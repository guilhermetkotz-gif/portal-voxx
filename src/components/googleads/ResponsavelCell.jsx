import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserCheck } from 'lucide-react';

export default function ResponsavelCell({ 
  account, 
  voxxUsers, 
  getUserName, 
  getResponsavelGoogleAds, 
  handleAssignResponsavel 
}) {
  const [open, setOpen] = useState(false);

  const handleUserClick = async (userId, userName) => {
    console.log('Botão clicado! Usuário:', userName, 'ID:', userId);
    console.log('Account:', account.account_name);
    
    try {
      await handleAssignResponsavel(account.id, account.account_name, userId);
      setOpen(false);
    } catch (error) {
      console.error('Erro no handleUserClick:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1 hover:text-violet-600 transition-colors">
          <UserCheck className="w-3 h-3" />
          <span>{getUserName(getResponsavelGoogleAds(account.account_name) || account.responsavel_voxx)}</span>
        </button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Atribuir Responsável Google Ads</DialogTitle>
          <p className="text-sm text-slate-500">{account.account_name}</p>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-2">
            {voxxUsers.length === 0 ? (
              <p className="text-sm text-slate-500 p-4">Nenhum usuário Voxx encontrado</p>
            ) : (
              voxxUsers.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Click capturado no botão:', u.full_name);
                    handleUserClick(u.id, u.full_name);
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg border hover:border-violet-600 hover:bg-violet-50 transition-colors cursor-pointer active:bg-violet-100"
                >
                  <div className="font-medium text-slate-900">{u.full_name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}