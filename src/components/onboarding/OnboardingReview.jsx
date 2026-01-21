import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

export default function OnboardingReview({ cliente, data, onNext }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onNext({});
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm text-green-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Revise todas as informações antes de finalizar o onboarding.
        </p>
      </div>

      {/* Resumo Informações */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-semibold">Informações Básicas</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Nome:</span>
            <p className="font-medium">{data.clienteInfo?.nome || cliente.nome}</p>
          </div>
          <div>
            <span className="text-slate-500">Cidade:</span>
            <p className="font-medium">{data.clienteInfo?.cidade || cliente.cidade}</p>
          </div>
          <div>
            <span className="text-slate-500">Estado:</span>
            <p className="font-medium">{data.clienteInfo?.estado || cliente.estado}</p>
          </div>
          <div>
            <span className="text-slate-500">Status:</span>
            <p className="font-medium capitalize">{cliente.status}</p>
          </div>
        </div>
      </div>

      {/* Resumo Contas */}
      {data.contas && data.contas.length > 0 && (
        <div className="border rounded-lg p-4 space-y-3">
          <h4 className="font-semibold">Contas de Anúncio</h4>
          <div className="space-y-2">
            {data.contas.map((conta, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm bg-slate-50 p-2 rounded">
                <span>{conta.conta_nome} ({conta.plataforma})</span>
                {conta.conta_principal && <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Principal</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resumo Planejamento */}
      {data.planejamento && Object.keys(data.planejamento).length > 0 && (
        <div className="border rounded-lg p-4 space-y-3">
          <h4 className="font-semibold">Planejamento Estratégico</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {data.planejamento.meta_faturamento && (
              <div>
                <span className="text-slate-500">Meta Faturamento:</span>
                <p className="font-medium">R$ {parseFloat(data.planejamento.meta_faturamento).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            )}
            {data.planejamento.cpl_planejado && (
              <div>
                <span className="text-slate-500">CPL Planejado:</span>
                <p className="font-medium">R$ {parseFloat(data.planejamento.cpl_planejado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resumo Contatos */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-semibold">Contatos</h4>
        <div className="space-y-2 text-sm">
          {data.contatos?.responsavel_cliente_nome && (
            <div>
              <span className="text-slate-500">Responsável Cliente:</span>
              <p className="font-medium">{data.contatos.responsavel_cliente_nome}</p>
            </div>
          )}
          {data.contatos?.responsavel_voxx_cs && (
            <div>
              <span className="text-slate-500">Responsável CS Voxx:</span>
              <p className="font-medium">{data.contatos.responsavel_voxx_cs}</p>
            </div>
          )}
          {data.contatos?.responsavel_voxx_trafego && (
            <div>
              <span className="text-slate-500">Responsável Tráfego Voxx:</span>
              <p className="font-medium">{data.contatos.responsavel_voxx_trafego}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <p className="text-sm text-slate-700">
          ✓ Após finalizar, o cliente será criado com todas as configurações. Você poderá editar mais tarde se necessário.
        </p>
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" className="bg-green-600 hover:bg-green-700">
          Finalizar Onboarding
        </Button>
      </div>
    </form>
  );
}