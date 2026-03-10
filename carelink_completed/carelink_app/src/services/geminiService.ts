import { GoogleGenAI, Type } from '@google/genai';
import { ChatMessage, HealthMetric, HealthReport, HealthStatus, ManualHealthInput, UserProfile } from '../types';

let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  }
  return aiInstance;
};

const STATUS_ORDER: Record<HealthStatus, number> = { normal: 0, caution: 1, danger: 2 };

const buildMetric = (
  key: HealthMetric['key'],
  name: string,
  value: number,
  unit: string,
  referenceRange: string,
  status: HealthStatus,
  description: string,
  category: HealthMetric['category'],
): HealthMetric => ({
  id: `${key}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  key,
  name,
  value,
  unit,
  referenceRange,
  status,
  description,
  category,
});

const describeTrendBasedRule = (value: number, caution: number, danger: number, highLabel: string, cautionLabel: string) => {
  if (value >= danger) return `${highLabel} 범위로 해석됩니다.`;
  if (value >= caution) return `${cautionLabel} 경계로 보입니다.`;
  return '현재 기준에서는 안정 범위입니다.';
};

export function analyzeHealthInputs(
  input: ManualHealthInput,
  userProfile: UserProfile,
  opts?: { sourceType?: HealthReport['sourceType']; fileName?: string; memberKey?: string },
): HealthReport {
  const bpStatus: HealthStatus = input.systolicBp >= 140 ? 'danger' : input.systolicBp >= 130 ? 'caution' : 'normal';
  const glucoseStatus: HealthStatus = input.fastingGlucose >= 126 ? 'danger' : input.fastingGlucose >= 100 ? 'caution' : 'normal';
  const cholStatus: HealthStatus = input.totalCholesterol >= 240 ? 'danger' : input.totalCholesterol >= 200 ? 'caution' : 'normal';
  const bmiStatus: HealthStatus = input.bmi >= 30 ? 'danger' : input.bmi >= 25 || input.bmi < 18.5 ? 'caution' : 'normal';
  const altStatus: HealthStatus = input.alt >= 80 ? 'danger' : input.alt > 40 ? 'caution' : 'normal';

  const metrics: HealthMetric[] = [
    buildMetric('bloodPressure', '혈압(수축기)', input.systolicBp, 'mmHg', '< 130', bpStatus, describeTrendBasedRule(input.systolicBp, 130, 140, '혈압 관리가 필요한', '혈압 상승'), 'blood'),
    buildMetric('glucose', '공복 혈당', input.fastingGlucose, 'mg/dL', '< 100', glucoseStatus, describeTrendBasedRule(input.fastingGlucose, 100, 126, '고혈당', '혈당 상승'), 'metabolism'),
    buildMetric('cholesterol', '총 콜레스테롤', input.totalCholesterol, 'mg/dL', '< 200', cholStatus, describeTrendBasedRule(input.totalCholesterol, 200, 240, '고콜레스테롤', '콜레스테롤 상승'), 'blood'),
    buildMetric('bmi', 'BMI', input.bmi, 'kg/m²', '18.5-24.9', bmiStatus, input.bmi < 18.5 ? '저체중 경향입니다.' : describeTrendBasedRule(input.bmi, 25, 30, '비만 위험', '체중 증가'), 'metabolism'),
    buildMetric('liver', '간수치(ALT)', input.alt, 'U/L', '0-40', altStatus, describeTrendBasedRule(input.alt, 41, 80, '간 기능 주의', '간수치 상승'), 'liver'),
  ];

  const dangerCount = metrics.filter((m) => m.status === 'danger').length;
  const cautionCount = metrics.filter((m) => m.status === 'caution').length;
  const metabolicSignalCount = [bpStatus, glucoseStatus, bmiStatus, cholStatus].filter((s) => s !== 'normal').length;

  const penalty = metrics.reduce((sum, metric) => sum + (metric.status === 'danger' ? 14 : metric.status === 'caution' ? 7 : 0), 0);
  const comboPenalty = metabolicSignalCount >= 3 ? 10 : metabolicSignalCount === 2 ? 5 : 0;
  const overallScore = Math.max(35, Math.min(100, 100 - penalty - comboPenalty));

  const riskFactors = [];
  if (glucoseStatus !== 'normal' && bmiStatus !== 'normal') {
    riskFactors.push({
      title: '대사 위험 신호',
      level: STATUS_ORDER[glucoseStatus] >= STATUS_ORDER[bmiStatus] ? glucoseStatus : bmiStatus,
      reason: '혈당과 체중 지표가 함께 올라 인슐린 저항성 가능성을 우선 점검해야 합니다.',
    });
  }
  if (bpStatus !== 'normal' && cholStatus !== 'normal') {
    riskFactors.push({
      title: '심혈관 부담 신호',
      level: STATUS_ORDER[bpStatus] >= STATUS_ORDER[cholStatus] ? bpStatus : cholStatus,
      reason: '혈압과 콜레스테롤이 함께 상승하면 혈관 부담이 커질 수 있습니다.',
    });
  }
  if (altStatus !== 'normal' && bmiStatus !== 'normal') {
    riskFactors.push({
      title: '간-체중 연관 위험',
      level: STATUS_ORDER[altStatus] >= STATUS_ORDER[bmiStatus] ? altStatus : bmiStatus,
      reason: '간수치 상승과 BMI 증가는 지방간 가능성과 연결될 수 있어 생활습관 점검이 필요합니다.',
    });
  }
  if (riskFactors.length === 0) {
    riskFactors.push({
      title: '안정 유지 권고',
      level: 'normal',
      reason: '현재는 전반적으로 안정적이지만, 추세 관리를 위해 정기 기록이 중요합니다.',
    });
  }

  const summary =
    dangerCount >= 2
      ? '복수 지표에서 즉시 관리가 필요한 신호가 확인되었습니다. 단일 수치보다 조합 위험을 우선 관리해야 합니다.'
      : dangerCount === 1 || cautionCount >= 3
      ? '경계-위험 구간 지표가 겹쳐 있어 생활습관 개입과 재평가가 필요합니다.'
      : cautionCount >= 1
      ? '전반적으로 양호하지만 경계 지표가 있어 선제적 관리가 유리합니다.'
      : '현재는 주요 지표가 안정 범위에 있으며 유지 전략이 중요합니다.';

  const healthStateDescription =
    metabolicSignalCount >= 3
      ? `${userProfile.name}님은 5대 핵심 지표 중 ${metabolicSignalCount}개에서 대사 위험 신호가 보여, 단편적 해석보다 묶음 관리가 적합합니다.`
      : `${userProfile.name}님의 이번 결과는 질환 진단보다는 예방 관리 단계 해석에 적합하며, 반복 기록을 통해 변화 추세를 보는 것이 중요합니다.`;

  const actionPlan = {
    diet: [
      glucoseStatus !== 'normal' ? '정제 탄수화물과 당 음료 섭취 빈도를 줄이고 식사 순서를 채소-단백질-탄수화물 순으로 조정하세요.' : '가공식품 비중을 줄이고 단백질·채소 중심 식단을 유지하세요.',
      cholStatus !== 'normal' ? '튀김·가공육·야식 빈도를 줄이고 식이섬유와 불포화지방을 늘리세요.' : '과식보다는 규칙적인 식사 간격을 유지하세요.',
      altStatus !== 'normal' ? '음주량과 늦은 야식을 점검하고 2~4주 단위로 간수치 변화를 확인하세요.' : '수분 섭취와 염분 조절을 유지하세요.',
    ],
    exercise: [
      bmiStatus !== 'normal' ? '주 5회, 30분 이상 빠르게 걷기 또는 자전거 등 지속 가능한 유산소 운동을 시작하세요.' : '주 3~5회 유산소 운동을 유지하세요.',
      bpStatus !== 'normal' ? '혈압 완화를 위해 운동 강도는 중등도로 유지하고 매주 총 150분 이상 활동량을 확보하세요.' : '근력 운동을 주 2회 이상 병행하세요.',
      '장시간 좌식 시간을 1시간 단위로 끊고 3~5분 가벼운 움직임을 추가하세요.',
    ],
    lifestyle: [
      '수면 시간을 일정하게 유지하고 주중·주말 수면 리듬 차이를 줄이세요.',
      '개선안을 2주 이상 실천해도 변화가 없으면 재측정 또는 전문 상담을 고려하세요.',
      '내가 실제로 지킬 수 있는 수준인지 매주 체크하고, 어려운 항목은 챗봇에서 대체 방안을 조정해보세요.',
    ],
  };

  const monitoring = [
    {
      adherenceQuestion: '식단·운동·생활습관 제안 중 실제로 2주 이상 유지 가능한 항목은 무엇인가요?',
      nextCheck: glucoseStatus !== 'normal' || bpStatus !== 'normal' ? '4~8주 후 혈압과 혈당을 우선 재확인하세요.' : '다음 정기검진 전 월 1회 자가 기록을 권장합니다.',
      escalationSignal: '실천 중인데도 체중·혈압·혈당이 악화되거나 증상이 생기면 전문의 상담으로 전환하세요.',
    },
  ];

  return {
    id: Math.random().toString(36).slice(2, 11),
    date: input.date || new Date().toISOString(),
    memberKey: opts?.memberKey,
    sourceType: opts?.sourceType || 'manual',
    fileName: opts?.fileName,
    overallScore,
    summary,
    healthStateDescription,
    metrics,
    riskFactors,
    actionPlan,
    monitoring,
    createdAt: new Date().toISOString(),
  };
}

export async function analyzeHealthResult(rawText: string, userProfile: UserProfile): Promise<HealthReport> {
  if (!process.env.GEMINI_API_KEY) {
    return analyzeHealthInputs(
      {
        date: new Date().toISOString(),
        systolicBp: 132,
        fastingGlucose: 108,
        totalCholesterol: 214,
        bmi: 26.1,
        alt: 47,
      },
      userProfile,
      { sourceType: 'upload' },
    );
  }

  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: `
      Extract five key metrics from this health checkup data and summarize the preventive health risk.
      User profile: ${userProfile.age} year old ${userProfile.gender}
      Raw data: ${rawText}
      Return JSON with the following numeric fields when available:
      systolicBp, fastingGlucose, totalCholesterol, bmi, alt.
    `,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          systolicBp: { type: Type.NUMBER },
          fastingGlucose: { type: Type.NUMBER },
          totalCholesterol: { type: Type.NUMBER },
          bmi: { type: Type.NUMBER },
          alt: { type: Type.NUMBER },
        },
      },
    },
  });

  const parsed = JSON.parse(response.text || '{}');
  return analyzeHealthInputs(
    {
      date: new Date().toISOString(),
      systolicBp: Number(parsed.systolicBp) || 130,
      fastingGlucose: Number(parsed.fastingGlucose) || 100,
      totalCholesterol: Number(parsed.totalCholesterol) || 200,
      bmi: Number(parsed.bmi) || 25,
      alt: Number(parsed.alt) || 40,
    },
    userProfile,
    { sourceType: 'upload' },
  );
}

export async function simulateOCR(fileDataUrl: string, mimeType = 'image/jpeg'): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return '혈압 132, 공복혈당 108, 총콜레스테롤 214, BMI 26.1, ALT 47';
  }

  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [
      { text: 'Extract visible health checkup metrics from this file. Focus on blood pressure, fasting glucose, cholesterol, BMI, ALT.' },
      { inlineData: { mimeType, data: fileDataUrl.split(',')[1] } },
    ],
  });

  return response.text || '';
}

export async function getChatbotReply(question: string, latestReport?: HealthReport | null): Promise<string> {
  const latestSummary = latestReport
    ? `최신 점수 ${latestReport.overallScore}, 위험요인: ${latestReport.riskFactors.map((item) => item.title).join(', ')}`
    : '아직 저장된 건강 리포트가 없습니다.';

  if (!process.env.GEMINI_API_KEY) {
    if (!latestReport) {
      return '아직 분석된 리포트가 없어서 일반 조언 중심으로 답할게요. 먼저 검진 기록을 입력하면 더 개인화된 답변이 가능합니다.';
    }
    if (question.includes('혈당')) return `최신 기록 기준으로 혈당 관련 위험 신호를 우선 관리하는 것이 좋습니다. ${latestReport.actionPlan.diet[0]}`;
    if (question.includes('운동')) return latestReport.actionPlan.exercise.join(' ');
    if (question.includes('식단')) return latestReport.actionPlan.diet.join(' ');
    return `${latestSummary}. 우선 실천 가능한 항목 1~2개부터 시작하고 4~8주 후 재확인하는 방식이 좋습니다.`;
  }

  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: `You are a cautious Korean health coaching chatbot. This is not a diagnosis. Use the latest summary: ${latestSummary}. User question: ${question}`,
  });
  return response.text || '답변을 생성하지 못했습니다.';
}
