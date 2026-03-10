import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Upload, 
  History, 
  LayoutDashboard, 
  ChevronRight, 
  Camera, 
  FileText,
  AlertTriangle,
  ArrowRight,
  Plus,
  User as UserIcon,
  Search,
  CheckCircle,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, Button } from './components/UI';
import { MetricCard } from './components/MetricCard';
import { TrendChart } from './components/TrendChart';
import { analyzeHealthResult, simulateOCR } from './services/geminiService';
import { HealthReport, UserProfile } from './types';
import { useAuth } from './components/AuthProvider';
import { db, collection, query, where, orderBy, onSnapshot, setDoc, doc, Timestamp, deleteDoc, writeBatch, getDocs } from './firebase';

import { PresentationView } from './components/PresentationView';

type View = 'landing' | 'my-info' | 'upload' | 'analysis' | 'history' | 'presentation';

export default function App() {
  const { user, loading: authLoading, signIn, logout } = useAuth();
  const [view, setView] = useState<string>('landing');
  const [reports, setReports] = useState<HealthReport[]>([]);
  const [currentReport, setCurrentReport] = useState<HealthReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: '사용자', age: 30, gender: 'male' });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync reports from Firestore
  useEffect(() => {
    if (!user) {
      setReports([]);
      return;
    }

    const q = query(
      collection(db, 'health_reports'),
      where('uid', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReports = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as HealthReport[];
      setReports(fetchedReports);
    }, (error) => {
      console.error("Firestore error:", error);
      // If index is missing, fallback to simple query and sort in memory
      if (error.message.includes('index')) {
        const simpleQ = query(collection(db, 'health_reports'), where('uid', '==', user.uid));
        onSnapshot(simpleQ, (snapshot) => {
          const fetchedReports = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          })) as HealthReport[];
          setReports(fetchedReports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        });
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Sync profile from Firestore
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.profile) {
          setUserProfile(data.profile);
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  const clearAllData = async () => {
    if (!user) return;
    if (window.confirm('모든 건강 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      try {
        const q = query(collection(db, 'health_reports'), where('uid', '==', user.uid));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        setView('landing');
      } catch (e) {
        console.error('Failed to clear data', e);
        alert('데이터 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        profile: userProfile
      }, { merge: true });
      setShowProfileModal(false);
    } catch (e) {
      console.error('Failed to save profile', e);
      alert('프로필 저장 중 오류가 발생했습니다.');
    }
  };

  const startDemo = async () => {
    if (!user) {
      signIn();
      return;
    }
    
    const batch = writeBatch(db);
    
    const mockReports = [
      {
        id: 'mock-1',
        uid: user.uid,
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 12).toISOString(),
        overallScore: 88,
        summary: "1년 전 검진 결과입니다. 모든 수치가 매우 양호하며 건강한 상태를 유지하고 계셨습니다.",
        metrics: [
          { id: 'm1', name: '간 수치 (ALT)', value: 28, unit: 'U/L', referenceRange: '0-40', status: 'normal', description: '간 세포 손상을 나타내는 지표입니다.', category: 'liver' },
          { id: 'm2', name: '공복 혈당', value: 92, unit: 'mg/dL', referenceRange: '70-99', status: 'normal', description: '정상 범위 내에 있습니다.', category: 'metabolism' },
          { id: 'm3', name: '총 콜레스테롤', value: 165, unit: 'mg/dL', referenceRange: '0-200', status: 'normal', description: '정상 범위 내에 있습니다.', category: 'blood' },
          { id: 'm4', name: '신장 수치 (Cr)', value: 0.8, unit: 'mg/dL', referenceRange: '0.7-1.3', status: 'normal', description: '신장 기능을 나타내는 지표입니다.', category: 'kidney' },
          { id: 'm5', name: '혈압 (수축기)', value: 118, unit: 'mmHg', referenceRange: '90-120', status: 'normal', description: '정상 혈압입니다.', category: 'blood' }
        ],
        actionPlan: {
          diet: ["현재의 균형 잡힌 식단 유지", "충분한 수분 섭취"],
          exercise: ["꾸준한 유산소 운동 유지"],
          medical: ["정기적인 연 1회 검진 권장"]
        },
        createdAt: Timestamp.now().toDate().toISOString()
      },
      {
        id: 'mock-2',
        uid: user.uid,
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 6).toISOString(),
        overallScore: 82,
        summary: "6개월 전 검진 결과입니다. 전반적으로 양호하지만 혈당이 정상 범위를 약간 상회하기 시작했습니다.",
        metrics: [
          { id: 'm1', name: '간 수치 (ALT)', value: 35, unit: 'U/L', referenceRange: '0-40', status: 'normal', description: '정상 범위 내에 있습니다.', category: 'liver' },
          { id: 'm2', name: '공복 혈당', value: 102, unit: 'mg/dL', referenceRange: '70-99', status: 'caution', description: '당뇨병 전단계 수준입니다.', category: 'metabolism' },
          { id: 'm3', name: '총 콜레스테롤', value: 185, unit: 'mg/dL', referenceRange: '0-200', status: 'normal', description: '정상 범위 내에 있습니다.', category: 'blood' },
          { id: 'm4', name: '신장 수치 (Cr)', value: 0.9, unit: 'mg/dL', referenceRange: '0.7-1.3', status: 'normal', description: '신장 기능은 정상입니다.', category: 'kidney' },
          { id: 'm5', name: '혈압 (수축기)', value: 124, unit: 'mmHg', referenceRange: '90-120', status: 'caution', description: '정상보다 약간 높은 혈압입니다.', category: 'blood' }
        ],
        actionPlan: {
          diet: ["단 음식 및 정제 탄수화물 섭취 줄이기"],
          exercise: ["주 3회 이상 걷기 운동"],
          medical: ["혈당 수치 모니터링 필요"]
        },
        createdAt: Timestamp.now().toDate().toISOString()
      },
      {
        id: 'mock-3',
        uid: user.uid,
        date: new Date().toISOString(),
        overallScore: 68,
        summary: "최근 검진 결과, 간 수치와 혈당이 급격히 상승하여 주의가 필요합니다. 특히 간 수치(ALT)가 위험 수준에 도달했으므로 즉각적인 생활 습관 개선이 필요합니다.",
        metrics: [
          { id: 'm1', name: '간 수치 (ALT)', value: 72, unit: 'U/L', referenceRange: '0-40', status: 'danger', description: '간 세포 손상이 의심되는 수준입니다. 과음이나 과로를 피해야 합니다.', category: 'liver' },
          { id: 'm2', name: '공복 혈당', value: 118, unit: 'mg/dL', referenceRange: '70-99', status: 'danger', description: '혈당 관리가 시급한 수준입니다.', category: 'metabolism' },
          { id: 'm3', name: '총 콜레스테롤', value: 215, unit: 'mg/dL', referenceRange: '0-200', status: 'caution', description: '정상 범위를 초과했습니다. 지방 섭취를 줄여야 합니다.', category: 'blood' },
          { id: 'm4', name: '신장 수치 (Cr)', value: 1.1, unit: 'mg/dL', referenceRange: '0.7-1.3', status: 'normal', description: '신장 기능은 정상입니다.', category: 'kidney' },
          { id: 'm5', name: '혈압 (수축기)', value: 138, unit: 'mmHg', referenceRange: '90-120', status: 'danger', description: '고혈압 관리가 필요합니다.', category: 'blood' }
        ],
        actionPlan: {
          diet: ["금주 및 저염식 식단 필수", "가공식품 및 고지방 음식 제한"],
          exercise: ["매일 40분 이상 걷기", "충분한 휴식과 수면 확보"],
          medical: ["내과 전문의 상담 및 정밀 검사 권장"]
        },
        createdAt: Timestamp.now().toDate().toISOString()
      }
    ];

    try {
      mockReports.forEach(report => {
        const ref = doc(collection(db, 'health_reports'));
        batch.set(ref, report);
      });
      await batch.commit();
      setView('my-info');
    } catch (e) {
      console.error('Failed to save demo data', e);
      alert('데모 데이터 저장 중 오류가 발생했습니다.');
    }
  };

  const renderLanding = () => (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center space-y-10 py-20">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-4"
      >
        <div className="inline-flex items-center gap-2 bg-blue-50 text-health-blue px-4 py-2 rounded-full text-sm font-bold">
          <Activity size={16} /> AI 기반 스마트 건강 관리
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 leading-[1.1]">
          어려운 검진 결과,<br />
          <span className="text-health-blue">CareLink</span>가 풀어드려요.
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
          복잡한 의학 용어와 수치들, 이제 고민하지 마세요. 
          AI가 당신의 건강 상태를 분석하고 맞춤형 액션 플랜을 제안합니다.
        </p>
        {!process.env.GEMINI_API_KEY && (
          <div className="bg-amber-50 border border-amber-100 text-amber-700 px-6 py-3 rounded-2xl text-sm font-medium inline-flex items-center gap-2 mt-4">
            <Zap size={16} className="text-amber-500" />
            현재 데모 모드입니다. 실제 AI 분석을 위해서는 API 키 설정이 필요합니다.
          </div>
        )}
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        {user ? (
          <Button size="lg" className="px-10 h-14 text-lg shadow-lg shadow-blue-200" onClick={() => setView(reports.length > 0 ? 'my-info' : 'upload')}>
            {reports.length > 0 ? '나의 정보 확인하기' : '검진 결과 분석하기'} <ArrowRight className="ml-2" />
          </Button>
        ) : (
          <Button size="lg" className="px-10 h-14 text-lg shadow-lg shadow-blue-200" onClick={signIn}>
            로그인하여 시작하기 <ArrowRight className="ml-2" />
          </Button>
        )}
        <Button size="lg" variant="outline" className="px-10 h-14 text-lg" onClick={startDemo}>
          데모 데이터로 체험하기
        </Button>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl pt-20"
      >
        {[
          { icon: Camera, title: '간편한 촬영', desc: '종이 결과표를 찍기만 하면 자동으로 수치를 인식합니다.' },
          { icon: Activity, title: 'AI 정밀 분석', desc: '최신 의학 가이드라인을 바탕으로 위험도를 평가합니다.' },
          { icon: History, title: '건강 히스토리', desc: '과거 데이터와 비교하여 건강 변화 추이를 분석합니다.' }
        ].map((feature, i) => (
          <div key={i} className="flex flex-col items-center p-6 space-y-3">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-health-blue">
              <feature.icon size={24} />
            </div>
            <h3 className="font-bold text-slate-800">{feature.title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
          </div>
        ))}
      </motion.div>

      {/* Footer Links */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="pt-20 flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm font-medium text-slate-400 border-t border-slate-100 w-full max-w-5xl"
      >
        <button onClick={() => setView('presentation')} className="hover:text-health-blue transition-colors">발표 모드</button>
        <button className="hover:text-health-blue transition-colors">도움말</button>
        <button className="hover:text-health-blue transition-colors">이용약관</button>
        <button className="hover:text-health-blue transition-colors">개인정보처리방침</button>
        <button className="hover:text-health-blue transition-colors">문의하기</button>
      </motion.div>
    </div>
  );

  // Save reports to localStorage when they change
  useEffect(() => {
    localStorage.setItem('carelink_reports', JSON.stringify(reports));
  }, [reports]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      signIn();
      return;
    }

    setIsAnalyzing(true);
    setView('analysis');

    try {
      // For demo purposes, we'll wait a bit to simulate analysis
      await new Promise(resolve => setTimeout(resolve, 3000));

      let finalReport: HealthReport;

      // If API key is missing, use mock analysis
      if (!process.env.GEMINI_API_KEY) {
        finalReport = {
          id: Math.random().toString(36).substr(2, 9),
          uid: user.uid,
          date: new Date().toISOString(),
          overallScore: 75,
          summary: "AI 분석 결과(데모 모드): 전반적으로 양호하지만 콜레스테롤 수치가 약간 높습니다. 꾸준한 유산소 운동과 식이 조절을 권장합니다.",
          metrics: [
            { id: 'm1', name: '간 수치 (ALT)', value: 42, unit: 'U/L', referenceRange: '0-40', status: 'caution', description: '정상 범위를 약간 벗어났습니다.', category: 'liver' },
            { id: 'm2', name: '공복 혈당', value: 98, unit: 'mg/dL', referenceRange: '70-99', status: 'normal', description: '정상 범위 내에 있습니다.', category: 'metabolism' },
            { id: 'm3', name: '총 콜레스테롤', value: 205, unit: 'mg/dL', referenceRange: '0-200', status: 'caution', description: '정상 범위를 약간 초과했습니다.', category: 'blood' },
            { id: 'm4', name: '신장 수치 (Cr)', value: 1.0, unit: 'mg/dL', referenceRange: '0.7-1.3', status: 'normal', description: '신장 기능은 정상입니다.', category: 'kidney' },
            { id: 'm5', name: '혈압 (수축기)', value: 122, unit: 'mmHg', referenceRange: '90-120', status: 'caution', description: '정상보다 약간 높은 혈압입니다.', category: 'blood' }
          ],
          actionPlan: {
            diet: ["포화 지방 섭취 줄이기", "식이섬유 섭취 늘리기"],
            exercise: ["주 5회 30분 이상 유산소 운동"],
            medical: ["3개월 후 재검사 권장"]
          }
        };
      } else {
        // Real analysis if API key exists
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.readAsDataURL(file);
        });
        
        const extractedText = await simulateOCR(base64);
        finalReport = await analyzeHealthResult(extractedText, userProfile);
        finalReport.uid = user.uid;
      }

      // Save to Firestore
      const reportRef = doc(collection(db, 'health_reports'));
      await setDoc(reportRef, {
        ...finalReport,
        id: reportRef.id,
        createdAt: Timestamp.now().toDate().toISOString()
      });
      
      setCurrentReport({ ...finalReport, id: reportRef.id });
      setIsAnalyzing(false);
    } catch (error) {
      console.error('Analysis failed', error);
      setIsAnalyzing(false);
      alert('분석 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  const renderMyInfo = () => {
    if (!user) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-health-blue">
            <UserIcon size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">로그인이 필요합니다</h2>
            <p className="text-slate-500 max-w-xs mx-auto">
              나의 건강 대시보드를 확인하려면 로그인이 필요합니다.
            </p>
          </div>
          <Button size="lg" onClick={signIn} className="px-8">
            Google로 로그인하기
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">나의 건강 정보</h1>
            <p className="text-slate-500 mt-1">{userProfile.name}님의 건강 상태와 과거 기록을 통합하여 보여드립니다.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Button variant="outline" className="flex-1 md:flex-none" onClick={() => setShowProfileModal(true)}>
              프로필 수정
            </Button>
            <Button className="flex-1 md:flex-none" onClick={() => setView('upload')}>
              <Plus size={18} className="mr-2" />
              새 검진 등록
            </Button>
          </div>
        </header>

        {reports.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed border-2 border-slate-200 bg-slate-50/50">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
              <FileText className="text-slate-400" size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">등록된 건강 정보가 없습니다</h2>
            <p className="text-slate-500 mt-2 max-w-xs">
              건강검진 결과표를 등록하여 나의 건강 정보를 관리해보세요.
            </p>
            <div className="flex gap-4 mt-6">
              <Button onClick={() => setView('upload')}>
                지금 시작하기
              </Button>
              <Button variant="outline" onClick={startDemo}>
                데모 데이터 불러오기
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Dashboard Summary Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="md:col-span-2 flex flex-col sm:flex-row items-center gap-8">
                <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-slate-100"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={364.4}
                      strokeDashoffset={364.4 - (364.4 * (reports[0].overallScore || 0)) / 100}
                      className="text-health-blue transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-slate-900">{reports[0].overallScore}</span>
                    <span className="text-xs font-semibold text-slate-400 uppercase">Health Score</span>
                  </div>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-xl font-bold text-slate-800">최근 검진 요약</h3>
                  <p className="text-slate-600 mt-2 leading-relaxed">
                    {reports[0].summary}
                  </p>
                  <Button variant="ghost" size="sm" className="mt-4 p-0 hover:bg-transparent text-health-blue font-bold" onClick={() => {
                    setCurrentReport(reports[0]);
                    setView('analysis');
                  }}>
                    상세 리포트 보기 <ChevronRight size={16} />
                  </Button>
                </div>
              </Card>

              <Card className="flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">주의 항목</h3>
                  <p className="text-sm text-slate-500 mt-1">관리가 필요한 수치들입니다.</p>
                </div>
                <div className="mt-4 space-y-3">
                  {reports[0].metrics.filter(m => m.status !== 'normal').slice(0, 3).map(m => (
                    <div key={m.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`status-dot ${m.status === 'danger' ? 'status-dot-red' : 'status-dot-yellow'}`} />
                        <span className="font-semibold text-slate-700">{m.name}</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-slate-900">{m.value} {m.unit}</span>
                    </div>
                  ))}
                  {reports[0].metrics.filter(m => m.status !== 'normal').length === 0 && (
                    <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl">
                      <CheckCircle className="text-health-green" size={18} />
                      <span className="text-sm font-semibold text-emerald-700">모든 수치가 정상 범위입니다.</span>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Trend Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TrendChart reports={reports} metricName="간 수치 (ALT)" />
              <TrendChart reports={reports} metricName="공복 혈당" />
            </div>

            {/* History Section Integrated */}
            <section className="pt-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">과거 검진 기록</h3>
                <Button variant="outline" size="sm" className="text-health-red border-health-red/20 hover:bg-red-50" onClick={clearAllData}>
                  기록 초기화
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {reports.map(report => (
                  <Card 
                    key={report.id} 
                    className="flex items-center justify-between hover:border-health-blue transition-all cursor-pointer group"
                    onClick={() => {
                      setCurrentReport(report);
                      setView('analysis');
                    }}
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-health-blue transition-colors">
                        <FileText size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">
                          {new Date(report.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 검진
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">종합 점수: {report.overallScore}점</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex -space-x-2">
                        {report.metrics.filter(m => m.status !== 'normal').map((m, i) => (
                          <div key={i} className={`w-3 h-3 rounded-full border-2 border-white ${m.status === 'danger' ? 'bg-health-red' : 'bg-health-yellow'}`} title={m.name} />
                        ))}
                      </div>
                      <ChevronRight size={20} className="text-slate-300 group-hover:text-health-blue transition-colors" />
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    );
  };

  const renderUpload = () => (
    <div className="max-w-2xl mx-auto space-y-8 py-10">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900">검진 결과 등록</h2>
        <p className="text-slate-500 mt-2">결과표를 촬영하거나 파일을 업로드하면 AI가 분석해 드립니다.</p>
      </div>

      <div 
        className="border-2 border-dashed border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center bg-white hover:border-health-blue transition-colors cursor-pointer group"
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*,application/pdf"
          onChange={handleFileUpload}
        />
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-blue-50 transition-colors mb-6">
          <Upload className="text-slate-400 group-hover:text-health-blue transition-colors" size={40} />
        </div>
        <h3 className="text-xl font-bold text-slate-800">파일 선택 또는 드래그</h3>
        <p className="text-slate-500 mt-2">JPG, PNG, PDF 파일 (최대 10MB)</p>
        <div className="flex gap-4 mt-8">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-100 px-4 py-2 rounded-full">
            <Camera size={16} /> 카메라 촬영
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-100 px-4 py-2 rounded-full">
            <FileText size={16} /> PDF 업로드
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-6 rounded-2xl flex gap-4">
        <div className="bg-health-blue/10 p-2 rounded-lg h-fit">
          <AlertTriangle className="text-health-blue" size={24} />
        </div>
        <div>
          <h4 className="font-bold text-slate-800">개인정보 보호 안내</h4>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">
            업로드하신 정보는 AI 분석을 위해서만 사용되며, 모든 데이터는 암호화되어 안전하게 처리됩니다. 
            의학적 판단은 반드시 전문의와 상담하시기 바랍니다.
          </p>
        </div>
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" onClick={() => setView('my-info')}>
          돌아가기
        </Button>
      </div>
    </div>
  );

  const renderAnalysis = () => (
    <div className="space-y-8">
      {isAnalyzing ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="relative w-24 h-24 mb-8">
            <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
            <div className="absolute inset-0 border-4 border-health-blue rounded-full border-t-transparent animate-spin" />
            <Activity className="absolute inset-0 m-auto text-health-blue animate-pulse" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">AI가 결과를 분석 중입니다</h2>
          <p className="text-slate-500 mt-2">수치를 추출하고 의학 가이드라인과 비교하고 있어요. 잠시만 기다려주세요.</p>
          <div className="mt-8 flex gap-2">
            <div className="w-2 h-2 bg-health-blue rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 bg-health-blue rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 bg-health-blue rounded-full animate-bounce" />
          </div>
        </div>
      ) : currentReport && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <header className="flex justify-between items-center">
            <div>
              <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => setView('my-info')}>
                <ChevronRight size={16} className="rotate-180 mr-1" /> 나의 정보로 돌아가기
              </Button>
              <h1 className="text-3xl font-bold text-slate-900">검진 결과 리포트</h1>
              <p className="text-slate-500 mt-1">{new Date(currentReport.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 검진</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline">PDF 다운로드</Button>
              <Button variant="outline">공유하기</Button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Card className="bg-slate-900 text-white border-none">
                <div className="flex items-center gap-6">
                  <div className="text-5xl font-bold text-health-blue">{currentReport.overallScore}</div>
                  <div>
                    <h3 className="text-xl font-bold">종합 건강 점수</h3>
                    <p className="text-slate-400 mt-1">{currentReport.summary}</p>
                  </div>
                </div>
              </Card>

              <section>
                <h3 className="text-xl font-bold text-slate-800 mb-4">상세 수치 분석</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentReport.metrics.map(metric => (
                    <MetricCard key={metric.name} metric={metric} />
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <Card className="bg-emerald-50 border-emerald-100">
                <h3 className="text-lg font-bold text-emerald-900 flex items-center gap-2">
                  <Activity size={20} /> 맞춤형 액션 플랜
                </h3>
                
                <div className="mt-6 space-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-emerald-700 uppercase tracking-wider mb-3">식단 가이드</h4>
                    <ul className="space-y-2">
                      {currentReport.actionPlan.diet.map((item, i) => (
                        <li key={i} className="flex gap-2 text-sm text-emerald-800">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-emerald-700 uppercase tracking-wider mb-3">운동 추천</h4>
                    <ul className="space-y-2">
                      {currentReport.actionPlan.exercise.map((item, i) => (
                        <li key={i} className="flex gap-2 text-sm text-emerald-800">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-emerald-700 uppercase tracking-wider mb-3">의료 권고</h4>
                    <ul className="space-y-2">
                      {currentReport.actionPlan.medical.map((item, i) => (
                        <li key={i} className="flex gap-2 text-sm text-emerald-800">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <Button className="w-full mt-8 bg-emerald-600 hover:bg-emerald-700">
                  주변 병원 예약하기 <ArrowRight size={16} className="ml-2" />
                </Button>
              </Card>

              <Card>
                <h3 className="text-lg font-bold text-slate-800">관련 건강 정보</h3>
                <div className="mt-4 space-y-4">
                  <div className="group cursor-pointer">
                    <h4 className="text-sm font-bold text-slate-700 group-hover:text-health-blue transition-colors">간 수치를 낮추는 5가지 습관</h4>
                    <p className="text-xs text-slate-500 mt-1">전문의가 알려주는 간 건강 관리법</p>
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div className="group cursor-pointer">
                    <h4 className="text-sm font-bold text-slate-700 group-hover:text-health-blue transition-colors">공복 혈당 장애, 당뇨로 가는 길목인가?</h4>
                    <p className="text-xs text-slate-500 mt-1">혈당 조절의 중요성과 예방법</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );

  if (view === 'presentation') {
    return <PresentationView onClose={() => setView('landing')} />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-health-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">사용자 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('landing')}>
            <div className="w-8 h-8 bg-health-blue rounded-lg flex items-center justify-center">
              <Activity className="text-white" size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">CareLink</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            {!process.env.GEMINI_API_KEY && (
              <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-[10px] font-bold border border-amber-100 uppercase tracking-wider">
                <Zap size={10} /> Demo Mode
              </div>
            )}
            <button 
              onClick={() => setView('landing')}
              className={`text-sm font-semibold transition-colors ${view === 'landing' ? 'text-health-blue' : 'text-slate-500 hover:text-slate-900'}`}
            >
              홈
            </button>
            <button 
              onClick={() => {
                if (!user) signIn();
                else setView('my-info');
              }}
              className={`text-sm font-semibold transition-colors ${view === 'my-info' ? 'text-health-blue' : 'text-slate-500 hover:text-slate-900'}`}
            >
              나의 정보
            </button>
            <div className="w-px h-4 bg-slate-200" />
            
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer hover:text-health-blue transition-colors" onClick={() => setShowProfileModal(true)}>
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden">
                    {user.photoURL ? <img src={user.photoURL} alt="profile" className="w-full h-full object-cover" /> : <UserIcon size={16} />}
                  </div>
                  {userProfile.name}
                </div>
                <button onClick={logout} className="text-xs font-bold text-slate-400 hover:text-health-red transition-colors">로그아웃</button>
              </div>
            ) : (
              <Button size="sm" onClick={signIn}>로그인</Button>
            )}
          </div>

          <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setView('my-info')}>
            <LayoutDashboard size={20} />
          </Button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 pt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {view === 'landing' && renderLanding()}
            {view === 'my-info' && renderMyInfo()}
            {view === 'upload' && renderUpload()}
            {view === 'analysis' && renderAnalysis()}
          </motion.div>
        </AnimatePresence>

        {/* Profile Modal */}
        <AnimatePresence>
          {showProfileModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={() => setShowProfileModal(false)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8"
              >
                <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">프로필 설정</h2>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">이름</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-health-blue focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                      value={userProfile.name}
                      onChange={(e) => setUserProfile(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">나이</label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-health-blue focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                        value={userProfile.age}
                        onChange={(e) => setUserProfile(prev => ({ ...prev, age: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">성별</label>
                      <select 
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-health-blue focus:ring-2 focus:ring-blue-100 outline-none transition-all appearance-none bg-white"
                        value={userProfile.gender}
                        onChange={(e) => setUserProfile(prev => ({ ...prev, gender: e.target.value as 'male' | 'female' }))}
                      >
                        <option value="male">남성</option>
                        <option value="female">여성</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <Button className="w-full mt-10 h-14 text-lg" onClick={saveProfile}>
                  저장하기
                </Button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation for Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50">
        <button onClick={() => setView('landing')} className={`flex flex-col items-center gap-1 ${view === 'landing' ? 'text-health-blue' : 'text-slate-400'}`}>
          <LayoutDashboard size={20} />
          <span className="text-[10px] font-bold">홈</span>
        </button>
        <button onClick={() => {
          if (!user) signIn();
          else setView('upload');
        }} className="flex flex-col items-center gap-1 text-slate-400">
          <div className="w-12 h-12 bg-health-blue rounded-full flex items-center justify-center -mt-8 shadow-lg shadow-blue-200">
            <Plus className="text-white" size={24} />
          </div>
          <span className="text-[10px] font-bold">등록</span>
        </button>
        <button onClick={() => {
          if (!user) signIn();
          else setView('my-info');
        }} className={`flex flex-col items-center gap-1 ${view === 'my-info' ? 'text-health-blue' : 'text-slate-400'}`}>
          <History size={20} />
          <span className="text-[10px] font-bold">나의 정보</span>
        </button>
      </div>
    </div>
  );
}
