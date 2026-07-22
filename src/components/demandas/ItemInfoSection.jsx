import React, { useState } from 'react';
import { cn } from '@/lib/utils';

const STATUS_PRODUCAO_LABELS = {
  nao_iniciado: 'Não iniciado',
  em_fila: 'Em fila',
  em_desenvolvimento: 'Em desenvolvimento',
  concluido: 'Concluído',
};

const STATUS_APROVACAO_LABELS = {
  nao_enviado: 'Não enviado',
  aguardando: 'Aguardando aprovação',
  ajustes_solicitados: 'Ajustes solicitados',
  reenviado: 'Reenviado',
  aprovado: 'Aprovado',
};

const STATUS_PUBLICACAO_LABELS = {
  nao_programada: 'Não programada',
  programada: 'Programada',
  vencida_sem_confirmacao: 'Vencida sem confirmação',
  publicada: 'Publicada',
  cancelada: 'Cancelada',
};

const STATUS_FINALIZACAO_LABELS = {
  ativo: 'Ativo',
  concluido: 'Concluído',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

function formatDate(value) {
  if (!value) return 'Não informado';
  const d = new Date(value);
  if (isNaN(d.getTime())) return 'Não informado';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') return 'Não informado';
  return value;
}

function Field({ label, value }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-xs text-slate-700 break-words">{value}</p>
    </div>
  );
}

export default function ItemInfoSection({ item }) {
  const [descricaoExpandida, setDescricaoExpandida] = useState(false);

  const descricao = displayValue(item.descricao);
  const temDescricaoLonga = item.descricao && item.descricao.length > 180;

  return (
    <div className="bg-slate-50/50 border border-slate-200 rounded-lg p-3 space-y-3">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
        Informações do item
      </p>

      {/* Descrição (largura total) */}
      {item.descricao ? (
        <Field
          label="Descrição"
          value={
            temDescricaoLonga && !descricaoExpandida ? (
              <span>
                {item.descricao.slice(0, 180)}{' '}
                <button
                  type="button"
                  onClick={() => setDescricaoExpandida(true)}
                  className="text-violet-600 hover:underline font-medium"
                >
                  Ver descrição completa
                </button>
              </span>
            ) : temDescricaoLonga && descricaoExpandida ? (
              <span>
                {item.descricao}{' '}
                <button
                  type="button"
                  onClick={() => setDescricaoExpandida(false)}
                  className="text-violet-600 hover:underline font-medium"
                >
                  Ver menos
                </button>
              </span>
            ) : descricao
          }
        />
      ) : (
        <Field label="Descrição" value="Não informado" />
      )}

      {/* Grid 2 colunas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
        <Field label="Tipo de material" value={displayValue(item.tipo_material)} />
        <Field label="Formato" value={displayValue(item.formato)} />
        <Field label="Canal" value={displayValue(item.canal)} />
        <Field label="Responsável" value={displayValue(item.responsavel_nome)} />
        <Field label="Data prevista" value={formatDate(item.data_prevista)} />
        <Field label="Prazo" value={formatDate(item.prazo_data)} />
        <Field
          label="Produção"
          value={item.status_producao ? (STATUS_PRODUCAO_LABELS[item.status_producao] || item.status_producao) : 'Não informado'}
        />
        <Field
          label="Publicação"
          value={item.status_publicacao ? (STATUS_PUBLICACAO_LABELS[item.status_publicacao] || item.status_publicacao) : 'Não informado'}
        />
        <Field
          label="Aprovação"
          value={item.status_aprovacao ? (STATUS_APROVACAO_LABELS[item.status_aprovacao] || item.status_aprovacao) : 'Não informado'}
        />
        <Field
          label="Situação do item"
          value={item.status_finalizacao ? (STATUS_FINALIZACAO_LABELS[item.status_finalizacao] || item.status_finalizacao) : 'Não informado'}
        />
      </div>
    </div>
  );
}