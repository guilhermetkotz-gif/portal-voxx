import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function ContasAnuncioForm({ contas = [], onChange }) {
  const { data: contasMetaAds = [] } = useQuery({
    queryKey: ['contasMetaAdsDisponiveis'],
    queryFn: () => base44.entities.ContaMetaAds.list('-updated_date', 500),
    staleTime: 0,
    refetchOnMount: true
  });

  const handleAddConta = () => {
    onChange([...contas, {
      plataforma: 'Meta',
      conta_nome: '',
      ad_account_id: '',
      business_manager_id: '',
      conta_principal: false,
      status_conta: 'ativa'
    }]);
  };

  const handleRemoveConta = (index) => {
    onChange(contas.filter((_, i) => i !== index));
  };

  const handleUpdateConta = (index, field, value) => {
    const updated = [...contas];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-preencher dados ao selecionar conta Meta Ads
    if (field === 'conta_nome' && updated[index].plataforma === 'Meta') {
      const contaSelecionada = contasMetaAds.find(c => c.account_name === value);
      if (contaSelecionada) {
        updated[index].ad_account_id = contaSelecionada.id || '';
      }
    }
    
    onChange(updated);
  };

  const handleTogglePrincipal = (index) => {
    const updated = [...contas];
    const plataforma = updated[index].plataforma;
    
    // Desmarcar outras contas principais da mesma plataforma
    updated.forEach((conta, i) => {
      if (conta.plataforma === plataforma && i !== index) {
        conta.conta_principal = false;
      }
    });
    
    updated[index].conta_principal = !updated[index].conta_principal;
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {contas.map((conta, index) => (
        <Card key={index} className="border-slate-200">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <h4 className="font-semibold text-slate-900">Conta {index + 1}</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveConta(index)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Plataforma *</Label>
                  <Select
                    value={conta.plataforma}
                    onValueChange={(value) => handleUpdateConta(index, 'plataforma', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Meta">Meta Ads</SelectItem>
                      <SelectItem value="Google">Google Ads</SelectItem>
                      <SelectItem value="TikTok">TikTok Ads</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Status da Conta</Label>
                  <Select
                    value={conta.status_conta}
                    onValueChange={(value) => handleUpdateConta(index, 'status_conta', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativa">Ativa</SelectItem>
                      <SelectItem value="inativa">Inativa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {conta.plataforma === 'Meta' ? (
                <div>
                  <Label>Conta (Lookup da Planilha)</Label>
                  <Select
                    value={conta.conta_nome}
                    onValueChange={(value) => handleUpdateConta(index, 'conta_nome', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma conta Meta Ads" />
                    </SelectTrigger>
                    <SelectContent>
                      {contasMetaAds.map((c) => (
                        <SelectItem key={c.id} value={c.account_name}>
                          {c.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label>Nome da Conta *</Label>
                  <Input
                    value={conta.conta_nome}
                    onChange={(e) => handleUpdateConta(index, 'conta_nome', e.target.value)}
                    placeholder="Nome da conta de anúncio"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Ad Account ID</Label>
                  <Input
                    value={conta.ad_account_id}
                    onChange={(e) => handleUpdateConta(index, 'ad_account_id', e.target.value)}
                    placeholder="ID da conta na plataforma"
                  />
                </div>

                {conta.plataforma === 'Meta' && (
                  <div>
                    <Label>Business Manager ID (opcional)</Label>
                    <Input
                      value={conta.business_manager_id || ''}
                      onChange={(e) => handleUpdateConta(index, 'business_manager_id', e.target.value)}
                      placeholder="ID do Business Manager"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`principal-${index}`}
                  checked={conta.conta_principal}
                  onCheckedChange={() => handleTogglePrincipal(index)}
                />
                <label
                  htmlFor={`principal-${index}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Conta Principal para {conta.plataforma}
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={handleAddConta}
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        Adicionar Conta de Anúncio
      </Button>
    </div>
  );
}