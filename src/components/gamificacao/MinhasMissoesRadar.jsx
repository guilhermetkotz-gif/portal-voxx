import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Target, Play, CheckCircle, XCircle, AlertTriangle, TrendingUp, 
  TrendingDown, Zap, Activity, Flame, ArrowRight 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import moment from 'moment';

// Banco de ações expandido
const ACOES_DISPONIVEIS = [
  // Criativo
  { value: 'trocar_criativos', label: '🎨 Trocar variações de criativo', categoria: 'criativo' },
  { value: 'adicionar_criativos', label: '➕ Adicionar novas peças', categoria: 'criativo' },
  { value: 'pausar_criativos_saturados', label: '⏸ Pausar criativos saturados', categoria: 'criativo' },
  
  // Público
  { value: 'ampliar_publico', label: '📢 Ampliar segmentação', categoria: 'publico' },
  { value: 'testar_broad', label: '🌐 Testar broad/lookalike', categoria: 'publico' },
  { value: 'excluir_engajados', label: '🚫 Excluir engajados', categoria: 'publico' },
  { value: 'ajustar_interesses', label: '🎯 Ajustar interesses', categoria: 'publico' },
  
  // Orçamento
  { value: 'recalcular_pacing', label: '💰 Recalcular pacing', categoria: 'orcamento' },
  { value: 'reduzir_gasto', label: '📉 Reduzir gasto improdutivo', categoria: 'orcamento' },
  { value: 'redistribuir_budget', label: '🔄 Redistribuir budget', categoria: 'orcamento' },
  
  // Estrutura
  { value: 'revisar_campanha', label: '🔧 Revisar estrutura da campanha', categoria: 'estrutura' },
  { value: 'separar_publicos', label: '📊 Separar públicos/campanhas', categoria: 'estrutura' },
  { value: 'otimizar_objetivo', label: '🎯 Revisar objetivo da campanha', categoria: 'estrutura' },
  
  // Lead/Qualidade
  { value: 'revisar_formulario', label: '📋 Ajustar formulário', categoria: 'lead' },
  { value: 'otimizar_qualidade', label: '✅ Otimizar para qualidade', categoria: 'lead' },
  { value: 'verificar_repeticao', label: '🔁 Verificar leads repetidos', categoria: 'lead' },
  
  // Diagnóstico/Técnico
  { value: 'checar_pixel', label: '🔍 Checar pixel/tracking', categoria: 'diagnostico' },
  { value: 'verificar_capi', label: '📡 Verificar CAPI', categoria: 'diagnostico' },
  { value: 'revisar_landing', label: '🌐 Revisar landing page', categoria: 'diagnostico' },
  
  // Contingência
  { value: 'gasto_sem_lead_fix', label: '🚨 Intervenção: gasto sem conversão', categoria: 'contingencia' },
  { value: 'saturacao_urgente', label: '⚠️ Ação urgente: saturação crítica', categoria: 'contingencia' },
  
  // Outros
  { value: 'outro', label: '📝 Outro', categoria: 'outro' }
];

export default function MinhasMissoesRadar({ user, responsavelEmail, visualizarComoGestor }) {
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [missaoSelecionada, setMissaoSelecionada] = useState(null);
  const [acaoAplicada, setAcaoAplicada] = useState('');
  const [descricaoAcao, setDescricaoAcao] = useState('');
  const [evidenciaUrl, setEvidenciaUrl] = useState('');

  const hoje = moment().format('YYYY-MM-DD');

  const { data: missoes = [], isLoading } = useQuery({
    queryKey: ['missoesRadarDia', responsavelEmail, hoje],
    queryFn: () => base44.entities.GamificacaoMissaoRadar.filter({
      responsavel_email: responsavelEmail,
      data_missao: hoje
    }, '-prioridade_radar', 50),
    enabled: !!responsavelEmail,
    staleTime: 60 * 1000
  });

  const concluirMissaoMutation = useMutation({
    mutationFn: async ({ missao, status, acao, descricao, evidencia }) => {
      const agora = moment();
      const criacao = moment(missao.created_date);
      const tempoMinutos = agora.diff(criacao, 'minutes');
      
      const pontos = calcularPontos(missao.prioridade_radar, status);
      
      await base44.entities.GamificacaoMissaoRadar.update(missao.id, {
        status,
        acao_aplicada: acao,
        descricao_acao: descricao,
        evidencia_url: evidencia,
        tempo_conclusao_minutos: tempoMinutos,
        pontos_ganhos: pontos,
        data_conclusao: agora.toISOString()
      });

      if (status === 'concluida') {
        await atualizarProgresso(pontos, missao);
      }

      return pontos;
    },
    onSuccess: (pontos) => {
      queryClient.invalidateQueries({ queryKey: ['missoesRadarDia'] });
      queryClient.invalidateQueries({ queryKey: ['progressoGamificacao'] });
      queryClient.invalidateQueries({ queryKey: ['historicoMissoesRadar'] });
      toast.success(`Missão concluída! +${pontos} pontos`);
      fecharDialog();
    }
  });

  const calcularPontos = (prioridade, status) => {
    if (status !== 'concluida') return 0;
    
    const pontosPorPrioridade = {
      critica: 60,
      alta: 40,
      media: 25,
      baixa: 15
    };
    
    return pontosPorPrioridade[prioridade] || 15;
  };

  const atualizarProgresso = async (pontosNovos, missao) => {
    const agora = moment().format('YYYY-MM-DD');
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
        ultima_atualizacao: agora,
        semana_atual: semanaAtual,
        missoes_concluidas_dia: (progresso.missoes_concluidas_dia || 0) + 1,
        missoes_concluidas_semana: (progresso.missoes_concluidas_semana || 0) + 1
      };

      // Bônus para missões críticas
      if (missao.prioridade_radar === 'critica') {
        atualizacao.missoes_criticas_concluidas = (progresso.missoes_criticas_concluidas || 0) + 1;
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
        missoes_concluidas_dia: 1,
        missoes_concluidas_semana: 1,
        missoes_criticas_concluidas: missao.prioridade_radar === 'critica' ? 1 : 0,
        acoes_registradas_dia: 0,
        acoes_registradas_semana: 0,
        ultima_atualizacao: agora,
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
    setAcaoAplicada('');
    setDescricaoAcao('');
    setEvidenciaUrl('');
  };

  const handleConcluir = () => {
    if (!acaoAplicada) {
      toast.error('Selecione a ação aplicada');
      return;
    }
    concluirMissaoMutation.mutate({
      missao: missaoSelecionada,
      status: 'concluida',
      acao: acaoAplicada,
      descricao: descricaoAcao,
      evidencia: evidenciaUrl
    });
  };

  const handleNaoAplicavel = (missao) => {
    concluirMissaoMutation.mutate({
      missao,
      status: 'nao_aplicavel',
      acao: '',
      descricao: 'Marcado como não aplicável',
      evidencia: ''
    });
  };

  const iniciarMissao = async (missao) => {
    await base44.entities.GamificacaoMissaoRadar.update(missao.id, {
      status: 'em_execucao'
    });
    queryClient.invalidateQueries({ queryKey: ['missoesRadarDia'] });
    toast.success('Missão iniciada!');
  };

  const getPrioridadeIcon = (tipo) => {
    switch (tipo) {
      case 'critica': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'alta': return <TrendingDown className="w-4 h-4 text-orange-600" />;
      case 'media': return <Activity className="w-4 h-4 text-yellow-600" />;
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

  const getTendenciaIcon = (tendencia) => {
    switch (tendencia) {
      case 'negativa': return <TrendingDown className="w-3 h-3 text-red-600" />;
      case 'positiva': return <TrendingUp className="w-3 h-3 text-green-600" />;
      default: return <ArrowRight className="w-3 h-3 text-slate-400" />;
    }
  };

  const missoesPendentes = missoes.filter(m => m.status === 'pendente' || m.status === 'em_execucao');
  const missoesConcluidas = missoes.filter(m => m.status === 'concluida');

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-violet-600" />
              Missões do Dia
              {visualizarComoGestor && (
                <Badge variant="outline" className="ml-2">
                  Visualização: {responsavelEmail}
                </Badge>
              )}
            </CardTitle>
            <div className="text-right">
              <p className="text-sm text-slate-600">
                {missoesConcluidas.length}/{missoes.length} concluídas
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-slate-500 py-8">Carregando missões...</p>
          ) : missoes.length === 0 ? (
            <div className="text-center py-8">
              <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-2">Nenhuma missão gerada para hoje</p>
              <p className="text-sm text-slate-400">
                Missões são geradas automaticamente com base no RADAR META
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Missões Pendentes */}
              {missoesPendentes.length > 0 && (
                <div className="space-y-3">
                  {missoesPendentes.map((missao) => (
                    <div
                      key={missao.id}
                      className={cn("p-4 rounded-lg", getPrioridadeColor(missao.prioridade_radar))}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {getPrioridadeIcon(missao.prioridade_radar)}
                            <h4 className="font-semibold text-slate-900">{missao.unidade_nome}</h4>
                            <Badge variant="outline" className="text-xs">
                              Score: {missao.radar_score}
                            </Badge>
                            <div className="flex items-center gap-1">
                              {getTendenciaIcon(missao.tendencia_recente)}
                              <span className="text-xs text-slate-600 capitalize">
                                {missao.tendencia_recente}
                              </span>
                            </div>
                          </div>
                          
                          <p className="text-sm text-slate-700 mb-2">{missao.motivo}</p>
                          
                          {/* Alertas Especiais */}
                          {missao.alertas_especiais?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {missao.alertas_especiais.map((alerta, idx) => (
                                <Badge key={idx} className="bg-amber-100 text-amber-800 text-xs">
                                  ⚠️ {alerta}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Métricas Principais */}
                          {missao.metricas_radar && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-xs">
                              <div className="bg-white bg-opacity-60 rounded p-2">
                                <p className="text-slate-500">CPL Atual</p>
                                <p className="font-semibold">
                                  R$ {missao.metricas_radar.cpl_atual?.toFixed(2) || '-'}
                                </p>
                              </div>
                              <div className="bg-white bg-opacity-60 rounded p-2">
                                <p className="text-slate-500">Freq. 7d</p>
                                <p className="font-semibold">
                                  {missao.metricas_radar.frequencia_7d?.toFixed(2) || '-'}
                                </p>
                              </div>
                              <div className="bg-white bg-opacity-60 rounded p-2">
                                <p className="text-slate-500">Leads Ontem</p>
                                <p className="font-semibold">
                                  {missao.metricas_radar.leads_ontem || 0}
                                </p>
                              </div>
                              <div className="bg-white bg-opacity-60 rounded p-2">
                                <p className="text-slate-500">Invest. Diário</p>
                                <p className="font-semibold">
                                  R$ {missao.metricas_radar.investimento_diario?.toFixed(2) || '-'}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Previsão 7D */}
                          {missao.previsao_7d && (
                            <div className="bg-blue-50 rounded p-2 mb-3 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-blue-900 font-medium">Previsão 7D:</span>
                                <div className="flex items-center gap-2">
                                  <span>Score: {missao.previsao_7d.radar_score}</span>
                                  <span className={cn(
                                    "font-semibold",
                                    missao.previsao_7d.delta > 0 ? "text-green-600" : "text-red-600"
                                  )}>
                                    {missao.previsao_7d.delta > 0 ? '+' : ''}{missao.previsao_7d.delta}
                                  </span>
                                  <Badge className={cn(
                                    "text-xs",
                                    missao.previsao_7d.confianca === 'alta' ? 'bg-green-100 text-green-800' :
                                    missao.previsao_7d.confianca === 'media' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  )}>
                                    {missao.previsao_7d.confianca}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          )}

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
                    ✅ Concluídas ({missoesConcluidas.length})
                  </p>
                  <div className="space-y-2">
                    {missoesConcluidas.map((missao) => (
                      <div
                        key={missao.id}
                        className="p-3 rounded-lg bg-green-50 border border-green-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-green-900">{missao.unidade_nome}</p>
                            <p className="text-xs text-green-700">{missao.acao_aplicada}</p>
                          </div>
                          <Badge className="bg-green-600 text-white">
                            +{missao.pontos_ganhos || 0} pts
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Concluir Missão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-xs text-slate-500 mb-1">Unidade:</p>
              <p className="font-semibold text-slate-900">{missaoSelecionada?.unidade_nome}</p>
              <p className="text-sm text-slate-600 mt-2">{missaoSelecionada?.motivo}</p>
            </div>

            <div>
              <label className="font-medium block mb-2">Ação Aplicada*</label>
              <Select value={acaoAplicada} onValueChange={setAcaoAplicada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a ação executada..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(
                    ACOES_DISPONIVEIS.reduce((acc, acao) => {
                      if (!acc[acao.categoria]) acc[acao.categoria] = [];
                      acc[acao.categoria].push(acao);
                      return acc;
                    }, {})
                  ).map(([categoria, acoes]) => (
                    <React.Fragment key={categoria}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase">
                        {categoria}
                      </div>
                      {acoes.map((acao) => (
                        <SelectItem key={acao.value} value={acao.value}>
                          {acao.label}
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="font-medium block mb-2">Descrição da Ação (opcional)</label>
              <Textarea
                value={descricaoAcao}
                onChange={(e) => setDescricaoAcao(e.target.value)}
                placeholder="Descreva em detalhes a ação executada, resultados esperados..."
                rows={4}
              />
            </div>

            <div>
              <label className="font-medium block mb-2">Link/Evidência (opcional)</label>
              <Input
                value={evidenciaUrl}
                onChange={(e) => setEvidenciaUrl(e.target.value)}
                placeholder="URL do screenshot, campanha, etc..."
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