import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Filter, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

const KanbanFilters = ({ filters, setFilters, clientes }) => {
  const [searchCliente, setSearchCliente] = useState('');
  const handleClearFilters = () => {
    setFilters({
      cliente_id: 'all',
      status: 'all',
      prioridade: 'all',
      prazo: 'all'
    });
    setSearchCliente('');
  };

  const hasActiveFilters = filters.cliente_id !== 'all' || filters.status !== 'all' || 
                           filters.prioridade !== 'all' || filters.prazo !== 'all';

  const filteredClientes = clientes.filter(c => 
    c.nome.toLowerCase().includes(searchCliente.toLowerCase()) ||
    c.marca?.toLowerCase().includes(searchCliente.toLowerCase()) ||
    c.cidade?.toLowerCase().includes(searchCliente.toLowerCase())
  );

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-slate-700">
            <Filter className="h-4 w-4" />
            <span className="font-medium text-sm">Filtros:</span>
          </div>

          <Select value={filters.cliente_id} onValueChange={(v) => setFilters({ ...filters, cliente_id: v })}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <div className="p-2 sticky top-0 bg-white">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Pesquisar cliente..."
                    value={searchCliente}
                    onChange={(e) => setSearchCliente(e.target.value)}
                    className="pl-8"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {filteredClientes.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
              {filteredClientes.length === 0 && searchCliente && (
                <div className="py-6 text-center text-sm text-slate-500">
                  Nenhum cliente encontrado
                </div>
              )}
            </SelectContent>
          </Select>

          <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="recebida">Recebida</SelectItem>
              <SelectItem value="em_triagem">Em Triagem</SelectItem>
              <SelectItem value="em_execucao">Em Execução</SelectItem>
              <SelectItem value="aguardando_cliente">Aguardando Cliente</SelectItem>
              <SelectItem value="em_revisao">Em Revisão</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.prioridade} onValueChange={(v) => setFilters({ ...filters, prioridade: v })}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.prazo} onValueChange={(v) => setFilters({ ...filters, prazo: v })}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Prazo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os prazos</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="hoje">Vence hoje</SelectItem>
              <SelectItem value="proximos_7_dias">Próximos 7 dias</SelectItem>
              <SelectItem value="sem_prazo">Sem prazo</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default KanbanFilters;