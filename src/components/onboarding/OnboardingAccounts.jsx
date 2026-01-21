import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2 } from 'lucide-react';

export default function OnboardingAccounts({ cliente, onNext }) {
  const [contas, setContas] = useState(cliente.contas_anuncio || []);
  const [newConta, setNewConta] = useState({
    plataforma: 'Meta',
    conta_nome: '',
    ad_account_id: '',
    conta_principal: false,
    status_conta: 'ativa',
  });

  const handleAddConta = () => {
    if (newConta.conta_nome && newConta.ad_account_id) {
      const updatedContas = [...contas, newConta];
      setContas(updatedContas);
      setNewConta({
        plataforma: 'Meta',
        conta_nome: '',
        ad_account_id: '',
        conta_principal: false,
        status_conta: 'ativa',
      });
    }
  };

  const handleRemoveConta = (index) => {
    setContas(contas.filter((_, i) => i !== index));
  };

  const handleTogglePrimary = (index) => {
    const plataforma = contas[index].plataforma;
    const updated = contas.map((c, i) => ({
      ...c,
      conta_principal: c.plataforma === plataforma && i === index ? true : false,
    }));
    setContas(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onNext(contas);
  };

  const metaPrincipal = contas.find(c => c.plataforma === 'Meta' && c.conta_principal);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          Adicione as contas de anúncio do cliente. Meta Ads é obrigatório para clientes ativos.
        </p>
      </div>

      {/* Lista de Contas */}
      {contas.length > 0 && (
        <div className="space-y-3">
          {contas.map((conta, idx) => (
            <div key={idx} className="p-4 border rounded-lg bg-slate-50 flex items-center justify-between">
              <div className="flex-1">
                <div className="font-semibold">{conta.conta_nome}</div>
                <div className="text-sm text-slate-600">
                  {conta.plataforma} • ID: {conta.ad_account_id}
                  {conta.conta_principal && <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Principal</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <Checkbox
                  checked={conta.conta_principal}
                  onCheckedChange={() => handleTogglePrimary(idx)}
                  title="Marcar como principal"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveConta(idx)}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nova Conta */}
      <div className="border rounded-lg p-4 space-y-4 bg-slate-50">
        <h4 className="font-semibold text-sm">Adicionar Nova Conta</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="plataforma">Plataforma</Label>
            <Select value={newConta.plataforma} onValueChange={(value) => setNewConta(prev => ({ ...prev, plataforma: value }))}>
              <SelectTrigger id="plataforma">
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
            <Label htmlFor="status_conta">Status</Label>
            <Select value={newConta.status_conta} onValueChange={(value) => setNewConta(prev => ({ ...prev, status_conta: value }))}>
              <SelectTrigger id="status_conta">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="inativa">Inativa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="conta_nome">Nome da Conta</Label>
            <Input
              id="conta_nome"
              value={newConta.conta_nome}
              onChange={(e) => setNewConta(prev => ({ ...prev, conta_nome: e.target.value }))}
              placeholder="Ex: Campanha Principal"
            />
          </div>

          <div>
            <Label htmlFor="ad_account_id">ID da Conta</Label>
            <Input
              id="ad_account_id"
              value={newConta.ad_account_id}
              onChange={(e) => setNewConta(prev => ({ ...prev, ad_account_id: e.target.value }))}
              placeholder="Ex: 123456789"
            />
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleAddConta}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Conta
        </Button>
      </div>

      {cliente.status === 'ativo' && !metaPrincipal && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">
            ⚠️ Cliente ativo precisa ter uma conta Meta Ads marcada como principal.
          </p>
        </div>
      )}

      <div className="pt-4 flex justify-end">
        <Button 
          type="submit" 
          disabled={cliente.status === 'ativo' && !metaPrincipal}
          className="bg-violet-600 hover:bg-violet-700"
        >
          Continuar
        </Button>
      </div>
    </form>
  );
}