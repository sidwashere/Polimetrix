export interface HistoryItem {
  time: string;
  score: number;
  reason?: string; // Short context why the score changed (e.g. "Finance Bill Protests")
  sourceUrl?: string; // Link to the source verifying this event
}

export interface Politician {
  id: string;
  name: string;
  role: string;
  party: string;
  score: number;
  trend: number; // The difference from the last update
  color: string;
  image: string;
  history: HistoryItem[];
  isCustom?: boolean;
  bio?: string;
  slogan?: string;
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
  scanInterval: number; // ms
  isPaused: boolean;
  useAI: boolean; // Whether to use Gemini or mock generator
  autoRefreshCandidates: boolean; // Automatically refresh candidate stats every 30m
}