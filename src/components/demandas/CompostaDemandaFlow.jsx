import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronRight, ChevronLeft, CheckCircle, AlertTriangle, Upload, X, Paperclip } from 'lucide-react';
import { cn } from "@/lib/utils";
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import EntregasDemandaBuilder from '@/components/demandas/EntregasDemandaBuilder';

const ETAPAS = [
  { id: 1, titulo: "Info Gerais", descricao: "Informações gerais do card" },
  { id: 2, titulo: "Entregas", descricao: "Cadastro das entregas independentes" },
  { id: 3, titulo: "Anexos", descricao: "Anexos e comunicação com o cliente" },
  { id: 4, titulo: "Revisão", descricao: "Revisar e criar demanda" }
];

/**
 * Fluxo compartilhado para demandas compostas em wizards.
 * 4 etapas: Info Gerais → Entregas → Anexos e Comunicação → Revisão.
 *
 * Props:
 *  - cliente, tipoWizard, accentColor, onComplete, onCancel
 */
export default function CompostaDemandaFlow({ cliente, tipoWizard, accentColor = 'violet', onComplete, onCancel }) {
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [infoGeral, setInfoGeral] = useState({
    titulo: '', contexto: '', prioridade: 'media',
    urgente: false, motivo_urgencia: '', observacoes: '',
    comunicar_cliente: true, resumo_entrega_cliente: '',
  });
  const [itens, setItens] = useState([]);
  const [anexos, setAnexos] = useState([]);
  const [uploading, setUploading] = useState(false);

  const set = (campo, valor) => setInfoGeral(prev => ({ ...prev, [campo]: valor }));

  const validItems = itens.filter(i => i.titulo?.trim());

  const validarEtapa = (etapa) => {
    switch (etapa) {
      case 1:
        return infoGeral.titulo.trim() && (!infoGeral.urgente || infoGeral.motivo_urgencia.trim());
      case 2:
        return validItems.length >= 2 && validItems.length === itens.length;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return true;
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploaded.push(file_url);
      }
      setAnexos(prev => [...prev, ...uploaded]);
    } catch (err) {
      toast.error('Erro ao enviar arquivo: ' + (err.message || 'erro'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeAnexo = (url) => setAnexos(prev => prev.filter(a => a !== url));

  const proximaEtapa = () => {
    if (!validarEtapa(etapaAtual)) return;
    if (etapaAtual < 4) {
      setEtapaAtual(etapaAtual + 1);
    } else {
      const descricaoComposta = [
        infoGeral.contexto || '',
        infoGeral.observacoes ? `\nObservações: ${infoGeral.observacoes}` : '',
        infoGeral.urgente ? `\n⚠️ URGENTE: ${infoGeral.motivo_urgencia}` : '',
      ].join('').trim();

      onComplete({
        estrutura_demanda: 'composta',
        itens: validItems,
        titulo: infoGeral.titulo,
        descricao: descricaoComposta,
        anexos,
        camposAdicionais: {
          tipo_composta: tipoWizard,
          contexto_campanha: infoGeral.contexto || null,
          observacoes_compartilhadas: infoGeral.observacoes || null,
          motivo_urgencia: infoGeral.urgente ? infoGeral.motivo_urgencia : null,
        },
        urgente: infoGeral.urgente,
        prioridade: infoGeral.prioridade,
        comunicar_cliente: infoGeral.comunicar_cliente,
        resumo_entrega_cliente: infoGeral.resumo_entrega_cliente || '',
      });
    }
  };

  const voltarEtapa = () => {
    if (etapaAtual > 1) setEtapaAtual(etapaAtual - 1);
    else onCancel();
  };

  // Calcular prazos para revisão
  const datasPrevistas = validItems
    .map(i => i.data_prevista ? new Date(i.data_prevista) : null)
    .filter(Boolean)
    .sort((a, b) => a - b);
  const prazoMaisProximo = datasPrevistas[0];
  const prazoMaisDistante = datasPrevistas[datasPrevistas.length - 1];

  const progresso = (etapaAtual / 4) * 100;
  const etapaInfo = ETAPAS[etapaAtual - 1];
  const accentBg = accentColor === 'blue' ? 'bg-blue-600' : 'bg-violet-600';
  const accentBtn = accentColor === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-violet-600 hover:bg-violet-700';

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try { return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }
    catch { return ''; }
  };

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-slate-700">Etapa {etapaAtual} de 4: {etapaInfo.descricao}</span>
          <span className="text-slate-500">{Math.round(progresso)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={cn("h-full transition-all duration-300", accentBg)} style={{ width: `${progresso}%` }} />
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {ETAPAS.map((etapa, idx) => (
          <React.Fragment key={etapa.id}>
            <div className={cn(
              "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
              etapa.id < etapaAtual ? "bg-emerald-500 text-white" :
              etapa.id === etapaAtual ? cn("text-white", accentBg) :
              "bg-slate-200 text-slate-500"
            )}>
              {etapa.id < etapaAtual ? <CheckCircle className="w-4 h-4" /> : etapa.id}
            </div>
            {idx < ETAPAS.length - 1 && (
              <div className={cn("h-0.5 flex-1 min-w-4 transition-colors", etapa.id < etapaAtual ? "bg-emerald-500" : "bg-slate-200")} />
            )}
          </React.Fragment>
        ))}
      </div>

      <Card className="p-6 min-h-[300px]">
        {/* ETAPA 1: Informações Gerais */}
        {etapaAtual === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Informações Gerais</h3>
              <p className="text-sm text-slate-500">Dados compartilhados entre todas as entregas deste card</p>
            </div>
            <div>
              <Label>Título geral *</Label>
              <Input value={infoGeral.titulo} onChange={e => set('titulo', e.target.value)}
                placeholder="Ex: Cronograma de agosto / Pacote de vídeos da campanha" />
            </div>
            <div>
              <Label>Contexto da campanha / conjunto</Label>
              <Textarea value={infoGeral.contexto} onChange={e => set('contexto', e.target.value)}
                placeholder="Ex: Campanha de implante dentário para agosto, foco em conversão via WhatsApp..."
                className="min-h-[80px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prioridade</Label>
                <Select value={infoGeral.prioridade} onValueChange={v => set('prioridade', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Urgente?</Label>
                <Select value={infoGeral.urgente ? 'sim' : 'nao'} onValueChange={v => set('urgente', v === 'sim')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao">Não</SelectItem>
                    <SelectItem value="sim">Sim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {infoGeral.urgente && (
              <div>
                <Label>Motivo da urgência *</Label>
                <Textarea value={infoGeral.motivo_urgencia} onChange={e => set('motivo_urgencia', e.target.value)}
                  placeholder="Por que é urgente?" className="min-h-[60px]" />
              </div>
            )}
            <div>
              <Label>Observações compartilhadas</Label>
              <Textarea value={infoGeral.observacoes} onChange={e => set('observacoes', e.target.value)}
                placeholder="Informações adicionais aplicáveis a todas as entregas" className="min-h-[60px]" />
            </div>
          </div>
        )}

        {/* ETAPA 2: Entregas */}
        {etapaAtual === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Entregas desta demanda</h3>
              <p className="text-sm text-slate-500">
                Cadastre cada entrega com seus próprios formatos, prazos e detalhes. Mínimo de 2 entregas.
              </p>
            </div>
            <EntregasDemandaBuilder items={itens} onChange={setItens} showValidation />
          </div>
        )}

        {/* ETAPA 3: Anexos e Comunicação */}
        {etapaAtual === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Anexos e Comunicação</h3>
              <p className="text-sm text-slate-500">Anexos gerais do card e configuração de comunicação com o cliente</p>
            </div>
            <div>
              <Label>Anexos gerais</Label>
              <div className="flex items-center gap-2 mt-1">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-600 hover:bg-slate-50">
                    <Upload className="w-4 h-4" /> {uploading ? 'Enviando...' : 'Enviar arquivo'}
                  </span>
                  <input type="file" multiple onChange={handleFileUpload} className="hidden" disabled={uploading} />
                </label>
              </div>
              {anexos.length > 0 && (
                <div className="mt-2 space-y-1">
                  {anexos.map((url, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-md text-xs">
                      <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                      <span className="flex-1 truncate text-slate-600">{url.split('/').pop()}</span>
                      <button type="button" onClick={() => removeAnexo(url)} className="text-slate-400 hover:text-red-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Comunicar cliente sobre esta demanda</Label>
                  <p className="text-xs text-slate-500 mt-0.5">Se ativado, o cliente será notificado sobre as entregas</p>
                </div>
                <Switch checked={infoGeral.comunicar_cliente} onCheckedChange={v => set('comunicar_cliente', v)} />
              </div>
            </div>
            {infoGeral.comunicar_cliente && (
              <div>
                <Label>Resumo para o cliente (opcional)</Label>
                <Textarea value={infoGeral.resumo_entrega_cliente} onChange={e => set('resumo_entrega_cliente', e.target.value)}
                  placeholder="Resumo em linguagem orientada ao cliente sobre esta demanda composta..."
                  className="min-h-[60px]" />
              </div>
            )}
          </div>
        )}

        {/* ETAPA 4: Revisão */}
        {etapaAtual === 4 && (
          <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Revisão Final</h3>
              <p className="text-sm text-slate-500">Confira os dados antes de criar a demanda</p>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Título da demanda</p>
                <p className="font-medium text-slate-900">{infoGeral.titulo}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span>Cliente: <strong className="text-slate-700">{cliente?.nome || '—'}</strong></span>
                  <span>·</span>
                  <span>Prioridade: <strong className="text-slate-700 capitalize">{infoGeral.prioridade}</strong></span>
                </div>
              </div>
              {infoGeral.contexto && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 mb-1 font-medium">CONTEXTO</p>
                  <p className="text-sm text-slate-900">{infoGeral.contexto}</p>
                </div>
              )}
              <div className="p-3 bg-violet-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-violet-600 font-medium">ENTREGAS ({validItems.length})</p>
                  {prazoMaisProximo && (
                    <p className="text-xs text-slate-500">
                      Prazo mais próximo: <strong className="text-slate-700">{formatDate(prazoMaisProximo)}</strong>
                      {prazoMaisDistante && prazoMaisDistante !== prazoMaisProximo && (
                        <> · Mais distante: <strong className="text-slate-700">{formatDate(prazoMaisDistante)}</strong></>
                      )}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  {validItems.map((item, i) => (
                    <div key={item.tempId} className="text-xs bg-white px-3 py-2 rounded border border-slate-200">
                      <span className="font-medium text-slate-900">{i + 1}. {item.titulo}</span>
                      <div className="text-slate-500 mt-0.5">
                        {item.formato && `${item.formato}`}
                        {item.canal && ` · ${item.canal}`}
                        {item.data_prevista && ` · ${formatDate(item.data_prevista)}`}
                        {item.responsavel_nome && ` · ${item.responsavel_nome}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {anexos.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1 font-medium">ANEXOS ({anexos.length})</p>
                  <div className="space-y-0.5">
                    {anexos.map((url, i) => (
                      <p key={i} className="text-xs text-slate-600 flex items-center gap-1">
                        <Paperclip className="w-3 h-3" /> {url.split('/').pop()}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {infoGeral.urgente && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-sm font-bold text-red-600">⚠️ URGENTE</p>
                  <p className="text-xs text-slate-700 mt-1">{infoGeral.motivo_urgencia}</p>
                </div>
              )}
              {infoGeral.observacoes && (
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-xs text-amber-600 mb-1 font-medium">OBSERVAÇÕES</p>
                  <p className="text-sm text-slate-700">{infoGeral.observacoes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Navegação */}
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={voltarEtapa} className="flex-1">
          <ChevronLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
        <Button type="button" onClick={proximaEtapa} disabled={!validarEtapa(etapaAtual)}
          className={cn("flex-1", accentBtn)}>
          {etapaAtual === 4 ? (
            <><CheckCircle className="w-4 h-4 mr-2" /> Criar demanda com {validItems.length} entregas</>
          ) : (
            <>Próximo <ChevronRight className="w-4 h-4 ml-2" /></>
          )}
        </Button>
      </div>
    </div>
  );
}