import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { isVoxxAdmin, isVoxxOperacao } from '@/components/utils/auth';

export default function ListaSaldoMetaAdsSimples({ balanceControls, clientes, selectedMonth, user, onClienteClick }) {
  const queryClient = useQueryClient();
  const [editingRows, setEditingRows] = useState({});

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const existing = balanceControls.find(
        b => b.client_id === data.client_id && b.month_year === data.month_year
      );
      
      if (existing) {
        return base44.entities.MetaAdsBalanceControl.update(existing.id, data);
      } else {
        return base44.entities.MetaAdsBalanceControl.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['metaAdsBalance']);
      toast.success('Saldo atualizado com sucesso');
    },
  });

  const getMainMetaAccount = (cliente) => {
    return cliente.contas_anuncio?.find(
      c => c.plataforma === 'Meta' && c.conta_principal
    );
  };

  const getBalanceControl = (clientId) => {
    return balanceControls.find(b => b.client_id === clientId);
  };

  const handleFieldChange = (clientId, field, value) => {
    setEditingRows(prev => ({
      ...prev,
      [clientId]: {
        ...(prev[clientId] || {}),
        [field]: value,
      }
    }));
  };

  const handleSave = (cliente, field) => {
    const edits = editingRows[cliente.id] || {};
    const balance = getBalanceControl(cliente.id) || {};
    const mainAccount = getMainMetaAccount(cliente);
    const adAccountId = edits.ad_account_id !== undefined ? edits.ad_account_id : mainAccount?.ad_account_id || '';

    if (!adAccountId && field === 'ad_account_id') {
      toast.error('Adicione um ID de conta Meta Ads');
      return;
    }

    const data = {
      client_id: cliente.id,
      client_name: cliente.nome,
      month_year: selectedMonth,
      ad_account_id: adAccountId,
      saldo: edits.saldo !== undefined ? parseFloat(edits.saldo) : balance.saldo || 0,
      valor_planejado_meta: edits.valor_planejado_meta !== undefined ? parseFloat(edits.valor_planejado_meta) : balance.valor_planejado_meta || 0,
      valor_pago: edits.valor_pago !== undefined ? parseFloat(edits.valor_pago) : balance.valor_pago || 0,
      gasto_diario: edits.gasto_diario !== undefined ? parseFloat(edits.gasto_diario) : balance.gasto_diario || 0,
      qtd_tomadas: balance.qtd_tomadas || 4,
      tomadas_pagas: balance.tomadas_pagas || 0,
      link_conta: edits.link_conta !== undefined ? edits.link_conta : balance.link_conta || '',
      metodo_pagamento: balance.metodo_pagamento || 'Pix',
    };

    saveMutation.mutate(data);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  return (
    <Card className="mt-8">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-violet-600" />
          Saldos Meta Ads - Visualização Simplificada
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-6">
        {clientes.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            Nenhum cliente encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Cliente</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">ID da Conta</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Link da Conta</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Saldo (R$)</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => {
                  const mainAccount = getMainMetaAccount(cliente);
                  const balance = getBalanceControl(cliente.id);
                  const edits = editingRows[cliente.id] || {};
                  const canEdit = isVoxxAdmin(user) || isVoxxOperacao(user);

                  return (
                    <tr key={cliente.id} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-violet-600 cursor-pointer" onClick={() => onClienteClick?.(cliente)}>
                        {cliente.nome}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                        {canEdit ? (
                          <Input
                            type="text"
                            placeholder="ID da conta..."
                            value={edits.ad_account_id !== undefined ? edits.ad_account_id : mainAccount?.ad_account_id || ''}
                            onChange={(e) => handleFieldChange(cliente.id, 'ad_account_id', e.target.value)}
                            onBlur={() => handleSave(cliente, 'ad_account_id')}
                            className="h-8 text-xs"
                          />
                        ) : (
                          <span className="text-slate-600">{mainAccount?.ad_account_id || '—'}</span>
                        )}
                      </td>
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        {canEdit ? (
                          <Input
                            type="url"
                            placeholder="https://..."
                            value={edits.link_conta !== undefined ? edits.link_conta : balance?.link_conta || ''}
                            onChange={(e) => handleFieldChange(cliente.id, 'link_conta', e.target.value)}
                            onBlur={() => handleSave(cliente, 'link_conta')}
                            className="h-8 text-xs"
                          />
                        ) : balance?.link_conta ? (
                          <a
                            href={balance.link_conta}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-600 hover:text-violet-700 underline text-xs"
                          >
                            Acessar
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {canEdit ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={edits.saldo !== undefined ? edits.saldo : balance?.saldo || ''}
                            onChange={(e) => handleFieldChange(cliente.id, 'saldo', e.target.value)}
                            onBlur={() => handleSave(cliente, 'saldo')}
                            className="h-8 text-xs text-right"
                          />
                        ) : (
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(balance?.saldo || 0)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}