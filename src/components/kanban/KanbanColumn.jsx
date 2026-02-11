import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import KanbanDemandCard from './KanbanDemandCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { GripVertical, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const KanbanColumn = ({ title, demands, id, onCardClick, dragHandleProps, isMinimized, onToggleMinimize, allTags }) => {
  const queryClient = useQueryClient();

  const handleUpdateTags = (demandaId, newTags) => {
    base44.entities.Demanda.update(demandaId, { tags: newTags })
      .then(() => {
        queryClient.invalidateQueries(['demandasKanban']);
        toast.success('Tags atualizadas!');
      })
      .catch((error) => {
        toast.error('Erro ao atualizar tags: ' + error.message);
      });
  };

  return (
    <Card className={cn(
      "flex flex-col flex-shrink-0 max-h-[calc(100vh-200px)]",
      isMinimized ? "w-64" : "w-80"
    )}>
      <CardHeader className="p-4 border-b bg-slate-50">
        <div className="flex items-center gap-2">
          <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4 text-slate-400" />
          </div>
          <CardTitle className="text-base font-semibold text-slate-900 flex-1">
            {title} <span className="text-sm font-normal text-slate-500">({demands.length})</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMinimize}
            className="h-7 w-7 flex-shrink-0"
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <Droppable droppableId={id}>
        {(provided, snapshot) => (
          <CardContent
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-grow p-3 overflow-y-auto",
              snapshot.isDraggingOver ? "bg-violet-50" : "bg-white"
            )}
          >
            {demands.map((demanda, index) => (
              <Draggable key={demanda.id} draggableId={demanda.id} index={index}>
                {(providedDraggable, snapshotDraggable) => (
                  <div
                    ref={providedDraggable.innerRef}
                    {...providedDraggable.draggableProps}
                    {...providedDraggable.dragHandleProps}
                    className={cn(snapshotDraggable.isDragging && "opacity-50")}
                  >
                    <KanbanDemandCard 
                      demanda={demanda} 
                      onClick={onCardClick} 
                      isMinimized={isMinimized}
                      onUpdateTags={(tags) => handleUpdateTags(demanda.id, tags)}
                      allTags={allTags}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {demands.length === 0 && (
              <p className="text-center text-slate-400 text-sm py-8">Nenhuma demanda</p>
            )}
          </CardContent>
        )}
      </Droppable>
    </Card>
  );
};

export default KanbanColumn;