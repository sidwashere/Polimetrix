import { Politician, Source, NewsEvent, HistoryItem, SimulationConfig } from '../types';

const DB_KEYS = {
  POLITICIANS: 'db_politicians',
  SOURCES: 'db_sources',
  FEED: 'db_feed',
  CONFIG: 'db_config',
  POTENTIAL_SOURCES: 'db_potential_sources',
  LAST_SYNC: 'db_last_sync',
  ASPIRANT_DISCOVERY: 'db_aspirant_discovery',
  FETCH_SCHEDULE: 'db_fetch_schedule',
};

export interface DatabaseSchema {
  politicians: Politician[];
  sources: Source[];
  feed: NewsEvent[];
  config: SimulationConfig;
  potentialSources: Source[];
  lastSync: string;
  aspirantDiscovery: AspirantDiscovery[];
  fetchSchedule: FetchSchedule;
}

export interface AspirantDiscovery {
  name: string;
  party: string;
  role: string;
  status: 'announcement' | 'rumor' | 'confirmed' | 'withdrawn' | 'stepped_down';
  firstSeen: string;
  lastSeen: string;
  sourceUrl?: string;
  sourceName?: string;
}

export interface FetchSchedule {
  lastFetchTime: string;
  nextFetchTime: string;
  fetchCount: number;
  hourlyFetchEnabled: boolean;
  fetchIntervalMinutes: number;
}

const DEFAULT_FETCH_SCHEDULE: FetchSchedule = {
  lastFetchTime: '',
  nextFetchTime: '',
  fetchCount: 0,
  hourlyFetchEnabled: true,
  fetchIntervalMinutes: 60,
};

const DEFAULT_CONFIG: SimulationConfig = {
  scanInterval: 8000,
  isPaused: false,
  useAI: false,
  autoRefreshCandidates: true,
  historyWindowDays: 60,
};

const getDefaultDB = (): DatabaseSchema => ({
  politicians: [],
  sources: [],
  feed: [],
  config: DEFAULT_CONFIG,
  potentialSources: [],
  lastSync: new Date().toISOString(),
  aspirantDiscovery: [],
  fetchSchedule: DEFAULT_FETCH_SCHEDULE,
});

class Database {
  private db: DatabaseSchema;

  constructor() {
    this.db = this.load();
  }

  private load(): DatabaseSchema {
    try {
      const data = localStorage.getItem('polimetric_db');
      if (data) {
        return { ...getDefaultDB(), ...JSON.parse(data) };
      }
    } catch (e) {
      console.error('Failed to load database:', e);
    }
    return getDefaultDB();
  }

  private save(): void {
    try {
      localStorage.setItem('polimetric_db', JSON.stringify(this.db));
    } catch (e) {
      console.error('Failed to save database:', e);
    }
  }

  getPoliticians(): Politician[] {
    return this.db.politicians;
  }

  setPoliticians(politicians: Politician[]): void {
    this.db.politicians = politicians;
    this.save();
  }

  addPolitician(politician: Politician): void {
    const exists = this.db.politicians.find(
      (p) => p.id === politician.id || p.name === politician.name
    );
    if (!exists) {
      this.db.politicians.push(politician);
      this.save();
    }
  }

  removePolitician(id: string): void {
    this.db.politicians = this.db.politicians.filter((p) => p.id !== id);
    this.save();
  }

  updatePolitician(id: string, updates: Partial<Politician>): void {
    this.db.politicians = this.db.politicians.map((p) => (p.id === id ? { ...p, ...updates } : p));
    this.save();
  }

  getSources(): Source[] {
    return this.db.sources;
  }

  setSources(sources: Source[]): void {
    this.db.sources = sources;
    this.save();
  }

  getFeed(): NewsEvent[] {
    return this.db.feed;
  }

  setFeed(feed: NewsEvent[]): void {
    this.db.feed = feed;
    this.save();
  }

  addFeedEvent(event: NewsEvent): void {
    this.db.feed = [event, ...this.db.feed].slice(0, 100);
    this.save();
  }

  getConfig(): SimulationConfig {
    return this.db.config;
  }

  setConfig(config: SimulationConfig): void {
    this.db.config = config;
    this.save();
  }

  getPotentialSources(): Source[] {
    return this.db.potentialSources;
  }

  setPotentialSources(sources: Source[]): void {
    this.db.potentialSources = sources;
    this.save();
  }

  getAspirantDiscovery(): AspirantDiscovery[] {
    return this.db.aspirantDiscovery;
  }

  addAspirantDiscovery(aspirant: AspirantDiscovery): void {
    const existing = this.db.aspirantDiscovery.find((a) => a.name === aspirant.name);
    if (existing) {
      existing.lastSeen = aspirant.lastSeen;
      existing.status = aspirant.status;
    } else {
      this.db.aspirantDiscovery.push(aspirant);
    }
    this.save();
  }

  updateAspirantStatus(name: string, status: AspirantDiscovery['status']): void {
    const aspirant = this.db.aspirantDiscovery.find((a) => a.name === name);
    if (aspirant) {
      aspirant.status = status;
      aspirant.lastSeen = new Date().toISOString();
    }
    this.save();
  }

  removeAspirantDiscovery(name: string): void {
    this.db.aspirantDiscovery = this.db.aspirantDiscovery.filter((a) => a.name !== name);
    this.save();
  }

  getFetchSchedule(): FetchSchedule {
    return this.db.fetchSchedule;
  }

  updateFetchSchedule(schedule: Partial<FetchSchedule>): void {
    this.db.fetchSchedule = { ...this.db.fetchSchedule, ...schedule };
    this.save();
  }

  getLastSync(): string {
    return this.db.lastSync;
  }

  setLastSync(time: string): void {
    this.db.lastSync = time;
    this.save();
  }

  filterByDays<T extends { time?: string; timestamp?: string }>(items: T[], days: number): T[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return items.filter((item) => {
      const dateStr = item.time || item.timestamp;
      if (!dateStr) return false;
      const date = new Date(dateStr);
      return date >= cutoff;
    });
  }

  getPoliticiansHistoryLast60Days(politicianId: string): HistoryItem[] {
    const politician = this.db.politicians.find((p) => p.id === politicianId);
    if (!politician) return [];
    return this.filterByDays(politician.history, 60);
  }

  getFeedLast24Hours(): NewsEvent[] {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    return this.db.feed.filter((event) => {
      const eventDate = new Date(event.timestamp);
      return eventDate >= cutoff;
    });
  }

  clearAllData(): void {
    localStorage.removeItem('polimetric_db');
    this.db = getDefaultDB();
  }

  exportData(): string {
    return JSON.stringify(this.db, null, 2);
  }

  importData(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      this.db = { ...getDefaultDB(), ...data };
      this.save();
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  }
}

export const database = new Database();
export default database;
