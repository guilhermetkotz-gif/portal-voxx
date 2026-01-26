import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import moment from 'moment';
import { toast } from 'sonner';

const ITENS_CHECKLIST = [
  { id: 'revisar_criticas', label: 'Revisei todas as contas críticas' },
  { id: 'top3_prioridades', label: 'Apliquei ações nas top 3 prioridades' },
  { id: 'atualizar_status', label: 'Atualizei status das unidades trabalhadas' },
  { id: 'registrar_acoes', label: 'Registrei as ações executadas' },
  { id: 'verificar_saturacao', label: 'Verifiquei contas com saturação alta' }
];

export default function ChecklistRotina({ user }) {
  const queryClient = useQueryClient();
  const hoje = moment().format('YYYY-MM-DD');

  const { data: checklistHoje } = useQuery({
    queryKey: ['checklistHoje', user?.id, hoje],
    queryFn: async () => {
      const checklists = await base44.entities.GamificacaoChecklist.filter({
        analista_id: user?.id,
        data: hoje
      });
      return checklists[0];
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000
  });

  const [itensConcluidos, setItensConcluidos] = useState([]);

  useEffect(() => {
    if (checklistHoje?.itens_concluidos) {
      setItensConcluidos(checklistHoje.itens_concluidos);
    }
  }, [checklistHoje]);

  const atualizarChecklistMutation = useMutation({
    mutationFn: async (novosItens) => {
      const completo = novosItens.length === ITENS_CHECKLIST.length;
      const pontos_bonus = completo ? 20 : 0;

      if (checklistHoje) {
        await base44.entities.GamificacaoChecklist.update(checklistHoje.id, {
          itens_concluidos: novosItens,
          completo,
          pontos_bonus
        });
      } else {
        await base44.entities.GamificacaoChecklist.create({
          analista_id: user?.id,
          data: hoje,
          itens_concluidos: novosItens,
          completo,
          pontos_bonus
        });
      }

      if (completo && (!checklistHoje || !checklistHoje.completo)) {
        await atualizarProgresso(pontos_bonus);
        toast.success('Checklist 100% completo! +20 pontos bônus', {
          icon: '🎉'
        });
      }

      return pontos_bonus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklistHoje'] });
      queryClient.invalidateQueries({ queryKey: ['progressoGamificacao'] });
    }
  });

  const atualizarProgresso = async (pontos_bonus) => {
    const progressos = await base44.entities.GamificacaoProgresso.filter({
      analista_id: user?.id
    });

    const progresso = progressos[0];
    if (progresso) {
      await base44.entities.GamificacaoProgresso.update(progresso.id, {
        pontos_dia: progresso.pontos_dia + pontos_bonus,
        pontos_semana: progresso.pontos_semana + pontos_bonus,
        pontos_mes: progresso.pontos_mes + pontos_bonus,
        pontos_total: progresso.pontos_total + pontos_bonus,
        checklist_completo_dias: progresso.checklist_completo_dias + 1
      });
    }
  };

  const toggleItem = (itemId) => {
    const novosItens = itensConcluidos.includes(itemId)
      ? itensConcluidos.filter(id => id !== itemId)
      : [...itensConcluidos, itemId];
    
    setItensConcluidos(novosItens);
    atualizarChecklistMutation.mutate(novosItens);
  };

  const progresso = (itensConcluidos.length / ITENS_CHECKLIST.length) * 100;
  const completo = itensConcluidos.length === ITENS_CHECKLIST.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-violet-600" />
            Checklist de Rotina
          </CardTitle>
          <div className="text-right">
            <p className="text-2xl font-bold text-violet-600">{itensConcluidos.length}/{ITENS_CHECKLIST.length}</p>
            <p className="text-xs text-slate-500">itens</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className={cn(
                "h-2 rounded-full transition-all duration-500",
                completo ? "bg-green-500" : "bg-violet-600"
              )}
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {ITENS_CHECKLIST.map((item) => {
            const concluido = itensConcluidos.includes(item.id);
            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-all",
                  concluido ? "bg-green-50 border border-green-200" : "bg-slate-50 border border-slate-200"
                )}
              >
                <Checkbox
                  checked={concluido}
                  onCheckedChange={() => toggleItem(item.id)}
                  className={cn(
                    concluido && "border-green-600 bg-green-600"
                  )}
                />
                <label
                  className={cn(
                    "text-sm flex-1 cursor-pointer",
                    concluido ? "text-green-900 line-through" : "text-slate-700"
                  )}
                  onClick={() => toggleItem(item.id)}
                >
                  {item.label}
                </label>
                {concluido && (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                )}
              </div>
            );
          })}
        </div>

        {completo && (
          <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg text-center">
            <p className="text-sm font-semibold text-green-900">
              🎉 Checklist 100% completo! Bônus de +20 pontos!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}