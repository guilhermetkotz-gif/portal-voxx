import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, BookOpen, Plus, AlertTriangle, CheckCircle2, Clock, User, Filter } from 'lucide-react';
import { format } from 'date-fns';
import BriefingDetalheModal from '@/components/briefing/BriefingDetalheModal';

// Calcula score de preenchimento (0–100)
export function calcBriefingScore(b) {
  if (!b) return 0;
  const checks = [
    // visao_geral (20pts)
    b.visao_geral?.segmento, b.visao_geral?.publico_principal, b.visao_geral?.posicionamento,
    b.visao_geral?.tom_marca, b.visao_geral?.objetivo_atual,
    // criacao (20pts)
    b.criacao?.direcao_arte, b.criacao?.tom_comunicacao, b.criacao?.paleta_cores,
    b.criacao?.posicionamento_visual, b.criacao?.limitacoes_criativas,
    // meta_ads (15pts)
    b.meta_ads?.publico_alvo, b.meta_ads?.principais_tratamentos, b.meta_ads?.foco_campanha,
    // google_ads (15pts)
    b.google_ads?.principais_buscas, b.google_ads?.tratamentos_prioritarios, b.google_ads?.palavras_estrategicas,
    // comercial (10pts)
    b.comercial?.objecoes, b.comercial?.perfil_ideal,
    // restricoes (10pts)
    b.restricoes?.nao_fazer, b.restricoes?.termos_proibidos,
    // assets (10pts)
    b.assets?.link_drive || b.assets?.link_dropbox, b.assets?.manual_marca_url,
  ];
  const filled = checks.filter(v => v && String(v).trim().length > 0).length;
  return Math.round((filled / checks.length) * 100);
}

const STATUS_CONFIG = {
  rascunho:     { label: 'Rascunho',      color: 'bg-slate-100 text-slate-600' },
  em_andamento: { label: 'Em andamento',  color: 'bg-blue-100 text-blue-700' },
  completo:     { label: 'Completo',      color: 'bg-green-100 text-green-700' },
  desatualizado:{ label: 'Desatualizado', color: 'bg-amber-100 text-amber-700' },
};

function ScoreBar({ score }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-400' : score >= 25 ? 'bg-orange-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-600 w-8 text-right">{score}%</span>
    </div>
  );
}

export default function BriefingClientes({ user }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedBriefing, setSelectedBriefing] = useState(null);
  const [selectedCliente, setSelectedCliente] = useState(null);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes_briefing'],
    queryFn: () => base44.entities.Cliente.list('-nome', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: briefings = [], isLoading } = useQuery({
    queryKey: ['briefings'],
    queryFn: () => base44.entities.BriefingCliente.list('-updated_date', 500),
    staleTime: 2 * 60 * 1000,
  });

  const createBriefing = useMutation({
    mutationFn: (data) => base44.entities.BriefingCliente.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['briefings'] }),
  });

  // Mapa clienteId → briefing
  const briefingMap = useMemo(() => {
    const m = {};
    briefings.forEach(b => { if (b.cliente_id) m[b.cliente_id] = b; });
    return m;
  }, [briefings]);

  // Combinar clientes + briefings
  const clientesComScore = useMemo(() => {
    return clientes.map(c => {
      const b = briefingMap[c.id] || null;
      const score = calcBriefingScore(b);
      return { cliente: c, briefing: b, score };
    });
  }, [clientes, briefingMap]);

  // Filtros
  const filtered = useMemo(() => {
    let arr = clientesComScore;
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(({ cliente }) =>
        cliente.nome?.toLowerCase().includes(q) ||
        cliente.cidade?.toLowerCase().includes(q) ||
        cliente.responsavel_voxx_cs?.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') {
      if (filterStatus === 'sem_briefing') arr = arr.filter(({ briefing }) => !briefing);
      else arr = arr.filter(({ briefing }) => briefing?.status_briefing === filterStatus);
    }
    return arr.sort((a, b) => b.score - a.score);
  }, [clientesComScore, search, filterStatus]);

  // Alertas gerais
  const semBriefing = clientesComScore.filter(x => !x.briefing).length;
  const desatualizados = clientesComScore.filter(x => x.briefing?.status_briefing === 'desatualizado').length;
  const scoreGeral = clientesComScore.length > 0
    ? Math.round(clientesComScore.reduce((a, x) => a + x.score, 0) / clientesComScore.length)
    : 0;

  const handleOpenBriefing = async ({ cliente, briefing }) => {
    if (!briefing) {
      // criar briefing vazio
      const novo = await createBriefing.mutateAsync({
        cliente_id: cliente.id,
        cliente_nome: cliente.nome,
        status_briefing: 'rascunho',
        responsavel_voxx: user?.email || '',
        responsavel_nome: user?.full_name || '',
      });
      setSelectedBriefing(novo);
    } else {
      setSelectedBriefing(briefing);
    }
    setSelectedCliente(cliente);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-violet-600" /> Briefing Clientes
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Central de contexto operacional, criativo e estratégico — memória viva da marca
          </p>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-xs text-slate-500">Clientes cadastrados</p>
          <p className="text-2xl font-bold text-slate-900">{clientes.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-slate-500">Score médio da base</p>
          <div className="flex items-end gap-2 mt-0.5">
            <p className="text-2xl font-bold text-slate-900">{scoreGeral}%</p>
          </div>
          <ScoreBar score={scoreGeral} />
        </Card>
        <Card className="p-3 border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Sem briefing</p>
          <p className="text-2xl font-bold text-amber-700">{semBriefing}</p>
          <p className="text-[10px] text-amber-500">clientes sem nenhum preenchimento</p>
        </Card>
        <Card className="p-3 border-orange-200 bg-orange-50">
          <p className="text-xs text-orange-700 flex items-center gap-1"><Clock className="w-3 h-3" /> Desatualizados</p>
          <p className="text-2xl font-bold text-orange-700">{desatualizados}</p>
          <p className="text-[10px] text-orange-400">marcados como desatualizado</p>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <Filter className="w-3 h-3 mr-1" />
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="sem_briefing">Sem briefing</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="completo">Completo</SelectItem>
            <SelectItem value="desatualizado">Desatualizado</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400">{filtered.length} clientes</span>
      </div>

      {/* Tabela */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Cliente', 'Cidade / Segmento', 'Responsável', 'Status', 'Score', 'Última atualização', 'Ação'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-slate-400 py-10 text-sm">Nenhum cliente encontrado</td></tr>
                ) : filtered.map(({ cliente, briefing, score }) => {
                  const st = STATUS_CONFIG[briefing?.status_briefing || 'rascunho'];
                  return (
                    <tr key={cliente.id} className="border-b border-slate-50 hover:bg-violet-50/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{cliente.nome}</p>
                        {cliente.marca && <p className="text-[10px] text-slate-400">{cliente.marca}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700">{cliente.cidade}{cliente.estado ? `, ${cliente.estado}` : ''}</p>
                        {cliente.plano_servico && (
                          <span className="text-[10px] text-slate-400">{cliente.plano_servico}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-600">
                            {briefing?.responsavel_nome || cliente.responsavel_voxx_cs || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {briefing ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500">Sem briefing</span>
                        )}
                      </td>
                      <td className="px-4 py-3 min-w-[130px]">
                        <ScoreBar score={score} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {briefing?.updated_date
                          ? format(new Date(briefing.updated_date), 'dd/MM/yy')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant={briefing ? 'outline' : 'default'}
                          onClick={() => handleOpenBriefing({ cliente, briefing })}
                          className="text-xs h-7"
                        >
                          {briefing ? 'Editar' : <><Plus className="w-3 h-3 mr-1" /> Criar</>}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal de detalhe */}
      {selectedBriefing && selectedCliente && (
        <BriefingDetalheModal
          briefing={selectedBriefing}
          cliente={selectedCliente}
          user={user}
          onClose={() => { setSelectedBriefing(null); setSelectedCliente(null); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ['briefings'] })}
        />
      )}
    </div>
  );
}