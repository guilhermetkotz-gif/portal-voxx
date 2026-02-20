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
  Loader2,
  Copy,
  CheckCircle
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

  // Funções de briefing (mesma lógica do DemandaDetail)
  const gerarBriefingVOXX = () => {
    if (!currentDemanda.campos_adicionais) return '';
    const campos = currentDemanda.campos_adicionais;
    const val = (campo) => campos[campo] || 'Não informado';
    return `BRIEFING VOXX | Image Performance Engine™ – Oral Sin

══════════════════════════════════════════════════════

📋 DADOS GERAIS
Cliente: ${currentDemanda.cliente_nome || 'Não informado'}
Unidade: ${val('cidade_unidade')}
WhatsApp: ${val('whatsapp_unidade')}

══════════════════════════════════════════════════════

🎨 ESPECIFICAÇÕES CRIATIVAS
Formato: ${val('formato_peca')}
Canal de Uso: ${val('canal_uso')}
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
Diferencial da Unidade: ${val('diferencial_unidade')}

══════════════════════════════════════════════════════

📝 OBSERVAÇÕES ADICIONAIS
${val('observacoes_extras')}

══════════════════════════════════════════════════════

⚙️ METADATA
ID Demanda: ${currentDemanda.id}
Data Criação: ${moment(currentDemanda.created_date).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm')}
Status: ${currentDemanda.status}
`.trim();
  };

  const gerarJSONAgente = () => {
    if (!currentDemanda.campos_adicionais) return '';
    const campos = currentDemanda.campos_adicionais;
    const val = (campo) => campos[campo] || 'Não informado';

    const derivarTipoCampanha = () => {
      const obj = val('objetivo_peca').toLowerCase();
      if (obj.includes('comercial') || obj.includes('conversão') || obj.includes('whatsapp') || obj.includes('reativação')) {
        return 'Comercial';
      }
      if (obj.includes('autoridade') || obj.includes('educativo') || obj.includes('institucional')) {
        return 'Institucional';
      }
      return 'Não informado';
    };

    const derivarFocoCriativo = () => {
      const estilo = val('estilo_comunicacao').toLowerCase();
      if (estilo.includes('comercial direto')) return 'Comercial';
      if (estilo.includes('técnico clínico')) return 'Técnico';
      if (estilo.includes('emocional humanizado')) return 'Emocional';
      if (estilo.includes('híbrido')) return 'Híbrido';
      return 'Não informado';
    };

    const derivarNivelFunil = () => {
      const obj = val('objetivo_peca').toLowerCase();
      if (obj.includes('comercial') || obj.includes('whatsapp') || obj.includes('reativação')) {
        return 'BOFU';
      }
      if (obj.includes('autoridade') || obj.includes('educativo')) {
        return 'TOFU/MOFU';
      }
      return 'Não informado';
    };

    const tipoImagem = val('tipo_imagem').toLowerCase();
    const precisaAnexo = tipoImagem.includes('dra da unidade') || tipoImagem.includes('paciente real');
    const temAnexo = currentDemanda.anexos && currentDemanda.anexos.length > 0;
    const anexosOk = !precisaAnexo || temAnexo;

    const jsonObj = {
      agent: "VOXX | Image Performance Engine™ – Oral Sin",
      version: "VOXX_BRIEFING_ORALSIN_v1",
      demanda_id: currentDemanda.id,
      created_at: currentDemanda.created_date,
      cliente: {
        nome: currentDemanda.cliente_nome || 'Não informado',
        unidade: currentDemanda.cliente_nome || 'Não informado',
        cidade: val('cidade_unidade'),
        whatsapp: val('whatsapp_unidade')
      },
      peca: {
        formato: val('formato_peca'),
        canal_uso: val('canal_uso'),
        subcategoria: currentDemanda.subcategoria || 'Não informado',
        tema_principal: val('tema_principal'),
        objetivo: val('objetivo_peca'),
        tipo_campanha: derivarTipoCampanha(),
        foco_criativo: derivarFocoCriativo(),
        nivel_funil: derivarNivelFunil(),
        estilo_comunicacao: val('estilo_comunicacao')
      },
      imagem: {
        tipo: val('tipo_imagem'),
        anexos_obrigatorios_ok: anexosOk,
        assets: currentDemanda.anexos || []
      },
      agenda: {
        urgencia_real: val('urgencia_agenda'),
        motivo_urgencia: val('motivo_urgencia'),
        data_desejada_entrega: currentDemanda.previsao_entrega || 'Não informado'
      },
      mensagem: {
        mensagem_chave: val('mensagem_chave'),
        objecao_dominante: val('objecao_dominante'),
        diferencial_unidade: val('diferencial_unidade'),
        observacoes_extras: val('observacoes_extras')
      }
    };

    if (!anexosOk) {
      jsonObj.pendencias = ['Enviar foto em boa qualidade'];
    }

    return JSON.stringify(jsonObj, null, 2);
  };

  const gerarBriefingEdicao = () => {
    if (!currentDemanda.campos_adicionais) return { briefing: '', score: 0, nivel: '', pendencias: [] };
    const ca = currentDemanda.campos_adicionais;
    const componentes = ca.componentes || {};
    const v = (campo) => ca[campo] || 'Não informado';
    
    const anexosVideo = (currentDemanda.anexos || []).filter(a => 
      a.includes('.mp4') || a.includes('.mov') || a.includes('.avi') || a.includes('video')
    );
    const qtdVideos = ca.video_source_type === 'upload' ? anexosVideo.length : (ca.video_link ? 1 : 0);
    
    const statusCapa = componentes.capa === true ? 'ATIVO' : 'NÃO SOLICITADO';
    const statusLegenda = componentes.legenda === true ? 'ATIVO' : 'NÃO SOLICITADO';
    const statusLettering = componentes.lettering === true ? 'ATIVO' : 'NÃO SOLICITADO';
    const statusVinheta = componentes.vinheta === true ? 'ATIVO' : 'NÃO SOLICITADO';
    const statusEtiqueta = componentes.etiqueta === true ? 'ATIVO' : 'NÃO SOLICITADO';
    
    let score = 100;
    const motivos = [];
    const pendencias = [];
    
    if (!ca.video_link && qtdVideos === 0) {
      score -= 60;
      motivos.push('Vídeo não enviado');
      pendencias.push('🔴 VÍDEO AUSENTE - Nenhum vídeo ou link foi fornecido');
    }
    
    const qualityCheck = ca.video_quality_check || {};
    if (qualityCheck.melhor_qualidade !== true && qualityCheck.posicao_correta !== true && qualityCheck.audio_compreensivel !== true) {
      score -= 10;
    }
    
    if (componentes.capa === true) {
      if (!ca.modelo_capa) {
        score -= 15;
        motivos.push('Modelo de capa não selecionado');
        pendencias.push('🔴 CAPA INCOMPLETA - Modelo de capa não selecionado');
      }
      if (!ca.texto_capa) {
        score -= 15;
        motivos.push('Texto de capa ausente');
        pendencias.push('🔴 CAPA INCOMPLETA - Texto da capa não informado');
      }
    }
    
    if (componentes.etiqueta === true) {
      if (!ca.nome_dra) {
        score -= 10;
        motivos.push('Nome da Dra não informado');
        pendencias.push('🔴 ETIQUETA INCOMPLETA - Nome da Dra não informado');
      }
      if (!ca.cro_dra) {
        score -= 15;
        motivos.push('CRO não informado');
        pendencias.push('🔴 ETIQUETA INCOMPLETA - CRO não informado');
      }
    }
    
    if (componentes.vinheta === true && ca.vinheta_tipo === 'propria') {
      const temVinheta = (currentDemanda.anexos || []).some(a => a.toLowerCase().includes('vinheta'));
      if (!temVinheta) {
        score -= 15;
        motivos.push('Vinheta própria sem arquivo');
        pendencias.push('🔴 VINHETA PRÓPRIA SEM ARQUIVO - Arquivo de vinheta não anexado');
      }
    }
    
    if (componentes.lettering === true) {
      if (ca.lettering_modo === 'fornecer' && !ca.lettering_frases) {
        score -= 15;
        motivos.push('Frases de lettering não fornecidas');
        pendencias.push('🔴 LETTERING INCOMPLETO - Frases não fornecidas');
      }
    }
    
    score = Math.max(0, Math.min(100, score));
    
    let nivelRisco = '';
    if (score >= 85) nivelRisco = 'BAIXO RISCO';
    else if (score >= 70) nivelRisco = 'MÉDIO RISCO';
    else if (score >= 50) nivelRisco = 'ALTO RISCO';
    else nivelRisco = 'CRÍTICO';
    
    const statusValidacao = pendencias.length > 0 ? 'REVISAR INFORMAÇÕES' : 'APTO PARA EDIÇÃO';
    
    const briefing = `📦 BRIEFING DE EDIÇÃO — RESUMO OPERACIONAL
==================================================

🏢 CLIENTE: ${currentDemanda.cliente_nome}
📁 DEMANDA ID: ${currentDemanda.id}
📅 PRAZO: ${currentDemanda.previsao_entrega ? moment(currentDemanda.previsao_entrega).tz('America/Sao_Paulo').format('DD/MM/YYYY') : 'Não informado'}

--------------------------------------------------
🎬 MODELO DE EDIÇÃO
--------------------------------------------------

🎞️ Modelo selecionado: ${v('modelo_edicao')}

--------------------------------------------------
📥 VÍDEO BASE
--------------------------------------------------

Origem: ${ca.video_source_type === 'upload' ? '📤 Upload direto' : '🔗 Link'}
Qtd. vídeos: ${qtdVideos}
Link (se houver): ${v('video_link')}

==================================================
🧩 COMPONENTES SOLICITADOS
==================================================

[CAPA]
Status: ${statusCapa}
${componentes.capa === true ? `Modelo: ${v('modelo_capa')}
Texto da capa: "${v('texto_capa')}"` : ''}

--------------------------------------------

[LEGENDA]
Status: ${statusLegenda}
${componentes.legenda === true ? `Estilo: ${v('estilo_legenda')}
Linguagem: ${v('linguagem_legenda')}` : ''}

--------------------------------------------

[LETTERING]
Status: ${statusLettering}
${componentes.lettering === true ? `Modo: ${v('lettering_modo')}
${ca.lettering_modo === 'fornecer' ? `Frases: ${v('lettering_frases')}` : 'Editor sugere baseado no vídeo'}` : ''}

--------------------------------------------

[VINHETA]
Status: ${statusVinheta}
${componentes.vinheta === true ? `Tipo: ${ca.vinheta_tipo === 'padrao' ? 'Padrão Voxx' : 'Cliente própria'}` : ''}

--------------------------------------------

[ETIQUETA]
Status: ${statusEtiqueta}
${componentes.etiqueta === true ? `Nome Dra: ${v('nome_dra')}
CRO: ${v('cro_dra')}` : ''}

==================================================
⚠️ ALERTAS AUTOMÁTICOS
==================================================

${pendencias.length > 0 ? pendencias.join('\n') : '✅ Nenhuma pendência detectada'}

==================================================
🎯 SCORE DE RISCO DE RETRABALHO
==================================================

Nível: ${nivelRisco}
Pontuação: ${score}/100
${motivos.length > 0 ? `Motivos críticos:\n${motivos.map(m => `• ${m}`).join('\n')}` : '✅ Briefing completo e bem estruturado'}

==================================================
✅ STATUS DE VALIDAÇÃO
==================================================

${statusValidacao}`.trim();
    
    return { briefing, score, nivelRisco, pendencias, statusValidacao };
  };

  const isOralSin = currentDemanda?.cliente_nome?.toLowerCase().includes('oral sin');
  const mostrarBriefingVOXX = currentDemanda?.setor === 'CRIACAO' && isOralSin && currentDemanda?.campos_adicionais;
  const mostrarBriefingEdicao = currentDemanda?.setor === 'EDICAO' && currentDemanda?.campos_adicionais;
  
  let dadosBriefingEdicao = null;
  if (mostrarBriefingEdicao && currentDemanda) {
    try {
      dadosBriefingEdicao = gerarBriefingEdicao();
    } catch (error) {
      console.error('Erro ao gerar briefing de edição:', error);
    }
  }

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

                {/* Briefing VOXX para Criação Oral Sin */}
                {mostrarBriefingVOXX && (
                  <>
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-violet-600" />
                            <CardTitle className="text-base">📦 Briefing para Agente VOXX</CardTitle>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(gerarBriefingVOXX());
                              toast.success('Briefing copiado!');
                            }}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copiar
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          value={gerarBriefingVOXX()}
                          readOnly
                          className="min-h-[300px] font-mono text-xs bg-slate-900 text-emerald-400 border-slate-700"
                        />
                        <p className="text-xs text-slate-400 mt-2">
                          Briefing otimizado para o VOXX | Image Performance Engine™
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-amber-600" />
                            <CardTitle className="text-base">🤖 INPUT COMPLETO PARA O AGENTE (JSON)</CardTitle>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(gerarJSONAgente());
                              toast.success('JSON copiado!');
                            }}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copiar JSON
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          value={gerarJSONAgente()}
                          readOnly
                          className="min-h-[400px] font-mono text-xs bg-slate-950 text-amber-300 border-slate-800"
                        />
                        <p className="text-xs text-slate-400 mt-2">
                          ⚡ Cole este JSON no agente para pular a coleta e ir direto para geração das peças
                        </p>
                      </CardContent>
                    </Card>
                  </>
                )}

                {/* Botão para enviar ao n8n */}
                {mostrarBriefingVOXX && (
                  <Card className="border-violet-200 bg-violet-50/50">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 mb-1">🤖 Geração Automática com IA</h4>
                          <p className="text-sm text-slate-600">
                            Envie o briefing completo para o n8n gerar imagem e briefing otimizado via GPT
                          </p>
                        </div>
                        <Button
                          onClick={handleEnviarParaN8n}
                          disabled={enviandoN8n}
                          className="ml-4 bg-violet-600 hover:bg-violet-700"
                        >
                          {enviandoN8n ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Processando...
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4 mr-2" />
                              Gerar com IA
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Briefing de Edição */}
                {mostrarBriefingEdicao && dadosBriefingEdicao && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-amber-600" />
                          <CardTitle className="text-base">📦 Briefing de Edição</CardTitle>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", 
                            dadosBriefingEdicao.score >= 85 ? "bg-green-100 text-green-700" :
                            dadosBriefingEdicao.score >= 70 ? "bg-yellow-100 text-yellow-700" :
                            dadosBriefingEdicao.score >= 50 ? "bg-orange-100 text-orange-700" :
                            "bg-red-100 text-red-700"
                          )}>
                            {dadosBriefingEdicao.nivelRisco}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(dadosBriefingEdicao.briefing);
                            toast.success('Briefing copiado!');
                          }}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copiar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Score visual */}
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700">Score de Qualidade</span>
                          <span className={cn("text-lg font-bold",
                            dadosBriefingEdicao.score >= 85 ? "text-green-600" :
                            dadosBriefingEdicao.score >= 70 ? "text-yellow-600" :
                            dadosBriefingEdicao.score >= 50 ? "text-orange-600" :
                            "text-red-600"
                          )}>
                            {dadosBriefingEdicao.score}/100
                          </span>
                        </div>
                        <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full transition-all",
                              dadosBriefingEdicao.score >= 85 ? "bg-green-500" :
                              dadosBriefingEdicao.score >= 70 ? "bg-yellow-500" :
                              dadosBriefingEdicao.score >= 50 ? "bg-orange-500" :
                              "bg-red-500"
                            )}
                            style={{ width: `${dadosBriefingEdicao.score}%` }}
                          />
                        </div>
                      </div>

                      {/* Alertas */}
                      {dadosBriefingEdicao.pendencias.length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm font-medium text-red-900 mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Pendências Detectadas
                          </p>
                          <div className="space-y-1 text-xs text-red-700">
                            {dadosBriefingEdicao.pendencias.map((p, idx) => (
                              <div key={idx}>{p}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Status */}
                      <div className={cn("p-3 rounded-lg",
                        dadosBriefingEdicao.statusValidacao === 'APTO PARA EDIÇÃO' 
                          ? "bg-green-50 border border-green-200" 
                          : "bg-amber-50 border border-amber-200"
                      )}>
                        <p className={cn("text-sm font-medium flex items-center gap-2",
                          dadosBriefingEdicao.statusValidacao === 'APTO PARA EDIÇÃO' 
                            ? "text-green-900" 
                            : "text-amber-900"
                        )}>
                          {dadosBriefingEdicao.statusValidacao === 'APTO PARA EDIÇÃO' ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <AlertTriangle className="w-4 h-4" />
                          )}
                          {dadosBriefingEdicao.statusValidacao}
                        </p>
                      </div>
                      
                      {/* Briefing completo */}
                      <Textarea
                        value={dadosBriefingEdicao.briefing}
                        readOnly
                        className="min-h-[400px] font-mono text-xs bg-slate-900 text-slate-100 border-slate-700"
                      />
                    </CardContent>
                  </Card>
                )}

                {/* Campos Adicionais - somente se não tiver briefing específico */}
                {!mostrarBriefingVOXX && !mostrarBriefingEdicao && currentDemanda.campos_adicionais && Object.keys(currentDemanda.campos_adicionais).length > 0 && (() => {
                  const isPrimitive = (value) => {
                    if (value === null || value === undefined) return false;
                    const type = typeof value;
                    if (type === 'object' || Array.isArray(value)) return false;
                    return type === 'string' || type === 'number' || type === 'boolean';
                  };
                  
                  const excludedKeys = ['componentes', 'video_quality_check'];
                  const primitiveFields = Object.entries(currentDemanda.campos_adicionais)
                    .filter(([key, value]) => !excludedKeys.includes(key) && isPrimitive(value));
                  
                  if (primitiveFields.length === 0) return null;
                  
                  return (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Informações Adicionais</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {primitiveFields.map(([key, value]) => {
                          const strValue = String(value);
                          const isUrl = /^https?:\/\/.+/i.test(strValue);
                          
                          return (
                            <div key={key}>
                              <p className="font-medium text-slate-700">{key.replace(/_/g, ' ')}</p>
                              {isUrl ? (
                                <a 
                                  href={strValue} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-violet-600 hover:text-violet-700 underline break-all"
                                >
                                  {strValue}
                                </a>
                              ) : (
                                <p className="text-slate-600">{strValue}</p>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })()}

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