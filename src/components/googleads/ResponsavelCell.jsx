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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1 hover:text-violet-600 transition-colors">
          <UserCheck className="w-3 h-3" />
          <span>{getUserName(getResponsavelGoogleAds(account.account_name) || account.responsavel_voxx)}</span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atribuir Responsável Google Ads</DialogTitle>
          <p className="text-sm text-slate-500">{account.account_name}</p>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-2">
            {voxxUsers.map(u => (
              <button
                key={u.id}
                onClick={async (e) => {
                  e.stopPropagation();
                  await handleAssignResponsavel(account.id, account.account_name, u.id, () => setOpen(false));
                }}
                className="w-full text-left px-4 py-3 rounded-lg border hover:border-violet-600 hover:bg-violet-50 transition-colors cursor-pointer"
              >
                <div className="font-medium text-slate-900">{u.full_name}</div>
                <div className="text-xs text-slate-500">{u.email}</div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}