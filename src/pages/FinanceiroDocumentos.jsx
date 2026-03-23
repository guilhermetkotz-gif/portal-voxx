import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, FileText, Download, FolderOpen, ArrowUpCircle, ArrowDownCircle, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TYPE_CONFIG = {
  receita: { label: 'Comprovante Receita', color: 'bg-emerald-100 text-emerald-700', icon: ArrowUpCircle },
  custo: { label: 'Comprovante Despesa', color: 'bg-red-100 text-red-700', icon: ArrowDownCircle },
  holerite: { label: 'Holerite CLT', color: 'bg-blue-100 text-blue-700', icon: Users },
  nota_fiscal: { label: 'Nota Fiscal PJ', color: 'bg-purple-100 text-purple-700', icon: Users },
  comp_folha: { label: 'Comprovante Folha', color: 'bg-indigo-100 text-indigo-700', icon: Users },
};

export default function FinanceiroDocumentos() {
  const [mes, setMes] = useState('');
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('all');

  const { data: receitas = [] } = useQuery({
    queryKey: ['fin-receitas-docs'],
    queryFn: () => base44.entities.FinanceiroReceita.list('-created_date', 500),
  });
  const { data: custos = [] } = useQuery({
    queryKey: ['fin-custos-docs'],
    queryFn: () => base44.entities.FinanceiroCusto.list('-created_date', 500),
  });
  const { data: folha = [] } = useQuery({
    queryKey: ['fin-folha-docs'],
    queryFn: () => base44.entities.FinanceiroFolha.list('-created_date', 500),
  });

  const docs = useMemo(() => {
    const list = [];

    receitas.filter(r => r.comprovante_recebimento).forEach(r => {
      list.push({
        id: `receita-${r.id}`,
        nome: `Recebimento — ${r.cliente_nome}`,
        tipo: 'receita',
        url: r.comprovante_recebimento,
        mes_referencia: r.mes_referencia,
        data: r.data_recebimento || r.created_date,
      });
    });

    custos.filter(c => c.comprovante_pagamento).forEach(c => {
      list.push({
        id: `custo-${c.id}`,
        nome: `Despesa — ${c.nome}`,
        tipo: 'custo',
        url: c.comprovante_pagamento,
        mes_referencia: c.mes_referencia,
        data: c.data_pagamento || c.created_date,
      });
    });

    folha.filter(f => f.holerite_url).forEach(f => {
      list.push({
        id: `holerite-${f.id}`,
        nome: `Holerite — ${f.nome}`,
        tipo: 'holerite',
        url: f.holerite_url,
        mes_referencia: f.mes_referencia,
        data: f.data_pagamento || f.created_date,
      });
    });

    folha.filter(f => f.nota_fiscal_url).forEach(f => {
      list.push({
        id: `nf-${f.id}`,
        nome: `NF — ${f.nome}`,
        tipo: 'nota_fiscal',
        url: f.nota_fiscal_url,
        mes_referencia: f.mes_referencia,
        data: f.data_pagamento || f.created_date,
      });
    });

    folha.filter(f => f.comprovante_pagamento_url).forEach(f => {
      list.push({
        id: `comp-folha-${f.id}`,
        nome: `Comprovante — ${f.nome} (${f.tipo_vinculo?.toUpperCase()})`,
        tipo: 'comp_folha',
        url: f.comprovante_pagamento_url,
        mes_referencia: f.mes_referencia,
        data: f.data_pagamento || f.created_date,
      });
    });

    return list.sort((a, b) => new Date(b.data) - new Date(a.data));
  }, [receitas, custos, folha]);

  const filtered = docs.filter(d => {
    const matchSearch = !search || d.nome.toLowerCase().includes(search.toLowerCase());
    const matchTipo = filtroTipo === 'all' || d.tipo === filtroTipo;
    const matchMes = !mes || d.mes_referencia === mes;
    return matchSearch && matchTipo && matchMes;
  });

  const counts = {
    total: docs.length,
    receita: docs.filter(d => d.tipo === 'receita').length,
    custo: docs.filter(d => d.tipo === 'custo').length,
    folha: docs.filter(d => ['holerite', 'nota_fiscal', 'comp_folha'].includes(d.tipo)).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-violet-100 rounded-xl">
          <FolderOpen className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documentos Financeiros</h1>
          <p className="text-slate-500 text-sm">Central de comprovantes, holerites e notas fiscais</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Total de Documentos</p>
          <p className="text-2xl font-bold text-slate-900">{counts.total}</p>
        </Card>
        <Card className="p-4 border-emerald-200 bg-emerald-50">
          <p className="text-xs text-emerald-600 mb-1">Receitas</p>
          <p className="text-2xl font-bold text-emerald-700">{counts.receita}</p>
        </Card>
        <Card className="p-4 border-red-200 bg-red-50">
          <p className="text-xs text-red-600 mb-1">Despesas</p>
          <p className="text-2xl font-bold text-red-700">{counts.custo}</p>
        </Card>
        <Card className="p-4 border-blue-200 bg-blue-50">
          <p className="text-xs text-blue-600 mb-1">Folha</p>
          <p className="text-2xl font-bold text-blue-700">{counts.folha}</p>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          className="border border-input rounded-md px-3 py-1.5 text-sm bg-white" />
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Buscar documento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-48" />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="receita">Comprovantes de Receita</SelectItem>
            <SelectItem value="custo">Comprovantes de Despesa</SelectItem>
            <SelectItem value="holerite">Holerites</SelectItem>
            <SelectItem value="nota_fiscal">Notas Fiscais</SelectItem>
            <SelectItem value="comp_folha">Comprovantes de Folha</SelectItem>
          </SelectContent>
        </Select>
        {mes && (
          <button onClick={() => setMes('')} className="text-xs text-slate-400 hover:text-slate-600 underline">
            Limpar mês
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400">Nenhum documento encontrado.</p>
          <p className="text-slate-300 text-sm mt-1">Anexe comprovantes nas telas de Receitas, Custos e Folha.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(doc => {
            const tc = TYPE_CONFIG[doc.tipo] || TYPE_CONFIG.receita;
            const Icon = tc.icon;
            return (
              <Card key={doc.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tc.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">{doc.nome}</p>
                    <Badge className={`text-[10px] mt-1 ${tc.color}`}>{tc.label}</Badge>
                    {doc.mes_referencia && (
                      <p className="text-xs text-slate-400 mt-1">Ref: {doc.mes_referencia}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <button className="w-full flex items-center justify-center gap-1.5 text-xs text-violet-600 border border-violet-200 rounded-lg py-1.5 hover:bg-violet-50 transition-colors">
                      <FileText className="w-3.5 h-3.5" /> Visualizar
                    </button>
                  </a>
                  <a href={doc.url} download target="_blank" rel="noopener noreferrer" className="flex-1">
                    <button className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg py-1.5 hover:bg-slate-50 transition-colors">
                      <Download className="w-3.5 h-3.5" /> Baixar
                    </button>
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}