import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Target, Play, CheckCircle, XCircle, AlertTriangle, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import moment from 'moment';

const TIPOS_ACAO = [
  { value: 'otimizacao_criativo', label: 'Otimização de Criativo' },
  { value: 'ajuste_segmentacao', label: 'Ajuste de Segmentação' },
  { value: 'ajuste_orcamento', label: 'Ajuste de Orçamento' },
  { value: 'pausa_campanha', label: 'Pausa de Campanha' },
  { value: 'ativacao_campanha', label: 'Ativação de Campanha' },
  { value: 'teste_ab', label: 'Teste A/B' },
  { value: 'expansao_publico', label: 'Expansão de Público' },
  { value: 'reducao_frequencia', label: 'Redução de Frequência' },
  { value: 'ajuste_lance', label: 'Ajuste de Lance' },
  { value: 'outro', label: 'Outro' }
];

export default function MissoesDoDia({ user }) {
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [missaoSelecionada, setMissaoSelecionada] = useState(null);
  const [acaoRealizada, setAcaoRealizada] = useState('');
  const [observacao, setObservacao] = useState('');

  const hoje = moment().format('YYYY-MM-DD');

  const { data: missoes = [], isLoading } = useQuery({
    queryKey: ['missoesDia', user?.id, hoje],
    queryFn: () => base44.entities.GamificacaoMissao.filter({
      analista_id: user?.id,
      data_geracao: hoje
    }, '-tipo_prioridade', 20),
    enabled: !!user?.id,
    staleTime: 60 * 1000
  });

  const concluirMissaoMutation = useMutation({
    mutationFn: async ({ missao, status, acao, obs }) => {
      const pontos = calcularPontos(missao.tipo_prioridade, status);
      
      await base44.entities.GamificacaoMissao.update(missao.id, {
        status,
        acao_realizada: acao,
        observacao: obs,
        pontos,
        data_conclusao: new Date().toISOString()
      });

      if (status === 'concluida') {
        await base44.entities.GamificacaoAcao.create({
          analista_id: user?.id,
          analista_nome: user?.full_name || user?.email,
          conta_meta_ads_id: missao.conta_meta_ads_id,
          account_name: missao.account_name,
          tipo_acao: acao,
          descricao: `Missão: ${missao.motivo}`,
          observacao: obs,
          missao_id: missao.id,
          pontos_ganhos: pontos
        });

        await atualizarProgresso(pontos, 'missao');
      }

      return pontos;
    },
    onSuccess: (pontos) => {
      queryClient.invalidateQueries({ queryKey: ['missoesDia'] });
      queryClient.invalidateQueries({ queryKey: ['progressoGamificacao'] });
      toast.success(`Missão concluída! +${pontos} pontos`);
      fecharDialog();
    }
  });

  const calcularPontos = (prioridade, status) => {
    if (status !== 'concluida') return 0;
    
    const pontosPorPrioridade = {
      critica: 50,
      alta: 30,
      media: 20,
      baixa: 10
    };
    
    return pontosPorPrioridade[prioridade] || 10;
  };

  const atualizarProgresso = async (pontosNovos, tipo) => {
    const progressos = await base44.entities.GamificacaoProgresso.filter({
      analista_id: user?.id
    });

    const progresso = progressos[0];
    const semanaAtual = moment().format('GGGG-WW');

    if (progresso) {
      const atualizacao = {
        pontos_dia: progresso.pontos_dia + pontosNovos,
        pontos_semana: progresso.pontos_semana + pontosNovos,
        pontos_mes: progresso.pontos_mes + pontosNovos,
        pontos_total: progresso.pontos_total + pontosNovos,
        ultima_atualizacao: hoje,
        semana_atual: semanaAtual
      };

      if (tipo === 'missao') {
        atualizacao.missoes_concluidas_dia = progresso.missoes_concluidas_dia + 1;
        atualizacao.missoes_concluidas_semana = progresso.missoes_concluidas_semana + 1;
      } else if (tipo === 'acao') {
        atualizacao.acoes_registradas_dia = progresso.acoes_registradas_dia + 1;
        atualizacao.acoes_registradas_semana = progresso.acoes_registradas_semana + 1;
      }

      await base44.entities.GamificacaoProgresso.update(progresso.id, atualizacao);
    } else {
      await base44.entities.GamificacaoProgresso.create({
        analista_id: user?.id,
        analista_nome: user?.full_name || user?.email,
        pontos_dia: pontosNovos,
        pontos_semana: pontosNovos,
        pontos_mes: pontosNovos,
        pontos_total: pontosNovos,
        missoes_concluidas_dia: tipo === 'missao' ? 1 : 0,
        missoes_concluidas_semana: tipo === 'missao' ? 1 : 0,
        acoes_registradas_dia: tipo === 'acao' ? 1 : 0,
        acoes_registradas_semana: tipo === 'acao' ? 1 : 0,
        ultima_atualizacao: hoje,
        semana_atual: semanaAtual
      });
    }
  };

  const abrirDialogConcluir = (missao) => {
    setMissaoSelecionada(missao);
    setDialogAberto(true);
  };

  const fecharDialog = () => {
    setDialogAberto(false);
    setMissaoSelecionada(null);
    setAcaoRealizada('');
    setObservacao('');
  };

  const handleConcluir = () => {
    if (!acaoRealizada) {
      toast.error('Selecione o tipo de ação realizada');
      return;
    }
    concluirMissaoMutation.mutate({
      missao: missaoSelecionada,
      status: 'concluida',
      acao: acaoRealizada,
      obs: observacao
    });
  };

  const handleNaoAplicavel = (missao) => {
    concluirMissaoMutation.mutate({
      missao,
      status: 'nao_aplicavel',
      acao: '',
      obs: 'Marcado como não aplicável'
    });
  };

  const iniciarMissao = async (missao) => {
    await base44.entities.GamificacaoMissao.update(missao.id, {
      status: 'em_execucao'
    });
    queryClient.invalidateQueries({ queryKey: ['missoesDia'] });
    toast.success('Missão iniciada!');
  };

  const getPrioridadeIcon = (tipo) => {
    switch (tipo) {
      case 'critica': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'alta': return <TrendingUp className="w-4 h-4 text-orange-600" />;
      case 'media': return <Target className="w-4 h-4 text-yellow-600" />;
      case 'baixa': return <Zap className="w-4 h-4 text-green-600" />;
      default: return <Target className="w-4 h-4" />;
    }
  };

  const getPrioridadeColor = (tipo) => {
    switch (tipo) {
      case 'critica': return 'border-l-4 border-red-500 bg-red-50';
      case 'alta': return 'border-l-4 border-orange-500 bg-orange-50';
      case 'media': return 'border-l-4 border-yellow-500 bg-yellow-50';
      case 'baixa': return 'border-l-4 border-green-500 bg-green-50';
      default: return 'border-l-4 border-slate-300';
    }
  };

  const missoesPendentes = missoes.filter(m => m.status === 'pendente' || m.status === 'em_execucao');
  const missoesConcluidas = missoes.filter(m => m.status === 'concluida');

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-violet-600" />
            Missões do Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-slate-500 py-8">Carregando missões...</p>
          ) : missoes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500 mb-4">Nenhuma missão gerada para hoje</p>
              <p className="text-sm text-slate-400">As missões são geradas automaticamente com base nas contas prioritárias</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Missões Pendentes */}
              {missoesPendentes.length > 0 && (
                <div className="space-y-3">
                  {missoesPendentes.map((missao) => (
                    <div
                      key={missao.id}
                      className={cn("p-4 rounded-lg", getPrioridadeColor(missao.tipo_prioridade))}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getPrioridadeIcon(missao.tipo_prioridade)}
                            <h4 className="font-semibold text-slate-900">{missao.account_name}</h4>
                            {missao.radar_score && (
                              <Badge variant="outline" className="text-xs">
                                Score: {missao.radar_score}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 mb-3">{missao.motivo}</p>
                          <div className="flex flex-wrap gap-2">
                            {missao.status === 'pendente' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => iniciarMissao(missao)}
                                >
                                  <Play className="w-3 h-3 mr-1" />
                                  Iniciar
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => abrirDialogConcluir(missao)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Concluir
                                </Button>
                              </>
                            )}
                            {missao.status === 'em_execucao' && (
                              <Button
                                size="sm"
                                onClick={() => abrirDialogConcluir(missao)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Concluir
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleNaoAplicavel(missao)}
                              className="text-slate-600"
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Não Aplicável
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Missões Concluídas */}
              {missoesConcluidas.length > 0 && (
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-sm font-medium text-slate-600 mb-2">
                    Concluídas ({missoesConcluidas.length})
                  </p>
                  <div className="space-y-2">
                    {missoesConcluidas.map((missao) => (
                      <div
                        key={missao.id}
                        className="p-3 rounded-lg bg-green-50 border border-green-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-green-900">{missao.account_name}</p>
                            <p className="text-xs text-green-700">{missao.acao_realizada}</p>
                          </div>
                          <Badge className="bg-green-600 text-white">
                            +{missao.pontos || 0} pts
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Concluir Missão */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir Missão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="font-medium mb-1">Conta:</p>
              <p className="text-sm text-slate-600">{missaoSelecionada?.account_name}</p>
            </div>
            <div>
              <p className="font-medium mb-1">Motivo:</p>
              <p className="text-sm text-slate-600">{missaoSelecionada?.motivo}</p>
            </div>
            <div>
              <label className="font-medium block mb-2">Ação Realizada*</label>
              <Select value={acaoRealizada} onValueChange={setAcaoRealizada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_ACAO.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-medium block mb-2">Observação (opcional)</label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Descreva a ação executada..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fecharDialog}>
              Cancelar
            </Button>
            <Button
              onClick={handleConcluir}
              disabled={concluirMissaoMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {concluirMissaoMutation.isPending ? 'Salvando...' : 'Concluir Missão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}