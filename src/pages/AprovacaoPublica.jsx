import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CheckCircle, AlertCircle, Loader2, ExternalLink, FileText,
  Image, Video, Download, Clock, History, ChevronDown, ChevronUp, Info,
  Upload, Link, Paperclip
} from 'lucide-react';
import { cn } from '@/lib/utils';
import moment from 'moment';
import 'moment-timezone';

const STATUS_CONFIG = {
  rascunho:             { label: 'Rascunho',              cls: 'bg-slate-100 text-slate-600' },
  enviado:              { label: 'Aguardando aprovação',  cls: 'bg-blue-100 text-blue-700' },
  em_aprovacao:         { label: 'Em aprovação',          cls: 'bg-blue-100 text-blue-700' },
  aprovado:             { label: 'Aprovado',              cls: 'bg-green-100 text-green-700' },
  solicitacao_alteracao:{ label: 'Alteração solicitada',  cls: 'bg-amber-100 text-amber-700' },
  reenviado:            { label: 'Nova versão enviada',   cls: 'bg-violet-100 text-violet-700' },
  publicado:            { label: 'Publicado',             cls: 'bg-emerald-100 text-emerald-700' },
  arquivado:            { label: 'Arquivado',             cls: 'bg-slate-100 text-slate-500' },
};

const TIPO_ICONS = { aprovacao: '✅', solicitacao_alteracao: '✏️', envio: '📤', reenvio: '🔄' };

function MaterialViewer({ arquivos = [], link_externo }) {
  if (!arquivos.length && !link_externo) return null;
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Material entregue</p>

      {link_externo && (
        <a href={link_externo} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl border border-violet-200 hover:border-violet-400 hover:bg-violet-100 transition-colors">
          <ExternalLink className="w-5 h-5 text-violet-600 flex-shrink-0" />
          <span className="text-sm text-violet-700 font-medium truncate">{link_externo}</span>
        </a>
      )}

      {arquivos.map((a, i) => {
        const url = a.url || '';
        const tipo = (a.tipo || '').toLowerCase();
        const isImg = /\.(png|jpg|jpeg|gif|webp|svg)/i.test(url) || tipo.startsWith('image');
        const isVid = /\.(mp4|webm|mov|avi)/i.test(url) || tipo.startsWith('video');
        const isPdf = /\.pdf/i.test(url) || tipo === 'application/pdf';
        return (
          <div key={i} className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            {isImg && (
              <a href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={a.nome} className="w-full max-h-[500px] object-contain bg-slate-900" />
              </a>
            )}
            {isVid && (
              <video controls className="w-full max-h-96 bg-black" playsInline>
                <source src={url} />
                Seu navegador não suporta vídeos.
              </video>
            )}
            {isPdf && (
              <iframe src={url} className="w-full h-96 border-0" title={a.nome} />
            )}
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-slate-50 hover:bg-violet-50 transition-colors border-t border-slate-100">
              <div className="flex items-center gap-2">
                {isImg ? <Image className="w-4 h-4 text-violet-600" /> :
                 isVid ? <Video className="w-4 h-4 text-violet-600" /> :
                 <FileText className="w-4 h-4 text-violet-600" />}
                <span className="text-sm text-violet-700 font-medium truncate max-w-[200px]">{a.nome || `Arquivo ${i + 1}`}</span>
              </div>
              <Download className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </a>
          </div>
        );
      })}
    </div>
  );
}

function HistoricoSection({ historico = [] }) {
  const [open, setOpen] = useState(false);
  if (!historico.length) return null;
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Histórico de aprovações ({historico.length})</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <div className="divide-y divide-slate-100">
          {historico.map((h, i) => (
            <div key={i} className="p-4 bg-white">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-800">
                  {TIPO_ICONS[h.acao] || '📋'} {h.acao === 'aprovar' ? 'Aprovado' : h.acao === 'solicitacao_alteracao' ? 'Alteração solicitada' : h.acao}
                </span>
                <span className="text-xs text-slate-400">
                  {h.data ? moment(h.data).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm') : ''}
                </span>
              </div>
              {h.nome_responsavel && (
                <p className="text-xs text-slate-500">Por: <span className="font-medium">{h.nome_responsavel}</span></p>
              )}
              {h.observacao && (
                <p className="text-xs text-slate-600 mt-1 italic">"{h.observacao}"</p>
              )}
              {h.anexos?.length > 0 && (
                <div className="mt-2 space-y-1">
                  {h.anexos.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700">
                      {a.tipo === 'link' ? <Link className="w-3 h-3" />
                       : a.tipo === 'imagem' ? <Image className="w-3 h-3" />
                       : a.tipo === 'video' ? <Video className="w-3 h-3" />
                       : <FileText className="w-3 h-3" />}
                      {a.nome}
                    </a>
                  ))}
                </div>
              )}
              {h.link_alteracao && (
                <a href={h.link_alteracao} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 mt-1">
                  <Link className="w-3 h-3" /> {h.link_alteracao}
                </a>
              )}
              {h.versao && (
                <p className="text-xs text-slate-400 mt-0.5">Versão {h.versao}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AprovacaoPublica() {
  const { token } = useParams();

  const [entrega, setEntrega] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acao, setAcao] = useState(null); // 'aprovar' | 'solicitar'
  const [nome, setNome] = useState('');
  const [observacao, setObservacao] = useState('');
  const [anexos, setAnexos] = useState([]); // [{url, nome, tipo}]
  const [linkAlteracao, setLinkAlteracao] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null); // 'aprovado' | 'solicitacao_alteracao' | 'erro'

  useEffect(() => {
    if (!token) { setError('link_invalido'); setLoading(false); return; }
    base44.functions.invoke('entregaPublica', { token })
      .then(res => {
        const data = res.data;
        if (!data?.entrega) {
          setError(data?.error || 'link_invalido');
        } else {
          setEntrega(data.entrega);
        }
        setLoading(false);
      })
      .catch(err => {
        const msg = err?.response?.data?.error || err?.message || 'link_invalido';
        setError(msg);
        setLoading(false);
      });
  }, [token]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      if (res.file_url) {
        setAnexos(prev => [...prev, {
          url: res.file_url,
          nome: file.name,
          tipo: file.type.startsWith('image/') ? 'imagem'
            : file.type.startsWith('video/') ? 'video'
            : file.type === 'application/pdf' ? 'pdf'
            : 'documento'
        }]);
      }
    } catch (err) {
      // silently fail
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleAddLink = () => {
    const url = linkAlteracao.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch { return; }
    setAnexos(prev => [...prev, { url, nome: url, tipo: 'link' }]);
    setLinkAlteracao('');
  };

  const handleRemoveAnexo = (index) => {
    setAnexos(prev => prev.filter((_, i) => i !== index));
  };

  const handleAcao = async () => {
    if (!nome.trim()) return;
    if (acao === 'solicitar' && !observacao.trim() && anexos.length === 0 && !linkAlteracao.trim()) return;
    setEnviando(true);
    try {
      const action = acao === 'aprovar' ? 'aprovar' : 'solicitacao_alteracao';
      const res = await base44.functions.invoke('entregaPublica', {
        token, action, nome_responsavel: nome.trim(), observacao: observacao.trim(),
        anexos: anexos.length > 0 ? anexos : undefined,
        link_alteracao: linkAlteracao.trim() || undefined
      });
      if (res.data?.success) {
        setResultado(action);
        setEntrega(prev => ({ ...prev, status_entrega: res.data?.status }));
      } else {
        setResultado('erro');
      }
    } catch {
      setResultado('erro');
    } finally {
      setEnviando(false);
    }
  };

  // ── Loading ──────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-slate-100 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-3" />
        <p className="text-sm text-slate-500">Carregando entrega...</p>
      </div>
    </div>
  );

  // ── Error ─────────────────────────────────────────────
  const errorMessages = {
    link_invalido:  { title: 'Link inválido',    msg: 'Este link não existe ou foi removido.' },
    link_inativo:   { title: 'Link desativado',  msg: 'Este link foi desativado pela equipe Voxx.' },
    link_expirado:  { title: 'Link expirado',    msg: 'Este link expirou. Solicite um novo à equipe Voxx.' },
  };
  if (error) {
    const errInfo = errorMessages[error] || { title: 'Link indisponível', msg: 'Este link não está disponível no momento.' };
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">{errInfo.title}</h2>
          <p className="text-slate-500 text-sm mb-6">{errInfo.msg}</p>
          <p className="text-xs text-slate-400">Portal Voxx — Plataforma de Gestão de Marketing</p>
        </div>
      </div>
    );
  }

  const jaRespondido = ['aprovado', 'solicitacao_alteracao'].includes(entrega?.status_entrega);
  const statusCfg = STATUS_CONFIG[entrega?.status_entrega] || STATUS_CONFIG.enviado;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">Portal Voxx</p>
            <h1 className="text-base font-bold text-slate-900 leading-tight">Central de Aprovação</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* Info da entrega */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-slate-900 leading-tight">{entrega?.nome_entrega}</h2>
              {entrega?.tipo_entrega && (
                <p className="text-sm text-slate-500 mt-0.5">{entrega.tipo_entrega}</p>
              )}
            </div>
            <span className={cn('text-xs px-3 py-1.5 rounded-full font-semibold flex-shrink-0', statusCfg.cls)}>
              {statusCfg.label}
            </span>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4 text-sm">
            {entrega?.cliente_nome && (
              <div>
                <p className="text-xs text-slate-400 font-medium mb-0.5">Cliente</p>
                <p className="text-slate-800 font-medium truncate">{entrega.cliente_nome}</p>
              </div>
            )}
            {entrega?.demanda_titulo && (
              <div>
                <p className="text-xs text-slate-400 font-medium mb-0.5">Demanda</p>
                <p className="text-slate-800 font-medium truncate">{entrega.demanda_titulo}</p>
              </div>
            )}
            {entrega?.data_envio && (
              <div>
                <p className="text-xs text-slate-400 font-medium mb-0.5">Data de envio</p>
                <p className="text-slate-800 font-medium">
                  {moment(entrega.data_envio).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm')}
                </p>
              </div>
            )}
            {entrega?.numero_versao_atual && (
              <div>
                <p className="text-xs text-slate-400 font-medium mb-0.5">Versão</p>
                <p className="text-slate-800 font-medium">v{entrega.numero_versao_atual}</p>
              </div>
            )}
          </div>

          {entrega?.descricao && (
            <p className="text-sm text-slate-600 mt-4 leading-relaxed">{entrega.descricao}</p>
          )}
        </div>

        {/* Mensagem da equipe */}
        {entrega?.observacao_voxx && (
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 flex gap-3">
            <Info className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide mb-1">Mensagem da equipe Voxx</p>
              <p className="text-sm text-violet-900 leading-relaxed">{entrega.observacao_voxx}</p>
            </div>
          </div>
        )}

        {/* Material */}
        {(entrega?.arquivos?.length > 0 || entrega?.link_externo) && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <MaterialViewer arquivos={entrega.arquivos} link_externo={entrega.link_externo} />
          </div>
        )}

        {/* Área de ação / resultado */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">

          {/* Resultado */}
          {resultado === 'aprovar' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-9 h-9 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-green-900 mb-2">Material aprovado com sucesso!</h3>
              <p className="text-green-700 text-sm">Obrigado pelo retorno.</p>
              <p className="text-green-600 text-sm">A equipe Voxx foi notificada.</p>
            </div>
          )}

          {resultado === 'solicitacao_alteracao' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-9 h-9 text-amber-500" />
              </div>
              <h3 className="text-xl font-bold text-amber-900 mb-2">Solicitação de alteração enviada.</h3>
              <p className="text-amber-700 text-sm">Nossa equipe foi notificada</p>
              <p className="text-amber-700 text-sm">e irá revisar o material.</p>
            </div>
          )}

          {resultado === 'erro' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center text-sm text-red-700 mb-4">
              Ocorreu um erro. Por favor, tente novamente.
              <button className="mt-2 text-red-600 underline block mx-auto" onClick={() => setResultado(null)}>Tentar novamente</button>
            </div>
          )}

          {/* Formulário */}
          {!resultado && (
            <>
              {jaRespondido ? (
                <div className={cn('flex items-center gap-3 p-4 rounded-xl',
                  entrega?.status_entrega === 'aprovado' ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200')}>
                  {entrega?.status_entrega === 'aprovado'
                    ? <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                    : <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0" />}
                  <div>
                    <p className={cn('text-sm font-semibold',
                      entrega?.status_entrega === 'aprovado' ? 'text-green-800' : 'text-amber-800')}>
                      {entrega?.status_entrega === 'aprovado' ? 'Material já aprovado' : 'Alteração já solicitada'}
                    </p>
                    {entrega?.observacao_cliente && (
                      <p className="text-xs text-slate-600 mt-0.5 italic">"{entrega.observacao_cliente}"</p>
                    )}
                  </div>
                </div>
              ) : !acao ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-700">O que deseja fazer com este material?</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setAcao('aprovar')}
                      className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-green-200 bg-green-50 hover:border-green-400 hover:bg-green-100 transition-all group">
                      <CheckCircle className="w-8 h-8 text-green-600 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-bold text-green-800">✓ Aprovar Material</span>
                    </button>
                    <button onClick={() => setAcao('solicitar')}
                      className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-amber-200 bg-amber-50 hover:border-amber-400 hover:bg-amber-100 transition-all group">
                      <AlertCircle className="w-8 h-8 text-amber-600 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-bold text-amber-800">✏ Solicitar Alteração</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={cn('flex items-center gap-2 p-3 rounded-lg text-sm font-semibold',
                    acao === 'aprovar' ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800')}>
                    {acao === 'aprovar' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {acao === 'aprovar' ? 'Aprovando material' : 'Solicitando alteração'}
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Nome do responsável <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={nome}
                      onChange={e => setNome(e.target.value)}
                      placeholder="Seu nome completo"
                      className="h-11"
                    />
                  </div>

                  {acao === 'solicitar' ? (
                    <>
                      <div>
                        <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                          Descreva as alterações necessárias <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          value={observacao}
                          onChange={e => setObservacao(e.target.value)}
                          placeholder="Seja específico sobre o que precisa ser modificado..."
                          className="min-h-[100px] resize-none"
                        />
                      </div>

                      {/* Anexos */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700">
                          <Paperclip className="w-3.5 h-3.5 inline mr-1.5" />
                          Anexar mídia, link ou documento <span className="text-slate-400 font-normal">(opcional)</span>
                        </Label>

                        {/* Link input */}
                        <div className="flex gap-2">
                          <Input
                            value={linkAlteracao}
                            onChange={e => setLinkAlteracao(e.target.value)}
                            placeholder="Cole um link (Dropbox, Drive, etc.)"
                            className="h-9 text-sm flex-1"
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLink(); } }}
                          />
                          <Button type="button" variant="outline" size="sm" className="h-9 gap-1"
                            onClick={handleAddLink} disabled={!linkAlteracao.trim()}>
                            <Link className="w-3.5 h-3.5" /> Adicionar
                          </Button>
                        </div>

                        {/* File upload */}
                        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-slate-200 hover:border-violet-300 cursor-pointer transition-colors text-sm text-slate-500 hover:text-violet-600">
                          <Upload className="w-4 h-4" />
                          {uploadingFile ? 'Enviando arquivo...' : 'Fazer upload de arquivo'}
                          <input type="file" className="hidden" onChange={handleFileUpload}
                            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" disabled={uploadingFile} />
                        </label>

                        {/* Preview dos anexos */}
                        {anexos.length > 0 && (
                          <div className="space-y-1.5 mt-2">
                            {anexos.map((a, i) => (
                              <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                                {a.tipo === 'link' ? <Link className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                 : a.tipo === 'imagem' ? <Image className="w-4 h-4 text-violet-500 flex-shrink-0" />
                                 : a.tipo === 'video' ? <Video className="w-4 h-4 text-violet-500 flex-shrink-0" />
                                 : <FileText className="w-4 h-4 text-violet-500 flex-shrink-0" />}
                                <span className="text-xs text-slate-600 truncate flex-1">{a.nome}</span>
                                <button onClick={() => handleRemoveAnexo(i)}
                                  className="text-slate-400 hover:text-red-500 flex-shrink-0">
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div>
                      <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                        Observação <span className="text-slate-400 font-normal">(opcional)</span>
                      </Label>
                      <Textarea
                        value={observacao}
                        onChange={e => setObservacao(e.target.value)}
                        placeholder="Algum comentário sobre o material?"
                        className="min-h-[80px] resize-none"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={handleAcao}
                      disabled={enviando || !nome.trim() || (acao === 'solicitar' && !observacao.trim() && anexos.length === 0 && !linkAlteracao.trim())}
                      className={cn('flex-1 h-11 font-semibold',
                        acao === 'aprovar'
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-amber-600 hover:bg-amber-700 text-white')}>
                      {enviando
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : acao === 'aprovar' ? '✓ Confirmar Aprovação' : '✏ Enviar Solicitação'}
                    </Button>
                    <Button variant="outline" onClick={() => setAcao(null)} className="h-11">
                      Voltar
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Histórico */}
        {(entrega?.historico_aprovacoes?.length > 0) && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <HistoricoSection historico={entrega.historico_aprovacoes} />
          </div>
        )}

        <p className="text-center text-xs text-slate-400 pb-4">
          Portal Voxx — Plataforma de Gestão de Marketing
        </p>
      </div>
    </div>
  );
}