import React, { useState, useRef } from 'react';
import { Send, Paperclip, Smile, Sticker, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import EmojiPicker from 'emoji-picker-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const STICKER_EMOJIS = ['😀','😂','🥰','😍','😎','🤔','😢','😡','👍','👎','❤️','🔥','🎉','👏','🙏','💯','🤣','😴','🤯','🥳','😱','🤗','👀','💪','✨','💔','🫶','🤝','😅','😭'];

export default function MessageInput({ onSend, onSendMedia, onSendSticker, replyingTo, onCancelReply, disabled }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleSend = () => {
    if (!text.trim() || sending) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const mimeType = file.type || '';
      let tipo = 'documento';
      if (mimeType.startsWith('image/')) tipo = 'imagem';
      else if (mimeType.startsWith('video/')) tipo = 'video';
      else if (mimeType.startsWith('audio/')) tipo = 'audio';

      onSendMedia({
        tipo_mensagem: tipo,
        midia_url: file_url,
        midia_nome: file.name,
        midia_mimetype: mimeType,
        conteudo: ''
      });
    } catch (err) {
      console.error('Erro no upload:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="px-4 py-3 border-t border-slate-200 bg-white">
      {replyingTo && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-slate-100 rounded-lg border-l-4 border-violet-500">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-violet-600">{replyingTo.remetente_nome}</p>
            <p className="text-xs text-slate-500 truncate">{replyingTo.conteudo || replyingTo.midia_nome || 'Mídia'}</p>
          </div>
          <button onClick={onCancelReply}><X className="w-4 h-4 text-slate-400 hover:text-slate-600" /></button>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File attach */}
        <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" />
        <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={uploading || disabled} className="text-slate-500 hover:text-slate-700 flex-shrink-0">
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
        </Button>

        {/* Emoji picker */}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-700 flex-shrink-0">
              <Smile className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-0" align="start">
            <EmojiPicker
              onEmojiClick={(emojiData) => setText(prev => prev + emojiData.emoji)}
              width={320}
              height={400}
              previewConfig={{ showPreview: false }}
            />
          </PopoverContent>
        </Popover>

        {/* Sticker picker */}
        <Popover open={stickerOpen} onOpenChange={setStickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-700 flex-shrink-0">
              <Sticker className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <div className="grid grid-cols-6 gap-1">
              {STICKER_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => { onSendSticker(emoji); setStickerOpen(false); }}
                  className="text-2xl hover:bg-slate-100 rounded p-1 transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Text input */}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem..."
          disabled={disabled || sending}
          rows={1}
          className="flex-1 resize-none max-h-32 min-h-[40px] text-foreground caret-foreground"
        />

        {/* Send */}
        <Button
          onClick={handleSend}
          disabled={!text.trim() || sending || disabled}
          size="icon"
          className="bg-violet-600 hover:bg-violet-700 flex-shrink-0"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}