import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export default function OnboardingPlanning({ cliente, onNext }) {
  const currentMonth = format(new Date(), 'yyyy-MM-01');
  
  const [formData, setFormData] = useState({
    mes_referencia: currentMonth,
    meta_faturamento: '',
    ticket_medio: '',
    percentual_investimento_marketing: '',
    investimento_meta: '',
    investimento_google: '',
    cpl_planejado: '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onNext(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          Defina as metas iniciais e planejamento de investimento para o cliente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="meta_faturamento">Meta de Faturamento (R$)</Label>
          <Input
            id="meta_faturamento"
            type="number"
            step="0.01"
            value={formData.meta_faturamento}
            onChange={(e) => handleChange('meta_faturamento', e.target.value)}
            placeholder="0,00"
          />
        </div>

        <div>
          <Label htmlFor="ticket_medio">Ticket Médio (R$)</Label>
          <Input
            id="ticket_medio"
            type="number"
            step="0.01"
            value={formData.ticket_medio}
            onChange={(e) => handleChange('ticket_medio', e.target.value)}
            placeholder="0,00"
          />
        </div>

        <div>
          <Label htmlFor="percentual_investimento_marketing">% Investimento em Marketing</Label>
          <Input
            id="percentual_investimento_marketing"
            type="number"
            step="0.01"
            value={formData.percentual_investimento_marketing}
            onChange={(e) => handleChange('percentual_investimento_marketing', e.target.value)}
            placeholder="0,00"
            max="100"
          />
        </div>

        <div>
          <Label htmlFor="cpl_planejado">CPL Planejado (R$)</Label>
          <Input
            id="cpl_planejado"
            type="number"
            step="0.01"
            value={formData.cpl_planejado}
            onChange={(e) => handleChange('cpl_planejado', e.target.value)}
            placeholder="0,00"
          />
        </div>

        <div>
          <Label htmlFor="investimento_meta">Investimento Meta Ads (R$)</Label>
          <Input
            id="investimento_meta"
            type="number"
            step="0.01"
            value={formData.investimento_meta}
            onChange={(e) => handleChange('investimento_meta', e.target.value)}
            placeholder="0,00"
          />
        </div>

        <div>
          <Label htmlFor="investimento_google">Investimento Google Ads (R$)</Label>
          <Input
            id="investimento_google"
            type="number"
            step="0.01"
            value={formData.investimento_google}
            onChange={(e) => handleChange('investimento_google', e.target.value)}
            placeholder="0,00"
          />
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <p className="text-sm text-slate-700">
          <strong>Mês de Referência:</strong> {format(new Date(currentMonth), 'MMMM/yyyy', { locale: require('date-fns/locale/pt-BR') })}
        </p>
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
          Continuar
        </Button>
      </div>
    </form>
  );
}