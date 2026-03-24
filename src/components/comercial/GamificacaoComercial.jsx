import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import {
  Trophy, Zap, Target, Star, AlertTriangle, TrendingUp,
  MessageCircle, Calendar, FileText, CheckCircle2, Users, Crown, X, ChevronRight, Activity
} from 'lucide-react';
import { startOfDay, startOfWeek, parseISO, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Pontuação ────────────────────────────────────────────────────────────────
const PONTOS = {
  ligacao:   15,
  whatsapp:  10,
  email:      8,
  reuniao:   30,
  proposta:  40,
  nota:       5,
  follow_up: 12,
  // qualidade
  scanner_preenchido: 20,
  analise_gmn:        15,
  analise_instagram:  15,
  // avançar etapa
  qualificado:         25,
  proposta_enviada:    40,
  negociacao:          35,
  fechado_ganho:      100,
};

const PENALIDADES = {
  lead_sem_followup: -10,   // por lead sem interação > 7 dias (max -50)
  dados_incompletos: -5,    // por lead sem telefone/email
};

const MISSOES_DIARIAS = [
  { id: 'abordagem',   label: '3 abordagens hoje',       meta: 3,  xp: 30,  tipo: ['whatsapp', 'ligacao', 'email'] },
  { id: 'followup',    label: '2 follow-ups hoje',        meta: 2,  xp: 20,  tipo: ['follow_up', 'nota'] },
  { id: 'reuniao',     label: '1 reunião agendada hoje',  meta: 1,  xp: 30,  tipo: ['reuniao'] },
  { id: 'scanner',     label: '1 Scanner Voxx gerado',    meta: 1,  xp: 25,  tipo: ['scanner'] },
];

const NIVEIS = [
  { nome: 'Iniciante',   min: 0,    max: 199,  cor: 'text-slate-500',  bg: 'bg-slate-100',  emoji: '🌱' },
  { nome: 'Operacional', min: 200,  max: 499,  cor: 'text-blue-600',   bg: 'bg-blue-50',    emoji: '⚡' },
  { nome: 'Consultivo',  min: 500,  max: 999,  cor: 'text-violet-600', bg: 'bg-violet-50',  emoji: '🎯' },
  { nome: 'Fechador',    min: 1000, max: 99999, cor: 'text-amber-600', bg: 'bg-amber-50',   emoji: '🏆' },
];

function getNivel(score) {
  return NIVEIS.find(n => score >= n.min && score <= n.max) || NIVEIS[0];
}

function ProgressBar({ value, max, color = 'bg-violet-500' }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full bg-slate-100 rounded-full h-2">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function GamificacaoComercial({ leads = [], user }) {
  const navigate = useNavigate();
  const hoje = startOfDay(new Date());
  const semana = startOfWeek(new Date(), { locale: ptBR });

  const { data: interacoes = [] } = useQuery({
    queryKey: ['interacoesGamificacao'],
    queryFn: () => base44.entities.InteracaoComercial.list('-created_date', 500),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: reunioes = [] } = useQuery({
    queryKey: ['reunioesGamificacao'],
    queryFn: () => base44.entities.ReuniaoComercial.list('-created_date', 200),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  // ── Cálculo de score por usuário ─────────────────────────────────────────
  const [selectedUser, setSelectedUser] = useState(null);

  const { ranking, meuScore, minhasInteracoesHoje, meuNivel, leadsEmRisco: leadsRisco } = useMemo(() => {
    const interacoesHoje = interacoes.filter(i => i.created_date && isAfter(parseISO(i.created_date), hoje));
    const interacoesSemana = interacoes.filter(i => i.created_date && isAfter(parseISO(i.created_date), semana));
    const reunioesSemana = reunioes.filter(r => r.created_date && isAfter(parseISO(r.created_date), semana));

    // Agrupar por autor
    const scorePorUsuario = {};

    const addScore = (email, nome, pts, semanaOnly = false) => {
      if (!email) return;
      if (!scorePorUsuario[email]) {
        scorePorUsuario[email] = { email, nome: nome || email.split('@')[0], scoreHoje: 0, scoreSemana: 0 };
      }
      if (!semanaOnly) scorePorUsuario[email].scoreHoje += pts;
      scorePorUsuario[email].scoreSemana += pts;
    };

    interacoesHoje.forEach(i => {
      const pts = PONTOS[i.tipo] || 5;
      addScore(i.autor, i.autor_nome, pts);
    });

    // Semana completa
    interacoesSemana.forEach(i => {
      const pts = PONTOS[i.tipo] || 5;
      if (!isAfter(parseISO(i.created_date), hoje)) {
        addScore(i.autor, i.autor_nome, pts, true);
      }
    });

    reunioesSemana.forEach(r => {
      if (!isAfter(parseISO(r.created_date), hoje)) {
        addScore(r.responsavel_voxx, r.responsavel_nome, PONTOS.reuniao, true);
      }
    });

    // Bonus: leads com scanner preenchido (criados esta semana)
    leads.forEach(l => {
      if (l.voxx_analise?.voxx_score && l.responsavel_voxx) {
        const pts = PONTOS.scanner_preenchido + (l.voxx_analise?.gmn_score ? PONTOS.analise_gmn : 0)
          + (l.voxx_analise?.instagram_score ? PONTOS.analise_instagram : 0);
        if (!scorePorUsuario[l.responsavel_voxx]) {
          scorePorUsuario[l.responsavel_voxx] = { email: l.responsavel_voxx, nome: l.responsavel_nome || l.responsavel_voxx, scoreHoje: 0, scoreSemana: 0 };
        }
        scorePorUsuario[l.responsavel_voxx].scoreSemana += pts;
      }
    });

    // Penalidades (leads em risco sem follow-up — impacta responsável)
    const leadsEmRisco = leads.filter(l => {
      if (['fechado_ganho', 'fechado_perdido'].includes(l.etapa)) return false;
      const ref = l.ultima_interacao || l.created_date;
      if (!ref) return true;
      return Math.floor((Date.now() - new Date(ref)) / (1000 * 60 * 60 * 24)) > 7;
    });

    leadsEmRisco.forEach(l => {
      if (l.responsavel_voxx && scorePorUsuario[l.responsavel_voxx]) {
        scorePorUsuario[l.responsavel_voxx].scoreSemana += PENALIDADES.lead_sem_followup;
        scorePorUsuario[l.responsavel_voxx].scoreHoje += PENALIDADES.lead_sem_followup / 2;
      }
    });

    const rankingArr = Object.values(scorePorUsuario)
      .map(u => ({ ...u, scoreHoje: Math.max(0, Math.round(u.scoreHoje)), scoreSemana: Math.max(0, Math.round(u.scoreSemana)) }))
      .sort((a, b) => b.scoreSemana - a.scoreSemana);

    const myEmail = user?.email;
    const meu = scorePorUsuario[myEmail] || { email: myEmail, nome: user?.full_name || 'Você', scoreHoje: 0, scoreSemana: 0 };
    const scoreHoje = Math.max(0, Math.round(meu.scoreHoje));
    const scoreSemana = Math.max(0, Math.round(meu.scoreSemana));

    const interacoesHojeMeu = interacoesHoje.filter(i => i.autor === myEmail);
    const nivel = getNivel(scoreSemana);

    return {
      ranking: rankingArr,
      meuScore: { hoje: scoreHoje, semana: scoreSemana },
      minhasInteracoesHoje: interacoesHojeMeu,
      meuNivel: nivel,
      leadsEmRisco,
      allInteracoesHoje: interacoesHoje,
      allInteracoesSemana: interacoesSemana,
    };
  }, [interacoes, reunioes, leads, user?.email]);

  // ── Missões diárias ──────────────────────────────────────────────────────
  const missoes = useMemo(() => {
    return MISSOES_DIARIAS.map(m => {
      let progresso = 0;
      if (m.id === 'scanner') {
        progresso = leads.filter(l =>
          l.responsavel_voxx === user?.email && l.voxx_analise?.voxx_score
        ).length;
      } else {
        progresso = minhasInteracoesHoje.filter(i => m.tipo.includes(i.tipo)).length;
      }
      return { ...m, progresso: Math.min(progresso, m.meta), completa: progresso >= m.meta };
      });
  }, [minhasInteracoesHoje, leads, user?.email]);

  const xpGanhoHoje = missoes.filter(m => m.completa).reduce((s, m) => s + m.xp, 0);
  const xpTotalPossivel = missoes.reduce((s, m) => s + m.xp, 0);

  // ── Leads esquecidos (meus) ──────────────────────────────────────────────
  // Detalhes do usuário selecionado
  const userDetail = useMemo(() => {
    if (!selectedUser) return null;
    const interacoesHoje = interacoes.filter(i => i.created_date && isAfter(parseISO(i.created_date), hoje));
    const interacoesSemana = interacoes.filter(i => i.created_date && isAfter(parseISO(i.created_date), semana));
    const minhasHoje = interacoesHoje.filter(i => i.autor === selectedUser.email);
    const minhasSemana = interacoesSemana.filter(i => i.autor === selectedUser.email);
    const meusLeads = leads.filter(l => l.responsavel_voxx === selectedUser.email && !['fechado_ganho','fechado_perdido'].includes(l.etapa));
    const leadsEsq = leads.filter(l => {
      if (l.responsavel_voxx !== selectedUser.email) return false;
      if (['fechado_ganho','fechado_perdido'].includes(l.etapa)) return false;
      const ref = l.ultima_interacao || l.created_date;
      if (!ref) return true;
      return Math.floor((Date.now() - new Date(ref)) / (1000 * 60 * 60 * 24)) > 7;
    });
    // Score breakdown por tipo
    const breakdown = {};
    minhasSemana.forEach(i => {
      breakdown[i.tipo] = (breakdown[i.tipo] || 0) + 1;
    });
    return { minhasHoje, minhasSemana, meusLeads, leadsEsq, breakdown };
  }, [selectedUser, interacoes, leads, hoje, semana]);

  const leadsEsquecidos = leads.filter(l => {
    if (l.responsavel_voxx !== user?.email) return false;
    if (['fechado_ganho', 'fechado_perdido'].includes(l.etapa)) return false;
    const ref = l.ultima_interacao || l.created_date;
    if (!ref) return true;
    return Math.floor((Date.now() - new Date(ref)) / (1000 * 60 * 60 * 24)) > 7;
  }).slice(0, 5);

  const proximoNivel = NIVEIS[NIVEIS.indexOf(meuNivel) + 1];

  return (
    <div className="space-y-5">
      {/* Meu Score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Painel principal */}
        <Card className={`p-5 col-span-1 ${meuNivel.bg} border-2 border-current`} style={{ borderColor: undefined }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Seu Nível</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl">{meuNivel.emoji}</span>
                <span className={`text-xl font-black ${meuNivel.cor}`}>{meuNivel.nome}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-slate-900">{meuScore.semana}</p>
              <p className="text-xs text-slate-400">pts esta semana</p>
            </div>
          </div>

          {proximoNivel && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{meuScore.semana} pts</span>
                <span>{proximoNivel.nome} → {proximoNivel.min} pts</span>
              </div>
              <ProgressBar value={meuScore.semana - meuNivel.min} max={meuNivel.max - meuNivel.min} color="bg-violet-500" />
            </div>
          )}

          <div className="flex gap-3 mt-3 pt-3 border-t border-slate-200">
            <div className="text-center flex-1">
              <p className="text-lg font-bold text-slate-800">{meuScore.hoje}</p>
              <p className="text-[10px] text-slate-400">pts hoje</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-lg font-bold text-emerald-600">{xpGanhoHoje}</p>
              <p className="text-[10px] text-slate-400">XP missões</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-lg font-bold text-slate-800">{minhasInteracoesHoje.length}</p>
              <p className="text-[10px] text-slate-400">ações hoje</p>
            </div>
          </div>
        </Card>

        {/* Missões Diárias */}
        <Card className="p-5 col-span-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><Target className="w-4 h-4 text-violet-500" /> Missões do Dia</p>
            <Badge className="bg-violet-100 text-violet-700 text-xs">{missoes.filter(m => m.completa).length}/{missoes.length}</Badge>
          </div>

          {/* Barra geral do dia */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Progresso diário</span>
              <span>{xpGanhoHoje}/{xpTotalPossivel} XP</span>
            </div>
            <ProgressBar value={xpGanhoHoje} max={xpTotalPossivel} color="bg-violet-500" />
          </div>

          <div className="space-y-2">
            {missoes.map(m => (
              <div key={m.id} className={`flex items-center gap-3 p-2 rounded-lg ${m.completa ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${m.completa ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                  {m.completa ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <span className="text-[10px] font-bold text-slate-500">{m.progresso}/{m.meta}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${m.completa ? 'text-emerald-700 line-through' : 'text-slate-700'}`}>{m.label}</p>
                  <ProgressBar value={m.progresso} max={m.meta} color={m.completa ? 'bg-emerald-400' : 'bg-violet-400'} />
                </div>
                <span className="text-[11px] font-bold text-violet-600 flex-shrink-0">+{m.xp}xp</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Leads esquecidos / alertas */}
        <Card className="p-5 col-span-1">
          <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Meus Leads Esquecidos
          </p>
          {leadsEsquecidos.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Nenhum lead esquecido!</p>
              <p className="text-xs text-emerald-600 font-medium mt-1">+50 pts de bônus mantidos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leadsEsquecidos.map(l => {
                const dias = Math.floor((Date.now() - new Date(l.ultima_interacao || l.created_date)) / (1000 * 60 * 60 * 24));
                return (
                  <div
                    key={l.id}
                    className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors"
                    onClick={() => navigate(`/LeadDetalhe?id=${l.id}`)}
                  >
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{l.nome_empresa}</p>
                      <p className="text-[10px] text-amber-700">{dias}d sem contato — -{Math.abs(PENALIDADES.lead_sem_followup / 2)} pts/dia</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ranking Semanal */}
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-4">
            <Crown className="w-4 h-4 text-amber-500" /> Ranking Semanal
          </p>
          {ranking.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Nenhuma atividade esta semana.</p>
          ) : (
            <div className="space-y-2">
              {ranking.map((u, i) => {
                const nivel = getNivel(u.scoreSemana);
                const isMe = u.email === user?.email;
                const isSelected = selectedUser?.email === u.email;
                return (
                  <div
                    key={u.email}
                    onClick={() => setSelectedUser(isSelected ? null : u)}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-violet-100 border border-violet-400' :
                      isMe ? 'bg-violet-50 border border-violet-200 hover:bg-violet-100' :
                      'bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`text-sm font-black w-5 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-500' : i === 2 ? 'text-amber-700' : 'text-slate-400'}`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </span>
                    <span className="text-base">{nivel.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isMe ? 'text-violet-800' : 'text-slate-800'}`}>
                        {u.nome} {isMe && <span className="text-xs text-violet-500">(você)</span>}
                      </p>
                      <p className="text-[11px] text-slate-400">{nivel.nome}</p>
                    </div>
                    <div className="text-right flex items-center gap-1">
                      <p className="text-sm font-bold text-slate-900">{u.scoreSemana} pts</p>
                      <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Ranking Hoje */}
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-4">
            <Zap className="w-4 h-4 text-violet-500" /> Ranking de Hoje
          </p>
          {ranking.filter(u => u.scoreHoje > 0).length === 0 ? (
            <div className="text-center py-6">
              <Zap className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Nenhuma atividade registrada hoje.</p>
              <p className="text-xs text-slate-400 mt-1">Seja o primeiro a pontuar!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ranking
                .filter(u => u.scoreHoje > 0)
                .sort((a, b) => b.scoreHoje - a.scoreHoje)
                .map((u, i) => {
                  const nivel = getNivel(u.scoreSemana);
                  const isMe = u.email === user?.email;
                  const isSelected = selectedUser?.email === u.email;
                  return (
                    <div
                      key={u.email}
                      onClick={() => setSelectedUser(isSelected ? null : u)}
                      className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                        isSelected ? 'bg-violet-100 border border-violet-400' :
                        isMe ? 'bg-violet-50 border border-violet-200 hover:bg-violet-100' :
                        'bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                    <span className="text-sm font-bold w-5 text-center text-slate-400">#{i + 1}</span>
                    <span className="text-base">{nivel.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isMe ? 'text-violet-800' : 'text-slate-800'}`}>
                        {u.nome} {isMe && <span className="text-xs text-violet-500">(você)</span>}
                      </p>
                      <p className="text-[11px] text-slate-400">{u.scoreHoje} pts hoje</p>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                  </div>
                  );
                })}
            </div>
          )}
        </Card>
      </div>

      {/* Painel de detalhes do usuário selecionado */}
      {selectedUser && userDetail && (
        <Card className="p-5 border-violet-200 bg-violet-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-600" />
              <p className="text-sm font-bold text-violet-900">
                {selectedUser.nome} — Detalhes de Performance
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${getNivel(selectedUser.scoreSemana).bg} ${getNivel(selectedUser.scoreSemana).cor}`}>
                {getNivel(selectedUser.scoreSemana).emoji} {getNivel(selectedUser.scoreSemana).nome}
              </span>
            </div>
            <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Score Hoje', value: selectedUser.scoreHoje, color: 'text-violet-700' },
              { label: 'Score Semana', value: selectedUser.scoreSemana, color: 'text-violet-900' },
              { label: 'Ações Hoje', value: userDetail.minhasHoje.length, color: 'text-blue-700' },
              { label: 'Leads Ativos', value: userDetail.meusLeads.length, color: 'text-slate-700' },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-lg p-3 text-center border border-violet-100">
                <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
                <p className="text-[11px] text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Breakdown de ações esta semana */}
            <div className="bg-white rounded-lg p-4 border border-violet-100">
              <p className="text-xs font-bold text-slate-600 mb-3 uppercase tracking-wide">Ações por tipo (semana)</p>
              {Object.keys(userDetail.breakdown).length === 0 ? (
                <p className="text-sm text-slate-400">Nenhuma ação registrada.</p>
              ) : (
                <div className="space-y-1.5">
                  {Object.entries(userDetail.breakdown).map(([tipo, qtd]) => (
                    <div key={tipo} className="flex items-center justify-between">
                      <span className="text-xs text-slate-600 capitalize">{tipo.replace('_', ' ')}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">{qtd}x</span>
                        <span className="text-xs text-violet-600">+{(PONTOS[tipo] || 5) * qtd} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Leads esquecidos do usuário */}
            <div className="bg-white rounded-lg p-4 border border-violet-100">
              <p className="text-xs font-bold text-slate-600 mb-3 uppercase tracking-wide">
                Leads esquecidos ({userDetail.leadsEsq.length})
              </p>
              {userDetail.leadsEsq.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <p className="text-sm">Nenhum lead esquecido!</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {userDetail.leadsEsq.slice(0, 5).map(l => {
                    const dias = Math.floor((Date.now() - new Date(l.ultima_interacao || l.created_date)) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={l.id} onClick={() => navigate(`/LeadDetalhe?id=${l.id}`)} className="flex items-center justify-between cursor-pointer hover:bg-red-50 p-1.5 rounded">
                        <p className="text-xs text-slate-700 truncate">{l.nome_empresa}</p>
                        <span className="text-[10px] text-red-600 font-bold flex-shrink-0 ml-2">{dias}d</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}


      {/* Tabela de pontuação */}
      <Card className="p-5">
        <p className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-1.5">
          <Star className="w-4 h-4 text-amber-400" /> Como Pontuar
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Abordagem (WA/Ligação)', pts: PONTOS.whatsapp + '–' + PONTOS.ligacao, icon: '📞', cor: 'bg-blue-50 border-blue-200' },
            { label: 'Reunião realizada', pts: PONTOS.reuniao, icon: '🤝', cor: 'bg-violet-50 border-violet-200' },
            { label: 'Proposta enviada', pts: PONTOS.proposta, icon: '📋', cor: 'bg-amber-50 border-amber-200' },
            { label: 'Venda fechada!', pts: PONTOS.fechado_ganho, icon: '🏆', cor: 'bg-emerald-50 border-emerald-200' },
            { label: 'Scanner Voxx gerado', pts: PONTOS.scanner_preenchido, icon: '🔍', cor: 'bg-indigo-50 border-indigo-200' },
            { label: 'Análise GMN', pts: PONTOS.analise_gmn, icon: '📍', cor: 'bg-pink-50 border-pink-200' },
            { label: 'Lead esquecido +7d', pts: PENALIDADES.lead_sem_followup, icon: '⚠️', cor: 'bg-red-50 border-red-200' },
            { label: 'Nota/Follow-up', pts: PONTOS.nota + '–' + PONTOS.follow_up, icon: '✍️', cor: 'bg-slate-50 border-slate-200' },
          ].map(item => (
            <div key={item.label} className={`p-3 rounded-lg border ${item.cor} flex items-center gap-2`}>
              <span className="text-xl">{item.icon}</span>
              <div>
                <p className="text-[11px] text-slate-600 leading-tight">{item.label}</p>
                <p className={`text-sm font-bold ${String(item.pts).startsWith('-') ? 'text-red-600' : 'text-slate-900'}`}>
                  {String(item.pts).startsWith('-') ? '' : '+'}{item.pts} pts
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}