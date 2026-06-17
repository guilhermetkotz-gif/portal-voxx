import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { X, Send, RefreshCw, Copy, ExternalLink, MessageSquare, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';
import 'moment-timezone';

function gerarMensagemPadrao(entrega, cliente) {
  const nomeEntrega = entrega.nome_entrega || 'Entrega';
  const tipoEntrega = entrega.tipo_entrega || 'Material';
  const link = entrega.link_publico_aprovacao;
  return `Olá, ${cliente?.nome || 'equipe'}! 👋\n\nPreparamos uma nova entrega para vocês:\n\n📦 *${nomeEntrega}*\n_Tipo: ${tipoEntrega}_\n\nAcesse o link abaixo para visualizar, aprovar ou solicitar alterações:\n🔗 ${link}\n\nEquipe Voxx`;
}

export default function EnvioAprovacaoModal({ entrega, demanda, user, onClose }) {
  const queryClient = useQueryClient();
  const [mensagem, setMensagem] = useState('');
  const [resultado, setResultado] = useState(null);

  const { data: cliente } = useQuery({
    queryKey: ['cliente', entrega?.cliente_id],
    queryFn: async () => {
      const r = await base44.entities.Cliente.filter({ id: entrega.cliente_id }, '-created_date', 1);
      return r[0] || null;
    },
    enabled: !!entrega?.cliente_id
  });

  const { data: ultimoEnvio } = useQuery({
    queryKey: ['ultimoEnvioAprovacao', entrega?.id],
    queryFn: async () => {
      const r = await base44.entities.EnvioAprovacaoWhatsApp.filter({ entrega_id: entrega.id }, '-enviado_em', 1);
      return r[0] || null;
    },
    enabled: !!entrega?.id
  });

  useEffect(() => {
    if (cliente) {
      setMensagem(gerarMensagemPadrao(entrega, cliente));
    }
  }, [cliente]);

  const enviarMutation = useMutation({
    mutationFn: async () => {
      // Detectar se há imagem para enviar
      const imagemArquivo = entrega.arquivos?.find(a => a.tipo === 'imagem' || /\.(png|jpg|jpeg|webp|gif)$/i.test(a.url || ''));
      const midia_url = imagemArquivo?.url || null;
      const tipo_midia = midia_url ? 'imagem' : 'texto';

      const resp = await base44.functions.invoke('enviarAprovacaoWhatsApp', {
        entrega_id: entrega.id,
        mensagem,
        midia_url,
        tipo_midia
      });
      return resp.data;
    },
    onSuccess: (data) => {
      setResultado(data);
      queryClient.invalidateQueries({ queryKey: ['entregas', demanda?.id] });
      queryClient.invalidateQueries({ queryKey: ['ultimoEnvioAprovacao', entrega?.id] });
      if (data.status_envio === 'enviado') {
        toast.success('Mensagem enviada com sucesso!');
      } else if (data.status_envio === 'rascunho') {
        toast.warning('API não configurada. Envio salvo como rascunho.');
      } else {
        toast.error('Erro ao enviar: ' + (data.erro || 'Desconhecido'));
      }
    },
    onError: (error) => {
      const msg = error?.response?.data?.error || error?.message || 'Erro desconhecido';
      toast.error('Falha ao enviar: ' + msg);
    }
  });

  const semGrupo = !cliente?.whatsapp_grupo_id;
  const semLink = !entrega?.link_publico_aprovacao || !entrega?.link_ativo;
  const podEnviar = !semGrupo && !semLink && mensagem.trim() && !enviarMutation.isPending;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-600" />
            <h2 className="text-base font-semibold text-slate-900">Enviar para Aprovação</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Infos da entrega */}
          <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Cliente</span>
              <span className="font-medium text-slate-800">{cliente?.nome || entrega.cliente_nome || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Grupo WhatsApp</span>
              {semGrupo ? (
                <span className="text-red-500 text-xs font-medium">Não configurado</span>
              ) : (
                <span className="font-mono text-xs text-slate-700">{cliente.whatsapp_grupo_id}</span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Entrega</span>
              <span className="font-medium text-slate-800 text-right max-w-[60%] truncate">{entrega.nome_entrega}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Link de Aprovação</span>
              {semLink ? (
                <span className="text-red-500 text-xs">Sem link ativo</span>
              ) : (
                <a href={entrega.link_publico_aprovacao} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-violet-600 hover:underline">
                  <ExternalLink className="w-3 h-3" /> Abrir link
                </a>
              )}
            </div>
          </div>

          {/* Alertas de bloqueio */}
          {semGrupo && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Este cliente não possui <strong>whatsapp_grupo_id</strong> configurado. Acesse o cadastro do cliente para adicionar.</span>
            </div>
          )}
          {semLink && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Esta entrega não possui link público ativo. Gere o link antes de enviar.</span>
            </div>
          )}

          {/* Prévia / edição da mensagem */}
          {!resultado && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-slate-700">Mensagem</label>
                  <button
                    onClick={() => setMensagem(gerarMensagemPadrao(entrega, cliente))}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800"
                  >
                    <RefreshCw className="w-3 h-3" /> Regenerar
                  </button>
                </div>
                <textarea
                  value={mensagem}
                  onChange={e => setMensagem(e.target.value)}
                  rows={9}
                  className="w-full rounded-lg border border-slate-200 text-sm p-3 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 bg-slate-50 font-mono"
                  placeholder="Mensagem para o cliente..."
                />
              </div>

              {/* Último envio */}
              {ultimoEnvio && (
                <p className="text-xs text-slate-400">
                  Último envio: {moment(ultimoEnvio.enviado_em).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm')} por {ultimoEnvio.enviado_por_nome}
                </p>
              )}

              {/* Botões */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                  disabled={!podEnviar}
                  onClick={() => enviarMutation.mutate()}
                >
                  {enviarMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  ) : (
                    <><Send className="w-4 h-4" /> Enviar via WhatsApp</>
                  )}
                </Button>
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
              </div>
            </>
          )}

          {/* Estado pós-envio */}
          {resultado && (
            <div className="space-y-3">
              {resultado.status_envio === 'enviado' ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">Mensagem enviada com sucesso!</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Falha no envio</p>
                    <p className="text-xs mt-0.5">{resultado.erro}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1"
                  onClick={() => { navigator.clipboard.writeText(mensagem); toast.success('Copiado!'); }}>
                  <Copy className="w-3 h-3" /> Copiar mensagem
                </Button>
                {entrega.link_publico_aprovacao && (
                  <a href={entrega.link_publico_aprovacao} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1">
                      <ExternalLink className="w-3 h-3" /> Abrir link
                    </Button>
                  </a>
                )}
                <Button size="sm" variant="outline" className="gap-1"
                  onClick={() => { setResultado(null); }}>
                  <RefreshCw className="w-3 h-3" /> Reenviar
                </Button>
              </div>
              <Button variant="outline" className="w-full" onClick={onClose}>Fechar</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}