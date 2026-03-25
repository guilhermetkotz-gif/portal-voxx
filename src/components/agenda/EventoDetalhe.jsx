import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Building2, Users, Target, Edit2, CheckCircle, XCircle, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG = {
  agendada:     { label: 'Agendada',       color: 'bg-blue-100 text-blue-700' },
  realizada:    { label: 'Realizada',      color: 'bg-green-100 text-green-700' },
  nao_realizada:{ label: 'Não realizada',  color: 'bg-red-100 text-red-700' },
  cancelada:    { label: 'Cancelada',      color: 'bg-slate-100 text-slate-600' },
};

const TIPOS_LABEL = {
  comercial: 'Comercial', onboarding: 'Onboarding', alinhamento: 'Alinhamento',
  resultados: 'Resultados', estrategico: 'Estratégico', operacional: 'Operacional', retencao: 'Retenção',
};

export default function EventoDetalhe({ reuniao, open, onClose, onEdit, onStatusChange }) {
  const [loading, setLoading] = useState(false);

  const changeStatus = async (status) => {
    setLoading(true);
    await base44.entities.AgendaReuniao.update(reuniao.id, { status });
    setLoading(false);
    onStatusChange();
  };

  if (!reuniao) return null;

  const start = new Date(reuniao.start_datetime);
  const end = new Date(reuniao.end_datetime);
  const statusCfg = STATUS_CONFIG[reuniao.status] || STATUS_CONFIG.agendada;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-xs text-slate-500 mb-1">{TIPOS_LABEL[reuniao.tipo_reuniao] || reuniao.tipo_reuniao}</p>
              <DialogTitle className="text-lg leading-snug">{reuniao.titulo}</DialogTitle>
            </div>
            <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>{format(start, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>{format(start, 'HH:mm')} – {format(end, 'HH:mm')}</span>
          </div>
          {reuniao.unidade_nome && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>{reuniao.unidade_nome}</span>
            </div>
          )}
          {reuniao.participantes_nomes?.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <Users className="w-4 h-4 text-slate-400 mt-0.5" />
              <span>{reuniao.participantes_nomes.join(', ')}</span>
            </div>
          )}
          {reuniao.objetivo && (
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <Target className="w-4 h-4 text-slate-400 mt-0.5" />
              <span>{reuniao.objetivo}</span>
            </div>
          )}
          {reuniao.observacoes && (
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
              {reuniao.observacoes}
            </div>
          )}
        </div>

        {/* Ações rápidas de status */}
        {reuniao.status === 'agendada' && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ação rápida</p>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => changeStatus('realizada')} disabled={loading}>
                <CheckCircle className="w-3.5 h-3.5" /> Realizada
              </Button>
              <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => changeStatus('nao_realizada')} disabled={loading}>
                <XCircle className="w-3.5 h-3.5" /> Não realizada
              </Button>
              <Button size="sm" variant="outline" className="text-slate-500" onClick={() => changeStatus('cancelada')} disabled={loading}>
                <X className="w-3.5 h-3.5" /> Cancelar
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-1 border-t">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit2 className="w-3.5 h-3.5" /> Editar reunião
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}