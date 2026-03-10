import React, { useRef, useState, useEffect } from 'react';
import { Card, Button } from './UI';
import { 
  Activity, 
  Target, 
  Users, 
  Zap, 
  Shield, 
  BarChart3, 
  ArrowRight, 
  CheckCircle2,
  FileText,
  LayoutDashboard,
  Download,
  Loader2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Printer
} from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';

export function PresentationView({ onClose }: { onClose: () => void }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const totalSlides = 6;

  const nextSlide = () => setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1));
  const prevSlide = () => setCurrentSlide((prev) => Math.max(prev - 1, 0));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showAll) return;
      if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAll]);

  const handleDownloadPDF = async () => {
    if (!contentRef.current) return;
    
    setIsDownloading(true);
    // Temporarily show all slides for capture if needed, 
    // but here we'll just capture the current view or the whole scrollable if showAll is true
    const wasShowAll = showAll;
    setShowAll(true);
    
    // Wait for state update and render
    setTimeout(async () => {
      try {
        const element = contentRef.current!;
        const dataUrl = await htmlToImage.toPng(element, {
          quality: 1.0,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          filter: (node) => {
            if (node instanceof HTMLElement && (node.classList.contains('print:hidden') || node.id === 'slide-nav')) {
              return false;
            }
            return true;
          }
        });
        
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: [element.offsetWidth * 2, element.offsetHeight * 2]
        });
        
        pdf.addImage(dataUrl, 'PNG', 0, 0, element.offsetWidth * 2, element.offsetHeight * 2);
        pdf.save('CareLink_Presentation.pdf');
      } catch (error) {
        console.error('PDF generation failed:', error);
        alert('PDF 생성 중 오류가 발생했습니다.');
      } finally {
        setIsDownloading(false);
        setShowAll(wasShowAll);
      }
    }, 500);
  };

  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const renderSlide = (index: number) => {
    switch (index) {
      case 0:
        return (
          <section className="h-full flex flex-col justify-center items-center text-center space-y-6">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-24 h-24 bg-health-blue rounded-3xl flex items-center justify-center shadow-xl shadow-blue-200 mb-4"
            >
              <Activity className="text-white" size={56} />
            </motion.div>
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-7xl font-bold tracking-tighter text-slate-900"
            >
              CareLink
            </motion.h1>
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-2xl text-slate-500 font-medium"
            >
              스마트 건강검진 결과 해석 서비스
            </motion.p>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="pt-10 flex gap-4 text-sm font-bold text-slate-400 uppercase tracking-widest"
            >
              <span>Product Design</span>
              <span>•</span>
              <span>AI Integration</span>
              <span>•</span>
              <span>Health Tech</span>
            </motion.div>
          </section>
        );
      case 1:
        return (
          <section className="h-full flex flex-col justify-center space-y-12">
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-health-blue uppercase tracking-widest">Problem & Solution</h2>
              <h3 className="text-5xl font-bold text-slate-900">왜 케어링크인가?</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="bg-slate-50 border-none p-10 space-y-6">
                <h4 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <span className="text-health-red">●</span> 기존의 문제점
                </h4>
                <ul className="space-y-4 text-lg text-slate-600">
                  <li className="flex gap-3"><span>•</span> 어려운 의학 용어로 인한 해석의 한계</li>
                  <li className="flex gap-3"><span>•</span> 단편적인 수치 제공 (과거 데이터와 단절)</li>
                  <li className="flex gap-3"><span>•</span> 결과 확인 후 구체적인 행동 지침 부재</li>
                </ul>
              </Card>
              
              <Card className="bg-blue-50 border-none p-10 space-y-6">
                <h4 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <span className="text-health-blue">●</span> 케어링크의 솔루션
                </h4>
                <ul className="space-y-4 text-lg text-slate-700">
                  <li className="flex gap-3"><span>•</span> Gemini AI 기반의 쉬운 일상어 요약</li>
                  <li className="flex gap-3"><span>•</span> 시계열 그래프를 통한 건강 추이 분석</li>
                  <li className="flex gap-3"><span>•</span> 개인별 맞춤형 식단 및 운동 플랜 제시</li>
                </ul>
              </Card>
            </div>
          </section>
        );
      case 2:
        return (
          <section className="h-full flex flex-col justify-center space-y-12">
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-health-blue uppercase tracking-widest">Key Features</h2>
              <h3 className="text-5xl font-bold text-slate-900">주요 기능 정의 (PRD)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                { icon: Zap, title: "스마트 OCR & 분석", desc: "이미지/PDF에서 수치를 자동 추출하고 AI가 즉시 분석합니다." },
                { icon: BarChart3, title: "건강 시계열 분석", desc: "과거 검진 데이터를 누적하여 건강 변화를 시각화합니다." },
                { icon: Target, title: "맞춤형 액션 플랜", desc: "이상 수치에 따른 식단, 운동, 의료 권고를 생성합니다." },
                { icon: Shield, title: "데이터 보안", desc: "민감한 의료 데이터를 암호화하여 안전하게 관리합니다." }
              ].map((item, i) => (
                <div key={i} className="flex gap-6 p-8 border border-slate-100 rounded-3xl bg-white shadow-sm">
                  <div className="bg-slate-50 p-4 rounded-2xl h-fit text-health-blue">
                    <item.icon size={32} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-800">{item.title}</h4>
                    <p className="text-slate-500 mt-2 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      case 3:
        return (
          <section className="h-full flex flex-col justify-center space-y-12">
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-health-blue uppercase tracking-widest">Technical Stack</h2>
              <h3 className="text-5xl font-bold text-slate-900">기술 아키텍처</h3>
            </div>

            <div className="flex flex-wrap gap-4">
              {['React 19', 'TypeScript', 'Tailwind CSS', 'Gemini 3.1 Pro', 'Recharts', 'Lucide Icons', 'Motion'].map(tech => (
                <span key={tech} className="px-8 py-4 bg-slate-900 text-white rounded-full font-bold text-base">
                  {tech}
                </span>
              ))}
            </div>

            <Card className="bg-slate-50 border-none p-12">
              <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                <div className="text-center space-y-3">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <FileText className="text-slate-400" size={32} />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Input</span>
                  <p className="font-bold text-lg">검진표 업로드</p>
                </div>
                <ArrowRight className="text-slate-300 hidden md:block" size={32} />
                <div className="text-center space-y-3">
                  <div className="w-20 h-20 bg-health-blue rounded-full flex items-center justify-center mx-auto shadow-lg shadow-blue-100">
                    <Zap className="text-white" size={32} />
                  </div>
                  <span className="text-xs font-bold text-health-blue uppercase tracking-widest">AI Engine</span>
                  <p className="font-bold text-lg text-health-blue">Gemini 분석</p>
                </div>
                <ArrowRight className="text-slate-300 hidden md:block" size={32} />
                <div className="text-center space-y-3">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <LayoutDashboard className="text-slate-400" size={32} />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Output</span>
                  <p className="font-bold text-lg">스마트 리포트</p>
                </div>
              </div>
            </Card>
          </section>
        );
      case 4:
        return (
          <section className="h-full flex flex-col justify-center space-y-12">
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-health-blue uppercase tracking-widest">Success Metrics</h2>
              <h3 className="text-5xl font-bold text-slate-900">기대 효과 및 지표</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-10 space-y-4 bg-slate-50 rounded-3xl">
                <div className="text-6xl font-bold text-health-blue">95%</div>
                <p className="text-xl font-bold text-slate-800">사용자 이해도 향상</p>
                <p className="text-slate-500">복잡한 수치의 직관적 해석</p>
              </div>
              <div className="text-center p-10 space-y-4 bg-slate-50 rounded-3xl">
                <div className="text-6xl font-bold text-health-blue">4.8/5.0</div>
                <p className="text-xl font-bold text-slate-800">서비스 만족도</p>
                <p className="text-slate-500">개인화된 건강 관리 경험</p>
              </div>
              <div className="text-center p-10 space-y-4 bg-slate-50 rounded-3xl">
                <div className="text-6xl font-bold text-health-blue">20%</div>
                <p className="text-xl font-bold text-slate-800">재검진 전환율</p>
                <p className="text-slate-500">위험군 조기 발견 및 조치</p>
              </div>
            </div>
          </section>
        );
      case 5:
        return (
          <section className="h-full flex flex-col justify-center items-center text-center space-y-10">
            <motion.h3 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-6xl font-bold text-slate-900 leading-tight"
            >
              건강 관리의 새로운 기준,<br />
              <span className="text-health-blue">CareLink</span>
            </motion.h3>
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl text-slate-500 max-w-2xl leading-relaxed"
            >
              우리는 데이터 그 이상의 가치를 전달하여<br />
              모두가 자신의 건강을 스스로 관리할 수 있는 세상을 만듭니다.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-3 text-health-blue font-bold text-xl"
            >
              <CheckCircle2 size={32} /> 2026 CareLink Project Presentation
            </motion.div>
          </section>
        );
      default:
        return null;
    }
  };

  if (showAll) {
    return (
      <div ref={contentRef} className="bg-white p-16 space-y-32 max-w-5xl mx-auto">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="min-h-screen border-b border-slate-100 last:border-none pb-20">
            {renderSlide(i)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-[60] flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="h-16 px-8 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-health-blue rounded-lg flex items-center justify-center">
            <Activity className="text-white" size={20} />
          </div>
          <span className="font-bold text-slate-900">CareLink Presentation</span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-500">
            나가기
          </Button>
          <div className="h-4 w-px bg-slate-200" />
          <div className="text-sm font-bold text-slate-400">
            Slide {currentSlide + 1} / {totalSlides}
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <Button variant="ghost" size="sm" onClick={openInNewTab}>
            <ExternalLink size={18} className="mr-2" /> 새 창
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
            <Printer size={18} className="mr-2" /> 전체 보기
          </Button>
          <Button 
            size="sm" 
            className="bg-health-blue text-white" 
            onClick={handleDownloadPDF}
            disabled={isDownloading}
          >
            {isDownloading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
          </Button>
        </div>
      </div>

      {/* Slide Content */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-8 md:p-20">
        <div ref={contentRef} className="w-full max-w-6xl h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="h-full"
            >
              {renderSlide(currentSlide)}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation Controls */}
      <div id="slide-nav" className="h-20 px-8 border-t border-slate-100 flex items-center justify-between bg-white">
        <Button 
          variant="ghost" 
          onClick={prevSlide} 
          disabled={currentSlide === 0}
          className="rounded-full w-12 h-12 p-0"
        >
          <ChevronLeft size={32} />
        </Button>
        
        <div className="flex gap-2">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentSlide === i ? 'w-8 bg-health-blue' : 'w-2 bg-slate-200 hover:bg-slate-300'
              }`}
            />
          ))}
        </div>

        <Button 
          variant="ghost" 
          onClick={nextSlide} 
          disabled={currentSlide === totalSlides - 1}
          className="rounded-full w-12 h-12 p-0"
        >
          <ChevronRight size={32} />
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 h-1 bg-health-blue transition-all duration-500" style={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }} />
    </div>
  );
}
