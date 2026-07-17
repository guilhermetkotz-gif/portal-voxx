import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Eye, History, Power, PowerOff } from 'lucide-react';
import { labelCategoria, labelTipoOrientacao, escopoAlvoText, badgeEscopoVariant } from './constants';
import { cn } from '@/lib/utils';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

export default function OrientacaoTable({ orientacoes, permissoes, onEditar, onDetalhe, onHistorico, onAtivar, onDesativar, loadingAcao }) {
  if (orientacoes.length === 0) return null;

  const canEdit = permissoes?.pode_editar;
  const canToggle = permissoes?.pode_ativar_desativar;
  const canHistory = permissoes?.pode_visualizar_historico;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              <th className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Título</th>
              <th className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Categoria</th>
              <th className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Tipo</th>
              <th className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Escopo</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-center whitespace-nowrap">Prio.</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-center whitespace-nowrap">Flags</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-center whitespace-nowrap">Status</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-center whitespace-nowrap">Versão</th>
              <th className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Atualização</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-center whitespace-nowrap">Ações</th>
            </tr>
          </thead>
          <tbody>
            {orientacoes.map(o => (
              <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3">
                  <button onClick={() => onDetalhe(o)} className="text-left">
                    <p className="font-medium text-slate-900 hover:text-violet-600 line-clamp-1">{o.titulo}</p>
                    {o.substituiu_orientacao_id && (
                      <span className="text-[10px] text-violet-500">Substituiu orientação anterior</span>
                    )}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{labelCategoria(o.categoria)}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{labelTipoOrientacao(o.tipo_orientacao)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={cn('text-[10px] py-0 px-1.5', badgeEscopoVariant(o.escopo_tipo))}>
                      {o.escopo_tipo}
                    </Badge>
                    <span className="text-xs text-slate-600 truncate max-w-[120px]">{escopoAlvoText(o)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center font-medium text-slate-700">{o.prioridade || 5}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    {o.obrigatoria && <Badge className="bg-rose-100 text-rose-700 text-[9px] py-0 px-1.5">Obrig.</Badge>}
                    {o.exige_verificacao && <Badge className="bg-amber-100 text-amber-700 text-[9px] py-0 px-1.5">Verif.</Badge>}
                    {o.tipo_orientacao === 'revisao_obrigatoria' && <Badge className="bg-red-100 text-red-700 text-[9px] py-0 px-1.5">Revisão</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge className={cn('text-[10px] py-0 px-1.5', o.ativa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                    {o.ativa ? 'Ativa' : 'Inativa'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center text-slate-500 text-xs">v{o.versao_atual || 1}</td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(o.updated_date)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDetalhe(o)} title="Visualizar">
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    {canHistory && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onHistorico(o.id)} title="Histórico">
                        <History className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditar(o)} title="Editar">
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {canToggle && o.ativa && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-rose-600" onClick={() => onDesativar(o)} title="Desativar" disabled={loadingAcao}>
                        <PowerOff className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {canToggle && !o.ativa && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-emerald-600" onClick={() => onAtivar(o)} title="Ativar" disabled={loadingAcao}>
                        <Power className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}