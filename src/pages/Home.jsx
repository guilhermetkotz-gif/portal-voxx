import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import KPICard from '@/components/ui/KPICard';
import HealthScore from '@/components/ui/HealthScore';
import AlertsSection from '@/components/home/AlertsSection';
import RecentDemandas from '@/components/home/RecentDemandas';
import AcoesVoxxCard from '@/components/home/AcoesVoxxCard';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Users, 
  DollarSign, 
  MousePointerClick,
  Wallet,
  Calendar,
  PlusCircle,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function Home() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000
  });

  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes', user?.cliente_id, user?.tipo_acesso],
    queryFn: async () => {
      if (user?.tipo_acesso === 'voxx_admin') {
        return base44.entities.Cliente.list('-updated_date', 200);
      }
      if (user?.tipo_acesso === 'voxx_operacao' && user?.clientes_atribuidos?.length) {
        const all = await base44.entities.Cliente.list('-updated_date', 200);
        return all.filter(c => user.clientes_atribuidos.includes(c.id));
      }
      if (user?.cliente_id) {
        return base44.entities.Cliente.filter({ id: user.cliente_id });
      }
      return [];
    },
    enabled: !!user,
    staleTime: 60 * 1000
  });

  const cliente = clientes[0];

  const { data: demandas = [] } = useQuery({
    queryKey: ['demandas', user?.cliente_id],
    queryFn: () => {
      if (user?.tipo_acesso?.startsWith('voxx')) {
        return base44.entities.Demanda.list('-updated_date', 100);
      }
      return base44.entities.Demanda.filter({ cliente_id: user?.cliente_id }, '-updated_date', 50);
    },
    enabled: !!user,
    staleTime: 60 * 1000
  });

  const demandasAbertas = demandas.filter(d => d.status !== 'concluida');

  const { data: acoes = [] } = useQuery({
    queryKey: ['acoes', user?.cliente_id],
    queryFn: () => {
      if (user?.tipo_acesso?.startsWith('voxx')) {
        return base44.entities.AcaoVoxx.list('-created_date', 20);
      }
      return base44.entities.AcaoVoxx.filter({ cliente_id: user?.cliente_id }, '-created_date', 10);
    },
    enabled: !!user,
    staleTime: 60 * 1000
  });

  if (loadingClientes) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  const totalLeadsGoogle = (cliente?.leads_google_cadastro || 0) + (cliente?.leads_google_ligacao || 0);
  const diasRestantesMeta = cliente?.investimento_dia_meta > 0 
    ? Math.floor((cliente?.saldo_meta || 0) / cliente.investimento_dia_meta) 
    : null;
  const diasRestantesGoogle = cliente?.investimento_dia_google > 0 
    ? Math.floor((cliente?.saldo_google || 0) / cliente.investimento_dia_google) 
    : null;

  return (
    <div className="space-y-6">
      {/* Welcome & Health Score */}
      <div className="grid lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-3 p-6 bg-gradient-to-br from-violet-600 to-violet-700 text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Olá, {user?.full_name?.split(' ')[0] || 'Gestor'}! 👋
              </h2>
              <p className="text-violet-200 mt-1">
                {cliente ? `${cliente.nome} • ` : ''}
                {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
              <p className="text-sm text-violet-200 mt-3 max-w-xl">
                Acompanhe a performance das suas campanhas e demandas em tempo real. 
                Qualquer dúvida, estamos aqui!
              </p>
            </div>
            <Link to={createPageUrl('AbrirDemanda')}>
              <Button className="bg-white text-violet-700 hover:bg-violet-50 font-semibold">
                <PlusCircle className="w-4 h-4 mr-2" />
                Nova Demanda
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="p-6 flex flex-col items-center justify-center">
          <p className="text-xs font-medium text-slate-500 mb-2">Health Score</p>
          <HealthScore score={cliente?.health_score || 75} size="md" />
        </Card>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Leads Meta"
          value={cliente?.leads_meta_mes?.toLocaleString('pt-BR') || '-'}
          subtitle="Este mês"
          icon={Users}
          variant="primary"
        />
        <KPICard
          title="CPL Meta"
          value={formatCurrency(cliente?.custo_por_lead_meta)}
          subtitle="Custo por lead"
          icon={DollarSign}
          variant={cliente?.custo_por_lead_meta > (cliente?.cpl_baseline_meta * 1.2) ? 'warning' : 'default'}
        />
        <KPICard
          title="Leads Google"
          value={totalLeadsGoogle.toLocaleString('pt-BR') || '-'}
          subtitle={`${cliente?.leads_google_cadastro || 0} cadastros + ${cliente?.leads_google_ligacao || 0} ligações`}
          icon={Users}
          variant="success"
        />
        <KPICard
          title="CPC Google"
          value={formatCurrency(cliente?.cpc_google)}
          subtitle="Custo por clique"
          icon={MousePointerClick}
          variant="default"
        />
      </div>

      {/* Saldos */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Wallet className="w-4 h-4 text-blue-600" />
              </div>
              <span className="font-semibold text-slate-900">Saldo Meta</span>
            </div>
            <span className="text-2xl font-bold text-slate-900">
              {formatCurrency(cliente?.saldo_meta)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-slate-500">
              <Calendar className="w-4 h-4" />
              Próx. investimento: {cliente?.data_proximo_investimento_meta 
                ? format(new Date(cliente.data_proximo_investimento_meta), "dd/MM") 
                : '-'}
            </div>
            {diasRestantesMeta !== null && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                diasRestantesMeta < 3 ? 'bg-red-100 text-red-700' : 
                diasRestantesMeta < 5 ? 'bg-amber-100 text-amber-700' : 
                'bg-emerald-100 text-emerald-700'
              }`}>
                ~{diasRestantesMeta} dias restantes
              </span>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <Wallet className="w-4 h-4 text-red-600" />
              </div>
              <span className="font-semibold text-slate-900">Saldo Google</span>
            </div>
            <span className="text-2xl font-bold text-slate-900">
              {formatCurrency(cliente?.saldo_google)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-slate-500">
              <Calendar className="w-4 h-4" />
              Próx. investimento: {cliente?.data_proximo_investimento_google 
                ? format(new Date(cliente.data_proximo_investimento_google), "dd/MM") 
                : '-'}
            </div>
            {diasRestantesGoogle !== null && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                diasRestantesGoogle < 3 ? 'bg-red-100 text-red-700' : 
                diasRestantesGoogle < 5 ? 'bg-amber-100 text-amber-700' : 
                'bg-emerald-100 text-emerald-700'
              }`}>
                ~{diasRestantesGoogle} dias restantes
              </span>
            )}
          </div>
        </Card>
      </div>

      {/* Alerts, Demandas, Ações */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900">Alertas</h3>
          <AlertsSection cliente={cliente} />
        </div>
        <RecentDemandas demandas={demandasAbertas} />
        <AcoesVoxxCard acoes={acoes} />
      </div>
    </div>
  );
}