import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import moment from 'moment';

export default function UserList({ users, currentUserId, selectedUserId, onSelectUser, getUserPreview }) {
  const [search, setSearch] = useState('');

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u =>
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.cargo || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const m = moment(timestamp);
    if (m.isSame(moment(), 'day')) return m.format('HH:mm');
    if (m.isSame(moment().subtract(1, 'day'), 'day')) return 'Ontem';
    return m.format('DD/MM');
  };

  return (
    <>
      <div className="p-4 border-b border-slate-200">
        <h2 className="font-bold text-slate-900 mb-3">Chat Voxx</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar contato..."
            className="pl-9"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Nenhum contato encontrado</p>
        ) : (
          filteredUsers.map((u) => {
            const preview = getUserPreview?.(u.id);
            const isSelected = selectedUserId === u.id;
            return (
              <button
                key={u.id}
                onClick={() => onSelectUser(u.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-100 transition-colors text-left border-l-2",
                  isSelected ? "bg-violet-50 border-violet-600" : "border-transparent"
                )}
              >
                {u.profile_picture ? (
                  <img src={u.profile_picture} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-violet-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                    {(u.full_name || u.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 text-sm truncate">
                      {u.full_name || u.email}
                    </span>
                    {preview?.timestamp && (
                      <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                        {formatTime(preview.timestamp)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 truncate block">
                    {preview?.preview || u.cargo || 'Iniciar conversa'}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}