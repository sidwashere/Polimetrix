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

const eventSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    sourceName: { type: Type.STRING, description: "The specific name of the news outlet or platform found in search." },
    headline: { type: Type.STRING, description: "A concise headline summarizing the real-world event found." },
    sentiment: { type: Type.STRING, enum: ["positive", "negative", "neutral"] },
    impact: { type: Type.NUMBER, description: "A number between 0.1 and 3.0 indicating political impact magnitude." },
  },
  required: ["sourceName", "headline", "sentiment", "impact"],
};

const historicalSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    history: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: "Date of the event (YYYY-MM-DD)" },
          headline: { type: Type.STRING, description: "Event summary" },
          impact: { type: Type.NUMBER, description: "Impact on popularity (-5.0 to +5.0)" }
        },
        required: ["date", "headline", "impact"]
      }
    }
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
  if (!apiKey) {
    return null;
  }

  // Strict "Live" filter
  const prompt = `
    Search for the very latest news (last 24-48 hours only) regarding "${targetPolitician.name}" in Kenyan politics (2027 election context).
    Ignore any news older than 48 hours.
    Find a specific, real recent event.
    
    Return a JSON object with:
    1. 'headline': A short summary of the event.
    2. 'sourceName': The name of the publisher (e.g. Daily Nation, The Star, Twitter/X).
    3. 'sentiment': 'positive', 'negative', or 'neutral' for the politician.
    4. 'impact': A score 0.1 to 3.0 based on significance.
  `;

  try {
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

    // Extract URL from grounding metadata if available
    let groundingUrl = undefined;
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
        // Find the first web URI
        const webChunk = chunks.find((c: any) => c.web?.uri);
        if (webChunk) {
            groundingUrl = webChunk.web.uri;
        }
    }

    return {
      headline: data.headline,
      sourceName: data.sourceName || "Web Search",
      sentiment: data.sentiment as SentimentType,
      impact: data.impact,
      url: groundingUrl
    };

  } catch (error) {
    console.error("Gemini AI Generation Error:", error);
    return null;
  }
};

export const fetchHistoricalStats = async (politician: Politician): Promise<HistoryItem[] | null> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;

  const prompt = `
    Research the political performance of "${politician.name}" in Kenya over the last 6 months.
    Identify 6-8 distinct key events or trends (approx one per month) that affected their popularity.
    
    Return a JSON array of events with:
    - 'date': approximate date (YYYY-MM-DD)
    - 'headline': very short summary of the event (e.g. "Finance Bill Protests", "Cabinet Reshuffle")
    - 'impact': A score impact value between -5.0 (highly negative) and +5.0 (highly positive).
  `;

  try {
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

    // Convert impacts to a running score history
    // We assume a starting score of 100 six months ago
    let currentScore = 100;
    const history: HistoryItem[] = [];

    // Sort by date ascending
    const sortedEvents = data.history.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const event of sortedEvents) {
      currentScore += event.impact;
      history.push({
        time: event.date,
        score: parseFloat(currentScore.toFixed(2)),
        reason: event.headline
      });
    }

    return history;

  } catch (e) {
    console.error("Historical Data Fetch Error:", e);
    return null;
  }
};

export const fetchSuggestedSources = async (existingSources: Source[]): Promise<Partial<Source>[] | null> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;

  const existingNames = existingSources.map(s => s.name).join(", ");
  const prompt = `
    Suggest 3 new, unique, and realistic political news sources (websites, TV stations, or social media handles) relevant to Kenyan politics (2027 Elections). 
    They should NOT be in this list: ${existingNames}.
    Assign a credibility weight between 1.0 (low) and 3.0 (high).
  `;

  try {
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
  } catch (e) {
    console.error("Gemini Source Discovery Error:", e);
    return null;
  }
};