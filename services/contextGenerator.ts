import { Politician, NewsEvent, CandidateContext, AIProviderConfig, AdvancedMetrics } from '../types';
import { getProvider, parseJSON } from './aiProvider';
import { calculateAllMetrics } from './analyticsService';
import { database } from './database';

/**
 * Context Generator
 * Uses AI to generate rich political narratives, summaries, and key insights for each candidate.
 * This powers the "Context" view and downloadable reports.
 */

const CONTEXT_UPDATE_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export const generateCandidateContext = async (
    politician: Politician,
    feed: NewsEvent[],
    config: AIProviderConfig,
    forceUpdate = false
): Promise<CandidateContext | null> => {
    const db = database;
    const existingContext = db.getCandidateContext(politician.id);
    const now = Date.now();

    // Rate limit check
    if (!forceUpdate && existingContext && (now - new Date(existingContext.lastGenerated).getTime() < CONTEXT_UPDATE_INTERVAL_MS)) {
        return existingContext;
    }

    const provider = getProvider(config);
    if (!provider.isConfigured) return null;

    // Gather data for the prompt
    const recentEvents = feed
        .filter(e => e.politicianId === politician.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

    const metrics = calculateAllMetrics(politician, feed, []); // sources not needed for this specific calc

    const prompt = `
    You are a senior political analyst covering the 2027 Kenyan General Election.
    Write a detailed strategic profile for "${politician.name}" (${politician.party}).

    Data Points:
    - Role: ${politician.role}
    - Coalition: ${politician.coalition || 'Unknown'}
    - Current Popularity Score: ${politician.score}
    - Trend: ${politician.trend > 0 ? 'Rising' : 'Falling'} (${metrics.trendStrength} strength)
    - Momentum: ${metrics.momentum}
    - Recent News Headlines:
    ${recentEvents.map(e => `- ${e.headline} (${e.sentiment})`).join('\n')}

    Generate a JSON object with this exact structure:
    {
      "narrative": "A rich 200-word narrative paragraph analyzing their current political standing, recent moves, and public perception. Use journalist tone.",
      "summary": "A concise 2-sentence executive summary of their status.",
      "keyEvents": ["List of 3-5 specific key political events from their recent history"],
      "strengths": ["List 3 key political strengths"],
      "weaknesses": ["List 3 key political weaknesses"],
      "controversies": ["List recent controversies or challenges"],
      "allies": ["List key political allies or coalition partners"],
      "rivals": ["List key political opponents"],
      "prediction": "A 1-sentence prediction for their next week"
    }
  `;

    try {
        const response = await provider.chat(prompt);
        if (!response) return null;

        const data = parseJSON(response);
        if (!data) return null;

        const context: CandidateContext = {
            politicianId: politician.id,
            narrative: data.narrative || "No narrative available.",
            summary: data.summary || "No summary available.",
            keyEvents: data.keyEvents || [],
            strengths: data.strengths || [],
            weaknesses: data.weaknesses || [],
            controversies: data.controversies || [],
            allies: data.allies || [],
            rivals: data.rivals || [],
            lastGenerated: new Date().toISOString()
        };

        // Save to DB
        db.setCandidateContext(context);
        return context;

    } catch (e) {
        console.error(`[ContextGen] Failed to generate context for ${politician.name}`, e);
        return null;
    }
};
