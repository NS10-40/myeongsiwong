import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Droplets,
  Images,
  Search,
  Tag,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  selectTopFacts,
  splitSegmentsBySentence,
} from '../services/koreanFramingEngine';
import {
  AnalysisMetrics,
  ExtractedArticleMeta,
  FramingAnalysis,
  SegmentType,
  TextSegment,
} from '../types/framing';
import {
  buildSummaryCopyText,
  copySummaryToClipboard,
} from '../utils/summaryCardExporter';
import { AlgorithmExplanationPanel } from './AlgorithmExplanationPanel';
import { InstaCardNewsModal } from './InstaCardNewsModal';
import { LayerFilter } from './TopBar';

interface ImpactDashboardProps {
  analysis: FramingAnalysis | null;
  metrics: AnalysisMetrics | null;
  articleMeta: ExtractedArticleMeta | null;
  activeLayer: LayerFilter;
  onChangeLayer: (layer: LayerFilter) => void;
  onReclassifySegment: (segmentId: string, nextType: SegmentType) => void;
}

const TYPE_OPTIONS: Array<{ value: SegmentType; label: string; colorClass: string }> = [
  { value: 'fact', label: '순수 팩트', colorClass: 'text-sky-300' },
  { value: 'emotion', label: '감정 선동', colorClass: 'text-rose-300' },
  { value: 'vague', label: '모호한 출처', colorClass: 'text-amber-300' },
  { value: 'neutral', label: '일반 문맥', colorClass: 'text-slate-300' },
];

const SEGMENT_STYLE: Record<
  Exclude<SegmentType, 'neutral'>,
  { label: string; highlightClass: string }
> = {
  emotion: {
    label: '감정 트리거',
    highlightClass:
      'bg-rose-500/20 text-rose-100 border-b border-rose-400/80 hover:bg-rose-500/30',
  },
  vague: {
    label: '모호한 출처',
    highlightClass:
      'bg-amber-500/20 text-amber-100 border-b border-amber-400/80 hover:bg-amber-500/30',
  },
  fact: {
    label: '순수 팩트',
    highlightClass:
      'bg-sky-500/22 text-sky-50 border-b border-sky-400 hover:bg-sky-500/32',
  },
};

function buildPerplexitySearchUrl(claimText: string): string {
  const prompt = `다음 주장의 통계와 사실 여부를 객관적인 출처를 들어 검증해줘: ${claimText.trim()}`;
  return `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`;
}

interface DonutChartProps {
  factPercent: number;
  emotionPercent: number;
  vaguePercent: number;
}

function PurityDonutChart({
  factPercent,
  emotionPercent,
  vaguePercent,
}: DonutChartProps) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  const factLen = (factPercent / 100) * circumference;
  const emotionLen = (emotionPercent / 100) * circumference;
  const vagueLen = (vaguePercent / 100) * circumference;

  const factOffset = 0;
  const emotionOffset = -factLen;
  const vagueOffset = -(factLen + emotionLen);

  return (
    <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
      <svg
        viewBox="0 0 112 112"
        className="w-28 h-28 -rotate-90"
        role="img"
        aria-label={`순수 팩트 비율 ${factPercent}%`}
      >
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="rgba(51, 65, 85, 0.45)"
          strokeWidth="12"
        />
        {vagueLen > 0 && (
          <circle
            cx="56"
            cy="56"
            r={radius}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="12"
            strokeDasharray={`${vagueLen} ${circumference}`}
            strokeDashoffset={vagueOffset}
          />
        )}
        {emotionLen > 0 && (
          <circle
            cx="56"
            cy="56"
            r={radius}
            fill="none"
            stroke="#f43f5e"
            strokeWidth="12"
            strokeDasharray={`${emotionLen} ${circumference}`}
            strokeDashoffset={emotionOffset}
          />
        )}
        {factLen > 0 && (
          <circle
            cx="56"
            cy="56"
            r={radius}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="12"
            strokeDasharray={`${factLen} ${circumference}`}
            strokeDashoffset={factOffset}
            strokeLinecap="butt"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono text-xl font-bold text-slate-100 tabular-nums leading-none">
          {factPercent}%
        </span>
        <span className="mt-1 text-[10px] font-medium text-slate-400">
          순수 팩트
        </span>
      </div>
    </div>
  );
}

export function ImpactDashboard({
  analysis,
  metrics,
  articleMeta,
  activeLayer,
  onChangeLayer,
  onReclassifySegment,
}: ImpactDashboardProps) {
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [dehydrateMode, setDehydrateMode] = useState(false);
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [selectedAccordionSeg, setSelectedAccordionSeg] =
    useState<TextSegment | null>(null);
  const [focusedSentenceIndex, setFocusedSentenceIndex] = useState<number | null>(
    null
  );
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isInstaModalOpen, setIsInstaModalOpen] = useState(false);
  const sentenceRefs = useRef<Record<number, HTMLSpanElement | null>>({});

  const topFacts = useMemo(() => {
    if (!analysis) return [];
    return selectTopFacts(analysis.segments, 3);
  }, [analysis]);

  const sentenceGroups = useMemo(() => {
    if (!analysis) return [];
    return splitSegmentsBySentence(analysis.segments);
  }, [analysis]);

  const totalChars = metrics?.totalChars ?? 0;
  useEffect(() => {
    setFocusedSentenceIndex(null);
    setCopiedSummary(false);
  }, [totalChars]);

  useEffect(() => {
    if (!isAccordionOpen || focusedSentenceIndex === null) return;
    const timer = window.setTimeout(() => {
      const target = sentenceRefs.current[focusedSentenceIndex];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [isAccordionOpen, focusedSentenceIndex]);

  if (!analysis || !metrics) {
    return (
      <div className="bg-[#0F172A] border border-slate-800/90 rounded-lg p-12 text-center">
        <p className="text-sm font-medium text-slate-300">
          분석할 텍스트가 없습니다.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          상단 입력창에서 샘플을 선택하거나 뉴스 링크 또는 본문을 입력한 뒤 X-레이 해부를 시작하세요.
        </p>
      </div>
    );
  }

  const emotionPercent =
    metrics.totalChars > 0
      ? Number(((metrics.emotionChars / metrics.totalChars) * 100).toFixed(1))
      : 0;
  const vaguePercent =
    metrics.totalChars > 0
      ? Number(((metrics.vagueChars / metrics.totalChars) * 100).toFixed(1))
      : 0;

  const gradeBadgeStyle =
    metrics.grade === 'aggro'
      ? 'bg-rose-500/15 border-rose-500/50 text-rose-200'
      : metrics.grade === 'factual'
        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200'
        : 'bg-amber-500/15 border-amber-500/50 text-amber-200';

  return (
    <div className="space-y-4">
      {/* Extracted Article Source Header (when loaded from URL) */}
      {articleMeta && (
        <div className="bg-[#0F172A] border border-slate-800/90 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <span className="text-xs font-semibold text-sky-400 shrink-0">
              추출 기사
            </span>
            <p className="text-xs font-semibold text-slate-100 truncate">
              {articleMeta.title}
            </p>
          </div>
          <a
            href={articleMeta.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] font-medium text-sky-300 hover:text-sky-200 transition-colors whitespace-nowrap shrink-0"
          >
            <span>원본 링크 바로가기</span>
            <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
          </a>
        </div>
      )}

      {/* 2. 상단 [3초 컷 임팩트 스코어보드] */}
      <section
        aria-label="3초 컷 임팩트 스코어보드"
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch"
      >
        {/* Left Score Card: Donut Chart + Grade Badge */}
        <div className="bg-[#0F172A] border border-slate-800/90 rounded-lg p-5 flex items-center gap-6">
          <PurityDonutChart
            factPercent={metrics.factPercent}
            emotionPercent={emotionPercent}
            vaguePercent={vaguePercent}
          />

          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-md border text-sm font-bold whitespace-nowrap ${gradeBadgeStyle}`}
              >
                {metrics.gradeLabel}
              </span>
              <span className="text-xs font-mono text-slate-300 tabular-nums">
                어그로 지수 {metrics.breakdown.aggroScore}점 / 100
              </span>
            </div>

            <p className="text-sm text-slate-200 font-medium tabular-nums">
              원문 <span className="font-mono font-bold text-white">{metrics.totalChars}</span>자 중 순수 팩트{' '}
              <span className="font-mono font-bold text-sky-300">{metrics.factChars}</span>자
            </p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 tabular-nums">
              <span className="text-sky-300">순수 팩트 {metrics.factPercent}%</span>
              <span aria-hidden="true">·</span>
              <span className="text-rose-300">감정 선동 {emotionPercent}%</span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-300">모호 출처 {vaguePercent}%</span>
            </div>
          </div>
        </div>

        {/* Right Score Card: Filtered Emotion TOP 3 + Vague Source Hashtag Pills */}
        <div className="bg-[#0F172A] border border-slate-800/90 rounded-lg p-5 flex flex-col justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-rose-300">
                감정 선동 키워드 TOP 3
              </span>
              <span className="font-mono tabular-nums">{metrics.emotionCount}건 탐지</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {analysis.emotionKeywords.length > 0 ? (
                analysis.emotionKeywords.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => {
                      onChangeLayer('emotion');
                      setIsAccordionOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-full bg-rose-500/18 border border-rose-500/45 text-sm font-semibold text-rose-100 hover:bg-rose-500/28 transition-colors whitespace-nowrap"
                  >
                    #{kw}
                  </button>
                ))
              ) : (
                <span className="text-xs text-slate-500">탐지된 감정 선동 키워드 없음</span>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800/70">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-amber-300">
                모호한 출처·책임 회피 표현
              </span>
              <span className="font-mono tabular-nums">{metrics.vagueCount}건 탐지</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {analysis.vagueKeywords.length > 0 ? (
                analysis.vagueKeywords.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => {
                      onChangeLayer('vague');
                      setIsAccordionOpen(true);
                    }}
                    className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-xs font-semibold text-amber-100 hover:bg-amber-500/25 transition-colors whitespace-nowrap"
                  >
                    #{kw}
                  </button>
                ))
              ) : (
                <span className="text-xs text-slate-500">탐지된 모호한 출처 표현 없음</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. 중앙 [탈수 완료: 핵심 팩트 TOP 3 요약 카드] */}
      <section
        aria-labelledby="top-facts-title"
        className="bg-[#0F172A] border border-slate-800/90 rounded-lg p-5 space-y-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2
              id="top-facts-title"
              className="text-sm font-bold text-slate-100 tracking-tight"
            >
              탈수 완료: 핵심 팩트 TOP 3
            </h2>
            <span className="text-xs font-mono text-sky-300 tabular-nums">
              · 뉴스 팩트 {metrics.factCount}건 중 {topFacts.length}건 엄선
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                const text = buildSummaryCopyText({
                  articleMeta,
                  metrics,
                  topFacts,
                  blindSpots: analysis.blindSpots,
                });
                const ok = await copySummaryToClipboard(text);
                if (ok) {
                  setCopiedSummary(true);
                  window.setTimeout(() => setCopiedSummary(false), 2000);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              {copiedSummary ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  <span className="text-emerald-300">복사 완료</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  <span>요약 복사</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsInstaModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-sky-500/50 bg-sky-500/15 hover:bg-sky-500/25 text-xs font-semibold text-sky-200 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Images className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
              <span>인스타 카드뉴스</span>
            </button>
          </div>
        </div>

        {topFacts.length === 0 ? (
          <div className="py-6 px-4 rounded-md bg-[#0B1120] border border-slate-800 text-center">
            <p className="text-sm text-slate-300">
              뉴스 보도·공식 발표·통계와 관련된 핵심 팩트 문장이 검출되지 않았습니다.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              광고·메타데이터·일상 문구는 제외되며, 하단 원문 전체 X-레이에서 직접 태그를 교정할 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {topFacts.map((seg, idx) => {
              const isEditing = editingFactId === seg.id;
              return (
                <div
                  key={seg.id}
                  className="p-4 rounded-lg bg-[#0B1120] border border-sky-500/35 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <span className="font-mono text-sm font-bold text-sky-400 pt-1 tabular-nums shrink-0">
                      0{idx + 1}
                    </span>
                    <p className="text-lg leading-relaxed font-medium text-slate-100 break-keep">
                      {seg.text}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 pl-8 md:pl-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-md p-1">
                        {TYPE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              onReclassifySegment(seg.id, opt.value);
                              setEditingFactId(null);
                            }}
                            className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                              seg.type === opt.value
                                ? 'bg-slate-800 text-white'
                                : `${opt.colorClass} hover:bg-slate-800/70`
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingFactId(seg.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-300 hover:text-slate-100 transition-colors whitespace-nowrap"
                      >
                        <Tag className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                        <span>태그 수정</span>
                      </button>
                    )}

                    <a
                      href={buildPerplexitySearchUrl(seg.text)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-sky-500/45 bg-sky-500/15 hover:bg-sky-500/25 text-xs font-semibold text-sky-200 transition-colors whitespace-nowrap"
                    >
                      <span>Perplexity↗</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. 하단 [1줄 헤드라인 배틀 & 사각지대 경고 칩] */}
      <section
        aria-label="1줄 헤드라인 배틀 및 사각지대 진단"
        className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-4 items-stretch"
      >
        {/* 1줄 헤드라인 배틀 (3 lines stacked side-by-side comparison) */}
        <div className="bg-[#0F172A] border border-slate-800/90 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100">
              1줄 헤드라인 배틀
            </h3>
            <span className="text-[11px] text-slate-400">
              동일 팩트 · 35자 이내 즉시 비교
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-md bg-[#0B1120] border border-rose-500/30">
              <span className="text-xs font-bold text-rose-300 whitespace-nowrap shrink-0">
                🔴 낚시성 기사
              </span>
              <p className="text-sm font-semibold text-slate-100 truncate">
                {analysis.headlineBattle.sensational}
              </p>
            </div>

            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-md bg-[#0B1120] border border-sky-500/30">
              <span className="text-xs font-bold text-sky-300 whitespace-nowrap shrink-0">
                🔵 건조한 팩트
              </span>
              <p className="text-sm font-semibold text-slate-100 truncate">
                {analysis.headlineBattle.dryFact}
              </p>
            </div>

            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-md bg-[#0B1120] border border-violet-500/30">
              <span className="text-xs font-bold text-violet-300 whitespace-nowrap shrink-0">
                🟣 반대 관점
              </span>
              <p className="text-sm font-semibold text-slate-100 truncate">
                {analysis.headlineBattle.counterAngle}
              </p>
            </div>
          </div>
        </div>

        {/* 사각지대 경고 배지 (max 2 one-line badges) */}
        <div className="bg-[#0F172A] border border-slate-800/90 rounded-lg p-5 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">
                사각지대 진단
              </h3>
              <span className="text-[11px] font-mono text-amber-300 tabular-nums">
                핵심 경고 {analysis.blindSpots.length}건
              </span>
            </div>

            <div className="space-y-2.5">
              {analysis.blindSpots.map((spot) => (
                <div
                  key={spot.id}
                  className="px-3.5 py-3 rounded-md bg-amber-500/10 border border-amber-500/35 text-xs sm:text-[13px] font-medium text-amber-100 leading-snug"
                >
                  ⚠️ {spot.oneLineWarning}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. 아코디언: [🔍 원문 전체 X-레이 펼치기 (N자)] */}
      <section
        aria-label="원문 전체 X-레이 아코디언"
        className="bg-[#0F172A] border border-slate-800/90 rounded-lg overflow-hidden"
      >
        <button
          type="button"
          aria-expanded={isAccordionOpen}
          onClick={() => setIsAccordionOpen((prev) => !prev)}
          className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-800/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Search className="w-4 h-4 text-sky-400" aria-hidden="true" />
            <span>
              🔍 원문 전체 X-레이 {isAccordionOpen ? '접기' : '펼치기'} ({metrics.totalChars.toLocaleString()}자)
            </span>
          </span>
          {isAccordionOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" aria-hidden="true" />
          )}
        </button>

        <AnimatePresence initial={false}>
          {isAccordionOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="border-t border-slate-800/90"
            >
              {/* Controls inside Accordion */}
              <div className="px-5 py-3 bg-[#0D1425] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400">
                  <span>구문을 클릭하면 태그 분류를 직접 수정할 수 있습니다</span>
                  {focusedSentenceIndex !== null && (
                    <button
                      type="button"
                      onClick={() => setFocusedSentenceIndex(null)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/15 border border-sky-400/50 text-sky-200 font-mono text-[11px] hover:bg-sky-500/25 transition-colors whitespace-nowrap"
                    >
                      <span>S{focusedSentenceIndex + 1} 강조 중 · 해제</span>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={dehydrateMode}
                  onClick={() => setDehydrateMode((prev) => !prev)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors whitespace-nowrap ${
                    dehydrateMode
                      ? 'bg-sky-500 text-slate-950 border-sky-400'
                      : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <Droplets className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>어그로 탈수 모드 {dehydrateMode ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              {/* Full Annotated Original Text */}
              <div className="p-5 text-[15px] leading-[1.9] text-slate-300 whitespace-pre-wrap break-keep">
                {sentenceGroups.map((group) => {
                  const isSentenceFocused =
                    group.sentenceIndex !== null &&
                    focusedSentenceIndex === group.sentenceIndex;

                  const renderedPieces = group.pieces.map((piece) => {
                    const seg = piece.segment;
                    if (
                      dehydrateMode &&
                      (seg.type === 'emotion' || seg.type === 'vague')
                    ) {
                      return (
                        <span
                          key={piece.key}
                          className="line-through opacity-30 text-slate-500 mx-[1px]"
                        >
                          {piece.text}
                        </span>
                      );
                    }

                    if (seg.type === 'neutral') {
                      return (
                        <button
                          key={piece.key}
                          type="button"
                          onClick={() => setSelectedAccordionSeg(seg)}
                          className="inline text-left text-slate-300 hover:text-slate-100 cursor-pointer"
                        >
                          {piece.text}
                        </button>
                      );
                    }

                    const style = SEGMENT_STYLE[seg.type];
                    const isDimmed =
                      activeLayer !== 'all' && activeLayer !== seg.type;

                    return (
                      <button
                        key={piece.key}
                        type="button"
                        onClick={() => setSelectedAccordionSeg(seg)}
                        className={`inline text-left rounded-[3px] px-1 py-0.5 mx-[1px] transition-opacity cursor-pointer ${
                          style.highlightClass
                        } ${isDimmed ? 'opacity-25' : 'opacity-100'} ${
                          selectedAccordionSeg?.id === seg.id
                            ? 'ring-1 ring-white/60'
                            : ''
                        }`}
                      >
                        {piece.text}
                      </button>
                    );
                  });

                  if (group.sentenceIndex === null) {
                    return <span key={group.key}>{renderedPieces}</span>;
                  }

                  const sIdx = group.sentenceIndex;
                  return (
                    <span
                      key={group.key}
                      ref={(el) => {
                        sentenceRefs.current[sIdx] = el;
                      }}
                      className={
                        isSentenceFocused
                          ? 'rounded px-1.5 py-0.5 bg-sky-500/15 ring-1 ring-sky-400/80 transition-colors'
                          : undefined
                      }
                    >
                      {renderedPieces}
                    </span>
                  );
                })}
              </div>

              {/* Interactive Tag Reclassification Strip */}
              {selectedAccordionSeg && (
                <div className="px-5 py-3 bg-[#0B1120] border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-slate-300 truncate">
                      선택 구문: “{selectedAccordionSeg.text.trim()}”
                    </p>
                    {selectedAccordionSeg.reason && (
                      <p className="text-[11px] text-slate-400">
                        {selectedAccordionSeg.reason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          onReclassifySegment(selectedAccordionSeg.id, opt.value);
                          setSelectedAccordionSeg({
                            ...selectedAccordionSeg,
                            type: opt.value,
                          });
                        }}
                        className={`px-2.5 py-1 rounded border text-[11px] font-semibold transition-colors ${
                          selectedAccordionSeg.type === opt.value
                            ? 'bg-slate-800 border-sky-400 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* 6. 분석 알고리즘 시각화 패널 */}
      <AlgorithmExplanationPanel
        metrics={metrics}
        segments={analysis.segments}
        focusedSentenceIndex={focusedSentenceIndex}
        onJumpToSentence={(sentenceIndex) => {
          onChangeLayer('all');
          setIsAccordionOpen(true);
          setFocusedSentenceIndex(sentenceIndex);
        }}
      />

      {/* 인스타 카드뉴스 스튜디오 모달 */}
      <InstaCardNewsModal
        isOpen={isInstaModalOpen}
        onClose={() => setIsInstaModalOpen(false)}
        articleMeta={articleMeta}
        metrics={metrics}
        topFacts={topFacts}
        blindSpots={analysis.blindSpots}
        headlineBattle={analysis.headlineBattle}
      />
    </div>
  );
}
