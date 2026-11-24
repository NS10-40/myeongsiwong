import {
  AnalysisMetrics,
  BlindSpot,
  ExtractedArticleMeta,
  HeadlineBattle,
  TextSegment,
} from '../types/framing';

export type CardNewsThemeId = 'editorial-light' | 'dark-magazine' | 'bold-contrast';

export interface CardNewsTheme {
  id: CardNewsThemeId;
  label: string;
  bg: string;
  surface: string;
  border: string;
  gridLine: string;
  titleColor: string;
  bodyColor: string;
  mutedColor: string;
  accent: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  warn: string;
  warnSoft: string;
  ok: string;
  okSoft: string;
}

export const CARD_NEWS_THEMES: Record<CardNewsThemeId, CardNewsTheme> = {
  'editorial-light': {
    id: 'editorial-light',
    label: '크림 에디토리얼',
    bg: '#F6F4EE',
    surface: '#FFFFFF',
    border: '#D6D3C9',
    gridLine: 'rgba(17, 24, 39, 0.045)',
    titleColor: '#0F172A',
    bodyColor: '#1E293B',
    mutedColor: '#64748B',
    accent: '#0284C7',
    accentSoft: 'rgba(2, 132, 199, 0.12)',
    danger: '#E11D48',
    dangerSoft: 'rgba(225, 29, 72, 0.12)',
    warn: '#D97706',
    warnSoft: 'rgba(217, 119, 6, 0.14)',
    ok: '#059669',
    okSoft: 'rgba(5, 150, 105, 0.12)',
  },
  'dark-magazine': {
    id: 'dark-magazine',
    label: '다크 매거진',
    bg: '#0B1120',
    surface: '#111C33',
    border: 'rgba(148, 163, 184, 0.22)',
    gridLine: 'rgba(148, 163, 184, 0.05)',
    titleColor: '#F8FAFC',
    bodyColor: '#E2E8F0',
    mutedColor: '#94A3B8',
    accent: '#38BDF8',
    accentSoft: 'rgba(56, 189, 248, 0.16)',
    danger: '#FB7185',
    dangerSoft: 'rgba(244, 63, 94, 0.18)',
    warn: '#FBBF24',
    warnSoft: 'rgba(251, 191, 36, 0.16)',
    ok: '#34D399',
    okSoft: 'rgba(52, 211, 153, 0.16)',
  },
  'bold-contrast': {
    id: 'bold-contrast',
    label: '임팩트 블랙',
    bg: '#09090B',
    surface: '#141418',
    border: 'rgba(250, 204, 21, 0.28)',
    gridLine: 'rgba(255, 255, 255, 0.04)',
    titleColor: '#FFFFFF',
    bodyColor: '#F4F4F5',
    mutedColor: '#A1A1AA',
    accent: '#FACC15',
    accentSoft: 'rgba(250, 204, 21, 0.16)',
    danger: '#F43F5E',
    dangerSoft: 'rgba(244, 63, 94, 0.2)',
    warn: '#FB923C',
    warnSoft: 'rgba(251, 146, 60, 0.18)',
    ok: '#22D3EE',
    okSoft: 'rgba(34, 211, 238, 0.16)',
  },
};

export interface CardNewsInput {
  articleMeta: ExtractedArticleMeta | null;
  metrics: AnalysisMetrics;
  topFacts: TextSegment[];
  blindSpots: BlindSpot[];
  headlineBattle: HeadlineBattle;
  customCoverTitle?: string;
}

export type CardNewsSlide =
  | {
      kind: 'cover';
      slideNumber: number;
      kicker: string;
      headline: string;
      metrics: AnalysisMetrics;
      emotionPercent: number;
      vaguePercent: number;
    }
  | {
      kind: 'fact';
      slideNumber: number;
      factOrder: number;
      text: string;
      highlights: string[];
    }
  | {
      kind: 'outro';
      slideNumber: number;
      headlineBattle: HeadlineBattle;
      blindSpots: BlindSpot[];
      aggroScore: number;
      gradeLabel: string;
    };

const HIGHLIGHT_TOKEN_REGEX =
  /(\d+(?:,\d{3})*(?:\.\d+)?\s*(?:%|퍼센트|%p|포인트|명|원|억|만|조|천|배|건|회|년|월|일|시간|분|초|점|위|세|대|호|달러|엔|유로|kg|km|m)|통계청|한국은행|기획재정부|교육부|보건복지부|고용노동부|과학기술정보통신부|국토교통부|산업통상자원부|금융위원회|공정거래위원회|경찰청|검찰|법원|국회|한국교육과정평가원|OECD|IMF|UN|WHO|연준|Fed|AI)/g;

export function buildInstaCardSlides(input: CardNewsInput): CardNewsSlide[] {
  const { articleMeta, metrics, topFacts, blindSpots, headlineBattle, customCoverTitle } =
    input;

  const emotionPercent =
    metrics.totalChars > 0
      ? Number(((metrics.emotionChars / metrics.totalChars) * 100).toFixed(1))
      : 0;
  const vaguePercent =
    metrics.totalChars > 0
      ? Number(((metrics.vagueChars / metrics.totalChars) * 100).toFixed(1))
      : 0;

  const defaultHeadline =
    customCoverTitle?.trim() ||
    articleMeta?.title?.trim() ||
    headlineBattle.dryFact ||
    '감정과 과장을 덜어낸 오늘의 팩트';

  const slides: CardNewsSlide[] = [
    {
      kind: 'cover',
      slideNumber: 1,
      kicker: 'FRAMING X-RAY · 오늘의 팩트 탈수',
      headline: defaultHeadline,
      metrics,
      emotionPercent,
      vaguePercent,
    },
  ];

  if (topFacts.length === 0) {
    slides.push({
      kind: 'fact',
      slideNumber: 2,
      factOrder: 1,
      text: '원문에서 수치·통계나 공인 기관 발표에 근거한 검증 가능한 뉴스 핵심 팩트가 검출되지 않았습니다.',
      highlights: ['검증 가능한 뉴스 핵심 팩트'],
    });
  } else {
    topFacts.forEach((fact, idx) => {
      const matches = fact.text.match(HIGHLIGHT_TOKEN_REGEX) || [];
      slides.push({
        kind: 'fact',
        slideNumber: slides.length + 1,
        factOrder: idx + 1,
        text: fact.text.trim(),
        highlights: Array.from(new Set(matches)),
      });
    });
  }

  slides.push({
    kind: 'outro',
    slideNumber: slides.length + 1,
    headlineBattle,
    blindSpots,
    aggroScore: metrics.breakdown.aggroScore,
    gradeLabel: metrics.gradeLabel,
  });

  return slides;
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

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const lines: string[] = [];
  let current = '';

  for (const ch of clean) {
    const candidate = current + ch;
    if (ctx.measureText(candidate).width > maxWidth && current.length > 0) {
      const lastSpace = current.lastIndexOf(' ');
      if (lastSpace > current.length * 0.5) {
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
  if (current.trim()) lines.push(current.trim());
  return lines;
}

function drawGridBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CardNewsTheme
): void {
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle architectural grid
  ctx.strokeStyle = theme.gridLine;
  ctx.lineWidth = 1;
  const step = 72;
  for (let x = step; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = step; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Soft top-right ambient radial glow
  const grad = ctx.createRadialGradient(w * 0.85, h * 0.12, 20, w * 0.85, h * 0.12, 520);
  grad.addColorStop(0, theme.accentSoft);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  slideNumber: number,
  totalSlides: number,
  theme: CardNewsTheme
): void {
  const padX = 76;
  const footerY = h - 76;

  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, footerY - 36);
  ctx.lineTo(w - padX, footerY - 36);
  ctx.stroke();

  // Slide dots
  let dotX = padX;
  for (let i = 1; i <= totalSlides; i++) {
    const isCurrent = i === slideNumber;
    const dotW = isCurrent ? 34 : 12;
    drawRoundedRect(ctx, dotX, footerY - 6, dotW, 12, 6);
    ctx.fillStyle = isCurrent ? theme.accent : theme.border;
    ctx.fill();
    dotX += dotW + 10;
  }

  // Right cue
  ctx.fillStyle = theme.mutedColor;
  ctx.font = '700 22px "IBM Plex Mono", "Plus Jakarta Sans", monospace';
  const cue =
    slideNumber < totalSlides
      ? `${slideNumber} / ${totalSlides}  ·  SWIPE →`
      : `${slideNumber} / ${totalSlides}  ·  FRAMING X-RAY`;
  const cueW = ctx.measureText(cue).width;
  ctx.fillText(cue, w - padX - cueW, footerY + 7);
}

function drawFactHighlightedLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  startX: number,
  startY: number,
  lineHeight: number,
  highlights: string[],
  theme: CardNewsTheme
): void {
  const sortedHighlights = [...highlights].sort((a, b) => b.length - a.length);

  lines.forEach((line, lineIdx) => {
    const y = startY + lineIdx * lineHeight;
    let x = startX;
    let remaining = line;

    while (remaining.length > 0) {
      let bestMatch: { idx: number; token: string } | null = null;
      for (const token of sortedHighlights) {
        const foundIdx = remaining.indexOf(token);
        if (foundIdx !== -1 && (!bestMatch || foundIdx < bestMatch.idx)) {
          bestMatch = { idx: foundIdx, token };
        }
      }

      if (!bestMatch) {
        ctx.fillStyle = theme.bodyColor;
        ctx.fillText(remaining, x, y);
        break;
      }

      if (bestMatch.idx > 0) {
        const before = remaining.slice(0, bestMatch.idx);
        ctx.fillStyle = theme.bodyColor;
        ctx.fillText(before, x, y);
        x += ctx.measureText(before).width;
      }

      const tokenW = ctx.measureText(bestMatch.token).width;
      drawRoundedRect(ctx, x - 4, y - 38, tokenW + 8, 48, 8);
      ctx.fillStyle = theme.accentSoft;
      ctx.fill();

      ctx.fillStyle = theme.accent;
      ctx.fillText(bestMatch.token, x, y);
      x += tokenW;
      remaining = remaining.slice(bestMatch.idx + bestMatch.token.length);
    }
  });
}

export function renderInstaCardSlide(
  canvas: HTMLCanvasElement,
  slide: CardNewsSlide,
  totalSlides: number,
  themeId: CardNewsThemeId
): void {
  const W = 1080;
  const H = 1350;
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const theme = CARD_NEWS_THEMES[themeId];
  drawGridBackground(ctx, W, H, theme);

  const padX = 76;
  const contentW = W - padX * 2;

  if (slide.kind === 'cover') {
    // Top Kicker Pill
    ctx.font = '700 24px "IBM Plex Mono", "Noto Sans KR", sans-serif';
    const kickerText = slide.kicker;
    const kickerW = ctx.measureText(kickerText).width + 40;
    drawRoundedRect(ctx, padX, 88, kickerW, 50, 10);
    ctx.fillStyle = theme.accentSoft;
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.accent;
    ctx.fillText(kickerText, padX + 20, 121);

    // Big Editorial Headline
    ctx.font = '700 64px "Noto Sans KR", "Plus Jakarta Sans", sans-serif';
    const headLines = wrapText(ctx, slide.headline, contentW).slice(0, 4);
    let y = 248;
    for (const line of headLines) {
      ctx.fillStyle = theme.titleColor;
      ctx.fillText(line, padX, y);
      y += 88;
    }

    // Center Visual Score Card
    const cardY = Math.max(y + 36, 610);
    const cardH = 440;
    drawRoundedRect(ctx, padX, cardY, contentW, cardH, 24);
    ctx.fillStyle = theme.surface;
    ctx.fill();
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Grade Stamp
    const gradeStyle =
      slide.metrics.grade === 'aggro'
        ? { bg: theme.dangerSoft, fg: theme.danger }
        : slide.metrics.grade === 'factual'
          ? { bg: theme.okSoft, fg: theme.ok }
          : { bg: theme.warnSoft, fg: theme.warn };

    drawRoundedRect(ctx, padX + 44, cardY + 42, 270, 58, 12);
    ctx.fillStyle = gradeStyle.bg;
    ctx.fill();
    ctx.strokeStyle = gradeStyle.fg;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = gradeStyle.fg;
    ctx.font = '700 28px "Noto Sans KR", sans-serif';
    ctx.fillText(slide.metrics.gradeLabel, padX + 68, cardY + 81);

    // Big Aggro Score Right Side
    ctx.fillStyle = theme.mutedColor;
    ctx.font = '600 22px "Noto Sans KR", sans-serif';
    ctx.fillText('어그로 지수', padX + contentW - 260, cardY + 62);

    ctx.fillStyle = theme.titleColor;
    ctx.font = '700 54px "IBM Plex Mono", monospace';
    ctx.fillText(`${slide.metrics.breakdown.aggroScore}`, padX + contentW - 260, cardY + 124);
    ctx.fillStyle = theme.mutedColor;
    ctx.font = '600 26px "IBM Plex Mono", monospace';
    ctx.fillText('/ 100', padX + contentW - 170, cardY + 124);

    // Donut + 3 Bars inside Score Card
    const cx = padX + 165;
    const cy = cardY + 280;
    const r = 92;
    const lw = 24;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = lw;
    ctx.stroke();

    const startAngle = -Math.PI / 2;
    const factRad = (slide.metrics.factPercent / 100) * Math.PI * 2;
    const emoRad = (slide.emotionPercent / 100) * Math.PI * 2;
    const vagueRad = (slide.vaguePercent / 100) * Math.PI * 2;

    if (factRad > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, startAngle + factRad);
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    if (emoRad > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle + factRad, startAngle + factRad + emoRad);
      ctx.strokeStyle = theme.danger;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    if (vagueRad > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle + factRad + emoRad, startAngle + factRad + emoRad + vagueRad);
      ctx.strokeStyle = theme.warn;
      ctx.lineWidth = lw;
      ctx.stroke();
    }

    ctx.fillStyle = theme.titleColor;
    ctx.font = '700 38px "IBM Plex Mono", monospace';
    const pctText = `${slide.metrics.factPercent}%`;
    const pctW = ctx.measureText(pctText).width;
    ctx.fillText(pctText, cx - pctW / 2, cy + 8);

    ctx.fillStyle = theme.mutedColor;
    ctx.font = '600 18px "Noto Sans KR", sans-serif';
    const subTxt = '순수 팩트';
    const subW = ctx.measureText(subTxt).width;
    ctx.fillText(subTxt, cx - subW / 2, cy + 36);

    // Right side horizontal breakdown bars
    const barX = padX + 320;
    const barW = contentW - 364;
    const items = [
      { label: '순수 팩트', val: slide.metrics.factPercent, color: theme.accent },
      { label: '감정 선동', val: slide.emotionPercent, color: theme.danger },
      { label: '모호 출처', val: slide.vaguePercent, color: theme.warn },
    ];
    items.forEach((it, idx) => {
      const by = cardY + 204 + idx * 72;
      ctx.fillStyle = theme.bodyColor;
      ctx.font = '600 22px "Noto Sans KR", sans-serif';
      ctx.fillText(it.label, barX, by);

      ctx.fillStyle = it.color;
      ctx.font = '700 24px "IBM Plex Mono", monospace';
      const vStr = `${it.val}%`;
      const vW = ctx.measureText(vStr).width;
      ctx.fillText(vStr, barX + barW - vW, by);

      drawRoundedRect(ctx, barX, by + 14, barW, 14, 7);
      ctx.fillStyle = theme.gridLine;
      ctx.fill();

      const fillW = Math.max(8, (Math.min(100, it.val) / 100) * barW);
      drawRoundedRect(ctx, barX, by + 14, fillW, 14, 7);
      ctx.fillStyle = it.color;
      ctx.fill();
    });
  } else if (slide.kind === 'fact') {
    // Top Kicker
    ctx.fillStyle = theme.mutedColor;
    ctx.font = '700 24px "IBM Plex Mono", "Noto Sans KR", sans-serif';
    ctx.fillText('탈수 완료 · 뉴스 핵심 팩트', padX, 118);

    // Big Editorial Fact Number
    ctx.fillStyle = theme.accent;
    ctx.font = '700 120px "IBM Plex Mono", sans-serif';
    ctx.fillText(`0${slide.factOrder}`, padX, 276);

    // Horizontal accent rule
    drawRoundedRect(ctx, padX, 314, 120, 8, 4);
    ctx.fillStyle = theme.accent;
    ctx.fill();

    // Main Fact Surface Card
    const boxY = 376;
    const boxH = 690;
    drawRoundedRect(ctx, padX, boxY, contentW, boxH, 24);
    ctx.fillStyle = theme.surface;
    ctx.fill();
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Quote mark accent
    ctx.fillStyle = theme.accentSoft;
    ctx.font = '700 130px Georgia, serif';
    ctx.fillText('“', padX + 42, boxY + 135);

    ctx.font = '600 42px "Noto Sans KR", "Plus Jakarta Sans", sans-serif';
    const lines = wrapText(ctx, slide.text, contentW - 104).slice(0, 7);
    const totalTextH = lines.length * 68;
    const textStartY = boxY + Math.max(175, (boxH - totalTextH) / 2 + 44);

    drawFactHighlightedLines(
      ctx,
      lines,
      padX + 52,
      textStartY,
      68,
      slide.highlights,
      theme
    );

    // Bottom tag caption inside card
    ctx.fillStyle = theme.mutedColor;
    ctx.font = '600 22px "Noto Sans KR", sans-serif';
    ctx.fillText('✓ 감정 수식·익명 추측을 제거한 검증 가능 진술', padX + 52, boxY + boxH - 44);
  } else {
    // Outro: 1-line Headline Battle + Blind Spot Warning
    ctx.fillStyle = theme.accent;
    ctx.font = '700 24px "IBM Plex Mono", "Noto Sans KR", sans-serif';
    ctx.fillText('FRAMING CHECK · 제목 전환 & 사각지대', padX, 118);

    ctx.fillStyle = theme.titleColor;
    ctx.font = '700 52px "Noto Sans KR", sans-serif';
    ctx.fillText('포장을 벗기면 보이는 차이', padX, 200);

    // Card 1: Sensational vs Dry Fact
    const c1Y = 266;
    drawRoundedRect(ctx, padX, c1Y, contentW, 210, 20);
    ctx.fillStyle = theme.surface;
    ctx.fill();
    ctx.strokeStyle = theme.danger;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = theme.danger;
    ctx.font = '700 24px "Noto Sans KR", sans-serif';
    ctx.fillText('🔴 낚시성 기사 프레이밍', padX + 38, c1Y + 56);

    ctx.fillStyle = theme.bodyColor;
    ctx.font = '700 36px "Noto Sans KR", sans-serif';
    const sensLines = wrapText(ctx, slide.headlineBattle.sensational, contentW - 76).slice(0, 2);
    sensLines.forEach((l, i) => ctx.fillText(l, padX + 38, c1Y + 116 + i * 50));

    const c2Y = 508;
    drawRoundedRect(ctx, padX, c2Y, contentW, 210, 20);
    ctx.fillStyle = theme.surface;
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = theme.accent;
    ctx.font = '700 24px "Noto Sans KR", sans-serif';
    ctx.fillText('🔵 건조한 팩트 헤드라인', padX + 38, c2Y + 56);

    ctx.fillStyle = theme.titleColor;
    ctx.font = '700 36px "Noto Sans KR", sans-serif';
    const dryLines = wrapText(ctx, slide.headlineBattle.dryFact, contentW - 76).slice(0, 2);
    dryLines.forEach((l, i) => ctx.fillText(l, padX + 38, c2Y + 116 + i * 50));

    // Blind Spot Warning Card
    const c3Y = 762;
    drawRoundedRect(ctx, padX, c3Y, contentW, 310, 20);
    ctx.fillStyle = theme.warnSoft;
    ctx.fill();
    ctx.strokeStyle = theme.warn;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = theme.warn;
    ctx.font = '700 26px "Noto Sans KR", sans-serif';
    ctx.fillText('⚠️ 이 기사에서 빠진 사각지대', padX + 38, c3Y + 62);

    const spotText =
      slide.blindSpots[0]?.oneLineWarning ||
      '전체 모수와 비교 대조군을 함께 확인하세요.';
    ctx.fillStyle = theme.titleColor;
    ctx.font = '600 32px "Noto Sans KR", sans-serif';
    const spotLines = wrapText(ctx, spotText, contentW - 76).slice(0, 3);
    spotLines.forEach((l, i) => ctx.fillText(l, padX + 38, c3Y + 132 + i * 52));
  }

  drawFooter(ctx, W, H, slide.slideNumber, totalSlides, theme);
}

export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
