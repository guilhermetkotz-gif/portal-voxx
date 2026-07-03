import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Move, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Seção para mover o card da demanda entre colunas (setores) do Kanban.
 *
 * Props:
 * - setorAtual: setor atual da demanda
 * - columns: array de { id, name } com as colunas disponíveis
 * - onMove(novoSetor): callback ao confirmar movimentação
 * - isMoving: estado de loading
 */
export default function MoverCardSection({ setorAtual, columns, onMove, isMoving }) {
  const [selectedSetor, setSelectedSetor] = useState('');

  const handleConfirm = () => {
    if (!selectedSetor || selectedSetor === setorAtual) return;
    onMove(selectedSetor);
    setSelectedSetor('');
  };

  // Colunas disponíveis, exceto a atual e a coluna "Sem Setor"
  const availableColumns = columns.filter(
    c => c.id !== setorAtual && c.id !== '__SEM_SETOR__'
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Move className="w-4 h-4 text-violet-600" />
          Mover Card
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-500">
          Selecione a coluna de destino para mover este card no Kanban.
        </p>
        <select
          value={selectedSetor}
          onChange={(e) => setSelectedSetor(e.target.value)}
          disabled={isMoving}
          className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Escolher coluna...</option>
          {availableColumns.map(col => (
            <option key={col.id} value={col.id}>{col.name}</option>
          ))}
        </select>
        <Button
          onClick={handleConfirm}
          disabled={!selectedSetor || selectedSetor === setorAtual || isMoving}
          className="w-full bg-violet-600 hover:bg-violet-700"
        >
          {isMoving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Movendo...
            </>
          ) : (
            <>
              <ArrowRight className="h-4 w-4 mr-2" />
              Mover para coluna selecionada
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}