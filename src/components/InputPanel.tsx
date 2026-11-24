import { Edit3, Eraser, FileText, Link2, Loader2, ScanSearch } from 'lucide-react';
import { FormEvent, useMemo, useRef, useState } from 'react';
import { SAMPLE_CASES } from '../data/samples';
import {
  extractNewsFromUrl,
  isLikelyStandaloneUrl,
} from '../services/newsExtractor';
import { ExtractedArticleMeta, SampleCase } from '../types/framing';

interface InputPanelProps {
  rawText: string;
  activeSampleId: SampleCase['id'] | null;
  extractedMeta: ExtractedArticleMeta | null;
  isCollapsed: boolean;
  onExpand: () => void;
  onChangeText: (text: string) => void;
  onArticleExtracted: (payload: {
    title: string;
    content: string;
    url: string;
  }) => void;
  onSelectSample: (sample: SampleCase) => void;
  onClear: () => void;
  onAnalyze: () => void;
}

export function InputPanel({
  rawText,
  activeSampleId,
  extractedMeta,
  isCollapsed,
  onExpand,
  onChangeText,
  onArticleExtracted,
  onSelectSample,
  onClear,
  onAnalyze,
}: InputPanelProps) {
  const [urlInput, setUrlInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const charCount = rawText.length;
  const detectedTextareaUrl = useMemo(
    () => isLikelyStandaloneUrl(rawText),
    [rawText]
  );

  const activeSample = useMemo(
    () => SAMPLE_CASES.find((s) => s.id === activeSampleId) || null,
    [activeSampleId]
  );

  const runExtraction = async (targetUrl: string) => {
    const trimmed = targetUrl.trim();
    if (!trimmed || isExtracting) return;

    setExtractError(null);
    setIsExtracting(true);
    setUrlInput(trimmed);

    try {
      const result = await extractNewsFromUrl(trimmed);
      onArticleExtracted(result);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : '보안 정책으로 자동 추출이 제한된 기사입니다. 아래 입력창에 본문을 직접 복사해 붙여넣어 주세요.';
      setExtractError(message);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleUrlSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runExtraction(urlInput);
  };

  const handleSelectSampleClick = (sample: SampleCase) => {
    setExtractError(null);
    setUrlInput('');
    onSelectSample(sample);
  };

  const handleClearClick = () => {
    setExtractError(null);
    setUrlInput('');
    onClear();
  };

  if (isCollapsed) {
    const sourceSummary =
      extractedMeta?.title ||
      activeSample?.title ||
      rawText.replace(/\s+/g, ' ').trim().slice(0, 60) ||
      '분석된 원문';

    return (
      <section
        aria-label="입력 원문 요약 바"
        className="bg-[#0F172A] border border-slate-800/90 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-xs font-semibold text-sky-400 whitespace-nowrap shrink-0">
            분석 대상
          </span>
          <p className="text-xs font-medium text-slate-200 truncate">
            {sourceSummary}
          </p>
          <span className="text-xs font-mono text-slate-400 tabular-nums whitespace-nowrap shrink-0">
            {charCount.toLocaleString()}자
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1 bg-[#0B1120] border border-slate-800 rounded-md p-0.5">
            {SAMPLE_CASES.map((sample, idx) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleSelectSampleClick(sample)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                  activeSampleId === sample.id
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {idx + 1}. {sample.shortLabel}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onExpand}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-100 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Edit3 className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
            <span>다시 입력하기</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="input-panel-title"
      className="flex flex-col bg-[#0F172A] border border-slate-800/90 rounded-lg overflow-hidden"
    >
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-slate-800/90 flex items-center justify-between gap-3">
        <h2
          id="input-panel-title"
          className="text-sm font-semibold text-slate-100 tracking-tight whitespace-nowrap"
        >
          01. 원문 입력 &amp; 실전 샘플
        </h2>
        <span className="text-xs font-mono text-slate-400 tabular-nums whitespace-nowrap">
          {charCount.toLocaleString()}자
        </span>
      </div>

      {/* 3 Quick Demo Sample Presets */}
      <div className="px-4 py-2.5 border-b border-slate-800/80 space-y-2 bg-[#0D1425]">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>실전 검증 샘플 (클릭 즉시 해부)</span>
          <span>3종</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {SAMPLE_CASES.map((sample, index) => {
            const isSelected = activeSampleId === sample.id;
            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleSelectSampleClick(sample)}
                className={`w-full text-left px-3 py-2 rounded-md border text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                  isSelected
                    ? 'bg-slate-800/90 border-sky-500/60 text-slate-100'
                    : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-100 truncate">
                    {index + 1}. {sample.shortLabel}
                  </span>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                    {sample.mediaFormat}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Unified Input Workspace: URL Extractor + Expanded Vertical Text Editor */}
      <div className="flex flex-col p-5 gap-4">
        {/* 1. URL Extraction Bar */}
        <form onSubmit={handleUrlSubmit} className="space-y-1.5">
          <label
            htmlFor="news-url-input"
            className="flex items-center gap-1.5 text-xs font-medium text-slate-300"
          >
            <Link2 className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
            <span>뉴스 링크(URL)로 불러오기</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="news-url-input"
              type="url"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                if (extractError) setExtractError(null);
              }}
              placeholder="https://news.example.com/article/..."
              className="flex-1 min-w-0 px-3 py-2.5 rounded-md bg-[#0B1120] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/70 focus:ring-1 focus:ring-sky-500/40"
            />
            <button
              type="submit"
              disabled={isExtracting || urlInput.trim().length === 0}
              className="px-4 py-2.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 border border-slate-700 text-xs font-semibold text-slate-100 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>추출 중</span>
                </>
              ) : (
                <span>본문 추출</span>
              )}
            </button>
          </div>
        </form>

        {/* Extraction Error / Guidance Message */}
        {extractError && (
          <div
            role="alert"
            className="px-3.5 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/35 text-xs text-amber-200 leading-relaxed"
          >
            {extractError}
          </div>
        )}

        {/* Extracted Meta Preview Strip */}
        {extractedMeta && !extractError && (
          <div className="px-3.5 py-2 rounded-md bg-sky-500/8 border border-sky-500/30 text-xs space-y-0.5">
            <p className="font-medium text-sky-200 truncate">
              추출 완료: {extractedMeta.title}
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              {extractedMeta.url}
            </p>
          </div>
        )}

        {/* 2. Direct Paste Text Editor (Increased Vertical Height) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="raw-article-input"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-300"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <span>기사 본문 직접 복붙 · 확인</span>
            </label>
            {rawText.length > 0 && (
              <button
                type="button"
                onClick={handleClearClick}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded px-1.5 py-0.5"
              >
                <Eraser className="w-3 h-3" aria-hidden="true" />
                <span>비우기</span>
              </button>
            )}
          </div>

          {detectedTextareaUrl && (
            <div className="px-3 py-2 rounded-md bg-sky-500/12 border border-sky-400/45 flex items-center justify-between gap-2">
              <span className="text-xs text-sky-200 truncate">
                링크 주소가 입력되었습니다. 본문을 자동으로 가져올까요?
              </span>
              <button
                type="button"
                disabled={isExtracting}
                onClick={() => void runExtraction(detectedTextareaUrl)}
                className="px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                {isExtracting ? '추출 중...' : '링크에서 본문 추출하기'}
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 items-stretch">
            <textarea
              ref={textareaRef}
              id="raw-article-input"
              value={rawText}
              onChange={(e) => onChangeText(e.target.value)}
              placeholder="추출된 기사 본문이 여기에 채워집니다. 직접 뉴스 본문, 유튜브 쇼츠 대본, 커뮤니티 글을 붙여넣을 수도 있습니다..."
              className="flex-1 w-full min-h-[210px] max-h-[340px] resize-y rounded-md bg-[#0B1120] border border-slate-800 p-4 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/70 focus:ring-1 focus:ring-sky-500/40"
            />
            <button
              type="button"
              onClick={onAnalyze}
              disabled={isExtracting || rawText.trim().length === 0}
              className="sm:w-48 py-3 px-4 rounded-md bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              <ScanSearch className="w-4 h-4" aria-hidden="true" />
              <span>X-레이 해부 시작</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
