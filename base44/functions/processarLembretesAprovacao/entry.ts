import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ZAPI_BASE = 'https://api.z-api.io';

async function getZapiCredentials(base44) {
  const configs = await base44.asServiceRole.entities.ConfiguracaoZapi.list('-created_date', 1).catch(() => []);
  const entityConfig = configs?.[0];
  return {
    zapiInstanceId: entityConfig?.instance_id || Deno.env.get('ZAPI_INSTANCE_ID'),
    zapiToken: entityConfig?.token_instancia || Deno.env.get('ZAPI_TOKEN'),
    zapiClientToken: entityConfig?.token_global || Deno.env.get('ZAPI_CLIENT_TOKEN'),
  };
}

// Blocos de horário útil (America/Sao_Paulo): 08:00-12:00, 13:13-18:00
const BLOCOS_MINUTOS = [
  { inicio: 8 * 60, fim: 12 * 60 },
  { inicio: 13 * 60 + 13, fim: 18 * 60 },
];
const MINUTOS_UTEIS_DIA = BLOCOS_MINUTOS.reduce((s, b) => s + (b.fim - b.inicio), 0); // 527 min

function minutosUteisNoDia(minutos) {
  let t = 0;
  for (const b of BLOCOS_MINUTOS) {
    const ini = Math.max(minutos, b.inicio);
    if (ini < b.fim) t += b.fim - ini;
  }
  return t;
}

function calcularMinutosUteis(inicio, fim) {
  const i = new Date(inicio);
  const f = new Date(fim);
  if (isNaN(i) || isNaN(f) || f <= i) return 0;

  let cursor = new Date(i);
  let total = 0;

  while (cursor < f) {
    const dia = cursor.getUTCDay(); // 0=dom no UTC, mas usamos locale
    // Em BRT (UTC-3), getDay do local: 0=dom, 6=sab
    // Precisamos usar o dia local: reconstruir
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

// Templates de mensagem
function mensagemLembrete1(clienteNome, entregaNome, linkAprovacao) {
  return `Olá ${clienteNome}! 👋\n\nPassando para lembrar que enviamos a entrega *"${entregaNome}"* para sua aprovação.\n\n📎 Link para aprovar: ${linkAprovacao}\n\nQualquer dúvida, estamos à disposição!`;
}

function mensagemLembrete2(clienteNome, entregaNome, linkAprovacao) {
  return `*${clienteNome}*, tudo bem?\n\nAinda não recebemos sua aprovação para a entrega *"${entregaNome}"*.\n\nSabemos que a rotina é corrida, mas sua aprovação é importante para darmos continuidade ao projeto.\n\n📎 Aprove aqui: ${linkAprovacao}\n\nPrecisa de algum ajuste? É só nos avisar!`;
}

async function enviarWhatsApp(base44, grupoId, mensagem, zapiCreds) {
  const endpointLovable = Deno.env.get('ENDPOINT_LOVABLE_ENVIO');
  const { zapiInstanceId, zapiToken, zapiClientToken } = zapiCreds;

  if (endpointLovable) {
    const resp = await fetch(endpointLovable, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'lembrete_aprovacao', grupo_whatsapp_id: grupoId, mensagem, tipo_midia: 'texto' })
    });
    return resp.ok;
  }

  if (zapiInstanceId && zapiToken && zapiClientToken) {
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

  return false;
}

Deno.serve(async (_req) => {
  try {
    const base44 = createClientFromRequest(_req);
    const sdk = base44.asServiceRole;
    const agora = new Date().toISOString();

    // Buscar todos os envios de aprovação com status enviado
    const envios = await sdk.entities.EnvioAprovacaoWhatsApp.filter(
      { status_envio: 'enviado' }, '-enviado_em', 500
    );

    let processados = 0;
    let lembretesEnviados = 0;
    let intervencoes = 0;

    for (const envio of envios) {
      // Verificar se a entrega vinculada ainda está em aprovação
      const entregas = await sdk.entities.EntregaDemanda.filter({ id: envio.entrega_id }, '-updated_date', 1);
      const entrega = entregas[0];
      if (!entrega || entrega.status_entrega !== 'em_aprovacao') continue;

      // Buscar ou criar TarefaAcompanhamento
      const tarefasExistentes = await sdk.entities.TarefaAcompanhamento.filter(
        { envio_aprovacao_id: envio.id }, '-created_date', 1
      );
      let tarefa = tarefasExistentes[0] || null;

      if (!tarefa) {
        // Primeira vez: verificar se já passaram 24h úteis desde o envio
        const minsUteis = calcularMinutosUteis(envio.enviado_em, agora);
        if (minsUteis < 24 * 60) continue; // Ainda não deu 24h úteis

        // Criar tarefa e enviar 1º lembrete
        const mensagem = mensagemLembrete1(
          envio.cliente_nome || 'Cliente',
          envio.entrega_nome || 'entrega',
          envio.link_aprovacao || ''
        );

        const zapiCreds = await getZapiCredentials(base44);
        const enviado = await enviarWhatsApp(base44, envio.whatsapp_grupo_id, mensagem, zapiCreds);

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
          status: enviado ? 'pendente' : 'pendente',
          data_ultimo_lembrete: agora,
          mensagem_enviada: mensagem,
          link_aprovacao: envio.link_aprovacao || '',
        });

        // Registrar log
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
        processados++;
        continue;
      }

      // Tarefa já existe
      if (tarefa.status === 'concluida') continue; // Já resolvida
      if (tarefa.status === 'intervencao_humana') {
        // Criar demanda de intervenção se ainda não foi criada
        const demandasIntervencao = await sdk.entities.Demanda.filter({
          cliente_id: envio.cliente_id,
          titulo: `Lembrete Pendente: Aprovação "${envio.entrega_nome}" - ${envio.cliente_nome}`
        }, '-created_date', 1);
        
        if (demandasIntervencao.length === 0) {
          await sdk.entities.Demanda.create({
            cliente_id: envio.cliente_id,
            cliente_nome: envio.cliente_nome,
            setor: 'ATENDIMENTO',
            setor_responsavel_original: 'ATENDIMENTO',
            titulo: `Lembrete Pendente: Aprovação "${envio.entrega_nome}" - ${envio.cliente_nome}`,
            descricao: `⚠️ O cliente não respondeu a 2 lembretes automáticos de aprovação.\n\n📎 Link: ${envio.link_aprovacao}\n📅 Envio original: ${envio.enviado_em}\n💬 Último lembrete: ${tarefa.data_ultimo_lembrete}\n\nAção necessária: Contato humano para verificar a situação.`,
            status: 'recebida',
            prioridade: 'alta',
            tags: ['aprovacao_pendente', 'intervencao_humana'],
            ultima_atividade_kanban: agora,
          });
          intervencoes++;
        }
        continue;
      }

      // Tarefa pendente: verificar se é hora do próximo lembrete
      const minsDesdeUltimo = calcularMinutosUteis(tarefa.data_ultimo_lembrete, agora);

      if (tarefa.sequencia_lembrete === 1 && minsDesdeUltimo >= 24 * 60) {
        // Enviar 2º lembrete
        const mensagem = mensagemLembrete2(
          envio.cliente_nome || 'Cliente',
          envio.entrega_nome || 'entrega',
          envio.link_aprovacao || ''
        );

        const zapiCreds = await getZapiCredentials(base44);
        const enviado = await enviarWhatsApp(base44, envio.whatsapp_grupo_id, mensagem, zapiCreds);

        await sdk.entities.TarefaAcompanhamento.update(tarefa.id, {
          sequencia_lembrete: 2,
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
      } else if (tarefa.sequencia_lembrete === 2 && minsDesdeUltimo >= 24 * 60) {
        // Já foram 2 lembretes + 24h do último → intervenção humana
        await sdk.entities.TarefaAcompanhamento.update(tarefa.id, {
          status: 'intervencao_humana',
          data_ultimo_lembrete: agora,
        });
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