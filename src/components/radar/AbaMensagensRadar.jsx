import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, RefreshCw, X, Loader2, Zap, AlertTriangle, Clock, Bell, MoonStar, WifiOff, Tag } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import moment from 'moment';
import 'moment-timezone';
import { useQueryClient } from '@tanstack/react-query';

const TZ = 'America/Sao_Paulo';

function formatarDataRelativa(ts) {
  if (!ts) return '—';
  const m = moment(ts).tz(TZ);
  const agora = moment().tz(TZ);
  const inicioHoje = agora.clone().startOf('day');
  const inicioOntem = inicioHoje.clone().subtract(1, 'day');
  const inicioSemana = inicioHoje.clone().subtract(6, 'days');

  if (m.isAfter(inicioHoje)) return m.format('HH:mm');
  if (m.isAfter(inicioOntem)) return 'Ontem';
  if (m.isAfter(inicioSemana)) return m.format('dddd');
  return m.format('DD/MM');
}

const ORIGEM_CONFIG = {
  recebida:    { label: 'Cliente',    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  enviada:     { label: 'VOXX',       color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  sistema:     { label: 'Sistema',    color: 'bg-slate-700 text-slate-400 border-slate-600' },
  desconhecida:{ label: 'Desconhecido', color: 'bg-slate-700 text-slate-500 border-slate-600' },
};

const TIPO_COLORS = {
  texto:     'bg-slate-700 text-slate-300 border-slate-600',
  imagem:    'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  video:     'bg-purple-500/20 text-purple-400 border-purple-500/30',
  audio:     'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  documento: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  sticker:   'bg-pink-500/20 text-pink-400 border-pink-500/30',
  sistema:   'bg-slate-700 text-slate-500 border-slate-600',
};

const ALERT_CONFIG_MSGS = {
  emergencial: { label: 'Emergencial', color: 'bg-red-500/20 text-red-400 border-red-500/30',       icon: Zap },
  critico:     { label: 'Crítico',     color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: AlertTriangle },
  alerta:      { label: 'Alerta',      color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
  alarme:      { label: '+15min',      color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',    icon: Bell },
};

// Mapa rápido de grupo_id → dados enriquecidos
function buildGrupoMap(gruposEnriquecidos) {
  if (!gruposEnriquecidos || gruposEnriquecidos.length === 0) return {};
  const map = {};
  gruposEnriquecidos.forEach(g => {
    if (g.grupo_id) map[g.grupo_id] = g;
  });
  return map;
}

export default function AbaMensagensRadar({ mensagens, clientes, loading, gruposEnriquecidos, tagGrupoIds, usuarioIdAtual }) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [filtroOrigem, setFiltroOrigem] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroEspecial, setFiltroEspecial] = useState('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('7d');

  const periodoCorte = useMemo(() => {
    const dias = { '1d': 1, '7d': 7, '30d': 30 };
    return moment().tz(TZ).subtract(dias[filtroPeriodo] || 7, 'days').toISOString();
  }, [filtroPeriodo]);

  // Mapa de prioridade por grupo_id (ordem do Radar WhatsApp)
  const prioridadePorGrupo = useMemo(() => {
    if (!gruposEnriquecidos || gruposEnriquecidos.length === 0) return {};
    const map = {};
    gruposEnriquecidos.forEach(g => {
      if (g.grupo_id) {
        // ordem invertida: 1=emergencial (mais urgente) → aparece primeiro
        map[g.grupo_id] = g.ordem ?? 99;
      }
    });
    return map;
  }, [gruposEnriquecidos]);

  const filtrados = useMemo(() => {
    const resultado = mensagens.filter(m => {
      const ts = m.received_at || m.timestamp_mensagem;
      if (ts < periodoCorte) return false;
      if (filtroOrigem !== 'todos' && m.origem !== filtroOrigem) return false;
      if (filtroTipo !== 'todos' && m.tipo_mensagem !== filtroTipo) return false;
      if (filtroEspecial === 'sem_cliente' && m.cliente_id) return false;
      if (filtroEspecial === 'erro' && m.status_processamento !== 'erro') return false;
      if (filtroEspecial === 'voxx' && m.remetente_tipo !== 'voxx' && m.origem !== 'enviada') return false;
      if (filtroEspecial === 'cliente' && m.remetente_tipo !== 'cliente' && m.origem !== 'recebida') return false;
      if (filtroEspecial === 'aguard_retorno' && (!m.grupo_id || !tagGrupoIds?.has(m.grupo_id))) return false;


      if (busca) {
        const b = busca.toLowerCase();
        const match = m.cliente_nome?.toLowerCase().includes(b) ||
          m.grupo_nome?.toLowerCase().includes(b) ||
          m.remetente_nome?.toLowerCase().includes(b) ||
          m.remetente_telefone?.includes(b) ||
          m.mensagem?.toLowerCase().includes(b);
        if (!match) return false;
      }
      return true;
    });

    // Ordenar: prioridade do grupo (alertas primeiro), depois data decrescente
    return resultado.sort((a, b) => {
      const pa = prioridadePorGrupo[a.grupo_id] ?? 99;
      const pb = prioridadePorGrupo[b.grupo_id] ?? 99;
      if (pa !== pb) return pa - pb;
      const ta = a.received_at || a.timestamp_mensagem || '';
      const tb = b.received_at || b.timestamp_mensagem || '';
      return tb.localeCompare(ta);
    });
  }, [mensagens, busca, filtroOrigem, filtroTipo, filtroEspecial, periodoCorte, prioridadePorGrupo, tagGrupoIds, usuarioIdAtual]);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
          <Input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)}
            className="pl-8 w-52 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm" />
          {busca && <button onClick={() => setBusca('')} className="absolute right-2.5 top-2.5 text-slate-500"><X className="w-3.5 h-3.5" /></button>}
        </div>

        <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
          <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-slate-100 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="todos">Todas origens</SelectItem>
            <SelectItem value="recebida">Recebida</SelectItem>
            <SelectItem value="enviada">Enviada</SelectItem>
            <SelectItem value="sistema">Sistema</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-slate-100 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="todos">Todos tipos</SelectItem>
            <SelectItem value="texto">Texto</SelectItem>
            <SelectItem value="imagem">Imagem</SelectItem>
            <SelectItem value="audio">Áudio</SelectItem>
            <SelectItem value="video">Vídeo</SelectItem>
            <SelectItem value="documento">Documento</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroEspecial} onValueChange={setFiltroEspecial}>
          <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-slate-100 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="sem_cliente">Sem cliente</SelectItem>
            <SelectItem value="voxx">Somente VOXX</SelectItem>
            <SelectItem value="cliente">Somente cliente</SelectItem>
            <SelectItem value="aguard_retorno">AGUARD. RETORNO</SelectItem>
            <SelectItem value="erro">Com erro</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
          <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-slate-100 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="1d">Hoje</SelectItem>
            <SelectItem value="7d">7 dias</SelectItem>
            <SelectItem value="30d">30 dias</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-slate-500">{filtrados.length} mensagens</span>
        <Button size="sm" variant="ghost" onClick={() => queryClient.invalidateQueries({ queryKey: ['radarMensagens'] })}
          className="text-slate-400 hover:text-white gap-1">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Tabela */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <ScrollArea className="h-[560px]">
          <table className="w-full text-xs">
            <thead className="border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <tr>
                <th className="text-left px-2 py-3 text-slate-500 font-medium w-8"></th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Data/hora</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Cliente</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Grupo</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Remetente</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Telefone</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Origem</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Tipo</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Mensagem</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-emerald-400" /></td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">Nenhuma mensagem encontrada.</td></tr>
              ) : (
                filtrados.map(m => {
                  const ts = m.received_at || m.timestamp_mensagem;
                  const origemCfg = ORIGEM_CONFIG[m.origem] || ORIGEM_CONFIG.desconhecida;
                  const tipoCor = TIPO_COLORS[m.tipo_mensagem] || TIPO_COLORS.texto;
                  const grupoMap = buildGrupoMap(gruposEnriquecidos);
                  const grupoInfo = m.grupo_id ? grupoMap[m.grupo_id] : null;
                  const alerta = grupoInfo?.alertaNivel ? ALERT_CONFIG_MSGS[grupoInfo.alertaNivel] : null;
                  const AlertIcon = alerta?.icon;
                  const isEmergencial = grupoInfo?.alertaNivel === 'emergencial';
                  const isCritico     = grupoInfo?.alertaNivel === 'critico';
                  const isAlerta      = grupoInfo?.alertaNivel === 'alerta';
                  const isAlarme      = grupoInfo?.alertaNivel === 'alarme';
                  const isInativo72   = grupoInfo?.inativo72h;
                  return (
                    <tr key={m.id} className={`border-b border-slate-800/50 hover:bg-slate-800/20 ${
                      isEmergencial ? 'bg-red-950/20' :
                      isCritico     ? 'bg-orange-950/20' :
                      isAlerta      ? 'bg-yellow-950/10' :
                      isAlarme      ? 'bg-amber-950/10' :
                      isInativo72   ? 'bg-purple-950/10' : ''
                    }`}>
                      <td className="px-2 py-2.5">
                        {alerta
                          ? <Badge className={`text-[10px] border p-1 flex items-center justify-center ${alerta.color}`} title={alerta.label}><AlertIcon className="w-3 h-3" /></Badge>
                          : isInativo72
                            ? <Badge className="text-[10px] border p-1 flex items-center justify-center bg-purple-500/20 text-purple-400 border-purple-500/30" title="Inativo 72h+"><MoonStar className="w-3 h-3" /></Badge>
                            : m.grupo_id && tagGrupoIds?.has(m.grupo_id)
                              ? <Badge className="text-[10px] border p-1 flex items-center justify-center bg-cyan-500/20 text-cyan-400 border-cyan-500/30" title="AGUARD. RETORNO"><Tag className="w-3 h-3" /></Badge>
                              : grupoInfo?.status_vinculo === 'nao_vinculado'
                                ? <Badge className="text-[10px] border p-1 flex items-center justify-center bg-slate-700/40 text-slate-400 border-slate-600" title="Sem vínculo"><WifiOff className="w-3 h-3" /></Badge>
                                : null
                        }
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                        {formatarDataRelativa(ts)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-200 font-medium">
                        {m.cliente_nome || <span className="text-amber-500/70 italic text-[11px]">Sem vínculo</span>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 max-w-[120px] truncate" title={m.grupo_nome}>{m.grupo_nome || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-300">{m.remetente_nome || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500 font-mono">{m.remetente_telefone || '—'}</td>
                      <td className="px-3 py-2.5">
                        <Badge className={`text-[10px] border ${origemCfg.color}`}>{origemCfg.label}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge className={`text-[10px] border ${tipoCor}`}>{m.tipo_mensagem || 'texto'}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-slate-300 max-w-[220px] truncate" title={m.mensagem}>{m.mensagem}</td>
                      <td className="px-3 py-2.5">
                        {m.status_processamento === 'erro'
                          ? <Badge className="text-[10px] border bg-red-500/20 text-red-400 border-red-500/30">Erro</Badge>
                          : m.status_processamento === 'sem_vinculo'
                            ? <Badge className="text-[10px] border bg-amber-500/20 text-amber-400 border-amber-500/30">Sem vínculo</Badge>
                            : <Badge className="text-[10px] border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">OK</Badge>
                        }
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </ScrollArea>
      </div>
    </div>
  );
}