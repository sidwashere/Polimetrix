import { Politician, Source, NewsEvent, SentimentType, HistoryItem } from '../../types';
import { AIProvider, withRetry, parseJSON } from '../aiProvider';
import { findPoliticianImage } from '../imageFinder';

type FreeBackend = 'huggingface' | 'openrouter';

/**
 * Free API Provider — supports HuggingFace Inference API and OpenRouter free tier.
 * Both use OpenAI-compatible chat completion format.
 */

const ENDPOINTS: Record<FreeBackend, { url: string; model: string; label: string }> = {
    huggingface: {
        url: 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions',
        model: 'mistralai/Mistral-7B-Instruct-v0.3',
        label: 'HuggingFace (Mistral 7B)',
    },
    openrouter: {
        url: 'https://openrouter.ai/api/v1/chat/completions',
        model: 'meta-llama/llama-3-8b-instruct:free',
        label: 'OpenRouter (Llama 3 8B)',
    },
};

export class FreeApiProvider implements AIProvider {
    readonly name: string;
    private backend: FreeBackend;
    private apiKey: string;
    private endpoint: typeof ENDPOINTS[FreeBackend];

    constructor(backend: FreeBackend, apiKey: string) {
        this.backend = backend;
        this.apiKey = apiKey;
        this.endpoint = ENDPOINTS[backend];
        this.name = this.endpoint.label;
    }

    get isConfigured(): boolean {
        return !!this.apiKey && this.apiKey.length > 0;
    }

    public async chat(prompt: string): Promise<string | null> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (this.backend === 'huggingface') {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        } else if (this.backend === 'openrouter') {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
            headers['HTTP-Referer'] = 'https://polimetric.app';
            headers['X-Title'] = 'PoliMetric Kenya 2027';
        }

        const body: any = {
            model: this.endpoint.model,
            messages: [
                {
                    role: 'system',
                    content: 'You are a political news analyst specializing in Kenyan politics and the 2027 presidential election. Always respond with valid JSON only, no markdown formatting, no explanation text outside the JSON.'
                },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 2048,
        };

        // OpenRouter supports JSON response format
        if (this.backend === 'openrouter') {
            body.response_format = { type: 'json_object' };
        }

        try {
            const response = await fetch(this.endpoint.url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errText = await response.text();
                throw { status: response.status, message: errText };
            }

            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content;
            return content || null;
        } catch (error) {
            console.error(`[${this.name}] Chat request failed:`, error);
            throw error;
        }
    }

    async fetchEvent(politician: Politician, sources: Source[]): Promise<Partial<NewsEvent> | null> {
        if (!this.isConfigured) return null;

        return withRetry(async () => {
            const prompt = `
        Analyze the current political landscape in Kenya for the 2027 presidential election.
        
        Politician: "${politician.name}" from party ${politician.party}, role: ${politician.role}.
        ${politician.bio ? `Background: ${politician.bio}` : ''}
        
        Based on your knowledge of recent Kenyan politics, generate a realistic and plausible current political event about this politician.
        
        Respond with ONLY this JSON structure:
        {
          "sourceName": "name of a real Kenyan news outlet (Daily Nation, The Standard, Citizen Digital, The Star, etc.)",
          "headline": "a concise headline summarizing a political event",
          "sentiment": "positive" or "negative" or "neutral",
          "impact": 0.5,
          "publishedDate": "2027-02-17",
          "sourceUrl": "https://news.google.com"
        }
      `;

            const text = await this.chat(prompt);
            if (!text) return null;

            const data = parseJSON(text);
            if (!data) return null;

            return {
                headline: data.headline,
                sourceName: data.sourceName || this.name,
                sentiment: (data.sentiment || 'neutral') as SentimentType,
                impact: Math.min(3.0, Math.max(0.1, data.impact || 0.5)),
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
        List 8-12 key political events involving Kenyan politician "${politician.name}" (${politician.party}) from the last ${days} days (after ${cutoffStr}).
        
        Respond with ONLY this JSON structure:
        {
          "history": [
            {
              "date": "YYYY-MM-DD",
              "headline": "short event summary",
              "sentiment": "positive" or "negative" or "neutral",
              "impact": -2.5,
              "sourceUrl": "https://nation.africa/article-url"
            }
          ]
        }
        
        Be realistic and use real Kenyan news outlet domain names.
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
                currentScore += event.impact || 0;
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
        
        Respond with ONLY this JSON:
        {
          "sources": [
            { "name": "Source Name", "type": "news", "weight": 2.0 }
          ]
        }
        
        Types can be: "news", "social", "blog", or "tv". Weight is 1.0 to 3.0.
      `;

            const text = await this.chat(prompt);
            if (!text) return null;
            const data = parseJSON(text);
            return data?.sources || [];
        });
    }
}
