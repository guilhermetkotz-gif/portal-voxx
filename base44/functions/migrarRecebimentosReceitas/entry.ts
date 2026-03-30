import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Acesso negado. Apenas admins.' }, { status: 403 });
  }

  // Busca todas as receitas
  const receitas = await base44.asServiceRole.entities.FinanceiroReceita.list('-created_date', 2000);

  // Busca todos os recebimentos existentes (para checar duplicatas)
  const recebimentosExistentes = await base44.asServiceRole.entities.RecebimentoReceita.list('-created_date', 5000);
  const receitasComRecebimento = new Set(recebimentosExistentes.map(r => r.receita_id));

  let migradas = 0;
  let ignoradas = 0;
  let erros = 0;

  for (const receita of receitas) {
    // Só migra se NÃO tem recebimentos já (segurança anti-duplicata)
    if (receitasComRecebimento.has(receita.id)) {
      ignoradas++;
      continue;
    }

    // Verifica se existe pagamento antigo
    const temPagamento = receita.status === 'pago'
      || receita.data_recebimento
      || receita.comprovante_recebimento;

    if (!temPagamento) {
      ignoradas++;
      continue;
    }

    const valorOriginal = receita.valor_mensal || 0;
    const valorPago = valorOriginal; // assume integral pois o sistema antigo não guardava valor parcial

    // Determina tipo
    let tipo = 'integral';
    if (valorPago < valorOriginal) tipo = 'parcial';
    else if (valorPago > valorOriginal) tipo = 'ajuste';

    // Data do pagamento: usa data_recebimento se existir, senão updated_at, senão data_cobranca
    const dataPagamento = receita.data_recebimento
      || (receita.updated_date ? receita.updated_date.substring(0, 10) : null)
      || receita.data_cobranca
      || new Date().toISOString().substring(0, 10);

    try {
      await base44.asServiceRole.entities.RecebimentoReceita.create({
        receita_id: receita.id,
        data_pagamento: dataPagamento,
        valor_principal_pago: valorPago,
        valor_juros: 0,
        valor_desconto: 0,
        valor_total_recebido: valorPago,
        tipo_recebimento: tipo,
        comprovante_url: receita.comprovante_recebimento || '',
        comprovante_nome: receita.comprovante_recebimento ? 'Comprovante migrado' : '',
        observacao: receita.observacao_recebimento
          ? `Recebimento migrado. Obs original: ${receita.observacao_recebimento}`
          : 'Recebimento migrado da estrutura anterior',
        registrado_por: 'sistema_migracao',
        mes_referencia: receita.mes_referencia || '',
      });
      migradas++;
    } catch (e) {
      console.error(`Erro ao migrar receita ${receita.id}:`, e.message);
      erros++;
    }
  }

  return Response.json({
    success: true,
    message: `Migração concluída: ${migradas} recebimento(s) criado(s), ${ignoradas} ignorado(s), ${erros} erro(s).`,
    migradas,
    ignoradas,
    erros,
  });
});