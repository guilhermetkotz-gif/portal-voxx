import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Search, 
  TrendingUp, 
  DollarSign, 
  MousePointerClick, 
  Target,
  AlertCircle,
  CheckCircle,
  Pause,
  RefreshCw,
  UserCheck
} from 'lucide-react';
import GoogleAdsAccountCard from '../components/GoogleAdsAccountCard';
import ResponsavelCell from '../components/googleads/ResponsavelCell';
import PerformancePorOperadorGoogleAds from '../components/googleads/PerformancePorOperadorGoogleAds';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function MonitoramentoGoogleAds() {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('cards');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['google-ads-accounts'],
    queryFn: async () => {
      const googleAdsAccounts = await base44.entities.GoogleAdsAccount.list('-optimization_score');
      const clientes = await base44.entities.Cliente.list();
      
      // Criar mapa de contas da planilha por account_name
      const googleAdsMap = new Map();
      googleAdsAccounts.forEach(acc => {
        if (acc.account_name) {
          googleAdsMap.set(acc.account_name.trim().toLowerCase(), acc);
        }
      });
      
      // Processar clientes
      const contasClientes = clientes
        .filter(c => c.google_ads_account_name && c.google_ads_account_name.trim())
        .map(c => {
          const accountNameNormalized = c.google_ads_account_name.trim().toLowerCase();
          const googleAdsData = googleAdsMap.get(accountNameNormalized);
          
          // Se tiver dados da planilha, mescla; senão, usa dados do cliente
          return {
            id: `cliente_${c.id}`,
            account_name: c.google_ads_account_name.trim(),
            unidade_nome: c.nome,
            cliente_nome: c.nome,
            responsavel_voxx: c.responsavel_voxx_trafego || c.responsavel_voxx,
            clicks: googleAdsData?.clicks || c.cliques_google_whatsapp || 0,
            conversions: googleAdsData?.conversions || (c.leads_google_cadastro || 0) + (c.leads_google_ligacao || 0),
            all_conversions: googleAdsData?.all_conversions || (c.leads_google_cadastro || 0) + (c.leads_google_ligacao || 0),
            cost: googleAdsData?.cost || c.investimento_google_mes || 0,
            avg_cpc: googleAdsData?.avg_cpc || c.cpc_google || 0,
            avg_cpm: googleAdsData?.avg_cpm || 0,
            optimization_score: googleAdsData?.optimization_score || 0,
            account_status: googleAdsData?.account_status || (c.status === 'ativo' ? 'Ativa' : 'Pausada'),
            conta_sem_dados: googleAdsData?.conta_sem_dados || false,
            fonte_dados: googleAdsData ? 'Planilha Google Ads' : 'Cadastro Cliente'
          };
        });
      
      // Adicionar contas da planilha que não têm cliente correspondente
      const clienteAccountNames = new Set(
        contasClientes.map(c => c.account_name.toLowerCase())
      );
      
      const contasOrfas = googleAdsAccounts
        .filter(acc => !clienteAccountNames.has(acc.account_name?.toLowerCase()))
        .map(acc => ({
          ...acc,
          fonte_dados: 'Planilha Google Ads (sem cliente)'
        }));
      
      return [...contasClientes, ...contasOrfas];
    },
    enabled: !!user,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user,
  });

  const { data: clientes = [], refetch: refetchClientes } = useQuery({
    queryKey: ['clientes-for-google-ads'],
    queryFn: () => base44.entities.Cliente.list(),
    enabled: !!user,
  });

  const voxxUsers = users.filter(u => 
    u.tipo_usuario === 'voxx_admin' || 
    u.tipo_usuario === 'voxx_operacao' || 
    u.tipo_usuario === 'voxx_manager'
  );

  const kpis = useMemo(() => {
    if (!accounts.length) return null;

    const totalInvestimento = accounts.reduce((sum, acc) => sum + acc.cost, 0);
    const totalConversoes = accounts.reduce((sum, acc) => sum + acc.conversions, 0);
    const cpaGeral = totalConversoes > 0 ? totalInvestimento / totalConversoes : 0;
    const cpcMedio = accounts.reduce((sum, acc) => sum + acc.avg_cpc, 0) / accounts.length;
    const scoreMedio = accounts.reduce((sum, acc) => sum + acc.optimization_score, 0) / accounts.length;
    const contasAtivas = accounts.filter(acc => acc.account_status === 'Ativa' && !acc.conta_sem_dados).length;

    return {
      totalInvestimento,
      totalConversoes,
      cpaGeral,
      cpcMedio,
      scoreMedio,
      contasAtivas,
      totalContas: accounts.length
    };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    let filtered = searchTerm 
      ? accounts.filter(acc => {
          const term = searchTerm.toLowerCase();
          return acc.account_name?.toLowerCase().includes(term) ||
                 acc.unidade_nome?.toLowerCase().includes(term) ||
                 acc.cliente_nome?.toLowerCase().includes(term);
        })
      : accounts;
    
    // Ordenar: contas com atenção (sem dados) por último, depois pausadas, ativas primeiro
    return filtered.sort((a, b) => {
      const getPriority = (acc) => {
        if (acc.conta_sem_dados) return 2; // Atenção - por último
        if (acc.account_status === 'Pausada') return 1; // Pausada - meio
        return 0; // Ativa - primeiro
      };
      
      return getPriority(a) - getPriority(b);
    });
  }, [accounts, searchTerm]);

  const getUserName = (userId) => {
    const user = users.find(u => u.id === userId);
    return user?.full_name || 'Não atribuído';
  };

  const handleAssignResponsavel = async (accountId, accountName, userId, closeDialog) => {
    try {
      console.log('Atribuindo responsável:', { accountId, accountName, userId });
      
      // Atualizar diretamente a conta GoogleAdsAccount
      await base44.entities.GoogleAdsAccount.update(accountId, {
        responsavel_voxx: userId
      });

      console.log('Conta Google Ads atualizada com sucesso!');
      toast.success('Responsável atribuído com sucesso!');
      
      // Fechar dialog
      if (closeDialog) {
        console.log('Fechando dialog...');
        closeDialog();
      }
      
      // Recarregar dados após delay
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Erro completo ao atribuir:', error);
      toast.error('Erro ao atribuir responsável: ' + error.message);
    }
  };

  const getResponsavelGoogleAds = (accountName) => {
    const cliente = clientes.find(c => 
      c.google_ads_account_name?.trim().toLowerCase() === accountName?.trim().toLowerCase()
    );
    return cliente?.responsavel_google_ads;
  };

  const getStatusIcon = (account) => {
    if (account.conta_sem_dados) {
      return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
    if (account.account_status === 'Pausada') {
      return <Pause className="w-4 h-4 text-orange-500" />;
    }
    return <CheckCircle className="w-4 h-4 text-green-600" />;
  };

  const getScoreBadge = (score) => {
    if (score >= 80) return <Badge className="bg-green-600">Excelente</Badge>;
    if (score >= 70) return <Badge className="bg-yellow-600">Bom</Badge>;
    return <Badge className="bg-red-600">Crítico</Badge>;
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      await base44.functions.invoke('syncGoogleAdsAccounts');
      toast.success('Dados atualizados com sucesso!');
      // Refetch accounts data
      window.location.reload();
    } catch (error) {
      toast.error('Erro ao atualizar dados: ' + error.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando contas Google Ads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Monitoramento Google Ads</h1>
            <p className="text-gray-600 mt-1">Visão geral das contas Google Ads - VOXX</p>
          </div>
          <Button
            onClick={handleRefreshData}
            disabled={isRefreshing}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Atualizando...' : 'Atualizar Dados'}
          </Button>
        </div>

        <Tabs defaultValue="monitoramento" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-2">
            <TabsTrigger value="monitoramento">Monitoramento de Contas</TabsTrigger>
            <TabsTrigger value="operadores">Contas/Operador</TabsTrigger>
          </TabsList>

          {/* Tab: Monitoramento de Contas */}
          <TabsContent value="monitoramento" className="space-y-6 mt-6">
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-4 py-2 rounded-lg ${viewMode === 'cards' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
              >
                Cards
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded-lg ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
              >
                Tabela
              </button>
            </div>

        {kpis && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Investimento Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold">R$ {kpis.totalInvestimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Conversões</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold">{kpis.totalConversoes}</p>
                  <Target className="w-6 h-6 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">CPA Médio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold">R$ {kpis.cpaGeral.toFixed(2)}</p>
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">CPC Médio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold">R$ {kpis.cpcMedio.toFixed(2)}</p>
                  <MousePointerClick className="w-6 h-6 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Score Médio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold">{kpis.scoreMedio.toFixed(0)}%</p>
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600">O</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Contas Ativas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold">{kpis.contasAtivas}/{kpis.totalContas}</p>
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Buscar por conta, unidade ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {viewMode === 'cards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.map(account => (
              <GoogleAdsAccountCard key={account.id} account={account} />
            ))}
          </div>
        )}

        {viewMode === 'table' && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Responsável VOXX</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Conversões</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Cost/Conv.</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead className="text-right">CPM</TableHead>
                  <TableHead>Opt. Score</TableHead>
                  <TableHead>Alertas</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map(account => {
                    return (
                      <TableRow key={account.id}>
                        <TableCell>{getStatusIcon(account)}</TableCell>
                        <TableCell className="font-medium">{account.account_name}</TableCell>
                        <TableCell>{account.unidade_nome}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          <ResponsavelCell
                            account={account}
                            voxxUsers={voxxUsers}
                            getUserName={getUserName}
                            getResponsavelGoogleAds={getResponsavelGoogleAds}
                            handleAssignResponsavel={handleAssignResponsavel}
                          />
                        </TableCell>
                        <TableCell className="text-right">{account.clicks.toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-right font-semibold">{account.conversions}</TableCell>
                        <TableCell className="text-right">R$ {account.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right font-semibold text-violet-600">
                          {account.cost_per_conversion > 0 ? `R$ ${account.cost_per_conversion.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">R$ {account.avg_cpc.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">R$ {account.avg_cpm.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getScoreBadge(account.optimization_score)}
                            <span className="text-sm text-gray-600">{account.optimization_score}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {account.conta_sem_dados && (
                            <Badge variant="outline" className="bg-gray-100">Sem Dados</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

            {filteredAccounts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Nenhuma conta encontrada</p>
              </div>
            )}
          </TabsContent>

          {/* Tab: Contas/Operador */}
          <TabsContent value="operadores" className="space-y-6 mt-6">
            <PerformancePorOperadorGoogleAds 
              googleAdsAccounts={accounts} 
              voxxUsers={voxxUsers}
              clientes={clientes}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}