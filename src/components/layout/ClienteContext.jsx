import React from 'react';
import { Button } from "@/components/ui/button";
import { Building2, MapPin, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ClienteSelector from '@/components/auth/ClienteSelector';

export default function ClienteContext({ user, cliente, clientes = [], onChangeCliente }) {
  const [open, setOpen] = React.useState(false);
  const canSwitchCliente = user?.tipo_usuario === 'voxx_admin' || user?.tipo_usuario === 'voxx_operacao' || clientes.length > 1;

  if (!cliente) return null;

  const handleSelectCliente = (newCliente) => {
    onChangeCliente(newCliente);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
      <Building2 className="w-4 h-4 text-slate-500" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{cliente.nome}</p>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="w-3 h-3" />
          <span>{cliente.cidade}, {cliente.estado}</span>
        </div>
      </div>
      {canSwitchCliente && clientes.length > 1 && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2">
              <RefreshCw className="w-3 h-3" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Selecionar Cliente</DialogTitle>
            </DialogHeader>
            <ClienteSelector 
              clientes={clientes} 
              onSelectCliente={handleSelectCliente}
              currentClienteId={cliente.id}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}