import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tag, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const TAG_COLORS = [
  'bg-red-100 text-red-700 border-red-300',
  'bg-orange-100 text-orange-700 border-orange-300',
  'bg-yellow-100 text-yellow-700 border-yellow-300',
  'bg-green-100 text-green-700 border-green-300',
  'bg-blue-100 text-blue-700 border-blue-300',
  'bg-indigo-100 text-indigo-700 border-indigo-300',
  'bg-purple-100 text-purple-700 border-purple-300',
  'bg-pink-100 text-pink-700 border-pink-300',
];

export default function TagManagerPopover({ demanda, onUpdateTags, availableTags = [] }) {
  const [open, setOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const currentTags = demanda.tags || [];

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    const normalized = newTag.trim().toLowerCase();
    if (currentTags.includes(normalized)) return;
    
    onUpdateTags([...currentTags, normalized]);
    setNewTag('');
  };

  const handleRemoveTag = (tag) => {
    onUpdateTags(currentTags.filter(t => t !== tag));
  };

  const handleToggleExistingTag = (tag) => {
    if (currentTags.includes(tag)) {
      onUpdateTags(currentTags.filter(t => t !== tag));
    } else {
      onUpdateTags([...currentTags, tag]);
    }
  };

  const getTagColor = (index) => {
    return TAG_COLORS[index % TAG_COLORS.length];
  };

  const unusedTags = availableTags.filter(tag => !currentTags.includes(tag));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="outline" size="sm" className="h-8">
          <Tag className="w-3.5 h-3.5 mr-1.5" />
          Tags {currentTags.length > 0 && `(${currentTags.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-2">Tags da Demanda</h4>
            {currentTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {currentTags.map((tag, idx) => (
                  <Badge
                    key={tag}
                    className={cn('border cursor-pointer group', getTagColor(idx))}
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag}
                    <X className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 mb-3">Nenhuma tag adicionada</p>
            )}
          </div>

          {unusedTags.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Tags Existentes</h4>
              <div className="flex flex-wrap gap-1.5">
                {unusedTags.map((tag, idx) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="cursor-pointer hover:bg-slate-100"
                    onClick={() => handleToggleExistingTag(tag)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="font-semibold text-sm mb-2">Criar Nova Tag</h4>
            <div className="flex gap-2">
              <Input
                placeholder="Nome da tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                className="h-8"
              />
              <Button 
                size="sm" 
                onClick={handleAddTag}
                disabled={!newTag.trim()}
                className="bg-violet-600 hover:bg-violet-700"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}