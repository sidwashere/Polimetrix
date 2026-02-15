import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Brush } from 'recharts';
import { Politician } from '../types';
import { ExternalLink } from 'lucide-react';

interface TrendChartProps {
  politicians: Politician[];
  historyWindowDays?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-lg text-xs max-w-[250px] z-50">
        <p className="font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">{label}</p>
        {payload.map((entry: any) => {
            const reason = entry.payload[`${entry.dataKey}_reason`];
            const url = entry.payload[`${entry.dataKey}_url`];

            return (
              <div key={entry.name} className="mb-2 last:mb-0">
                <div className="flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }}></span>
                   <span className="font-medium text-slate-800">{entry.name}: {entry.value}</span>
                </div>
                {/* Context */}
                {reason && (
                    <p className="text-slate-500 pl-4 mt-0.5 leading-snug">
                        {reason}
                    </p>
                )}
                {/* Source Link */}
                {url && (
                    <a 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 pl-4 mt-1 text-[10px] text-indigo-500 hover:text-indigo-700 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                    >
                        Verify Source <ExternalLink size={10} />
                    </a>
                )}
              </div>
            );
        })}
      </div>
    );
  }
  return null;
};

export const TrendChart: React.FC<TrendChartProps> = ({ politicians, historyWindowDays = 180 }) => {
  // 1. Collect all unique dates from all politicians
  const allDates = new Set<string>();
  politicians.forEach(p => {
      p.history.forEach(h => {
          if (h.time) allDates.add(h.time);
      });
  });

  // 2. Sort dates chronologically
  const sortedDates = Array.from(allDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  // 3. Construct chart data points ensuring alignment
  const chartData = sortedDates.map(date => {
      const point: any = { time: date };
      
      politicians.forEach(p => {
          // Find if this politician has an entry for this specific date
          const entry = p.history.find(h => h.time === date);
          
          if (entry) {
              point[p.id] = entry.score;
              point[`${p.id}_reason`] = entry.reason;
              point[`${p.id}_url`] = entry.sourceUrl;
          } else {
              // Optional: Interpolate or leave undefined for broken lines. 
          }
      });
      return point;
  });

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 10, fill: '#64748b' }} 
            tickFormatter={(val) => {
                // Format YYYY-MM-DD to cleaner format like "Oct 24"
                if (!val) return "";
                const date = new Date(val);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
            interval="preserveStartEnd"
            minTickGap={30}
          />
          <YAxis domain={['auto', 'auto']} hide />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '5px', fontSize: '12px' }} />
          <Brush 
              dataKey="time" 
              height={30} 
              stroke="#cbd5e1" 
              tickFormatter={(val) => {
                  const date = new Date(val);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
          />
          {politicians.map((p) => (
            <Line
              key={p.id}
              type="monotone"
              dataKey={p.id}
              name={p.name}
              stroke={p.color}
              strokeWidth={2}
              dot={true}
              activeDot={{ r: 5 }}
              connectNulls={true} // Connects lines even if data is missing for some dates
              animationDuration={1000}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};