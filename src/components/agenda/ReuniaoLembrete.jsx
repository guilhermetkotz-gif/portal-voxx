import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { parseISO, differenceInMinutes, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, Calendar, Clock, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EventoDetalhe from '@/components/agenda/EventoDetalhe';

const SHOWN_KEY = 'voxx_reuniao_lembretes_shown';

function getShownSet() {
  try { return new Set(JSON.parse(localStorage.getItem(SHOWN_KEY) || '[]')); }
  catch { return new Set(); }
}

function markShown(key) {
  const set = getShownSet();
  const now = Date.now();
  // Limpar entradas antigas (mais de 48h)
  const cleaned = [...set].filter(k => {
    const ts = parseInt(k.split('_ts_')[1] || '0');
    return now - ts < 48 * 60 * 60 * 1000;
  });
  cleaned.push(key);
  localStorage.setItem(SHOWN_KEY, JSON.stringify([...new Set(cleaned)]));
}

function wasShown(key) {
  return getShownSet().has(key);
}

const STATUS_INVALIDOS = ['cancelada', 'realizada', 'nao_realizada', 'reagendada'];

export default function ReuniaoLembrete({ user }) {
  const queryClient = useQueryClient();
  const [alertas, setAlertas] = useState([]); // [{reuniao, tipo: '1h'|'5min'|'15min_after', key}]
  const [detalheReuniao, setDetalheReuniao] = useState(null);

  const { data: reunioes = [] } = useQuery({
    queryKey: ['reunioes_lembretes_global'],
    queryFn: () => base44.entities.AgendaReuniao.list('-start_datetime', 200),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id || reunioes.length === 0) return;

    const check = () => {
      const now = new Date();
      const novosAlertas = [];

      reunioes.forEach(r => {
        if (!r.participantes_ids?.includes(user.id)) return;

        let start;
        try { start = parseISO(r.start_datetime); } catch { return; }

        const diff = differenceInMinutes(start, now); // positivo = futuro, negativo = passado

        // --- 1 hora antes ---
        if (!STATUS_INVALIDOS.includes(r.status) && diff >= 55 && diff <= 65) {
          const key = `${r.id}_1h_ts_${Math.floor(now.getTime() / (60 * 60 * 1000))}`;
          if (!wasShown(key)) novosAlertas.push({ reuniao: r, tipo: '1h', key });
        }

        // --- 5 minutos antes ---
        if (!STATUS_INVALIDOS.includes(r.status) && diff >= 2 && diff <= 7) {
          const key = `${r.id}_5min_ts_${Math.floor(now.getTime() / (60 * 60 * 1000))}`;
          if (!wasShown(key)) novosAlertas.push({ reuniao: r, tipo: '5min', key });
        }

        // --- 15 minutos após o início ---
        // diff negativo entre -13 e -20 = passou entre 13 e 20 min
        // só para reuniões ainda agendadas (não atualizadas)
        const statusPermitidos15 = ['agendada', 'confirmada'];
        if (statusPermitidos15.includes(r.status) && diff <= -13 && diff >= -20) {
          const key = `${r.id}_15after_ts_${Math.floor(start.getTime() / (60 * 60 * 1000))}`;
          if (!wasShown(key)) novosAlertas.push({ reuniao: r, tipo: '15min_after', key });
        }
      });

      if (novosAlertas.length > 0) {
        setAlertas(prev => {
          const existingKeys = new Set(prev.map(a => a.key));
          const newOnes = novosAlertas.filter(a => !existingKeys.has(a.key));
          return [...prev, ...newOnes];
        });
      }
    };

    check();
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
  }, [reunioes, user?.id]);

  const dismiss = (key) => {
    markShown(key);
    setAlertas(prev => prev.filter(a => a.key !== key));
  };

  const openReuniao = (reuniao, key) => {
    dismiss(key);
    setDetalheReuniao(reuniao);
  };

  const enviarLink = (reuniao, key) => {
    const link = reuniao.local_link || '';
    if (link.startsWith('http')) {
      window.open(link, '_blank');
    } else {
      openReuniao(reuniao, key);
      return;
    }
    dismiss(key);
  };

  const handleDetalheClose = () => {
    setDetalheReuniao(null);
    queryClient.invalidateQueries({ queryKey: ['reunioes_lembretes_global'] });
  };

  if (alertas.length === 0 && !detalheReuniao) return null;

  return (
    <>
      {/* Popup de detalhes/formulário */}
      {detalheReuniao && (
        <EventoDetalhe
          reuniao={detalheReuniao}
          open={!!detalheReuniao}
          onClose={handleDetalheClose}
          onEdit={() => {}}
          onStatusChange={handleDetalheClose}
        />
      )}

      {/* Popups de lembrete */}
      <div className="fixed bottom-4 right-4 z-[9998] space-y-3 max-w-sm w-full">
        {alertas.map(({ reuniao, tipo, key }) => {
          const start = parseISO(reuniao.start_datetime);
          const horario = format(start, "HH:mm", { locale: ptBR });
          const is1h = tipo === '1h';
          const is5min = tipo === '5min';
          const is15after = tipo === '15min_after';

          if (is15after) {
            return (
              <div
                key={key}
                className="bg-white rounded-2xl shadow-2xl border-l-4 border-amber-500 p-4 animate-in slide-in-from-right-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-600">
                      ⚠️ Atualize o status
                    </p>
                  </div>
                  <button onClick={() => dismiss(key)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mb-3">
                  <p className="text-sm font-semibold text-slate-800 leading-tight">{reuniao.titulo}</p>
                  {reuniao.unidade_nome && (
                    <p className="text-xs text-slate-500 mt-0.5">{reuniao.unidade_nome}</p>
                  )}
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 mt-2 leading-relaxed">
                    A reunião com <strong>{reuniao.unidade_nome || 'o cliente'}</strong> já deveria ter acontecido. Atualize agora o status da reunião.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => openReuniao(reuniao, key)}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Realizada
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => openReuniao(reuniao, key)}
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    Não realizada
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs"
                    onClick={() => openReuniao(reuniao, key)}
                  >
                    Ver reunião
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-slate-400"
                    onClick={() => dismiss(key)}
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            );
          }

          // Popup 1h e 5min
          return (
            <div
              key={key}
              className={`bg-white rounded-2xl shadow-2xl border-l-4 p-4 animate-in slide-in-from-right-5 ${
                is1h ? 'border-blue-500' : 'border-red-500'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${is1h ? 'bg-blue-100' : 'bg-red-100'}`}>
                    {is1h
                      ? <Clock className="w-4 h-4 text-blue-600" />
                      : <Calendar className="w-4 h-4 text-red-600" />
                    }
                  </div>
                  <p className={`text-xs font-bold uppercase tracking-wide ${is1h ? 'text-blue-600' : 'text-red-600'}`}>
                    {is1h ? '⏰ Em 1 hora' : '🚨 Em 5 minutos'}
                  </p>
                </div>
                <button onClick={() => dismiss(key)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-3">
                <p className="text-sm font-semibold text-slate-800 leading-tight">{reuniao.titulo}</p>
                {reuniao.unidade_nome && (
                  <p className="text-xs text-slate-500 mt-0.5">{reuniao.unidade_nome}</p>
                )}
                <p className="text-xs text-slate-400 mt-1">Horário: <span className="font-semibold text-slate-600">{horario}</span></p>
                {is5min && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 mt-2 leading-relaxed">
                    Faltam 5 minutos para a reunião com <strong>{reuniao.unidade_nome || 'o cliente'}</strong>. Envie o link para a reunião agora.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {is5min && (
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => enviarLink(reuniao, key)}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Enviar link
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={is1h ? 'default' : 'outline'}
                  className={`${is1h ? 'flex-1 bg-blue-600 hover:bg-blue-700 text-white' : ''} h-8 text-xs`}
                  onClick={() => openReuniao(reuniao, key)}
                >
                  Ver reunião
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => dismiss(key)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}