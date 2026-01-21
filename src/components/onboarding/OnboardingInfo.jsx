import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function OnboardingInfo({ cliente, onNext }) {
  const [formData, setFormData] = useState({
    nome: cliente.nome || '',
    razao_social: cliente.razao_social || '',
    cnpj: cliente.cnpj || '',
    cidade: cliente.cidade || '',
    estado: cliente.estado || '',
    endereco_completo: cliente.endereco_completo || '',
    cep: cliente.cep || '',
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
          Verifique e ajuste as informações básicas do cliente se necessário.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="nome">Nome Fantasia</Label>
          <Input
            id="nome"
            value={formData.nome}
            onChange={(e) => handleChange('nome', e.target.value)}
            placeholder="Nome da clínica/empresa"
            required
          />
        </div>

        <div>
          <Label htmlFor="razao_social">Razão Social</Label>
          <Input
            id="razao_social"
            value={formData.razao_social}
            onChange={(e) => handleChange('razao_social', e.target.value)}
            placeholder="Razão social"
          />
        </div>

        <div>
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input
            id="cnpj"
            value={formData.cnpj}
            onChange={(e) => handleChange('cnpj', e.target.value)}
            placeholder="00.000.000/0000-00"
          />
        </div>

        <div>
          <Label htmlFor="cep">CEP</Label>
          <Input
            id="cep"
            value={formData.cep}
            onChange={(e) => handleChange('cep', e.target.value)}
            placeholder="00000-000"
          />
        </div>

        <div>
          <Label htmlFor="cidade">Cidade</Label>
          <Input
            id="cidade"
            value={formData.cidade}
            onChange={(e) => handleChange('cidade', e.target.value)}
            placeholder="Cidade"
            required
          />
        </div>

        <div>
          <Label htmlFor="estado">Estado (UF)</Label>
          <Input
            id="estado"
            value={formData.estado}
            onChange={(e) => handleChange('estado', e.target.value)}
            placeholder="SP"
            maxLength={2}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="endereco_completo">Endereço Completo</Label>
        <Input
          id="endereco_completo"
          value={formData.endereco_completo}
          onChange={(e) => handleChange('endereco_completo', e.target.value)}
          placeholder="Rua, número, bairro"
        />
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
          Continuar
        </Button>
      </div>
    </form>
  );
}