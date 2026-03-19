import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import FitScoreCalculator, { calcularFitScore, FitScoreDisplay } from './FitScoreCalculator';
import LeadHeader from './LeadHeader';
import ProximaAcaoBlock from './ProximaAcaoBlock';
import LeadVisaoGeral from './LeadVisaoGeral';
import RegistrarInteracaoModal from './RegistrarInteracaoModal';
import { toast } from 'sonner';
import { Phone, MessageSquare, Mail, Users, FileText, Target, Send, CheckSquare, Loader2, Plus, Clock, Calendar, Edit3, Check, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ETAPA_LABELS = {
  novo_lead: 'Novo Lead', contato_iniciado: 'Contato Iniciado',
  diagnostico_reuniao: 'Diagnóstico/Reunião', qualificado: 'Qualificado',
  proposta_enviada: 'Proposta Enviada', negociacao: 'Negociação',
  fechado_ganho: 'Fechado (Ganho)', fechado_perdido: 'Fechado (Perdido)'
};

const PROPOSTA_STATUS_LABEL = {
  nao_enviada: 'Não Enviada', enviada: 'Enviada',
  em_negociacao: 'Em Negociação', aceita: 'Aceita', recusada: 'Recusada'
};

const TIPO_ICONS = {
  ligacao: <Phone className="w-3.5 h-3.5" />,
  whatsapp: <MessageSquare className="w-3.5 h-3.5 text-green-500" />,
  email: <Mail className="w-3.5 h-3.5 text-blue-500" />,
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
  { id: 'plano', label: 'Plano' },
  { id: 'proposta', label: 'Proposta' },
  { id: 'tarefas', label: 'Tarefas' },
];

export default function LeadFichaModal({ lead, open, onClose, user }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('visao_geral');
  const [formData, setFormData] = useState({});
  const [editandoGeral, setEditandoGeral] = useState(false);
  const [showInteracaoModal, setShowInteracaoModal] = useState(false);
  const [showAgendarReuniao, setShowAgendarReuniao] = useState(false);
  const [novaReuniao, setNovaReuniao] = useState({ titulo: '', data_hora: '', tipo: 'diagnostico', local_link: '' });

  useEffect(() => {
    if (lead) { setFormData(lead); setActiveTab('visao_geral'); }
  }, [lead?.id]);

  const { data: interacoes = [] } = useQuery({
    queryKey: ['interacoesComercial', lead?.id],
    queryFn: () => base44.entities.InteracaoComercial.filter({ lead_id: lead.id }, '-created_date', 50),
    enabled: !!lead?.id && open,
  });

  const { data: reunioes = [] } = useQuery({
    queryKey: ['reunioesLead', lead?.id],
    queryFn: () => base44.entities.ReuniaoComercial.filter({ lead_id: lead.id }, '-data_hora', 20),
    enabled: !!lead?.id && open,
  });

  const { data: tarefas = [] } = useQuery({
    queryKey: ['tarefasLead', lead?.id],
    queryFn: () => base44.entities.TarefaComercial.filter({ lead_id: lead.id }, 'data_prazo', 30),
    enabled: !!lead?.id && open,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.LeadComercial.update(lead.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leadsComercial'] });
      toast.success('Salvo!');
      setEditandoGeral(false);
    }
  });

  const avancarEtapaMutation = useMutation({
    mutationFn: (etapa) => base44.entities.LeadComercial.update(lead.id, { etapa }),
    onSuccess: (_, etapa) => {
      queryClient.invalidateQueries({ queryKey: ['leadsComercial'] });
      base44.entities.InteracaoComercial.create({
        lead_id: lead.id, tipo: 'status_change',
        descricao: `Etapa avançada para: ${ETAPA_LABELS[etapa]}`,
        autor: user?.email, autor_nome: user?.full_name,
        status_anterior: lead.etapa, status_novo: etapa,
      });
      toast.success(`Etapa avançada para ${ETAPA_LABELS[etapa]}!`);
    }
  });

  const criarReuniaoMutation = useMutation({
    mutationFn: (data) => base44.entities.ReuniaoComercial.create({
      ...data, lead_id: lead.id, lead_nome: lead.nome_empresa,
      responsavel_voxx: user?.email, responsavel_nome: user?.full_name,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reunioesLead', lead?.id] });
      toast.success('Reunião agendada!');
      setShowAgendarReuniao(false);
      setNovaReuniao({ titulo: '', data_hora: '', tipo: 'diagnostico', local_link: '' });
    }
  });

  const concluirTarefaMutation = useMutation({
    mutationFn: (id) => base44.entities.TarefaComercial.update(id, { status: 'concluida' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tarefasLead', lead?.id] })
  });

  const handleSave = (extraData = {}) => {
    const qual = formData.qualificacao || {};
    const { score, classificacao } = calcularFitScore(qual);
    updateMutation.mutate({ ...formData, ...extraData, fit_score: score, fit_classificacao: classificacao });
  };

  if (!lead) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full max-w-2xl p-0 flex flex-col overflow-hidden" side="right">
          {/* Botão abrir página completa */}
          <div className="flex justify-end px-4 pt-3 bg-slate-900">
            <button
              onClick={() => { onClose(); navigate(`/LeadDetalhe?id=${lead.id}`); }}
              className="text-xs text-violet-300 hover:text-white transition-colors flex items-center gap-1"
            >
              Abrir completo →
            </button>
          </div>

          {/* HEADER */}
          <LeadHeader
            lead={formData.id ? formData : lead}
            onAvancarEtapa={(etapa) => avancarEtapaMutation.mutate(etapa)}
            onRegistrarInteracao={() => setShowInteracaoModal(true)}
            onAgendarReuniao={() => { setShowAgendarReuniao(true); setActiveTab('reunioes'); }}
          />

          {/* BLOCO PRÓXIMA AÇÃO */}
          <ProximaAcaoBlock
            lead={formData.id ? formData : lead}
            onTabChange={setActiveTab}
            onRegistrarInteracao={() => setShowInteracaoModal(true)}
            onAgendarReuniao={() => { setShowAgendarReuniao(true); setActiveTab('reunioes'); }}
          />

          {/* TABS */}
          <div className="border-b border-slate-200 overflow-x-auto flex-shrink-0">
            <div className="flex">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
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

          {/* CONTEÚDO DAS ABAS */}
          <div className="flex-1 overflow-y-auto">
            {/* VISÃO GERAL */}
            {activeTab === 'visao_geral' && (
              <LeadVisaoGeral lead={formData.id ? formData : lead} tarefas={tarefas} reunioes={reunioes} />
            )}

            {/* INTERAÇÕES */}
            {activeTab === 'interacoes' && (
              <div className="p-5 space-y-4">
                <Button onClick={() => setShowInteracaoModal(true)} className="w-full bg-violet-600 hover:bg-violet-700">
                  <Plus className="w-4 h-4 mr-2" /> Registrar Interação
                </Button>
                <div className="space-y-3">
                  {interacoes.map(i => {
                    const lines = i.descricao?.split('\n\n') || [i.descricao];
                    const descPrincipal = lines[0];
                    const proximoPasso = lines.find(l => l.startsWith('📌'));
                    return (
                      <div key={i.id} className="flex gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
                        <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {TIPO_ICONS[i.tipo] || <MessageSquare className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-medium text-slate-600 capitalize">{i.tipo?.replace('_', ' ')}</span>
                            <span className="text-xs text-slate-400">
                              {i.created_date ? format(parseISO(i.created_date), "dd/MM 'às' HH:mm", { locale: ptBR }) : ''}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700">{descPrincipal}</p>
                          {proximoPasso && (
                            <p className="text-xs text-violet-600 mt-1 font-medium">{proximoPasso}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-1">{i.autor_nome}</p>
                        </div>
                      </div>
                    );
                  })}
                  {interacoes.length === 0 && (
                    <div className="text-center py-10 text-slate-400">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Nenhuma interação registrada.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* REUNIÕES */}
            {activeTab === 'reunioes' && (
              <div className="p-5 space-y-4">
                {showAgendarReuniao ? (
                  <div className="p-4 border rounded-xl bg-violet-50 space-y-3">
                    <p className="text-sm font-semibold text-violet-800">Nova Reunião</p>
                    <Input placeholder="Título da reunião" value={novaReuniao.titulo} onChange={e => setNovaReuniao({ ...novaReuniao, titulo: e.target.value })} />
                    <Input type="datetime-local" value={novaReuniao.data_hora} onChange={e => setNovaReuniao({ ...novaReuniao, data_hora: e.target.value })} />
                    <Select value={novaReuniao.tipo} onValueChange={v => setNovaReuniao({ ...novaReuniao, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[['diagnostico','Diagnóstico'],['apresentacao','Apresentação'],['negociacao','Negociação'],['follow_up','Follow-up'],['outro','Outro']].map(([k,v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input placeholder="Link / Local (Meet, Zoom...)" value={novaReuniao.local_link} onChange={e => setNovaReuniao({ ...novaReuniao, local_link: e.target.value })} />
                    <div className="flex gap-2">
                      <Button onClick={() => criarReuniaoMutation.mutate(novaReuniao)} disabled={!novaReuniao.titulo || !novaReuniao.data_hora || criarReuniaoMutation.isPending} className="bg-violet-600 hover:bg-violet-700 flex-1">
                        {criarReuniaoMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Agendar
                      </Button>
                      <Button variant="outline" onClick={() => setShowAgendarReuniao(false)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setShowAgendarReuniao(true)} className="w-full">
                    <Plus className="w-4 h-4 mr-2" /> Agendar Reunião
                  </Button>
                )}

                <div className="space-y-2">
                  {reunioes.map(r => (
                    <div key={r.id} className="p-3 border rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm text-slate-800">{r.titulo}</p>
                        <Badge variant="outline" className="text-xs capitalize">{r.status}</Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        {r.data_hora ? format(parseISO(r.data_hora), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''}
                        {r.local_link && <span className="ml-2 text-violet-600">{r.local_link}</span>}
                      </p>
                      {r.notas && <p className="text-xs text-slate-600 mt-1 italic">{r.notas}</p>}
                    </div>
                  ))}
                  {reunioes.length === 0 && (
                    <div className="text-center py-10 text-slate-400">
                      <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Nenhuma reunião registrada.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* BRIEFING */}
            {activeTab === 'briefing' && (
              <div className="p-5 space-y-4">
                {[
                  { key: 'segmento', label: 'Segmento' },
                  { key: 'cidade_regiao', label: 'Cidade / Região' },
                  { key: 'principais_servicos', label: 'Principais Serviços' },
                  { key: 'principais_dores', label: 'Principais Dores', rows: 3 },
                  { key: 'objetivos', label: 'Objetivos do Cliente', rows: 3 },
                  { key: 'diferenciais', label: 'Diferenciais', rows: 2 },
                  { key: 'concorrencia', label: 'Concorrência', rows: 2 },
                ].map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs text-slate-500">{f.label}</Label>
                    {f.rows ? (
                      <Textarea rows={f.rows} value={formData.briefing?.[f.key] || ''} onChange={e => setFormData({ ...formData, briefing: { ...formData.briefing, [f.key]: e.target.value } })} />
                    ) : (
                      <Input value={formData.briefing?.[f.key] || ''} onChange={e => setFormData({ ...formData, briefing: { ...formData.briefing, [f.key]: e.target.value } })} />
                    )}
                  </div>
                ))}
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Ticket Médio (R$)</Label>
                  <Input type="number" value={formData.briefing?.ticket_medio || ''} onChange={e => setFormData({ ...formData, briefing: { ...formData.briefing, ticket_medio: Number(e.target.value) } })} />
                </div>
                <Button onClick={() => handleSave()} disabled={updateMutation.isPending} className="w-full bg-violet-600 hover:bg-violet-700">
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar Briefing
                </Button>
              </div>
            )}

            {/* QUALIFICAÇÃO */}
            {activeTab === 'qualificacao' && (
              <div className="p-5 space-y-4">
                <FitScoreCalculator qualificacao={formData.qualificacao || {}} onChange={q => setFormData({ ...formData, qualificacao: q })} />
                <Button onClick={() => handleSave()} disabled={updateMutation.isPending} className="w-full bg-violet-600 hover:bg-violet-700">
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar Qualificação
                </Button>
              </div>
            )}

            {/* PLANO DE SERVIÇOS */}
            {activeTab === 'plano' && (
              <div className="p-5 space-y-4">
                {[
                  { key: 'servicos_recomendados', label: 'Serviços Recomendados', rows: 3 },
                  { key: 'canais_sugeridos', label: 'Canais Sugeridos' },
                  { key: 'estrategia_geral', label: 'Estratégia Geral', rows: 4 },
                  { key: 'prioridade_execucao', label: 'Prioridade de Execução' },
                ].map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs text-slate-500">{f.label}</Label>
                    {f.rows ? (
                      <Textarea rows={f.rows} value={formData.plano_servicos?.[f.key] || ''} onChange={e => setFormData({ ...formData, plano_servicos: { ...formData.plano_servicos, [f.key]: e.target.value } })} />
                    ) : (
                      <Input value={formData.plano_servicos?.[f.key] || ''} onChange={e => setFormData({ ...formData, plano_servicos: { ...formData.plano_servicos, [f.key]: e.target.value } })} />
                    )}
                  </div>
                ))}
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Estimativa de Investimento (R$)</Label>
                  <Input type="number" value={formData.plano_servicos?.estimativa_investimento || ''} onChange={e => setFormData({ ...formData, plano_servicos: { ...formData.plano_servicos, estimativa_investimento: Number(e.target.value) } })} />
                </div>
                <Button onClick={() => handleSave()} disabled={updateMutation.isPending} className="w-full bg-violet-600 hover:bg-violet-700">
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar Plano
                </Button>
              </div>
            )}

            {/* PROPOSTA */}
            {activeTab === 'proposta' && (
              <div className="p-5 space-y-4">
                {[
                  { key: 'tipo_servico', label: 'Tipo de Serviço' },
                  { key: 'prazo', label: 'Prazo' },
                ].map(f => (
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
                  <Label className="text-xs text-slate-500">Status da Proposta</Label>
                  <Select value={formData.proposta?.status || 'nao_enviada'} onValueChange={v => setFormData({ ...formData, proposta: { ...formData.proposta, status: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROPOSTA_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => handleSave()} disabled={updateMutation.isPending} className="w-full bg-violet-600 hover:bg-violet-700">
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar Proposta
                </Button>
              </div>
            )}

            {/* TAREFAS */}
            {activeTab === 'tarefas' && (
              <div className="p-5 space-y-3">
                {tarefas.map(t => (
                  <div key={t.id} className={`flex items-start gap-3 p-3 border rounded-xl transition-opacity ${t.status === 'concluida' ? 'opacity-50 bg-slate-50' : 'bg-white'}`}>
                    <button
                      onClick={() => t.status !== 'concluida' && concluirTarefaMutation.mutate(t.id)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${t.status === 'concluida' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-violet-400'}`}
                    >
                      {t.status === 'concluida' && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${t.status === 'concluida' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {t.titulo}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-400">
                          {t.data_prazo ? format(parseISO(t.data_prazo), 'dd/MM/yyyy') : '-'}
                        </span>
                        {t.automatica && <Badge variant="outline" className="text-[10px] px-1 py-0">Auto</Badge>}
                      </div>
                    </div>
                  </div>
                ))}
                {tarefas.length === 0 && (
                  <div className="text-center py-10 text-slate-400">
                    <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhuma tarefa. Registre interações com próximo passo!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal de interação */}
      <RegistrarInteracaoModal
        leadId={lead?.id}
        open={showInteracaoModal}
        onClose={() => setShowInteracaoModal(false)}
        user={user}
      />
    </>
  );
}