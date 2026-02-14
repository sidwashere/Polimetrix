import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Politician } from '../types';

interface TrendChartProps {
  politicians: Politician[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-xs">
        <p className="font-bold text-slate-700 mb-2">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="mb-1">
            <div className="flex items-center gap-2">
               <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
               <span className="font-medium">{entry.name}: {entry.value}</span>
            </div>
            {/* Show the reason/context if passed in the payload */}
            {entry.payload[`${entry.dataKey}_reason`] && (
                <p className="text-slate-400 pl-4 italic max-w-[200px] truncate">
                    {entry.payload[`${entry.dataKey}_reason`]}
                </p>
            )}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const TrendChart: React.FC<TrendChartProps> = ({ politicians }) => {
  
  // To chart multiple lines with potentially different time points, we need to unify the timeline
  // or just use the longest history if we assume sync. 
  // For this implementation, we will merge data based on index for simplicity, 
  // but ideally we'd map by Date.
  
  // We'll take the history of the first politician as the "master" timeline for X-axis structure
  // if roughly synced, or just flatten all unique dates.
  
  // A simpler approach for the visualization:
  // Create a unified set of data points based on the longest history.
  
  const maxHistory = Math.max(...politicians.map(p => p.history.length));
  
  const chartData = Array.from({ length: maxHistory }, (_, i) => {
    const point: any = {};
    
    politicians.forEach(p => {
      // Get the item at index i (or the last one if i is out of bounds for this pol, though we try to sync)
      const item = p.history[i];
      if (item) {
          point[p.id] = item.score;
          point[`${p.id}_reason`] = item.reason;
          // Use the date from the first politician found at this index as the label
          if (!point.time) point.time = item.time;
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
                // If val is YYYY-MM-DD, show MM-DD
                if (val && val.length > 5) return val.substring(5);
                return val;
            }}
            interval="preserveStartEnd"
          />
          <YAxis domain={['auto', 'auto']} hide />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
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
              connectNulls
              animationDuration={1000}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};