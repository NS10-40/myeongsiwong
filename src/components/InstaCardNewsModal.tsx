import {
  ChevronLeft,
  ChevronRight,
  Download,
  Images,
  Palette,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AnalysisMetrics,
  BlindSpot,
  ExtractedArticleMeta,
  HeadlineBattle,
  TextSegment,
} from '../types/framing';
import {
  buildInstaCardSlides,
  CARD_NEWS_THEMES,
  CardNewsThemeId,
  downloadCanvasPng,
  renderInstaCardSlide,
} from '../utils/instaCardNewsRenderer';

interface InstaCardNewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  articleMeta: ExtractedArticleMeta | null;
  metrics: AnalysisMetrics;
  topFacts: TextSegment[];
  blindSpots: BlindSpot[];
  headlineBattle: HeadlineBattle;
}

const THEME_OPTIONS: Array<{ id: CardNewsThemeId; label: string; swatchClass: string }> = [
  { id: 'editorial-light', label: '크림 에디토리얼', swatchClass: 'bg-[#F6F4EE] border-[#D6D3C9]' },
  { id: 'dark-magazine', label: '다크 매거진', swatchClass: 'bg-[#0B1120] border-sky-400/60' },
  { id: 'bold-contrast', label: '임팩트 블랙', swatchClass: 'bg-[#09090B] border-yellow-400/70' },
];

export function InstaCardNewsModal({
  isOpen,
  onClose,
  articleMeta,
  metrics,
  topFacts,
  blindSpots,
  headlineBattle,
}: InstaCardNewsModalProps) {
  const defaultTitle =
    articleMeta?.title?.trim() ||
    headlineBattle.dryFact ||
    '감정과 과장을 덜어낸 오늘의 팩트';

  const [themeId, setThemeId] = useState<CardNewsThemeId>('editorial-light');
  const [coverTitle, setCoverTitle] = useState(defaultTitle);
  const [slideIdx, setSlideIdx] = useState(0);
  const [isExportingAll, setIsExportingAll] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCoverTitle(defaultTitle);
      setSlideIdx(0);
    }
  }, [isOpen, defaultTitle]);

  const slides = useMemo(
    () =>
      buildInstaCardSlides({
        articleMeta,
        metrics,
        topFacts,
        blindSpots,
        headlineBattle,
        customCoverTitle: coverTitle,
      }),
    [articleMeta, metrics, topFacts, blindSpots, headlineBattle, coverTitle]
  );

  const safeIdx = Math.min(slideIdx, Math.max(0, slides.length - 1));
  const activeSlide = slides[safeIdx];

  useEffect(() => {
    if (!isOpen || !canvasRef.current || !activeSlide) return;
    renderInstaCardSlide(canvasRef.current, activeSlide, slides.length, themeId);
  }, [isOpen, activeSlide, slides.length, themeId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        setSlideIdx((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setSlideIdx((prev) => Math.min(slides.length - 1, prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, slides.length]);

  if (!isOpen) return null;

  const handleDownloadCurrent = () => {
    if (!canvasRef.current) return;
    downloadCanvasPng(canvasRef.current, `framing-xray-card-${safeIdx + 1}.png`);
  };

  const handleDownloadAll = () => {
    if (isExportingAll) return;
    setIsExportingAll(true);
    const offscreen = document.createElement('canvas');

    slides.forEach((slide, idx) => {
      window.setTimeout(() => {
        renderInstaCardSlide(offscreen, slide, slides.length, themeId);
        downloadCanvasPng(offscreen, `framing-xray-card-${idx + 1}.png`);
        if (idx === slides.length - 1) {
          setIsExportingAll(false);
        }
      }, idx * 240);
    });
  };

  const slideLabels = slides.map((s) => {
    if (s.kind === 'cover') return '1. 표지';
    if (s.kind === 'fact') return `${s.slideNumber}. 팩트 0${s.factOrder}`;
    return `${s.slideNumber}. 결론`;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="insta-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl bg-[#0F172A] border border-slate-700/80 rounded-xl overflow-hidden shadow-2xl my-auto"
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Images className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
            <h2
              id="insta-modal-title"
              className="text-sm font-bold text-slate-100 truncate"
            >
              인스타 카드뉴스 스튜디오
            </h2>
            <span className="hidden sm:inline text-xs font-mono text-slate-400 tabular-nums">
              · 1080×1350 (4:5) · {slides.length}장 세트
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="카드뉴스 창 닫기"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body: Preview Left + Controls Right */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-[1fr_290px] gap-6 items-start">
          {/* Left: 4:5 Instagram Carousel Preview */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-full max-w-[360px] aspect-[4/5] rounded-lg overflow-hidden border border-slate-700/80 bg-[#0B1120]">
              <canvas
                ref={canvasRef}
                className="w-full h-full block"
              />

              <button
                type="button"
                aria-label="이전 카드"
                disabled={safeIdx === 0}
                onClick={() => setSlideIdx((prev) => Math.max(0, prev - 1))}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/55 hover:bg-black/80 disabled:opacity-25 text-white flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                aria-label="다음 카드"
                disabled={safeIdx === slides.length - 1}
                onClick={() => setSlideIdx((prev) => Math.min(slides.length - 1, prev + 1))}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/55 hover:bg-black/80 disabled:opacity-25 text-white flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Slide Selector Strip */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {slideLabels.map((label, idx) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSlideIdx(idx)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-colors whitespace-nowrap ${
                    safeIdx === idx
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Theme + Cover Title + Export Actions */}
          <div className="space-y-5">
            {/* Theme Picker */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Palette className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                <span>카드뉴스 디자인 테마</span>
              </div>
              <div className="space-y-1.5">
                {THEME_OPTIONS.map((opt) => {
                  const selected = themeId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setThemeId(opt.id)}
                      className={`w-full px-3 py-2 rounded-md border text-xs font-medium flex items-center justify-between transition-colors ${
                        selected
                          ? 'bg-slate-800 border-sky-400 text-white'
                          : 'bg-[#0B1120] border-slate-800 text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={`w-4 h-4 rounded-xs border ${opt.swatchClass}`}
                        />
                        <span>{opt.label}</span>
                      </span>
                      {selected && (
                        <span className="font-mono text-[10px] text-sky-400">
                          선택됨
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cover Title Editor */}
            <div className="space-y-1.5">
              <label
                htmlFor="insta-cover-title"
                className="block text-xs font-semibold text-slate-200"
              >
                표지 헤드라인 (1번 카드)
              </label>
              <input
                id="insta-cover-title"
                type="text"
                value={coverTitle}
                onChange={(e) => {
                  setCoverTitle(e.target.value);
                  setSlideIdx(0);
                }}
                placeholder="인스타 표지에 들어갈 제목 입력..."
                className="w-full px-3 py-2 rounded-md bg-[#0B1120] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Download Controls */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <button
                type="button"
                onClick={handleDownloadCurrent}
                className="w-full py-2.5 px-4 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-100 inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                <span>현재 {safeIdx + 1}번 카드만 저장</span>
              </button>

              <button
                type="button"
                disabled={isExportingAll}
                onClick={handleDownloadAll}
                className="w-full py-2.5 px-4 rounded-md bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                <Images className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {isExportingAll
                    ? '카드 저장 중...'
                    : `전체 ${slides.length}장 세트 저장 (PNG)`}
                </span>
              </button>
              <p className="text-[11px] text-slate-400 text-center">
                {CARD_NEWS_THEMES[themeId].label} · 1080×1350px 고화질
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
