import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import {
  determinarVersaoCanonica,
  versaoStatusToItemStatus,
  versaoStatusToEntregaStatus,
} from '../../shared/versaoCanonica.ts';

/**
 * Fase 2A — Reconciliação de versões de entrega (modelo entidade_versao).
 *
 * NÃO executa durante listagens. Deve ser chamada explicitamente ou via automação.
 *
 * Etapas:
 *  1. Determinar versão canônica
 *  2. Marcar versões duplicadas (idempotency_key + payload_hash)
 *  3. Marcar versões não-canônicas ativas como substituida
 *  4. Atualizar caches de EntregaDemanda
 *  5. Sincronizar ItemDemanda.status_aprovacao
 *  6. Retomar OperacaoEntrega parcial (há mais de 5 min)
 *  6.5. Retomar RespostaAprovacaoEntrega pendente ou com falha
 *  6.6. Deduplicar RespostaAprovacaoEntrega por assinatura completa
 *  6.7. Deduplicar OperacaoEntrega por assinatura completa
 *  7. TimelineEvent de conflito ou reconciliação
 *
 * Assinatura completa RespostaAprovacaoEntrega:
 *  (idempotency_key, entrega_id, versao_uid, tipo_resposta)
 *
 * Assinatura completa OperacaoEntrega:
 *  (idempotency_key, tipo_operacao, entrega_id, payload_hash)
 *
 * Falhas NÃO são ocultadas — cada etapa registra (etapa, mensagem, timestamp).
 * Retorno informa: success, success_partial, failure.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Usuário não autenticado.' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso negado. Apenas admins podem executar reconciliação.' }, { status: 403 });

    const sdk = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { entrega_id, all } = body;
    if (!entrega_id && !all) return Response.json({ error: 'Forneça entrega_id ou all=true.' }, { status: 400 });

    const agora = new Date().toISOString();
    const resultados = [];
    let totalSuccess = 0, totalPartial = 0, totalFailure = 0;

    let entregasParaReconciliar = [];
    if (all) {
      entregasParaReconciliar = await sdk.entities.EntregaDemanda.filter(
        { modelo_versionamento: 'entidade_versao' }, '-created_date', 500
      );
    } else {
      const arr = await sdk.entities.EntregaDemanda.filter({ id: entrega_id });
      const e = arr[0];
      if (!e) return Response.json({ error: 'EntregaDemanda não encontrada.' }, { status: 404 });
      if (e.modelo_versionamento !== 'entidade_versao') {
        return Response.json({ error: `EntregaDemanda usa modelo '${e.modelo_versionamento}'. Reconciliação aplicável apenas a 'entidade_versao'.` }, { status: 400 });
      }
      entregasParaReconciliar = [e];
    }

    for (const entrega of entregasParaReconciliar) {
      const resultado = { entrega_id: entrega.id, item_titulo: entrega.item_titulo, acoes: [], falhas: [] };
      let hasFailure = false, hasPartial = false;

      const registrarFalha = (etapa, erro) => {
        resultado.falhas.push({ etapa, mensagem: erro.message || String(erro), timestamp: new Date().toISOString() });
        hasFailure = true;
      };

      // 1. Determinar versão canônica
      let canonico;
      try {
        canonico = await determinarVersaoCanonica(sdk, entrega.id);
      } catch (e) {
        registrarFalha('determinar_versao_canonica', e);
        resultado.status = 'failure';
        totalFailure++;
        resultados.push(resultado);
        continue;
      }

      const { versao_canonica, versoes_validas, tem_concorrencia, numero_versao_canonica } = canonico;
      if (!versao_canonica) {
        resultado.acoes.push('sem_versoes_validas');
        resultado.status = 'success';
        totalSuccess++;
        resultados.push(resultado);
        continue;
      }

      // 2. Marcar versões duplicadas (idempotency_key + payload_hash)
      try {
        const grupos = {};
        for (const v of versoes_validas) {
          const key = `${v.idempotency_key || ''}|${v.payload_hash || ''}`;
          if (!grupos[key]) grupos[key] = [];
          grupos[key].push(v);
        }
        for (const [key, versoesGrupo] of Object.entries(grupos)) {
          if (versoesGrupo.length <= 1) continue;
          const ordenadas = [...versoesGrupo].sort((a, b) => {
            const cmp = (a.created_date || '').localeCompare(b.created_date || '');
            return cmp !== 0 ? cmp : (a.versao_uid || '').localeCompare(b.versao_uid || '');
          });
          const versaoVencedora = ordenadas[ordenadas.length - 1];
          for (let i = 0; i < ordenadas.length - 1; i++) {
            const v = ordenadas[i];
            if ((v.status_canonico || 'ativa') === 'ativa') {
              await sdk.entities.VersaoEntregaDemanda.update(v.id, {
                status_canonico: 'duplicada', substituida_em: agora,
                substituida_por_versao_uid: versaoVencedora.versao_uid,
              });
              resultado.acoes.push(`versao_${v.numero_exibicao || '?'}_marcada_duplicada`);
              if (v.operacao_id) {
                const opsArr = await sdk.entities.OperacaoEntrega.filter({ operacao_id: v.operacao_id });
                if (opsArr[0] && opsArr[0].status_operacao !== 'duplicada') {
                  await sdk.entities.OperacaoEntrega.update(opsArr[0].id, {
                    status_operacao: 'duplicada', operacao_canonica_id: versaoVencedora.operacao_id, concluida_em: agora,
                  });
                }
              }
            }
          }
        }
      } catch (e) { registrarFalha('marcar_versoes_duplicadas', e); }

      // 3. Marcar versões não-canônicas ativas como substituida
      try {
        for (const v of versoes_validas) {
          if (v.versao_uid === versao_canonica.versao_uid) continue;
          const sc = v.status_canonico || 'ativa';
          if (sc === 'ativa' && !v.substituida_em) {
            await sdk.entities.VersaoEntregaDemanda.update(v.id, {
              status_canonico: 'substituida', substituida_em: agora,
              substituida_por_versao_uid: versao_canonica.versao_uid,
            });
            resultado.acoes.push(`versao_${v.numero_exibicao_calculado}_marcada_substituida`);
          }
        }
      } catch (e) { registrarFalha('marcar_versoes_substituidas', e); }

      // 4. Atualizar caches de EntregaDemanda
      try {
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
      } catch (e) { registrarFalha('atualizar_caches_entrega', e); }

      // 5. Sincronizar ItemDemanda
      try {
        if (entrega.item_demanda_id) {
          const novoStatusItem = versaoStatusToItemStatus(versao_canonica.status);
          const itemArr = await sdk.entities.ItemDemanda.filter({ id: entrega.item_demanda_id });
          const item = itemArr[0];
          if (item && item.status_aprovacao !== novoStatusItem) {
            await sdk.entities.ItemDemanda.update(item.id, { status_aprovacao: novoStatusItem });
            resultado.acoes.push(`item_sincronizado:${novoStatusItem}`);
          }
        }
      } catch (e) { registrarFalha('sincronizar_item_demanda', e); }

      // 6. Retomar OperacaoEntrega parcial (há mais de 5 min)
      try {
        const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const opsParciais = await sdk.entities.OperacaoEntrega.filter(
          { entrega_id: entrega.id, status_operacao: { $in: ['iniciada', 'em_execucao', 'parcial', 'falha'] } },
          'created_date', 20
        );
        for (const op of opsParciais) {
          if (op.created_date && op.created_date < cincoMinAtras) {
            if (op.status_operacao !== 'parcial') {
              await sdk.entities.OperacaoEntrega.update(op.id, {
                status_operacao: 'parcial', etapa_atual: 'reconciliacao_marcada',
              });
              resultado.acoes.push(`operacao_${op.operacao_id.substring(0, 8)}_marcada_parcial`);
            }
          }
        }
      } catch (e) { registrarFalha('retomar_operacoes_parciais', e); }

      // 6.5. Retomar RespostaAprovacaoEntrega pendente ou com falha
      // PRECONDIÇÕES OBRIGATÓRIAS antes de aplicar:
      //   a) versão respondida ainda é a versão canônica
      //   b) status atual da versão canônica é em_aprovacao ou reenviado
      //   c) não existe resposta canônica aplicada mais recente para a mesma versão
      //   d) operação vinculada à resposta não foi marcada como duplicada
      // Se qualquer precondição falhar: marcar resposta como duplicada (obsoleta),
      //   NÃO alterar VersaoEntregaDemanda, ItemDemanda, caches, timeline ou notificação.
      try {
        const respostasPendentes = await sdk.entities.RespostaAprovacaoEntrega.filter(
          { entrega_id: entrega.id, status_aplicacao: { $in: ['pendente_aplicacao', 'falha_aplicacao'] } },
          'created_date', 20
        );
        // Buscar todas as respostas aplicadas da entrega para verificação de precedência
        const respostasAplicadas = await sdk.entities.RespostaAprovacaoEntrega.filter(
          { entrega_id: entrega.id, status_aplicacao: 'aplicada' },
          'created_date', 50
        );
        for (const resp of respostasPendentes) {
          try {
            let versaoResp = null;
            if (resp.versao_entrega_demanda_id) {
              const vArr = await sdk.entities.VersaoEntregaDemanda.filter({ id: resp.versao_entrega_demanda_id });
              versaoResp = vArr[0];
            }
            if (!versaoResp) {
              resultado.acoes.push(`resposta_${resp.id.substring(0, 8)}_versao_inexistente`);
              continue;
            }
            // Precondição (a): versão respondida ainda é a canônica
            if (versaoResp.versao_uid !== versao_canonica.versao_uid) {
              await sdk.entities.RespostaAprovacaoEntrega.update(resp.id, {
                status_aplicacao: 'duplicada',
                erro_aplicacao_detalhe: 'Versão respondida foi substituída por uma mais recente.',
              });
              resultado.acoes.push(`resposta_${resp.id.substring(0, 8)}_obsoleta_versao_substituida`);
              continue;
            }
            // Precondição (b): status atual da versão canônica permite retomada
            const statusPermiteRetomada = ['em_aprovacao', 'reenviado'].includes(versao_canonica.status);
            if (!statusPermiteRetomada) {
              await sdk.entities.RespostaAprovacaoEntrega.update(resp.id, {
                status_aplicacao: 'duplicada',
                erro_aplicacao_detalhe: `Versão canônica já está em estado terminal (${versao_canonica.status}). Resposta obsoleta — não aplicada por existir estado canônico mais recente.`,
              });
              resultado.acoes.push(`resposta_${resp.id.substring(0, 8)}_obsoleta_status_${versao_canonica.status}`);
              continue;
            }
            // Precondição (c): não existe resposta aplicada mais recente para a mesma versão
            const existeRespostaMaisRecente = respostasAplicadas.some(r =>
              r.id !== resp.id &&
              r.versao_uid === versaoResp.versao_uid &&
              (r.created_date || '') >= (resp.created_date || '')
            );
            if (existeRespostaMaisRecente) {
              await sdk.entities.RespostaAprovacaoEntrega.update(resp.id, {
                status_aplicacao: 'duplicada',
                erro_aplicacao_detalhe: 'Existe resposta canônica aplicada mais recente para esta versão. Resposta obsoleta — não aplicada.',
              });
              resultado.acoes.push(`resposta_${resp.id.substring(0, 8)}_obsoleta_resposta_mais_recente`);
              continue;
            }
            // Precondição (d): operação vinculada não foi marcada como duplicada
            if (resp.operacao_id) {
              const opRespArr = await sdk.entities.OperacaoEntrega.filter({ operacao_id: resp.operacao_id });
              const opResp = opRespArr[0];
              if (opResp && opResp.status_operacao === 'duplicada') {
                await sdk.entities.RespostaAprovacaoEntrega.update(resp.id, {
                  status_aplicacao: 'duplicada',
                  erro_aplicacao_detalhe: 'Operação vinculada foi marcada como duplicada. Resposta obsoleta — não aplicada.',
                });
                resultado.acoes.push(`resposta_${resp.id.substring(0, 8)}_obsoleta_operacao_duplicada`);
                continue;
              }
            }
            // Todas as precondições atendidas — aplicar resposta
            const novoStatusVersao = resp.tipo_resposta === 'aprovado' ? 'aprovado' : 'solicitacao_alteracao';
            await sdk.entities.VersaoEntregaDemanda.update(versaoResp.id, {
              status: novoStatusVersao,
              ...(resp.tipo_resposta === 'aprovado' ? { aprovada_em: resp.data_resposta, aprovada_por: resp.nome_responsavel } : {}),
            });
            if (versaoResp.item_demanda_id) {
              const novoStatusItem = versaoStatusToItemStatus(novoStatusVersao);
              await sdk.entities.ItemDemanda.update(versaoResp.item_demanda_id, { status_aprovacao: novoStatusItem });
            }
            await sdk.entities.EntregaDemanda.update(entrega.id, {
              status_entrega_cache: novoStatusVersao, retorno_cliente_tratado: false,
            });
            await sdk.entities.RespostaAprovacaoEntrega.update(resp.id, {
              status_aplicacao: 'aplicada', aplicada_em: new Date().toISOString(),
            });
            if (resp.operacao_id) {
              const opsArr = await sdk.entities.OperacaoEntrega.filter({ operacao_id: resp.operacao_id });
              if (opsArr[0]) {
                await sdk.entities.OperacaoEntrega.update(opsArr[0].id, {
                  status_operacao: 'concluida', etapa_atual: 'resposta_aplicada_reconciliacao',
                  versao_uid: versaoResp.versao_uid, concluida_em: new Date().toISOString(),
                });
              }
            }
            resultado.acoes.push(`resposta_${resp.id.substring(0, 8)}_aplicada_reconciliacao`);
          } catch (e) {
            registrarFalha(`retomar_resposta_${resp.id.substring(0, 8)}`, e);
            hasPartial = true;
          }
        }
      } catch (e) { registrarFalha('retomar_respostas_pendentes', e); }

      // 6.6. Deduplicar RespostaAprovacaoEntrega por assinatura completa
      // Assinatura: (idempotency_key, entrega_id, versao_uid, tipo_resposta)
      try {
        const todasRespostas = await sdk.entities.RespostaAprovacaoEntrega.filter(
          { entrega_id: entrega.id }, 'created_date', 50
        );
        const gruposResp = {};
        for (const r of todasRespostas) {
          if (!r.idempotency_key) continue;
          const key = `${r.idempotency_key}|${r.versao_uid || ''}|${r.tipo_resposta || ''}`;
          if (!gruposResp[key]) gruposResp[key] = [];
          gruposResp[key].push(r);
        }
        for (const [key, respostasGroup] of Object.entries(gruposResp)) {
          if (respostasGroup.length <= 1) continue;
          const ordenadas = [...respostasGroup].sort((a, b) => {
            const cmp = (a.created_date || '').localeCompare(b.created_date || '');
            return cmp !== 0 ? cmp : (a.id || '').localeCompare(b.id || '');
          });
          const respostaVencedora = ordenadas[0];
          const operacaoCanonicaId = respostaVencedora.operacao_id;
          for (let i = 1; i < ordenadas.length; i++) {
            const r = ordenadas[i];
            if (r.status_aplicacao !== 'duplicada') {
              await sdk.entities.RespostaAprovacaoEntrega.update(r.id, {
                status_aplicacao: 'duplicada',
                erro_aplicacao_detalhe: `Resposta duplicada na reconciliação. Assinatura: idempotency_key=${r.idempotency_key}, versao_uid=${r.versao_uid}, tipo_resposta=${r.tipo_resposta}. Operação canônica: ${operacaoCanonicaId || 'desconhecida'}.`,
              });
              if (r.operacao_id) {
                const opsArr = await sdk.entities.OperacaoEntrega.filter({ operacao_id: r.operacao_id });
                if (opsArr[0] && opsArr[0].status_operacao !== 'duplicada') {
                  await sdk.entities.OperacaoEntrega.update(opsArr[0].id, {
                    status_operacao: 'duplicada', operacao_canonica_id: operacaoCanonicaId, concluida_em: agora,
                  });
                }
              }
              // Excluir notificação duplicada (registrado explicitamente, não silencioso)
              const notifsDup = await sdk.entities.NotificacaoAprovacao.filter(
                { operacao_id: r.operacao_id }, 'created_date', 5
              );
              for (const nd of notifsDup) {
                await sdk.entities.NotificacaoAprovacao.delete(nd.id);
                resultado.acoes.push(`notificacao_${nd.id.substring(0, 8)}_deduplicada_excluida`);
              }
              resultado.acoes.push(`resposta_${r.id.substring(0, 8)}_deduplicada`);
            }
          }
        }
      } catch (e) { registrarFalha('deduplicar_respostas', e); }

      // 6.7. Deduplicar OperacaoEntrega por assinatura completa
      // Assinatura: (idempotency_key, tipo_operacao, entrega_id, payload_hash)
      try {
        const todasOps = await sdk.entities.OperacaoEntrega.filter(
          { entrega_id: entrega.id }, 'created_date', 100
        );
        const gruposOps = {};
        for (const o of todasOps) {
          if (!o.idempotency_key) continue;
          const key = `${o.idempotency_key}|${o.tipo_operacao || ''}|${o.payload_hash || ''}`;
          if (!gruposOps[key]) gruposOps[key] = [];
          gruposOps[key].push(o);
        }
        for (const [key, opsGroup] of Object.entries(gruposOps)) {
          if (opsGroup.length <= 1) continue;
          const ordenadas = [...opsGroup].sort((a, b) => {
            const cmp = (a.created_date || '').localeCompare(b.created_date || '');
            return cmp !== 0 ? cmp : (a.operacao_id || '').localeCompare(b.operacao_id || '');
          });
          const opVencedora = ordenadas[0];
          for (let i = 1; i < ordenadas.length; i++) {
            const o = ordenadas[i];
            if (o.status_operacao !== 'duplicada') {
              await sdk.entities.OperacaoEntrega.update(o.id, {
                status_operacao: 'duplicada', operacao_canonica_id: opVencedora.operacao_id, concluida_em: agora,
              });
              resultado.acoes.push(`operacao_${o.operacao_id.substring(0, 8)}_deduplicada`);
            }
          }
        }
      } catch (e) { registrarFalha('deduplicar_operacoes', e); }

      // 7. TimelineEvent de conflito
      if (tem_concorrencia) {
        try {
          await sdk.entities.TimelineEvent.create({
            demanda_id: entrega.demanda_id, cliente_id: entrega.cliente_id,
            item_demanda_id: entrega.item_demanda_id || null, entrega_demanda_id: entrega.id,
            versao_uid: versao_canonica.versao_uid, tipo: 'conflito_versao',
            descricao: `⚠️ Conflito de versões detectado em "${entrega.item_titulo || entrega.nome_entrega}". Versão canônica: v${numero_versao_canonica}. ${canonico.total_validas} versões candidatas.`,
            autor: user.full_name || user.email, autor_tipo: 'voxx',
          });
        } catch (e) { registrarFalha('criar_timeline_conflito', e); }
      }

      resultado.acoes.push(`versao_canonica:v${numero_versao_canonica}`);
      resultado.tem_concorrencia = tem_concorrencia;

      if (hasFailure && resultado.acoes.length <= 1) {
        resultado.status = 'failure';
        totalFailure++;
      } else if (hasFailure || hasPartial) {
        resultado.status = 'success_partial';
        totalPartial++;
      } else {
        resultado.status = 'success';
        totalSuccess++;
      }
      resultados.push(resultado);
    }

    return Response.json({
      success: totalFailure === 0,
      success_partial: totalPartial,
      failure: totalFailure,
      reconciliadas: resultados.length,
      resultados,
      timestamp: agora,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});