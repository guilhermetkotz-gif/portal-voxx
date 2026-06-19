import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, Image, Video, FileText, Link2, CheckSquare, X, Eye, Download } from 'lucide-react';
import moment from 'moment';
import 'moment-timezone';

const TZ = 'America/Sao_Paulo';

export default function GrupoMidiaTab({ grupoId, grupoNome }) {
  const [subTab, setSubTab] = useState('midia');
  const [selecionando, setSelecionando] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());
  const [visualizando, setVisualizando] = useState(null);

  // Buscar todas as mensagens com mídia do grupo
  const { data: mensagens = [], isLoading } = useQuery({
    queryKey: ['grupoMidia', grupoId],
    queryFn: async () => {
      const todas = await base44.entities.WhatsappMensagem.filter(
        { grupo_id: grupoId },
        '-received_at',
        500
      );
      return todas.filter(m =>
        !m.deletado &&
        m.tipo_mensagem !== 'sem_conteudo' &&
        m.tipo_mensagem !== 'sistema' &&
        m.tipo_mensagem !== 'atividade' &&
        m.tipo_mensagem !== 'reacao'
      );
    },
    enabled: !!grupoId,
    staleTime: 30 * 1000,
  });

  // Separar por tipo
  const { midias, links, docs } = useMemo(() => {
    const m = [];
    const l = [];
    const d = [];

    mensagens.forEach(msg => {
      const tipo = msg.tipo_mensagem;
      const temUrl = msg.midia_url;
      const temLink = msg.mensagem && /https?:\/\/[^\s]+/.test(msg.mensagem);

      if (tipo === 'imagem' || tipo === 'video') {
        if (temUrl) m.push(msg);
      } else if (tipo === 'documento') {
        if (temUrl) d.push(msg);
      }
      
      // Extrair links de mensagens de texto
      if (temLink && tipo === 'texto') {
        const urls = msg.mensagem.match(/https?:\/\/[^\s]+/g) || [];
        urls.forEach(url => {
          l.push({ ...msg, linkUrl: url });
        });
      }
    });

    return { midias: m, links: l, docs: d };
  }, [mensagens]);

  const itemsAtuais = subTab === 'midia' ? midias : subTab === 'links' ? links : docs;

  const toggleSelecionado = (id) => {
    const novo = new Set(selecionados);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setSelecionados(novo);
  };

  const abrirVisualizacao = (item) => {
    if (selecionando) {
      toggleSelecionado(item.id);
      return;
    }
    setVisualizando(item);
  };

  const baixarItem = (url) => {
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs + Selecionar */}
      <div className="flex items-center justify-between px-1 mb-3">
        <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
          {[
            { key: 'midia', label: 'Mídia', icon: Image },
            { key: 'links', label: 'Links', icon: Link2 },
            { key: 'docs', label: 'Docs', icon: FileText },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setSubTab(tab.key); setSelecionando(false); setSelecionados(new Set()); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                subTab === tab.key
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setSelecionando(!selecionando); setSelecionados(new Set()); }}
          className={`text-xs font-medium transition-colors ${
            selecionando ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {selecionando ? 'Cancelar' : 'Selecionar'}
        </button>
      </div>

      {/* Período */}
      <div className="bg-slate-800/70 rounded-lg px-3 py-1.5 mb-3">
        <span className="text-xs text-slate-400">Neste mês</span>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      ) : itemsAtuais.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-500">
            {subTab === 'midia' ? 'Nenhuma mídia' : subTab === 'links' ? 'Nenhum link' : 'Nenhum documento'}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-1.5">
            {itemsAtuais.map(item => {
              const isImg = subTab === 'midia' && item.tipo_mensagem === 'imagem';
              const isVideo = subTab === 'midia' && item.tipo_mensagem === 'video';
              const isDoc = subTab === 'docs';
              const isLink = subTab === 'links';
              const selected = selecionados.has(item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => abrirVisualizacao(item)}
                  className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer group border-2 transition-all ${
                    selected ? 'border-emerald-400 shadow-lg shadow-emerald-500/20' : 'border-transparent hover:border-slate-500'
                  }`}
                >
                  {isImg && (
                    <img
                      src={item.midia_url}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                  {isVideo && (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                      <video src={item.midia_url} className="w-full h-full object-cover" preload="metadata" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Video className="w-8 h-8 text-white/80" />
                      </div>
                    </div>
                  )}
                  {isDoc && (
                    <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center gap-1 p-2">
                      <FileText className="w-8 h-8 text-slate-400" />
                      <span className="text-[9px] text-slate-400 text-center truncate w-full leading-tight">
                        {item.midia_nome || 'Documento'}
                      </span>
                    </div>
                  )}
                  {isLink && (
                    <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center gap-1 p-2">
                      <Link2 className="w-8 h-8 text-blue-400" />
                      <span className="text-[9px] text-blue-400 text-center truncate w-full leading-tight">
                        {item.linkUrl?.replace(/^https?:\/\//, '').substring(0, 30)}
                      </span>
                    </div>
                  )}

                  {/* Checkbox de seleção */}
                  {selecionando && (
                    <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center ${
                      selected ? 'bg-emerald-500 text-white' : 'bg-black/50 text-white/60 border border-white/30'
                    }`}>
                      {selected && <CheckSquare className="w-3 h-3" />}
                    </div>
                  )}

                  {/* Hover overlay */}
                  {!selecionando && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Eye className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rodapé */}
      <div className="flex items-center justify-between pt-3 mt-auto border-t border-slate-800">
        <button className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
          Mostrar mídias de todas as conversas
        </button>
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-6 h-8"
          onClick={() => {
            if (selecionados.size > 0) {
              // Baixar todos selecionados
              itemsAtuais
                .filter(item => selecionados.has(item.id))
                .forEach(item => {
                  const url = item.midia_url || item.linkUrl;
                  if (url) window.open(url, '_blank');
                });
            }
          }}
        >
          {selecionados.size > 0 ? `Baixar (${selecionados.size})` : 'OK'}
        </Button>
      </div>

      {/* Modal de visualização */}
      {visualizando && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90"
          onClick={() => setVisualizando(null)}
        >
          <button
            onClick={() => setVisualizando(null)}
            className="absolute top-4 right-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {visualizando.tipo_mensagem === 'imagem' && (
            <img
              src={visualizando.midia_url}
              alt=""
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {visualizando.tipo_mensagem === 'video' && (
            <video
              src={visualizando.midia_url}
              controls
              autoPlay
              className="max-w-[90vw] max-h-[90vh] rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {visualizando.tipo_mensagem === 'documento' && (
            <div
              className="bg-slate-800 rounded-xl p-8 text-center max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-white font-medium mb-1">{visualizando.midia_nome || 'Documento'}</p>
              <Button
                className="bg-emerald-600 hover:bg-emerald-500 gap-2 mt-3"
                onClick={() => baixarItem(visualizando.midia_url)}
              >
                <Download className="w-4 h-4" /> Baixar / Abrir
              </Button>
            </div>
          )}
          {visualizando.linkUrl && (
            <div
              className="bg-slate-800 rounded-xl p-8 text-center max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <Link2 className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <p className="text-white font-medium mb-2">Link</p>
              <p className="text-xs text-slate-400 break-all mb-4">{visualizando.linkUrl}</p>
              <Button
                className="bg-emerald-600 hover:bg-emerald-500 gap-2"
                onClick={() => window.open(visualizando.linkUrl, '_blank')}
              >
                <Link2 className="w-4 h-4" /> Abrir link
              </Button>
            </div>
          )}

          {/* Botão download no canto inferior */}
          {visualizando.midia_url && !visualizando.linkUrl && (
            <button
              onClick={(e) => { e.stopPropagation(); baixarItem(visualizando.midia_url); }}
              className="absolute bottom-6 right-6 p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg transition-colors"
            >
              <Download className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}