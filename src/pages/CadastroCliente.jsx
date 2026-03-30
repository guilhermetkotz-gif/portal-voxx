import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { UserPlus, AlertTriangle, CheckCircle2, RefreshCw, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import ContasAnuncioForm from '@/components/cliente/ContasAnuncioForm';
import DocumentUpload from '@/components/cliente/DocumentUpload';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';

export default function CadastroCliente() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: allClientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['allClientes'],
    queryFn: () => base44.entities.Cliente.list('-updated_date', 500),
    staleTime: 60 * 1000,
  });

  const [formData, setFormData] = useState({
    // Seção A - Identificação
    nome: '',
    razao_social: '',
    cnpj: '',
    legacy_client_key: '',
    status: 'ativo',
    tipo_cliente: 'outro',
    
    // Seção B - Localização
    cidade: '',
    estado: '',
    endereco_completo: '',
    cep: '',
    regiao: '',
    estimativa_habitantes: 0,
    abrangencia_atendimento: 'somente_cidade',
    
    // Seção C - Contatos
    responsavel_cliente_nome: '',
    responsavel_cliente_telefone: '',
    responsavel_cliente_email: '',
    responsavel_voxx_cs: '',
    responsavel_voxx_trafego: '',
    responsavel_google_ads: '',
    
    // Seção D - Contas de Anúncio
    contas_anuncio: [],
    
    // Seção E - Briefing
    briefing: '',
    restrictions: '',
    observacoes_operacionais: '',
    procedimentos_foco: '',
    publico_alvo: '',
    
    // Seção F - Documentos
    contract_files: [],
    
    // Seção G - Metadados
    tags: [],
    fonte_entrada: 'outro',
    maturidade_digital: 'basico',
    
    // Seção H - Integrações
    google_leads_sheet_url: '',
  });

  const [errors, setErrors] = useState({});
  const [currentTab, setCurrentTab] = useState('identificacao');
  const [legacyKeyManuallyEdited, setLegacyKeyManuallyEdited] = useState(false);
  const [legacyKeyUnique, setLegacyKeyUnique] = useState(true);
  const [checkingUniqueness, setCheckingUniqueness] = useState(false);
  const [confirmLegacyKey, setConfirmLegacyKey] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'form'
  const [editingClienteId, setEditingClienteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [legacyKeyOpen, setLegacyKeyOpen] = useState(false);
  const [legacyKeySearchTerm, setLegacyKeySearchTerm] = useState('');

  // Get unique legacy keys from existing clients
  const existingLegacyKeys = Array.from(new Set(allClientes.map(c => c.legacy_client_key).filter(Boolean))).sort();
  const filteredLegacyKeys = existingLegacyKeys.filter(key =>
    key.toLowerCase().includes(legacyKeySearchTerm.toLowerCase())
  );

  const saveClientMutation = useMutation({
    mutationFn: async (clientData) => {
      // Se estiver editando
      if (editingClienteId) {
        return base44.entities.Cliente.update(editingClienteId, clientData);
      }
      
      // Se estiver criando novo
      if (clientData.legacy_client_key) {
        const existingClients = await base44.entities.Cliente.filter({ legacy_client_key: clientData.legacy_client_key });
        if (existingClients.length > 0) {
          throw new Error('Já existe um cliente com esta chave legada.');
        }
      }
      
      return base44.entities.Cliente.create(clientData);
    },
    onSuccess: async (response) => {
      queryClient.invalidateQueries(['clientes']);
      queryClient.invalidateQueries(['allClientes']);
      
      // Se novo cliente, atribuir a todos os usuários Voxx
      if (!editingClienteId) {
        try {
          await base44.functions.invoke('assignClienteToAllVoxxUsers', {
            cliente_id: response.id
          });
        } catch (error) {
          console.error('Erro ao atribuir cliente a usuários Voxx:', error);
        }
      }
      
      toast({
        title: 'Sucesso!',
        description: editingClienteId ? 'Cliente atualizado com sucesso.' : 'Cliente cadastrado e atribuído aos usuários Voxx.',
      });
      
      // Redirecionar para onboarding se novo cliente
      if (!editingClienteId) {
        navigate(createPageUrl('OnboardingCliente') + `?clienteId=${response.id}`);
      } else {
        setViewMode('list');
        resetForm();
      }
    },
    onError: (error) => {
      toast({
        title: editingClienteId ? 'Erro ao atualizar cliente' : 'Erro ao cadastrar cliente',
        description: error.message || 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    },
  });

  // Normalizar chave legada
  const normalizeLegacyKey = (text) => {
    return text
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Gerar chave legada automaticamente
  const generateLegacyKey = (nome, cidade) => {
    if (!nome || !cidade) return '';
    return `${normalizeLegacyKey(nome)} - ${normalizeLegacyKey(cidade)}`;
  };

  // Auto-gerar chave legada apenas se campo estiver vazio e não foi tocado manualmente
  useEffect(() => {
    if (!legacyKeyManuallyEdited && !formData.legacy_client_key && formData.nome && formData.cidade) {
      // Não auto-gera mais: usuário decide se quer preencher
    }
  }, [formData.nome, formData.cidade, legacyKeyManuallyEdited]);

  // Validar unicidade da chave legada (apenas para novos clientes)
  useEffect(() => {
    if (!formData.legacy_client_key || editingClienteId) {
      setLegacyKeyUnique(true);
      return;
    }

    const checkUniqueness = async () => {
      setCheckingUniqueness(true);
      try {
        const existing = await base44.entities.Cliente.filter({ 
          legacy_client_key: formData.legacy_client_key 
        });
        setLegacyKeyUnique(existing.length === 0);
      } catch (error) {
        console.error('Erro ao verificar unicidade:', error);
      } finally {
        setCheckingUniqueness(false);
      }
    };

    const timeoutId = setTimeout(checkUniqueness, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.legacy_client_key, editingClienteId]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Marcar se a chave legada foi editada manualmente
    if (field === 'legacy_client_key') {
      setLegacyKeyManuallyEdited(true);
      setConfirmLegacyKey(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    
    // Validações obrigatórias
    if (!formData.nome) newErrors.nome = 'Nome é obrigatório.';
    if (!formData.cidade) newErrors.cidade = 'Cidade é obrigatória.';
    if (!formData.estado) newErrors.estado = 'Estado é obrigatório.';

    // Validar unicidade da chave legada (só bloqueia se preenchida)
    if (formData.legacy_client_key && !legacyKeyUnique) {
      newErrors.legacy_client_key = 'Já existe um cliente com esta chave legada.';
    }

    // Confirmação só é necessária se a chave foi preenchida
    if (formData.legacy_client_key && !editingClienteId && !confirmLegacyKey) {
      newErrors.legacy_client_key = 'Você precisa confirmar a chave legada antes de salvar.';
      toast({
        title: 'Confirmação necessária',
        description: 'Por favor, confirme que a chave legada está correta.',
        variant: 'destructive',
      });
      setCurrentTab('identificacao');
      return;
    }

    if (formData.legacy_client_key && editingClienteId && legacyKeyManuallyEdited && !confirmLegacyKey) {
      newErrors.legacy_client_key = 'Você precisa confirmar a alteração da chave legada antes de salvar.';
      toast({
        title: 'Confirmação necessária',
        description: 'Por favor, confirme que a chave legada está correta.',
        variant: 'destructive',
      });
      setCurrentTab('identificacao');
      return;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      setCurrentTab('identificacao');
      return;
    }
    
    setErrors({});
    saveClientMutation.mutate(formData);
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      razao_social: '',
      cnpj: '',
      legacy_client_key: '',
      status: 'ativo',
      tipo_cliente: 'outro',
      cidade: '',
      estado: '',
      endereco_completo: '',
      cep: '',
      regiao: '',
      estimativa_habitantes: 0,
      abrangencia_atendimento: 'somente_cidade',
      responsavel_cliente_nome: '',
      responsavel_cliente_telefone: '',
      responsavel_cliente_email: '',
      responsavel_voxx_cs: '',
      responsavel_voxx_trafego: '',
      responsavel_google_ads: '',
      contas_anuncio: [],
      briefing: '',
      restrictions: '',
      observacoes_operacionais: '',
      procedimentos_foco: '',
      publico_alvo: '',
      contract_files: [],
      tags: [],
      fonte_entrada: 'outro',
      maturidade_digital: 'basico',
      google_leads_sheet_url: '',
    });
    setEditingClienteId(null);
    setLegacyKeyManuallyEdited(false);
    setConfirmLegacyKey(false);
    setErrors({});
    setCurrentTab('identificacao');
  };

  const handleEditCliente = (cliente) => {
    setFormData({
      nome: cliente.nome || '',
      razao_social: cliente.razao_social || '',
      cnpj: cliente.cnpj || '',
      legacy_client_key: cliente.legacy_client_key || '',
      status: cliente.status || 'ativo',
      tipo_cliente: cliente.tipo_cliente || 'outro',
      cidade: cliente.cidade || '',
      estado: cliente.estado || '',
      endereco_completo: cliente.endereco_completo || '',
      cep: cliente.cep || '',
      regiao: cliente.regiao || '',
      estimativa_habitantes: cliente.estimativa_habitantes || 0,
      abrangencia_atendimento: cliente.abrangencia_atendimento || 'somente_cidade',
      responsavel_cliente_nome: cliente.responsavel_cliente_nome || '',
      responsavel_cliente_telefone: cliente.responsavel_cliente_telefone || '',
      responsavel_cliente_email: cliente.responsavel_cliente_email || '',
      responsavel_voxx_cs: cliente.responsavel_voxx_cs || '',
      responsavel_voxx_trafego: cliente.responsavel_voxx_trafego || '',
      responsavel_google_ads: cliente.responsavel_google_ads || '',
      contas_anuncio: cliente.contas_anuncio || [],
      briefing: cliente.briefing || '',
      restrictions: cliente.restrictions || '',
      observacoes_operacionais: cliente.observacoes_operacionais || '',
      procedimentos_foco: cliente.procedimentos_foco || '',
      publico_alvo: cliente.publico_alvo || '',
      contract_files: cliente.contract_files || [],
      tags: cliente.tags || [],
      fonte_entrada: cliente.fonte_entrada || 'outro',
      maturidade_digital: cliente.maturidade_digital || 'basico',
      google_leads_sheet_url: cliente.google_leads_sheet_url || '',
    });
    setEditingClienteId(cliente.id);
    setLegacyKeyManuallyEdited(false);
    setConfirmLegacyKey(false);
    setViewMode('form');
  };

  const handleNewCliente = () => {
    resetForm();
    setViewMode('form');
  };

  const filteredClientes = allClientes.filter(c => {
    const search = searchTerm.trim().toLowerCase();
    return (
      c.nome?.toLowerCase().includes(search) ||
      c.cidade?.toLowerCase().includes(search) ||
      c.legacy_client_key?.toLowerCase().includes(search) ||
      c.responsavel_cliente_nome?.toLowerCase().includes(search)
    );
  });

  if (viewMode === 'list') {
    return (
      <div className="max-w-7xl mx-auto p-6 pb-12">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <UserPlus className="w-6 h-6 text-violet-600" />
                  Gerenciar Clientes
                </CardTitle>
                <p className="text-sm text-slate-500 mt-2">
                  Lista de todos os clientes cadastrados. Clique em editar para atualizar informações.
                </p>
              </div>
              <Button onClick={handleNewCliente} className="bg-violet-600 hover:bg-violet-700">
                <UserPlus className="w-4 h-4 mr-2" />
                Novo Cliente
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="mb-4">
              <Input
                placeholder="Buscar por nome, cidade ou chave legada..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>

            {loadingClientes ? (
              <div className="text-center py-12 text-slate-500">Carregando clientes...</div>
            ) : filteredClientes.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                {searchTerm ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredClientes.map((cliente) => (
                  <div
                    key={cliente.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-slate-900">{cliente.nome}</h3>
                        <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                          {cliente.status}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 mt-1">
                        {cliente.cidade}, {cliente.estado} • {cliente.legacy_client_key}
                      </div>
                      {cliente.responsavel_cliente_nome && (
                        <div className="text-xs text-slate-400 mt-1">
                          Responsável: {cliente.responsavel_cliente_nome}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditCliente(cliente)}
                    >
                      Editar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 pb-12">
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <UserPlus className="w-6 h-6 text-violet-600" />
                {editingClienteId ? 'Editar Cliente' : 'Cadastro de Novo Cliente'}
              </CardTitle>
              <p className="text-sm text-slate-500 mt-2">
                Preencha as informações do cliente. Campos marcados com * são obrigatórios.
              </p>
            </div>
            <Button variant="outline" onClick={() => setViewMode('list')}>
              Voltar para Lista
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit}>
            <Tabs value={currentTab} onValueChange={setCurrentTab}>
              <TabsList className="grid grid-cols-4 lg:grid-cols-8 mb-6">
                <TabsTrigger value="identificacao">Identificação</TabsTrigger>
                <TabsTrigger value="localizacao">Localização</TabsTrigger>
                <TabsTrigger value="contatos">Contatos</TabsTrigger>
                <TabsTrigger value="contas">Contas</TabsTrigger>
                <TabsTrigger value="briefing">Briefing</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
                <TabsTrigger value="integracoes">Integrações</TabsTrigger>
                <TabsTrigger value="metadados">Interno</TabsTrigger>
              </TabsList>

              {/* SEÇÃO A - Identificação */}
              <TabsContent value="identificacao" className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Identificação do Cliente</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nome">Nome Fantasia *</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => handleInputChange('nome', e.target.value)}
                        className={errors.nome ? 'border-red-500' : ''}
                        placeholder="Ex: Clínica Implante Perfeito"
                      />
                      {errors.nome && <p className="text-red-500 text-xs mt-1">{errors.nome}</p>}
                    </div>
                    
                    <div>
                      <Label htmlFor="razao_social">Razão Social</Label>
                      <Input
                        id="razao_social"
                        value={formData.razao_social}
                        onChange={(e) => handleInputChange('razao_social', e.target.value)}
                        placeholder="Razão social da empresa"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input
                        id="cnpj"
                        value={formData.cnpj}
                        onChange={(e) => handleInputChange('cnpj', e.target.value)}
                        placeholder="00.000.000/0000-00"
                      />
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="legacy_client_key">Chave Legada (Facebook/Planilhas)
                          <span className="ml-1 text-xs font-normal text-slate-400">(opcional)</span>
                        </Label>
                        {!legacyKeyManuallyEdited && formData.nome && formData.cidade && formData.legacy_client_key && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Auto-gerado
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Popover open={legacyKeyOpen} onOpenChange={setLegacyKeyOpen}>
                          <PopoverTrigger asChild>
                            <button
                              className={cn(
                                "flex-1 justify-between px-3 py-2 text-left border rounded-md transition-colors flex items-center",
                                errors.legacy_client_key || !legacyKeyUnique ? 'border-red-500 bg-red-50' : legacyKeyUnique && formData.legacy_client_key ? 'border-green-500' : 'border-input hover:border-slate-400',
                                legacyKeyOpen && 'ring-1 ring-violet-500'
                              )}
                              type="button"
                            >
                              <span className={formData.legacy_client_key ? 'text-slate-900' : 'text-slate-500'}>
                                {formData.legacy_client_key || 'Deixar em branco por enquanto...'}
                              </span>
                              {checkingUniqueness ? (
                                <RefreshCw className="w-4 h-4 text-slate-400 animate-spin ml-auto" />
                              ) : (
                                <ChevronsUpDown className="w-4 h-4 opacity-50 ml-auto" />
                              )}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0" align="start">
                            <Command>
                              <CommandInput
                                placeholder="Buscar ou digitar chave..."
                                value={legacyKeySearchTerm}
                                onValueChange={setLegacyKeySearchTerm}
                              />
                              <CommandEmpty>Nenhuma chave encontrada. Digite para criar nova.</CommandEmpty>
                              <CommandGroup>
                                {filteredLegacyKeys.map((key) => (
                                  <CommandItem
                                    key={key}
                                    value={key}
                                    onSelect={(value) => {
                                      handleInputChange('legacy_client_key', value);
                                      setLegacyKeyOpen(false);
                                      setLegacyKeySearchTerm('');
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.legacy_client_key === key ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {key}
                                  </CommandItem>
                                ))}
                                {legacyKeySearchTerm && !filteredLegacyKeys.includes(legacyKeySearchTerm) && (
                                  <CommandItem
                                    value={legacyKeySearchTerm}
                                    onSelect={(value) => {
                                      handleInputChange('legacy_client_key', value);
                                      setLegacyKeyOpen(false);
                                      setLegacyKeySearchTerm('');
                                    }}
                                    className="cursor-pointer bg-violet-50"
                                  >
                                    <Plus className="mr-2 h-4 w-4 text-violet-600" />
                                    <span className="text-violet-600">Criar nova: {legacyKeySearchTerm}</span>
                                  </CommandItem>
                                )}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {formData.legacy_client_key && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              handleInputChange('legacy_client_key', '');
                              setLegacyKeyManuallyEdited(true);
                              setConfirmLegacyKey(false);
                            }}
                            className="text-slate-400 hover:text-red-500"
                          >
                            Limpar
                          </Button>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 mt-1">
                        Necessária apenas para integrar com planilhas Meta/Facebook existentes. Pode ser preenchida depois.
                      </p>

                      {!legacyKeyUnique && (
                        <Alert className="mt-2 bg-red-50 border-red-200">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                          <AlertDescription className="text-red-700 text-xs">
                            Já existe um cliente com esta chave legada. Por favor, escolha outra.
                          </AlertDescription>
                        </Alert>
                      )}

                      {legacyKeyUnique && formData.legacy_client_key && (!editingClienteId || legacyKeyManuallyEdited) && (
                        <div className="flex items-center space-x-2 mt-3 p-3 bg-violet-50 rounded-lg border border-violet-200">
                          <Checkbox
                            id="confirm-legacy-key"
                            checked={confirmLegacyKey}
                            onCheckedChange={setConfirmLegacyKey}
                          />
                          <label
                            htmlFor="confirm-legacy-key"
                            className="text-xs font-medium text-slate-900 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            Confirmo que esta chave corresponde ao identificador usado nas planilhas/Facebook
                          </label>
                        </div>
                      )}

                      {errors.legacy_client_key && <p className="text-red-500 text-xs mt-1">{errors.legacy_client_key}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label htmlFor="status">Status do Cliente</Label>
                      <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                        <SelectTrigger id="status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="implantacao">Em Implantação</SelectItem>
                          <SelectItem value="pausado">Pausado</SelectItem>
                          <SelectItem value="encerrado">Encerrado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="tipo_cliente">Tipo de Cliente</Label>
                      <Select value={formData.tipo_cliente} onValueChange={(value) => handleInputChange('tipo_cliente', value)}>
                        <SelectTrigger id="tipo_cliente">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="oral_sin">Oral Sin</SelectItem>
                          <SelectItem value="particular">Particular</SelectItem>
                          <SelectItem value="franquia">Franquia</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                    <p><strong>Data de Cadastro:</strong> {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                    <p><strong>Cadastrado por:</strong> {user?.email || 'Sistema'}</p>
                  </div>
                </div>
              </TabsContent>

              {/* SEÇÃO B - Localização */}
              <TabsContent value="localizacao" className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Localização e Mercado</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cidade">Cidade *</Label>
                      <Input
                        id="cidade"
                        value={formData.cidade}
                        onChange={(e) => handleInputChange('cidade', e.target.value)}
                        className={errors.cidade ? 'border-red-500' : ''}
                        placeholder="Ex: Curitiba"
                      />
                      {errors.cidade && <p className="text-red-500 text-xs mt-1">{errors.cidade}</p>}
                    </div>
                    
                    <div>
                      <Label htmlFor="estado">Estado (UF) *</Label>
                      <Input
                        id="estado"
                        value={formData.estado}
                        onChange={(e) => handleInputChange('estado', e.target.value)}
                        className={errors.estado ? 'border-red-500' : ''}
                        placeholder="Ex: PR"
                        maxLength={2}
                      />
                      {errors.estado && <p className="text-red-500 text-xs mt-1">{errors.estado}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="endereco_completo">Endereço Completo</Label>
                      <Input
                        id="endereco_completo"
                        value={formData.endereco_completo}
                        onChange={(e) => handleInputChange('endereco_completo', e.target.value)}
                        placeholder="Rua, número, bairro, complemento"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        value={formData.cep}
                        onChange={(e) => handleInputChange('cep', e.target.value)}
                        placeholder="00000-000"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label htmlFor="regiao">Região</Label>
                      <Input
                        id="regiao"
                        value={formData.regiao}
                        onChange={(e) => handleInputChange('regiao', e.target.value)}
                        placeholder="Ex: Norte PR, Interior SP"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="estimativa_habitantes">Estimativa de Habitantes (Cidade)</Label>
                      <Input
                        id="estimativa_habitantes"
                        type="number"
                        value={formData.estimativa_habitantes}
                        onChange={(e) => handleInputChange('estimativa_habitantes', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <Label htmlFor="abrangencia_atendimento">Abrangência de Atendimento</Label>
                    <Select value={formData.abrangencia_atendimento} onValueChange={(value) => handleInputChange('abrangencia_atendimento', value)}>
                      <SelectTrigger id="abrangencia_atendimento">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="somente_cidade">Somente cidade</SelectItem>
                        <SelectItem value="cidade_regiao">Cidade + região</SelectItem>
                        <SelectItem value="estadual">Estadual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* SEÇÃO C - Contatos */}
              <TabsContent value="contatos" className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Contatos e Responsáveis</h3>
                  
                  <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-semibold text-slate-700 text-sm">Responsável do Cliente</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="responsavel_cliente_nome">Nome</Label>
                        <Input
                          id="responsavel_cliente_nome"
                          value={formData.responsavel_cliente_nome}
                          onChange={(e) => handleInputChange('responsavel_cliente_nome', e.target.value)}
                          placeholder="Nome do responsável"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="responsavel_cliente_telefone">Telefone / WhatsApp</Label>
                        <Input
                          id="responsavel_cliente_telefone"
                          value={formData.responsavel_cliente_telefone}
                          onChange={(e) => handleInputChange('responsavel_cliente_telefone', e.target.value)}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="responsavel_cliente_email">E-mail</Label>
                        <Input
                          id="responsavel_cliente_email"
                          type="email"
                          value={formData.responsavel_cliente_email}
                          onChange={(e) => handleInputChange('responsavel_cliente_email', e.target.value)}
                          placeholder="email@exemplo.com"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-4 bg-violet-50 rounded-lg mt-4">
                    <h4 className="font-semibold text-slate-700 text-sm">Responsáveis Voxx</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="responsavel_voxx_cs">Responsável CS / Atendimento</Label>
                        <Input
                          id="responsavel_voxx_cs"
                          value={formData.responsavel_voxx_cs}
                          onChange={(e) => handleInputChange('responsavel_voxx_cs', e.target.value)}
                          placeholder="Email do usuário Voxx"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="responsavel_voxx_trafego">Responsável Tráfego / Operação</Label>
                        <Input
                          id="responsavel_voxx_trafego"
                          value={formData.responsavel_voxx_trafego}
                          onChange={(e) => handleInputChange('responsavel_voxx_trafego', e.target.value)}
                          placeholder="Email do usuário Voxx"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="responsavel_google_ads">Responsável Google Ads</Label>
                        <Input
                          id="responsavel_google_ads"
                          value={formData.responsavel_google_ads}
                          onChange={(e) => handleInputChange('responsavel_google_ads', e.target.value)}
                          placeholder="Email do usuário Voxx"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* SEÇÃO D - Contas de Anúncio */}
              <TabsContent value="contas" className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Contas de Anúncio e Integrações</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Vincule as contas de anúncio do cliente. Para Meta Ads, selecione da lista sincronizada.
                  </p>
                  
                  {formData.status === 'ativo' && formData.contas_anuncio.length > 0 && formData.contas_anuncio.filter(c => c.plataforma === 'Meta' && c.conta_principal).length === 0 && (
                    <Alert className="mb-4">
                      <AlertTriangle className="w-4 h-4" />
                      <AlertDescription>
                        Há contas Meta Ads cadastradas mas nenhuma está marcada como principal.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <ContasAnuncioForm
                    contas={formData.contas_anuncio}
                    onChange={(contas) => handleInputChange('contas_anuncio', contas)}
                  />
                </div>
              </TabsContent>

              {/* SEÇÃO E - Briefing */}
              <TabsContent value="briefing" className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Briefing e Diretrizes</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="briefing">Briefing do Cliente</Label>
                      <Textarea
                        id="briefing"
                        value={formData.briefing}
                        onChange={(e) => handleInputChange('briefing', e.target.value)}
                        placeholder="Estratégia, foco, serviços/procedimentos, diferenciais da clínica..."
                        rows={5}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="restrictions">Restrições</Label>
                      <Textarea
                        id="restrictions"
                        value={formData.restrictions}
                        onChange={(e) => handleInputChange('restrictions', e.target.value)}
                        placeholder="Compliance, CRO, CADE, proibições, termos sensíveis, limitações..."
                        rows={4}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="observacoes_operacionais">Observações Operacionais Internas</Label>
                      <Textarea
                        id="observacoes_operacionais"
                        value={formData.observacoes_operacionais}
                        onChange={(e) => handleInputChange('observacoes_operacionais', e.target.value)}
                        placeholder="Rotina, particularidades, histórico, informações relevantes para a operação..."
                        rows={4}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="procedimentos_foco">Procedimentos/Produtos Foco</Label>
                        <Input
                          id="procedimentos_foco"
                          value={formData.procedimentos_foco}
                          onChange={(e) => handleInputChange('procedimentos_foco', e.target.value)}
                          placeholder="Ex: Implante, Protocolo, Ortodontia"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="publico_alvo">Público-alvo Prioritário</Label>
                        <Input
                          id="publico_alvo"
                          value={formData.publico_alvo}
                          onChange={(e) => handleInputChange('publico_alvo', e.target.value)}
                          placeholder="Ex: 40-60 anos, Classe A/B"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* SEÇÃO F - Documentos */}
              <TabsContent value="documentos" className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Documentos e Anexos</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Faça upload de contratos, aditivos e outros documentos relevantes.
                  </p>
                  
                  <DocumentUpload
                    files={formData.contract_files}
                    onChange={(files) => handleInputChange('contract_files', files)}
                  />
                </div>
              </TabsContent>

              {/* SEÇÃO G - Integrações */}
              <TabsContent value="integracoes" className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Integrações de Dados</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Configure integrações com planilhas e outras fontes de dados externas.
                  </p>
                  
                  <div>
                    <Label htmlFor="google_leads_sheet_url">URL da Planilha Google Sheets (Leads Google)</Label>
                    <Input
                      id="google_leads_sheet_url"
                      value={formData.google_leads_sheet_url}
                      onChange={(e) => handleInputChange('google_leads_sheet_url', e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="mt-1"
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      Cole aqui a URL completa da planilha Google Sheets contendo os leads do Google Ads. 
                      A planilha deve ter uma aba com o nome do mês atual (ex: "Janeiro", "Fevereiro") 
                      para que o sistema conte automaticamente os leads cadastrados.
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* SEÇÃO H - Metadados */}
              <TabsContent value="metadados" className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Metadados e Controle Interno</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="fonte_entrada">Fonte de Entrada</Label>
                      <Select value={formData.fonte_entrada} onValueChange={(value) => handleInputChange('fonte_entrada', value)}>
                        <SelectTrigger id="fonte_entrada">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="indicacao">Indicação</SelectItem>
                          <SelectItem value="inbound">Inbound</SelectItem>
                          <SelectItem value="outbound">Outbound</SelectItem>
                          <SelectItem value="parceiro">Parceiro</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="maturidade_digital">Maturidade Digital</Label>
                      <Select value={formData.maturidade_digital} onValueChange={(value) => handleInputChange('maturidade_digital', value)}>
                        <SelectTrigger id="maturidade_digital">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basico">Básico</SelectItem>
                          <SelectItem value="estruturado">Estruturado</SelectItem>
                          <SelectItem value="escalavel">Escalável</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="tags">Tags do Cliente</Label>
                      <Input
                        id="tags"
                        value={formData.tags.join(', ')}
                        onChange={(e) => handleInputChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                        placeholder="Premium, Alto ticket, Urgência"
                      />
                      <p className="text-xs text-slate-500 mt-1">Separe por vírgulas</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-8 pt-6 border-t flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Todos os dados são salvos com segurança e podem ser editados posteriormente.
              </p>
              <div className="flex gap-3">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setViewMode('list')}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-violet-600 hover:bg-violet-700 px-8" 
                  disabled={saveClientMutation.isPending}
                >
                  {saveClientMutation.isPending ? 'Salvando...' : editingClienteId ? 'Atualizar Cliente' : 'Cadastrar Cliente'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}