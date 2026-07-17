import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Search, X, Filter } from 'lucide-react';
import { CATEGORIAS, TIPOS_ORIENTACAO, ESCOPOS } from './constants';

const FILTROS_VAZIOS = {
  busca: '',
  categoria: 'all',
  tipo_orientacao: 'all',
  escopo_tipo: 'all',
  ativa: 'all',
  obrigatoria: 'all',
  exige_verificacao: 'all',
  prioridade: 'all',
};

export const FILTROS_INICIAIS = { ...FILTROS_VAZIOS };

export function filtrarOrientacoes(orientacoes, filtros) {
  return orientacoes.filter(o => {
    if (filtros.busca?.trim()) {
      const termo = filtros.busca.toLowerCase().trim();
      const matchTitulo = (o.titulo || '').toLowerCase().includes(termo);
      const matchConteudo = (o.conteudo || '').toLowerCase().includes(termo);
      const matchChave = (o.chave_tematica || '').toLowerCase().includes(termo);
      const matchPalavras = (o.palavras_chave || []).some(p => p.toLowerCase().includes(termo));
      if (!matchTitulo && !matchConteudo && !matchChave && !matchPalavras) return false;
    }
    if (filtros.categoria !== 'all' && o.categoria !== filtros.categoria) return false;
    if (filtros.tipo_orientacao !== 'all' && o.tipo_orientacao !== filtros.tipo_orientacao) return false;
    if (filtros.escopo_tipo !== 'all' && o.escopo_tipo !== filtros.escopo_tipo) return false;
    if (filtros.ativa !== 'all' && o.ativa !== (filtros.ativa === 'true')) return false;
    if (filtros.obrigatoria !== 'all' && o.obrigatoria !== (filtros.obrigatoria === 'true')) return false;
    if (filtros.exige_verificacao !== 'all' && o.exige_verificacao !== (filtros.exige_verificacao === 'true')) return false;
    if (filtros.prioridade !== 'all' && (o.prioridade || 5) !== Number(filtros.prioridade)) return false;
    return true;
  });
}

export function hasFiltrosAtivos(filtros) {
  return Object.entries(filtros).some(([key, val]) => val !== FILTROS_VAZIOS[key]);
}

export default function FiltrosBar({ filtros, setFiltros }) {
  const update = (key, value) => setFiltros(prev => ({ ...prev, [key]: value }));
  const limpar = () => setFiltros({ ...FILTROS_VAZIOS });
  const ativo = hasFiltrosAtivos(filtros);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por título, conteúdo, chave temática ou palavra-chave..."
            value={filtros.busca}
            onChange={e => update('busca', e.target.value)}
            className="pl-9"
          />
        </div>
        {ativo && (
          <Button variant="outline" size="sm" onClick={limpar} className="flex items-center gap-1.5">
            <X className="w-4 h-4" /> Limpar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <Select value={filtros.categoria} onValueChange={v => update('categoria', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtros.tipo_orientacao} onValueChange={v => update('tipo_orientacao', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            {TIPOS_ORIENTACAO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtros.escopo_tipo} onValueChange={v => update('escopo_tipo', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Escopo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos escopos</SelectItem>
            {ESCOPOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtros.ativa} onValueChange={v => update('ativa', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="true">Ativas</SelectItem>
            <SelectItem value="false">Inativas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtros.obrigatoria} onValueChange={v => update('obrigatoria', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Obrigatória" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="true">Obrigatórias</SelectItem>
            <SelectItem value="false">Não obrigatórias</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtros.exige_verificacao} onValueChange={v => update('exige_verificacao', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Verificação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="true">Exigem verificação</SelectItem>
            <SelectItem value="false">Sem exigência</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtros.prioridade} onValueChange={v => update('prioridade', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            {[1,2,3,4,5,6,7,8,9,10].map(p => <SelectItem key={p} value={String(p)}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5 text-xs text-slate-400 px-1">
          <Filter className="w-3.5 h-3.5" />
          <span>Filtros</span>
        </div>
      </div>
    </div>
  );
}