import React, { useState, useMemo } from 'react';
import { Search, Users, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import moment from 'moment-timezone';

export default function UserList({ users, groups, currentUserId, selectedConversationId, onSelectUser, onSelectGroup, getUserPreview, onCreateGroup, unreadByUserId = {}, unreadByGroupId = {} }) {
  const [search, setSearch] = useState('');

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u => {
      const name = u.nome_customizado || u.full_name || '';
      return name.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
    });
  }, [users, search]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter(g => (g.nome_grupo || '').toLowerCase().includes(q));
  }, [groups, search]);

  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      const previewA = getUserPreview?.(a.id);
      const previewB = getUserPreview?.(b.id);
      const unreadA = unreadByUserId[a.id] || 0;
      const unreadB = unreadByUserId[b.id] || 0;

      if (unreadA > 0 && unreadB === 0) return -1;
      if (unreadA === 0 && unreadB > 0) return 1;

      const tsA = previewA?.timestamp || '';
      const tsB = previewB?.timestamp || '';
      if (tsA && tsB) {
        if (tsA > tsB) return -1;
        if (tsA < tsB) return 1;
      } else if (tsA) {
        return -1;
      } else if (tsB) {
        return 1;
      }

      const nameA = a.nome_customizado || a.full_name || a.email || '';
      const nameB = b.nome_customizado || b.full_name || b.email || '';
      return nameA.localeCompare(nameB);
    });
  }, [filteredUsers, getUserPreview, unreadByUserId]);

  const sortedGroups = useMemo(() => {
    return [...filteredGroups].sort((a, b) => {
      const unreadA = unreadByGroupId[a.id] || 0;
      const unreadB = unreadByGroupId[b.id] || 0;

      if (unreadA > 0 && unreadB === 0) return -1;
      if (unreadA === 0 && unreadB > 0) return 1;

      const tsA = a.timestamp_ultima_atividade || '';
      const tsB = b.timestamp_ultima_atividade || '';
      if (tsA && tsB) {
        if (tsA > tsB) return -1;
        if (tsA < tsB) return 1;
      }

      return (a.nome_grupo || '').localeCompare(b.nome_grupo || '');
    });
  }, [filteredGroups, unreadByGroupId]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const m = moment.tz(timestamp, 'America/Sao_Paulo');
    const now = moment.tz('America/Sao_Paulo');
    if (m.isSame(now, 'day')) return m.format('HH:mm');
    if (m.isSame(now.clone().subtract(1, 'day'), 'day')) return 'Ontem';
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

  const renderUnreadBadge = (count) => {
    if (!count || count === 0) return null;
    return (
      <span className="bg-violet-600 text-white text-xs font-semibold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
        {count > 99 ? '99+' : count}
      </span>
    );
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
        {sortedGroups.length > 0 && (
          <div className="border-b border-slate-200">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 pt-3 pb-1">Grupos</p>
            {sortedGroups.map((g) => {
              const isSelected = selectedConversationId === g.id;
              const unreadCount = unreadByGroupId[g.id] || 0;
              const hasUnread = unreadCount > 0;
              return (
                <button
                  key={g.id}
                  onClick={() => onSelectGroup(g)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-100 transition-colors text-left border-l-2",
                    isSelected ? "bg-violet-50 border-violet-600" : hasUnread ? "bg-violet-50/50 border-violet-300" : "border-transparent"
                  )}
                >
                  {g.foto_grupo ? (
                    <img src={g.foto_grupo} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-sm truncate", hasUnread ? "font-bold text-slate-900" : "font-medium text-slate-900")}>{g.nome_grupo}</span>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {renderUnreadBadge(unreadCount)}
                        {g.timestamp_ultima_atividade && (
                          <span className={cn("text-xs", hasUnread ? "text-violet-600 font-medium" : "text-slate-400")}>{formatTime(g.timestamp_ultima_atividade)}</span>
                        )}
                      </div>
                    </div>
                    <span className={cn("text-xs truncate block", hasUnread ? "text-slate-700 font-medium" : "text-slate-500")}>
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
          {sortedUsers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Nenhum contato encontrado</p>
          ) : (
            sortedUsers.map((u) => {
              const preview = getUserPreview?.(u.id);
              const isSelected = selectedConversationId === preview?.convId;
              const unreadCount = unreadByUserId[u.id] || 0;
              const hasUnread = unreadCount > 0;
              return (
                <button
                  key={u.id}
                  onClick={() => onSelectUser(u.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-100 transition-colors text-left border-l-2",
                    isSelected ? "bg-violet-50 border-violet-600" : hasUnread ? "bg-violet-50/50 border-violet-300" : "border-transparent"
                  )}
                >
                  {u.profile_picture ? (
                    <img src={u.profile_picture} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-violet-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {(u.nome_customizado || u.full_name || u.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-sm truncate", hasUnread ? "font-bold text-slate-900" : "font-medium text-slate-900")}>{u.nome_customizado || u.full_name || u.email}</span>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {renderUnreadBadge(unreadCount)}
                        {preview?.timestamp && (
                          <span className={cn("text-xs", hasUnread ? "text-violet-600 font-medium" : "text-slate-400")}>{formatTime(preview.timestamp)}</span>
                        )}
                      </div>
                    </div>
                    <span className={cn("text-xs truncate block", hasUnread ? "text-slate-700 font-medium" : "text-slate-500")}>
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