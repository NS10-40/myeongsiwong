import {
  AnalysisMetrics,
  BlindSpot,
  ExtractedArticleMeta,
  TextSegment,
} from '../types/framing';

export interface SummaryCardPayload {
  articleMeta: ExtractedArticleMeta | null;
  metrics: AnalysisMetrics;
  topFacts: TextSegment[];
  blindSpots: BlindSpot[];
}

export function buildSummaryCopyText({
  articleMeta,
  metrics,
  topFacts,
  blindSpots,
}: SummaryCardPayload): string {
  const emotionPercent =
    metrics.totalChars > 0
      ? Number(((metrics.emotionChars / metrics.totalChars) * 100).toFixed(1))
      : 0;
  const vaguePercent =
    metrics.totalChars > 0
      ? Number(((metrics.vagueChars / metrics.totalChars) * 100).toFixed(1))
      : 0;

  const lines: string[] = ['[Framing X-Ray] 탈수 완료 · 핵심 팩트 TOP 3'];
  if (articleMeta?.title) {
    lines.push(`기사: ${articleMeta.title}`);
  }
  lines.push(
    `판정: ${metrics.gradeLabel} | 어그로 지수 ${metrics.breakdown.aggroScore}/100점`
  );
  lines.push(
    `구성: 순수 팩트 ${metrics.factPercent}% · 감정 선동 ${emotionPercent}% · 모호 출처 ${vaguePercent}%`
  );
  lines.push('');

  if (topFacts.length === 0) {
    lines.push('검출된 뉴스 핵심 팩트가 없습니다.');
  } else {
    topFacts.forEach((fact, idx) => {
      lines.push(`0${idx + 1}. ${fact.text.trim()}`);
    });
  }

  if (blindSpots[0]) {
    lines.push('');
    lines.push(`사각지대 경고: ${blindSpots[0].oneLineWarning}`);
  }

  if (articleMeta?.url) {
    lines.push(`원문: ${articleMeta.url}`);
  }

  return lines.join('\n');
}

export async function copySummaryToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    const ok = document.execCommand('copy');
    return ok;
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const lines: string[] = [];
  let current = '';

  for (const ch of normalized) {
    const candidate = current + ch;
    if (ctx.measureText(candidate).width > maxWidth && current.length > 0) {
      // Try breaking cleanly at last space if recent
      const lastSpace = current.lastIndexOf(' ');
      if (lastSpace > current.length * 0.55) {
        lines.push(current.slice(0, lastSpace).trim());
        current = (current.slice(lastSpace + 1) + ch).trimStart();
      } else {
        lines.push(current.trim());
        current = ch === ' ' ? '' : ch;
      }
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    lines.push(current.trim());
  }
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function downloadSummaryCardPng(payload: SummaryCardPayload): void {
  if (typeof document === 'undefined') return;
  const { articleMeta, metrics, topFacts, blindSpots } = payload;

  const width = 1200;
  const paddingX = 64;
  const cardWidth = width - paddingX * 2;
  const innerWidth = cardWidth - 64;

  // Pre-measure wrapped lines using an offscreen measurement context
  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');
  if (!mCtx) return;

  mCtx.font = '600 22px "Noto Sans KR", "Plus Jakarta Sans", sans-serif';
  const titleLines = articleMeta?.title
    ? wrapTextLines(mCtx, articleMeta.title, innerWidth).slice(0, 2)
    : [];

  mCtx.font = '500 24px "Noto Sans KR", "Plus Jakarta Sans", sans-serif';
  const factEntries =
    topFacts.length > 0
      ? topFacts.map((f) => wrapTextLines(mCtx, f.text, innerWidth - 76))
      : [['검출된 뉴스 핵심 팩트가 없습니다.']];

  mCtx.font = '500 18px "Noto Sans KR", "Plus Jakarta Sans", sans-serif';
  const warningLines = blindSpots[0]
    ? wrapTextLines(mCtx, `사각지대: ${blindSpots[0].oneLineWarning}`, innerWidth - 28).slice(0, 2)
    : [];

  // Calculate dynamic canvas height
  let contentHeight = 48; // top outer margin
  contentHeight += 42; // brand header
  if (titleLines.length > 0) {
    contentHeight += titleLines.length * 32 + 16;
  }
  contentHeight += 110; // score strip box
  contentHeight += 32; // section label
  factEntries.forEach((lines) => {
    contentHeight += Math.max(76, lines.length * 34 + 34) + 16;
  });
  if (warningLines.length > 0) {
    contentHeight += warningLines.length * 26 + 34;
  }
  contentHeight += 48; // bottom outer margin

  const height = Math.max(560, contentHeight);
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  // Canvas Background
  ctx.fillStyle = '#0B1120';
  ctx.fillRect(0, 0, width, height);

  // Outer Card Container
  drawRoundedRect(ctx, paddingX, 36, cardWidth, height - 72, 16);
  ctx.fillStyle = '#0F172A';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.85)';
  ctx.stroke();

  let y = 76;
  const left = paddingX + 32;

  // Brand Header
  ctx.fillStyle = '#38BDF8';
  ctx.font = '700 16px "Plus Jakarta Sans", "Noto Sans KR", sans-serif';
  ctx.fillText('FRAMING X-RAY · 탈수 완료 핵심 팩트 요약 카드', left, y);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 14px "IBM Plex Mono", monospace';
  const dateText = new Date().toISOString().slice(0, 10);
  const dateWidth = ctx.measureText(dateText).width;
  ctx.fillText(dateText, left + innerWidth - dateWidth, y);

  y += 28;

  // Optional Article Title
  if (titleLines.length > 0) {
    y += 12;
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 22px "Noto Sans KR", "Plus Jakarta Sans", sans-serif';
    for (const line of titleLines) {
      ctx.fillText(line, left, y);
      y += 32;
    }
    y += 8;
  }

  // Score Summary Strip
  const emotionPercent =
    metrics.totalChars > 0
      ? Number(((metrics.emotionChars / metrics.totalChars) * 100).toFixed(1))
      : 0;
  const vaguePercent =
    metrics.totalChars > 0
      ? Number(((metrics.vagueChars / metrics.totalChars) * 100).toFixed(1))
      : 0;

  drawRoundedRect(ctx, left, y, innerWidth, 84, 10);
  ctx.fillStyle = '#0B1120';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.75)';
  ctx.stroke();

  const gradeColors =
    metrics.grade === 'aggro'
      ? { bg: 'rgba(244, 63, 94, 0.16)', border: 'rgba(244, 63, 94, 0.55)', text: '#FECDD3' }
      : metrics.grade === 'factual'
        ? { bg: 'rgba(16, 185, 129, 0.16)', border: 'rgba(16, 185, 129, 0.55)', text: '#A7F3D0' }
        : { bg: 'rgba(245, 158, 11, 0.16)', border: 'rgba(245, 158, 11, 0.55)', text: '#FDE68A' };

  drawRoundedRect(ctx, left + 20, y + 20, 176, 44, 8);
  ctx.fillStyle = gradeColors.bg;
  ctx.fill();
  ctx.strokeStyle = gradeColors.border;
  ctx.stroke();

  ctx.fillStyle = gradeColors.text;
  ctx.font = '700 18px "Noto Sans KR", sans-serif';
  ctx.fillText(metrics.gradeLabel, left + 38, y + 48);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 22px "IBM Plex Mono", "Noto Sans KR", monospace';
  ctx.fillText(`어그로 지수 ${metrics.breakdown.aggroScore}점`, left + 220, y + 49);

  const statsText = `순수 팩트 ${metrics.factPercent}%  ·  감정 ${emotionPercent}%  ·  모호 ${vaguePercent}%`;
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 16px "Noto Sans KR", "IBM Plex Mono", sans-serif';
  const statsW = ctx.measureText(statsText).width;
  ctx.fillText(statsText, left + innerWidth - 20 - statsW, y + 48);

  y += 114;

  // Section Header
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '700 18px "Noto Sans KR", sans-serif';
  ctx.fillText('탈수 완료: 뉴스 핵심 팩트 TOP 3', left, y);
  y += 18;

  // Fact Cards
  factEntries.forEach((lines, idx) => {
    const boxH = Math.max(76, lines.length * 34 + 34);
    drawRoundedRect(ctx, left, y, innerWidth, boxH, 10);
    ctx.fillStyle = '#0B1120';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    ctx.font = '700 22px "IBM Plex Mono", monospace';
    ctx.fillText(`0${idx + 1}`, left + 22, y + 42);

    ctx.fillStyle = '#F1F5F9';
    ctx.font = '500 22px "Noto Sans KR", "Plus Jakarta Sans", sans-serif';
    let lineY = y + 42;
    for (const line of lines) {
      ctx.fillText(line, left + 70, lineY);
      lineY += 34;
    }

    y += boxH + 14;
  });

  // Blind Spot Warning Footer
  if (warningLines.length > 0) {
    const warnH = warningLines.length * 26 + 24;
    drawRoundedRect(ctx, left, y + 4, innerWidth, warnH, 8);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.stroke();

    ctx.fillStyle = '#FDE68A';
    ctx.font = '500 17px "Noto Sans KR", sans-serif';
    let wy = y + 32;
    for (const wLine of warningLines) {
      ctx.fillText(wLine, left + 18, wy);
      wy += 26;
    }
  }

  // Trigger Download
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = 'framing-xray-top3-card.png';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
