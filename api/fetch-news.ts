import { lookup } from 'node:dns/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { isIP } from 'node:net';
import { extractArticleFromHtml } from '../src/utils/htmlArticleExtractor';

interface VercelRequest extends IncomingMessage {
  body?: unknown;
}

interface VercelResponse extends ServerResponse {
  status?: (code: number) => VercelResponse;
  json?: (data: unknown) => void;
}

function sendJson(res: VercelResponse, statusCode: number, payload: unknown): void {
  if (typeof res.status === 'function') {
    const nextRes = res.status(statusCode);
    if (typeof nextRes?.json === 'function') {
      nextRes.json(payload);
      return;
    }
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    const MAX_BYTES = 16 * 1024;

    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BYTES) {
        reject(new Error('Request payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^::ffff:/, '');
  if (isIP(normalized) === 4) {
    const parts = normalized.split('.').map((n) => parseInt(n, 10));
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (isIP(normalized) === 6) {
    if (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80')
    ) {
      return true;
    }
    return false;
  }

  return true;
}

async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl.trim());
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('http 또는 https URL만 지원됩니다.');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost')
  ) {
    throw new Error('내부 네트워크 주소는 조회할 수 없습니다.');
  }

  if (isIP(hostname) !== 0) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error('사설 또는 예약된 IP 주소는 조회할 수 없습니다.');
    }
    return parsed;
  }

  const resolved = await lookup(hostname, { all: true });
  if (!resolved.length || resolved.some((entry) => isPrivateOrReservedIp(entry.address))) {
    throw new Error('허용되지 않은 대상 호스트입니다.');
  }

  return parsed;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  let parsedBody: { url?: unknown } = {};
  try {
    if (req.body && typeof req.body === 'object') {
      parsedBody = req.body as { url?: unknown };
    } else if (typeof req.body === 'string') {
      parsedBody = JSON.parse(req.body) as { url?: unknown };
    } else {
      const raw = await readRawBody(req);
      parsedBody = raw ? (JSON.parse(raw) as { url?: unknown }) : {};
    }
  } catch {
    sendJson(res, 400, { error: '유효한 JSON 요청 본문이 필요합니다.' });
    return;
  }

  const rawUrl = typeof parsedBody.url === 'string' ? parsedBody.url.trim() : '';
  if (!rawUrl || rawUrl.length > 2000) {
    sendJson(res, 400, { error: '유효한 뉴스 기사 URL을 입력해 주세요.' });
    return;
  }

  let targetUrl: URL;
  try {
    targetUrl = await assertSafePublicUrl(rawUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '유효하지 않은 URL입니다.';
    sendJson(res, 400, { error: msg });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (response.url) {
      await assertSafePublicUrl(response.url);
    }

    if (!response.ok) {
      sendJson(res, 422, {
        error: `언론사 서버 응답 오류 (HTTP ${response.status})`,
      });
      return;
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (
      contentType &&
      !contentType.includes('text/html') &&
      !contentType.includes('application/xhtml+xml') &&
      !contentType.includes('text/plain')
    ) {
      sendJson(res, 422, { error: 'HTML 웹 페이지 형식이 아닙니다.' });
      return;
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 2.5 * 1024 * 1024) {
      sendJson(res, 422, { error: '문서 크기가 너무 큽니다.' });
      return;
    }

    // Detect charset (e.g. euc-kr on older Korean news portals)
    let charset = 'utf-8';
    const ctMatch = contentType.match(/charset=([a-zA-Z0-9_-]+)/i);
    if (ctMatch?.[1]) {
      charset = ctMatch[1].toLowerCase();
    } else {
      const headPreview = Buffer.from(buffer.slice(0, 4096)).toString('latin1');
      const metaMatch = headPreview.match(/charset=["']?([a-zA-Z0-9_-]+)/i);
      if (metaMatch?.[1]) {
        charset = metaMatch[1].toLowerCase();
      }
    }

    let html: string;
    try {
      html = new TextDecoder(charset).decode(buffer);
    } catch {
      html = new TextDecoder('utf-8').decode(buffer);
    }

    const extracted = extractArticleFromHtml(html);
    if (!extracted.content || extracted.content.length < 60) {
      sendJson(res, 422, {
        error: '기사 본문을 충분히 추출하지 못했습니다.',
      });
      return;
    }

    sendJson(res, 200, {
      title: extracted.title,
      content: extracted.content,
      url: response.url || targetUrl.toString(),
      html,
    });
  } catch {
    sendJson(res, 422, {
      error: '보안 정책 또는 네트워크 제한으로 기사를 불러오지 못했습니다.',
    });
  } finally {
    clearTimeout(timeout);
  }
}
