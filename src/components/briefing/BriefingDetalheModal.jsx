import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  X, Save, AlertTriangle, CheckCircle2, BookOpen, Palette, Target,
  Globe, ShoppingBag, ShieldAlert, Folder, Zap, Eye, Plus
} from 'lucide-react';
import { calcBriefingScore } from '@/pages/BriefingClientes';
import { format } from 'date-fns';

function ImagensReferencia({ imagens, onChange }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    onChange([...imagens, ...urls]);
    setUploading(false);
    e.target.value = '';
  };

  const removeImagem = (idx) => {
    onChange(imagens.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {imagens.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {imagens.map((url, i) => (
            <div key={i} className="relative group aspect-square">
              <img src={url} alt={`ref-${i}`} className="w-full h-full object-cover rounded-lg border border-slate-200" />
              <button
                onClick={() => removeImagem(i)}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      <Button
        size="sm"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-xs h-7 gap-1 border-dashed"
      >
        {uploading ? (
          <><div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> Enviando...</>
        ) : (
          <><Plus className="w-3 h-3" /> Adicionar imagens</>
        )}
      </Button>
    </div>
  );
}

function Field({ label, value, onChange, multiline = false, placeholder = '' }) {
  const base = "w-full border border-slate-200 rounded-lg text-sm text-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white resize-none";
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 block mb-1">{label}</label>
      {multiline ? (
        <textarea
          className={`${base} min-h-[80px]`}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className={base}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function SectionGrid({ children }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

function AlertasBriefing({ b }) {
  const alertas = [];
  if (!b?.visao_geral?.publico_principal) alertas.push('Público-alvo não definido');
  if (!b?.visao_geral?.posicionamento) alertas.push('Posicionamento da marca ausente');
  if (!b?.restricoes?.nao_fazer) alertas.push('Restrições da marca não preenchidas');
  if (!b?.assets?.link_drive && !b?.assets?.link_dropbox && !b?.assets?.manual_marca_url) alertas.push('Nenhum asset/link de materiais cadastrado');
  if (!b?.meta_ads?.publico_alvo) alertas.push('Briefing Meta Ads incompleto (sem público-alvo)');
  if (!b?.google_ads?.principais_buscas) alertas.push('Briefing Google Ads incompleto (sem buscas principais)');
  if (!b?.criacao?.direcao_arte) alertas.push('Direção de arte não definida');
  if (alertas.length === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
      <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" /> {alertas.length} alerta{alertas.length > 1 ? 's' : ''} de preenchimento
      </p>
      <ul className="space-y-0.5">
        {alertas.map((a, i) => (
          <li key={i} className="text-xs text-amber-600 flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0" /> {a}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScoreRing({ score }) {
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-12 h-12">
        <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${score} ${100 - score}`} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700">{score}%</span>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-700">Score de preenchimento</p>
        <p className="text-[10px] text-slate-400">{score >= 80 ? 'Completo' : score >= 50 ? 'Em andamento' : 'Incompleto'}</p>
      </div>
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'completo', label: 'Completo' },
  { value: 'desatualizado', label: 'Desatualizado' },
];

export default function BriefingDetalheModal({ briefing, cliente, user, onClose, onSaved }) {
  const [data, setData] = useState(briefing);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setData(briefing); }, [briefing?.id]);

  const score = calcBriefingScore(data);

  const set = (section, key, val) => {
    setData(prev => ({
      ...prev,
      [section]: { ...(prev[section] || {}), [key]: val }
    }));
  };

  const setTop = (key, val) => setData(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.BriefingCliente.update(data.id, {
      ...data,
      atualizado_por_nome: user?.full_name || user?.email || '',
      atualizado_por_email: user?.email || '',
    });
    onSaved?.();
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
              <BookOpen className="w-4.5 h-4.5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{cliente.nome}</h2>
              <p className="text-xs text-slate-400">{cliente.cidade}{cliente.estado ? `, ${cliente.estado}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ScoreRing score={score} />
            <Select value={data.status_briefing || 'rascunho'} onValueChange={v => setTop('status_briefing', v)}>
              <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white h-8 gap-1.5">
              <Save className="w-3.5 h-3.5" /> {saving ? 'Salvando…' : 'Salvar'}
            </Button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
          {/* Alertas */}
          <AlertasBriefing b={data} />

          {/* Resumo executivo */}
          <Card className="p-4 bg-gradient-to-br from-violet-50 to-white border-violet-100">
            <h3 className="text-xs font-bold text-violet-700 mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Resumo Executivo da Marca
            </h3>
            <textarea
              className="w-full text-sm text-slate-700 bg-transparent border-none outline-none resize-none min-h-[80px] placeholder:text-slate-300"
              placeholder="Descreva rapidamente quem é esta marca, seu posicionamento, público, foco e diferenciais. Este resumo será lido pela equipe antes de executar qualquer demanda."
              value={data.resumo_executivo || ''}
              onChange={e => setTop('resumo_executivo', e.target.value)}
            />
          </Card>

          {/* Responsável */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Responsável Voxx" value={data.responsavel_nome} onChange={v => setTop('responsavel_nome', v)} placeholder="Nome do responsável" />
            <Field label="Email do responsável" value={data.responsavel_voxx} onChange={v => setTop('responsavel_voxx', v)} placeholder="email@voxx.com" />
          </div>

          {/* Abas */}
          <Tabs defaultValue="visao_geral">
            <TabsList className="grid w-full grid-cols-7 text-[10px]">
              <TabsTrigger value="visao_geral" className="text-[10px] gap-1"><Eye className="w-3 h-3 hidden sm:block" />Visão Geral</TabsTrigger>
              <TabsTrigger value="criacao" className="text-[10px] gap-1"><Palette className="w-3 h-3 hidden sm:block" />Criação</TabsTrigger>
              <TabsTrigger value="meta_ads" className="text-[10px] gap-1"><Target className="w-3 h-3 hidden sm:block" />Meta Ads</TabsTrigger>
              <TabsTrigger value="google_ads" className="text-[10px] gap-1"><Globe className="w-3 h-3 hidden sm:block" />Google</TabsTrigger>
              <TabsTrigger value="comercial" className="text-[10px] gap-1"><ShoppingBag className="w-3 h-3 hidden sm:block" />Comercial</TabsTrigger>
              <TabsTrigger value="restricoes" className="text-[10px] gap-1 text-red-600 data-[state=active]:text-red-700"><ShieldAlert className="w-3 h-3 hidden sm:block" />Restrições</TabsTrigger>
              <TabsTrigger value="assets" className="text-[10px] gap-1"><Folder className="w-3 h-3 hidden sm:block" />Assets</TabsTrigger>
            </TabsList>

            {/* ── VISÃO GERAL ── */}
            <TabsContent value="visao_geral" className="mt-4 space-y-4">
              <SectionGrid>
                <Field label="Segmento" value={data.visao_geral?.segmento} onChange={v => set('visao_geral','segmento',v)} placeholder="Ex: Odontologia, Clínica médica…" />
                <Field label="Cidade" value={data.visao_geral?.cidade} onChange={v => set('visao_geral','cidade',v)} placeholder="Cidade de atuação" />
                <Field label="Público principal" value={data.visao_geral?.publico_principal} onChange={v => set('visao_geral','publico_principal',v)} placeholder="Ex: Mulheres 30-55, classe B/C…" />
                <Field label="Principal produto/serviço" value={data.visao_geral?.produto_principal} onChange={v => set('visao_geral','produto_principal',v)} placeholder="Ex: Implante dentário, harmonização…" />
                <Field label="Tom da marca" value={data.visao_geral?.tom_marca} onChange={v => set('visao_geral','tom_marca',v)} placeholder="Ex: Formal, acolhedor, especialista…" />
                <Field label="Objetivo atual" value={data.visao_geral?.objetivo_atual} onChange={v => set('visao_geral','objetivo_atual',v)} placeholder="Ex: Gerar leads, aumentar visibilidade…" />
              </SectionGrid>
              <Field label="Posicionamento" value={data.visao_geral?.posicionamento} onChange={v => set('visao_geral','posicionamento',v)} multiline placeholder="Como a marca quer ser percebida pelo mercado?" />
              <Field label="Diferencial principal" value={data.visao_geral?.diferencial_principal} onChange={v => set('visao_geral','diferencial_principal',v)} multiline placeholder="O que faz esta marca única em relação à concorrência?" />
              <Field label="História da marca" value={data.visao_geral?.historia_marca} onChange={v => set('visao_geral','historia_marca',v)} multiline placeholder="Conte a história e contexto da marca..." />
              <Field label="Observações gerais" value={data.visao_geral?.observacoes} onChange={v => set('visao_geral','observacoes',v)} multiline placeholder="Notas adicionais importantes para a equipe..." />
            </TabsContent>

            {/* ── CRIAÇÃO ── */}
            <TabsContent value="criacao" className="mt-4 space-y-4">
              <SectionGrid>
                <Field label="Tom de comunicação" value={data.criacao?.tom_comunicacao} onChange={v => set('criacao','tom_comunicacao',v)} placeholder="Ex: Informativo, emocional, técnico…" />
                <Field label="Posicionamento visual" value={data.criacao?.posicionamento_visual} onChange={v => set('criacao','posicionamento_visual',v)} placeholder="Ex: Minimalista, clean, colorido…" />
                <Field label="Paleta de cores" value={data.criacao?.paleta_cores} onChange={v => set('criacao','paleta_cores',v)} placeholder="Ex: Azul #1A3C6E, Branco, Dourado…" />
                <Field label="Estilo desejado" value={data.criacao?.estilo_desejado} onChange={v => set('criacao','estilo_desejado',v)} placeholder="Ex: Médico/tecnológico, luxo, acolhedor…" />
                <Field label="Continuidade visual" value={data.criacao?.continuidade_visual} onChange={v => set('criacao','continuidade_visual',v)} placeholder="Padrões visuais já estabelecidos…" />
                <Field label="Singularidade da marca" value={data.criacao?.singularidade_marca} onChange={v => set('criacao','singularidade_marca',v)} placeholder="Elementos únicos e exclusivos da marca…" />
              </SectionGrid>
              <Field label="Direção de arte" value={data.criacao?.direcao_arte} onChange={v => set('criacao','direcao_arte',v)} multiline placeholder="Como devem ser as peças criativas? Referências visuais, estilo, abordagem…" />
              <Field label="Inspirações" value={data.criacao?.inspiracoes} onChange={v => set('criacao','inspiracoes',v)} multiline placeholder="Links ou descrição de referências inspiradoras…" />
              <Field label="Limitações criativas" value={data.criacao?.limitacoes_criativas} onChange={v => set('criacao','limitacoes_criativas',v)} multiline placeholder="O que NÃO pode ser feito criativamente…" />
              <Field label="Links de referências" value={data.criacao?.referencias} onChange={v => set('criacao','referencias',v)} multiline placeholder="URLs de referências, pastas Drive, etc…" />

              {/* Imagens de referência */}
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Imagens de referência</label>
                <ImagensReferencia
                  imagens={data.criacao?.imagens_referencia || []}
                  onChange={arr => set('criacao', 'imagens_referencia', arr)}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Qtd. Artes/mês" value={data.criacao?.qtd_artes} onChange={v => set('criacao','qtd_artes',Number(v))} placeholder="0" />
                <Field label="Qtd. Vídeos/mês" value={data.criacao?.qtd_videos} onChange={v => set('criacao','qtd_videos',Number(v))} placeholder="0" />
                <Field label="Qtd. Roteiros/mês" value={data.criacao?.qtd_roteiros} onChange={v => set('criacao','qtd_roteiros',Number(v))} placeholder="0" />
                <Field label="Demandas extras" value={data.criacao?.demandas_extras} onChange={v => set('criacao','demandas_extras',v)} placeholder="Descreva extras…" />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={!!data.criacao?.lp_inclusa} onChange={e => set('criacao','lp_inclusa',e.target.checked)} className="accent-violet-600" />
                  LP inclusa no plano
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={!!data.criacao?.trafego_ativo} onChange={e => set('criacao','trafego_ativo',e.target.checked)} className="accent-violet-600" />
                  Tráfego ativo
                </label>
              </div>
              <SectionGrid>
                <Field label="URL Manual de Marca" value={data.criacao?.manual_marca_url} onChange={v => set('criacao','manual_marca_url',v)} placeholder="https://..." />
                <Field label="URL Banco de Imagens" value={data.criacao?.banco_imagens_url} onChange={v => set('criacao','banco_imagens_url',v)} placeholder="https://..." />
              </SectionGrid>
            </TabsContent>

            {/* ── META ADS ── */}
            <TabsContent value="meta_ads" className="mt-4 space-y-4">
              <SectionGrid>
                <Field label="Público-alvo" value={data.meta_ads?.publico_alvo} onChange={v => set('meta_ads','publico_alvo',v)} placeholder="Ex: Mulheres 30-55, renda B…" />
                <Field label="ICP (Perfil ideal do cliente)" value={data.meta_ads?.icp} onChange={v => set('meta_ads','icp',v)} placeholder="Quem é o cliente perfeito?" />
                <Field label="Faixa etária" value={data.meta_ads?.faixa_etaria} onChange={v => set('meta_ads','faixa_etaria',v)} placeholder="Ex: 25-45 anos" />
                <Field label="Ticket médio" value={data.meta_ads?.ticket_medio} onChange={v => set('meta_ads','ticket_medio',v)} placeholder="Ex: R$ 2.500 a R$ 8.000" />
                <Field label="Foco atual de campanha" value={data.meta_ads?.foco_campanha} onChange={v => set('meta_ads','foco_campanha',v)} placeholder="Ex: Leads para implante, captação local…" />
                <Field label="Tipos de campanha" value={data.meta_ads?.tipos_campanha} onChange={v => set('meta_ads','tipos_campanha',v)} placeholder="Ex: Conversão, alcance, remarketing…" />
              </SectionGrid>
              <Field label="Principais tratamentos/serviços a divulgar" value={data.meta_ads?.principais_tratamentos} onChange={v => set('meta_ads','principais_tratamentos',v)} multiline placeholder="Liste os serviços mais importantes para divulgar…" />
              <Field label="Objeções dos leads" value={data.meta_ads?.objecoes} onChange={v => set('meta_ads','objecoes',v)} multiline placeholder="Por que os leads não convertem? O que eles dizem?…" />
              <Field label="Diferenciais para comunicar" value={data.meta_ads?.diferenciais} onChange={v => set('meta_ads','diferenciais',v)} multiline placeholder="O que destacar nos anúncios?…" />
              <SectionGrid>
                <Field label="Regiões de segmentação" value={data.meta_ads?.regioes} onChange={v => set('meta_ads','regioes',v)} multiline placeholder="Cidades, bairros, raio…" />
                <Field label="Metas (CPL, leads/mês)" value={data.meta_ads?.metas} onChange={v => set('meta_ads','metas',v)} multiline placeholder="Ex: CPL < R$25, 80 leads/mês…" />
                <Field label="Concorrentes" value={data.meta_ads?.concorrentes} onChange={v => set('meta_ads','concorrentes',v)} multiline placeholder="Principais concorrentes na região…" />
                <Field label="Restrições Meta Ads" value={data.meta_ads?.restricoes} onChange={v => set('meta_ads','restricoes',v)} multiline placeholder="Termos, imagens ou abordagens bloqueadas…" />
              </SectionGrid>
              <Field label="Observações estratégicas" value={data.meta_ads?.observacoes} onChange={v => set('meta_ads','observacoes',v)} multiline placeholder="Contexto estratégico adicional para as campanhas…" />
            </TabsContent>

            {/* ── GOOGLE ADS ── */}
            <TabsContent value="google_ads" className="mt-4 space-y-4">
              <Field label="Principais buscas (palavras-chave)" value={data.google_ads?.principais_buscas} onChange={v => set('google_ads','principais_buscas',v)} multiline placeholder="Ex: clínica odontológica, implante dentário…" />
              <SectionGrid>
                <Field label="Tratamentos prioritários" value={data.google_ads?.tratamentos_prioritarios} onChange={v => set('google_ads','tratamentos_prioritarios',v)} multiline placeholder="Quais tratamentos priorizar no Google?…" />
                <Field label="Cidades foco" value={data.google_ads?.cidades_foco} onChange={v => set('google_ads','cidades_foco',v)} multiline placeholder="Onde focar as campanhas?…" />
                <Field label="Concorrentes" value={data.google_ads?.concorrentes} onChange={v => set('google_ads','concorrentes',v)} multiline placeholder="Quem disputa os mesmos termos?…" />
                <Field label="Diferenciais de busca" value={data.google_ads?.diferenciais} onChange={v => set('google_ads','diferenciais',v)} multiline placeholder="Por que escolher este cliente ao buscar?…" />
                <Field label="Palavras estratégicas" value={data.google_ads?.palavras_estrategicas} onChange={v => set('google_ads','palavras_estrategicas',v)} multiline placeholder="Palavras que convertem bem…" />
                <Field label="Palavras proibidas" value={data.google_ads?.palavras_proibidas} onChange={v => set('google_ads','palavras_proibidas',v)} multiline placeholder="Palavras que NÃO devem aparecer…" />
                <Field label="Foco comercial" value={data.google_ads?.foco_comercial} onChange={v => set('google_ads','foco_comercial',v)} placeholder="Ex: Implante, ortodontia, estética…" />
                <Field label="Urgência comercial" value={data.google_ads?.urgencia_comercial} onChange={v => set('google_ads','urgencia_comercial',v)} placeholder="Ex: Alta — precisa de leads imediatamente" />
              </SectionGrid>
              <Field label="Restrições Google Ads" value={data.google_ads?.restricoes} onChange={v => set('google_ads','restricoes',v)} multiline placeholder="Limitações específicas das políticas do Google para este cliente…" />
              <Field label="Observações estratégicas" value={data.google_ads?.observacoes} onChange={v => set('google_ads','observacoes',v)} multiline placeholder="Contexto e estratégia adicional para o Google…" />
            </TabsContent>

            {/* ── COMERCIAL ── */}
            <TabsContent value="comercial" className="mt-4 space-y-4">
              <SectionGrid>
                <Field label="Objeções comuns" value={data.comercial?.objecoes} onChange={v => set('comercial','objecoes',v)} multiline placeholder="Por que os leads não fecham?…" />
                <Field label="Perfil ideal do cliente" value={data.comercial?.perfil_ideal} onChange={v => set('comercial','perfil_ideal',v)} multiline placeholder="Quem é o melhor cliente para esta clínica?…" />
                <Field label="Dificuldades comerciais" value={data.comercial?.dificuldades} onChange={v => set('comercial','dificuldades',v)} multiline placeholder="Principais dificuldades do time comercial…" />
                <Field label="Gargalos de atendimento" value={data.comercial?.gargalos_atendimento} onChange={v => set('comercial','gargalos_atendimento',v)} multiline placeholder="Onde a venda trava com mais frequência?…" />
                <Field label="Principais dores dos pacientes" value={data.comercial?.dores_pacientes} onChange={v => set('comercial','dores_pacientes',v)} multiline placeholder="O que mais preocupa / motiva os pacientes?…" />
                <Field label="Argumentos de venda" value={data.comercial?.argumentos_venda} onChange={v => set('comercial','argumentos_venda',v)} multiline placeholder="O que mais convence os leads?…" />
                <Field label="Diferenciais comerciais" value={data.comercial?.diferenciais} onChange={v => set('comercial','diferenciais',v)} multiline placeholder="Por que fechar com este cliente?…" />
                <Field label="Tempo médio de resposta" value={data.comercial?.tempo_resposta} onChange={v => set('comercial','tempo_resposta',v)} placeholder="Ex: 30 minutos, imediato…" />
              </SectionGrid>
              <Field label="Taxa de fechamento (opcional)" value={data.comercial?.taxa_fechamento} onChange={v => set('comercial','taxa_fechamento',v)} placeholder="Ex: ~30% dos leads chegam a agendar" />
              <Field label="Observações comerciais" value={data.comercial?.observacoes} onChange={v => set('comercial','observacoes',v)} multiline placeholder="Contexto adicional sobre o processo comercial…" />
            </TabsContent>

            {/* ── RESTRIÇÕES ── */}
            <TabsContent value="restricoes" className="mt-4 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-600 font-medium">
                  Esta aba define os limites da marca. Toda a equipe deve consultar antes de executar qualquer criação, copy ou campanha. Informações incompletas aqui geram retrabalho.
                </p>
              </div>
              <Field label="O que NÃO pode ser feito" value={data.restricoes?.nao_fazer} onChange={v => set('restricoes','nao_fazer',v)} multiline placeholder="Liste tudo que é proibido fazer para este cliente…" />
              <SectionGrid>
                <Field label="Termos proibidos" value={data.restricoes?.termos_proibidos} onChange={v => set('restricoes','termos_proibidos',v)} multiline placeholder="Palavras e expressões que não podem aparecer…" />
                <Field label="Estilos proibidos" value={data.restricoes?.estilos_proibidos} onChange={v => set('restricoes','estilos_proibidos',v)} multiline placeholder="Estilos visuais e abordagens criativas proibidas…" />
                <Field label="Limitações jurídicas" value={data.restricoes?.limitacoes_juridicas} onChange={v => set('restricoes','limitacoes_juridicas',v)} multiline placeholder="Restrições do CFM, CRO, CADE, ANVISA…" />
                <Field label="Limitações de design" value={data.restricoes?.limitacoes_design} onChange={v => set('restricoes','limitacoes_design',v)} multiline placeholder="Elementos de design que devem ser evitados…" />
                <Field label="Restrições de copy" value={data.restricoes?.restricoes_copy} onChange={v => set('restricoes','restricoes_copy',v)} multiline placeholder="Tom, linguagem ou frases que NÃO podem ser usadas…" />
                <Field label="Restrições comerciais" value={data.restricoes?.restricoes_comerciais} onChange={v => set('restricoes','restricoes_comerciais',v)} multiline placeholder="Ofertas, preços ou abordagens comerciais proibidas…" />
                <Field label="Limitações de tráfego" value={data.restricoes?.limitacoes_trafego} onChange={v => set('restricoes','limitacoes_trafego',v)} multiline placeholder="Restrições de segmentação, criativos, CTA para tráfego…" />
                <Field label="Palavras proibidas (tráfego)" value={data.restricoes?.palavras_proibidas} onChange={v => set('restricoes','palavras_proibidas',v)} multiline placeholder="Palavras proibidas especificamente para anúncios…" />
              </SectionGrid>
              <Field label="Observações críticas" value={data.restricoes?.observacoes_criticas} onChange={v => set('restricoes','observacoes_criticas',v)} multiline placeholder="Alertas críticos que toda a equipe precisa saber sobre este cliente…" />
            </TabsContent>

            {/* ── ASSETS ── */}
            <TabsContent value="assets" className="mt-4 space-y-4">
              <p className="text-xs text-slate-500">Centralize todos os links e materiais da marca aqui para acesso rápido da equipe.</p>
              <SectionGrid>
                <Field label="Link Google Drive" value={data.assets?.link_drive} onChange={v => set('assets','link_drive',v)} placeholder="https://drive.google.com/..." />
                <Field label="Link Dropbox" value={data.assets?.link_dropbox} onChange={v => set('assets','link_dropbox',v)} placeholder="https://www.dropbox.com/..." />
                <Field label="Manual de Marca (URL)" value={data.assets?.manual_marca_url} onChange={v => set('assets','manual_marca_url',v)} placeholder="https://..." />
                <Field label="Banco de Imagens (URL)" value={data.assets?.banco_imagens_url} onChange={v => set('assets','banco_imagens_url',v)} placeholder="https://..." />
                <Field label="Vídeos (URL / pasta)" value={data.assets?.videos_url} onChange={v => set('assets','videos_url',v)} placeholder="https://..." />
              </SectionGrid>
              {/* Links extras */}
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Links adicionais</label>
                <div className="space-y-2">
                  {(data.assets?.outros_links || []).map((link, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="flex-1 border border-slate-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
                        placeholder="Label (ex: Pasta Criação)"
                        value={link.label || ''}
                        onChange={e => {
                          const arr = [...(data.assets?.outros_links || [])];
                          arr[i] = { ...arr[i], label: e.target.value };
                          set('assets', 'outros_links', arr);
                        }}
                      />
                      <input
                        className="flex-[2] border border-slate-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
                        placeholder="https://..."
                        value={link.url || ''}
                        onChange={e => {
                          const arr = [...(data.assets?.outros_links || [])];
                          arr[i] = { ...arr[i], url: e.target.value };
                          set('assets', 'outros_links', arr);
                        }}
                      />
                      <button
                        onClick={() => {
                          const arr = (data.assets?.outros_links || []).filter((_, j) => j !== i);
                          set('assets', 'outros_links', arr);
                        }}
                        className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => set('assets', 'outros_links', [...(data.assets?.outros_links || []), { label: '', url: '' }])}
                    className="text-xs h-7 gap-1"
                  >
                    <Plus className="w-3 h-3" /> Adicionar link
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer info */}
          {data.atualizado_por_nome && (
            <p className="text-[10px] text-slate-400 text-right">
              Última atualização por {data.atualizado_por_nome}
              {data.updated_date ? ` em ${format(new Date(data.updated_date), 'dd/MM/yyyy HH:mm')}` : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}