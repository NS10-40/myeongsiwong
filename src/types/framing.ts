export type SegmentType = 'emotion' | 'vague' | 'fact' | 'neutral';

export interface TextSegment {
  id: string;
  text: string;
  type: SegmentType;
  reason?: string;
  weight?: number;
}

export interface HeadlineBattle {
  sensational: string;
  dryFact: string;
  counterAngle: string;
}

export interface BlindSpot {
  id: string;
  title: string;
  oneLineWarning: string;
}

export interface FramingAnalysis {
  segments: TextSegment[];
  emotionKeywords: string[];
  vagueKeywords: string[];
  headlineBattle: HeadlineBattle;
  blindSpots: BlindSpot[];
  engineLabel: string;
}

export interface SampleCase {
  id: 'economy' | 'tech' | 'society';
  category: string;
  shortLabel: string;
  title: string;
  mediaFormat: string;
  text: string;
}

export type SentenceStatus = 'fact' | 'framing' | 'mixed' | 'neutral';

export interface AlgorithmBreakdown {
  aggroScore: number;
  emotionScore: number;
  vagueScore: number;
  sentenceScore: number;
  factRelief: number;
  emotionWeightedSum: number;
  vagueWeightedSum: number;
  emotionDensityPer500: number;
  vagueDensityPer500: number;
  totalSentences: number;
  contaminatedSentences: number;
  factSentences: number;
  contaminatedSentenceRatio: number;
  sentenceStatuses: SentenceStatus[];
}

export interface AnalysisMetrics {
  totalChars: number;
  factChars: number;
  emotionChars: number;
  vagueChars: number;
  neutralChars: number;
  factPercent: number;
  packagingPercent: number;
  emotionCount: number;
  vagueCount: number;
  factCount: number;
  grade: 'aggro' | 'caution' | 'factual';
  gradeLabel: string;
  breakdown: AlgorithmBreakdown;
}

export interface ExtractedArticleMeta {
  title: string;
  url: string;
}
