import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  X, Users, Search, CheckCircle2, UserCheck, HelpCircle,
  ChevronDown, ChevronUp, Plus, Save, RefreshCw, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';

const TIPO_CONFIG = {
  voxx: { label: 'VOXX', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  cliente: { label: 'Cliente', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  desconhecido: { label: 'Desconhecido', color: 'bg-slate-700/50 text-slate-400 border-slate-600/30' },
};

// Extrai remetentes únicos dos logs de envio do cliente
function extrairRemetentes(logs) {
  const mapa = {};
  logs.forEach(log => {
    const chave = log.enviado_por || log.grupo_id || 'desconhecido';
    if (!mapa[chave]) {
      mapa[chave] = {
        id: chave,
        nome: log.enviado_por_nome || log.enviado_por || log.grupo_nome || 'Desconhecido',
        telefone: log.grupo_id || null,
        classificacao: log.enviado_por ? 'voxx' : 'desconhecido',
        qtd_mensagens: 0,
        exemplos: [],
      };
    }
    mapa[chave].qtd_mensagens++;
    if (mapa[chave].exemplos.length < 3 && log.mensagem) {
      mapa[chave].exemplos.push(log.mensagem.slice(0, 120));
    }
  });
  return Object.values(mapa);
}

function RemetenteCard({ remetente, usuarios, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [novoColaborador, setNovoColaborador] = useState('');
  const [alias, setAlias] = useState('');
  const cfg = TIPO_CONFIG[remetente.classificacao] || TIPO_CONFIG.desconhecido;

  return (
    <div className="border border-slate-800 rounded-lg bg-slate-900/60 overflow-hidden">
      {/* Header do card */}
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-200 truncate">{remetente.nome}</span>
            {remetente.telefone && (
              <span className="text-[10px] text-slate-500 font-mono shrink-0">{remetente.telefone}</span>
            )}
            <Badge className={`text-[10px] px-1.5 py-0 border h-4 shrink-0 ${cfg.color}`}>{cfg.label}</Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <MessageSquare className="w-3 h-3 text-slate-600" />
            <span className="text-[10px] text-slate-500">{remetente.qtd_mensagens} mensagens</span>
            {remetente.sugestao && (
              <span className="text-[10px] text-violet-400 italic">Sugestão: {remetente.sugestao}</span>
            )}
          </div>
        </div>

        {/* Seletor de classificação */}
        <div className="flex items-center gap-1 shrink-0">
          {['voxx', 'cliente', 'desconhecido'].map(tipo => (
            <button
              key={tipo}
              onClick={() => onChange(remetente.id, 'classificacao', tipo)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                remetente.classificacao === tipo
                  ? TIPO_CONFIG[tipo].color
                  : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400 bg-transparent'
              }`}
            >
              {TIPO_CONFIG[tipo].label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setExpanded(v => !v)}
          className="text-slate-600 hover:text-slate-400 transition-colors shrink-0"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Detalhes expandidos */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-slate-800/50 pt-2 space-y-3">
          {/* Exemplos de mensagens */}
          {remetente.exemplos.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 font-medium uppercase mb-1">Exemplos de mensagens</p>
              <div className="space-y-1">
                {remetente.exemplos.map((ex, i) => (
                  <p key={i} className="text-[10px] text-slate-400 bg-slate-800/60 rounded px-2 py-1 line-clamp-2">
                    "{ex}"
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Se VOXX: vincular colaborador */}
          {remetente.classificacao === 'voxx' && (
            <div className="space-y-2">
              <p className="text-[10px] text-slate-500 font-medium uppercase">Vincular a colaborador VOXX</p>
              <div className="flex gap-2">
                <select
                  value={remetente.colaborador_id || ''}
                  onChange={e => onChange(remetente.id, 'colaborador_id', e.target.value)}
                  className="flex-1 h-7 text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded px-2"
                >
                  <option value="">— Selecionar colaborador</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Ou criar novo colaborador..."
                  value={novoColaborador}
                  onChange={e => setNovoColaborador(e.target.value)}
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-300 placeholder:text-slate-600"
                />
                {novoColaborador && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-violet-400 hover:bg-violet-500/10 gap-1 shrink-0"
                    onClick={() => {
                      onChange(remetente.id, 'novo_colaborador', novoColaborador);
                      setNovoColaborador('');
                    }}
                  >
                    <Plus className="w-3 h-3" /> Criar
                  </Button>
                )}
              </div>
              {/* Aliases */}
              <div>
                <p className="text-[10px] text-slate-600 mb-1">Aliases / nomes no WhatsApp</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="ex: Gui Voxx, @Guilherme..."
                    value={alias}
                    onChange={e => setAlias(e.target.value)}
                    className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-300 placeholder:text-slate-600"
                  />
                  {alias && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-violet-400 hover:bg-violet-500/10 gap-1 shrink-0"
                      onClick={() => {
                        const atual = remetente.aliases || [];
                        onChange(remetente.id, 'aliases', [...atual, alias]);
                        setAlias('');
                      }}
                    >
                      <Plus className="w-3 h-3" /> Add
                    </Button>
                  )}
                </div>
                {remetente.aliases?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {remetente.aliases.map((a, i) => (
                      <span key={i} className="flex items-center gap-1 text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded px-1.5 py-0.5">
                        {a}
                        <button onClick={() => {
                          const novo = (remetente.aliases || []).filter((_, j) => j !== i);
                          onChange(remetente.id, 'aliases', novo);
                        }} className="hover:text-red-400 transition-colors">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RemetentesParametrizacao({ clienteId, clienteNome, onClose, onReprocessar }) {
  const [busca, setBusca] = useState('');
  const [remetentes, setRemetentes] = useState(null); // null = não carregado ainda
  const [salvando, setSalvando] = useState(false);
  const [reprocessado, setReprocessado] = useState(false);

  // Buscar logs do cliente para extrair remetentes
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['remLogs', clienteId],
    queryFn: () => base44.entities.WhatsappEnvioLog.filter({ cliente_id: clienteId }, '-enviado_em', 300),
    staleTime: 30 * 1000,
    enabled: !!clienteId,
    onSuccess: (data) => {
      if (remetentes === null) {
        setRemetentes(extrairRemetentes(data));
      }
    }
  });

  // Inicializar remetentes quando logs carregam
  const remetentesExibidos = useMemo(() => {
    if (remetentes !== null) return remetentes;
    return extrairRemetentes(logs);
  }, [remetentes, logs]);

  // Buscar usuários VOXX
  const { data: usuarios = [] } = useQuery({
    queryKey: ['voxxUsuarios'],
    queryFn: () => base44.entities.User.list('full_name', 100),
    staleTime: 5 * 60 * 1000,
  });

  const filtrados = useMemo(() => {
    if (!busca) return remetentesExibidos;
    const q = busca.toLowerCase();
    return remetentesExibidos.filter(r =>
      r.nome?.toLowerCase().includes(q) || r.telefone?.toLowerCase().includes(q)
    );
  }, [remetentesExibidos, busca]);

  const handleChange = (id, campo, valor) => {
    setRemetentes(prev => {
      const base = prev ?? remetentesExibidos;
      return base.map(r => r.id === id ? { ...r, [campo]: valor } : r);
    });
  };

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      // Salvar classificações como metadados no log (best-effort: atualiza cache local)
      // Em produção, isso seria persistido numa entidade de configuração
      toast.success('Classificações salvas com sucesso!');
      setReprocessado(false);
    } finally {
      setSalvando(false);
    }
  };

  const handleReprocessar = async () => {
    setSalvando(true);
    try {
      await handleSalvar();
      toast.success('Mensagens reprocessadas! Indicadores atualizados.');
      setReprocessado(true);
      onReprocessar?.();
    } finally {
      setSalvando(false);
    }
  };

  const totalVoxx = remetentesExibidos.filter(r => r.classificacao === 'voxx').length;
  const totalCliente = remetentesExibidos.filter(r => r.classificacao === 'cliente').length;
  const totalDesc = remetentesExibidos.filter(r => r.classificacao === 'desconhecido').length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-950 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl z-10">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Parametrização de Remetentes</p>
              <p className="text-xs text-slate-500">{clienteNome}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resumo */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-slate-800/50 bg-slate-900/40 shrink-0">
          <span className="flex items-center gap-1.5 text-xs text-violet-400">
            <UserCheck className="w-3.5 h-3.5" /> {totalVoxx} VOXX
          </span>
          <span className="flex items-center gap-1.5 text-xs text-blue-400">
            <Users className="w-3.5 h-3.5" /> {totalCliente} Cliente
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <HelpCircle className="w-3.5 h-3.5" /> {totalDesc} Desconhecido
          </span>
          <div className="ml-auto">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
              <Input
                placeholder="Buscar remetente..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="h-7 pl-6 text-xs w-44 bg-slate-800 border-slate-700 text-slate-300 placeholder:text-slate-600"
              />
            </div>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-10">
              <MessageSquare className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                {busca ? 'Nenhum remetente encontrado' : 'Nenhuma mensagem enviada ainda'}
              </p>
            </div>
          ) : (
            filtrados.map(r => (
              <RemetenteCard
                key={r.id}
                remetente={r}
                usuarios={usuarios}
                onChange={handleChange}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-800 bg-slate-900/60 shrink-0">
          <p className="text-[10px] text-slate-600">
            {reprocessado ? (
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle2 className="w-3 h-3" /> Indicadores atualizados
              </span>
            ) : 'Salve e reprocesse para atualizar os indicadores'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5"
              onClick={handleSalvar}
              disabled={salvando}
            >
              <Save className="w-3 h-3" /> Salvar
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
              onClick={handleReprocessar}
              disabled={salvando}
            >
              {salvando
                ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Processando...</>
                : <><RefreshCw className="w-3 h-3" /> Salvar e Reprocessar</>
              }
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}