import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Politician, Source, NewsEvent, SentimentType, HistoryItem } from "../types";

// Helper to sanitize JSON string if model adds markdown
const parseJSON = (text: string) => {
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse JSON:", text);
    return null;
  }
};

// --- Retry Logic ---
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(
  operation: () => Promise<T>, 
  retries = 3, 
  baseDelay = 2000
): Promise<T | null> {
  try {
    return await operation();
  } catch (error: any) {
    // Check for Rate Limit (429) or Overloaded (503)
    const status = error?.status || error?.code;
    const msg = error?.message || '';
    const isRateLimit = status === 429 || 
                        status === 'RESOURCE_EXHAUSTED' || 
                        msg.includes('429') || 
                        msg.includes('quota') || 
                        msg.includes('exhausted');
    
    const isServerOverload = status === 503;

    if ((isRateLimit || isServerOverload) && retries > 0) {
      console.warn(`Gemini API Rate Limit/Error (${status}). Retrying in ${baseDelay}ms...`);
      await wait(baseDelay);
      return withRetry(operation, retries - 1, baseDelay * 2);
    }

    // If we ran out of retries or it's a different error, log and return null
    console.error("Gemini API Request Failed:", error);
    return null;
  }
}
// -------------------

const eventSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    sourceName: { type: Type.STRING, description: "The specific name of the news outlet or platform found in search." },
    headline: { type: Type.STRING, description: "A concise headline summarizing the real-world event found." },
    sentiment: { type: Type.STRING, enum: ["positive", "negative", "neutral"] },
    impact: { type: Type.NUMBER, description: "A number between 0.1 and 3.0 indicating political impact magnitude." },
    publishedDate: { type: Type.STRING, description: "The specific date and time the news was posted (e.g. 'Oct 24, 14:00' or '2023-11-05')." },
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
    imageUrl: { type: Type.STRING, description: "A direct URL to a public profile image or photo of the politician found in search." }
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

export const fetchAIEvent = async (
  targetPolitician: Politician,
  sources: Source[]
): Promise<Partial<NewsEvent> | null> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;

  return withRetry(async () => {
      const prompt = `
        Search for the very latest news (last 24-72 hours only) regarding "${targetPolitician.name}" who is a Kenyan politician from ${targetPolitician.party}.
        ${targetPolitician.bio ? `Background: ${targetPolitician.bio}` : ''}
        Focus on the 2027 Kenyan presidential election context.
        Ignore any news older than 72 hours.
        Find a specific, real recent event.
        
        Return a JSON object with:
        1. 'headline': A short summary of the event.
        2. 'sourceName': The name of the publisher (e.g. Daily Nation, The Star, Twitter/X, Citizen TV).
        3. 'sentiment': 'positive', 'negative', or 'neutral' for the politician.
        4. 'impact': A score 0.1 to 3.0 based on significance.
        5. 'publishedDate': The exact date and time of publication. Be precise (e.g. "Oct 24, 2:30 PM" or "2024-10-24").
        6. 'sourceUrl': The direct link to the article.
      `;

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: prompt,
        config: {
          tools: [{googleSearch: {}}],
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
              if (webChunk) {
                  finalUrl = webChunk.web.uri;
              }
          }
      }

      if (!finalUrl || finalUrl.length < 5) {
          return null;
      }

      return {
        headline: data.headline,
        sourceName: data.sourceName || "Web Search",
        sentiment: data.sentiment as SentimentType,
        impact: data.impact,
        timestamp: data.publishedDate || new Date().toLocaleString(),
        url: finalUrl
      };
  });
};

export const fetchHistoricalStats = async (politician: Politician, days: number = 180): Promise<HistoryItem[] | null> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;

  return withRetry(async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffDateString = cutoffDate.toISOString().split('T')[0];

      const prompt = `
        Research the political performance of "${politician.name}" in Kenya over the last ${days} DAYS (from ${cutoffDateString} to today).
        Identify 8-12 distinct key events that affected their popularity. The more events the better for accuracy.
        
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

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{googleSearch: {}}],
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
          sentiment: event.sentiment as SentimentType
        });
      }

      return history;
  });
};

export const fetchCandidateImage = async (name: string): Promise<string | null> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return null;

    return withRetry(async () => {
        const prompt = `
          Find a public profile image URL for Kenyan politician "${name}". 
          Prefer official portraits or high quality news images. 
          Return the URL in JSON format.
        `;

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{googleSearch: {}}],
                responseMimeType: "application/json",
                responseSchema: imageSchema
            }
        });

        const text = response.text;
        if (!text) return null;
        const data = parseJSON(text);
        
        if (data?.imageUrl) return data.imageUrl;
        return null;
    });
};

export const fetchSuggestedSources = async (existingSources: Source[]): Promise<Partial<Source>[] | null> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;

  return withRetry(async () => {
      const existingNames = existingSources.map(s => s.name).join(", ");
      const prompt = `
        Suggest 3 new, unique, and realistic political news sources (websites, TV stations, or social media handles) relevant to Kenyan politics (2027 Elections). 
        They should NOT be in this list: ${existingNames}.
        Assign a credibility weight between 1.0 (low) and 3.0 (high).
      `;

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-latest",
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
};