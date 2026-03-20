import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, CheckCircle2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import CriacaoOralSinWizard from '@/components/demandas/CriacaoOralSinWizard';
import BriefingUniversalWizard from '@/components/demandas/BriefingUniversalWizard';
import EdicaoVideoWizard from '@/components/demandas/EdicaoVideoWizard';

const SETORES = [
  { value: 'ATENDIMENTO', label: '📋 Atendimento', subcategorias: ['Geral', 'Outro'] },
  { value: 'TRAFEGO_META', label: '🔥 Tráfego – Meta Ads', subcategorias: ['Poucos leads', 'CPL alto', 'Leads repetidos', 'Ajuste de verba', 'Outro'] },
  { value: 'TRAFEGO_GOOGLE', label: '🔥 Tráfego – Google Ads', subcategorias: ['Poucos leads', 'CPL alto', 'Baixo volume de ligações', 'Outro'] },
  { value: 'TRAFEGO_TIKTOK', label: '🔥 Tráfego – TikTok Ads', subcategorias: ['Poucos leads', 'Baixo engajamento', 'Outro'] },
  { value: 'CRIACAO', label: '✏️ Criação (Artes & Peças)', subcategorias: ['Arte para campanha', 'Post feed', 'Story', 'Outro'] },
  { value: 'EDICAO', label: '🎬 Edição de Vídeo', subcategorias: ['Edição para Ads', 'Reels / Shorts', 'Outro'] },
  { value: 'BI_RELATORIO', label: '📊 Relatórios / BI', subcategorias: ['CPL e volume de leads', 'Relatório mensal', 'Outro'] },
  { value: 'IMPLANTACAO', label: '🛠 Implantação / Acessos', subcategorias: ['Acesso BM / Google Ads', 'Pixel / Tag', 'Outro'] },
  { value: 'FINANCEIRO', label: '💰 Financeiro', subcategorias: ['Boleto', 'Nota fiscal', 'Tomada de investimento', 'Outro'] },
  { value: 'ALTERACAO_CRIACAO', label: '✏️ Alteração Criação', subcategorias: ['Ajuste de arte', 'Correção de texto', 'Outro'] },
  { value: 'AUTOMACAO', label: '🤖 Automação', subcategorias: ['Configuração', 'Fluxo de mensagens', 'Outro'] },
  { value: 'SALDOS', label: '💵 Saldos', subcategorias: ['Consulta de saldo', 'Atualização de saldo', 'Outro'] },
];

/**
 * Modal de criação de demanda a partir de um item do Plano de Ação.
 * Após criar a demanda, vincula o ID ao PlanoDeAcaoItem.demanda_id_relacionada.
 */
export default function NovaDemandaPlanoModal({ open, onClose, clienteId, clienteNome, planoAcaoItemId, planoAcaoItem }) {
  const queryClient = useQueryClient();
  const [fase, setFase] = useState('form'); // 'form' | 'wizard_oral_sin' | 'wizard_universal' | 'wizard_edicao' | 'sucesso'
  const [ultimaDemandaTitulo, setUltimaDemandaTitulo] = useState('');
  const [setor, setSetor] = useState('');
  const [subcategoria, setSubcategoria] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [prioridade, setPrioridade] = useState('media');
  const [previsaoEntrega, setPrevisaoEntrega] = useState('');
  const [salvando, setSalvando] = useState(false);

  const { data: cliente } = useQuery({
    queryKey: ['clienteDetalhe', clienteId],
    queryFn: () => base44.entities.Cliente.filter({ id: clienteId }).then(r => r[0]),
    enabled: !!clienteId && open,
    staleTime: 5 * 60 * 1000,
  });

  const isOralSin = (c) => {
    if (!c) return false;
    return (c.nome || '').toLowerCase().includes('oral sin') || (c.tipo_cliente || '') === 'oral_sin';
  };

  const setorSelecionado = SETORES.find(s => s.value === setor);

  const handleSetorChange = (v) => {
    setSetor(v);
    setSubcategoria('');
    setFase('form');
  };

  const criarDemandaEVincular = async (dadosDemanda) => {
    setSalvando(true);
    try {
      const demanda = await base44.entities.Demanda.create({
        cliente_id: clienteId,
        cliente_nome: clienteNome,
        status: 'recebida',
        ...dadosDemanda,
      });

      // Vincular demanda ao item do plano (sempre sobrescreve com a mais recente)
      if (planoAcaoItemId) {
        await base44.entities.PlanoDeAcaoItem.update(planoAcaoItemId, {
          demanda_id_relacionada: demanda.id,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['planoItens'] });
      queryClient.invalidateQueries({ queryKey: ['demandas'] });
      setUltimaDemandaTitulo(dadosDemanda.titulo || 'Demanda');
      setFase('sucesso');
    } catch (error) {
      toast.error('Erro ao criar demanda: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleNovaDemanda = () => {
    setSetor('');
    setSubcategoria('');
    setTitulo('');
    setDescricao('');
    setUrgente(false);
    setPrioridade('media');
    setPrevisaoEntrega('');
    setFase('form');
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!setor || !titulo) return;

    // Para Criação, redirecionar para wizard
    if (setor === 'CRIACAO') {
      if (isOralSin(cliente)) {
        setFase('wizard_oral_sin');
        return;
      } else {
        setFase('wizard_universal');
        return;
      }
    }
    if (setor === 'EDICAO') {
      setFase('wizard_edicao');
      return;
    }

    await criarDemandaEVincular({
      setor,
      subcategoria,
      titulo,
      descricao,
      prioridade,
      urgente,
      previsao_entrega: previsaoEntrega || null,
    });
  };

  const handleWizardOralSinComplete = async ({ camposAdicionais, descricao: desc, titulo: tit, urgente: urg, previsao_entrega, anexos }) => {
    await criarDemandaEVincular({
      setor: 'CRIACAO',
      subcategoria: 'Briefing Oral Sin',
      titulo: tit || 'Nova Arte',
      descricao: desc || '',
      prioridade: urg ? 'alta' : 'media',
      urgente: urg || false,
      previsao_entrega: previsao_entrega || null,
      campos_adicionais: camposAdicionais,
      anexos: anexos || [],
    });
  };

  const handleWizardUniversalComplete = async ({ camposAdicionais, descricao: desc, titulo: tit, urgente: urg, previsao_entrega, anexos }) => {
    await criarDemandaEVincular({
      setor: 'CRIACAO',
      subcategoria: 'Briefing Universal',
      titulo: tit || 'Nova Arte',
      descricao: desc || '',
      prioridade: urg ? 'alta' : 'media',
      urgente: urg || false,
      previsao_entrega: previsao_entrega || null,
      campos_adicionais: camposAdicionais,
      anexos: anexos || [],
    });
  };

  const handleWizardEdicaoComplete = async ({ subcategoria: sub, titulo: tit, descricao: desc, urgente: urg, camposAdicionais, anexos }) => {
    await criarDemandaEVincular({
      setor: 'EDICAO',
      subcategoria: sub,
      titulo: tit,
      descricao: desc || '',
      prioridade: urg ? 'alta' : 'media',
      urgente: urg,
      previsao_entrega: camposAdicionais?.prazo_desejado || null,
      campos_adicionais: camposAdicionais,
      anexos: anexos || [],
    });
  };

  const handleClose = () => {
    setSetor('');
    setSubcategoria('');
    setTitulo('');
    setDescricao('');
    setUrgente(false);
    setPrioridade('media');
    setPrevisaoEntrega('');
    setFase('form');
    setUltimaDemandaTitulo('');
    onClose();
  };

  const tituloModal = fase === 'wizard_oral_sin'
    ? 'Briefing Oral Sin'
    : fase === 'wizard_universal'
    ? 'Briefing Universal – Criação'
    : fase === 'wizard_edicao'
    ? 'Briefing Edição de Vídeo'
    : 'Nova Demanda';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tituloModal}</DialogTitle>
          <DialogDescription>
            Cliente: <strong>{clienteNome}</strong>
            {planoAcaoItemId && ' · A demanda será vinculada automaticamente ao item do plano.'}
          </DialogDescription>
        </DialogHeader>

        {/* BRIEFING DA AÇÃO */}
        {fase === 'form' && planoAcaoItem && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-2">
            <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-2">📋 Contexto da Ação do Plano</p>
            {planoAcaoItem.problema_identificado && (
              <div>
                <p className="text-xs text-violet-500 font-medium">Problema identificado</p>
                <p className="text-sm text-slate-800">{planoAcaoItem.problema_identificado}</p>
              </div>
            )}
            {planoAcaoItem.acao_proposta && (
              <div>
                <p className="text-xs text-violet-500 font-medium">Ação proposta</p>
                <p className="text-sm text-slate-800 font-semibold">{planoAcaoItem.acao_proposta}</p>
              </div>
            )}
            {planoAcaoItem.observacoes && (
              <div>
                <p className="text-xs text-violet-500 font-medium">Observações</p>
                <p className="text-sm text-slate-600 italic">{planoAcaoItem.observacoes}</p>
              </div>
            )}
          </div>
        )}

        {/* FASE: Formulário padrão */}
        {fase === 'form' && (
          <form onSubmit={handleSubmitForm} className="space-y-4 py-2">
            {/* Setor */}
            <div className="space-y-1">
              <Label>Tipo de Demanda *</Label>
              <Select value={setor} onValueChange={handleSetorChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor..." />
                </SelectTrigger>
                <SelectContent>
                  {SETORES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subcategoria */}
            {setorSelecionado && setor !== 'CRIACAO' && setor !== 'EDICAO' && (
              <div className="space-y-1">
                <Label>Subcategoria</Label>
                <Select value={subcategoria} onValueChange={setSubcategoria}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {setorSelecionado.subcategorias.map(sub => (
                      <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Aviso para Criação / Edição */}
            {(setor === 'CRIACAO' || setor === 'EDICAO') && (
              <div className="p-3 rounded-lg bg-violet-50 border border-violet-200 text-sm text-violet-700">
                {setor === 'CRIACAO'
                  ? isOralSin(cliente)
                    ? '🟣 Será aberto o briefing Oral Sin ao continuar.'
                    : '🔵 Será aberto o briefing Universal de Criação ao continuar.'
                  : '🎬 Será aberto o briefing de Edição de Vídeo ao continuar.'}
              </div>
            )}

            {/* Título */}
            {setor && setor !== 'CRIACAO' && setor !== 'EDICAO' && (
              <>
                <div className="space-y-1">
                  <Label>Título da Demanda *</Label>
                  <Input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Descreva brevemente o que você precisa"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Descrição</Label>
                  <Textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Detalhes adicionais..."
                    className="min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Prioridade</Label>
                    <Select value={prioridade} onValueChange={setPrioridade}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Prazo</Label>
                    <Input type="date" value={previsaoEntrega} onChange={(e) => setPrevisaoEntrega(e.target.value)} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch checked={urgente} onCheckedChange={setUrgente} />
                  <span className="text-sm text-slate-600">{urgente ? 'Urgente' : 'Normal'}</span>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1">Cancelar</Button>
              <Button
                type="submit"
                disabled={!setor || ((setor !== 'CRIACAO' && setor !== 'EDICAO') && !titulo) || salvando}
                className="flex-1 bg-violet-600 hover:bg-violet-700"
              >
                {salvando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : setor === 'CRIACAO' || setor === 'EDICAO' ? 'Continuar →' : 'Criar Demanda'}
              </Button>
            </div>
          </form>
        )}

        {/* FASE: Wizard Oral Sin */}
        {fase === 'wizard_oral_sin' && (
          <CriacaoOralSinWizard
            cliente={cliente}
            onComplete={handleWizardOralSinComplete}
            onCancel={() => setFase('form')}
          />
        )}

        {/* FASE: Wizard Universal */}
        {fase === 'wizard_universal' && (
          <BriefingUniversalWizard
            cliente={cliente}
            onComplete={handleWizardUniversalComplete}
            onCancel={() => setFase('form')}
          />
        )}

        {/* FASE: Wizard Edição */}
        {fase === 'wizard_edicao' && (
          <EdicaoVideoWizard
            cliente={cliente}
            subcategoria={subcategoria}
            onComplete={handleWizardEdicaoComplete}
            onCancel={() => setFase('form')}
          />
        )}

        {salvando && (
          <div className="flex items-center justify-center gap-2 py-4 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Criando e vinculando demanda...</span>
          </div>
        )}

        {/* FASE: Sucesso */}
        {fase === 'sucesso' && (
          <div className="py-6 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Demanda criada e vinculada!</p>
              <p className="text-sm text-slate-500 mt-1">
                <strong>"{ultimaDemandaTitulo}"</strong> foi criada e vinculada a esta ação do plano.
              </p>
            </div>
            <div className="flex gap-3 w-full mt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">Fechar</Button>
              <Button onClick={handleNovaDemanda} className="flex-1 bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4 mr-1" /> Nova Demanda
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}