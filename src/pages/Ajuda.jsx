import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Search, BookOpen, Users, BarChart3, Wallet, HelpCircle, MessageCircle, Target, Zap } from 'lucide-react';

const glossario = [
  { termo: "CPL", definicao: "Custo Por Lead - valor médio pago para gerar cada lead. Calculado dividindo o investimento pelo número de leads." },
  { termo: "CPC", definicao: "Custo Por Clique - valor médio pago por cada clique em seus anúncios." },
  { termo: "Lead", definicao: "Pessoa interessada que deixou seus dados de contato (nome, telefone, etc) através do anúncio." },
  { termo: "Impressões", definicao: "Número de vezes que seu anúncio foi exibido na tela de alguém." },
  { termo: "Alcance", definicao: "Número de pessoas únicas que viram seu anúncio." },
  { termo: "Frequência", definicao: "Número médio de vezes que cada pessoa viu seu anúncio." },
  { termo: "CTR", definicao: "Click Through Rate - taxa de cliques. Percentual de pessoas que clicaram após ver o anúncio." },
  { termo: "Conversão", definicao: "Quando um usuário realiza a ação desejada (preencher formulário, ligar, enviar mensagem)." },
  { termo: "Pixel", definicao: "Código instalado no site que rastreia ações dos visitantes vindos dos anúncios." },
  { termo: "Remarketing", definicao: "Estratégia de mostrar anúncios para pessoas que já interagiram com sua marca." },
  { termo: "BM (Business Manager)", definicao: "Gerenciador de Negócios do Meta, onde ficam todas as contas de anúncios e páginas." },
  { termo: "Criativo", definicao: "Arte ou vídeo usado nos anúncios." }
];

const faqSections = [
  {
    title: "Sobre Leads",
    icon: Users,
    questions: [
      {
        q: "O que fazer quando os leads estão fora do perfil?",
        a: "Leads fora do perfil podem ter diversas causas: segmentação ampla demais, criativo atraindo público errado, ou região muito abrangente. Abra uma demanda de 'Tráfego - Meta' ou 'Tráfego - Google' selecionando 'Leads fora do perfil' e descreva qual o perfil esperado vs. o que está chegando. Nossa equipe vai analisar e ajustar a segmentação, criativos e públicos."
      },
      {
        q: "Meus leads estão repetidos, o que fazer?",
        a: "Leads repetidos geralmente indicam que o público está muito restrito ou a frequência está alta. Abra uma demanda informando quantos leads repetidos você identificou nos últimos 10 recebidos. Vamos ajustar a frequência e expandir o público de forma estratégica."
      },
      {
        q: "Estou recebendo poucos leads, o que pode ser?",
        a: "Volume baixo de leads pode ter várias causas: orçamento insuficiente, criativo saturado, concorrência alta, ou problemas técnicos. Abra uma demanda com detalhes sobre quando o problema começou e se houve alguma mudança recente na clínica ou atendimento."
      }
    ]
  },
  {
    title: "Sobre Métricas",
    icon: BarChart3,
    questions: [
      {
        q: "O que é um CPL bom para implantes?",
        a: "O CPL ideal varia muito por região, concorrência e época do ano. Em média, CPL entre R$15-R$50 é considerado saudável para implantes. Mas o mais importante é a qualidade do lead, não apenas o custo. Um lead de R$50 que fecha é melhor que 5 leads de R$10 que não respondem."
      },
      {
        q: "Por que meu CPL subiu?",
        a: "CPL pode subir por: aumento de concorrência, criativo saturado (mesmo público vendo muitas vezes), datas comemorativas (custos de mídia sobem), ou mudanças no algoritmo. Quando identificamos alta no CPL, já iniciamos testes de novos criativos e ajustes de público."
      },
      {
        q: "Como interpretar o relatório de performance?",
        a: "Foque nos números que importam: 1) Quantidade de leads (volume), 2) CPL (eficiência), 3) Qualidade dos leads (conversão em consultas). Os outros dados são para nossa análise técnica. Em caso de dúvidas, abra uma demanda de BI/Relatório."
      }
    ]
  },
  {
    title: "Sobre Investimento",
    icon: Wallet,
    questions: [
      {
        q: "Como funciona o saldo e investimento?",
        a: "Você faz uma 'tomada de investimento' que é creditada na plataforma (Meta ou Google). Esse saldo vai sendo consumido diariamente pelos anúncios. Quando o saldo acaba, as campanhas pausam automaticamente. Por isso é importante manter saldo disponível."
      },
      {
        q: "Quanto devo investir por mês?",
        a: "Depende da sua meta de leads e capacidade de atendimento. Como referência: investimento de R$3.000-5.000/mês costuma gerar entre 60-150 leads para implantes. Converse com nosso time para definir o investimento ideal para sua realidade."
      },
      {
        q: "O que acontece se meu saldo acabar?",
        a: "As campanhas pausam automaticamente. Você receberá alertas no portal quando o saldo estiver baixo. Recomendamos sempre manter pelo menos 5 dias de investimento como reserva."
      }
    ]
  },
  {
    title: "Boas Práticas para CRC",
    icon: Target,
    questions: [
      {
        q: "Como atender os leads de forma eficiente?",
        a: "1) Responda em até 5 minutos - leads quentes esfriam rápido. 2) Ligue em vez de só mandar mensagem. 3) Seja consultivo, entenda a dor do paciente. 4) Agende a avaliação rapidamente. 5) Faça follow-up nos que não responderam."
      },
      {
        q: "O que fazer com leads que não respondem?",
        a: "Continue tentando! Faça pelo menos 6 tentativas de contato em horários diferentes. Alterne entre ligação, WhatsApp e SMS. Muitos leads convertem após múltiplas tentativas. Não desista nas primeiras tentativas."
      },
      {
        q: "Como aumentar a taxa de agendamento?",
        a: "1) Tenha disponibilidade próxima (agenda cheia = lead perdido). 2) Ofereça avaliação gratuita. 3) Facilite o acesso (localização, estacionamento). 4) Mostre cases de sucesso. 5) Trate cada lead como se fosse único - personalização importa."
      }
    ]
  },
  {
    title: "Sobre Criativos e Conteúdo",
    icon: Zap,
    questions: [
      {
        q: "Que tipo de conteúdo funciona melhor?",
        a: "Para implantes, os melhores resultados vêm de: 1) Antes e depois reais (com autorização). 2) Depoimentos em vídeo. 3) Vídeos do dentista explicando o procedimento. 4) Bastidores da clínica. Autenticidade vende mais que produção sofisticada."
      },
      {
        q: "Com que frequência devo enviar conteúdo?",
        a: "Idealmente, envie 2-4 vídeos/fotos por mês para mantermos os criativos atualizados. Criativos novos = melhor performance. Não precisa ser profissional - celular com boa iluminação já funciona."
      },
      {
        q: "Posso usar fotos/vídeos de pacientes?",
        a: "Sim, desde que tenha autorização por escrito (termo de uso de imagem). Depoimentos reais de pacientes satisfeitos são os criativos que mais convertem. Peça permissão e envie o material para nossa equipe de criação."
      }
    ]
  }
];

export default function Ajuda() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredGlossario = glossario.filter(item => 
    item.termo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.definicao.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFaq = faqSections.map(section => ({
    ...section,
    questions: section.questions.filter(q => 
      q.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.a.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(section => section.questions.length > 0);

  return (
    <div className="space-y-8">
      {/* Search */}
      <Card className="p-6 bg-gradient-to-r from-violet-600 to-violet-700">
        <h2 className="text-xl font-bold text-white mb-2">Como podemos ajudar?</h2>
        <p className="text-violet-200 mb-4">Busque por termos, dúvidas ou assuntos</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Ex: CPL, leads, investimento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white"
          />
        </div>
      </Card>

      {/* Glossário */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-violet-600" />
          <h2 className="text-xl font-bold text-slate-900">Glossário de Métricas</h2>
        </div>
        <Card className="p-0 overflow-hidden">
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {(searchTerm ? filteredGlossario : glossario).map((item, index) => (
              <div key={item.termo} className={`p-4 ${index % 2 === 0 ? 'md:border-b' : ''} border-slate-100`}>
                <h4 className="font-semibold text-violet-600">{item.termo}</h4>
                <p className="text-sm text-slate-600 mt-1">{item.definicao}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* FAQ */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-violet-600" />
          <h2 className="text-xl font-bold text-slate-900">Perguntas Frequentes</h2>
        </div>
        
        {(searchTerm ? filteredFaq : faqSections).map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title} className="mb-4">
              <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                <div className="p-2 bg-violet-100 rounded-lg">
                  <Icon className="w-4 h-4 text-violet-600" />
                </div>
                <h3 className="font-semibold text-slate-900">{section.title}</h3>
              </div>
              <Accordion type="single" collapsible className="px-4">
                {section.questions.map((item, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left text-sm font-medium">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 whitespace-pre-wrap">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Card>
          );
        })}
      </div>

      {/* Contact */}
      <Card className="p-6 bg-slate-50">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-violet-100 rounded-xl">
            <MessageCircle className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Não encontrou o que procura?</h3>
            <p className="text-sm text-slate-600 mt-1">
              Abra uma demanda de "BI/Relatório" com sua dúvida que nosso time vai responder detalhadamente.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}