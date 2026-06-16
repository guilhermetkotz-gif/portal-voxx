import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'voxx_chat_theme';

export function useChatTheme() {
  const [isLight, setIsLight] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'light';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, isLight ? 'light' : 'dark');
    } catch {}
  }, [isLight]);

  const toggle = useCallback(() => setIsLight(prev => !prev), []);

  return { isLight, toggle };
}

// Mapa de cores para tema escuro (default) e claro (WhatsApp-style)
const DARK = {
  bg: 'bg-slate-950',
  bgPanel: 'bg-slate-900',
  bgPanelAlpha: 'bg-slate-900/80',
  bgCard: 'bg-slate-800',
  bgCardHover: 'hover:bg-slate-800/50',
  bgCardSelected: 'bg-slate-800',
  bgCardAlpha: 'bg-slate-800/50',
  bgInput: 'bg-slate-800',
  bgBubbleOut: 'bg-emerald-600',
  bgBubbleIn: 'bg-slate-800',
  bgQuoteOut: 'bg-emerald-700/40',
  bgQuoteIn: 'bg-slate-700/50',
  bgReaction: 'bg-slate-700/60',
  bgHoverBtn: 'hover:bg-slate-700',
  bgHoverGhost: 'hover:bg-slate-700',
  bgIconCircle: 'bg-slate-800',
  bgBadgeUnread: 'bg-emerald-500',
  bgRecording: 'bg-red-500/10',
  bgModal: 'bg-slate-900',
  bgModalOverlay: 'bg-black/70',
  bgCloseBtnHover: 'hover:bg-slate-700',
  textPrimary: 'text-white',
  textSecondary: 'text-slate-400',
  textTertiary: 'text-slate-500',
  textBubbleOut: 'text-white',
  textBubbleIn: 'text-slate-200',
  textName: 'text-white',
  textNameOut: 'text-emerald-300',
  textNameIn: 'text-blue-400',
  textTimestamp: 'text-emerald-200',
  textTimestampIn: 'text-slate-500',
  textPlaceholder: 'placeholder:text-slate-500',
  textInput: 'text-slate-100',
  textQuoteOut: 'text-emerald-100',
  textQuoteIn: 'text-slate-300',
  textQuoteNameOut: 'text-emerald-200',
  textQuoteNameIn: 'text-blue-400',
  border: 'border-slate-800',
  borderSubtle: 'border-slate-800/50',
  borderLight: 'border-slate-700',
  borderRecording: 'border-red-500/20',
  borderQuoteOut: 'border-emerald-300/40',
  borderQuoteIn: 'border-blue-500/40',
  borderModal: 'border-slate-800',
  divider: 'divide-slate-800/50',
  iconGreen: 'text-emerald-400',
  iconBlue: 'text-blue-400',
  iconGreenBg: 'bg-emerald-500/20',
  iconBlueBg: 'bg-blue-500/20',
  inputBorder: 'border-slate-700',
  popoverBg: 'bg-slate-800',
  popoverBorder: 'border-slate-700',
  popoverHover: 'hover:bg-slate-700',
  emojiPickerTheme: 'dark',
  alertEmergencial: 'border-l-red-500',
  alertCritico: 'border-l-orange-500',
  alertAlerta: 'border-l-yellow-500',
  alertAlarme: 'border-l-amber-500',
  tabActive: 'bg-emerald-600 text-white',
  tabInactive: 'text-slate-400 hover:text-white hover:bg-slate-800',
  // Input bar WhatsApp-style
  bgBarraInput: 'bg-slate-900/95',
  bgCampoInput: 'bg-slate-800',
  inputFieldBorder: 'border-slate-700',
  inputIconColor: 'text-slate-400',
  sendBtnBg: 'bg-emerald-600 hover:bg-emerald-500',
  // Papel de parede da área de mensagens (tema escuro — sem wallpaper)
  bgMensagens: 'bg-slate-950',
  bgMensagensStyle: {},
};

const LIGHT = {
  bg: 'bg-[#f0f2f5]',
  bgPanel: 'bg-white',
  bgPanelAlpha: 'bg-white/95',
  bgCard: 'bg-white',
  bgCardHover: 'hover:bg-[#f0f2f5]',
  bgCardSelected: 'bg-[#f0f2f5]',
  bgCardAlpha: 'bg-[#f0f2f5]',
  bgInput: 'bg-white',
  bgBubbleOut: 'bg-[#d9fdd3]',
  bgBubbleIn: 'bg-white',
  bgQuoteOut: 'bg-[#d9fdd3]/60',
  bgQuoteIn: 'bg-[#f0f2f5]',
  bgReaction: 'bg-[#f0f2f5]/80',
  bgHoverBtn: 'hover:bg-[#f0f2f5]',
  bgHoverGhost: 'hover:bg-[#e9edef]',
  bgIconCircle: 'bg-[#f0f2f5]',
  bgBadgeUnread: 'bg-[#00a884]',
  bgRecording: 'bg-red-100',
  bgModal: 'bg-white',
  bgModalOverlay: 'bg-black/50',
  bgCloseBtnHover: 'hover:bg-[#e9edef]',
  textPrimary: 'text-[#111b21]',
  textSecondary: 'text-[#667781]',
  textTertiary: 'text-[#667781]',
  textBubbleOut: 'text-[#111b21]',
  textBubbleIn: 'text-[#111b21]',
  textName: 'text-[#111b21]',
  textNameOut: 'text-[#00a884]',
  textNameIn: 'text-[#008069]',
  textTimestamp: 'text-[#667781]',
  textTimestampIn: 'text-[#667781]',
  textPlaceholder: 'placeholder:text-[#8696a0]',
  textInput: 'text-[#111b21]',
  textQuoteOut: 'text-[#3b4a54]',
  textQuoteIn: 'text-[#3b4a54]',
  textQuoteNameOut: 'text-[#00a884]',
  textQuoteNameIn: 'text-[#008069]',
  border: 'border-[#e9edef]',
  borderSubtle: 'border-[#e9edef]',
  borderLight: 'border-[#e9edef]',
  borderRecording: 'border-red-200',
  borderQuoteOut: 'border-[#00a884]/40',
  borderQuoteIn: 'border-[#008069]/40',
  borderModal: 'border-[#e9edef]',
  divider: 'divide-[#e9edef]',
  iconGreen: 'text-[#00a884]',
  iconBlue: 'text-[#008069]',
  iconGreenBg: 'bg-[#00a884]/15',
  iconBlueBg: 'bg-[#008069]/15',
  inputBorder: 'border-[#e9edef]',
  popoverBg: 'bg-white',
  popoverBorder: 'border-[#e9edef]',
  popoverHover: 'hover:bg-[#f0f2f5]',
  emojiPickerTheme: 'light',
  alertEmergencial: 'border-l-red-500',
  alertCritico: 'border-l-orange-500',
  alertAlerta: 'border-l-yellow-500',
  alertAlarme: 'border-l-amber-500',
  tabActive: 'bg-[#00a884] text-white',
  tabInactive: 'text-[#667781] hover:text-[#111b21] hover:bg-[#f0f2f5]',
  // Input bar WhatsApp-style
  bgBarraInput: 'bg-[#f0f2f5]',
  bgCampoInput: 'bg-white',
  inputFieldBorder: 'border-transparent',
  inputIconColor: 'text-[#54656f]',
  sendBtnBg: 'bg-[#00a884] hover:bg-[#06cf9c]',
  // Papel de parede da área de mensagens (tema claro)
  bgMensagens: 'bg-[#efeae2]',
  bgMensagensStyle: {
    backgroundImage: 'url(https://media.base44.com/images/public/695d14d862b9c933054dfba4/abf2c7755_ChatGPTImage16dejunde202618_01_47.png)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
  },
};

export function chatTheme(isLight) {
  return isLight ? LIGHT : DARK;
}