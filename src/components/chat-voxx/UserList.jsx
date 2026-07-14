import React, { useState, useMemo } from 'react';
import { Search, Users, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import moment from 'moment';

export default function UserList({ users, groups, currentUserId, selectedConversationId, onSelectUser, onSelectGroup, getUserPreview, onCreateGroup }) {
  const [search, setSearch] = useState('');

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u =>
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter(g => (g.nome_grupo || '').toLowerCase().includes(q));
  }, [groups, search]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const m = moment(timestamp);
    if (m.isSame(moment(), 'day')) return m.format('HH:mm');
    if (m.isSame(moment().subtract(1, 'day'), 'day')) return 'Ontem';
    return m.format('DD/MM');
  };

  const renderPreview = (preview) => {
    if (!preview) return null;
    const tipo = preview.ultima_mensagem_tipo;
    if (tipo === 'imagem') return '📷 Foto';
    if (tipo === 'video') return '🎥 Vídeo';
    if (tipo === 'documento') return '📄 Documento';
    if (tipo === 'sticker') return '🎨 Figurinha';
    if (tipo === 'audio') return '🎵 Áudio';
    return preview.ultima_mensagem_preview || '';
  };

  return (
    <>
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900">Chat Voxx</h2>
          <Button size="sm" onClick={onCreateGroup} className="bg-violet-600 hover:bg-violet-700 h-8 gap-1.5">
            <Users className="w-4 h-4" /> Grupo
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar contato ou grupo..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Groups */}
        {filteredGroups.length > 0 && (
          <div className="border-b border-slate-200">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 pt-3 pb-1">Grupos</p>
            {filteredGroups.map((g) => {
              const isSelected = selectedConversationId === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => onSelectGroup(g)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-100 transition-colors text-left border-l-2",
                    isSelected ? "bg-violet-50 border-violet-600" : "border-transparent"
                  )}
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900 text-sm truncate">{g.nome_grupo}</span>
                      {g.timestamp_ultima_atividade && (
                        <span className="text-xs text-slate-400 flex-shrink-0 ml-2">{formatTime(g.timestamp_ultima_atividade)}</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 truncate block">
                      {g.ultima_mensagem_preview ? renderPreview(g) : `${g.participantes?.length || 0} participantes`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Direct contacts */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 pt-3 pb-1">Contatos</p>
          {filteredUsers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Nenhum contato encontrado</p>
          ) : (
            filteredUsers.map((u) => {
              const preview = getUserPreview?.(u.id);
              const isSelected = selectedConversationId === preview?.convId;
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
                      <span className="font-medium text-slate-900 text-sm truncate">{u.full_name || u.email}</span>
                      {preview?.timestamp && (
                        <span className="text-xs text-slate-400 flex-shrink-0 ml-2">{formatTime(preview.timestamp)}</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 truncate block">
                      {preview?.preview ? renderPreview({ ultima_mensagem_preview: preview.preview, ultima_mensagem_tipo: preview.tipo }) : (u.cargo || 'Iniciar conversa')}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}