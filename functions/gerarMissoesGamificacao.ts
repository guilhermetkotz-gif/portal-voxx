import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.tipo_usuario !== 'voxx_admin')) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Pegar data de hoje
    const hoje = new Date().toISOString().split('T')[0];

    // Buscar dados do radar (contas com problemas)
    const radarData = await base44.asServiceRole.entities.RadarMetaData.list('-created_date', 500);
    const accounts = await base44.asServiceRole.entities.ContaMetaAds.list('-created_date', 500);
    const clientes = await base44.asServiceRole.entities.Cliente.list('-updated_date', 500);

    // Buscar analistas Voxx
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);
    const analistas = allUsers.filter(u => 
      u.tipo_usuario === 'voxx_operacao' || 
      u.tipo_usuario === 'voxx_admin' || 
      u.tipo_usuario === 'voxx_manager'
    );

    if (analistas.length === 0) {
      return Response.json({ message: 'Nenhum analista encontrado', missoes_criadas: 0 });
    }

    const clientesMap = new Map(clientes.map(c => [c.nome, c]));
    const radarMap = new Map(radarData.map(r => [r.account_name, r]));

    // Calcular scores e prioridades para cada conta
    const contasComScore = accounts.map(acc => {
      const radar = radarMap.get(acc.account_name);
      const cliente = clientesMap.get(acc.account_name);
      
      if (!radar || !cliente) return null;

      // Cálculo simplificado do radar score
      const leadsOntem = radar.leads_ontem || 0;
      const leads7d = radar.leads_7d || 0;
      const leadsDia7d = leads7d > 0 ? leads7d / 7 : 0;
      const cplAtual = radar.cpl_ontem || 0;
      const ctrAtual = radar.ctr_ontem || 0;
      const frequencia7d = radar.frequencia_7d || 0;

      let riscoScore = 100;
      if (cplAtual > 50) riscoScore -= 40;
      else if (cplAtual > 35) riscoScore -= 25;
      else if (cplAtual > 25) riscoScore -= 15;

      if (ctrAtual < 0.5) riscoScore -= 30;
      else if (ctrAtual < 1.0) riscoScore -= 20;
      else if (ctrAtual < 1.5) riscoScore -= 10;

      if (frequencia7d >= 3.0) riscoScore -= 35;
      else if (frequencia7d >= 2.5) riscoScore -= 20;
      else if (frequencia7d >= 1.8) riscoScore -= 5;
      else riscoScore += 10;

      riscoScore = Math.max(0, Math.min(100, riscoScore));

      let tendenciaScore = 50;
      const cpl7d = radar.cpl_7d || 0;
      const ctr7d = radar.ctr_7d || 0;

      if (cplAtual < cpl7d * 0.9) tendenciaScore += 10;
      else if (cplAtual > cpl7d * 1.1) tendenciaScore -= 10;

      if (ctrAtual > ctr7d * 1.1) tendenciaScore += 10;
      else if (ctrAtual < ctr7d * 0.9) tendenciaScore -= 10;

      if (leadsOntem > leadsDia7d * 1.2) tendenciaScore += 10;
      else if (leadsOntem < leadsDia7d * 0.7) tendenciaScore -= 10;

      tendenciaScore = Math.max(0, Math.min(100, tendenciaScore));

      let impactoScore = 0;
      if (leadsDia7d >= 30) impactoScore += 50;
      else if (leadsDia7d >= 20) impactoScore += 40;
      else if (leadsDia7d >= 10) impactoScore += 30;
      else if (leadsDia7d >= 5) impactoScore += 20;
      else impactoScore += 10;

      const investimentoDiario = acc.amount_spent ? acc.amount_spent / 30 : 0;
      if (investimentoDiario >= 500) impactoScore += 50;
      else if (investimentoDiario >= 300) impactoScore += 40;
      else if (investimentoDiario >= 200) impactoScore += 30;
      else if (investimentoDiario >= 100) impactoScore += 20;
      else impactoScore += 10;

      impactoScore = Math.max(0, Math.min(100, impactoScore));

      const radarScore = Math.round((riscoScore * 0.4) + (tendenciaScore * 0.3) + (impactoScore * 0.3));

      let prioridade;
      if (radarScore <= 30) prioridade = 'critica';
      else if (radarScore <= 50) prioridade = 'alta';
      else if (radarScore <= 70) prioridade = 'media';
      else prioridade = 'baixa';

      // Identificar motivo principal
      const problemas = [];
      if (cplAtual > 35) problemas.push('CPL elevado');
      if (ctrAtual < 1.0) problemas.push('CTR baixo');
      if (frequencia7d >= 3.0) problemas.push('Saturação crítica');
      else if (frequencia7d >= 2.5) problemas.push('Saturação moderada');
      if (leadsOntem < leadsDia7d * 0.7) problemas.push('Queda de leads');

      const motivo = problemas.length > 0 
        ? `Performance em atenção: ${problemas.join(', ')}`
        : 'Monitoramento preventivo';

      return {
        account_name: acc.account_name,
        conta_meta_ads_id: acc.id,
        radarScore,
        prioridade,
        motivo,
        responsavel: cliente.responsavel_voxx_trafego
      };
    }).filter(c => c !== null);

    // Filtrar apenas contas críticas e altas
    const contasPrioritarias = contasComScore
      .filter(c => c.prioridade === 'critica' || c.prioridade === 'alta')
      .sort((a, b) => a.radarScore - b.radarScore);

    let missoesCriadas = 0;

    // Distribuir missões entre analistas
    for (const analista of analistas) {
      // Verificar se já tem missões para hoje
      const missoesExistentes = await base44.asServiceRole.entities.GamificacaoMissao.filter({
        analista_id: analista.id,
        data_geracao: hoje
      });

      if (missoesExistentes.length > 0) {
        console.log(`Analista ${analista.full_name} já tem missões para hoje`);
        continue;
      }

      // Pegar contas do analista (se tiver responsável definido)
      const contasDoAnalista = contasPrioritarias.filter(c => 
        c.responsavel === analista.email
      );

      // Se analista tem contas atribuídas, usar elas. Senão, pegar das top prioritárias
      const contasParaMissoes = contasDoAnalista.length > 0 
        ? contasDoAnalista.slice(0, 8)
        : contasPrioritarias.slice(0, 5);

      // Criar missões
      for (const conta of contasParaMissoes) {
        await base44.asServiceRole.entities.GamificacaoMissao.create({
          analista_id: analista.id,
          analista_nome: analista.full_name || analista.email,
          data_geracao: hoje,
          conta_meta_ads_id: conta.conta_meta_ads_id,
          account_name: conta.account_name,
          tipo_prioridade: conta.prioridade,
          radar_score: conta.radarScore,
          motivo: conta.motivo,
          status: 'pendente'
        });
        missoesCriadas++;
      }
    }

    return Response.json({ 
      success: true, 
      missoes_criadas: missoesCriadas,
      analistas_atendidos: analistas.length
    });

  } catch (error) {
    console.error('Erro ao gerar missões:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});