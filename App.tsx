import React, { useState, useEffect, useCallback, useRef } from 'react';
import { INITIAL_POLITICIANS, INITIAL_SOURCES } from './constants';
import { Politician, Source, NewsEvent, SimulationConfig, SentimentType, AIProviderConfig, ProviderType } from './types';
import { getProvider, getDefaultAIProviderConfig, AIProvider } from './services/aiProvider';
import { fetchRealNewsEvent } from './services/realTimeNewsFetcher';
import {
  calculateAllMetrics,
  calculateAnalyticsSummary,
  calculateVolatility,
  calculateMomentum,
  calculateMediaFrequency,
  calculateSentimentRatio,
  calculateInfluenceScore,
  calculateConsistencyScore,
} from './services/analyticsService';
import { database } from './services/database';
import { Ticker } from './components/Ticker';
import { LeaderboardCard } from './components/LeaderboardCard';
import { TrendChart } from './components/TrendChart';
import { LiveFeed } from './components/LiveFeed';
import { SourceManager } from './components/SourceManager';
import { CandidateManager } from './components/CandidateManager';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { CandidateContextModal } from './components/CandidateContextModal';
import { updateCandidateProfile } from './services/candidateProfileUpdater';
import {
  BarChart3,
  Settings,
  Play,
  Pause,
  Activity,
  AlertTriangle,
  Search,
  Database as DatabaseIcon,
  Loader2,
  RotateCcw,
  X,
  Brain,
  Clock,
  RefreshCw,
  Server,
  Cpu,
  Globe,
  CheckCircle2,
  XCircle,
  Zap,
} from 'lucide-react';

const STORAGE_KEYS = {
  POLITICIANS: 'poli_politicians_v1',
  SOURCES: 'poli_sources_v1',
  FEED: 'poli_feed_v1',
  CONFIG: 'poli_config_v1',
  POTENTIAL_SOURCES: 'poli_potential_sources_v1',
};

export default function App() {
  // Load initial state from Local Storage or Constants
  const [politicians, setPoliticians] = useState<Politician[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.POLITICIANS);
    return saved ? JSON.parse(saved) : INITIAL_POLITICIANS;
  });

  const [sources, setSources] = useState<Source[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SOURCES);
    return saved ? JSON.parse(saved) : INITIAL_SOURCES;
  });

  const [feed, setFeed] = useState<NewsEvent[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FEED);
    return saved ? JSON.parse(saved) : [];
  });

  const [potentialSources, setPotentialSources] = useState<Source[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.POTENTIAL_SOURCES);
    return saved ? JSON.parse(saved) : [];
  });

  const [config, setConfig] = useState<SimulationConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
    const defaults: SimulationConfig = {
      scanInterval: 15000,
      isPaused: false,
      useAI: true,
      autoRefreshCandidates: true,
      historyWindowDays: 60,
      aiProviderConfig: getDefaultAIProviderConfig(),
    };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  const [ollamaStatus, setOllamaStatus] = useState<{ ok: boolean; models: string[] }>({ ok: false, models: [] });

  const [candidateFilter, setCandidateFilter] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [refreshingCandidateId, setRefreshingCandidateId] = useState<string | null>(null);
  const [addingCandidateId, setAddingCandidateId] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState(false);

  // Get the current AI provider
  const currentProvider = getProvider(config.aiProviderConfig);
  const isProviderConfigured = currentProvider.isConfigured;
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedPoliticianId, setSelectedPoliticianId] = useState<string | null>(null);

  // Dynamic Profile Updates (runs periodically to check for party/slogan changes)
  useEffect(() => {
    if (!config.useAI || !isProviderConfigured || config.isPaused) return;

    const runProfileUpdates = async () => {
      // Pick one random politician to check per cycle to avoid spamming
      const target = politicians[Math.floor(Math.random() * politicians.length)];
      if (!target) return;

      const updates = await updateCandidateProfile(target, config.aiProviderConfig);
      if (updates) {
        setPoliticians(prev => prev.map(p => p.id === target.id ? { ...p, ...updates } : p));
      }
    };

    const interval = setInterval(runProfileUpdates, 60 * 60 * 1000); // Check every hour (staggered)
    return () => clearInterval(interval);
  }, [config, isProviderConfigured, politicians]);

  const handleViewContext = (id: string) => setSelectedPoliticianId(id);
  const handleCloseContext = () => setSelectedPoliticianId(null);

  // Persistence Effects - also save to database
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.POLITICIANS, JSON.stringify(politicians));
    database.setPoliticians(politicians);
  }, [politicians]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SOURCES, JSON.stringify(sources));
    database.setSources(sources);
  }, [sources]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FEED, JSON.stringify(feed.slice(0, 100)));
    database.setFeed(feed);
  }, [feed]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.POTENTIAL_SOURCES, JSON.stringify(potentialSources));
    database.setPotentialSources(potentialSources);
  }, [potentialSources]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    database.setConfig(config);
  }, [config]);

  // On mount: auto-detect provider and load data
  useEffect(() => {
    // Auto-detect best available provider from env
    const envConfig = getDefaultAIProviderConfig();
    if (envConfig.geminiApiKey) {
      setConfig(prev => ({ ...prev, useAI: true, aiProviderConfig: { ...prev.aiProviderConfig, geminiApiKey: envConfig.geminiApiKey, provider: prev.aiProviderConfig.provider || 'gemini' } }));
    }
    // Check Ollama availability
    import('./services/providers/ollamaProvider').then(({ OllamaProvider }) => {
      OllamaProvider.checkConnection(config.aiProviderConfig.ollamaUrl).then(setOllamaStatus);
    });
    // Load historical context
    loadHistoricalContext();
  }, []);

  // Updated to use SEQUENTIAL requests to avoid 429 Errors
  const loadHistoricalContext = async () => {
    setIsHistoryLoading(true);

    // Create a copy of IDs to iterate over. We use the initial state 'politicians'
    // available in closure, which is fine for the mount effect.
    // If we wanted to ensure we had absolutely latest, we'd use a ref, but IDs rarely change on mount.
    const targets = [...politicians];

    for (const pol of targets) {
      // Double check against current state in case something changed rapidly
      // This also ensures we don't overwrite user edits if possible, though this runs on mount.
      const hasHistory = pol.history.some((h) => h.time !== '');
      const hasPlaceholderImage =
        pol.image.includes('ui-avatars.com') || pol.image.includes('wikipedia');

      if (hasHistory && !hasPlaceholderImage) {
        continue;
      }

      try {
        // Process one politician at a time
        const provider = getProvider(config.aiProviderConfig);
        const fetchPromises = [];
        if (!hasHistory && provider.isConfigured) fetchPromises.push(provider.fetchHistory(pol, config.historyWindowDays));
        else fetchPromises.push(Promise.resolve(null));

        if (hasPlaceholderImage && provider.isConfigured) fetchPromises.push(provider.fetchImage(pol.name));
        else fetchPromises.push(Promise.resolve(null));

        // Execute fetches for THIS politician
        const [history, image] = await Promise.all(fetchPromises);

        // Update State Incrementally
        setPoliticians((prev) =>
          prev.map((p) => {
            if (p.id === pol.id) {
              return {
                ...p,
                history: history && history.length > 0 ? history : p.history,
                score: history && history.length > 0 ? history[history.length - 1].score : p.score,
                image: image || p.image,
              };
            }
            return p;
          })
        );

        // Force a small delay to respect rate limits between candidates
        await new Promise((r) => setTimeout(r, 2000));
      } catch (e) {
        console.error(`Error loading context for ${pol.name}`, e);
      }
    }

    setIsHistoryLoading(false);
  };

  const handleResetData = () => {
    if (
      confirm(
        'Are you sure you want to reset all data? This will clear all tracked stats, sources, and history.'
      )
    ) {
      localStorage.removeItem(STORAGE_KEYS.POLITICIANS);
      localStorage.removeItem(STORAGE_KEYS.SOURCES);
      localStorage.removeItem(STORAGE_KEYS.FEED);
      localStorage.removeItem(STORAGE_KEYS.POTENTIAL_SOURCES);
      localStorage.removeItem(STORAGE_KEYS.CONFIG);

      window.location.reload();
    }
  };

  // Mock event generation removed — production mode uses real data only

  const processEvent = useCallback((event: NewsEvent) => {
    setFeed((prev) => [event, ...prev].slice(0, 50));

    setPoliticians((prevPols) => {
      return prevPols.map((p) => {
        if (p.id !== event.politicianId) {
          return p;
        }

        let change = 0;
        if (event.sentiment === 'positive') change = event.impact;
        if (event.sentiment === 'negative') change = -event.impact;

        const newScore = parseFloat((p.score + change).toFixed(2));

        // Append new live point to history
        const today = new Date().toISOString().split('T')[0];

        const newHistoryItem = {
          time: today,
          score: newScore,
          reason: 'Live: ' + event.headline,
          sourceUrl: event.url, // Persist URL to history
        };

        // Keep history size manageable
        const newHistory = [...p.history, newHistoryItem].slice(-50);

        return {
          ...p,
          score: newScore,
          trend: change,
          history: newHistory,
        };
      });
    });
  }, []);

  const runSimulationStep = async () => {
    if (config.isPaused || isHistoryLoading) return;
    if (politicians.length === 0) return;

    const targetPolitician = politicians[Math.floor(Math.random() * politicians.length)];
    const provider = getProvider(config.aiProviderConfig);

    try {
      // Always use real-time news fetching — no mock data
      const aiData = await fetchRealNewsEvent(targetPolitician, sources, provider);

      if (aiData && aiData.headline) {
        const event: NewsEvent = {
          id: Date.now(),
          politicianId: targetPolitician.id,
          sourceId: `${config.aiProviderConfig.provider}-live`,
          sourceName: aiData.sourceName || provider.name,
          headline: aiData.headline || 'Update received',
          sentiment: aiData.sentiment || 'neutral',
          impact: aiData.impact || 0.5,
          timestamp: aiData.timestamp || new Date().toLocaleString(),
          url: aiData.url,
        };
        processEvent(event);
      }
    } catch (err) {
      console.error('[App] Real-time fetch error:', err);
    }
  };

  // Simulation Loop
  useEffect(() => {
    const interval = setInterval(runSimulationStep, config.scanInterval);
    return () => clearInterval(interval);
  }, [config, politicians, sources, isHistoryLoading]);

  // Handlers
  const handleScanForSources = async () => {
    setIsScanning(true);
    const provider = getProvider(config.aiProviderConfig);
    if (provider.isConfigured) {
      const newSuggestions = await provider.fetchSuggestedSources(sources);
      if (newSuggestions && newSuggestions.length > 0) {
        const newPotentials = newSuggestions.map(
          (s) =>
            ({
              id: `p-${Date.now()}-${Math.random()}`,
              name: s.name || 'Unknown',
              type: s.type || 'news',
              weight: s.weight || 1.5,
              active: true,
            }) as Source
        );
        setPotentialSources((prev) => [...prev, ...newPotentials]);
      }
    } else {
      await new Promise((r) => setTimeout(r, 1500));
    }
    setIsScanning(false);
  };

  const handleAcceptSource = (source: Source) => {
    setSources((prev) => [...prev, { ...source, id: `s-${Date.now()}` }]);
    setPotentialSources((prev) => prev.filter((p) => p.id !== source.id));
  };

  const handleRejectSource = (id: string) => {
    setPotentialSources((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddCandidate = async (candidate: Politician) => {
    setPoliticians((prev) => [...prev, candidate]);
    const provider = getProvider(config.aiProviderConfig);

    if (provider.isConfigured) {
      setAddingCandidateId(true);
      try {
        const [history, image] = await Promise.all([
          provider.fetchHistory(candidate, config.historyWindowDays),
          provider.fetchImage(candidate.name),
        ]);

        setPoliticians((prev) =>
          prev.map((p) => {
            if (p.id === candidate.id) {
              return {
                ...p,
                history: history && history.length > 0 ? history : p.history,
                score: history && history.length > 0 ? history[history.length - 1].score : p.score,
                image: image || p.image,
              };
            }
            return p;
          })
        );
      } catch (e) {
        console.error('Failed to analyze new candidate', e);
      } finally {
        setAddingCandidateId(false);
      }
    }
  };

  const handleDeleteCandidate = (id: string) => {
    setPoliticians((prev) => prev.filter((p) => p.id !== id));
  };

  const handleRefreshCandidate = async (id: string) => {
    const pol = politicians.find((p) => p.id === id);
    if (!pol || refreshingCandidateId) return;

    setRefreshingCandidateId(id);
    const provider = getProvider(config.aiProviderConfig);

    try {
      if (provider.isConfigured) {
        const aiData = await fetchRealNewsEvent(pol, sources, provider);
        if (aiData && aiData.headline) {
          const event: NewsEvent = {
            id: Date.now(),
            politicianId: pol.id,
            sourceId: `${config.aiProviderConfig.provider}-manual`,
            sourceName: aiData.sourceName || provider.name,
            headline: aiData.headline,
            sentiment: aiData.sentiment || 'neutral',
            impact: aiData.impact || 0.5,
            timestamp: aiData.timestamp || new Date().toLocaleString(),
            url: aiData.url,
          };
          processEvent(event);
        }

        const [history, image] = await Promise.all([
          provider.fetchHistory(pol, config.historyWindowDays),
          provider.fetchImage(pol.name),
        ]);

        setPoliticians((prev) =>
          prev.map((p) => {
            if (p.id === id) {
              return {
                ...p,
                history: history && history.length > 0 ? history : p.history,
                score: history && history.length > 0 ? history[history.length - 1].score : p.score,
                image: image || p.image,
              };
            }
            return p;
          })
        );
      }
    } catch (e) {
      console.error('Refresh failed', e);
    } finally {
      setRefreshingCandidateId(null);
    }
  };

  const togglePause = () => setConfig((prev) => ({ ...prev, isPaused: !prev.isPaused }));
  const addSource = (source: Source) => setSources((prev) => [...prev, source]);
  const removeSource = (id: string) => setSources((prev) => prev.filter((s) => s.id !== id));

  const handleImportData = (data: {
    politicians: Politician[];
    feed: NewsEvent[];
    sources: Source[];
  }) => {
    setPoliticians(data.politicians);
    setFeed(data.feed);
    setSources(data.sources);
  };

  // Filter and Sort
  const filteredPoliticians = politicians.filter(
    (p) =>
      p.name.toLowerCase().includes(candidateFilter.toLowerCase()) ||
      p.party.toLowerCase().includes(candidateFilter.toLowerCase())
  );
  const sortedPoliticians = [...filteredPoliticians].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12 relative">
      {/* Navbar */}
      <nav className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Activity className="text-indigo-400" />
              <span className="text-xl font-bold tracking-tight">
                PoliMetric <span className="text-slate-400 font-normal">| Kenya 2027</span>
              </span>
              <span className="ml-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse font-bold tracking-wider">
                LIVE
              </span>
            </div>
            <div className="flex items-center space-x-4 relative">
              {addingCandidateId && (
                <div className="flex items-center gap-2 text-indigo-300 text-xs">
                  <Loader2 size={12} className="animate-spin" />
                  Analyzing New Candidate...
                </div>
              )}
              <button
                onClick={togglePause}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${config.isPaused ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-700 hover:bg-slate-600'}`}
              >
                {config.isPaused ? (
                  <>
                    <Play size={14} /> Resume
                  </>
                ) : (
                  <>
                    <Pause size={14} /> Pause
                  </>
                )}
              </button>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-md text-slate-300 hover:bg-slate-700 hover:text-white transition-colors ${showSettings ? 'bg-slate-700 text-white' : ''}`}
                title="Settings"
              >
                <Settings size={18} />
              </button>

              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className={`p-2 rounded-md text-slate-300 hover:bg-slate-700 hover:text-white transition-colors ${showAnalytics ? 'bg-slate-700 text-white' : ''}`}
                title="Analytics Dashboard"
              >
                <Brain size={18} />
              </button>

              <button
                onClick={handleResetData}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-rose-900/50 hover:bg-rose-900 text-rose-200 transition-colors"
                title="Reset all tracked data"
              >
                <RotateCcw size={14} />
                Reset
              </button>

              {/* Settings Dropdown */}
              {showSettings && (
                <div className="absolute top-12 right-0 w-80 bg-white shadow-xl rounded-xl border border-slate-200 p-4 z-50 text-slate-800" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                  <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                      <Settings size={14} /> Configuration
                    </h4>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="space-y-4">
                    {/* AI Provider Selection */}
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI Provider</span>
                      <div className="mt-2 space-y-1.5">
                        {[
                          { key: 'gemini' as ProviderType, label: 'Gemini (Google)', icon: <Globe size={13} />, configured: !!config.aiProviderConfig.geminiApiKey },
                          { key: 'ollama' as ProviderType, label: `Ollama (Local)`, icon: <Server size={13} />, configured: ollamaStatus.ok },
                          { key: 'huggingface' as ProviderType, label: 'HuggingFace (Free)', icon: <Cpu size={13} />, configured: !!config.aiProviderConfig.huggingfaceApiKey },
                          { key: 'openrouter' as ProviderType, label: 'OpenRouter (Free)', icon: <Zap size={13} />, configured: !!config.aiProviderConfig.openrouterApiKey },
                        ].map(p => (
                          <button
                            key={p.key}
                            onClick={() => setConfig(prev => ({ ...prev, aiProviderConfig: { ...prev.aiProviderConfig, provider: p.key } }))}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${config.aiProviderConfig.provider === p.key
                              ? 'bg-indigo-50 border border-indigo-300 text-indigo-700'
                              : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              {p.icon}
                              {p.label}
                            </div>
                            <div className="flex items-center gap-1">
                              {p.configured ? <CheckCircle2 size={12} className="text-emerald-500" /> : <XCircle size={12} className="text-slate-300" />}
                              {config.aiProviderConfig.provider === p.key && <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">ACTIVE</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Ollama Config */}
                    {config.aiProviderConfig.provider === 'ollama' && (
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                        <span className="text-xs font-bold text-slate-500">Ollama Settings</span>
                        <div>
                          <label className="text-[10px] text-slate-400">Server URL</label>
                          <input
                            type="text"
                            value={config.aiProviderConfig.ollamaUrl}
                            onChange={(e) => setConfig(prev => ({ ...prev, aiProviderConfig: { ...prev.aiProviderConfig, ollamaUrl: e.target.value } }))}
                            className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 focus:border-indigo-500 focus:outline-none mt-0.5"
                            placeholder="http://localhost:11434"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Model</label>
                          <input
                            type="text"
                            value={config.aiProviderConfig.ollamaModel}
                            onChange={(e) => setConfig(prev => ({ ...prev, aiProviderConfig: { ...prev.aiProviderConfig, ollamaModel: e.target.value } }))}
                            className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 focus:border-indigo-500 focus:outline-none mt-0.5"
                            placeholder="llama3"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          {ollamaStatus.ok ? (
                            <><CheckCircle2 size={12} className="text-emerald-500" /><span className="text-[10px] text-emerald-600">Connected • {ollamaStatus.models.length} model(s)</span></>
                          ) : (
                            <><XCircle size={12} className="text-rose-400" /><span className="text-[10px] text-rose-500">Not connected</span></>
                          )}
                          <button
                            onClick={async () => {
                              const { OllamaProvider } = await import('./services/providers/ollamaProvider');
                              const status = await OllamaProvider.checkConnection(config.aiProviderConfig.ollamaUrl);
                              setOllamaStatus(status);
                            }}
                            className="text-[10px] text-indigo-600 hover:underline ml-auto"
                          >
                            Test
                          </button>
                        </div>
                        {ollamaStatus.ok && ollamaStatus.models.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {ollamaStatus.models.slice(0, 6).map(m => (
                              <button
                                key={m}
                                onClick={() => setConfig(prev => ({ ...prev, aiProviderConfig: { ...prev.aiProviderConfig, ollamaModel: m } }))}
                                className={`text-[9px] px-1.5 py-0.5 rounded border ${config.aiProviderConfig.ollamaModel === m ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* HuggingFace Config */}
                    {config.aiProviderConfig.provider === 'huggingface' && (
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                        <span className="text-xs font-bold text-slate-500">HuggingFace API Key</span>
                        <input
                          type="password"
                          value={config.aiProviderConfig.huggingfaceApiKey}
                          onChange={(e) => setConfig(prev => ({ ...prev, aiProviderConfig: { ...prev.aiProviderConfig, huggingfaceApiKey: e.target.value } }))}
                          className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 focus:border-indigo-500 focus:outline-none"
                          placeholder="hf_xxxxxxxxxxxxx"
                        />
                        <p className="text-[10px] text-slate-400">Free tier at huggingface.co/settings/tokens</p>
                      </div>
                    )}

                    {/* OpenRouter Config */}
                    {config.aiProviderConfig.provider === 'openrouter' && (
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                        <span className="text-xs font-bold text-slate-500">OpenRouter API Key</span>
                        <input
                          type="password"
                          value={config.aiProviderConfig.openrouterApiKey}
                          onChange={(e) => setConfig(prev => ({ ...prev, aiProviderConfig: { ...prev.aiProviderConfig, openrouterApiKey: e.target.value } }))}
                          className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 focus:border-indigo-500 focus:outline-none"
                          placeholder="sk-or-xxxxxxxxxxxxx"
                        />
                        <p className="text-[10px] text-slate-400">Free tier at openrouter.ai/keys</p>
                      </div>
                    )}

                    <hr className="border-slate-100" />

                    {/* Existing settings */}
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700">
                          Auto-Refresh Stats
                        </span>
                        <span className="text-[10px] text-slate-400">Fetch new data every 30m</span>
                      </div>
                      <button
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            autoRefreshCandidates: !prev.autoRefreshCandidates,
                          }))
                        }
                        className={`w-10 h-5 rounded-full relative transition-colors ${config.autoRefreshCandidates ? 'bg-indigo-600' : 'bg-slate-300'}`}
                      >
                        <span
                          className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${config.autoRefreshCandidates ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700">History Window</span>
                        <span className="text-[10px] text-slate-400">
                          Days of historical data to fetch
                        </span>
                      </div>
                      <select
                        value={config.historyWindowDays}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            historyWindowDays: parseInt(e.target.value),
                          }))
                        }
                        className="text-sm border border-slate-300 rounded px-2 py-1 focus:border-indigo-500 focus:outline-none"
                      >
                        <option value={60}>60 days</option>
                        <option value={90}>90 days</option>
                        <option value={120}>120 days</option>
                        <option value={180}>180 days</option>
                        <option value={365}>365 days</option>
                      </select>
                    </div>
                    <div className="text-[10px] text-slate-400 bg-slate-50 p-2 rounded">
                      Provider: <strong>{currentProvider.name}</strong> • {isProviderConfigured ? 'Configured ✓' : 'Not configured'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Ticker */}
      <Ticker events={feed} />

      {/* Provider Status Banner */}
      {!isProviderConfigured && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2 text-xs text-center flex items-center justify-center gap-2">
          <AlertTriangle size={14} />
          <span>
            No AI provider configured. Open <strong>Settings</strong> to select a provider (Gemini, Ollama, HuggingFace, or OpenRouter). Real-time news fetching is active but sentiment analysis requires a provider.
          </span>
        </div>
      )}

      {/* Main Dashboard */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Intro */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              2027 Presidential Sentiment Tracker
            </h1>
            <p className="text-slate-500 max-w-2xl text-sm leading-relaxed">
              Real-time AI analysis of the Kenyan political landscape. Tracking sentiment velocity
              across news, social media, and verified web sources for the upcoming General Election.
            </p>
          </div>
          <div className="text-right hidden md:block">
            <div className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">
              Data Stream
            </div>
            <div className="flex items-center gap-2 justify-end">
              {isHistoryLoading ? (
                <div className="flex items-center gap-2 text-amber-500">
                  <DatabaseIcon size={14} className="animate-bounce" />
                  <span className="text-sm font-medium">Backfilling History...</span>
                </div>
              ) : (
                <>
                  <div className={`h-2 w-2 rounded-full ${isProviderConfigured ? 'bg-emerald-500' : 'bg-amber-400'} animate-pulse`}></div>
                  <span className="text-sm font-medium text-slate-700">
                    {currentProvider.name} {isProviderConfigured ? '• Live' : '• Unconfigured'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Stats & Charts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Leaderboard Grid */}
            {sortedPoliticians.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedPoliticians.map((pol, idx) => (
                  <LeaderboardCard
                    key={pol.id}
                    politician={pol}
                    rank={idx + 1}
                    onRefresh={handleRefreshCandidate}
                    onRemove={handleDeleteCandidate}
                    isRefreshing={refreshingCandidateId === pol.id}
                    autoRefreshEnabled={config.autoRefreshCandidates}
                    volatility={calculateVolatility(pol.history)}
                    momentum={calculateMomentum(pol.history)}
                    mediaFrequency={calculateMediaFrequency(feed, pol.id)}
                    sentimentRatio={calculateSentimentRatio(pol.history)}
                    influenceScore={calculateInfluenceScore(pol.history, sources, feed)}
                    consistencyScore={calculateConsistencyScore(pol.history)}
                    onViewContext={handleViewContext}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-400">No candidates match your filter.</p>
              </div>
            )}

            {/* Main Trend Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <BarChart3 size={20} className="text-indigo-600" />
                  {config.historyWindowDays <= 60
                    ? '60-Day Trend Velocity'
                    : config.historyWindowDays <= 90
                      ? '90-Day Trend Velocity'
                      : config.historyWindowDays <= 120
                        ? '120-Day Trend Velocity'
                        : config.historyWindowDays <= 180
                          ? '6-Month Trend Velocity'
                          : '1-Year Trend Velocity'}
                </h3>
                <div className="flex gap-2">
                  <span className="text-xs font-medium px-2 py-1 bg-slate-100 rounded text-slate-600">
                    Historical & Live
                  </span>
                </div>
              </div>
              {isHistoryLoading ? (
                <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm italic">
                  Analyzing recent political data...
                </div>
              ) : (
                <TrendChart
                  politicians={politicians}
                  historyWindowDays={config.historyWindowDays}
                />
              )}
            </div>

            {/* Analytics Dashboard */}
            {showAnalytics && (
              <AnalyticsDashboard
                politicians={politicians}
                feed={feed}
                sources={sources}
                onImport={handleImportData}
              />
            )}

            {/* Mobile Candidates & Sources */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:hidden">
              <CandidateManager
                candidates={politicians}
                onAddCandidate={handleAddCandidate}
                onDeleteCandidate={handleDeleteCandidate}
                filterText={candidateFilter}
                onFilterChange={setCandidateFilter}
              />
              <SourceManager
                sources={sources}
                potentialSources={potentialSources}
                onAddSource={addSource}
                onRemoveSource={removeSource}
                onAcceptSource={handleAcceptSource}
                onRejectSource={handleRejectSource}
                onScan={handleScanForSources}
                isScanning={isScanning}
              />
            </div>
          </div>

          {/* Right Column: Feed & Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* Live Feed */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-[500px] flex flex-col">
              <LiveFeed feed={feed} />
            </div>

            {/* Desktop: Candidate Manager */}
            <div className="hidden lg:block">
              <CandidateManager
                candidates={politicians}
                onAddCandidate={handleAddCandidate}
                onDeleteCandidate={handleDeleteCandidate}
                filterText={candidateFilter}
                onFilterChange={setCandidateFilter}
              />
            </div>

            {/* Desktop: Source Manager */}
            <div className="hidden lg:block h-[350px]">
              <SourceManager
                sources={sources}
                potentialSources={potentialSources}
                onAddSource={addSource}
                onRemoveSource={removeSource}
                onAcceptSource={handleAcceptSource}
                onRejectSource={handleRejectSource}
                onScan={handleScanForSources}
                isScanning={isScanning}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Candidate Context Modal */}
      {selectedPoliticianId && (
        (() => {
          const pol = politicians.find(p => p.id === selectedPoliticianId);
          if (!pol) return null;
          const metrics = calculateAllMetrics(pol, feed, sources);
          return (
            <CandidateContextModal
              politician={pol}
              metrics={metrics}
              onClose={handleCloseContext}
              config={config}
              feed={feed}
            />
          );
        })()
      )}
    </div>
  );
}

