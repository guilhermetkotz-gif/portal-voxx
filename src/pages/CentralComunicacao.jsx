import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  MessageCircle, CheckCircle2, Clock, Send, AlertCircle, RefreshCw,
  FileText, Image, Video, Paperclip, Pencil, Trash2, Sparkles,
  Users, BarChart3, X, Eye, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const statusConfig = {
  aguardando_revisao: { label: 'Aguardando Revisão', color: 'bg-amber-100 text-amber-700', icon: Clock },
  pronto_envio: { label: 'Pronto para Envio', color: 'bg-blue-100 text-blue-700', icon: Send },
  enviado: { label: 'Enviado', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  erro: { label: 'Erro', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  cancelado: { label: 'Cancelado', color: 'bg-slate-100 text-slate-500', icon: X }
};

function ResumoCard({ resumo, onAprovar, onCancelar, onEditar, onRegenerar, isLoading }) {
  const [expanded, setExpanded] = useState(false);
  const [editando, setEditando] = useState(false);
  const [mensagem, setMensagem] = useState(resumo.mensagem_editada || resumo.mensagem_gerada || '');
  const cfg = statusConfig[resumo.status_envio] || statusConfig.aguardando_revisao;
  const Icon = cfg.icon;

  const handleSalvarEdicao = () => {
    onEditar(resumo.id, mensagem);
    setEditando(false);
  };

  const anexosImagens = (resumo.anexos || []).filter(a => a.tipo === 'imagem');
  const anexosVideos = (resumo.anexos || []).filter(a => a.tipo === 'video');
  const anexosOutros = (resumo.anexos || []).filter(a => !['imagem', 'video'].includes(a.tipo));

  return (
    <Card className="overflow-hidden border border-slate-200">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-slate-900">{resumo.cliente_nome}</span>
              {resumo.whatsapp_grupo_nome && (
                <span className="text-xs text-slate-400">• {resumo.whatsapp_grupo_nome}</span>
              )}
            </div>
            <span className="text-xs text-slate-500">
              {format(new Date(resumo.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </span>
          </div>
          <Badge className={cfg.color}>
            <Icon className="w-3 h-3 mr-1" />
            {cfg.label}
          </Badge>
        </div>

        {/* Métricas */}
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <BarChart3 className="w-4 h-4 text-violet-500" />
            <span>{resumo.total_acoes || 0} ações</span>
          </div>
          {(resumo.total_anexos || 0) > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <Paperclip className="w-4 h-4 text-violet-500" />
              <span>{resumo.total_anexos} anexos</span>
            </div>
          )}
          {anexosImagens.length > 0 && (
            <div className="flex items-center gap-1 text-sm text-slate-500">
              <Image className="w-3.5 h-3.5" /> {anexosImagens.length}
            </div>
          )}
          {anexosVideos.length > 0 && (
            <div className="flex items-center gap-1 text-sm text-slate-500">
              <Video className="w-3.5 h-3.5" /> {anexosVideos.length}
            </div>
          )}
          {anexosOutros.length > 0 && (
            <div className="flex items-center gap-1 text-sm text-slate-500">
              <FileText className="w-3.5 h-3.5" /> {anexosOutros.length}
            </div>
          )}
        </div>

        {/* Mensagem */}
        {editando ? (
          <div className="space-y-2">
            <textarea
              value={mensagem}
              onChange={e => setMensagem(e.target.value)}
              rows={8}
              className="w-full text-sm border border-slate-300 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSalvarEdicao}>Salvar</Button>
              <Button size="sm" variant="outline" onClick={() => { setEditando(false); setMensagem(resumo.mensagem_editada || resumo.mensagem_gerada || ''); }}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <div>
            <div className={`text-sm text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed ${!expanded ? 'max-h-32 overflow-hidden' : ''}`}>
              {resumo.mensagem_editada || resumo.mensagem_gerada || '—'}
            </div>
            {(resumo.mensagem_editada || resumo.mensagem_gerada || '').length > 300 && (
              <button onClick={() => setExpanded(!expanded)} className="text-xs text-violet-600 mt-1 flex items-center gap-1 hover:underline">
                {expanded ? <><ChevronUp className="w-3 h-3" /> Ver menos</> : <><ChevronDown className="w-3 h-3" /> Ver mais</>}
              </button>
            )}
            {resumo.mensagem_editada && (
              <p className="text-[10px] text-violet-500 mt-1">✏️ Editada manualmente</p>
            )}
          </div>
        )}
      </div>

      {/* Ações */}
      {resumo.status_envio === 'aguardando_revisao' && (
        <div className="px-5 pb-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => onAprovar(resumo.id)} disabled={isLoading}>
            <CheckCircle2 className="w-4 h-4 mr-1" /> Aprovar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditando(true)}>
            <Pencil className="w-4 h-4 mr-1" /> Editar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onRegenerar(resumo.id, resumo.cliente_id)} disabled={isLoading}>
            <Sparkles className="w-4 h-4 mr-1" /> Regenerar IA
          </Button>
          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => onCancelar(resumo.id)} disabled={isLoading}>
            <X className="w-4 h-4 mr-1" /> Cancelar
          </Button>
        </div>
      )}
      {resumo.status_envio === 'pronto_envio' && (
        <div className="px-5 pb-4 flex gap-2 border-t border-slate-100 pt-4">
          <Badge className="bg-blue-100 text-blue-700 flex items-center gap-1">
            <Send className="w-3 h-3" /> Aguardando integração WhatsApp
          </Badge>
          <Button size="sm" variant="ghost" className="text-slate-500" onClick={() => setEditando(true)}>
            <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function CentralComunicacao({ user }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('revisao');
  const [gerando, setGerando] = useState(false);

  const hoje = format(new Date(), 'yyyy-MM-dd');

  const { data: resumosHoje = [], isLoading } = useQuery({
    queryKey: ['resumosDiarios', hoje],
    queryFn: () => base44.entities.ResumoDiarioCliente.filter({ data: hoje }, '-created_date', 50),
    staleTime: 0
  });

  const { data: historico = [] } = useQuery({
    queryKey: ['resumosDiariosHistorico'],
    queryFn: () => base44.entities.ResumoDiarioCliente.list('-created_date', 100),
    staleTime: 60 * 1000
  });

  const { data: filaItens = [] } = useQuery({
    queryKey: ['filaComun'],
    queryFn: () => base44.entities.FilaComunicacaoCliente.filter({ status: 'aguardando' }, '-created_date', 100),
    staleTime: 0
  });

  // Stats
  const pendentes = resumosHoje.filter(r => r.status_envio === 'aguardando_revisao').length;
  const aprovados = resumosHoje.filter(r => r.status_envio === 'pronto_envio').length;
  const enviados = historico.filter(r => r.status_envio === 'enviado').length;
  const totalMes = historico.filter(r => r.data?.startsWith(format(new Date(), 'yyyy-MM'))).length;

  const mutacaoAtualizar = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ResumoDiarioCliente.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resumosDiarios'] })
  });

  const handleAprovar = (id) => {
    mutacaoAtualizar.mutate({ id, data: {
      status_revisao: 'aprovado',
      status_envio: 'pronto_envio',
      aprovado_por: user?.email,
      aprovado_por_nome: user?.full_name,
      aprovado_em: new Date().toISOString()
    }});
    toast.success('Resumo aprovado e marcado como pronto para envio!');
  };

  const handleCancelar = (id) => {
    mutacaoAtualizar.mutate({ id, data: { status_revisao: 'cancelado', status_envio: 'cancelado' }});
    toast.info('Resumo cancelado.');
  };

  const handleEditar = (id, mensagem) => {
    mutacaoAtualizar.mutate({ id, data: { mensagem_editada: mensagem, status_revisao: 'editado' }});
    toast.success('Mensagem salva.');
  };

  const handleRegenerar = async (id, clienteId) => {
    try {
      setGerando(true);
      await base44.functions.invoke('consolidarComunicacaoDiaria', { cliente_id: clienteId, forcar_regenerar: true });
      await queryClient.invalidateQueries({ queryKey: ['resumosDiarios'] });
      toast.success('Mensagem regenerada pela IA!');
    } catch {
      toast.error('Erro ao regenerar mensagem.');
    } finally {
      setGerando(false);
    }
  };

  const handleGerarTodos = async () => {
    try {
      setGerando(true);
      const res = await base44.functions.invoke('consolidarComunicacaoDiaria', {});
      await queryClient.invalidateQueries({ queryKey: ['resumosDiarios'] });
      const gerados = res.data?.resultados?.filter(r => r.status === 'gerado').length || 0;
      toast.success(`${gerados} resumo(s) gerado(s) com sucesso!`);
    } catch {
      toast.error('Erro ao gerar resumos.');
    } finally {
      setGerando(false);
    }
  };

  const resumosPendentes = resumosHoje.filter(r => r.status_envio === 'aguardando_revisao');
  const resumosProntos = resumosHoje.filter(r => r.status_envio === 'pronto_envio');
  const historicoFiltrado = historico.filter(r => r.status_envio !== 'aguardando_revisao' && r.status_envio !== 'pronto_envio');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <div className="p-2 bg-green-100 rounded-xl">
              <MessageCircle className="w-6 h-6 text-green-600" />
            </div>
            Central de Comunicação
          </h1>
          <p className="text-slate-500 mt-1">Geração e revisão de resumos diários para clientes via WhatsApp</p>
        </div>
        <Button
          onClick={handleGerarTodos}
          disabled={gerando}
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Gerar Resumos de Hoje
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-l-4 border-l-amber-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Aguardando Revisão</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{pendentes}</p>
            </div>
            <Clock className="w-8 h-8 text-amber-400" />
          </div>
        </Card>
        <Card className="p-5 border-l-4 border-l-blue-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Prontos para Envio</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{aprovados}</p>
            </div>
            <Send className="w-8 h-8 text-blue-400" />
          </div>
        </Card>
        <Card className="p-5 border-l-4 border-l-green-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Enviados (total)</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{enviados}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
        </Card>
        <Card className="p-5 border-l-4 border-l-violet-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Fila Pendente</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{filaItens.length}</p>
            </div>
            <Users className="w-8 h-8 text-violet-400" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="revisao">
            Revisão Hoje
            {pendentes > 0 && <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5">{pendentes}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="prontos">
            Prontos para Envio
            {aprovados > 0 && <Badge className="ml-2 bg-blue-500 text-white text-[10px] px-1.5">{aprovados}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="fila">Fila de Eventos</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* Revisão */}
        <TabsContent value="revisao">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
            </div>
          ) : resumosPendentes.length === 0 ? (
            <Card className="p-10 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">Nenhum resumo aguardando revisão</p>
              <p className="text-sm text-slate-400 mt-1">Clique em "Gerar Resumos de Hoje" para consolidar as ações do dia</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {resumosPendentes.map(r => (
                <ResumoCard key={r.id} resumo={r}
                  onAprovar={handleAprovar} onCancelar={handleCancelar}
                  onEditar={handleEditar} onRegenerar={handleRegenerar}
                  isLoading={mutacaoAtualizar.isPending || gerando}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Prontos */}
        <TabsContent value="prontos">
          {resumosProntos.length === 0 ? (
            <Card className="p-10 text-center">
              <Send className="w-12 h-12 text-blue-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">Nenhum resumo pronto para envio</p>
              <p className="text-sm text-slate-400 mt-1">Aprove os resumos na aba "Revisão Hoje"</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {resumosProntos.map(r => (
                <ResumoCard key={r.id} resumo={r}
                  onAprovar={handleAprovar} onCancelar={handleCancelar}
                  onEditar={handleEditar} onRegenerar={handleRegenerar}
                  isLoading={mutacaoAtualizar.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Fila de eventos */}
        <TabsContent value="fila">
          {filaItens.length === 0 ? (
            <Card className="p-10 text-center">
              <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">Fila vazia</p>
              <p className="text-sm text-slate-400 mt-1">Quando demandas forem concluídas ou ações registradas com "Comunicar ao cliente", aparecerão aqui</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Cliente</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Origem</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Resumo</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filaItens.map(item => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{item.cliente_nome}</td>
                      <td className="px-4 py-3">
                        <Badge className="bg-violet-100 text-violet-700">{item.origem}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{item.resumo}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {item.data_evento ? format(new Date(item.data_evento), 'dd/MM/yy') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className="bg-amber-100 text-amber-700">{item.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        {/* Histórico */}
        <TabsContent value="historico">
          {historicoFiltrado.length === 0 ? (
            <Card className="p-10 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">Nenhum registro no histórico ainda</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Cliente</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Ações</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Aprovado por</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoFiltrado.map(item => {
                    const cfg = statusConfig[item.status_envio] || statusConfig.aguardando_revisao;
                    return (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-700">
                          {item.data ? format(new Date(item.data), 'dd/MM/yyyy') : '—'}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{item.cliente_nome}</td>
                        <td className="px-4 py-3 text-slate-600">{item.total_acoes || 0} ações</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{item.aprovado_por_nome || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge className={cfg.color}>{cfg.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}