import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { HealthReport } from '../types';
import { Card } from './UI';

interface TrendChartProps {
  reports: HealthReport[];
  metricName: string;
}

export function TrendChart({ reports, metricName }: TrendChartProps) {
  const data = reports
    .map(r => {
      const metric = r.metrics.find(m => m.name === metricName);
      return {
        date: new Date(r.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
        value: metric?.value || 0,
        fullDate: r.date
      };
    })
    .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());

  return (
    <Card className="h-[350px] w-full">
      <h3 className="text-lg font-bold mb-6 text-slate-800">{metricName} 추이</h3>
      <ResponsiveContainer width="100%" height="80%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ 
              borderRadius: '12px', 
              border: 'none', 
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              padding: '12px'
            }}
          />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#3b82f6" 
            strokeWidth={3} 
            dot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 8, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
