import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import GmnChecklist from './GmnChecklist';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Zap, Loader2, MapPin, AlertCircle, MessageCircle, Copy, ExternalLink,
  RefreshCw, Trash2, Star, Instagram, TrendingUp, BarChart2, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_GMN = {
  rating: null, reviews_count: null, reviews_response: null,
  photos_quantity: null, photos_type: null,
  has_description: null, has_services: null, has_hours: null,
  posting_frequency: null,
  has_website: null, has_whatsapp: null, has_call_button: null,
  has_qna: null,
};

const CLASSIFICATION_CONFIG = {
  'Estruturado': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800', label: 'Estruturado (escala)' },
  'Ajustável':   { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-800',    label: 'Ajustável (oportunidade)' },
  'Desorganizado': { bg: 'bg-amber-50', border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-800',  label: 'Desorganizado (problema claro)' },
  'Crítico':     { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     badge: 'bg-red-100 text-red-800',      label: 'Crítico (alta perda de pacientes)' },
};

function ScoreBar({ value, color }) {
  const barColor = color || (value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-blue-500' : value >= 40 ? 'bg-amber-400' : 'bg-red-500');
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

export default function ScannerVoxx({ lead, formData, setFormData, onSave }) {
  const queryClient = useQueryClient();
  const [analisando, setAnalisando] = useState(false);
  const [mensagemEditada, setMensagemEditada] = useState('');
  const [gmnChecklist, setGmnChecklist] = useState(lead?.gmn_analise?.checklist || EMPTY_GMN);
  const [localAnalise, setLocalAnalise] = useState(null);

  const analise = localAnalise || lead?.voxx_analise || null;
  const hasAnalise = !!analise;

  const classification = analise?.lead_classification || 'Crítico';
  const classCfg = CLASSIFICATION_CONFIG[classification] || CLASSIFICATION_CONFIG['Crítico'];
  const isAltaPrioridade = analise?.lead_priority === 'ALTA PRIORIDADE';

  const handleAnalisar = async () => {
    setAnalisando(true);
    const nome = lead.nome_empresa || lead.nome_contato || 'o cliente';
    const segmento = lead.segmento || lead.briefing?.segmento || 'não informado';

    // Build GMN checklist summary
    const gmnSummary = Object.values(gmnChecklist).some(v => v !== null) ? `
CHECKLIST GOOGLE MEU NEGÓCIO:
- Nota média: ${gmnChecklist.rating ?? 'não informado'}
- Qtd. avaliações: ${gmnChecklist.reviews_count ?? 'não informado'}
- Respostas a avaliações: ${gmnChecklist.reviews_response ?? 'não informado'}
- Qtd. fotos: ${gmnChecklist.photos_quantity ?? 'não informado'}
- Tipo de fotos: ${gmnChecklist.photos_type ?? 'não informado'}
- Descrição estratégica: ${gmnChecklist.has_description === true ? 'sim' : gmnChecklist.has_description === false ? 'não' : 'não informado'}
- Serviços cadastrados: ${gmnChecklist.has_services === true ? 'sim' : gmnChecklist.has_services === false ? 'não' : 'não informado'}
- Horário atualizado: ${gmnChecklist.has_hours === true ? 'sim' : gmnChecklist.has_hours === false ? 'não' : 'não informado'}
- Freq. postagens: ${gmnChecklist.posting_frequency ?? 'não informado'}
- Site vinculado: ${gmnChecklist.has_website === true ? 'sim' : gmnChecklist.has_website === false ? 'não' : 'não informado'}
- WhatsApp no perfil: ${gmnChecklist.has_whatsapp === true ? 'sim' : gmnChecklist.has_whatsapp === false ? 'não' : 'não informado'}
- Botão de ligação: ${gmnChecklist.has_call_button === true ? 'sim' : gmnChecklist.has_call_button === false ? 'não' : 'não informado'}
- Q&A: ${gmnChecklist.has_qna === true ? 'sim' : gmnChecklist.has_qna === false ? 'não' : 'não informado'}` : 'GMN: não informado';

    const prompt = `Você é o motor de análise VOXX SCORE 360°. Analise a presença digital abaixo e retorne o JSON solicitado.

EMPRESA: ${nome}
SEGMENTO: ${segmento}
CIDADE: ${lead.cidade || 'não informado'}

INSTAGRAM: ${formData.link_instagram || 'não informado'}
BIBLIOTECA DE ANÚNCIOS META: ${formData.link_biblioteca_ads || 'não informado'}
${gmnSummary}

━━━ REGRAS DE CÁLCULO ━━━

INSTAGRAM_SCORE (0-100): baseado em posicionamento, conteúdo, consistência, estratégia.
GMN_SCORE (0-100): pesos — Conversão(site+whatsapp+ligação)=25%, Avaliações(nota+qtd+respostas)=30%, Conteúdo(fotos+postagens)=25%, Estrutura(descrição+serviços+horário+qna)=20%
ADS_SCORE (0-100): existência e qualidade de campanhas. Se não roda tráfego = 0.

VOXX_SCORE = (instagram_score * 0.40) + (gmn_score * 0.35) + (ads_score * 0.25) — arredondado, inteiro

CLASSIFICAÇÃO pelo voxx_score:
80-100 → "Estruturado"
60-79  → "Ajustável"
40-59  → "Desorganizado"
0-39   → "Crítico"

GATILHOS CRÍTICOS (sobrescrevem a prioridade):
Se QUALQUER um for verdadeiro: sem WhatsApp no GMN, sem site no GMN, Instagram sem consistência, não roda tráfego
→ lead_priority = "ALTA PRIORIDADE"
Caso contrário: lead_priority = "Monitorar"

FALHAS CONSOLIDADAS: liste TODAS as falhas reais dos 3 canais em ordem de impacto (conversão > conteúdo > estrutura). Máximo 7 itens. NÃO invente.

DIAGNÓSTICO: 1 parágrafo direto, comercial, explicando o estado atual da presença digital e o impacto em captação de pacientes.

MENSAGEM WHATSAPP — use exatamente este template preenchendo com as falhas reais:
"Olá, tudo bem?

Fiz uma análise da presença digital da clínica e identifiquei alguns pontos que podem estar fazendo vocês perderem pacientes hoje.

[Se GMN tiver falha crítica, falar do Google primeiro. Se Instagram for o maior problema, falar do Instagram primeiro.]

No Google, encontramos falhas importantes na estrutura de conversão:
- [falha GMN 1]
- [falha GMN 2]

No Instagram, o perfil ainda não está sendo explorado de forma estratégica:
- [falha Instagram 1]
- [falha Instagram 2]

Isso impacta diretamente pacientes que já estão buscando tratamento e prontos para decidir.

Hoje, quem tem uma estrutura digital mais ajustada acaba ficando com esses pacientes.

Temos uma estratégia pronta para corrigir esses pontos e aumentar a entrada de pacientes de forma previsível.

Faz sentido te mostrar isso em 15 minutos?"

REGRAS DA MENSAGEM:
- Nunca citar números de nota ou avaliações
- Focar em falhas estruturais
- Tom de especialista, não de vendedor
- Se não há dado do GMN, focar apenas no Instagram/Ads`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude_sonnet_4_6',
      response_json_schema: {
        type: 'object',
        properties: {
          instagram_score: { type: 'number' },
          gmn_score: { type: 'number' },
          ads_score: { type: 'number' },
          voxx_score: { type: 'number' },
          lead_classification: { type: 'string' },
          lead_priority: { type: 'string' },
          main_failures: { type: 'array', items: { type: 'string' } },
          diagnosis: { type: 'string' },
          whatsapp_message: { type: 'string' },
        }
      }
    });

    const updateData = {
      voxx_analise: {
        ...result,
        checklist_gmn: gmnChecklist,
        data_analise: new Date().toISOString(),
      },
      // Compatibilidade com campos antigos
      score_oportunidade: result.voxx_score,
      temperatura_lead: result.voxx_score >= 80 ? 'Fervendo' : result.voxx_score >= 60 ? 'Quente' : result.voxx_score >= 40 ? 'Morno' : 'Frio',
      falhas_identificadas: result.main_failures || [],
      mensagem_whatsapp_sugerida: result.whatsapp_message,
      data_analise: new Date().toISOString(),
      link_instagram: formData.link_instagram,
      link_biblioteca_ads: formData.link_biblioteca_ads,
    };

    if (gmnChecklist.rating) updateData.nota_google = gmnChecklist.rating;
    if (gmnChecklist.reviews_count) updateData.total_avaliacoes_google = gmnChecklist.reviews_count;

    await base44.entities.LeadComercial.update(lead.id, updateData);

    const analiseLocal = {
      ...result,
      checklist_gmn: gmnChecklist,
      data_analise: new Date().toISOString(),
    };
    setLocalAnalise(analiseLocal);
    setMensagemEditada(result.whatsapp_message || '');
    queryClient.invalidateQueries({ queryKey: ['leadDetalhe', lead.id] });
    queryClient.invalidateQueries({ queryKey: ['leadsComercial'] });
    toast.success('VOXX Score 360° gerado!');
    setAnalisando(false);
  };

  const handleLimparAnalise = async () => {
    setLocalAnalise(null);
    await base44.entities.LeadComercial.update(lead.id, {
      voxx_analise: null,
      score_oportunidade: null,
      temperatura_lead: null,
      falhas_identificadas: null,
      mensagem_whatsapp_sugerida: null,
      data_analise: null,
      criterios_analise: null,
      gmn_analise: null,
    });
    queryClient.invalidateQueries({ queryKey: ['leadDetalhe', lead.id] });
    queryClient.invalidateQueries({ queryKey: ['leadsComercial'] });
    toast.success('Análise removida.');
  };

  const handleCopiarMensagem = () => {
    const msg = mensagemEditada || lead?.mensagem_whatsapp_sugerida || '';
    navigator.clipboard.writeText(msg);
    toast.success('Mensagem copiada!');
  };

  const handleAbrirWhatsApp = () => {
    const numero = formData.whatsapp_lead || lead?.whatsapp_lead || lead?.telefone?.replace(/\D/g, '');
    if (!numero) { toast.error('Número de WhatsApp não informado.'); return; }
    const msg = encodeURIComponent(mensagemEditada || lead?.mensagem_whatsapp_sugerida || '');
    window.open(`https://wa.me/${numero}?text=${msg}`, '_blank');
  };

  // Critical triggers derived from checklist
  const criticalTriggers = [];
  if (gmnChecklist.has_whatsapp === false) criticalTriggers.push('Sem WhatsApp no Google');
  if (gmnChecklist.has_website === false) criticalTriggers.push('Sem site no Google');
  if (!formData.link_biblioteca_ads) criticalTriggers.push('Não roda tráfego pago');

  return (
    <div className="space-y-5 max-w-3xl">
      {/* DADOS DE ENTRADA */}
      <Card className="p-5 space-y-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-violet-500" /> Scanner Voxx 360° — Dados de Entrada
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">WhatsApp (DDI + número)</Label>
            <Input
              placeholder="5511999999999"
              value={formData.whatsapp_lead || formData.telefone?.replace(/\D/g, '') || ''}
              onChange={e => setFormData({ ...formData, whatsapp_lead: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Instagram className="w-3 h-3" /> Instagram</Label>
            <Input
              placeholder="https://instagram.com/..."
              value={formData.link_instagram || ''}
              onChange={e => setFormData({ ...formData, link_instagram: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><BarChart2 className="w-3 h-3" /> Biblioteca de Anúncios (Meta Ads)</Label>
            <Input
              placeholder="https://facebook.com/ads/library/..."
              value={formData.link_biblioteca_ads || ''}
              onChange={e => setFormData({ ...formData, link_biblioteca_ads: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> Link Google Meu Negócio</Label>
            <Input
              placeholder="https://maps.google.com/..."
              value={formData.gmn_link || ''}
              onChange={e => setFormData({ ...formData, gmn_link: e.target.value })}
            />
          </div>
        </div>

        {/* GMN Checklist */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">🔍 Checklist Google Meu Negócio</p>
            <button type="button" onClick={() => setGmnChecklist(EMPTY_GMN)} className="text-[10px] text-slate-400 hover:text-slate-600 underline">
              Limpar
            </button>
          </div>
          <GmnChecklist value={gmnChecklist} onChange={setGmnChecklist} />
        </div>

        {/* Critical triggers preview */}
        {criticalTriggers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {criticalTriggers.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 rounded text-[11px] text-red-700">
                <AlertTriangle className="w-3 h-3" /> {t}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button onClick={handleAnalisar} disabled={analisando} className="bg-violet-600 hover:bg-violet-700 gap-2">
            {analisando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {hasAnalise ? 'Reanalisar 360°' : 'Analisar — VOXX Score 360°'}
          </Button>
          <Button variant="outline" onClick={() => onSave()} size="sm">Salvar Dados</Button>
        </div>
      </Card>

      {/* RESULTADO */}
      {hasAnalise && analise && (
        <>
          {/* VOXX SCORE — PRINCIPAL */}
          <Card className={`p-6 ${classCfg.bg} ${classCfg.border} border-2`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">🔥 VOXX Score</p>
                <div className="flex items-end gap-2">
                  <span className={`text-6xl font-black ${classCfg.text}`}>{analise.voxx_score}</span>
                  <span className="text-slate-400 text-xl mb-2">/100</span>
                </div>
                <ScoreBar value={analise.voxx_score} />
              </div>
              <div className="text-right space-y-2">
                <div>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${classCfg.badge}`}>
                    {analise.lead_classification}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-0.5">{CLASSIFICATION_CONFIG[analise.lead_classification]?.label}</p>
                </div>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${
                  isAltaPrioridade ? 'bg-red-600 border-red-600 text-white' : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}>
                  {isAltaPrioridade && <AlertTriangle className="w-3.5 h-3.5" />}
                  {analise.lead_priority}
                </div>
              </div>
            </div>
            {analise.data_analise && (
              <p className="text-[10px] text-slate-400">
                Analisado em {format(parseISO(analise.data_analise), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </Card>

          {/* SUBSCORES */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Instagram', icon: Instagram, value: analise.instagram_score, color: 'text-pink-600', bar: 'bg-pink-400', weight: '40%' },
              { label: 'GMN', icon: MapPin, value: analise.gmn_score, color: 'text-blue-600', bar: 'bg-blue-400', weight: '35%' },
              { label: 'Ads', icon: BarChart2, value: analise.ads_score, color: 'text-violet-600', bar: 'bg-violet-400', weight: '25%' },
            ].map(({ label, icon: Icon, value, color, bar, weight }) => (
              <Card key={label} className="p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  <span className="text-xs font-semibold text-slate-600">{label}</span>
                  <span className="text-[10px] text-slate-400 ml-auto">{weight}</span>
                </div>
                <p className={`text-3xl font-black ${color}`}>{value ?? '—'}</p>
                <ScoreBar value={value ?? 0} color={bar} />
              </Card>
            ))}
          </div>

          {/* ALERTAS CRÍTICOS */}
          {isAltaPrioridade && analise.main_failures?.length > 0 && (
            <Card className="p-4 border-red-200 bg-red-50">
              <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Gatilhos Críticos — Alta Prioridade
              </p>
              <div className="space-y-1.5">
                {analise.main_failures.slice(0, 3).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-red-800">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* TODAS AS FALHAS */}
          {analise.main_failures?.length > 0 && (
            <Card className="p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Falhas Consolidadas
              </p>
              <div className="space-y-2">
                {analise.main_failures.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-xs font-bold text-slate-400 w-4 flex-shrink-0">{i + 1}.</span>
                    <span className="text-sm text-slate-700">{f}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* DIAGNÓSTICO */}
          {analise.diagnosis && (
            <Card className="p-5 border-violet-200 bg-violet-50">
              <p className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-2">🧠 Diagnóstico VOXX</p>
              <p className="text-sm text-violet-900 leading-relaxed">{analise.diagnosis}</p>
            </Card>
          )}

          {/* MENSAGEM WHATSAPP */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-green-500" /> Mensagem Unificada (WhatsApp)
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleCopiarMensagem} className="gap-1 h-7 text-xs">
                  <Copy className="w-3 h-3" /> Copiar
                </Button>
                <Button size="sm" onClick={handleAbrirWhatsApp} className="gap-1 h-7 text-xs bg-green-600 hover:bg-green-700">
                  <ExternalLink className="w-3 h-3" /> Abrir WhatsApp
                </Button>
              </div>
            </div>
            <Textarea
              rows={10}
              value={mensagemEditada || lead?.mensagem_whatsapp_sugerida || ''}
              onChange={e => setMensagemEditada(e.target.value)}
              className="text-sm resize-none"
              placeholder="Mensagem gerada pela análise..."
            />
            {mensagemEditada && mensagemEditada !== lead?.mensagem_whatsapp_sugerida && (
              <div className="flex justify-end mt-2">
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={async () => {
                  await base44.entities.LeadComercial.update(lead.id, { mensagem_whatsapp_sugerida: mensagemEditada });
                  queryClient.invalidateQueries({ queryKey: ['leadDetalhe', lead.id] });
                  toast.success('Mensagem salva!');
                }}>
                  Salvar edição
                </Button>
              </div>
            )}
          </Card>

          {/* Ações */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleAnalisar} disabled={analisando} className="gap-1.5 text-xs">
              <RefreshCw className="w-3.5 h-3.5" /> Reanalisar
            </Button>
            <Button variant="outline" size="sm" onClick={handleLimparAnalise} className="gap-1.5 text-xs text-red-600 hover:text-red-700 border-red-200">
              <Trash2 className="w-3.5 h-3.5" /> Excluir Análise
            </Button>
          </div>
        </>
      )}

      {/* Estado vazio */}
      {!hasAnalise && !analisando && (
        <Card className="p-10 text-center border-dashed">
          <Zap className="w-12 h-12 text-violet-300 mx-auto mb-3" />
          <p className="font-bold text-slate-700 mb-1">Scanner Voxx 360°</p>
          <p className="text-sm text-slate-400 mb-1">Analisa Instagram + GMN + Tráfego em um único Score.</p>
          <p className="text-xs text-slate-400">Preencha os dados acima e clique em "Analisar" para gerar o diagnóstico completo.</p>
        </Card>
      )}

      {analisando && (
        <Card className="p-10 text-center">
          <Loader2 className="w-12 h-12 text-violet-500 animate-spin mx-auto mb-3" />
          <p className="font-bold text-slate-700">Calculando VOXX Score 360°...</p>
          <p className="text-sm text-slate-400 mt-1">Analisando Instagram, Google Meu Negócio e Tráfego...</p>
          <div className="flex justify-center gap-4 mt-4 text-xs text-slate-400">
            <span>📸 Instagram 40%</span>
            <span>📍 GMN 35%</span>
            <span>📊 Ads 25%</span>
          </div>
        </Card>
      )}
    </div>
  );
}