import { Politician, ProfileChange, AIProviderConfig } from '../types';
import { database } from './database';
import { getProvider, parseJSON } from './aiProvider';
import { findPoliticianImage } from './imageFinder';

/**
 * Dynamic Profile Updater
 * Detects and applies changes to a politician's party, coalition, slogan, or role.
 */

const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // Check once every 24 hours

export const updateCandidateProfile = async (
    politician: Politician,
    config: AIProviderConfig
): Promise<Partial<Politician> | null> => {
    const lastUpdate = politician.lastProfileUpdate ? new Date(politician.lastProfileUpdate).getTime() : 0;
    const now = Date.now();

    // If recently updated, skip (unless forced, but force isn't implemented here yet)
    if (now - lastUpdate < UPDATE_INTERVAL_MS) {
        return null;
    }

    const provider = getProvider(config);
    if (!provider.isConfigured) return null;

    try {
        const prompt = `
      Analyze the current political status of "${politician.name}" in Kenya (2027 election context).
      Current Data:
      - Party: ${politician.party}
      - Role: ${politician.role}
      - Slogan: ${politician.slogan || 'None'}
      - Coalition: ${politician.coalition || 'None'}

      Has any of this changed recently? 
      Return a JSON object with strictly these fields (and only if changed, otherwise use current value):
      {
        "party": "Current political party name",
        "coalition": "Current coalition name (e.g. Kenya Kwanza, Azimio)",
        "role": "Current official role or title (e.g. President, Opposition Leader)",
        "slogan": "Current campaign slogan or motto",
        "bio": "A 1-sentence updated bio summary"
      }
    `;

        const response = await provider.chat(prompt);
        if (!response) return null;

        const data = parseJSON(response);
        if (!data) return null;

        const updates: Partial<Politician> = {};
        const changes: ProfileChange[] = [];
        const timestamp = new Date().toISOString();

        // Check for changes
        if (data.party && data.party !== politician.party) {
            updates.party = data.party;
            changes.push({ field: 'party', oldValue: politician.party, newValue: data.party, detectedAt: timestamp });
        }
        if (data.coalition && data.coalition !== politician.coalition) {
            updates.coalition = data.coalition;
            changes.push({ field: 'coalition', oldValue: politician.coalition || '', newValue: data.coalition, detectedAt: timestamp });
        }
        if (data.role && data.role !== politician.role) {
            updates.role = data.role;
            changes.push({ field: 'role', oldValue: politician.role, newValue: data.role, detectedAt: timestamp });
        }
        if (data.slogan && data.slogan !== politician.slogan) {
            updates.slogan = data.slogan;
            changes.push({ field: 'slogan', oldValue: politician.slogan || '', newValue: data.slogan, detectedAt: timestamp });
        }
        if (data.bio && data.bio !== politician.bio && data.bio.length > 20) {
            updates.bio = data.bio;
            // Bio changes aren't "critical" profile changes so we don't log them in profileChanges array usually, but we could.
        }

        // Check for missing or placeholder image
        if (!politician.image || politician.image.includes('ui-avatars.com')) {
            const newImage = await findPoliticianImage(politician.name);
            if (newImage && newImage !== politician.image) {
                updates.image = newImage;
            }
        }

        if (Object.keys(updates).length > 0) {
            updates.lastProfileUpdate = timestamp;
            if (changes.length > 0) {
                updates.profileChanges = [...(politician.profileChanges || []), ...changes];
            }
            return updates;
        }

        // Even if no changes, update the timestamp so we don't check again too soon
        return { lastProfileUpdate: timestamp };

    } catch (e) {
        console.error(`[ProfileUpdater] Failed to update ${politician.name}`, e);
        return null;
    }
};
