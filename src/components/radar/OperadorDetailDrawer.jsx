import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Star, Clock, AlertTriangle, Users, MessageSquare, Target, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import MensagensCriticasSection from './MensagensCriticasSection';

const CLASS_COLORS = {
  excelente: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  bom: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  atencao: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  critico: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  emergencial: 'bg-red-500/15 text-red-400 border-red-500/25',
};

function normalizarTel(tel) {
  return (tel || '').replace(/\D/g, '');
}

function Secao({ titulo, icon: Icon, children }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{titulo}</h4>
      </div>
      {children}
    </div>
  );
}

function ItemMetrica({ label, value, destaque }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-800/40 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xs font-mono font-semibold ${destaque || 'text-white'}`}>{value ?? '—'}</span>
    </div>
  );
}

export default function OperadorDetailDrawer({ open, onClose, operador, periodoInicio, periodoFim }) {
  const telNormalizado = operador ? normalizarTel(operador.telefone_normalizado) : '';

  const { data: msgsData, isLoading: loadingMsgs } = useQuery({
    queryKey: ['opMsgs', telNormalizado, periodoInicio, periodoFim],
    queryFn: async () => {
      const msgs = await base44.entities.WhatsappMensagem.filter(
        { remetente_tipo: 'voxx' }, '-received_at', 500
      );
      const nomeOp = (operador?.nome || '').toUpperCase();
      return msgs.filter(m => {
        // Backend usa received_at (timestamp_mensagem pode estar corrompido)
        const ts = m.received_at || m.timestamp_mensagem;
        if (!ts || ts < periodoInicio || ts > periodoFim) return false;
        // Match exato por telefone, ou por nome (mapa reverso do backend)
        if (normalizarTel(m.remetente_telefone) === telNormalizado) return true;
        if (nomeOp && m.remetente_nome && m.remetente_nome.toUpperCase().includes(nomeOp)) return true;
        return false;
      });
    },
    enabled: open && !!telNormalizado,
    staleTime: 30 * 1000,
  });

  // Buscar avaliações pelos IDs das mensagens do operador no período
  // (mesma lógica do backend: avaliação ↔ mensagem via whatsapp_mensagem_id)
  // Evita depender de remetente_telefone (que é o telefone da mensagem, pode diferir)
  // e de timestamp_mensagem (que pode estar corrompido)
  const msgIds = (msgsData || []).map(m => m.id);

  const { data: avaliacoes = [] } = useQuery({
    queryKey: ['opAvals', telNormalizado, periodoInicio, periodoFim, msgIds],
    queryFn: async () => {
      if (!msgIds.length) return [];
      const all = [];
      const CHUNK = 30;
      for (let i = 0; i < msgIds.length; i += CHUNK) {
        const chunk = msgIds.slice(i, i + CHUNK);
        const lote = await base44.entities.WhatsappAvaliacaoMensagemVoxx.filter(
          { whatsapp_mensagem_id: { $in: chunk } }, '-avaliado_em', 500
        );
        all.push(...lote);
      }
      return all;
    },
    enabled: open && !!telNormalizado && msgIds.length > 0,
    staleTime: 30 * 1000,
  });

  const [showCriticas, setShowCriticas] = useState(false);

  if (!operador) return null;

  const mensagensRecentes = (msgsData || []).slice(0, 20);
  // Já escopadas às mensagens do operador no período (via whatsapp_mensagem_id)
  const avalsRecentes = avaliacoes;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="bg-slate-950 border-l border-slate-800 text-white w-full sm:max-w-lg overflow-hidden flex flex-col">
        <SheetHeader className="border-b border-slate-800 pb-4 mb-0">
          <SheetTitle className="text-white text-lg">{operador.nome}</SheetTitle>
          <p className="text-slate-400 text-xs font-mono">{operador.telefone}</p>
        </SheetHeader>

        <ScrollArea className="flex-1 px-1">
          <div className="pr-4 pt-4 pb-6 space-y-1">
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-center">
                <p className="text-2xl font-bold text-white">{operador.score_geral}</p>
                <p className="text-[10px] text-slate-500">Score geral</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-center">
                <Badge className={`text-[10px] border ${CLASS_COLORS[operador.classificacao] || CLASS_COLORS.atencao}`}>
                  {operador.classificacao}
                </Badge>
                <p className="text-[10px] text-slate-500 mt-1">Classificação</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-center">
                <p className="text-2xl font-bold text-white">{operador.mensagens_enviadas}</p>
                <p className="text-[10px] text-slate-500">Mensagens</p>
              </div>
            </div>

            {/* Tempo de Resposta */}
            <Secao titulo="Tempo de Resposta" icon={Clock}>
              <ItemMetrica label="Primeiras respostas" value={operador.primeiras_respostas} />
              <ItemMetrica label="Tempo médio" value={operador.tempo_medio_resposta != null ? `${operador.tempo_medio_resposta} min` : '—'} />
              <ItemMetrica label="Tempo mediano" value={operador.tempo_mediano_resposta != null ? `${operador.tempo_mediano_resposta} min` : '—'} />
              <ItemMetrica label="Maior atraso" value={operador.maior_atraso != null ? `${operador.maior_atraso} min` : '—'} />
              <ItemMetrica label="% dentro do SLA" value={operador.pct_dentro_sla != null ? `${operador.pct_dentro_sla}%` : '—'}
                destaque={operador.pct_dentro_sla != null && operador.pct_dentro_sla < 80 ? 'text-red-400' : 'text-emerald-400'} />
              <ItemMetrica label="Dentro do SLA (0-14min)" value={operador.respostas_dentro_sla} />
              <ItemMetrica label="Atenção (15-29min)" value={operador.respostas_atencao} />
              <ItemMetrica label="Alerta (30-59min)" value={operador.respostas_alerta} />
              <ItemMetrica label="Crítico (60-119min)" value={operador.respostas_criticas_tempo} />
              <ItemMetrica label="Emergencial (120+min)" value={operador.respostas_emergenciais} />
            </Secao>

            {/* Qualidade */}
            <Secao titulo="Qualidade" icon={Star}>
              <ItemMetrica label="Score médio" value={operador.score_medio_qualidade != null ? operador.score_medio_qualidade : '—'} />
              <ItemMetrica label="Mensagens avaliadas" value={operador.mensagens_avaliadas} />
              <ItemMetrica label="Avaliações pendentes" value={operador.avaliacoes_pendentes}
                destaque={operador.avaliacoes_pendentes > 0 ? 'text-amber-400' : undefined} />
              <ItemMetrica label="Excelentes" value={operador.mensagens_excelentes} />
              <ItemMetrica label="Boas" value={operador.mensagens_boas} />
              <ItemMetrica label="Atenção" value={operador.mensagens_atencao} />
              <ItemMetrica label="Fracas" value={operador.mensagens_fracas} />
              {operador.mensagens_criticas > 0 ? (
                <button
                  onClick={() => setShowCriticas(!showCriticas)}
                  className="flex items-center justify-between w-full py-1.5 border-b border-slate-800/40 last:border-0 hover:bg-red-500/5 -mx-1 px-1 rounded transition-colors group"
                >
                  <span className="text-xs text-slate-400 flex items-center gap-1 group-hover:text-red-300">
                    {showCriticas
                      ? <ChevronDown className="w-3 h-3" />
                      : <ChevronRight className="w-3 h-3" />}
                    Críticas
                  </span>
                  <span className="text-xs font-mono font-semibold text-red-400">{operador.mensagens_criticas}</span>
                </button>
              ) : (
                <ItemMetrica label="Críticas" value={0} />
              )}
            </Secao>

            {/* Resolutividade */}
            <Secao titulo="Resolutividade" icon={Target}>
              <ItemMetrica label="Com próximo passo" value={operador.com_proximo_passo} />
              <ItemMetrica label="Sem próximo passo" value={operador.sem_proximo_passo}
                destaque={operador.sem_proximo_passo > 0 ? 'text-amber-400' : undefined} />
              <ItemMetrica label="Respostas vagas" value={operador.respostas_vagas}
                destaque={operador.respostas_vagas > 0 ? 'text-amber-400' : undefined} />
            </Secao>

            {/* Risco */}
            <Secao titulo="Risco" icon={Shield}>
              <ItemMetrica label="Com risco de ruído" value={operador.com_risco_ruido}
                destaque={operador.com_risco_ruido > 0 ? 'text-red-400' : undefined} />
              <ItemMetrica label="Respostas defensivas" value={operador.respostas_defensivas} />
              <ItemMetrica label="Respostas muito curtas" value={operador.respostas_muito_curtas} />
            </Secao>

            {/* Mensagens Críticas — Análise e Orientação */}
            {showCriticas && (
              <Secao titulo="Mensagens Críticas — Análise e Orientação" icon={AlertTriangle}>
                <MensagensCriticasSection avaliacoes={avalsRecentes} />
              </Secao>
            )}

            {/* Grupos e Clientes */}
            <Secao titulo="Grupos e Clientes" icon={Users}>
              <ItemMetrica label="Grupos em que participou" value={operador.grupos_em_que_participou} />
              <ItemMetrica label="Clientes em que participou" value={operador.clientes_em_que_participou} />
            </Secao>

            {/* Mensagens recentes */}
            <Secao titulo="Mensagens Recentes" icon={MessageSquare}>
              {loadingMsgs ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-500 mx-auto my-4" />
              ) : mensagensRecentes.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">Nenhuma mensagem no período.</p>
              ) : (
                <div className="space-y-2">
                  {mensagensRecentes.slice(0, 10).map(msg => {
                    const aval = avalsRecentes.find(a => a.whatsapp_mensagem_id === msg.id);
                    return (
                      <div key={msg.id} className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500">{msg.grupo_nome || msg.grupo_id}</span>
                          </div>
                          {aval && (
                            <Badge className={`text-[9px] border ${
                              (CLASS_COLORS[aval.classificacao] || CLASS_COLORS.atencao)
                            }`}>
                              {aval.score_qualidade}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 line-clamp-2">{msg.mensagem}</p>
                        {aval?.sugestao_melhoria && (
                          <p className="text-[10px] text-amber-400 mt-1.5 italic">💡 {aval.sugestao_melhoria}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Secao>

            {/* Pontos de Atenção */}
            {operador.principal_ponto_atencao && (
              <Secao titulo="Pontos de Atenção" icon={AlertTriangle}>
                <div className="bg-red-950/20 border border-red-800/40 rounded-lg p-3">
                  <p className="text-xs text-red-300">{operador.principal_ponto_atencao}</p>
                </div>
              </Secao>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}