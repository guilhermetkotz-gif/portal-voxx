import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { 
  Calendar, 
  User, 
  Clock, 
  FileText, 
  Paperclip, 
  Send, 
  Upload, 
  Trash2,
  Edit,
  X,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import moment from 'moment';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import 'moment-timezone';
import TimeTracker from '@/components/demandas/TimeTracker';

const DemandaDetailModal = ({ demanda, open, onClose }) => {
  const queryClient = useQueryClient();
  const [comentario, setComentario] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [comentarioAnexo, setComentarioAnexo] = useState(null);
  
  const [editData, setEditData] = useState({
    titulo: demanda?.titulo || '',
    descricao: demanda?.descricao || '',
    status: demanda?.status || '',
    prioridade: demanda?.prioridade || '',
    previsao_entrega: demanda?.previsao_entrega || ''
  });

  const handleSaveTime = async (minutes) => {
    try {
      const currentTime = currentDemanda?.tempo_trabalho_minutos || 0;
      const newTotal = currentTime + minutes;
      const historico = currentDemanda?.historico_tempo_trabalho || [];
      
      historico.push({
        usuario_id: user?.id,
        usuario_nome: user?.full_name || user?.email,
        minutos: minutes,
        data_registro: new Date().toISOString()
      });
      
      await base44.entities.Demanda.update(demanda.id, { 
        tempo_trabalho_minutos: newTotal,
        historico_tempo_trabalho: historico
      });
      queryClient.invalidateQueries({ queryKey: ['demanda', demanda.id] });
      toast.success(`${minutes} minutos adicionados ao tempo de trabalho!`);
    } catch (error) {
      toast.error('Erro ao salvar tempo de trabalho');
    }
  };

  // Recarrega demanda atual
  const { data: demandaAtual } = useQuery({
    queryKey: ['demanda', demanda?.id],
    queryFn: () => base44.entities.Demanda.filter({ id: demanda?.id }).then(d => d[0]),
    enabled: !!demanda?.id && open,
    initialData: demanda
  });

  const currentDemanda = demandaAtual || demanda;

  const { data: timeline = [] } = useQuery({
    queryKey: ['timeline', demanda?.id],
    queryFn: () => base44.entities.TimelineEvent.filter({ demanda_id: demanda?.id }, '-created_date', 100),
    enabled: !!demanda?.id && open,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const updateDemandaMutation = useMutation({
    mutationFn: (data) => base44.entities.Demanda.update(demanda.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['demandasKanban']);
      queryClient.invalidateQueries(['demanda', demanda.id]);
      queryClient.invalidateQueries(['timeline']);
      toast.success('Demanda atualizada!');
      setEditMode(false);
    },
  });

  const addComentarioMutation = useMutation({
    mutationFn: async ({ texto, anexo }) => {
      const event = await base44.entities.TimelineEvent.create({
        demanda_id: demanda.id,
        cliente_id: demanda.cliente_id,
        tipo: anexo ? 'anexo' : 'comentario',
        descricao: texto,
        autor: user?.full_name || user?.email,
        autor_tipo: user?.tipo_usuario?.startsWith('voxx') ? 'voxx' : 'cliente',
        anexo_url: anexo || null
      });
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['timeline']);
      setComentario('');
      toast.success('Comentário adicionado!');
    },
  });

  const deleteDemandaMutation = useMutation({
    mutationFn: () => base44.entities.Demanda.delete(demanda.id),
    onSuccess: () => {
      queryClient.invalidateQueries(['demandasKanban']);
      toast.success('Demanda excluída!');
      onClose();
    },
  });

  const handleComentarioFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const isImage = file.type.startsWith('image/');
      setComentarioAnexo({ name: file.name, url: file_url, isImage });
      toast.success('Arquivo anexado ao comentário!');
    } catch (error) {
      toast.error('Erro ao fazer upload');
    } finally {
      setUploading(false);
    }
  };

  const handleEnviarComentario = async () => {
    if (!comentario.trim() && !comentarioAnexo) return;
    
    const texto = comentarioAnexo 
      ? `${comentario.trim() || 'Anexo enviado'}\n[Arquivo: ${comentarioAnexo.name}]`
      : comentario;
    
    await addComentarioMutation.mutateAsync({ 
      texto, 
      anexo: comentarioAnexo?.url 
    });
    
    setComentarioAnexo(null);
  };

  const handlePasteImage = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        
        setUploading(true);
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          setComentarioAnexo({ name: file.name || 'Imagem colada', url: file_url, isImage: true });
          toast.success('Imagem colada e anexada!');
        } catch (error) {
          toast.error('Erro ao anexar imagem');
        } finally {
          setUploading(false);
        }
        break;
      }
    }
  };

  const handleSaveEdit = () => {
    updateDemandaMutation.mutate(editData);
  };

  const handleStatusChange = async (newStatus) => {
    const statusAnterior = demanda.status;
    
    await updateDemandaMutation.mutateAsync({ status: newStatus });
    
    await base44.entities.TimelineEvent.create({
      demanda_id: demanda.id,
      cliente_id: demanda.cliente_id,
      tipo: 'status_change',
      descricao: `Status alterado`,
      autor: user?.full_name || user?.email,
      autor_tipo: user?.tipo_usuario?.startsWith('voxx') ? 'voxx' : 'cliente',
      status_anterior: statusAnterior,
      status_novo: newStatus
    });
    
    queryClient.invalidateQueries(['timeline']);
  };

  if (!demanda) return null;

  const statusOptions = [
    { value: 'recebida', label: 'Recebida' },
    { value: 'em_triagem', label: 'Em Triagem' },
    { value: 'em_execucao', label: 'Em Execução' },
    { value: 'aguardando_cliente', label: 'Aguardando Cliente' },
    { value: 'em_revisao', label: 'Em Revisão' },
    { value: 'concluida', label: 'Concluída' }
  ];

  const priorityColors = {
    alta: 'bg-red-500',
    media: 'bg-yellow-500',
    baixa: 'bg-green-500',
  };

  const statusColors = {
    recebida: 'bg-blue-500',
    em_triagem: 'bg-indigo-500',
    em_execucao: 'bg-purple-500',
    aguardando_cliente: 'bg-orange-500',
    em_revisao: 'bg-yellow-500',
    concluida: 'bg-green-500',
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <SheetTitle className="text-xl pr-8">{currentDemanda.titulo}</SheetTitle>
                <SheetDescription className="mt-1">
                  Cliente: {currentDemanda.cliente_nome}
                </SheetDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditMode(!editMode)}
                className="flex-shrink-0"
              >
                {editMode ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
              </Button>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Status e Prioridade */}
            <div className="flex flex-wrap gap-2">
              {currentDemanda.urgente && (
                <Badge variant="destructive">Urgente</Badge>
              )}
              <Badge className={cn(statusColors[currentDemanda.status], 'text-white')}>
                {currentDemanda.status.replace(/_/g, ' ').charAt(0).toUpperCase() + currentDemanda.status.replace(/_/g, ' ').slice(1)}
              </Badge>
              <Badge className={cn(priorityColors[currentDemanda.prioridade], 'text-white')}>
                Prioridade: {currentDemanda.prioridade}
              </Badge>
            </div>

            {/* Modo de Edição */}
            {editMode ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Editar Demanda</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Título</Label>
                    <Input
                      value={editData.titulo}
                      onChange={(e) => setEditData({ ...editData, titulo: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea
                      value={editData.descricao}
                      onChange={(e) => setEditData({ ...editData, descricao: e.target.value })}
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Status</Label>
                      <Select value={editData.status} onValueChange={(v) => setEditData({ ...editData, status: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Prioridade</Label>
                      <Select value={editData.prioridade} onValueChange={(v) => setEditData({ ...editData, prioridade: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baixa">Baixa</SelectItem>
                          <SelectItem value="media">Média</SelectItem>
                          <SelectItem value="alta">Alta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Previsão de Entrega</Label>
                    <Input
                      type="date"
                      value={editData.previsao_entrega}
                      onChange={(e) => setEditData({ ...editData, previsao_entrega: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveEdit} disabled={updateDemandaMutation.isPending}>
                      {updateDemandaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                    </Button>
                    <Button variant="outline" onClick={() => setEditMode(false)}>
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Cronômetro de Trabalho */}
                <TimeTracker 
                  demandaId={demanda.id}
                  onSaveTime={handleSaveTime}
                  initialMinutes={0}
                />

                {/* Tempo Total de Trabalho */}
                {currentDemanda.tempo_trabalho_minutos > 0 && (
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Tempo Total de Trabalho</p>
                          <p className="text-2xl font-bold text-green-700 mt-1">
                            {currentDemanda.tempo_trabalho_minutos >= 60 
                              ? `${Math.floor(currentDemanda.tempo_trabalho_minutos / 60)}h ${currentDemanda.tempo_trabalho_minutos % 60}m`
                              : `${currentDemanda.tempo_trabalho_minutos}m`
                            }
                          </p>
                        </div>
                        <Clock className="w-8 h-8 text-green-600" />
                      </div>
                      
                      {/* Histórico de Tempo por Usuário */}
                      {currentDemanda.historico_tempo_trabalho && currentDemanda.historico_tempo_trabalho.length > 0 && (
                        <div className="border-t border-green-200 pt-3">
                          <p className="text-xs font-semibold text-gray-700 mb-2">Registros por Usuário:</p>
                          <div className="space-y-1.5 text-xs">
                            {currentDemanda.historico_tempo_trabalho.map((registro, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-white bg-opacity-50 p-1.5 rounded">
                                <span className="font-medium text-gray-700">{registro.usuario_nome}</span>
                                <span className="text-green-700 font-semibold">{registro.minutos}min</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Detalhes */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Detalhes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-slate-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-slate-700">Setor</p>
                        <p className="text-slate-600">{currentDemanda.setor.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    {currentDemanda.subcategoria && (
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-slate-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-slate-700">Subcategoria</p>
                          <p className="text-slate-600">{currentDemanda.subcategoria}</p>
                        </div>
                      </div>
                    )}
                    {currentDemanda.descricao && (
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-slate-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-slate-700">Descrição</p>
                          <p 
                            className="text-slate-600 whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{
                              __html: currentDemanda.descricao?.replace(
                                /(https?:\/\/[^\s]+)/g, 
                                '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-violet-600 hover:text-violet-700 underline">$1</a>'
                              )
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {currentDemanda.previsao_entrega && (
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 text-slate-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-slate-700">Previsão de Entrega</p>
                          <p className="text-slate-600">{moment(currentDemanda.previsao_entrega).tz('America/Sao_Paulo').format('DD/MM/YYYY')}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 text-slate-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-slate-700">Criada em</p>
                        <p className="text-slate-600">{moment(currentDemanda.created_date).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Anexos */}
                {currentDemanda.anexos && currentDemanda.anexos.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Anexos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {currentDemanda.anexos.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700"
                        >
                          <Paperclip className="h-4 w-4" />
                          Anexo {idx + 1}
                        </a>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Campos Adicionais */}
                {currentDemanda.campos_adicionais && Object.keys(currentDemanda.campos_adicionais).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Informações Adicionais</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {Object.entries(currentDemanda.campos_adicionais).map(([key, value]) => (
                        <div key={key}>
                          <p className="font-medium text-slate-700">{key.replace(/_/g, ' ')}</p>
                          <p className="text-slate-600">{value}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Timeline */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Histórico</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {timeline.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">Nenhum evento registrado</p>
                    ) : (
                      timeline.map((event) => (
                        <div key={event.id} className="flex gap-3 text-sm border-l-2 border-slate-200 pl-3 py-1">
                          <div className="flex-1">
                            <p 
                              className="font-medium text-slate-800 whitespace-pre-wrap"
                              dangerouslySetInnerHTML={{
                                __html: event.descricao?.replace(
                                  /(https?:\/\/[^\s]+)/g, 
                                  '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-violet-600 hover:text-violet-700 underline">$1</a>'
                                )
                              }}
                            />
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                              <User className="h-3 w-3" />
                              <span>{event.autor}</span>
                              <span>•</span>
                              <span>{moment(event.created_date).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm')}</span>
                            </div>
                            {event.anexo_url && (
                              <a
                                href={event.anexo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 mt-2 text-violet-600 hover:text-violet-700"
                              >
                                <Paperclip className="h-3 w-3" />
                                Ver anexo
                              </a>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Adicionar Comentário */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Adicionar Comentário</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      onPaste={handlePasteImage}
                      placeholder="Digite seu comentário ou cole uma imagem..."
                      className="min-h-[80px]"
                    />
                    
                    {comentarioAnexo && (
                      <div className="bg-violet-50 border border-violet-200 rounded-md p-3">
                        {comentarioAnexo.isImage ? (
                          <div className="space-y-2">
                            <img 
                              src={comentarioAnexo.url} 
                              alt={comentarioAnexo.name}
                              className="w-full max-w-xs rounded-md border border-violet-300"
                            />
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-violet-700">{comentarioAnexo.name}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setComentarioAnexo(null)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Paperclip className="h-4 w-4 text-violet-600" />
                              <span className="text-sm text-violet-700">{comentarioAnexo.name}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setComentarioAnexo(null)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={handleEnviarComentario}
                        disabled={(!comentario.trim() && !comentarioAnexo) || addComentarioMutation.isPending}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Enviar
                      </Button>
                      <Button variant="outline" disabled={uploading}>
                        <label className="cursor-pointer flex items-center">
                          {uploading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Paperclip className="h-4 w-4 mr-2" />
                          )}
                          Anexar Arquivo
                          <input
                            type="file"
                            className="hidden"
                            onChange={handleComentarioFileUpload}
                            disabled={uploading}
                          />
                        </label>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Ações Rápidas */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Mudar Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select value={currentDemanda.status} onValueChange={handleStatusChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {/* Excluir */}
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Demanda
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta demanda? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDemandaMutation.mutate()}
              className="bg-red-500 hover:bg-red-600"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DemandaDetailModal;