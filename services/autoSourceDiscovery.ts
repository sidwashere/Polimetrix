import { Source, DiscoveredSource, AIProviderConfig } from '../types';
import { database } from './database';
import { getProvider } from './aiProvider';

/**
 * Auto-Discovery Service
 * Scans for new Kenyan news sources, blogs, and social accounts covering the 2027 election.
 * Uses DuckDuckGo for discovery and AI for classification.
 */

const DISCOVERY_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MIN_SEEN_COUNT_TO_SUGGEST = 3;

// Known reliable domains to ignore (already in default list or handled)
const IGNORED_DOMAINS = [
    'nation.africa',
    'standardmedia.co.ke',
    'the-star.co.ke',
    'citizen.digital',
    'kenyans.co.ke',
    'tuko.co.ke',
    'kbc.co.ke',
    'capitalfm.co.ke',
    'twitter.com',
    'x.com',
    'facebook.com',
    'instagram.com',
    'youtube.com',
    'linkedin.com',
    'tiktok.com',
    'reddit.com',
    'wikipedia.org',
    'google.com',
    'yahoo.com',
    'bing.com'
];

interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}

const fetchSearchResults = async (query: string): Promise<SearchResult[]> => {
    try {
        const encoded = encodeURIComponent(query);
        const url = `https://ddg-api.vercel.app/search?q=${encoded}&max_results=10`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return data.results || [];
    } catch (e) {
        console.error('[AutoDiscovery] Search failed:', e);
        return [];
    }
};

const extractDomain = (url: string): string => {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return '';
    }
};

export const runSourceDiscovery = async (
    currentSources: Source[],
    config: AIProviderConfig
): Promise<Source[]> => {
    const lastRun = localStorage.getItem('last_source_discovery');
    const now = Date.now();

    // Rate limit: only run every 6 hours
    if (lastRun && now - parseInt(lastRun) < DISCOVERY_INTERVAL_MS) {
        return [];
    }

    console.log('[AutoDiscovery] Starting source discovery scan...');
    localStorage.setItem('last_source_discovery', now.toString());

    const queries = [
        'Kenya 2027 election news',
        'Kenya politics blog 2027',
        'latest kenya political news sites',
        'kenya election analysis blogs',
        'kenya political pundits sub-stack',
    ];

    const candidates: Record<string, SearchResult> = {};

    // 1. Search for potential sources
    for (const q of queries) {
        const results = await fetchSearchResults(q);
        for (const r of results) {
            const domain = extractDomain(r.url);
            if (!domain) continue;

            // Skip if already tracked
            if (currentSources.some(s => extractDomain(s.id).includes(domain) || s.name.toLowerCase().includes(domain))) continue;

            // Skip ignored/common domains
            if (IGNORED_DOMAINS.some(d => domain.includes(d))) continue;

            candidates[domain] = r; // Keep one sample result
        }
        // Polite delay
        await new Promise(r => setTimeout(r, 1000));
    }

    // 2. Process candidates
    const newSuggestions: Source[] = [];
    const db = database;

    // Ensure DB is ready
    await db.waitForReady();
    const discoveredStore = db.getDiscoveredSources();

    for (const [domain, sample] of Object.entries(candidates)) {
        let entry = discoveredStore.find(s => s.domain === domain);
        const today = new Date().toISOString();

        if (entry) {
            if (entry.rejected || entry.accepted) continue;

            // Update existing entry
            entry.lastSeen = today;
            entry.seenCount++;
            db.addDiscoveredSource(entry); // updates it
        } else {
            // New discovery
            entry = {
                domain,
                name: domain, // placeholder
                type: 'blog',
                weight: 1.0,
                firstSeen: today,
                lastSeen: today,
                seenCount: 1,
                accepted: false,
                rejected: false
            };

            // Use AI to classify if possible
            const provider = getProvider(config);
            if (provider.isConfigured) {
                try {
                    const prompt = `Analyze this website based on the snippet:
URL: ${sample.url}
Title: ${sample.title}
Snippet: ${sample.snippet}

Return JSON with:
{
  "name": "Human readable name",
  "type": "news" | "blog" | "social",
  "weight": number (0.5 to 2.0 based on credibility)
}`;
                    // We can't easily call provider.fetchEvent for this generic query, 
                    // so we might skip AI classification for now or implement a generic 'chat' method later.
                    // For now, simple heuristics:
                    if (sample.title.toLowerCase().includes('news')) entry.type = 'news';
                    entry.weight = 1.0;
                    entry.name = domain;
                } catch (e) {
                    console.warn('Failed to classify source', e);
                }
            }

            db.addDiscoveredSource(entry);
        }

        // If seen enough times, suggest it to the user
        if (entry.seenCount >= MIN_SEEN_COUNT_TO_SUGGEST) {
            newSuggestions.push({
                id: `auto-${domain}`,
                name: entry.name,
                type: entry.type,
                weight: entry.weight,
                active: true
            });
        }
    }

    console.log(`[AutoDiscovery] Scan complete. Found ${Object.keys(candidates).length} candidates, suggesting ${newSuggestions.length}.`);
    return newSuggestions;
};
