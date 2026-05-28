import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Shield, Save, CheckCircle, Lock, Eye, Users, Search, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';

const TIPOS_USUARIO = [
  { value: 'voxx_admin', label: 'Voxx Admin', color: 'bg-purple-100 text-purple-700', description: 'Acesso total ao sistema' },
  { value: 'voxx_manager', label: 'Voxx Manager', color: 'bg-blue-100 text-blue-700', description: 'Gestão de clientes e equipe' },
  { value: 'voxx_operacao', label: 'Voxx Operação', color: 'bg-indigo-100 text-indigo-700', description: 'Operação e execução' },
  { value: 'voxx_financeiro', label: 'Voxx Financeiro', color: 'bg-emerald-100 text-emerald-700', description: 'Acesso ao módulo financeiro VOXX' },
  { value: 'cliente_admin', label: 'Cliente Admin', color: 'bg-green-100 text-green-700', description: 'Administrador do cliente' },
  { value: 'cliente_usuario', label: 'Cliente Usuário', color: 'bg-slate-100 text-slate-700', description: 'Usuário padrão do cliente' },
  { value: 'oral_sin_franqueadora', label: 'Oral Sin Franqueadora', color: 'bg-orange-100 text-orange-700', description: 'Acesso franqueadora Oral Sin' }
];

const PAGINAS_DISPONIVEIS = [
  { nome: 'Home', descricao: 'Dashboard principal', categoria: 'Principal' },
  { nome: 'Performance', descricao: 'Métricas de performance', categoria: 'Análise' },
  { nome: 'DashboardPortfolio', descricao: 'Dashboard de portfólio', categoria: 'Análise' },
  { nome: 'Saldos', descricao: 'Controle de saldos', categoria: 'Financeiro' },
  { nome: 'GestaoSaldoMetaAds', descricao: 'Gestão de saldos Meta Ads', categoria: 'Financeiro' },
  { nome: 'RecalculoMetaAds', descricao: 'Recálculo Meta Ads', categoria: 'Financeiro' },
  { nome: 'PlanejamentoEstrategico', descricao: 'Planejamento estratégico', categoria: 'Planejamento' },
  { nome: 'Demandas', descricao: 'Gestão de demandas', categoria: 'Operacional' },
  { nome: 'AbrirDemanda', descricao: 'Criar nova demanda', categoria: 'Operacional' },
  { nome: 'Kanban', descricao: 'Kanban de demandas', categoria: 'Operacional' },
  { nome: 'Timeline', descricao: 'Timeline de entregas', categoria: 'Operacional' },
  { nome: 'Cronograma', descricao: 'Cronograma Oral Sin', categoria: 'Operacional' },
  { nome: 'MonitoramentoContas', descricao: 'Monitoramento de contas', categoria: 'Análise' },
  { nome: 'HistoricoOtimizacoesCliente', descricao: 'Histórico de otimizações', categoria: 'Análise' },
  { nome: 'CrcCaixaLeads', descricao: 'CRC - Caixa de Leads', categoria: 'CRC' },
  { nome: 'CrcPerformance', descricao: 'CRC - Performance', categoria: 'CRC' },
  { nome: 'CrcConfiguracao', descricao: 'CRC - Configuração', categoria: 'CRC' },
  { nome: 'Newsletter', descricao: 'Newsletter e insights', categoria: 'Conteúdo' },
  { nome: 'Ajuda', descricao: 'Central de ajuda', categoria: 'Suporte' },
  { nome: 'Conta', descricao: 'Configurações de conta', categoria: 'Configurações' },
  { nome: 'GerenciarAcessos', descricao: 'Gerenciar acessos', categoria: 'Administração' },
  { nome: 'GerenciarPermissoes', descricao: 'Gerenciar permissões', categoria: 'Administração' },
  { nome: 'GerenciarContas', descricao: 'Gerenciar contas', categoria: 'Administração' },
  { nome: 'GerenciarChats', descricao: 'Gerenciar chats', categoria: 'Administração' },
  { nome: 'CadastroCliente', descricao: 'Cadastro de cliente', categoria: 'Administração' },
  { nome: 'OnboardingCliente', descricao: 'Onboarding de cliente', categoria: 'Administração' },
  { nome: 'ConfiguracaoAlertas', descricao: 'Configuração de alertas', categoria: 'Configurações' },
  { nome: 'Chat', descricao: 'Chat & Suporte', categoria: 'Suporte' },
  { nome: 'MonitoramentoDemandas', descricao: 'Monitoramento de Demandas', categoria: 'Análise' },
  { nome: 'MonitoramentoGoogleAds', descricao: 'Monitoramento Google Ads', categoria: 'Análise' },
  { nome: 'GestaoSaldoGoogleAds', descricao: 'Gestão de Saldos Google Ads', categoria: 'Financeiro' },
  { nome: 'FinanceiroVisaoGeral', descricao: 'Financeiro — Visão Geral', categoria: 'Financeiro' },
  { nome: 'FinanceiroReceitas', descricao: 'Financeiro — Receitas', categoria: 'Financeiro' },
  { nome: 'FinanceiroCustos', descricao: 'Financeiro — Custos & Despesas', categoria: 'Financeiro' },
  { nome: 'FinanceiroFolha', descricao: 'Financeiro — Folha de Pagamento', categoria: 'Financeiro' },
  { nome: 'FinanceiroDocumentos', descricao: 'Financeiro — Documentos', categoria: 'Financeiro' },
  { nome: 'FinanceiroFluxoCaixa', descricao: 'Financeiro — Fluxo de Caixa (DRE)', categoria: 'Financeiro' },
  { nome: 'FinanceiroCarteira', descricao: 'Financeiro — Carteira de Clientes', categoria: 'Financeiro' },
  { nome: 'Comercial', descricao: 'Pipeline comercial e gestão de leads', categoria: 'Operacional' },
  { nome: 'PerformanceOperacional', descricao: 'Performance Operacional por setor', categoria: 'Operacional' },
  { nome: 'BriefingClientes', descricao: 'Briefing e contexto das marcas', categoria: 'Operacional' },
  { nome: 'InteligeniciaOperacional', descricao: 'Inteligência Operacional por cliente', categoria: 'Operacional' },
  { nome: 'AgendaVoxx', descricao: 'Agenda VOXX — reuniões e organização', categoria: 'Operacional' },
  { nome: 'AgendaDashboard', descricao: 'Dashboard Agenda — performance do time', categoria: 'Análise' },
  { nome: 'PlanoDeAcao', descricao: 'Plano de Ação', categoria: 'Operacional' },
  { nome: 'PlanoDeAcaoDetalhe', descricao: 'Detalhe do Plano de Ação', categoria: 'Operacional' },
  { nome: 'ReportDiario', descricao: 'Report Diário', categoria: 'Operacional' },
  { nome: 'InteligenicaUnidades', label: 'Performance VOXX | Oral Sin', descricao: 'Performance VOXX | Oral Sin', categoria: 'Análise' },
  { nome: 'DetalheConta', descricao: 'Detalhe de Conta Meta Ads', categoria: 'Análise' },
  { nome: 'HistoricoOtimizacoesCliente', descricao: 'Histórico de Otimizações', categoria: 'Análise' }
];

const CATEGORIAS = [...new Set(PAGINAS_DISPONIVEIS.map(p => p.categoria))];

export default function GerenciarPermissoes({ user }) {
  const queryClient = useQueryClient();
  const [permissoesPorTipo, setPermissoesPorTipo] = useState({});
  const [permissoesOriginais, setPermissoesOriginais] = useState({});
  const [tipoAtivo, setTipoAtivo] = useState('voxx_admin');
  const [busca, setBusca] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [temAlteracoes, setTemAlteracoes] = useState(false);

  const { data: permissoesExistentes = [], isLoading } = useQuery({
    queryKey: ['userTypePermissions'],
    queryFn: () => base44.entities.UserTypePermissions.list('-updated_date', 100),
    staleTime: 30 * 1000
  });

  // Inicializar estado com permissões existentes
  useEffect(() => {
    if (permissoesExistentes.length > 0) {
      const permissoesMap = {};
      permissoesExistentes.forEach(perm => {
        permissoesMap[perm.tipo_usuario] = {
          id: perm.id,
          paginas: perm.paginas_permitidas || [],
          descricao: perm.descricao
        };
      });
      setPermissoesPorTipo(permissoesMap);
      setPermissoesOriginais(JSON.parse(JSON.stringify(permissoesMap)));
    } else if (permissoesExistentes.length === 0 && Object.keys(permissoesPorTipo).length === 0) {
      // Inicializar com permissões padrão apenas se ainda não foi inicializado
      const permissoesDefault = {};
      TIPOS_USUARIO.forEach(tipo => {
        permissoesDefault[tipo.value] = {
          id: null,
          paginas: tipo.value === 'voxx_admin' ? PAGINAS_DISPONIVEIS.map(p => p.nome) : [],
          descricao: tipo.description
        };
      });
      setPermissoesPorTipo(permissoesDefault);
      setPermissoesOriginais(JSON.parse(JSON.stringify(permissoesDefault)));
    }
  }, [permissoesExistentes.length]);

  // Detectar alterações
  useEffect(() => {
    const alterado = JSON.stringify(permissoesPorTipo) !== JSON.stringify(permissoesOriginais);
    setTemAlteracoes(alterado);
  }, [permissoesPorTipo, permissoesOriginais]);

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const promises = [];
      
      for (const tipo of TIPOS_USUARIO) {
        const permissao = permissoesPorTipo[tipo.value];
        if (!permissao) continue;

        const data = {
          tipo_usuario: tipo.value,
          paginas_permitidas: permissao.paginas,
          descricao: permissao.descricao || tipo.description
        };

        if (permissao.id) {
          promises.push(base44.entities.UserTypePermissions.update(permissao.id, data));
        } else {
          promises.push(base44.entities.UserTypePermissions.create(data));
        }
      }

      await Promise.all(promises);

      // Log
      await base44.entities.LogAuditoria.create({
        acao: 'UPDATE_PERMISSIONS',
        usuario_id: user.id,
        usuario_email: user.email,
        entidade: 'UserTypePermissions',
        detalhes: {
          tipos_atualizados: TIPOS_USUARIO.map(t => t.value)
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userTypePermissions'] });
      setPermissoesOriginais(JSON.parse(JSON.stringify(permissoesPorTipo)));
      setTemAlteracoes(false);
      toast.success('Permissões atualizadas com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar permissões: ' + error.message);
    }
  });

  const togglePagina = (tipoUsuario, nomePagina) => {
    setPermissoesPorTipo(prev => {
      const permissao = prev[tipoUsuario] || { id: null, paginas: [], descricao: '' };
      const paginas = permissao.paginas || [];
      const novasPaginas = paginas.includes(nomePagina)
        ? paginas.filter(p => p !== nomePagina)
        : [...paginas, nomePagina];

      return {
        ...prev,
        [tipoUsuario]: {
          ...permissao,
          paginas: novasPaginas
        }
      };
    });
  };

  const toggleTodasPaginas = (tipoUsuario, marcar) => {
    if (!marcar) {
      setConfirmAction(() => () => {
        setPermissoesPorTipo(prev => {
          const permissao = prev[tipoUsuario] || { id: null, paginas: [], descricao: '' };
          return {
            ...prev,
            [tipoUsuario]: {
              ...permissao,
              paginas: []
            }
          };
        });
      });
      setShowConfirmDialog(true);
    } else {
      setPermissoesPorTipo(prev => {
        const permissao = prev[tipoUsuario] || { id: null, paginas: [], descricao: '' };
        return {
          ...prev,
          [tipoUsuario]: {
            ...permissao,
            paginas: PAGINAS_DISPONIVEIS.map(p => p.nome)
          }
        };
      });
    }
  };

  const descartarAlteracoes = () => {
    setPermissoesPorTipo(JSON.parse(JSON.stringify(permissoesOriginais)));
    toast.info('Alterações descartadas');
  };

  const toggleCategoria = (tipoUsuario, categoria, marcar) => {
    setPermissoesPorTipo(prev => {
      const permissao = prev[tipoUsuario] || { id: null, paginas: [], descricao: '' };
      const paginasCategoria = PAGINAS_DISPONIVEIS.filter(p => p.categoria === categoria).map(p => p.nome);
      const paginasAtuais = permissao.paginas || [];

      const novasPaginas = marcar
        ? [...new Set([...paginasAtuais, ...paginasCategoria])]
        : paginasAtuais.filter(p => !paginasCategoria.includes(p));

      return {
        ...prev,
        [tipoUsuario]: {
          ...permissao,
          paginas: novasPaginas
        }
      };
    });
  };

  const tipoSelecionado = TIPOS_USUARIO.find(t => t.value === tipoAtivo);
  const permissaoAtual = permissoesPorTipo[tipoAtivo] || { paginas: [], descricao: '' };
  const paginasSelecionadas = permissaoAtual.paginas || [];

  const paginasFiltradas = PAGINAS_DISPONIVEIS.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.descricao.toLowerCase().includes(busca.toLowerCase()) ||
    p.categoria.toLowerCase().includes(busca.toLowerCase())
  );

  const categoriasFiltradas = busca 
    ? [...new Set(paginasFiltradas.map(p => p.categoria))]
    : CATEGORIAS;

  // Verificar se usuário tem permissão (APÓS todos os hooks)
  const tipoUsuario = user?.tipo_usuario || user?.tipo_acesso;
  if (!user || (user.role !== 'admin' && tipoUsuario !== 'voxx_admin')) {
    return (
      <Card className="p-8 text-center">
        <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold">Acesso Negado</h2>
        <p className="text-slate-500 mt-2">Apenas administradores podem gerenciar permissões.</p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Carregando permissões...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Gerenciar Permissões</h1>
            {temAlteracoes && (
              <Badge className="bg-amber-100 text-amber-700 animate-pulse">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Não salvo
              </Badge>
            )}
          </div>
          <p className="text-slate-500 mt-1">Configure quais páginas cada tipo de usuário pode acessar</p>
        </div>
        <div className="flex gap-2">
          {temAlteracoes && (
            <Button 
              onClick={descartarAlteracoes}
              variant="outline"
            >
              <X className="w-4 h-4 mr-2" />
              Descartar
            </Button>
          )}
          <Button 
            onClick={() => salvarMutation.mutate()}
            disabled={salvarMutation.isPending || !temAlteracoes}
            className="bg-violet-600 hover:bg-violet-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {salvarMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </div>

      {/* Alert Info */}
      {temAlteracoes ? (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-900">
            Você tem alterações não salvas. Clique em "Salvar Alterações" para aplicar ou "Descartar" para cancelar.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-blue-50 border-blue-200">
          <Shield className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            Defina quais páginas cada perfil de usuário pode visualizar. As alterações serão aplicadas imediatamente após salvar.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs por Tipo de Usuário */}
      <Tabs value={tipoAtivo} onValueChange={setTipoAtivo}>
        <TabsList className="grid w-full grid-cols-7 mb-6">
          {TIPOS_USUARIO.map(tipo => (
            <TabsTrigger key={tipo.value} value={tipo.value}>
              <Users className="w-4 h-4 mr-2" />
              {tipo.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TIPOS_USUARIO.map(tipo => {
          const permissao = permissoesPorTipo[tipo.value] || { paginas: [] };
          const paginas = permissao.paginas || [];

          return (
            <TabsContent key={tipo.value} value={tipo.value} className="space-y-6">
              {/* Info do Tipo */}
              <Card>
                <CardHeader>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-3">
                          <Badge className={tipo.color}>{tipo.label}</Badge>
                          <span className="text-slate-600 text-sm font-normal">
                            {paginas.length} de {PAGINAS_DISPONIVEIS.length} páginas permitidas
                          </span>
                        </CardTitle>
                        <p className="text-sm text-slate-500 mt-2">{tipo.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleTodasPaginas(tipo.value, true)}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Marcar Todas
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleTodasPaginas(tipo.value, false)}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Desmarcar Todas
                        </Button>
                      </div>
                    </div>
                    
                    {/* Busca */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Buscar páginas..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="pl-10"
                      />
                      {busca && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                          onClick={() => setBusca('')}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {busca && (
                      <div className="text-sm text-slate-600">
                        {paginasFiltradas.length} página(s) encontrada(s)
                      </div>
                    )}
                  </div>
                </CardHeader>
              </Card>

              {/* Páginas por Categoria */}
              {categoriasFiltradas.map(categoria => {
                const paginasCategoria = paginasFiltradas.filter(p => p.categoria === categoria);
                const todasMarcadas = paginasCategoria.every(p => paginas.includes(p.nome));
                const algumasMarcadas = paginasCategoria.some(p => paginas.includes(p.nome));

                return (
                  <Card key={categoria}>
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{categoria}</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleCategoria(tipo.value, categoria, !todasMarcadas)}
                          className="text-xs"
                        >
                          {todasMarcadas ? 'Desmarcar Categoria' : 'Marcar Categoria'}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {paginasCategoria.map(pagina => {
                          const isPermitida = paginas.includes(pagina.nome);
                          return (
                            <label
                              key={pagina.nome}
                              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md group ${
                                isPermitida 
                                  ? 'border-violet-300 bg-violet-50 hover:bg-violet-100' 
                                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <Checkbox
                                checked={isPermitida}
                                onCheckedChange={() => togglePagina(tipo.value, pagina.nome)}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {isPermitida ? (
                                    <Eye className="w-4 h-4 text-violet-600 flex-shrink-0" />
                                  ) : (
                                    <Lock className="w-4 h-4 text-slate-400 flex-shrink-0 group-hover:text-slate-600" />
                                  )}
                                  <p className={`font-medium truncate ${isPermitida ? 'text-violet-900' : 'text-slate-900'}`}>
                                    {pagina.label || pagina.nome}
                                  </p>
                                </div>
                                <p className="text-xs text-slate-500">{pagina.descricao}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Resumo Geral */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo de Permissões</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {TIPOS_USUARIO.map(tipo => {
              const permissao = permissoesPorTipo[tipo.value] || { paginas: [] };
              const paginas = permissao.paginas || [];
              const percentual = ((paginas.length / PAGINAS_DISPONIVEIS.length) * 100).toFixed(0);

              return (
                <div key={tipo.value} className="flex items-center gap-4">
                  <Badge className={`${tipo.color} min-w-[140px]`}>{tipo.label}</Badge>
                  <div className="flex-1">
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-violet-600 h-2 rounded-full transition-all"
                        style={{ width: `${percentual}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-slate-600 min-w-[100px] text-right">
                    {paginas.length}/{PAGINAS_DISPONIVEIS.length} páginas
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Confirmação */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desmarcar todas as páginas?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a remover o acesso a todas as páginas para este tipo de usuário. 
              Isso pode impedir que usuários deste perfil acessem o sistema. Tem certeza?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction) confirmAction();
                setShowConfirmDialog(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Sim, desmarcar todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}