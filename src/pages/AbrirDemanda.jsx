import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  Zap,
  Target,
  Palette,
  Video,
  BarChart3,
  Settings,
  DollarSign,
  Upload,
  MessageCircle
} from 'lucide-react';
import CriacaoOralSinWizard from '@/components/demandas/CriacaoOralSinWizard';
import EdicaoVideoWizard from '@/components/demandas/EdicaoVideoWizard';
import BriefingUniversalWizard from '@/components/demandas/BriefingUniversalWizard';

const setores = [
  { 
    value: 'TRAFEGO_META', 
    label: '🔥 Tráfego – Meta Ads', 
    icon: Zap,
    subcategorias: [
      'Poucos leads',
      'Leads fora do perfil',
      'Leads repetidos',
      'CPL alto',
      'Ajuste de verba',
      'Pausar / ativar campanhas',
      'Criação de nova campanha',
      'Outro'
    ],
    campos: ['desde_quando', 'o_que_percebeu', 'urgente', 'observacoes']
  },
  { 
    value: 'TRAFEGO_GOOGLE', 
    label: '🔥 Tráfego – Google Ads', 
    icon: Target,
    subcategorias: [
      'Poucos leads',
      'Leads fora do perfil',
      'CPL alto',
      'Baixo volume de ligações',
      'Cliques sem conversão',
      'Criação de nova campanha',
      'Outro'
    ],
    campos: ['desde_quando', 'sintoma_principal', 'urgente']
  },
  { 
    value: 'TRAFEGO_TIKTOK', 
    label: '🔥 Tráfego – TikTok Ads', 
    icon: Zap,
    subcategorias: [
      'Poucos leads',
      'Baixo engajamento',
      'Criativo não performa',
      'CPL alto',
      'Nova campanha',
      'Outro'
    ],
    campos: ['tipo_criativo', 'desde_quando', 'urgente']
  },
  { 
    value: 'CRIACAO', 
    label: '✏️ Criação (Artes & Peças)', 
    icon: Palette,
    subcategorias: [
      'Arte para campanha',
      'Post feed',
      'Story',
      'Banner / panfleto / outdoor',
      'Data comemorativa',
      'Antes e depois',
      'Outro'
    ],
    campos: ['objetivo_peca', 'canal_uso', 'data_desejada', 'observacoes']
  },
  { 
    value: 'EDICAO', 
    label: '🎬 Edição de Vídeo', 
    icon: Video,
    subcategorias: [
      'Edição de vídeo para Ads',
      'Reels / Shorts',
      'Corte de vídeo longo',
      'Legendas',
      'Outro'
    ],
    campos: ['link_video', 'objetivo_video', 'canal_veiculacao', 'urgente']
  },
  { 
    value: 'BI_RELATORIO', 
    label: '📊 Relatórios / BI', 
    icon: BarChart3,
    subcategorias: [
      'CPL e volume de leads',
      'Relatório mensal',
      'Conferência de investimento',
      'Dashboard',
      'Outro'
    ],
    campos: ['periodo_desejado', 'duvida_esclarecer', 'canal']
  },
  { 
    value: 'IMPLANTACAO', 
    label: '🛠 Implantação / Acessos', 
    icon: Settings,
    subcategorias: [
      'Novo cliente',
      'Acesso BM / Google Ads',
      'Pixel / Tag / Conversões',
      'Correção de configuração',
      'Outro'
    ],
    campos: ['qual_acesso', 'links_logins', 'observacoes']
  },
  { 
    value: 'FINANCEIRO', 
    label: '💰 Financeiro / Administrativo', 
    icon: DollarSign,
    subcategorias: [
      'Boleto',
      'Nota fiscal',
      'Contrato',
      'Pagamento',
      'Tomada de investimento',
      'Outro'
    ],
    campos: ['descricao_pedido', 'periodo_referencia']
  },
  { 
    value: 'ALTERACAO_CRIACAO', 
    label: '✏️ Alteração Criação', 
    icon: Palette,
    subcategorias: [
      'Ajuste de arte',
      'Correção de texto',
      'Mudança de cores',
      'Alteração de layout',
      'Outro'
    ],
    campos: ['o_que_alterar', 'link_arquivo_original']
  },
  { 
    value: 'AUTOMACAO', 
    label: '🤖 Automação', 
    icon: Settings,
    subcategorias: [
      'Configuração de automação',
      'Fluxo de mensagens',
      'Integração',
      'Chatbot',
      'Outro'
    ],
    campos: ['tipo_automacao', 'plataforma']
  },
  { 
    value: 'SALDOS', 
    label: '💵 Saldos', 
    icon: DollarSign,
    subcategorias: [
      'Consulta de saldo',
      'Atualização de saldo',
      'Histórico de investimento',
      'Previsão de saldo',
      'Outro'
    ],
    campos: ['periodo_consulta', 'plataforma']
  }
];

export default function AbrirDemanda({ currentCliente, selectedClienteId }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [clienteId, setClienteId] = useState(selectedClienteId || '');
  const [searchCliente, setSearchCliente] = useState('');
  const [setor, setSetor] = useState('');
  const [subcategoria, setSubcategoria] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [prioridade, setPrioridade] = useState('media');
  const [previsaoEntrega, setPrevisaoEntrega] = useState('');
  const [camposAdicionais, setCamposAdicionais] = useState({});
  const [anexos, setAnexos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [comunicarCliente, setComunicarCliente] = useState(true);
  const [resumoEntregaCliente, setResumoEntregaCliente] = useState('');
  const [anexosExcluidos, setAnexosExcluidos] = useState([]);
  const [novaSubcategoria, setNovaSubcategoria] = useState('');
  const [mostrarNovaSubcategoria, setMostrarNovaSubcategoria] = useState(false);
  const [mostrarWizardOralSin, setMostrarWizardOralSin] = useState(false);
  const [mostrarWizardEdicao, setMostrarWizardEdicao] = useState(false);
  const [demandaId, setDemandaId] = useState(null);

  // Check URL params for pre-fill or edit
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tipo = params.get('tipo');
    const subtipo = params.get('subtipo');
    const editId = params.get('demanda_id');
    
    if (editId) {
      setDemandaId(editId);
    } else if (tipo) {
      setSetor(tipo);
      if (subtipo === 'investimento') {
        setSubcategoria('Tomada de investimento');
        setTitulo('Solicitação de tomada de investimento');
      }
    }
  }, []);

  // Buscar demanda existente para edição
  const { data: demandaExistente } = useQuery({
    queryKey: ['demandaEdit', demandaId],
    queryFn: () => base44.entities.Demanda.get(demandaId),
    enabled: !!demandaId,
    staleTime: 0
  });

  // Pré-preencher campos quando dados chegarem
  useEffect(() => {
    if (!demandaExistente) return;
    setClienteId(demandaExistente.cliente_id || '');
    setSearchCliente('');
    setSetor(demandaExistente.setor || '');
    setSubcategoria(demandaExistente.subcategoria || '');
    setTitulo(demandaExistente.titulo || '');
    setDescricao(demandaExistente.descricao || '');
    setUrgente(demandaExistente.urgente || false);
    setPrioridade(demandaExistente.prioridade || 'media');
    setPrevisaoEntrega(demandaExistente.previsao_entrega || '');
    setCamposAdicionais(demandaExistente.campos_adicionais || {});
    setAnexos(demandaExistente.anexos || []);
    setComunicarCliente(demandaExistente.comunicar_cliente ?? true);
    setResumoEntregaCliente(demandaExistente.resumo_entrega_cliente || '');
  }, [demandaExistente]);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientesDisponiveis', user?.id, user?.tipo_usuario, user?.tipo_acesso],
    queryFn: async () => {
      if (!user) return [];
      
      const tipoUsuario = user.tipo_usuario || user.tipo_acesso;
      
      // Usuários Voxx veem TODOS os clientes
      if (user.role === 'admin' || tipoUsuario === 'voxx_admin' || tipoUsuario === 'voxx_operacao' || tipoUsuario === 'voxx_manager') {
        return base44.entities.Cliente.list('-updated_date', 500);
      }
      
      // Clientes veem apenas os clientes atribuídos via UserClientAccess
      const access = await base44.entities.UserClientAccess.filter({
        usuario_id: user.id,
        status: 'ativo'
      });
      
      if (access.length > 0) {
        const clienteIds = access.map(a => a.cliente_id);
        const allClientes = await base44.entities.Cliente.list('-updated_date', 500);
        return allClientes.filter(c => clienteIds.includes(c.id));
      }
      
      return [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000
  });

  // Buscar colunas customizadas do Kanban
  const { data: kanbanColumns = [] } = useQuery({
    queryKey: ['kanbanColumns'],
    queryFn: () => base44.entities.KanbanColumn.list('-created_date', 100),
    staleTime: 5 * 60 * 1000
  });

  // Mesclar setores pré-definidos com colunas customizadas do Kanban
  const todosSetores = React.useMemo(() => {
    const setoresCustomizados = kanbanColumns
      .filter(col => !setores.some(s => s.value === col.column_id))
      .map(col => ({
        value: col.column_id,
        label: col.display_name || col.column_id,
        icon: Settings,
        subcategorias: ['Geral', 'Outro'],
        campos: []
      }));
    
    return [...setores, ...setoresCustomizados];
  }, [kanbanColumns]);

  const clienteSelecionado = clientes.find(c => c.id === clienteId);
  
  // Verificar se deve mostrar wizard Oral Sin
  const isOralSin = clienteSelecionado?.tipo_cliente === 'oral_sin' || 
                    clienteSelecionado?.marca?.toLowerCase().includes('oral sin') ||
                    clienteSelecionado?.nome?.toLowerCase().includes('oral sin');
  const deveMostrarWizard = setor === 'CRIACAO' && isOralSin && !mostrarWizardOralSin;
  const deveMostrarWizardUniversal = setor === 'CRIACAO' && clienteId && !isOralSin;
  
  const clientesFiltrados = clientes.filter(c => 
    c.nome?.toLowerCase().includes(searchCliente.toLowerCase()) ||
    c.marca?.toLowerCase().includes(searchCliente.toLowerCase()) ||
    c.cidade?.toLowerCase().includes(searchCliente.toLowerCase())
  );

  const { data: demandasExistentes = [] } = useQuery({
    queryKey: ['demandasExistentes', clienteId, setor],
    queryFn: () => base44.entities.Demanda.filter({
      cliente_id: clienteId,
      setor: setor,
      status: { $ne: 'concluida' }
    }),
    enabled: !!clienteId && !!setor,
    staleTime: 30 * 1000
  });

  const createDemanda = useMutation({
    mutationFn: async (data) => {
      const demanda = await base44.entities.Demanda.create(data);
      await base44.entities.TimelineEvent.create({
        demanda_id: demanda.id,
        cliente_id: data.cliente_id,
        tipo: 'criacao',
        descricao: `Demanda criada: ${data.titulo}`,
        autor: user?.full_name || user?.email,
        autor_tipo: 'cliente'
      });
      return demanda;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas'] });
      setSuccess(true);
    }
  });

  const updateDemanda = useMutation({
    mutationFn: async (data) => {
      await base44.entities.Demanda.update(demandaId, data);
      await base44.entities.TimelineEvent.create({
        demanda_id: demandaId,
        cliente_id: data.cliente_id,
        tipo: 'edicao',
        descricao: `Demanda editada: ${data.titulo}`,
        autor: user?.full_name || user?.email,
        autor_tipo: 'voxx'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas'] });
      queryClient.invalidateQueries({ queryKey: ['demandaEdit', demandaId] });
      setSuccess(true);
    }
  });

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    const uploadedUrls = [];

    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      uploadedUrls.push(file_url);
    }

    setAnexos([...anexos, ...uploadedUrls]);
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!clienteId || !setor || !titulo) return;

    const subcategoriaFinal = mostrarNovaSubcategoria ? novaSubcategoria : subcategoria;

    const anexosClienteFinal = comunicarCliente
      ? anexos.filter(u => !anexosExcluidos.includes(u)).map(url => ({ url, nome: 'Anexo', tipo: 'documento', enviar_cliente: true }))
      : [];

    const data = {
      cliente_id: clienteId,
      cliente_nome: clienteSelecionado?.nome,
      setor,
      setor_responsavel_original: setor,
      subcategoria: subcategoriaFinal,
      titulo,
      descricao,
      status: 'recebida',
      prioridade,
      urgente,
      previsao_entrega: previsaoEntrega || null,
      anexos,
      campos_adicionais: camposAdicionais,
      comunicar_cliente: comunicarCliente,
      resumo_entrega_cliente: resumoEntregaCliente || '',
      anexos_cliente: anexosClienteFinal
    };

    if (demandaId) {
      await updateDemanda.mutateAsync(data);
    } else {
      await createDemanda.mutateAsync(data);
    }
  };

  const handleWizardUniversalComplete = async (wizardData) => {
    const data = {
      cliente_id: clienteId,
      cliente_nome: clienteSelecionado?.nome,
      setor: 'CRIACAO',
      setor_responsavel_original: 'CRIACAO',
      subcategoria: 'Briefing Universal',
      titulo: wizardData.titulo,
      descricao: wizardData.descricao,
      status: 'recebida',
      prioridade: wizardData.urgente ? 'alta' : 'media',
      urgente: wizardData.urgente || false,
      previsao_entrega: wizardData.previsao_entrega || null,
      anexos: wizardData.anexos || [],
      campos_adicionais: wizardData.camposAdicionais,
      comunicar_cliente: comunicarCliente,
      resumo_entrega_cliente: resumoEntregaCliente || '',
      anexos_cliente: (wizardData.anexos || []).map(url => ({ url, nome: 'Anexo', tipo: 'documento', enviar_cliente: true }))
    };
    await createDemanda.mutateAsync(data);
  };

  const handleWizardComplete = async (wizardData) => {
    const data = {
      cliente_id: clienteId,
      cliente_nome: clienteSelecionado?.nome,
      setor: 'CRIACAO',
      setor_responsavel_original: 'CRIACAO',
      subcategoria: 'Briefing Oral Sin',
      titulo: wizardData.titulo,
      descricao: wizardData.descricao,
      status: 'recebida',
      prioridade: wizardData.camposAdicionais.urgencia_agenda === 'Sim' ? 'alta' : 'media',
      urgente: wizardData.camposAdicionais.urgencia_agenda === 'Sim',
      previsao_entrega: wizardData.camposAdicionais.data_desejada || null,
      anexos: wizardData.anexos,
      campos_adicionais: wizardData.camposAdicionais,
      comunicar_cliente: comunicarCliente,
      resumo_entrega_cliente: resumoEntregaCliente || '',
      anexos_cliente: (wizardData.anexos || []).map(url => ({ url, nome: 'Anexo', tipo: 'documento', enviar_cliente: true }))
    };

    await createDemanda.mutateAsync(data);
  };

  const handleWizardEdicaoComplete = async (wizardData) => {
    const data = {
      cliente_id: clienteId,
      cliente_nome: clienteSelecionado?.nome,
      setor: 'EDICAO',
      setor_responsavel_original: 'EDICAO',
      subcategoria: wizardData.subcategoria,
      titulo: wizardData.titulo,
      descricao: wizardData.descricao,
      status: 'recebida',
      prioridade: wizardData.urgente ? 'alta' : 'media',
      urgente: wizardData.urgente,
      previsao_entrega: wizardData.camposAdicionais.prazo_desejado || null,
      anexos: wizardData.anexos,
      campos_adicionais: wizardData.camposAdicionais,
      comunicar_cliente: comunicarCliente,
      resumo_entrega_cliente: resumoEntregaCliente || '',
      anexos_cliente: (wizardData.anexos || []).map(url => ({ url, nome: 'Anexo', tipo: 'documento', enviar_cliente: true }))
    };

    await createDemanda.mutateAsync(data);
  };

  const setorSelecionado = todosSetores.find(s => s.value === setor);
  const canViewerCreate = user?.tipo_acesso !== 'cliente_viewer';
  const isVoxx = user?.role === 'admin' || user?.tipo_acesso?.startsWith('voxx_');

  if (!canViewerCreate) {
    return (
      <Card className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Acesso restrito</h2>
        <p className="text-slate-500">
          Você não tem permissão para criar demandas. Entre em contato com o administrador da conta.
        </p>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="p-8 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{demandaId ? 'Demanda atualizada!' : 'Demanda registrada!'}</h2>
        <p className="text-slate-500 mb-6">
          {demandaId
            ? 'As informações da demanda foram salvas com sucesso.'
            : 'Nosso time já recebeu sua solicitação e você pode acompanhar o andamento pela timeline. Assim que houver atualização, você será notificado.'}
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate(createPageUrl('Demandas'))}>
            Ver Demandas
          </Button>
          <Button onClick={() => {
            setSuccess(false);
            setClienteId('');
            setSearchCliente('');
            setSetor('');
            setSubcategoria('');
            setNovaSubcategoria('');
            setMostrarNovaSubcategoria(false);
            setTitulo('');
            setDescricao('');
            setUrgente(false);
            setPrevisaoEntrega('');
            setCamposAdicionais({});
            setAnexos([]);
          }}>
            Abrir Nova Demanda
          </Button>
        </div>
      </Card>
    );
  }

  // Mostrar wizard se for Oral Sin + Criação
  if (deveMostrarWizard && clienteId) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="p-6 bg-gradient-to-r from-violet-50 to-blue-50 border-violet-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Briefing Oral Sin</h3>
              <p className="text-sm text-slate-600 mt-1">
                Vamos criar um briefing completo em 8 etapas rápidas. Tempo estimado: 90 segundos.
              </p>
            </div>
          </div>
        </Card>

        <CriacaoOralSinWizard
          cliente={clienteSelecionado}
          onComplete={handleWizardComplete}
          onCancel={() => {
            setMostrarWizardOralSin(false);
            setSetor('');
          }}
        />
      </div>
    );
  }

  // Mostrar wizard Universal para clientes NÃO Oral Sin ao selecionar CRIACAO
  if (deveMostrarWizardUniversal) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Briefing Universal – Criação de Artes</h3>
              <p className="text-sm text-slate-600 mt-1">
                Cliente: <strong>{clienteSelecionado?.nome}</strong> — Vamos criar um briefing completo em 8 etapas. Tempo estimado: 90 segundos.
              </p>
            </div>
          </div>
        </Card>
        <BriefingUniversalWizard
          cliente={clienteSelecionado}
          onComplete={handleWizardUniversalComplete}
          onCancel={() => setSetor('')}
        />
      </div>
    );
  }

  // Mostrar wizard de Edição de Vídeo - ativa automaticamente quando escolher EDICAO
  if (setor === 'EDICAO' && clienteId) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Briefing de Edição de Vídeo</h3>
              <p className="text-sm text-slate-600 mt-1">
                Vamos coletar todas as informações necessárias em 7 etapas. Tempo estimado: 2 minutos.
              </p>
            </div>
          </div>
        </Card>

        <EdicaoVideoWizard
          cliente={clienteSelecionado}
          subcategoria={subcategoria}
          onComplete={handleWizardEdicaoComplete}
          onCancel={() => {
            setSetor('');
            setSubcategoria('');
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Banner Oral Sin */}
      {setor === 'CRIACAO' && isOralSin && (
        <Card className="p-4 bg-violet-50 border-violet-200">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-violet-900">Briefing rápido disponível!</p>
              <p className="text-sm text-violet-700 mt-1">
                Para Oral Sin, temos um formulário guiado que facilita o briefing.
              </p>
              <Button
                size="sm"
                className="mt-3 bg-violet-600 hover:bg-violet-700"
                onClick={() => setMostrarWizardOralSin(true)}
              >
                Usar Briefing Guiado
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Banner Edição de Vídeo */}
      {setor === 'EDICAO' && subcategoria && !mostrarWizardEdicao && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Video className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-blue-900">Briefing guiado de edição</p>
              <p className="text-sm text-blue-700 mt-1">
                Use nosso formulário step-by-step para garantir um briefing completo e evitar retrabalho.
              </p>
              <Button
                size="sm"
                className="mt-3 bg-blue-600 hover:bg-blue-700"
                onClick={() => setMostrarWizardEdicao(true)}
              >
                Usar Briefing Guiado (Recomendado)
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Demanda similar warning */}
      {demandasExistentes.length > 0 && (
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">
                Já existe uma demanda semelhante em andamento
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Você tem {demandasExistentes.length} demanda(s) de {setorSelecionado?.label} abertas.
              </p>
              <Button 
                variant="link" 
                className="p-0 h-auto text-amber-700 underline mt-1"
                onClick={() => navigate(createPageUrl('Demandas'))}
              >
                Ver demandas existentes
              </Button>
            </div>
          </div>
        </Card>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-6">
          {/* Cliente */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <div className="space-y-2">
              <Input
                placeholder="Buscar cliente por nome, marca ou cidade..."
                value={searchCliente}
                onChange={(e) => setSearchCliente(e.target.value)}
                className="mb-2"
              />
              {searchCliente && clientesFiltrados.length > 0 && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {clientesFiltrados.slice(0, 10).map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setClienteId(c.id);
                        setSearchCliente(c.nome);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors border-b last:border-b-0 ${
                        clienteId === c.id ? 'bg-violet-50' : ''
                      }`}
                    >
                      <div className="font-medium text-slate-900">{c.nome}</div>
                      {c.marca && <div className="text-xs text-slate-500">{c.marca}</div>}
                      <div className="text-xs text-slate-400">{c.cidade} - {c.estado}</div>
                    </button>
                  ))}
                </div>
              )}
              {clienteSelecionado && !searchCliente && (
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
                  <div className="font-medium text-slate-900">{clienteSelecionado.nome}</div>
                  {clienteSelecionado.marca && <div className="text-xs text-slate-500">{clienteSelecionado.marca}</div>}
                  <div className="text-xs text-slate-400">{clienteSelecionado.cidade} - {clienteSelecionado.estado}</div>
                </div>
              )}
            </div>
          </div>

          {/* Setor */}
          <div className="space-y-2">
            <Label>Tipo de Demanda *</Label>
            <Select value={setor} onValueChange={(v) => { setSetor(v); setSubcategoria(''); setMostrarNovaSubcategoria(false); setNovaSubcategoria(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o setor" />
              </SelectTrigger>
              <SelectContent>
                {todosSetores.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subcategoria */}
          {setorSelecionado && (
            <div className="space-y-2">
              <Label>Subcategoria *</Label>
              {!mostrarNovaSubcategoria ? (
                <Select 
                  value={subcategoria} 
                  onValueChange={(v) => {
                    if (v === '__NOVA__') {
                      setMostrarNovaSubcategoria(true);
                      setSubcategoria('');
                    } else {
                      setSubcategoria(v);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {setorSelecionado.subcategorias.map(sub => (
                      <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                    ))}
                    {isVoxx && (
                      <SelectItem value="__NOVA__">➕ Adicionar nova subcategoria</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={novaSubcategoria}
                    onChange={(e) => setNovaSubcategoria(e.target.value)}
                    placeholder="Digite a nova subcategoria"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMostrarNovaSubcategoria(false);
                      setNovaSubcategoria('');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Título */}
          <div className="space-y-2">
            <Label>Título da Demanda *</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Descreva brevemente o que você precisa"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição detalhada</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Quanto mais detalhes você fornecer, mais rápida será a entrega"
              className="min-h-[120px]"
            />
          </div>

          {/* Campos específicos por setor */}
          {setorSelecionado && setor === 'TRAFEGO_META' && (
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-700">Informações adicionais</p>
              
              <div className="space-y-2">
                <Label className="text-sm">Desde quando o problema ocorre?</Label>
                <Input
                  value={camposAdicionais.desde_quando || ''}
                  onChange={(e) => setCamposAdicionais({...camposAdicionais, desde_quando: e.target.value})}
                  placeholder="Ex: há 3 dias, desde segunda-feira..."
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">O que você percebeu de diferente?</Label>
                <Textarea
                  value={camposAdicionais.o_que_percebeu || ''}
                  onChange={(e) => setCamposAdicionais({...camposAdicionais, o_que_percebeu: e.target.value})}
                  placeholder="Descreva o que mudou"
                  className="min-h-[80px]"
                />
              </div>

              {subcategoria === 'Leads repetidos' && (
                <div className="space-y-2">
                  <Label className="text-sm">Dos últimos 10 leads, quantos são repetidos?</Label>
                  <Input
                    type="number"
                    value={camposAdicionais.leads_repetidos || ''}
                    onChange={(e) => setCamposAdicionais({...camposAdicionais, leads_repetidos: e.target.value})}
                  />
                </div>
              )}
            </div>
          )}

          {setorSelecionado && setor === 'CRIACAO' && (
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-700">Informações da peça</p>
              
              <div className="space-y-2">
                <Label className="text-sm">Objetivo da peça</Label>
                <Input
                  value={camposAdicionais.objetivo_peca || ''}
                  onChange={(e) => setCamposAdicionais({...camposAdicionais, objetivo_peca: e.target.value})}
                  placeholder="Ex: promover campanha de implantes"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Canal de uso</Label>
                <Select 
                  value={camposAdicionais.canal_uso || ''} 
                  onValueChange={(v) => setCamposAdicionais({...camposAdicionais, canal_uso: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ads">Ads (Meta/Google)</SelectItem>
                    <SelectItem value="Feed">Feed (orgânico)</SelectItem>
                    <SelectItem value="Impressos">Impressos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Data desejada de entrega</Label>
                <Input
                  type="date"
                  value={camposAdicionais.data_desejada || ''}
                  onChange={(e) => setCamposAdicionais({...camposAdicionais, data_desejada: e.target.value})}
                />
              </div>
            </div>
          )}

          {/* Previsão de Entrega */}
          <div className="space-y-2">
            <Label>Prazo/Data de Entrega Desejada</Label>
            <Input
              type="date"
              value={previsaoEntrega}
              onChange={(e) => setPrevisaoEntrega(e.target.value)}
            />
          </div>

          {/* Prioridade & Urgente */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Urgente?</Label>
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={urgente} onCheckedChange={setUrgente} />
                <span className="text-sm text-slate-600">
                  {urgente ? 'Sim, é urgente' : 'Não'}
                </span>
              </div>
            </div>
          </div>

          {/* Anexos */}
          <div className="space-y-2">
            <Label>Anexos</Label>
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                {uploading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
                    <span className="text-sm text-slate-500">Enviando...</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Clique para enviar arquivos</p>
                    <p className="text-xs text-slate-400 mt-1">Imagens, vídeos, documentos</p>
                  </>
                )}
              </label>
            </div>
            {anexos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {anexos.map((url, index) => (
                  <span key={index} className="text-xs bg-slate-100 px-2 py-1 rounded">
                    Anexo {index + 1}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Comunicação com o Cliente */}
          <div className="border-t pt-5 space-y-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-green-600" />
              <p className="font-semibold text-slate-900 text-sm">Comunicação com o Cliente</p>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-700">Comunicar entrega ao cliente via WhatsApp?</p>
                <p className="text-xs text-slate-500 mt-0.5">A mensagem será enviada quando a demanda for concluída</p>
              </div>
              <Switch checked={comunicarCliente} onCheckedChange={setComunicarCliente} />
            </div>

            {comunicarCliente && (
              <div className="space-y-3 pl-0">
                <div className="space-y-1">
                  <Label className="text-sm">Resumo para o cliente <span className="text-slate-400 font-normal">(opcional)</span></Label>
                  <Input
                    value={resumoEntregaCliente}
                    onChange={e => setResumoEntregaCliente(e.target.value)}
                    placeholder="Ex: Material de campanha finalizado para utilização nas ações de comunicação."
                  />
                  <p className="text-xs text-slate-400">Se vazio, o sistema gerará automaticamente com base no título e setor</p>
                </div>

                {anexos.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm">Anexos disponíveis para o cliente</Label>
                    <div className="space-y-1.5">
                      {anexos.map((url, idx) => (
                        <label key={idx} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!anexosExcluidos.includes(url)}
                            onChange={e => {
                              if (e.target.checked) {
                                setAnexosExcluidos(prev => prev.filter(u => u !== url));
                              } else {
                                setAnexosExcluidos(prev => [...prev, url]);
                              }
                            }}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-slate-700">Anexo {idx + 1}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!comunicarCliente && (
              <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-2.5">
                ℹ️ Esta demanda está marcada como <strong>interna</strong> e não gerará comunicação automática ao cliente.
              </p>
            )}
          </div>

          {/* Submit */}
          <Button 
            type="submit" 
            className="w-full bg-violet-600 hover:bg-violet-700"
            disabled={!clienteId || !setor || !titulo || createDemanda.isPending || updateDemanda.isPending || (mostrarNovaSubcategoria && !novaSubcategoria)}
          >
            {(createDemanda.isPending || updateDemanda.isPending) ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {demandaId ? 'Salvando...' : 'Enviando...'}
              </>
            ) : (
              demandaId ? 'Salvar Alterações' : 'Enviar Demanda'
            )}
          </Button>
        </Card>
      </form>

      {/* Help text */}
      <Card className="p-4 bg-slate-50">
        <p className="text-sm text-slate-600">
          💡 <strong>Dica:</strong> Quanto mais contexto você enviar (prints, vídeos, exemplos), 
          mais rápida e assertiva será nossa entrega.
        </p>
      </Card>
    </div>
  );
}