import React, { useState } from 'react';
import { Politician } from '../types';
import { Users, Plus, X, Search, Filter } from 'lucide-react';

interface CandidateManagerProps {
  candidates: Politician[];
  onAddCandidate: (candidate: Politician) => void;
  onDeleteCandidate: (id: string) => void;
  filterText: string;
  onFilterChange: (text: string) => void;
}

export const CandidateManager: React.FC<CandidateManagerProps> = ({
  candidates,
  onAddCandidate,
  onDeleteCandidate,
  filterText,
  onFilterChange
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newParty, setNewParty] = useState('');
  const [newRole, setNewRole] = useState('Presidential Aspirant');
  const [newSlogan, setNewSlogan] = useState('');
  const [newBio, setNewBio] = useState('');

  const handleAdd = () => {
    if (!newName || !newParty) return;
    
    const newCandidate: Politician = {
      id: `c-${Date.now()}`,
      name: newName,
      party: newParty,
      role: newRole,
      slogan: newSlogan || 'Forward Together',
      bio: newBio || 'A presidential hopeful for the 2027 General Elections.',
      score: 100.0,
      trend: 0,
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
      image: `https://ui-avatars.com/api/?name=${encodeURIComponent(newName)}&background=random`,
      history: Array(15).fill({ time: '', score: 100 }),
      isCustom: true
    };
    
    onAddCandidate(newCandidate);
    setNewName('');
    setNewParty('');
    setNewSlogan('');
    setNewBio('');
    setIsAdding(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <Users size={16} className="text-indigo-600"/> 
          2027 Candidates
        </h3>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded font-medium transition-colors"
        >
          {isAdding ? 'Cancel' : 'Add Candidate'}
        </button>
      </div>

      {isAdding && (
        <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100 animate-in slide-in-from-top-2">
           <div className="space-y-2">
             <input 
                className="w-full text-sm border border-slate-300 rounded px-2 py-1.5 focus:border-indigo-500 focus:outline-none"
                placeholder="Full Name (e.g. Stephen Kalonzo)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
             />
             <div className="flex gap-2">
                <input 
                    className="flex-1 text-sm border border-slate-300 rounded px-2 py-1.5 focus:border-indigo-500 focus:outline-none"
                    placeholder="Party (e.g. Wiper)"
                    value={newParty}
                    onChange={e => setNewParty(e.target.value)}
                />
                 <input 
                    className="flex-1 text-sm border border-slate-300 rounded px-2 py-1.5 focus:border-indigo-500 focus:outline-none"
                    placeholder="Slogan (e.g. Hakika)"
                    value={newSlogan}
                    onChange={e => setNewSlogan(e.target.value)}
                />
             </div>
             <textarea 
                className="w-full text-sm border border-slate-300 rounded px-2 py-1.5 focus:border-indigo-500 focus:outline-none resize-none"
                placeholder="Brief Biography..."
                rows={2}
                value={newBio}
                onChange={e => setNewBio(e.target.value)}
             />
             <button 
                onClick={handleAdd}
                className="w-full bg-indigo-600 text-white px-3 py-2 rounded text-xs font-bold hover:bg-indigo-700 flex items-center justify-center gap-2"
            >
                <Plus size={14} /> Add to Tracker
            </button>
           </div>
        </div>
      )}

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
        <input 
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-indigo-400 transition-colors"
            placeholder="Filter candidates..."
            value={filterText}
            onChange={(e) => onFilterChange(e.target.value)}
        />
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scroll pr-1">
        {candidates.filter(c => c.name.toLowerCase().includes(filterText.toLowerCase()) || c.party.toLowerCase().includes(filterText.toLowerCase())).map(candidate => (
          <div key={candidate.id} className="flex items-center justify-between p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group">
             <div className="flex items-center gap-2">
                <img src={candidate.image} alt="" className="w-8 h-8 rounded-full object-cover bg-slate-200 border border-slate-200" />
                <div className="overflow-hidden">
                    <div className="text-xs font-bold text-slate-700 truncate w-32">{candidate.name}</div>
                    <div className="text-[10px] text-slate-500">{candidate.party}</div>
                </div>
             </div>
             <button 
                onClick={() => onDeleteCandidate(candidate.id)}
                className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                title="Remove candidate"
             >
                <X size={14} />
             </button>
          </div>
        ))}
      </div>
    </div>
  );
};