import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ZAPI_BASE = 'https://api.z-api.io';

// --- Credenciais Z-API ---
async function getZapiCredentials(base44) {
  const configs = await base44.asServiceRole.entities.ConfiguracaoZapi.list('-created_date', 1).catch(() => []);
  const entityConfig = configs?.[0];
  return {
    zapiInstanceId: entityConfig?.instance_id || Deno.env.get('ZAPI_INSTANCE_ID'),
    zapiToken: entityConfig?.token_instancia || Deno.env.get('ZAPI_TOKEN'),
    zapiClientToken: entityConfig?.token_global || Deno.env.get('ZAPI_CLIENT_TOKEN'),
  };
}

// --- Configuração de lembretes ---
async function getConfiguracao(sdk) {
  const configs = await sdk.entities.ConfiguracaoLembreteAprovacao.list('-created_date', 1).catch(() => []);
  const cfg = configs?.[0];
  if (!cfg) return null;
  return {
    ativo: cfg.ativo !== false,
    intervalos: cfg.intervalos_horas_uteis || [24, 48],
    mensagens: cfg.mensagens_lembrete || [],
    setores: cfg.setores_ativos || [],
    maxAuto: cfg.max_mensagens_automaticas ?? 2,
  };
}

// --- Horário útil (America/Sao_Paulo) ---
const BLOCOS_MINUTOS = [
  { inicio: 8 * 60, fim: 12 * 60 },
  { inicio: 13 * 60 + 13, fim: 18 * 60 },
];

function calcularMinutosUteis(inicio, fim) {
  const i = new Date(inicio);
  const f = new Date(fim);
  if (isNaN(i) || isNaN(f) || f <= i) return 0;

  let cursor = new Date(i);
  let total = 0;

  while (cursor < f) {
    const localStr = cursor.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const localDate = new Date(localStr);
    const diaSemana = localDate.getDay();
    const ehFimDeSemana = diaSemana === 0 || diaSemana === 6;

    if (!ehFimDeSemana) {
      const fimDiaLocal = new Date(localDate);
      fimDiaLocal.setHours(23, 59, 59, 999);
      const limiteMs = f < fimDiaLocal ? f.getTime() : fimDiaLocal.getTime();

      const minsCursor = localDate.getHours() * 60 + localDate.getMinutes();
      const limiteLocal = new Date(limiteMs);
      const limiteStr = limiteLocal.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
      const limiteDate = new Date(limiteStr);
      const minsLimite = limiteDate.getHours() * 60 + limiteDate.getMinutes();

      for (const b of BLOCOS_MINUTOS) {
        const iniBloco = Math.max(minsCursor, b.inicio);
        const fimBloco = Math.min(minsLimite, b.fim);
        if (iniBloco < fimBloco) total += fimBloco - iniBloco;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }
  return total;
}

// --- Templates padrão ---
const DEFAULT_MENSAGENS = [
  'Olá {{cliente}}! 👋\n\nPassando para lembrar que enviamos a entrega *"{{entrega}}"* para sua aprovação.\n\n📎 Link para aprovar: {{link}}\n\nQualquer dúvida, estamos à disposição!',
  '*{{cliente}}*, tudo bem?\n\nAinda não recebemos sua aprovação para a entrega *"{{entrega}}"*.\n\nSabemos que a rotina é corrida, mas sua aprovação é importante para darmos continuidade ao projeto.\n\n📎 Aprove aqui: {{link}}\n\nPrecisa de algum ajuste? É só nos avisar!',
];

function formatarMensagem(template, clienteNome, entregaNome, link) {
  return template
    .replace(/\{\{cliente\}\}/g, clienteNome)
    .replace(/\{\{entrega\}\}/g, entregaNome)
    .replace(/\{\{link\}\}/g, link);
}

// --- Envio WhatsApp ---
async function enviarWhatsApp(grupoId, mensagem, zapiCreds) {
  const { zapiInstanceId, zapiToken, zapiClientToken } = zapiCreds;

  if (!zapiInstanceId || !zapiToken || !zapiClientToken) return false;

  const statusResp = await fetch(`${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/status`, {
    headers: { 'Client-Token': zapiClientToken }
  });
  const statusData = await statusResp.json().catch(() => ({}));
  if (!statusData.connected) return false;

  const sendResp = await fetch(`${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/send-text`, {
    method: 'POST',
    headers: { 'Client-Token': zapiClientToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: grupoId, message: mensagem })
  });
  return sendResp.ok;
}

// --- Batch loader: busca todos os dados necessários de uma vez ---
async function carregarDados(sdk, envios) {
  // Coleta todos os IDs únicos
  const entregaIds = [...new Set(envios.map(e => e.entrega_id).filter(Boolean))];
  const demandaIds = [...new Set(envios.map(e => e.demanda_id).filter(Boolean))];

  // Busca lotes por IDs
  const entregas = entregaIds.length > 0
    ? await sdk.entities.EntregaDemanda.list('-updated_date', 500)
    : [];
  const demandas = demandaIds.length > 0
    ? await sdk.entities.Demanda.list('-updated_date', 500)
    : [];
  const tarefas = await sdk.entities.TarefaAcompanhamento.list('-updated_date', 500);
  const demandasIntervencao = await sdk.entities.Demanda.filter(
    { tags: 'aprovacao_pendente' }, '-created_date', 500
  ).catch(() => []);

  // Mapas para acesso rápido
  const entregasMap = {};
  entregas.forEach(e => { entregasMap[e.id] = e; });
  const demandasMap = {};
  demandas.forEach(d => { demandasMap[d.id] = d; });
  const tarefasMap = {};
  tarefas.forEach(t => { if (t.envio_aprovacao_id) tarefasMap[t.envio_aprovacao_id] = t; });
  const intervencaoMap = {};
  demandasIntervencao.forEach(d => { if (d.titulo) intervencaoMap[d.titulo] = d; });

  return { entregasMap, demandasMap, tarefasMap, intervencaoMap };
}

// --- MAIN ---
Deno.serve(async (_req) => {
  try {
    const base44 = createClientFromRequest(_req);
    const sdk = base44.asServiceRole;
    const agora = new Date().toISOString();

    const cfg = await getConfiguracao(sdk);
    if (!cfg || !cfg.ativo) {
      return Response.json({ success: true, processados: 0, lembretesEnviados: 0, intervencoes: 0, motivo: 'automacao_inativa' });
    }

    const intervalos = cfg.intervalos.length > 0 ? cfg.intervalos : [24, 48];
    const maxAuto = cfg.maxAuto ?? 2;
    const templates = cfg.mensagens.length > 0 ? cfg.mensagens : DEFAULT_MENSAGENS;
    const setoresFiltro = cfg.setores.length > 0 ? cfg.setores : null;

    // Buscar envios de aprovação com status enviado
    const envios = await sdk.entities.EnvioAprovacaoWhatsApp.filter(
      { status_envio: 'enviado' }, '-enviado_em', 500
    );

    // Carregar todos os dados em lote (poucas chamadas)
    const { entregasMap, demandasMap, tarefasMap, intervencaoMap } = await carregarDados(sdk, envios);

    // Buscar credenciais Z-API uma vez
    const zapiCreds = await getZapiCredentials(base44);

    let processados = 0;
    let lembretesEnviados = 0;
    let intervencoes = 0;

    for (const envio of envios) {
      const entrega = entregasMap[envio.entrega_id];
      const demanda = demandasMap[envio.demanda_id];

      // Filtrar por setor (se configurado)
      if (setoresFiltro) {
        const setor = entrega?.setor || demanda?.setor;
        if (setor && !setoresFiltro.includes(setor)) continue;
      }

      // Verificar se a entrega ainda está em aprovação
      if (!entrega || entrega.status_entrega !== 'em_aprovacao') continue;

      let tarefa = tarefasMap[envio.id] || null;

      const clienteNome = envio.cliente_nome || 'Cliente';
      const entregaNome = envio.entrega_nome || 'entrega';
      const link = envio.link_aprovacao || '';

      if (!tarefa) {
        // Primeira vez: verificar se passou o primeiro intervalo
        const minsUteis = calcularMinutosUteis(envio.enviado_em, agora);
        const limiteMin = (intervalos[0] || 24) * 60;
        if (minsUteis < limiteMin) continue;

        const template = templates[0] || DEFAULT_MENSAGENS[0];
        const mensagem = formatarMensagem(template, clienteNome, entregaNome, link);

        const enviado = await enviarWhatsApp(envio.whatsapp_grupo_id, mensagem, zapiCreds);

        tarefa = await sdk.entities.TarefaAcompanhamento.create({
          cliente_id: envio.cliente_id,
          cliente_nome: envio.cliente_nome,
          entrega_id: envio.entrega_id,
          entrega_nome: envio.entrega_nome,
          demanda_id: envio.demanda_id || null,
          demanda_titulo: envio.demanda_titulo || null,
          envio_aprovacao_id: envio.id,
          whatsapp_grupo_id: envio.whatsapp_grupo_id,
          sequencia_lembrete: 1,
          status: 'pendente',
          data_ultimo_lembrete: agora,
          mensagem_enviada: mensagem,
          link_aprovacao: link,
        });

        await sdk.entities.WhatsappEnvioLog.create({
          cliente_id: envio.cliente_id,
          cliente_nome: envio.cliente_nome,
          grupo_id: envio.whatsapp_grupo_id,
          tipo_envio: 'texto',
          origem: 'aprovacao_entrega',
          origem_id: envio.id,
          mensagem,
          status_envio: enviado ? 'enviado' : 'erro',
          enviado_por: 'sistema',
          enviado_em: agora,
        });

        // Atualiza mapa local
        tarefasMap[envio.id] = tarefa;
        lembretesEnviados++;
        processados++;
        continue;
      }

      if (tarefa.status === 'concluida') continue;

      const minsDesdeUltimo = calcularMinutosUteis(tarefa.data_ultimo_lembrete, agora);
      const seq = tarefa.sequencia_lembrete;

      if (tarefa.status === 'intervencao_humana') {
        // Criar demanda de intervenção se ainda não existe
        const demandaTitulo = `Lembrete Pendente: Aprovação "${envio.entrega_nome}" - ${envio.cliente_nome}`;
        
        if (!intervencaoMap[demandaTitulo]) {
          const novaDemanda = await sdk.entities.Demanda.create({
            cliente_id: envio.cliente_id,
            cliente_nome: envio.cliente_nome,
            setor: 'ATENDIMENTO',
            setor_responsavel_original: 'ATENDIMENTO',
            titulo: demandaTitulo,
            descricao: `⚠️ O cliente não respondeu a ${maxAuto} lembretes automáticos de aprovação.\n\n📎 Link: ${link}\n📅 Envio original: ${envio.enviado_em}\n💬 Último lembrete: ${tarefa.data_ultimo_lembrete}\n\nAção necessária: Contato humano para verificar a situação.`,
            status: 'recebida',
            prioridade: 'alta',
            tags: ['aprovacao_pendente', 'intervencao_humana'],
            ultima_atividade_kanban: agora,
          });
          intervencaoMap[demandaTitulo] = novaDemanda;
          intervencoes++;
        }
        continue;
      }

      // Tarefa pendente: verificar próximo intervalo
      if (seq < maxAuto) {
        // Próximo lembrete automático
        const idxIntervalo = seq;
        const limiteMin = (intervalos[idxIntervalo] || intervalos[intervalos.length - 1] || 24) * 60;

        if (minsDesdeUltimo >= limiteMin) {
          const idxTemplate = seq;
          const template = templates[idxTemplate] || DEFAULT_MENSAGENS[Math.min(idxTemplate, DEFAULT_MENSAGENS.length - 1)];
          const mensagem = formatarMensagem(template, clienteNome, entregaNome, link);

          const enviado = await enviarWhatsApp(envio.whatsapp_grupo_id, mensagem, zapiCreds);

          await sdk.entities.TarefaAcompanhamento.update(tarefa.id, {
            sequencia_lembrete: seq + 1,
            data_ultimo_lembrete: agora,
            mensagem_enviada: mensagem,
          });

          await sdk.entities.WhatsappEnvioLog.create({
            cliente_id: envio.cliente_id,
            cliente_nome: envio.cliente_nome,
            grupo_id: envio.whatsapp_grupo_id,
            tipo_envio: 'texto',
            origem: 'aprovacao_entrega',
            origem_id: envio.id,
            mensagem,
            status_envio: enviado ? 'enviado' : 'erro',
            enviado_por: 'sistema',
            enviado_em: agora,
          });

          lembretesEnviados++;
        }
      } else {
        // Já atingiu maxAuto: verificar último intervalo para intervenção
        // O último intervalo da lista sempre define o tempo para intervenção humana
        const idxUltimo = intervalos.length - 1;
        const limiteMin = (intervalos[idxUltimo] || 24) * 60;

        if (minsDesdeUltimo >= limiteMin) {
          await sdk.entities.TarefaAcompanhamento.update(tarefa.id, {
            status: 'intervencao_humana',
            data_ultimo_lembrete: agora,
          });
        }
      }

      processados++;
    }

    return Response.json({
      success: true,
      processados,
      lembretesEnviados,
      intervencoes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});