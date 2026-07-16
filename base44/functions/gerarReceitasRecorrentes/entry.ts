import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { mes_referencia } = await req.json();
  if (!mes_referencia) return Response.json({ error: 'mes_referencia obrigatório (ex: 2026-04)' }, { status: 400 });

  const [targetYear, targetMonth] = mes_referencia.split('-').map(Number);
  const targetDate = new Date(targetYear, targetMonth - 1, 1);

  // Buscar todas as receitas recorrentes (templates)
  const recorrentes = await base44.asServiceRole.entities.FinanceiroReceita.filter({ recorrente: true });

  // Buscar receitas já existentes no mês alvo
  const existentesNoMes = await base44.asServiceRole.entities.FinanceiroReceita.filter({ mes_referencia });

  let criados = 0;
  let pulados = 0;
  let duplicatasRemovidas = 0;

  // ── PASSO 1: Limpar duplicatas existentes no mês ──
  // Agrupa por cliente_nome e remove os "vazios" quando há um com dados
  const porCliente = {};
  for (const r of existentesNoMes) {
    const key = (r.cliente_nome || '').toLowerCase().trim();
    if (!porCliente[key]) porCliente[key] = [];
    porCliente[key].push(r);
  }

  for (const [, grupo] of Object.entries(porCliente)) {
    if (grupo.length <= 1) continue;

    // Classifica: tem dados = tem data_recebimento, comprovante, observação ou data_cobranca
    const temDados = (r) => !!(r.data_recebimento || r.comprovante_recebimento || r.observacao_recebimento || r.data_cobranca);

    const comDados = grupo.filter(temDados);
    const semDados = grupo.filter(r => !temDados(r));

    // Se há pelo menos um com dados, remove todos os sem dados
    if (comDados.length > 0 && semDados.length > 0) {
      for (const r of semDados) {
        await base44.asServiceRole.entities.FinanceiroReceita.delete(r.id);
        duplicatasRemovidas++;
      }
    } else if (comDados.length === 0 && semDados.length > 1) {
      // Sem nenhum com dados: mantém o mais recente, remove os outros
      const ordenados = semDados.sort((a, b) => (b.updated_date || b.created_date || '').localeCompare(a.updated_date || a.created_date || ''));
      for (const r of ordenados.slice(1)) {
        await base44.asServiceRole.entities.FinanceiroReceita.delete(r.id);
        duplicatasRemovidas++;
      }
    }
  }

  // Recarrega existentes após limpeza
  const existentesAtualizados = await base44.asServiceRole.entities.FinanceiroReceita.filter({ mes_referencia });

  // Buscar clientes financeiros para fallback de dia_cobranca
  const clientesFin = await base44.asServiceRole.entities.ClienteFinanceiro.list('-created_date', 500);
  const diaCobrancaPorNome = {};
  for (const c of clientesFin) {
    if (c.dia_cobranca) {
      const base = (c.nome || '').toLowerCase().trim();
      const full = base + (c.unidade ? ` — ${c.unidade}` : '');
      diaCobrancaPorNome[base] = c.dia_cobranca;
      diaCobrancaPorNome[full] = c.dia_cobranca;
    }
  }

  // ── PASSO 2: Gerar lançamentos para receitas recorrentes ──
  for (const receita of recorrentes) {
    // Verifica período
    if (receita.data_inicio) {
      const inicio = new Date(receita.data_inicio);
      if (targetDate < new Date(inicio.getFullYear(), inicio.getMonth(), 1)) {
        pulados++;
        continue;
      }
    }
    if (receita.data_fim) {
      const fim = new Date(receita.data_fim);
      if (targetDate > new Date(fim.getFullYear(), fim.getMonth(), 1)) {
        pulados++;
        continue;
      }
    }

    // Verifica se já existe para este cliente/mês (sem restrição de is_previsto)
    const jaExiste = existentesAtualizados.some(
      e => e.recorrencia_id === receita.id ||
           (e.cliente_nome?.toLowerCase().trim() === receita.cliente_nome?.toLowerCase().trim())
    );

    if (jaExiste) {
      pulados++;
      continue;
    }

    // Calcula data_cobranca: preserva o dia original do template, ou usa dia_cobranca do ClienteFinanceiro
    let data_cobranca = null;
    let diaCobranca = null;
    if (receita.data_cobranca) {
      diaCobranca = new Date(receita.data_cobranca).getDate();
    } else {
      // Fallback: buscar dia_cobranca do ClienteFinanceiro
      const nomeKey = (receita.cliente_nome || '').toLowerCase().trim();
      const baseKey = nomeKey.split(' — ')[0].trim();
      diaCobranca = diaCobrancaPorNome[nomeKey] || diaCobrancaPorNome[baseKey];
    }
    if (diaCobranca) {
      const ultimoDia = new Date(targetYear, targetMonth, 0).getDate();
      const dia = Math.min(diaCobranca, ultimoDia);
      data_cobranca = `${mes_referencia}-${String(dia).padStart(2, '0')}`;
    }

    await base44.asServiceRole.entities.FinanceiroReceita.create({
      cliente_nome: receita.cliente_nome,
      cliente_id: receita.cliente_id,
      valor_mensal: receita.valor_mensal,
      tipo_contrato: receita.tipo_contrato,
      data_cobranca,
      status: 'a_vencer',
      mes_referencia,
      recorrente: true,
      frequencia: receita.frequencia || 'mensal',
      data_inicio: receita.data_inicio,
      data_fim: receita.data_fim,
      is_previsto: true,
      recorrencia_id: receita.id,
    });

    criados++;
  }

  return Response.json({
    success: true,
    mes_referencia,
    criados,
    pulados,
    duplicatasRemovidas,
    message: `${criados} receita(s) gerada(s) para ${mes_referencia}. ${pulados} pulada(s). ${duplicatasRemovidas > 0 ? `${duplicatasRemovidas} duplicata(s) removida(s).` : ''}`.trim()
  });
});