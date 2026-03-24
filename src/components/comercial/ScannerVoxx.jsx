import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Zap, Copy, MessageCircle, RefreshCw, Trash2, AlertCircle, ExternalLink, Star, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TEMP_CONFIG = {
  'Fervendo': { color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', emoji: '🔥' },
  'Quente':   { color: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', emoji: '🌡️' },
  'Morno':    { color: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', emoji: '☕' },
  'Frio':     { color: 'bg-blue-400', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', emoji: '❄️' },
};

const CRITERIO_LABELS = {
  bio_instagram: 'Bio Instagram',
  stories_instagram: 'Stories',
  feed_instagram: 'Feed',
  anuncios_meta: 'Anúncios Meta',
  reputacao_google: 'Reputação Google',
};

async function analyzeGoogleMyBusiness(gmn_link, nome, notaConfirmada, avaliacoesConfirmadas) {
  const dadosConfirmados = [];
  if (notaConfirmada) dadosConfirmados.push(`- rating = ${notaConfirmada} (CONFIRMADO PELO USUÁRIO — NÃO altere)`);
  if (avaliacoesConfirmadas) dadosConfirmados.push(`- reviews_count = ${avaliacoesConfirmadas} (CONFIRMADO PELO USUÁRIO — NÃO altere)`);

  const prompt = `Você é um especialista em presença digital e marketing local.

ACESSE DIRETAMENTE esta URL do Google Meu Negócio e extraia os dados reais:
${gmn_link}

NOME DO LEAD NO SISTEMA: "${nome}"

INSTRUÇÕES CRÍTICAS:
1. Acesse o link acima e leia os dados DIRETAMENTE desta página específica.
2. Extraia o nome real do perfil encontrado no Google Meu Negócio.
3. Valide por correlação se o nome do Google corresponde ao lead "${nome}" (não precisa ser idêntico — mesmo negócio, mesma localidade, nomes similares são válidos). Se não houver nenhuma correlação, retorne name_mismatch: true.
${dadosConfirmados.length > 0 ? `4. DADOS CONFIRMADOS PELO USUÁRIO (use exatamente estes valores):\n${dadosConfirmados.join('\n')}` : '4. Extraia nota e número de avaliações diretamente da página.'}

Calcule gmn_score (0-100):
- Avaliações (30%): nota < 4.5 = alerta; < 50 avaliações = baixa autoridade
- Conteúdo/fotos/posts (25%)
- Estrutura: horários, serviços, descrição (25%)
- Engajamento: respostas, postagens recentes (20%)

Retorne APENAS JSON:
{
  "gmn_score": 0,
  "rating": 0,
  "reviews_count": 0,
  "name_found": "",
  "name_mismatch": false,
  "diagnosis": "",
  "failures": [],
  "impact": "",
  "opportunity": ""
}`;

  return await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        gmn_score: { type: 'number' },
        rating: { type: 'number' },
        reviews_count: { type: 'number' },
        name_found: { type: 'string' },
        name_mismatch: { type: 'boolean' },
        diagnosis: { type: 'string' },
        failures: { type: 'array', items: { type: 'string' } },
        impact: { type: 'string' },
        opportunity: { type: 'string' },
      }
    }
  });
}

export default function ScannerVoxx({ lead, formData, setFormData, onSave }) {
  const queryClient = useQueryClient();
  const [analisando, setAnalisando] = useState(false);
  const [mensagemEditada, setMensagemEditada] = useState('');

  const hasAnalise = !!lead?.score_oportunidade;
  const hasGmn = !!lead?.gmn_analise?.gmn_score;
  const temperatura = lead?.temperatura_lead;
  const tempCfg = TEMP_CONFIG[temperatura] || TEMP_CONFIG['Frio'];

  const buildWhatsAppMessage = (analise, gmnAnalise, nome) => {
    const prompt = `Você é um consultor de marketing digital da agência Voxx. Crie uma mensagem de WhatsApp consultiva, direta e personalizada para ${nome}, com base na análise abaixo.

ANÁLISE DE PRESENÇA DIGITAL:
Score de Oportunidade: ${analise.score_oportunidade}/100
Temperatura: ${analise.temperatura_lead}
Falhas identificadas: ${(analise.falhas_identificadas || []).join(', ')}

${gmnAnalise ? `ANÁLISE GOOGLE MEU NEGÓCIO:
Score GMN: ${gmnAnalise.gmn_score}/100
Nota: ${gmnAnalise.rating}
Avaliações: ${gmnAnalise.reviews_count}
Diagnóstico: ${gmnAnalise.diagnosis}
Falhas GMN: ${(gmnAnalise.failures || []).join(', ')}` : ''}

Regras da mensagem:
- Tom de especialista, não de vendedor
- Máximo 3 parágrafos
- Sem emojis excessivos
- Mencionar falhas específicas encontradas
- Se houver análise GMN, incluir trecho sobre o Google da empresa
- Finalizar com proposta de diagnóstico gratuito`;

    return base44.integrations.Core.InvokeLLM({ prompt });
  };

  const handleAnalisar = async () => {
    setAnalisando(true);
    const nome = lead.nome_empresa || lead.nome_contato || 'o cliente';
    const segmento = lead.segmento || lead.briefing?.segmento || 'não informado';

    // 1. Análise principal (presença digital)
    const mainResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Você é um especialista em marketing digital. Analise a presença digital da empresa abaixo e retorne um JSON.

EMPRESA: ${nome}
CIDADE: ${lead.cidade || ''}
SEGMENTO: ${segmento}
Instagram: ${formData.link_instagram || 'não informado'}
Biblioteca de Anúncios Meta: ${formData.link_biblioteca_ads || 'não informado'}
Nota Google: ${formData.nota_google || 'não informado'}
Total de Avaliações Google: ${formData.total_avaliacoes_google || 'não informado'}

Avalie cada critério de 0 a 2:
- bio_instagram: qualidade da bio — 0=sem perfil/péssima, 1=básica, 2=boa
- stories_instagram: atividade nos stories — 0=inativo, 1=esporádico, 2=ativo
- feed_instagram: qualidade e frequência do feed — 0=ruim, 1=básico, 2=bom
- anuncios_meta: presença de anúncios ativos — 0=sem anúncios, 1=poucos/fracos, 2=ativos (PESO ALTO)
- reputacao_google: nota <3.5=0, 3.5-4.2=1, >4.2=2; sem avaliações=0, <50=1, >50=2 — tire a média

score_oportunidade: soma ponderada (anuncios_meta peso 2.5x, reputacao_google peso 1.5x, resto 1x) / total_possivel * 100 — inteiro 0-100
temperatura_lead: "Fervendo">=80, "Quente">=60, "Morno">=40, "Frio"<40
falhas_identificadas: array com falhas detectadas (critérios com pontuação 0 ou 1)

Retorne APENAS o JSON.`,
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
        }
      }
    });

    // 2. Análise GMN (se link informado)
    let gmnResult = null;
    const gmnLink = formData.gmn_link || lead.gmn_link;
    if (gmnLink) {
      gmnResult = await analyzeGoogleMyBusiness(
        gmnLink,
        nome,
        formData.nota_google || null,
        formData.total_avaliacoes_google || null
      );
    }

    // 3. Gerar mensagem WhatsApp incluindo GMN se disponível
    const analiseParaMensagem = {
      score_oportunidade: mainResult.score_oportunidade,
      temperatura_lead: mainResult.temperatura_lead,
      falhas_identificadas: mainResult.falhas_identificadas || [],
    };
    const mensagem = await buildWhatsAppMessage(analiseParaMensagem, gmnResult, nome);

    // 4. Salvar tudo
    const updateData = {
      score_oportunidade: mainResult.score_oportunidade,
      temperatura_lead: mainResult.temperatura_lead,
      falhas_identificadas: mainResult.falhas_identificadas || [],
      mensagem_whatsapp_sugerida: mensagem,
      data_analise: new Date().toISOString(),
      criterios_analise: {
        bio_instagram: mainResult.bio_instagram,
        stories_instagram: mainResult.stories_instagram,
        feed_instagram: mainResult.feed_instagram,
        anuncios_meta: mainResult.anuncios_meta,
        reputacao_google: mainResult.reputacao_google,
      },
      link_instagram: formData.link_instagram,
      link_biblioteca_ads: formData.link_biblioteca_ads,
      gmn_link: gmnLink || undefined,
      nota_google: formData.nota_google ? Number(formData.nota_google) : undefined,
      total_avaliacoes_google: formData.total_avaliacoes_google ? Number(formData.total_avaliacoes_google) : undefined,
    };

    if (gmnResult) {
      updateData.gmn_analise = gmnResult;
    }

    await base44.entities.LeadComercial.update(lead.id, updateData);

    setMensagemEditada(mensagem || '');
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

  const criterios = lead?.criterios_analise || {};
  const gmn = lead?.gmn_analise;

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
          <div className="space-y-1">
            <Label className="text-xs">Link do Google Meu Negócio</Label>
            <Input
              placeholder="https://maps.google.com/..."
              value={formData.gmn_link || ''}
              onChange={e => setFormData({ ...formData, gmn_link: e.target.value })}
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
        {(formData.gmn_link || lead?.gmn_link) && (
          <p className="text-[11px] text-violet-600 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> A análise incluirá o Google Meu Negócio
          </p>
        )}
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

          {/* Critérios presença digital */}
          {Object.keys(criterios).length > 0 && (
            <Card className="p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Avaliação por Critério — Presença Digital</p>
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

          {/* Falhas presença digital */}
          {lead.falhas_identificadas?.length > 0 && (
            <Card className="p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-red-500" /> Falhas — Presença Digital
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

          {/* BLOCO GMN */}
          {hasGmn && gmn && (
            <Card className="p-5 border-blue-200">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-semibold text-blue-800">Google Meu Negócio</p>
                <div className="ml-auto flex items-center gap-3">
                  {gmn.rating > 0 && (
                    <div className="flex items-center gap-1 text-amber-600">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span className="text-sm font-bold">{gmn.rating}</span>
                      {gmn.reviews_count > 0 && <span className="text-xs text-slate-400">({gmn.reviews_count} avaliações)</span>}
                    </div>
                  )}
                  <div className="text-center">
                    <span className={`text-2xl font-bold ${gmn.gmn_score >= 70 ? 'text-emerald-600' : gmn.gmn_score >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{gmn.gmn_score}</span>
                    <span className="text-xs text-slate-400">/100</span>
                  </div>
                </div>
              </div>

              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-4">
                <div
                  className={`h-1.5 rounded-full ${gmn.gmn_score >= 70 ? 'bg-emerald-500' : gmn.gmn_score >= 40 ? 'bg-amber-400' : 'bg-red-500'}`}
                  style={{ width: `${gmn.gmn_score}%` }}
                />
              </div>

              {gmn.diagnosis && (
                <div className="p-3 bg-blue-50 rounded-lg mb-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Diagnóstico</p>
                  <p className="text-sm text-blue-800">{gmn.diagnosis}</p>
                </div>
              )}

              {gmn.failures?.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Falhas identificadas</p>
                  {gmn.failures.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-red-50 rounded border border-red-100">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-red-700">{f}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {gmn.impact && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <p className="text-[10px] font-semibold text-amber-700 mb-1">⚠️ Impacto</p>
                    <p className="text-xs text-amber-800">{gmn.impact}</p>
                  </div>
                )}
                {gmn.opportunity && (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <p className="text-[10px] font-semibold text-emerald-700 mb-1">✅ Oportunidade</p>
                    <p className="text-xs text-emerald-800">{gmn.opportunity}</p>
                  </div>
                )}
              </div>

              {gmn.name_found && (
                <div className={`flex items-center gap-2 p-2.5 rounded-lg border mt-3 text-xs ${
                  gmn.name_mismatch
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}>
                  <span>{gmn.name_mismatch ? '⚠️' : '✅'}</span>
                  <span>
                    {gmn.name_mismatch
                      ? `Atenção: o perfil encontrado é "${gmn.name_found}" — pode não corresponder ao lead`
                      : `Perfil validado: "${gmn.name_found}"`
                    }
                  </span>
                </div>
              )}
              {lead.gmn_link && (
                <a href={lead.gmn_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-3">
                  <ExternalLink className="w-3 h-3" /> Ver no Google
                </a>
              )}
            </Card>
          )}

          {/* Mensagem WhatsApp */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5 text-green-500" /> Mensagem Sugerida (WhatsApp)
                {hasGmn && <span className="text-[10px] text-blue-500 ml-1">· inclui GMN</span>}
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
          <p className="text-sm text-slate-400 mb-4">Preencha os dados acima e clique em "Analisar Presença Digital" para gerar o diagnóstico completo.</p>
        </Card>
      )}

      {analisando && (
        <Card className="p-8 text-center">
          <Loader2 className="w-10 h-10 text-violet-500 animate-spin mx-auto mb-3" />
          <p className="font-semibold text-slate-700">Analisando presença digital...</p>
          <p className="text-sm text-slate-400 mt-1">
            {(formData.gmn_link || lead?.gmn_link) ? 'Analisando Instagram, Meta Ads e Google Meu Negócio...' : 'Aguarde, isso pode levar alguns segundos.'}
          </p>
        </Card>
      )}
    </div>
  );
}