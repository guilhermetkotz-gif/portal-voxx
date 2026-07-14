import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import moment from 'moment';

export default function MessageBubble({ message, isMine }) {
  const time = message.created_date ? moment(message.created_date).format('HH:mm') : '';

  return (
    <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[70%] rounded-2xl px-4 py-2",
        isMine
          ? "bg-violet-600 text-white rounded-br-sm"
          : "bg-white border border-slate-200 text-slate-900 rounded-bl-sm"
      )}>
        <p className="text-sm whitespace-pre-wrap break-words">{message.conteudo}</p>
        <div className={cn(
          "flex items-center gap-1 mt-1",
          isMine ? "justify-end" : "justify-start"
        )}>
          <span className={cn("text-xs", isMine ? "text-violet-200" : "text-slate-400")}>
            {time}
          </span>
          {isMine && (
            message.lida
              ? <CheckCheck className="w-3.5 h-3.5 text-violet-200" />
              : <Check className="w-3.5 h-3.5 text-violet-200" />
          )}
        </div>
      </div>
    </div>
  );
}