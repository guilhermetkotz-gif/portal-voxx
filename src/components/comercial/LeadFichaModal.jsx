import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FitScoreDisplay, calcularFitScore } from './FitScoreCalculator';
import FitScoreCalculator from './FitScoreCalculator';
import { toast } from 'sonner';
import { Phone, MapPin, User, MessageSquare, Calendar, FileText, Target, Send, CheckSquare, Loader2, Plus, Clock } from 'lucide-react';
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

export default function LeadFichaModal({ lead, open, onClose, user }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('geral');
  const [novaInteracao, setNovaInteracao] = useState('');
  const [editando, setEditando] = useState(false);
  const [formData, setFormData] = useState(lead || {});

  React.useEffect(() => {
    if (lead) setFormData(lead);
  }, [lead]);

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
    queryFn: () => base44.entities.TarefaComercial.filter({ lead_id: lead.id }, 'data_prazo', 20),
    enabled: !!lead?.id && open,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.LeadComercial.update(lead.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['leadsComercial']);
      toast.success('Lead atualizado!');
      setEditando(false);
    }
  });

  const addInteracaoMutation = useMutation({
    mutationFn: (data) => base44.entities.InteracaoComercial.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['interacoesComercial', lead?.id]);
      setNovaInteracao('');
      toast.success('Interação registrada!');
      // Atualiza ultima_interacao do lead
      base44.entities.LeadComercial.update(lead.id, { ultima_interacao: new Date().toISOString() });
      queryClient.invalidateQueries(['leadsComercial']);
    }
  });

  const concluirTarefaMutation = useMutation({
    mutationFn: (id) => base44.entities.TarefaComercial.update(id, { status: 'concluida' }),
    onSuccess: () => queryClient.invalidateQueries(['tarefasLead', lead?.id])
  });

  const handleSave = () => {
    const qual = formData.qualificacao || {};
    const { score, classificacao } = calcularFitScore(qual);
    updateMutation.mutate({ ...formData, fit_score: score, fit_classificacao: classificacao });
  };

  const handleAddInteracao = () => {
    if (!novaInteracao.trim()) return;
    addInteracaoMutation.mutate({
      lead_id: lead.id,
      tipo: 'nota',
      descricao: novaInteracao,
      autor: user?.email,
      autor_nome: user?.full_name
    });
  };

  if (!lead) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full max-w-2xl overflow-y-auto p-0" side="right">
        <SheetHeader className="p-6 pb-0 border-b">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl">{lead.nome_empresa}</SheetTitle>
              <p className="text-sm text-slate-500 mt-1">{lead.nome_contato}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className="bg-violet-100 text-violet-700">{ETAPA_LABELS[lead.etapa]}</Badge>
                {lead.fit_score > 0 && (
                  <FitScoreDisplay score={lead.fit_score} classificacao={lead.fit_classificacao} size="sm" />
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="w-full rounded-none border-b h-auto p-0 bg-white">
            {[
              { value: 'geral', label: 'Geral', icon: User },
              { value: 'historico', label: 'Histórico', icon: MessageSquare },
              { value: 'reunioes', label: 'Reuniões', icon: Calendar },
              { value: 'briefing', label: 'Briefing', icon: FileText },
              { value: 'qualificacao', label: 'Fit Score', icon: Target },
              { value: 'proposta', label: 'Proposta', icon: Send },
              { value: 'tarefas', label: 'Tarefas', icon: CheckSquare },
            ].map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab.value
                    ? 'border-violet-600 text-violet-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </TabsList>

          {/* GERAL */}
          <TabsContent value="geral" className="p-6 space-y-4">
            {editando ? (
              <div className="space-y-4">
                {[
                  { key: 'nome_empresa', label: 'Empresa' },
                  { key: 'nome_contato', label: 'Contato' },
                  { key: 'telefone', label: 'Telefone' },
                  { key: 'email', label: 'E-mail' },
                  { key: 'cidade', label: 'Cidade' },
                  { key: 'estado', label: 'Estado' },
                  { key: 'segmento', label: 'Segmento' },
                ].map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label}</Label>
                    <Input value={formData[f.key] || ''} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })} />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label className="text-xs">Valor Estimado (R$)</Label>
                  <Input type="number" value={formData.valor_estimado || ''} onChange={e => setFormData({ ...formData, valor_estimado: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Etapa</Label>
                  <Select value={formData.etapa} onValueChange={v => setFormData({ ...formData, etapa: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ETAPA_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Leitura Estratégica Voxx (interno)</Label>
                  <Textarea value={formData.leitura_estrategica || ''} onChange={e => setFormData({ ...formData, leitura_estrategica: e.target.value })} rows={3} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={updateMutation.isPending} className="bg-violet-600 hover:bg-violet-700">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                  </Button>
                  <Button variant="outline" onClick={() => setEditando(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Empresa', value: lead.nome_empresa },
                    { label: 'Contato', value: lead.nome_contato },
                    { label: 'Telefone', value: lead.telefone },
                    { label: 'E-mail', value: lead.email },
                    { label: 'Cidade', value: lead.cidade },
                    { label: 'Estado', value: lead.estado },
                    { label: 'Segmento', value: lead.segmento },
                    { label: 'Valor Estimado', value: lead.valor_estimado ? `R$ ${lead.valor_estimado?.toLocaleString('pt-BR')}` : '-' },
                    { label: 'Responsável', value: lead.responsavel_nome || '-' },
                    { label: 'Origem', value: lead.origem || '-' },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-xs text-slate-400">{item.label}</p>
                      <p className="font-medium text-slate-800">{item.value || '-'}</p>
                    </div>
                  ))}
                </div>
                {lead.leitura_estrategica && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-medium text-amber-700 mb-1">🔒 Leitura Estratégica Voxx</p>
                    <p className="text-sm text-amber-800">{lead.leitura_estrategica}</p>
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={() => setEditando(true)}>Editar</Button>
              </div>
            )}
          </TabsContent>

          {/* HISTÓRICO */}
          <TabsContent value="historico" className="p-6 space-y-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Registrar interação, nota ou atualização..."
                value={novaInteracao}
                onChange={e => setNovaInteracao(e.target.value)}
                rows={2}
                className="flex-1"
              />
              <Button onClick={handleAddInteracao} disabled={addInteracaoMutation.isPending} className="bg-violet-600 hover:bg-violet-700 self-end">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-3">
              {interacoes.map(i => (
                <div key={i.id} className="flex gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-violet-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-slate-700">{i.descricao}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {i.autor_nome} · {i.created_date ? format(parseISO(i.created_date), "dd/MM/yyyy HH:mm", { locale: ptBR }) : ''}
                    </p>
                  </div>
                </div>
              ))}
              {interacoes.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nenhuma interação registrada.</p>}
            </div>
          </TabsContent>

          {/* REUNIÕES */}
          <TabsContent value="reunioes" className="p-6 space-y-3">
            {reunioes.map(r => (
              <div key={r.id} className="p-3 border rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{r.titulo}</p>
                  <Badge variant="outline" className="text-xs">{r.status}</Badge>
                </div>
                <p className="text-xs text-slate-500">
                  {r.data_hora ? format(parseISO(r.data_hora), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''}
                </p>
                {r.notas && <p className="text-xs text-slate-600 mt-1">{r.notas}</p>}
              </div>
            ))}
            {reunioes.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nenhuma reunião registrada.</p>}
          </TabsContent>

          {/* BRIEFING */}
          <TabsContent value="briefing" className="p-6 space-y-4">
            <div className="space-y-3">
              {[
                { key: 'segmento', label: 'Segmento' },
                { key: 'cidade_regiao', label: 'Cidade / Região' },
                { key: 'principais_servicos', label: 'Principais Serviços' },
                { key: 'principais_dores', label: 'Principais Dores', textarea: true },
                { key: 'objetivos', label: 'Objetivos do Cliente', textarea: true },
                { key: 'diferenciais', label: 'Diferenciais do Negócio', textarea: true },
                { key: 'concorrencia', label: 'Concorrência', textarea: true },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">{f.label}</Label>
                  {f.textarea ? (
                    <Textarea
                      value={formData.briefing?.[f.key] || ''}
                      onChange={e => setFormData({ ...formData, briefing: { ...formData.briefing, [f.key]: e.target.value } })}
                      rows={2}
                    />
                  ) : (
                    <Input
                      value={formData.briefing?.[f.key] || ''}
                      onChange={e => setFormData({ ...formData, briefing: { ...formData.briefing, [f.key]: e.target.value } })}
                    />
                  )}
                </div>
              ))}
              <div className="space-y-1">
                <Label className="text-xs">Ticket Médio (R$)</Label>
                <Input
                  type="number"
                  value={formData.briefing?.ticket_medio || ''}
                  onChange={e => setFormData({ ...formData, briefing: { ...formData.briefing, ticket_medio: Number(e.target.value) } })}
                />
              </div>
              <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full bg-violet-600 hover:bg-violet-700">
                Salvar Briefing
              </Button>
            </div>
          </TabsContent>

          {/* FIT SCORE */}
          <TabsContent value="qualificacao" className="p-6 space-y-4">
            <FitScoreCalculator
              qualificacao={formData.qualificacao || {}}
              onChange={q => setFormData({ ...formData, qualificacao: q })}
            />
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full bg-violet-600 hover:bg-violet-700">
              Salvar Qualificação
            </Button>
          </TabsContent>

          {/* PROPOSTA */}
          <TabsContent value="proposta" className="p-6 space-y-4">
            {[
              { key: 'tipo_servico', label: 'Tipo de Serviço' },
              { key: 'prazo', label: 'Prazo' },
            ].map(f => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  value={formData.proposta?.[f.key] || ''}
                  onChange={e => setFormData({ ...formData, proposta: { ...formData.proposta, [f.key]: e.target.value } })}
                />
              </div>
            ))}
            <div className="space-y-1">
              <Label className="text-xs">Valor Proposto (R$)</Label>
              <Input
                type="number"
                value={formData.proposta?.valor_proposto || ''}
                onChange={e => setFormData({ ...formData, proposta: { ...formData.proposta, valor_proposto: Number(e.target.value) } })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Escopo</Label>
              <Textarea
                value={formData.proposta?.escopo || ''}
                onChange={e => setFormData({ ...formData, proposta: { ...formData.proposta, escopo: e.target.value } })}
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status da Proposta</Label>
              <Select
                value={formData.proposta?.status || 'nao_enviada'}
                onValueChange={v => setFormData({ ...formData, proposta: { ...formData.proposta, status: v } })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PROPOSTA_STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full bg-violet-600 hover:bg-violet-700">
              Salvar Proposta
            </Button>
          </TabsContent>

          {/* TAREFAS */}
          <TabsContent value="tarefas" className="p-6 space-y-3">
            {tarefas.map(t => (
              <div key={t.id} className={`flex items-start gap-3 p-3 border rounded-lg ${t.status === 'concluida' ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  checked={t.status === 'concluida'}
                  onChange={() => t.status !== 'concluida' && concluirTarefaMutation.mutate(t.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${t.status === 'concluida' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    {t.titulo}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>{t.data_prazo ? format(parseISO(t.data_prazo), 'dd/MM/yyyy') : '-'}</span>
                    {t.automatica && <Badge variant="outline" className="text-xs">Auto</Badge>}
                  </div>
                </div>
              </div>
            ))}
            {tarefas.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nenhuma tarefa registrada.</p>}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}