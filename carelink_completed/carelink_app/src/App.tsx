import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileText,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageCircle,
  Plus,
  Shield,
  Upload,
  User as UserIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Button, Card } from './components/UI';
import { MetricCard } from './components/MetricCard';
import { TrendChart } from './components/TrendChart';
import { PresentationView } from './components/PresentationView';
import { useAuth } from './components/AuthProvider';
import {
  addDoc,
  collection,
  db,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from './firebase';
import { ChatMessage, HealthReport, ManualHealthInput, UserProfile } from './types';
import { analyzeHealthInputs, analyzeHealthResult, getChatbotReply, simulateOCR } from './services/geminiService';

type View = 'home' | 'input' | 'mypage' | 'report' | 'presentation';

const defaultProfile: UserProfile = { name: '사용자', age: 30, gender: 'male' };
const defaultInput: ManualHealthInput = {
  date: new Date().toISOString().slice(0, 10),
  systolicBp: 128,
  fastingGlucose: 98,
  totalCholesterol: 185,
  bmi: 24.2,
  alt: 28,
  consentToImport: false,
};

const statusBadge = {
  normal: 'bg-emerald-50 text-emerald-700',
  caution: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
};

export default function App() {
  const { user, loading: authLoading, signIn, logout } = useAuth();
  const [view, setView] = useState<View>('home');
  const [reports, setReports] = useState<HealthReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultProfile);
  const [profileDraft, setProfileDraft] = useState<UserProfile>(defaultProfile);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [form, setForm] = useState<ManualHealthInput>(defaultInput);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '안녕하세요. CareLink 챗봇입니다. 최신 검진 기록 기반으로 상태 확인, 식단/운동/생활습관 조언을 드릴게요.',
      createdAt: new Date().toISOString(),
    },
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      setReports([]);
      return;
    }

    const q = query(collection(db, 'health_reports'), where('uid', '==', user.uid), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next = snapshot.docs.map((docSnap) => ({ ...(docSnap.data() as HealthReport), id: docSnap.id }));
        setReports(next);
        if (!selectedReportId && next.length > 0) setSelectedReportId(next[0].id);
      },
      async () => {
        const fallback = query(collection(db, 'health_reports'), where('uid', '==', user.uid));
        const fallbackUnsub = onSnapshot(fallback, (snapshot) => {
          const next = snapshot.docs
            .map((docSnap) => ({ ...(docSnap.data() as HealthReport), id: docSnap.id }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setReports(next);
          if (!selectedReportId && next.length > 0) setSelectedReportId(next[0].id);
        });
        return fallbackUnsub;
      },
    );

    return () => unsubscribe();
  }, [user, selectedReportId]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (!snap.exists()) return;
      const profile = (snap.data().profile || defaultProfile) as UserProfile;
      setUserProfile(profile);
      setProfileDraft(profile);
    });
    return () => unsubscribe();
  }, [user]);

  const memberKey = useMemo(() => (user ? `CL-${user.uid.slice(0, 8).toUpperCase()}` : '로그인 필요'), [user]);
  const latestReport = useMemo(() => reports.find((item) => item.id === selectedReportId) || reports[0] || null, [reports, selectedReportId]);

  const metricValue = (report: HealthReport | null, metricName: string) => report?.metrics.find((m) => m.name === metricName)?.value ?? '-';

  const saveProfile = async () => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), { uid: user.uid, profile: profileDraft }, { merge: true });
    setShowProfileEditor(false);
  };

  const handleAnalyze = async () => {
    if (!user) {
      await signIn();
      return;
    }

    setIsAnalyzing(true);
    try {
      let report = analyzeHealthInputs(form, userProfile, {
        sourceType: uploadedFile ? 'upload' : form.consentToImport ? 'nhis-consent' : 'manual',
        fileName: uploadedFile?.name,
        memberKey,
      });

      if (uploadedFile) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(uploadedFile);
        });

        const isImage = uploadedFile.type.startsWith('image/');
        if (isImage || uploadedFile.type === 'application/pdf') {
          const ocrText = await simulateOCR(dataUrl, uploadedFile.type || 'image/jpeg');
          report = await analyzeHealthResult(ocrText, userProfile);
          report = {
            ...report,
            date: form.date,
            sourceType: form.consentToImport ? 'nhis-consent' : 'upload',
            fileName: uploadedFile.name,
            memberKey,
          };
        }
      }

      const ref = await addDoc(collection(db, 'health_reports'), {
        ...report,
        uid: user.uid,
        createdAt: Timestamp.now().toDate().toISOString(),
      });
      setSelectedReportId(ref.id);
      setView('report');
      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '새 검진 기록이 저장되었습니다. 마이페이지에서 추이를 확인하고, 챗봇에게 현재 상태를 질문할 수 있어요.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error(error);
      alert('검진 분석 중 오류가 발생했습니다. 입력값을 다시 확인해주세요.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClearRecords = async () => {
    if (!user || !window.confirm('이 계정의 검진 기록을 모두 삭제할까요?')) return;
    const q = query(collection(db, 'health_reports'), where('uid', '==', user.uid));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((item) => batch.delete(item.ref));
    await batch.commit();
    setSelectedReportId(null);
    setView('home');
  };

  const submitChat = async () => {
    if (!chatInput.trim()) return;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: chatInput,
      createdAt: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    const reply = await getChatbotReply(userMessage.content, latestReport);
    setChatMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const seedDemoData = async () => {
    if (!user) {
      await signIn();
      return;
    }
    const samples: ManualHealthInput[] = [
      { date: '2024-03-10', systolicBp: 122, fastingGlucose: 94, totalCholesterol: 178, bmi: 23.4, alt: 24 },
      { date: '2025-03-10', systolicBp: 130, fastingGlucose: 103, totalCholesterol: 205, bmi: 25.6, alt: 39 },
      { date: '2026-03-10', systolicBp: 138, fastingGlucose: 114, totalCholesterol: 226, bmi: 27.2, alt: 52 },
    ];
    const batch = writeBatch(db);
    samples.forEach((sample) => {
      const ref = doc(collection(db, 'health_reports'));
      batch.set(ref, {
        ...analyzeHealthInputs(sample, userProfile, { sourceType: 'manual', memberKey }),
        uid: user.uid,
        id: ref.id,
        createdAt: Timestamp.now().toDate().toISOString(),
      });
    });
    await batch.commit();
    setView('mypage');
  };

  const NavButton = ({ target, label, icon: Icon }: { target: View; label: string; icon: React.ElementType }) => (
    <button
      onClick={() => setView(target)}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
        view === target ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );

  const renderHome = () => (
    <div className="space-y-8">
      <section className="min-h-[62vh] flex flex-col justify-center items-center text-center gap-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-health-blue">
          <Shield size={16} /> 계정별 보안 대시보드 제공
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] text-slate-900">
          CareLink<br />
          <span className="text-health-blue">검진 결과를 이해에서 관리까지</span>
        </h1>
        <p className="max-w-3xl text-lg text-slate-500 leading-relaxed">
          복잡한 검진표를 단순 고저 비교로 끝내지 않고, 회원 키 기반 기록 관리와 대시보드, 위험요인 리포트, 지속 피드백까지 한 화면에서 연결합니다.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={() => setView(user ? 'input' : 'home')} className="px-8">
            {user ? '검진 기록 입력하기' : '로그인 후 시작하기'} <ArrowRight className="ml-2" size={18} />
          </Button>
          {!user ? (
            <Button size="lg" variant="outline" onClick={signIn} className="px-8">
              <LogIn className="mr-2" size={18} /> Google 로그인
            </Button>
          ) : (
            <Button size="lg" variant="outline" onClick={() => setView('mypage')} className="px-8">
              <LayoutDashboard className="mr-2" size={18} /> 마이페이지
            </Button>
          )}
          <Button size="lg" variant="outline" onClick={seedDemoData} className="px-8">
            데모 보기
          </Button>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-4">
        {[
          ['로그인·회원관리', '회원 키를 기반으로 내 기록만 조회 가능'],
          ['검진 기록 입력', '직접 입력 + 이미지/PDF 업로드를 한 화면에서 처리'],
          ['AI 건강분석', '건강 점수 → 위험요인 → 상태 설명 순으로 제공'],
          ['지속 피드백', '식단·운동·생활습관 개선안과 모니터링 질문 제공'],
        ].map(([title, desc]) => (
          <Card key={title} className="space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-health-blue">
              <Activity size={20} />
            </div>
            <h3 className="font-bold text-slate-900">{title}</h3>
            <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
          </Card>
        ))}
      </section>
    </div>
  );

  const renderInput = () => (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">검진 기록 입력</h2>
          <p className="text-slate-500 mt-1">혈압, 혈당, 콜레스테롤, BMI, 간수치를 입력하거나 결과표 파일을 등록하세요.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            검진일
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            혈압(수축기)
            <input type="number" value={form.systolicBp} onChange={(e) => setForm({ ...form, systolicBp: Number(e.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            공복 혈당
            <input type="number" value={form.fastingGlucose} onChange={(e) => setForm({ ...form, fastingGlucose: Number(e.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            총 콜레스테롤
            <input type="number" value={form.totalCholesterol} onChange={(e) => setForm({ ...form, totalCholesterol: Number(e.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            BMI
            <input type="number" step="0.1" value={form.bmi} onChange={(e) => setForm({ ...form, bmi: Number(e.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            간수치(ALT)
            <input type="number" value={form.alt} onChange={(e) => setForm({ ...form, alt: Number(e.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
          </label>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 p-5 bg-slate-50/70">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-800">이미지/PDF 업로드</p>
              <p className="text-sm text-slate-500">건강검진 결과표를 첨부하면 OCR 기반 보조 분석 흐름으로 저장합니다.</p>
            </div>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2" size={16} /> 파일 선택
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setUploadedFile(e.target.files?.[0] || null)} />
          </div>
          {uploadedFile && <p className="mt-3 text-sm text-slate-600">선택 파일: {uploadedFile.name}</p>}
        </div>

        <label className="flex items-start gap-3 rounded-2xl bg-blue-50 px-4 py-4 text-sm text-slate-700">
          <input type="checkbox" checked={form.consentToImport} onChange={(e) => setForm({ ...form, consentToImport: e.target.checked })} className="mt-1" />
          <span>
            국민건강보험공단 데이터 직접 연동 기능을 추후 붙일 수 있도록, <strong>개인정보 제공 동의 기반 불러오기</strong> 요청 상태로 저장합니다.
            현재 버전에서는 자동 연동 대신 동의 여부와 업로드 이력을 기록합니다.
          </span>
        </label>

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleAnalyze} disabled={isAnalyzing}>
            {isAnalyzing ? '분석 중...' : '검진 리포트 생성'}
          </Button>
          <Button variant="outline" onClick={() => setForm(defaultInput)}>입력 초기화</Button>
        </div>
      </Card>

      <Card className="space-y-5">
        <h3 className="text-xl font-bold text-slate-900">입력 전 안내</h3>
        <ul className="space-y-3 text-sm text-slate-600 leading-relaxed">
          <li>• 회원 계정으로 로그인해야 내 대시보드와 기록이 저장됩니다.</li>
          <li>• 대사증후군 관련 5대 핵심 지표를 기준으로 건강 점수와 위험요인을 산출합니다.</li>
          <li>• 리포트는 단순 수치 나열이 아니라 조합 위험, 상태 설명, 개선 방향을 함께 제공합니다.</li>
          <li>• 홈 아이콘을 누르면 언제든 슬로건이 있는 첫 화면으로 돌아갑니다.</li>
        </ul>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          추가로 정해야 할 사항: 건강 점수 가중치 확정, 피드백 주기, NHIS 연동 범위, 의료기관 상담 문구 기준.
        </div>
      </Card>
    </div>
  );

  const renderMyPage = () => {
    if (!user) {
      return (
        <Card className="py-14 text-center space-y-4">
          <UserIcon className="mx-auto text-health-blue" size={36} />
          <h2 className="text-2xl font-bold">마이페이지는 로그인 후 이용할 수 있습니다.</h2>
          <Button onClick={signIn}>Google 로그인</Button>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">마이페이지</h2>
            <p className="mt-1 text-slate-500">회원 키 {memberKey} · 이 계정으로 저장된 건강 지표와 기록만 표시됩니다.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setShowProfileEditor(true)}>회원관리</Button>
            <Button onClick={() => setView('input')}><Plus className="mr-2" size={16} /> 검진 기록 입력</Button>
          </div>
        </div>

        {!latestReport ? (
          <Card className="py-16 text-center space-y-4">
            <FileText className="mx-auto text-slate-400" size={36} />
            <h3 className="text-xl font-bold">아직 저장된 검진 기록이 없습니다.</h3>
            <p className="text-slate-500">데이터 입력 화면에서 직접 입력 또는 PDF 업로드로 첫 기록을 만들어주세요.</p>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <p className="text-sm text-slate-500">건강 점수</p>
                <p className="mt-3 text-4xl font-bold text-slate-900">{latestReport.overallScore}</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">혈압</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{metricValue(latestReport, '혈압(수축기)')}</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">혈당</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{metricValue(latestReport, '공복 혈당')}</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">콜레스테롤</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{metricValue(latestReport, '총 콜레스테롤')}</p>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
              <TrendChart reports={reports} metricName="공복 혈당" />
              <Card className="space-y-4">
                <h3 className="text-xl font-bold text-slate-900">주요 위험요인 리포트</h3>
                {latestReport.riskFactors.map((risk) => (
                  <div key={risk.title} className="rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">{risk.title}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge[risk.level]}`}>{risk.level}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{risk.reason}</p>
                  </div>
                ))}
              </Card>
            </div>

            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">검진 기록</h3>
                <Button variant="outline" size="sm" onClick={handleClearRecords}>기록 초기화</Button>
              </div>
              <div className="space-y-3">
                {reports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => {
                      setSelectedReportId(report.id);
                      setView('report');
                    }}
                    className="w-full rounded-2xl border border-slate-100 px-4 py-4 text-left hover:border-health-blue transition-colors"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{new Date(report.date).toLocaleDateString('ko-KR')}</p>
                        <p className="text-sm text-slate-500">{report.sourceType === 'upload' ? `업로드 입력 · ${report.fileName || '파일'}` : report.sourceType === 'nhis-consent' ? '동의 기반 가져오기 요청' : '직접 입력'}</p>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-500">
                        <span>점수 {report.overallScore}</span>
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    );
  };

  const renderReport = () => {
    if (!latestReport) {
      return (
        <Card className="py-14 text-center">
          <p className="text-slate-500">표시할 리포트가 없습니다. 먼저 검진 기록을 입력해주세요.</p>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        <Card className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm text-slate-500">{new Date(latestReport.date).toLocaleDateString('ko-KR')} · {latestReport.memberKey}</p>
              <h2 className="text-3xl font-bold text-slate-900 mt-1">AI 건강분석 리포트</h2>
            </div>
            <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white">
              <p className="text-xs uppercase tracking-widest text-slate-300">Health Score</p>
              <p className="text-3xl font-bold">{latestReport.overallScore}</p>
            </div>
          </div>
          <p className="text-slate-600 leading-relaxed">{latestReport.summary}</p>
          <div className="rounded-2xl bg-blue-50 p-4 text-slate-700 leading-relaxed">{latestReport.healthStateDescription}</div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {latestReport.metrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">개선 방향 제안</h3>
            {[
              ['식단', latestReport.actionPlan.diet],
              ['운동', latestReport.actionPlan.exercise],
              ['생활습관', latestReport.actionPlan.lifestyle],
            ].map(([title, items]) => (
              <div key={String(title)}>
                <p className="font-semibold text-slate-800">{title}</p>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  {(items as string[]).map((item) => (
                    <li key={item} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 text-health-blue" /> <span>{item}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-health-blue" />
              <h3 className="text-xl font-bold text-slate-900">AI 건강 챗봇</h3>
            </div>
            <div className="max-h-[360px] space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-4">
              {chatMessages.map((message) => (
                <div key={message.id} className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === 'assistant' ? 'bg-white text-slate-700' : 'bg-slate-900 text-white ml-10'}`}>
                  {message.content}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitChat()}
                placeholder="예: 내 혈당 상태를 어떻게 관리하면 좋을까?"
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3"
              />
              <Button onClick={submitChat}>전송</Button>
            </div>
          </Card>
        </div>

        <Card className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900">지속 관리 피드백</h3>
          {latestReport.monitoring.map((item, idx) => (
            <div key={idx} className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">수용 가능성 체크</p>
                <p className="mt-1 text-sm text-slate-600">{item.adherenceQuestion}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">다음 확인 시점</p>
                <p className="mt-1 text-sm text-slate-600">{item.nextCheck}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">변화 없을 때</p>
                <p className="mt-1 text-sm text-slate-600">{item.escalationSignal}</p>
              </div>
            </div>
          ))}
        </Card>
      </div>
    );
  };

  if (authLoading) {
    return <div className="min-h-screen grid place-items-center text-slate-500">로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 md:px-8">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/50 bg-white/80 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <button onClick={() => setView('home')} className="flex items-center gap-3 text-left">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white"><Activity size={22} /></div>
            <div>
              <p className="text-lg font-bold text-slate-900">CareLink</p>
              <p className="text-sm text-slate-500">스마트 건강검진 결과 해석기</p>
            </div>
          </button>
          <nav className="flex flex-wrap items-center gap-2">
            <NavButton target="home" label="홈" icon={Home} />
            <NavButton target="input" label="데이터 입력" icon={Upload} />
            <NavButton target="mypage" label="마이페이지" icon={LayoutDashboard} />
            <NavButton target="report" label="리포트" icon={FileText} />
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            {user ? (
              <>
                <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">{user.displayName || user.email}</div>
                <Button variant="outline" onClick={logout}><LogOut className="mr-2" size={16} />로그아웃</Button>
              </>
            ) : (
              <Button onClick={signIn}><LogIn className="mr-2" size={16} />로그인</Button>
            )}
          </div>
        </header>

        <main className="flex-1">
          {view === 'home' && renderHome()}
          {view === 'input' && renderInput()}
          {view === 'mypage' && renderMyPage()}
          {view === 'report' && renderReport()}
          {view === 'presentation' && <PresentationView onClose={() => setView('home')} />}
        </main>

        <footer className="mt-12 border-t border-slate-200 pt-6">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-500">
            <button onClick={() => setView('presentation')} className="hover:text-health-blue">발표모드</button>
            <button className="hover:text-health-blue">도움말</button>
            <button className="hover:text-health-blue">의견 보내기</button>
            <button className="hover:text-health-blue">보안 안내</button>
          </div>
        </footer>
      </div>

      {showProfileEditor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/35 px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-2xl font-bold text-slate-900">회원관리</h3>
            <p className="mt-1 text-sm text-slate-500">회원 키 {memberKey} · 이 정보는 내 대시보드 개인화에만 사용됩니다.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
                이름
                <input value={profileDraft.name} onChange={(e) => setProfileDraft({ ...profileDraft, name: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                나이
                <input type="number" value={profileDraft.age} onChange={(e) => setProfileDraft({ ...profileDraft, age: Number(e.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                성별
                <select value={profileDraft.gender} onChange={(e) => setProfileDraft({ ...profileDraft, gender: e.target.value as UserProfile['gender'] })} className="w-full rounded-xl border border-slate-200 px-4 py-3">
                  <option value="male">남성</option>
                  <option value="female">여성</option>
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowProfileEditor(false)}>닫기</Button>
              <Button onClick={saveProfile}>저장</Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
