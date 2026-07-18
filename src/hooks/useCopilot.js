import { useState, useRef, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

function gerarSugestaoId() {
  return 'cp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

/**
 * Hook do Copilot para o Radar WhatsApp.
 *
 * Garante:
 * - Identificador único por solicitação (respostas fora de ordem são descartadas)
 * - sugestao_id único por geração (para vincular feedback)
 * - Rastreio de texto original, regenerações e edição
 * - Preservação de texto digitado manualmente durante a geração
 * - Estado isolado por usuário (não afeta o campo de outro colaborador)
 * - Nenhum envio automático
 */
export function useCopilot({ selectedChat, mensagem, setMensagem, respondendoA, user }) {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Rastreio da sugestão atual
  const [sugestaoId, setSugestaoId] = useState(null);
  const [textoOriginalGerado, setTextoOriginalGerado] = useState('');
  const [quantidadeRegeneracoes, setQuantidadeRegeneracoes] = useState(0);

  // Refs para rastrear estado no momento da geração
  const requestIdRef = useRef(0);
  const chatIdRef = useRef(null);
  const textoOriginalRef = useRef('');
  const regeneracoesCountRef = useRef(0);

  // Refs atualizadas a cada render para acessar valores atuais em callbacks async
  const selectedChatRef = useRef(selectedChat);
  const mensagemRef = useRef(mensagem);
  selectedChatRef.current = selectedChat;
  mensagemRef.current = mensagem;

  // Resetar estado ao trocar de conversa
  useEffect(() => {
    setResultado(null);
    setSugestaoId(null);
    setTextoOriginalGerado('');
    setQuantidadeRegeneracoes(0);
    regeneracoesCountRef.current = 0;
  }, [selectedChat?.id]);

  const startGeneration = async (acao, isRegeneracao = false) => {
    if (!selectedChat) return;

    const currentRequestId = ++requestIdRef.current;
    const currentChatId = selectedChat.id;
    const currentTexto = mensagem;

    // Registrar estado no momento da geração
    chatIdRef.current = currentChatId;
    textoOriginalRef.current = currentTexto;

    setLoading(true);
    setShowModal(false);
    setResultado(null);

    try {
      const res = await base44.functions.invoke('gerarSugestaoCopilot', {
        chatId: currentChatId,
        clienteId: selectedChat.clienteId || '',
        clienteNome: selectedChat.clienteNome || '',
        chatName: selectedChat.name || '',
        textoExistente: acao === 'melhorar' ? currentTexto : '',
        acao,
        respondendoTexto: respondendoA?.mensagem || '',
        respondendoRemetente: respondendoA?.remetente_nome || '',
      });

      const data = res.data;

      // 1. Verificar se é a solicitação mais recente
      if (currentRequestId !== requestIdRef.current) {
        return; // Uma solicitação mais nova foi feita — descartar esta resposta
      }

      // 2. Verificar se o usuário ainda está na mesma conversa
      if (currentChatId !== selectedChatRef.current?.id) {
        toast.info('A sugestão foi gerada, mas você trocou de conversa. Gere novamente na conversa atual.');
        return;
      }

      // 3. Verificar se o texto não foi alterado durante a geração
      const textoAtual = mensagemRef.current;
      if (textoAtual.trim() !== textoOriginalRef.current.trim()) {
        // O colaborador alterou o texto durante a geração — não sobrescrever
        toast.info('Você alterou o texto durante a geração. A sugestão não foi inserida automaticamente.');
        setResultado(data); // Armazenar para permitir "Gerar novamente"
        return;
      }

      // Todas as verificações passaram — inserir a sugestão
      const novoSugestaoId = gerarSugestaoId();
      const regeneracoes = isRegeneracao ? regeneracoesCountRef.current : 0;

      setMensagem(data.mensagem_sugerida || '');
      setResultado(data);
      setSugestaoId(novoSugestaoId);
      setTextoOriginalGerado(data.mensagem_sugerida || '');
      setQuantidadeRegeneracoes(regeneracoes);
    } catch (e) {
      // Verificar se ainda é a solicitação mais recente
      if (currentRequestId !== requestIdRef.current) return;

      const errorMsg = e?.response?.data?.error || e?.message || '';
      toast.error(
        errorMsg ||
        'Não foi possível gerar a sugestão agora. Seu texto foi preservado e você pode tentar novamente.'
      );
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleCopilotClick = () => {
    if (!selectedChat || loading) return;

    // Nova sessão — resetar contador de regenerações
    regeneracoesCountRef.current = 0;

    // Se já existe texto digitado, mostrar opções antes de gerar
    if (mensagem.trim()) {
      setShowModal(true);
      return;
    }

    // Campo vazio — prosseguir diretamente
    startGeneration('gerar', false);
  };

  const handleModalChoice = (choice) => {
    setShowModal(false);
    if (choice === 'melhorar') {
      regeneracoesCountRef.current = 0;
      startGeneration('melhorar', false);
    } else if (choice === 'substituir') {
      regeneracoesCountRef.current = 0;
      startGeneration('gerar', false);
    }
    // 'cancelar' não faz nada
  };

  const handleGerarNovamente = () => {
    if (loading) return;
    // "Gerar novamente" sempre gera do zero, sem mostrar modal de conflito
    regeneracoesCountRef.current += 1;
    startGeneration('gerar', true);
  };

  const dismissResultado = () => {
    setResultado(null);
    setSugestaoId(null);
    setTextoOriginalGerado('');
    setQuantidadeRegeneracoes(0);
    regeneracoesCountRef.current = 0;
  };

  /**
   * Marca a sugestão atual como enviada.
   * Atualiza o registro de feedback existente ou cria um novo.
   */
  const marcarComoEnviada = useCallback(async (textoEnviado) => {
    if (!sugestaoId || !user?.id) return;
    const foiEditada = (textoOriginalGerado || '').trim() !== (textoEnviado || '').trim();
    try {
      const existing = await base44.entities.CopilotFeedback.filter({
        sugestao_id: sugestaoId,
        usuario_id: user.id,
      });
      if (existing && existing.length > 0) {
        await base44.entities.CopilotFeedback.update(existing[0].id, {
          foi_enviada: true,
          texto_enviado: textoEnviado || '',
          foi_editada_antes_da_avaliacao: foiEditada,
        });
      } else {
        await base44.entities.CopilotFeedback.create({
          sugestao_id: sugestaoId,
          grupo_id: selectedChat?.id || '',
          cliente_id: selectedChat?.clienteId || '',
          usuario_id: user.id,
          avaliacao: null,
          texto_original_gerado: textoOriginalGerado || '',
          texto_enviado: textoEnviado || '',
          foi_enviada: true,
          foi_editada_antes_da_avaliacao: foiEditada,
          quantidade_regeneracoes: quantidadeRegeneracoes || 0,
          modelo_utilizado: 'automatic',
        });
      }
    } catch (_) { /* silencioso — não bloqueia envio */ }
  }, [sugestaoId, user, textoOriginalGerado, quantidadeRegeneracoes, selectedChat]);

  return {
    loading,
    resultado,
    showModal,
    sugestaoId,
    textoOriginalGerado,
    quantidadeRegeneracoes,
    modeloUtilizado: 'automatic',
    handleCopilotClick,
    handleModalChoice,
    handleGerarNovamente,
    dismissResultado,
    marcarComoEnviada,
  };
}