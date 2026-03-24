import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, Copy, MessageCircle, RefreshCw, Trash2, Star, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TEMP_CONFIG = {
  'Fervendo': { color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', emoji: '🔥' },
  'Quente':   { color: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', emoji: '🌡️' },
  'Morno':    { color: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', emoji: '☕' },
  'Frio':     { color: 'bg-blue-400', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', emoji: '❄️' },
};

export default function ScannerVoxx({ lead, formData, setFormData, onSave }) {
  const queryClient = useQueryClient();
  const [analisando, setAnalisando] = useState(false);
  const [mensagemEditada, setMensagemEditada] = useState('');

  const hasAnalise = !!lead?.score_oportunidade;
  const temperatura = lead?.temperatura_lead;
  const tempCfg = TEMP_CONFIG[temperatura] || TEMP_CONFIG['Frio'];

  const handleAnalisar = async () => {
    setAnalisando(true);
    const nome = lead.nome_empresa || lead.nome_contato || 'o cliente';
    const cidade = lead.cidade || '';
    const segmento = lead.segmento || lead.briefing?.segmento || 'não informado';
    const instagram = formData.link_instagram || '';
    const biblioteca = formData.link_biblioteca_ads || '';
    const notaGoogle = formData.nota_google || '';
    const totalAvaliacoes = formData.total_avaliacoes_google || '';

    const prompt = `Você é um especialista em marketing digital e análise de presença online para agências de tráfego pago. Analise a presença digital da empresa abaixo e retorne um JSON com a análise completa.

EMPRESA: ${nome}
CIDADE: ${cidade}
SEGMENTO: ${segmento}
Instagram: ${instagram || 'não informado'}
Biblioteca de Anúncios Meta: ${biblioteca || 'não informado'}
Nota Google: ${notaGoogle || 'não informado'}
Total de Avaliações Google: ${totalAvaliacoes || 'não informado'}

Avalie cada critério de 0 a 2:
- bio_instagram: qualidade da bio (completa, clara, CTA) — 0=sem perfil/péssima, 1=básica, 2=boa
- stories_instagram: atividade nos stories — 0=inativo, 1=esporádico, 2=ativo
- feed_instagram: qualidade e frequência do feed — 0=sem posts/ruim, 1=básico, 2=bom
- anuncios_meta: presença de anúncios ativos na biblioteca — 0=sem anúncios, 1=poucos/fracos, 2=ativos e bem produzidos (PESO ALTO)
- reputacao_google: baseado na nota (0=sem presença, <3.5=ruim=0, 3.5-4.2=médio=1, >4.2=bom=2) e volume (sem avaliações=0, <50=1, >50=2), tire a média dos dois

Com base nos critérios, calcule:
- score_oportunidade: soma ponderada (anuncios_meta peso 2.5x, reputacao_google peso 1.5x, resto peso 1x) / total_possivel * 100 — retorne inteiro 0-100
- temperatura_lead: "Fervendo" se score>=80, "Quente" se >=60, "Morno" se >=40, "Frio" se <40
- falhas_identificadas: array de strings com as falhas detectadas (critérios com pontuação 0 ou 1), seja direto e específico
- mensagem_whatsapp: mensagem consultiva, direta, personalizada para ${nome}, focando nas falhas identificadas, sem ser genérica, tom de especialista, máximo 3 parágrafos, sem emojis excessivos

Retorne APENAS o JSON, sem texto extra.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          bio_instagram: { type: 'number' },
          stories_instagram: { type: 'number' },
          feed_instagram: { type: 'number' },
          anuncios_meta: { type: 'number' },
          reputacao_google: { type: 'number' },
          score_oportunidade: { type: 'number' },
          temperatura_lead: { type: 'string' },
          falhas_identificadas: { type: 'array', items: { type: 'string' } },
          mensagem_whatsapp: { type: 'string' },
        }
      }
    });

    const analise = {
      score_oportunidade: result.score_oportunidade,
      temperatura_lead: result.temperatura_lead,
      falhas_identificadas: result.falhas_identificadas || [],
      mensagem_whatsapp_sugerida: result.mensagem_whatsapp,
      data_analise: new Date().toISOString(),
      criterios_analise: {
        bio_instagram: result.bio_instagram,
        stories_instagram: result.stories_instagram,
        feed_instagram: result.feed_instagram,
        anuncios_meta: result.anuncios_meta,
        reputacao_google: result.reputacao_google,
      }
    };

    await base44.entities.LeadComercial.update(lead.id, {
      ...analise,
      link_instagram: formData.link_instagram,
      link_biblioteca_ads: formData.link_biblioteca_ads,
      nota_google: formData.nota_google ? Number(formData.nota_google) : undefined,
      total_avaliacoes_google: formData.total_avaliacoes_google ? Number(formData.total_avaliacoes_google) : undefined,
    });

    setMensagemEditada(result.mensagem_whatsapp || '');
    queryClient.invalidateQueries({ queryKey: ['leadDetalhe', lead.id] });
    queryClient.invalidateQueries({ queryKey: ['leadsComercial'] });
    toast.success('Análise concluída!');
    setAnalisando(false);
  };

  const handleLimparAnalise = async () => {
    await base44.entities.LeadComercial.update(lead.id, {
      score_oportunidade: null,
      temperatura_lead: null,
      falhas_identificadas: null,
      mensagem_whatsapp_sugerida: null,
      data_analise: null,
      criterios_analise: null,
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

  const criterios = lead?.criterios_analise || {};

  const CRITERIO_LABELS = {
    bio_instagram: 'Bio Instagram',
    stories_instagram: 'Stories',
    feed_instagram: 'Feed',
    anuncios_meta: 'Anúncios Meta',
    reputacao_google: 'Reputação Google',
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {/* DADOS DE ENTRADA */}
      <Card className="p-5 space-y-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dados de Presença Digital</p>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">WhatsApp (com DDI, só números)</Label>
            <Input
              placeholder="5511999999999"
              value={formData.whatsapp_lead || formData.telefone?.replace(/\D/g, '') || ''}
              onChange={e => setFormData({ ...formData, whatsapp_lead: e.target.value })}
            />
            {!formData.whatsapp_lead && formData.telefone && (
              <p className="text-[10px] text-slate-400">Preenchido automaticamente a partir do telefone cadastrado</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Link Instagram</Label>
            <Input
              placeholder="https://instagram.com/..."
              value={formData.link_instagram || ''}
              onChange={e => setFormData({ ...formData, link_instagram: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Biblioteca de Anúncios (Meta)</Label>
            <Input
              placeholder="https://facebook.com/ads/library/..."
              value={formData.link_biblioteca_ads || ''}
              onChange={e => setFormData({ ...formData, link_biblioteca_ads: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Nota Google (0-5)</Label>
              <Input
                type="number" step="0.1" min="0" max="5"
                placeholder="4.2"
                value={formData.nota_google || ''}
                onChange={e => setFormData({ ...formData, nota_google: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Qtd. Avaliações</Label>
              <Input
                type="number"
                placeholder="120"
                value={formData.total_avaliacoes_google || ''}
                onChange={e => setFormData({ ...formData, total_avaliacoes_google: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleAnalisar}
            disabled={analisando}
            className="bg-violet-600 hover:bg-violet-700 gap-2"
          >
            {analisando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {hasAnalise ? 'Reanalisar' : 'Analisar Presença Digital'}
          </Button>
          <Button variant="outline" onClick={() => onSave()} size="sm">
            Salvar Dados
          </Button>
        </div>
      </Card>

      {/* RESULTADO DA ANÁLISE */}
      {hasAnalise && (
        <>
          {/* Score + Temperatura */}
          <div className="grid grid-cols-2 gap-4">
            <Card className={`p-5 ${tempCfg.bg} ${tempCfg.border} border`}>
              <p className="text-xs font-semibold text-slate-500 mb-1">Temperatura do Lead</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{tempCfg.emoji}</span>
                <span className={`text-xl font-bold ${tempCfg.text}`}>{temperatura}</span>
              </div>
              {lead.data_analise && (
                <p className="text-[10px] text-slate-400 mt-2">
                  Analisado em {format(parseISO(lead.data_analise), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </Card>

            <Card className="p-5">
              <p className="text-xs font-semibold text-slate-500 mb-1">Score de Oportunidade</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-slate-900">{lead.score_oportunidade}</span>
                <span className="text-slate-400 mb-1">/100</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full ${lead.score_oportunidade >= 80 ? 'bg-red-500' : lead.score_oportunidade >= 60 ? 'bg-orange-500' : lead.score_oportunidade >= 40 ? 'bg-amber-400' : 'bg-blue-400'}`}
                  style={{ width: `${lead.score_oportunidade}%` }}
                />
              </div>
            </Card>
          </div>

          {/* Critérios */}
          {Object.keys(criterios).length > 0 && (
            <Card className="p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Avaliação por Critério</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {Object.entries(CRITERIO_LABELS).map(([key, label]) => {
                  const val = criterios[key] ?? '-';
                  const color = val === 2 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : val === 1 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200';
                  return (
                    <div key={key} className={`p-3 rounded-lg border text-center ${typeof val === 'number' ? color : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                      <p className="text-[10px] font-semibold mb-1">{label}</p>
                      <p className="text-xl font-bold">{val}/2</p>
                      {key === 'anuncios_meta' && <p className="text-[9px] mt-0.5 opacity-60">peso alto</p>}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Falhas */}
          {lead.falhas_identificadas?.length > 0 && (
            <Card className="p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-red-500" /> Falhas Identificadas
              </p>
              <div className="space-y-2">
                {lead.falhas_identificadas.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 bg-red-50 rounded-lg border border-red-100">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-red-700">{f}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Mensagem WhatsApp */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5 text-green-500" /> Mensagem Sugerida (WhatsApp)
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleCopiarMensagem} className="gap-1 h-7 text-xs">
                  <Copy className="w-3 h-3" /> Copiar
                </Button>
                <Button
                  size="sm"
                  onClick={handleAbrirWhatsApp}
                  className="gap-1 h-7 text-xs bg-green-600 hover:bg-green-700"
                >
                  <ExternalLink className="w-3 h-3" /> Abrir WhatsApp
                </Button>
              </div>
            </div>
            <Textarea
              rows={6}
              value={mensagemEditada || lead?.mensagem_whatsapp_sugerida || ''}
              onChange={e => setMensagemEditada(e.target.value)}
              className="text-sm resize-none"
              placeholder="Mensagem gerada pela análise..."
            />
            {mensagemEditada && mensagemEditada !== lead?.mensagem_whatsapp_sugerida && (
              <div className="flex justify-end mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={async () => {
                    await base44.entities.LeadComercial.update(lead.id, { mensagem_whatsapp_sugerida: mensagemEditada });
                    queryClient.invalidateQueries({ queryKey: ['leadDetalhe', lead.id] });
                    toast.success('Mensagem salva!');
                  }}
                >
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
        <Card className="p-8 text-center border-dashed">
          <Zap className="w-10 h-10 text-violet-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-600 mb-1">Nenhuma análise realizada</p>
          <p className="text-sm text-slate-400 mb-4">Preencha os dados acima e clique em "Analisar Presença Digital" para gerar o diagnóstico.</p>
        </Card>
      )}

      {analisando && (
        <Card className="p-8 text-center">
          <Loader2 className="w-10 h-10 text-violet-500 animate-spin mx-auto mb-3" />
          <p className="font-semibold text-slate-700">Analisando presença digital...</p>
          <p className="text-sm text-slate-400 mt-1">Aguarde, isso pode levar alguns segundos.</p>
        </Card>
      )}
    </div>
  );
}