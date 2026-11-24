import { ArrowRight, BarChart3, Layers, Scale } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnalysisMetrics, SentenceStatus, TextSegment } from '../types/framing';

interface AlgorithmExplanationPanelProps {
  metrics: AnalysisMetrics;
  segments: TextSegment[];
  focusedSentenceIndex: number | null;
  onJumpToSentence: (sentenceIndex: number) => void;
}

type ExplainTab = 'formula' | 'weights' | 'structure';

const WEIGHT_TIERS = [
  {
    tier: '극단 은유 · 속보',
    multiplier: 3.0,
    widthPct: 100,
    keywords: '[속보] · 대폭발 · 대재앙 · 줄도산 · 종말',
    barClass: 'bg-rose-500',
    textClass: 'text-rose-300',
  },
  {
    tier: '공포 · 과장 · 부호',
    multiplier: 2.0,
    widthPct: 67,
    keywords: '역대급 · 충격 · 경악 · 폭등/폭락 · !! · ?!',
    barClass: 'bg-rose-400',
    textClass: 'text-rose-200',
  },
  {
    tier: '모호한 출처 · 여론',
    multiplier: 1.5,
    widthPct: 50,
    keywords: '관계자 · 소식통 · 커뮤니티 중심 · ~로 알려졌다',
    barClass: 'bg-amber-400',
    textClass: 'text-amber-300',
  },
  {
    tier: '긴박 · 논란 수식어',
    multiplier: 1.3,
    widthPct: 43,
    keywords: '결국 · 벼랑 끝 · 적신호 · 심각 · 무력화',
    barClass: 'bg-rose-300/80',
    textClass: 'text-slate-200',
  },
];

const SENTENCE_STYLE: Record<
  SentenceStatus,
  { label: string; boxClass: string }
> = {
  fact: {
    label: '순수 팩트',
    boxClass: 'bg-sky-500/25 border-sky-400/70 text-sky-100',
  },
  framing: {
    label: '프레이밍 오염',
    boxClass: 'bg-rose-500/25 border-rose-400/70 text-rose-100',
  },
  mixed: {
    label: '팩트+프레이밍 혼재',
    boxClass: 'bg-amber-500/25 border-amber-400/70 text-amber-100',
  },
  neutral: {
    label: '일반 문맥',
    boxClass: 'bg-slate-800/80 border-slate-700 text-slate-300',
  },
};

const PIPELINE_STEPS = [
  {
    step: '01',
    title: '문장 분할',
    summary: '마침표 · 줄바꿈 기준',
    detail: '2.3% 소수점 보존',
    accentClass: 'text-sky-400',
  },
  {
    step: '02',
    title: '모호함 분리',
    summary: '익명 · 추측 어미 선점',
    detail: '복합명사 오탐 차단',
    accentClass: 'text-amber-400',
  },
  {
    step: '03',
    title: '감정어 확장',
    summary: '선동어 · !! · ?! 탐지',
    detail: '어절 단위 확장 태깅',
    accentClass: 'text-rose-400',
  },
  {
    step: '04',
    title: '뉴스 팩트 추출',
    summary: '수치 · 기관 · 보도 동사',
    detail: '광고 · 메타데이터 제외',
    accentClass: 'text-emerald-400',
  },
];

export function AlgorithmExplanationPanel({
  metrics,
  segments,
  focusedSentenceIndex,
  onJumpToSentence,
}: AlgorithmExplanationPanelProps) {
  const [activeTab, setActiveTab] = useState<ExplainTab>('formula');
  const { breakdown } = metrics;

  const topWeightedHits = useMemo(() => {
    return segments
      .filter((s) => s.type === 'emotion' || s.type === 'vague')
      .map((s) => ({
        id: s.id,
        text: s.text.trim(),
        type: s.type,
        weight: s.weight ?? (s.type === 'emotion' ? 2.0 : 1.5),
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);
  }, [segments]);

  const factorBars = [
    {
      label: '감정선동어 밀도',
      valueText: `+${breakdown.emotionScore}`,
      maxText: '/ 55',
      pct: Math.min(100, (breakdown.emotionScore / 55) * 100),
      barClass: 'bg-rose-500',
      valClass: 'text-rose-300',
    },
    {
      label: '모호한 출처 · 추측',
      valueText: `+${breakdown.vagueScore}`,
      maxText: '/ 30',
      pct: Math.min(100, (breakdown.vagueScore / 30) * 100),
      barClass: 'bg-amber-400',
      valClass: 'text-amber-300',
    },
    {
      label: `문장 오염도 (${breakdown.contaminatedSentences}/${breakdown.totalSentences}문장)`,
      valueText: `+${breakdown.sentenceScore}`,
      maxText: '/ 20',
      pct: Math.min(100, (breakdown.sentenceScore / 20) * 100),
      barClass: 'bg-violet-400',
      valClass: 'text-violet-300',
    },
    {
      label: '뉴스 팩트 상쇄',
      valueText: `-${breakdown.factRelief}`,
      maxText: '/ -15',
      pct: Math.min(100, (breakdown.factRelief / 15) * 100),
      barClass: 'bg-sky-400',
      valClass: 'text-sky-300',
    },
  ];

  const gaugeLeftPct = Math.max(2, Math.min(98, breakdown.aggroScore));

  return (
    <section
      aria-labelledby="algorithm-panel-title"
      className="bg-[#0F172A] border border-slate-800/90 rounded-lg overflow-hidden"
    >
      {/* Header + Visual Tabs */}
      <div className="px-5 py-3.5 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <BarChart3 className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
          <h2
            id="algorithm-panel-title"
            className="text-sm font-bold text-slate-100 tracking-tight"
          >
            분석 알고리즘 시각화 패널
          </h2>
          <span className="hidden sm:inline text-xs font-mono text-slate-400 tabular-nums">
            · 어그로 지수 {breakdown.aggroScore}점 ({metrics.gradeLabel})
          </span>
        </div>

        <div
          role="tablist"
          aria-label="알고리즘 시각화 탭"
          className="flex items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-md"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'formula'}
            onClick={() => setActiveTab('formula')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
              activeTab === 'formula'
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
            <span>점수 게이지</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'weights'}
            onClick={() => setActiveTab('weights')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
              activeTab === 'weights'
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
            <span>단어 가중치</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'structure'}
            onClick={() => setActiveTab('structure')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
              activeTab === 'structure'
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>문장 구조 맵</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Visual Score Gauge + Stacked Contribution Bars */}
      {activeTab === 'formula' && (
        <div className="p-5 space-y-5">
          {/* 0~100 Threshold Gauge */}
          <div className="bg-[#0B1120] border border-slate-800/90 rounded-md p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-200">
                어그로 판정 게이지 (0 ~ 100점)
              </span>
              <span className="font-mono font-bold text-white tabular-nums">
                현재 {breakdown.aggroScore}점 · {metrics.gradeLabel}
              </span>
            </div>

            {/* 3-Zone Bar + Current Needle */}
            <div className="relative pt-4 pb-1">
              <div
                style={{ left: `${gaugeLeftPct}%` }}
                className="absolute top-0 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              >
                <span className="font-mono text-[11px] font-bold text-white bg-slate-800 border border-slate-600 px-1.5 py-0.5 rounded tabular-nums leading-none">
                  {breakdown.aggroScore}
                </span>
              </div>

              <div className="h-3.5 w-full rounded-sm overflow-hidden flex border border-slate-800">
                <div
                  style={{ width: '25%' }}
                  className="bg-emerald-500/45 border-r border-slate-900"
                  title="0~24점: 팩트 위주"
                />
                <div
                  style={{ width: '30%' }}
                  className="bg-amber-500/45 border-r border-slate-900"
                  title="25~54점: 포장 주의"
                />
                <div
                  style={{ width: '45%' }}
                  className="bg-rose-500/50"
                  title="55~100점: 어그로 과다"
                />
              </div>

              <div
                style={{ left: `${gaugeLeftPct}%` }}
                className="absolute top-[22px] bottom-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] pointer-events-none"
              />
            </div>

            <div className="grid grid-cols-3 text-[11px] font-mono tabular-nums pt-0.5">
              <div className="text-emerald-300">0~24 ✅ 팩트 위주</div>
              <div className="text-amber-300 text-center">25~54 ⚠️ 포장 주의</div>
              <div className="text-rose-300 text-right">55~100 🚨 어그로 과다</div>
            </div>
          </div>

          {/* 4 Visual Progress Bars + Live Visual Equation */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4 items-stretch">
            <div className="bg-[#0B1120] border border-slate-800/90 rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">점수 구성 막대</span>
                <span className="text-[11px] text-slate-400">항목별 기여도</span>
              </div>

              <div className="space-y-3">
                {factorBars.map((bar) => (
                  <div key={bar.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">{bar.label}</span>
                      <span className="font-mono tabular-nums">
                        <span className={`font-bold ${bar.valClass}`}>
                          {bar.valueText}
                        </span>
                        <span className="text-slate-500 text-[11px]"> {bar.maxText}</span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-sm bg-slate-900 overflow-hidden">
                      <div
                        style={{ width: `${bar.pct}%` }}
                        className={`h-full rounded-sm transition-all duration-300 ${bar.barClass}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual Block Equation */}
            <div className="bg-[#0B1120] border border-slate-800/90 rounded-md p-4 flex flex-col justify-between gap-3">
              <span className="text-xs font-semibold text-slate-200">
                실시간 점수 계산식
              </span>

              <div className="grid grid-cols-4 gap-2 text-center font-mono tabular-nums">
                <div className="py-2.5 px-1.5 rounded bg-rose-500/10 border border-rose-500/30">
                  <div className="text-[10px] text-rose-300">감정</div>
                  <div className="text-sm font-bold text-rose-200">
                    +{breakdown.emotionScore}
                  </div>
                </div>
                <div className="py-2.5 px-1.5 rounded bg-amber-500/10 border border-amber-500/30">
                  <div className="text-[10px] text-amber-300">모호</div>
                  <div className="text-sm font-bold text-amber-200">
                    +{breakdown.vagueScore}
                  </div>
                </div>
                <div className="py-2.5 px-1.5 rounded bg-violet-500/10 border border-violet-500/30">
                  <div className="text-[10px] text-violet-300">문장</div>
                  <div className="text-sm font-bold text-violet-200">
                    +{breakdown.sentenceScore}
                  </div>
                </div>
                <div className="py-2.5 px-1.5 rounded bg-sky-500/10 border border-sky-500/30">
                  <div className="text-[10px] text-sky-300">팩트</div>
                  <div className="text-sm font-bold text-sky-200">
                    -{breakdown.factRelief}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">선동어 0건이면 수치 적어도 0점</span>
                <span className="font-mono font-bold text-base text-white tabular-nums">
                  = {breakdown.aggroScore}점
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Visual Word Weights & 500-char Density */}
      {activeTab === 'weights' && (
        <div className="p-5 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 items-stretch">
          {/* Multiplier Bars */}
          <div className="bg-[#0B1120] border border-slate-800/90 rounded-md p-4 space-y-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">표현 위험도별 가중치</span>
              <span className="font-mono text-slate-400 tabular-nums">
                ×1.2 ~ ×3.0 배수
              </span>
            </div>

            <div className="space-y-3">
              {WEIGHT_TIERS.map((item) => (
                <div key={item.tier} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={`font-semibold ${item.textClass}`}>
                      {item.tier}
                    </span>
                    <span className="font-mono font-bold text-slate-100 tabular-nums">
                      ×{item.multiplier.toFixed(1)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-sm bg-slate-900 overflow-hidden">
                    <div
                      style={{ width: `${item.widthPct}%` }}
                      className={`h-full rounded-sm ${item.barClass}`}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {item.keywords}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 500-Char Frequency + Top Hits */}
          <div className="bg-[#0B1120] border border-slate-800/90 rounded-md p-4 flex flex-col justify-between gap-4">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded bg-slate-900/70 border border-slate-800">
                <div className="text-[11px] text-slate-400">500자당 감정 빈도</div>
                <div className="mt-1 font-mono text-lg font-bold text-rose-300 tabular-nums">
                  {breakdown.emotionDensityPer500}
                </div>
              </div>
              <div className="p-3 rounded bg-slate-900/70 border border-slate-800">
                <div className="text-[11px] text-slate-400">500자당 모호 빈도</div>
                <div className="mt-1 font-mono text-lg font-bold text-amber-300 tabular-nums">
                  {breakdown.vagueDensityPer500}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">적발 TOP 5 가중 표현</span>
                <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                  합계 {(breakdown.emotionWeightedSum + breakdown.vagueWeightedSum).toFixed(1)}점
                </span>
              </div>

              {topWeightedHits.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  탐지된 가중 표현 없음
                </div>
              ) : (
                <div className="space-y-2">
                  {topWeightedHits.map((hit) => (
                    <div key={hit.id} className="flex items-center gap-2.5 text-xs">
                      <span className="w-28 truncate text-slate-200 font-medium shrink-0">
                        {hit.text}
                      </span>
                      <div className="flex-1 h-2 rounded-sm bg-slate-900 overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, (hit.weight / 3) * 100)}%` }}
                          className={`h-full rounded-sm ${
                            hit.type === 'emotion' ? 'bg-rose-500' : 'bg-amber-400'
                          }`}
                        />
                      </div>
                      <span
                        className={`font-mono font-bold tabular-nums w-9 text-right shrink-0 ${
                          hit.type === 'emotion' ? 'text-rose-300' : 'text-amber-300'
                        }`}
                      >
                        +{hit.weight.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Visual Sentence Map + Compact 4-Step Flow */}
      {activeTab === 'structure' && (
        <div className="p-5 space-y-4">
          {/* Sentence Mini-Map */}
          <div className="bg-[#0B1120] border border-slate-800/90 rounded-md p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-200">
                  문장별 판별 맵 ({breakdown.totalSentences}문장)
                </span>
                <span className="text-[11px] text-sky-400">
                  · 클릭하면 원문 문장으로 이동
                </span>
              </div>
              <span className="font-mono text-slate-300 tabular-nums">
                오염 {breakdown.contaminatedSentences} · 팩트 {breakdown.factSentences} · 오염률 {breakdown.contaminatedSentenceRatio}%
              </span>
            </div>

            {breakdown.sentenceStatuses.length === 0 ? (
              <p className="text-xs text-slate-500">분석할 문장이 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {breakdown.sentenceStatuses.map((status, idx) => {
                  const style = SENTENCE_STYLE[status];
                  const isFocused = focusedSentenceIndex === idx;
                  return (
                    <button
                      key={`${status}-${idx}`}
                      type="button"
                      onClick={() => onJumpToSentence(idx)}
                      title={`S${idx + 1}: ${style.label} (클릭하여 원문 이동)`}
                      className={`h-8 min-w-[42px] px-2 rounded border flex items-center justify-center font-mono text-[11px] font-semibold tabular-nums transition-transform hover:scale-105 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                        style.boxClass
                      } ${isFocused ? 'ring-2 ring-white/90' : ''}`}
                    >
                      S{idx + 1}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-500/50 border border-sky-400/70" />
                순수 팩트
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/50 border border-rose-400/70" />
                프레이밍 오염
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500/50 border border-amber-400/70" />
                팩트+프레이밍 혼재
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-800 border border-slate-700" />
                일반 문맥
              </span>
            </div>
          </div>

          {/* 4-Step Visual Flow */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {PIPELINE_STEPS.map((item, idx) => (
              <div
                key={item.step}
                className="bg-[#0B1120] border border-slate-800/90 rounded-md p-3.5 flex items-center justify-between gap-2"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono text-xs font-bold ${item.accentClass}`}>
                      {item.step}
                    </span>
                    <span className="text-xs font-bold text-slate-100 truncate">
                      {item.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 truncate">{item.summary}</p>
                  <p className="text-[11px] text-slate-500 truncate">{item.detail}</p>
                </div>
                {idx < PIPELINE_STEPS.length - 1 && (
                  <ArrowRight
                    className="hidden lg:block w-3.5 h-3.5 text-slate-600 shrink-0"
                    aria-hidden="true"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
