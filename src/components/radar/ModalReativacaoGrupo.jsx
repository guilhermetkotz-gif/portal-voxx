import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  X, Send, Loader2, RefreshCw, Copy, CheckCircle, AlertTriangle,
  Clock, MessageSquare, FileText, BarChart3, KanbanSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';
import 'moment-timezone';

const TZ = 'America/Sao_Paulo';

export default function ModalReativacaoGrupo({ grupo, onClose, onSent }) {
  const queryClient = useQueryClient();
  const [mensagem, setMensagem] = useState('');
  const [gerando, setGerando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [contextoResumo, setContextoResumo] = useState(null);
  const [erroGeracao, setErroGeracao] = useState(null);

  const clienteNome = grupo?.cliente_nome || 'Cliente';
  const grupoNome = grupo?.nome_grupo || '';
  const grupoId = grupo?.grupo_id;
  const clienteId = grupo?.cliente_id;
  const horasSemMsg = grupo?.horasSemMensagem ? Math.floor(grupo.horasSemMensagem) : null;
  const ultimaMsg = grupo?.ultimaGeral?.received_at || grupo?.ultima_atividade;

  // Buscar dados para o contexto
  const { data: mensagensCtx = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ['reativacaoMsgs', grupoId],
    queryFn: () => base44.entities.WhatsappMensagem.filter({ grupo_id: grupoId }, '-received_at', 20),
    enabled: !!grupoId,
    staleTime: 30 * 1000,
  });

  const { data: demandasCtx = [], isLoading: loadingDemandas } = useQuery({
    queryKey: ['reativacaoDemandas', clienteId],
    queryFn: () => base44.entities.Demanda.filter({ cliente_id: clienteId }, '-updated_date', 10),
    enabled: !!clienteId,
    staleTime: 60 * 1000,
  });

  const { data: otimizacoesCtx = [], isLoading: loadingOtim } = useQuery({
    queryKey: ['reativacaoOtimizacoes', clienteId],
    queryFn: () => base44.entities.MetaAdsOtimizacao.filter({ cliente_id: clienteId }, '-created_date', 10),
    enabled: !!clienteId,
    staleTime: 60 * 1000,
  });

  const { data: kanbanCtx = [], isLoading: loadingKanban } = useQuery({
    queryKey: ['reativacaoKanban', clienteId],
    queryFn: () => base44.entities.DemandaHistoricoSetor.filter({ cliente_id: clienteId }, '-created_date', 10),
    enabled: !!clienteId,
    staleTime: 60 * 1000,
  });

  const queriesCarregadas = !loadingMsgs && !loadingDemandas && !loadingOtim && !loadingKanban;

  // Verificar se já houve reativação recente (últimos 3 dias úteis)
  const { data: logsRecentes = [] } = useQuery({
    queryKey: ['reativacaoLogs', grupoId],
    queryFn: () => base44.entities.WhatsappEnvioLog.filter({
      grupo_id: grupoId,
      origem: 'reativacao_grupo',
    }, '-created_date', 5),
    enabled: !!grupoId,
    staleTime: 30 * 1000,
  });

  const temReativacaoRecente = (() => {
    if (logsRecentes.length === 0) return false;
    const agora = moment().tz(TZ);
    const ultima = moment(logsRecentes[0].created_date || logsRecentes[0].enviado_em).tz(TZ);
    // Verifica se foi há menos de 3 dias úteis
    let diasUteis = 0;
    let cursor = ultima.clone();
    while (cursor.isBefore(agora, 'day')) {
      cursor.add(1, 'day');
      if (cursor.day() !== 0 && cursor.day() !== 6) diasUteis++;
    }
    return diasUteis < 3;
  })();

  // Gerar mensagem somente quando todas as queries tiverem carregado
  useEffect(() => {
    if (!clienteNome || !queriesCarregadas) return;
    gerarMensagem();
  }, [clienteNome, queriesCarregadas]);

  const gerarMensagem = async () => {
    setGerando(true);
    setErroGeracao(null);
    try {
      const res = await base44.functions.invoke('gerarMensagemReativacaoGrupo', {
        cliente_id: clienteId || '',
        cliente_nome: clienteNome,
        grupo_nome: grupoNome,
        tempo_sem_comunicacao: horasSemMsg ? `${Math.floor(horasSemMsg)}h úteis` : 'vários dias',
        mensagens_recentes: mensagensCtx.slice(0, 15).map(m => ({
          mensagem: m.mensagem?.substring(0, 200) || '',
          remetente_tipo: m.remetente_tipo,
          origem: m.origem,
        })),
        demandas_recentes: demandasCtx.map(d => ({
          titulo: d.titulo,
          status: d.status,
          setor: d.setor,
        })),
        otimizacoes_meta_ads: otimizacoesCtx.map(o => ({
          problema: o.problema?.substring(0, 150),
          objetivo: o.objetivo?.substring(0, 150),
          acoes_implementadas: o.acoes_implementadas?.substring(0, 150),
        })),
        dados_kanban: kanbanCtx.map(k => ({
          titulo: k.demanda_titulo,
          setor: k.setor_destino || k.setor,
        })),
      });

      if (res.data?.mensagem_sugerida) {
        setMensagem(res.data.mensagem_sugerida);
        setContextoResumo(res.data.resumo_contexto_usado || null);
      } else {
        setErroGeracao(res.data?.error || 'Erro ao gerar mensagem');
      }
    } catch (e) {
      setErroGeracao(e.message || 'Erro ao gerar mensagem');
    } finally {
      setGerando(false);
    }
  };

  const handleEnviar = async () => {
    if (!mensagem.trim() || !grupoId || enviando) return;
    setEnviando(true);
    try {
      const res = await base44.functions.invoke('enviarMensagemGeral', {
        chatId: grupoId,
        mensagem: mensagem.trim(),
        tipo: 'texto',
        incluirAssinatura: false,
        clienteId: clienteId || '',
        clienteNome: clienteNome,
        chatName: grupoNome,
      });

      if (res.data?.success) {
        // Registrar no WhatsappEnvioLog
        try {
          await base44.entities.WhatsappEnvioLog.create({
            cliente_id: clienteId || '',
            cliente_nome: clienteNome,
            grupo_id: grupoId,
            grupo_nome: grupoNome,
            origem: 'reativacao_grupo',
            mensagem: mensagem.trim(),
            status_envio: 'enviado',
            enviado_em: new Date().toISOString(),
          });
        } catch (_) {}

        setEnviado(true);
        toast.success('Mensagem de reativação enviada!');
        queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
        queryClient.invalidateQueries({ queryKey: ['reativacaoLogs', grupoId] });
        if (onSent) onSent();
        setTimeout(() => onClose(), 1500);
      } else {
        toast.error(res.data?.erro || 'Erro ao enviar mensagem');
      }
    } catch (e) {
      toast.error('Erro ao enviar: ' + (e.message || 'Desconhecido'));
    } finally {
      setEnviando(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(mensagem);
    setCopiado(true);
    toast.success('Mensagem copiada');
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-800 sticky top-0 bg-slate-900 rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-bold text-white">Mensagem de reativação do grupo</h2>
            <p className="text-slate-400 text-sm mt-0.5">{clienteNome}{grupoNome ? ` · ${grupoNome}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info cards */}
        <div className="px-6 py-4 space-y-4">
          {/* Status cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-purple-300 font-medium">Tempo sem comunicação</span>
              </div>
              <p className="text-xl font-bold text-purple-300">
                {horasSemMsg ? `${horasSemMsg}h úteis` : '—'}
              </p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-400 font-medium">Última comunicação</span>
              </div>
              <p className="text-sm text-slate-300">
                {ultimaMsg ? moment(ultimaMsg).tz(TZ).format('DD/MM HH:mm') : '—'}
              </p>
            </div>
          </div>

          {/* Contexto analisado */}
          {contextoResumo && !gerando && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Contexto analisado</h3>
              <div className="grid grid-cols-2 gap-2">
                <ContextoItem
                  icon={MessageSquare}
                  label="Mensagens recentes"
                  ativo={contextoResumo.tem_mensagens}
                />
                <ContextoItem
                  icon={FileText}
                  label="Demandas"
                  ativo={contextoResumo.tem_demandas}
                />
                <ContextoItem
                  icon={BarChart3}
                  label="Meta Ads"
                  ativo={contextoResumo.tem_otimizacoes}
                />
                <ContextoItem
                  icon={KanbanSquare}
                  label="Kanban"
                  ativo={contextoResumo.tem_kanban}
                />
              </div>
            </div>
          )}

          {/* Alerta de reativação recente */}
          {temReativacaoRecente && !enviado && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-300 font-medium">Este grupo já recebeu uma mensagem de reativação recentemente.</p>
                <p className="text-xs text-amber-400/70 mt-0.5">Confirme se deseja enviar novamente.</p>
              </div>
            </div>
          )}

          {/* Mensagem sugerida */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mensagem sugerida</h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-slate-400 hover:text-white gap-1.5"
                onClick={gerarMensagem}
                disabled={gerando}
              >
                {gerando ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Regenerar
              </Button>
            </div>

            {gerando ? (
              <div className="flex items-center justify-center py-12 bg-slate-800/50 border border-slate-700 rounded-xl">
                <div className="text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Analisando contexto e gerando mensagem...</p>
                </div>
              </div>
            ) : erroGeracao ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                <p className="text-red-400 text-sm">{erroGeracao}</p>
                <Button variant="outline" size="sm" className="mt-3 text-xs border-red-500/20 text-red-400" onClick={gerarMensagem}>
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 text-sm rounded-xl min-h-[140px] resize-y"
                placeholder="Mensagem de reativação..."
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center gap-3 sticky bottom-0 bg-slate-900 rounded-b-2xl">
          {enviado ? (
            <div className="flex-1 flex items-center gap-2 text-emerald-400">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Mensagem enviada com sucesso!</span>
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 text-xs"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 text-xs"
                onClick={handleCopy}
              >
                {copiado ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copiar
              </Button>
              <Button
                size="sm"
                className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs ml-auto"
                onClick={handleEnviar}
                disabled={enviando || !mensagem.trim() || gerando}
              >
                {enviando ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Enviar WhatsApp
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ContextoItem({ icon: Icon, label, ativo }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
      ativo ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-slate-800/50 border border-slate-700 text-slate-500'
    }`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
      {ativo ? (
        <CheckCircle className="w-3 h-3 ml-auto" />
      ) : (
        <span className="text-[10px] ml-auto">—</span>
      )}
    </div>
  );
}