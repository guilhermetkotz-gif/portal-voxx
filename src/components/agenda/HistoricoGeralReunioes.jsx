import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, isToday, isThisWeek, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, AlertTriangle, Clock, UserCheck, Search, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EventoDetalhe from './EventoDetalhe';

const STATUS_CONFIG = {
  agendada:      { label: 'Agendada',      cls: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  realizada:     { label: 'Realizada',     cls: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  nao_realizada: { label: 'Não realizada', cls: 'bg-red-100 text-red-700',      dot: 'bg-red-500' },
  cancelada:     { label: 'Cancelada',     cls: 'bg-slate-100 text-slate-500',  dot: 'bg-slate-400' },
  reagendada:    { label: 'Reagendada',    cls: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
};

const TIPOS_LABEL = {
  comercial: 'Comercial', onboarding: 'Onboarding', alinhamento: 'Alinhamento',
  resultados: 'Resultados', estrategico: 'Estratégico', operacional: 'Operacional', retencao: 'Retenção',
};

function hasRegistro(r) {
  return !!(r.summary || r.discussion_points || r.pending_items || r.next_steps);
}

function getFollowupStatus(r) {
  if (!r.followup_date) return null;
  // Se tiver followup_date, verificar se atrasado
  const followupDate = new Date(r.followup_date);
  const now = new Date();
  if (followupDate < startOfDay(now)) return 'atrasado';
  return 'pendente';
}

const QUICK_FILTERS = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'sem_registro', label: '⚠️ Sem registro' },
  { key: 'followup_atrasado', label: '🔴 Follow-up atrasado' },
];

export default function HistoricoGeralReunioes({ user }) {
  const [detalhe, setDetalhe] = useState(null);
  const [search, setSearch] = useState('');
  const [filtroUnidade, setFiltroUnidade] = useState('all');
  const [filtroUsuario, setFiltroUsuario] = useState('all');
  const [filtroTipo, setFiltroTipo] = useState('all');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [filtroFollowup, setFiltroFollowup] = useState('all');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [quickFilter, setQuickFilter] = useState(null);

  const { data: reunioes = [], isLoading, refetch } = useQuery({
    queryKey: ['historico_reunioes_geral'],
    queryFn: () => base44.entities.AgendaReuniao.list('-start_datetime', 1000),
    staleTime: 60 * 1000,
  });

  const { data: voxxUsers = [] } = useQuery({
    queryKey: ['voxx_users_agenda'],
    queryFn: async () => {
      const all = await base44.entities.User.list('-created_date', 200);
      return all.filter(u => {
        const tipo = u.tipo_usuario || u.tipo_acesso;
        return tipo && (tipo.startsWith('voxx_') || u.role === 'admin');
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes_agenda'],
    queryFn: () => base44.entities.Cliente.list('nome', 500),
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    let list = [...reunioes];

    // Quick filters (override period filters)
    if (quickFilter === 'hoje') {
      list = list.filter(r => isToday(parseISO(r.start_datetime)));
    } else if (quickFilter === 'semana') {
      list = list.filter(r => isThisWeek(parseISO(r.start_datetime), { weekStartsOn: 1 }));
    } else if (quickFilter === 'sem_registro') {
      list = list.filter(r => r.status === 'realizada' && !hasRegistro(r));
    } else if (quickFilter === 'followup_atrasado') {
      list = list.filter(r => getFollowupStatus(r) === 'atrasado');
    } else {
      // Period filters
      if (dataInicio) list = list.filter(r => parseISO(r.start_datetime) >= new Date(dataInicio));
      if (dataFim) list = list.filter(r => parseISO(r.start_datetime) <= endOfDay(new Date(dataFim)));
    }

    if (search) list = list.filter(r => r.titulo?.toLowerCase().includes(search.toLowerCase()) || r.unidade_nome?.toLowerCase().includes(search.toLowerCase()));
    if (filtroUnidade !== 'all') list = list.filter(r => r.unidade_id === filtroUnidade);
    if (filtroUsuario !== 'all') list = list.filter(r => r.participantes_ids?.includes(filtroUsuario));
    if (filtroTipo !== 'all') list = list.filter(r => r.tipo_reuniao === filtroTipo);
    if (filtroStatus !== 'all') list = list.filter(r => r.status === filtroStatus);
    if (filtroFollowup !== 'all') {
      if (filtroFollowup === 'com_followup') list = list.filter(r => !!r.followup_date);
      else if (filtroFollowup === 'atrasado') list = list.filter(r => getFollowupStatus(r) === 'atrasado');
      else if (filtroFollowup === 'sem_followup') list = list.filter(r => !r.followup_date);
    }

    return list;
  }, [reunioes, search, filtroUnidade, filtroUsuario, filtroTipo, filtroStatus, filtroFollowup, dataInicio, dataFim, quickFilter]);

  const hasActiveFilters = search || filtroUnidade !== 'all' || filtroUsuario !== 'all' || filtroTipo !== 'all' || filtroStatus !== 'all' || filtroFollowup !== 'all' || dataInicio || dataFim || quickFilter;

  const clearFilters = () => {
    setSearch(''); setFiltroUnidade('all'); setFiltroUsuario('all');
    setFiltroTipo('all'); setFiltroStatus('all'); setFiltroFollowup('all');
    setDataInicio(''); setDataFim(''); setQuickFilter(null);
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Filtros rápidos */}
      <div className="flex items-center gap-2 flex-wrap">
        {QUICK_FILTERS.map(qf => (
          <button
            key={qf.key}
            onClick={() => setQuickFilter(quickFilter === qf.key ? null : qf.key)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              quickFilter === qf.key
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {qf.label}
          </button>
        ))}
        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-xs text-violet-600 hover:underline ml-2">
            Limpar filtros
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} reunião(ões)</span>
      </div>

      {/* Filtros avançados */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs w-44" />
        </div>

        <input type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); setQuickFilter(null); }}
          className="border border-input rounded-md px-2 py-1 text-xs bg-white h-8" placeholder="De" />
        <input type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); setQuickFilter(null); }}
          className="border border-input rounded-md px-2 py-1 text-xs bg-white h-8" placeholder="Até" />

        <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
          <SelectTrigger className="w-40 h-8 text-xs bg-white"><SelectValue placeholder="Unidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as unidades</SelectItem>
            {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
          <SelectTrigger className="w-40 h-8 text-xs bg-white"><SelectValue placeholder="Usuário" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os usuários</SelectItem>
            {voxxUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-36 h-8 text-xs bg-white"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(TIPOS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-36 h-8 text-xs bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtroFollowup} onValueChange={setFiltroFollowup}>
          <SelectTrigger className="w-40 h-8 text-xs bg-white"><SelectValue placeholder="Follow-up" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os follow-ups</SelectItem>
            <SelectItem value="com_followup">Com follow-up</SelectItem>
            <SelectItem value="atrasado">🔴 Follow-up atrasado</SelectItem>
            <SelectItem value="sem_followup">Sem follow-up</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400 text-sm">Carregando reuniões...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma reunião encontrada.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(r => {
            const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.agendada;
            const start = parseISO(r.start_datetime);
            const temRegistro = hasRegistro(r);
            const foiRealizada = r.status === 'realizada';
            const followupStatus = getFollowupStatus(r);

            return (
              <button
                key={r.id}
                onClick={() => setDetalhe(r)}
                className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border bg-white hover:shadow-sm hover:border-slate-300 transition-all"
              >
                {/* Indicador de status */}
                <div className={`w-1.5 self-stretch rounded-full shrink-0 ${sc.dot}`} />

                {/* Indicador de registro */}
                <div className="shrink-0 w-5 flex items-center justify-center">
                  {foiRealizada ? (
                    temRegistro
                      ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                      : <AlertTriangle className="w-4 h-4 text-amber-500" />
                  ) : (
                    <div className={`w-2 h-2 rounded-full ${sc.dot} opacity-50`} />
                  )}
                </div>

                {/* Data */}
                <div className="shrink-0 w-20 text-right">
                  <p className="text-xs font-semibold text-slate-700">{format(start, 'dd/MM/yyyy')}</p>
                  <p className="text-[10px] text-slate-400">{format(start, 'HH:mm')}</p>
                </div>

                {/* Informações principais */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-slate-800 truncate">{r.titulo}</p>
                    <Badge className={`text-[10px] px-1.5 py-0 ${sc.cls} shrink-0`}>{sc.label}</Badge>
                    {r.tipo_reuniao && (
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0">
                        {TIPOS_LABEL[r.tipo_reuniao]}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {r.unidade_nome}
                    {r.participantes_nomes?.length > 0 && ` · ${r.participantes_nomes.slice(0, 3).map(n => n.split(' ')[0]).join(', ')}${r.participantes_nomes.length > 3 ? ` +${r.participantes_nomes.length - 3}` : ''}`}
                  </p>
                  {r.summary && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{r.summary}</p>
                  )}
                </div>

                {/* Follow-up */}
                <div className="shrink-0 text-right min-w-[100px]">
                  {r.followup_date ? (
                    <div className={`flex items-center gap-1 justify-end text-xs font-medium ${
                      followupStatus === 'atrasado' ? 'text-red-600' : 'text-violet-600'
                    }`}>
                      {followupStatus === 'atrasado'
                        ? <span className="text-red-500">🔴</span>
                        : <Clock className="w-3 h-3" />
                      }
                      <span>{format(new Date(r.followup_date), 'dd/MM')}</span>
                    </div>
                  ) : null}
                  {r.followup_owner_nome && (
                    <p className="text-[10px] text-slate-400 flex items-center gap-0.5 justify-end mt-0.5">
                      <UserCheck className="w-3 h-3" />
                      {r.followup_owner_nome.split(' ')[0]}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <EventoDetalhe
        reuniao={detalhe}
        open={!!detalhe}
        onClose={() => setDetalhe(null)}
        onEdit={() => { setDetalhe(null); }}
        onStatusChange={() => { refetch(); setDetalhe(null); }}
      />
    </div>
  );
}