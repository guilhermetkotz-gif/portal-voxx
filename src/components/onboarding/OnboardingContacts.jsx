import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function OnboardingContacts({ cliente, onNext }) {
  const [formData, setFormData] = useState({
    responsavel_cliente_nome: cliente.responsavel_cliente_nome || '',
    responsavel_cliente_telefone: cliente.responsavel_cliente_telefone || '',
    responsavel_cliente_email: cliente.responsavel_cliente_email || '',
    responsavel_voxx_cs: cliente.responsavel_voxx_cs || '',
    responsavel_voxx_trafego: cliente.responsavel_voxx_trafego || '',
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
          Adicione os contatos principais do cliente e dos responsáveis Voxx.
        </p>
      </div>

      {/* Contato do Cliente */}
      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="font-semibold text-sm">Responsável do Cliente</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="responsavel_cliente_nome">Nome</Label>
            <Input
              id="responsavel_cliente_nome"
              value={formData.responsavel_cliente_nome}
              onChange={(e) => handleChange('responsavel_cliente_nome', e.target.value)}
              placeholder="Nome completo"
            />
          </div>

          <div>
            <Label htmlFor="responsavel_cliente_telefone">Telefone / WhatsApp</Label>
            <Input
              id="responsavel_cliente_telefone"
              value={formData.responsavel_cliente_telefone}
              onChange={(e) => handleChange('responsavel_cliente_telefone', e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="responsavel_cliente_email">E-mail</Label>
            <Input
              id="responsavel_cliente_email"
              type="email"
              value={formData.responsavel_cliente_email}
              onChange={(e) => handleChange('responsavel_cliente_email', e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>
        </div>
      </div>

      {/* Responsáveis Voxx */}
      <div className="border rounded-lg p-4 space-y-4 bg-violet-50">
        <h4 className="font-semibold text-sm">Responsáveis Voxx</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="responsavel_voxx_cs">Responsável CS / Atendimento</Label>
            <Input
              id="responsavel_voxx_cs"
              value={formData.responsavel_voxx_cs}
              onChange={(e) => handleChange('responsavel_voxx_cs', e.target.value)}
              placeholder="Email do usuário Voxx"
            />
          </div>

          <div>
            <Label htmlFor="responsavel_voxx_trafego">Responsável Tráfego / Operação</Label>
            <Input
              id="responsavel_voxx_trafego"
              value={formData.responsavel_voxx_trafego}
              onChange={(e) => handleChange('responsavel_voxx_trafego', e.target.value)}
              placeholder="Email do usuário Voxx"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
          Continuar
        </Button>
      </div>
    </form>
  );
}