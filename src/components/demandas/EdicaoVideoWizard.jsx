import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle, 
  AlertTriangle,
  Upload,
  Loader2,
  FileVideo,
  AlertCircle
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { base44 } from '@/api/base44Client';

const ETAPAS = [
  { id: 0, titulo: "Tipo", descricao: "Tipo de edição" },
  { id: 1, titulo: "Contexto", descricao: "Objetivo e formato" },
  { id: 2, titulo: "Modelo", descricao: "Modelo de edição" },
  { id: 3, titulo: "Componentes", descricao: "O que incluir" },
  { id: 4, titulo: "Textos", descricao: "Dados de texto" },
  { id: 5, titulo: "Assets", descricao: "Arquivos" },
  { id: 6, titulo: "Prazo", descricao: "Urgência e prazo" },
  { id: 7, titulo: "Revisão", descricao: "Confirmar" }
];

const SUBCATEGORIAS_EDICAO = [
  'Edição de vídeo para Ads',
  'Reels / Shorts',
  'Corte de vídeo longo',
  'Legendas',
  'Outro'
];

export default function EdicaoVideoWizard({ cliente, subcategoria: subcategoriaInicial, onComplete, onCancel }) {
  const [etapaAtual, setEtapaAtual] = useState(0);
  const [subcategoria, setSubcategoria] = useState(subcategoriaInicial || '');
  const [dados, setDados] = useState({
    // Etapa 0
    video_objetivo: '',
    plataforma: '',
    formato: '',
    duracao: '',
    duracao_outro: '',
    
    // Etapa 1
    modelo_edicao: '',
    modelo_observacao: '',
    modelo_capa: '',
    
    // Etapa 2
    componentes: {
      capa: true,
      legenda: true,
      vinheta: true,
      etiqueta: true,
      lettering: true
    },
    
    // Etapa 3
    texto_capa: '',
    cidade_capa: '',
    cta_capa: '',
    estilo_legenda: '',
    linguagem_legenda: '',
    obs_legenda: '',
    vinheta_tipo: 'padrao',
    nome_dra: '',
    cro_dra: '',
    lettering_modo: '',
    lettering_frases: '',
    
    // Etapa 4
    video_source_type: 'upload',
    video_link: '',
    video_quality_check: {
      melhor_qualidade: false,
      posicao_correta: false,
      audio_compreensivel: false,
      acesso_liberado: false
    },
    
    // Etapa 5
    prazo_desejado: '',
    obs_prazo: '',
    urgente: false,
    motivo_urgencia: ''
  });
  
  const [anexos, setAnexos] = useState([]);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    const uploadedUrls = [];

    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      uploadedUrls.push(file_url);
    }

    setAnexos([...anexos, ...uploadedUrls]);
    setUploading(false);
  };

  const validarEtapa = (etapa) => {
    switch (etapa) {
      case 0:
        return subcategoria;
      case 1:
        return dados.video_objetivo && dados.plataforma && dados.formato && 
               (dados.duracao && (dados.duracao !== 'Outro' || dados.duracao_outro));
      case 2:
        return dados.modelo_edicao;
      case 3:
        // Pelo menos um componente deve estar marcado
        return Object.values(dados.componentes).some(v => v);
      case 4:
        // Validar campos conforme componentes marcados  
        if (dados.componentes.capa && (!dados.modelo_capa || !dados.texto_capa)) return false;
        if (dados.componentes.legenda && (!dados.estilo_legenda || !dados.linguagem_legenda)) return false;
        if (dados.componentes.vinheta && dados.vinheta_tipo === 'propria' && !anexos.some(a => a.includes('vinheta'))) return false;
        if (dados.componentes.etiqueta && (!dados.nome_dra || !dados.cro_dra)) return false;
        if (dados.componentes.lettering && !dados.lettering_modo) return false;
        if (dados.componentes.lettering && dados.lettering_modo === 'fornecer' && !dados.lettering_frases) return false;
        return true;
      case 5:
        // Validação: deve ter vídeo (upload OU link)
        if (dados.video_source_type === 'upload') {
          if (anexos.length === 0) return false;
        } else if (dados.video_source_type === 'link') {
          if (!dados.video_link.trim()) return false;
          // Validar formato de URL
          try {
            new URL(dados.video_link);
          } catch {
            return false;
          }
        }
        return true;
      case 6:
        if (dados.urgente && !dados.motivo_urgencia) return false;
        return true;
      case 7:
        return true;
      default:
        return true;
    }
  };

  const proximaEtapa = () => {
    if (!validarEtapa(etapaAtual)) return;
    if (etapaAtual < 7) {
      setEtapaAtual(etapaAtual + 1);
    } else {
      // Montar objeto final
      const camposAdicionais = {
        video_objetivo: dados.video_objetivo,
        plataforma: dados.plataforma,
        formato: dados.formato,
        duracao: dados.duracao === 'Outro' ? dados.duracao_outro : dados.duracao,
        modelo_edicao: dados.modelo_edicao,
        modelo_observacao: dados.modelo_observacao || null,
        componentes: dados.componentes,
        modelo_capa: dados.componentes.capa ? dados.modelo_capa : null,
        texto_capa: dados.componentes.capa ? dados.texto_capa : null,
        cidade_capa: dados.componentes.capa ? dados.cidade_capa : null,
        cta_capa: dados.componentes.capa ? dados.cta_capa : null,
        estilo_legenda: dados.componentes.legenda ? dados.estilo_legenda : null,
        linguagem_legenda: dados.componentes.legenda ? dados.linguagem_legenda : null,
        obs_legenda: dados.componentes.legenda ? dados.obs_legenda : null,
        vinheta_tipo: dados.componentes.vinheta ? dados.vinheta_tipo : null,
        nome_dra: dados.componentes.etiqueta ? dados.nome_dra : null,
        cro_dra: dados.componentes.etiqueta ? dados.cro_dra : null,
        lettering_modo: dados.componentes.lettering ? dados.lettering_modo : null,
        lettering_frases: dados.componentes.lettering && dados.lettering_modo === 'fornecer' ? dados.lettering_frases : null,
        video_source_type: dados.video_source_type,
        video_link: dados.video_source_type === 'link' ? dados.video_link : null,
        video_quality_check: dados.video_quality_check,
        prazo_desejado: dados.prazo_desejado || null,
        obs_prazo: dados.obs_prazo || null,
        urgente: dados.urgente,
        motivo_urgencia: dados.urgente ? dados.motivo_urgencia : null
      };

      // Gerar descrição automática
      const componentesAtivos = Object.keys(dados.componentes).filter(k => dados.componentes[k]).join(', ');
      const descricaoAuto = `
Objetivo: ${dados.video_objetivo}
Plataforma: ${dados.plataforma}
Formato: ${dados.formato}
Duração: ${dados.duracao === 'Outro' ? dados.duracao_outro : dados.duracao}
Modelo: ${dados.modelo_edicao}
Componentes: ${componentesAtivos}
${dados.urgente ? `⚠️ URGENTE: ${dados.motivo_urgencia}` : ''}
      `.trim();

      onComplete({
        camposAdicionais,
        descricao: descricaoAuto,
        anexos,
        titulo: `[Edição] ${subcategoria} - ${dados.plataforma}`,
        urgente: dados.urgente,
        subcategoria
      });
    }
  };

  const voltarEtapa = () => {
    if (etapaAtual > 0) {
      setEtapaAtual(etapaAtual - 1);
    }
  };

  const progresso = ((etapaAtual + 1) / 8) * 100;
  const etapaInfo = ETAPAS[etapaAtual];

  const toggleComponente = (key) => {
    setDados({
      ...dados,
      componentes: {
        ...dados.componentes,
        [key]: !dados.componentes[key]
      }
    });
  };

  const isCorteVideoLongo = subcategoria === 'Corte de vídeo longo';

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-slate-700">
            Etapa {etapaAtual + 1} de 8: {etapaInfo.descricao}
          </span>
          <span className="text-slate-500">{Math.round(progresso)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progresso}%` }}
          />
        </div>
      </div>

      {/* Stepper visual */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {ETAPAS.map((etapa, idx) => (
          <React.Fragment key={etapa.id}>
            <div className={cn(
              "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
              etapa.id < etapaAtual ? "bg-emerald-500 text-white" :
              etapa.id === etapaAtual ? "bg-blue-600 text-white" :
              "bg-slate-200 text-slate-500"
            )}>
              {etapa.id < etapaAtual ? <CheckCircle className="w-4 h-4" /> : etapa.id + 1}
            </div>
            {idx < ETAPAS.length - 1 && (
              <div className={cn(
                "h-0.5 flex-1 min-w-4 transition-colors",
                etapa.id < etapaAtual ? "bg-emerald-500" : "bg-slate-200"
              )} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Conteúdo da etapa */}
      <Card className="p-6 min-h-[350px]">
        {/* ETAPA 0 - Tipo de Edição */}
        {etapaAtual === 0 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Tipo de Edição</h3>
              <p className="text-sm text-slate-500">Selecione o tipo de edição necessária</p>
            </div>
            
            <div className="space-y-3">
              {SUBCATEGORIAS_EDICAO.map(tipo => (
                <label
                  key={tipo}
                  className={cn(
                    "flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all",
                    subcategoria === tipo 
                      ? "border-blue-600 bg-blue-50" 
                      : "border-slate-200 hover:border-blue-300"
                  )}
                >
                  <input
                    type="radio"
                    name="subcategoria"
                    value={tipo}
                    checked={subcategoria === tipo}
                    onChange={(e) => setSubcategoria(e.target.value)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="font-medium text-slate-900">{tipo}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ETAPA 1 - Contexto */}
        {etapaAtual === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Contexto do Vídeo</h3>
              <p className="text-sm text-slate-500">Informações essenciais sobre o vídeo</p>
            </div>
            
            <div>
              <Label>Objetivo do vídeo *</Label>
              <Select value={dados.video_objetivo} onValueChange={(v) => setDados({...dados, video_objetivo: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o objetivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Conversão / WhatsApp (performance)">Conversão / WhatsApp (performance)</SelectItem>
                  <SelectItem value="Autoridade / Conteúdo">Autoridade / Conteúdo</SelectItem>
                  <SelectItem value="Prova social / Depoimento">Prova social / Depoimento</SelectItem>
                  <SelectItem value="Institucional">Institucional</SelectItem>
                  <SelectItem value="Reativação / Remarketing">Reativação / Remarketing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Plataforma principal *</Label>
              <Select value={dados.plataforma} onValueChange={(v) => setDados({...dados, plataforma: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Instagram Reels">Instagram Reels</SelectItem>
                  <SelectItem value="Stories">Stories</SelectItem>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                  <SelectItem value="YouTube Shorts">YouTube Shorts</SelectItem>
                  <SelectItem value="Meta Ads (Reels/Feed)">Meta Ads (Reels/Feed)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Formato final *</Label>
              <Select value={dados.formato} onValueChange={(v) => setDados({...dados, formato: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16 (vertical)">9:16 (vertical)</SelectItem>
                  <SelectItem value="1:1 (quadrado)">1:1 (quadrado)</SelectItem>
                  <SelectItem value="16:9 (horizontal)">16:9 (horizontal)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Duração alvo *</Label>
              <Select value={dados.duracao} onValueChange={(v) => setDados({...dados, duracao: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a duração" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6–15s">6–15s</SelectItem>
                  <SelectItem value="15–30s">15–30s</SelectItem>
                  <SelectItem value="30–60s">30–60s</SelectItem>
                  <SelectItem value="60–90s">60–90s</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dados.duracao === 'Outro' && (
              <Input
                value={dados.duracao_outro}
                onChange={(e) => setDados({...dados, duracao_outro: e.target.value})}
                placeholder="Especifique a duração (ex: 2–3 minutos)"
                autoFocus
              />
            )}
          </div>
        )}

        {/* ETAPA 2 - Modelo de Edição */}
        {etapaAtual === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Modelo de Edição</h3>
              <p className="text-sm text-slate-500">Escolha o estilo de edição desejado</p>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-slate-700">Modelo de edição *</Label>
              {['Modelo 01', 'Modelo 02', 'Modelo 03'].map(modelo => (
                <label
                  key={modelo}
                  className={cn(
                    "flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all",
                    dados.modelo_edicao === modelo 
                      ? "border-blue-600 bg-blue-50" 
                      : "border-slate-200 hover:border-blue-300"
                  )}
                >
                  <input
                    type="radio"
                    name="modelo_edicao"
                    value={modelo}
                    checked={dados.modelo_edicao === modelo}
                    onChange={(e) => setDados({...dados, modelo_edicao: e.target.value})}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div>
                    <span className="font-medium text-slate-900">{modelo}</span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {modelo === 'Modelo 01' && 'Edição simples com cortes básicos'}
                      {modelo === 'Modelo 02' && 'Edição intermediária com efeitos'}
                      {modelo === 'Modelo 03' && 'Edição completa com recursos avançados'}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div>
              <Label>Observação sobre o modelo (opcional)</Label>
              <Textarea
                value={dados.modelo_observacao}
                onChange={(e) => setDados({...dados, modelo_observacao: e.target.value})}
                placeholder="Descreva o que gostou no modelo ou personalizações desejadas"
                className="min-h-[100px]"
              />
            </div>
          </div>
        )}

        {/* ETAPA 3 - Componentes */}
        {etapaAtual === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Componentes do Vídeo</h3>
              <p className="text-sm text-slate-500">Selecione o que deve ser incluído</p>
            </div>

            <div className="space-y-3">
              {[
                { key: 'capa', label: 'CAPA', desc: 'Imagem de capa personalizada' },
                { key: 'legenda', label: 'LEGENDA', desc: 'Legendas animadas no vídeo' },
                { key: 'vinheta', label: 'VINHETA', desc: 'Vinheta de abertura/fechamento' },
                { key: 'etiqueta', label: 'ETIQUETA (CRO e nome da Dra)', desc: 'Identificação profissional' },
                { key: 'lettering', label: 'LETTERING', desc: 'Textos destacados em cena' }
              ].map(comp => (
                <label
                  key={comp.key}
                  className={cn(
                    "flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all",
                    dados.componentes[comp.key]
                      ? "border-blue-600 bg-blue-50" 
                      : "border-slate-200 hover:border-blue-300"
                  )}
                >
                  <Checkbox
                    checked={dados.componentes[comp.key]}
                    onCheckedChange={() => toggleComponente(comp.key)}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-slate-900">{comp.label}</p>
                    <p className="text-xs text-slate-500">{comp.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {isCorteVideoLongo && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Para cortes longos, ao menos LEGENDA ou LETTERING devem estar marcados.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ETAPA 4 - Dados de Texto */}
        {etapaAtual === 4 && (
          <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Dados de Texto</h3>
              <p className="text-sm text-slate-500">Preencha conforme componentes selecionados</p>
            </div>

            {/* CAPA */}
            {dados.componentes.capa && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <h4 className="font-medium text-red-900 text-sm">📸 CAPA (Obrigatório)</h4>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-red-900">Modelo de capa *</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {['Modelo 01', 'Modelo 02', 'Modelo 03', 'Modelo 04'].map(modelo => (
                      <label
                        key={modelo}
                        className={cn(
                          "flex items-center gap-2 p-3 border-2 rounded cursor-pointer transition-all bg-white",
                          dados.modelo_capa === modelo 
                            ? "border-red-600 bg-red-50" 
                            : "border-red-200 hover:border-red-400"
                        )}
                      >
                        <input
                          type="radio"
                          name="modelo_capa"
                          value={modelo}
                          checked={dados.modelo_capa === modelo}
                          onChange={(e) => setDados({...dados, modelo_capa: e.target.value})}
                          className="w-4 h-4 text-red-600"
                        />
                        <span className="text-sm font-medium text-slate-900">{modelo}</span>
                      </label>
                    ))}
                  </div>
                  {!dados.modelo_capa && (
                    <p className="text-xs text-red-600 mt-1">⚠️ Selecione o modelo de capa</p>
                  )}
                </div>

                <div>
                  <Label className="text-sm font-medium text-red-900">Texto da capa *</Label>
                  <Input
                    value={dados.texto_capa}
                    onChange={(e) => setDados({...dados, texto_capa: e.target.value})}
                    placeholder="Texto principal da capa"
                    className={cn(!dados.texto_capa && "border-red-300")}
                  />
                  {!dados.texto_capa && (
                    <p className="text-xs text-red-600 mt-1">⚠️ Preencha o texto da capa</p>
                  )}
                </div>
                
                <div>
                  <Label className="text-sm">Cidade / Unidade (opcional)</Label>
                  <Input
                    value={dados.cidade_capa}
                    onChange={(e) => setDados({...dados, cidade_capa: e.target.value})}
                    placeholder="Ex: São Paulo"
                  />
                </div>
                <div>
                  <Label className="text-sm">CTA curto (opcional)</Label>
                  <Input
                    value={dados.cta_capa}
                    onChange={(e) => setDados({...dados, cta_capa: e.target.value})}
                    placeholder="Ex: Clique aqui"
                  />
                </div>
              </div>
            )}

            {/* LEGENDA */}
            {dados.componentes.legenda && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
                <h4 className="font-medium text-purple-900 text-sm">💬 LEGENDA</h4>
                <div>
                  <Label>Estilo de legenda *</Label>
                  <Select value={dados.estilo_legenda} onValueChange={(v) => setDados({...dados, estilo_legenda: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dinâmica (palavra-chave)">Dinâmica (palavra-chave)</SelectItem>
                      <SelectItem value="Completa (linha a linha)">Completa (linha a linha)</SelectItem>
                      <SelectItem value="Mista">Mista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Linguagem *</Label>
                  <Select value={dados.linguagem_legenda} onValueChange={(v) => setDados({...dados, linguagem_legenda: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Formal">Formal</SelectItem>
                      <SelectItem value="Simples (popular)">Simples (popular)</SelectItem>
                      <SelectItem value="Técnica (clínica)">Técnica (clínica)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Observações (opcional)</Label>
                  <Textarea
                    value={dados.obs_legenda}
                    onChange={(e) => setDados({...dados, obs_legenda: e.target.value})}
                    placeholder="Qualquer detalhe adicional"
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            )}

            {/* VINHETA */}
            {dados.componentes.vinheta && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                <h4 className="font-medium text-green-900 text-sm">🎬 VINHETA</h4>
                <div className="space-y-2">
                  {['padrao', 'propria'].map(tipo => (
                    <label
                      key={tipo}
                      className={cn(
                        "flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all",
                        dados.vinheta_tipo === tipo 
                          ? "border-green-600 bg-white" 
                          : "border-green-200 hover:border-green-400"
                      )}
                    >
                      <input
                        type="radio"
                        name="vinheta"
                        value={tipo}
                        checked={dados.vinheta_tipo === tipo}
                        onChange={(e) => setDados({...dados, vinheta_tipo: e.target.value})}
                        className="w-4 h-4 text-green-600"
                      />
                      <span className="text-sm font-medium text-slate-900">
                        {tipo === 'padrao' ? 'Usar vinheta padrão Voxx' : 'Cliente tem vinheta própria'}
                      </span>
                    </label>
                  ))}
                </div>
                {dados.vinheta_tipo === 'propria' && (
                  <p className="text-xs text-green-700">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Lembre-se de anexar o arquivo da vinheta na etapa de Assets
                  </p>
                )}
              </div>
            )}

            {/* ETIQUETA */}
            {dados.componentes.etiqueta && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <h4 className="font-medium text-red-900 text-sm">🏷️ ETIQUETA (Obrigatório)</h4>
                </div>
                <div>
                  <Label className="text-sm font-medium text-red-900">Nome da Dra *</Label>
                  <Input
                    value={dados.nome_dra}
                    onChange={(e) => setDados({...dados, nome_dra: e.target.value})}
                    placeholder="Dra. Maria Silva"
                    className={cn(!dados.nome_dra && "border-red-300")}
                  />
                  {!dados.nome_dra && (
                    <p className="text-xs text-red-600 mt-1">⚠️ Preencha o nome da Dra</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-red-900">CRO *</Label>
                  <Input
                    value={dados.cro_dra}
                    onChange={(e) => setDados({...dados, cro_dra: e.target.value})}
                    placeholder="CRO-SP 12345"
                    className={cn(!dados.cro_dra && "border-red-300")}
                  />
                  {!dados.cro_dra && (
                    <p className="text-xs text-red-600 mt-1">⚠️ Preencha o CRO</p>
                  )}
                </div>
              </div>
            )}

            {/* LETTERING */}
            {dados.componentes.lettering && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <h4 className="font-medium text-red-900 text-sm">✍️ LETTERING (Obrigatório)</h4>
                </div>
                <div className="space-y-2">
                  {[
                    { value: 'fornecer', label: 'Fornecer frases' },
                    { value: 'editor_sugere', label: 'Editor sugere baseado no vídeo' }
                  ].map(opt => (
                    <label
                      key={opt.value}
                      className={cn(
                        "flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all bg-white",
                        dados.lettering_modo === opt.value 
                          ? "border-red-600 bg-red-50" 
                          : "border-red-200 hover:border-red-400"
                      )}
                    >
                      <input
                        type="radio"
                        name="lettering"
                        value={opt.value}
                        checked={dados.lettering_modo === opt.value}
                        onChange={(e) => setDados({...dados, lettering_modo: e.target.value})}
                        className="w-4 h-4 text-red-600"
                      />
                      <span className="text-sm font-medium text-slate-900">{opt.label}</span>
                    </label>
                  ))}
                </div>
                {!dados.lettering_modo && (
                  <p className="text-xs text-red-600">⚠️ Informe as frases ou selecione "Editor sugere"</p>
                )}
                {dados.lettering_modo === 'fornecer' && (
                  <div>
                    <Label className="text-sm font-medium text-red-900">Frase(s) chave *</Label>
                    <Textarea
                      value={dados.lettering_frases}
                      onChange={(e) => setDados({...dados, lettering_frases: e.target.value})}
                      placeholder="Digite as frases que devem aparecer no lettering"
                      className={cn("min-h-[80px]", !dados.lettering_frases && "border-red-300")}
                    />
                    {!dados.lettering_frases && (
                      <p className="text-xs text-red-600 mt-1">⚠️ Forneça as frases para o lettering</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ETAPA 5 - Assets */}
        {etapaAtual === 5 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Vídeo Bruto e Assets</h3>
              <p className="text-sm text-slate-500">Envie o vídeo para edição</p>
            </div>

            {/* Escolha de fonte do vídeo */}
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900">Obrigatório: Vídeo para edição</p>
                  <p className="text-xs text-red-700">Escolha como enviar o vídeo bruto</p>
                </div>
              </div>

              <div className="space-y-2">
                {['upload', 'link'].map(tipo => (
                  <label
                    key={tipo}
                    className={cn(
                      "flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all bg-white",
                      dados.video_source_type === tipo 
                        ? "border-red-600 bg-red-50" 
                        : "border-red-200 hover:border-red-400"
                    )}
                  >
                    <input
                      type="radio"
                      name="video_source"
                      value={tipo}
                      checked={dados.video_source_type === tipo}
                      onChange={(e) => setDados({...dados, video_source_type: e.target.value})}
                      className="w-4 h-4 text-red-600"
                    />
                    <div>
                      <span className="font-medium text-slate-900">
                        {tipo === 'upload' ? 'Upload do vídeo' : 'Link do vídeo'}
                      </span>
                      <p className="text-xs text-slate-500">
                        {tipo === 'upload' ? 'Envie arquivos diretamente (MP4, MOV, AVI)' : 'Google Drive, WeTransfer, Dropbox, etc.'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Upload de vídeo */}
              {dados.video_source_type === 'upload' && (
                <div className="border-2 border-dashed border-red-300 rounded-lg p-6 text-center bg-white">
                  <input
                    type="file"
                    multiple
                    accept="video/mp4,video/quicktime,video/x-msvideo,video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="upload-video"
                  />
                  <label htmlFor="upload-video" className="cursor-pointer">
                    {uploading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="text-sm text-slate-500">Enviando...</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-red-600 mx-auto mb-2" />
                        <p className="text-sm text-red-700 font-medium mb-1">Clique para enviar vídeo(s)</p>
                        <p className="text-xs text-slate-500">Formatos: MP4, MOV, AVI</p>
                      </>
                    )}
                  </label>
                </div>
              )}

              {/* Link do vídeo */}
              {dados.video_source_type === 'link' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-red-900">Link do vídeo *</Label>
                  <Input
                    type="url"
                    value={dados.video_link}
                    onChange={(e) => setDados({...dados, video_link: e.target.value})}
                    placeholder="https://drive.google.com/... ou https://wetransfer.com/..."
                    className="border-red-300 focus:border-red-500"
                  />
                  {dados.video_link && (() => {
                    try {
                      new URL(dados.video_link);
                      return (
                        <div className="flex items-start gap-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>Link válido</span>
                        </div>
                      );
                    } catch {
                      return (
                        <div className="flex items-start gap-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-700">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>URL inválida - verifique o formato</span>
                        </div>
                      );
                    }
                  })()}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800">
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      Verifique se o link tem acesso liberado para download
                    </p>
                  </div>
                </div>
              )}

              {/* Vídeos enviados */}
              {dados.video_source_type === 'upload' && anexos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-green-700">Vídeos enviados:</p>
                  <div className="space-y-1">
                    {anexos.map((url, index) => (
                      <div key={index} className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-2 rounded text-xs">
                        <CheckCircle className="w-4 h-4" />
                        <FileVideo className="w-4 h-4" />
                        Vídeo {index + 1}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Checklist de qualidade */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <p className="text-sm font-medium text-slate-700">Check de qualidade (recomendado)</p>
              <div className="space-y-2">
                {[
                  { key: 'melhor_qualidade', label: 'Vídeo na melhor qualidade disponível' },
                  { key: 'posicao_correta', label: 'Vídeo na posição correta (vertical/horizontal)' },
                  { key: 'audio_compreensivel', label: 'Áudio compreensível' },
                  { key: 'acesso_liberado', label: 'Link com acesso liberado (se aplicável)' }
                ].map(item => (
                  <label
                    key={item.key}
                    className="flex items-start gap-3 p-2 hover:bg-slate-100 rounded cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={dados.video_quality_check[item.key]}
                      onCheckedChange={(checked) => setDados({
                        ...dados,
                        video_quality_check: {
                          ...dados.video_quality_check,
                          [item.key]: checked
                        }
                      })}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-slate-700">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Outros assets */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-medium text-blue-800 mb-2">Outros arquivos (opcional)</p>
              <p className="text-xs text-blue-700 mb-3">Logo, vinheta própria, referências, etc.</p>
              <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 text-center bg-white">
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*,.zip,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="upload-outros"
                />
                <label htmlFor="upload-outros" className="cursor-pointer">
                  <Upload className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-xs text-blue-700">Clique para enviar</p>
                </label>
              </div>
            </div>

            {dados.componentes.vinheta && dados.vinheta_tipo === 'propria' && !anexos.some(a => a.includes('vinheta')) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Não esqueça de incluir o arquivo da vinheta própria
                </p>
              </div>
            )}
          </div>
        )}

        {/* ETAPA 6 - Prazo */}
        {etapaAtual === 6 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Prazo e Urgência</h3>
              <p className="text-sm text-slate-500">Prazo padrão: até 5 dias corridos</p>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                O prazo padrão é de até 5 dias corridos. Para prazos menores, marque como urgente.
              </p>
            </div>

            <div>
              <Label>Prazo desejado (opcional)</Label>
              <Input
                type="date"
                value={dados.prazo_desejado}
                onChange={(e) => setDados({...dados, prazo_desejado: e.target.value})}
              />
            </div>

            <div>
              <Label>Observações sobre prazo (opcional)</Label>
              <Textarea
                value={dados.obs_prazo}
                onChange={(e) => setDados({...dados, obs_prazo: e.target.value})}
                placeholder="Contexto adicional sobre o prazo"
                className="min-h-[60px]"
              />
            </div>

            <div className="flex items-start gap-3 p-4 border-2 border-slate-200 rounded-lg">
              <Checkbox
                checked={dados.urgente}
                onCheckedChange={(checked) => setDados({...dados, urgente: checked})}
                className="mt-1"
              />
              <div className="flex-1">
                <p className="font-medium text-slate-900">Marcar como URGENTE</p>
                <p className="text-xs text-slate-500 mb-2">Depende de validação com equipe de edição</p>
                
                {dados.urgente && (
                  <div>
                    <Label>Motivo da urgência *</Label>
                    <Textarea
                      value={dados.motivo_urgencia}
                      onChange={(e) => setDados({...dados, motivo_urgencia: e.target.value})}
                      placeholder="Por que precisa ser urgente?"
                      className="min-h-[60px]"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 7 - Revisão Final */}
        {etapaAtual === 7 && (
          <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Revisão Final</h3>
              <p className="text-sm text-slate-500">Confira todos os dados antes de enviar</p>
            </div>

            <div className="space-y-3">
              {/* Cliente */}
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Cliente</p>
                <p className="font-medium text-slate-900">{cliente?.nome || 'Não especificado'}</p>
                <p className="text-sm text-slate-600">{subcategoria}</p>
              </div>

              {/* Contexto */}
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600 mb-2 font-medium">🎯 CONTEXTO</p>
                <div className="space-y-1 text-sm text-slate-900">
                  <p><strong>Objetivo:</strong> {dados.video_objetivo}</p>
                  <p><strong>Plataforma:</strong> {dados.plataforma}</p>
                  <p><strong>Formato:</strong> {dados.formato}</p>
                  <p><strong>Duração:</strong> {dados.duracao === 'Outro' ? dados.duracao_outro : dados.duracao}</p>
                </div>
              </div>

              {/* Modelo */}
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-purple-600 mb-2 font-medium">🎨 MODELO</p>
                <p className="text-sm text-slate-900"><strong>{dados.modelo_edicao}</strong></p>
                {dados.modelo_observacao && (
                  <p className="text-xs text-slate-600 mt-1">{dados.modelo_observacao}</p>
                )}
              </div>

              {/* Componentes */}
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-green-600 mb-2 font-medium">✅ COMPONENTES ATIVOS</p>
                <div className="space-y-1">
                  {dados.componentes.capa && (
                    <div className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">
                      📋 CAPA - {dados.modelo_capa || 'Modelo não definido'}
                    </div>
                  )}
                  {dados.componentes.legenda && (
                    <div className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">
                      💬 LEGENDA - {dados.estilo_legenda}
                    </div>
                  )}
                  {dados.componentes.vinheta && (
                    <div className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">
                      🎥 VINHETA - {dados.vinheta_tipo === 'padrao' ? 'Padrão' : 'Cliente própria'}
                    </div>
                  )}
                  {dados.componentes.etiqueta && (
                    <div className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">
                      🏷️ ETIQUETA - {dados.nome_dra || 'Não informado'}
                    </div>
                  )}
                  {dados.componentes.lettering && (
                    <div className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">
                      ✍️ LETTERING - {dados.lettering_modo === 'fornecer' ? 'Frases fornecidas' : 'Editor sugere'}
                    </div>
                  )}
                </div>
              </div>

              {/* Textos */}
              <div className="p-3 bg-amber-50 rounded-lg">
                <p className="text-xs text-amber-600 mb-2 font-medium">💬 DETALHES</p>
                <div className="space-y-1 text-xs text-slate-700">
                  {dados.componentes.capa && (
                    <p><strong>Capa ({dados.modelo_capa}):</strong> {dados.texto_capa}</p>
                  )}
                  {dados.componentes.legenda && (
                    <p><strong>Legenda:</strong> {dados.estilo_legenda} - {dados.linguagem_legenda}</p>
                  )}
                  {dados.componentes.etiqueta && dados.nome_dra && (
                    <p><strong>Etiqueta:</strong> {dados.nome_dra} - {dados.cro_dra}</p>
                  )}
                  {dados.componentes.lettering && (
                    <p><strong>Lettering:</strong> {dados.lettering_modo === 'editor_sugere' ? 'Editor sugere' : dados.lettering_frases}</p>
                  )}
                </div>
              </div>

              {/* Assets */}
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-600 mb-2 font-medium">📁 VÍDEO E ASSETS</p>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-slate-600">Origem:</span>
                    <span className="ml-2 font-medium text-slate-900">
                      {dados.video_source_type === 'upload' ? '📤 Upload direto' : '🔗 Link'}
                    </span>
                  </div>
                  
                  {dados.video_source_type === 'upload' && (
                    <div>
                      <span className="text-slate-600">Quantidade:</span>
                      <span className="ml-2 font-medium text-slate-900">{anexos.length} arquivo(s)</span>
                    </div>
                  )}
                  
                  {dados.video_source_type === 'link' && dados.video_link && (
                    <div>
                      <span className="text-slate-600">Link:</span>
                      <p className="text-xs text-slate-900 break-all mt-1 bg-white p-2 rounded border border-slate-200">
                        {dados.video_link}
                      </p>
                    </div>
                  )}

                  {/* Checklist status */}
                  <div className="pt-2 border-t border-red-300">
                    <p className="text-xs text-slate-600 mb-1">Checklist de qualidade:</p>
                    <div className="space-y-0.5">
                      {[
                        { key: 'melhor_qualidade', label: 'Melhor qualidade' },
                        { key: 'posicao_correta', label: 'Posição correta' },
                        { key: 'audio_compreensivel', label: 'Áudio OK' },
                        { key: 'acesso_liberado', label: 'Acesso liberado' }
                      ].map(item => (
                        <div key={item.key} className="flex items-center gap-1 text-xs">
                          {dados.video_quality_check[item.key] ? (
                            <CheckCircle className="w-3 h-3 text-green-600" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-amber-500" />
                          )}
                          <span className={dados.video_quality_check[item.key] ? 'text-green-700' : 'text-amber-700'}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Prazo */}
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-2 font-medium">⏰ PRAZO</p>
                {dados.urgente ? (
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-red-600">⚠️ URGENTE</p>
                    <p className="text-xs text-slate-700">{dados.motivo_urgencia}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-700">Prazo padrão: até 5 dias</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Navegação */}
      <div className="flex gap-3">
        {etapaAtual > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={voltarEtapa}
            className="flex-1"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        )}
        {etapaAtual === 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            Cancelar
          </Button>
        )}
        <Button
          onClick={proximaEtapa}
          disabled={!validarEtapa(etapaAtual)}
          className="flex-1 bg-blue-600 hover:bg-blue-700"
        >
          {etapaAtual === 7 ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirmar e Enviar
            </>
          ) : (
            <>
              Próximo
              <ChevronRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}