import { Politician, Source, NewsEvent, SentimentType, HistoryItem } from '../../types';
import { AIProvider, withRetry, parseJSON } from '../aiProvider';
import { findPoliticianImage } from '../imageFinder';

/**
 * Ollama Provider — calls a local or network Ollama instance.
 * Uses /api/chat with JSON format for structured output.
 * Works with any model: llama3, mistral, qwen2, gemma2, phi3, etc.
 */
export class OllamaProvider implements AIProvider {
    readonly name: string;
    private baseUrl: string;
    private model: string;

    constructor(baseUrl: string = 'http://localhost:11434', model: string = 'llama3') {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.model = model;
        this.name = `Ollama (${model})`;
    }

    get isConfigured(): boolean {
        return !!this.baseUrl && !!this.model;
    }

    public async chat(prompt: string): Promise<string | null> {
        try {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a political news analyst specializing in Kenyan politics. Always respond with valid JSON only, no markdown, no explanation text.'
                        },
                        { role: 'user', content: prompt }
                    ],
                    format: 'json',
                    stream: false,
                    options: {
                        temperature: 0.3,
                        num_predict: 2048,
                    }
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama HTTP ${response.status}: ${await response.text()}`);
            }

            const data = await response.json();
            return data?.message?.content || null;
        } catch (error) {
            console.error('[Ollama] Chat request failed:', error);
            throw error;
        }
    }

    async fetchEvent(politician: Politician, sources: Source[]): Promise<Partial<NewsEvent> | null> {
        if (!this.isConfigured) return null;

        return withRetry(async () => {
            const prompt = `
        You are analyzing current political news in Kenya for the 2027 presidential election.
        
        Politician: "${politician.name}" from party ${politician.party}, role: ${politician.role}.
        ${politician.bio ? `Background: ${politician.bio}` : ''}
        
        Based on your knowledge of recent Kenyan politics, generate a realistic and plausible current event about this politician.
        Focus on realistic political developments that could be happening now.
        
        Return a JSON object with these exact fields:
        {
          "sourceName": "name of a real Kenyan news outlet (e.g. Daily Nation, The Standard, Citizen Digital, The Star)",
          "headline": "a concise headline summarizing a political event",
          "sentiment": "positive" or "negative" or "neutral",
          "impact": a number between 0.1 and 3.0,
          "publishedDate": "today's date in YYYY-MM-DD format",
          "sourceUrl": "https://news.google.com"
        }
      `;

            const text = await this.chat(prompt);
            if (!text) return null;

            const data = parseJSON(text);
            if (!data) return null;

            return {
                headline: data.headline,
                sourceName: data.sourceName || 'Ollama Analysis',
                sentiment: (data.sentiment || 'neutral') as SentimentType,
                impact: data.impact || 0.5,
                timestamp: data.publishedDate || new Date().toLocaleString(),
                url: data.sourceUrl || undefined,
            };
        });
    }

    async fetchHistory(politician: Politician, days: number): Promise<HistoryItem[] | null> {
        if (!this.isConfigured) return null;

        return withRetry(async () => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            const cutoffStr = cutoffDate.toISOString().split('T')[0];

            const prompt = `
        Based on your knowledge of Kenyan politics, list 8-12 key political events involving "${politician.name}" (${politician.party}) from the last ${days} days (after ${cutoffStr}).
        
        Return a JSON object with a "history" array. Each entry must have:
        {
          "history": [
            {
              "date": "YYYY-MM-DD",
              "headline": "short event summary",
              "sentiment": "positive" or "negative" or "neutral",
              "impact": number from -5.0 to +5.0,
              "sourceUrl": "https://relevant-news-site.com/article"
            }
          ]
        }
        
        Be realistic. Use real Kenyan news outlet URLs where possible.
      `;

            const text = await this.chat(prompt);
            if (!text) return null;

            const data = parseJSON(text);
            if (!data?.history) return null;

            let currentScore = 100;
            const history: HistoryItem[] = [];

            const validEvents = data.history
                .filter((e: any) => {
                    const eventDate = new Date(e.date);
                    return !isNaN(eventDate.getTime()) && eventDate >= cutoffDate;
                })
                .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

            for (const event of validEvents) {
                currentScore += event.impact;
                history.push({
                    time: event.date,
                    score: parseFloat(currentScore.toFixed(2)),
                    reason: event.headline,
                    sourceUrl: event.sourceUrl,
                    sentiment: (event.sentiment || 'neutral') as SentimentType,
                });
            }

            return history;
        });
    }

    async fetchImage(name: string): Promise<string | null> {
        // Try to find a real image first
        const realImage = await findPoliticianImage(name);
        if (realImage) return realImage;

        // Fallback to placeholder
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=200`;
    }

    async fetchSuggestedSources(existingSources: Source[]): Promise<Partial<Source>[] | null> {
        if (!this.isConfigured) return null;

        return withRetry(async () => {
            const existingNames = existingSources.map(s => s.name).join(', ');
            const prompt = `
        Suggest 3 new, unique, and realistic political news sources relevant to Kenyan politics and the 2027 Elections.
        They should NOT be in this list: ${existingNames}.
        
        Return a JSON object:
        {
          "sources": [
            { "name": "Source Name", "type": "news" or "social" or "blog" or "tv", "weight": number 1.0 to 3.0 }
          ]
        }
      `;

            const text = await this.chat(prompt);
            if (!text) return null;

            const data = parseJSON(text);
            return data?.sources || [];
        });
    }

    /** Check if the Ollama server is reachable and list available models */
    static async checkConnection(baseUrl: string): Promise<{ ok: boolean; models: string[] }> {
        try {
            const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/tags`);
            if (!response.ok) return { ok: false, models: [] };
            const data = await response.json();
            const models = (data.models || []).map((m: any) => m.name || m.model);
            return { ok: true, models };
        } catch {
            return { ok: false, models: [] };
        }
    }
}
