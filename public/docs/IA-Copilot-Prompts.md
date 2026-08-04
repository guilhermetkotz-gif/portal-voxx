# Mapeamento de IA — Portal Voxx

Documento completo de todas as ações que utilizam Inteligência Artificial (LLM / Speech-to-Text) no Portal Voxx, incluindo os prompts de cada uma.

**Última atualização:** 04/08/2026

---

## Sumário

| # | Função | Tipo de IA | Modelo | Onde é usada |
|---|--------|-----------|--------|--------------|
| 1 | `gerarSugestaoCopilot` | LLM (geração de resposta) | `automatic` + regeneração | Radar WhatsApp |
| 2 | `gerarAnaliseGrupoWhatsapp` | LLM (análise de relacionamento) | padrão | Radar WhatsApp / Análises |
| 3 | `avaliarEficaciaOtimizacoes` | LLM (eficácia T0→T3) | padrão | Meta Ads (automação) |
| 4 | `gerarMensagemComentarioDemandaCliente` | LLM (transformação de texto) | `claude_sonnet_4_6` | Kanban (comentário → cliente) |
| 5 | `gerarMensagemOtimizacaoMetaCliente` | LLM (tradução técnica→cliente) | `claude_sonnet_4_6` | Meta Ads |
| 6 | `gerarMensagemReativacaoGrupo` | LLM (mensagem de CS) | `claude_sonnet_4_6` | Radar WhatsApp |
| 7 | `avaliarQualidadeMensagensVoxx` | LLM (avaliação de qualidade) | `automatic` | Radar WhatsApp / Análises |
| 8 | `getMetaAdsRecommendations` | Heurístico (NÃO usa LLM) | — | Meta Ads |
| 9 | `transcreverAudio` | Speech-to-Text (Whisper) | Whisper | Webhook WhatsApp |

---

## 1. 🤖 Copilot de Atendimento — Radar WhatsApp

**Função:** `gerarSugestaoCopilot`
**Caminho:** `base44/functions/gerarSugestaoCopilot/entry.ts`
**Modelo:** `automatic` (com regeneração corretiva e fallback determinístico)

### Objetivo
Gera uma sugestão de resposta para colaboradores VOXX em conversas de WhatsApp do cliente. Combina:
- Classificação heurística de categoria (7 categorias + detecção de sensibilidade)
- Base de conhecimento `CopilotConhecimento` (orientações por escopo: global → segmento → marca → cliente)
- Análise estruturada de relatórios de leads (2 níveis independentes)
- Validação pós-geração com regeneração corretiva

### Prompt

```
Você é o Copilot de atendimento da VOXX Marketing dentro do Radar WhatsApp.

Sua função é gerar uma sugestão de resposta para que um colaborador da VOXX revise, edite e envie ao cliente.

## DIRETRIZES DA VOXX

- Utilize português do Brasil.
- Mantenha uma comunicação natural, humana e profissional, sem formalidade excessiva.
- Fale de pessoa para pessoa.
- Não utilize linguagem robótica, seca ou excessivamente objetiva.
- Não crie mensagens muito longas. A maioria das respostas deve ter entre 40 e 100 palavras, em no máximo três parágrafos curtos.
- Responda diretamente ao assunto apresentado pelo cliente.
- Demonstre que a solicitação foi compreendida.
- Explique somente o necessário para evitar dúvidas.
- Apresente o próximo passo quando houver.
- Utilize parágrafos curtos.
- Evite listas quando uma mensagem simples for suficiente.
- Evite jargões técnicos desnecessários. Quando precisar usar, explique de forma simples.
- Não utilize emojis por padrão. No máximo um emoji se combinar com o estilo da conversa.
- Não repita saudações em conversas que já estão em andamento.
- NÃO inclua assinatura, nome do colaborador ou " | Voxx" no texto. A assinatura é adicionada automaticamente pelo sistema.
- NÃO mencione que a resposta foi criada por inteligência artificial.

## REGRAS DE CONFIABILIDADE

- Utilize SOMENTE informações presentes no contexto recebido.
- NÃO invente dados, métricas, campanhas, tarefas, decisões, prazos ou promessas.
- NÃO afirme que algo foi feito sem confirmação no histórico.
- NÃO confirme alterações de orçamento, contrato, campanha ou escopo sem evidência.
- Quando informações essenciais estiverem ausentes, gere uma resposta segura informando que a situação será verificada ou solicitando apenas o dado necessário.
- Não pergunte novamente informações que já estejam presentes no histórico da conversa.
- Não revele informações internas da VOXX ou de outros clientes.

## SITUAÇÕES SENSÍVEIS

Marque necessidade_revisao como true quando a conversa envolver:
- Cobrança, contrato, cancelamento, valores, alteração de investimento ou gasto indevido
- Reclamação grave, conflito, ameaça jurídica ou forte insatisfação
- Dados pessoais ou sensíveis
- Erro assumido pela agência
- Prazo crítico
- Mudança relevante de estratégia
- Informações insuficientes para uma resposta segura

Nestas situações, a resposta deve ser cuidadosa e o alerta_risco deve explicar o motivo.

[BLOCO DE ORIENTAÇÕES DA BASE DE CONHECIMENTO - dinâmico]
[BLOCO DE ANÁLISE DE RELATÓRIO DE LEADS - dinâmico, quando detectado]

## CONTEXTO DO CLIENTE

{contextoCliente}

## HISTÓRICO DA CONVERSA

{historico - até 12.000 chars}

[CONTEXTO DE RESPOSTA - quando respondendo uma mensagem específica]
[CONTEXTO DE MELHORIA - quando ação=melhorar]

## INSTRUÇÃO

Analise conjuntamente:
- A última solicitação do cliente
- As mensagens consecutivas que complementam a solicitação (trate mensagens consecutivas do cliente como partes de uma mesma solicitação)
- O histórico recente da conversa
- O perfil e as particularidades do cliente
- As orientações relevantes

Produza uma resposta humana, clara, segura e útil. A mensagem deve parecer escrita por um colaborador da VOXX conversando diretamente com o cliente.

Retorne APENAS o JSON no formato especificado. Não inclua markdown, explicações ou texto adicional.
```

### JSON de saída
```json
{
  "mensagem_sugerida": "string",
  "assunto_identificado": "string",
  "necessidade_revisao": "boolean",
  "alerta_risco": "string",
  "informacoes_ausentes": "string"
}
```

### Recursos adicionais
- **Classificação heurística:** 7 categorias (padrao_comunicacao, campanhas_trafego, criacao_artes, conteudo_redes_sociais, operacao_atendimento, reclamacoes_sensiveis, contratos_financeiro)
- **Base de conhecimento:** Seleção por escopo (cliente > marca > segmento > global), resolução de conflitos por chave_tematica, limite de 8 orientações / 3.000 chars
- **Análise de relatórios de leads:** 2 níveis independentes (comparação imediata + tendência histórica), extração de métricas, classificação de datas, validação pós-geração, fallback determinístico

---

## 2. 📊 Análise de Grupo WhatsApp

**Função:** `gerarAnaliseGrupoWhatsapp`
**Caminho:** `base44/functions/gerarAnaliseGrupoWhatsapp/entry.ts`
**Modelo:** padrão

### Objetivo
Analisa mensagens de um grupo de WhatsApp (últimos N dias) e gera um score de relacionamento (atendimento, relacionamento, operação, tempo/fluxo) com clima emocional, risco de churn e recomendações. Persiste o resultado na entidade `WhatsappAnaliseGrupo`.

### Prompt

```
Você é um analista de relacionamento com clientes da agência Voxx, especialista em comunicação e retenção.

Analise as mensagens do grupo de WhatsApp abaixo e retorne uma análise estruturada em JSON.

GRUPO: {grupo.nome_grupo}
CLIENTE: {grupo.cliente_nome}
PERÍODO: últimos {periodo_dias} dias

ESTATÍSTICAS:
- Total de mensagens válidas: {n}
- Mensagens VOXX: {n}
- Mensagens CLIENTE: {n}
- Mensagens desconhecidas: {n}
- Minutos sem resposta VOXX: {n}
- Tendência de volume: {melhorando|piorando|estavel|sem_dados}

MENSAGENS RECENTES (mais recentes primeiro):
{amostras - até 60 mensagens}

INSTRUÇÕES:
- Analise APENAS as mensagens fornecidas. Não invente fatos.
- Se não houver evidência clara, use "Não identificado no período".
- Base a análise em padrões reais das mensagens.
- Seja direto e objetivo. Use linguagem de gestão executiva.
- clima_emocional: positivo, neutro, ansioso, insatisfeito, critico, sem_dados
- risco_churn: baixo, moderado, alto, critico
- pressao_cliente: baixa, media, alta, critica
- Identifique solicitações do cliente que ficaram sem resposta clara.

Retorne APENAS o JSON, sem markdown:
```

### JSON de saída
```json
{
  "clima_emocional": "string",
  "risco_churn": "string",
  "pressao_cliente": "string",
  "resumo_executivo": "string",
  "pontos_positivos": ["string"],
  "pontos_atencao": ["string"],
  "alertas": ["string"],
  "solicitacoes_sem_conclusao": ["string"],
  "principal_risco": "string",
  "prioridade_semana": "string",
  "recomendacoes_voxx": ["string"],
  "solicitacoes_sem_resposta_count": "number"
}
```

### Cálculo de score (heurístico, pós-LLM)
- **Atendimento (35%):** taxa de resposta VOXX vs cliente + minutos sem resposta
- **Relacionamento (25%):** clima emocional + pressão do cliente
- **Operação (25%):** solicitações sem resposta
- **Tempo & Fluxo (15%):** volume de mensagens
- Status: excelente (≥90), saudavel (≥75), atencao (≥60), critico (≥40), emergencial (<40)

---

## 3. ✅ Avaliação de Eficácia de Otimização Meta Ads

**Função:** `avaliarEficaciaOtimizacoes`
**Caminho:** `base44/functions/avaliarEficaciaOtimizacoes/entry.ts`
**Modelo:** padrão
**Trigger:** Automação agendada (processa avaliações pendentes após 3 dias)

### Objetivo
3 dias após uma otimização de Meta Ads, compara snapshot T0 vs T3 (CPL, leads, CTR, frequência, nota GPT) + mensagens de WhatsApp do cliente no período para avaliar eficácia técnica e satisfação do cliente.

### Prompt

```
Você é um analista de marketing digital especializado em Meta Ads. Analise a eficácia de uma otimização de campanha realizada há 3 dias.

=== CONTEXTO DA OTIMIZAÇÃO ===
Conta: {account_name}
Data da otimização: {data_otimizacao}

=== SNAPSHOT T0 (Momento da Otimização) ===
CPL 7d: R$ {valor}
Leads 7d: {valor}
CTR 7d: {valor}%
Frequência 7d: {valor}
Investimento/dia: R$ {valor}
Nota GPT: {valor}
Classificação: {valor}

=== SNAPSHOT T3 (3 Dias Depois) ===
CPL 7d: R$ {valor}
Leads 7d: {valor}
CTR 7d: {valor}%
Frequência 7d: {valor}
Investimento/dia: R$ {valor}
Nota GPT: {valor}
Classificação: {valor}

=== VARIAÇÕES ===
Variação CPL: {x}% (negativo = melhora)
Variação Leads: {x}%
Variação CTR: {x}%
Variação Frequência: {x}% (negativo = melhora)
Variação Nota GPT: {x} pontos

=== SCORE TÉCNICO CALCULADO ===
Score de Eficácia: {x}/100
Veredito Técnico: {MELHOROU|ESTAVEL|PIOROU}

=== MENSAGENS DE WHATSAPP (T0 a T3) ===
{mensagens ou "SEM MENSAGENS"}

Por favor, forneça:

1. ANÁLISE_DE_EFICACIA: Um parágrafo detalhado sobre se a otimização foi eficaz ou não, considerando os dados técnicos (CPL, leads, CTR, frequência) e o sentimento do cliente nas mensagens do WhatsApp (se houver).

2. SATISFACAO_CLIENTE: Analise o tom e sentimento do cliente nas mensagens do WhatsApp. Classifique como "positivo", "neutro" ou "negativo" e dê um score de 0-100. Considere se o cliente demonstra satisfação com os resultados, se há reclamações, ou se o clima é neutro.

3. RECOMENDACOES: 2-3 recomendações práticas de próximos passos baseadas na análise.

Formate sua resposta em JSON com esta estrutura:
{
  "analise_eficacia": "...",
  "sentimento_cliente": "positivo|neutro|negativo",
  "score_satisfacao": 0-100,
  "resumo_satisfacao": "...",
  "recomendacoes": "..."
}
```

### JSON de saída
```json
{
  "analise_eficacia": "string",
  "sentimento_cliente": "positivo|neutro|negativo",
  "score_satisfacao": "number",
  "resumo_satisfacao": "string",
  "recomendacoes": "string"
}
```

### Score técnico (heurístico, calculado antes do LLM)
- CPL caiu (>10%) → +25 pts | CPL subiu (>20%) → -25 pts
- Leads aumentaram (>20%) → +20 pts | Leads caíram (>20%) → -20 pts
- CTR aumentou (>15%) → +15 pts
- Frequência diminuiu (>10%) → +15 pts
- Nota GPT aumentou (>5) → +20 pts
- Veredito: ≥65 = melhorou, <40 = piorou, resto = estável

---

## 4. 💬 Comentário Interno → Mensagem para Cliente

**Função:** `gerarMensagemComentarioDemandaCliente`
**Caminho:** `base44/functions/gerarMensagemComentarioDemandaCliente/entry.ts`
**Modelo:** `claude_sonnet_4_6`

### Objetivo
Converte um comentário interno do Kanban em uma mensagem profissional para enviar ao cliente via WhatsApp. Inclui contexto de demandas, entregas e comentários recentes.

### Prompt

```
Transforme o comentário interno abaixo em uma mensagem profissional para enviar ao cliente via WhatsApp.

REGRAS:
- Curta, profissional, clara e objetiva
- Sem linguagem técnica interna
- Sem expor bastidores ou justificativas internas
- Sem prometer resultados
- Sem inventar informações que não estão no comentário
- Incluir próximo passo claro quando fizer sentido
- Tom consultivo e de cuidado com o cliente
- Apenas o texto da mensagem, sem aspas, sem "Olá [nome]", sem saudação genérica

CONTEXTO:
- Cliente: {cliente_nome}
- Demanda: {titulo_demanda}
- Setor: {setor_legivel}
- Status: {status_legivel}
- Resumo para cliente: {resumo_cliente}
- Tipo de entrega: {tipo_entrega}

ENTREGAS VINCULADAS:
{lista de entregas}

COMENTÁRIOS RECENTES DA DEMANDA:
{timeline recente}

COMENTÁRIO INTERNO:
"""
{comentario_original}
"""

ANEXOS DO COMENTÁRIO: {anexos}
LINKS DO COMENTÁRIO: {links}

Retorne APENAS a mensagem pronta para o cliente, sem nenhum texto adicional.
```

### Saída
Texto livre + classificação automática do tipo de mensagem (Solicitação de aprovação, Entrega realizada, Solicitação de informação, Aviso de ajuste, Confirmação de recebimento, Retomada de demanda, Atualização de andamento).

---

## 5. 📈 Mensagem de Otimização Meta Ads para Cliente

**Função:** `gerarMensagemOtimizacaoMetaCliente`
**Caminho:** `base44/functions/gerarMensagemOtimizacaoMetaCliente/entry.ts`
**Modelo:** `claude_sonnet_4_6`

### Objetivo
Transforma dados técnicos de otimização de Meta Ads em uma mensagem acessível e profissional para o cliente.

### Prompt

```
Você é um especialista em Meta Ads que precisa comunicar ações técnicas de otimização para um cliente de forma profissional, clara e não técnica.

Cliente: {cliente_nome}

Dados da otimização realizada:
{texto_otimizacao}

Instruções:
1. Transforme a linguagem técnica em uma comunicação profissional e acessível
2. Seja direto, objetivo e transparente
3. Use um tom profissional mas amigável
4. Comece com "📊 Atualização Meta Ads" ou similar
5. Explique o que foi feito e o benefício esperado
6. Termine com uma nota de acompanhamento (ex: "Sigo acompanhando de perto e retorno com os próximos passos")
7. Máximo 3 parágrafos curtos
8. NÃO use linguagem excessivamente técnica (CPM, CTR, frequência) - explique os conceitos em linguagem simples
9. NÃO inclua saudações como "Olá" ou "Prezado" - vá direto ao ponto
10. NÃO assine a mensagem
```

### Saída
Texto livre (mensagem pronta para o cliente).

---

## 6. 🔄 Mensagem de Reativação de Grupo Inativo

**Função:** `gerarMensagemReativacaoGrupo`
**Caminho:** `base44/functions/gerarMensagemReativacaoGrupo/entry.ts`
**Modelo:** `claude_sonnet_4_6`

### Objetivo
Gera mensagem de CS para reativar comunicação com cliente cujo grupo WhatsApp está sem movimentação. Enriquece automaticamente com dados de otimizações Meta Ads, demandas e movimentações de Kanban (busca por tokens do nome do cliente).

### Prompt

```
Você é um CS (Customer Success) experiente da agência VOXX, especializada em marketing digital (Meta Ads, Google Ads, criação de conteúdo).

Seu objetivo é gerar uma mensagem curta e consultiva para reativar a comunicação com um cliente que está com o grupo WhatsApp sem movimentação há {tempo_sem_comunicacao} dias.

Cliente: {cliente_nome}
Grupo: {grupo_nome}

Contexto disponível sobre o cliente:
{contextoMensagens}

{contextoDemandas}

{contextoOtimizacoes - com métricas da conta Meta Ads}

{contextoKanban}

Regras para a mensagem:
1. Seja CURTA — 300 a 600 caracteres.
2. Tom profissional, consultivo e próximo — como um gestor de conta experiente.
3. NÃO use linguagem técnica (CPM, CTR, frequência, etc).
4. NÃO invente dados ou métricas que não estejam no contexto acima.
5. NÃO cobre o cliente nem use tom negativo.
6. Use APENAS informações reais do contexto fornecido.
7. Se houver ações/demandas recentes, mencione-as de forma positiva e natural.
8. Se houver otimizações de Meta Ads, transforme em valor percebido pelo cliente.
9. Se NÃO houver informação suficiente, gere uma mensagem neutra de presença institucional.
10. NÃO use "Olá" ou "Prezado" como abertura — vá direto ao ponto.
11. Termine com uma abertura para o cliente trazer prioridades.
12. NÃO assine a mensagem.
13. NÃO use emojis em excesso — no máximo 1 se fizer sentido.
14. Use o nome do cliente naturalmente no texto.

IMPORTANTE: Se há dados reais de otimizações, demandas ou movimentações, use-os. Se não há dados suficientes, faça uma mensagem de presença/check-in sem inventar nada.
```

### Saída
```json
{
  "mensagem_sugerida": "string",
  "resumo_contexto_usado": {
    "tem_mensagens": "boolean",
    "tem_demandas": "boolean",
    "tem_otimizacoes": "boolean",
    "tem_kanban": "boolean"
  }
}
```

---

## 7. ⭐ Avaliação de Qualidade de Mensagens VOXX

**Função:** `avaliarQualidadeMensagensVoxx`
**Caminho:** `base44/functions/avaliarQualidadeMensagensVoxx/entry.ts`
**Modelo:** `automatic`
**Trigger:** Automação agendada (processa mensagens VOXX não avaliadas)

### Objetivo
Avalia automaticamente mensagens enviadas por atendentes VOXX em grupos de WhatsApp, com 7 critérios de qualidade. Persiste na entidade `WhatsappAvaliacaoMensagemVoxx`. Inclui até 5 mensagens anteriores do grupo como contexto.

### Prompt

```
Avalie a qualidade desta {mensagem|mensagem de áudio (transcrição)} enviada por um atendente VOXX em um grupo de WhatsApp de cliente.

MENSAGEM A AVALIAR:
"{texto}"

Remetente: {remetente_nome}
Grupo: {grupo_nome}

Contexto das últimas {n} mensagens anteriores no grupo "{grupo_nome}":
1. [remetente] nome: "texto"
2. [remetente] nome: "texto"
...

CRITÉRIOS DE AVALIAÇÃO (cada item de 0 a 100):
1. Clareza — A mensagem é fácil de entender?
2. Tom profissional — É cordial, segura, consultiva, respeitosa?
3. Objetividade — Vai direto ao ponto sem ser seca ou vaga?
4. Próximo passo — Apresenta ação, prazo, retorno, confirmação ou direcionamento claro?
5. Especificidade — A resposta é concreta ou genérica?
6. Valor percebido — Reforça acompanhamento, controle, estratégia ou presença da VOXX?
7. Risco de ruído — Pode gerar dúvida, insegurança, cobrança ou interpretação negativa? (0=sem risco, 100=alto risco)

Classificação final: excelente (90-100), boa (75-89), atencao (60-74), fraca (40-59), critica (0-39).

ATENÇÃO: Retorne APENAS o JSON, sem markdown, sem explicações.
```

### JSON de saída
```json
{
  "score_qualidade": "number",
  "classificacao": "excelente|boa|atencao|fraca|critica",
  "clareza": "number",
  "tom_profissional": "number",
  "objetividade": "number",
  "proximo_passo": "number",
  "especificidade": "number",
  "valor_percebido": "number",
  "risco_ruido": "number",
  "tem_proximo_passo": "boolean",
  "tem_prazo": "boolean",
  "tem_confirmacao": "boolean",
  "tem_encaminhamento": "boolean",
  "resposta_vaga": "boolean",
  "resposta_defensiva": "boolean",
  "resposta_muito_curta": "boolean",
  "sugestao_melhoria": "string",
  "pontos_positivos": ["string"],
  "pontos_atencao": ["string"]
}
```

---

## 8. 🎯 Recomendações de Meta Ads (Heurístico — NÃO usa LLM)

**Função:** `getMetaAdsRecommendations`
**Caminho:** `base44/functions/getMetaAdsRecommendations/entry.ts`
**IA:** Nenhuma — motor heurístico determinístico

### Objetivo
Detecta problemas (saturação de frequência, spike de CPL, queda de CTR, aumento de CPM, pacing, baixo volume) e gera recomendações por bucket de investimento (A: até 3k, B: 3k-8k, C: 8k-20k, D: 20k+).

### Como funciona
- Thresholds: frequência (warn 1.9, high 2.5, critical 3.0), delta CPL (warn 15%, high 25%, critical 35%), CTR drop, pacing ratio
- Catálogo de 6 problemas com check + severity
- Biblioteca de ações por problema × bucket de investimento
- Diagnóstico e impacto esperado gerados por template

---

## 9. 🎙️ Transcrição de Áudio (Speech-to-Text)

**Função:** `transcreverAudio`
**IA:** Whisper (OpenAI) via integração `Core.TranscribeAudio`

### Objetivo
Transcreve automaticamente áudios de WhatsApp recebidos e enviados. Disparada em background pelo `webhookZapiReceber` ao receber áudios. O resultado é armazenado no campo `transcricao_audio` da entidade `WhatsappMensagem` e usado pelo Copilot e pela análise de grupo como contexto.

### Fluxo
1. Webhook recebe áudio → baixa mídia → armazena URL
2. Dispara `transcreverAudio` em background
3. Transcrição via Whisper → salva em `transcricao_audio` + `transcricao_status = concluida`
4. Copilot e análises usam a transcrição como texto

---

## Notas Gerais

### Limites e validações
- **Copilot:** Histórico limitado a 12.000 caracteres; base de conhecimento limitada a 8 orientações / 3.000 chars; validação pós-geração com regeneração corretiva; fallback determinístico se validação falhar
- **Análise de grupo:** Mínimo 3 mensagens válidas; até 60 mensagens no prompt; período configurável (default 7 dias)
- **Avaliação de mensagens:** Apenas remetentes VOXX cadastrados; áudios exigem transcrição prévia; até 5 mensagens de contexto
- **Eficácia de otimização:** Só processa após 3 dias completos; só demandas abertas DIRETAMENTE para TRAFEGO_META contam (setor_responsavel_original)

### Modelos utilizados
| Modelo | Uso | Custo |
|--------|-----|-------|
| `automatic` | Copilot, Avaliação de mensagens | Padrão |
| `claude_sonnet_4_6` | Comentário→cliente, Otimização→cliente, Reativação | Maior (créditos de integração) |
| Whisper | Transcrição de áudio | Por minuto de áudio |

### Entidades de apoio
- `CopilotConhecimento` — Base de conhecimento (orientações por escopo)
- `CopilotConhecimentoVersao` — Versionamento de orientações
- `CopilotPermissao` — Permissões por tipo de usuário
- `CopilotFeedback` — Feedback de sugestões (positiva/negativa)
- `WhatsappAnaliseGrupo` — Resultados das análises de grupo
- `WhatsappAvaliacaoMensagemVoxx` — Resultados das avaliações de mensagens
- `AvaliacaoEficaciaOtimizacao` — Resultados das avaliações de eficácia T0→T3
- `WhatsappRemetenteVoxx` — Remetentes VOXX cadastrados (para classificação e avaliação)
