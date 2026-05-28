import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Edit2, AlertTriangle, CheckCircle2, Zap, ShieldAlert,
  Palette, Target, Globe, ShoppingBag, Folder, Eye, MapPin, User,
  Calendar, ExternalLink, BookOpen, Star, TrendingUp, Lightbulb,
  CheckSquare, XCircle, Image, FileText, Link2, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calcBriefingScore } from './BriefingClientes';
import BriefingDetalheModal from '@/components/briefing/BriefingDetalheModal';

// ─── Helpers ───────────────────────────────────────────────────────────────

function scoreLabel(score) {
  if (score >= 90) return { label: 'Completo', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
  if (score >= 75) return { label: 'Bom', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' };
  if (score >= 50) return { label: 'Parcial', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };
  return { label: 'Crítico', color: 'text-red-600', bg: 'bg-red-50 border-red-200' };
}

const STATUS_CONFIG = {
  rascunho:     { label: 'Rascunho',      color: 'bg-slate-100 text-slate-600' },
  em_andamento: { label: 'Em andamento',  color: 'bg-blue-100 text-blue-700' },
  completo:     { label: 'Completo',      color: 'bg-emerald-100 text-emerald-700' },
  desatualizado:{ label: 'Desatualizado', color: 'bg-amber-100 text-amber-700' },
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function ScoreRing({ score }) {
  const { label, color } = scoreLabel(score);
  const strokeColor = score >= 90 ? '#10b981' : score >= 75 ? '#3b82f6' : score >= 50 ? '#f59e0b' : '#ef4444';
  const circumference = 2 * Math.PI * 20;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 50 50" className="w-16 h-16 -rotate-90">
          <circle cx="25" cy="25" r="20" fill="none" stroke="#f1f5f9" strokeWidth="4" />
          <circle cx="25" cy="25" r="20" fill="none" stroke={strokeColor} strokeWidth="4"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-800">{score}%</span>
      </div>
      <span className={`text-xs font-semibold ${color}`}>{label}</span>
    </div>
  );
}

function InfoChip({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-1.5 text-sm text-slate-600">
      <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      <span className="text-slate-400 text-xs">{label}:</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}

function InfoCard({ label, value, icon: Icon }) {
  if (!value) return null;
  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className="w-3 h-3 text-slate-400" />}
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function SectionGrid({ children }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>;
}

function AlertasBriefing({ b }) {
  const alertas = [];
  if (!b?.visao_geral?.publico_principal) alertas.push({ text: 'Público-alvo não definido', key: 'publico' });
  if (!b?.visao_geral?.posicionamento) alertas.push({ text: 'Posicionamento da marca ausente', key: 'posicionamento' });
  if (!b?.restricoes?.nao_fazer) alertas.push({ text: 'Restrições da marca não preenchidas', key: 'restricoes' });
  if (!b?.assets?.link_drive && !b?.assets?.link_dropbox && !b?.assets?.manual_marca_url) alertas.push({ text: 'Nenhum asset/material cadastrado', key: 'assets' });
  if (!b?.meta_ads?.publico_alvo) alertas.push({ text: 'Briefing Meta Ads incompleto', key: 'meta' });
  if (!b?.google_ads?.principais_buscas) alertas.push({ text: 'Briefing Google Ads incompleto', key: 'google' });
  if (!b?.criacao?.direcao_arte) alertas.push({ text: 'Direção de arte não definida', key: 'arte' });
  if (alertas.length === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <p className="text-xs font-bold text-amber-700 mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> {alertas.length} campo{alertas.length > 1 ? 's' : ''} importante{alertas.length > 1 ? 's' : ''} em falta
      </p>
      <div className="flex flex-wrap gap-2">
        {alertas.map(a => (
          <span key={a.key} className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" /> {a.text}
          </span>
        ))}
      </div>
    </div>
  );
}

function AssetLink({ label, url, icon: Icon }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50 transition-all group">
      <div className="w-8 h-8 bg-slate-100 group-hover:bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
        <Icon className="w-4 h-4 text-slate-500 group-hover:text-violet-600" />
      </div>
      <span className="text-sm font-medium text-slate-700 group-hover:text-violet-700 flex-1 truncate">{label}</span>
      <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-400 flex-shrink-0" />
    </a>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function BriefingVisualizacao({ user }) {
  const params = new URLSearchParams(window.location.search);
  const clienteId = params.get('clienteId');
  const qc = useQueryClient();
  const [editModal, setEditModal] = useState(false);

  const { data: cliente } = useQuery({
    queryKey: ['cliente_bv', clienteId],
    queryFn: () => base44.entities.Cliente.get(clienteId),
    enabled: !!clienteId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: briefing, isLoading } = useQuery({
    queryKey: ['briefing_bv', clienteId],
    queryFn: async () => {
      const list = await base44.entities.BriefingCliente.filter({ cliente_id: clienteId });
      return list[0] || null;
    },
    enabled: !!clienteId,
    staleTime: 2 * 60 * 1000,
  });

  const createBriefing = useMutation({
    mutationFn: (data) => base44.entities.BriefingCliente.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['briefing_bv', clienteId] }),
  });

  const score = calcBriefingScore(briefing);
  const { bg: scoreBg } = scoreLabel(score);
  const stConfig = STATUS_CONFIG[briefing?.status_briefing || 'rascunho'];

  const handleEdit = async () => {
    if (!briefing && cliente) {
      await createBriefing.mutateAsync({
        cliente_id: cliente.id,
        cliente_nome: cliente.nome,
        status_briefing: 'rascunho',
        responsavel_voxx: user?.email || '',
        responsavel_nome: user?.full_name || '',
      });
    }
    setEditModal(true);
  };

  if (!clienteId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-slate-400">Cliente não especificado.</p>
      </div>
    );
  }

  if (isLoading || !cliente) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  const b = briefing;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── BREADCRUMB ── */}
      <div className="flex items-center gap-2 text-sm">
        <a href="/BriefingClientes" className="flex items-center gap-1 text-slate-400 hover:text-violet-600 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Briefing Clientes
        </a>
        <span className="text-slate-200">/</span>
        <span className="text-slate-600 font-medium">{cliente.nome}</span>
      </div>

      {/* ── HERO HEADER ── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-violet-900 rounded-2xl p-6 lg:p-8 text-white">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-6 h-6 text-violet-300" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">{cliente.nome}</h1>
                {cliente.marca && <p className="text-slate-300 text-sm">{cliente.marca}</p>}
              </div>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
              <InfoChip icon={MapPin} label="Cidade" value={`${cliente.cidade}${cliente.estado ? `, ${cliente.estado}` : ''}`} />
              <InfoChip icon={Star} label="Segmento" value={b?.visao_geral?.segmento || cliente.plano_servico} />
              <InfoChip icon={User} label="Responsável" value={b?.responsavel_nome || cliente.responsavel_voxx_cs} />
              {b?.updated_date && (
                <InfoChip icon={Calendar} label="Atualizado em"
                  value={format(new Date(b.updated_date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })} />
              )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="bg-white/10 rounded-2xl px-5 py-4 flex items-center gap-4 backdrop-blur border border-white/10">
              <ScoreRing score={score} />
              <div>
                <p className="text-xs text-slate-400 mb-1">Status do briefing</p>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${stConfig.color}`}>{stConfig.label}</span>
              </div>
            </div>

            <Button onClick={handleEdit} className="bg-white text-slate-900 hover:bg-violet-50 h-10 gap-2 font-semibold flex-shrink-0">
              <Edit2 className="w-4 h-4" /> Editar Briefing
            </Button>
          </div>
        </div>
      </div>

      {/* ── ALERTAS ── */}
      {b && <AlertasBriefing b={b} />}

      {/* ── RESUMO EXECUTIVO ── */}
      {b?.resumo_executivo && (
        <Card className="p-6 bg-gradient-to-br from-violet-50 via-white to-indigo-50 border-violet-200">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <Zap className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-violet-800 mb-2 uppercase tracking-wide">Resumo Estratégico da Marca</h2>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{b.resumo_executivo}</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── DNA DA MARCA + BOAS PRÁTICAS + RESTRIÇÕES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* DNA da Marca */}
        <Card className="p-5 border-violet-100 bg-gradient-to-b from-violet-50 to-white lg:col-span-1">
          <h3 className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <div className="w-5 h-5 bg-violet-100 rounded flex items-center justify-center">
              <TrendingUp className="w-3 h-3 text-violet-600" />
            </div>
            DNA da Marca
          </h3>
          <div className="space-y-3">
            {b?.visao_geral?.posicionamento && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Quem é</p>
                <p className="text-xs text-slate-700 leading-relaxed">{b.visao_geral.posicionamento}</p>
              </div>
            )}
            {b?.visao_geral?.tom_marca && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Como comunicar</p>
                <p className="text-xs text-slate-700">{b.visao_geral.tom_marca}</p>
              </div>
            )}
            {b?.visao_geral?.diferencial_principal && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Diferencial</p>
                <p className="text-xs text-slate-700 leading-relaxed">{b.visao_geral.diferencial_principal}</p>
              </div>
            )}
            {b?.visao_geral?.objetivo_atual && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Prioridade atual</p>
                <p className="text-xs text-violet-700 font-semibold">{b.visao_geral.objetivo_atual}</p>
              </div>
            )}
            {!b?.visao_geral?.posicionamento && !b?.visao_geral?.tom_marca && (
              <p className="text-xs text-slate-400 italic">Preencha a Visão Geral para ver o DNA da marca aqui.</p>
            )}
          </div>
        </Card>

        {/* Boas Práticas */}
        <Card className="p-5 border-emerald-200 bg-gradient-to-b from-emerald-50 to-white">
          <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <div className="w-5 h-5 bg-emerald-100 rounded flex items-center justify-center">
              <CheckSquare className="w-3 h-3 text-emerald-600" />
            </div>
            Boas Práticas da Marca
          </h3>
          <div className="space-y-2.5">
            {[
              { label: 'Tom aprovado', value: b?.criacao?.tom_comunicacao },
              { label: 'Direção visual', value: b?.criacao?.posicionamento_visual },
              { label: 'Estilo', value: b?.criacao?.estilo_desejado },
              { label: 'Inspirações', value: b?.criacao?.inspiracoes },
              { label: 'Diferenciais a destacar', value: b?.meta_ads?.diferenciais || b?.visao_geral?.diferencial_principal },
            ].filter(x => x.value).map((item) => (
              <div key={item.label} className="flex gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-bold text-emerald-600">{item.label}: </span>
                  <span className="text-xs text-slate-700">{item.value}</span>
                </div>
              </div>
            ))}
            {!b?.criacao?.tom_comunicacao && !b?.criacao?.posicionamento_visual && (
              <p className="text-xs text-slate-400 italic">Preencha Criação para ver boas práticas aqui.</p>
            )}
          </div>
        </Card>

        {/* Restrições */}
        <Card className="p-5 border-red-200 bg-gradient-to-b from-red-50 to-white">
          <h3 className="text-xs font-bold text-red-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <div className="w-5 h-5 bg-red-100 rounded flex items-center justify-center">
              <ShieldAlert className="w-3 h-3 text-red-600" />
            </div>
            Restrições da Marca
          </h3>
          <div className="space-y-2.5">
            {[
              { label: 'Não fazer', value: b?.restricoes?.nao_fazer },
              { label: 'Termos proibidos', value: b?.restricoes?.termos_proibidos },
              { label: 'Limitações jurídicas', value: b?.restricoes?.limitacoes_juridicas },
              { label: 'Restrições de copy', value: b?.restricoes?.restricoes_copy },
              { label: 'Obs. críticas', value: b?.restricoes?.observacoes_criticas },
            ].filter(x => x.value).map((item) => (
              <div key={item.label} className="flex gap-2">
                <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-bold text-red-600">{item.label}: </span>
                  <span className="text-xs text-slate-700">{item.value}</span>
                </div>
              </div>
            ))}
            {!b?.restricoes?.nao_fazer && (
              <div className="flex items-start gap-2 p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-600 font-medium">Restrições não preenchidas — risco de retrabalho.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── ABAS DETALHADAS ── */}
      <Tabs defaultValue="visao_geral" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 p-1 rounded-xl w-full">
          {[
            { value: 'visao_geral', icon: Eye, label: 'Visão Geral' },
            { value: 'criacao', icon: Palette, label: 'Criação' },
            { value: 'meta_ads', icon: Target, label: 'Meta Ads' },
            { value: 'google_ads', icon: Globe, label: 'Google Ads' },
            { value: 'comercial', icon: ShoppingBag, label: 'Comercial' },
            { value: 'assets', icon: Folder, label: 'Assets' },
          ].map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}
              className="flex items-center gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm flex-1 min-w-[80px]">
              <tab.icon className="w-3.5 h-3.5" /> {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* VISÃO GERAL */}
        <TabsContent value="visao_geral" className="mt-4">
          <div className="space-y-4">
            <SectionGrid>
              <InfoCard label="Segmento" value={b?.visao_geral?.segmento} icon={Star} />
              <InfoCard label="Público principal" value={b?.visao_geral?.publico_principal} icon={User} />
              <InfoCard label="Principal produto/serviço" value={b?.visao_geral?.produto_principal} icon={Lightbulb} />
              <InfoCard label="Tom da marca" value={b?.visao_geral?.tom_marca} icon={Zap} />
              <InfoCard label="Objetivo atual" value={b?.visao_geral?.objetivo_atual} icon={TrendingUp} />
              <InfoCard label="Cidade" value={b?.visao_geral?.cidade || cliente.cidade} icon={MapPin} />
            </SectionGrid>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard label="Posicionamento" value={b?.visao_geral?.posicionamento} />
              <InfoCard label="Diferencial principal" value={b?.visao_geral?.diferencial_principal} />
              <InfoCard label="História da marca" value={b?.visao_geral?.historia_marca} />
              <InfoCard label="Observações gerais" value={b?.visao_geral?.observacoes} />
            </div>
          </div>
        </TabsContent>

        {/* CRIAÇÃO */}
        <TabsContent value="criacao" className="mt-4">
          <div className="space-y-4">
            <SectionGrid>
              <InfoCard label="Tom de comunicação" value={b?.criacao?.tom_comunicacao} />
              <InfoCard label="Posicionamento visual" value={b?.criacao?.posicionamento_visual} />
              <InfoCard label="Paleta de cores" value={b?.criacao?.paleta_cores} />
              <InfoCard label="Estilo desejado" value={b?.criacao?.estilo_desejado} />
              <InfoCard label="Continuidade visual" value={b?.criacao?.continuidade_visual} />
              <InfoCard label="Singularidade da marca" value={b?.criacao?.singularidade_marca} />
            </SectionGrid>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard label="Direção de arte" value={b?.criacao?.direcao_arte} />
              <InfoCard label="Inspirações" value={b?.criacao?.inspiracoes} />
              <InfoCard label="Limitações criativas" value={b?.criacao?.limitacoes_criativas} />
              <InfoCard label="Links de referências" value={b?.criacao?.referencias} />
            </div>

            {/* Estrutura contratada */}
            <Card className="p-4 bg-slate-50 border-slate-200">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Estrutura Contratada</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Artes/mês', value: b?.criacao?.qtd_artes },
                  { label: 'Vídeos/mês', value: b?.criacao?.qtd_videos },
                  { label: 'Roteiros/mês', value: b?.criacao?.qtd_roteiros },
                  { label: 'Demandas extras', value: b?.criacao?.demandas_extras },
                ].map(item => (
                  <div key={item.label} className="bg-white rounded-lg p-3 border border-slate-200 text-center">
                    <p className="text-2xl font-bold text-slate-800">{item.value ?? '—'}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-3">
                <div className={`flex items-center gap-1.5 text-xs ${b?.criacao?.lp_inclusa ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {b?.criacao?.lp_inclusa ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  LP inclusa
                </div>
                <div className={`flex items-center gap-1.5 text-xs ${b?.criacao?.trafego_ativo ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {b?.criacao?.trafego_ativo ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  Tráfego ativo
                </div>
              </div>
            </Card>

            {/* Imagens de referência */}
            {b?.criacao?.imagens_referencia?.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Imagens de Referência</h4>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {b.criacao.imagens_referencia.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-violet-300 transition-colors block">
                      <img src={url} alt={`ref-${i}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* META ADS */}
        <TabsContent value="meta_ads" className="mt-4">
          <div className="space-y-4">
            <SectionGrid>
              <InfoCard label="Público-alvo" value={b?.meta_ads?.publico_alvo} />
              <InfoCard label="ICP" value={b?.meta_ads?.icp} />
              <InfoCard label="Faixa etária" value={b?.meta_ads?.faixa_etaria} />
              <InfoCard label="Ticket médio" value={b?.meta_ads?.ticket_medio} />
              <InfoCard label="Foco de campanha" value={b?.meta_ads?.foco_campanha} />
              <InfoCard label="Tipos de campanha" value={b?.meta_ads?.tipos_campanha} />
            </SectionGrid>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard label="Principais tratamentos" value={b?.meta_ads?.principais_tratamentos} />
              <InfoCard label="Objeções dos leads" value={b?.meta_ads?.objecoes} />
              <InfoCard label="Diferenciais para comunicar" value={b?.meta_ads?.diferenciais} />
              <InfoCard label="Regiões de segmentação" value={b?.meta_ads?.regioes} />
              <InfoCard label="Metas (CPL, leads/mês)" value={b?.meta_ads?.metas} />
              <InfoCard label="Concorrentes" value={b?.meta_ads?.concorrentes} />
              <InfoCard label="Restrições Meta Ads" value={b?.meta_ads?.restricoes} />
              <InfoCard label="Observações estratégicas" value={b?.meta_ads?.observacoes} />
            </div>
          </div>
        </TabsContent>

        {/* GOOGLE ADS */}
        <TabsContent value="google_ads" className="mt-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard label="Principais buscas" value={b?.google_ads?.principais_buscas} />
              <InfoCard label="Tratamentos prioritários" value={b?.google_ads?.tratamentos_prioritarios} />
              <InfoCard label="Cidades foco" value={b?.google_ads?.cidades_foco} />
              <InfoCard label="Concorrentes" value={b?.google_ads?.concorrentes} />
              <InfoCard label="Diferenciais de busca" value={b?.google_ads?.diferenciais} />
              <InfoCard label="Palavras estratégicas" value={b?.google_ads?.palavras_estrategicas} />
              <InfoCard label="Palavras proibidas" value={b?.google_ads?.palavras_proibidas} />
              <InfoCard label="Foco comercial" value={b?.google_ads?.foco_comercial} />
              <InfoCard label="Urgência comercial" value={b?.google_ads?.urgencia_comercial} />
              <InfoCard label="Restrições Google Ads" value={b?.google_ads?.restricoes} />
              <InfoCard label="Observações estratégicas" value={b?.google_ads?.observacoes} />
            </div>
          </div>
        </TabsContent>

        {/* COMERCIAL */}
        <TabsContent value="comercial" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoCard label="Perfil ideal do cliente" value={b?.comercial?.perfil_ideal} />
            <InfoCard label="Principais objeções" value={b?.comercial?.objecoes} />
            <InfoCard label="Dores dos pacientes" value={b?.comercial?.dores_pacientes} />
            <InfoCard label="Argumentos de venda" value={b?.comercial?.argumentos_venda} />
            <InfoCard label="Diferenciais comerciais" value={b?.comercial?.diferenciais} />
            <InfoCard label="Gargalos de atendimento" value={b?.comercial?.gargalos_atendimento} />
            <InfoCard label="Dificuldades comerciais" value={b?.comercial?.dificuldades} />
            <InfoCard label="Tempo médio de resposta" value={b?.comercial?.tempo_resposta} />
            <InfoCard label="Taxa de fechamento" value={b?.comercial?.taxa_fechamento} />
            <InfoCard label="Observações comerciais" value={b?.comercial?.observacoes} />
          </div>
        </TabsContent>

        {/* ASSETS */}
        <TabsContent value="assets" className="mt-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <AssetLink label="Google Drive" url={b?.assets?.link_drive} icon={Folder} />
              <AssetLink label="Dropbox" url={b?.assets?.link_dropbox} icon={Folder} />
              <AssetLink label="Manual de Marca" url={b?.assets?.manual_marca_url || b?.criacao?.manual_marca_url} icon={FileText} />
              <AssetLink label="Banco de Imagens" url={b?.assets?.banco_imagens_url || b?.criacao?.banco_imagens_url} icon={Image} />
              <AssetLink label="Vídeos" url={b?.assets?.videos_url} icon={FileText} />
              {(b?.assets?.outros_links || []).map((link, i) => (
                link.url && <AssetLink key={i} label={link.label || `Link ${i + 1}`} url={link.url} icon={Link2} />
              ))}
            </div>

            {!b?.assets?.link_drive && !b?.assets?.link_dropbox && !b?.assets?.manual_marca_url && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Folder className="w-10 h-10 mb-3 text-slate-200" />
                <p className="text-sm font-medium">Nenhum asset cadastrado</p>
                <p className="text-xs mt-1">Adicione links de materiais editando o briefing.</p>
                <Button onClick={handleEdit} variant="outline" size="sm" className="mt-4 gap-1.5">
                  <Edit2 className="w-3.5 h-3.5" /> Adicionar assets
                </Button>
              </div>
            )}

            {/* Logos */}
            {b?.assets?.logos?.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Logos</h4>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {b.assets.logos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50 hover:border-violet-300 transition-colors flex items-center justify-center">
                      <img src={url} alt={`logo-${i}`} className="w-full h-full object-contain p-2" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── TIMELINE / ÚLTIMA ATUALIZAÇÃO ── */}
      {b?.updated_date && (
        <Card className="p-4 border-slate-100">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" /> Histórico de Atualizações
          </h3>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-violet-400 rounded-full mt-1.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-slate-700">
                <span className="font-medium">{b.atualizado_por_nome || 'Equipe Voxx'}</span> atualizou o briefing
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {format(new Date(b.updated_date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
          {b.created_date && b.created_date !== b.updated_date && (
            <div className="flex items-start gap-3 mt-3 pt-3 border-t border-slate-50">
              <div className="w-2 h-2 bg-slate-300 rounded-full mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-slate-500">Briefing criado</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {format(new Date(b.created_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── EDIT MODAL ── */}
      {editModal && briefing && cliente && (
        <BriefingDetalheModal
          briefing={briefing}
          cliente={cliente}
          user={user}
          onClose={() => setEditModal(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['briefing_bv', clienteId] });
            setEditModal(false);
          }}
        />
      )}
    </div>
  );
}