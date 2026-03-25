import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { parseISO, differenceInMinutes } from 'date-fns';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, Calendar, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SHOWN_KEY = 'voxx_reuniao_lembretes_shown';

function getShownSet() {
  try { return new Set(JSON.parse(localStorage.getItem(SHOWN_KEY) || '[]')); }
  catch { return new Set(); }
}

function markShown(key) {
  const set = getShownSet();
  set.add(key);
  // Limpar entradas antigas (mais de 24h) para não crescer indefinidamente
  const now = Date.now();
  const cleaned = [...set].filter(k => {
    const ts = parseInt(k.split('_ts_')[1] || '0');
    return now - ts < 24 * 60 * 60 * 1000;
  });
  cleaned.push(key);
  localStorage.setItem(SHOWN_KEY, JSON.stringify([...new Set(cleaned)]));
}

function wasShown(key) {
  return getShownSet().has(key);
}

export default function ReuniaoLembrete({ user }) {
  const [alertas, setAlertas] = useState([]); // [{reuniao, tipo: '1h'|'5min'}]

  const { data: reunioes = [] } = useQuery({
    queryKey: ['reunioes_lembretes_global'],
    queryFn: () => base44.entities.AgendaReuniao.list('-start_datetime', 200),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000, // checar a cada minuto
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id || reunioes.length === 0) return;

    const check = () => {
      const now = new Date();
      const novosAlertas = [];

      reunioes.forEach(r => {
        // Ignorar canceladas e realizadas
        if (['cancelada', 'realizada', 'nao_realizada'].includes(r.status)) return;
        // Só para participantes desta reunião
        if (!r.participantes_ids?.includes(user.id)) return;

        let start;
        try { start = parseISO(r.start_datetime); } catch { return; }

        const diff = differenceInMinutes(start, now);

        // Lembrete de 1 hora: entre 55 e 65 minutos
        if (diff >= 55 && diff <= 65) {
          const key = `${r.id}_1h_ts_${Math.floor(now.getTime() / (60 * 60 * 1000))}`;
          if (!wasShown(key)) {
            novosAlertas.push({ reuniao: r, tipo: '1h', key });
          }
        }

        // Lembrete de 5 minutos: entre 2 e 7 minutos
        if (diff >= 2 && diff <= 7) {
          const key = `${r.id}_5min_ts_${Math.floor(now.getTime() / (60 * 60 * 1000))}`;
          if (!wasShown(key)) {
            novosAlertas.push({ reuniao: r, tipo: '5min', key });
          }
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

  const openReuniao = (reuniaoId, key) => {
    dismiss(key);
    window.location.href = `/AgendaVoxx`;
  };

  const enviarLink = (reuniao, key) => {
    if (reuniao.local_link || reuniao.objetivo?.includes('http')) {
      const link = reuniao.local_link || '';
      if (link.startsWith('http')) {
        window.open(link, '_blank');
      } else {
        openReuniao(reuniao.id, key);
      }
    } else {
      openReuniao(reuniao.id, key);
    }
    dismiss(key);
  };

  if (alertas.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] space-y-3 max-w-sm w-full">
      {alertas.map(({ reuniao, tipo, key }) => {
        const start = parseISO(reuniao.start_datetime);
        const horario = format(start, "HH:mm", { locale: ptBR });
        const is1h = tipo === '1h';

        return (
          <div
            key={key}
            className={`bg-white rounded-2xl shadow-2xl border-l-4 p-4 animate-in slide-in-from-right-5 ${
              is1h ? 'border-blue-500' : 'border-red-500'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  is1h ? 'bg-blue-100' : 'bg-red-100'
                }`}>
                  {is1h
                    ? <Clock className="w-4 h-4 text-blue-600" />
                    : <Calendar className="w-4 h-4 text-red-600" />
                  }
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wide ${is1h ? 'text-blue-600' : 'text-red-600'}`}>
                    {is1h ? '⏰ Em 1 hora' : '🚨 Em 5 minutos'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => dismiss(key)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="mb-3">
              <p className="text-sm font-semibold text-slate-800 leading-tight">{reuniao.titulo}</p>
              {reuniao.unidade_nome && (
                <p className="text-xs text-slate-500 mt-0.5">{reuniao.unidade_nome}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">Horário: <span className="font-semibold text-slate-600">{horario}</span></p>

              {!is1h && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 mt-2 leading-relaxed">
                  Faltam 5 minutos para a reunião com <strong>{reuniao.unidade_nome || 'o cliente'}</strong>. Envie o link para a reunião agora.
                </p>
              )}
            </div>

            {/* Botões */}
            <div className="flex items-center gap-2">
              {!is1h && (
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
                onClick={() => openReuniao(reuniao.id, key)}
              >
                Ver reunião
              </Button>
              {is1h && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => dismiss(key)}
                >
                  Fechar
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}