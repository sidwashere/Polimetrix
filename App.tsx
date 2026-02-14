import React, { useState, useEffect, useCallback, useRef } from 'react';
import { INITIAL_POLITICIANS, INITIAL_SOURCES, MOCK_HEADLINES } from './constants';
import { Politician, Source, NewsEvent, SimulationConfig, SentimentType } from './types';
import { fetchAIEvent, fetchSuggestedSources, fetchHistoricalStats } from './services/geminiService';
import { Ticker } from './components/Ticker';
import { LeaderboardCard } from './components/LeaderboardCard';
import { TrendChart } from './components/TrendChart';
import { LiveFeed } from './components/LiveFeed';
import { SourceManager } from './components/SourceManager';
import { CandidateManager } from './components/CandidateManager';
import { BarChart3, Settings, Play, Pause, Activity, AlertTriangle, Search, Database } from 'lucide-react';

export default function App() {
  const [politicians, setPoliticians] = useState<Politician[]>(INITIAL_POLITICIANS);
  const [candidateFilter, setCandidateFilter] = useState('');
  const [sources, setSources] = useState<Source[]>(INITIAL_SOURCES);
  const [potentialSources, setPotentialSources] = useState<Source[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [feed, setFeed] = useState<NewsEvent[]>([]);
  const [config, setConfig] = useState<SimulationConfig>({
    scanInterval: 8000, // Slower interval to allow for processing
    isPaused: false,
    useAI: false
  });
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);

  // Check for API key on mount
  useEffect(() => {
    if (!process.env.API_KEY) {
      setIsApiKeyMissing(true);
      setConfig(prev => ({ ...prev, useAI: false }));
    } else {
        setConfig(prev => ({ ...prev, useAI: true }));
        // Trigger historical fetch
        loadHistoricalContext();
    }
  }, []);

  const loadHistoricalContext = async () => {
    setIsHistoryLoading(true);
    const updatedPoliticians = [...INITIAL_POLITICIANS];
    
    // We'll fetch history for the top 3 default candidates to save tokens/time on init
    // In a real app, this would be a backend job
    const promises = updatedPoliticians.slice(0, 3).map(async (pol) => {
        const history = await fetchHistoricalStats(pol);
        if (history && history.length > 0) {
            pol.history = history;
            // Update current score to the last point in history
            pol.score = history[history.length - 1].score;
        }
        return pol;
    });

    await Promise.all(promises);
    setPoliticians(updatedPoliticians);
    setIsHistoryLoading(false);
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
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
  };

  const processEvent = useCallback((event: NewsEvent) => {
    setFeed(prev => [event, ...prev].slice(0, 50));

    setPoliticians(prevPols => {
      // Handle updates for ALL politicians to keep history aligned
      return prevPols.map(p => {
        if (p.id !== event.politicianId) {
            // No change for others in live loop, or we could duplicate last point
            return p;
        }

        let change = 0;
        if (event.sentiment === 'positive') change = event.impact;
        if (event.sentiment === 'negative') change = -event.impact;

        const newScore = parseFloat((p.score + change).toFixed(2));
        
        // Append new live point to history
        const newHistoryItem = { 
            time: new Date().toISOString().split('T')[0], // Just date for graph simplicity
            score: newScore,
            reason: "Live Update: " + event.headline
        };
        
        // Keep history size manageable
        const newHistory = [...p.history, newHistoryItem].slice(-30);

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
    if (config.isPaused || isHistoryLoading) return; // Wait for history to load first

    let event: NewsEvent | null = null;
    // Pick a random politician to 'scan' for news
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
               timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
               url: aiData.url
           } as NewsEvent;
       }
    } 
    
    // Fallback if AI didn't return (e.g. no recent news found) or dev mode
    if (!event) {
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
        const MOCK_DISCOVERIES = [
            { name: "Kahawa Tungu", type: "blog" as const, weight: 1.8 },
            { name: "Tuko.co.ke", type: "news" as const, weight: 1.5 },
            { name: "KBC Channel 1", type: "tv" as const, weight: 2.0 }
        ];
        const random = MOCK_DISCOVERIES[Math.floor(Math.random() * MOCK_DISCOVERIES.length)];
        if (!sources.find(s => s.name === random.name)) {
            setPotentialSources(prev => [...prev, {
                id: `mock-${Date.now()}`,
                name: random.name,
                type: random.type,
                weight: random.weight,
                active: true
            }]);
        }
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
  
  const handleAddCandidate = (candidate: Politician) => {
      setPoliticians(prev => [...prev, candidate]);
  };

  const handleDeleteCandidate = (id: string) => {
      setPoliticians(prev => prev.filter(p => p.id !== id));
  };

  const togglePause = () => setConfig(prev => ({ ...prev, isPaused: !prev.isPaused }));
  const addSource = (source: Source) => setSources(prev => [...prev, source]);
  const removeSource = (id: string) => setSources(prev => prev.filter(s => s.id !== id));

  // Filter and Sort
  const filteredPoliticians = politicians.filter(p => 
     p.name.toLowerCase().includes(candidateFilter.toLowerCase()) || 
     p.party.toLowerCase().includes(candidateFilter.toLowerCase())
  );
  const sortedPoliticians = [...filteredPoliticians].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* Navbar */}
      <nav className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-2">
                    <Activity className="text-indigo-400" />
                    <span className="text-xl font-bold tracking-tight">PoliMetric <span className="text-slate-400 font-normal">| Kenya 2027</span></span>
                    <span className="ml-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse font-bold tracking-wider">LIVE</span>
                </div>
                <div className="flex items-center space-x-4">
                     <button 
                        onClick={togglePause}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${config.isPaused ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-700 hover:bg-slate-600'}`}
                     >
                        {config.isPaused ? <><Play size={14}/> Resume</> : <><Pause size={14}/> Pause</>}
                     </button>
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
                            <LeaderboardCard key={pol.id} politician={pol} rank={idx + 1} />
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
                            6-Month Trend Velocity
                        </h3>
                        <div className="flex gap-2">
                           <span className="text-xs font-medium px-2 py-1 bg-slate-100 rounded text-slate-600">Historical & Live</span>
                        </div>
                    </div>
                    {isHistoryLoading ? (
                        <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm italic">
                            Analyzing 6 months of political data...
                        </div>
                    ) : (
                        <TrendChart politicians={politicians} />
                    )}
                </div>
                
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