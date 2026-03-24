import { jsPDF } from 'jspdf';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── CORES ──────────────────────────────────────────────────────────────────
const VOXX_PURPLE = [109, 40, 217];   // violet-700
const VOXX_LIGHT  = [237, 233, 254];  // violet-100
const BLACK       = [15, 15, 15];
const GRAY        = [100, 100, 100];
const LIGHT_GRAY  = [245, 245, 245];
const WHITE       = [255, 255, 255];
const RED         = [220, 38, 38];
const GREEN       = [22, 163, 74];

// ── HELPERS ────────────────────────────────────────────────────────────────
function r(c) { return c[0]; }
function g(c) { return c[1]; }
function b(c) { return c[2]; }
function setFill(doc, color) { doc.setFillColor(r(color), g(color), b(color)); }
function setTextColor(doc, color) { doc.setTextColor(r(color), g(color), b(color)); }
function setDrawColor(doc, color) { doc.setDrawColor(r(color), g(color), b(color)); }

// ── PAGE HELPERS ───────────────────────────────────────────────────────────
function newPage(doc) {
  doc.addPage();
  // subtle top bar
  setFill(doc, VOXX_PURPLE);
  doc.rect(0, 0, 210, 4, 'F');
  // footer
  setTextColor(doc, [180, 180, 180]);
  doc.setFontSize(8);
  doc.text('VOXX Marketing Digital — Diagnóstico Confidencial', 105, 292, { align: 'center' });
}

function sectionTitle(doc, text, y) {
  setFill(doc, VOXX_LIGHT);
  doc.roundedRect(20, y, 170, 10, 2, 2, 'F');
  setTextColor(doc, VOXX_PURPLE);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(text, 25, y + 7);
  return y + 16;
}

function scoreBar(doc, label, value, y, color = VOXX_PURPLE) {
  setTextColor(doc, GRAY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(label, 25, y);
  doc.text(`${value}/100`, 175, y, { align: 'right' });
  // bg
  setFill(doc, [230, 230, 230]);
  doc.roundedRect(25, y + 2, 150, 4, 2, 2, 'F');
  // fill
  const w = Math.max(2, (value / 100) * 150);
  setFill(doc, color);
  doc.roundedRect(25, y + 2, w, 4, 2, 2, 'F');
  return y + 14;
}

function bulletList(doc, items, y, color = BLACK) {
  setTextColor(doc, color);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  items.forEach(item => {
    if (y > 270) return;
    doc.text('•', 25, y);
    const lines = doc.splitTextToSize(item, 155);
    lines.forEach((line, i) => {
      doc.text(line, 32, y + (i * 5));
    });
    y += lines.length * 5 + 4;
  });
  return y;
}

function paragraph(doc, text, y, color = BLACK) {
  if (!text) return y;
  setTextColor(doc, color);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const lines = doc.splitTextToSize(text, 170);
  doc.text(lines, 20, y);
  return y + lines.length * 5.5 + 4;
}

// classification config
function classLabel(voxx_score) {
  if (voxx_score >= 80) return { label: 'Estruturado', color: GREEN };
  if (voxx_score >= 60) return { label: 'Ajustável', color: [37, 99, 235] };
  if (voxx_score >= 40) return { label: 'Desorganizado', color: [245, 158, 11] };
  return { label: 'Crítico', color: RED };
}

// ── MAIN EXPORT ────────────────────────────────────────────────────────────
export function gerarPDFScannerVoxx(lead, analise) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const nomeclinica = lead?.nome_empresa || 'Clínica';
  const cidade = lead?.cidade || '';
  const dataAnalise = analise?.data_analise
    ? format(parseISO(analise.data_analise), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const voxx_score = analise?.voxx_score ?? 0;
  const instagram_score = analise?.instagram_score ?? 0;
  const gmn_score = analise?.gmn_score ?? 0;
  const ads_score = analise?.ads_score ?? 0;
  const cls = classLabel(voxx_score);

  const hasInstagram = !!lead?.link_instagram;
  const hasGMN = !!(lead?.gmn_link || lead?.gmn_analise);
  const hasAds = ads_score > 0 || !!lead?.link_biblioteca_ads;

  // ─── PÁGINA 1 — CAPA ─────────────────────────────────────────────────────
  // full top purple block
  setFill(doc, VOXX_PURPLE);
  doc.rect(0, 0, 210, 120, 'F');

  // VOXX logo text
  setTextColor(doc, WHITE);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('VOXX', 105, 45, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Marketing Digital', 105, 53, { align: 'center' });

  // title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Diagnóstico de Presença Digital', 105, 80, { align: 'center' });
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text('Análise Estratégica — Scanner VOXX', 105, 89, { align: 'center' });

  // clinic info card
  setFill(doc, WHITE);
  doc.roundedRect(30, 105, 150, 65, 4, 4, 'F');
  setTextColor(doc, VOXX_PURPLE);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(nomeclinica, 105, 125, { align: 'center' });
  if (cidade) {
    setTextColor(doc, GRAY);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(cidade, 105, 134, { align: 'center' });
  }
  // horizontal line
  setDrawColor(doc, VOXX_LIGHT);
  doc.setLineWidth(0.5);
  doc.line(45, 140, 165, 140);
  setTextColor(doc, GRAY);
  doc.setFontSize(10);
  doc.text(`Data: ${dataAnalise}`, 105, 151, { align: 'center' });
  doc.setFontSize(9);
  doc.text('Documento confidencial — uso interno e comercial', 105, 159, { align: 'center' });

  // bottom tagline
  setTextColor(doc, GRAY);
  doc.setFontSize(9);
  doc.text('Especialistas em crescimento previsível para clínicas', 105, 285, { align: 'center' });

  // ─── PÁGINA 2 — VISÃO GERAL ───────────────────────────────────────────────
  newPage(doc);

  // Big score circle
  setFill(doc, VOXX_PURPLE);
  doc.circle(105, 55, 30, 'F');
  setTextColor(doc, WHITE);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(`${voxx_score}`, 105, 52, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('/100', 105, 62, { align: 'center' });

  setTextColor(doc, BLACK);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('🔥 VOXX SCORE', 105, 97, { align: 'center' });

  // classification badge
  setFill(doc, cls.color);
  doc.roundedRect(70, 101, 70, 10, 3, 3, 'F');
  setTextColor(doc, WHITE);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(cls.label.toUpperCase(), 105, 108, { align: 'center' });

  // priority
  const isAlta = analise?.lead_priority === 'ALTA PRIORIDADE';
  setFill(doc, isAlta ? RED : [34, 197, 94]);
  doc.roundedRect(70, 114, 70, 8, 3, 3, 'F');
  setTextColor(doc, WHITE);
  doc.setFontSize(9);
  doc.text(analise?.lead_priority || 'Monitorar', 105, 120, { align: 'center' });

  // sub scores
  let y = 133;
  y = sectionTitle(doc, '📊 Breakdown por Canal', y);
  y = scoreBar(doc, 'Instagram (40%)', instagram_score, y, [236, 72, 153]);
  y = scoreBar(doc, 'Google Meu Negócio (35%)', gmn_score, y, [37, 99, 235]);
  y = scoreBar(doc, 'Tráfego / Ads (25%)', ads_score, y, VOXX_PURPLE);

  // diagnosis
  y += 4;
  y = sectionTitle(doc, '🧠 Diagnóstico Geral', y);
  paragraph(doc, analise?.diagnosis, y, GRAY);

  // ─── PÁGINA 3 — INSTAGRAM ─────────────────────────────────────────────────
  if (hasInstagram) {
    newPage(doc);
    let y = 15;

    setTextColor(doc, VOXX_PURPLE);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('📸 Análise do Instagram', 20, y + 8);
    y += 20;

    // score badge
    setFill(doc, [252, 231, 243]);
    doc.roundedRect(20, y, 60, 22, 3, 3, 'F');
    setTextColor(doc, [219, 39, 119]);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(`${instagram_score}`, 50, y + 11, { align: 'center' });
    doc.setFontSize(9);
    doc.text('/100', 50, y + 18, { align: 'center' });
    y += 32;

    const instaFailures = (analise?.main_failures || []).filter(f =>
      /instagram|perfil|feed|stories|bio|conteúdo|engajamento|post|seguidor/i.test(f)
    );
    const generalFailures = instaFailures.length > 0 ? instaFailures : (analise?.main_failures || []).slice(0, 3);

    y = sectionTitle(doc, '⚠️ Falhas Identificadas', y);
    y = bulletList(doc, generalFailures.length > 0 ? generalFailures : ['Nenhuma falha crítica identificada no Instagram'], y, RED);

    y += 6;
    y = sectionTitle(doc, '📉 Impacto no Negócio', y);
    paragraph(doc, 'A ausência de estratégia consistente no Instagram reduz a percepção de autoridade da clínica, diminui o alcance orgânico e impede que potenciais pacientes encontrem provas sociais que os convençam a agendar.', y, GRAY);
  }

  // ─── PÁGINA 4 — GMN ───────────────────────────────────────────────────────
  if (hasGMN) {
    newPage(doc);
    let y = 15;

    setTextColor(doc, VOXX_PURPLE);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('📍 Análise Google Meu Negócio', 20, y + 8);
    y += 20;

    // score badge
    setFill(doc, [219, 234, 254]);
    doc.roundedRect(20, y, 60, 22, 3, 3, 'F');
    setTextColor(doc, [37, 99, 235]);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(`${gmn_score}`, 50, y + 11, { align: 'center' });
    doc.setFontSize(9);
    doc.text('/100', 50, y + 18, { align: 'center' });
    y += 32;

    // checklist GMN
    const checklist = analise?.checklist_gmn || {};
    if (Object.values(checklist).some(v => v !== null && v !== undefined)) {
      y = sectionTitle(doc, '🔍 Estrutura do Perfil GMN', y);
      const items = [
        checklist.has_website !== null ? `Site vinculado: ${checklist.has_website ? '✓ Sim' : '✗ Não'}` : null,
        checklist.has_whatsapp !== null ? `WhatsApp no perfil: ${checklist.has_whatsapp ? '✓ Sim' : '✗ Não'}` : null,
        checklist.has_call_button !== null ? `Botão de ligação: ${checklist.has_call_button ? '✓ Sim' : '✗ Não'}` : null,
        checklist.has_description !== null ? `Descrição estratégica: ${checklist.has_description ? '✓ Sim' : '✗ Não'}` : null,
        checklist.has_services !== null ? `Serviços cadastrados: ${checklist.has_services ? '✓ Sim' : '✗ Não'}` : null,
        checklist.has_hours !== null ? `Horário atualizado: ${checklist.has_hours ? '✓ Sim' : '✗ Não'}` : null,
        checklist.rating ? `Nota média: ${checklist.rating} ⭐` : null,
        checklist.reviews_count ? `Total de avaliações: ${checklist.reviews_count}` : null,
      ].filter(Boolean);
      y = bulletList(doc, items, y, GRAY);
      y += 4;
    }

    const gmnFailures = (analise?.main_failures || []).filter(f =>
      /google|gmn|avalia|negócio|mapa|site|whatsapp/i.test(f)
    );

    y = sectionTitle(doc, '⚠️ Falhas Identificadas', y);
    y = bulletList(doc, gmnFailures.length > 0 ? gmnFailures : ['Nenhuma falha crítica identificada no GMN'], y, RED);

    y += 6;
    y = sectionTitle(doc, '📉 Impacto no Negócio', y);
    paragraph(doc, 'Pacientes que buscam tratamento no Google não encontram informações completas de contato, reduzindo drasticamente a taxa de conversão de visitas em agendamentos.', y, GRAY);
  }

  // ─── PÁGINA 5 — ADS ───────────────────────────────────────────────────────
  if (hasAds) {
    newPage(doc);
    let y = 15;

    setTextColor(doc, VOXX_PURPLE);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('📢 Análise de Tráfego Pago', 20, y + 8);
    y += 20;

    setFill(doc, VOXX_LIGHT);
    doc.roundedRect(20, y, 60, 22, 3, 3, 'F');
    setTextColor(doc, VOXX_PURPLE);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(`${ads_score}`, 50, y + 11, { align: 'center' });
    doc.setFontSize(9);
    doc.text('/100', 50, y + 18, { align: 'center' });
    y += 32;

    const adsFailures = (analise?.main_failures || []).filter(f =>
      /tráfego|anúncio|ads|campanha|meta|facebook|instagram ad/i.test(f)
    );

    y = sectionTitle(doc, '⚠️ Falhas nas Campanhas', y);
    y = bulletList(doc, adsFailures.length > 0 ? adsFailures : ['Nenhuma campanha ativa identificada'], y, RED);

    y += 6;
    y = sectionTitle(doc, '📉 Impacto no Negócio', y);
    paragraph(doc, 'Sem tráfego pago bem estruturado, a clínica depende exclusivamente do orgânico para geração de leads — o que limita o crescimento previsível e a escalabilidade da captação de pacientes.', y, GRAY);
  }

  // ─── PÁGINA 6 — PRINCIPAIS FALHAS ────────────────────────────────────────
  newPage(doc);
  let y6 = 15;
  setTextColor(doc, VOXX_PURPLE);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('⚠️ Principais Falhas Identificadas', 20, y6 + 8);
  y6 += 22;

  const failures = analise?.main_failures || [];
  failures.forEach((f, i) => {
    if (y6 > 265) return;
    setFill(doc, i % 2 === 0 ? LIGHT_GRAY : WHITE);
    doc.roundedRect(20, y6, 170, 14, 2, 2, 'F');
    setFill(doc, RED);
    doc.circle(28, y6 + 7, 2.5, 'F');
    setTextColor(doc, BLACK);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(f, 150);
    doc.text(lines[0], 34, y6 + 7.5);
    y6 += 17;
  });

  // ─── PÁGINA 7 — IMPACTO ───────────────────────────────────────────────────
  newPage(doc);
  // full purple hero
  setFill(doc, VOXX_PURPLE);
  doc.rect(0, 0, 210, 70, 'F');
  setTextColor(doc, WHITE);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('📉 Impacto no Negócio', 105, 30, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('O custo real de não agir agora', 105, 42, { align: 'center' });

  let y7 = 85;
  const impactText = `Hoje, essas falhas fazem com que a ${nomeclinica} perca pacientes diariamente — inclusive aqueles que já estão prontos para iniciar tratamento.\n\nPacientes pesquisam antes de decidir. Se encontram um perfil incompleto no Google, sem WhatsApp, sem avaliações respondidas, sem conteúdo consistente no Instagram — eles escolhem a clínica concorrente que parece mais confiável.\n\nEssa não é uma questão de visibilidade. É uma questão de conversão. E cada dia sem ação é receita deixada para o concorrente.`;
  paragraph(doc, impactText, y7, BLACK);

  // ─── PÁGINA 8 — OPORTUNIDADE ──────────────────────────────────────────────
  newPage(doc);
  setFill(doc, VOXX_PURPLE);
  doc.rect(0, 0, 210, 70, 'F');
  setTextColor(doc, WHITE);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('🚀 Oportunidade', 105, 30, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('O que é possível com a estratégia certa', 105, 42, { align: 'center' });

  const opportunities = [
    'Aumento imediato de leads qualificados via Google Meu Negócio otimizado',
    'Maior taxa de conversão com WhatsApp e site bem vinculados',
    'Autoridade digital crescente com conteúdo consistente no Instagram',
    'Captação previsível com campanhas de tráfego pago bem estruturadas',
    'Redução do custo por lead com perfil e anúncios alinhados',
    'Crescimento sustentável e escalável da base de pacientes',
  ];
  let y8 = 82;
  opportunities.forEach((opp, i) => {
    setFill(doc, i % 2 === 0 ? VOXX_LIGHT : WHITE);
    doc.roundedRect(20, y8, 170, 14, 2, 2, 'F');
    setFill(doc, VOXX_PURPLE);
    doc.circle(28, y8 + 7, 2.5, 'F');
    setTextColor(doc, BLACK);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(opp, 150);
    doc.text(lines[0], 34, y8 + 7.5);
    y8 += 17;
  });

  // ─── PÁGINA 9 — MENSAGEM COMERCIAL ───────────────────────────────────────
  if (analise?.whatsapp_message) {
    newPage(doc);
    let y9 = 15;
    setTextColor(doc, VOXX_PURPLE);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('💬 Abordagem Comercial', 20, y9 + 8);
    y9 += 22;
    setTextColor(doc, GRAY);
    doc.setFontSize(9);
    doc.text('Mensagem pronta para envio via WhatsApp', 20, y9);
    y9 += 10;

    setFill(doc, LIGHT_GRAY);
    const msgLines = doc.splitTextToSize(analise.whatsapp_message, 162);
    const boxH = Math.min(msgLines.length * 5 + 12, 220);
    doc.roundedRect(20, y9, 170, boxH, 4, 4, 'F');
    setTextColor(doc, BLACK);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    msgLines.slice(0, 40).forEach((line, i) => {
      if (y9 + 8 + i * 5 < y9 + boxH - 4) {
        doc.text(line, 25, y9 + 8 + i * 5);
      }
    });
  }

  // ─── PÁGINA 10 — ENCERRAMENTO ─────────────────────────────────────────────
  newPage(doc);
  setFill(doc, VOXX_PURPLE);
  doc.rect(0, 0, 210, 297, 'F');
  setTextColor(doc, WHITE);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('VOXX', 105, 110, { align: 'center' });
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text('Marketing Digital', 105, 120, { align: 'center' });
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Especialistas em crescimento previsível para clínicas', 105, 145, { align: 'center' });

  setFill(doc, [255, 255, 255, 0.2]);
  doc.roundedRect(30, 160, 150, 0.5, 0, 0, 'F');

  setTextColor(doc, [200, 200, 255]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Diagnóstico preparado com exclusividade para:', 105, 178, { align: 'center' });
  setTextColor(doc, WHITE);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(nomeclinica, 105, 190, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(dataAnalise, 105, 200, { align: 'center' });

  // ── DOWNLOAD ───────────────────────────────────────────────────────────────
  const filename = `diagnostico_voxx_${nomeclinica.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}.pdf`;
  doc.save(filename);
}