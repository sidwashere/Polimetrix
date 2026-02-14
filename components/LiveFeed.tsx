import React from 'react';
import { NewsEvent } from '../types';
import { Bot, Radio, Globe, MessageCircle, Newspaper, ExternalLink } from 'lucide-react';

interface LiveFeedProps {
  feed: NewsEvent[];
}

const SourceIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'social': return <MessageCircle size={14} />;
    case 'news': return <Newspaper size={14} />;
    case 'tv': return <Radio size={14} />;
    default: return <Globe size={14} />;
  }
};

export const LiveFeed: React.FC<LiveFeedProps> = ({ feed }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center rounded-t-xl">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Globe size={18} className="text-indigo-600" />
            Kenya 2027 Live Wire
          </h3>
          <p className="text-xs text-slate-500">Real-time web monitoring active</p>
        </div>
        <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-mono text-emerald-600">LIVE</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 custom-scroll min-h-[400px] max-h-[600px]">
        {feed.length === 0 && (
          <div className="text-center text-slate-400 py-10 text-sm">
            Initializing 2027 election scanners...
          </div>
        )}
        {feed.map((event) => {
           let borderClass = 'border-l-4 border-slate-300';
           let bgClass = 'bg-white';
           
           if (event.sentiment === 'positive') {
               borderClass = 'border-l-4 border-emerald-500';
           } else if (event.sentiment === 'negative') {
               borderClass = 'border-l-4 border-rose-500';
               bgClass = 'bg-rose-50/30';
           }

           return (
            <div key={event.id} className={`p-3 rounded-r-lg shadow-sm border border-slate-200 ${borderClass} ${bgClass} text-sm transition-all animate-in slide-in-from-right-2 duration-300 relative group`}>
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-slate-700 text-[10px] uppercase tracking-wide flex items-center gap-1">
                   {event.sourceName}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{event.timestamp}</span>
              </div>
              <div className="font-medium text-slate-800 mb-2 leading-relaxed">
                {event.headline}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100/50">
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        event.sentiment === 'positive' ? 'text-emerald-700 bg-emerald-100' : 
                        event.sentiment === 'negative' ? 'text-rose-700 bg-rose-100' : 'text-slate-600 bg-slate-100'
                    }`}>
                        {event.sentiment.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <span className={`font-mono font-bold ${event.sentiment === 'negative' ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {event.sentiment === 'negative' ? '-' : '+'}{event.impact.toFixed(2)}
                        </span>
                    </span>
                </div>
                {event.url && (
                    <a href={event.url} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-700 flex items-center gap-1 text-[10px] font-medium opacity-80 hover:opacity-100">
                        Read Source <ExternalLink size={10} />
                    </a>
                )}
              </div>
            </div>
           );
        })}
      </div>
    </div>
  );
};