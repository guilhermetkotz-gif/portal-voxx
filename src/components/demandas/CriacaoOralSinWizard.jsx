import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle, 
  AlertTriangle,
  Upload,
  Loader2
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { base44 } from '@/api/base44Client';

const ETAPAS = [
  { id: 1, titulo: "Formato", descricao: "Formato da peça" },
  { id: 2, titulo: "Tema", descricao: "Tema principal" },
  { id: 3, titulo: "Objetivo", descricao: "Objetivo da peça" },
  { id: 4, titulo: "Estilo", descricao: "Estilo de comunicação" },
  { id: 5, titulo: "Imagem", descricao: "Tipo de imagem" },
  { id: 6, titulo: "Dados", descricao: "Dados da unidade" },
  { id: 7, titulo: "Urgência", descricao: "Urgência de agenda" },
  { id: 8, titulo: "Extras", descricao: "Campos opcionais" }
];

export default function CriacaoOralSinWizard({ cliente, onComplete, onCancel }) {
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [dados, setDados] = useState({
    formato_peca: '',
    canal_uso: '',
    tema_principal: '',
    tema_principal_outro: '',
    objetivo_peca: '',
    estilo_comunicacao: '',
    tipo_imagem: '',
    cidade_unidade: '',
    whatsapp_unidade: '',
    urgencia_agenda: 'Não',
    motivo_urgencia: '',
    mensagem_chave: '',
    objecao_dominante: '',
    diferencial_unidade: '',
    observacoes_extras: ''
  });
  const [anexos, setAnexos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [mostrarAvancados, setMostrarAvancados] = useState(false);

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
      case 1:
        return dados.formato_peca;
      case 2:
        return dados.tema_principal && (dados.tema_principal !== 'Outro' || dados.tema_principal_outro);
      case 3:
        return dados.objetivo_peca;
      case 4:
        return dados.estilo_comunicacao;
      case 5:
        const imagemOk = dados.tipo_imagem;
        const precisaAnexo = dados.tipo_imagem === 'Dra da unidade' || dados.tipo_imagem === 'Paciente real';
        return imagemOk && (!precisaAnexo || anexos.length > 0);
      case 6:
        return dados.cidade_unidade && dados.whatsapp_unidade;
      case 7:
        return dados.urgencia_agenda && (dados.urgencia_agenda === 'Não' || dados.motivo_urgencia);
      case 8:
        return true; // Etapa opcional
      default:
        return true;
    }
  };

  const proximaEtapa = () => {
    if (!validarEtapa(etapaAtual)) return;
    if (etapaAtual < 8) {
      setEtapaAtual(etapaAtual + 1);
    } else {
      // Montar objeto final
      const temaFinal = dados.tema_principal === 'Outro' ? dados.tema_principal_outro : dados.tema_principal;
      
      const camposAdicionais = {
        formato_peca: dados.formato_peca,
        canal_uso: dados.canal_uso || 'Meta Ads',
        tema_principal: temaFinal,
        objetivo_peca: dados.objetivo_peca,
        estilo_comunicacao: dados.estilo_comunicacao,
        tipo_imagem: dados.tipo_imagem,
        cidade_unidade: dados.cidade_unidade,
        whatsapp_unidade: dados.whatsapp_unidade,
        urgencia_agenda: dados.urgencia_agenda,
        motivo_urgencia: dados.motivo_urgencia || null,
        mensagem_chave: dados.mensagem_chave || null,
        objecao_dominante: dados.objecao_dominante || null,
        diferencial_unidade: dados.diferencial_unidade || null,
        observacoes_extras: dados.observacoes_extras || null
      };

      // Gerar descrição automática
      const descricaoAuto = `
Formato: ${dados.formato_peca}
Tema: ${temaFinal}
Objetivo: ${dados.objetivo_peca}
Estilo: ${dados.estilo_comunicacao}
Tipo de Imagem: ${dados.tipo_imagem}
Cidade: ${dados.cidade_unidade}
WhatsApp: ${dados.whatsapp_unidade}
Urgência: ${dados.urgencia_agenda}${dados.motivo_urgencia ? ` - ${dados.motivo_urgencia}` : ''}
      `.trim();

      onComplete({
        camposAdicionais,
        descricao: descricaoAuto,
        anexos,
        titulo: `[Oral Sin] Arte ${temaFinal} - ${dados.formato_peca}`
      });
    }
  };

  const voltarEtapa = () => {
    if (etapaAtual > 1) {
      setEtapaAtual(etapaAtual - 1);
    }
  };

  const progresso = (etapaAtual / 8) * 100;
  const etapaInfo = ETAPAS[etapaAtual - 1];

  const precisaAnexo = dados.tipo_imagem === 'Dra da unidade' || dados.tipo_imagem === 'Paciente real';

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-slate-700">
            Etapa {etapaAtual} de 8: {etapaInfo.descricao}
          </span>
          <span className="text-slate-500">{Math.round(progresso)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-violet-600 transition-all duration-300"
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
              etapa.id === etapaAtual ? "bg-violet-600 text-white" :
              "bg-slate-200 text-slate-500"
            )}>
              {etapa.id < etapaAtual ? <CheckCircle className="w-4 h-4" /> : etapa.id}
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
      <Card className="p-6 min-h-[300px]">
        {/* ETAPA 1 - Formato */}
        {etapaAtual === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Formato da Peça</h3>
              <p className="text-sm text-slate-500">Selecione o formato de veiculação</p>
            </div>
            <div className="space-y-3">
              {['Feed 4:5', 'Ads Adaptável'].map(formato => (
                <label
                  key={formato}
                  className={cn(
                    "flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all",
                    dados.formato_peca === formato 
                      ? "border-violet-600 bg-violet-50" 
                      : "border-slate-200 hover:border-violet-300"
                  )}
                >
                  <input
                    type="radio"
                    name="formato"
                    value={formato}
                    checked={dados.formato_peca === formato}
                    onChange={(e) => setDados({...dados, formato_peca: e.target.value})}
                    className="w-4 h-4 text-violet-600"
                  />
                  <span className="font-medium text-slate-900">{formato}</span>
                </label>
              ))}
            </div>
            <div className="pt-4">
              <Label>Canal de uso</Label>
              <Select value={dados.canal_uso || 'Meta Ads'} onValueChange={(v) => setDados({...dados, canal_uso: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Meta Ads" />
                </SelectTrigger>
                <SelectContent>
                  {['Meta Ads', 'Google Ads', 'TikTok Ads', 'Múltiplos canais'].map(canal => (
                    <SelectItem key={canal} value={canal}>{canal}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* ETAPA 2 - Tema */}
        {etapaAtual === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Tema Principal</h3>
              <p className="text-sm text-slate-500">Qual o foco principal da peça?</p>
            </div>
            <Select value={dados.tema_principal} onValueChange={(v) => setDados({...dados, tema_principal: v})}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tema" />
              </SelectTrigger>
              <SelectContent>
                {['Protocolo', 'Implante', 'Dentadura Solta', 'Autoridade', 'Prova Social', 'Agenda / Escassez', 'Educativo', 'Institucional', 'Outro'].map(tema => (
                  <SelectItem key={tema} value={tema}>{tema}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dados.tema_principal === 'Outro' && (
              <Input
                value={dados.tema_principal_outro}
                onChange={(e) => setDados({...dados, tema_principal_outro: e.target.value})}
                placeholder="Especifique o tema"
                autoFocus
              />
            )}
          </div>
        )}

        {/* ETAPA 3 - Objetivo */}
        {etapaAtual === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Objetivo da Peça</h3>
              <p className="text-sm text-slate-500">Qual o objetivo principal?</p>
            </div>
            <div className="space-y-3">
              {['WhatsApp (conversão)', 'Comercial', 'Autoridade', 'Educativo', 'Reativação'].map(obj => (
                <label
                  key={obj}
                  className={cn(
                    "flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all",
                    dados.objetivo_peca === obj 
                      ? "border-violet-600 bg-violet-50" 
                      : "border-slate-200 hover:border-violet-300"
                  )}
                >
                  <input
                    type="radio"
                    name="objetivo"
                    value={obj}
                    checked={dados.objetivo_peca === obj}
                    onChange={(e) => setDados({...dados, objetivo_peca: e.target.value})}
                    className="w-4 h-4 text-violet-600"
                  />
                  <span className="font-medium text-slate-900">{obj}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ETAPA 4 - Estilo */}
        {etapaAtual === 4 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Estilo de Comunicação</h3>
              <p className="text-sm text-slate-500">Como deve ser a linguagem?</p>
            </div>
            <div className="space-y-3">
              {['Comercial direto', 'Emocional humanizado', 'Técnico clínico', 'Híbrido'].map(estilo => (
                <label
                  key={estilo}
                  className={cn(
                    "flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all",
                    dados.estilo_comunicacao === estilo 
                      ? "border-violet-600 bg-violet-50" 
                      : "border-slate-200 hover:border-violet-300"
                  )}
                >
                  <input
                    type="radio"
                    name="estilo"
                    value={estilo}
                    checked={dados.estilo_comunicacao === estilo}
                    onChange={(e) => setDados({...dados, estilo_comunicacao: e.target.value})}
                    className="w-4 h-4 text-violet-600"
                  />
                  <span className="font-medium text-slate-900">{estilo}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ETAPA 5 - Tipo de Imagem */}
        {etapaAtual === 5 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Tipo de Imagem</h3>
              <p className="text-sm text-slate-500">Que tipo de foto usar?</p>
            </div>
            <div className="space-y-3">
              {['Dra da unidade', 'Paciente modelo 55+', 'Paciente real', 'Render / Prótese', 'Deixar o agente decidir'].map(tipo => (
                <label
                  key={tipo}
                  className={cn(
                    "flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all",
                    dados.tipo_imagem === tipo 
                      ? "border-violet-600 bg-violet-50" 
                      : "border-slate-200 hover:border-violet-300"
                  )}
                >
                  <input
                    type="radio"
                    name="tipo_imagem"
                    value={tipo}
                    checked={dados.tipo_imagem === tipo}
                    onChange={(e) => setDados({...dados, tipo_imagem: e.target.value})}
                    className="w-4 h-4 text-violet-600"
                  />
                  <span className="font-medium text-slate-900">{tipo}</span>
                </label>
              ))}
            </div>

            {precisaAnexo && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    Para este tipo de imagem é obrigatório anexar foto em boa qualidade.
                  </p>
                </div>
                
                <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 text-center bg-white">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="upload-imagem"
                  />
                  <label htmlFor="upload-imagem" className="cursor-pointer">
                    {uploading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
                        <span className="text-sm text-slate-500">Enviando...</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                        <p className="text-sm text-amber-700 font-medium">Clique para enviar foto(s)</p>
                      </>
                    )}
                  </label>
                </div>

                {anexos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {anexos.map((url, index) => (
                      <div key={index} className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs">
                        <CheckCircle className="w-3 h-3" />
                        Foto {index + 1}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ETAPA 6 - Dados da Unidade */}
        {etapaAtual === 6 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Dados da Unidade</h3>
              <p className="text-sm text-slate-500">Informações de contato</p>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Cidade da unidade *</Label>
                <Input
                  value={dados.cidade_unidade}
                  onChange={(e) => setDados({...dados, cidade_unidade: e.target.value})}
                  placeholder="Ex: São Paulo"
                />
              </div>
              <div>
                <Label>WhatsApp da unidade *</Label>
                <Input
                  value={dados.whatsapp_unidade}
                  onChange={(e) => setDados({...dados, whatsapp_unidade: e.target.value})}
                  placeholder="Ex: (11) 98765-4321"
                />
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 7 - Urgência */}
        {etapaAtual === 7 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Urgência de Agenda</h3>
              <p className="text-sm text-slate-500">A peça precisa sair com urgência?</p>
            </div>
            <div className="space-y-3">
              {['Sim', 'Não'].map(opcao => (
                <label
                  key={opcao}
                  className={cn(
                    "flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all",
                    dados.urgencia_agenda === opcao 
                      ? "border-violet-600 bg-violet-50" 
                      : "border-slate-200 hover:border-violet-300"
                  )}
                >
                  <input
                    type="radio"
                    name="urgencia"
                    value={opcao}
                    checked={dados.urgencia_agenda === opcao}
                    onChange={(e) => setDados({...dados, urgencia_agenda: e.target.value})}
                    className="w-4 h-4 text-violet-600"
                  />
                  <span className="font-medium text-slate-900">{opcao}</span>
                </label>
              ))}
            </div>
            {dados.urgencia_agenda === 'Sim' && (
              <div>
                <Label>Motivo da urgência *</Label>
                <Textarea
                  value={dados.motivo_urgencia}
                  onChange={(e) => setDados({...dados, motivo_urgencia: e.target.value})}
                  placeholder="Por que precisa sair rápido?"
                  className="min-h-[80px]"
                />
              </div>
            )}
          </div>
        )}

        {/* ETAPA 8 - Campos Avançados */}
        {etapaAtual === 8 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Campos Avançados</h3>
              <p className="text-sm text-slate-500">Opcional - Apenas se necessário</p>
            </div>
            
            <button
              type="button"
              onClick={() => setMostrarAvancados(!mostrarAvancados)}
              className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <span className="text-sm font-medium text-slate-700">
                {mostrarAvancados ? 'Ocultar campos' : 'Mostrar campos avançados'}
              </span>
              <ChevronRight className={cn(
                "w-4 h-4 text-slate-500 transition-transform",
                mostrarAvancados && "rotate-90"
              )} />
            </button>

            {mostrarAvancados && (
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Mensagem-chave</Label>
                  <Input
                    value={dados.mensagem_chave}
                    onChange={(e) => setDados({...dados, mensagem_chave: e.target.value})}
                    placeholder="Principal mensagem a comunicar"
                  />
                </div>

                <div>
                  <Label>Objeção dominante</Label>
                  <Select value={dados.objecao_dominante} onValueChange={(v) => setDados({...dados, objecao_dominante: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {['Medo de dor', 'Medo financeiro', 'Medo de arrependimento', 'Vergonha do sorriso', 'Pós-operatório', 'Outro'].map(obj => (
                        <SelectItem key={obj} value={obj}>{obj}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Diferencial da unidade</Label>
                  <Input
                    value={dados.diferencial_unidade}
                    onChange={(e) => setDados({...dados, diferencial_unidade: e.target.value})}
                    placeholder="Ex: Especialista em prótese protocolo, Atendimento 24h..."
                  />
                </div>

                <div>
                  <Label>Observações extras</Label>
                  <Textarea
                    value={dados.observacoes_extras}
                    onChange={(e) => setDados({...dados, observacoes_extras: e.target.value})}
                    placeholder="Qualquer informação adicional relevante"
                    className="min-h-[100px]"
                  />
                </div>
              </div>
            )}

            {!mostrarAvancados && (
              <p className="text-sm text-slate-500 text-center py-8">
                Clique em "Concluir" para finalizar o briefing
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Navegação */}
      <div className="flex gap-3">
        {etapaAtual > 1 && (
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
        {etapaAtual === 1 && (
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
          className="flex-1 bg-violet-600 hover:bg-violet-700"
        >
          {etapaAtual === 8 ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Concluir Briefing
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