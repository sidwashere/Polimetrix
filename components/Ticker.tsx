import React from 'react';
import { NewsEvent } from '../types';
import { Circle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TickerProps {
  events: NewsEvent[];
}

export const Ticker: React.FC<TickerProps> = ({ events }) => {
  const recentEvents = events.slice(0, 10); // Show last 10 events

  return (
    <div className="bg-slate-900 text-slate-300 h-10 flex items-center border-b border-slate-700 relative z-40">
      <div className="bg-indigo-700 h-full px-4 flex items-center font-bold text-white text-xs uppercase tracking-wider shadow-lg z-10 shrink-0">
        Live Wire
      </div>
      <div className="ticker-wrap flex-1 flex items-center">
        <div className="ticker">
          {recentEvents.map((event) => (
            <div key={`tick-${event.id}`} className="inline-flex items-center mx-6 text-sm">
              <span className={`mr-2 ${
                event.sentiment === 'positive' ? 'text-emerald-400' :
                event.sentiment === 'negative' ? 'text-rose-400' : 'text-slate-400'
              }`}>
                {event.sentiment === 'positive' ? <TrendingUp size={14} /> :
                 event.sentiment === 'negative' ? <TrendingDown size={14} /> :
                 <Minus size={14} />}
              </span>
              <span className="font-bold text-slate-100 mr-2">[{event.sourceName}]</span>
              <span>{event.headline}</span>
            </div>
          ))}
          {/* Duplicate for seamless loop effect */}
          {recentEvents.map((event) => (
            <div key={`tick-dup-${event.id}`} className="inline-flex items-center mx-6 text-sm">
              <span className={`mr-2 ${
                event.sentiment === 'positive' ? 'text-emerald-400' :
                event.sentiment === 'negative' ? 'text-rose-400' : 'text-slate-400'
              }`}>
                {event.sentiment === 'positive' ? <TrendingUp size={14} /> :
                 event.sentiment === 'negative' ? <TrendingDown size={14} /> :
                 <Minus size={14} />}
              </span>
              <span className="font-bold text-slate-100 mr-2">[{event.sourceName}]</span>
              <span>{event.headline}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};