import { Politician, NewsEvent, Source } from '../types';
import { database, FetchSchedule } from './database';
import { fetchAIEvent } from './geminiService';

export interface FetchResult {
  success: boolean;
  event?: NewsEvent;
  error?: string;
  timestamp: string;
}

class HourlyFetchScheduler {
  private schedulerInterval: NodeJS.Timeout | null = null;
  private fetchIntervalMs: number = 60 * 60 * 1000;
  private isRunning: boolean = false;
  private politicians: Politician[] = [];
  private sources: Source[] = [];
  private onEventFetched: ((event: NewsEvent) => void) | null = null;
  private onScheduleUpdate: ((schedule: FetchSchedule) => void) | null = null;
  private fetchCount: number = 0;
  private lastFetchTime: string = '';

  initialize(
    politicians: Politician[],
    sources: Source[],
    onEventFetched: (event: NewsEvent) => void,
    onScheduleUpdate: (schedule: FetchSchedule) => void
  ): void {
    this.politicians = politicians;
    this.sources = sources;
    this.onEventFetched = onEventFetched;
    this.onScheduleUpdate = onScheduleUpdate;

    const schedule = database.getFetchSchedule();
    this.fetchCount = schedule.fetchCount;
    this.lastFetchTime = schedule.lastFetchTime;
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('Hourly Fetch Scheduler started');

    this.schedulerInterval = setInterval(() => {
      this.runHourlyFetch();
    }, this.fetchIntervalMs);

    this.runHourlyFetch();
  }

  stop(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
    this.isRunning = false;
    console.log('Hourly Fetch Scheduler stopped');
  }

  updatePoliticians(politicians: Politician[]): void {
    this.politicians = politicians;
  }

  setFetchInterval(minutes: number): void {
    this.fetchIntervalMs = minutes * 60 * 1000;
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  async runHourlyFetch(): Promise<FetchResult[]> {
    const results: FetchResult[] = [];
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    console.log(`[${now.toISOString()}] Running hourly fetch cycle ${this.fetchCount + 1}...`);

    for (const politician of this.politicians) {
      try {
        const event = await fetchAIEvent(politician, this.sources);

        if (event && event.headline) {
          const newsEvent: NewsEvent = {
            id: Date.now(),
            politicianId: politician.id,
            sourceId: 'hourly-schedule',
            sourceName: event.sourceName || 'Scheduled Fetch',
            headline: event.headline,
            sentiment: event.sentiment || 'neutral',
            impact: event.impact || 0.5,
            timestamp: event.timestamp || now.toLocaleString(),
            url: event.url,
          };

          database.addFeedEvent(newsEvent);

          if (this.onEventFetched) {
            this.onEventFetched(newsEvent);
          }

          results.push({
            success: true,
            event: newsEvent,
            timestamp: now.toISOString(),
          });

          console.log(`Fetched event for ${politician.name}: ${event.headline}`);
        } else {
          results.push({
            success: false,
            error: 'No event found',
            timestamp: now.toISOString(),
          });
        }

        await new Promise((r) => setTimeout(r, 2000));
      } catch (error: any) {
        console.error(`Error fetching for ${politician.name}:`, error);
        results.push({
          success: false,
          error: error.message,
          timestamp: now.toISOString(),
        });
      }
    }

    this.fetchCount++;
    this.lastFetchTime = now.toISOString();

    const schedule: FetchSchedule = {
      lastFetchTime: this.lastFetchTime,
      nextFetchTime: new Date(now.getTime() + this.fetchIntervalMs).toISOString(),
      fetchCount: this.fetchCount,
      hourlyFetchEnabled: true,
      fetchIntervalMinutes: this.fetchIntervalMs / 60000,
    };

    database.updateFetchSchedule(schedule);

    if (this.onScheduleUpdate) {
      this.onScheduleUpdate(schedule);
    }

    return results;
  }

  getSchedule(): FetchSchedule {
    return database.getFetchSchedule();
  }

  getStats(): { fetchCount: number; lastFetchTime: string; isRunning: boolean } {
    return {
      fetchCount: this.fetchCount,
      lastFetchTime: this.lastFetchTime,
      isRunning: this.isRunning,
    };
  }

  async fetchNow(): Promise<FetchResult[]> {
    return this.runHourlyFetch();
  }
}

export const hourlyFetchScheduler = new HourlyFetchScheduler();
export default hourlyFetchScheduler;
