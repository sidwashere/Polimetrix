import { Politician } from '../types';
import { database, AspirantDiscovery } from './database';

export interface DiscoveredAspirant {
  name: string;
  party: string;
  role: string;
  status: AspirantDiscovery['status'];
  bio?: string;
  sourceUrl?: string;
  sourceName?: string;
}

const COLORS = [
  '#fbbf24',
  '#3b82f6',
  '#a855f7',
  '#ef4444',
  '#10b981',
  '#f97316',
  '#06b6d4',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
];

const getRandomColor = (): string => COLORS[Math.floor(Math.random() * COLORS.length)];

const fetchWithRetry = async (url: string, retries = 3): Promise<any | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return fetchWithRetry(url, retries - 1);
    }
    return null;
  }
};

export const discoverAspirants = async (): Promise<DiscoveredAspirant[]> => {
  const discovered: DiscoveredAspirant[] = [];

  const searchTerms = [
    'Kenya 2027 presidential candidate declares',
    'Kenya 2027 presidential aspirant announcement',
    'who will run for president Kenya 2027',
    'Kenya opposition presidential candidate 2027',
  ];

  try {
    for (const term of searchTerms) {
      const encodedTerm = encodeURIComponent(term);
      const url = `https://ddg-api.vercel.app/search?q=${encodedTerm}&max_results=10`;

      const results = await fetchWithRetry(url);

      if (results && results.results) {
        for (const result of results.results) {
          const title = result.title?.toLowerCase() || '';
          const snippet = result.snippet?.toLowerCase() || '';
          const text = `${title} ${snippet}`;

          if (
            text.includes('president') ||
            text.includes('presidential') ||
            text.includes('candidate') ||
            text.includes('aspirant') ||
            text.includes('vying') ||
            text.includes('run for')
          ) {
            const namePatterns = [
              /(?:William Ruto|Rigathi Gachagua|Kalonzo Musyoka|Fred Matiang'i|Justi(?:n|ce) Muturi|George Wajackoyah|James Orengo|Moses Wetang'ula|Wycliffe Oparanya|Gideon Moi|Ekuru Aukot|Reuben Kigame|Mwai Kibaki|Joe Kaguta|Moses Kuria|Alees Nzeng|Johnny Muthama|Othaya Njiriri|Njeru Kagia|Josphat Nanok|Jacob Juma|Martin Wambora|Francis Oparanya|Sophonias Mogeni|Hassan Joho|Ajabu Achari|Thuo Mathonde|Mburu Manyasa|Mbugua Mureithi|Mwangi Thuita)/gi,
            ];

            for (const pattern of namePatterns) {
              const matches = text.match(pattern);
              if (matches) {
                for (const name of matches) {
                  const cleanName = name.trim();
                  if (cleanName.length > 3 && !discovered.find((d) => d.name === cleanName)) {
                    let status: AspirantDiscovery['status'] = 'announcement';
                    if (
                      text.includes('withdraw') ||
                      text.includes('step down') ||
                      text.includes('drops out') ||
                      text.includes('retire')
                    ) {
                      status = 'stepped_down';
                    } else if (text.includes('confirmed') || text.includes('official')) {
                      status = 'confirmed';
                    }

                    discovered.push({
                      name: cleanName,
                      party: inferParty(text),
                      role: 'Presidential Aspirant',
                      status,
                      sourceUrl: result.url,
                      sourceName: extractSourceName(result.url || ''),
                    });
                  }
                }
              }
            }
          }
        }
      }

      await new Promise((r) => setTimeout(r, 500));
    }
  } catch (error) {
    console.error('Aspirant discovery error:', error);
  }

  return discovered;
};

const inferParty = (text: string): string => {
  const partyMap: Record<string, string> = {
    uda: 'UDA',
    'kenya kwanza': 'Kenya Kwanza',
    odm: 'ODM',
    'orange democratic movement': 'ODM',
    azimio: 'Azimio',
    wiper: 'Wiper Democratic Movement',
    ' Jubilee': 'Jubilee Party',
    kanu: 'KANU',
    roots: 'Roots Party',
    thirdway: 'Thirdway Alliance',
    democratic: 'Democratic Party',
    ford: 'Ford Kenya',
    anc: 'ANC',
  };

  const lower = text.toLowerCase();
  for (const [key, party] of Object.entries(partyMap)) {
    if (lower.includes(key)) return party;
  }
  return 'Independent';
};

const extractSourceName = (url: string): string => {
  const sources = [
    'the-star.co.ke',
    'standardmedia.co.ke',
    'nation.africa',
    'citizen.digital',
    'kbc.co.ke',
    'tuko.co.ke',
    'capitalfm.co.ke',
    'streamlinefeed.co.ke',
    'allafrica.com',
  ];

  for (const source of sources) {
    if (url.includes(source)) {
      return source.replace('.co.ke', '').replace('.', ' ').trim();
    }
  }
  return 'Web News';
};

export const syncAspirants = async (
  existingPoliticians: Politician[],
  onAdd: (politician: Politician) => void,
  onRemove: (id: string) => void
): Promise<void> => {
  const discovered = await discoverAspirants();
  const existingNames = existingPoliticians.map((p) => p.name.toLowerCase());
  const discovery = database.getAspirantDiscovery();

  const now = new Date().toISOString();

  for (const aspirant of discovered) {
    const existingInDb = discovery.find(
      (d) => d.name.toLowerCase() === aspirant.name.toLowerCase()
    );

    if (aspirant.status === 'stepped_down' || aspirant.status === 'withdrawn') {
      database.addAspirantDiscovery({
        name: aspirant.name,
        party: aspirant.party,
        role: aspirant.role,
        status: 'stepped_down',
        firstSeen: existingInDb?.firstSeen || now,
        lastSeen: now,
        sourceUrl: aspirant.sourceUrl,
        sourceName: aspirant.sourceName,
      });

      const existingPol = existingPoliticians.find(
        (p) => p.name.toLowerCase() === aspirant.name.toLowerCase()
      );
      if (existingPol) {
        onRemove(existingPol.id);
      }
    } else if (!existingNames.includes(aspirant.name.toLowerCase())) {
      database.addAspirantDiscovery({
        name: aspirant.name,
        party: aspirant.party,
        role: aspirant.role,
        status: aspirant.status,
        firstSeen: now,
        lastSeen: now,
        sourceUrl: aspirant.sourceUrl,
        sourceName: aspirant.sourceName,
      });

      const newPolitician: Politician = {
        id: `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: aspirant.name,
        role: aspirant.role,
        party: aspirant.party,
        score: 100.0,
        trend: 0,
        color: getRandomColor(),
        image: `https://ui-avatars.com/api/?name=${encodeURIComponent(aspirant.name)}&background=random&size=200`,
        bio: aspirant.bio,
        history: Array(15).fill({ time: '', score: 100 }),
      };

      onAdd(newPolitician);
    } else {
      if (existingInDb) {
        existingInDb.lastSeen = now;
        existingInDb.status = aspirant.status;
      }
    }
  }
};

export const checkForSteppedDownAspirants = async (
  existingPoliticians: Politician[],
  onRemove: (id: string) => void
): Promise<void> => {
  const searchTerms = [
    'presidential candidate withdraws Kenya 2027',
    'presidential aspirant steps down Kenya',
    'candidate drops out Kenya 2027 race',
  ];

  try {
    for (const term of searchTerms) {
      const encodedTerm = encodeURIComponent(term);
      const url = `https://ddg-api.vercel.app/search?q=${encodedTerm}&max_results=5`;

      const results = await fetchWithRetry(url);

      if (results && results.results) {
        for (const result of results.results) {
          const snippet = result.snippet?.toLowerCase() || '';

          if (
            snippet.includes('withdraw') ||
            snippet.includes('step down') ||
            snippet.includes('drops out') ||
            snippet.includes('quit')
          ) {
            for (const pol of existingPoliticians) {
              if (snippet.includes(pol.name.toLowerCase())) {
                database.updateAspirantStatus(pol.name, 'stepped_down');
                onRemove(pol.id);
              }
            }
          }
        }
      }

      await new Promise((r) => setTimeout(r, 300));
    }
  } catch (error) {
    console.error('Check stepped down error:', error);
  }
};
