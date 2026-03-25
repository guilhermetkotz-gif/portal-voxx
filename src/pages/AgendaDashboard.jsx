import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Loader2, BarChart3, ArrowLeft } from 'lucide-react';
import AgendaDashboardKPIs from '@/components/agenda/AgendaDashboardKPIs';
import AgendaPerformanceUsuarios from '@/components/agenda/AgendaPerformanceUsuarios';
import AgendaAtividadeUnidades from '@/components/agenda/AgendaAtividadeUnidades';
import AgendaAlertasGerenciais from '@/components/agenda/AgendaAlertasGerenciais';

const PERIODOS = [
  { label: 'Este mês', value: 'mes' },
  { label: 'Mês passado', value: 'mes_anterior' },
  { label: 'Últimos 3 meses', value: '3meses' },
  { label: 'Tudo', value: 'tudo' },
];

function hasRegistro(r) {
  return !!(r.summary || r.discussion_points || r.pending_items || r.next_steps);
}

export default function AgendaDashboard() {
  const [periodo, setPeriodo] = useState('mes');

  const { data: todasReunioes = [], isLoading } = useQuery({
    queryKey: ['agenda_dashboard_reunioes'],
    queryFn: () => base44.entities.AgendaReuniao.list('-start_datetime', 1000),
    staleTime: 2 * 60 * 1000,
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

  const reunioes = useMemo(() => {
    const now = new Date();
    if (periodo === 'tudo') return todasReunioes;
    if (periodo === 'mes') {
      const s = startOfMonth(now), e = endOfMonth(now);
      return todasReunioes.filter(r => { try { const d = new Date(r.start_datetime); return d >= s && d <= e; } catch { return false; } });
    }
    if (periodo === 'mes_anterior') {
      const prev = subMonths(now, 1);
      const s = startOfMonth(prev), e = endOfMonth(prev);
      return todasReunioes.filter(r => { try { const d = new Date(r.start_datetime); return d >= s && d <= e; } catch { return false; } });
    }
    if (periodo === '3meses') {
      const s = startOfMonth(subMonths(now, 2));
      return todasReunioes.filter(r => { try { return new Date(r.start_datetime) >= s; } catch { return false; } });
    }
    return todasReunioes;
  }, [todasReunioes, periodo]);

  const realizadas = reunioes.filter(r => r.status === 'realizada');
  const semRegistro = realizadas.filter(r => !hasRegistro(r));
  const taxaQualidade = realizadas.length > 0 ? Math.round(((realizadas.length - semRegistro.length) / realizadas.length) * 100) : 0;
  const comerciais = reunioes.filter(r => r.tipo_reuniao === 'comercial' && r.status === 'realizada');
  const propostas = reunioes.filter(r => r.status === 'realizada' && (r.meeting_result === 'proposta_enviada' || r.meeting_result === 'avancou')).length;
  const convertidas = comerciais.filter(r => r.meeting_result === 'fechado');
  const taxaConversao = comerciais.length > 0 ? Math.round((convertidas.length / comerciais.length) * 100) : 0;

  // Insights automáticos
  const insights = [];
  if (taxaQualidade < 60) insights.push({ emoji: '⚠️', text: `Apenas ${taxaQualidade}% das reuniões têm registro — priorize documentar.` });
  if (taxaQualidade >= 80) insights.push({ emoji: '✅', text: `Excelente taxa de qualidade (${taxaQualidade}%). Time operando bem!` });
  if (convertidas.length > 0) insights.push({ emoji: '💼', text: `${convertidas.length} fechamento${convertidas.length > 1 ? 's' : ''} no período — taxa de conversão de ${taxaConversao}%.` });
  if (semRegistro.length > 3) insights.push({ emoji: '🔴', text: `${semRegistro.length} reuniões sem registro — risco de perda de informação estratégica.` });
  if (propostas > 0) insights.push({ emoji: '📄', text: `${propostas} proposta${propostas > 1 ? 's' : ''} gerada${propostas > 1 ? 's' : ''} no período.` });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/AgendaVoxx" className="text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-violet-600" />
              Dashboard Agenda VOXX
            </h1>
            <p className="text-sm text-slate-500">Performance do time e disciplina operacional</p>
          </div>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {PERIODOS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriodo(p.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${periodo === p.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs: Produção + Qualidade */}
      <AgendaDashboardKPIs reunioes={reunioes} />

      {/* Comercial */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">🤝 Comercial</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{comerciais.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Reuniões comerciais</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{propostas}</p>
            <p className="text-xs text-slate-500 mt-0.5">Propostas geradas</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{convertidas.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Fechamentos</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-violet-600">{taxaConversao}%</p>
            <p className="text-xs text-slate-500 mt-0.5">Taxa de conversão</p>
          </div>
        </div>
      </div>

      {/* Grid: Alertas + Unidades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">🎯 Ações recomendadas hoje</h2>
          <AgendaAlertasGerenciais reunioes={reunioes} voxxUsers={voxxUsers} />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">🏥 Tempo sem contato por unidade</h2>
          <div className="max-h-72 overflow-y-auto">
            <AgendaAtividadeUnidades reunioes={reunioes} />
          </div>
        </div>
      </div>

      {/* Insights automáticos */}
      {insights.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-3">💡 Insights automáticos</h2>
          <div className="space-y-2">
            {insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="shrink-0">{ins.emoji}</span>
                <span>{ins.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ranking */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
          🏆 Ranking & Performance por Usuário
        </h2>
        <p className="text-xs text-slate-400 mb-4">Nível: Fechador ≥ 150pts · Consultivo ≥ 60pts · Operacional</p>
        <AgendaPerformanceUsuarios reunioes={reunioes} voxxUsers={voxxUsers} />
      </div>
    </div>
  );
}