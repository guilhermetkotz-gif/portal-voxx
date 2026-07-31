import React from 'react';
import { User, Phone } from 'lucide-react';

/**
 * Cartão de contato compartilhado entre ChatDrawer e ChatHubDrawer.
 * Renderiza mensagens do tipo "contato" (vCard compartilhado no WhatsApp).
 * Props:
 *   - mensagem: objeto WhatsappMensagem (campos: mensagem = nome, midia_nome = telefones)
 *   - themeStyles: objeto de tema do useChatTheme (t)
 */
export default function ContactCard({ mensagem, themeStyles: t }) {
  const nome = mensagem?.mensagem || 'Contato';
  const telefones = mensagem?.midia_nome || '';

  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg ${t?.bgQuoteIn || 'bg-slate-700/50'} ${t?.borderLight ? `border ${t.borderLight}` : 'border border-slate-600/50'}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${t?.iconBlueBg || 'bg-blue-500/20'} ${t?.iconBlue || 'text-blue-400'}`}>
        <User className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${t?.textName || 'text-slate-100'}`}>{nome}</p>
        {telefones && (
          <p className={`text-xs flex items-center gap-1 truncate ${t?.textSecondary || 'text-slate-400'}`}>
            <Phone className="w-3 h-3 shrink-0" />
            {telefones}
          </p>
        )}
      </div>
    </div>
  );
}