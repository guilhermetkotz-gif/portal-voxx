import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Plus, Pencil, Trash2, RefreshCw, Loader2,
  Users, UserCheck, MessageSquare, PhoneCall, Search, Check, ChevronsUpDown
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { toast } from 'sonner';

function normalizarTelefone(tel) {
  if (!tel) return '';
  return tel.replace(/\D/g, '');
}

function KPICard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value ?? '—'}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );
}

const FORM_VAZIO = { nome: '', telefone: '', ativo: true, usuario_id: '' };

export default function AbaRemetentesVoxx({ mensagens = [] }) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [reprocessando, setReprocessando] = useState(false);
  const [resultadoReprocessamento, setResultadoReprocessamento] = useState(null);
  const [userPopoverOpen, setUserPopoverOpen] = useState(false);

  const { data: remetentes = [], isLoading } = useQuery({
    queryKey: ['remVoxx'],
    queryFn: () => base44.entities.WhatsappRemetenteVoxx.list('-created_date', 200),
    staleTime: 30 * 1000,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['voxxUsers'],
    queryFn: () => base44.asServiceRole.entities.User.list('full_name', 200),
    staleTime: 60 * 1000,
  });

  // KPIs a partir das mensagens já carregadas no RadarWhatsApp
  const kpis = useMemo(() => {
    const voxx    = mensagens.filter(m => m.remetente_tipo === 'voxx').length;
    const cliente = mensagens.filter(m => m.remetente_tipo === 'cliente').length;
    return { voxx, cliente };
  }, [mensagens]);

  const ativos = remetentes.filter(r => r.ativo !== false);
  const usuarioSelecionado = usuarios.find(u => u.id === form.usuario_id);

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(u => u.full_name);
  }, [usuarios]);

  const abrirNovo = () => {
    setEditando(null);
    setForm(FORM_VAZIO);
    setModalOpen(true);
  };

  const abrirEditar = (r) => {
    setEditando(r);
    setForm({ nome: r.nome, telefone: r.telefone, ativo: r.ativo !== false, usuario_id: r.usuario_id || '' });
    setModalOpen(true);
  };

  const salvar = async () => {
    if (!form.nome.trim() || !form.telefone.trim()) {
      toast.error('Nome e telefone são obrigatórios.');
      return;
    }
    setSalvando(true);
    try {
      const telNorm = normalizarTelefone(form.telefone);
      const dados = {
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        telefone_normalizado: telNorm,
        usuario_id: form.usuario_id || null,
        ativo: form.ativo,
      };
      if (editando) {
        await base44.entities.WhatsappRemetenteVoxx.update(editando.id, dados);
        toast.success('Remetente atualizado.');
      } else {
        await base44.entities.WhatsappRemetenteVoxx.create(dados);
        toast.success('Remetente cadastrado.');
      }
      queryClient.invalidateQueries({ queryKey: ['remVoxx'] });
      setModalOpen(false);
    } catch (e) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const toggleAtivo = async (r) => {
    await base44.entities.WhatsappRemetenteVoxx.update(r.id, { ativo: !r.ativo });
    queryClient.invalidateQueries({ queryKey: ['remVoxx'] });
    toast.success(r.ativo ? 'Remetente inativado.' : 'Remetente ativado.');
  };

  const excluir = async (r) => {
    if (!confirm(`Excluir ${r.nome}?`)) return;
    await base44.entities.WhatsappRemetenteVoxx.delete(r.id);
    queryClient.invalidateQueries({ queryKey: ['remVoxx'] });
    toast.success('Remetente excluído.');
  };

  const reprocessar = async () => {
    setReprocessando(true);
    setResultadoReprocessamento(null);
    try {
      const res = await base44.functions.invoke('reprocessarRemetentesWhatsapp', {});
      setResultadoReprocessamento(res.data);
      toast.success(`Reprocessamento concluído: ${res.data.totalAnalisadas} mensagens.`);
      queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
    } catch (e) {
      toast.error('Erro: ' + e.message);
    } finally {
      setReprocessando(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard icon={Users}        label="Total cadastrados"    value={remetentes.length} color="bg-violet-500/20 text-violet-400" />
        <KPICard icon={UserCheck}    label="Remetentes ativos"    value={ativos.length}     color="bg-emerald-500/20 text-emerald-400" />
        <KPICard icon={PhoneCall}    label="Mensagens VOXX"       value={kpis.voxx}         color="bg-blue-500/20 text-blue-400" />
        <KPICard icon={MessageSquare} label="Mensagens Cliente"   value={kpis.cliente}      color="bg-slate-700 text-slate-300" />
      </div>

      {/* Barra de ações */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
        <p className="text-slate-400 text-sm">
          {remetentes.length} remetente(s) cadastrado(s) · {ativos.length} ativo(s)
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={reprocessar} disabled={reprocessando} variant="outline"
            className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 gap-2 text-sm h-8">
            {reprocessando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Reprocessar mensagens
          </Button>
          <Button onClick={abrirNovo} className="bg-emerald-600 hover:bg-emerald-500 gap-2 text-sm h-8">
            <Plus className="w-3.5 h-3.5" /> Novo remetente
          </Button>
        </div>
      </div>

      {/* Resultado do reprocessamento */}
      {resultadoReprocessamento && (
        <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl px-5 py-4">
          <p className="text-emerald-400 font-semibold text-sm mb-3">Resultado do reprocessamento</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            {[
              ['Analisadas',      resultadoReprocessamento.totalAnalisadas,    'text-white'],
              ['VOXX',            resultadoReprocessamento.totalVoxx,           'text-blue-400'],
              ['Cliente',         resultadoReprocessamento.totalCliente,        'text-emerald-400'],
              ['Sem telefone',    resultadoReprocessamento.totalSemTelefone,    'text-slate-400'],
            ].map(([label, val, color]) => (
              <div key={label}>
                <p className="text-slate-500 text-xs">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{val ?? 0}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs">Nome</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs">Telefone</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs">Normalizado</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs">Usuário</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs">Status</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium text-xs">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
            ) : remetentes.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500 text-sm">Nenhum remetente cadastrado ainda.</td></tr>
            ) : (
              remetentes.map(r => (
                <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{r.nome}</td>
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">{r.telefone}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{r.telefone_normalizado}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {r.usuario_id
                      ? (usuarios.find(u => u.id === r.usuario_id)?.full_name || r.usuario_id)
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={r.ativo !== false
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]'
                      : 'bg-slate-700 text-slate-400 border-slate-600 text-[10px]'}>
                      {r.ativo !== false ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => abrirEditar(r)}
                        className="text-slate-400 hover:text-white hover:bg-slate-700 h-7 w-7 p-0">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleAtivo(r)}
                        className="text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10 h-7 px-2 text-xs">
                        {r.ativo !== false ? 'Inativar' : 'Ativar'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => excluir(r)}
                        className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 h-7 w-7 p-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal cadastro/edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar remetente' : 'Novo remetente VOXX'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Nome</label>
              <Input
                placeholder="ex: Guilherme"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Telefone</label>
              <Input
                placeholder="ex: 5543999999999"
                value={form.telefone}
                onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-white font-mono"
              />
              {form.telefone && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Normalizado: <span className="text-emerald-400 font-mono">{normalizarTelefone(form.telefone)}</span>
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Usuário vinculado</label>
              <Popover open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:text-white text-sm font-normal">
                    {usuarioSelecionado ? (
                      <span className="truncate">{usuarioSelecionado.full_name} ({usuarioSelecionado.email})</span>
                    ) : (
                      <span className="text-slate-500">Selecionar usuário...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-slate-800 border-slate-700 max-h-64 overflow-hidden" align="start" side="bottom">
                  <Command className="bg-transparent">
                    <CommandInput placeholder="Buscar usuário..." className="text-white" />
                    <CommandList className="max-h-60 overflow-y-auto">
                      <CommandEmpty className="text-slate-400 py-3 text-sm text-center">Nenhum usuário encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__nenhum__"
                          onSelect={() => { setForm(f => ({ ...f, usuario_id: '' })); setUserPopoverOpen(false); }}
                          className="text-slate-300 aria-selected:text-white aria-selected:bg-slate-700"
                        >
                          <Check className={`mr-2 h-4 w-4 ${!form.usuario_id ? 'opacity-100' : 'opacity-0'}`} />
                          Nenhum
                        </CommandItem>
                        {usuariosFiltrados.map(u => (
                          <CommandItem
                            key={u.id}
                            value={`${u.full_name} ${u.email}`}
                            onSelect={() => { setForm(f => ({ ...f, usuario_id: u.id })); setUserPopoverOpen(false); }}
                            className="text-white aria-selected:bg-slate-700"
                          >
                            <Check className={`mr-2 h-4 w-4 text-emerald-400 ${form.usuario_id === u.id ? 'opacity-100' : 'opacity-0'}`} />
                            <span>{u.full_name}</span>
                            <span className="ml-2 text-xs text-slate-400">{u.email}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-slate-300">Ativo</label>
              <Switch
                checked={form.ativo}
                onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}
              className="text-slate-400 hover:text-white">Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}
              className="bg-emerald-600 hover:bg-emerald-500 gap-2">
              {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}