import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { differenceInDays } from 'date-fns';

const setorLabels = {
  'TRAFEGO_META': 'Meta',
  'TRAFEGO_GOOGLE': 'Google',
  'TRAFEGO_TIKTOK': 'TikTok',
  'CRIACAO': 'Criação',
  'EDICAO': 'Edição',
  'BI_RELATORIO': 'BI',
  'IMPLANTACAO': 'Implantação',
  'FINANCEIRO': 'Financeiro',
  'ALTERACAO_CRIACAO': 'Alt/Criação',
  'AUTOMACAO': 'Automação',
  'SALDOS': 'Saldos'
};

export default function TempoMedioConclusao({ demandas = [] }) {
  const temposPorSetor = {};

  demandas
    .filter(d => d.status === 'concluida' && d.created_date && d.updated_date)
    .forEach(d => {
      if (!temposPorSetor[d.setor]) {
        temposPorSetor[d.setor] = { tempos: [], total: 0 };
      }
      const dias = differenceInDays(new Date(d.updated_date), new Date(d.created_date));
      temposPorSetor[d.setor].tempos.push(dias);
    });

  const data = Object.entries(temposPorSetor)
    .map(([setor, { tempos }]) => ({
      setor: setorLabels[setor] || setor,
      media: Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length * 10) / 10,
      total: tempos.length
    }))
    .filter(item => item.total > 0)
    .sort((a, b) => b.media - a.media);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tempo Médio de Conclusão (dias)</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            Nenhuma demanda concluída para análise
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="setor" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1' }}
                formatter={(value, name) => {
                  if (name === 'media') return [value, 'Média (dias)'];
                  return [value, name];
                }}
              />
              <Bar dataKey="media" fill="#8b5cf6" name="Média (dias)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}