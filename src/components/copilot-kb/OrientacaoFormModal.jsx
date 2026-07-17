import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, X, Plus, Search, Info } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { CATEGORIAS, TIPOS_ORIENTACAO, ESCOPOS, SEGMENTOS_CLIENTE, TIPOS_EXIGEM_CHAVE } from './constants';
import { cn } from '@/lib/utils';

const CAMPOS_INICIAIS = {
  titulo: '', conteudo: '', categoria: '', tipo_orientacao: '',
  escopo_tipo: 'global', escopo_segmento: '', escopo_marca: '',
  escopo_cliente_id: '', escopo_cliente_nome: '',
  chave_tematica: '', prioridade: 5, palavras_chave: [],
  obrigatoria: false, exige_verificacao: false,
};

export default function OrientacaoFormModal({ open, onClose, orientacaoEdit, permissoes, executarAcao, onConflito }) {
  const isEdit = !!orientacaoEdit;
  const [form, setForm] = useState(CAMPOS_INICIAIS);
  const [errors, setErrors] = useState({});
  const [motivo, setMotivo] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteResultados, setClienteResultados] = useState([]);
  const [searchingClientes, setSearchingClientes] = useState(false);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const searchTimer = useRef(null);

  const categoriasDisponiveis = CATEGORIAS.filter(c =>
    (permissoes?.categorias_administraveis || []).includes(c.value)
  );

  useEffect(() => {
    if (open && orientacaoEdit) {
      setForm({
        titulo: orientacaoEdit.titulo || '',
        conteudo: orientacaoEdit.conteudo || '',
        categoria: orientacaoEdit.categoria || '',
        tipo_orientacao: orientacaoEdit.tipo_orientacao || '',
        escopo_tipo: orientacaoEdit.escopo_tipo || 'global',
        escopo_segmento: orientacaoEdit.escopo_segmento || '',
        escopo_marca: orientacaoEdit.escopo_marca || '',
        escopo_cliente_id: orientacaoEdit.escopo_cliente_id || '',
        escopo_cliente_nome: orientacaoEdit.escopo_cliente_nome || '',
        chave_tematica: orientacaoEdit.chave_tematica || '',
        prioridade: orientacaoEdit.prioridade || 5,
        palavras_chave: orientacaoEdit.palavras_chave || [],
        obrigatoria: orientacaoEdit.obrigatoria || false,
        exige_verificacao: orientacaoEdit.exige_verificacao || false,
      });
      setMotivo('');
    } else if (open && !orientacaoEdit) {
      setForm(CAMPOS_INICIAIS);
      setMotivo('');
      // Pre-select first available category if only one
      if (categoriasDisponiveis.length === 1) {
        setForm(prev => ({ ...prev, categoria: categoriasDisponiveis[0].value }));
      }
    }
    setErrors({});
    setKeywordInput('');
    setClienteSearch('');
    setClienteResultados([]);
    setShowClienteDropdown(false);
  }, [open, orientacaoEdit]);

  // Fetch marcas for select
  const { data: marcas = [] } = useQuery({
    queryKey: ['clienteMarcasDistinct'],
    queryFn: async () => {
      const clientes = await base44.entities.Cliente.list('-updated_date', 500);
      const marcas = [...new Set(clientes.map(c => c.marca).filter(Boolean))];
      return marcas.sort();
    },
    enabled: open && form.escopo_tipo === 'marca',
    staleTime: 5 * 60 * 1000,
  });

  // Cliente search
  useEffect(() => {
    if (form.escopo_tipo !== 'cliente') return;
    if (!clienteSearch.trim()) {
      setClienteResultados([]);
      setShowClienteDropdown(false);
      return;
    }
    setSearchingClientes(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const all = await base44.entities.Cliente.list('-updated_date', 500);
        const termo = clienteSearch.toLowerCase();
        const filtered = all.filter(c =>
          (c.nome || '').toLowerCase().includes(termo) ||
          (c.razao_social || '').toLowerCase().includes(termo)
        ).slice(0, 10);
        setClienteResultados(filtered);
        setShowClienteDropdown(true);
      } catch {
        setClienteResultados([]);
      } finally {
        setSearchingClientes(false);
      }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [clienteSearch, form.escopo_tipo]);

  const update = (key, value) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'escopo_tipo') {
        next.escopo_segmento = '';
        next.escopo_marca = '';
        next.escopo_cliente_id = '';
        next.escopo_cliente_nome = '';
        setClienteSearch('');
      }
      if (key === 'tipo_orientacao' && !TIPOS_EXIGEM_CHAVE.includes(value)) {
        // Keep chave_tematica but it's not required
      }
      return next;
    });
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const addKeyword = () => {
    const tag = keywordInput.trim().replace(/\s+/g, ' ');
    if (!tag) return;
    if (form.palavras_chave.includes(tag)) {
      setKeywordInput('');
      return;
    }
    update('palavras_chave', [...form.palavras_chave, tag]);
    setKeywordInput('');
  };

  const removeKeyword = (tag) => {
    update('palavras_chave', form.palavras_chave.filter(k => k !== tag));
  };

  const selectCliente = (cliente) => {
    setForm(prev => ({ ...prev, escopo_cliente_id: cliente.id, escopo_cliente_nome: cliente.nome }));
    setClienteSearch(cliente.nome);
    setShowClienteDropdown(false);
  };

  const validate = () => {
    const e = {};
    if (!form.titulo.trim()) e.titulo = 'Título é obrigatório.';
    if (!form.conteudo.trim()) e.conteudo = 'Conteúdo é obrigatório.';
    if (form.conteudo.length > 800) e.conteudo = 'Conteúdo deve ter no máximo 800 caracteres.';
    if (!form.categoria) e.categoria = 'Categoria é obrigatória.';
    if (!form.tipo_orientacao) e.tipo_orientacao = 'Tipo de orientação é obrigatório.';

    if (form.escopo_tipo === 'segmento' && !form.escopo_segmento) e.escopo = 'Selecione o segmento.';
    if (form.escopo_tipo === 'marca' && !form.escopo_marca) e.escopo = 'Selecione a marca.';
    if (form.escopo_tipo === 'cliente' && !form.escopo_cliente_id) e.escopo = 'Selecione o cliente.';

    if (TIPOS_EXIGEM_CHAVE.includes(form.tipo_orientacao) && !form.chave_tematica?.trim()) {
      e.chave_tematica = 'Chave temática é obrigatória para este tipo de orientação.';
    }

    const p = Number(form.prioridade);
    if (isNaN(p) || p < 1 || p > 10) e.prioridade = 'Prioridade deve estar entre 1 e 10.';

    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const dados = {
      titulo: form.titulo.trim(),
      conteudo: form.conteudo.trim(),
      categoria: form.categoria,
      tipo_orientacao: form.tipo_orientacao,
      escopo_tipo: form.escopo_tipo,
      escopo_segmento: form.escopo_tipo === 'segmento' ? form.escopo_segmento : '',
      escopo_marca: form.escopo_tipo === 'marca' ? form.escopo_marca : '',
      escopo_cliente_id: form.escopo_tipo === 'cliente' ? form.escopo_cliente_id : '',
      chave_tematica: form.chave_tematica?.trim() || '',
      prioridade: Number(form.prioridade),
      palavras_chave: form.palavras_chave,
      obrigatoria: form.obrigatoria,
      exige_verificacao: form.exige_verificacao,
    };

    try {
      if (isEdit) {
        await executarAcao('editar', { orientacao_id: orientacaoEdit.id, dados, motivo: motivo.trim() || 'Edição' });
        toast.success('Orientação atualizada com sucesso.');
      } else {
        await executarAcao('criar', { dados });
        toast.success('Orientação criada com sucesso.');
      }
      onClose();
    } catch (err) {
      if (err.conflito) {
        onConflito(dados, err.conflitante_id, isEdit, isEdit ? orientacaoEdit.id : null);
      } else {
        toast.error(err.message || 'Não foi possível salvar a orientação.');
      }
    }
  };

  const exigeChave = TIPOS_EXIGEM_CHAVE.includes(form.tipo_orientacao);
  const conteudoLen = form.conteudo.length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar orientação' : 'Nova orientação'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Edite os campos da orientação. Uma nova versão será registrada no histórico.' : 'Crie uma nova orientação para a base de conhecimento do Copilot.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Título */}
          <div>
            <Label htmlFor="titulo">Título *</Label>
            <Input id="titulo" value={form.titulo} onChange={e => update('titulo', e.target.value)} placeholder="Título curto da orientação" className="mt-1" />
            {errors.titulo && <p className="text-xs text-red-500 mt-1">{errors.titulo}</p>}
          </div>

          {/* Conteúdo */}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="conteudo">Conteúdo *</Label>
              <span className={cn('text-xs', conteudoLen > 800 ? 'text-red-500 font-medium' : 'text-slate-400')}>
                {conteudoLen} / 800
              </span>
            </div>
            <Textarea
              id="conteudo"
              value={form.conteudo}
              onChange={e => update('conteudo', e.target.value)}
              placeholder="Texto da orientação..."
              className="mt-1"
              rows={4}
              maxLength={900}
            />
            {errors.conteudo && <p className="text-xs text-red-500 mt-1">{errors.conteudo}</p>}
          </div>

          {/* Categoria + Tipo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Categoria *</Label>
              <Select value={form.categoria} onValueChange={v => update('categoria', v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {categoriasDisponiveis.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.categoria && <p className="text-xs text-red-500 mt-1">{errors.categoria}</p>}
              {categoriasDisponiveis.length === 0 && <p className="text-xs text-amber-600 mt-1">Você não tem categorias administráveis.</p>}
            </div>

            <div>
              <Label>Tipo de orientação *</Label>
              <Select value={form.tipo_orientacao} onValueChange={v => update('tipo_orientacao', v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {TIPOS_ORIENTACAO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.tipo_orientacao && (
                <p className="text-xs text-slate-400 mt-1 flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {TIPOS_ORIENTACAO.find(t => t.value === form.tipo_orientacao)?.desc}
                </p>
              )}
              {errors.tipo_orientacao && <p className="text-xs text-red-500 mt-1">{errors.tipo_orientacao}</p>}
            </div>
          </div>

          {/* Escopo */}
          <div>
            <Label>Tipo de escopo *</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ESCOPOS.map(e => (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => update('escopo_tipo', e.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                    form.escopo_tipo === e.value
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                  )}
                >
                  {e.label}
                </button>
              ))}
            </div>
            {errors.escopo && <p className="text-xs text-red-500 mt-1">{errors.escopo}</p>}
          </div>

          {/* Escopo: Segmento */}
          {form.escopo_tipo === 'segmento' && (
            <div>
              <Label>Segmento *</Label>
              <Select value={form.escopo_segmento} onValueChange={v => update('escopo_segmento', v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o segmento..." /></SelectTrigger>
                <SelectContent>
                  {SEGMENTOS_CLIENTE.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Escopo: Marca */}
          {form.escopo_tipo === 'marca' && (
            <div>
              <Label>Marca *</Label>
              <Select value={form.escopo_marca} onValueChange={v => update('escopo_marca', v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a marca..." /></SelectTrigger>
                <SelectContent>
                  {marcas.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              {marcas.length === 0 && <p className="text-xs text-slate-400 mt-1">Carregando marcas...</p>}
            </div>
          )}

          {/* Escopo: Cliente */}
          {form.escopo_tipo === 'cliente' && (
            <div className="relative">
              <Label>Cliente *</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={clienteSearch}
                  onChange={e => setClienteSearch(e.target.value)}
                  placeholder="Buscar cliente por nome..."
                  className="pl-9"
                  onFocus={() => clienteResultados.length > 0 && setShowClienteDropdown(true)}
                  onBlur={() => setTimeout(() => setShowClienteDropdown(false), 200)}
                />
                {searchingClientes && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
              </div>
              {showClienteDropdown && clienteResultados.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {clienteResultados.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCliente(c)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors text-sm"
                    >
                      <p className="font-medium text-slate-900">{c.nome}</p>
                      <p className="text-xs text-slate-400">{c.cidade} — {c.estado}</p>
                    </button>
                  ))}
                </div>
              )}
              {form.escopo_cliente_nome && (
                <p className="text-xs text-emerald-600 mt-1">Cliente selecionado: {form.escopo_cliente_nome}</p>
              )}
            </div>
          )}

          {/* Chave temática + Prioridade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="chave">Chave temática {exigeChave && '*'}</Label>
              <Input
                id="chave"
                value={form.chave_tematica}
                onChange={e => update('chave_tematica', e.target.value)}
                placeholder="Identificador temático"
                className="mt-1"
              />
              <p className="text-xs text-slate-400 mt-1 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                Utilizada para identificar regras equivalentes, substituições e conflitos.
              </p>
              {errors.chave_tematica && <p className="text-xs text-red-500 mt-1">{errors.chave_tematica}</p>}
            </div>

            <div>
              <Label>Prioridade</Label>
              <Select value={String(form.prioridade)} onValueChange={v => update('prioridade', Number(v))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,7,8,9,10].map(p => <SelectItem key={p} value={String(p)}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 mt-1">Peso 1-10 para desempate dentro do mesmo escopo.</p>
              {errors.prioridade && <p className="text-xs text-red-500 mt-1">{errors.prioridade}</p>}
            </div>
          </div>

          {/* Palavras-chave */}
          <div>
            <Label>Palavras-chave</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                placeholder="Adicionar palavra-chave..."
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={addKeyword}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {form.palavras_chave.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.palavras_chave.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 pr-1">
                    {tag}
                    <button type="button" onClick={() => removeKeyword(tag)} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Switches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <p className="text-sm font-medium">Obrigatória</p>
                <p className="text-xs text-slate-400">Inclui independentemente de matching.</p>
              </div>
              <Switch checked={form.obrigatoria} onCheckedChange={v => update('obrigatoria', v)} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <p className="text-sm font-medium">Exige verificação</p>
                <p className="text-xs text-slate-400">Requer confirmação antes de comunicar.</p>
              </div>
              <Switch checked={form.exige_verificacao} onCheckedChange={v => update('exige_verificacao', v)} />
            </div>
          </div>

          {/* Motivo da edição */}
          {isEdit && (
            <div>
              <Label htmlFor="motivo">Motivo da edição</Label>
              <Textarea
                id="motivo"
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Explique o motivo da alteração..."
                className="mt-1"
                rows={2}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} className="gap-1.5 bg-violet-600 hover:bg-violet-700">
            <Save className="w-4 h-4" />
            {isEdit ? 'Salvar alterações' : 'Criar orientação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}