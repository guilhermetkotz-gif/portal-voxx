import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

export default function DemandasPorSetor({ demandas = [] }) {
  const demandasPorSetor = {};
  
  demandas.forEach(d => {
    if (!demandasPorSetor[d.setor]) {
      demandasPorSetor[d.setor] = { abertas: 0, concluidas: 0, total: 0 };
    }
    demandasPorSetor[d.setor].total++;
    if (d.status === 'concluida') {
      demandasPorSetor[d.setor].concluidas++;
    } else {
      demandasPorSetor[d.setor].abertas++;
    }
  });

  const data = Object.entries(demandasPorSetor).map(([setor, counts]) => ({
    nome: setorLabels[setor] || setor,
    abertas: counts.abertas,
    concluidas: counts.concluidas,
    total: counts.total
  })).sort((a, b) => b.total - a.total);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demandas por Setor</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            Nenhuma demanda encontrada
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="nome" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1' }}
                formatter={(value) => [value, '']}
              />
              <Legend />
              <Bar dataKey="abertas" fill="#ef4444" name="Abertas" />
              <Bar dataKey="concluidas" fill="#10b981" name="Concluídas" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}