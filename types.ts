export interface HistoryItem {
  time: string;
  score: number;
  reason?: string;
  sourceUrl?: string;
  sentiment?: SentimentType;
}

export interface PoliticianMetrics {
  volatility: number;
  momentum: number;
  mediaFrequency: number;
  lastUpdated?: string;
}

export interface Politician {
  id: string;
  name: string;
  role: string;
  party: string;
  score: number;
  trend: number;
  color: string;
  image: string;
  history: HistoryItem[];
  isCustom?: boolean;
  bio?: string;
  slogan?: string;
  metrics?: PoliticianMetrics;
}

export type SentimentType = 'positive' | 'negative' | 'neutral';

export interface Source {
  id: string;
  name: string;
  type: 'social' | 'news' | 'blog' | 'tv';
  weight: number; // Multiplier for impact
  active: boolean;
}

export interface NewsEvent {
  id: number;
  politicianId: string;
  sourceId: string;
  sourceName: string;
  headline: string;
  sentiment: SentimentType;
  impact: number;
  timestamp: string;
  url?: string; // Link to real news source
}

export interface SimulationConfig {
  scanInterval: number;
  isPaused: boolean;
  useAI: boolean;
  autoRefreshCandidates: boolean;
  historyWindowDays: number;
}

export interface AdvancedPrediction {
  nextWeek: number;
  confidence: number;
  trend: 'rising' | 'falling' | 'stable';
}

export interface MovingAverages {
  sma7: number;
  sma14: number;
  sma30: number;
  ema12: number;
}

export interface SentimentBreakdown {
  positive: number;
  negative: number;
  neutral: number;
}