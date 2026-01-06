import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Building2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AguardandoAprovacao({ user }) {
  const { data: solicitacoes = [] } = useQuery({
    queryKey: ['minhasSolicitacoes', user?.id],
    queryFn: () => base44.entities.AccessRequest.filter({ usuario_id: user?.id }, '-created_date'),
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000 // Poll every 30 seconds
  });

  const solicitacaoPendente = solicitacoes.find(s => s.status === 'pendente');
  const solicitacoesAnteriores = solicitacoes.filter(s => s.status !== 'pendente');

  const statusConfig = {
    pendente: {
      icon: Clock,
      color: 'bg-amber-100 text-amber-700 border-amber-200',
      label: 'Em análise'
    },
    aprovado: {
      icon: CheckCircle,
      color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      label: 'Aprovado'
    },
    aprovado_parcial: {
      icon: CheckCircle,
      color: 'bg-blue-100 text-blue-700 border-blue-200',
      label: 'Aprovado Parcialmente'
    },
    rejeitado: {
      icon: XCircle,
      color: 'bg-red-100 text-red-700 border-red-200',
      label: 'Rejeitado'
    }
  };

  const handleLogout = () => {
    base44.auth.logout('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-4">
        {/* Main Card */}
        <Card className="p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-amber-600 animate-pulse" />
          </div>
          
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Aguardando Aprovação</h1>
          <p className="text-slate-600 mb-6">
            Sua solicitação de acesso foi enviada e está em análise pela equipe Voxx.
            Assim que for aprovada, você terá acesso completo ao portal.
          </p>

          {solicitacaoPendente && (
            <div className="bg-slate-50 rounded-lg p-6 text-left space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Solicitação enviada</p>
                  <p className="text-xs text-slate-400">
                    {formatDistanceToNow(new Date(solicitacaoPendente.created_date), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </p>
                </div>
                <Badge className={statusConfig.pendente.color}>
                  Em análise
                </Badge>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Unidades solicitadas:</p>
                <div className="space-y-2">
                  {solicitacaoPendente.contas_solicitadas_nomes?.map((nome, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-slate-600">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      {nome}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Função:</p>
                <p className="text-sm text-slate-600">{solicitacaoPendente.motivo}</p>
              </div>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-sm text-slate-600 mb-4">
              ⏰ Tempo médio de aprovação: <strong>até 24 horas úteis</strong>
            </p>
            <Button variant="outline" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </Card>

        {/* Histórico */}
        {solicitacoesAnteriores.length > 0 && (
          <Card className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Histórico de Solicitações</h3>
            <div className="space-y-3">
              {solicitacoesAnteriores.map(sol => {
                const config = statusConfig[sol.status];
                const Icon = config.icon;

                return (
                  <div key={sol.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <Icon className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={config.color} size="sm">
                          {config.label}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {formatDistanceToNow(new Date(sol.decidido_em || sol.created_date), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">
                        {sol.contas_solicitadas_nomes?.length || 0} conta(s) solicitada(s)
                      </p>
                      {sol.observacao_admin && (
                        <p className="text-xs text-slate-500 mt-1">
                          <strong>Observação:</strong> {sol.observacao_admin}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Contato */}
        <Card className="p-4 bg-violet-50 border-violet-200">
          <p className="text-sm text-slate-700 text-center">
            💬 Dúvidas? Entre em contato: <strong>contato@voxxmarketing.com.br</strong>
          </p>
        </Card>
      </div>
    </div>
  );
}