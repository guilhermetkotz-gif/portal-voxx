import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, User, Clock, MessageSquare, Wifi, WifiOff, AlertTriangle, Zap, Link2, Users, Info, FileText, Pencil, Check, Loader2, UserPlus, UserMinus, LogOut, MoonStar, RefreshCw } from 'lucide-react';
import moment from 'moment';
import 'moment-timezone';
import { toast } from 'sonner';
import ModalReativacaoGrupo from './ModalReativacaoGrupo';

const TZ = 'America/Sao_Paulo';

const ALERTA_COLOR = {
  emergencial: 'bg-red-500/20 text-red-400 border-red-500/30',
  critico:     'bg-orange-500/20 text-orange-400 border-orange-500/30',
  alerta:      'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

function tempoFormatado(minutos) {
  if (!minutos) return null;
  if (minutos >= 60) return `${Math.floor(minutos / 60)}h ${minutos % 60 > 0 ? `${minutos % 60}m` : ''}`.trim();
  return `${minutos}m`;
}

export default function GrupoDetalheDrawer({ grupo, clientes, onClose }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('atividade');
  const [editandoDescricao, setEditandoDescricao] = useState(false);
  const [descricaoEdit, setDescricaoEdit] = useState('');
  const [salvandoDescricao, setSalvandoDescricao] = useState(false);
  const [novoTelefone, setNovoTelefone] = useState('');
  const [adicionandoMembro, setAdicionandoMembro] = useState(false);
  const [acaoMembroId, setAcaoMembroId] = useState(null);
  const [showReativacao, setShowReativacao] = useState(false);

  // ── Dados do grupo via Z-API ──
  const { data: grupoZapi, isLoading: loadingGrupoZapi, refetch: refetchGrupoZapi } = useQuery({
    queryKey: ['grupoZapiInfo', grupo.grupo_id],
    queryFn: async () => {
      const res = await base44.functions.invoke('gerenciarGrupoWhatsapp', {
        acao: 'info',
        grupoId: grupo.grupo_id,
      });
      return res.data?.group || null;
    },
    enabled: !!grupo.grupo_id,
    staleTime: 60 * 1000,
  });

  // ── Histórico de mensagens ──
  const { data: msgHistorico = [] } = useQuery({
    queryKey: ['radarMsgsGrupo', grupo.grupo_id],
    queryFn: () => base44.entities.WhatsappMensagem.filter({ grupo_id: grupo.grupo_id }, '-received_at', 30),
    enabled: !!grupo.grupo_id,
    staleTime: 15 * 1000,
  });

  const vinculo = grupo.status_vinculo;
  const alertaNivel = grupo.alertaNivel;
  const alertaCfg = alertaNivel ? ALERTA_COLOR[alertaNivel] : null;

  // ── Handlers ──
  const handleSalvarDescricao = async () => {
    if (!grupo.grupo_id) return;
    setSalvandoDescricao(true);
    try {
      const res = await base44.functions.invoke('gerenciarGrupoWhatsapp', {
        acao: 'atualizarDescricao',
        grupoId: grupo.grupo_id,
        descricao: descricaoEdit,
      });
      if (res.data?.success) {
        toast.success('Descrição atualizada');
        setEditandoDescricao(false);
        refetchGrupoZapi();
      } else {
        toast.error(res.data?.error || 'Erro ao atualizar descrição');
      }
    } catch (e) {
      toast.error('Erro: ' + (e.message || 'Desconhecido'));
    } finally {
      setSalvandoDescricao(false);
    }
  };

  const handleAdicionarMembro = async () => {
    const tel = novoTelefone.replace(/\D/g, '');
    if (!tel || tel.length < 8) { toast.error('Telefone inválido'); return; }
    setAdicionandoMembro(true);
    try {
      const res = await base44.functions.invoke('gerenciarGrupoWhatsapp', {
        acao: 'adicionarMembro',
        grupoId: grupo.grupo_id,
        telefone: tel,
      });
      if (res.data?.success) {
        toast.success('Membro adicionado');
        setNovoTelefone('');
        refetchGrupoZapi();
      } else {
        toast.error(res.data?.error || 'Erro ao adicionar');
      }
    } catch (e) {
      toast.error('Erro: ' + (e.message || ''));
    } finally {
      setAdicionandoMembro(false);
    }
  };

  const handleRemoverMembro = async (telefone) => {
    setAcaoMembroId(telefone);
    try {
      const res = await base44.functions.invoke('gerenciarGrupoWhatsapp', {
        acao: 'removerMembro',
        grupoId: grupo.grupo_id,
        telefone,
      });
      if (res.data?.success) {
        toast.success('Membro removido');
        refetchGrupoZapi();
      } else {
        toast.error(res.data?.error || 'Erro ao remover');
      }
    } catch (e) {
      toast.error('Erro: ' + (e.message || ''));
    } finally {
      setAcaoMembroId(null);
    }
  };

  const handleSairGrupo = async () => {
    if (!confirm('Tem certeza que deseja sair deste grupo?')) return;
    try {
      const res = await base44.functions.invoke('gerenciarGrupoWhatsapp', {
        acao: 'sairGrupo',
        grupoId: grupo.grupo_id,
      });
      if (res.data?.success) {
        toast.success('Você saiu do grupo');
        onClose();
      } else {
        toast.error(res.data?.error || 'Erro ao sair');
      }
    } catch (e) {
      toast.error('Erro: ' + (e.message || ''));
    }
  };

  const participantes = grupoZapi?.participants || [];
  const totalParticipantes = grupoZapi?.totalParticipants || participantes.length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">{grupo.nome_grupo}</h2>
            <p className="text-slate-400 text-sm mt-0.5">{grupo.cliente_nome || 'Sem cliente vinculado'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 bg-slate-800 border border-slate-700">
            <TabsTrigger value="dados" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs gap-1.5">
              <Info className="w-3.5 h-3.5" /> Dados
            </TabsTrigger>
            <TabsTrigger value="membros" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs gap-1.5">
              <Users className="w-3.5 h-3.5" /> Membros
              {totalParticipantes > 0 && (
                <span className="bg-slate-700 text-slate-300 text-[10px] rounded-full px-1.5 py-0.5 ml-0.5">
                  {totalParticipantes}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="atividade" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Atividade
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Dados ── */}
          <TabsContent value="dados" className="flex-1 overflow-y-auto px-6 py-4 mt-0 space-y-5">
            {/* Info básica */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Informações</h3>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="ID do Grupo" value={<span className="font-mono text-[11px] text-slate-400">{grupo.grupo_id}</span>} />
                <InfoRow label="Status vínculo" value={
                  <Badge className={`text-[10px] border ${vinculo === 'vinculado' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                    {vinculo === 'vinculado' ? <Wifi className="w-3 h-3 inline mr-1" /> : <WifiOff className="w-3 h-3 inline mr-1" />}
                    {vinculo === 'vinculado' ? 'Vinculado' : vinculo === 'nao_vinculado' ? 'Não vinculado' : vinculo}
                  </Badge>
                } />
                <InfoRow label="Última atividade" value={
                  grupo.ultima_atividade
                    ? moment(grupo.ultima_atividade).tz(TZ).format('DD/MM/YYYY HH:mm')
                    : '—'
                } />
                <InfoRow label="Total de mensagens" value={grupo.totalMsgs || 0} />
                {loadingGrupoZapi ? (
                  <InfoRow label="Participantes" value={<Loader2 className="w-3 h-3 animate-spin text-slate-500" />} />
                ) : (
                  <InfoRow label="Participantes" value={totalParticipantes || '—'} />
                )}
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição do Grupo</h3>
                {!editandoDescricao && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-slate-400 hover:text-white"
                    onClick={() => {
                      setDescricaoEdit(grupoZapi?.description || '');
                      setEditandoDescricao(true);
                    }}
                  >
                    <Pencil className="w-3 h-3 mr-1" /> Editar
                  </Button>
                )}
              </div>

              {loadingGrupoZapi ? (
                <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-slate-500" /></div>
              ) : editandoDescricao ? (
                <div className="space-y-2">
                  <Textarea
                    value={descricaoEdit}
                    onChange={(e) => setDescricaoEdit(e.target.value)}
                    placeholder="Adicionar descrição do grupo..."
                    className="bg-slate-800 border-slate-700 text-slate-100 text-sm rounded-xl min-h-[200px] resize-y"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500 text-xs h-8"
                      onClick={handleSalvarDescricao}
                      disabled={salvandoDescricao}
                    >
                      {salvandoDescricao ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                      Salvar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 text-xs h-8"
                      onClick={() => setEditandoDescricao(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 min-h-[60px]">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">
                    {grupoZapi?.description || <span className="text-slate-500 italic">Sem descrição</span>}
                  </p>
                </div>
              )}
            </div>

            {/* Ações do grupo */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</h3>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                onClick={handleSairGrupo}
              >
                <LogOut className="w-4 h-4" /> Sair do Grupo
              </Button>
            </div>
          </TabsContent>

          {/* ── Tab: Membros ── */}
          <TabsContent value="membros" className="flex-1 overflow-y-auto px-6 py-4 mt-0 space-y-4">
            {/* Adicionar membro */}
            <div className="flex gap-2">
              <Input
                value={novoTelefone}
                onChange={(e) => setNovoTelefone(e.target.value)}
                placeholder="+55 11 99999-9999"
                className="bg-slate-800 border-slate-700 text-slate-100 text-sm rounded-xl flex-1"
              />
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-xs shrink-0"
                onClick={handleAdicionarMembro}
                disabled={adicionandoMembro || !novoTelefone.trim()}
              >
                {adicionandoMembro ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              </Button>
            </div>

            {/* Lista de membros */}
            {loadingGrupoZapi ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
            ) : participantes.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-8">Nenhum participante encontrado ou sem permissão para listar.</p>
            ) : (
              <div className="space-y-1">
                {participantes.map((p, idx) => (
                  <div
                    key={p.phone || idx}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/30"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        p.isSuperAdmin ? 'bg-amber-500/20 text-amber-400' :
                        p.isAdmin ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {(p.name || p.phone || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{p.name || 'Sem nome'}</p>
                        <p className="text-[11px] text-slate-500 font-mono truncate">{p.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.isSuperAdmin && <Badge className="bg-amber-500/20 text-amber-400 text-[10px] border-amber-500/20">Admin</Badge>}
                      {p.isAdmin && !p.isSuperAdmin && <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px] border-emerald-500/20">Admin</Badge>}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => handleRemoverMembro(p.phone)}
                        disabled={acaoMembroId === p.phone}
                      >
                        {acaoMembroId === p.phone ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserMinus className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Tab: Atividade ── */}
          <TabsContent value="atividade" className="flex-1 overflow-y-auto px-6 py-4 mt-0 space-y-5">
            {/* Últimas mensagens */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Últimas mensagens</h3>
              <div className="grid gap-2">
                <MsgCard label="Última geral" msg={grupo.ultimaGeral} />
                <MsgCard label="Última cliente" msg={grupo.ultimaCliente} color="blue" />
                <MsgCard label="Última VOXX" msg={grupo.ultimaVoxx} color="violet" />
              </div>
            </div>

            {/* Reativação de grupo inativo 72h+ */}
            {grupo.inativo72h && grupo.status_vinculo === 'vinculado' && (
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MoonStar className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-semibold text-purple-300">Grupo inativo há {Math.floor(grupo.horasSemMensagem / 24)}d</span>
                </div>
                <p className="text-xs text-purple-400/70 mb-3">
                  Este grupo está sem comunicação há mais de 72h úteis. Gere uma mensagem de reativação personalizada com base no contexto do cliente.
                </p>
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-500 text-white gap-2 text-xs w-full"
                  onClick={() => setShowReativacao(true)}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Gerar mensagem de reativação
                </Button>
              </div>
            )}

            {/* Tempo sem resposta */}
            {grupo.minutosSemResposta > 0 && (
              <div className={`rounded-xl border p-4 ${alertaCfg || 'bg-slate-800 border-slate-700'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {alertaNivel === 'emergencial' ? <Zap className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  <span className="text-sm font-semibold">Sem resposta VOXX</span>
                </div>
                <p className="text-2xl font-bold">{tempoFormatado(grupo.minutosSemResposta)}</p>
                <p className="text-xs opacity-70 mt-1">Minutos úteis aguardando retorno</p>
              </div>
            )}

            {/* Histórico recente */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Histórico recente (últimas 30)</h3>
              {msgHistorico.length === 0 ? (
                <p className="text-slate-500 text-sm">Nenhuma mensagem registrada.</p>
              ) : (
                <div className="space-y-1.5">
                  {msgHistorico.map(m => {
                    const ts = m.received_at || m.timestamp_mensagem;
                    const isVoxx = m.remetente_tipo === 'voxx' || m.origem === 'enviada';
                    return (
                      <div key={m.id} className={`rounded-lg px-3 py-2 text-xs ${isVoxx ? 'bg-violet-950/30 border border-violet-800/30' : 'bg-slate-800 border border-slate-700/50'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-medium ${isVoxx ? 'text-violet-300' : 'text-blue-300'}`}>
                            {m.remetente_nome || (isVoxx ? 'VOXX' : 'Cliente')}
                          </span>
                          <span className="text-slate-500">{moment(ts).tz(TZ).format('DD/MM HH:mm')}</span>
                        </div>
                        <p className="text-slate-300">{m.mensagem}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de reativação */}
      {showReativacao && (
        <ModalReativacaoGrupo
          grupo={grupo}
          onClose={() => setShowReativacao(false)}
          onSent={() => setShowReativacao(false)}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500 mb-0.5">{label}</p>
      <div className="text-sm text-slate-200">{value}</div>
    </div>
  );
}

function MsgCard({ label, msg, color }) {
  const colors = {
    blue:   'border-blue-800/30 bg-blue-950/20',
    violet: 'border-violet-800/30 bg-violet-950/20',
  };
  const cls = colors[color] || 'border-slate-700 bg-slate-800';
  if (!msg) return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>
      <p className="text-slate-500 text-[11px] mb-1">{label}</p>
      <p className="text-slate-600">—</p>
    </div>
  );
  const ts = msg.received_at || msg.timestamp_mensagem;
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-slate-400 text-[11px]">{label}</p>
        <span className="text-slate-500">{moment(ts).tz(TZ).format('DD/MM HH:mm')}</span>
      </div>
      <p className="text-slate-200 font-medium">{msg.remetente_nome || '—'}</p>
      <p className="text-slate-400 mt-0.5 truncate">{msg.mensagem}</p>
    </div>
  );
}