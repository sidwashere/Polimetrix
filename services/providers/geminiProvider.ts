import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Politician, Source, NewsEvent, SentimentType, HistoryItem } from "../../types";
import { AIProvider, withRetry, parseJSON } from "../aiProvider";

const eventSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        sourceName: { type: Type.STRING, description: "The specific name of the news outlet or platform found in search." },
        headline: { type: Type.STRING, description: "A concise headline summarizing the real-world event found." },
        sentiment: { type: Type.STRING, enum: ["positive", "negative", "neutral"] },
        impact: { type: Type.NUMBER, description: "A number between 0.1 and 3.0 indicating political impact magnitude." },
        publishedDate: { type: Type.STRING, description: "The specific date and time the news was posted." },
        sourceUrl: { type: Type.STRING, description: "The direct URL to the news article or social post. REQUIRED." }
    },
    required: ["sourceName", "headline", "sentiment", "impact", "sourceUrl"],
};

const historicalSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        history: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    date: { type: Type.STRING, description: "Exact date of the event in YYYY-MM-DD format." },
                    headline: { type: Type.STRING, description: "Event summary" },
                    sentiment: { type: Type.STRING, enum: ["positive", "negative", "neutral"] },
                    impact: { type: Type.NUMBER, description: "Impact on popularity (-5.0 to +5.0)" },
                    sourceUrl: { type: Type.STRING, description: "The direct URL to the source verifying this specific event. REQUIRED." }
                },
                required: ["date", "headline", "sentiment", "impact", "sourceUrl"]
            }
        }
    }
};

const imageSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        imageUrl: { type: Type.STRING, description: "A direct URL to a public profile image or photo of the politician." }
    }
};

const sourceDiscoverySchema: Schema = {
    type: Type.OBJECT,
    properties: {
        sources: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ["news", "social", "blog", "tv"] },
                    weight: { type: Type.NUMBER },
                },
                required: ["name", "type", "weight"]
            }
        }
    }
};

export class GeminiProvider implements AIProvider {
    readonly name = 'Gemini';
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    get isConfigured(): boolean {
        return !!this.apiKey && this.apiKey.length > 0;
    }

    async fetchEvent(politician: Politician, sources: Source[]): Promise<Partial<NewsEvent> | null> {
        if (!this.isConfigured) return null;

        return withRetry(async () => {
            const prompt = `
        Search for the very latest news (last 24-72 hours only) regarding "${politician.name}" who is a Kenyan politician from ${politician.party}.
        ${politician.bio ? `Background: ${politician.bio}` : ''}
        Focus on the 2027 Kenyan presidential election context.
        Ignore any news older than 72 hours.
        Find a specific, real recent event.
        
        Return a JSON object with:
        1. 'headline': A short summary of the event.
        2. 'sourceName': The name of the publisher.
        3. 'sentiment': 'positive', 'negative', or 'neutral' for the politician.
        4. 'impact': A score 0.1 to 3.0 based on significance.
        5. 'publishedDate': The exact date and time of publication.
        6. 'sourceUrl': The direct link to the article.
      `;

            const ai = new GoogleGenAI({ apiKey: this.apiKey });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                    responseMimeType: "application/json",
                    responseSchema: eventSchema,
                },
            });

            const text = response.text;
            if (!text) return null;

            const data = parseJSON(text);
            if (!data) return null;

            let finalUrl = data.sourceUrl;
            if (!finalUrl) {
                const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
                if (chunks) {
                    const webChunk = chunks.find((c: any) => c.web?.uri);
                    if (webChunk) finalUrl = webChunk.web.uri;
                }
            }

            if (!finalUrl || finalUrl.length < 5) return null;

            return {
                headline: data.headline,
                sourceName: data.sourceName || "Web Search",
                sentiment: data.sentiment as SentimentType,
                impact: data.impact,
                timestamp: data.publishedDate || new Date().toLocaleString(),
                url: finalUrl,
            };
        });
    }

    async fetchHistory(politician: Politician, days: number): Promise<HistoryItem[] | null> {
        if (!this.isConfigured) return null;

        return withRetry(async () => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            const cutoffDateString = cutoffDate.toISOString().split('T')[0];

            const prompt = `
        Research the political performance of "${politician.name}" in Kenya over the last ${days} DAYS (from ${cutoffDateString} to today).
        Identify 8-12 distinct key events that affected their popularity.
        
        STRICT REQUIREMENTS:
        1. Only include events that happened AFTER ${cutoffDateString}.
        2. Do NOT include any event older than ${days} days.
        3. Provide the EXACT DATE (YYYY-MM-DD) for each event.
        4. Provide a VALID SOURCE URL for each event.
        5. Determine sentiment: 'positive', 'negative', or 'neutral' for each event.
        
        Return a JSON array of events with:
        - 'date': exact date (YYYY-MM-DD)
        - 'headline': very short summary
        - 'sentiment': 'positive', 'negative', or 'neutral'
        - 'impact': score impact (-5.0 to +5.0)
        - 'sourceUrl': link to the source
      `;

            const ai = new GoogleGenAI({ apiKey: this.apiKey });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                    responseMimeType: "application/json",
                    responseSchema: historicalSchema,
                },
            });

            const text = response.text;
            if (!text) return null;
            const data = parseJSON(text);
            if (!data || !data.history) return null;

            let currentScore = 100;
            const history: HistoryItem[] = [];

            const validEvents = data.history.filter((e: any) => {
                const eventDate = new Date(e.date);
                const hasUrl = e.sourceUrl && e.sourceUrl.startsWith('http');
                const isRecent = !isNaN(eventDate.getTime()) && eventDate >= cutoffDate;
                return isRecent && hasUrl;
            });

            const sortedEvents = validEvents.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

            for (const event of sortedEvents) {
                currentScore += event.impact;
                history.push({
                    time: event.date,
                    score: parseFloat(currentScore.toFixed(2)),
                    reason: event.headline,
                    sourceUrl: event.sourceUrl,
                    sentiment: event.sentiment as SentimentType,
                });
            }

            return history;
        });
    }

    async fetchImage(name: string): Promise<string | null> {
        if (!this.isConfigured) return null;

        return withRetry(async () => {
            const prompt = `
        Find a public profile image URL for Kenyan politician "${name}". 
        Prefer official portraits or high quality news images. 
        Return the URL in JSON format.
      `;

            const ai = new GoogleGenAI({ apiKey: this.apiKey });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                    responseMimeType: "application/json",
                    responseSchema: imageSchema,
                },
            });

            const text = response.text;
            if (!text) return null;
            const data = parseJSON(text);
            if (data?.imageUrl) return data.imageUrl;
            return null;
        });
    }

    async fetchSuggestedSources(existingSources: Source[]): Promise<Partial<Source>[] | null> {
        if (!this.isConfigured) return null;

        return withRetry(async () => {
            const existingNames = existingSources.map(s => s.name).join(", ");
            const prompt = `
        Suggest 3 new, unique, and realistic political news sources relevant to Kenyan politics (2027 Elections). 
        They should NOT be in this list: ${existingNames}.
        Assign a credibility weight between 1.0 (low) and 3.0 (high).
      `;

            const ai = new GoogleGenAI({ apiKey: this.apiKey });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: sourceDiscoverySchema,
                },
            });

            const text = response.text;
            if (!text) return null;
            const data = parseJSON(text);
            return data?.sources || [];
        });
    }

    async chat(prompt: string): Promise<string | null> {
        if (!this.isConfigured) return null;

        return withRetry(async () => {
            const ai = new GoogleGenAI({ apiKey: this.apiKey });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
            });

            return response.text || null;
        });
    }
}
