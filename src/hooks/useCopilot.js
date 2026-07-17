import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Hook do Copilot para o Radar WhatsApp.
 *
 * Garante:
 * - Identificador único por solicitação (respostas fora de ordem são descartadas)
 * - Sugestão vinculada à conversa original (troca de grupo descarta inserção)
 * - Preservação de texto digitado manualmente durante a geração
 * - Estado isolado por usuário (não afeta o campo de outro colaborador)
 * - Nenhum envio automático
 */
export function useCopilot({ selectedChat, mensagem, setMensagem, respondendoA, user }) {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null); // { mensagem_sugerida, assunto_identificado, necessidade_revisao, alerta_risco, informacoes_ausentes }
  const [showModal, setShowModal] = useState(false);

  // Refs para rastrear estado no momento da geração
  const requestIdRef = useRef(0);       // incrementa a cada nova solicitação
  const chatIdRef = useRef(null);        // chatId que originou a geração
  const textoOriginalRef = useRef('');   // texto no momento em que a geração iniciou

  // Refs atualizadas a cada render para acessar valores atuais em callbacks async
  const selectedChatRef = useRef(selectedChat);
  const mensagemRef = useRef(mensagem);
  selectedChatRef.current = selectedChat;
  mensagemRef.current = mensagem;

  const startGeneration = async (acao) => {
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
      setMensagem(data.mensagem_sugerida || '');
      setResultado(data);
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

    // Se já existe texto digitado, mostrar opções antes de gerar
    if (mensagem.trim()) {
      setShowModal(true);
      return;
    }

    // Campo vazio — prosseguir diretamente
    startGeneration('gerar');
  };

  const handleModalChoice = (choice) => {
    setShowModal(false);
    if (choice === 'melhorar') {
      startGeneration('melhorar');
    } else if (choice === 'substituir') {
      startGeneration('gerar');
    }
    // 'cancelar' não faz nada
  };

  const handleGerarNovamente = () => {
    if (loading) return;
    // "Gerar novamente" sempre gera do zero, sem mostrar modal de conflito
    startGeneration('gerar');
  };

  const dismissResultado = () => setResultado(null);

  return {
    loading,
    resultado,
    showModal,
    handleCopilotClick,
    handleModalChoice,
    handleGerarNovamente,
    dismissResultado,
  };
}