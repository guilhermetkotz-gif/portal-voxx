import React from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function BotaoSomAlertas({ somAtivado, onToggle }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={somAtivado ? 'default' : 'outline'}
            size="sm"
            onClick={onToggle}
            className={somAtivado
              ? 'bg-violet-600 hover:bg-violet-700 text-white gap-1.5'
              : 'gap-1.5 text-slate-500'
            }
          >
            {somAtivado ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
            <span className="hidden sm:inline text-xs">
              {somAtivado ? 'Som ativo' : 'Ativar som'}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {somAtivado
            ? 'Som de alertas ativado — clique para desativar'
            : 'Ativar som para alertas importantes'
          }
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}