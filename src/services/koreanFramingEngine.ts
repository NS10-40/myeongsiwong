import {
  AnalysisMetrics,
  BlindSpot,
  FramingAnalysis,
  HeadlineBattle,
  SegmentType,
  SentenceStatus,
  TextSegment,
} from '../types/framing';

interface SpanAnnotation {
  start: number;
  end: number;
  type: Exclude<SegmentType, 'neutral'>;
  reason: string;
  weight?: number;
}

const EMOTION_LEXICON: Array<{ pattern: string; label: string; weight: number }> = [
  { pattern: '\\[속보\\]|\\[단독\\]|\\[충격\\]|\\[긴급\\]', label: '클릭 유도 속보성 말머리', weight: 3.0 },
  { pattern: '서민\\s*등골\\s*휜다|등골이\\s*휜다|등골\\s*휘는', label: '집단적 고통과 분노를 자극하는 관용구', weight: 3.0 },
  { pattern: '대폭발|대재앙|아수라장|초토화|쑥대밭|피눈물|줄초상|줄도산', label: '재난급 위기감을 주입하는 극단적 은유', weight: 3.0 },
  { pattern: '무자비하게|집어삼키고|증발|종말|뇌가\\s*썩고|민낯|참사|파국|대혼란|대란|최악', label: '대상을 악마화하거나 극단화하는 선동 어휘', weight: 3.0 },
  { pattern: '역대급|사상\\s*초유|역대\\s*최악|전례\\s*없는', label: '비교 근거 없이 크기를 과장하는 수식어', weight: 2.0 },
  { pattern: '터졌다|터져\\s*나오고\\s*있다|터져\\s*나왔다|뒤집혔다|발칵', label: '사건의 파장을 극적으로 부풀리는 동사', weight: 2.0 },
  { pattern: '충격적|충격|경악할|경악|아연실색|경천동지|믿기\\s*힘든', label: '독자의 정서적 동요를 즉각 유도하는 감정 어휘', weight: 2.0 },
  { pattern: '폭등|폭락|추락|급락|치솟는|치솟았다|붕괴|무너졌다|무너졌', label: '변동폭을 과장해 공포감을 유발하는 서술어', weight: 2.0 },
  { pattern: '분노|분통|원성|질타|뭇매|개탄|혀를\\s*차|비명|눈물|허탈|배신감', label: '대중의 감정적 반응을 일반화하는 어휘', weight: 2.0 },
  { pattern: '공포감|공포|패닉|멘붕|쇼크|악몽|비관론|암울한|암담하다|암담', label: '불안과 파국적 심리를 증폭시키는 표현', weight: 2.0 },
  { pattern: '결국|이대로\\s*가다간|카운트다운|시한폭탄|벼랑\\s*끝|초비상|적신호|경고음|경고|직격탄', label: '필연적 위기와 긴박함을 암시하는 프레임 어휘', weight: 1.4 },
  { pattern: '심각한|심각|위기감|휘청|들끓|들썩|술렁|도마\\s*위|휩싸여|휩싸였다|날\\s*선\\s*비판|무력화', label: '논란성과 부정적 긴장감을 강조하는 표현', weight: 1.2 },
];

const EMOTION_PUNCTUATION_REGEX = /[!?]{2,}|[?!]{2,}|\.{3,}|…+/g;
const EMOTION_PUNCTUATION_WEIGHT = 2.0;

const VAGUE_PATTERNS: Array<{ regex: RegExp; reason: string; weight: number }> = [
  {
    regex:
      /(?<![가-힣a-zA-Z0-9])(?:복수의\s*)?(?:(?:유통업계|교육\s*현장|실리콘밸리\s*내부|업계|시장|정계|재계|현장|일선|학계|외신|커뮤니티|온라인)\s+)?(?:정통한\s*)?(?:전문가|관계자|소식통|당국자|상인|교사|학부모|직장인|소비자|네티즌|누리꾼|시민|이들|일각)(?:들)?(?:은|는|이|가|의|도|만)?(?:\s*(?:사이에서|사이에선|에\s*따르면|측은|다수는|중심으로))?(?![가-힣a-zA-Z0-9])/g,
    reason: '모호한 출처 · 구체적 기관·실명 없이 익명 또는 집단 주어에 의존',
    weight: 1.5,
  },
  {
    regex:
      /(?:온라인\s*커뮤니티를\s*중심으로|커뮤니티를\s*중심으로|온라인상에서는|온라인상에선|업계에서는|업계에선|일각에서는|일각에선|현장에서는|현장에선|대다수\s*(?:전문가|네티즌|누리꾼|시민)(?:들은|은)?)/g,
    reason: '모호한 출처 · 대표성이 검증되지 않은 집단 여론 일반화',
    weight: 2.0,
  },
  {
    regex:
      /(?:(?:으)?로\s*알려졌다|라는\s*지적이다|라는\s*지적이\s*나온다|라는\s*평가다|라는\s*분석이다|라는\s*전망이다|라는\s*비판이다|것으로\s*보인다|것으로\s*전해졌다|것으로\s*알려졌다|것으로\s*추정된다|입을\s*모은다|입을\s*모았다|중론이다|지배적이다|풀이된다|관측된다|전해졌다|알려졌다)/g,
    reason: '책임 회피 서술 · 주체와 근거를 흐리는 피동·추측형 어미',
    weight: 1.2,
  },
];

const NUMBER_UNIT_REGEX =
  /\d+(?:,\d{3})*(?:\.\d+)?\s*(?:%|퍼센트|%p|포인트|명|원|억|만|조|천|배|건|회|년|월|일|시간|분|초|점|위|세|대|호|달러|엔|유로|kg|km|m)/g;

const OFFICIAL_AGENCY_REGEX =
  /(?:통계청|한국은행|기획재정부|교육부|보건복지부|고용노동부|과학기술정보통신부|국토교통부|산업통상자원부|금융위원회|공정거래위원회|경찰청|검찰|법원|국회|한국교육과정평가원|질병관리청|기상청|감사원|OECD|IMF|UN|WHO|연준|Fed|발표|보고서|통계|조사\s*결과|집계|백서|공시|지표|지수|추산)/g;

const DIRECT_QUOTE_REGEX = /(?:"[^"\n]{4,}"|“[^”\n]{4,}”|'[^'\n]{4,}'|‘[^’\n]{4,}’)/g;

const BOILERPLATE_NOISE_REGEX =
  /(?:(?:기사\s*)?(?:입력|수정|승인|발행|작성|등록|업데이트|출고)\s*[:.]?\s*\d{2,4}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|https?:\/\/|www\.|무단\s*전재|재배포\s*금지|저작권자|copyright|ⓒ|구독\s*하기|구독과\s*좋아요|알림\s*설정|공유하기|스크랩|기사\s*제보|독자\s*제보|광고\s*문의|사업자\s*등록번호|(?:사진|영상|그래픽|자료|일러스트|화면\s*캡처)\s*[=:]|(?:조회수?|댓글|답글|공감|추천|비추천|좋아요|구독자?|팔로워)\s*[:.]?\s*\d|(?:할인\s*쿠폰|특가\s*세일|무료\s*배송|사은품|선착순\s*\d+|프로모션|지금\s*구매|이벤트\s*응모|회원\s*가입)|0\d{1,2}-\d{3,4}-\d{4}|(?:15|16|18)\d{2}-\d{4})/i;

const DATE_ONLY_LINE_REGEX =
  /^\s*(?:\[[^\]]+\]\s*)?\d{4}[.\-/년]\s*\d{1,2}[.\-/월]\s*\d{1,2}(?:일)?(?:\s*\([월화수목금토일]\))?(?:\s*(?:오전|오후)?\s*\d{1,2}:\d{2}(?::\d{2})?)?\s*$/;

const NON_NEWS_CHATTER_REGEX =
  /(?:안녕하세요|반갑습니다|브이로그|먹방|오늘\s*일기|꿀팁|내돈내산|리뷰\s*이벤트|(?:친구|엄마|아빠|남친|여친|남편|아내)(?:들)?(?:이랑|하고|랑|와)\s*.*(?:먹었|갔었|샀다|놀았|마셨|봤다))/;

const INCOMPLETE_FRAGMENT_REGEX =
  /(?:은|는|이|가|을|를|의|에|에서|에게|와|과|로|으로|라는|이라는|다는|라고|다고|라며|면서|으며|지만|는데|은데|거나|든지|더라|다더라)["'”’\s]*$/;

const NEWS_ENTITY_OR_DOMAIN_REGEX =
  /(?:통계청|한국은행|기획재정부|기재부|교육부|보건복지부|복지부|고용노동부|고용부|과학기술정보통신부|과기부|국토교통부|국토부|산업통상자원부|산업부|외교부|국방부|법무부|행안부|환경부|금융위원회|금융위|금융감독원|금감원|공정거래위원회|공정위|방통위|선관위|국세청|관세청|경찰청|경찰|검찰|공수처|법원|재판부|헌법재판소|국회|정부|대통령실|국무회의|여당|야당|지자체|서울시|경기도|시청|구청|도청|교육청|한국교육과정평가원|질병관리청|기상청|감사원|연구원|연구소|학회|협회|공사|공단|거래소|OECD|IMF|UN|WHO|EU|연준|Fed|발표|보고서|통계|조사|집계|백서|공시|지표|지수|추산|산정|평가|보도|취재|확인|전년|동월|동기|대비|기준금리|물가|소비자물가|근원물가|수출|수입|무역|환율|코스피|코스닥|주가|실적|매출|영업이익|GDP|성장률|실업률|고용률|출산율|인구|예산|세수|세금|금리|대출|부동산|아파트|전세|청약|분양|법안|개정안|시행령|조례|판결|선고|기소|수사|혐의|체포|구속|사고|화재|지진|태풍|폭우|폭설|감염|확진|백신|임상|특허|반도체|인공지능|AI|직무|노동|임금|최저임금|연금|건강보험|학업성취도|문해력|언어능력|기후|탄소|원전|전력|에너지|외교|안보|정상회담|관세|제재)/;

const NEWS_REPORTING_VERB_REGEX =
  /(?:발표|공개|조사|집계|기록|상승|하락|증가|감소|확대|축소|추산|산정|밝혔|전했|보도|공시|체결|승인|확정|시행|개정|판결|선고|기소|입건|착수|중단|예고|지적|분석|평가|나타났|드러났|달했|넘었|줄었|늘었|올랐|내렸|동결|인상|인하|포함)(?:했|됐|했으|됐으|했습|됐습|한다|된다|했다|됐다|다)?/;

export function isBoilerplateOrNoise(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (DATE_ONLY_LINE_REGEX.test(trimmed)) return true;
  if (BOILERPLATE_NOISE_REGEX.test(trimmed)) return true;
  if (NON_NEWS_CHATTER_REGEX.test(trimmed)) return true;
  return false;
}

export function isIncompleteFactFragment(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/^["'“‘][^"'”’\n]+["'”’]$/.test(trimmed)) return true;
  if (INCOMPLETE_FRAGMENT_REGEX.test(trimmed)) return true;
  return false;
}

export function isNewsRelatedFact(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 12) return false;
  if (isBoilerplateOrNoise(trimmed) || isIncompleteFactFragment(trimmed)) {
    return false;
  }

  const hasNewsDomain = NEWS_ENTITY_OR_DOMAIN_REGEX.test(trimmed);
  const hasReportingVerb = NEWS_REPORTING_VERB_REGEX.test(trimmed);
  const hasFactSignal = inspectFactSignals(trimmed).length > 0;

  return hasFactSignal && (hasNewsDomain || hasReportingVerb);
}

function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[가-힣a-zA-Z0-9]/.test(ch);
}

function expandToKoreanWord(text: string, start: number, end: number): [number, number] {
  let s = start;
  let e = end;
  while (s > 0 && isWordChar(text[s - 1])) {
    s -= 1;
  }
  while (e < text.length && isWordChar(text[e])) {
    e += 1;
  }
  return [s, e];
}

function addNonOverlappingSpan(
  spans: SpanAnnotation[],
  candidate: SpanAnnotation
): void {
  if (candidate.end <= candidate.start) return;
  const hasOverlap = spans.some(
    (existing) => candidate.start < existing.end && candidate.end > existing.start
  );
  if (!hasOverlap) {
    spans.push(candidate);
  }
}

function detectEmotionAndVagueSpans(rawText: string): SpanAnnotation[] {
  const spans: SpanAnnotation[] = [];

  for (const rule of VAGUE_PATTERNS) {
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(rawText)) !== null) {
      const matchedText = match[0];
      if (!matchedText.trim() || matchedText.trim().length < 2) continue;

      const leadSpaces = matchedText.length - matchedText.trimStart().length;
      const trailSpaces = matchedText.length - matchedText.trimEnd().length;
      const start = match.index + leadSpaces;
      const end = match.index + matchedText.length - trailSpaces;

      addNonOverlappingSpan(spans, {
        start,
        end,
        type: 'vague',
        reason: rule.reason,
        weight: rule.weight,
      });
    }
  }

  for (const entry of EMOTION_LEXICON) {
    const regex = new RegExp(entry.pattern, 'gi');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(rawText)) !== null) {
      const [expStart, expEnd] = expandToKoreanWord(
        rawText,
        match.index,
        match.index + match[0].length
      );
      addNonOverlappingSpan(spans, {
        start: expStart,
        end: expEnd,
        type: 'emotion',
        reason: `감정 트리거 · ${entry.label}`,
        weight: entry.weight,
      });
    }
  }

  const punctRegex = new RegExp(
    EMOTION_PUNCTUATION_REGEX.source,
    EMOTION_PUNCTUATION_REGEX.flags
  );
  let punctMatch: RegExpExecArray | null;
  while ((punctMatch = punctRegex.exec(rawText)) !== null) {
    addNonOverlappingSpan(spans, {
      start: punctMatch.index,
      end: punctMatch.index + punctMatch[0].length,
      type: 'emotion',
      reason: '감정 트리거 · 긴박감·의혹을 과장하는 반복 문장부호',
      weight: EMOTION_PUNCTUATION_WEIGHT,
    });
  }

  return spans.sort((a, b) => a.start - b.start);
}

function getSentenceBounds(rawText: string): Array<{ start: number; end: number }> {
  const bounds: Array<{ start: number; end: number }> = [];
  let currentStart = 0;

  for (let i = 0; i < rawText.length; i++) {
    const ch = rawText[i];
    const nextCh = rawText[i + 1];

    const isLineBreak = ch === '\n';
    const isSentenceEnd =
      (ch === '.' || ch === '!' || ch === '?') &&
      !(ch === '.' && /\d/.test(rawText[i - 1] || '') && /\d/.test(nextCh || '')) &&
      !(ch === '.' && (rawText[i - 1] === '.' || nextCh === '.'));

    if (isLineBreak || isSentenceEnd) {
      const end = i + 1;
      if (end > currentStart) {
        bounds.push({ start: currentStart, end });
      }
      currentStart = end;
    }
  }

  if (currentStart < rawText.length) {
    bounds.push({ start: currentStart, end: rawText.length });
  }

  return bounds;
}

function findUnmarkedGaps(
  start: number,
  end: number,
  occupied: SpanAnnotation[]
): Array<{ start: number; end: number }> {
  const gaps: Array<{ start: number; end: number }> = [];
  let cursor = start;

  for (const span of occupied) {
    if (span.end <= start || span.start >= end) continue;
    if (span.start > cursor) {
      gaps.push({ start: cursor, end: Math.min(span.start, end) });
    }
    cursor = Math.max(cursor, span.end);
  }

  if (cursor < end) {
    gaps.push({ start: cursor, end });
  }

  return gaps;
}

function inspectFactSignals(slice: string): string[] {
  const signals: string[] = [];
  const numMatches = slice.match(NUMBER_UNIT_REGEX);
  if (numMatches && numMatches.length > 0) {
    signals.push(`수치·단위(${numMatches.slice(0, 2).join(', ')})`);
  }

  const agencyMatches = slice.match(OFFICIAL_AGENCY_REGEX);
  if (agencyMatches && agencyMatches.length > 0) {
    signals.push(`공식 출처·지표(${agencyMatches.slice(0, 2).join(', ')})`);
  }

  const quoteMatches = slice.match(DIRECT_QUOTE_REGEX);
  if (quoteMatches && quoteMatches.length > 0 && signals.length > 0) {
    signals.push('직접 인용 포함');
  }

  return signals;
}

function detectFactSpans(
  rawText: string,
  existingSpans: SpanAnnotation[]
): SpanAnnotation[] {
  const factSpans: SpanAnnotation[] = [];
  const sentenceBounds = getSentenceBounds(rawText);

  for (const sentence of sentenceBounds) {
    const gaps = findUnmarkedGaps(sentence.start, sentence.end, existingSpans);

    for (const gap of gaps) {
      const rawSlice = rawText.slice(gap.start, gap.end);
      const leadSpaces = rawSlice.length - rawSlice.trimStart().length;
      const trailSpaces = rawSlice.length - rawSlice.trimEnd().length;
      const trimmedStart = gap.start + leadSpaces;
      const trimmedEnd = gap.end - trailSpaces;
      const trimmed = rawText.slice(trimmedStart, trimmedEnd);

      if (trimmed.length < 12) continue;
      if (!isNewsRelatedFact(trimmed)) continue;

      const signals = inspectFactSignals(trimmed);
      if (signals.length > 0) {
        factSpans.push({
          start: trimmedStart,
          end: trimmedEnd,
          type: 'fact',
          reason: `검증 가능 뉴스 팩트 · ${signals.join(' + ')}`,
        });
      }
    }
  }

  return factSpans;
}

function buildSegmentsFromSpans(
  rawText: string,
  allSpans: SpanAnnotation[]
): TextSegment[] {
  const sorted = [...allSpans].sort((a, b) => a.start - b.start);
  const segments: TextSegment[] = [];
  let cursor = 0;
  let idx = 0;

  for (const span of sorted) {
    if (span.start < cursor) continue;
    if (span.start > cursor) {
      segments.push({
        id: `seg-${idx++}`,
        text: rawText.slice(cursor, span.start),
        type: 'neutral',
      });
    }
    segments.push({
      id: `seg-${idx++}`,
      text: rawText.slice(span.start, span.end),
      type: span.type,
      reason: span.reason,
      weight: span.weight,
    });
    cursor = span.end;
  }

  if (cursor < rawText.length) {
    segments.push({
      id: `seg-${idx++}`,
      text: rawText.slice(cursor),
      type: 'neutral',
    });
  }

  return segments;
}

function extractHashtagKeywords(segments: TextSegment[]): {
  emotionKeywords: string[];
  vagueKeywords: string[];
} {
  const emotionSet = new Set<string>();
  const vagueSet = new Set<string>();

  for (const seg of segments) {
    const clean = seg.text
      .replace(/[\[\]"'“”‘’.,!?…]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean || clean.length < 2) continue;

    if (seg.type === 'emotion') {
      // Prefer concise core keyword (<= 14 chars)
      const short = clean.length > 14 ? clean.split(' ')[0] : clean;
      if (short.length >= 2) emotionSet.add(short);
    } else if (seg.type === 'vague') {
      const short = clean.length > 16 ? clean.slice(0, 16).trim() : clean;
      if (short.length >= 2) vagueSet.add(short);
    }
  }

  return {
    emotionKeywords: Array.from(emotionSet).slice(0, 3),
    vagueKeywords: Array.from(vagueSet).slice(0, 4),
  };
}

function clampHeadline35(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 35) return normalized;
  return `${normalized.slice(0, 34).trim()}…`;
}

function extractCoreTopicNoun(text: string): string {
  const cleaned = text
    .replace(NUMBER_UNIT_REGEX, '')
    .replace(/[\[\]"'“”‘’.,!?…()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = cleaned
    .split(' ')
    .map((t) => t.replace(/(은|는|이|가|을|를|의|에|서|로|으로|와|과|도)$/, ''))
    .filter((t) => t.length >= 2 && !/^(지난달|올해|작년|최근|반면|한편|전체|기준|대비|이상|미만)$/.test(t));

  return tokens[0] || '핵심 지표';
}

function buildHeadlineBattle(segments: TextSegment[]): HeadlineBattle {
  const factTexts = segments
    .filter((s) => s.type === 'fact')
    .map((s) => s.text.trim())
    .filter(Boolean);

  if (factTexts.length === 0) {
    return {
      sensational: clampHeadline35('근거 수치 없는 충격 논란… 지금 확인 필수'),
      dryFact: clampHeadline35('검증 가능한 정량 수치·공식 출처 미확인'),
      counterAngle: clampHeadline35('수치 없는 주장, 객관 근거 확인부터 해야'),
    };
  }

  const combined = factTexts.join(' ');
  const nums = combined.match(NUMBER_UNIT_REGEX) || [];
  const agencies = combined.match(OFFICIAL_AGENCY_REGEX) || [];

  const mainNum = nums[0]?.replace(/\s+/g, '') || '';
  const subNum = nums[1]?.replace(/\s+/g, '') || '';
  const mainAgency = agencies[0] || '';
  const topic = extractCoreTopicNoun(factTexts[0]);

  const sensationalRaw = mainNum
    ? `${topic} ${mainNum}${subNum ? `·${subNum}` : ''} 충격… 위기 현실화`
    : `${topic} 관련 발표 나왔다… 파장 불가피`;

  const dryFactRaw = mainAgency && mainNum
    ? `${mainAgency} 발표, ${topic} ${mainNum}${subNum ? `·${subNum}` : ''} 기록`
    : mainNum
      ? `${topic} 관련 수치 ${mainNum}${subNum ? `·${subNum}` : ''} 집계`
      : `${mainAgency || topic} 공식 자료 기반 사실 확인`;

  const counterRaw = mainNum
    ? `${topic} ${mainNum} 숫자만 봐선 오해… 모수 따져야`
    : `${topic} 단일 단면만으로 일반화 근거 부족`;

  return {
    sensational: clampHeadline35(sensationalRaw),
    dryFact: clampHeadline35(dryFactRaw),
    counterAngle: clampHeadline35(counterRaw),
  };
}

function buildBlindSpots(
  segments: TextSegment[],
  rawText: string
): BlindSpot[] {
  const emotionSegs = segments.filter((s) => s.type === 'emotion');
  const vagueSegs = segments.filter((s) => s.type === 'vague');
  const factSegs = segments.filter((s) => s.type === 'fact');

  const allNums = rawText.match(NUMBER_UNIT_REGEX) || [];
  const percentNums = allNums.filter((n) => /%|퍼센트|배/.test(n));
  const spots: BlindSpot[] = [];

  if (percentNums.length > 0) {
    spots.push({
      id: 'bs-denominator',
      title: '전체 모수·가중치 누락',
      oneLineWarning: `전체 모수 누락 — 비율(${percentNums.slice(0, 2).join(', ')})만 있고 전체 비중·기저효과가 없음`,
    });
  } else if (factSegs.length === 0) {
    spots.push({
      id: 'bs-no-quant',
      title: '정량 수치·공식 출처 부재',
      oneLineWarning: '정량 근거 부재 — 검증할 통계 수치나 공인 기관 출처가 전혀 없음',
    });
  } else {
    spots.push({
      id: 'bs-baseline',
      title: '비교 대조군 생략',
      oneLineWarning: `비교 기준선 생략 — 제시된 수치(${allNums.slice(0, 2).join(', ') || '단일 지표'})의 장기 평균·대조군이 없음`,
    });
  }

  if (vagueSegs.length > 0) {
    const sampleVague = vagueSegs[0].text.trim().slice(0, 14);
    spots.push({
      id: 'bs-vague-source',
      title: '익명 권위 차용',
      oneLineWarning: `익명 권위 의존 — 실명 출처 대신 '${sampleVague}' 같은 모호한 주어로 반론 생략`,
    });
  } else if (emotionSegs.length > 0) {
    const sampleEmotion = emotionSegs[0].text.trim().slice(0, 12);
    spots.push({
      id: 'bs-emotion-leap',
      title: '감정 어휘 비약',
      oneLineWarning: `인과관계 비약 — '${sampleEmotion}' 등 감정 표현이 객관적 원인 분석을 대체함`,
    });
  } else {
    spots.push({
      id: 'bs-counter-omission',
      title: '반대 측 반론 누락',
      oneLineWarning: '반대 논리 생략 — 동일 수치를 다르게 해석하는 상반된 변수가 배제됨',
    });
  }

  return spots.slice(0, 2);
}

export function selectTopFacts(segments: TextSegment[], max = 3): TextSegment[] {
  const newsFactSegments = segments.filter((s) => {
    if (s.type !== 'fact') return false;
    if (s.reason?.startsWith('사용자 직접 교정')) return true;
    return isNewsRelatedFact(s.text);
  });

  if (newsFactSegments.length <= max) return newsFactSegments;

  const scored = newsFactSegments.map((seg, index) => {
    const text = seg.text;
    const numCount = (text.match(NUMBER_UNIT_REGEX) || []).length;
    const agencyCount = (text.match(OFFICIAL_AGENCY_REGEX) || []).length;
    const hasNewsVerb = NEWS_REPORTING_VERB_REGEX.test(text) ? 1 : 0;
    const hasQuote = DIRECT_QUOTE_REGEX.test(text) ? 1 : 0;
    const score =
      numCount * 3 +
      agencyCount * 2 +
      hasNewsVerb * 2 +
      hasQuote +
      Math.min(text.length, 140) / 70;
    return { seg, index, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.seg);
}

export function computeMetrics(segments: TextSegment[]): AnalysisMetrics {
  let totalChars = 0;
  let factChars = 0;
  let emotionChars = 0;
  let vagueChars = 0;
  let neutralChars = 0;
  let emotionCount = 0;
  let vagueCount = 0;
  let factCount = 0;
  let emotionWeightedSum = 0;
  let vagueWeightedSum = 0;

  for (const seg of segments) {
    const len = seg.text.length;
    totalChars += len;
    if (seg.type === 'fact') {
      factChars += len;
      factCount += 1;
    } else if (seg.type === 'emotion') {
      emotionChars += len;
      emotionCount += 1;
      emotionWeightedSum += seg.weight ?? 2.0;
    } else if (seg.type === 'vague') {
      vagueChars += len;
      vagueCount += 1;
      vagueWeightedSum += seg.weight ?? 1.5;
    } else {
      neutralChars += len;
    }
  }

  // Sentence structure analysis across reconstructed full text
  const fullText = segments.map((s) => s.text).join('');
  const rawBounds = getSentenceBounds(fullText);
  const nonEmptyBounds = rawBounds.filter(
    (b) => fullText.slice(b.start, b.end).trim().length > 0
  );

  const sentenceFlags = nonEmptyBounds.map(() => ({
    hasFraming: false,
    hasFact: false,
  }));

  let cursor = 0;
  for (const seg of segments) {
    const segStart = cursor;
    const segEnd = cursor + seg.text.length;
    cursor = segEnd;
    if (seg.type === 'neutral') continue;

    for (let i = 0; i < nonEmptyBounds.length; i++) {
      const sb = nonEmptyBounds[i];
      if (segStart < sb.end && segEnd > sb.start) {
        if (seg.type === 'emotion' || seg.type === 'vague') {
          sentenceFlags[i].hasFraming = true;
        } else if (seg.type === 'fact') {
          sentenceFlags[i].hasFact = true;
        }
      }
    }
  }

  const sentenceStatuses: SentenceStatus[] = sentenceFlags.map((f) => {
    if (f.hasFraming && f.hasFact) return 'mixed';
    if (f.hasFraming) return 'framing';
    if (f.hasFact) return 'fact';
    return 'neutral';
  });

  const totalSentences = nonEmptyBounds.length;
  const contaminatedSentences = sentenceFlags.filter((s) => s.hasFraming).length;
  const factSentences = sentenceFlags.filter((s) => s.hasFact).length;
  const contaminatedSentenceRatio =
    totalSentences > 0
      ? Number(((contaminatedSentences / totalSentences) * 100).toFixed(1))
      : 0;

  const factPercent =
    totalChars > 0 ? Number(((factChars / totalChars) * 100).toFixed(1)) : 0;
  const packagingPercent =
    totalChars > 0 ? Number((100 - factPercent).toFixed(1)) : 0;

  // Normalize framing frequency per 500 chars (floor 200 chars to avoid small-text spikes)
  const normBase = Math.max(totalChars, 200);
  const emotionDensityPer500 = Number(
    ((emotionWeightedSum / normBase) * 500).toFixed(1)
  );
  const vagueDensityPer500 = Number(
    ((vagueWeightedSum / normBase) * 500).toFixed(1)
  );

  const emotionScore = Math.min(
    55,
    Number((emotionDensityPer500 * 2.4).toFixed(1))
  );
  const vagueScore = Math.min(
    30,
    Number((vagueDensityPer500 * 2.5).toFixed(1))
  );
  const sentenceScore = Math.min(
    20,
    Number(((contaminatedSentenceRatio / 100) * 20).toFixed(1))
  );
  const factRelief = Math.min(
    15,
    Number(((factPercent / 100) * 20).toFixed(1))
  );

  const rawAggro = emotionScore + vagueScore + sentenceScore - factRelief;
  const aggroScore =
    totalChars > 0 ? Math.round(Math.max(0, Math.min(100, rawAggro))) : 0;

  let grade: AnalysisMetrics['grade'] = 'factual';
  let gradeLabel = '✅ 팩트 위주';
  if (aggroScore >= 55) {
    grade = 'aggro';
    gradeLabel = '🚨 어그로 과다';
  } else if (aggroScore >= 25) {
    grade = 'caution';
    gradeLabel = '⚠️ 포장 주의';
  }

  return {
    totalChars,
    factChars,
    emotionChars,
    vagueChars,
    neutralChars,
    factPercent,
    packagingPercent,
    emotionCount,
    vagueCount,
    factCount,
    grade,
    gradeLabel,
    breakdown: {
      aggroScore,
      emotionScore,
      vagueScore,
      sentenceScore,
      factRelief,
      emotionWeightedSum: Number(emotionWeightedSum.toFixed(1)),
      vagueWeightedSum: Number(vagueWeightedSum.toFixed(1)),
      emotionDensityPer500,
      vagueDensityPer500,
      totalSentences,
      contaminatedSentences,
      factSentences,
      contaminatedSentenceRatio,
      sentenceStatuses,
    },
  };
}

export function buildDerivedAnalysis(
  segments: TextSegment[],
  rawText?: string
): FramingAnalysis {
  const fullText = rawText ?? segments.map((s) => s.text).join('');
  const { emotionKeywords, vagueKeywords } = extractHashtagKeywords(segments);
  const headlineBattle = buildHeadlineBattle(segments);
  const blindSpots = buildBlindSpots(segments, fullText);

  return {
    segments,
    emotionKeywords,
    vagueKeywords,
    headlineBattle,
    blindSpots,
    engineLabel: '자체 한국어 프레이밍 엔진',
  };
}

export function reclassifySegment(
  current: FramingAnalysis,
  segmentId: string,
  nextType: SegmentType
): FramingAnalysis {
  const reasonMap: Record<SegmentType, string | undefined> = {
    fact: '사용자 직접 교정 · 검증 가능한 순수 팩트로 지정',
    emotion: '사용자 직접 교정 · 감정 선동·과장 표현으로 변경',
    vague: '사용자 직접 교정 · 모호한 권위·출처 은폐로 변경',
    neutral: undefined,
  };

  const updatedSegments = current.segments.map((seg) =>
    seg.id === segmentId
      ? {
          ...seg,
          type: nextType,
          reason: reasonMap[nextType],
        }
      : seg
  );

  return buildDerivedAnalysis(updatedSegments);
}

export function analyzeKoreanFraming(rawText: string): FramingAnalysis {
  const emotionAndVagueSpans = detectEmotionAndVagueSpans(rawText);
  const factSpans = detectFactSpans(rawText, emotionAndVagueSpans);
  const segments = buildSegmentsFromSpans(rawText, [
    ...emotionAndVagueSpans,
    ...factSpans,
  ]);

  return buildDerivedAnalysis(segments, rawText);
}

export interface SentenceSegmentPiece {
  key: string;
  text: string;
  segment: TextSegment;
}

export interface SentenceSegmentGroup {
  key: string;
  sentenceIndex: number | null;
  pieces: SentenceSegmentPiece[];
}

export function splitSegmentsBySentence(
  segments: TextSegment[]
): SentenceSegmentGroup[] {
  const fullText = segments.map((s) => s.text).join('');
  if (!fullText) return [];

  const nonEmptyBounds = getSentenceBounds(fullText).filter(
    (b) => fullText.slice(b.start, b.end).trim().length > 0
  );

  // Build full non-overlapping partition [0..fullText.length] tagged with sentenceIndex or null
  const chunks: Array<{ start: number; end: number; sentenceIndex: number | null }> = [];
  let pos = 0;
  nonEmptyBounds.forEach((b, idx) => {
    if (b.start > pos) {
      chunks.push({ start: pos, end: b.start, sentenceIndex: null });
    }
    chunks.push({ start: b.start, end: b.end, sentenceIndex: idx });
    pos = b.end;
  });
  if (pos < fullText.length) {
    chunks.push({ start: pos, end: fullText.length, sentenceIndex: null });
  }

  // Build segment offsets
  const segOffsets: Array<{ start: number; end: number; segment: TextSegment }> = [];
  let cursor = 0;
  for (const seg of segments) {
    const start = cursor;
    const end = cursor + seg.text.length;
    segOffsets.push({ start, end, segment: seg });
    cursor = end;
  }

  return chunks.map((chunk, chunkIdx) => {
    const pieces: SentenceSegmentPiece[] = [];
    for (const s of segOffsets) {
      if (s.end <= chunk.start || s.start >= chunk.end) continue;
      const overlapStart = Math.max(chunk.start, s.start);
      const overlapEnd = Math.min(chunk.end, s.end);
      if (overlapEnd > overlapStart) {
        pieces.push({
          key: `${s.segment.id}-${chunkIdx}-${overlapStart}`,
          text: fullText.slice(overlapStart, overlapEnd),
          segment: s.segment,
        });
      }
    }
    return {
      key: `sent-group-${chunkIdx}`,
      sentenceIndex: chunk.sentenceIndex,
      pieces,
    };
  });
}
