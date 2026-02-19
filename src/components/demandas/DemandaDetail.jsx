import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import StatusBadge from '@/components/ui/StatusBadge';
import { 
  Clock, 
  Calendar, 
  Paperclip, 
  Send, 
  ExternalLink,
  MessageSquare,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const eventIcons = {
  criacao: CheckCircle,
  status_change: ArrowRight,
  comentario: MessageSquare,
  anexo: Paperclip,
  acao_voxx: CheckCircle
};

const eventColors = {
  criacao: 'bg-emerald-100 text-emerald-600',
  status_change: 'bg-blue-100 text-blue-600',
  comentario: 'bg-violet-100 text-violet-600',
  anexo: 'bg-amber-100 text-amber-600',
  acao_voxx: 'bg-emerald-100 text-emerald-600'
};

export default function DemandaDetail({ demanda, events = [], open, onClose, user }) {
  const [comentario, setComentario] = useState('');
  const [sending, setSending] = useState(false);
  const queryClient = useQueryClient();

  const addComentario = useMutation({
    mutationFn: async () => {
      await base44.entities.TimelineEvent.create({
        demanda_id: demanda.id,
        cliente_id: demanda.cliente_id,
        tipo: 'comentario',
        descricao: comentario,
        autor: user?.full_name || user?.email,
        autor_tipo: user?.tipo_acesso?.startsWith('voxx') ? 'voxx' : 'cliente'
      });
    },
    onSuccess: () => {
      setComentario('');
      queryClient.invalidateQueries({ queryKey: ['timelineEvents'] });
    }
  });

  const handleSendComentario = async () => {
    if (!comentario.trim()) return;
    setSending(true);
    await addComentario.mutateAsync();
    setSending(false);
  };

  if (!demanda) return null;

  const isAguardando = demanda.status === 'aguardando_cliente';

  // Função para gerar briefing formatado para VOXX
  const gerarBriefingVOXX = () => {
    if (!demanda.campos_adicionais) return '';

    const campos = demanda.campos_adicionais;
    const val = (campo) => campos[campo] || 'Não informado';

    return `BRIEFING VOXX | Image Performance Engine™ – Oral Sin

══════════════════════════════════════════════════════

📋 DADOS GERAIS
Cliente: ${demanda.cliente_nome || 'Não informado'}
Unidade: ${val('cidade_unidade')}
WhatsApp: ${val('whatsapp_unidade')}

══════════════════════════════════════════════════════

🎨 ESPECIFICAÇÕES CRIATIVAS
Formato: ${val('formato_peca')}
Tema Principal: ${val('tema_principal')}
Objetivo: ${val('objetivo_peca')}
Estilo: ${val('estilo_comunicacao')}
Tipo de Imagem: ${val('tipo_imagem')}

══════════════════════════════════════════════════════

⚡ URGÊNCIA & TIMING
Urgência de Agenda: ${val('urgencia_agenda')}
${campos.motivo_urgencia ? `Motivo: ${campos.motivo_urgencia}` : ''}

══════════════════════════════════════════════════════

💬 ESTRATÉGIA DE MENSAGEM
Mensagem-chave: ${val('mensagem_chave')}
Objeção Dominante: ${val('objecao_dominante')}

══════════════════════════════════════════════════════

📝 OBSERVAÇÕES ADICIONAIS
${val('observacoes_extras')}

══════════════════════════════════════════════════════

⚙️ METADATA
ID Demanda: ${demanda.id}
Data Criação: ${format(new Date(demanda.created_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
Status: ${demanda.status}
`.trim();
  };

  const handleCopiarBriefing = () => {
    const briefing = gerarBriefingVOXX();
    navigator.clipboard.writeText(briefing);
    toast.success('Briefing copiado para área de transferência!');
  };

  // Verificar se é demanda CRIACAO + Oral Sin
  const isOralSin = demanda.cliente_nome?.toLowerCase().includes('oral sin');
  const mostrarBriefingVOXX = demanda.setor === 'CRIACAO' && isOralSin && demanda.campos_adicionais;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge type="setor" value={demanda.setor} size="sm" />
            {demanda.urgente && (
              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                URGENTE
              </span>
            )}
          </div>
          <SheetTitle className="text-xl">{demanda.titulo}</SheetTitle>
        </SheetHeader>

        <div className="py-4 space-y-6">
          {/* Alert for Aguardando Cliente */}
          {isAguardando && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800">Aguardando sua resposta</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Esta demanda precisa de informações adicionais. Por favor, envie um comentário abaixo.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status & Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Status</p>
              <StatusBadge type="status" value={demanda.status} size="md" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Prioridade</p>
              <StatusBadge type="prioridade" value={demanda.prioridade} size="md" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Criada em</p>
              <p className="text-sm font-medium">
                {format(new Date(demanda.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            {demanda.previsao_entrega && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Previsão de entrega</p>
                <p className="text-sm font-medium">
                  {format(new Date(demanda.previsao_entrega), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            )}
          </div>

          {/* Descrição */}
          {demanda.descricao && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Descrição</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg">
                {demanda.descricao}
              </p>
            </div>
          )}

          {/* Campos Adicionais */}
          {demanda.campos_adicionais && Object.keys(demanda.campos_adicionais).length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Informações adicionais</p>
              <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                {Object.entries(demanda.campos_adicionais).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-slate-500">{key.replace(/_/g, ' ')}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Briefing VOXX */}
          {mostrarBriefingVOXX && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-violet-600" />
                  <p className="text-xs text-slate-500">📦 Briefing para Agente VOXX</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopiarBriefing}
                  className="h-7 text-xs"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copiar
                </Button>
              </div>
              <Textarea
                value={gerarBriefingVOXX()}
                readOnly
                className="min-h-[300px] font-mono text-xs bg-slate-900 text-emerald-400 border-slate-700"
              />
              <p className="text-xs text-slate-400 mt-2">
                Este briefing é gerado automaticamente e otimizado para o VOXX | Image Performance Engine™
              </p>
            </div>
          )}

          {/* Anexos */}
          {demanda.anexos?.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Anexos</p>
              <div className="space-y-2">
                {demanda.anexos.map((url, index) => (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <Paperclip className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-violet-600 truncate flex-1">Anexo {index + 1}</span>
                    <ExternalLink className="w-4 h-4 text-slate-400" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <p className="text-xs text-slate-500 mb-3">Timeline</p>
            <div className="space-y-3">
              {events.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Nenhum evento registrado</p>
              ) : (
                events.map((event) => {
                  const Icon = eventIcons[event.tipo] || Clock;
                  const colorClass = eventColors[event.tipo] || 'bg-slate-100 text-slate-600';
                  
                  return (
                    <div key={event.id} className="flex gap-3">
                      <div className={`p-2 rounded-lg h-fit ${colorClass}`}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-700">{event.descricao}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                          <span>{event.autor}</span>
                          <span>•</span>
                          <span>
                            {formatDistanceToNow(new Date(event.created_date), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Comentário */}
          <div className="pt-4 border-t">
            <p className="text-xs text-slate-500 mb-2">Adicionar comentário</p>
            <div className="flex gap-2">
              <Textarea
                placeholder="Digite seu comentário..."
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="flex-1 min-h-[80px]"
              />
            </div>
            <Button 
              className="w-full mt-2" 
              onClick={handleSendComentario}
              disabled={!comentario.trim() || sending}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Enviar Comentário
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}