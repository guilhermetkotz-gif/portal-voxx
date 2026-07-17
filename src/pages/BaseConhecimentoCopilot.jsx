import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Plus, BrainCircuit, Lock, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useConhecimentoCopilot } from '@/hooks/useConhecimentoCopilot';
import IndicadoresCards from '@/components/copilot-kb/IndicadoresCards';
import FiltrosBar, { FILTROS_INICIAIS, filtrarOrientacoes, hasFiltrosAtivos } from '@/components/copilot-kb/FiltrosBar';
import OrientacaoTable from '@/components/copilot-kb/OrientacaoTable';
import OrientacaoFormModal from '@/components/copilot-kb/OrientacaoFormModal';
import OrientacaoDetalheModal from '@/components/copilot-kb/OrientacaoDetalheModal';
import HistoricoModal from '@/components/copilot-kb/HistoricoModal';
import ConflitoModal from '@/components/copilot-kb/ConflitoModal';

export default function BaseConhecimentoCopilot({ user }) {
  const { permissoes, loadingAccess, denied, orientacoes, loadingOrientacoes, error, refetch, loadingAcao, executarAcao } = useConhecimentoCopilot(user);

  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [formModal, setFormModal] = useState({ open: false, edit: null });
  const [detalheModal, setDetalheModal] = useState({ open: false, orientacao: null });
  const [historicoModal, setHistoricoModal] = useState({ open: false, orientacaoId: null });
  const [conflitoState, setConflitoState] = useState({ open: false, conflitanteId: null, dados: null });
  const [confirmToggle, setConfirmToggle] = useState({ open: false, orientacao: null, acao: null });

  // ── Auth gates ──
  if (loadingAccess) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (denied) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-slate-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Acesso restrito</h2>
        <p className="text-sm text-slate-500 max-w-sm">Você não possui permissão para acessar a Base de Conhecimento do Copilot. Contate o administrador se necessário.</p>
      </div>
    );
  }

  const canCreate = permissoes?.pode_criar;
  const orientacoesFiltradas = filtrarOrientacoes(orientacoes, filtros);
  const filtrosAtivos = hasFiltrosAtivos(filtros);

  // ── Handlers ──
  const handleConflito = (dados, conflitanteId) => {
    setConflitoState({ open: true, conflitanteId, dados });
  };

  const handleSubstituir = async (motivo) => {
    try {
      await executarAcao('substituir', {
        orientacao_substituida_id: conflitoState.conflitanteId,
        dados: conflitoState.dados,
        motivo,
      });
      toast.success('Orientação substituída com sucesso.');
      setConflitoState({ open: false, conflitanteId: null, dados: null });
      setFormModal({ open: false, edit: null });
    } catch (err) {
      toast.error(err.message || 'Não foi possível substituir a orientação.');
    }
  };

  const handleConfirmToggle = async () => {
    const { orientacao, acao } = confirmToggle;
    try {
      await executarAcao(acao, {
        orientacao_id: orientacao.id,
        motivo: acao === 'ativar' ? 'Ativação manual' : 'Desativação manual',
      });
      toast.success(`Orientação ${acao === 'ativar' ? 'ativada' : 'desativada'} com sucesso.`);
      setConfirmToggle({ open: false, orientacao: null, acao: null });
    } catch (err) {
      if (err.conflito) {
        toast.error('Não é possível ativar: existe outra orientação ativa em conflito com a mesma chave temática, categoria, escopo e prioridade.');
      } else {
        toast.error(err.message || `Não foi possível ${acao === 'ativar' ? 'ativar' : 'desativar'} a orientação.`);
      }
      setConfirmToggle({ open: false, orientacao: null, acao: null });
    }
  };

  const handleRestaurar = async (orientacaoId, versaoId, motivo) => {
    try {
      await executarAcao('restaurar', { orientacao_id: orientacaoId, versao_id: versaoId, motivo });
      toast.success('Versão restaurada com sucesso.');
      setHistoricoModal({ open: false, orientacaoId: null });
    } catch (err) {
      if (err.conflito) {
        toast.error('Não é possível restaurar: existe outra orientação ativa em conflito.');
        setHistoricoModal({ open: false, orientacaoId: null });
      } else {
        toast.error(err.message || 'Não foi possível restaurar a versão.');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Base de Conhecimento do Copilot</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie as orientações utilizadas pelo Copilot nas respostas do Radar WhatsApp.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setFormModal({ open: true, edit: null })} className="gap-1.5 bg-violet-600 hover:bg-violet-700">
            <Plus className="w-4 h-4" /> Nova orientação
          </Button>
        )}
      </div>

      {/* Indicadores */}
      {!loadingOrientacoes && !error && orientacoes.length > 0 && (
        <IndicadoresCards orientacoes={orientacoes} />
      )}

      {/* Filtros */}
      {orientacoes.length > 0 && (
        <FiltrosBar filtros={filtros} setFiltros={setFiltros} />
      )}

      {/* Content */}
      {loadingOrientacoes ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      ) : error ? (
        <Card className="p-8 text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Não foi possível carregar a base de conhecimento.</h2>
          <p className="text-sm text-slate-500 mb-4">Verifique sua conexão e tente novamente.</p>
          <Button variant="outline" onClick={refetch} className="gap-1.5">
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </Button>
        </Card>
      ) : orientacoes.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-14 h-14 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <BrainCircuit className="w-7 h-7 text-violet-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Nenhuma orientação cadastrada</h2>
          <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">Crie a primeira orientação para começar a estruturar a base de conhecimento do Copilot.</p>
          {canCreate && (
            <Button onClick={() => setFormModal({ open: true, edit: null })} className="gap-1.5 bg-violet-600 hover:bg-violet-700">
              <Plus className="w-4 h-4" /> Criar primeira orientação
            </Button>
          )}
        </Card>
      ) : orientacoesFiltradas.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-500">Nenhum resultado encontrado com os filtros aplicados.</p>
          {filtrosAtivos && (
            <Button variant="outline" size="sm" onClick={() => setFiltros(FILTROS_INICIAIS)} className="mt-3">
              Limpar filtros
            </Button>
          )}
        </Card>
      ) : (
        <OrientacaoTable
          orientacoes={orientacoesFiltradas}
          permissoes={permissoes}
          onEditar={(o) => setFormModal({ open: true, edit: o })}
          onDetalhe={(o) => setDetalheModal({ open: true, orientacao: o })}
          onHistorico={(id) => setHistoricoModal({ open: true, orientacaoId: id })}
          onAtivar={(o) => setConfirmToggle({ open: true, orientacao: o, acao: 'ativar' })}
          onDesativar={(o) => setConfirmToggle({ open: true, orientacao: o, acao: 'desativar' })}
          loadingAcao={loadingAcao}
        />
      )}

      {/* Form Modal */}
      <OrientacaoFormModal
        open={formModal.open}
        onClose={() => setFormModal({ open: false, edit: null })}
        orientacaoEdit={formModal.edit}
        permissoes={permissoes}
        executarAcao={executarAcao}
        onConflito={handleConflito}
      />

      {/* Detail Modal */}
      <OrientacaoDetalheModal
        open={detalheModal.open}
        onClose={() => setDetalheModal({ open: false, orientacao: null })}
        orientacao={detalheModal.orientacao}
      />

      {/* History Modal */}
      <HistoricoModal
        open={historicoModal.open}
        onClose={() => setHistoricoModal({ open: false, orientacaoId: null })}
        orientacaoId={historicoModal.orientacaoId}
        permissoes={permissoes}
        onRestaurar={handleRestaurar}
        loadingAcao={loadingAcao}
      />

      {/* Conflict Modal */}
      <ConflitoModal
        open={conflitoState.open}
        onClose={() => setConflitoState({ open: false, conflitanteId: null, dados: null })}
        conflitanteId={conflitoState.conflitanteId}
        onSubstituir={handleSubstituir}
        loadingAcao={loadingAcao}
      />

      {/* Confirm Toggle Dialog */}
      {confirmToggle.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmToggle({ open: false, orientacao: null, acao: null })}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {confirmToggle.acao === 'ativar' ? 'Ativar orientação' : 'Desativar orientação'}
              </h3>
              <p className="text-sm text-slate-500 mt-2">
                {confirmToggle.acao === 'desativar'
                  ? 'Esta orientação deixará de ser utilizada pelo Copilot, mas seu histórico será preservado.'
                  : 'O Copilot voltará a utilizar esta orientação. O sistema verificará novamente permissões, escopo, categoria e conflitos antes da ativação.'}
              </p>
              <p className="text-xs text-slate-400 mt-2 font-medium truncate">{confirmToggle.orientacao.titulo}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmToggle({ open: false, orientacao: null, acao: null })}>Cancelar</Button>
              <Button
                onClick={handleConfirmToggle}
                disabled={loadingAcao}
                className={confirmToggle.acao === 'ativar' ? 'bg-emerald-600 hover:bg-emerald-700 gap-1.5' : 'bg-rose-600 hover:bg-rose-700 gap-1.5'}
              >
                {loadingAcao && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirmToggle.acao === 'ativar' ? 'Confirmar ativação' : 'Confirmar desativação'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}