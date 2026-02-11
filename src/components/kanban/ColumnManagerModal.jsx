import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit2, Trash2, GripVertical, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';

export default function ColumnManagerModal({ open, onClose, columns, onSave }) {
  const [editingColumns, setEditingColumns] = useState(columns);
  const [editingId, setEditingId] = useState(null);
  const [newColumnName, setNewColumnName] = useState('');

  const handleAddColumn = () => {
    if (!newColumnName.trim()) return;
    
    const newColumn = {
      column_id: `CUSTOM_${Date.now()}`,
      name: newColumnName,
      order: editingColumns.length,
      is_custom: true,
      active: true,
      isNew: true
    };
    
    setEditingColumns([...editingColumns, newColumn]);
    setNewColumnName('');
  };

  const handleEditColumn = (columnId, newName) => {
    setEditingColumns(editingColumns.map(col => 
      col.column_id === columnId ? { ...col, name: newName } : col
    ));
    setEditingId(null);
  };

  const handleDeleteColumn = (columnId) => {
    if (!confirm('Tem certeza que deseja excluir esta coluna?')) return;
    setEditingColumns(editingColumns.filter(col => col.column_id !== columnId));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(editingColumns);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const reordered = items.map((col, index) => ({ ...col, order: index }));
    setEditingColumns(reordered);
  };

  const handleSave = () => {
    onSave(editingColumns);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Colunas do Kanban</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Add New Column */}
          <div className="border rounded-lg p-4 bg-slate-50">
            <Label className="text-sm font-semibold mb-2 block">Nova Coluna</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Nome da coluna..."
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddColumn()}
              />
              <Button onClick={handleAddColumn} disabled={!newColumnName.trim()}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>

          {/* Existing Columns */}
          <div>
            <Label className="text-sm font-semibold mb-3 block">
              Colunas Existentes ({editingColumns.length})
            </Label>
            <p className="text-xs text-slate-500 mb-3">
              Arraste para reordenar. Clique no nome para editar.
            </p>

            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="columns">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-2"
                  >
                    {editingColumns.map((column, index) => (
                      <Draggable
                        key={column.column_id}
                        draggableId={column.column_id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={cn(
                              "flex items-center gap-3 p-3 bg-white border rounded-lg",
                              snapshot.isDragging && "shadow-lg",
                              column.isNew && "border-green-300 bg-green-50"
                            )}
                          >
                            <div {...provided.dragHandleProps} className="cursor-grab">
                              <GripVertical className="w-5 h-5 text-slate-400" />
                            </div>

                            <div className="flex-1">
                              {editingId === column.column_id ? (
                                <div className="flex gap-2">
                                  <Input
                                    value={column.name}
                                    onChange={(e) =>
                                      setEditingColumns(
                                        editingColumns.map((c) =>
                                          c.column_id === column.column_id
                                            ? { ...c, name: e.target.value }
                                            : c
                                        )
                                      )
                                    }
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        setEditingId(null);
                                      }
                                    }}
                                    autoFocus
                                    className="h-8"
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingId(null)}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{column.name}</span>
                                  {!column.is_custom && (
                                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                      Padrão
                                    </span>
                                  )}
                                  {column.isNew && (
                                    <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">
                                      Nova
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(column.column_id)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              {column.is_custom && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteColumn(column.column_id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-violet-600 hover:bg-violet-700">
              Salvar Alterações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}