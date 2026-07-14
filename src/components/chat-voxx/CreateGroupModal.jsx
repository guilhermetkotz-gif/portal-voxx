import React, { useState, useMemo } from 'react';
import { Search, Check, X, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export default function CreateGroupModal({ open, onClose, users, currentUser, onCreate }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u =>
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const toggleUser = (userId) => {
    setSelected(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const handleCreate = () => {
    if (selected.length < 1) return;
    const name = groupName.trim() || selected.map(id => users.find(u => u.id === id)?.full_name).filter(Boolean).join(', ').substring(0, 50);
    onCreate({
      nome_grupo: name,
      participantes: [currentUser.id, ...selected],
      is_group: true,
      criador_id: currentUser.id
    });
    setSelected([]);
    setGroupName('');
    onClose();
  };

  const handleClose = () => {
    setSelected([]);
    setGroupName('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-600" />
            Novo Grupo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Nome do grupo (opcional)"
          />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar usuários..."
              className="pl-9"
            />
          </div>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map(id => {
                const u = users.find(u => u.id === id);
                return (
                  <span key={id} className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 text-xs px-2 py-1 rounded-full">
                    {u?.full_name || u?.email}
                    <button onClick={() => toggleUser(id)}><X className="w-3 h-3" /></button>
                  </span>
                );
              })}
            </div>
          )}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.map(u => {
              const isSelected = selected.includes(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggleUser(u.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left",
                    isSelected ? "bg-violet-50" : "hover:bg-slate-100"
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {(u.full_name || u.email || '?')[0].toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-medium text-slate-900 truncate">{u.full_name || u.email}</span>
                  <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0", isSelected ? "bg-violet-600 border-violet-600" : "border-slate-300")}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={selected.length < 1} className="bg-violet-600 hover:bg-violet-700">
            Criar Grupo ({selected.length + 1})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}