import React from 'react';
import { HealthMetric } from '../types';
import { Card } from './UI';
import { 
  AlertCircle, 
  CheckCircle, 
  Info, 
  Droplets, 
  Activity, 
  Zap, 
  Shield, 
  Heart 
} from 'lucide-react';

interface MetricCardProps {
  metric: HealthMetric;
}

export function MetricCard({ metric }: MetricCardProps) {
  const statusColors = {
    normal: 'text-health-green',
    caution: 'text-health-yellow',
    danger: 'text-health-red'
  };

  const StatusIcon = {
    normal: CheckCircle,
    caution: Info,
    danger: AlertCircle
  }[metric.status];

  const CategoryIcon = {
    liver: Activity,
    kidney: Droplets,
    blood: Heart,
    metabolism: Zap,
    other: Shield
  }[metric.category] || Shield;

  return (
    <Card className="flex flex-col gap-2 group hover:border-health-blue/30 transition-all duration-300">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-health-blue transition-colors">
            <CategoryIcon size={16} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {metric.category}
          </span>
        </div>
        <StatusIcon className={statusColors[metric.status]} size={18} />
      </div>
      
      <h3 className="text-lg font-bold text-slate-800 mt-2">{metric.name}</h3>
      
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-3xl font-bold tracking-tight text-slate-900">{metric.value}</span>
        <span className="text-sm text-slate-500 font-medium">{metric.unit}</span>
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2">
          <span className="text-slate-400">참고치</span>
          <span className="text-slate-600">{metric.referenceRange}</span>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          {metric.description}
        </p>
      </div>
    </Card>
  );
}
