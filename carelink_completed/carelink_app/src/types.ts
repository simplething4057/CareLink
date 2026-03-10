export type HealthStatus = 'normal' | 'caution' | 'danger';

export type MetricKey = 'bloodPressure' | 'glucose' | 'cholesterol' | 'bmi' | 'liver';

export interface HealthMetric {
  id: string;
  key: MetricKey;
  name: string;
  value: number;
  unit: string;
  referenceRange: string;
  status: HealthStatus;
  description: string;
  category: 'liver' | 'blood' | 'metabolism' | 'other';
}

export interface RiskFactor {
  title: string;
  level: HealthStatus;
  reason: string;
}

export interface MonitoringFeedback {
  adherenceQuestion: string;
  nextCheck: string;
  escalationSignal: string;
}

export interface HealthReport {
  id: string;
  uid?: string;
  memberKey?: string;
  date: string;
  sourceType?: 'manual' | 'upload' | 'nhis-consent';
  fileName?: string;
  overallScore: number;
  summary: string;
  healthStateDescription: string;
  metrics: HealthMetric[];
  riskFactors: RiskFactor[];
  actionPlan: {
    diet: string[];
    exercise: string[];
    lifestyle: string[];
  };
  monitoring: MonitoringFeedback[];
  createdAt?: string;
}

export interface UserProfile {
  name: string;
  age: number;
  gender: 'male' | 'female';
}

export interface ManualHealthInput {
  date: string;
  systolicBp: number;
  fastingGlucose: number;
  totalCholesterol: number;
  bmi: number;
  alt: number;
  consentToImport?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}
