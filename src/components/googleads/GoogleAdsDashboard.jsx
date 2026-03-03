import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, Legend 
} from 'recharts';
import { AlertTriangle, TrendingDown, Target, Activity, Zap } from 'lucide-react';

const COLORS = {
  critico: '#ef4444',
  atencao: '#f97316',
  bom: '#eab308',
  excelente: '#22c55e',
  semDado: '#94a3b8',
  ativo: '#3b82f6',
  pausado: '#f97316',
};

function getScoreFaixa(score) {
  if (score == null || score === 0) return 'Sem score';
  if (score < 40) return 'Crítico';
  if (score < 60) return 'Atenção';
  if (score < 80) return 'Bom';
  return 'Excelente';
}

function getImpactoFaixa(spend, p33, p66) {
  if (spend <= 0) return 'Sem gasto';
  if (spend <= p33) return 'Baixo';
  if (spend <= p66) return 'Médio';
  return 'Alto';
}

export default function GoogleAdsDashboard({ accounts, voxxUsers }) {
  const data = useMemo(() => {
    if (!accounts || accounts.length === 0) return null;

    // Filtrar apenas contas com dados
    const comDados = accounts.filter(a => (a.cost || 0) > 0 || (a.clicks || 0) > 0);
    const semDados = accounts.filter(a => (a.cost || 0) === 0 && (a.clicks || 0) === 0);

    // Calcular percentis de spend para impacto
    const spends = accounts.map(a => a.cost || 0).filter(s => s > 0).sort((a, b) => a - b);
    const p33 = spends[Math.floor(spends.length * 0.33)] || 0;
    const p66 = spends[Math.floor(spends.length * 0.66)] || 0;

    // GRÁFICO 1 — Distribuição de Score
    const scoreFaixas = { 'Crítico': 0, 'Atenção': 0, 'Bom': 0, 'Excelente': 0, 'Sem score': 0 };
    accounts.forEach(a => {
      const score = a.health_score || a.optimization_score || 0;
      const faixa = getScoreFaixa(score);
      scoreFaixas[faixa]++;
    });
    const scoreData = Object.entries(scoreFaixas)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));

    // GRÁFICO 2 — Scatter: Score vs Impacto
    const scatterData = accounts.map(a => {
      const score = a.health_score || a.optimization_score || 0;
      const spend = a.cost || 0;
      const responsavelNome = voxxUsers?.find(u => u.id === a.responsavel_voxx)?.full_name || 'Não atribuído';
      return {
        x: score,
        y: spend,
        z: (a.conversions || 0) + 1,
        name: a.account_name,
        conversions: a.conversions || 0,
        cpa: a.cost_per_conversion || 0,
        responsavel: responsavelNome,
        status: a.account_status,
      };
    }).filter(d => d.x > 0 || d.y > 0);

    // GRÁFICO 3 — Top 10 Prioridade
    const scored = accounts.map(a => {
      const score = a.health_score || a.optimization_score || 0;
      const spend = a.cost || 0;
      const conversions = a.conversions || 0;
      let priority = 0;
      if (spend > 0 && conversions === 0) priority += 30;
      if (score < 40 && score > 0) priority += 25;
      if (score > 0 && score < 60) priority += 15;
      if (spend > p66) priority += 20;
      if (a.cost_per_conversion > 0) {
        const avgCpa = accounts.filter(x => x.cost_per_conversion > 0).reduce((s, x) => s + x.cost_per_conversion, 0) / 
          (accounts.filter(x => x.cost_per_conversion > 0).length || 1);
        if (a.cost_per_conversion > avgCpa * 1.5) priority += 10;
      }
      return { ...a, priority };
    }).filter(a => a.priority > 0)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10)
      .map(a => ({
        name: (a.account_name || '').length > 25 ? (a.account_name || '').slice(0, 25) + '…' : (a.account_name || ''),
        score: a.health_score || a.optimization_score || 0,
        spend: a.cost || 0,
        priority: a.priority,
      }));

    // GRÁFICO 4 — Status
    const statusCount = {};
    accounts.forEach(a => {
      const s = a.account_status || 'Desconhecido';
      statusCount[s] = (statusCount[s] || 0) + 1;
    });
    const statusData = Object.entries(statusCount).map(([name, value]) => ({ name, value }));

    // ALERTAS
    const semGasto = accounts.filter(a => (a.cost || 0) === 0).length;
    const gastoSemConversao = accounts.filter(a => (a.cost || 0) > 0 && (a.conversions || 0) === 0).length;
    const allCpas = accounts.filter(a => a.cost_per_conversion > 0).map(a => a.cost_per_conversion).sort((x, y) => x - y);
    const cpaP75 = allCpas[Math.floor(allCpas.length * 0.75)] || 0;
    const cpaAlto = accounts.filter(a => a.cost_per_conversion > cpaP75 && cpaP75 > 0).length;
    const allScores = accounts.map(a => a.health_score || a.optimization_score || 0).filter(s => s > 0);
    const scoreP25 = allScores.sort((a, b) => a - b)[Math.floor(allScores.length * 0.25)] || 0;
    const scoreBaixo = accounts.filter(a => {
      const s = a.health_score || a.optimization_score || 0;
      return s > 0 && s < scoreP25;
    }).length;

    return {
      scoreData,
      scatterData,
      rankingData: scored,
      statusData,
      alertas: { semGasto, gastoSemConversao, cpaAlto, scoreBaixo },
      totais: {
        total: accounts.length,
        comDados: comDados.length,
        semDados: semDados.length,
      }
    };
  }, [accounts, voxxUsers]);

  if (!data) return null;

  const scoreFaixaColor = {
    'Crítico': COLORS.critico,
    'Atenção': COLORS.atencao,
    'Bom': COLORS.bom,
    'Excelente': COLORS.excelente,
    'Sem score': COLORS.semDado,
  };

  const statusColor = ['#3b82f6', '#f97316', '#94a3b8', '#22c55e', '#ef4444'];

  const CustomScatterTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs space-y-1 max-w-[220px]">
        <p className="font-bold text-slate-800">{d.name}</p>
        <p>Score: <span className="font-semibold">{d.x || '—'}</span></p>
        <p>Gasto: <span className="font-semibold">R$ {(d.y || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
        <p>Conversões: <span className="font-semibold">{d.conversions}</span></p>
        {d.cpa > 0 && <p>CPA: <span className="font-semibold">R$ {d.cpa.toFixed(2)}</span></p>}
        <p>Resp.: <span className="font-semibold">{d.responsavel}</span></p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">📊 Visão de Performance — Google Ads</h2>
        <p className="text-sm text-slate-500 mt-1">{data.totais.total} contas · {data.totais.comDados} com dados · {data.totais.semDados} sem dados</p>
      </div>

      {/* Cards de Alerta */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AlertCard icon={<Activity className="w-5 h-5 text-slate-400" />} label="Sem gasto" value={data.alertas.semGasto} color="slate" />
        <AlertCard icon={<TrendingDown className="w-5 h-5 text-orange-500" />} label="Gasto sem conversão" value={data.alertas.gastoSemConversao} color="orange" />
        <AlertCard icon={<AlertTriangle className="w-5 h-5 text-red-500" />} label="CPA alto (top 25%)" value={data.alertas.cpaAlto} color="red" />
        <AlertCard icon={<Zap className="w-5 h-5 text-yellow-500" />} label="Score baixo (bot. 25%)" value={data.alertas.scoreBaixo} color="yellow" />
      </div>

      {/* Linha 1: Score + Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gráfico 1: Distribuição de Score */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Distribuição de Saúde (Score)</CardTitle>
            <p className="text-xs text-slate-400">Contas agrupadas por faixa de Health/Optimization Score</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.scoreData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [v, 'Contas']} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.scoreData.map((entry, idx) => (
                    <Cell key={idx} fill={scoreFaixaColor[entry.name] || '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico 4: Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Distribuição por Status</CardTitle>
            <p className="text-xs text-slate-400">Ativas, pausadas e sem dados</p>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data.statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {data.statusData.map((entry, idx) => (
                    <Cell key={idx} fill={statusColor[idx % statusColor.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Linha 2: Scatter + Ranking */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gráfico 2: Mapa de Risco */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Mapa de Risco — Score vs Gasto</CardTitle>
            <p className="text-xs text-slate-400">Contas com score baixo e gasto alto são prioridade</p>
          </CardHeader>
          <CardContent>
            {data.scatterData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart margin={{ top: 8, right: 8, left: -10, bottom: 4 }}>
                  <XAxis dataKey="x" name="Score" tick={{ fontSize: 10 }} label={{ value: 'Score', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                  <YAxis dataKey="y" name="Gasto" tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <ZAxis dataKey="z" range={[40, 400]} />
                  <Tooltip content={<CustomScatterTooltip />} />
                  <Scatter data={data.scatterData} fill="#6366f1" fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
                Dados insuficientes para o mapa de risco
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico 3: Ranking de Prioridade */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Top Prioridade — Contas para Atenção</CardTitle>
            <p className="text-xs text-slate-400">Gasto alto + score baixo + sem conversão</p>
          </CardHeader>
          <CardContent>
            {data.rankingData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart 
                  data={data.rankingData} 
                  layout="vertical" 
                  margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                >
                  <XAxis type="number" tick={{ fontSize: 10 }} hide />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                  <Tooltip 
                    formatter={(v, n) => [v, 'Índice de prioridade']}
                    labelFormatter={(l) => l}
                  />
                  <Bar dataKey="priority" fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
                Nenhuma conta crítica identificada
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AlertCard({ icon, label, value, color }) {
  const colorMap = {
    slate: 'bg-slate-50 border-slate-200',
    orange: 'bg-orange-50 border-orange-200',
    red: 'bg-red-50 border-red-200',
    yellow: 'bg-yellow-50 border-yellow-200',
  };
  const textMap = {
    slate: 'text-slate-700',
    orange: 'text-orange-700',
    red: 'text-red-700',
    yellow: 'text-yellow-700',
  };
  return (
    <Card className={`border ${colorMap[color] || colorMap.slate}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className={`text-xs font-medium ${textMap[color] || textMap.slate}`}>{label}</span>
        </div>
        <p className={`text-3xl font-bold ${textMap[color] || textMap.slate}`}>{value}</p>
      </CardContent>
    </Card>
  );
}