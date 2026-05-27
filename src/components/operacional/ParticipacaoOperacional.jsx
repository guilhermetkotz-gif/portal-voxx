import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Users, Award, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

const SETOR_CONFIG = {
  ATENDIMENTO:       { label: 'Atendimento',              cor: '#6366f1' },
  TRAFEGO_META:      { label: 'Tráfego – Meta Ads',       cor: '#3b82f6' },
  TRAFEGO_GOOGLE:    { label: 'Tráfego – Google Ads',     cor: '#0ea5e9' },
  TRAFEGO_TIKTOK:    { label: 'Tráfego – TikTok Ads',     cor: '#06b6d4' },
  CRIACAO:           { label: 'Criação (Artes & Peças)',   cor: '#8b5cf6' },
  EDICAO:            { label: 'Edição de Vídeo',           cor: '#a855f7' },
  BI_RELATORIO:      { label: 'Relatórios / BI',           cor: '#ec4899' },
  IMPLANTACAO:       { label: 'Implantação / Acessos',     cor: '#f97316' },
  FINANCEIRO:        { label: 'Financeiro / Administrativo', cor: '#eab308' },
  ALTERACAO_CRIACAO: { label: 'Alteração Criação',         cor: '#84cc16' },
  AUTOMACAO:         { label: 'Automação',                 cor: '#22c55e' },
  SALDOS:            { label: 'Saldos',                    cor: '#14b8a6' },
  GESTAO:            { label: 'Gestão',                    cor: '#64748b' },
  COMERCIAL:         { label: 'Comercial',                 cor: '#f43f5e' },
};

export default function ParticipacaoOperacional({ demandasPeriodo }) {
  const { data: usuarios = [] } = useQuery({
    queryKey: ['voxx_users_setor'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 5 * 60 * 1000,
  });

  // Map email → { nome, setor_responsavel }
  const userMap = useMemo(() => {
    const map = {};
    usuarios.forEach(u => {
      if (u.email) {
        map[u.email] = {
          nome: u.full_name || u.email,
          setor: u.setor_responsavel || null,
          tipo: u.tipo_usuario || u.tipo_acesso || '',
        };
      }
    });
    return map;
  }, [usuarios]);

  const isVoxx = (email) => {
    const u = userMap[email];
    return u && (u.tipo.startsWith('voxx_') || u.tipo.startsWith('admin'));
  };

  // Para cada demanda, coletar usuários participantes Voxx
  const { participacaoSetores, participacaoUsuarios } = useMemo(() => {
    const setores = {}; // setor_key → { label, cor, demandasIds: Set, concluidasIds: Set, usuariosEmails: Set }
    const usuariosMap = {}; // email → { nome, setor, total: Set, concluidas: Set }

    const registerParticipacao = (email, demandaId, concluida) => {
      if (!email || !isVoxx(email)) return;
      const u = userMap[email];
      if (!u) return;

      // Por usuário
      if (!usuariosMap[email]) {
        usuariosMap[email] = { nome: u.nome, setor: u.setor, email, total: new Set(), concluidas: new Set() };
      }
      usuariosMap[email].total.add(demandaId);
      if (concluida) usuariosMap[email].concluidas.add(demandaId);

      // Por setor do usuário
      const setorKey = u.setor;
      if (setorKey && SETOR_CONFIG[setorKey]) {
        if (!setores[setorKey]) {
          setores[setorKey] = {
            key: setorKey,
            label: SETOR_CONFIG[setorKey].label,
            cor: SETOR_CONFIG[setorKey].cor,
            demandasIds: new Set(),
            concluidasIds: new Set(),
            usuariosEmails: new Set(),
          };
        }
        setores[setorKey].demandasIds.add(demandaId);
        if (concluida) setores[setorKey].concluidasIds.add(demandaId);
        setores[setorKey].usuariosEmails.add(email);
      }
    };

    demandasPeriodo.forEach(d => {
      const concluida = d.status === 'concluida' || d.status === 'finalizada';

      // Criador
      if (d.created_by) registerParticipacao(d.created_by, d.id, concluida);

      // Histórico de tempo de trabalho
      if (Array.isArray(d.historico_tempo_trabalho)) {
        d.historico_tempo_trabalho.forEach(h => {
          if (h.usuario_id || h.usuario_nome) {
            // Try to match by email via users list
            const emailFromId = usuarios.find(u => u.id === h.usuario_id)?.email;
            if (emailFromId) registerParticipacao(emailFromId, d.id, concluida);
          }
        });
      }

      // Cronômetro ativo
      if (d.cronometro_usuario_id) {
        const emailTimer = usuarios.find(u => u.id === d.cronometro_usuario_id)?.email;
        if (emailTimer) registerParticipacao(emailTimer, d.id, concluida);
      }
    });

    // Serializar para exibição
    const participacaoSetoresArr = Object.values(setores).map(s => ({
      ...s,
      demandas: s.demandasIds.size,
      concluidas: s.concluidasIds.size,
      usuarios: s.usuariosEmails.size,
    })).sort((a, b) => b.demandas - a.demandas);

    const participacaoUsuariosArr = Object.values(usuariosMap).map(u => ({
      ...u,
      total: u.total.size,
      concluidas: u.concluidas.size,
      setorLabel: (u.setor && SETOR_CONFIG[u.setor]?.label) || 'Setor não definido',
      setorCor: (u.setor && SETOR_CONFIG[u.setor]?.cor) || '#94a3b8',
    })).sort((a, b) => b.total - a.total);

    return { participacaoSetores: participacaoSetoresArr, participacaoUsuarios: participacaoUsuariosArr };
  }, [demandasPeriodo, userMap, usuarios]);

  const hasData = participacaoSetores.length > 0 || participacaoUsuarios.length > 0;

  if (!hasData) {
    return (
      <Card className="p-5 border border-dashed border-slate-200">
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 text-violet-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-slate-700">Participação Operacional por Usuário</p>
            <p className="text-xs text-slate-500 mt-1">
              Assim que demandas forem criadas ou trabalhadas por usuários Voxx com setor definido, a participação operacional aparecerá aqui.
              Configure os setores dos usuários em <strong>Gerenciar Acessos</strong>.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const barData = participacaoSetores.map(s => ({
    name: s.label.length > 14 ? s.label.substring(0, 14) + '…' : s.label,
    demandas: s.demandas,
    fill: s.cor,
  }));

  return (
    <div className="space-y-6">
      {/* Participação por Setor */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-500" /> Participação Operacional por Setor (baseada em usuários)
          </h3>
          <span className="text-xs text-slate-400">{participacaoSetores.length} setores com participação</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico */}
          {barData.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 0, right: 10, bottom: 40, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, 'Demandas']} />
                <Bar dataKey="demandas" radius={[4, 4, 0, 0]}>
                  {barData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Tabela */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Setor', 'Demandas', 'Concluídas', 'Usuários'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 py-2 px-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {participacaoSetores.map(s => (
                  <tr key={s.key} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.cor }} />
                        <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{s.label}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 font-semibold text-slate-900">{s.demandas}</td>
                    <td className="py-2 px-2">
                      <span className={s.concluidas > 0 ? 'text-green-600 font-semibold' : 'text-slate-400'}>{s.concluidas}</span>
                    </td>
                    <td className="py-2 px-2 text-slate-600">{s.usuarios}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Ranking de Usuários */}
      {participacaoUsuarios.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" /> Ranking Operacional por Usuário
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['#', 'Usuário', 'Setor', 'Participações', 'Concluídas', '% Conclusão'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 py-2 px-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {participacaoUsuarios.slice(0, 20).map((u, i) => {
                  const pct = u.total > 0 ? Math.round((u.concluidas / u.total) * 100) : 0;
                  return (
                    <tr key={u.email} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-xs font-bold text-slate-400">{i + 1}</td>
                      <td className="py-2.5 px-3">
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{u.nome}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge className="text-xs" style={{ background: u.setorCor + '22', color: u.setorCor, borderColor: u.setorCor + '44' }}>
                          {u.setorLabel}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{u.total}</td>
                      <td className="py-2.5 px-3">
                        <span className={u.concluidas > 0 ? 'text-green-600 font-semibold' : 'text-slate-400'}>{u.concluidas}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5 min-w-[60px]">
                            <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-600 whitespace-nowrap">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}