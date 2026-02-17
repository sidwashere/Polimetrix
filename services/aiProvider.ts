import { Politician, Source, NewsEvent, HistoryItem, AIProviderConfig, ProviderType } from '../types';
import { GeminiProvider } from './providers/geminiProvider';
import { OllamaProvider } from './providers/ollamaProvider';
import { FreeApiProvider } from './providers/freeApiProvider';

/**
 * Unified AI Provider Interface
 * All providers must implement this contract for hot-swappable backends.
 */
export interface AIProvider {
    readonly name: string;
    readonly isConfigured: boolean;

    fetchEvent(politician: Politician, sources: Source[]): Promise<Partial<NewsEvent> | null>;
    fetchHistory(politician: Politician, days: number): Promise<HistoryItem[] | null>;
    fetchImage(name: string): Promise<string | null>;
    fetchSuggestedSources(existingSources: Source[]): Promise<Partial<Source>[] | null>;
    chat(prompt: string): Promise<string | null>;
}

// --- Retry Logic (shared across all providers) ---
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function withRetry<T>(
    operation: () => Promise<T>,
    retries = 3,
    baseDelay = 2000
): Promise<T | null> {
    try {
        return await operation();
    } catch (error: any) {
        const status = error?.status || error?.code;
        const msg = error?.message || '';
        const isRateLimit = status === 429 ||
            status === 'RESOURCE_EXHAUSTED' ||
            msg.includes('429') ||
            msg.includes('quota') ||
            msg.includes('exhausted');
        const isServerOverload = status === 503;

        if ((isRateLimit || isServerOverload) && retries > 0) {
            console.warn(`[AI Provider] Rate limit/error (${status}). Retrying in ${baseDelay}ms...`);
            await wait(baseDelay);
            return withRetry(operation, retries - 1, baseDelay * 2);
        }

        console.error('[AI Provider] Request failed:', error);
        return null;
    }
}

// --- JSON parser (shared) ---
export const parseJSON = (text: string) => {
    try {
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        console.error('Failed to parse JSON:', text);
        return null;
    }
};

// --- Provider Factory ---
let cachedProvider: AIProvider | null = null;
let cachedConfigHash: string = '';

function configHash(config: AIProviderConfig): string {
    return `${config.provider}|${config.ollamaUrl}|${config.ollamaModel}|${config.huggingfaceApiKey}|${config.openrouterApiKey}|${config.geminiApiKey}`;
}

export function getProvider(config: AIProviderConfig): AIProvider {
    const hash = configHash(config);
    if (cachedProvider && cachedConfigHash === hash) {
        return cachedProvider;
    }

    switch (config.provider) {
        case 'gemini':
            cachedProvider = new GeminiProvider(config.geminiApiKey);
            break;
        case 'ollama':
            cachedProvider = new OllamaProvider(config.ollamaUrl, config.ollamaModel);
            break;
        case 'huggingface':
            cachedProvider = new FreeApiProvider('huggingface', config.huggingfaceApiKey);
            break;
        case 'openrouter':
            cachedProvider = new FreeApiProvider('openrouter', config.openrouterApiKey);
            break;
        default:
            cachedProvider = new GeminiProvider(config.geminiApiKey);
    }

    cachedConfigHash = hash;
    return cachedProvider;
}

export function getDefaultAIProviderConfig(): AIProviderConfig {
    return {
        provider: 'gemini',
        ollamaUrl: 'http://localhost:11434',
        ollamaModel: 'llama3',
        huggingfaceApiKey: '',
        openrouterApiKey: '',
        geminiApiKey: (typeof process !== 'undefined' && process.env?.API_KEY) || '',
    };
}
