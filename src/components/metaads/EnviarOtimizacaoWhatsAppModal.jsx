import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, CheckCircle2, AlertTriangle, Copy, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';

export default function EnviarOtimizacaoWhatsAppModal({ open, onOpenChange, otimizacao, cliente }) {
    const [mensagem, setMensagem] = useState('');
    const [gerando, setGerando] = useState(false);

    const queryClient = useQueryClient();

    const { data: zapiStatus } = useQuery({
        queryKey: ['zapiStatus'],
        queryFn: () => base44.functions.invoke('zapiStatus', {}).then(r => r.data),
        staleTime: 30 * 1000
    });

    const gerarMensagem = async () => {
        setGerando(true);
        try {
            const textoCompleto = `Problema: ${otimizacao.problema}\nObjetivo: ${otimizacao.objetivo}\nAções: ${otimizacao.acoes_implementadas}`;
            const response = await base44.functions.invoke('gerarMensagemOtimizacaoMetaCliente', {
                cliente_nome: cliente?.nome || otimizacao.account_name,
                texto_otimizacao: textoCompleto
            });
            setMensagem(response.data.mensagem || '');
        } catch (error) {
            toast.error('Erro ao gerar mensagem: ' + error.message);
        } finally {
            setGerando(false);
        }
    };

    const sendMutation = useMutation({
        mutationFn: async () => {
            const response = await base44.functions.invoke('enviarOtimizacaoMetaWhatsApp', {
                otimizacao_id: otimizacao.id,
                cliente_id: cliente?.id,
                mensagem: mensagem,
                grupo_id: cliente?.whatsapp_grupo_id
            });
            return response.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['metaAdsOtimizacoes'] });
            toast.success('Mensagem enviada ao cliente com sucesso!');
            onOpenChange(false);
        },
        onError: (error) => {
            toast.error('Erro ao enviar: ' + error.message);
        }
    });

    const copiarMensagem = () => {
        navigator.clipboard.writeText(mensagem);
        toast.success('Mensagem copiada!');
    };

    const zapiConectado = zapiStatus?.connected !== false;
    const temGrupo = !!cliente?.whatsapp_grupo_id;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Enviar otimização ao cliente</DialogTitle>
                    <DialogDescription>
                        A mensagem abaixo será enviada para o grupo WhatsApp de {cliente?.nome || otimizacao.account_name}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Status verificações */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 text-xs">
                            {zapiConectado ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                            )}
                            <span className={zapiConectado ? 'text-emerald-600' : 'text-red-600'}>
                                {zapiConectado ? 'Z-API conectada' : 'Z-API desconectada'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            {temGrupo ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                            )}
                            <span className={temGrupo ? 'text-emerald-600' : 'text-amber-600'}>
                                {temGrupo ? 'Grupo WhatsApp vinculado' : 'Sem grupo WhatsApp'}
                            </span>
                        </div>
                    </div>

                    {/* Resumo da otimização */}
                    <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
                        <div className="flex gap-2">
                            <span className="font-medium text-slate-500">Conta:</span>
                            <span>{otimizacao.account_name}</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="font-medium text-slate-500">Data:</span>
                            <span>{moment(otimizacao.data_acao).format('DD/MM/YYYY')}</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="font-medium text-slate-500">Problema:</span>
                            <span className="text-slate-600">{otimizacao.problema}</span>
                        </div>
                    </div>

                    {/* Geração IA */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Mensagem para o cliente</span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={gerarMensagem}
                                disabled={gerando}
                                className="h-7 text-xs"
                            >
                                {gerando ? (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                    <Sparkles className="w-3 h-3 mr-1" />
                                )}
                                Gerar com IA
                            </Button>
                        </div>
                        <Textarea
                            value={mensagem}
                            onChange={(e) => setMensagem(e.target.value)}
                            placeholder="Clique em 'Gerar com IA' ou digite a mensagem manualmente..."
                            rows={6}
                            className="text-sm"
                        />
                    </div>

                    {/* Ações */}
                    <div className="flex justify-between items-center pt-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={copiarMensagem}
                            disabled={!mensagem}
                            className="text-xs"
                        >
                            <Copy className="w-3 h-3 mr-1" />
                            Copiar
                        </Button>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                size="sm"
                            >
                                Pular
                            </Button>
                            <Button
                                onClick={() => sendMutation.mutate()}
                                disabled={!mensagem || sendMutation.isPending || !zapiConectado || !temGrupo}
                                className="bg-emerald-600 hover:bg-emerald-700"
                                size="sm"
                            >
                                {sendMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4 mr-1" />
                                )}
                                Enviar ao Cliente
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}