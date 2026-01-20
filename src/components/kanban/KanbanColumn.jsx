import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import KanbanDemandCard from './KanbanDemandCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const KanbanColumn = ({ title, demands, id }) => {
  return (
    <Card className="flex flex-col flex-shrink-0 w-80 max-h-[calc(100vh-200px)]">
      <CardHeader className="p-4 border-b bg-slate-50">
        <CardTitle className="text-base font-semibold text-slate-900">
          {title} <span className="text-sm font-normal text-slate-500">({demands.length})</span>
        </CardTitle>
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
                    <KanbanDemandCard demanda={demanda} />
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