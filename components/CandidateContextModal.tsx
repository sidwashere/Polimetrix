import React, { useEffect, useState } from 'react';
import { Politician, CandidateContext, AdvancedMetrics } from '../types';
import { X, BookOpen, ExternalLink, TrendingUp, AlertTriangle, ShieldCheck, Download, Loader2 } from 'lucide-react';
import { generateCandidateContext } from '../services/contextGenerator';
import { database } from '../services/database';

interface CandidateContextModalProps {
    politician: Politician;
    metrics: AdvancedMetrics;
    onClose: () => void;
    config: any;
    feed: any[];
}

export const CandidateContextModal: React.FC<CandidateContextModalProps> = ({
    politician,
    metrics,
    onClose,
    config,
    feed
}) => {
    const [context, setContext] = useState<CandidateContext | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        loadContext();
    }, [politician.id]);

    const loadContext = async () => {
        setLoading(true);
        // Try to load from DB first
        const existing = database.getCandidateContext(politician.id);
        if (existing) {
            setContext(existing);
            setLoading(false);
        } else {
            // Generate automatically if missing? No, user action preferred to save credits, or auto if configured.
            // For now, auto-generate if missing
            handleGenerate(false);
        }
    };

    const handleGenerate = async (force = false) => {
        setGenerating(true);
        try {
            const newContext = await generateCandidateContext(politician, feed, config.aiProviderConfig, force);
            if (newContext) setContext(newContext);
        } catch (e) {
            console.error(e);
        } finally {
            setGenerating(false);
            setLoading(false);
        }
    };

    const handleExport = () => {
        if (!context) return;
        const content = `# Political Context: ${politician.name} (${politician.party})
Generated: ${new Date().toISOString()}

## Summary
${context.summary}

## Strategic Narrative
${context.narrative}

## Key Strengths
${context.strengths.map(s => `- ${s}`).join('\n')}

## Weaknesses
${context.weaknesses.map(w => `- ${w}`).join('\n')}

## Key Allies
${context.allies.join(', ')}

## Key Rivals
${context.rivals.join(', ')}

## Recent Controversies
${context.controversies.join('\n')}
`;
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${politician.name.replace(/\s+/g, '_')}_context.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-4">
                        <img
                            src={politician.image}
                            alt={politician.name}
                            className="w-16 h-16 rounded-full object-cover border-2 border-slate-200"
                        />
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">{politician.name}</h2>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <span className="font-medium text-slate-700">{politician.party}</span>
                                <span>•</span>
                                <span>{politician.role}</span>
                                {politician.coalition && (
                                    <>
                                        <span>•</span>
                                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                                            {politician.coalition}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 space-y-8 flex-1">
                    {loading || generating ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Loader2 size={48} className="animate-spin mb-4 text-indigo-500" />
                            <p className="text-lg font-medium">Analyzing political landscape...</p>
                            <p className="text-sm">Generating strategic context for {politician.name}</p>
                        </div>
                    ) : context ? (
                        <>
                            {/* Executive Summary */}
                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <TrendingUp size={16} /> Executive Summary
                                </h3>
                                <p className="text-lg text-slate-800 leading-relaxed font-medium">
                                    {context.summary}
                                </p>
                            </div>

                            {/* Narrative */}
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <BookOpen size={24} className="text-indigo-600" />
                                    Strategic Narrative
                                </h3>
                                <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed">
                                    {context.narrative.split('\n').map((para, i) => (
                                        <p key={i} className="mb-4">{para}</p>
                                    ))}
                                </div>
                                <div className="text-xs text-slate-400 mt-2 italic">
                                    Analysis generated: {new Date(context.lastGenerated).toLocaleString()}
                                </div>
                            </div>

                            {/* Grid: Strengths, Weaknesses, Allies */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Strengths */}
                                <div className="bg-emerald-50/50 p-5 rounded-lg border border-emerald-100">
                                    <h4 className="flex items-center gap-2 font-bold text-emerald-800 mb-3">
                                        <ShieldCheck size={18} /> Key Strengths
                                    </h4>
                                    <ul className="space-y-2">
                                        {context.strengths.map((s, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-emerald-900">
                                                <span className="mt-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0" />
                                                {s}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Weaknesses */}
                                <div className="bg-rose-50/50 p-5 rounded-lg border border-rose-100">
                                    <h4 className="flex items-center gap-2 font-bold text-rose-800 mb-3">
                                        <AlertTriangle size={18} /> Potential Vulnerabilities
                                    </h4>
                                    <ul className="space-y-2">
                                        {context.weaknesses.map((w, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-rose-900">
                                                <span className="mt-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full flex-shrink-0" />
                                                {w}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Allies & Rivals */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Key Allies</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {context.allies.map((ally, i) => (
                                            <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium border border-indigo-100">
                                                {ally}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Principal Rivals</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {context.rivals.map((rival, i) => (
                                            <span key={i} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium border border-slate-200">
                                                {rival}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                        </>
                    ) : (
                        <div className="text-center py-20">
                            <p className="text-slate-500">Failed to load context. Please try again.</p>
                            <button
                                onClick={() => handleGenerate(true)}
                                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                            >
                                Retry Generation
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 rounded-b-xl">
                    <button
                        onClick={() => handleGenerate(true)}
                        disabled={generating}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        {generating ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
                        Regenerate Analysis
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={!context}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm disabled:opacity-50"
                    >
                        <Download size={16} />
                        Export Context Report
                    </button>
                </div>
            </div>
        </div>
    );
};
