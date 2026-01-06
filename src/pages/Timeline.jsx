import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from '@/components/ui/StatusBadge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Loader2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRight,
  Filter,
  MessageSquare
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusSteps = [
  { key: 'recebida', label: 'Recebida', icon: Clock },
  { key: 'em_triagem', label: 'Triagem', icon: Clock },
  { key: 'em_execucao', label: 'Execução', icon: Clock },
  { key: 'em_revisao', label: 'Revisão', icon: Clock },
  { key: 'concluida', label: 'Concluída', icon: CheckCircle2 }
];

const getStepIndex = (status) => {
  if (status === 'aguardando_cliente') return 2; // Same as em_execucao
  return statusSteps.findIndex(s => s.key === status);
};

function TimelineItem({ demanda }) {
  const currentStep = getStepIndex(demanda.status);
  const isAguardando = demanda.status === 'aguardando_cliente';

  return (
    <Card className={`p-5 ${isAguardando ? 'border-amber-300 bg-amber-50/50' : ''}`}>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge type="setor" value={demanda.setor} size="xs" />
            {demanda.urgente && (
              <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                URGENTE
              </span>
            )}
          </div>
          <h3 className="font-semibold text-slate-900">{demanda.titulo}</h3>
          <p className="text-xs text-slate-500 mt-1">
            Criada em {format(new Date(demanda.created_date), "dd/MM/yyyy", { locale: ptBR })}
            {demanda.previsao_entrega && (
              <> • Previsão: {format(new Date(demanda.previsao_entrega), "dd/MM", { locale: ptBR })}</>
            )}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-1">
          {statusSteps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const Icon = step.icon;

            return (
              <React.Fragment key={step.key}>
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                  ${isCompleted ? 'bg-emerald-500 text-white' : 
                    isCurrent ? (isAguardando ? 'bg-amber-500 text-white' : 'bg-violet-500 text-white') : 
                    'bg-slate-200 text-slate-400'}
                `}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isCurrent && isAguardando ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < statusSteps.length - 1 && (
                  <div className={`w-6 h-0.5 ${isCompleted ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Action */}
        <div className="flex items-center gap-2">
          {isAguardando && (
            <Link to={createPageUrl(`Demandas?id=${demanda.id}`)}>
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600">
                <MessageSquare className="w-4 h-4 mr-1" />
                Responder
              </Button>
            </Link>
          )}
          {!isAguardando && (
            <Link to={createPageUrl(`Demandas?id=${demanda.id}`)}>
              <Button variant="outline" size="sm">
                Ver detalhes
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Aguardando Alert */}
      {isAguardando && (
        <div className="mt-4 p-3 bg-amber-100 rounded-lg flex items-center gap-2 text-amber-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">
            Esta demanda aguarda informações suas para continuar.
          </span>
        </div>
      )}
    </Card>
  );
}

export default function Timeline() {
  const [setorFilter, setSetorFilter] = useState('all');

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000
  });

  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas', user?.cliente_id, user?.tipo_acesso],
    queryFn: async () => {
      if (user?.tipo_acesso === 'voxx_admin') {
        return base44.entities.Demanda.list('-updated_date', 200);
      }
      if (user?.tipo_acesso === 'voxx_operacao' && user?.clientes_atribuidos?.length) {
        const all = await base44.entities.Demanda.list('-updated_date', 200);
        return all.filter(d => user.clientes_atribuidos.includes(d.cliente_id));
      }
      if (user?.cliente_id) {
        return base44.entities.Demanda.filter({ cliente_id: user.cliente_id }, '-updated_date', 100);
      }
      return [];
    },
    enabled: !!user,
    staleTime: 30 * 1000
  });

  const filteredDemandas = demandas
    .filter(d => d.status !== 'concluida')
    .filter(d => setorFilter === 'all' || d.setor === setorFilter)
    .sort((a, b) => {
      // Aguardando cliente first
      if (a.status === 'aguardando_cliente' && b.status !== 'aguardando_cliente') return -1;
      if (b.status === 'aguardando_cliente' && a.status !== 'aguardando_cliente') return 1;
      return new Date(b.updated_date) - new Date(a.updated_date);
    });

  const aguardandoCount = demandas.filter(d => d.status === 'aguardando_cliente').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert for Aguardando */}
      {aguardandoCount > 0 && (
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-800">
                {aguardandoCount} demanda(s) aguardando sua resposta
              </p>
              <p className="text-sm text-amber-700">
                Responda para que possamos dar continuidade ao trabalho.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <Select value={setorFilter} onValueChange={setSetorFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            <SelectItem value="TRAFEGO_META">Tráfego Meta</SelectItem>
            <SelectItem value="TRAFEGO_GOOGLE">Tráfego Google</SelectItem>
            <SelectItem value="TRAFEGO_TIKTOK">Tráfego TikTok</SelectItem>
            <SelectItem value="CRIACAO">Criação</SelectItem>
            <SelectItem value="EDICAO">Edição</SelectItem>
            <SelectItem value="BI_RELATORIO">BI/Relatório</SelectItem>
            <SelectItem value="IMPLANTACAO">Implantação</SelectItem>
            <SelectItem value="FINANCEIRO">Financeiro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Timeline List */}
      {filteredDemandas.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-slate-500">Nenhuma demanda em andamento.</p>
          <Link to={createPageUrl('AbrirDemanda')}>
            <Button className="mt-4">Abrir nova demanda</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredDemandas.map(demanda => (
            <TimelineItem key={demanda.id} demanda={demanda} />
          ))}
        </div>
      )}

      {/* Legend */}
      <Card className="p-4">
        <p className="text-xs font-medium text-slate-500 mb-3">Legenda dos status</p>
        <div className="flex flex-wrap gap-4 text-sm">
          {statusSteps.map((step, index) => (
            <div key={step.key} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs">
                {index + 1}
              </div>
              <span className="text-slate-600">{step.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center">
              <AlertCircle className="w-3 h-3" />
            </div>
            <span className="text-slate-600">Aguardando Cliente</span>
          </div>
        </div>
      </Card>
    </div>
  );
}