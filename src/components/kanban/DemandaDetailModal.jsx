import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// Sheet substituído por painel inline - evita conflito de portal (removeChild crash)
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Select não usado - removido
// AlertDialog substituído por dialog inline
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
  CheckCircle,
  Zap,
  ArrowRight,
  Building2,
  Tag,
  Layers,
  MessageCircle
} from 'lucide-react';
import moment from 'moment';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import 'moment-timezone';
import TimeTracker from '@/components/demandas/TimeTracker';
import TempoLimiteDemanda from '@/components/demandas/TempoLimiteDemanda';
import EntregasSection from '@/components/demandas/EntregasSection';
import EnviarComentarioWhatsAppModal from '@/components/demandas/EnviarComentarioWhatsAppModal';
import MoverCardSection from '@/components/kanban/MoverCardSection';
import AlteracaoManualSection from '@/components/kanban/AlteracaoManualSection';
import ItensDemandaSection from '@/components/kanban/ItensDemandaSection';
import EntregasPorItemSection from '@/components/demandas/EntregasPorItemSection';
import { isFeatureEnabled, FEATURES } from '@/lib/featureFlags';
import { getEstruturaDemanda } from '@/lib/estruturaDemanda';

const DemandaDetailModal = ({ demanda, open, onClose, kanbanColumns = [] }) => {
  const queryClient = useQueryClient();
  const [comentario, setComentario] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const enterEditMode = () => {
    setEditData({
      titulo: currentDemanda?.titulo || '',
      descricao: currentDemanda?.descricao || '',
      status: currentDemanda?.status || '',
      prioridade: currentDemanda?.prioridade || '',
      previsao_entrega: currentDemanda?.previsao_entrega || '',
      comunicar_cliente: currentDemanda?.comunicar_cliente || false,
      resumo_entrega_cliente: currentDemanda?.resumo_entrega_cliente || '',
      resumo_cliente: currentDemanda?.resumo_cliente || '',
      tipo_comunicacao: currentDemanda?.tipo_comunicacao || ''
    });
    setEditMode(true);
  };
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);

  const timerRef = useRef(null);
  const [comentarioAnexo, setComentarioAnexo] = useState(null);
  const [enviandoN8n, setEnviandoN8n] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showAlteracaoForm, setShowAlteracaoForm] = useState(false);
  const [comentarioParaWhatsApp, setComentarioParaWhatsApp] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  
  const [editData, setEditData] = useState({
    titulo: demanda?.titulo || '',
    descricao: demanda?.descricao || '',
    status: demanda?.status || '',
    prioridade: demanda?.prioridade || '',
    previsao_entrega: demanda?.previsao_entrega || '',
    comunicar_cliente: demanda?.comunicar_cliente || false,
    resumo_entrega_cliente: demanda?.resumo_entrega_cliente || '',
    resumo_cliente: demanda?.resumo_cliente || '',
    tipo_comunicacao: demanda?.tipo_comunicacao || ''
  });



  // Recarrega demanda atual — refetch frequente para manter cronômetros_ativos sempre atualizado
  const { data: demandaAtual } = useQuery({
    queryKey: ['demanda', demanda?.id],
    queryFn: () => base44.entities.Demanda.filter({ id: demanda?.id }).then(d => d[0]),
    enabled: !!demanda?.id && open,
    initialData: demanda,
    refetchInterval: 3000,
  });

  const currentDemanda = demandaAtual || demanda;

  // Fase 2B.1 — Piloto: EntregasPorItemSection apenas para a demanda piloto
  const isPilotoEntregasPorItem =
    currentDemanda?.id === '6a5e51c1f77aa0ea68dd3e42' &&
    getEstruturaDemanda(currentDemanda) === 'composta' &&
    isFeatureEnabled(FEATURES.ENTREGAS_POR_ITEM);

  const { data: itensDemanda = [] } = useQuery({
    queryKey: ['itensDemandaPiloto', currentDemanda?.id],
    queryFn: () => base44.entities.ItemDemanda.filter({ demanda_id: currentDemanda.id }, 'ordem', 50),
    enabled: !!currentDemanda?.id && isPilotoEntregasPorItem && open,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ['timeline', demanda?.id],
    queryFn: () => base44.entities.TimelineEvent.filter({ demanda_id: demanda?.id }, '-created_date', 100),
    enabled: !!demanda?.id && open,
  });

  const { data: historicoSetores = [] } = useQuery({
    queryKey: ['historicoSetores', demanda?.id],
    queryFn: () => base44.entities.DemandaHistoricoSetor.filter({ demanda_id: demanda?.id }, 'data_entrada', 50),
    enabled: !!demanda?.id && open,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const updateDemandaMutation = useMutation({
    mutationFn: (data) => base44.entities.Demanda.update(demanda.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandasKanban'] });
      queryClient.invalidateQueries({ queryKey: ['demanda', demanda.id] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
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
      // Atualiza última atividade relevante no kanban
      await base44.entities.Demanda.update(demanda.id, { ultima_atividade_kanban: new Date().toISOString() });
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['demandasKanban'] });
      setComentario('');
      setComentarioAnexo(null);
      toast.success('Comentário adicionado!');
    },
  });

  const updateComentarioMutation = useMutation({
    mutationFn: ({ eventId, texto }) => base44.entities.TimelineEvent.update(eventId, {
      descricao: texto,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      setEditingCommentId(null);
      setEditingCommentText('');
      toast.success('Comentário atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar comentário: ' + error.message);
    },
  });

  const handleStartEditComment = (event) => {
    setEditingCommentId(event.id);
    setEditingCommentText(event.descricao || '');
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleSaveEditComment = () => {
    if (!editingCommentText.trim()) {
      toast.error('O comentário não pode ficar vazio.');
      return;
    }
    updateComentarioMutation.mutate({ eventId: editingCommentId, texto: editingCommentText });
  };

  const deleteDemandaMutation = useMutation({
    mutationFn: () => base44.entities.Demanda.delete(demanda.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandasKanban'] });
      toast.success('Demanda excluída!');
      onClose();
    },
  });

  // Mutation para mover o card entre colunas (setores) do Kanban
  const moverCardMutation = useMutation({
    mutationFn: async (novoSetor) => {
      const setorAnterior = currentDemanda.setor;
      await base44.entities.Demanda.update(demanda.id, {
        setor: novoSetor,
        ultima_atividade_kanban: new Date().toISOString(),
      });
      base44.functions.invoke('registrarMovimentacaoSetor', {
        demanda_id: demanda.id,
        setor_novo: novoSetor,
        setor_anterior: setorAnterior || null,
        usuario_id: user?.id || null,
        usuario_nome: user?.full_name || user?.email || 'Sistema',
      }).catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandasKanban'] });
      queryClient.invalidateQueries({ queryKey: ['demanda', demanda.id] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      toast.success('Card movido com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao mover card: ' + error.message);
    },
  });

  const handleComentarioFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limpar o input para permitir reenvio do mesmo arquivo
    e.target.value = '';

    // Validar tamanho (25MB máx)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error('Arquivo muito grande. O tamanho máximo é 25MB.');
      return;
    }

    // Validar tipo
    const tiposPermitidos = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/quicktime',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (!tiposPermitidos.includes(file.type) && !file.type.startsWith('image/')) {
      toast.error('Formato não suportado. Use imagem, vídeo, PDF ou documento Office.');
      return;
    }

    setUploading(true);
    try {
      console.log('[Upload Comentário] Iniciando upload', {
        demanda_id: demanda?.id,
        nome: file.name,
        tipo: file.type,
        tamanho: file.size,
      });

      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      if (!file_url) throw new Error('URL do arquivo não retornada pelo servidor');

      const isImage = file.type.startsWith('image/');
      setComentarioAnexo({ name: file.name, url: file_url, isImage, tipo: file.type, tamanho: file.size });
      toast.success('Arquivo anexado! Clique em Enviar para salvar o comentário.');
    } catch (error) {
      console.error('[Upload Comentário] Falha', {
        demanda_id: demanda?.id,
        nome: file.name,
        tipo: file.type,
        tamanho: file.size,
        erro: error?.message,
      });
      toast.error('Não foi possível enviar o arquivo. Verifique o tamanho ou formato e tente novamente.');
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

  const handleEnviarComentarioWhatsApp = async () => {
    if (!comentario.trim() && !comentarioAnexo) return;
    
    // Buscar cliente para validar grupo WhatsApp
    const clienteData = await base44.entities.Cliente.filter({ id: currentDemanda.cliente_id });
    const cliente = clienteData[0];
    
    if (!cliente?.whatsapp_grupo_id) {
      toast.error('Este cliente ainda não possui grupo WhatsApp vinculado. Vincule o grupo no Radar WhatsApp antes de enviar.');
      return;
    }

    // Verificar Z-API
    const zapiRes = await base44.functions.invoke('zapiStatus', {});
    if (!zapiRes.data?.connected) {
      toast.error('Instância Z-API desconectada. Verifique a conexão antes de enviar.');
      return;
    }

    // Salvar comentário primeiro
    const texto = comentarioAnexo 
      ? `${comentario.trim() || 'Anexo enviado'}\n[Arquivo: ${comentarioAnexo.name}]`
      : comentario;
    
    addComentarioMutation.mutate({ texto, anexo: comentarioAnexo?.url });
    
    setComentarioParaWhatsApp(texto);
    setComentarioAnexo(null);
    setShowWhatsAppModal(true);
  };

  const handlePasteImage = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) break;

        setUploading(true);
        try {
          console.log('[Upload Paste] Enviando imagem colada', { demanda_id: demanda?.id, tipo: file.type });
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          if (!file_url) throw new Error('URL não retornada');
          setComentarioAnexo({ name: 'Imagem colada', url: file_url, isImage: true, tipo: file.type });
          toast.success('Imagem colada e anexada!');
        } catch (error) {
          console.error('[Upload Paste] Falha', { erro: error?.message });
          toast.error('Não foi possível enviar a imagem colada. Tente novamente.');
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
    
    const updates = { status: newStatus };
    if (newStatus === 'concluida' || newStatus === 'finalizada') {
      updates.data_conclusao = new Date().toISOString();
    }
    
    await updateDemandaMutation.mutateAsync(updates);
    
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
    
    queryClient.invalidateQueries({ queryKey: ['timeline'] });
  };

  const handleEnviarParaN8n = async () => {
    setEnviandoN8n(true);
    try {
      const jsonData = gerarJSONAgente();
      const response = await base44.functions.invoke('enviarBriefingParaN8n', {
        demanda_id: currentDemanda.id,
        briefing_json: jsonData
      });
      
      if (response.data.success) {
        toast.success('Briefing enviado com sucesso! IA está gerando o conteúdo.');
      } else {
        toast.error(response.data.error || 'Erro ao enviar para n8n');
      }
    } catch (error) {
      console.error('Erro ao enviar para n8n:', error);
      toast.error('Erro ao processar solicitação');
    } finally {
      setEnviandoN8n(false);
    }
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

🎞️ Modelo selecionado: ${v('modelo_edicao')}${ca.modelo_observacao ? `\n📝 Observação sobre o modelo: ${ca.modelo_observacao}` : ''}

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

  const handleOpenFile = async (url) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch {
      window.open(url, '_blank');
    }
  };

  if (!demanda) return null;

  // Mapa de labels dos setores
  const SETOR_LABELS = {
    ATENDIMENTO: 'Atendimento', TRAFEGO_META: 'Tráfego Meta Ads', TRAFEGO_GOOGLE: 'Tráfego Google Ads',
    TRAFEGO_TIKTOK: 'Tráfego TikTok', CRIACAO: 'Criação', EDICAO: 'Edição de Vídeo',
    BI_RELATORIO: 'BI & Relatórios', IMPLANTACAO: 'Implantação', FINANCEIRO: 'Financeiro',
    ALTERACAO_CRIACAO: 'Alteração Criação', AUTOMACAO: 'Automação', SALDOS: 'Saldos',
  };
  const setorLabel = (s) => SETOR_LABELS[s] || s?.replace(/_/g, ' ') || '–';

  // Calcular setores envolvidos a partir do histórico
  const setoresEnvolvidos = (() => {
    const map = {};
    historicoSetores.forEach(h => {
      if (!map[h.setor]) map[h.setor] = { setor: h.setor, minutos: 0, atual: false };
      if (h.minutos_no_setor) map[h.setor].minutos += h.minutos_no_setor;
      if (!h.data_saida) map[h.setor].atual = true;
    });
    return Object.values(map);
  })();

  const isOralSin = currentDemanda?.cliente_nome?.toLowerCase().includes('oral sin');
  const mostrarBriefingVOXX = currentDemanda?.setor === 'CRIACAO' && isOralSin && currentDemanda?.campos_adicionais;
  const mostrarBriefingEdicao = currentDemanda?.setor === 'EDICAO' && currentDemanda?.campos_adicionais;
  const mostrarBriefingUniversal = currentDemanda?.setor === 'CRIACAO' && !isOralSin && currentDemanda?.campos_adicionais?.briefing_universal;
  
  let dadosBriefingEdicao = null;
  if (mostrarBriefingEdicao && currentDemanda) {
    try {
      dadosBriefingEdicao = gerarBriefingEdicao();
    } catch (error) {
      console.error('Erro ao gerar briefing de edição:', error);
    }
  }

  const statusOptions = [
    { value: 'recebida', label: 'Recebida' },
    { value: 'em_triagem', label: 'Em Triagem' },
    { value: 'programada', label: 'Programada' },
    { value: 'em_execucao', label: 'Em Execução' },
    { value: 'aguardando_cliente', label: 'Aguardando Cliente' },
    { value: 'em_revisao', label: 'Em Revisão' },
    { value: 'concluida', label: 'Concluída' },
    { value: 'finalizada', label: 'Finalizada' }
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
    finalizada: 'bg-slate-500',
  };

  if (!open) return null;

  const handleClose = () => {
    // Verifica diretamente no TimeTracker via ref se o cronômetro está rodando,
    // evitando depender de currentDemanda possivelmente stale.
    const meuCronometroAtivo = (currentDemanda?.cronometros_ativos || []).find(c => c.usuario_id === user?.id);
    if (meuCronometroAtivo) {
      setShowPauseDialog(true);
    } else {
      onClose();
    }
  };

  // Evita duplo disparo do handleClose (overlay + container pai)
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay — um único handler para evitar duplo disparo */}
      <div className="absolute inset-0 bg-black/40" onClick={handleOverlayClick} />
      
      {/* Painel lateral */}
      <div className="relative w-full sm:max-w-2xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-semibold pr-8">{currentDemanda.titulo}</h2>
              <p className="text-sm text-muted-foreground mt-1">Cliente: {currentDemanda.cliente_nome}</p>
              <div className="mt-2">
                <TimeTracker ref={timerRef} demandaId={demanda.id} />
                <TempoLimiteDemanda demanda={currentDemanda} />
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => editMode ? setEditMode(false) : enterEditMode()}
              >
                {editMode ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
            {/* Identidade da Demanda */}
            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <div>
                <p className="text-slate-400 font-medium uppercase tracking-wide mb-0.5">Setor Principal</p>
                <p className="font-semibold text-violet-700">{setorLabel(currentDemanda.setor_responsavel_original || currentDemanda.setor)}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium uppercase tracking-wide mb-0.5">Setor Atual (Kanban)</p>
                <p className="font-semibold text-slate-700">{setorLabel(currentDemanda.setor)}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium uppercase tracking-wide mb-0.5">Criado em</p>
                <p className="text-slate-600">{moment(currentDemanda.created_date).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm')}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium uppercase tracking-wide mb-0.5">Status</p>
                <p className="text-slate-600 capitalize">{currentDemanda.status?.replace(/_/g, ' ')}</p>
              </div>
              {currentDemanda.data_conclusao && (
                <div className="col-span-2">
                  <p className="text-slate-400 font-medium uppercase tracking-wide mb-0.5">Concluído em</p>
                  <p className="text-green-700 font-semibold">{moment(currentDemanda.data_conclusao).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm')}</p>
                </div>
              )}
            </div>

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
                      <select
                        value={editData.status}
                        onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {statusOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Prioridade</Label>
                      <select
                        value={editData.prioridade}
                        onChange={(e) => setEditData({ ...editData, prioridade: e.target.value })}
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="baixa">Baixa</option>
                        <option value="media">Média</option>
                        <option value="alta">Alta</option>
                      </select>
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
                {/* Itens da Demanda Composta (Fase 1 — Modelo Híbrido) */}
                {isFeatureEnabled(FEATURES.ITENS_DEMANDA) && getEstruturaDemanda(currentDemanda) === 'composta' && (
                  <ItensDemandaSection demanda={currentDemanda} user={user} />
                )}

                {/* Entregas e Aprovações — Fase 2B.1: piloto usa EntregasPorItemSection */}
                {isPilotoEntregasPorItem ? (
                  <EntregasPorItemSection
                    demanda={currentDemanda}
                    user={user}
                    itens={itensDemanda}
                  />
                ) : (
                  <EntregasSection demanda={currentDemanda} user={user} />
                )}

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
                        <p className="font-medium text-slate-700">Setor Atual (Kanban)</p>
                        <p className="text-slate-600">{currentDemanda.setor.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    {currentDemanda.setor_responsavel_original && (
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-violet-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-slate-700">Setor Responsável Original</p>
                          <p className="text-violet-700 font-medium">{currentDemanda.setor_responsavel_original.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                    )}
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
                    {currentDemanda.data_conclusao && (
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-slate-700">Data de Conclusão</p>
                          <p className="text-green-700 font-medium">{moment(currentDemanda.data_conclusao).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm')}</p>
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
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleOpenFile(url)}
                          className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700"
                        >
                          <Paperclip className="h-4 w-4" />
                          Anexo {idx + 1}
                        </button>
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

                {/* Briefing Universal — Clientes não Oral Sin */}
                {mostrarBriefingUniversal && (() => {
                  const bu = currentDemanda.campos_adicionais.briefing_universal;
                  const val = (campo) => bu[campo] || 'Não informado';
                  const texto = `📦 BRIEFING DE CRIAÇÃO (RESUMO)
══════════════════════════

[FORMATO] ${val('formato')}
[CANAL] ${val('canal')}
[TEMA] ${val('tema')}
[OFERTA] ${val('oferta')}
[OBJETIVO] ${val('objetivo')}
[CTA] ${val('cta')}
[DESTINO] ${val('destino_tipo')}${bu.destino ? ` → ${bu.destino}` : ''}
[TOM] ${val('tom')} | [LINGUAGEM] ${val('linguagem')}
[TIPO_IMAGEM] ${val('tipo_imagem')}
[PRAZO] ${val('prazo')}${bu.urgente === 'Sim' ? ` ⚡ URGENTE: ${bu.motivo_urgencia}` : ''}

══════════════════════════
🪝 HOOKS (3 variações):
${(bu.hooks || []).map((h, i) => `${i + 1}. ${h}`).join('\n') || 'Não gerado'}

══════════════════════════
✍️ COPY DA ARTE:
${bu.copy_arte || 'Não gerado'}

══════════════════════════
🎨 DIREÇÃO DE ARTE:
${bu.direcao_arte || 'Não gerado'}

══════════════════════════
🏗️ ESTRUTURA DO CRIATIVO:
${bu.estrutura_criativo || 'Não gerado'}
`.trim();

                  return (
                    <Card key="briefing-universal">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <CardTitle className="text-base">📦 Briefing de Criação (Resumo)</CardTitle>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { navigator.clipboard.writeText(texto); toast.success('Briefing copiado!'); }}
                          >
                            <Copy className="w-3 h-3 mr-1" /> Copiar briefing
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          value={texto}
                          readOnly
                          className="min-h-[500px] font-mono text-xs bg-slate-900 text-blue-300 border-slate-700"
                        />
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Campos Adicionais - somente se não tiver briefing específico */}
                {!mostrarBriefingVOXX && !mostrarBriefingEdicao && !mostrarBriefingUniversal && currentDemanda.campos_adicionais && Object.keys(currentDemanda.campos_adicionais).length > 0 && (() => {
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

                {/* Setores Envolvidos */}
                {setoresEnvolvidos.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Layers className="w-4 h-4 text-violet-600" />
                        Setores Envolvidos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2">
                        {setoresEnvolvidos.map((se, idx) => (
                          <div key={idx} className={cn(
                            'p-2.5 rounded-lg border text-xs',
                            se.atual ? 'bg-violet-50 border-violet-200' : 'bg-slate-50 border-slate-200'
                          )}>
                            <p className={cn('font-semibold', se.atual ? 'text-violet-700' : 'text-slate-700')}>
                              {setorLabel(se.setor)}
                            </p>
                            <p className="text-slate-500 mt-0.5">
                              {se.atual ? (
                                <span className="inline-flex items-center gap-1 text-violet-600 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block"></span>
                                  Atual
                                </span>
                              ) : se.minutos > 0 ? (
                                se.minutos >= 60 ? `${Math.floor(se.minutos/60)}h ${se.minutos%60}m` : `${se.minutos}m`
                              ) : 'Em trânsito'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Histórico de Movimentação por Setor */}
                {historicoSetores.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ArrowRight className="w-4 h-4 text-violet-600" />
                        Histórico de Movimentação
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-0">
                      {historicoSetores.map((h, idx) => (
                        <div key={h.id || idx} className="relative flex gap-3 pb-4">
                          {/* Linha vertical conectando itens */}
                          {idx < historicoSetores.length - 1 && (
                            <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-200" />
                          )}
                          {/* Ponto */}
                          <div className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 z-10',
                            !h.data_saida ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-500'
                          )}>
                            <Building2 className="w-3 h-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {h.setor_anterior && (
                                <>
                                  <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{setorLabel(h.setor_anterior)}</span>
                                  <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                </>
                              )}
                              <span className={cn(
                                'text-xs font-semibold px-1.5 py-0.5 rounded',
                                !h.data_saida ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700'
                              )}>
                                {setorLabel(h.setor)}
                              </span>
                              {!h.data_saida && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Atual</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                              <div>Entrada: {moment(h.data_entrada).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm')}</div>
                              {h.data_saida && (
                                <div>Saída: {moment(h.data_saida).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm')}</div>
                              )}
                              {h.minutos_no_setor > 0 && (
                                <div className="font-medium text-slate-500">
                                  Tempo: {h.minutos_no_setor >= 60 ? `${Math.floor(h.minutos_no_setor/60)}h ${h.minutos_no_setor%60}m` : `${h.minutos_no_setor}m`}
                                </div>
                              )}
                            </div>
                          </div>
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
                      timeline.map((event) => {
                        const isComentario = event.tipo === 'comentario' || event.tipo === 'anexo';
                        const isEditing = editingCommentId === event.id;
                        return (
                          <div key={event.id} className="flex gap-3 text-sm border-l-2 border-slate-200 pl-3 py-1">
                            <div className="flex-1">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <Textarea
                                    value={editingCommentText}
                                    onChange={(e) => setEditingCommentText(e.target.value)}
                                    className="min-h-[80px]"
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={handleSaveEditComment}
                                      disabled={updateComentarioMutation.isPending}
                                    >
                                      {updateComentarioMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      ) : (
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                      )}
                                      Salvar
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={handleCancelEditComment}>
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
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
                                    {isComentario && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 px-1.5 text-xs text-slate-400 hover:text-violet-600"
                                        onClick={() => handleStartEditComment(event)}
                                      >
                                        <Edit className="h-3 w-3 mr-1" />
                                        Editar
                                      </Button>
                                    )}
                                  </div>
                                  {event.anexo_url && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenFile(event.anexo_url)}
                                      className="flex items-center gap-1 mt-2 text-violet-600 hover:text-violet-700"
                                    >
                                      <Paperclip className="h-3 w-3" />
                                      Ver anexo
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
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
                    
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        onClick={handleEnviarComentario}
                        disabled={(!comentario.trim() && !comentarioAnexo) || addComentarioMutation.isPending || uploading}
                      >
                        {addComentarioMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Enviar
                      </Button>
                      <Button
                        variant="outline"
                        className="border-green-300 text-green-700 hover:bg-green-50 gap-2"
                        onClick={handleEnviarComentarioWhatsApp}
                        disabled={(!comentario.trim() && !comentarioAnexo) || addComentarioMutation.isPending || uploading}
                      >
                        <MessageCircle className="h-4 w-4" />
                        Enviar por WhatsApp
                      </Button>
                      <Button variant="outline" disabled={uploading} asChild>
                        <label className="cursor-pointer flex items-center gap-2">
                          {uploading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Enviando arquivo...
                            </>
                          ) : (
                            <>
                              <Paperclip className="h-4 w-4" />
                              Anexar Arquivo
                            </>
                          )}
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,video/mp4,video/quicktime,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            onChange={handleComentarioFileUpload}
                            disabled={uploading}
                          />
                        </label>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Alterações Manuais — formulário + lista */}
                <AlteracaoManualSection
                  demanda={currentDemanda}
                  user={user}
                  showForm={showAlteracaoForm}
                  onCloseForm={() => setShowAlteracaoForm(false)}
                />

                {/* Ações Rápidas */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Mudar Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <select
                      value={currentDemanda.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {statusOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </CardContent>
                </Card>

                {/* Sinalizar Alteração Manual */}
                <Button
                  variant="outline"
                  className={cn(
                    'w-full',
                    (currentDemanda.tags || []).includes('ajuste-manual')
                      ? 'border-orange-500 text-orange-700 bg-orange-100 hover:bg-orange-200'
                      : 'border-orange-300 text-orange-600 hover:bg-orange-50'
                  )}
                  onClick={() => setShowAlteracaoForm(true)}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Sinalizar Alteração
                </Button>

                {/* Mover Card entre colunas do Kanban */}
                <MoverCardSection
                  setorAtual={currentDemanda.setor}
                  columns={kanbanColumns}
                  onMove={(novoSetor) => moverCardMutation.mutate(novoSetor)}
                  isMoving={moverCardMutation.isPending}
                />

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

        {/* Dialog de Confirmação de Pausa do Cronômetro */}
        {showPauseDialog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-violet-500" />
                Cronômetro ativo
              </h3>
              <p className="text-sm text-slate-600 mb-6">
                Você tem um cronômetro rodando nesta demanda. O que deseja fazer?
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  className="bg-yellow-500 hover:bg-yellow-600 text-white"
                  onClick={async () => {
                    setShowPauseDialog(false);
                    await timerRef.current?.pause();
                    onClose();
                  }}
                >
                  Pausar e fechar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setShowPauseDialog(false); onClose(); }}
                >
                  Deixar rodando e fechar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowPauseDialog(false)}
                >
                  Cancelar (voltar)
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal WhatsApp */}
        <EnviarComentarioWhatsAppModal
          open={showWhatsAppModal}
          onClose={() => {
            setShowWhatsAppModal(false);
            setComentario('');
          }}
          demanda={currentDemanda}
          comentarioOriginal={comentarioParaWhatsApp}
          user={user}
        />

        {/* Dialog de Confirmação de Exclusão - inline, sem portal */}
        {showDeleteDialog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteDialog(false)} />
            <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Confirmar Exclusão
              </h3>
              <p className="text-sm text-slate-600 mb-6">
                Tem certeza que deseja excluir esta demanda? Esta ação não pode ser desfeita.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
                <Button
                  className="bg-red-500 hover:bg-red-600 text-white"
                  onClick={() => deleteDemandaMutation.mutate()}
                >
                  Excluir
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DemandaDetailModal;