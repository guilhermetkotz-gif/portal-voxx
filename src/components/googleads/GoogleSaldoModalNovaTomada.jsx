import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';

export default function GoogleSaldoModalNovaTomada({ open, onOpenChange, onSave, accountName, valorSugerido }) {
  const [formData, setFormData] = useState({
    valor: '',
    data_envio: format(new Date(), 'yyyy-MM-dd'),
    metodo_pagamento: 'Pix'
  });

  React.useEffect(() => {
    if (open && valorSugerido) {
      setFormData(prev => ({ ...prev, valor: valorSugerido.toFixed(2) }));
    }
  }, [open, valorSugerido]);

  const handleSave = () => {
    if (!formData.valor || parseFloat(formData.valor) <= 0) return;
    onSave({
      valor: parseFloat(formData.valor),
      data_envio: formData.data_envio,
      metodo_pagamento: formData.metodo_pagamento,
      pago: false,
      data_pagamento: null
    });
    setFormData({ valor: '', data_envio: format(new Date(), 'yyyy-MM-dd'), metodo_pagamento: 'Pix' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            Cadastrar Nova Tomada — Google Ads
          </DialogTitle>
          {accountName && <p className="text-sm text-slate-500 mt-1">{accountName}</p>}
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Valor da Tomada (R$)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0,00"
              value={formData.valor}
              onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <Label>Data de Envio</Label>
            <Input
              type="date"
              value={formData.data_envio}
              onChange={(e) => setFormData({ ...formData, data_envio: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Método de Pagamento</Label>
            <Select value={formData.metodo_pagamento} onValueChange={(v) => setFormData({ ...formData, metodo_pagamento: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Pix">Pix</SelectItem>
                <SelectItem value="Boleto">Boleto</SelectItem>
                <SelectItem value="Cartão">Cartão</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!formData.valor || parseFloat(formData.valor) <= 0}>
            Cadastrar Tomada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}