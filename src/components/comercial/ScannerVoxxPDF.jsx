import jsPDF from 'jspdf';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Paleta ──────────────────────────────────────────────────────────────────
const COLORS = {
  brand:     [108, 56, 220],  // violet-600
  brandLight:[240, 235, 255], // violet-50
  dark:      [15,  23,  42],  // slate-900
  mid:       [71,  85, 105],  // slate-600
  light:     [148,163,184],   // slate-400
  border:    [226,232,240],   // slate-200
  white:     [255,255,255],
  green:     [16, 185, 129],
  amber:     [245,158, 11],
  red:       [239, 68, 68],
};

function rgb(arr) { return { r: arr[0], g: arr[1], b: arr[2] }; }

function scoreColor(v) {
  if (v >= 80) return COLORS.green;
  if (v >= 60) return COLORS.brand;
  if (v >= 40) return COLORS.amber;
  return COLORS.red;
}

function classLabel(v) {
  if (v >= 80) return 'Estruturado';
  if (v >= 60) return 'Ajustável';
  if (v >= 40) return 'Desorganizado';
  return 'Crítico';
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

// ── Gerador Principal ────────────────────────────────────────────────────────
export function gerarPDFScannerVoxx(lead, analise) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297;
  const M = 14; // margem lateral

  // ── 1. HEADER ─────────────────────────────────────────────────────────────
  // Faixa superior
  const { r: br, g: bg, b: bb } = rgb(COLORS.brand);
  doc.setFillColor(br, bg, bb);
  doc.rect(0, 0, W, 22, 'F');

  // Logo / título
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('VOXX SCORE 360°', M, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Diagnóstico de Presença Digital', M, 15.5);

  // Clínica + data
  const dataTxt = analise?.data_analise
    ? format(parseISO(analise.data_analise), "dd/MM/yyyy", { locale: ptBR })
    : format(new Date(), "dd/MM/yyyy", { locale: ptBR });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(truncate(lead.nome_empresa || 'Clínica', 40), W - M, 9, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Análise em ${dataTxt}`, W - M, 14.5, { align: 'right' });

  // ── 2. SCORE VOXX — ELEMENTO PRINCIPAL ────────────────────────────────────
  let y = 30;

  const score = analise?.voxx_score ?? 0;
  const classification = classLabel(score);
  const scoreCol = scoreColor(score);
  const { r: sc, g: sg, b: sb } = rgb(scoreCol);

  // Círculo grande
  const cx = W / 2, cy = y + 22, cr = 18;
  doc.setFillColor(sc, sg, sb);
  doc.circle(cx, cy, cr, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text(String(score), cx, cy + 1, { align: 'center', baseline: 'middle' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('/100', cx, cy + 9, { align: 'center' });

  // Classificação abaixo do círculo
  doc.setTextColor(sc, sg, sb);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(classification, cx, cy + cr + 6, { align: 'center' });

  // Prioridade (badge)
  const priority = analise?.lead_priority || 'Monitorar';
  const isAlta = priority === 'ALTA PRIORIDADE';
  const { r: pr, g: pg, b: pb } = rgb(isAlta ? COLORS.red : COLORS.light);
  doc.setFillColor(pr, pg, pb);
  const badgeW = 38, badgeH = 6.5;
  doc.roundedRect(cx - badgeW / 2, cy + cr + 9, badgeW, badgeH, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(priority.toUpperCase(), cx, cy + cr + 13.5, { align: 'center' });

  y = cy + cr + 22;

  // ── 3. DIAGNÓSTICO (1 frase) ──────────────────────────────────────────────
  if (analise?.diagnosis) {
    const diag = truncate(analise.diagnosis.split('.')[0] + '.', 130);
    doc.setFillColor(240, 235, 255);
    doc.roundedRect(M, y, W - 2 * M, 10, 2, 2, 'F');
    doc.setTextColor(...COLORS.brand);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('🧠 ' + diag, W / 2, y + 5.5, { align: 'center', maxWidth: W - 2 * M - 4 });
    y += 15;
  }

  // ── 4. ANÁLISE — DUAS COLUNAS ─────────────────────────────────────────────
  const colW = (W - 2 * M - 5) / 2;
  const colL = M, colR = M + colW + 5;

  function renderColuna(xc, titulo, icon, subscoreVal, falhas) {
    const maxFalhas = (falhas || []).slice(0, 3);
    const boxH = 10 + maxFalhas.length * 9 + 4;
    const { r: wr, g: wg, b: wb } = rgb(COLORS.border);

    doc.setDrawColor(wr, wg, wb);
    doc.setFillColor(250, 250, 252);
    doc.setLineWidth(0.3);
    doc.roundedRect(xc, y, colW, boxH, 2, 2, 'FD');

    // Título canal
    doc.setTextColor(...COLORS.dark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`${icon} ${titulo}`, xc + 3, y + 6);

    // Subscore pequeno
    const sc2 = scoreColor(subscoreVal ?? 0);
    doc.setTextColor(...sc2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(String(subscoreVal ?? '—'), xc + colW - 3, y + 6.5, { align: 'right' });

    doc.setTextColor(...COLORS.light);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('/100', xc + colW - 3, y + 10, { align: 'right' });

    // Falhas
    doc.setTextColor(...COLORS.mid);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    maxFalhas.forEach((f, i) => {
      doc.setFillColor(...COLORS.red);
      doc.circle(xc + 5, y + 13.5 + i * 9, 1, 'F');
      doc.text(truncate(f, 55), xc + 8, y + 14 + i * 9, { maxWidth: colW - 10 });
    });

    if (maxFalhas.length === 0) {
      doc.setTextColor(...COLORS.light);
      doc.setFontSize(7);
      doc.text('Sem falhas identificadas', xc + 3, y + 14);
    }

    return boxH;
  }

  // Separar falhas por canal
  const allFalhas = analise?.main_failures || [];
  const falhasInsta = allFalhas.filter(f =>
    /instagram|feed|stories|bio|perfil/i.test(f)
  ).slice(0, 3);
  const falhasGmn = allFalhas.filter(f =>
    /google|gmn|avalia|nota|whatsapp.*google|site.*google|maps/i.test(f)
  ).slice(0, 3);
  const falhasGmnFinal = falhasGmn.length > 0 ? falhasGmn : allFalhas.filter(f => !falhasInsta.includes(f)).slice(0, 3);

  const hL = renderColuna(colL, 'Instagram', '📸', analise?.instagram_score, falhasInsta);
  const hR = renderColuna(colR, 'Google Meu Negócio', '📍', analise?.gmn_score, falhasGmnFinal);
  y += Math.max(hL, hR) + 6;

  // ── 5. BLOCO DE IMPACTO ───────────────────────────────────────────────────
  const impactoBullets = allFalhas.slice(0, 3);
  if (impactoBullets.length > 0) {
    const impH = 8 + impactoBullets.length * 8 + 3;
    doc.setFillColor(255, 245, 245);
    doc.setDrawColor(239, 68, 68);
    doc.setLineWidth(0.4);
    doc.roundedRect(M, y, W - 2 * M, impH, 2, 2, 'FD');

    doc.setTextColor(...COLORS.red);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('⚠ ONDE VOCÊ PERDE PACIENTES HOJE', M + 3, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.dark);
    impactoBullets.forEach((b, i) => {
      doc.setFillColor(...COLORS.red);
      doc.circle(M + 5, y + 11.5 + i * 8, 1, 'F');
      doc.text(truncate(b, 100), M + 8, y + 12 + i * 8, { maxWidth: W - 2 * M - 10 });
    });

    y += impH + 6;
  }

  // ── 6. BLOCO DE OPORTUNIDADE ──────────────────────────────────────────────
  const opBullets = [
    'Estruturar perfil Google com WhatsApp, site e fotos estratégicas.',
    'Criar linha editorial consistente no Instagram (3x/semana mínimo).',
    'Ativar campanhas de tráfego pago segmentadas para o público local.',
  ].slice(0, 3);

  const opH = 8 + opBullets.length * 8 + 3;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(...COLORS.green);
  doc.setLineWidth(0.4);
  doc.roundedRect(M, y, W - 2 * M, opH, 2, 2, 'FD');

  doc.setTextColor(...COLORS.green);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('✅ O QUE PODEMOS CORRIGIR', M + 3, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.dark);
  opBullets.forEach((b, i) => {
    doc.setFillColor(...COLORS.green);
    doc.circle(M + 5, y + 11.5 + i * 8, 1, 'F');
    doc.text(b, M + 8, y + 12 + i * 8, { maxWidth: W - 2 * M - 10 });
  });

  y += opH + 6;

  // ── 7. CTA FINAL ──────────────────────────────────────────────────────────
  doc.setFillColor(br, bg, bb);
  doc.roundedRect(M, y, W - 2 * M, 12, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Podemos te mostrar em 15 minutos como corrigir isso.', W / 2, y + 5.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Fale com um especialista VOXX agora.', W / 2, y + 10, { align: 'center' });

  // ── RODAPÉ ────────────────────────────────────────────────────────────────
  doc.setTextColor(...COLORS.light);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('VOXX Digital · Diagnóstico Confidencial · ' + dataTxt, W / 2, H - 5, { align: 'center' });

  doc.save(`scanner-voxx-${(lead.nome_empresa || 'lead').toLowerCase().replace(/\s+/g, '-')}.pdf`);
}