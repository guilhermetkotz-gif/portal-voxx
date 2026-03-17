import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Progress } from "@/components/ui/progress";
import { Wallet, Calendar, TrendingUp, AlertTriangle, ArrowRight, PiggyBank } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

function SaldoCard({ 
  plataforma, 
  saldo, 
  investimentoDia, 
  proximoInvestimento, 
  investimentoMes,
  color 
}) {
  const diasRestantes = investimentoDia > 0 ? Math.floor(saldo / investimentoDia) : null;
  const diasAteProximo = proximoInvestimento 
    ? differenceInDays(new Date(proximoInvestimento), new Date())
    : null;
  
  const statusColor = diasRestantes === null ? 'slate' :
    diasRestantes < 3 ? 'red' : 
    diasRestantes < 5 ? 'amber' : 'emerald';

  const colorConfig = {
    meta: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'bg-blue-100 text-blue-600', badge: 'bg-blue-600' },
    google: { bg: 'bg-red-50', border: 'border-red-200', icon: 'bg-red-100 text-red-600', badge: 'bg-red-600' }
  };

  const config = colorConfig[color];

  return (
    <Card className={`p-6 ${config.bg} ${config.border} border-2`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${config.icon}`}>
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${config.badge}`}>
              {plataforma.toUpperCase()}
            </span>
            <p className="text-sm text-slate-500 mt-1">Saldo disponível</p>
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900">{formatCurrency(saldo)}</p>
      </div>

      {/* Progress */}
      {diasRestantes !== null && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-600">Duração estimada</span>
            <span className={`font-semibold text-${statusColor}-600`}>
              {diasRestantes} dias
            </span>
          </div>
          <Progress 
            value={Math.min((diasRestantes / 30) * 100, 100)} 
            className="h-2"
          />
        </div>
      )}

      {/* Details */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
        <div>
          <div className="flex items-center gap-1 text-slate-500 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs">Investimento/dia</span>
          </div>
          <p className="font-semibold text-slate-900">{formatCurrency(investimentoDia)}</p>
        </div>
        <div>
          <div className="flex items-center gap-1 text-slate-500 mb-1">
            <PiggyBank className="w-4 h-4" />
            <span className="text-xs">Investido no mês</span>
          </div>
          <p className="font-semibold text-slate-900">{formatCurrency(investimentoMes)}</p>
        </div>
      </div>

      {/* Next Investment */}
      {proximoInvestimento && (
        <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-600">Próximo investimento</span>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-900">
                {format(new Date(proximoInvestimento), "dd 'de' MMMM", { locale: ptBR })}
              </p>
              {diasAteProximo !== null && (
                <p className="text-xs text-slate-500">
                  {diasAteProximo <= 0 ? 'Hoje ou em breve' : `em ${diasAteProximo} dia(s)`}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Alert */}
      {diasRestantes !== null && diasRestantes < 5 && (
        <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
          diasRestantes < 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
        }`}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">
            {diasRestantes < 3 
              ? 'Saldo crítico! Solicite investimento urgente.'
              : 'Saldo baixo. Considere antecipar investimento.'}
          </span>
        </div>
      )}
    </Card>
  );
}

export default function Saldos({ currentCliente }) {
  const cliente = currentCliente;

  if (!cliente) {
    return (
      <Card className="p-8 text-center">
        <p className="text-slate-500">Nenhum cliente vinculado à sua conta.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Saldo Cards */}
      <div className="grid lg:grid-cols-2 gap-6">
        <SaldoCard
          plataforma="Meta"
          saldo={cliente.saldo_meta}
          investimentoDia={cliente.investimento_dia_meta}
          proximoInvestimento={cliente.data_proximo_investimento_meta}
          investimentoMes={cliente.investimento_meta_mes}
          color="meta"
        />
        <SaldoCard
          plataforma="Google"
          saldo={cliente.saldo_google}
          investimentoDia={cliente.investimento_dia_google}
          proximoInvestimento={cliente.data_proximo_investimento_google}
          investimentoMes={cliente.investimento_google_mes}
          color="google"
        />
      </div>

      {/* CTA */}
      <Card className="p-6 bg-gradient-to-r from-violet-600 to-violet-700 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">Precisa de mais investimento?</h3>
            <p className="text-violet-200 mt-1">
              Solicite uma nova tomada de investimento diretamente por aqui.
            </p>
          </div>
          <Link to={createPageUrl('AbrirDemanda') + '?tipo=FINANCEIRO&subtipo=investimento'}>
            <Button className="bg-white text-violet-700 hover:bg-violet-50 font-semibold">
              Solicitar Investimento
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </Card>

      {/* Info */}
      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-3">ℹ️ Como funciona</h3>
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            <strong>Saldo:</strong> É o valor disponível para suas campanhas rodarem. Quando zera, os anúncios pausam automaticamente.
          </p>
          <p>
            <strong>Investimento por dia:</strong> Média de quanto é gasto diariamente nas campanhas.
          </p>
          <p>
            <strong>Próximo investimento:</strong> Data prevista para a próxima recarga de saldo.
          </p>
        </div>
      </Card>
    </div>
  );
}