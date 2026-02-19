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
  FileText,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";

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
ID Demanda: ${demanda.id}
Data Criação: ${format(new Date(demanda.created_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
Status: ${demanda.status}
`.trim();
  };

  // Função para gerar JSON completo para agente
  const gerarJSONAgente = () => {
    if (!demanda.campos_adicionais) return '';

    const campos = demanda.campos_adicionais;
    const val = (campo) => campos[campo] || 'Não informado';

    // Derivações automáticas
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

    // Verificar anexos obrigatórios
    const tipoImagem = val('tipo_imagem').toLowerCase();
    const precisaAnexo = tipoImagem.includes('dra da unidade') || tipoImagem.includes('paciente real');
    const temAnexo = demanda.anexos && demanda.anexos.length > 0;
    const anexosOk = !precisaAnexo || temAnexo;

    const jsonObj = {
      agent: "VOXX | Image Performance Engine™ – Oral Sin",
      version: "VOXX_BRIEFING_ORALSIN_v1",
      demanda_id: demanda.id,
      created_at: demanda.created_date,
      cliente: {
        nome: demanda.cliente_nome || 'Não informado',
        unidade: demanda.cliente_nome || 'Não informado',
        cidade: val('cidade_unidade'),
        whatsapp: val('whatsapp_unidade')
      },
      peca: {
        formato: val('formato_peca'),
        canal_uso: val('canal_uso'),
        subcategoria: demanda.subcategoria || 'Não informado',
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
        assets: demanda.anexos || []
      },
      agenda: {
        urgencia_real: val('urgencia_agenda'),
        motivo_urgencia: val('motivo_urgencia'),
        data_desejada_entrega: demanda.previsao_entrega || 'Não informado'
      },
      mensagem: {
        mensagem_chave: val('mensagem_chave'),
        objecao_dominante: val('objecao_dominante'),
        diferencial_unidade: val('diferencial_unidade'),
        observacoes_extras: val('observacoes_extras')
      }
    };

    // Adicionar pendências se necessário
    if (!anexosOk) {
      jsonObj.pendencias = ['Enviar foto em boa qualidade'];
    }

    return JSON.stringify(jsonObj, null, 2);
  };

  const handleCopiarBriefing = () => {
    const briefing = gerarBriefingVOXX();
    navigator.clipboard.writeText(briefing);
    toast.success('Briefing copiado para área de transferência!');
  };

  const handleCopiarJSON = () => {
    const json = gerarJSONAgente();
    navigator.clipboard.writeText(json);
    toast.success('JSON copiado para área de transferência!');
  };

  // Função para gerar briefing de edição com score de risco
  const gerarBriefingEdicao = () => {
    if (!demanda.campos_adicionais) return { briefing: '', score: 0, nivel: '', pendencias: [] };

    const ca = demanda.campos_adicionais;
    const componentes = ca.componentes || {};
    const v = (campo) => ca[campo] || 'Não informado';
    
    // Calcular quantidade de vídeos
    const anexosVideo = (demanda.anexos || []).filter(a => 
      a.includes('.mp4') || a.includes('.mov') || a.includes('.avi') || a.includes('video')
    );
    const qtdVideos = ca.video_source_type === 'upload' ? anexosVideo.length : (ca.video_link ? 1 : 0);
    
    // Status dos componentes
    const statusCapa = componentes.capa ? 'ATIVO' : 'NÃO SOLICITADO';
    const statusLegenda = componentes.legenda ? 'ATIVO' : 'NÃO SOLICITADO';
    const statusLettering = componentes.lettering ? 'ATIVO' : 'NÃO SOLICITADO';
    const statusVinheta = componentes.vinheta ? 'ATIVO' : 'NÃO SOLICITADO';
    const statusEtiqueta = componentes.etiqueta ? 'ATIVO' : 'NÃO SOLICITADO';
    
    // Calcular risco de retrabalho
    let score = 100;
    const motivos = [];
    const pendencias = [];
    
    // Validar vídeo
    if (!ca.video_link && qtdVideos === 0) {
      score -= 60;
      motivos.push('Vídeo não enviado');
      pendencias.push('🔴 VÍDEO AUSENTE - Nenhum vídeo ou link foi fornecido');
    }
    
    const qualityCheck = ca.video_quality_check || {};
    if (!qualityCheck.melhor_qualidade && !qualityCheck.posicao_correta && !qualityCheck.audio_compreensivel) {
      score -= 10;
    }
    
    // Validar capa
    if (componentes.capa) {
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
    
    // Validar etiqueta
    if (componentes.etiqueta) {
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
    
    // Validar vinheta
    if (componentes.vinheta && ca.vinheta_tipo === 'propria') {
      const temVinheta = (demanda.anexos || []).some(a => a.toLowerCase().includes('vinheta'));
      if (!temVinheta) {
        score -= 15;
        motivos.push('Vinheta própria sem arquivo');
        pendencias.push('🔴 VINHETA PRÓPRIA SEM ARQUIVO - Arquivo de vinheta não anexado');
      }
    }
    
    // Validar lettering
    if (componentes.lettering) {
      if (ca.lettering_modo === 'fornecer' && !ca.lettering_frases) {
        score -= 15;
        motivos.push('Frases de lettering não fornecidas');
        pendencias.push('🔴 LETTERING INCOMPLETO - Frases não fornecidas');
      }
    }
    
    // Garantir limites
    score = Math.max(0, Math.min(100, score));
    
    // Classificar risco
    let nivelRisco = '';
    if (score >= 85) nivelRisco = 'BAIXO RISCO';
    else if (score >= 70) nivelRisco = 'MÉDIO RISCO';
    else if (score >= 50) nivelRisco = 'ALTO RISCO';
    else nivelRisco = 'CRÍTICO';
    
    // Status de validação
    const statusValidacao = pendencias.length > 0 ? 'REVISAR INFORMAÇÕES' : 'APTO PARA EDIÇÃO';
    
    // Montar briefing
    const briefing = `📦 BRIEFING DE EDIÇÃO — RESUMO OPERACIONAL
==================================================

🏢 CLIENTE: ${demanda.cliente_nome}
📁 DEMANDA ID: ${demanda.id}
📅 PRAZO: ${demanda.previsao_entrega ? format(new Date(demanda.previsao_entrega), 'dd/MM/yyyy', { locale: ptBR }) : 'Não informado'}

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
${componentes.capa ? `Modelo: ${v('modelo_capa')}
Texto da capa: "${v('texto_capa')}"` : ''}

--------------------------------------------

[LEGENDA]
Status: ${statusLegenda}
${componentes.legenda ? `Estilo: ${v('estilo_legenda')}
Linguagem: ${v('linguagem_legenda')}` : ''}

--------------------------------------------

[LETTERING]
Status: ${statusLettering}
${componentes.lettering ? `Modo: ${v('lettering_modo')}
${ca.lettering_modo === 'fornecer' ? `Frases: ${v('lettering_frases')}` : 'Editor sugere baseado no vídeo'}` : ''}

--------------------------------------------

[VINHETA]
Status: ${statusVinheta}
${componentes.vinheta ? `Tipo: ${ca.vinheta_tipo === 'padrao' ? 'Padrão Voxx' : 'Cliente própria'}` : ''}

--------------------------------------------

[ETIQUETA]
Status: ${statusEtiqueta}
${componentes.etiqueta ? `Nome Dra: ${v('nome_dra')}
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

  // Verificar se é demanda CRIACAO + Oral Sin
  const isOralSin = demanda.cliente_nome?.toLowerCase().includes('oral sin');
  const mostrarBriefingVOXX = demanda.setor === 'CRIACAO' && isOralSin && demanda.campos_adicionais;

  // Verificar se é demanda EDICAO e gerar briefing
  const mostrarBriefingEdicao = demanda.setor === 'EDICAO' && demanda.campos_adicionais;
  const dadosBriefingEdicao = mostrarBriefingEdicao ? gerarBriefingEdicao() : null;

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

          {/* Campos Adicionais - apenas valores primitivos */}
          {demanda.campos_adicionais && Object.keys(demanda.campos_adicionais).length > 0 && !mostrarBriefingVOXX && !mostrarBriefingEdicao && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Informações adicionais</p>
              <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                {Object.entries(demanda.campos_adicionais)
                  .filter(([key, value]) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
                  .map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-slate-500">{key.replace(/_/g, ' ')}</span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Briefing VOXX */}
          {mostrarBriefingVOXX && (
            <>
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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-600" />
                    <p className="text-xs text-slate-500">🤖 INPUT COMPLETO PARA O AGENTE (JSON)</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopiarJSON}
                    className="h-7 text-xs"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copiar JSON
                  </Button>
                </div>
                <Textarea
                  value={gerarJSONAgente()}
                  readOnly
                  className="min-h-[400px] font-mono text-xs bg-slate-950 text-amber-300 border-slate-800"
                />
                <p className="text-xs text-slate-400 mt-2">
                  ⚡ Cole este JSON no agente para pular a coleta e ir direto para geração das peças
                </p>
              </div>
            </>
          )}

          {/* Briefing de Edição */}
          {mostrarBriefingEdicao && dadosBriefingEdicao && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  📦 Briefing de Edição (Resumo)
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", 
                    dadosBriefingEdicao.score >= 85 ? "bg-green-100 text-green-700" :
                    dadosBriefingEdicao.score >= 70 ? "bg-yellow-100 text-yellow-700" :
                    dadosBriefingEdicao.score >= 50 ? "bg-orange-100 text-orange-700" :
                    "bg-red-100 text-red-700"
                  )}>
                    {dadosBriefingEdicao.nivelRisco}
                  </span>
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(dadosBriefingEdicao.briefing);
                    toast.success('Briefing copiado!');
                  }}
                  className="gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copiar
                </Button>
              </div>
              
              {/* Score visual */}
              <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
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

              {/* Alertas críticos */}
              {dadosBriefingEdicao.pendencias.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Pendências Detectadas
                  </p>
                  <div className="space-y-1 text-xs text-red-700">
                    {dadosBriefingEdicao.pendencias.map((p, idx) => (
                      <div key={idx}>{p}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status final */}
              <div className={cn("p-3 rounded-lg mb-4",
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
                    <AlertCircle className="w-4 h-4" />
                  )}
                  {dadosBriefingEdicao.statusValidacao}
                </p>
              </div>
              
              {/* Briefing completo */}
              <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono border border-slate-700">
{dadosBriefingEdicao.briefing}
              </pre>
              <p className="text-xs text-slate-400 mt-2">
                Briefing gerado automaticamente • Atualiza ao editar ou adicionar anexos
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