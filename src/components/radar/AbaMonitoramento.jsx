import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Eye, AlertTriangle, Zap, Clock, CheckCircle, WifiOff, Filter } from 'lucide-react';
import moment from 'moment';
import 'moment-timezone';
import GrupoDetalheDrawer from './GrupoDetalheDrawer';

const TZ = 'America/Sao_Paulo';

const ALERT_CONFIG = {
  emergencial: { label: 'Emergencial', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: Zap },
  critico:     { label: 'Crítico',     color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: AlertTriangle },
  alerta:      { label: 'Alerta',      color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
};

const VINCULO_CONFIG = {
  vinculado:              { label: 'Vinculado',        color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  nao_vinculado:          { label: 'Não vinculado',    color: 'bg-slate-600/40 text-slate-400 border-slate-600' },
  possivel_correspondencia:{ label: 'Possível',        color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  inativo:                { label: 'Inativo',          color: 'bg-slate-700/40 text-slate-500 border-slate-700' },
};

function tempoFormatado(minutos) {
  if (!minutos) return null;
  if (minutos >= 60) return `${Math.floor(minutos / 60)}h${minutos % 60 > 0 ? `${minutos % 60}m` : ''}`;
  return `${minutos}m`;
}

function DataHora({ ts }) {
  if (!ts) return <span className="text-slate-600">—</span>;
  const m = moment(ts).tz(TZ);
  const hoje = moment().tz(TZ).startOf('day');
  if (m.isAfter(hoje)) return <span className="text-slate-300">{m.format('HH:mm')}</span>;
  return <span className="text-slate-400">{m.format('DD/MM HH:mm')}</span>;
}

export default function AbaMonitoramento({ gruposEnriquecidos, clientes, loading }) {
  const [busca, setBusca] = useState('');
  const [filtroVinculo, setFiltroVinculo] = useState('todos');
  const [filtroAlerta, setFiltroAlerta] = useState('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('7d');
  const [grupoSelecionado, setGrupoSelecionado] = useState(null);

  const periodoCorte = useMemo(() => {
    const m = { '1d': 1, '7d': 7, '30d': 30 };
    return moment().tz(TZ).subtract(m[filtroPeriodo] || 7, 'days').toISOString();
  }, [filtroPeriodo]);

  const filtrados = useMemo(() => {
    return gruposEnriquecidos.filter(g => {
      if (busca) {
        const b = busca.toLowerCase();
        if (!g.nome_grupo?.toLowerCase().includes(b) && !g.cliente_nome?.toLowerCase().includes(b) && !g.grupo_id?.toLowerCase().includes(b)) return false;
      }
      if (filtroVinculo !== 'todos' && g.status_vinculo !== filtroVinculo) return false;
      if (filtroAlerta === 'com_alerta' && !g.alertaNivel) return false;
      if (filtroAlerta === 'sem_resposta' && !g.alertaNivel) return false;
      if (filtroAlerta === 'saudaveis' && g.alertaNivel) return false;
      if (filtroAlerta === 'emergencial' && g.alertaNivel !== 'emergencial') return false;
      if (filtroAlerta === 'critico' && g.alertaNivel !== 'critico') return false;
      return true;
    });
  }, [gruposEnriquecidos, busca, filtroVinculo, filtroAlerta, periodoCorte]);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Buscar grupo ou cliente..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-8 w-52 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm"
          />
        </div>

        <Select value={filtroVinculo} onValueChange={setFiltroVinculo}>
          <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-slate-100 text-sm">
            <SelectValue placeholder="Vínculo" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="vinculado">Vinculados</SelectItem>
            <SelectItem value="nao_vinculado">Não vinculados</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroAlerta} onValueChange={setFiltroAlerta}>
          <SelectTrigger className="w-44 bg-slate-800 border-slate-700 text-slate-100 text-sm">
            <SelectValue placeholder="Alerta" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="com_alerta">Com alerta</SelectItem>
            <SelectItem value="emergencial">Emergencial</SelectItem>
            <SelectItem value="critico">Crítico</SelectItem>
            <SelectItem value="saudaveis">Saudáveis</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
          <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-slate-100 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="1d">Hoje</SelectItem>
            <SelectItem value="7d">7 dias</SelectItem>
            <SelectItem value="30d">30 dias</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-slate-500 ml-auto">{filtrados.length} grupos</span>
      </div>

      {/* Tabela */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-slate-800">
              <tr>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Cliente / Grupo</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Vínculo</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Msgs hoje</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Última mensagem</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Últ. Cliente</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Últ. VOXX</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Sem resposta</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Alerta</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">Carregando...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">Nenhum grupo encontrado.</td></tr>
              ) : (
                filtrados.map(g => {
                  const alerta = g.alertaNivel ? ALERT_CONFIG[g.alertaNivel] : null;
                  const vinculo = VINCULO_CONFIG[g.status_vinculo] || VINCULO_CONFIG.nao_vinculado;
                  const AlertIcon = alerta?.icon;
                  return (
                    <tr
                      key={g.id}
                      className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${g.alertaNivel === 'emergencial' ? 'bg-red-950/20' : g.alertaNivel === 'critico' ? 'bg-orange-950/20' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white text-sm">{g.cliente_nome || <span className="text-slate-500 italic">Sem cliente</span>}</div>
                        <div className="text-slate-500 text-[11px] mt-0.5">{g.nome_grupo}</div>
                        {g.ultimaGeral?.mensagem && (
                          <div className="text-slate-400 text-[11px] mt-1 max-w-[220px] truncate">{g.ultimaGeral.mensagem}</div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge className={`text-[10px] border ${vinculo.color}`}>{vinculo.label}</Badge>
                      </td>
                      <td className="px-3 py-3 text-slate-300 font-medium">{g.msgsHoje || '—'}</td>
                      <td className="px-3 py-3"><DataHora ts={g.ultimaGeral?.received_at} /></td>
                      <td className="px-3 py-3"><DataHora ts={g.ultimaCliente?.received_at} /></td>
                      <td className="px-3 py-3"><DataHora ts={g.ultimaVoxx?.received_at} /></td>
                      <td className="px-3 py-3">
                        {g.minutosSemResposta > 0
                          ? <span className={alerta ? `font-semibold ${alerta.color.split(' ')[1]}` : 'text-slate-400'}>{tempoFormatado(g.minutosSemResposta)}</span>
                          : <span className="text-slate-600">—</span>
                        }
                      </td>
                      <td className="px-3 py-3">
                        {alerta
                          ? <Badge className={`text-[10px] border gap-1 flex items-center ${alerta.color}`}><AlertIcon className="w-2.5 h-2.5" />{alerta.label}</Badge>
                          : g.status_vinculo === 'nao_vinculado'
                            ? <Badge className="text-[10px] border bg-slate-700/40 text-slate-400 border-slate-600"><WifiOff className="w-2.5 h-2.5 inline mr-1" />Sem vínculo</Badge>
                            : <Badge className="text-[10px] border bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><CheckCircle className="w-2.5 h-2.5 inline mr-1" />OK</Badge>
                        }
                      </td>
                      <td className="px-3 py-3">
                        <Button size="sm" variant="ghost" onClick={() => setGrupoSelecionado(g)}
                          className="text-slate-400 hover:text-white hover:bg-slate-700 text-[11px] gap-1 h-7 px-2">
                          <Eye className="w-3 h-3" /> Detalhes
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer de detalhe */}
      {grupoSelecionado && (
        <GrupoDetalheDrawer
          grupo={grupoSelecionado}
          clientes={clientes}
          onClose={() => setGrupoSelecionado(null)}
        />
      )}
    </div>
  );
}