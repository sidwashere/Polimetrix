
import { Politician } from '../types';

/**
 * Finds a high-quality image for a politician using public Wikipedia APIs.
 * This serves as a reliable fallback when AI providers don't support image generation/search.
 */
export const findPoliticianImage = async (name: string): Promise<string | null> => {
    try {
        // Try exact match first
        let imageUrl = await searchWiki(name);
        if (imageUrl) return imageUrl;

        // Try adding "Kenya" for context if generic name
        imageUrl = await searchWiki(`${name} Kenya`);
        if (imageUrl) return imageUrl;

        // Try just the last name if full name fails (risky but worth a shot for famous people)
        const parts = name.split(' ');
        if (parts.length > 1) {
            imageUrl = await searchWiki(parts[parts.length - 1] + " Kenya politician");
            if (imageUrl) return imageUrl;
        }

        return null;
    } catch (e) {
        console.warn(`[ImageFinder] Failed to find image for ${name}:`, e);
        return null;
    }
};

const searchWiki = async (query: string): Promise<string | null> => {
    try {
        const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
        const res = await fetch(url);
        const data = await res.json();
        const pages = data.query?.pages;
        if (pages) {
            const pageId = Object.keys(pages)[0];
            if (pageId !== "-1" && pages[pageId].thumbnail) {
                return pages[pageId].thumbnail.source;
            }
        }
        return null;
    } catch {
        return null;
    }
}
