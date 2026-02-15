import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Politician, NewsEvent, Source } from '../types';
import { 
  calculateAllMetrics, 
  calculateAnalyticsSummary, 
  exportData, 
  importData,
  AdvancedMetrics,
  AnalyticsSummary 
} from '../services/analyticsService';
import { 
  TrendingUp, TrendingDown, Activity, Zap, Users, 
  Target, Brain, Download, Upload, X, PieChart as PieChartIcon,
  BarChart3, LineChart as LineChartIcon
} from 'lucide-react';

interface AnalyticsDashboardProps {
  politicians: Politician[];
  feed: NewsEvent[];
  sources: Source[];
  onImport: (data: { politicians: Politician[], feed: NewsEvent[], sources: Source[] }) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  politicians,
  feed,
  sources,
  onImport
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'predictions' | 'sentiment' | 'sources'>('overview');
  const [selectedPolitician, setSelectedPolitician] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  const metrics = useMemo(() => {
    if (selectedPolitician) {
      const pol = politicians.find(p => p.id === selectedPolitician);
      if (pol) return calculateAllMetrics(pol, feed, sources);
    }
    return null;
  }, [selectedPolitician, politicians, feed, sources]);

  const summary = useMemo(() => calculateAnalyticsSummary(feed, politicians, sources), [feed, politicians, sources]);

  const sentimentData = useMemo(() => {
    return politicians.map(p => {
      const polMetrics = calculateAllMetrics(p, feed, sources);
      return {
        name: p.name,
        positive: polMetrics.sentimentBreakdown.positive,
        negative: polMetrics.sentimentBreakdown.negative,
        neutral: polMetrics.sentimentBreakdown.neutral
      };
    });
  }, [politicians, feed, sources]);

  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    feed.forEach(e => {
      counts[e.sourceName] = (counts[e.sourceName] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [feed]);

  const predictionData = useMemo(() => {
    return politicians.map(p => {
      const polMetrics = calculateAllMetrics(p, feed, sources);
      return {
        name: p.name,
        current: p.score,
        prediction: polMetrics.prediction.nextWeek,
        confidence: polMetrics.prediction.confidence,
        trend: polMetrics.prediction.trend
      };
    });
  }, [politicians, feed, sources]);

  const handleExport = () => {
    const data = exportData(politicians, feed, sources);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `polimetric-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const data = importData(content);
      if (data) {
        onImport(data);
        alert('Data imported successfully!');
      } else {
        alert('Failed to import data. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="text-indigo-600" size={20} />
          <h3 className="font-bold text-slate-800">Analytics Dashboard</h3>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download size={12} /> Export
          </button>
          <label className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
            <Upload size={12} /> Import
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex px-4">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'predictions', label: 'Predictions', icon: Brain },
            { id: 'sentiment', label: 'Sentiment', icon: PieChartIcon },
            { id: 'sources', label: 'Sources', icon: Activity }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id 
                  ? 'border-indigo-600 text-indigo-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Activity size={14} />
                  <span className="text-xs font-medium">Total Events</span>
                </div>
                <p className="text-2xl font-bold text-slate-800">{summary.totalEvents}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <TrendingUp size={14} />
                  <span className="text-xs font-medium">Avg Sentiment</span>
                </div>
                <p className={`text-2xl font-bold ${summary.avgSentiment > 0 ? 'text-emerald-600' : summary.avgSentiment < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {summary.avgSentiment > 0 ? '+' : ''}{summary.avgSentiment}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Target size={14} />
                  <span className="text-xs font-medium">Top Source</span>
                </div>
                <p className="text-lg font-bold text-slate-800 truncate">{summary.mostInfluentialSource}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Zap size={14} />
                  <span className="text-xs font-medium">Top Mover</span>
                </div>
                <p className="text-lg font-bold text-slate-800 truncate">{summary.topMover.name}</p>
                <p className={`text-xs ${summary.topMover.change > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {summary.topMover.change > 0 ? '+' : ''}{summary.topMover.change.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3">Prediction vs Current</h4>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={predictionData} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" domain={[80, 120]} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="current" name="Current" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="prediction" name="Predicted" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3">Media Share Distribution</h4>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {sourceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'predictions' && (
          <div className="space-y-6">
            <div className="mb-4">
              <label className="text-sm font-medium text-slate-700 mb-2 block">Select Candidate</label>
              <select 
                value={selectedPolitician || ''}
                onChange={(e) => setSelectedPolitician(e.target.value || null)}
                className="w-full md:w-64 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="">All Candidates</option>
                {politicians.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {metrics && selectedPolitician ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
                  <div className="flex items-center gap-2 text-indigo-600 mb-2">
                    <Brain size={16} />
                    <span className="text-xs font-bold uppercase">7-Day Prediction</span>
                  </div>
                  <p className="text-3xl font-bold text-indigo-800">{metrics.prediction.nextWeek}</p>
                  <p className="text-xs text-indigo-600 mt-1">
                    {metrics.prediction.trend === 'rising' ? 'Trending Up' : 
                     metrics.prediction.trend === 'falling' ? 'Trending Down' : 'Stable'}
                  </p>
                </div>

                <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
                  <div className="flex items-center gap-2 text-emerald-600 mb-2">
                    <Target size={16} />
                    <span className="text-xs font-bold uppercase">Confidence</span>
                  </div>
                  <p className="text-3xl font-bold text-emerald-800">{metrics.prediction.confidence}%</p>
                  <p className="text-xs text-emerald-600 mt-1">Prediction reliability</p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-600 mb-2">
                    <TrendingUp size={16} />
                    <span className="text-xs font-bold uppercase">Trend Strength</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-800">{metrics.trendStrength}</p>
                  <p className="text-xs text-slate-500 mt-1">Momentum intensity</p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-600 mb-2">
                    <Activity size={16} />
                    <span className="text-xs font-bold uppercase">Volatility</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-800">{metrics.volatility.toFixed(2)}</p>
                  <p className="text-xs text-slate-500 mt-1">Score stability</p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-600 mb-2">
                    <Zap size={16} />
                    <span className="text-xs font-bold uppercase">Momentum</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-800">{metrics.momentum > 0 ? '+' : ''}{metrics.momentum.toFixed(2)}</p>
                  <p className="text-xs text-slate-500 mt-1">Week-over-week change</p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-600 mb-2">
                    <Users size={16} />
                    <span className="text-xs font-bold uppercase">Influence Score</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-800">{metrics.influenceScore}</p>
                  <p className="text-xs text-slate-500 mt-1">Overall impact rating</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                Select a candidate to view detailed predictions
              </div>
            )}

            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-3">All Predictions</h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={predictionData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[80, 120]} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="current" name="Current" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="prediction" name="Predicted (7-day)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sentiment' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {politicians.map((pol, idx) => {
                const polMetrics = calculateAllMetrics(pol, feed, sources);
                const breakdown = [
                  { name: 'Positive', value: polMetrics.sentimentBreakdown.positive, color: '#10b981' },
                  { name: 'Negative', value: polMetrics.sentimentBreakdown.negative, color: '#ef4444' },
                  { name: 'Neutral', value: polMetrics.sentimentBreakdown.neutral, color: '#94a3b8' }
                ].filter(b => b.value > 0);

                return (
                  <div key={pol.id} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: pol.color }}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">{pol.name}</h4>
                        <p className="text-xs text-slate-500">Sentiment Ratio: {polMetrics.sentimentRatio > 0 ? '+' : ''}{polMetrics.sentimentRatio}</p>
                      </div>
                    </div>
                    <div className="h-[150px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={breakdown}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={50}
                          >
                            {breakdown.map((entry, i) => (
                              <Cell key={`cell-${i}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-3">Sentiment Comparison</h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sentimentData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="positive" name="Positive" stackId="a" fill="#10b981" />
                    <Bar dataKey="neutral" name="Neutral" stackId="a" fill="#94a3b8" />
                    <Bar dataKey="negative" name="Negative" stackId="a" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sources' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3">Source Activity</h4>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sourceData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                      <Tooltip />
                      <Bar dataKey="value" name="Events" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3">Source Distribution</h4>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      >
                        {sourceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-800">Export Data</h3>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Export all politicians, feed events, and sources to a JSON file.
            </p>
            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-slate-500">
                <strong>Politicians:</strong> {politicians.length}<br />
                <strong>Feed Events:</strong> {feed.length}<br />
                <strong>Sources:</strong> {sources.length}
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowExportModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleExport}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                Download JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
