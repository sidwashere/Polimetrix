import React from 'react';
import { Politician } from '../types';
import { TrendingUp, TrendingDown, Minus, Quote } from 'lucide-react';

interface LeaderboardCardProps {
  politician: Politician;
  rank: number;
}

export const LeaderboardCard: React.FC<LeaderboardCardProps> = ({ politician, rank }) => {
  // Calculate trend styling
  const isPositive = politician.trend > 0;
  const isNegative = politician.trend < 0;
  
  const trendColor = isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-400';
  const trendIcon = isPositive ? <TrendingUp size={16} /> : isNegative ? <TrendingDown size={16} /> : <Minus size={16} />;

  // Progress bar visual (80 to 120 range normalized to 0-100%)
  const progressPct = Math.max(5, Math.min(95, ((politician.score - 80) / 40) * 100));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 transition-all duration-300 hover:shadow-md relative overflow-hidden group flex flex-col h-full">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-slate-100 shadow-sm">
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
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold text-slate-900 tracking-tight">{politician.score.toFixed(2)}</span>
                <span className={`text-xs font-bold flex items-center ${trendColor} bg-slate-50 px-1.5 py-0.5 rounded`}>
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
      </div>
    </div>
  );
};