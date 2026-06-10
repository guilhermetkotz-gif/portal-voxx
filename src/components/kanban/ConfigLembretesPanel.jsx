import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, X, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const SETORES_DISPONIVEIS = [
  'ATENDIMENTO', 'TRAFEGO_META', 'TRAFEGO_GOOGLE', 'TRAFEGO_TIKTOK',
  'CRIACAO', 'EDICAO', 'BI_RELATORIO', 'IMPLANTACAO',
  'FINANCEIRO', 'ALTERACAO_CRIACAO', 'AUTOMACAO', 'SALDOS',
];

export default function ConfigLembretesPanel({ onClose }) {
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['configLembreteAprovacao'],
    queryFn: () => base44.entities.ConfiguracaoLembreteAprovacao.list('-created_date', 1),
  });

  const config = configs[0] || null;

  const [ativo, setAtivo] = useState(config?.ativo ?? true);
  const [intervalos, setIntervalos] = useState(
    (config?.intervalos_horas_uteis || [24, 48]).map(String)
  );
  const [mensagens, setMensagens] = useState(
    config?.mensagens_lembrete?.length > 0
      ? config.mensagens_lembrete
      : [
          'Olá {{cliente}}! 👋\n\nPassando para lembrar que enviamos a entrega *"{{entrega}}"* para sua aprovação.\n\n📎 Link para aprovar: {{link}}\n\nQualquer dúvida, estamos à disposição!',
          '*{{cliente}}*, tudo bem?\n\nAinda não recebemos sua aprovação para a entrega *"{{entrega}}"*.\n\nSabemos que a rotina é corrida, mas sua aprovação é importante para darmos continuidade ao projeto.\n\n📎 Aprove aqui: {{link}}\n\nPrecisa de algum ajuste? É só nos avisar!',
        ]
  );
  const [setores, setSetores] = useState(config?.setores_ativos || []);
  const [maxAuto, setMaxAuto] = useState(String(config?.max_mensagens_automaticas ?? 2));
  const [saving, setSaving] = useState(false);

  // Sincroniza state quando o config carrega
  React.useEffect(() => {
    if (config) {
      setAtivo(config.ativo !== false);
      setIntervalos((config.intervalos_horas_uteis || [24, 48]).map(String));
      setMensagens(config.mensagens_lembrete?.length > 0 ? config.mensagens_lembrete : mensagens);
      setSetores(config.setores_ativos || []);
      setMaxAuto(String(config.max_mensagens_automaticas ?? 2));
    }
  }, [config?.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        ativo,
        intervalos_horas_uteis: intervalos.filter(Boolean).map(Number).filter(n => n > 0),
        mensagens_lembrete: mensagens.filter(m => m.trim()),
        setores_ativos: setores,
        max_mensagens_automaticas: parseInt(maxAuto) || 2,
      };

      if (config?.id) {
        await base44.entities.ConfiguracaoLembreteAprovacao.update(config.id, data);
      } else {
        await base44.entities.ConfiguracaoLembreteAprovacao.create(data);
      }

      queryClient.invalidateQueries({ queryKey: ['configLembreteAprovacao'] });
      toast.success('Configuração salva com sucesso!');
    } catch (e) {
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const addIntervalo = () => setIntervalos([...intervalos, '24']);
  const removeIntervalo = (i) => setIntervalos(intervalos.filter((_, idx) => idx !== i));
  const updateIntervalo = (i, v) => {
    const copy = [...intervalos];
    copy[i] = v;
    setIntervalos(copy);
  };

  const addMensagem = () => setMensagens([...mensagens, '']);
  const removeMensagem = (i) => setMensagens(mensagens.filter((_, idx) => idx !== i));
  const updateMensagem = (i, v) => {
    const copy = [...mensagens];
    copy[i] = v;
    setMensagens(copy);
  };

  const toggleSetor = (s) => {
    setSetores(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="border-t mt-4 pt-4 px-6 pb-6 space-y-5">
      {/* Ativo */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Automação ativa</Label>
        <Switch checked={ativo} onCheckedChange={setAtivo} />
      </div>

      {/* Intervalos */}
      <div>
        <Label className="text-sm font-medium mb-2 block">
          Intervalos entre lembretes (horas úteis)
        </Label>
        <p className="text-xs text-slate-500 mb-2">
          O último intervalo define quando entra em intervenção humana após o último lembrete automático.
        </p>
        <div className="space-y-2">
          {intervalos.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <Badge variant="outline" className="shrink-0 w-16 justify-center text-xs">
                {i + 1}º
              </Badge>
              <Input
                type="number"
                min="1"
                value={v}
                onChange={(e) => updateIntervalo(i, e.target.value)}
                className="h-8 w-24 text-sm"
              />
              <span className="text-xs text-slate-500">h úteis</span>
              {intervalos.length > 1 && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeIntervalo(i)}>
                  <Trash2 className="h-3 w-3 text-red-400" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={addIntervalo} className="text-xs gap-1">
            <Plus className="h-3 w-3" /> Adicionar intervalo
          </Button>
        </div>
      </div>

      {/* Máximo de mensagens automáticas */}
      <div>
        <Label className="text-sm font-medium mb-2 block">
          Máximo de mensagens automáticas
        </Label>
        <p className="text-xs text-slate-500 mb-2">
          Após este número de lembretes automáticos, o sistema abre um card de intervenção humana no Kanban.
        </p>
        <Input
          type="number"
          min="1"
          max="10"
          value={maxAuto}
          onChange={(e) => setMaxAuto(e.target.value)}
          className="h-8 w-24 text-sm"
        />
      </div>

      {/* Mensagens */}
      <div>
        <Label className="text-sm font-medium mb-2 block">
          Templates de mensagem
        </Label>
        <p className="text-xs text-slate-500 mb-2">
          Use <code className="bg-slate-100 px-1 rounded text-xs">{"{{cliente}}"}</code>,{" "}
          <code className="bg-slate-100 px-1 rounded text-xs">{"{{entrega}}"}</code> e{" "}
          <code className="bg-slate-100 px-1 rounded text-xs">{"{{link}}"}</code> como placeholders.
        </p>
        <div className="space-y-2">
          {mensagens.map((m, i) => (
            <div key={i} className="flex items-start gap-2">
              <Badge variant="outline" className="shrink-0 w-16 justify-center text-xs mt-2">
                {i + 1}º
              </Badge>
              <textarea
                value={m}
                onChange={(e) => updateMensagem(i, e.target.value)}
                rows={3}
                className="flex-1 text-xs border rounded-md p-2 resize-y bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
              {mensagens.length > 1 && (
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 mt-1" onClick={() => removeMensagem(i)}>
                  <Trash2 className="h-3 w-3 text-red-400" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={addMensagem} className="text-xs gap-1">
            <Plus className="h-3 w-3" /> Adicionar mensagem
          </Button>
        </div>
      </div>

      {/* Setores */}
      <div>
        <Label className="text-sm font-medium mb-2 block">
          Setores com automação
        </Label>
        <p className="text-xs text-slate-500 mb-2">
          Selecione os setores que recebem lembretes. Vazio = todos os setores.
        </p>
        <div className="flex flex-wrap gap-2">
          {SETORES_DISPONIVEIS.map(s => (
            <Badge
              key={s}
              variant={setores.includes(s) ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => toggleSetor(s)}
            >
              {s.replace(/_/g, ' ')}
            </Badge>
          ))}
        </div>
      </div>

      {/* Botões */}
      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} disabled={saving} className="gap-2" size="sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configuração
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1">
          <X className="h-4 w-4" /> Fechar
        </Button>
      </div>
    </div>
  );
}