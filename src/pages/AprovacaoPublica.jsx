import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, AlertCircle, Loader2, ExternalLink, FileText, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import moment from 'moment';
import 'moment-timezone';

const STATUS_LABELS = {
  rascunho: 'Rascunho', enviado: 'Aguardando aprovação', em_aprovacao: 'Em aprovação',
  aprovado: 'Aprovado', solicitacao_alteracao: 'Alteração solicitada',
  reenviado: 'Nova versão enviada', publicado: 'Publicado', arquivado: 'Arquivado'
};

export default function AprovacaoPublica() {
  const { token } = useParams();

  const [entrega, setEntrega] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acao, setAcao] = useState(null); // 'aprovar' | 'solicitar'
  const [nome, setNome] = useState('');
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    if (!token) { setError('Link inválido.'); setLoading(false); return; }
    base44.functions.invoke('entregaPublica', { token })
      .then(res => { setEntrega(res.data?.entrega); setLoading(false); })
      .catch(() => { setError('Entrega não encontrada ou link inválido.'); setLoading(false); });
  }, [token]);

  const handleAcao = async () => {
    if (!nome.trim()) return;
    if (acao === 'solicitar' && !observacao.trim()) return;
    setEnviando(true);
    try {
      const action = acao === 'aprovar' ? 'aprovar' : 'solicitacao_alteracao';
      const res = await base44.functions.invoke('entregaPublica', { token, action, nome_responsavel: nome, observacao });
      setResultado(action);
      setEntrega(prev => ({ ...prev, status_entrega: res.data?.status }));
    } catch {
      setResultado('erro');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-slate-800 mb-1">Link inválido</h2>
        <p className="text-slate-500">{error}</p>
      </div>
    </div>
  );

  const jaRespondido = entrega?.status_entrega === 'aprovado' || entrega?.status_entrega === 'solicitacao_alteracao';

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-slate-100 p-4 py-10">
      <div className="max-w-xl mx-auto space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-violet-600 rounded-xl mb-3">
            <Package className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Portal Voxx</h1>
          <p className="text-slate-500 text-sm mt-1">Aprovação de Material</p>
        </div>

        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-md p-6 space-y-5">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{entrega?.nome_entrega}</h2>
                <p className="text-sm text-slate-500 mt-0.5">{entrega?.tipo_entrega}</p>
              </div>
              <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', {
                'bg-green-100 text-green-700': entrega?.status_entrega === 'aprovado',
                'bg-red-100 text-red-700': entrega?.status_entrega === 'solicitacao_alteracao',
                'bg-blue-100 text-blue-700': ['enviado', 'em_aprovacao', 'reenviado'].includes(entrega?.status_entrega),
                'bg-slate-100 text-slate-600': !['aprovado', 'solicitacao_alteracao', 'enviado', 'em_aprovacao', 'reenviado'].includes(entrega?.status_entrega),
              })}>
                {STATUS_LABELS[entrega?.status_entrega] || entrega?.status_entrega}
              </span>
            </div>

            {entrega?.descricao && (
              <p className="text-sm text-slate-600 mt-3">{entrega.descricao}</p>
            )}

            {entrega?.data_envio && (
              <p className="text-xs text-slate-400 mt-2">
                Enviado em {moment(entrega.data_envio).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm')}
                {entrega?.numero_versao_atual > 1 && ` · Versão ${entrega.numero_versao_atual}`}
              </p>
            )}
          </div>

          {/* Material */}
          {(entrega?.arquivos?.length > 0 || entrega?.link_externo) && (
            <div className="border border-slate-100 rounded-xl p-4 space-y-2.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Material</p>

              {entrega.link_externo && (
                <a href={entrega.link_externo} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg hover:bg-violet-50 border border-slate-200 hover:border-violet-300 transition-colors">
                  <ExternalLink className="w-4 h-4 text-violet-600" />
                  <span className="text-sm text-violet-700 font-medium truncate">{entrega.link_externo}</span>
                </a>
              )}

              {entrega.arquivos?.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg hover:bg-violet-50 border border-slate-200 hover:border-violet-300 transition-colors">
                  <FileText className="w-4 h-4 text-violet-600" />
                  <span className="text-sm text-violet-700 font-medium truncate">{a.nome}</span>
                </a>
              ))}
            </div>
          )}

          {/* Observação do cliente anterior */}
          {entrega?.observacao_cliente && jaRespondido && (
            <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 italic">
              "{entrega.observacao_cliente}"
            </div>
          )}

          {/* Resultado */}
          {resultado === 'aprovar' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <h3 className="font-semibold text-green-900 text-lg">Material aprovado!</h3>
              <p className="text-green-700 text-sm mt-1">Nossa equipe foi notificada. Obrigado!</p>
            </div>
          )}

          {resultado === 'solicitacao_alteracao' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              <h3 className="font-semibold text-amber-900 text-lg">Alteração registrada!</h3>
              <p className="text-amber-700 text-sm mt-1">Nossa equipe vai revisar e enviar uma nova versão em breve.</p>
            </div>
          )}

          {resultado === 'erro' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center text-sm text-red-700">
              Ocorreu um erro. Por favor, tente novamente.
            </div>
          )}

          {/* Formulário de ação */}
          {!resultado && (
            <>
              {!acao ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 font-medium">O que deseja fazer com este material?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setAcao('aprovar')}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-green-200 bg-green-50 hover:border-green-400 hover:bg-green-100 transition-all">
                      <CheckCircle className="w-7 h-7 text-green-600" />
                      <span className="text-sm font-semibold text-green-800">Aprovar</span>
                    </button>
                    <button onClick={() => setAcao('solicitar')}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-amber-200 bg-amber-50 hover:border-amber-400 hover:bg-amber-100 transition-all">
                      <AlertCircle className="w-7 h-7 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-800">Solicitar Alteração</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className={cn('p-3 rounded-lg text-sm font-medium',
                    acao === 'aprovar' ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800')}>
                    {acao === 'aprovar' ? '✓ Aprovando material' : '✏ Solicitando alteração'}
                  </div>

                  <div>
                    <Label>Seu nome *</Label>
                    <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Como deseja ser identificado" />
                  </div>

                  {acao === 'solicitar' && (
                    <div>
                      <Label>Descreva as alterações necessárias *</Label>
                      <Textarea value={observacao} onChange={e => setObservacao(e.target.value)}
                        placeholder="Seja específico sobre o que precisa ser modificado..."
                        className="min-h-[100px]" />
                    </div>
                  )}

                  {acao === 'aprovar' && (
                    <div>
                      <Label>Observação <span className="text-slate-400">(opcional)</span></Label>
                      <Input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Algum comentário?" />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={handleAcao}
                      disabled={enviando || !nome.trim() || (acao === 'solicitar' && !observacao.trim())}
                      className={cn('flex-1', acao === 'aprovar' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700')}>
                      {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : acao === 'aprovar' ? 'Confirmar Aprovação' : 'Enviar Solicitação'}
                    </Button>
                    <Button variant="outline" onClick={() => setAcao(null)}>Voltar</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400">Portal Voxx — Plataforma de Gestão de Marketing</p>
      </div>
    </div>
  );
}