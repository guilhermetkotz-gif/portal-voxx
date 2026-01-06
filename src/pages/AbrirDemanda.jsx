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
  Upload
} from 'lucide-react';

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
  }
];

export default function AbrirDemanda() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [setor, setSetor] = useState('');
  const [subcategoria, setSubcategoria] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [prioridade, setPrioridade] = useState('media');
  const [camposAdicionais, setCamposAdicionais] = useState({});
  const [anexos, setAnexos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Check URL params for pre-fill
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tipo = params.get('tipo');
    const subtipo = params.get('subtipo');
    
    if (tipo) {
      setSetor(tipo);
      if (subtipo === 'investimento') {
        setSubcategoria('Tomada de investimento');
        setTitulo('Solicitação de tomada de investimento');
      }
    }
  }, []);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', user?.cliente_id],
    queryFn: async () => {
      if (user?.cliente_id) {
        return base44.entities.Cliente.filter({ id: user.cliente_id });
      }
      return [];
    },
    enabled: !!user?.cliente_id,
    staleTime: 60 * 1000
  });

  const cliente = clientes[0];

  const { data: demandasExistentes = [] } = useQuery({
    queryKey: ['demandasExistentes', user?.cliente_id, setor],
    queryFn: () => base44.entities.Demanda.filter({
      cliente_id: user?.cliente_id,
      setor: setor,
      status: { $ne: 'concluida' }
    }),
    enabled: !!user?.cliente_id && !!setor,
    staleTime: 30 * 1000
  });

  const createDemanda = useMutation({
    mutationFn: async (data) => {
      // Create demanda
      const demanda = await base44.entities.Demanda.create(data);
      
      // Create initial timeline event
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
    
    if (!setor || !titulo) return;

    const data = {
      cliente_id: user?.cliente_id,
      cliente_nome: cliente?.nome,
      setor,
      subcategoria,
      titulo,
      descricao,
      status: 'recebida',
      prioridade,
      urgente,
      anexos,
      campos_adicionais: camposAdicionais
    };

    await createDemanda.mutateAsync(data);
  };

  const setorSelecionado = setores.find(s => s.value === setor);
  const canViewerCreate = user?.tipo_acesso !== 'cliente_viewer';

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
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Demanda registrada!</h2>
        <p className="text-slate-500 mb-6">
          Nosso time já recebeu sua solicitação e você pode acompanhar o andamento pela timeline.
          Assim que houver atualização, você será notificado.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate(createPageUrl('Demandas'))}>
            Ver Demandas
          </Button>
          <Button onClick={() => {
            setSuccess(false);
            setSetor('');
            setSubcategoria('');
            setTitulo('');
            setDescricao('');
            setUrgente(false);
            setCamposAdicionais({});
            setAnexos([]);
          }}>
            Abrir Nova Demanda
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
          {/* Setor */}
          <div className="space-y-2">
            <Label>Tipo de Demanda *</Label>
            <Select value={setor} onValueChange={(v) => { setSetor(v); setSubcategoria(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o setor" />
              </SelectTrigger>
              <SelectContent>
                {setores.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subcategoria */}
          {setorSelecionado && (
            <div className="space-y-2">
              <Label>Subcategoria *</Label>
              <Select value={subcategoria} onValueChange={setSubcategoria}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {setorSelecionado.subcategorias.map(sub => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          {/* Submit */}
          <Button 
            type="submit" 
            className="w-full bg-violet-600 hover:bg-violet-700"
            disabled={!setor || !titulo || createDemanda.isPending}
          >
            {createDemanda.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar Demanda'
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