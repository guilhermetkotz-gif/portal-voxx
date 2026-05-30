import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Filter, X, Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const KanbanFilters = ({ filters, setFilters, clientes, availableTags = [] }) => {
  const [searchCliente, setSearchCliente] = useState('');
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [tagsPopoverOpen, setTagsPopoverOpen] = useState(false);
  
  const statusOptions = [
    { value: 'recebida', label: 'Recebida' },
    { value: 'em_triagem', label: 'Em Triagem' },
    { value: 'programada', label: 'Programada' },
    { value: 'em_execucao', label: 'Em Execução' },
    { value: 'aguardando_cliente', label: 'Aguardando Cliente' },
    { value: 'em_revisao', label: 'Em Revisão' },
    { value: 'concluida', label: 'Concluída' }
  ];
  
  const handleClearFilters = () => {
    setFilters({
      cliente_id: 'all',
      status: [],
      prioridade: 'all',
      prazo: 'all',
      tags: []
    });
    setSearchCliente('');
  };

  const toggleStatus = (statusValue) => {
    const currentStatus = Array.isArray(filters.status) ? filters.status : [];
    const newStatus = currentStatus.includes(statusValue)
      ? currentStatus.filter(s => s !== statusValue)
      : [...currentStatus, statusValue];
    setFilters({ ...filters, status: newStatus });
  };

  const toggleTag = (tag) => {
    const currentTags = Array.isArray(filters.tags) ? filters.tags : [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    setFilters({ ...filters, tags: newTags });
  };

  const hasActiveFilters = filters.cliente_id !== 'all' || 
                           (Array.isArray(filters.status) && filters.status.length > 0) || 
                           filters.prioridade !== 'all' || 
                           filters.prazo !== 'all' ||
                           (Array.isArray(filters.tags) && filters.tags.length > 0);

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
            <SelectContent modal={false}>
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

          <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-start">
                {Array.isArray(filters.status) && filters.status.length > 0 ? (
                  <>
                    <Badge variant="secondary" className="mr-1">
                      {filters.status.length}
                    </Badge>
                    Status selecionados
                  </>
                ) : (
                  'Todos os status'
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0">
              <div className="p-2 space-y-1">
                {statusOptions.map((option) => {
                  const isSelected = Array.isArray(filters.status) && filters.status.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      onClick={() => toggleStatus(option.value)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md hover:bg-slate-100 transition-colors",
                        isSelected && "bg-slate-100"
                      )}
                    >
                      <span>{option.label}</span>
                      {isSelected && <Check className="h-4 w-4 text-violet-600" />}
                    </button>
                  );
                })}
              </div>
              {Array.isArray(filters.status) && filters.status.length > 0 && (
                <div className="border-t p-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full"
                    onClick={() => setFilters({ ...filters, status: [] })}
                  >
                    Limpar seleção
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Select value={filters.prioridade} onValueChange={(v) => setFilters({ ...filters, prioridade: v })}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent modal={false}>
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
            <SelectContent modal={false}>
              <SelectItem value="all">Todos os prazos</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="hoje">Vence hoje</SelectItem>
              <SelectItem value="proximos_7_dias">Próximos 7 dias</SelectItem>
              <SelectItem value="sem_prazo">Sem prazo</SelectItem>
            </SelectContent>
          </Select>

          {availableTags.length > 0 && (
            <Popover open={tagsPopoverOpen} onOpenChange={setTagsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[180px] justify-start">
                  {Array.isArray(filters.tags) && filters.tags.length > 0 ? (
                    <>
                      <Badge variant="secondary" className="mr-1">
                        {filters.tags.length}
                      </Badge>
                      Tags selecionadas
                    </>
                  ) : (
                    'Todas as tags'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0">
                <div className="p-2 space-y-1">
                  {availableTags.map((tag) => {
                    const isSelected = Array.isArray(filters.tags) && filters.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md hover:bg-slate-100 transition-colors",
                          isSelected && "bg-slate-100"
                        )}
                      >
                        <span>{tag}</span>
                        {isSelected && <Check className="h-4 w-4 text-violet-600" />}
                      </button>
                    );
                  })}
                </div>
                {Array.isArray(filters.tags) && filters.tags.length > 0 && (
                  <div className="border-t p-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full"
                      onClick={() => setFilters({ ...filters, tags: [] })}
                    >
                      Limpar seleção
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          )}

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