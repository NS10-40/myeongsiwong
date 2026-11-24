import { ExtractedArticleMeta } from '../types/framing';
import { extractArticleFromHtml } from '../utils/htmlArticleExtractor';

export interface ExtractedNewsPayload extends ExtractedArticleMeta {
  content: string;
}

export const BLOCKED_EXTRACTION_MESSAGE =
  '보안 정책으로 자동 추출이 제한된 기사입니다. 아래 입력창에 본문을 직접 복사해 붙여넣어 주세요.';

export function sanitizePublicHttpUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function isLikelyStandaloneUrl(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return sanitizePublicHttpUrl(trimmed);
}

async function fetchViaServerlessApi(targetUrl: string): Promise<ExtractedNewsPayload | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 11000);
  try {
    const res = await fetch('/api/fetch-news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: targetUrl }),
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      title?: string;
      content?: string;
      url?: string;
      html?: string;
    };

    const parsedFromDom = data.html ? extractArticleFromHtml(data.html) : null;
    const content = (
      parsedFromDom && parsedFromDom.content.length >= 60
        ? parsedFromDom.content
        : data.content || ''
    ).trim();
    if (content.length < 60) return null;

    const title = (
      (parsedFromDom?.title && parsedFromDom.title !== '제목 없는 웹 기사'
        ? parsedFromDom.title
        : data.title) || '제목 없는 웹 기사'
    ).trim();

    return {
      title,
      content,
      url: sanitizePublicHttpUrl(data.url || targetUrl) || targetUrl,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchViaAllOriginsProxy(targetUrl: string): Promise<ExtractedNewsPayload | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 11000);
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl, { signal: controller.signal });
    if (!res.ok) return null;

    const payload = (await res.json()) as {
      contents?: string;
      status?: { http_code?: number; url?: string };
    };

    const html = payload.contents || '';
    if (!html || html.length < 200) return null;

    const extracted = extractArticleFromHtml(html);
    if (!extracted.content || extracted.content.length < 60) return null;

    return {
      title: extracted.title,
      content: extracted.content,
      url: sanitizePublicHttpUrl(payload.status?.url || targetUrl) || targetUrl,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function extractNewsFromUrl(rawUrl: string): Promise<ExtractedNewsPayload> {
  const validUrl = sanitizePublicHttpUrl(rawUrl);
  if (!validUrl) {
    throw new Error('올바른 http:// 또는 https:// 뉴스 기사 링크를 입력해 주세요.');
  }

  // 1. Try Vercel Serverless Function (/api/fetch-news)
  const serverResult = await fetchViaServerlessApi(validUrl);
  if (serverResult) {
    return serverResult;
  }

  // 2. Fallback to public CORS proxy (api.allorigins.win) for static/preview environments
  const proxyResult = await fetchViaAllOriginsProxy(validUrl);
  if (proxyResult) {
    return proxyResult;
  }

  // 3. Both blocked or unable to extract clean article body
  throw new Error(BLOCKED_EXTRACTION_MESSAGE);
}
