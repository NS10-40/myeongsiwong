/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { ImpactDashboard } from './components/ImpactDashboard';
import { InputPanel } from './components/InputPanel';
import { LayerFilter, TopBar } from './components/TopBar';
import { findMatchingSample, SAMPLE_CASES } from './data/samples';
import {
  analyzeKoreanFraming,
  computeMetrics,
  reclassifySegment,
} from './services/koreanFramingEngine';
import { sanitizePublicHttpUrl } from './services/newsExtractor';
import {
  ExtractedArticleMeta,
  FramingAnalysis,
  SampleCase,
  SegmentType,
} from './types/framing';

const INITIAL_SAMPLE = SAMPLE_CASES[0];

export default function App() {
  const [rawText, setRawText] = useState<string>(INITIAL_SAMPLE.text);
  const [activeSampleId, setActiveSampleId] = useState<SampleCase['id'] | null>(
    INITIAL_SAMPLE.id
  );
  const [extractedMeta, setExtractedMeta] =
    useState<ExtractedArticleMeta | null>(null);
  const [analyzedArticleMeta, setAnalyzedArticleMeta] =
    useState<ExtractedArticleMeta | null>(null);

  const [analysis, setAnalysis] = useState<FramingAnalysis | null>(() =>
    analyzeKoreanFraming(INITIAL_SAMPLE.text)
  );
  const [isInputCollapsed, setIsInputCollapsed] = useState<boolean>(false);
  const [activeLayer, setActiveLayer] = useState<LayerFilter>('all');

  const metrics = useMemo(() => {
    if (!analysis) return null;
    return computeMetrics(analysis.segments);
  }, [analysis]);

  const handleSelectSample = (sample: SampleCase) => {
    setRawText(sample.text);
    setActiveSampleId(sample.id);
    setExtractedMeta(null);
    setAnalyzedArticleMeta(null);
    setAnalysis(analyzeKoreanFraming(sample.text));
  };

  const handleArticleExtracted = (payload: {
    title: string;
    content: string;
    url: string;
  }) => {
    const safeUrl = sanitizePublicHttpUrl(payload.url);
    const meta = safeUrl ? { title: payload.title, url: safeUrl } : null;
    setRawText(payload.content);
    setActiveSampleId(null);
    setExtractedMeta(meta);
    setAnalyzedArticleMeta(meta);
    setAnalysis(analyzeKoreanFraming(payload.content));
  };

  const handleChangeText = (nextText: string) => {
    setRawText(nextText);
    const matched = findMatchingSample(nextText);
    setActiveSampleId(matched ? matched.id : null);
    if (matched || !nextText.trim()) {
      setExtractedMeta(null);
    }
  };

  const handleClear = () => {
    setRawText('');
    setActiveSampleId(null);
    setExtractedMeta(null);
    setAnalyzedArticleMeta(null);
    setAnalysis(null);
  };

  const handleAnalyze = () => {
    if (!rawText.trim()) return;
    setAnalyzedArticleMeta(extractedMeta);
    setAnalysis(analyzeKoreanFraming(rawText));
    setIsInputCollapsed(true);
  };

  const handleReclassifySegment = (segmentId: string, nextType: SegmentType) => {
    setAnalysis((prev) => (prev ? reclassifySegment(prev, segmentId, nextType) : prev));
  };

  const handleResetToSample = () => {
    handleSelectSample(INITIAL_SAMPLE);
    setIsInputCollapsed(false);
    setActiveLayer('all');
  };

  return (
    <div
      id="top"
      className="min-h-screen flex flex-col bg-[#0B1120] text-slate-100"
    >
      <TopBar
        activeLayer={activeLayer}
        onChangeLayer={setActiveLayer}
        onResetToSample={handleResetToSample}
      />

      <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 lg:p-6 flex flex-col gap-5">
        <div className="w-full">
          <InputPanel
            rawText={rawText}
            activeSampleId={activeSampleId}
            extractedMeta={extractedMeta}
            isCollapsed={isInputCollapsed}
            onExpand={() => setIsInputCollapsed(false)}
            onChangeText={handleChangeText}
            onArticleExtracted={handleArticleExtracted}
            onSelectSample={handleSelectSample}
            onClear={handleClear}
            onAnalyze={handleAnalyze}
          />
        </div>

        <div className="w-full">
          <ImpactDashboard
            analysis={analysis}
            metrics={metrics}
            articleMeta={analyzedArticleMeta}
            activeLayer={activeLayer}
            onChangeLayer={setActiveLayer}
            onReclassifySegment={handleReclassifySegment}
          />
        </div>
      </main>
    </div>
  );
}
