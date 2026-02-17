import { Politician, Source, NewsEvent, HistoryItem, SimulationConfig, AIProviderConfig, CandidateContext, DiscoveredSource } from '../types';
import { getDefaultAIProviderConfig } from './aiProvider';

const DB_NAME = 'polimetric_db';
const DB_VERSION = 2;

/**
 * Object store names
 */
const STORES = {
  POLITICIANS: 'politicians',
  SOURCES: 'sources',
  FEED: 'feed',
  CONFIG: 'config',
  POTENTIAL_SOURCES: 'potential_sources',
  ASPIRANT_DISCOVERY: 'aspirant_discovery',
  FETCH_SCHEDULE: 'fetch_schedule',
  CANDIDATE_CONTEXTS: 'candidate_contexts',
  DISCOVERED_SOURCES: 'discovered_sources',
  META: 'meta',
} as const;

export interface DatabaseSchema {
  politicians: Politician[];
  sources: Source[];
  feed: NewsEvent[];
  config: SimulationConfig;
  potentialSources: Source[];
  lastSync: string;
  aspirantDiscovery: AspirantDiscovery[];
  fetchSchedule: FetchSchedule;
  aiProviderConfig: AIProviderConfig;
  candidateContexts: CandidateContext[];
  discoveredSources: DiscoveredSource[];
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
  scanInterval: 15000,
  isPaused: false,
  useAI: true,
  autoRefreshCandidates: true,
  historyWindowDays: 60,
  aiProviderConfig: getDefaultAIProviderConfig(),
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
  aiProviderConfig: getDefaultAIProviderConfig(),
  candidateContexts: [],
  discoveredSources: [],
});

/**
 * IndexedDB-backed persistent database with in-memory cache for synchronous React reads.
 * Writes are async to IndexedDB, reads are always from the in-memory cache.
 */
class Database {
  private db: DatabaseSchema;
  private idb: IDBDatabase | null = null;
  private idbReady: Promise<void>;

  constructor() {
    this.db = this.loadFromLocalStorage();
    this.idbReady = this.initIndexedDB();
  }

  // ─── IndexedDB Initialization ───

  private initIndexedDB(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (typeof indexedDB === 'undefined') {
        console.warn('[DB] IndexedDB not available, using localStorage fallback');
        resolve();
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // Create all object stores if they don't exist
        for (const storeName of Object.values(STORES)) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName);
          }
        }
        console.log('[DB] IndexedDB schema created/upgraded');
      };

      request.onsuccess = async (event) => {
        this.idb = (event.target as IDBOpenDBRequest).result;
        console.log('[DB] IndexedDB connected');

        // Try to load from IndexedDB first; if empty, migrate from localStorage
        const hasData = await this.loadFromIDB();
        if (!hasData) {
          console.log('[DB] No IndexedDB data found — migrating from localStorage...');
          await this.migrateFromLocalStorage();
        }
        resolve();
      };

      request.onerror = (event) => {
        console.error('[DB] IndexedDB failed to open:', event);
        resolve(); // fallback to localStorage
      };
    });
  }

  private async loadFromIDB(): Promise<boolean> {
    if (!this.idb) return false;

    try {
      const politicians = await this.idbGet(STORES.POLITICIANS, 'data');
      if (!politicians || (Array.isArray(politicians) && politicians.length === 0)) return false;

      this.db.politicians = politicians || [];
      this.db.sources = (await this.idbGet(STORES.SOURCES, 'data')) || [];
      this.db.feed = (await this.idbGet(STORES.FEED, 'data')) || [];
      this.db.config = { ...DEFAULT_CONFIG, ...(await this.idbGet(STORES.CONFIG, 'data') || {}) };
      this.db.potentialSources = (await this.idbGet(STORES.POTENTIAL_SOURCES, 'data')) || [];
      this.db.aspirantDiscovery = (await this.idbGet(STORES.ASPIRANT_DISCOVERY, 'data')) || [];
      this.db.fetchSchedule = { ...DEFAULT_FETCH_SCHEDULE, ...(await this.idbGet(STORES.FETCH_SCHEDULE, 'data') || {}) };
      this.db.candidateContexts = (await this.idbGet(STORES.CANDIDATE_CONTEXTS, 'data')) || [];
      this.db.discoveredSources = (await this.idbGet(STORES.DISCOVERED_SOURCES, 'data')) || [];
      this.db.lastSync = (await this.idbGet(STORES.META, 'lastSync')) || new Date().toISOString();

      console.log(`[DB] Loaded from IndexedDB: ${this.db.politicians.length} politicians, ${this.db.feed.length} feed items`);
      return true;
    } catch (e) {
      console.error('[DB] Failed to load from IndexedDB:', e);
      return false;
    }
  }

  private async migrateFromLocalStorage(): Promise<void> {
    // The constructor already loaded from localStorage into this.db
    await this.saveAllToIDB();
    console.log('[DB] Migration from localStorage complete');
  }

  private async saveAllToIDB(): Promise<void> {
    if (!this.idb) return;
    try {
      await Promise.all([
        this.idbPut(STORES.POLITICIANS, 'data', this.db.politicians),
        this.idbPut(STORES.SOURCES, 'data', this.db.sources),
        this.idbPut(STORES.FEED, 'data', this.db.feed),
        this.idbPut(STORES.CONFIG, 'data', this.db.config),
        this.idbPut(STORES.POTENTIAL_SOURCES, 'data', this.db.potentialSources),
        this.idbPut(STORES.ASPIRANT_DISCOVERY, 'data', this.db.aspirantDiscovery),
        this.idbPut(STORES.FETCH_SCHEDULE, 'data', this.db.fetchSchedule),
        this.idbPut(STORES.CANDIDATE_CONTEXTS, 'data', this.db.candidateContexts),
        this.idbPut(STORES.DISCOVERED_SOURCES, 'data', this.db.discoveredSources),
        this.idbPut(STORES.META, 'lastSync', this.db.lastSync),
      ]);
    } catch (e) {
      console.error('[DB] saveAllToIDB failed:', e);
    }
  }

  // ─── Low-level IDB helpers ───

  private idbGet(storeName: string, key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.idb) { resolve(null); return; }
      try {
        const tx = this.idb.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) {
        resolve(null);
      }
    });
  }

  private idbPut(storeName: string, key: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.idb) { resolve(); return; }
      try {
        const tx = this.idb.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (e) {
        console.error('[DB] idbPut error:', e);
        resolve();
      }
    });
  }

  // ─── LocalStorage fallback (legacy) ───

  private loadFromLocalStorage(): DatabaseSchema {
    try {
      const data = localStorage.getItem('polimetric_db');
      if (data) {
        return { ...getDefaultDB(), ...JSON.parse(data) };
      }
    } catch (e) {
      console.error('Failed to load database from localStorage:', e);
    }
    return getDefaultDB();
  }

  private save(): void {
    // Async write to IndexedDB
    this.saveAllToIDB();
    // Also write to localStorage as backup (best-effort, may fail for large data)
    try {
      const slim = {
        politicians: this.db.politicians,
        sources: this.db.sources,
        feed: this.db.feed.slice(0, 50),
        config: this.db.config,
        lastSync: this.db.lastSync,
      };
      localStorage.setItem('polimetric_db', JSON.stringify(slim));
    } catch (e) {
      // localStorage quota exceeded — IndexedDB will handle persistence
      console.warn('[DB] localStorage backup failed (likely quota), IndexedDB has the data');
    }
  }

  // ─── Public API ───

  /** Wait for IndexedDB to be ready */
  async waitForReady(): Promise<void> {
    await this.idbReady;
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
    this.db.feed = [event, ...this.db.feed].slice(0, 200);
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

  // ─── Candidate Contexts ───

  getCandidateContexts(): CandidateContext[] {
    return this.db.candidateContexts;
  }

  getCandidateContext(politicianId: string): CandidateContext | undefined {
    return this.db.candidateContexts.find((c) => c.politicianId === politicianId);
  }

  setCandidateContext(context: CandidateContext): void {
    const idx = this.db.candidateContexts.findIndex((c) => c.politicianId === context.politicianId);
    if (idx >= 0) {
      this.db.candidateContexts[idx] = context;
    } else {
      this.db.candidateContexts.push(context);
    }
    this.save();
  }

  // ─── Discovered Sources ───

  getDiscoveredSources(): DiscoveredSource[] {
    return this.db.discoveredSources;
  }

  addDiscoveredSource(source: DiscoveredSource): void {
    const existing = this.db.discoveredSources.find((s) => s.domain === source.domain);
    if (existing) {
      existing.lastSeen = source.lastSeen;
      existing.seenCount++;
    } else {
      this.db.discoveredSources.push(source);
    }
    this.save();
  }

  markDiscoveredSourceAccepted(domain: string): void {
    const source = this.db.discoveredSources.find((s) => s.domain === domain);
    if (source) {
      source.accepted = true;
      this.save();
    }
  }

  markDiscoveredSourceRejected(domain: string): void {
    const source = this.db.discoveredSources.find((s) => s.domain === domain);
    if (source) {
      source.rejected = true;
      this.save();
    }
  }

  // ─── Query Helpers ───

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
    // Clear IndexedDB stores
    if (this.idb) {
      for (const storeName of Object.values(STORES)) {
        try {
          const tx = this.idb.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).clear();
        } catch (e) { /* ignore */ }
      }
    }
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
