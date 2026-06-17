import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import EnviarOtimizacaoWhatsAppModal from '@/components/metaads/EnviarOtimizacaoWhatsAppModal';

export default function AdicionarOtimizacaoModal({ open, onOpenChange, conta }) {
    const [formData, setFormData] = useState({
        data_acao: new Date().toISOString().split('T')[0],
        problema: '',
        objetivo: '',
        acoes_implementadas: ''
    });
    const [createdOtimizacao, setCreatedOtimizacao] = useState(null);
    const [clienteEnvio, setClienteEnvio] = useState(null);
    const [showEnvioModal, setShowEnvioModal] = useState(false);

    const queryClient = useQueryClient();

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me(),
        staleTime: 5 * 60 * 1000
    });

    // Buscar clientes para vincular automaticamente
    const { data: clientes = [] } = useQuery({
        queryKey: ['clientesMetaAdsModal'],
        queryFn: () => base44.entities.Cliente.list('-updated_date', 500),
        staleTime: 5 * 60 * 1000
    });

    const encontrarCliente = async (accountName) => {
        if (!accountName || !clientes.length) return null;
        const cliente = clientes.find(c =>
            c.nome === accountName ||
            c.meta_ads_account_name === accountName ||
            (Array.isArray(c.contas_anuncio) && c.contas_anuncio.some(ca => ca.plataforma === 'Meta' && ca.conta_nome === accountName))
        );
        return cliente || null;
    };

    const createMutation = useMutation({
        mutationFn: async (data) => {
            let resumo = data.acoes_implementadas;
            if (resumo.length > 150) {
                resumo = resumo.substring(0, 150);
                const lastSpace = resumo.lastIndexOf(' ');
                if (lastSpace > 100) {
                    resumo = resumo.substring(0, lastSpace) + '...';
                }
            }

            const cliente = await encontrarCliente(conta?.account_name);

            const otimizacao = {
                conta_meta_ads_id: conta.id,
                account_name: conta.account_name,
                cliente_id: cliente?.id || '',
                cliente_nome: cliente?.nome || '',
                data_acao: data.data_acao,
                problema: data.problema,
                objetivo: data.objetivo,
                acoes_implementadas: data.acoes_implementadas,
                resumo_acao: resumo,
                usuario_nome: currentUser?.full_name || currentUser?.email || 'Desconhecido',
                usuario_email: currentUser?.email || ''
            };

            return base44.entities.MetaAdsOtimizacao.create(otimizacao);
        },
        onSuccess: async (result) => {
            queryClient.invalidateQueries({ queryKey: ['metaAdsOtimizacoes'] });
            toast.success('Otimização registrada com sucesso');
            setFormData({
                data_acao: new Date().toISOString().split('T')[0],
                problema: '',
                objetivo: '',
                acoes_implementadas: ''
            });

            // Buscar o registro criado e o cliente vinculado
            const otimizacaoId = result?.id;
            if (otimizacaoId) {
                const [otimizacao, cliente] = await Promise.all([
                    base44.entities.MetaAdsOtimizacao.get(otimizacaoId),
                    encontrarCliente(conta?.account_name)
                ]);
                if (otimizacao && cliente) {
                    setCreatedOtimizacao(otimizacao);
                    setClienteEnvio(cliente);
                    setShowEnvioModal(true);
                } else {
                    onOpenChange(false);
                }
            } else {
                onOpenChange(false);
            }
        },
        onError: (error) => {
            toast.error('Erro ao registrar otimização: ' + error.message);
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!formData.problema || !formData.objetivo || !formData.acoes_implementadas) {
            toast.error('Por favor, preencha todos os campos obrigatórios');
            return;
        }

        createMutation.mutate(formData);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Adicionar Otimização</DialogTitle>
                    <DialogDescription>
                        Registre as ações de tráfego Meta implementadas para {conta?.account_name}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="data_acao">Data da Ação *</Label>
                        <div className="relative">
                            <Input
                                id="data_acao"
                                type="date"
                                value={formData.data_acao}
                                onChange={(e) => setFormData({ ...formData, data_acao: e.target.value })}
                                required
                                className="pl-10"
                            />
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="problema">Problema Identificado *</Label>
                        <Textarea
                            id="problema"
                            value={formData.problema}
                            onChange={(e) => setFormData({ ...formData, problema: e.target.value })}
                            placeholder="Ex: Frequência alta (4.8), criativo saturado"
                            required
                            rows={2}
                        />
                    </div>

                    <div>
                        <Label htmlFor="objetivo">Objetivo *</Label>
                        <Textarea
                            id="objetivo"
                            value={formData.objetivo}
                            onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
                            placeholder="Ex: Reduzir frequência para abaixo de 3.5 e melhorar CPM"
                            required
                            rows={2}
                        />
                    </div>

                    <div>
                        <Label htmlFor="acoes_implementadas">Ações Implementadas *</Label>
                        <Textarea
                            id="acoes_implementadas"
                            value={formData.acoes_implementadas}
                            onChange={(e) => setFormData({ ...formData, acoes_implementadas: e.target.value })}
                            placeholder="Descreva detalhadamente as ações de tráfego implementadas..."
                            required
                            rows={4}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Um resumo será gerado automaticamente a partir deste texto
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={createMutation.isPending}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="bg-violet-600 hover:bg-violet-700"
                        >
                            {createMutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                'Salvar Otimização'
                            )}
                        </Button>
                    </div>
                </form>

                {/* Modal de envio WhatsApp (após criar otimização) */}
                {createdOtimizacao && (
                    <EnviarOtimizacaoWhatsAppModal
                        open={showEnvioModal}
                        onOpenChange={(isOpen) => {
                            setShowEnvioModal(isOpen);
                            if (!isOpen) {
                                setCreatedOtimizacao(null);
                                setClienteEnvio(null);
                                onOpenChange(false);
                            }
                        }}
                        otimizacao={createdOtimizacao}
                        cliente={clienteEnvio}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}