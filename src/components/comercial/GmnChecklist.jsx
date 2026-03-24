import React from 'react';
import { cn } from '@/lib/utils';

const ToggleGroup = ({ label, options, value, onChange }) => (
  <div className="space-y-1.5">
    <p className="text-xs font-medium text-slate-600">{label}</p>
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(value === opt.value ? null : opt.value)}
          className={cn(
            'px-2.5 py-1 text-xs rounded-lg border transition-all',
            value === opt.value
              ? 'bg-violet-600 text-white border-violet-600'
              : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

const BoolToggle = ({ label, value, onChange }) => (
  <div className="space-y-1.5">
    <p className="text-xs font-medium text-slate-600">{label}</p>
    <div className="flex gap-1.5">
      {[{ label: 'Sim', value: true }, { label: 'Não', value: false }].map(opt => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(value === opt.value ? null : opt.value)}
          className={cn(
            'px-3 py-1 text-xs rounded-lg border transition-all',
            value === opt.value
              ? opt.value
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-red-500 text-white border-red-500'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

export default function GmnChecklist({ value, onChange }) {
  const set = (key, val) => onChange({ ...value, [key]: val });

  return (
    <div className="space-y-4 pt-1">
      {/* Avaliações */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">⭐ Avaliações</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-600">Nota média</p>
            <input
              type="number" step="0.1" min="0" max="5"
              placeholder="4.3"
              value={value.rating || ''}
              onChange={e => set('rating', e.target.value ? parseFloat(e.target.value) : null)}
              className="w-full h-8 px-2.5 text-xs rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-600">Qtd. avaliações</p>
            <input
              type="number"
              placeholder="127"
              value={value.reviews_count || ''}
              onChange={e => set('reviews_count', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full h-8 px-2.5 text-xs rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
          </div>
        </div>
        <ToggleGroup
          label="A clínica responde avaliações?"
          value={value.reviews_response}
          onChange={v => set('reviews_response', v)}
          options={[
            { label: 'Sim, personalizada', value: 'personalizada' },
            { label: 'Sim, padrão', value: 'padrao' },
            { label: 'Não responde', value: 'nao_responde' },
          ]}
        />
      </div>

      {/* Fotos */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">📸 Fotos</p>
        <div className="space-y-2">
          <ToggleGroup
            label="Quantidade de fotos"
            value={value.photos_quantity}
            onChange={v => set('photos_quantity', v)}
            options={[
              { label: 'Muitas e atualizadas', value: 'muitas' },
              { label: 'Algumas', value: 'algumas' },
              { label: 'Poucas/desatualizadas', value: 'poucas' },
              { label: 'Quase nenhuma', value: 'quase_nenhuma' },
            ]}
          />
          <ToggleGroup
            label="Tipo de fotos"
            value={value.photos_type}
            onChange={v => set('photos_type', v)}
            options={[
              { label: 'Reais da clínica', value: 'reais' },
              { label: 'Banco de imagem', value: 'banco' },
              { label: 'Misto', value: 'misto' },
            ]}
          />
        </div>
      </div>

      {/* Estrutura */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">📍 Estrutura do Perfil</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <BoolToggle label="Descrição estratégica?" value={value.has_description} onChange={v => set('has_description', v)} />
          <BoolToggle label="Serviços cadastrados?" value={value.has_services} onChange={v => set('has_services', v)} />
          <BoolToggle label="Horário atualizado?" value={value.has_hours} onChange={v => set('has_hours', v)} />
        </div>
      </div>

      {/* Atividade */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">📈 Atividade</p>
        <ToggleGroup
          label="Frequência de postagens"
          value={value.posting_frequency}
          onChange={v => set('posting_frequency', v)}
          options={[
            { label: 'Frequente', value: 'frequente' },
            { label: 'Ocasional', value: 'ocasional' },
            { label: 'Não posta', value: 'nao_posta' },
          ]}
        />
      </div>

      {/* Conversão */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">🔗 Conversão <span className="text-red-500">(CRÍTICO)</span></p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <BoolToggle label="Site vinculado?" value={value.has_website} onChange={v => set('has_website', v)} />
          <BoolToggle label="Botão/link WhatsApp?" value={value.has_whatsapp} onChange={v => set('has_whatsapp', v)} />
          <BoolToggle label="Botão de ligação?" value={value.has_call_button} onChange={v => set('has_call_button', v)} />
        </div>
      </div>

      {/* Extras */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">❓ Recursos Extras</p>
        <BoolToggle label="Usa seção de perguntas e respostas?" value={value.has_qna} onChange={v => set('has_qna', v)} />
      </div>
    </div>
  );
}