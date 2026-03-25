import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { mes_referencia } = await req.json();
  if (!mes_referencia) return Response.json({ error: 'mes_referencia obrigatório (ex: 2026-04)' }, { status: 400 });

  const [targetYear, targetMonth] = mes_referencia.split('-').map(Number);
  const targetDate = new Date(targetYear, targetMonth - 1, 1);

  // Buscar todas as receitas recorrentes (com data_inicio ou sem, que sejam recorrentes)
  const recorrentes = await base44.asServiceRole.entities.FinanceiroReceita.filter({ recorrente: true });

  // Buscar receitas já existentes no mês alvo para evitar duplicatas
  const existentesNoMes = await base44.asServiceRole.entities.FinanceiroReceita.filter({ mes_referencia });

  let criados = 0;
  let pulados = 0;

  for (const receita of recorrentes) {
    // Verificar se a receita se aplica ao mês alvo
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

    // Verificar se já existe lançamento para este mês (via recorrencia_id ou mesmo cliente+mês)
    const jaExiste = existentesNoMes.some(
      e => e.recorrencia_id === receita.id || (e.cliente_nome === receita.cliente_nome && e.is_previsto)
    );

    if (jaExiste) {
      pulados++;
      continue;
    }

    // Calcular data_cobranca para o mês alvo
    let data_cobranca = null;
    if (receita.data_cobranca) {
      const diaOriginal = new Date(receita.data_cobranca).getDate();
      const ultimoDia = new Date(targetYear, targetMonth, 0).getDate();
      const dia = Math.min(diaOriginal, ultimoDia);
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
    message: `${criados} receita(s) gerada(s) para ${mes_referencia}. ${pulados} pulada(s) (já existentes ou fora do período).`
  });
});