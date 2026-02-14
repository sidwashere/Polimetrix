import React, { useState } from 'react';
import { Source } from '../types';
import { Plus, Trash2, Globe, CheckCircle, Radio, Search, Check, X, Loader2 } from 'lucide-react';

interface SourceManagerProps {
  sources: Source[];
  potentialSources: Source[];
  onAddSource: (source: Source) => void;
  onRemoveSource: (id: string) => void;
  onAcceptSource: (source: Source) => void;
  onRejectSource: (id: string) => void;
  onScan: () => void;
  isScanning: boolean;
}

export const SourceManager: React.FC<SourceManagerProps> = ({ 
  sources, 
  potentialSources,
  onAddSource, 
  onRemoveSource,
  onAcceptSource,
  onRejectSource,
  onScan,
  isScanning
}) => {
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceType, setNewSourceType] = useState<Source['type']>('news');

  const handleAdd = () => {
    if (!newSourceName.trim()) return;
    const newSource: Source = {
      id: `s${Date.now()}`,
      name: newSourceName,
      type: newSourceType,
      weight: 1.5, // Default weight
      active: true
    };
    onAddSource(newSource);
    setNewSourceName('');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <Globe size={16} className="text-indigo-600"/> 
          Source Grid
        </h3>
        <button 
          onClick={onScan}
          disabled={isScanning}
          className={`text-xs flex items-center gap-1 px-2 py-1 rounded border transition-all ${isScanning ? 'bg-indigo-50 text-indigo-400 border-indigo-100' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300'}`}
        >
          {isScanning ? <Loader2 size={12} className="animate-spin"/> : <Radio size={12}/>}
          {isScanning ? 'Scanning...' : 'Discover'}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-4">
        
        {/* Discovery Section */}
        {potentialSources.length > 0 && (
          <div className="bg-indigo-50/50 rounded-lg border border-indigo-100 p-3 mb-4 animate-in slide-in-from-top-2">
             <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider">New Signals Detected</span>
                <span className="bg-indigo-200 text-indigo-700 text-[10px] px-1.5 rounded-full font-bold">{potentialSources.length}</span>
             </div>
             <div className="space-y-2">
               {potentialSources.map(source => (
                 <div key={source.id} className="bg-white p-2 rounded shadow-sm flex items-center justify-between border border-indigo-100/50">
                    <div>
                      <div className="font-bold text-slate-800 text-xs">{source.name}</div>
                      <div className="text-[10px] text-slate-400">{source.type} • Cred: {source.weight}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => onAcceptSource(source)} className="p-1 hover:bg-emerald-100 text-slate-300 hover:text-emerald-600 rounded transition-colors">
                        <Check size={14} />
                      </button>
                      <button onClick={() => onRejectSource(source.id)} className="p-1 hover:bg-rose-100 text-slate-300 hover:text-rose-600 rounded transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* Active Sources List */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Active Targets</div>
          {sources.map(source => (
            <div key={source.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100 text-sm hover:border-slate-200 transition-colors">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${source.active ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                <span className="font-medium text-slate-700 truncate">{source.name}</span>
                <span className="text-[10px] text-slate-400 uppercase border border-slate-200 px-1 rounded hidden sm:inline-block">{source.type}</span>
              </div>
              <button 
                onClick={() => onRemoveSource(source.id)}
                className="text-slate-300 hover:text-rose-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {sources.length === 0 && <div className="text-center text-slate-400 text-xs py-4">No active sources</div>}
        </div>
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50">
        <label className="text-xs font-bold text-slate-500 mb-2 block">Manual Entry</label>
        <div className="flex gap-2 mb-2">
          <input 
            type="text" 
            value={newSourceName}
            onChange={(e) => setNewSourceName(e.target.value)}
            placeholder="Name" 
            className="flex-1 text-sm border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500"
          />
          <select 
            value={newSourceType}
            onChange={(e) => setNewSourceType(e.target.value as any)}
            className="text-sm border border-slate-300 rounded px-2 py-1.5 bg-white w-20"
          >
            <option value="news">News</option>
            <option value="social">Soc</option>
            <option value="blog">Blog</option>
          </select>
        </div>
        <button 
          onClick={handleAdd}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 rounded transition-colors flex items-center justify-center gap-2 uppercase tracking-wide"
        >
          <Plus size={14} /> Add Target
        </button>
      </div>
    </div>
  );
};