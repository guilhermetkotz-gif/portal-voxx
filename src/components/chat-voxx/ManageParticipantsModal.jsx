import React, { useState, useMemo } from 'react';
import { Search, Check, X, Users, UserPlus, UserMinus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ManageParticipantsModal({ open, onClose, group, users, currentUser, onUpdate }) {
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const currentParticipants = group?.participantes || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    const getName = (u) => u.nome_customizado || u.full_name || '';
    return users.filter(u =>
      getName(u).toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleToggle = async (userId) => {
    if (saving || userId === currentUser?.id) return;
    const isSelected = currentParticipants.includes(userId);
    const newParticipants = isSelected
      ? currentParticipants.filter(id => id !== userId)
      : [...currentParticipants, userId];
    setSaving(true);
    try {
      await onUpdate(newParticipants);
    } catch (err) {
      toast.error('Erro ao atualizar participantes');
    } finally {
      setSaving(false);
    }
  };

  const participantUsers = useMemo(() => {
    return currentParticipants
      .map(id => users.find(u => u.id === id))
      .filter(Boolean);
  }, [currentParticipants, users]);

  const getName = (u) => u?.nome_customizado || u?.full_name || u?.email || '?';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-600" />
            Participantes do Grupo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Current participants */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">{participantUsers.length} participantes</p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {participantUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50">
                  <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                    {getName(u)[0].toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-medium text-slate-900 truncate">
                    {getName(u)}
                    {u.id === currentUser?.id && <span className="text-xs text-slate-400 ml-1">(você)</span>}
                  </span>
                  {u.id !== currentUser?.id && (
                    <button
                      onClick={() => handleToggle(u.id)}
                      disabled={saving}
                      className="p-1.5 rounded-full text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Remover participante"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add participants */}
          <div className="border-t border-slate-200 pt-3">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar para adicionar..."
                className="pl-9"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filtered.map(u => {
                const isSelected = currentParticipants.includes(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => handleToggle(u.id)}
                    disabled={saving || u.id === currentUser?.id}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left disabled:opacity-50 disabled:cursor-default",
                      isSelected ? "bg-violet-50" : "hover:bg-slate-100"
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                      {getName(u)[0].toUpperCase()}
                    </div>
                    <span className="flex-1 text-sm font-medium text-slate-900 truncate">{getName(u)}</span>
                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0", isSelected ? "bg-violet-600 border-violet-600" : "border-slate-300")}>
                      {isSelected ? <Check className="w-3 h-3 text-white" /> : <UserPlus className="w-3 h-3 text-slate-400" />}
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-4">Nenhum usuário encontrado</p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}