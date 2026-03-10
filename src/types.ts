export type HealthStatus = 'normal' | 'caution' | 'danger';

export interface HealthMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  referenceRange: string;
  status: HealthStatus;
  description: string;
  category: 'liver' | 'kidney' | 'blood' | 'metabolism' | 'other';
}

export interface HealthReport {
  id: string;
  uid?: string;
  date: string;
  overallScore: number;
  summary: string;
  metrics: HealthMetric[];
  actionPlan: {
    diet: string[];
    exercise: string[];
    medical: string[];
  };
}

export interface UserProfile {
  name: string;
  age: number;
  gender: 'male' | 'female';
}
