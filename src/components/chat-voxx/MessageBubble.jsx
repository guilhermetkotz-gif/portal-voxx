import React, { useState } from 'react';
import { Check, CheckCheck, Download, FileText, Play, Smile, Reply } from 'lucide-react';
import { cn } from '@/lib/utils';
import moment from 'moment-timezone';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { base44 } from '@/api/base44Client';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function renderTextWithLinks(text) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all">{part}</a>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function MessageBubble({ message, isMine, isGroup, currentUserId, onReply }) {
  const [showReactions, setShowReactions] = useState(false);
  const time = message.created_date ? moment(message.created_date).tz('America/Sao_Paulo').format('HH:mm') : '';

  const handleReact = async (emoji) => {
    setShowReactions(false);
    const existing = message.reacoes || [];
    const alreadyMine = existing.find(r => r.usuario_id === currentUserId && r.emoji === emoji);
    let newReacoes;
    if (alreadyMine) {
      newReacoes = existing.filter(r => !(r.usuario_id === currentUserId && r.emoji === emoji));
    } else {
      const others = existing.filter(r => r.usuario_id !== currentUserId);
      newReacoes = [...others, { emoji, usuario_id: currentUserId, usuario_nome: '' }];
    }
    try {
      await base44.entities.ChatVoxxMensagem.update(message.id, { reacoes: newReacoes });
    } catch (err) {
      console.error('Erro ao reagir:', err);
    }
  };

  const renderMedia = () => {
    switch (message.tipo_mensagem) {
      case 'imagem':
        return (
          <img
            src={message.midia_url}
            alt={message.midia_nome || 'imagem'}
            className="rounded-lg max-w-full max-h-80 object-cover cursor-pointer"
            onClick={() => window.open(message.midia_url, '_blank')}
          />
        );
      case 'video':
        return <video src={message.midia_url} controls className="rounded-lg max-w-full max-h-80" />;
      case 'audio':
        return <audio src={message.midia_url} controls className="w-full max-w-64" />;
      case 'documento':
        return (
          <a href={message.midia_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 bg-black/10 rounded-lg hover:bg-black/20 transition-colors min-w-48">
            <FileText className="w-8 h-8 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{message.midia_nome || 'documento'}</p>
              <p className="text-xs opacity-70 flex items-center gap-1"><Download className="w-3 h-3" /> Baixar</p>
            </div>
          </a>
        );
      case 'sticker':
        return <div className="text-7xl leading-none">{message.conteudo}</div>;
      default:
        return null;
    }
  };

  const hasMedia = ['imagem', 'video', 'documento', 'audio', 'sticker'].includes(message.tipo_mensagem);
  const reactions = message.reacoes || [];

  return (
    <div className={cn("flex group", isMine ? "justify-end" : "justify-start")}>
      <div className={cn("relative max-w-[70%]", isMine ? "items-end" : "items-start")}>
        {/* Reply context */}
        {message.resposta_id && (
          <div className={cn("mb-1 px-3 py-1.5 rounded-lg border-l-2 text-xs", isMine ? "bg-violet-700/30 border-violet-300" : "bg-slate-100 border-violet-500")}>
            <p className="font-semibold opacity-80">{message.resposta_remetente_nome || 'Usuário'}</p>
            <p className="opacity-70 truncate">{message.resposta_texto || 'Mídia'}</p>
          </div>
        )}

        {/* Sender name in group */}
        {isGroup && !isMine && (
          <p className="text-xs font-semibold text-violet-600 mb-0.5 px-1">{message.remetente_nome}</p>
        )}

        <div className={cn(
          "rounded-2xl px-3 py-2 relative",
          hasMedia && message.tipo_mensagem !== 'sticker' ? "p-1" : "",
          message.tipo_mensagem === 'sticker' ? "bg-transparent p-0" : "",
          isMine
            ? "bg-violet-600 text-white rounded-br-sm"
            : "bg-white border border-slate-200 text-slate-900 rounded-bl-sm"
        )}>
          {hasMedia && renderMedia()}
          {message.conteudo && message.tipo_mensagem !== 'sticker' && (
            <p className={cn("text-sm whitespace-pre-wrap break-words", hasMedia && "px-2 py-1")}>
              {renderTextWithLinks(message.conteudo)}
            </p>
          )}

          {message.tipo_mensagem !== 'sticker' && (
            <div className={cn("flex items-center gap-1 mt-0.5", isMine ? "justify-end" : "justify-start")}>
              <span className={cn("text-xs", isMine ? "text-violet-200" : "text-slate-400")}>{time}</span>
              {isMine && (message.lida ? <CheckCheck className="w-3.5 h-3.5 text-violet-200" /> : <Check className="w-3.5 h-3.5 text-violet-200" />)}
            </div>
          )}
        </div>

        {/* Reactions bar */}
        {reactions.length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mt-1", isMine ? "justify-end" : "justify-start")}>
            {reactions.reduce((acc, r) => {
              const existing = acc.find(x => x.emoji === r.emoji);
              if (existing) existing.count++;
              else acc.push({ emoji: r.emoji, count: 1, mine: r.usuario_id === currentUserId });
              return acc;
            }, []).map(({ emoji, count, mine }) => (
              <span key={emoji} className={cn("inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full", mine ? "bg-violet-100 border border-violet-300" : "bg-slate-100 border border-slate-200")}>
                {emoji} {count > 1 && <span className="text-slate-500">{count}</span>}
              </span>
            ))}
          </div>
        )}

        {/* Hover actions */}
        <div className={cn("absolute -top-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-white border border-slate-200 rounded-full shadow-sm px-1 py-0.5", isMine ? "left-0" : "right-0")}>
          <Popover open={showReactions} onOpenChange={setShowReactions}>
            <PopoverTrigger asChild>
              <button className="p-1 hover:bg-slate-100 rounded-full"><Smile className="w-3.5 h-3.5 text-slate-500" /></button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1" align="center">
              <div className="flex gap-0.5">
                {REACTION_EMOJIS.map(emoji => (
                  <button key={emoji} onClick={() => handleReact(emoji)} className="text-lg hover:scale-125 transition-transform p-0.5">
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <button onClick={() => onReply?.(message)} className="p-1 hover:bg-slate-100 rounded-full">
            <Reply className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>
    </div>
  );
}