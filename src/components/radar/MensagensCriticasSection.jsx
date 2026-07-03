import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Lightbulb, CheckCircle2 } from 'lucide-react';

function MetricaBar({ label, value }) {
  const color = value >= 70 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-slate-500 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value || 0}%` }} />
      </div>
      <span className="text-[9px] text-slate-400 font-mono w-6 text-right">{value || 0}</span>
    </div>
  );
}

export default function MensagensCriticasSection({ avaliacoes }) {
  const [gerandoIdeal, setGerandoIdeal] = useState({});
  const [ideais, setIdeais] = useState({});

  const criticas = avaliacoes.filter(a => a.classificacao === 'critica');

  if (criticas.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
        <p className="text-xs text-slate-400">Nenhuma mensagem crítica no período. 🎉</p>
      </div>
    );
  }

  const gerarIdeal = async (avaliacao) => {
    setGerandoIdeal(prev => ({ ...prev, [avaliacao.id]: true }));
    try {
      const prompt = `Você é um especialista em comunicação de atendimento ao cliente via WhatsApp para agências de marketing digital (foco em clínicas odontológicas e saúde).

Analise a seguinte mensagem enviada por um operador e avaliada como CRÍTICA (baixa qualidade):

Mensagem original: "${avaliacao.texto_mensagem || '[sem texto]'}"
Score de qualidade: ${avaliacao.score_qualidade}/100
Pontos de atenção: ${(avaliacao.pontos_atencao || []).join('; ') || 'N/A'}
Sugestão de melhoria: ${avaliacao.sugestao_melhoria || 'N/A'}
Cliente: ${avaliacao.cliente_nome || 'N/A'}

Scores parciais:
- Clareza: ${avaliacao.clareza || 0}/100
- Tom profissional: ${avaliacao.tom_profissional || 0}/100
- Objetividade: ${avaliacao.objetividade || 0}/100
- Próximo passo: ${avaliacao.proximo_passo || 0}/100
- Especificidade: ${avaliacao.especificidade || 0}/100
- Valor percebido: ${avaliacao.valor_percebido || 0}/100

Gere uma versão REESCRITA da mensagem que obteria pontuação alta (90+), mantendo a mesma intenção e contexto, mas aplicando: clareza, tom profissional e acolhedor, objetividade, próximo passo claro e específico, especificidade (datas, valores, nomes) e valor percebido pelo cliente.

Responda APENAS com JSON contendo:
1. "mensagem_ideal": a versão reescrita pronta para enviar
2. "explicacao": por que esta versão é melhor (máx 2 frases)
3. "checklist": array de 3-5 princípios curtos que o operador deve lembrar para futuras mensagens`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            mensagem_ideal: { type: 'string' },
            explicacao: { type: 'string' },
            checklist: { type: 'array', items: { type: 'string' } }
          }
        }
      });
      setIdeais(prev => ({ ...prev, [avaliacao.id]: res }));
    } catch (e) {
      setIdeais(prev => ({ ...prev, [avaliacao.id]: { erro: e.message } }));
    } finally {
      setGerandoIdeal(prev => ({ ...prev, [avaliacao.id]: false }));
    }
  };

  return (
    <div className="space-y-3">
      {/* Orientação geral */}
      <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-blue-400" />
          <p className="text-xs text-blue-300 font-semibold">Formato ideal para boa pontuação</p>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Uma mensagem de alta qualidade (90+) deve ter: <strong className="text-slate-300">clareza</strong> (direta, sem ambiguidade),{' '}
          <strong className="text-slate-300">tom profissional</strong> (acolhedor e respeitoso),{' '}
          <strong className="text-slate-300">objetividade</strong> (sem excesso de palavras),{' '}
          <strong className="text-slate-300">próximo passo claro</strong> (o que vem a seguir),{' '}
          <strong className="text-slate-300">especificidade</strong> (datas, valores, nomes) e{' '}
          <strong className="text-slate-300">valor percebido</strong> (cliente entende o benefício).
        </p>
      </div>

      {/* Lista de mensagens críticas */}
      {criticas.map((aval, i) => (
        <div key={aval.id || i} className="bg-red-950/10 border border-red-800/30 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <Badge className="text-[9px] border bg-red-500/15 text-red-400 border-red-500/25">
              {aval.score_qualidade}/100 · Crítica
            </Badge>
            <span className="text-[10px] text-slate-500">
              {aval.grupo_nome || aval.cliente_nome || '—'}
            </span>
          </div>

          {/* Mensagem original */}
          <div>
            <p className="text-[10px] text-red-400 font-semibold mb-1">📨 Mensagem enviada:</p>
            <div className="bg-slate-900/60 border border-slate-800 rounded p-2">
              <p className="text-xs text-slate-300 italic">"{aval.texto_mensagem || '[sem texto]'}"</p>
            </div>
          </div>

          {/* Scores parciais */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <MetricaBar label="Clareza" value={aval.clareza} />
            <MetricaBar label="Tom" value={aval.tom_profissional} />
            <MetricaBar label="Objetiv." value={aval.objetividade} />
            <MetricaBar label="Próx. passo" value={aval.proximo_passo} />
            <MetricaBar label="Especif." value={aval.especificidade} />
            <MetricaBar label="Valor" value={aval.valor_percebido} />
          </div>

          {/* Pontos de atenção */}
          {aval.pontos_atencao?.length > 0 && (
            <div>
              <p className="text-[10px] text-red-400 font-semibold mb-1">⚠️ Pontos de atenção:</p>
              <ul className="text-[10px] text-slate-400 space-y-0.5 ml-3">
                {aval.pontos_atencao.map((p, j) => <li key={j}>• {p}</li>)}
              </ul>
            </div>
          )}

          {/* Sugestão */}
          {aval.sugestao_melhoria && (
            <div>
              <p className="text-[10px] text-amber-400 font-semibold mb-1">💡 Sugestão de melhoria:</p>
              <p className="text-[10px] text-slate-300 leading-relaxed">{aval.sugestao_melhoria}</p>
            </div>
          )}

          {/* Botão gerar formato ideal */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => gerarIdeal(aval)}
            disabled={gerandoIdeal[aval.id]}
            className="h-7 text-[10px] gap-1.5 border-emerald-700 text-emerald-400 hover:bg-emerald-500/10 w-full"
          >
            {gerandoIdeal[aval.id]
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Gerando formato ideal...</>
              : <><Sparkles className="w-3 h-3" /> Ver formato ideal</>
            }
          </Button>

          {/* Resultado do formato ideal */}
          {ideais[aval.id] && !ideais[aval.id].erro && (
            <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-lg p-2.5 space-y-2">
              <p className="text-[10px] text-emerald-400 font-semibold">✨ Formato ideal (score 90+):</p>
              <div className="bg-emerald-950/30 border border-emerald-800/20 rounded p-2">
                <p className="text-xs text-emerald-100 whitespace-pre-wrap">{ideais[aval.id].mensagem_ideal}</p>
              </div>
              <p className="text-[10px] text-slate-400">{ideais[aval.id].explicacao}</p>
              {ideais[aval.id].checklist?.length > 0 && (
                <div>
                  <p className="text-[10px] text-emerald-400 font-semibold mb-1">📋 Princípios aplicados:</p>
                  <ul className="text-[10px] text-slate-300 space-y-0.5 ml-3">
                    {ideais[aval.id].checklist.map((c, j) => <li key={j}>✓ {c}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          {ideais[aval.id]?.erro && (
            <p className="text-[10px] text-red-400">Erro ao gerar: {ideais[aval.id].erro}</p>
          )}
        </div>
      ))}
    </div>
  );
}