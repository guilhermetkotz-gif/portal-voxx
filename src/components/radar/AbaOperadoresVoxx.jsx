import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Users, Clock, Star, AlertTriangle, BarChart3, Search, Eye, RefreshCw, UserX, FileQuestion } from 'lucide-react';
import OperadorDetailDrawer from './OperadorDetailDrawer';
import { toast } from 'sonner';
import moment from 'moment';
import 'moment-timezone';

const TZ = 'America/Sao_Paulo';

const CLASS_COLORS = {
  excelente: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  bom: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  atencao: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  critico: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  emergencial: 'bg-red-500/15 text-red-400 border-red-500/25',
};

function CardTopo({ icon: Icon, label, value, sub, color }) {
  return (
    <div className={`rounded-lg border p-2.5 flex items-center gap-2.5 ${color}`}>
      <Icon className="w-4 h-4 opacity-70 shrink-0" />
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight">{value ?? '—'}</p>
        <p className="text-[10px] opacity-70 leading-tight truncate">{label}</p>
        {sub && <p className="text-[9px] opacity-50">{sub}</p>}
      </div>
    </div>
  );
}

export default function AbaOperadoresVoxx() {
  const queryClient = useQueryClient();
  const [periodo, setPeriodo] = useState('7d');
  const [filtroClassificacao, setFiltroClassificacao] = useState('todas');
  const [filtroAtendente, setFiltroAtendente] = useState('');
  const [operadorSelecionado, setOperadorSelecionado] = useState(null);
  const [avaliando, setAvaliando] = useState(false);

  const getPeriodo = () => {
    const agora = moment().tz(TZ);
    switch (periodo) {
      case 'hoje': return { inicio: agora.clone().startOf('day').toISOString(), fim: agora.toISOString() };
      case 'ontem': return { inicio: agora.clone().subtract(1, 'day').startOf('day').toISOString(), fim: agora.clone().subtract(1, 'day').endOf('day').toISOString() };
      case '7d': return { inicio: agora.clone().subtract(7, 'days').startOf('day').toISOString(), fim: agora.toISOString() };
      case '30d': default: return { inicio: agora.clone().subtract(30, 'days').startOf('day').toISOString(), fim: agora.toISOString() };
    }
  };

  const periodoObj = getPeriodo();

  // Usar backend function para calcular tudo (evita rate limit carregando 6000+ msgs no frontend)
  const { data: resultado = { operadores: [], cards: {}, remetentes_nao_cadastrados: 0 }, isLoading } = useQuery({
    queryKey: ['perfOperadores', periodoObj.inicio, periodoObj.fim],
    queryFn: async () => {
      const res = await base44.functions.invoke('calcularPerformanceOperadoresVoxx', {
        periodoInicio: periodoObj.inicio,
        periodoFim: periodoObj.fim,
      });
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const operadores = resultado.operadores || [];
  const cards = resultado.cards || {};
  const remetentesNaoCadastrados = resultado.remetentes_nao_cadastrados || 0;

  // Filtros UI
  const operadoresFiltrados = useMemo(() => {
    return operadores.filter(op => {
      if (filtroClassificacao !== 'todas' && op.classificacao !== filtroClassificacao) return false;
      if (filtroAtendente && !op.nome.toLowerCase().includes(filtroAtendente.toLowerCase())) return false;
      return true;
    });
  }, [operadores, filtroClassificacao, filtroAtendente]);

  const avaliarPendentes = async () => {
    setAvaliando(true);
    try {
      const res = await base44.functions.invoke('avaliarQualidadeMensagensVoxx', { maxMensagens: 10 });
      toast.success(res.data.mensagem || 'Avaliação concluída.');
      queryClient.invalidateQueries({ queryKey: ['perfOperadores'] });
    } catch (e) {
      toast.error('Erro ao avaliar: ' + e.message);
    } finally {
      setAvaliando(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cards do topo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <CardTopo icon={Users} label="Atendentes ativos" value={cards.atendentes_ativos} color="bg-violet-500/10 text-violet-400 border-violet-500/15" />
        <CardTopo icon={Star} label="Score médio equipe" value={cards.score_medio_equipe} color="bg-blue-500/10 text-blue-400 border-blue-500/15" />
        <CardTopo icon={Clock} label="Tempo médio resp." value={cards.tempo_medio_resposta_equipe != null ? `${cards.tempo_medio_resposta_equipe}min` : '—'} color="bg-emerald-500/10 text-emerald-400 border-emerald-500/15" />
        <CardTopo icon={BarChart3} label="% dentro do SLA" value={cards.pct_dentro_sla_equipe != null ? `${cards.pct_dentro_sla_equipe}%` : '—'} color="bg-cyan-500/10 text-cyan-400 border-cyan-500/15" />
        <CardTopo icon={AlertTriangle} label="Msgs críticas" value={cards.mensagens_criticas_total} color="bg-red-500/10 text-red-400 border-red-500/15" />
        <CardTopo icon={FileQuestion} label="Aval. pendentes" value={cards.avaliacoes_pendentes_total} color="bg-amber-500/10 text-amber-400 border-amber-500/15" />
        <CardTopo icon={Star} label="Melhor score" value={cards.melhor_score} color="bg-emerald-500/10 text-emerald-400 border-emerald-500/15" sub="Individual" />
        <CardTopo icon={AlertTriangle} label="Ponto de atenção" value={cards.maior_ponto_atencao || 'Nenhum'} color="bg-slate-700 text-slate-300 border-slate-600" />
      </div>

      {/* Alertas */}
      {remetentesNaoCadastrados > 0 && (
        <div className="bg-amber-950/20 border border-amber-800/40 rounded-lg px-4 py-2.5 flex items-center gap-2">
          <UserX className="w-4 h-4 text-amber-400" />
          <p className="text-amber-300 text-xs">
            Existem <strong>{remetentesNaoCadastrados}</strong> remetente(s) VOXX não cadastrado(s). Verifique a aba <strong>Remetentes VOXX</strong>.
          </p>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 flex items-center gap-2 flex-wrap">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-28 h-7 text-xs bg-slate-800 border-slate-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="hoje" className="text-xs text-white">Hoje</SelectItem>
            <SelectItem value="ontem" className="text-xs text-white">Ontem</SelectItem>
            <SelectItem value="7d" className="text-xs text-white">7 dias</SelectItem>
            <SelectItem value="30d" className="text-xs text-white">30 dias</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroClassificacao} onValueChange={setFiltroClassificacao}>
          <SelectTrigger className="w-28 h-7 text-xs bg-slate-800 border-slate-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="todas" className="text-xs text-white">Todas</SelectItem>
            <SelectItem value="excelente" className="text-xs text-white">Excelente</SelectItem>
            <SelectItem value="bom" className="text-xs text-white">Bom</SelectItem>
            <SelectItem value="atencao" className="text-xs text-white">Atenção</SelectItem>
            <SelectItem value="critico" className="text-xs text-white">Crítico</SelectItem>
            <SelectItem value="emergencial" className="text-xs text-white">Emergencial</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Buscar atendente..."
            value={filtroAtendente}
            onChange={e => setFiltroAtendente(e.target.value)}
            className="w-36 h-7 text-xs bg-slate-800 border-slate-700 text-white pl-7"
          />
        </div>

        <div className="flex-1" />

        <Button
          size="sm"
          onClick={avaliarPendentes}
          disabled={avaliando}
          className="bg-emerald-600 hover:bg-emerald-500 h-7 text-xs gap-1.5"
        >
          {avaliando ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Avaliar pendentes
        </Button>
      </div>

      {/* Tabela */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="text-left px-3 py-2.5 text-slate-500 font-medium">#</th>
                <th className="text-left px-3 py-2.5 text-slate-500 font-medium">Atendente</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">Score</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">Classif.</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">Msgs</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">Grupos</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">Clientes</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">1ª Resp.</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">T. Médio</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">% SLA</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">Qualid.</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">Críticas</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">Pend.</th>
                <th className="text-left px-3 py-2.5 text-slate-500 font-medium">Ponto de Atenção</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={15} className="px-4 py-10 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : operadoresFiltrados.length === 0 ? (
                <tr><td colSpan={15} className="px-4 py-10 text-center text-slate-500">
                  {resultado.total_msgs_voxx_periodo === 0
                    ? 'Nenhuma mensagem VOXX no período selecionado.'
                    : 'Nenhum atendente encontrado com os filtros atuais.'}
                </td></tr>
              ) : (
                operadoresFiltrados.map((op, i) => (
                  <tr key={op.telefone_normalizado} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                    <td className="px-3 py-2.5 text-slate-500 font-mono">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <p className="text-white font-medium text-sm">{op.nome}</p>
                      <p className="text-slate-500 text-[10px] font-mono">{op.telefone}</p>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                        op.score_geral >= 90 ? 'bg-emerald-500/20 text-emerald-400' :
                        op.score_geral >= 75 ? 'bg-blue-500/20 text-blue-400' :
                        op.score_geral >= 60 ? 'bg-amber-500/20 text-amber-400' :
                        op.score_geral >= 40 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>{op.score_geral}</span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <Badge className={`text-[10px] border ${CLASS_COLORS[op.classificacao] || CLASS_COLORS.atencao}`}>
                        {op.classificacao === 'excelente' ? 'Excel.' :
                         op.classificacao === 'atencao' ? 'Atenção' :
                         op.classificacao === 'critico' ? 'Crítico' :
                         op.classificacao}
                      </Badge>
                    </td>
                    <td className="px-2 py-2.5 text-center text-white font-mono">{op.mensagens_enviadas}</td>
                    <td className="px-2 py-2.5 text-center text-slate-300 font-mono">{op.grupos_em_que_participou}</td>
                    <td className="px-2 py-2.5 text-center text-slate-300 font-mono">{op.clientes_em_que_participou}</td>
                    <td className="px-2 py-2.5 text-center text-white font-mono">{op.primeiras_respostas}</td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`font-mono ${op.tempo_medio_resposta != null && op.tempo_medio_resposta > 14 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {op.tempo_medio_resposta != null ? `${op.tempo_medio_resposta}m` : '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`font-mono ${op.pct_dentro_sla != null && op.pct_dentro_sla < 80 ? 'text-red-400' : op.pct_dentro_sla != null && op.pct_dentro_sla < 95 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {op.pct_dentro_sla != null ? `${op.pct_dentro_sla}%` : '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`font-mono ${op.score_medio_qualidade != null && op.score_medio_qualidade < 75 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {op.score_medio_qualidade != null ? op.score_medio_qualidade : '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      {op.mensagens_criticas > 0
                        ? <span className="text-red-400 font-bold font-mono">{op.mensagens_criticas}</span>
                        : <span className="text-slate-500 font-mono">0</span>}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      {op.avaliacoes_pendentes > 0
                        ? <span className="text-amber-400 font-mono">{op.avaliacoes_pendentes}</span>
                        : <span className="text-slate-500 font-mono">0</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] text-slate-400">{op.principal_ponto_atencao || '—'}</span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setOperadorSelecionado(op)}
                        className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-7 w-7 p-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {operadorSelecionado && (
        <OperadorDetailDrawer
          open={!!operadorSelecionado}
          onClose={() => setOperadorSelecionado(null)}
          operador={operadorSelecionado}
          periodoInicio={periodoObj.inicio}
          periodoFim={periodoObj.fim}
        />
      )}
    </div>
  );
}