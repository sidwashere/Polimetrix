import { Politician, NewsEvent, Source, HistoryItem, SentimentType } from '../types';

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
  sentimentBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
  };
}

export interface AnalyticsSummary {
  totalEvents: number;
  avgSentiment: number;
  mostInfluentialSource: string;
  topMover: { name: string; change: number };
  mediaShare: { source: string; count: number }[];
}

export const calculateVolatility = (history: HistoryItem[]): number => {
  if (history.length < 2) return 0;
  const scores = history.filter(h => h.time).map(h => h.score);
  if (scores.length < 2) return 0;
  
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  return Math.sqrt(variance);
};

export const calculateMomentum = (history: HistoryItem[]): number => {
  if (history.length < 7) return 0;
  
  const validHistory = history.filter(h => h.time);
  if (validHistory.length < 14) return 0;
  
  const recent7 = validHistory.slice(-7);
  const prev7 = validHistory.slice(-14, -7);
  
  const recentAvg = recent7.reduce((a, b) => a + b.score, 0) / recent7.length;
  const prevAvg = prev7.reduce((a, b) => a + b.score, 0) / prev7.length;
  
  return parseFloat((recentAvg - prevAvg).toFixed(2));
};

export const calculateMediaFrequency = (feed: NewsEvent[], politicianId: string): number => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return feed.filter(event => {
    const eventDate = new Date(event.timestamp);
    return event.politicianId === politicianId && eventDate >= thirtyDaysAgo;
  }).length;
};

export const calculateSentimentRatio = (history: HistoryItem[]): number => {
  if (history.length === 0) return 0;
  
  const positive = history.filter(h => h.sentiment === 'positive').length;
  const negative = history.filter(h => h.sentiment === 'negative').length;
  const total = positive + negative;
  
  if (total === 0) return 0;
  return parseFloat(((positive - negative) / total).toFixed(3));
};

export const calculateInfluenceScore = (
  history: HistoryItem[],
  sources: Source[],
  feed: NewsEvent[]
): number => {
  const scoreComponent = history.length > 0 ? history[history.length - 1].score : 100;
  
  const sourceWeights = sources.filter(s => s.active).reduce((sum, s) => sum + s.weight, 0);
  const avgWeight = sources.length > 0 ? sourceWeights / sources.length : 1;
  
  const recentEvents = feed.slice(0, 20);
  const eventCount = recentEvents.length;
  
  const influence = (scoreComponent / 100) * 0.5 + (avgWeight / 3) * 0.3 + (Math.min(eventCount, 20) / 20) * 0.2;
  return parseFloat((influence * 100).toFixed(2));
};

export const calculateAudienceReach = (feed: NewsEvent[], politicianId: string): number => {
  const politicianEvents = feed.filter(e => e.politicianId === politicianId);
  return politicianEvents.reduce((sum, e) => sum + (e.impact * 1000), 0);
};

export const calculateTrendStrength = (history: HistoryItem[]): number => {
  if (history.length < 7) return 0;
  
  const scores = history.slice(-14).map(h => h.score);
  if (scores.length < 7) return 0;
  
  const n = scores.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += scores[i];
    sumXY += i * scores[i];
    sumX2 += i * i;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const rSquared = Math.pow((n * sumXY - sumX * sumY) / 
    Math.sqrt((n * sumX2 - sumX * sumX) * (n * reduceSum(scores.map(s => Math.pow(s - sumY/n, 2))) - sumY*sumY)), 2) || 0;
  
  return parseFloat(Math.abs(slope * rSquared).toFixed(3));
};

const reduceSum = (arr: number[]): number => arr.reduce((a, b) => a + b, 0);

export const calculateConsistencyScore = (history: HistoryItem[]): number => {
  if (history.length < 5) return 0;
  
  const scores = history.map(h => h.score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  
  const coefficientOfVariation = stdDev / mean;
  const consistency = Math.max(0, 100 - (coefficientOfVariation * 100));
  
  return parseFloat(consistency.toFixed(2));
};

export const calculateSMA = (history: HistoryItem[], period: number): number => {
  const scores = history.map(h => h.score).slice(-period);
  if (scores.length < period) return history.length > 0 ? history[history.length - 1].score : 100;
  return parseFloat((scores.reduce((a, b) => a + b, 0) / period).toFixed(2));
};

export const calculateEMA = (history: HistoryItem[], period: number): number => {
  const scores = history.map(h => h.score);
  if (scores.length === 0) return 100;
  
  const multiplier = 2 / (period + 1);
  let ema = scores[0];
  
  for (let i = 1; i < scores.length; i++) {
    ema = (scores[i] - ema) * multiplier + ema;
  }
  
  return parseFloat(ema.toFixed(2));
};

export const calculatePrediction = (history: HistoryItem[]): AdvancedMetrics['prediction'] => {
  if (history.length < 7) {
    return { nextWeek: 100, confidence: 0, trend: 'stable' };
  }
  
  const recentScores = history.slice(-14).map(h => h.score);
  const n = recentScores.length;
  
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += recentScores[i];
    sumXY += i * recentScores[i];
    sumX2 += i * i;
  }
  
  const slope = n > 0 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;
  const intercept = (sumY - slope * sumX) / n;
  
  const predicted = intercept + slope * (n + 7);
  const nextWeek = parseFloat(Math.max(80, Math.min(120, predicted)).toFixed(2));
  
  const residuals = recentScores.map((y, i) => y - (intercept + slope * i));
  const mse = residuals.reduce((sum, r) => sum + r * r, 0) / n;
  const rmse = Math.sqrt(mse);
  const confidence = parseFloat(Math.max(0, Math.min(100, 100 - rmse)).toFixed(1));
  
  let trend: 'rising' | 'falling' | 'stable' = 'stable';
  if (slope > 0.5) trend = 'rising';
  else if (slope < -0.5) trend = 'falling';
  
  return { nextWeek, confidence, trend };
};

export const calculateSentimentBreakdown = (history: HistoryItem[]): AdvancedMetrics['sentimentBreakdown'] => {
  const breakdown = { positive: 0, negative: 0, neutral: 0 };
  
  history.forEach(h => {
    if (h.sentiment === 'positive') breakdown.positive++;
    else if (h.sentiment === 'negative') breakdown.negative++;
    else breakdown.neutral++;
  });
  
  const total = breakdown.positive + breakdown.negative + breakdown.neutral;
  if (total === 0) return breakdown;
  
  return {
    positive: parseFloat(((breakdown.positive / total) * 100).toFixed(1)),
    negative: parseFloat(((breakdown.negative / total) * 100).toFixed(1)),
    neutral: parseFloat(((breakdown.neutral / total) * 100).toFixed(1))
  };
};

export const calculateAllMetrics = (
  politician: Politician,
  feed: NewsEvent[],
  sources: Source[]
): AdvancedMetrics => {
  const { history } = politician;
  
  return {
    volatility: calculateVolatility(history),
    momentum: calculateMomentum(history),
    mediaFrequency: calculateMediaFrequency(feed, politician.id),
    sentimentRatio: calculateSentimentRatio(history),
    influenceScore: calculateInfluenceScore(history, sources, feed),
    audienceReach: calculateAudienceReach(feed, politician.id),
    trendStrength: calculateTrendStrength(history),
    consistencyScore: calculateConsistencyScore(history),
    prediction: calculatePrediction(history),
    movingAverages: {
      sma7: calculateSMA(history, 7),
      sma14: calculateSMA(history, 14),
      sma30: calculateSMA(history, 30),
      ema12: calculateEMA(history, 12)
    },
    sentimentBreakdown: calculateSentimentBreakdown(history)
  };
};

export const calculateAnalyticsSummary = (
  feed: NewsEvent[],
  politicians: Politician[],
  sources: Source[]
): AnalyticsSummary => {
  const totalEvents = feed.length;
  
  const sentimentScores = feed.map(e => {
    if (e.sentiment === 'positive') return 1;
    if (e.sentiment === 'negative') return -1;
    return 0;
  });
  const avgSentiment = sentimentScores.length > 0 
    ? parseFloat((sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length).toFixed(2))
    : 0;
  
  const sourceCounts: Record<string, number> = {};
  feed.forEach(e => {
    sourceCounts[e.sourceName] = (sourceCounts[e.sourceName] || 0) + 1;
  });
  
  let mostInfluentialSource = 'Unknown';
  let maxCount = 0;
  Object.entries(sourceCounts).forEach(([source, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostInfluentialSource = source;
    }
  });
  
  const topMover = politicians.reduce((best, p) => {
    if (Math.abs(p.trend) > Math.abs(best.change)) {
      return { name: p.name, change: p.trend };
    }
    return best;
  }, { name: 'None', change: 0 });
  
  const mediaShare = Object.entries(sourceCounts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return {
    totalEvents,
    avgSentiment,
    mostInfluentialSource,
    topMover,
    mediaShare
  };
};

export const exportData = (
  politicians: Politician[],
  feed: NewsEvent[],
  sources: Source[]
): string => {
  const data = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    politicians,
    feed,
    sources
  };
  return JSON.stringify(data, null, 2);
};

export const importData = (jsonString: string): { politicians: Politician[], feed: NewsEvent[], sources: Source[] } | null => {
  try {
    const data = JSON.parse(jsonString);
    if (!data.politicians || !data.feed || !data.sources) {
      throw new Error('Invalid data format');
    }
    return {
      politicians: data.politicians,
      feed: data.feed,
      sources: data.sources
    };
  } catch (e) {
    console.error('Import failed:', e);
    return null;
  }
};
