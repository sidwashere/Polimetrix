import React, { useState, useEffect, useCallback, useRef } from 'react';
import { INITIAL_POLITICIANS, INITIAL_SOURCES, MOCK_HEADLINES } from './constants';
import { Politician, Source, NewsEvent, SimulationConfig, SentimentType } from './types';
import { fetchAIEvent, fetchSuggestedSources, fetchHistoricalStats, fetchCandidateImage } from './services/geminiService';
import { calculateAllMetrics, calculateAnalyticsSummary, calculateVolatility, calculateMomentum, calculateMediaFrequency, calculateSentimentRatio, calculateInfluenceScore, calculateConsistencyScore } from './services/analyticsService';
import { Ticker } from './components/Ticker';
import { LeaderboardCard } from './components/LeaderboardCard';
import { TrendChart } from './components/TrendChart';
import { LiveFeed } from './components/LiveFeed';
import { SourceManager } from './components/SourceManager';
import { CandidateManager } from './components/CandidateManager';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { BarChart3, Settings, Play, Pause, Activity, AlertTriangle, Search, Database, Loader2, RotateCcw, X, Brain } from 'lucide-react';

const STORAGE_KEYS = {
    POLITICIANS: 'poli_politicians_v1',
    SOURCES: 'poli_sources_v1',
    FEED: 'poli_feed_v1',
    CONFIG: 'poli_config_v1',
    POTENTIAL_SOURCES: 'poli_potential_sources_v1'
};

const calculateVolatility = (history: Politician['history']): number => {
    if (history.length < 2) return 0;
    const scores = history.filter(h => h.time).map(h => h.score);
    if (scores.length < 2) return 0;
    
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    return Math.sqrt(variance);
};

const calculateMomentum = (history: Politician['history']): number => {
    if (history.length < 7) return 0;
    
    const validHistory = history.filter(h => h.time);
    if (validHistory.length < 14) return 0;
    
    const recent7 = validHistory.slice(-7);
    const prev7 = validHistory.slice(-14, -7);
    
    const recentAvg = recent7.reduce((a, b) => a + b.score, 0) / recent7.length;
    const prevAvg = prev7.reduce((a, b) => a + b.score, 0) / prev7.length;
    
    return parseFloat((recentAvg - prevAvg).toFixed(2));
};

const calculateMediaFrequency = (feed: NewsEvent[], politicianId: string): number => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return feed.filter(event => {
        const eventDate = new Date(event.timestamp);
        return event.politicianId === politicianId && eventDate >= thirtyDaysAgo;
    }).length;
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
      const defaults = {
        scanInterval: 8000, 
        isPaused: false,
        useAI: false,
        autoRefreshCandidates: true,
        historyWindowDays: 180
      };
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  const [candidateFilter, setCandidateFilter] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [refreshingCandidateId, setRefreshingCandidateId] = useState<string | null>(null);
  const [addingCandidateId, setAddingCandidateId] = useState<boolean>(false);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Persistence Effects
  useEffect(() => {
      localStorage.setItem(STORAGE_KEYS.POLITICIANS, JSON.stringify(politicians));
  }, [politicians]);

  useEffect(() => {
      localStorage.setItem(STORAGE_KEYS.SOURCES, JSON.stringify(sources));
  }, [sources]);

  useEffect(() => {
      localStorage.setItem(STORAGE_KEYS.FEED, JSON.stringify(feed.slice(0, 50)));
  }, [feed]);

  useEffect(() => {
      localStorage.setItem(STORAGE_KEYS.POTENTIAL_SOURCES, JSON.stringify(potentialSources));
  }, [potentialSources]);

  useEffect(() => {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  }, [config]);

  // Check for API key on mount and re-validate/fetch missing data
  useEffect(() => {
    if (!process.env.API_KEY) {
      setIsApiKeyMissing(true);
      setConfig(prev => ({ ...prev, useAI: false }));
    } else {
        setConfig(prev => ({ ...prev, useAI: true }));
        // Trigger check for missing data on all candidates
        loadHistoricalContext();
    }
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
        const hasHistory = pol.history.some(h => h.time !== '');
        const hasPlaceholderImage = pol.image.includes('ui-avatars.com') || pol.image.includes('wikipedia'); 

        if (hasHistory && !hasPlaceholderImage) {
            continue;
        }

        try {
            // Process one politician at a time
            const fetchPromises = [];
            if (!hasHistory) fetchPromises.push(fetchHistoricalStats(pol, config.historyWindowDays));
            else fetchPromises.push(Promise.resolve(null));

            if (hasPlaceholderImage) fetchPromises.push(fetchCandidateImage(pol.name));
            else fetchPromises.push(Promise.resolve(null));

            // Execute fetches for THIS politician
            const [history, image] = await Promise.all(fetchPromises);

            // Update State Incrementally
            setPoliticians(prev => prev.map(p => {
                if (p.id === pol.id) {
                    return {
                        ...p,
                        history: history && history.length > 0 ? history : p.history,
                        score: history && history.length > 0 ? history[history.length - 1].score : p.score,
                        image: image || p.image
                    };
                }
                return p;
            }));

            // Force a small delay to respect rate limits between candidates
            await new Promise(r => setTimeout(r, 2000));

        } catch (e) {
            console.error(`Error loading context for ${pol.name}`, e);
        }
    }
    
    setIsHistoryLoading(false);
  };

  const handleResetData = () => {
      if (confirm("Are you sure you want to reset all data? This will clear all tracked stats, sources, and history.")) {
          localStorage.removeItem(STORAGE_KEYS.POLITICIANS);
          localStorage.removeItem(STORAGE_KEYS.SOURCES);
          localStorage.removeItem(STORAGE_KEYS.FEED);
          localStorage.removeItem(STORAGE_KEYS.POTENTIAL_SOURCES);
          localStorage.removeItem(STORAGE_KEYS.CONFIG);
          
          window.location.reload();
      }
  };

  const generateMockEvent = (pols: Politician[], srcs: Source[]): NewsEvent => {
    const pol = pols[Math.floor(Math.random() * pols.length)];
    const src = srcs[Math.floor(Math.random() * srcs.length)] || { id: 'mock', name: 'Unknown', weight: 1 };
    
    // Weighted random sentiment
    const r = Math.random();
    let sentiment: SentimentType = 'neutral';
    if (r < 0.4) sentiment = 'positive';
    else if (r < 0.8) sentiment = 'negative';

    const templates = MOCK_HEADLINES[sentiment];
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // Impact calculation
    let baseImpact = (Math.random() * 1.5) + 0.5;
    if (sentiment === 'neutral') baseImpact = 0.1;
    const actualImpact = parseFloat((baseImpact * (src.weight / 2)).toFixed(2));

    return {
      id: Date.now(),
      politicianId: pol.id,
      sourceId: src.id,
      sourceName: src.name,
      headline: `${pol.name} ${template}`,
      sentiment,
      impact: actualImpact,
      timestamp: new Date().toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
      }),
      // Placeholder for mock events - in prod this should be real
      url: 'https://news.google.com' 
    };
  };

  const processEvent = useCallback((event: NewsEvent) => {
    setFeed(prev => [event, ...prev].slice(0, 50));

    setPoliticians(prevPols => {
      return prevPols.map(p => {
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
            reason: "Live: " + event.headline,
            sourceUrl: event.url // Persist URL to history
        };
        
        // Keep history size manageable
        const newHistory = [...p.history, newHistoryItem].slice(-50); 

        return {
          ...p,
          score: newScore,
          trend: change,
          history: newHistory
        };
      });
    });
  }, []);

  const runSimulationStep = async () => {
    if (config.isPaused || isHistoryLoading) return;

    let event: NewsEvent | null = null;
    const targetPolitician = politicians[Math.floor(Math.random() * politicians.length)];

    if (config.useAI && !isApiKeyMissing) {
       // Real-Time Google Search via Gemini
       const aiData = await fetchAIEvent(targetPolitician, sources);
       
       if (aiData && aiData.headline) {
           event = {
               id: Date.now(),
               politicianId: targetPolitician.id,
               sourceId: 'google-search-gen',
               sourceName: aiData.sourceName || 'Web Search',
               headline: aiData.headline || 'Update received',
               sentiment: aiData.sentiment || 'neutral',
               impact: aiData.impact || 0.5,
               timestamp: aiData.timestamp || new Date().toLocaleString(),
               url: aiData.url
           } as NewsEvent;
       }
    } 
    
    if (!event && !config.useAI) {
        event = generateMockEvent(politicians, sources);
    }

    if (event) processEvent(event);
  };

  // Simulation Loop
  useEffect(() => {
    const interval = setInterval(runSimulationStep, config.scanInterval);
    return () => clearInterval(interval);
  }, [config, politicians, sources, isHistoryLoading]); 

  // Handlers
  const handleScanForSources = async () => {
    setIsScanning(true);
    if (config.useAI && !isApiKeyMissing) {
       const newSuggestions = await fetchSuggestedSources(sources);
       if (newSuggestions && newSuggestions.length > 0) {
         const newPotentials = newSuggestions.map(s => ({
            id: `p-${Date.now()}-${Math.random()}`,
            name: s.name || 'Unknown',
            type: s.type || 'news',
            weight: s.weight || 1.5,
            active: true
         } as Source));
         setPotentialSources(prev => [...prev, ...newPotentials]);
       }
    } else {
        await new Promise(r => setTimeout(r, 1500));
        setIsScanning(false);
    }
    setIsScanning(false);
  };

  const handleAcceptSource = (source: Source) => {
      setSources(prev => [...prev, { ...source, id: `s-${Date.now()}` }]);
      setPotentialSources(prev => prev.filter(p => p.id !== source.id));
  };

  const handleRejectSource = (id: string) => {
      setPotentialSources(prev => prev.filter(p => p.id !== id));
  };
  
  const handleAddCandidate = async (candidate: Politician) => {
      setPoliticians(prev => [...prev, candidate]);
      
       if (config.useAI && !isApiKeyMissing) {
           setAddingCandidateId(true);
           try {
              const [history, image] = await Promise.all([
                  fetchHistoricalStats(candidate, config.historyWindowDays),
                  fetchCandidateImage(candidate.name)
              ]);

             setPoliticians(prev => prev.map(p => {
                 if (p.id === candidate.id) {
                     return {
                         ...p,
                         history: history && history.length > 0 ? history : p.history,
                         score: history && history.length > 0 ? history[history.length - 1].score : p.score,
                         image: image || p.image
                     };
                 }
                 return p;
             }));
          } catch(e) {
              console.error("Failed to analyze new candidate", e);
          } finally {
              setAddingCandidateId(false);
          }
      }
  };

  const handleDeleteCandidate = (id: string) => {
      setPoliticians(prev => prev.filter(p => p.id !== id));
  };

  const handleRefreshCandidate = async (id: string) => {
      const pol = politicians.find(p => p.id === id);
      if (!pol || refreshingCandidateId) return;

      setRefreshingCandidateId(id);

      try {
          if (config.useAI && !isApiKeyMissing) {
              const aiData = await fetchAIEvent(pol, sources);
              if (aiData && aiData.headline) {
                   const event: NewsEvent = {
                       id: Date.now(),
                       politicianId: pol.id,
                       sourceId: 'google-search-manual',
                       sourceName: aiData.sourceName || 'Web Search',
                       headline: aiData.headline,
                       sentiment: aiData.sentiment || 'neutral',
                       impact: aiData.impact || 0.5,
                       timestamp: aiData.timestamp || new Date().toLocaleString(),
                       url: aiData.url
                   };
                   processEvent(event);
              }
              
               const [history, image] = await Promise.all([
                  fetchHistoricalStats(pol, config.historyWindowDays),
                  fetchCandidateImage(pol.name)
              ]);

             setPoliticians(prev => prev.map(p => {
                 if (p.id === id) {
                     return {
                         ...p,
                         history: history && history.length > 0 ? history : p.history,
                         score: history && history.length > 0 ? history[history.length - 1].score : p.score,
                         image: image || p.image
                     };
                 }
                 return p;
             }));
          }
      } catch (e) {
          console.error("Refresh failed", e);
      } finally {
          setRefreshingCandidateId(null);
      }
  };

const togglePause = () => setConfig(prev => ({ ...prev, isPaused: !prev.isPaused }));
  const addSource = (source: Source) => setSources(prev => [...prev, source]);
  const removeSource = (id: string) => setSources(prev => prev.filter(s => s.id !== id));

  const handleImportData = (data: { politicians: Politician[], feed: NewsEvent[], sources: Source[] }) => {
    setPoliticians(data.politicians);
    setFeed(data.feed);
    setSources(data.sources);
  };

  // Filter and Sort
  const filteredPoliticians = politicians.filter(p => 
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
                    <span className="text-xl font-bold tracking-tight">PoliMetric <span className="text-slate-400 font-normal">| Kenya 2027</span></span>
                    <span className="ml-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse font-bold tracking-wider">LIVE</span>
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
                        {config.isPaused ? <><Play size={14}/> Resume</> : <><Pause size={14}/> Pause</>}
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
                        <div className="absolute top-12 right-0 w-72 bg-white shadow-xl rounded-xl border border-slate-200 p-4 z-50 animate-in fade-in slide-in-from-top-2 text-slate-800">
                            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                                <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                                    <Settings size={14} /> Configuration
                                </h4>
                                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={14} />
                                </button>
                            </div>
                             <div className="space-y-4">
                                 <div className="flex items-center justify-between">
                                     <div className="flex flex-col">
                                         <span className="text-sm font-medium text-slate-700">Auto-Refresh Stats</span>
                                         <span className="text-[10px] text-slate-400">Fetch new data every 30m</span>
                                     </div>
                                     <button 
                                         onClick={() => setConfig(prev => ({...prev, autoRefreshCandidates: !prev.autoRefreshCandidates}))}
                                         className={`w-10 h-5 rounded-full relative transition-colors ${config.autoRefreshCandidates ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                     >
                                         <span className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${config.autoRefreshCandidates ? 'translate-x-5' : 'translate-x-0'}`} />
                                     </button>
                                 </div>
                                 <div className="flex items-center justify-between">
                                     <div className="flex flex-col">
                                         <span className="text-sm font-medium text-slate-700">History Window</span>
                                         <span className="text-[10px] text-slate-400">Days of historical data to fetch</span>
                                     </div>
                                     <select 
                                         value={config.historyWindowDays}
                                         onChange={(e) => setConfig(prev => ({...prev, historyWindowDays: parseInt(e.target.value)}))}
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
                                     Note: Auto-refresh performs a deep analysis of each candidate using current sources.
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

      {/* API Key Warning */}
      {isApiKeyMissing && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2 text-xs text-center flex items-center justify-center gap-2">
              <AlertTriangle size={14} />
              <span>Production Mode Warning: API Key missing. Running in simulation mode. Add <code>API_KEY</code> to environment to enable real-time Google Search data.</span>
          </div>
      )}

      {/* Main Dashboard */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Intro */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">2027 Presidential Sentiment Tracker</h1>
                <p className="text-slate-500 max-w-2xl text-sm leading-relaxed">
                    Real-time AI analysis of the Kenyan political landscape. Tracking sentiment velocity across news, social media, and verified web sources for the upcoming General Election.
                </p>
            </div>
            <div className="text-right hidden md:block">
                <div className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Data Stream</div>
                <div className="flex items-center gap-2 justify-end">
                    {isHistoryLoading ? (
                        <div className="flex items-center gap-2 text-amber-500">
                             <Database size={14} className="animate-bounce" />
                             <span className="text-sm font-medium">Backfilling History...</span>
                        </div>
                    ) : (
                        <>
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-sm font-medium text-slate-700">Google Grounding Active</span>
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
                            <BarChart3 size={20} className="text-indigo-600"/>
                            {config.historyWindowDays <= 60 ? "60-Day Trend Velocity" : 
                             config.historyWindowDays <= 90 ? "90-Day Trend Velocity" :
                             config.historyWindowDays <= 120 ? "120-Day Trend Velocity" :
                             config.historyWindowDays <= 180 ? "6-Month Trend Velocity" :
                             "1-Year Trend Velocity"}
                        </h3>
                        <div className="flex gap-2">
                           <span className="text-xs font-medium px-2 py-1 bg-slate-100 rounded text-slate-600">Historical & Live</span>
                        </div>
                    </div>
                    {isHistoryLoading ? (
                        <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm italic">
                            Analyzing recent political data...
                        </div>
                    ) : (
                        <TrendChart politicians={politicians} historyWindowDays={config.historyWindowDays} />
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
    </div>
  );
}