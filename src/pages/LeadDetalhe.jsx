import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import FitScoreCalculator, { calcularFitScore, FitScoreDisplay } from '@/components/comercial/FitScoreCalculator';
import ProximaAcaoBlock from '@/components/comercial/ProximaAcaoBlock';
import RegistrarInteracaoModal from '@/components/comercial/RegistrarInteracaoModal';
import InteligenciaLeadPanel from '@/components/comercial/InteligenicaLeadPanel';
import { avaliarTriggers, gerarTarefasFollowUp, calcularTemperaturaLead, calcularScorePrioridade } from '@/lib/comercial/inteligencia';
import { isVoxxAdmin, isVoxxOperacao, isVoxxManager } from '@/components/utils/auth';
import { toast } from 'sonner';
import {
  ArrowLeft, Phone, MapPin, User, Clock, DollarSign, Calendar,
  MessageSquare, Plus, CheckSquare, Loader2, ArrowRight,
  FileText, Send, Check, Mail, Users, Target, Zap, AlertTriangle
} from 'lucide-react';
import { format, parseISO, differenceInDays, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ETAPA_LABELS = {
  novo_lead: 'Novo Lead', contato_iniciado: 'Contato Iniciado',
  diagnostico_reuniao: 'Diagnóstico/Reunião', qualificado: 'Qualificado',
  proposta_enviada: 'Proposta Enviada', negociacao: 'Negociação',
  fechado_ganho: 'Fechado (Ganho)', fechado_perdido: 'Fechado (Perdido)'
};
const ETAPAS_ORDER = ['novo_lead','contato_iniciado','diagnostico_reuniao','qualificado','proposta_enviada','negociacao','fechado_ganho','fechado_perdido'];

const PROPOSTA_STATUS_LABEL = {
  nao_enviada: 'Não Enviada', enviada: 'Enviada',
  em_negociacao: 'Em Negociação', aceita: 'Aceita ✓', recusada: 'Recusada'
};

const TIPO_ICONS = {
  ligacao: <Phone className="w-3.5 h-3.5 text-blue-500" />,
  whatsapp: <MessageSquare className="w-3.5 h-3.5 text-green-500" />,
  email: <Mail className="w-3.5 h-3.5 text-indigo-500" />,
  reuniao: <Users className="w-3.5 h-3.5 text-violet-500" />,
  proposta: <FileText className="w-3.5 h-3.5 text-amber-500" />,
  nota: <FileText className="w-3.5 h-3.5 text-slate-400" />,
  status_change: <Target className="w-3.5 h-3.5 text-indigo-400" />,
};

const TABS = [
  { id: 'visao_geral', label: 'Visão Geral' },
  { id: 'interacoes', label: 'Interações' },
  { id: 'reunioes', label: 'Reuniões' },
  { id: 'briefing', label: 'Briefing' },
  { id: 'qualificacao', label: 'Fit Score' },
  { id: 'plano', label: 'Plano de Serviços' },
  { id: 'proposta', label: 'Proposta' },
  { id: 'tarefas', label: 'Tarefas' },
];

function getStatusVisual(lead) {
  if (!lead.ultima_interacao) return { color: 'bg-red-500', label: 'Sem contato', badge: 'bg-red-100 text-red-700' };
  const dias = differenceInDays(new Date(), parseISO(lead.ultima_interacao));
  if (dias <= 3) return { color: 'bg-emerald-500', label: 'Ativo', badge: 'bg-emerald-100 text-emerald-700' };
  if (dias <= 7) return { color: 'bg-amber-400', label: 'Aguardando', badge: 'bg-amber-100 text-amber-700' };
  return { color: 'bg-red-500', label: 'Parado', badge: 'bg-red-100 text-red-700' };
}

export default function LeadDetalhe({ user }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (user && !isVoxxAdmin(user) && !isVoxxOperacao(user) && !isVoxxManager(user) && user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-lg text-red-500">Acesso negado. Esta página é apenas para usuários Voxx.</p>
      </div>
    );
  }

  const params = new URLSearchParams(window.location.search);
  const leadId = params.get('id');

  const [activeTab, setActiveTab] = useState('visao_geral');
  const [formData, setFormData] = useState({});
  const [showInteracaoModal, setShowInteracaoModal] = useState(false);
  const [showAgendarReuniao, setShowAgendarReuniao] = useState(false);
  const [novaReuniao, setNovaReuniao] = useState({ titulo: '', data_hora: '', tipo: 'diagnostico', local_link: '' });

  const { data: lead, isLoading } = useQuery({
    queryKey: ['leadDetalhe', leadId],
    queryFn: () => base44.entities.LeadComercial.filter({ id: leadId }),
    enabled: !!leadId,
    select: (data) => data?.[0] || null,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (lead) setFormData(lead);
  }, [lead?.id]);

  const { data: interacoes = [] } = useQuery({
    queryKey: ['interacoesComercial', leadId],
    queryFn: () => base44.entities.InteracaoComercial.filter({ lead_id: leadId }, '-created_date', 50),
    enabled: !!leadId,
  });

  const { data: reunioes = [] } = useQuery({
    queryKey: ['reunioesLead', leadId],
    queryFn: () => base44.entities.ReuniaoComercial.filter({ lead_id: leadId }, '-data_hora', 20),
    enabled: !!leadId,
  });

  const { data: tarefas = [] } = useQuery({
    queryKey: ['tarefasLead', leadId],
    queryFn: () => base44.entities.TarefaComercial.filter({ lead_id: leadId }, 'data_prazo', 30),
    enabled: !!leadId,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.LeadComercial.update(leadId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leadDetalhe', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leadsComercial'] });
      toast.success('Salvo!');
    }
  });

  const avancarEtapaMutation = useMutation({
    mutationFn: (etapa) => base44.entities.LeadComercial.update(leadId, { etapa }),
    onSuccess: async (_, etapa) => {
      await base44.entities.InteracaoComercial.create({
        lead_id: leadId, tipo: 'status_change',
        descricao: `Etapa avançada para: ${ETAPA_LABELS[etapa]}`,
        autor: user?.email, autor_nome: user?.full_name,
        status_anterior: lead?.etapa, status_novo: etapa,
      });
      queryClient.invalidateQueries({ queryKey: ['leadDetalhe', leadId] });
      queryClient.invalidateQueries({ queryKey: ['interacoesComercial', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leadsComercial'] });
      toast.success(`Avançado para ${ETAPA_LABELS[etapa]}!`);
    }
  });

  const criarReuniaoMutation = useMutation({
    mutationFn: (data) => base44.entities.ReuniaoComercial.create({
      ...data, lead_id: leadId, lead_nome: lead?.nome_empresa,
      responsavel_voxx: user?.email, responsavel_nome: user?.full_name,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reunioesLead', leadId] });
      toast.success('Reunião agendada!');
      setShowAgendarReuniao(false);
      setNovaReuniao({ titulo: '', data_hora: '', tipo: 'diagnostico', local_link: '' });
    }
  });

  const concluirTarefaMutation = useMutation({
    mutationFn: (id) => base44.entities.TarefaComercial.update(id, { status: 'concluida' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tarefasLead', leadId] })
  });

  const handleSave = (extraData = {}) => {
    const qual = formData.qualificacao || {};
    const { score, classificacao } = calcularFitScore(qual);
    updateMutation.mutate({ ...formData, ...extraData, fit_score: score, fit_classificacao: classificacao });
  };

  // Gerar follow-ups automáticos — DEVE estar antes dos early returns
  useEffect(() => {
    if (!lead || !leadId) return;
    const novasTarefas = gerarTarefasFollowUp(lead, tarefas);
    if (novasTarefas.length > 0) {
      Promise.all(novasTarefas.map(t => base44.entities.TarefaComercial.create(t)))
        .then(() => queryClient.invalidateQueries({ queryKey: ['tarefasLead', leadId] }))
        .catch(() => {});
    }
  }, [lead?.etapa, lead?.proposta?.data_envio, tarefas.length]);

  if (isLoading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
    </div>
  );

  if (!lead) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <p className="text-slate-500">Lead não encontrado.</p>
      <Button onClick={() => navigate('/Comercial')}>Voltar ao Comercial</Button>
    </div>
  );

  const currentLead = formData.id ? formData : lead;
  const statusVisual = getStatusVisual(currentLead);
  const temperatura = calcularTemperaturaLead(currentLead, interacoes);
  const scorePrioridade = calcularScorePrioridade(currentLead, interacoes);
  const etapaIdx = ETAPAS_ORDER.indexOf(currentLead.etapa);
  const proximaEtapa = ETAPAS_ORDER[etapaIdx + 1];
  const diasNoPipeline = lead.created_date ? differenceInDays(new Date(), parseISO(lead.created_date)) : 0;
  const diasSemInteracao = lead.ultima_interacao ? differenceInDays(new Date(), parseISO(lead.ultima_interacao)) : 999;
  const alertaInatividade = diasSemInteracao > 7 && !['fechado_ganho','fechado_perdido'].includes(currentLead.etapa);
  const proximaReuniao = reunioes.find(r => r.status === 'agendada');
  const tarefasPendentes = tarefas.filter(t => t.status === 'pendente');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER FIXO */}
      <div className="bg-slate-900 text-white sticky top-0 z-20 shadow-lg">
        {/* Linha de topo */}
        <div className="flex items-center gap-3 px-6 pt-4 pb-3 border-b border-slate-800">
          <button
            onClick={() => navigate('/Comercial')}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Comercial
          </button>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300 text-sm">{lead.nome_empresa}</span>
        </div>

        {/* Header principal */}
        <div className="px-6 py-4">
          <div className="flex items-start justify-between gap-6">
            {/* Esquerda: info do lead */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2.5 h-2.5 rounded-full ${statusVisual.color}`} />
                <span className="text-xs text-slate-400">{statusVisual.label}</span>
                {lead.ultima_interacao && (
                  <span className="text-slate-600 text-xs">· {formatDistanceToNow(parseISO(lead.ultima_interacao), { addSuffix: true, locale: ptBR })}</span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-white leading-tight">{lead.nome_empresa}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-slate-400">
                {lead.nome_contato && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{lead.nome_contato}</span>}
                {lead.telefone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{lead.telefone}</span>}
                {lead.cidade && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{lead.cidade}{lead.estado ? `, ${lead.estado}` : ''}</span>}
              </div>
            </div>

            {/* Centro: etapa */}
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <Badge className="bg-violet-600 text-white border-0 px-3 py-1">{ETAPA_LABELS[currentLead.etapa]}</Badge>
              {proximaEtapa && !['fechado_ganho','fechado_perdido'].includes(currentLead.etapa) && (
                <button
                  onClick={() => avancarEtapaMutation.mutate(proximaEtapa)}
                  disabled={avancarEtapaMutation.isPending}
                  className="flex items-center gap-1 text-xs text-violet-300 hover:text-white transition-colors"
                >
                  {avancarEtapaMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  {ETAPA_LABELS[proximaEtapa]}
                </button>
              )}
            </div>

            {/* Direita: ações */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowInteracaoModal(true)}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5"
              >
                <MessageSquare className="w-4 h-4" /> Registrar
              </Button>
              <Button
                size="sm"
                onClick={() => { setShowAgendarReuniao(true); setActiveTab('reunioes'); }}
                className="bg-violet-600 hover:bg-violet-700 gap-1.5"
              >
                <Calendar className="w-4 h-4" /> Agendar Reunião
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* BLOCO 1: RESUMO EXECUTIVO */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            {
              label: 'Fit Score',
              content: lead.fit_score > 0
                ? <FitScoreDisplay score={lead.fit_score} classificacao={lead.fit_classificacao} size="sm" />
                : <span className="text-sm text-slate-400 italic">Não avaliado</span>
            },
            {
              label: 'Valor Estimado',
              content: <span className="font-bold text-slate-900 text-lg">
                {lead.valor_estimado > 0 ? `R$ ${lead.valor_estimado?.toLocaleString('pt-BR')}` : '—'}
              </span>
            },
            {
              label: 'Proposta',
              content: <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                lead.proposta?.status === 'aceita' ? 'bg-emerald-100 text-emerald-700' :
                lead.proposta?.status === 'enviada' ? 'bg-blue-100 text-blue-700' :
                lead.proposta?.status === 'em_negociacao' ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-500'
              }`}>
                {PROPOSTA_STATUS_LABEL[lead.proposta?.status || 'nao_enviada']}
              </span>
            },
            {
              label: 'Última Interação',
              content: <span className="text-sm text-slate-700">
                {lead.ultima_interacao
                  ? formatDistanceToNow(parseISO(lead.ultima_interacao), { addSuffix: true, locale: ptBR })
                  : 'Nunca'}
              </span>
            },
            {
              label: 'Tempo no Pipeline',
              content: <span className="text-sm font-semibold text-slate-700">{diasNoPipeline} dias</span>
            },
          ].map((item, i) => (
            <Card key={i} className="p-4">
              <p className="text-xs text-slate-400 mb-1.5">{item.label}</p>
              {item.content}
            </Card>
          ))}
        </div>

        {/* Alerta de inatividade */}
        {alertaInatividade && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Lead sem interação há {diasSemInteracao} dias</p>
              <p className="text-xs text-amber-600 mt-0.5">Este lead pode estar esfriando. Registre uma interação agora.</p>
            </div>
            <Button size="sm" onClick={() => setShowInteracaoModal(true)} className="ml-auto bg-amber-600 hover:bg-amber-700">
              Registrar agora
            </Button>
          </div>
        )}

        {/* BLOCO 2: INTELIGÊNCIA + PRÓXIMA AÇÃO */}
        <Card className="overflow-hidden border-violet-200">
          <InteligenciaLeadPanel
            lead={currentLead}
            interacoes={interacoes}
            onRegistrarInteracao={() => setShowInteracaoModal(true)}
            onTabChange={setActiveTab}
          />
          <div className="border-t border-violet-100">
          <ProximaAcaoBlock
            lead={currentLead}
            onTabChange={setActiveTab}
            onRegistrarInteracao={() => setShowInteracaoModal(true)}
            onAgendarReuniao={() => { setShowAgendarReuniao(true); setActiveTab('reunioes'); }}
          />
          </div>
        </Card>

        {/* BLOCO 3: TIMELINE + TABS lado a lado */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Timeline — 2/3 */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold text-slate-800">Timeline</h3>
                <Button size="sm" onClick={() => setShowInteracaoModal(true)} variant="outline" className="gap-1.5 text-xs h-7">
                  <Plus className="w-3.5 h-3.5" /> Registrar
                </Button>
              </div>
              <div className="p-4 max-h-[480px] overflow-y-auto">
                {interacoes.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma interação ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {interacoes.map((item, idx) => {
                      const lines = item.descricao?.split('\n\n') || [item.descricao];
                      const descPrincipal = lines[0];
                      const proximoPasso = lines.find(l => l?.startsWith('📌'));
                      return (
                        <div key={item.id} className="flex gap-3">
                          {/* linha vertical */}
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center flex-shrink-0 z-10">
                              {TIPO_ICONS[item.tipo] || <MessageSquare className="w-3.5 h-3.5 text-slate-400" />}
                            </div>
                            {idx < interacoes.length - 1 && <div className="w-0.5 bg-slate-200 flex-1 my-1" />}
                          </div>
                          <div className="flex-1 pb-4 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-slate-700 capitalize">{item.tipo?.replace('_', ' ')}</span>
                              <span className="text-slate-300">·</span>
                              <span className="text-xs text-slate-400">
                                {item.created_date ? format(parseISO(item.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''}
                              </span>
                              {item.autor_nome && <span className="text-xs text-slate-400">· {item.autor_nome}</span>}
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed">{descPrincipal}</p>
                            {proximoPasso && (
                              <p className="text-xs text-violet-600 font-medium mt-1 flex items-center gap-1">
                                {proximoPasso}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar direita — 1/3 */}
          <div className="space-y-4">
            {/* Próxima reunião */}
            {proximaReuniao && (
              <Card className="p-4 border-violet-200 bg-violet-50">
                <p className="text-xs font-semibold text-violet-600 mb-2 uppercase tracking-wide">Próxima Reunião</p>
                <p className="font-semibold text-slate-900 text-sm">{proximaReuniao.titulo}</p>
                <p className="text-xs text-slate-600 mt-1">
                  {proximaReuniao.data_hora ? format(parseISO(proximaReuniao.data_hora), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR }) : ''}
                </p>
                {proximaReuniao.local_link && (
                  <p className="text-xs text-violet-600 mt-1">{proximaReuniao.local_link}</p>
                )}
              </Card>
            )}

            {/* Tarefas pendentes */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Tarefas ({tarefasPendentes.length})</p>
              </div>
              {tarefasPendentes.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">Sem tarefas pendentes</p>
              ) : (
                <div className="space-y-2">
                  {tarefasPendentes.slice(0, 5).map(t => (
                    <div key={t.id} className="flex items-center gap-2">
                      <button
                        onClick={() => concluirTarefaMutation.mutate(t.id)}
                        className="w-4 h-4 rounded border-2 border-slate-300 hover:border-violet-500 flex-shrink-0 transition-colors"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 truncate">{t.titulo}</p>
                        <p className="text-[10px] text-slate-400">{t.data_prazo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Leitura estratégica */}
            {lead.leitura_estrategica && (
              <Card className="p-4 bg-amber-50 border-amber-200">
                <p className="text-xs font-semibold text-amber-700 mb-1">🔒 Leitura Estratégica</p>
                <p className="text-xs text-amber-800 leading-relaxed">{lead.leitura_estrategica}</p>
              </Card>
            )}
          </div>
        </div>

        {/* BLOCO 4: TABS */}
        <Card className="overflow-hidden">
          <div className="border-b overflow-x-auto">
            <div className="flex">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-violet-600 text-violet-700 bg-violet-50'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* VISÃO GERAL */}
            {activeTab === 'visao_geral' && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Informações do Lead</p>
                    <div className="space-y-2 text-sm">
                      {[
                        ['Empresa', lead.nome_empresa],
                        ['Contato', lead.nome_contato],
                        ['Telefone', lead.telefone],
                        ['E-mail', lead.email],
                        ['Cidade', [lead.cidade, lead.estado].filter(Boolean).join(', ')],
                        ['Segmento', lead.segmento],
                        ['Origem', lead.origem],
                        ['Responsável', lead.responsavel_nome],
                      ].map(([k, v]) => v ? (
                        <div key={k} className="flex gap-2">
                          <span className="text-slate-400 w-24 flex-shrink-0">{k}</span>
                          <span className="text-slate-800 font-medium">{v}</span>
                        </div>
                      ) : null)}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  {lead.briefing?.principais_dores && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Principais Dores</p>
                      <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{lead.briefing.principais_dores}</p>
                    </div>
                  )}
                  {lead.briefing?.objetivos && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Objetivos</p>
                      <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{lead.briefing.objetivos}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* INTERAÇÕES */}
            {activeTab === 'interacoes' && (
              <div className="space-y-3">
                <Button onClick={() => setShowInteracaoModal(true)} className="bg-violet-600 hover:bg-violet-700">
                  <Plus className="w-4 h-4 mr-2" /> Nova Interação
                </Button>
                <div className="space-y-2 mt-4">
                  {interacoes.map(i => {
                    const lines = i.descricao?.split('\n\n') || [i.descricao];
                    const descPrincipal = lines[0];
                    const proximoPasso = lines.find(l => l?.startsWith('📌'));
                    return (
                      <div key={i.id} className="flex gap-3 p-3 rounded-xl border bg-slate-50">
                        <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center flex-shrink-0">
                          {TIPO_ICONS[i.tipo] || <MessageSquare className="w-3.5 h-3.5 text-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-slate-700 capitalize">{i.tipo?.replace('_', ' ')}</span>
                            <span className="text-xs text-slate-400">
                              {i.created_date ? format(parseISO(i.created_date), "dd/MM 'às' HH:mm", { locale: ptBR }) : ''}
                              {i.autor_nome ? ` · ${i.autor_nome}` : ''}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700">{descPrincipal}</p>
                          {proximoPasso && <p className="text-xs text-violet-600 font-medium mt-1">{proximoPasso}</p>}
                        </div>
                      </div>
                    );
                  })}
                  {interacoes.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Nenhuma interação registrada.</p>}
                </div>
              </div>
            )}

            {/* REUNIÕES */}
            {activeTab === 'reunioes' && (
              <div className="space-y-4">
                {showAgendarReuniao ? (
                  <div className="p-5 border rounded-xl bg-violet-50 space-y-3 max-w-md">
                    <p className="font-semibold text-violet-800 text-sm">Nova Reunião</p>
                    <Input placeholder="Título" value={novaReuniao.titulo} onChange={e => setNovaReuniao({ ...novaReuniao, titulo: e.target.value })} />
                    <Input type="datetime-local" value={novaReuniao.data_hora} onChange={e => setNovaReuniao({ ...novaReuniao, data_hora: e.target.value })} />
                    <Select value={novaReuniao.tipo} onValueChange={v => setNovaReuniao({ ...novaReuniao, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[['diagnostico','Diagnóstico'],['apresentacao','Apresentação'],['negociacao','Negociação'],['follow_up','Follow-up'],['outro','Outro']].map(([k,v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input placeholder="Link / Local" value={novaReuniao.local_link} onChange={e => setNovaReuniao({ ...novaReuniao, local_link: e.target.value })} />
                    <div className="flex gap-2">
                      <Button onClick={() => criarReuniaoMutation.mutate(novaReuniao)} disabled={!novaReuniao.titulo || !novaReuniao.data_hora || criarReuniaoMutation.isPending} className="bg-violet-600 hover:bg-violet-700">
                        {criarReuniaoMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Agendar
                      </Button>
                      <Button variant="outline" onClick={() => setShowAgendarReuniao(false)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setShowAgendarReuniao(true)}><Plus className="w-4 h-4 mr-2" />Agendar Reunião</Button>
                )}
                <div className="space-y-2">
                  {reunioes.map(r => (
                    <div key={r.id} className="p-4 border rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-slate-800">{r.titulo}</p>
                        <Badge variant="outline" className="text-xs capitalize">{r.status}</Badge>
                      </div>
                      <p className="text-sm text-slate-500">
                        {r.data_hora ? format(parseISO(r.data_hora), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''}
                        {r.local_link && <span className="ml-2 text-violet-600">{r.local_link}</span>}
                      </p>
                      {r.notas && <p className="text-sm text-slate-600 mt-2 italic">{r.notas}</p>}
                    </div>
                  ))}
                  {reunioes.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Nenhuma reunião registrada.</p>}
                </div>
              </div>
            )}

            {/* BRIEFING */}
            {activeTab === 'briefing' && (
              <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
                {[
                  { key: 'segmento', label: 'Segmento' },
                  { key: 'cidade_regiao', label: 'Cidade / Região' },
                  { key: 'principais_servicos', label: 'Principais Serviços' },
                  { key: 'ticket_medio', label: 'Ticket Médio (R$)', type: 'number' },
                ].map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs text-slate-500">{f.label}</Label>
                    <Input type={f.type || 'text'} value={formData.briefing?.[f.key] || ''} onChange={e => setFormData({ ...formData, briefing: { ...formData.briefing, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value } })} />
                  </div>
                ))}
                {[
                  { key: 'principais_dores', label: 'Principais Dores', rows: 3 },
                  { key: 'objetivos', label: 'Objetivos do Cliente', rows: 3 },
                  { key: 'diferenciais', label: 'Diferenciais', rows: 2 },
                  { key: 'concorrencia', label: 'Concorrência', rows: 2 },
                ].map(f => (
                  <div key={f.key} className="md:col-span-2 space-y-1">
                    <Label className="text-xs text-slate-500">{f.label}</Label>
                    <Textarea rows={f.rows} value={formData.briefing?.[f.key] || ''} onChange={e => setFormData({ ...formData, briefing: { ...formData.briefing, [f.key]: e.target.value } })} />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <Button onClick={() => handleSave()} disabled={updateMutation.isPending} className="bg-violet-600 hover:bg-violet-700">
                    {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar Briefing
                  </Button>
                </div>
              </div>
            )}

            {/* QUALIFICAÇÃO */}
            {activeTab === 'qualificacao' && (
              <div className="max-w-xl space-y-4">
                <FitScoreCalculator qualificacao={formData.qualificacao || {}} onChange={q => setFormData({ ...formData, qualificacao: q })} />
                <Button onClick={() => handleSave()} disabled={updateMutation.isPending} className="w-full bg-violet-600 hover:bg-violet-700">
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar Qualificação
                </Button>
              </div>
            )}

            {/* PLANO */}
            {activeTab === 'plano' && (
              <div className="space-y-4 max-w-2xl">
                {[
                  { key: 'servicos_recomendados', label: 'Serviços Recomendados', rows: 3 },
                  { key: 'canais_sugeridos', label: 'Canais Sugeridos' },
                  { key: 'estrategia_geral', label: 'Estratégia Geral', rows: 4 },
                  { key: 'prioridade_execucao', label: 'Prioridade de Execução' },
                ].map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs text-slate-500">{f.label}</Label>
                    {f.rows
                      ? <Textarea rows={f.rows} value={formData.plano_servicos?.[f.key] || ''} onChange={e => setFormData({ ...formData, plano_servicos: { ...formData.plano_servicos, [f.key]: e.target.value } })} />
                      : <Input value={formData.plano_servicos?.[f.key] || ''} onChange={e => setFormData({ ...formData, plano_servicos: { ...formData.plano_servicos, [f.key]: e.target.value } })} />
                    }
                  </div>
                ))}
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Estimativa de Investimento (R$)</Label>
                  <Input type="number" value={formData.plano_servicos?.estimativa_investimento || ''} onChange={e => setFormData({ ...formData, plano_servicos: { ...formData.plano_servicos, estimativa_investimento: Number(e.target.value) } })} />
                </div>
                <Button onClick={() => handleSave()} disabled={updateMutation.isPending} className="bg-violet-600 hover:bg-violet-700">
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar Plano
                </Button>
              </div>
            )}

            {/* PROPOSTA */}
            {activeTab === 'proposta' && (
              <div className="space-y-4 max-w-xl">
                {[{ key: 'tipo_servico', label: 'Tipo de Serviço' }, { key: 'prazo', label: 'Prazo' }].map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs text-slate-500">{f.label}</Label>
                    <Input value={formData.proposta?.[f.key] || ''} onChange={e => setFormData({ ...formData, proposta: { ...formData.proposta, [f.key]: e.target.value } })} />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Valor Proposto (R$)</Label>
                  <Input type="number" value={formData.proposta?.valor_proposto || ''} onChange={e => setFormData({ ...formData, proposta: { ...formData.proposta, valor_proposto: Number(e.target.value) } })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Escopo</Label>
                  <Textarea rows={3} value={formData.proposta?.escopo || ''} onChange={e => setFormData({ ...formData, proposta: { ...formData.proposta, escopo: e.target.value } })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Status</Label>
                  <Select value={formData.proposta?.status || 'nao_enviada'} onValueChange={v => setFormData({ ...formData, proposta: { ...formData.proposta, status: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROPOSTA_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => handleSave()} disabled={updateMutation.isPending} className="bg-violet-600 hover:bg-violet-700">
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar Proposta
                </Button>
              </div>
            )}

            {/* TAREFAS */}
            {activeTab === 'tarefas' && (
              <div className="space-y-3 max-w-xl">
                {tarefas.map(t => (
                  <div key={t.id} className={`flex items-start gap-3 p-3 border rounded-xl ${t.status === 'concluida' ? 'opacity-50 bg-slate-50' : 'bg-white'}`}>
                    <button
                      onClick={() => t.status !== 'concluida' && concluirTarefaMutation.mutate(t.id)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${t.status === 'concluida' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-violet-500'}`}
                    >
                      {t.status === 'concluida' && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${t.status === 'concluida' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{t.titulo}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-400">{t.data_prazo || '—'}</span>
                        {t.automatica && <Badge variant="outline" className="text-[10px] px-1 py-0">Auto</Badge>}
                      </div>
                    </div>
                  </div>
                ))}
                {tarefas.length === 0 && (
                  <div className="text-center py-10 text-slate-400">
                    <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Registre interações com próximo passo para gerar tarefas automaticamente.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      <RegistrarInteracaoModal
        leadId={leadId}
        open={showInteracaoModal}
        onClose={() => setShowInteracaoModal(false)}
        user={user}
      />
    </div>
  );
}