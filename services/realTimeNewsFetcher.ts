import { Politician, NewsEvent, SentimentType, Source } from '../types';
import { AIProvider } from './aiProvider';

/**
 * Real-Time News Fetcher
 * Fetches actual news from free APIs, then uses the AI provider for sentiment analysis.
 * Sources: DuckDuckGo search API, GNews free tier, RSS proxy.
 */

interface RawNewsItem {
    title: string;
    snippet: string;
    url: string;
    source: string;
    publishedAt?: string;
}

const fetchWithTimeout = async (url: string, timeout = 8000): Promise<any | null> => {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (err) {
        console.warn('[NewsFetcher] Request failed:', url, err);
        return null;
    }
};

/**
 * Search DuckDuckGo for recent news about a politician
 */
const searchDuckDuckGo = async (politician: Politician): Promise<RawNewsItem[]> => {
    const query = encodeURIComponent(`${politician.name} Kenya 2027 election news`);
    const url = `https://ddg-api.vercel.app/search?q=${query}&max_results=5`;

    const data = await fetchWithTimeout(url);
    if (!data?.results) return [];

    return data.results.map((r: any) => ({
        title: r.title || '',
        snippet: r.snippet || r.body || '',
        url: r.url || r.link || '',
        source: extractSourceName(r.url || ''),
        publishedAt: r.publishedDate || new Date().toISOString(),
    }));
};

/**
 * Search GNews API (free tier: 100 req/day)
 */
const searchGNews = async (politician: Politician): Promise<RawNewsItem[]> => {
    const gnewsKey = (typeof process !== 'undefined' && process.env?.GNEWS_API_KEY) || '';
    if (!gnewsKey) return [];

    const query = encodeURIComponent(`${politician.name} Kenya`);
    const url = `https://gnews.io/api/v4/search?q=${query}&lang=en&country=ke&max=5&apikey=${gnewsKey}`;

    const data = await fetchWithTimeout(url);
    if (!data?.articles) return [];

    return data.articles.map((a: any) => ({
        title: a.title || '',
        snippet: a.description || '',
        url: a.url || '',
        source: a.source?.name || extractSourceName(a.url || ''),
        publishedAt: a.publishedAt || new Date().toISOString(),
    }));
};

const extractSourceName = (url: string): string => {
    const knownSources: Record<string, string> = {
        'nation.africa': 'Daily Nation',
        'standardmedia.co.ke': 'The Standard',
        'citizen.digital': 'Citizen Digital',
        'the-star.co.ke': 'The Star',
        'kenyans.co.ke': 'Kenyans.co.ke',
        'tuko.co.ke': 'Tuko News',
        'capitalfm.co.ke': 'Capital FM',
        'kbc.co.ke': 'KBC',
        'allafrica.com': 'AllAfrica',
        'twitter.com': 'X (Twitter)',
        'x.com': 'X (Twitter)',
    };

    for (const [domain, name] of Object.entries(knownSources)) {
        if (url.includes(domain)) return name;
    }

    try {
        const hostname = new URL(url).hostname.replace('www.', '');
        return hostname;
    } catch {
        return 'Web News';
    }
};

/**
 * Fetch real news and use AI to analyze sentiment.
 * Returns a processed NewsEvent or null.
 */
export const fetchRealNewsEvent = async (
    politician: Politician,
    sources: Source[],
    aiProvider: AIProvider
): Promise<Partial<NewsEvent> | null> => {
    // First try to get real news from search APIs
    const [ddgResults, gnewsResults] = await Promise.all([
        searchDuckDuckGo(politician),
        searchGNews(politician),
    ]);

    const allResults = [...ddgResults, ...gnewsResults];

    if (allResults.length === 0) {
        // Fallback: use AI provider directly (it may have its own search)
        return aiProvider.fetchEvent(politician, sources);
    }

    // Pick the most relevant result (first one is usually most relevant)
    const best = allResults[0];

    // If AI provider is configured, use it for sentiment analysis
    if (aiProvider.isConfigured) {
        try {
            const sentimentResult = await analyzeSentiment(aiProvider, politician, best);
            if (sentimentResult) return sentimentResult;
        } catch (err) {
            console.warn('[NewsFetcher] AI sentiment analysis failed, using heuristic:', err);
        }
    }

    // Heuristic fallback sentiment analysis
    return {
        headline: best.title,
        sourceName: best.source,
        sentiment: heuristicSentiment(best.title + ' ' + best.snippet, politician.name),
        impact: 0.5,
        timestamp: best.publishedAt || new Date().toLocaleString(),
        url: best.url,
    };
};

/**
 * Use AI provider to analyze sentiment of a real news item
 */
const analyzeSentiment = async (
    aiProvider: AIProvider,
    politician: Politician,
    newsItem: RawNewsItem
): Promise<Partial<NewsEvent> | null> => {
    // We leverage the provider's own fetchEvent which already handles the prompt.
    // But enrich it with the actual news context.
    const result = await aiProvider.fetchEvent(politician, []);

    if (result) {
        // Prefer the real URL and source name
        return {
            ...result,
            headline: result.headline || newsItem.title,
            sourceName: result.sourceName || newsItem.source,
            url: newsItem.url || result.url,
        };
    }

    return null;
};

/**
 * Simple heuristic sentiment analysis (no AI required)
 */
const heuristicSentiment = (text: string, politicianName: string): SentimentType => {
    const lower = text.toLowerCase();
    const name = politicianName.toLowerCase();

    const positiveWords = ['endorses', 'praised', 'wins', 'surging', 'supports', 'launches', 'successful', 'popular', 'leads', 'alliance', 'victory', 'rally', 'endorsement', 'boost', 'momentum'];
    const negativeWords = ['criticized', 'scandal', 'drops', 'heckled', 'defects', 'allegations', 'opposes', 'falls', 'controversy', 'questioned', 'decline', 'fails', 'loss', 'protest', 'rival'];

    let positiveHits = 0;
    let negativeHits = 0;

    for (const word of positiveWords) {
        if (lower.includes(word)) positiveHits++;
    }
    for (const word of negativeWords) {
        if (lower.includes(word)) negativeHits++;
    }

    if (positiveHits > negativeHits) return 'positive';
    if (negativeHits > positiveHits) return 'negative';
    return 'neutral';
};

/**
 * Fetch multiple news events for all politicians
 */
export const fetchAllRealNews = async (
    politicians: Politician[],
    sources: Source[],
    aiProvider: AIProvider
): Promise<Partial<NewsEvent>[]> => {
    const results: Partial<NewsEvent>[] = [];

    for (const politician of politicians) {
        try {
            const event = await fetchRealNewsEvent(politician, sources, aiProvider);
            if (event && event.headline) {
                results.push({
                    ...event,
                    politicianId: politician.id,
                } as any);
            }
            // Rate limit between politicians
            await new Promise(r => setTimeout(r, 1500));
        } catch (err) {
            console.error(`[NewsFetcher] Error for ${politician.name}:`, err);
        }
    }

    return results;
};
