import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, ChevronLeft, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from "@/lib/utils";
import ItensDemandaInlineEditor from '@/components/demandas/ItensDemandaInlineEditor';

const ETAPAS = [
  { id: 1, titulo: "Info Geral", descricao: "Informações gerais do card" },
  { id: 2, titulo: "Entregas", descricao: "Cadastro das entregas independentes" },
  { id: 3, titulo: "Revisão", descricao: "Revisar e enviar" }
];

/**
 * Fluxo compartilhado para demandas compostas em wizards.
 * Substitui as etapas originais do wizard quando o usuário escolhe "Várias entregas independentes".
 *
 * Separa informações gerais do card (título, contexto, prioridade, etc.)
 * das informações específicas de cada ItemDemanda (formato, canal, prazo, etc.).
 *
 * Props:
 *  - cliente: objeto cliente
 *  - tipoWizard: 'criacao' | 'edicao' | 'universal' | 'oral_sin'
 *  - accentColor: 'violet' | 'blue'
 *  - onComplete: (data) => void
 *      data = { estrutura_demanda: 'composta', itens, titulo, descricao, camposAdicionais, urgente, prioridade, comunicar_cliente }
 *  - onCancel: () => void
 */
export default function CompostaDemandaFlow({ cliente, tipoWizard, accentColor = 'violet', onComplete, onCancel }) {
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [infoGeral, setInfoGeral] = useState({
    titulo: '',
    contexto: '',
    prioridade: 'media',
    urgente: false,
    motivo_urgencia: '',
    observacoes: '',
    comunicar_cliente: true,
  });
  const [itens, setItens] = useState([]);

  const set = (campo, valor) => setInfoGeral(prev => ({ ...prev, [campo]: valor }));

  const validItems = itens.filter(i => i.titulo?.trim());

  const validarEtapa = (etapa) => {
    switch (etapa) {
      case 1:
        return infoGeral.titulo.trim() && (!infoGeral.urgente || infoGeral.motivo_urgencia.trim());
      case 2:
        return validItems.length >= 2;
      case 3:
        return true;
      default:
        return true;
    }
  };

  const proximaEtapa = () => {
    if (!validarEtapa(etapaAtual)) return;
    if (etapaAtual < 3) {
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
        camposAdicionais: {
          tipo_composta: tipoWizard,
          contexto_campanha: infoGeral.contexto || null,
          observacoes_compartilhadas: infoGeral.observacoes || null,
          motivo_urgencia: infoGeral.urgente ? infoGeral.motivo_urgencia : null,
        },
        urgente: infoGeral.urgente,
        prioridade: infoGeral.prioridade,
        comunicar_cliente: infoGeral.comunicar_cliente,
      });
    }
  };

  const voltarEtapa = () => {
    if (etapaAtual > 1) {
      setEtapaAtual(etapaAtual - 1);
    } else {
      onCancel();
    }
  };

  const progresso = (etapaAtual / 3) * 100;
  const etapaInfo = ETAPAS[etapaAtual - 1];
  const accentBg = accentColor === 'blue' ? 'bg-blue-600' : 'bg-violet-600';
  const accentBtn = accentColor === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-violet-600 hover:bg-violet-700';

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-slate-700">Etapa {etapaAtual} de 3: {etapaInfo.descricao}</span>
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
              <Input
                value={infoGeral.titulo}
                onChange={e => set('titulo', e.target.value)}
                placeholder="Ex: Cronograma de agosto / Pacote de vídeos da campanha"
              />
            </div>
            <div>
              <Label>Contexto da campanha / conjunto</Label>
              <Textarea
                value={infoGeral.contexto}
                onChange={e => set('contexto', e.target.value)}
                placeholder="Ex: Campanha de implante dentário para agosto, foco em conversão via WhatsApp..."
                className="min-h-[80px]"
              />
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
                <Textarea
                  value={infoGeral.motivo_urgencia}
                  onChange={e => set('motivo_urgencia', e.target.value)}
                  placeholder="Por que é urgente?"
                  className="min-h-[60px]"
                />
              </div>
            )}
            <div>
              <Label>Observações compartilhadas</Label>
              <Textarea
                value={infoGeral.observacoes}
                onChange={e => set('observacoes', e.target.value)}
                placeholder="Informações adicionais aplicáveis a todas as entregas"
                className="min-h-[60px]"
              />
            </div>
          </div>
        )}

        {/* ETAPA 2: Entregas */}
        {etapaAtual === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Entregas Independentes</h3>
              <p className="text-sm text-slate-500">
                Cadastre cada entrega com seus próprios formatos, prazos e detalhes. Mínimo de 2 entregas.
              </p>
            </div>
            <ItensDemandaInlineEditor items={itens} onChange={setItens} />
            {validItems.length < 2 && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Mínimo de 2 entregas com título preenchido para salvar como composta.
              </p>
            )}
          </div>
        )}

        {/* ETAPA 3: Revisão */}
        {etapaAtual === 3 && (
          <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Revisão Final</h3>
              <p className="text-sm text-slate-500">Confira os dados antes de enviar</p>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Título geral</p>
                <p className="font-medium text-slate-900">{infoGeral.titulo}</p>
              </div>
              {infoGeral.contexto && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 mb-1 font-medium">CONTEXTO</p>
                  <p className="text-sm text-slate-900">{infoGeral.contexto}</p>
                </div>
              )}
              <div className="p-3 bg-violet-50 rounded-lg">
                <p className="text-xs text-violet-600 mb-2 font-medium">ENTREGAS ({validItems.length})</p>
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
        <Button
          type="button"
          onClick={proximaEtapa}
          disabled={!validarEtapa(etapaAtual)}
          className={cn("flex-1", accentBtn)}
        >
          {etapaAtual === 3 ? (
            <><CheckCircle className="w-4 h-4 mr-2" /> Confirmar e Enviar</>
          ) : (
            <>Próximo <ChevronRight className="w-4 h-4 ml-2" /></>
          )}
        </Button>
      </div>
    </div>
  );
}