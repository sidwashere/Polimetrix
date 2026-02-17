import React, { useEffect, useRef, useState } from 'react';
import { Politician } from '../types';
import { TrendingUp, TrendingDown, Minus, Quote, RefreshCw, Trash2, Loader2, Activity, Zap, Radio } from 'lucide-react';

interface LeaderboardCardProps {
  politician: Politician;
  rank: number;
  onRefresh?: (id: string) => void;
  onRemove?: (id: string) => void;
  isRefreshing?: boolean;
  autoRefreshEnabled?: boolean;
  volatility?: number;
  momentum?: number;
  mediaFrequency?: number;
  sentimentRatio?: number;
  influenceScore?: number;
  consistencyScore?: number;
  onViewContext?: (id: string) => void;
}

export const LeaderboardCard: React.FC<LeaderboardCardProps> = ({
  politician,
  rank,
  onRefresh,
  onRemove,
  isRefreshing = false,
  autoRefreshEnabled = false,
  volatility = 0,
  momentum = 0,
  mediaFrequency = 0,
  sentimentRatio = 0,

  influenceScore = 0,
  consistencyScore = 0,
  onViewContext
}) => {
  // State for visual flash animation on update
  const prevScore = useRef(politician.score);
  const [updateFlash, setUpdateFlash] = useState<'up' | 'down' | null>(null);

  // Automatic refresh timer (30 minutes)
  useEffect(() => {
    if (!autoRefreshEnabled || !onRefresh) return;

    // 30 minutes in milliseconds
    const REFRESH_INTERVAL = 30 * 60 * 1000;

    // Simple interval to trigger refresh
    const simpleInterval = setInterval(() => {
      onRefresh(politician.id);
    }, REFRESH_INTERVAL);

    return () => clearInterval(simpleInterval);
  }, [autoRefreshEnabled, onRefresh, politician.id]);

  // Detect score changes for animation
  useEffect(() => {
    // Small threshold to avoid floating point flicker, though usually distinct
    if (Math.abs(politician.score - prevScore.current) > 0.001) {
      const isUp = politician.score > prevScore.current;
      setUpdateFlash(isUp ? 'up' : 'down');
      prevScore.current = politician.score;

      const timer = setTimeout(() => {
        setUpdateFlash(null);
      }, 2000); // Highlight lasts 2 seconds

      return () => clearTimeout(timer);
    }
  }, [politician.score]);

  // Calculate trend styling
  const isPositive = politician.trend > 0;
  const isNegative = politician.trend < 0;

  const trendColor = isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-400';
  const trendIcon = isPositive ? <TrendingUp size={16} /> : isNegative ? <TrendingDown size={16} /> : <Minus size={16} />;

  // Progress bar visual (80 to 120 range normalized to 0-100%)
  const progressPct = Math.max(5, Math.min(95, ((politician.score - 80) / 40) * 100));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 transition-all duration-300 hover:shadow-md relative overflow-hidden group flex flex-col h-full">

      {/* Action Buttons */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 p-1 rounded-lg backdrop-blur-sm z-10">
        {onRefresh && (
          <button
            onClick={() => onRefresh(politician.id)}
            disabled={isRefreshing}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
            title="Refresh stats and fetch latest news"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
          </button>
        )}
        {onRemove && (
          <button
            onClick={() => onRemove(politician.id)}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
            title="Remove candidate"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-slate-100 shadow-sm bg-slate-100">
              <img src={politician.image} alt={politician.name} className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              #{rank}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 leading-tight text-lg">{politician.name}</h3>
            <p className="text-xs text-slate-500 font-medium">{politician.party} • {politician.role}</p>
          </div>
        </div>
        {rank === 1 && (
          <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200 shadow-sm">
            Leader
          </span>
        )}
      </div>

      {politician.slogan && (
        <div className="mb-3 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 inline-block self-start">
          <p className="text-xs text-slate-600 italic font-medium flex gap-2">
            <Quote size={12} className="text-indigo-400 rotate-180 shrink-0" />
            {politician.slogan}
          </p>
        </div>
      )}

      {politician.bio && (
        <div className="mb-4">
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2" title={politician.bio}>
            {politician.bio}
          </p>
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-slate-100">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Sentiment Index</p>

            {/* Score Display with Animation Wrapper */}
            <div className={`flex items-center space-x-2 px-2 -ml-2 py-1 rounded-lg transition-all duration-700 ease-out ${updateFlash === 'up' ? 'bg-emerald-100' :
              updateFlash === 'down' ? 'bg-rose-100' :
                'bg-transparent'
              }`}>
              <span className={`text-3xl font-bold tracking-tight transition-colors duration-300 ${updateFlash === 'up' ? 'text-emerald-700' :
                updateFlash === 'down' ? 'text-rose-700' :
                  'text-slate-900'
                }`}>
                {politician.score.toFixed(2)}
              </span>

              <span className={`text-xs font-bold flex items-center ${trendColor} bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100`}>
                {trendIcon}
                <span className="ml-1">{Math.abs(politician.trend).toFixed(2)}</span>
              </span>
            </div>

          </div>

          <div className="w-1/3">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-700 ease-out rounded-full"
                style={{ width: `${progressPct}%`, backgroundColor: politician.color }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-slate-400">
              <span>80</span>
              <span>120</span>
            </div>
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="mt-3 pt-3 border-t border-slate-50 grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5">
              <Activity size={10} />
              <span className="text-[9px] uppercase font-bold">Volatility</span>
            </div>
            <span className={`text-xs font-bold ${volatility > 2 ? 'text-amber-600' : volatility > 1 ? 'text-amber-500' : 'text-slate-600'}`}>
              {volatility.toFixed(2)}
            </span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5">
              <Zap size={10} />
              <span className="text-[9px] uppercase font-bold">Momentum</span>
            </div>
            <span className={`text-xs font-bold ${momentum > 0.5 ? 'text-emerald-600' : momentum < -0.5 ? 'text-rose-600' : 'text-slate-600'}`}>
              {momentum > 0 ? '+' : ''}{momentum.toFixed(2)}
            </span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5">
              <Radio size={10} />
              <span className="text-[9px] uppercase font-bold">Mentions</span>
            </div>
            <span className="text-xs font-bold text-slate-600">
              {mediaFrequency}
            </span>
          </div>
        </div>

        {/* Extended Metrics */}
        <div className="mt-2 pt-2 border-t border-slate-50 grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5">
              <span className="text-[9px] uppercase font-bold">Sentiment</span>
            </div>
            <span className={`text-xs font-bold ${sentimentRatio > 0.2 ? 'text-emerald-600' : sentimentRatio < -0.2 ? 'text-rose-600' : 'text-slate-600'}`}>
              {sentimentRatio > 0 ? '+' : ''}{sentimentRatio.toFixed(2)}
            </span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5">
              <span className="text-[9px] uppercase font-bold">Influence</span>
            </div>
            <span className="text-xs font-bold text-indigo-600">
              {influenceScore.toFixed(0)}
            </span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5">
              <span className="text-[9px] uppercase font-bold">Consistency</span>
            </div>
            <span className={`text-xs font-bold ${consistencyScore > 70 ? 'text-emerald-600' : consistencyScore < 40 ? 'text-rose-600' : 'text-slate-600'}`}>
              {consistencyScore.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {isRefreshing && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-20">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-indigo-600" size={24} />
            <span className="text-xs font-bold text-indigo-700">Updating Stats...</span>
          </div>
        </div>
      )}
    </div>
  );
};