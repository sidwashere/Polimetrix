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

export interface ProfileChange {
  field: string;
  oldValue: string;
  newValue: string;
  detectedAt: string;
  sourceUrl?: string;
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
  coalition?: string;
  region?: string;
  profileChanges?: ProfileChange[];
  endorsements?: string[];
  lastProfileUpdate?: string;
}

export type SentimentType = 'positive' | 'negative' | 'neutral';

export type ProviderType = 'gemini' | 'ollama' | 'huggingface' | 'openrouter';

export interface AIProviderConfig {
  provider: ProviderType;
  ollamaUrl: string;
  ollamaModel: string;
  huggingfaceApiKey: string;
  openrouterApiKey: string;
  geminiApiKey: string;
}

export interface Source {
  id: string;
  name: string;
  type: 'social' | 'news' | 'blog' | 'tv';
  weight: number;
  active: boolean;
}

export interface DiscoveredSource {
  domain: string;
  name: string;
  type: 'social' | 'news' | 'blog' | 'tv';
  weight: number;
  firstSeen: string;
  lastSeen: string;
  seenCount: number;
  accepted: boolean;
  rejected: boolean;
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
  url?: string;
}

export interface CandidateContext {
  politicianId: string;
  narrative: string;
  summary: string;
  keyEvents: string[];
  strengths: string[];
  weaknesses: string[];
  controversies: string[];
  allies: string[];
  rivals: string[];
  lastGenerated: string;
}

export interface SimulationConfig {
  scanInterval: number;
  isPaused: boolean;
  useAI: boolean;
  autoRefreshCandidates: boolean;
  historyWindowDays: number;
  aiProviderConfig: AIProviderConfig;
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

export interface AdvancedMetrics {
  volatility: number;
  momentum: number;
  mediaFrequency: number;
  sentimentRatio: number;
  influenceScore: number;
  audienceReach: number;
  trendStrength: number;
  consistencyScore: number;
  prediction: {
    nextWeek: number;
    confidence: number;
    trend: 'rising' | 'falling' | 'stable';
  };
  movingAverages: {
    sma7: number;
    sma14: number;
    sma30: number;
    ema12: number;
  };
  sentimentBreakdown: SentimentBreakdown;
  coalitionScore: number;
  endorsementScore: number;
  controversyPenalty: number;
  regionalDiversity: number;
  messageConsistency: number;
  overallPerformanceScore: number;
}