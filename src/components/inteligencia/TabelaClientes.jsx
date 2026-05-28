import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';
import ClienteDetalheModal from './ClienteDetalheModal';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const STATUS_OP = {
  0: { label: 'Normal', className: 'bg-green-50 text-green-700 border-green-200' },
  1: { label: 'Atenção', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  2: { label: 'Elevado', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  3: { label: 'Crítico', className: 'bg-red-50 text-red-700 border-red-200' },
};

export default function TabelaClientes({ dados, loading, setorLabels, periodo }) {
  const [sortBy, setSortBy] = useState('custo_estimado');
  const [sortDir, setSortDir] = useState('desc');
  const [selected, setSelected] = useState(null);

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const sorted = [...dados].sort((a, b) => {
    let va = a[sortBy], vb = b[sortBy];
    if (typeof va === 'string') va = va.toLowerCase(), vb = vb.toLowerCase();
    if (sortBy === 'intensidade') { va = a.intensidade.level; vb = b.intensidade.level; }
    if (sortBy === 'setores') { va = a.setores.length; vb = b.setores.length; }
    if (sortBy === 'usuarios') { va = a.usuarios.length; vb = b.usuarios.length; }
    return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ChevronUp className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-violet-600" />
      : <ChevronDown className="w-3 h-3 text-violet-600" />;
  };

  const Th = ({ col, children }) => (
    <TableHead
      className="cursor-pointer hover:bg-slate-50 select-none whitespace-nowrap"
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center gap-1">
        {children}
        <SortIcon col={col} />
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-16 text-center text-slate-400 text-sm">
          Carregando dados operacionais...
        </CardContent>
      </Card>
    );
  }

  if (dados.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-16 text-center text-slate-400 text-sm">
          Nenhum cliente com demandas no período selecionado.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-6 text-center text-xs text-slate-400">#</TableHead>
                  <Th col="cliente_nome">Cliente</Th>
                  <Th col="qtd_demandas">Demandas</Th>
                  <Th col="participacoes">Participações</Th>
                  <Th col="setores">Setores</Th>
                  <Th col="usuarios">Usuários</Th>
                  <Th col="custo_estimado">Custo Est.</Th>
                  <Th col="custo_por_demanda">Custo/Dem.</Th>
                  <Th col="intensidade">Intensidade</Th>
                  <Th col="percentual">% Operação</Th>
                  <Th col="media_diaria">Méd. Diária</Th>
                  <TableHead>Status Op.</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c, i) => {
                  const statusOp = STATUS_OP[c.intensidade.level];
                  return (
                    <TableRow
                      key={c.cliente_id}
                      className="hover:bg-violet-50/30 cursor-pointer"
                      onClick={() => setSelected(c)}
                    >
                      <TableCell className="text-center text-xs text-slate-400 font-medium">{i + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{c.cliente_nome}</p>
                          <p className="text-xs text-slate-400">{c.cliente_id.slice(-6)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-violet-700">{c.qtd_demandas}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-700">{c.participacoes}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[140px]">
                          {c.setores.slice(0, 3).map((s, j) => (
                            <span key={j} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {setorLabels[s]?.split(' ')[0] || s.slice(0, 6)}
                            </span>
                          ))}
                          {c.setores.length > 3 && (
                            <span className="text-[10px] text-slate-400">+{c.setores.length - 3}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600">{c.usuarios.length || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-amber-700">{fmt(c.custo_estimado)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600">{fmt(c.custo_por_demanda)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${c.intensidade.color} border-0 text-xs`}>
                          {c.intensidade.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-violet-500"
                              style={{ width: `${Math.min(c.percentual, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-700">{c.percentual.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-500">{c.media_diaria.toFixed(1)}/dia</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${statusOp.className}`}>
                          {statusOp.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ClienteDetalheModal
        cliente={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        setorLabels={setorLabels}
      />
    </>
  );
}