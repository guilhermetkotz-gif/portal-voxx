import React from 'react';
import AlertCard from '@/components/ui/AlertCard';

export default function AlertsSection({ cliente, saldoMeta, gastoDiarioMeta, contaMetaAdsAtual }) {
  const alerts = [];
  
  if (!cliente) return null;

  // Saldo baixo Meta — usa dados da planilha se disponíveis
  const saldoMetaEfetivo = saldoMeta ?? cliente.saldo_meta ?? 0;
  const gastoDiarioMetaEfetivo = gastoDiarioMeta > 0 ? gastoDiarioMeta : cliente.investimento_dia_meta;

  const diasRestantesMeta = gastoDiarioMetaEfetivo > 0
    ? Math.floor(saldoMetaEfetivo / gastoDiarioMetaEfetivo)
    : null;
  
  if (diasRestantesMeta !== null && diasRestantesMeta < 3) {
    alerts.push({
      type: 'danger',
      title: 'Saldo Meta crítico',
      message: `Saldo restante cobre apenas ${diasRestantesMeta} dia(s). Considere nova tomada de investimento.`,
      action: 'Solicitar investimento'
    });
  } else if (diasRestantesMeta !== null && diasRestantesMeta < 5) {
    alerts.push({
      type: 'warning',
      title: 'Saldo Meta baixo',
      message: `Saldo restante cobre aproximadamente ${diasRestantesMeta} dias.`
    });
  }

  // Saldo baixo Google
  const diasRestantesGoogle = cliente.investimento_dia_google > 0 
    ? Math.floor(cliente.saldo_google / cliente.investimento_dia_google) 
    : null;
  
  if (diasRestantesGoogle !== null && diasRestantesGoogle < 3) {
    alerts.push({
      type: 'danger',
      title: 'Saldo Google crítico',
      message: `Saldo restante cobre apenas ${diasRestantesGoogle} dia(s). Considere nova tomada de investimento.`,
      action: 'Solicitar investimento'
    });
  } else if (diasRestantesGoogle !== null && diasRestantesGoogle < 5) {
    alerts.push({
      type: 'warning',
      title: 'Saldo Google baixo',
      message: `Saldo restante cobre aproximadamente ${diasRestantesGoogle} dias.`
    });
  }

  // CPL alto — usa dados da planilha se disponíveis
  const cplAtual = contaMetaAdsAtual?.cost_per_new_messaging ?? contaMetaAdsAtual?.cost_per_messaging ?? cliente.custo_por_lead_meta;
  if (cliente.cpl_baseline_meta && cplAtual) {
    const cplVariacao = ((cplAtual - cliente.cpl_baseline_meta) / cliente.cpl_baseline_meta) * 100;
    if (cplVariacao > 20) {
      alerts.push({
        type: 'warning',
        title: 'CPL acima do esperado',
        message: `O custo por lead Meta está ${cplVariacao.toFixed(0)}% acima do baseline. Estamos analisando.`
      });
    }
  }

  // Poucos leads (estimativa simples) — usa dados da planilha se disponíveis
  const leadsMetaMes = contaMetaAdsAtual?.messaging_conversations ?? contaMetaAdsAtual?.new_messaging_connections ?? cliente.leads_meta_mes;
  const diaDoMes = new Date().getDate();
  if (diaDoMes > 10 && leadsMetaMes !== undefined && leadsMetaMes !== null && leadsMetaMes < (diaDoMes * 0.5)) {
    alerts.push({
      type: 'info',
      title: 'Volume de leads abaixo do ritmo',
      message: 'O volume de leads Meta está abaixo do esperado para este período do mês.'
    });
  }

  if (alerts.length === 0) {
    return (
      <AlertCard 
        type="success"
        title="Tudo em ordem!"
        message="Não há alertas no momento. Sua conta está operando normalmente."
      />
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => (
        <AlertCard key={index} {...alert} />
      ))}
    </div>
  );
}