import React, { useState, useMemo, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Calendar, List, Clock, AlertTriangle, UserCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import AgendaAlertas from '@/components/agenda/AgendaAlertas';
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addWeeks, subWeeks, addMonths, subMonths, eachDayOfInterval,
  isSameDay, isSameMonth, parseISO, startOfDay, endOfDay,
  addDays, getDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import NovaReuniaoModal from '@/components/agenda/NovaReuniaoModal';
import EventoDetalhe from '@/components/agenda/EventoDetalhe';

const STATUS_COLORS = {
  agendada:      { bg: 'bg-blue-500',   text: 'text-white',     border: 'border-blue-600' },
  realizada:     { bg: 'bg-green-500',  text: 'text-white',     border: 'border-green-600' },
  nao_realizada: { bg: 'bg-red-500',    text: 'text-white',     border: 'border-red-600' },
  cancelada:     { bg: 'bg-slate-400',  text: 'text-white',     border: 'border-slate-500' },
};

const STATUS_LABELS = {
  agendada: 'Agendada', realizada: 'Realizada',
  nao_realizada: 'Não realizada', cancelada: 'Cancelada',
};

const TIPOS_LABEL = {
  comercial: 'Comercial', onboarding: 'Onboarding', alinhamento: 'Alinhamento',
  resultados: 'Resultados', estrategico: 'Estratégico', operacional: 'Operacional', retencao: 'Retenção',
};

function hasRegistro(r) {
  return !!(r.summary || r.discussion_points || r.pending_items || r.next_steps);
}

function isCritical(r) {
  if (r.status === 'nao_realizada') return true;
  if (r.status === 'realizada' && !hasRegistro(r)) return true;
  if (r.followup_date && new Date(r.followup_date) < new Date() && r.status !== 'cancelada') return true;
  return false;
}

function EventoPill({ reuniao, onClick, onDragStart }) {
  const sc = STATUS_COLORS[reuniao.status] || STATUS_COLORS.agendada;
  const start = parseISO(reuniao.start_datetime);
  const critical = isCritical(reuniao);
  const temRegistro = hasRegistro(reuniao);
  const realizada = reuniao.status === 'realizada';

  return (
    <button
      draggable
      onDragStart={(e) => { e.stopPropagation(); onDragStart && onDragStart(e, reuniao); }}
      onClick={(e) => { e.stopPropagation(); onClick(reuniao); }}
      className={`w-full text-left rounded-md px-1.5 py-1 mb-0.5 text-xs font-medium transition-all hover:brightness-95 active:scale-[0.98] ${sc.bg} ${sc.text} ${
        critical ? 'ring-2 ring-red-400 ring-offset-1' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold truncate">{format(start, 'HH:mm')} {reuniao.titulo}</span>
        <span className="shrink-0 opacity-90">
          {realizada ? (
            temRegistro
              ? <CheckCircle2 className="w-3 h-3 inline text-green-200" />
              : <AlertCircle className="w-3 h-3 inline text-yellow-200" />
          ) : null}
          {reuniao.followup_date && <span className="ml-0.5">📌</span>}
        </span>
      </div>
      {reuniao.unidade_nome && (
        <div className="truncate opacity-80 text-[10px]">{reuniao.unidade_nome}</div>
      )}
      {reuniao.participantes_nomes?.length > 0 && (
        <div className="truncate opacity-70 text-[10px]">
          {reuniao.participantes_nomes.slice(0, 2).map(n => n.split(' ')[0]).join(', ')}
          {reuniao.participantes_nomes.length > 2 ? ` +${reuniao.participantes_nomes.length - 2}` : ''}
        </div>
      )}
    </button>
  );
}

function VisualizacaoSemana({ reunioes, currentDate, onClickDia, onClickEvento, onReschedule }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7h–20h
  const [currentTimeTop, setCurrentTimeTop] = useState(null);
  const [dragOver, setDragOver] = useState(null); // {dayIdx, hour}
  const [draggingId, setDraggingId] = useState(null);
  const gridRef = useRef(null);

  useEffect(() => {
    const calcTop = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      if (h < 7 || h > 20) { setCurrentTimeTop(null); return; }
      setCurrentTimeTop(((h - 7) * 56) + (m / 60 * 56));
    };
    calcTop();
    const iv = setInterval(calcTop, 60000);
    return () => clearInterval(iv);
  }, []);

  const eventosDia = (day) => reunioes.filter(r => isSameDay(parseISO(r.start_datetime), day));

  const handleDragStart = (e, reuniao) => {
    e.dataTransfer.setData('reuniaoId', reuniao.id);
    setDraggingId(reuniao.id);
  };

  const handleDrop = (e, day, hour) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('reuniaoId');
    setDragOver(null);
    setDraggingId(null);
    if (id && onReschedule) onReschedule(id, day, hour);
  };

  const isToday = isSameDay(currentDate, new Date());
  const todayDayIdx = days.findIndex(d => isSameDay(d, new Date()));

  return (
    <div className="overflow-x-auto">
      {/* Header dos dias */}
      <div className="grid grid-cols-8 border-b bg-slate-50">
        <div className="p-2 text-xs text-slate-400 text-center border-r">Hora</div>
        {days.map((day, di) => {
          const count = eventosDia(day).length;
          const isT = isSameDay(day, new Date());
          return (
            <div key={day.toISOString()} className="p-2 text-center border-r last:border-r-0">
              <p className="text-xs text-slate-500 capitalize">{format(day, 'EEE', { locale: ptBR })}</p>
              <button
                onClick={() => onClickDia(day)}
                className={`w-8 h-8 mx-auto mt-0.5 rounded-full flex items-center justify-center text-sm font-bold
                  ${isT ? 'bg-violet-600 text-white' : 'text-slate-700 hover:bg-slate-200'}`}
              >
                {format(day, 'd')}
              </button>
              {count > 0 && (
                <span className={`mt-0.5 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  isT ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
                }`}>{count} {count === 1 ? 'reunião' : 'reuniões'}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-8 min-h-[780px]" ref={gridRef}>
        {/* Coluna de horas */}
        <div className="border-r">
          {hours.map(h => (
            <div key={h} className="h-14 border-b flex items-start px-2 pt-1">
              <span className="text-xs text-slate-400">{String(h).padStart(2, '0')}:00</span>
            </div>
          ))}
        </div>

        {days.map((day, di) => (
          <div key={day.toISOString()} className="border-r last:border-r-0 relative">
            {/* Células clicáveis */}
            {hours.map(h => (
              <div
                key={h}
                className={`h-14 border-b cursor-pointer transition-colors ${
                  dragOver?.di === di && dragOver?.h === h ? 'bg-violet-50' : 'hover:bg-slate-50'
                }`}
                onClick={() => { const d = new Date(day); d.setHours(h, 0, 0, 0); onClickDia(d); }}
                onDragOver={(e) => { e.preventDefault(); setDragOver({ di, h }); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => handleDrop(e, day, h)}
              />
            ))}

            {/* Linha de horário atual */}
            {isSameDay(day, new Date()) && currentTimeTop !== null && (
              <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: `${currentTimeTop}px` }}>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1" />
                  <div className="flex-1 h-px bg-red-400" />
                </div>
              </div>
            )}

            {/* Eventos */}
            {eventosDia(day).map(r => {
              const start = parseISO(r.start_datetime);
              const end = parseISO(r.end_datetime);
              const hourF = start.getHours();
              const minutesF = start.getMinutes();
              const topPx = ((hourF - 7) * 56) + (minutesF / 60 * 56);
              const durationMin = (end - start) / 60000;
              const heightPx = Math.max(28, (durationMin / 60) * 56 - 2);
              return (
                <div
                  key={r.id}
                  className="absolute left-0.5 right-0.5"
                  style={{ top: `${Math.max(0, topPx)}px`, height: `${heightPx}px` }}
                >
                  <EventoPill reuniao={r} onClick={onClickEvento} onDragStart={handleDragStart} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function VisualizacaoMes({ reunioes, currentDate, onClickDia, onClickEvento }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const eventosDia = (day) => reunioes.filter(r => isSameDay(parseISO(r.start_datetime), day));

  return (
    <div>
      <div className="grid grid-cols-7 border-b bg-slate-50">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
          <div key={d} className="p-2 text-center text-xs font-semibold text-slate-500">{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b">
          {week.map(day => {
            const evts = eventosDia(day);
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, currentDate);
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[90px] p-1 border-r last:border-r-0 cursor-pointer hover:bg-slate-50 ${!isCurrentMonth ? 'bg-slate-50/50' : ''}`}
                onClick={() => onClickDia(day)}
              >
                <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-semibold mb-1
                  ${isToday ? 'bg-violet-600 text-white' : isCurrentMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                  {format(day, 'd')}
                </span>
                {evts.slice(0, 3).map(r => (
                  <EventoPill key={r.id} reuniao={r} onClick={onClickEvento} />
                ))}
                {evts.length > 3 && (
                  <p className="text-xs text-slate-500 pl-1">+{evts.length - 3} mais</p>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function VisualizacaoLista({ reunioes, onClickEvento }) {
  const sorted = [...reunioes].sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
  const grouped = {};
  sorted.forEach(r => {
    const key = format(parseISO(r.start_datetime), 'yyyy-MM-dd');
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  if (sorted.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Nenhuma reunião encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {Object.entries(grouped).map(([dateKey, evts]) => (
        <div key={dateKey}>
          <h3 className="text-sm font-semibold text-slate-500 mb-2 capitalize">
            {format(new Date(dateKey + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h3>
          <div className="space-y-2">
            {evts.map(r => {
              const sc = STATUS_COLORS[r.status] || STATUS_COLORS.agendada;
              const start = parseISO(r.start_datetime);
              const end = parseISO(r.end_datetime);
              const semRegistro = r.status === 'realizada' && !hasRegistro(r);
              return (
                <button
                  key={r.id}
                  onClick={() => onClickEvento(r)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-xl border hover:shadow-sm transition-shadow bg-white"
                >
                  <div className={`w-1 self-stretch rounded-full ${sc.bg}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-slate-800 truncate">{r.titulo}</p>
                      {semRegistro && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-medium">
                          <AlertTriangle className="w-2.5 h-2.5" /> Sem registro
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{r.unidade_nome} · {TIPOS_LABEL[r.tipo_reuniao]}</p>
                    {r.followup_owner_nome && (
                      <p className="text-xs text-violet-600 flex items-center gap-1 mt-0.5">
                        <UserCheck className="w-3 h-3" /> Follow-up: {r.followup_owner_nome}
                        {r.followup_date ? ` · ${r.followup_date}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-slate-700">{format(start, 'HH:mm')} – {format(end, 'HH:mm')}</p>
                    <Badge className={`text-[10px] ${sc.bg} ${sc.text} mt-0.5`}>{STATUS_LABELS[r.status]}</Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AgendaVoxx({ user }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState('semana');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [defaultModalDate, setDefaultModalDate] = useState(null);
  const [editingReuniao, setEditingReuniao] = useState(null);
  const [detalheReuniao, setDetalheReuniao] = useState(null);
  const [cloneData, setCloneData] = useState(null);
  const [filtroUsuario, setFiltroUsuario] = useState('all');
  const [filtroUnidade, setFiltroUnidade] = useState('all');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [filtroProblemas, setFiltroProblemas] = useState(false);

  // Range de datas para busca
  const rangeStart = useMemo(() => {
    if (view === 'semana') return startOfWeek(currentDate, { weekStartsOn: 1 });
    if (view === 'mes') return startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    return subMonths(currentDate, 1);
  }, [view, currentDate]);

  const rangeEnd = useMemo(() => {
    if (view === 'semana') return endOfWeek(currentDate, { weekStartsOn: 1 });
    if (view === 'mes') return endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return addMonths(currentDate, 2);
  }, [view, currentDate]);

  const { data: reunioes = [], isLoading } = useQuery({
    queryKey: ['agenda_reunioes', rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: () => base44.entities.AgendaReuniao.list('-start_datetime', 500),
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

  const reunioesFiltradas = useMemo(() => {
    let list = reunioes.filter(r => {
      const start = parseISO(r.start_datetime);
      return start >= rangeStart && start <= rangeEnd;
    });
    if (filtroUsuario !== 'all') {
      list = list.filter(r => r.participantes_ids?.includes(filtroUsuario));
    }
    if (filtroUnidade !== 'all') {
      list = list.filter(r => r.unidade_id === filtroUnidade);
    }
    if (filtroStatus !== 'all') {
      list = list.filter(r => r.status === filtroStatus);
    }
    if (filtroProblemas) {
      list = list.filter(r => isCritical(r));
    }
    return list;
  }, [reunioes, rangeStart, rangeEnd, filtroUsuario, filtroUnidade, filtroStatus, filtroProblemas]);

  const navigate = (dir) => {
    if (view === 'semana') setCurrentDate(d => dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1));
    else if (view === 'mes') setCurrentDate(d => dir > 0 ? addMonths(d, 1) : subMonths(d, 1));
    else setCurrentDate(d => dir > 0 ? addMonths(d, 1) : subMonths(d, 1));
  };

  const periodLabel = useMemo(() => {
    if (view === 'semana') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(ws, "d 'de' MMM", { locale: ptBR })} – ${format(we, "d 'de' MMM yyyy", { locale: ptBR })}`;
    }
    return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
  }, [view, currentDate]);



  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['agenda_reunioes'] });
    setModalOpen(false);
    setEditingReuniao(null);
    setDetalheReuniao(null);
  };

  const handleReschedule = async (reuniaoId, newDay, newHour) => {
    const r = reunioes.find(x => x.id === reuniaoId);
    if (!r) return;
    const oldStart = parseISO(r.start_datetime);
    const oldEnd = parseISO(r.end_datetime);
    const durMin = (oldEnd - oldStart) / 60000;
    const newStart = new Date(newDay);
    newStart.setHours(newHour, 0, 0, 0);
    const newEnd = new Date(newStart.getTime() + durMin * 60000);
    await base44.entities.AgendaReuniao.update(reuniaoId, {
      start_datetime: newStart.toISOString(),
      end_datetime: newEnd.toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['agenda_reunioes'] });
  };

  const handleClickDia = (date) => {
    setDefaultModalDate(date);
    setEditingReuniao(null);
    setModalOpen(true);
  };

  const handleClickEvento = (reuniao) => {
    setDetalheReuniao(reuniao);
  };

  const handleEditFromDetalhe = (opts) => {
    if (opts?.clone) {
      // Clonar reunião para criar próxima
      setCloneData(opts.reuniao);
      setEditingReuniao(null);
    } else {
      setEditingReuniao(detalheReuniao);
    }
    setDetalheReuniao(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-0 -m-4 lg:-m-8">
      {/* Topo */}
      <div className="flex items-center justify-between gap-3 px-4 lg:px-8 py-4 border-b bg-white sticky top-0 z-10 flex-wrap gap-y-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
          <span className="text-base font-semibold text-slate-800 capitalize">{periodLabel}</span>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Seletor de visualização */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            {[
              { key: 'semana', label: 'Semana', icon: CalendarDays },
              { key: 'mes', label: 'Mês', icon: Calendar },
              { key: 'lista', label: 'Lista', icon: List },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  view === key ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <Button onClick={() => { setEditingReuniao(null); setDefaultModalDate(null); setModalOpen(true); }} className="bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="w-4 h-4" />
            Nova reunião
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 px-4 lg:px-8 py-2 border-b bg-slate-50 flex-wrap">
        <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
          <SelectTrigger className="w-44 h-8 text-xs bg-white">
            <SelectValue placeholder="Todos os usuários" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os usuários</SelectItem>
            {voxxUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
          <SelectTrigger className="w-44 h-8 text-xs bg-white">
            <SelectValue placeholder="Todas as unidades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as unidades</SelectItem>
            {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-36 h-8 text-xs bg-white">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="agendada">Agendada</SelectItem>
            <SelectItem value="realizada">Realizada</SelectItem>
            <SelectItem value="nao_realizada">Não realizada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>

        {(filtroUsuario !== 'all' || filtroUnidade !== 'all' || filtroStatus !== 'all') && (
          <button
            onClick={() => { setFiltroUsuario('all'); setFiltroUnidade('all'); setFiltroStatus('all'); }}
            className="text-xs text-violet-600 hover:underline"
          >
            Limpar filtros
          </button>
        )}

        <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
          {Object.entries(STATUS_COLORS).map(([key, sc]) => (
            <span key={key} className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-full ${sc.bg}`} />
              {STATUS_LABELS[key]}
            </span>
          ))}
        </div>
      </div>

      <AgendaAlertas reunioes={reunioes} onClickReuniao={setDetalheReuniao} />

      {/* Calendário */}
      <div className="bg-white border-b min-h-[600px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">Carregando...</div>
        ) : view === 'semana' ? (
          <VisualizacaoSemana
            reunioes={reunioesFiltradas}
            currentDate={currentDate}
            onClickDia={handleClickDia}
            onClickEvento={handleClickEvento}
            onReschedule={handleReschedule}
          />
        ) : view === 'mes' ? (
          <VisualizacaoMes
            reunioes={reunioesFiltradas}
            currentDate={currentDate}
            onClickDia={handleClickDia}
            onClickEvento={handleClickEvento}
          />
        ) : (
          <VisualizacaoLista
            reunioes={reunioesFiltradas}
            onClickEvento={handleClickEvento}
          />
        )}
      </div>

      {/* Modais */}
      <NovaReuniaoModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingReuniao(null); setCloneData(null); }}
        onSaved={refresh}
        reuniao={editingReuniao}
        defaultDate={defaultModalDate}
        cloneFrom={cloneData}
      />

      <EventoDetalhe
        reuniao={detalheReuniao}
        open={!!detalheReuniao}
        onClose={() => setDetalheReuniao(null)}
        onEdit={handleEditFromDetalhe}
        onStatusChange={refresh}
      />
    </div>
  );
}