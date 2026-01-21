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
import { createPageUrl } from '@/utils';
import { UserPlus, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import ContasAnuncioForm from '@/components/cliente/ContasAnuncioForm';
import DocumentUpload from '@/components/cliente/DocumentUpload';
import { format } from 'date-fns';

export default function CadastroCliente() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
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
  });

  const [errors, setErrors] = useState({});
  const [currentTab, setCurrentTab] = useState('identificacao');
  const [legacyKeyManuallyEdited, setLegacyKeyManuallyEdited] = useState(false);
  const [legacyKeyUnique, setLegacyKeyUnique] = useState(true);
  const [checkingUniqueness, setCheckingUniqueness] = useState(false);
  const [confirmLegacyKey, setConfirmLegacyKey] = useState(false);

  const createClientMutation = useMutation({
    mutationFn: async (newClient) => {
      const existingClients = await base44.entities.Cliente.filter({ legacy_client_key: newClient.legacy_client_key });
      if (existingClients.length > 0) {
        throw new Error('Já existe um cliente com esta chave legada.');
      }
      
      // Validar conta principal Meta Ads se status ativo
      if (newClient.status === 'ativo') {
        const hasMetaPrincipal = newClient.contas_anuncio?.some(
          c => c.plataforma === 'Meta' && c.conta_principal
        );
        if (!hasMetaPrincipal && newClient.status !== 'implantacao') {
          throw new Error('Cliente ativo precisa de pelo menos uma conta Meta Ads principal.');
        }
      }
      
      return base44.entities.Cliente.create(newClient);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
      toast({
        title: 'Sucesso!',
        description: 'Cliente cadastrado com sucesso.',
      });
      navigate(createPageUrl('PlanejamentoEstrategico'));
    },
    onError: (error) => {
      toast({
        title: 'Erro ao cadastrar cliente',
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

  // Auto-gerar chave legada quando nome ou cidade mudam
  useEffect(() => {
    if (!legacyKeyManuallyEdited && formData.nome && formData.cidade) {
      const generated = generateLegacyKey(formData.nome, formData.cidade);
      setFormData((prev) => ({
        ...prev,
        legacy_client_key: generated,
      }));
    }
  }, [formData.nome, formData.cidade, legacyKeyManuallyEdited]);

  // Validar unicidade da chave legada
  useEffect(() => {
    if (!formData.legacy_client_key) {
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
  }, [formData.legacy_client_key]);

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
    if (!formData.legacy_client_key) newErrors.legacy_client_key = 'Chave legada é obrigatória.';
    if (!formData.cidade) newErrors.cidade = 'Cidade é obrigatória.';
    if (!formData.estado) newErrors.estado = 'Estado é obrigatório.';

    // Validar unicidade da chave legada
    if (!legacyKeyUnique) {
      newErrors.legacy_client_key = 'Já existe um cliente com esta chave legada.';
    }

    // Validar confirmação da chave legada
    if (!confirmLegacyKey) {
      newErrors.legacy_client_key = 'Você precisa confirmar a chave legada antes de salvar.';
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
    createClientMutation.mutate(formData);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 pb-12">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <UserPlus className="w-6 h-6 text-violet-600" />
            Cadastro de Novo Cliente
          </CardTitle>
          <p className="text-sm text-slate-500 mt-2">
            Preencha as informações do cliente. Campos marcados com * são obrigatórios.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit}>
            <Tabs value={currentTab} onValueChange={setCurrentTab}>
              <TabsList className="grid grid-cols-4 lg:grid-cols-7 mb-6">
                <TabsTrigger value="identificacao">Identificação</TabsTrigger>
                <TabsTrigger value="localizacao">Localização</TabsTrigger>
                <TabsTrigger value="contatos">Contatos</TabsTrigger>
                <TabsTrigger value="contas">Contas</TabsTrigger>
                <TabsTrigger value="briefing">Briefing</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
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
                        <Label htmlFor="legacy_client_key">Chave Legada do Cliente *</Label>
                        {!legacyKeyManuallyEdited && formData.nome && formData.cidade && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Auto-gerado
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          id="legacy_client_key"
                          value={formData.legacy_client_key}
                          onChange={(e) => handleInputChange('legacy_client_key', e.target.value)}
                          className={errors.legacy_client_key || !legacyKeyUnique ? 'border-red-500' : legacyKeyUnique && formData.legacy_client_key ? 'border-green-500' : ''}
                          placeholder="Nome Fantasia - Cidade"
                        />
                        {checkingUniqueness && (
                          <RefreshCw className="w-4 h-4 absolute right-3 top-3 text-slate-400 animate-spin" />
                        )}
                      </div>
                      
                      {!legacyKeyUnique && (
                        <Alert className="mt-2 bg-red-50 border-red-200">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                          <AlertDescription className="text-red-700 text-xs">
                            Já existe um cliente com esta chave legada. Por favor, escolha outra.
                          </AlertDescription>
                        </Alert>
                      )}

                      {legacyKeyUnique && formData.legacy_client_key && (
                        <Alert className="mt-2 bg-amber-50 border-amber-200">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <AlertDescription className="text-amber-700 text-xs">
                            <strong>Atenção:</strong> Confirme se esta chave corresponde ao identificador já usado nas planilhas e dados históricos.
                          </AlertDescription>
                        </Alert>
                      )}

                      {legacyKeyManuallyEdited && (
                        <Alert className="mt-2 bg-yellow-50 border-yellow-200">
                          <AlertTriangle className="w-4 h-4 text-yellow-600" />
                          <AlertDescription className="text-yellow-700 text-xs">
                            <strong>Aviso:</strong> Alterar esta chave pode causar perda de vínculo com dados antigos.
                          </AlertDescription>
                        </Alert>
                      )}

                      {legacyKeyUnique && formData.legacy_client_key && (
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
                            Confirmo que esta chave legada está correta e corresponde aos dados históricos
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  
                  {formData.status === 'ativo' && formData.contas_anuncio.filter(c => c.plataforma === 'Meta' && c.conta_principal).length === 0 && (
                    <Alert className="mb-4">
                      <AlertTriangle className="w-4 h-4" />
                      <AlertDescription>
                        Cliente ativo precisa de pelo menos uma conta Meta Ads principal.
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

              {/* SEÇÃO G - Metadados */}
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
              <Button 
                type="submit" 
                className="bg-violet-600 hover:bg-violet-700 px-8" 
                disabled={createClientMutation.isPending}
              >
                {createClientMutation.isPending ? 'Cadastrando...' : 'Cadastrar Cliente'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}