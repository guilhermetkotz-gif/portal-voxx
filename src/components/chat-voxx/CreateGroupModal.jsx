import React, { useState, useMemo, useRef } from 'react';
import { Search, Check, X, Users, Camera } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';

export default function CreateGroupModal({ open, onClose, users, currentUser, onCreate }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [groupPhoto, setGroupPhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    const getName = (u) => u.nome_customizado || u.full_name || '';
    return users.filter(u =>
      getName(u).toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const toggleUser = (userId) => {
    setSelected(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingPhoto(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setGroupPhoto(file_url);
    } catch (err) {
      console.error('Erro ao enviar foto:', err);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreate = () => {
    if (selected.length < 1) return;
    const name = groupName.trim() || selected.map(id => { const u = users.find(u => u.id === id); return u?.nome_customizado || u?.full_name; }).filter(Boolean).join(', ').substring(0, 50);
    onCreate({
      nome_grupo: name,
      participantes: [currentUser.id, ...selected],
      is_group: true,
      criador_id: currentUser.id,
      foto_grupo: groupPhoto || undefined
    });
    setSelected([]);
    setGroupName('');
    setGroupPhoto(null);
    onClose();
  };

  const handleClose = () => {
    setSelected([]);
    setGroupName('');
    setGroupPhoto(null);
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
          {/* Group photo */}
          <div className="flex flex-col items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="relative w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white overflow-hidden hover:opacity-90 transition-opacity"
            >
              {groupPhoto ? (
                <img src={groupPhoto} alt="" className="w-full h-full object-cover" />
              ) : (
                <Users className="w-8 h-8" />
              )}
              <span className="absolute bottom-0 right-0 w-7 h-7 bg-violet-600 rounded-full flex items-center justify-center border-2 border-white">
                <Camera className="w-3.5 h-3.5" />
              </span>
            </button>
            <p className="text-xs text-slate-400">{uploadingPhoto ? 'Enviando...' : 'Foto do grupo (opcional)'}</p>
          </div>

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
                    {u?.nome_customizado || u?.full_name || u?.email}
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
                    {(u.nome_customizado || u.full_name || u.email || '?')[0].toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-medium text-slate-900 truncate">{u.nome_customizado || u.full_name || u.email}</span>
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
          <Button onClick={handleCreate} disabled={selected.length < 1 || uploadingPhoto} className="bg-violet-600 hover:bg-violet-700">
            Criar Grupo ({selected.length + 1})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}