import React from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, MapPin, Search, ChevronRight } from 'lucide-react';
import { cn } from "@/lib/utils";
import StatusBadge from '@/components/ui/StatusBadge';

export default function ClienteSelector({ clientes = [], onSelectCliente, currentClienteId }) {
  const [search, setSearch] = React.useState('');

  const filteredClientes = clientes.filter(cliente => 
    cliente.nome?.toLowerCase().includes(search.toLowerCase()) ||
    cliente.cidade?.toLowerCase().includes(search.toLowerCase()) ||
    cliente.marca?.toLowerCase().includes(search.toLowerCase())
  );

  const statusConfig = {
    ativo: { variant: 'success' },
    pausado: { variant: 'warning' },
    encerrado: { variant: 'danger' }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-3 max-h-[600px] overflow-y-auto">
        {filteredClientes.map(cliente => (
          <Card 
            key={cliente.id}
            className={cn(
              "p-4 cursor-pointer transition-all hover:shadow-md hover:border-violet-300",
              currentClienteId === cliente.id && "border-violet-500 bg-violet-50"
            )}
            onClick={() => onSelectCliente(cliente)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-900">{cliente.nome}</h3>
                </div>
                {cliente.marca && (
                  <p className="text-sm text-slate-500 mb-1">{cliente.marca}</p>
                )}
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <MapPin className="w-3 h-3" />
                  <span>{cliente.cidade}, {cliente.estado}</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <StatusBadge 
                    type="setor" 
                    value={cliente.status || 'ativo'} 
                    size="xs"
                  />
                  {cliente.plano_servico && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {cliente.plano_servico}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </div>
          </Card>
        ))}

        {filteredClientes.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-slate-500">Nenhum cliente encontrado</p>
          </Card>
        )}
      </div>
    </div>
  );
}