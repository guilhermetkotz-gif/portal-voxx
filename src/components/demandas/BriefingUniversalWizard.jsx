import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, ChevronLeft, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from "@/lib/utils";
import { base44 } from '@/api/base44Client';

const ETAPAS = [
  { id: 1, titulo: "Formato", descricao: "Formato da peça e canal" },
  { id: 2, titulo: "Tema", descricao: "Tema e oferta" },
  { id: 3, titulo: "Objetivo", descricao: "Objetivo e CTA" },
  { id: 4, titulo: "Estilo", descricao: "Tom e linguagem" },
  { id: 5, titulo: "Visual", descricao: "Tipo de imagem" },
  { id: 6, titulo: "Destino", descricao: "Destino do CTA" },
  { id: 7, titulo: "Prazo", descricao: "Prazo e urgência" },
  { id: 8, titulo: "Extras", descricao: "Campos avançados" }
];

const FORMATOS = ['Feed 4:5', 'Stories 9:16', 'Carrossel', 'Banner', 'Ads Adaptável', 'Post Quadrado 1:1'];
const CANAIS = ['Meta Ads', 'Google Ads', 'TikTok Ads', 'Instagram Orgânico', 'Múltiplos canais'];
const TEMAS = ['Promoção / Oferta', 'Lançamento de produto', 'Institucional', 'Autoridade / Prova Social', 'Educativo', 'Reativação', 'Engajamento', 'Sazonal', 'Outro'];
const OBJETIVOS = ['Conversão / Venda', 'Geração de Leads', 'Reconhecimento de Marca', 'Engajamento', 'Tráfego para Site', 'WhatsApp'];
const CTAS = ['Saiba Mais', 'Compre Agora', 'Fale Conosco', 'Agende Já', 'Acesse o Site', 'Baixe Agora', 'Entre em Contato'];
const TONS = ['Comercial direto', 'Emocional humanizado', 'Técnico especialista', 'Jovem e descontraído', 'Sofisticado e premium', 'Urgente e escassez'];
const LINGUAGENS = ['Formal', 'Informal', 'Híbrido'];
const TIPOS_IMAGEM = ['Foto de produto', 'Foto de pessoa', 'Ilustração / Vetor', 'Foto de estúdio', 'Mockup', 'Infográfico', 'Deixar o designer decidir'];
const DESTINOS = ['WhatsApp', 'Site / Landing Page', 'Instagram', 'Formulário', 'Loja', 'Ligação'];

export default function BriefingUniversalWizard({ cliente, onComplete, onCancel }) {
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [gerando, setGerando] = useState(false);
  const [mostrarAvancados, setMostrarAvancados] = useState(false);
  const [dados, setDados] = useState({
    formato: '',
    canal: '',
    tema: '',
    oferta: '',
    objetivo: '',
    cta: '',
    tom: '',
    linguagem: '',
    tipo_imagem: '',
    estilo_visual: '',
    destino_tipo: '',
    destino: '',
    prazo: '',
    urgente: 'Não',
    motivo_urgencia: '',
    mensagem: '',
    objecao: '',
    diferencial: '',
    referencias: ''
  });

  const set = (campo, valor) => setDados(prev => ({ ...prev, [campo]: valor }));

  const validarEtapa = (etapa) => {
    switch (etapa) {
      case 1: return dados.formato && dados.canal;
      case 2: return dados.tema && dados.oferta.trim();
      case 3: return dados.objetivo && dados.cta;
      case 4: return dados.tom && dados.linguagem;
      case 5: return dados.tipo_imagem;
      case 6:
        if (dados.objetivo === 'Conversão / Venda' || dados.objetivo === 'WhatsApp') {
          return dados.destino_tipo && dados.destino.trim();
        }
        return dados.destino_tipo;
      case 7:
        if (!dados.prazo) return false;
        if (dados.urgente === 'Sim') return dados.motivo_urgencia.trim();
        return true;
      case 8: return true;
      default: return true;
    }
  };

  const gerarConteudoIA = async () => {
    setGerando(true);
    try {
      const prompt = `Você é um especialista em marketing digital e copywriting. Gere o seguinte para uma peça criativa:

DADOS DO BRIEFING:
- Cliente: ${cliente?.nome || 'Não informado'}
- Formato: ${dados.formato}
- Canal: ${dados.canal}
- Tema: ${dados.tema}
- Oferta: ${dados.oferta}
- Objetivo: ${dados.objetivo}
- CTA: ${dados.cta}
- Tom: ${dados.tom}
- Linguagem: ${dados.linguagem}
- Tipo de Imagem: ${dados.tipo_imagem}
- Diferencial: ${dados.diferencial || 'Não informado'}
- Objeção a tratar: ${dados.objecao || 'Nenhuma'}
- Mensagem principal: ${dados.mensagem || 'Não informada'}

Gere exatamente no formato JSON abaixo:
{
  "hooks": ["hook 1 (max 12 palavras)", "hook 2 (max 12 palavras)", "hook 3 (max 12 palavras)"],
  "copy_arte": "copy completo da arte (max 80 palavras, inclui headline, subheadline e CTA)",
  "direcao_arte": "instrução completa para o designer (descreva: layout, hierarquia visual, cores sugeridas, posição dos elementos, estilo da imagem, tipografia recomendada)",
  "estrutura_criativo": "descrição da estrutura: qual elemento vai em cima, no meio e embaixo; qual é o foco principal; como o CTA se posiciona"
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            hooks: { type: "array", items: { type: "string" } },
            copy_arte: { type: "string" },
            direcao_arte: { type: "string" },
            estrutura_criativo: { type: "string" }
          }
        }
      });

      return result;
    } finally {
      setGerando(false);
    }
  };

  const proximaEtapa = async () => {
    if (!validarEtapa(etapaAtual)) return;
    if (etapaAtual < 8) {
      setEtapaAtual(etapaAtual + 1);
    } else {
      // Gerar conteúdo IA
      const gerado = await gerarConteudoIA();

      const briefing_universal = {
        formato: dados.formato,
        canal: dados.canal,
        tema: dados.tema,
        oferta: dados.oferta,
        objetivo: dados.objetivo,
        cta: dados.cta,
        tom: dados.tom,
        linguagem: dados.linguagem,
        tipo_imagem: dados.tipo_imagem,
        estilo_visual: dados.estilo_visual || null,
        destino_tipo: dados.destino_tipo,
        destino: dados.destino || null,
        prazo: dados.prazo,
        urgente: dados.urgente,
        motivo_urgencia: dados.urgente === 'Sim' ? dados.motivo_urgencia : null,
        mensagem: dados.mensagem || null,
        objecao: dados.objecao || null,
        diferencial: dados.diferencial || null,
        referencias: dados.referencias || null,
        hooks: gerado?.hooks || [],
        copy_arte: gerado?.copy_arte || '',
        direcao_arte: gerado?.direcao_arte || '',
        estrutura_criativo: gerado?.estrutura_criativo || ''
      };

      const descricaoAuto = `
Formato: ${dados.formato} | Canal: ${dados.canal}
Tema: ${dados.tema} | Oferta: ${dados.oferta}
Objetivo: ${dados.objetivo} | CTA: ${dados.cta}
Tom: ${dados.tom} | Linguagem: ${dados.linguagem}
Prazo: ${dados.prazo}${dados.urgente === 'Sim' ? ` (URGENTE: ${dados.motivo_urgencia})` : ''}
`.trim();

      onComplete({
        camposAdicionais: { briefing_universal },
        descricao: descricaoAuto,
        titulo: `[Arte] ${dados.tema} - ${dados.formato} - ${cliente?.nome || ''}`,
        urgente: dados.urgente === 'Sim',
        previsao_entrega: dados.prazo
      });
    }
  };

  const voltarEtapa = () => {
    if (etapaAtual > 1) setEtapaAtual(etapaAtual - 1);
  };

  const progresso = (etapaAtual / 8) * 100;
  const etapaInfo = ETAPAS[etapaAtual - 1];
  const podeAvancar = validarEtapa(etapaAtual);

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-slate-700">Etapa {etapaAtual} de 8: {etapaInfo.descricao}</span>
          <span className="text-slate-500">{Math.round(progresso)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progresso}%` }} />
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {ETAPAS.map((etapa, idx) => (
          <React.Fragment key={etapa.id}>
            <div className={cn(
              "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
              etapa.id < etapaAtual ? "bg-emerald-500 text-white" :
              etapa.id === etapaAtual ? "bg-blue-600 text-white" :
              "bg-slate-200 text-slate-500"
            )}>
              {etapa.id < etapaAtual ? <CheckCircle className="w-4 h-4" /> : etapa.id}
            </div>
            {idx < ETAPAS.length - 1 && (
              <div className={cn("h-0.5 flex-1 min-w-4 transition-colors", etapa.id < etapaAtual ? "bg-emerald-500" : "bg-slate-200")} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Conteúdo */}
      <Card className="p-6 min-h-[300px]">

        {/* ETAPA 1 */}
        {etapaAtual === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Formato da Peça</h3>
              <p className="text-sm text-slate-500">Selecione o formato e o canal de veiculação</p>
            </div>
            <div className="space-y-3">
              {FORMATOS.map(f => (
                <label key={f} className={cn("flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all",
                  dados.formato === f ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-blue-300"
                )}>
                  <input type="radio" name="formato" value={f} checked={dados.formato === f} onChange={(e) => set('formato', e.target.value)} className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-slate-900">{f}</span>
                </label>
              ))}
            </div>
            <div>
              <Label>Canal de veiculação *</Label>
              <Select value={dados.canal} onValueChange={(v) => set('canal', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o canal" /></SelectTrigger>
                <SelectContent>
                  {CANAIS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* ETAPA 2 */}
        {etapaAtual === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Tema e Oferta</h3>
              <p className="text-sm text-slate-500">O que será divulgado?</p>
            </div>
            <div>
              <Label>Tema *</Label>
              <Select value={dados.tema} onValueChange={(v) => set('tema', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o tema" /></SelectTrigger>
                <SelectContent>
                  {TEMAS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>O que divulgar / Oferta *</Label>
              <Textarea
                value={dados.oferta}
                onChange={(e) => set('oferta', e.target.value)}
                placeholder="Ex: Desconto de 30% em consultas, Lançamento do produto X, Promoção de verão..."
                className="min-h-[100px]"
              />
            </div>
          </div>
        )}

        {/* ETAPA 3 */}
        {etapaAtual === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Objetivo e CTA</h3>
              <p className="text-sm text-slate-500">Qual ação queremos que o público realize?</p>
            </div>
            <div className="space-y-3">
              {OBJETIVOS.map(o => (
                <label key={o} className={cn("flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all",
                  dados.objetivo === o ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-blue-300"
                )}>
                  <input type="radio" name="objetivo" value={o} checked={dados.objetivo === o} onChange={(e) => set('objetivo', e.target.value)} className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-slate-900">{o}</span>
                </label>
              ))}
            </div>
            <div>
              <Label>CTA (Call to Action) *</Label>
              <Select value={dados.cta} onValueChange={(v) => set('cta', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o CTA" /></SelectTrigger>
                <SelectContent>
                  {CTAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* ETAPA 4 */}
        {etapaAtual === 4 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Estilo de Comunicação</h3>
              <p className="text-sm text-slate-500">Tom e linguagem da peça</p>
            </div>
            <div>
              <Label className="mb-2 block">Tom *</Label>
              <div className="space-y-2">
                {TONS.map(t => (
                  <label key={t} className={cn("flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all",
                    dados.tom === t ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-blue-300"
                  )}>
                    <input type="radio" name="tom" value={t} checked={dados.tom === t} onChange={(e) => set('tom', e.target.value)} className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-slate-900">{t}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Linguagem *</Label>
              <Select value={dados.linguagem} onValueChange={(v) => set('linguagem', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a linguagem" /></SelectTrigger>
                <SelectContent>
                  {LINGUAGENS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* ETAPA 5 */}
        {etapaAtual === 5 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Visual</h3>
              <p className="text-sm text-slate-500">Tipo de imagem e estilo visual</p>
            </div>
            <div className="space-y-2">
              {TIPOS_IMAGEM.map(t => (
                <label key={t} className={cn("flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all",
                  dados.tipo_imagem === t ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-blue-300"
                )}>
                  <input type="radio" name="tipo_imagem" value={t} checked={dados.tipo_imagem === t} onChange={(e) => set('tipo_imagem', e.target.value)} className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-slate-900">{t}</span>
                </label>
              ))}
            </div>
            <div>
              <Label>Estilo visual (opcional)</Label>
              <Input value={dados.estilo_visual} onChange={(e) => set('estilo_visual', e.target.value)} placeholder="Ex: minimalista, colorido, escuro, neon..." />
            </div>
          </div>
        )}

        {/* ETAPA 6 */}
        {etapaAtual === 6 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Destino do CTA</h3>
              <p className="text-sm text-slate-500">Para onde o público será direcionado?</p>
            </div>
            <div>
              <Label>Tipo de destino *</Label>
              <Select value={dados.destino_tipo} onValueChange={(v) => set('destino_tipo', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o destino" /></SelectTrigger>
                <SelectContent>
                  {DESTINOS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>
                {dados.objetivo === 'Conversão / Venda' || dados.objetivo === 'WhatsApp' ? 'Link / Número *' : 'Link / Número (opcional)'}
              </Label>
              <Input
                value={dados.destino}
                onChange={(e) => set('destino', e.target.value)}
                placeholder="Ex: https://site.com.br ou (11) 99999-9999"
              />
              {(dados.objetivo === 'Conversão / Venda' || dados.objetivo === 'WhatsApp') && !dados.destino && (
                <p className="text-xs text-red-500 mt-1">Obrigatório para objetivo de conversão</p>
              )}
            </div>
          </div>
        )}

        {/* ETAPA 7 */}
        {etapaAtual === 7 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Prazo</h3>
              <p className="text-sm text-slate-500">Quando precisa estar pronto?</p>
            </div>
            <div>
              <Label>Data de entrega *</Label>
              <Input type="date" value={dados.prazo} onChange={(e) => set('prazo', e.target.value)} />
            </div>
            <div>
              <Label className="mb-2 block">É urgente?</Label>
              <div className="flex gap-3">
                {['Sim', 'Não'].map(op => (
                  <label key={op} className={cn("flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all flex-1",
                    dados.urgente === op ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-blue-300"
                  )}>
                    <input type="radio" name="urgente" value={op} checked={dados.urgente === op} onChange={(e) => set('urgente', e.target.value)} className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-slate-900">{op}</span>
                  </label>
                ))}
              </div>
            </div>
            {dados.urgente === 'Sim' && (
              <div>
                <Label>Motivo da urgência *</Label>
                <Textarea
                  value={dados.motivo_urgencia}
                  onChange={(e) => set('motivo_urgencia', e.target.value)}
                  placeholder="Por que precisa sair com urgência?"
                  className="min-h-[80px]"
                />
              </div>
            )}
          </div>
        )}

        {/* ETAPA 8 */}
        {etapaAtual === 8 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Campos Avançados</h3>
              <p className="text-sm text-slate-500">Opcional — adicione mais contexto para a IA gerar conteúdo melhor</p>
            </div>
            <button
              type="button"
              onClick={() => setMostrarAvancados(!mostrarAvancados)}
              className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <span className="text-sm font-medium text-slate-700">
                {mostrarAvancados ? 'Ocultar campos' : 'Mostrar campos avançados'}
              </span>
              <ChevronRight className={cn("w-4 h-4 text-slate-500 transition-transform", mostrarAvancados && "rotate-90")} />
            </button>
            {mostrarAvancados && (
              <div className="space-y-4">
                <div>
                  <Label>Mensagem principal</Label>
                  <Input value={dados.mensagem} onChange={(e) => set('mensagem', e.target.value)} placeholder="Principal mensagem a transmitir" />
                </div>
                <div>
                  <Label>Objeção a tratar</Label>
                  <Input value={dados.objecao} onChange={(e) => set('objecao', e.target.value)} placeholder="Ex: Preço alto, desconfiança, falta de tempo..." />
                </div>
                <div>
                  <Label>Diferencial do cliente</Label>
                  <Input value={dados.diferencial} onChange={(e) => set('diferencial', e.target.value)} placeholder="Ex: Entrega em 24h, atendimento humanizado..." />
                </div>
                <div>
                  <Label>Referências visuais</Label>
                  <Textarea value={dados.referencias} onChange={(e) => set('referencias', e.target.value)} placeholder="Links ou descrição de referências..." className="min-h-[80px]" />
                </div>
              </div>
            )}
            {!mostrarAvancados && (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-500">Clique em "Gerar Briefing" para finalizar.</p>
                <p className="text-xs text-blue-600 mt-1">🤖 A IA vai gerar hooks, copy e direção de arte automaticamente.</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Validação */}
      {!podeAvancar && (
        <p className="text-sm text-red-500 flex items-center gap-1">
          <AlertTriangle className="w-4 h-4" />
          Preencha os campos obrigatórios para continuar.
        </p>
      )}

      {/* Navegação */}
      <div className="flex gap-3">
        {etapaAtual > 1 ? (
          <Button type="button" variant="outline" onClick={voltarEtapa} className="flex-1">
            <ChevronLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button
          onClick={proximaEtapa}
          disabled={!podeAvancar || gerando}
          className="flex-1 bg-blue-600 hover:bg-blue-700"
        >
          {gerando ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando com IA...</>
          ) : etapaAtual === 8 ? (
            <><CheckCircle className="w-4 h-4 mr-2" /> Gerar Briefing</>
          ) : (
            <>Próximo <ChevronRight className="w-4 h-4 ml-2" /></>
          )}
        </Button>
      </div>
    </div>
  );
}