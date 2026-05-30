import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MessageCircle, CheckCircle2, Clock, Send, AlertCircle, RefreshCw,
  FileText, Image, Video, Paperclip, Pencil, Trash2, Sparkles,
  Users, BarChart3, X, Eye, ChevronDown, ChevronUp, Loader2,
  Wifi, WifiOff, FlaskConical, Zap, CheckCheck, Filter
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

  const todosAnexos = resumo.anexos || [];
  const totalAnexos = todosAnexos.length;
  const tipoIcone = (tipo) => {
    if (tipo === 'imagem') return '🖼️';
    if (tipo === 'video') return '🎬';
    if (tipo === 'pdf') return '📄';
    if (tipo === 'documento') return '📝';
    return '📎';
  };

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
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <Paperclip className="w-4 h-4 text-violet-500" />
            <span>📎 Anexos encontrados: <strong>{totalAnexos}</strong></span>
          </div>
        </div>

        {/* Lista de Anexos */}
        {totalAnexos > 0 && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-700 mb-2">📎 Arquivos a enviar ({totalAnexos})</p>
            <ul className="space-y-1">
              {todosAnexos.map((a, idx) => (
                <li key={idx} className="flex items-center gap-2 text-xs text-blue-800">
                  <span>{tipoIcone(a.tipo)}</span>
                  <span className="font-medium">{a.nome || 'Arquivo sem nome'}</span>
                  {a.tipo && <Badge className="bg-blue-100 text-blue-600 text-[10px] px-1.5 py-0">{a.tipo}</Badge>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {totalAnexos === 0 && (
          <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <p className="text-xs text-slate-400">📎 Nenhum arquivo anexado — a frase "Arquivos em anexo" não será exibida na mensagem.</p>
          </div>
        )}

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
  const [ativando, setAtivando] = useState(false);
  const [criandoTeste, setCriandoTeste] = useState(false);
  const [clienteTesteId, setClienteTesteId] = useState('');
  const [resultadoAtivacao, setResultadoAtivacao] = useState(null);

  const hoje = format(new Date(), 'yyyy-MM-dd');
  const [dataSelecionada, setDataSelecionada] = useState(hoje);

  const { data: resumosHoje = [], isLoading } = useQuery({
    queryKey: ['resumosDiarios', dataSelecionada],
    queryFn: () => base44.entities.ResumoDiarioCliente.filter({ data: dataSelecionada }, '-created_date', 50),
    staleTime: 0
  });

  const { data: historico = [] } = useQuery({
    queryKey: ['resumosDiariosHistorico'],
    queryFn: () => base44.entities.ResumoDiarioCliente.list('-created_date', 100),
    staleTime: 60 * 1000
  });

  const { data: filaItens = [], refetch: refetchFila } = useQuery({
    queryKey: ['filaComun'],
    queryFn: () => base44.entities.FilaComunicacaoCliente.filter({ status: 'aguardando' }, '-created_date', 100),
    staleTime: 0
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientesParaComunicacao'],
    queryFn: () => base44.entities.Cliente.filter({ status: 'ativo' }, '-nome', 200),
    staleTime: 60 * 1000
  });

  const { data: demandasRecentes = [] } = useQuery({
    queryKey: ['demandasRecentesComunicacao', hoje],
    queryFn: () => base44.entities.Demanda.filter({}, '-updated_date', 200),
    staleTime: 30 * 1000
  });

  const { data: otimizacoesHoje = [] } = useQuery({
    queryKey: ['otimizacoesMetaHoje', hoje],
    queryFn: () => base44.entities.MetaAdsOtimizacao.filter({ comunicar_cliente: true }, '-created_date', 200),
    staleTime: 30 * 1000
  });

  const clientesComEnvio = clientes.filter(c => c.whatsapp_envio_ativo);
  const clientesSemGrupo = clientesComEnvio.filter(c => !c.whatsapp_grupo_id);
  const concluidasStatus = demandasRecentes.filter(d => d.status === 'concluida' || d.status === 'finalizada');
  const demandasConcluidasHoje = concluidasStatus.filter(d =>
    d.data_conclusao?.startsWith(hoje) || d.updated_date?.startsWith(hoje)
  );
  const demandasConcluidasHojeComunicar = demandasConcluidasHoje.filter(d => d.comunicar_cliente);
  const demandasConcluidasHojeSemDataConclusao = demandasConcluidasHoje.filter(d => !d.data_conclusao);
  const filaHoje = filaItens.filter(i => i.data_evento === hoje);
  const otimizacoesHojeCount = otimizacoesHoje.filter(o =>
    (o.data_acao || o.created_date?.split('T')[0] || '').startsWith(hoje)
  ).length;

  // Stats
  const pendentes = resumosHoje.filter(r => r.status_envio === 'aguardando_revisao').length;
  const aprovados = resumosHoje.filter(r => r.status_envio === 'pronto_envio').length;
  const enviados = historico.filter(r => r.status_envio === 'enviado').length;
  const totalMes = historico.filter(r => r.data?.startsWith(format(new Date(), 'yyyy-MM'))).length;

  const mutacaoAtualizar = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ResumoDiarioCliente.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resumosDiarios'] })
  });

  const handleLimparRevisaoHoje = async () => {
    setLimpandoHoje(true);
    const itens = resumosHoje.filter(r => r.data === dataSelecionada);
    let filaResetados = 0;
    for (const item of itens) {
      // Resetar itens da fila que foram consolidados por este resumo
      const idsConsolidados = item.itens_consolidados || [];
      for (const filaId of idsConsolidados) {
        try {
          await base44.entities.FilaComunicacaoCliente.update(filaId, { status: 'aguardando', resumo_diario_id: null });
          filaResetados++;
        } catch {}
      }
      try { await base44.entities.ResumoDiarioCliente.delete(item.id); } catch {}
    }
    // Também resetar flag de idempotência nas demandas relacionadas
    // para que o fallback possa re-enfileirá-las se necessário
    await queryClient.invalidateQueries({ queryKey: ['resumosDiarios'] });
    await queryClient.invalidateQueries({ queryKey: ['filaComun'] });
    setLimpandoHoje(false);
    toast.success(`${itens.length} resumo(s) excluído(s) e ${filaResetados} evento(s) da fila resetados. Agora você pode gerar novamente.`);
  };

  const handleExcluirPorStatus = async (status) => {
    setExcluindoStatus(status);
    const itens = await base44.entities.FilaComunicacaoCliente.filter({ status });
    for (const item of itens) {
      await base44.entities.FilaComunicacaoCliente.delete(item.id);
    }
    await queryClient.invalidateQueries({ queryKey: ['filaComun'] });
    setExcluindoStatus(null);
    setConfirmandoExclusao(null);
    toast.success(`${itens.length} evento(s) com status "${status}" excluído(s).`);
  };

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

  const handleAtivarClientes = async () => {
    setAtivando(true);
    setResultadoAtivacao(null);
    const res = await base44.functions.invoke('ativarComunicacaoClientes', {});
    setResultadoAtivacao(res.data);
    queryClient.invalidateQueries({ queryKey: ['clientesParaComunicacao'] });
    setAtivando(false);
    if (res.data?.success) toast.success(`${res.data.atualizados} cliente(s) habilitado(s)!`);
  };

  const handleCriarEventoTeste = async () => {
    if (!clienteTesteId) { toast.error('Selecione um cliente para o evento de teste.'); return; }
    const cliente = clientes.find(c => c.id === clienteTesteId);
    setCriandoTeste(true);
    await base44.entities.FilaComunicacaoCliente.create({
      cliente_id: clienteTesteId,
      cliente_nome: cliente?.nome || 'Cliente Teste',
      origem: 'manual',
      tipo_evento: 'entrega',
      tipo_entrega: 'Meta Ads',
      resumo: '[TESTE] Otimização de campanha realizada — ajuste de segmentação e criativos para melhorar CPL.',
      data_evento: hoje,
      usuario_responsavel: user?.email || '',
      usuario_responsavel_nome: user?.full_name || '',
      status: 'aguardando'
    });
    queryClient.invalidateQueries({ queryKey: ['filaComun'] });
    setCriandoTeste(false);
    toast.success('Evento de teste criado na fila!');
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

  const [diagnostico, setDiagnostico] = useState(null);
  const [progresso, setProgresso] = useState({ ativo: false, mensagem: '', clientes_processados: 0, total_estimado: 0 });
  const [excluindoStatus, setExcluindoStatus] = useState(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(null);
  const [limpandoHoje, setLimpandoHoje] = useState(false);

  const handleGerarTodos = async () => {
    try {
      setGerando(true);
      setDiagnostico(null);
      setProgresso({ ativo: true, mensagem: 'Iniciando geração...', clientes_processados: 0, total_estimado: clientesComEnvio.length });
      
      const semResumos = resumosHoje.length === 0;
      const res = await base44.functions.invoke('consolidarComunicacaoDiaria', { 
        data: dataSelecionada,
        forcar_regenerar: semResumos
      });
      
      setProgresso({ ativo: true, mensagem: 'Atualizando interface...', clientes_processados: res.data?.gerados || 0, total_estimado: clientesComEnvio.length });
      
      await queryClient.invalidateQueries({ queryKey: ['resumosDiarios'] });
      await queryClient.invalidateQueries({ queryKey: ['filaComun'] });
      
      const gerados = res.data?.gerados || 0;
      const jaExistem = (res.data?.resultados || []).filter(r => r.status === 'ja_existe').length;
      
      setTimeout(() => {
        setProgresso({ ativo: false, mensagem: '', clientes_processados: 0, total_estimado: 0 });
        setDiagnostico(null);
        
        if (gerados > 0) {
          toast.success(`${gerados} resumo(s) gerado(s) com sucesso!`);
        } else if (jaExistem > 0) {
          toast.info(`${jaExistem} resumo(s) já existem para hoje — use "Limpar resumos de hoje" para regenerar.`);
        } else {
          toast.info('Nenhuma ação pendente para consolidar hoje.');
        }
      }, 800);
    } catch (e) {
      setProgresso({ ativo: false, mensagem: '', clientes_processados: 0, total_estimado: 0 });
      toast.error('Erro ao gerar resumos: ' + (e.message || ''));
    } finally {
      setGerando(false);
    }
  };

  const resumosPendentes = resumosHoje.filter(r => r.status_envio === 'aguardando_revisao');
  const resumosProntos = resumosHoje.filter(r => r.status_envio === 'pronto_envio');
  const historicoFiltrado = historico.filter(r => r.status_envio !== 'aguardando_revisao' && r.status_envio !== 'pronto_envio');

  return (
    <div className="space-y-6">
      {/* Modal de Progresso */}
      {progresso.ativo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-center justify-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-600 animate-spin"></div>
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-slate-900 text-lg">Gerando resumos...</h3>
              <p className="text-sm text-slate-600">{progresso.mensagem}</p>
            </div>
            {progresso.total_estimado > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Progresso</span>
                  <span>{progresso.clientes_processados} de {progresso.total_estimado}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-violet-600 transition-all duration-300"
                    style={{ width: `${progresso.total_estimado > 0 ? (progresso.clientes_processados / progresso.total_estimado) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dataSelecionada}
            onChange={e => setDataSelecionada(e.target.value)}
            max={hoje}
            className="h-10 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <Button
            onClick={handleGerarTodos}
            disabled={gerando}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Gerar Resumos
          </Button>
        </div>
      </div>

      {/* Ferramentas */}
      <div className="flex flex-wrap gap-3 items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAtivarClientes}
          disabled={ativando}
          className="text-green-700 border-green-300 hover:bg-green-50"
        >
          {ativando ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5 mr-1.5" />}
          Ativar comunicação para todos os clientes ativos
        </Button>

        <div className="flex items-center gap-2">
          <Select value={clienteTesteId} onValueChange={setClienteTesteId}>
            <SelectTrigger className="h-8 w-52 text-xs">
              <SelectValue placeholder="Cliente para teste" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCriarEventoTeste}
            disabled={criandoTeste || !clienteTesteId}
            className="text-violet-700 border-violet-300 hover:bg-violet-50"
          >
            {criandoTeste ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5 mr-1.5" />}
            Criar evento de teste
          </Button>
        </div>
      </div>

      {resultadoAtivacao?.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-center gap-2">
          <CheckCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span>
            Ativação concluída: <strong>{resultadoAtivacao.atualizados}</strong> atualizado(s),
            {' '}<strong>{resultadoAtivacao.ja_habilitados}</strong> já estavam habilitados.
            Total de clientes ativos: <strong>{resultadoAtivacao.total_clientes_ativos}</strong>.
          </span>
          <button onClick={() => setResultadoAtivacao(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Diagnóstico Permanente */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wifi className="w-4 h-4 text-green-500" />
            <p className="text-xs text-slate-500">Com comunicação ativa</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{clientesComEnvio.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">de {clientes.length} clientes ativos</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <WifiOff className="w-4 h-4 text-amber-500" />
            <p className="text-xs text-slate-500">Sem grupo WhatsApp</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{clientesSemGrupo.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">habilitados sem grupo configurado</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
            <p className="text-xs text-slate-500">Concluídas hoje</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{demandasConcluidasHoje.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {demandasConcluidasHojeComunicar.length} para comunicar
            {demandasConcluidasHojeSemDataConclusao.length > 0 && (
              <span className="text-amber-500 ml-1">· {demandasConcluidasHojeSemDataConclusao.length} sem data_conclusao</span>
            )}
          </p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-violet-500" />
            <p className="text-xs text-slate-500">Eventos gerados hoje</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{filaHoje.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">na fila de comunicação</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <p className="text-xs text-slate-500">Ações Meta Ads hoje</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{otimizacoesHojeCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">com comunicar ao cliente</p>
        </div>
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

      {/* Diagnóstico */}
      {diagnostico && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-amber-900">Diagnóstico — Por que nenhum resumo foi gerado?</h3>
            <button onClick={() => setDiagnostico(null)} className="ml-auto text-amber-500 hover:text-amber-700"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div className="bg-white rounded-lg p-3 border border-amber-200">
              <p className="text-slate-500 text-xs">Itens na fila (aguardando)</p>
              <p className="text-2xl font-bold text-slate-900">{diagnostico.itens_aguardando}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">
              <p className="text-slate-500 text-xs">Clientes com envio ativo</p>
              <p className="text-2xl font-bold text-slate-900">{diagnostico.clientes_com_envio_ativo}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">
              <p className="text-slate-500 text-xs">Itens sem cliente elegível</p>
              <p className="text-2xl font-bold text-slate-900">{diagnostico.itens_sem_cliente_encontrado}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">
              <p className="text-slate-500 text-xs">Total fila</p>
              <p className="text-2xl font-bold text-slate-900">{diagnostico.total_itens_fila}</p>
            </div>
          </div>
          {diagnostico.motivos_nao_geracao?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Motivos:</p>
              {diagnostico.motivos_nao_geracao.map((m, i) => (
                <p key={i} className="text-sm text-amber-800 flex items-start gap-1.5">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  {m}
                </p>
              ))}
            </div>
          )}
          {diagnostico.detalhes_por_cliente?.filter(d => d.status !== 'gerado').length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Por cliente:</p>
              {diagnostico.detalhes_por_cliente.filter(d => d.status !== 'gerado').map((d, i) => (
                <p key={i} className="text-sm text-amber-700">
                  <span className="font-medium">{d.cliente_nome}</span>: {d.motivo}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="revisao">
            Revisão Hoje
            {pendentes > 0 && <Badge className="ml-2 bg-orange-500 text-white text-[10px] px-1.5 py-0">{pendentes}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="prontos">
            Prontos para Envio
            {aprovados > 0 && <Badge className="ml-2 bg-blue-500 text-white text-[10px] px-1.5 py-0">{aprovados}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="fila">
            Fila de Eventos
            {filaItens.length > 0 && <Badge className="ml-2 bg-slate-500 text-white text-[10px] px-1.5 py-0">{filaItens.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="historico">
            Histórico
            {enviados > 0 && <Badge className="ml-2 bg-green-500 text-white text-[10px] px-1.5 py-0">{enviados}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="fluxo">Status do Fluxo</TabsTrigger>
        </TabsList>

        {/* Revisão */}
        <TabsContent value="revisao">
          {resumosHoje.length > 0 && (
            <div className="flex justify-end mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLimparRevisaoHoje}
                disabled={limpandoHoje}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                {limpandoHoje ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                Limpar resumos de hoje
              </Button>
            </div>
          )}
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
          {/* Controles de exclusão por status */}
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <span className="text-sm text-slate-500 flex items-center gap-1.5"><Filter className="w-4 h-4" /> Excluir por status:</span>
            {['aguardando', 'consolidado', 'descartado', 'enviado', 'erro'].map(s => (
              <button
                key={s}
                onClick={() => setConfirmandoExclusao(s)}
                disabled={!!excluindoStatus}
                className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {excluindoStatus === s ? <Loader2 className="w-3 h-3 animate-spin inline" /> : <Trash2 className="w-3 h-3 inline mr-1" />}
                {s}
              </button>
            ))}
          </div>

          {/* Modal de confirmação */}
          {confirmandoExclusao && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg"><Trash2 className="w-5 h-5 text-red-600" /></div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Confirmar exclusão</h3>
                    <p className="text-sm text-slate-500">Esta ação não pode ser desfeita.</p>
                  </div>
                </div>
                <p className="text-sm text-slate-700">
                  Todos os eventos com status <strong className="text-red-600">"{confirmandoExclusao}"</strong> serão excluídos permanentemente.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setConfirmandoExclusao(null)}>Cancelar</Button>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleExcluirPorStatus(confirmandoExclusao)}
                    disabled={!!excluindoStatus}
                  >
                    {excluindoStatus ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                    Excluir todos
                  </Button>
                </div>
              </div>
            </div>
          )}

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

        {/* Status do Fluxo */}
        <TabsContent value="fluxo">
          <div className="space-y-4">
            {/* Automações */}
            <Card className="p-5 space-y-4">
              <h3 className="font-semibold text-slate-900">Automações de Comunicação</h3>
              <div className="space-y-3">
                {[
                  {
                    nome: 'Fila de Comunicação — Demanda Concluída',
                    ativa: true,
                    entidade: 'Demanda',
                    evento: 'update',
                    condicoes: 'comunicar_cliente = true + status em [concluida, finalizada] + changed_fields contains status',
                    funcao: 'processarDemandaConcluida'
                  },
                  {
                    nome: 'Fila de Comunicação — Otimização Meta Ads',
                    ativa: true,
                    entidade: 'MetaAdsOtimizacao',
                    evento: 'create / update',
                    condicoes: 'comunicar_cliente = true',
                    funcao: 'processarOtimizacaoMeta'
                  },
                  {
                    nome: 'Consolidação Diária de Comunicação',
                    ativa: true,
                    entidade: null,
                    evento: 'Agendada — 17:30 diário',
                    condicoes: 'Consolida todos os itens da FilaComunicacaoCliente com status aguardando',
                    funcao: 'consolidarComunicacaoDiaria'
                  }
                ].map((a, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg">
                    <span className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${a.ativa ? 'bg-green-500' : 'bg-red-400'}`} />
                    <div className="flex-1 space-y-0.5">
                      <p className="text-sm font-medium text-slate-900">{a.nome}</p>
                      {a.entidade && <p className="text-xs text-slate-500">Entidade: <strong>{a.entidade}</strong> — Evento: <strong>{a.evento}</strong></p>}
                      {!a.entidade && <p className="text-xs text-slate-500">{a.evento}</p>}
                      <p className="text-xs text-slate-400">Condição: {a.condicoes}</p>
                      <p className="text-xs text-violet-600">→ Função: {a.funcao}</p>
                    </div>
                    <Badge className={a.ativa ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}>{a.ativa ? 'Ativa' : 'Pausada'}</Badge>
                  </div>
                ))}
              </div>
            </Card>

            {/* Fluxo esperado */}
            <Card className="p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Fluxo Esperado</h3>
              <ol className="space-y-2 text-sm text-slate-600">
                {[
                  'Demanda criada com comunicar_cliente = true (padrão)',
                  'Equipe conclui a demanda → status muda para concluida ou finalizada',
                  'Automação detecta a mudança e chama processarDemandaConcluida',
                  'Função cria item na FilaComunicacaoCliente com status aguardando',
                  'Diariamente às 17:30 → consolidarComunicacaoDiaria agrupa os itens por cliente',
                  'IA gera mensagem profissional em português para cada cliente',
                  'Equipe revisa, edita e aprova o resumo na aba "Revisão Hoje"',
                  'Após aprovação → status muda para "Pronto para Envio" (aguarda integração WhatsApp)'
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 bg-violet-100 text-violet-700 rounded-full text-xs flex items-center justify-center font-bold mt-0.5">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </Card>

            {/* Por que a fila pode estar vazia */}
            <Card className="p-5 bg-amber-50 border-amber-200">
              <h3 className="font-semibold text-amber-900 mb-2">Por que a fila pode estar vazia?</h3>
              <ul className="space-y-1.5 text-sm text-amber-800">
                <li className="flex items-start gap-1.5"><span className="mt-1.5 w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0" />Nenhuma demanda foi concluída/finalizada <strong>após a criação da automação</strong> (hoje, 29/05)</li>
                <li className="flex items-start gap-1.5"><span className="mt-1.5 w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0" />Demandas já concluídas antes da automação <strong>não entram retroativamente</strong> (comportamento correto)</li>
                <li className="flex items-start gap-1.5"><span className="mt-1.5 w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0" />A demanda concluída pode ter <code className="bg-amber-100 px-1 rounded">comunicar_cliente = false</code></li>
                <li className="flex items-start gap-1.5"><span className="mt-1.5 w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0" />Use o botão <strong>"Criar evento de teste"</strong> (acima) para validar a geração de resumo sem precisar de demanda real</li>
              </ul>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}