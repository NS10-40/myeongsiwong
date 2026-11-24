export interface ExtractedHtmlArticle {
  title: string;
  content: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  middot: '·',
  bull: '•',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

const NON_BODY_TAG_SELECTOR =
  'script, style, noscript, iframe, header, footer, nav, aside, form, button, input, figure, figcaption, svg, select, textarea';

const NOISE_CLASS_ID_REGEX =
  /(?:comment|reply|banner|related|recommend|ranking|popular|sidebar|widget|share|sns|promotion|copyright|reporter|byline|breadcrumb|\bad(?:s|vert|vertisement|box|wrap|unit|slot|sense|area|container)?\b|[_-]ad(?:s)?(?:[_-]|$)|(?:^|[_-])ad(?:s)?[_-])/i;

const PRIORITY_SELECTORS: string[] = [
  // 1순위: 네이버 뉴스
  '#dic_area',
  '#newsct_article',
  // 2순위: 다음 뉴스
  '.article_view',
  '#harmonyContainer',
  // 3순위: 범용/주요 언론사 본문 컨테이너
  '[itemprop="articleBody"]',
  'article',
  '#articleBody',
  '.article_body',
  '.article-body',
  '#article-view-content-div',
  '.news_body',
  '.view_con',
];

const TRUNCATE_KEYWORDS = [
  '무단 전재',
  '무단전재',
  '재배포 금지',
  '저작권자',
  'copyright',
  'ⓒ',
  '제보는',
  '▶',
  '☞',
  '관련기사',
  '많이 본 뉴스',
  '이 시각 주요뉴스',
  '구독하기',
];

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : '';
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : '';
    })
    .replace(/&([a-zA-Z]+);/g, (full, name: string) => {
      return NAMED_ENTITIES[name.toLowerCase()] ?? full;
    });
}

/**
 * 3. 하단 찌꺼기 문구 자동 절단 및 짧은 UI 버튼성 줄 제거
 */
export function postProcessArticleText(rawText: string): string {
  const rawLines = rawText.replace(/\r\n?/g, '\n').split('\n');
  const keptLines: string[] = [];

  for (const rawLine of rawLines) {
    const line = rawLine.replace(/[ \t\f\v]+/g, ' ').trim();
    if (!line) continue;

    const lowerLine = line.toLowerCase();
    const shouldTruncate = TRUNCATE_KEYWORDS.some((kw) =>
      lowerLine.includes(kw.toLowerCase())
    );
    if (shouldTruncate) {
      break;
    }

    // 문장 부호(. ! ? 다 요 음 함 임) 없이 15자 미만으로 끊기는 짧은 UI 버튼성 줄 제거
    const hasSentenceEnding = /[.!?]|[다요음함임](?:\s*["'”’)\]]*)$/.test(line);
    if (line.length < 15 && !hasSentenceEnding) {
      continue;
    }

    keptLines.push(line);
  }

  return keptLines.join('\n\n').trim();
}

function extractTextWithBreaksFromElement(root: Element): string {
  const BLOCK_TAGS = new Set([
    'P',
    'DIV',
    'LI',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'BLOCKQUOTE',
    'SECTION',
    'ARTICLE',
    'TR',
  ]);

  const chunks: string[] = [];

  function walk(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (text) chunks.push(text);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toUpperCase();

    if (tag === 'BR') {
      chunks.push('\n');
      return;
    }

    const isBlock = BLOCK_TAGS.has(tag);
    if (isBlock) chunks.push('\n');

    for (let i = 0; i < el.childNodes.length; i++) {
      walk(el.childNodes[i]);
    }

    if (isBlock) chunks.push('\n');
  }

  walk(root);
  return chunks.join('');
}

function extractTitleFromDom(doc: Document): string {
  const ogTitle = doc
    .querySelector('meta[property="og:title"]')
    ?.getAttribute('content')
    ?.trim();
  if (ogTitle && ogTitle.length > 3) return ogTitle;

  const twTitle = doc
    .querySelector('meta[name="twitter:title"]')
    ?.getAttribute('content')
    ?.trim();
  if (twTitle && twTitle.length > 3) return twTitle;

  const h1Text = doc.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim();
  if (h1Text && h1Text.length > 3 && h1Text.length < 180) return h1Text;

  const titleText = doc.querySelector('title')?.textContent?.replace(/\s+/g, ' ').trim();
  return titleText || '';
}

function findDensestContainer(doc: Document): Element | null {
  const root = doc.body || doc.documentElement;
  if (!root) return null;

  const candidates = Array.from(root.querySelectorAll('div, section'));
  let bestEl: Element | null = null;
  let bestScore = 0;

  for (const el of candidates) {
    const pElements = Array.from(el.querySelectorAll('p'));
    if (pElements.length === 0) continue;

    let pTextLen = 0;
    for (const p of pElements) {
      const text = (p.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length >= 15) {
        pTextLen += text.length;
      }
    }

    if (pTextLen < 80) continue;

    const totalLen = (el.textContent || '').replace(/\s+/g, ' ').trim().length || 1;
    const linkLen = Array.from(el.querySelectorAll('a')).reduce(
      (sum, a) => sum + (a.textContent || '').trim().length,
      0
    );
    const linkRatio = linkLen / totalLen;
    if (linkRatio > 0.45) continue;

    const pDensity = pTextLen / totalLen;
    // Prefer tightest container holding rich <p> density (slightly penalize huge outer wrappers)
    const score = pElements.length * 60 + pTextLen * pDensity - totalLen * 0.08;

    if (score > bestScore) {
      bestScore = score;
      bestEl = el;
    }
  }

  return bestEl;
}

function extractWithDomParser(html: string): ExtractedHtmlArticle {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const title = extractTitleFromDom(doc);

  // 1-A. 기본 비본문 태그 제거
  doc.querySelectorAll(NON_BODY_TAG_SELECTOR).forEach((el) => el.remove());

  // 1-B. 광고·댓글·추천기사 관련 클래스/ID 제거 (대소문자 무시)
  const allElements = Array.from(doc.querySelectorAll('*'));
  for (const el of allElements) {
    if (!el.isConnected) continue;
    const tag = el.tagName.toUpperCase();
    if (tag === 'HTML' || tag === 'BODY') continue;

    const idVal = el.getAttribute('id') || '';
    const classVal = el.getAttribute('class') || '';
    if (NOISE_CLASS_ID_REGEX.test(idVal) || NOISE_CLASS_ID_REGEX.test(classVal)) {
      el.remove();
    }
  }

  // 2. 언론사 본문 영역 우선 탐색
  let targetContainer: Element | null = null;
  for (const selector of PRIORITY_SELECTORS) {
    const matched = doc.querySelector(selector);
    if (!matched) continue;
    const cleaned = postProcessArticleText(extractTextWithBreaksFromElement(matched));
    if (cleaned.length >= 60) {
      targetContainer = matched;
      break;
    }
  }

  // Fallback: <p> 태그가 가장 많이 모여 있고 본문 밀도가 높은 단일 div 또는 section
  if (!targetContainer) {
    targetContainer = findDensestContainer(doc);
  }

  const rawExtracted = targetContainer
    ? extractTextWithBreaksFromElement(targetContainer)
    : doc.body
      ? extractTextWithBreaksFromElement(doc.body)
      : '';

  const content = postProcessArticleText(rawExtracted).slice(0, 15000);

  return {
    title: title || '제목 없는 웹 기사',
    content,
  };
}

// --- Node.js / Non-DOM fallback (used by /api/fetch-news.ts) ---

function stripTagsToTextNode(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|blockquote|tr|section|article)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );
}

function removeNoiseBlocksNode(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(
      /<(script|style|noscript|iframe|header|footer|nav|aside|form|button|input|figure|figcaption|svg|select|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi,
      ''
    )
    .replace(/<(input|img|hr|meta|link)\b[^>]*\/?>/gi, '')
    .replace(
      /<([a-zA-Z0-9]+)\b[^>]*(?:class|id)=["'][^"']*(?:comment|reply|banner|related|recommend|ranking|popular|sidebar|widget|share|sns|promotion|copyright|reporter|byline|breadcrumb)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
      ''
    );
}

function extractMetaTitleNode(html: string): string {
  const metaPatterns = [
    /<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["'][^>]*>/i,
    /<meta\b[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:title["'][^>]*>/i,
  ];
  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const cleaned = decodeHtmlEntities(match[1]).replace(/\s+/g, ' ').trim();
      if (cleaned.length > 3) return cleaned;
    }
  }
  const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match?.[1]) {
    const cleaned = stripTagsToTextNode(h1Match[1]).replace(/\s+/g, ' ').trim();
    if (cleaned.length > 3 && cleaned.length < 180) return cleaned;
  }
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    return decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, ' ').trim();
  }
  return '';
}

function extractBalancedBlockNode(html: string, openTagPattern: RegExp): string | null {
  const match = openTagPattern.exec(html);
  if (!match || match.index === undefined) return null;

  const startIdx = match.index;
  const tagNameMatch = match[0].match(/^<([a-zA-Z0-9]+)/);
  const tagName = tagNameMatch?.[1]?.toLowerCase() || 'div';
  const tagScanner = new RegExp(`<(\\/?)${tagName}\\b[^>]*>`, 'gi');
  tagScanner.lastIndex = startIdx;

  let depth = 0;
  let token: RegExpExecArray | null;
  while ((token = tagScanner.exec(html)) !== null) {
    const isClosing = token[1] === '/';
    if (isClosing) {
      depth -= 1;
      if (depth <= 0) {
        return html.slice(startIdx, token.index + token[0].length);
      }
    } else {
      depth += 1;
    }
  }
  return null;
}

function extractWithNodeFallback(html: string): ExtractedHtmlArticle {
  const title = extractMetaTitleNode(html);
  const cleanedHtml = removeNoiseBlocksNode(html);

  const nodePriorityPatterns: RegExp[] = [
    /<[a-zA-Z0-9]+\b[^>]*id=["'](?:dic_area|newsct_article)["'][^>]*>/i,
    /<[a-zA-Z0-9]+\b[^>]*(?:class=["'][^"']*\barticle_view\b[^"']*["']|id=["']harmonyContainer["'])[^>]*>/i,
    /<[a-zA-Z0-9]+\b[^>]*itemprop=["']articleBody["'][^>]*>/i,
    /<article\b[^>]*>/i,
    /<[a-zA-Z0-9]+\b[^>]*(?:id=["'](?:articleBody|article-view-content-div)["']|class=["'][^"']*\b(?:article_body|article-body|news_body|view_con)\b[^"']*["'])[^>]*>/i,
  ];

  let content = '';
  for (const pattern of nodePriorityPatterns) {
    const block = extractBalancedBlockNode(cleanedHtml, pattern);
    if (!block) continue;
    const candidate = postProcessArticleText(stripTagsToTextNode(block));
    if (candidate.length >= 60) {
      content = candidate;
      break;
    }
  }

  if (content.length < 60) {
    const pMatches = cleanedHtml.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [];
    const paragraphs = pMatches
      .map((p) => stripTagsToTextNode(p).replace(/\n+/g, ' ').trim())
      .filter((p) => p.length >= 15);
    content = postProcessArticleText(paragraphs.join('\n'));
  }

  return {
    title: title || '제목 없는 웹 기사',
    content: content.slice(0, 15000),
  };
}

export function extractArticleFromHtml(html: string): ExtractedHtmlArticle {
  if (typeof DOMParser !== 'undefined') {
    return extractWithDomParser(html);
  }
  return extractWithNodeFallback(html);
}
