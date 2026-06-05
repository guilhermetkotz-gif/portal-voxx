import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Upload, FileText, CheckCircle2, Loader2, Brain,
  MessageSquare, TrendingUp, Users, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import moment from 'moment';

const CLIMA_CONFIG = {
  otimo: { label: '😊 Ótimo', color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  bom: { label: '🙂 Bom', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  neutro: { label: '😐 Neutro', color: 'text-slate-400 bg-slate-700/50 border-slate-600/20' },
  tenso: { label: '😟 Tenso', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  critico: { label: '😡 Crítico', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

function AnaliseCard({ registro }) {
  const [expanded, setExpanded] = useState(false);
  const a = registro.analise_ia || {};
  const climaCfg = CLIMA_CONFIG[a.clima_relacional] || CLIMA_CONFIG.neutro;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-100">{registro.cliente_nome}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{registro.nome_arquivo}</p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {registro.data_inicio && moment(registro.data_inicio).format('DD/MM/YY')} →{' '}
              {registro.data_fim && moment(registro.data_fim).format('DD/MM/YY')} · {registro.total_mensagens?.toLocaleString()} msgs
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={`text-[10px] px-2 py-0 border ${climaCfg.color}`}>{climaCfg.label}</Badge>
            <button onClick={() => setExpanded(v => !v)} className="text-slate-500 hover:text-slate-300 transition-colors">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Métricas rápidas */}
        <div className="flex flex-wrap gap-3 mt-3">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Brain className="w-3 h-3 text-violet-400" />
            <span className="text-slate-400">Engajamento</span>
            <span className={`font-bold ${a.score_engajamento >= 70 ? 'text-green-400' : a.score_engajamento >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
              {a.score_engajamento ?? '—'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <TrendingUp className="w-3 h-3 text-blue-400" />
            <span className="text-slate-400">Satisfação</span>
            <span className={`font-bold ${a.score_satisfacao >= 70 ? 'text-green-400' : a.score_satisfacao >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
              {a.score_satisfacao ?? '—'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <MessageSquare className="w-3 h-3 text-slate-400" />
            <span className="text-slate-400">Leads/dia</span>
            <span className="text-slate-200 font-bold">{a.media_leads_dia ?? '—'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <CheckCircle2 className="w-3 h-3 text-green-400" />
            <span className="text-slate-400">Conversão</span>
            <span className="text-green-400 font-bold">{a.taxa_conversao_media != null ? `${a.taxa_conversao_media}%` : '—'}</span>
          </div>
        </div>

        {/* Resumo executivo */}
        {a.resumo_executivo && (
          <p className="mt-3 text-[12px] text-slate-400 leading-relaxed border-l-2 border-violet-500/40 pl-3">
            {a.resumo_executivo}
          </p>
        )}
      </div>

      {/* Detalhe expandido */}
      {expanded && (
        <div className="border-t border-slate-800 p-4 space-y-4">
          {a.pontos_positivos?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-green-400 mb-1.5">✅ Pontos Positivos</p>
              <ul className="space-y-1">
                {a.pontos_positivos.map((p, i) => (
                  <li key={i} className="text-[12px] text-slate-400 flex gap-2">
                    <span className="text-green-500 shrink-0">•</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {a.pontos_atencao?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-amber-400 mb-1.5">⚠️ Pontos de Atenção</p>
              <ul className="space-y-1">
                {a.pontos_atencao.map((p, i) => (
                  <li key={i} className="text-[12px] text-slate-400 flex gap-2">
                    <span className="text-amber-500 shrink-0">•</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {a.acoes_recomendadas?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-blue-400 mb-1.5">🚀 Ações Recomendadas</p>
              <ul className="space-y-1">
                {a.acoes_recomendadas.map((p, i) => (
                  <li key={i} className="text-[12px] text-slate-400 flex gap-2">
                    <span className="text-blue-500 shrink-0">{i + 1}.</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {a.principal_objecao && (
            <div>
              <p className="text-[11px] font-semibold text-red-400 mb-1">🚫 Principal Objeção dos Leads</p>
              <p className="text-[12px] text-slate-400">{a.principal_objecao}</p>
            </div>
          )}
          {a.principais_problemas?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-orange-400 mb-1.5">🔧 Problemas Recorrentes</p>
              <ul className="space-y-1">
                {a.principais_problemas.map((p, i) => (
                  <li key={i} className="text-[12px] text-slate-400 flex gap-2">
                    <span className="text-orange-500 shrink-0">•</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Participantes */}
          {registro.participantes?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 mb-1.5">
                <Users className="w-3 h-3 inline mr-1" /> Participantes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {registro.participantes.slice(0, 10).map((p, i) => (
                  <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    p.tipo === 'voxx' ? 'border-violet-500/30 text-violet-400 bg-violet-500/10' :
                    p.tipo === 'cliente' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' :
                    'border-slate-600 text-slate-500 bg-slate-800'
                  }`}>
                    {p.nome.length > 25 ? p.nome.substring(0, 25) + '...' : p.nome} ({p.total_mensagens})
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-[10px] text-slate-700 text-right">
            Importado por {registro.importado_por_nome} · {moment(registro.created_date).format('DD/MM/YY HH:mm')}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ImportarHistoricoWhatsapp({ user }) {
  const [clienteId, setClienteId] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [processando, setProcessando] = useState(false);
  const inputRef = useRef();

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientesImportacao'],
    queryFn: () => base44.entities.Cliente.filter({ status: 'ativo' }, 'nome', 200),
    staleTime: 60000
  });

  const { data: historicos = [], refetch } = useQuery({
    queryKey: ['historicosWhatsapp'],
    queryFn: () => base44.entities.HistoricoConversaWhatsapp.list('-created_date', 50),
    staleTime: 30000
  });

  const clienteSelecionado = clientes.find(c => c.id === clienteId);

  const handleArquivo = (e) => {
    const f = e.target.files[0];
    if (f && f.name.endsWith('.txt')) {
      setArquivo(f);
    } else {
      toast.error('Selecione um arquivo .txt exportado do WhatsApp');
    }
  };

  const handleImportar = async () => {
    if (!clienteId || !arquivo) {
      toast.error('Selecione o cliente e o arquivo .txt');
      return;
    }
    setProcessando(true);
    toast.info('Processando histórico e gerando análise com IA...');
    try {
      const texto = await arquivo.text();
      const res = await base44.functions.invoke('importarHistoricoWhatsapp', {
        cliente_id: clienteId,
        cliente_nome: clienteSelecionado?.nome || '',
        nome_arquivo: arquivo.name,
        conteudo_txt: texto
      });
      toast.success(`Análise concluída! ${res.data.total_mensagens?.toLocaleString()} mensagens processadas.`);
      refetch();
      setArquivo(null);
      setClienteId('');
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      toast.error('Erro ao importar: ' + err.message);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 lg:p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-green-500/10 border border-green-500/20">
            <MessageSquare className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Importar Histórico WhatsApp</h1>
            <p className="text-slate-500 text-sm">Importe o .txt exportado do WhatsApp para gerar análise com IA</p>
          </div>
        </div>

        {/* Card de importação */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <p className="text-sm font-medium text-slate-300">Nova importação</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] text-slate-500 mb-1.5">Cliente</p>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger className="h-9 text-sm bg-slate-800 border-slate-700 text-slate-200">
                  <SelectValue placeholder="Selecione o cliente..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200 max-h-64">
                  {clientes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-[11px] text-slate-500 mb-1.5">Arquivo .txt (exportado do WhatsApp)</p>
              <label className={`flex items-center gap-2 h-9 px-3 rounded-md border text-sm cursor-pointer transition-colors ${
                arquivo ? 'border-green-500/40 bg-green-500/10 text-green-400' : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
              }`}>
                <Upload className="w-4 h-4 shrink-0" />
                <span className="truncate">{arquivo ? arquivo.name : 'Selecionar arquivo...'}</span>
                <input ref={inputRef} type="file" accept=".txt" className="hidden" onChange={handleArquivo} />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              Exporte o histórico do grupo: Menu do grupo → Mais → Exportar conversa → Sem mídia
            </div>
            <Button
              size="sm"
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white shrink-0"
              onClick={handleImportar}
              disabled={processando || !clienteId || !arquivo}
            >
              {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {processando ? 'Analisando...' : 'Importar e Analisar'}
            </Button>
          </div>
        </div>

        {/* Históricos importados */}
        {historicos.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Análises importadas ({historicos.length})
            </p>
            {historicos.map(h => (
              <AnaliseCard key={h.id} registro={h} />
            ))}
          </div>
        )}

        {historicos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-slate-500 text-sm">Nenhum histórico importado ainda</p>
            <p className="text-slate-700 text-xs mt-1">Importe um arquivo .txt do WhatsApp para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}