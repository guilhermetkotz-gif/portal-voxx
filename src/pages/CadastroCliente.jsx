import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CadastroCliente() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nome: '',
    legacy_client_key: '',
    cidade: '',
    estado: '',
    status: 'ativo',
    tipo_cliente: 'outro',
  });
  const [errors, setErrors] = useState({});

  const createClientMutation = useMutation({
    mutationFn: async (newClient) => {
      const existingClients = await base44.entities.Cliente.filter({ legacy_client_key: newClient.legacy_client_key });
      if (existingClients.length > 0) {
        throw new Error('Já existe um cliente com esta chave legada.');
      }
      return base44.entities.Cliente.create(newClient);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
      toast({
        title: 'Sucesso!',
        description: 'Cliente cadastrado com sucesso.',
      });
      navigate('/planejamento-estrategico');
    },
    onError: (error) => {
      toast({
        title: 'Erro ao cadastrar cliente',
        description: error.message || 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    },
  });

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSelectChange = (id, value) => {
    setFormData((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.nome) newErrors.nome = 'Nome é obrigatório.';
    if (!formData.legacy_client_key) newErrors.legacy_client_key = 'Chave legada é obrigatória.';
    if (!formData.cidade) newErrors.cidade = 'Cidade é obrigatória.';
    if (!formData.estado) newErrors.estado = 'Estado é obrigatório.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }
    setErrors({});
    createClientMutation.mutate(formData);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle className="w-6 h-6 text-violet-600" />
            Cadastro de Novo Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nome">Nome Fantasia *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={handleInputChange}
                  className={errors.nome ? 'border-red-500' : ''}
                />
                {errors.nome && <p className="text-red-500 text-xs mt-1">{errors.nome}</p>}
              </div>
              <div>
                <Label htmlFor="legacy_client_key">Chave Legada do Cliente (para compatibilidade) *</Label>
                <Input
                  id="legacy_client_key"
                  value={formData.legacy_client_key}
                  onChange={handleInputChange}
                  className={errors.legacy_client_key ? 'border-red-500' : ''}
                />
                {errors.legacy_client_key && <p className="text-red-500 text-xs mt-1">{errors.legacy_client_key}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cidade">Cidade *</Label>
                <Input
                  id="cidade"
                  value={formData.cidade}
                  onChange={handleInputChange}
                  className={errors.cidade ? 'border-red-500' : ''}
                />
                {errors.cidade && <p className="text-red-500 text-xs mt-1">{errors.cidade}</p>}
              </div>
              <div>
                <Label htmlFor="estado">Estado (UF) *</Label>
                <Input
                  id="estado"
                  value={formData.estado}
                  onChange={handleInputChange}
                  className={errors.estado ? 'border-red-500' : ''}
                />
                {errors.estado && <p className="text-red-500 text-xs mt-1">{errors.estado}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="status">Status do Cliente</Label>
              <Select value={formData.status} onValueChange={(value) => handleSelectChange('status', value)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                  <SelectItem value="implantacao">Implantação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tipo_cliente">Tipo de Cliente</Label>
              <Select value={formData.tipo_cliente} onValueChange={(value) => handleSelectChange('tipo_cliente', value)}>
                <SelectTrigger id="tipo_cliente">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oral_sin">Oral Sin</SelectItem>
                  <SelectItem value="particular">Particular</SelectItem>
                  <SelectItem value="franquia">Franquia</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={createClientMutation.isPending}>
              {createClientMutation.isPending ? 'Cadastrando...' : 'Cadastrar Cliente'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}