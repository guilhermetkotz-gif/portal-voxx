import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import {
  determinarVersaoCanonica,
  determinarOperacaoCanonica,
  versaoStatusToItemStatus,
  versaoStatusToEntregaStatus,
  STATUS_CANONICO_EXCLUIDOS,
} from '../../shared/versaoCanonica.ts';

/**
 * Fase 2A — Reconciliação de versões de entrega (modelo entidade_versao).
 *
 * NÃO executa durante listagens. Deve ser chamada explicitamente ou via automação.
 *
 * A função:
 *  1. Identifica operações duplicadas e marca versões ligadas como 'duplicada'
 *  2. Determina a versão vigente (canônica)
 *  3. Marca versões não-canônicas ativas como 'substituida'
 *  4. Atualiza caches de EntregaDemanda
 *  5. Sincroniza ItemDemanda.status_aprovacao
 *  6. Retoma OperacaoEntrega parcial (registros em 'parcial' há mais de 5 min)
 *  7. Registra TimelineEvent de conflito ou reconciliação
 *
 * Payload:
 *  - entrega_id: string (reconcilia uma entrega específica)
 *  - all: true (reconcilia todas as entregas com modelo_versionamento='entidade_versao')
 *  - admin_only: true (requer role=admin)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Usuário não autenticado.' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado. Apenas admins podem executar reconciliação.' }, { status: 403 });
    }

    const sdk = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { entrega_id, all } = body;

    if (!entrega_id && !all) {
      return Response.json({ error: 'Forneça entrega_id ou all=true.' }, { status: 400 });
    }

    const agora = new Date().toISOString();
    const resultados = [];

    // Coletar EntregaDemanda para reconciliar
    let entregasParaReconciliar = [];
    if (all) {
      entregasParaReconciliar = await sdk.entities.EntregaDemanda.filter(
        { modelo_versionamento: 'entidade_versao' },
        '-created_date',
        500
      );
    } else {
      const arr = await sdk.entities.EntregaDemanda.filter({ id: entrega_id });
      const e = arr[0];
      if (!e) {
        return Response.json({ error: 'EntregaDemanda não encontrada.' }, { status: 404 });
      }
      if (e.modelo_versionamento !== 'entidade_versao') {
        return Response.json({
          error: `EntregaDemanda usa modelo '${e.modelo_versionamento}'. Reconciliação aplicável apenas a 'entidade_versao'.`,
        }, { status: 400 });
      }
      entregasParaReconciliar = [e];
    }

    for (const entrega of entregasParaReconciliar) {
      const resultado = { entrega_id: entrega.id, item_titulo: entrega.item_titulo, acoes: [] };

      // 1. Determinar versão canônica (somente leitura)
      const canonico = await determinarVersaoCanonica(sdk, entrega.id);
      const { versao_canonica, versoes_validas, tem_concorrencia, numero_versao_canonica } = canonico;

      if (!versao_canonica) {
        resultado.acoes.push('sem_versoes_validas');
        resultados.push(resultado);
        continue;
      }

      // 2. Identificar e marcar operações duplicadas
      // Agrupar versões por (idempotency_key, tipo_operacao, payload_hash)
      const grupos = {};
      for (const v of versoes_validas) {
        const key = `${v.idempotency_key || ''}|${v.payload_hash || ''}`;
        if (!grupos[key]) grupos[key] = [];
        grupos[key].push(v);
      }

      for (const [key, versoesGrupo] of Object.entries(grupos)) {
        if (versoesGrupo.length <= 1) continue;

        // Ordenar por created_date ASC, versao_uid ASC
        const ordenadas = [...versoesGrupo].sort((a, b) => {
          const cmp = (a.created_date || '').localeCompare(b.created_date || '');
          if (cmp !== 0) return cmp;
          return (a.versao_uid || '').localeCompare(b.versao_uid || '');
        });

        const versaoVencedora = ordenadas[ordenadas.length - 1];

        // Marcar as outras como duplicada
        for (let i = 0; i < ordenadas.length - 1; i++) {
          const v = ordenadas[i];
          if ((v.status_canonico || 'ativa') === 'ativa') {
            await sdk.entities.VersaoEntregaDemanda.update(v.id, {
              status_canonico: 'duplicada',
              substituida_em: agora,
              substituida_por_versao_uid: versaoVencedora.versao_uid,
            });
            resultado.acoes.push(`versao_${v.numero_exibicao || '?'}_marcada_duplicada`);

            // Marcar OperacaoEntrega correspondente como duplicada
            if (v.operacao_id) {
              const opsArr = await sdk.entities.OperacaoEntrega.filter({ operacao_id: v.operacao_id });
              if (opsArr[0] && opsArr[0].status_operacao !== 'duplicada') {
                await sdk.entities.OperacaoEntrega.update(opsArr[0].id, {
                  status_operacao: 'duplicada',
                  operacao_canonica_id: versaoVencedora.operacao_id,
                  concluida_em: agora,
                });
              }
            }
          }
        }
      }

      // 3. Marcar versões não-canônicas ativas (que não são a vigente) como substituida
      for (const v of versoes_validas) {
        if (v.versao_uid === versao_canonica.versao_uid) continue;
        const sc = v.status_canonico || 'ativa';
        if (sc === 'ativa' && !v.substituida_em) {
          await sdk.entities.VersaoEntregaDemanda.update(v.id, {
            status_canonico: 'substituida',
            substituida_em: agora,
            substituida_por_versao_uid: versao_canonica.versao_uid,
          });
          resultado.acoes.push(`versao_${v.numero_exibicao_calculado}_marcada_substituida`);
        }
      }

      // 4. Atualizar caches de EntregaDemanda
      // Após os passos 2 e 3, todas as versões não-canônicas foram marcadas como
      // duplicada/substituida — o conflito foi resolvido, então tem_conflito_versao = false.
      const novoStatusCache = versaoStatusToEntregaStatus(versao_canonica.status);
      await sdk.entities.EntregaDemanda.update(entrega.id, {
        versao_atual_uid_cache: versao_canonica.versao_uid,
        numero_versao_atual_cache: numero_versao_canonica,
        status_entrega_cache: novoStatusCache,
        token_publico_cache: versao_canonica.token_publico,
        tem_conflito_versao: false,
        ultima_sincronizacao_em: agora,
      });
      resultado.acoes.push('caches_atualizados');

      // 5. Sincronizar ItemDemanda
      if (entrega.item_demanda_id) {
        const novoStatusItem = versaoStatusToItemStatus(versao_canonica.status);
        const itemArr = await sdk.entities.ItemDemanda.filter({ id: entrega.item_demanda_id });
        const item = itemArr[0];
        if (item && item.status_aprovacao !== novoStatusItem) {
          await sdk.entities.ItemDemanda.update(item.id, { status_aprovacao: novoStatusItem });
          resultado.acoes.push(`item_sincronizado:${novoStatusItem}`);
        }
      }

      // 6. Retomar OperacaoEntrega parcial (há mais de 5 min)
      const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const opsParciais = await sdk.entities.OperacaoEntrega.filter(
        { entrega_id: entrega.id, status_operacao: { $in: ['iniciada', 'em_execucao', 'parcial'] } },
        'created_date',
        20
      );
      for (const op of opsParciais) {
        if (op.created_date && op.created_date < cincoMinAtras) {
          // Marcar como parcial para retomada manual
          if (op.status_operacao !== 'parcial') {
            await sdk.entities.OperacaoEntrega.update(op.id, {
              status_operacao: 'parcial',
              etapa_atual: 'reconciliacao_marcada',
            });
            resultado.acoes.push(`operacao_${op.operacao_id.substring(0, 8)}_marcada_parcial`);
          }
        }
      }

      // 7. TimelineEvent de conflito ou reconciliação
      if (tem_concorrencia) {
        await sdk.entities.TimelineEvent.create({
          demanda_id: entrega.demanda_id,
          cliente_id: entrega.cliente_id,
          item_demanda_id: entrega.item_demanda_id || null,
          entrega_demanda_id: entrega.id,
          versao_uid: versao_canonica.versao_uid,
          tipo: 'conflito_versao',
          descricao: `⚠️ Conflito de versões detectado em "${entrega.item_titulo || entrega.nome_entrega}". Versão canônica: v${numero_versao_canonica}. ${canonico.total_validas} versões candidatas.`,
          autor: user.full_name || user.email,
          autor_tipo: 'voxx',
        });
      }

      resultado.acoes.push(`versao_canonica:v${numero_versao_canonica}`);
      resultado.tem_concorrencia = tem_concorrencia;
      resultados.push(resultado);
    }

    return Response.json({
      success: true,
      reconciliadas: resultados.length,
      resultados,
      timestamp: agora,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});