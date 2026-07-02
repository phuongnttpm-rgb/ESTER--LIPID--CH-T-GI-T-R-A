import React, { useState, useEffect, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Award,
  BookOpen,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Home,
  RefreshCw,
  User,
  Users,
  CheckCircle2,
  XCircle,
  Beaker,
  TrendingUp,
  Volume2
} from "lucide-react";
import { questionBank } from "./questions";
import { PlayQuestion, ShuffledOption, UserInfo, GameMode, GameState } from "./types";

declare global {
  interface Window {
    MathJax?: any;
  }
}

// Helper for Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Clean option prefixes (e.g., "A. \\(RCOOR'\\)" -> "\\(RCOOR'\\)")
const cleanOptionText = (text: string): string => {
  return text.replace(/^[A-D]\.\s*/i, "").trim();
};

// Component to render text containing LaTeX and trigger MathJax typesetting specifically for its element
export function MathText({ text, className = "" }: { text: string; className?: string }) {
  const containerRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = text;
      if (window.MathJax && window.MathJax.typesetPromise) {
        try {
          window.MathJax.typesetClear?.([containerRef.current]);
          window.MathJax.typesetPromise([containerRef.current]).catch((err: any) => {
            console.error("MathJax typesetting local error:", err);
          });
        } catch (e) {
          window.MathJax.typesetPromise([containerRef.current]).catch((err: any) => {
            console.error("MathJax typesetting local fallback error:", err);
          });
        }
      }
    }
  }, [text]);

  return <span ref={containerRef} className={className} />;
}

export default function App() {
  // Game States
  const [gameState, setGameState] = useState<GameState>("welcome");
  const [userInfo, setUserInfo] = useState<UserInfo>({ name: "", className: "" });
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [playQuestions, setPlayQuestions] = useState<PlayQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({}); // maps question index -> selected option original index
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  // Trigger MathJax re-render whenever the question or state changes
  useEffect(() => {
    if (window.MathJax) {
      const timer = setTimeout(() => {
        try {
          window.MathJax.typesetPromise?.();
        } catch (err) {
          console.error("MathJax typesetting error:", err);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [gameState, currentQuestionIndex, playQuestions, userAnswers]);

  // Load Speech Voices once on startup
  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  // Text-To-Speech Feedback
  const speakFeedback = (correct: boolean) => {
    if (!soundEnabled || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const text = correct ? "TUYỆT VỜI" : "SAI RỒI";
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "vi-VN";
      utterance.rate = 1.15; // upbeat pacing
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      // Look for any Vietnamese voice
      const viVoice = voices.find(
        (v) => v.lang.includes("vi-VN") || v.lang.includes("vi")
      );
      if (viVoice) {
        utterance.voice = viVoice;
      }
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("TTS Speech synthesis error:", e);
    }
  };

  // Setup Game Mode & Questions
  const handleStartMode = (mode: GameMode) => {
    setGameMode(mode);
    const rawQuestions = questionBank[mode];
    setShowExplanation(false);
    
    // Prepare each question by clean and shuffle its options
    const prepared = rawQuestions.map((q, qIdx) => {
      const cleanedOptions = q.options.map((opt, oIdx) => ({
        text: cleanOptionText(opt),
        originalIndex: oIdx,
      }));
      const shuffledOpts = shuffleArray(cleanedOptions);
      return {
        id: `q-${mode}-${qIdx}-${Math.random()}`,
        question: q.question,
        shuffledOptions: shuffledOpts,
        correctAnswerOriginalIndex: q.correctAnswer,
        explanation: q.explanation,
      };
    });

    // Shuffle the sequence of the questions list
    const shuffledQuestions = shuffleArray(prepared);
    
    setPlayQuestions(shuffledQuestions);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setGameState("gameplay");
  };

  const handleSelectOption = (optionOriginalIndex: number) => {
    // Only register answer if not already answered
    if (userAnswers[currentQuestionIndex] !== undefined) return;

    const currentQuestion = playQuestions[currentQuestionIndex];
    const isCorrect = optionOriginalIndex === currentQuestion.correctAnswerOriginalIndex;
    
    // Update answer
    setUserAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: optionOriginalIndex,
    }));

    // Trigger audio cue
    speakFeedback(isCorrect);
  };

  // Navigation handlers
  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      setShowExplanation(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < playQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setShowExplanation(false);
    } else {
      setGameState("result");
    }
  };

  const handleBackToHome = () => {
    setGameState("select_mode");
  };

  const handleResetApp = () => {
    setUserInfo({ name: "", className: "" });
    setGameMode(null);
    setPlayQuestions([]);
    setUserAnswers({});
    setGameState("welcome");
  };

  // Stats calculation
  const totalQuestions = playQuestions.length;
  const answeredCount = Object.keys(userAnswers).length;
  const correctCount = playQuestions.reduce((acc, q, idx) => {
    const selected = userAnswers[idx];
    return selected !== undefined && selected === q.correctAnswerOriginalIndex ? acc + 1 : acc;
  }, 0);
  const scoreBase10 = totalQuestions > 0 ? parseFloat(((correctCount / totalQuestions) * 10).toFixed(1)) : 0;

  // Custom feedback text
  const getFeedbackMessage = (score: number) => {
    if (score === 10) return { title: "THẦN ĐỒNG HOÁ HỌC! 🎉", color: "text-emerald-600" };
    if (score >= 8) return { title: "XUẤT SẮC! 🌟", color: "text-indigo-600" };
    if (score >= 5) return { title: "KHÁ TỐT! CỐ GẮNG HƠN NHÉ! 👍", color: "text-blue-600" };
    return { title: "CẦN ÔN TẬP THÊM BÀI HỌC! 💪", color: "text-amber-600" };
  };

  return (
    <div id="app-container" className="min-h-screen w-full flex flex-col justify-between bg-slate-50 text-slate-800 font-sans p-2 md:p-3 select-none relative gap-3 pb-8">
      {/* Background soft chemistry decorative blobs */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-teal-100/40 rounded-full blur-3xl pointer-events-none"></div>

      {/* SOUND CONTROL & CANDIDATE BAR */}
      <header id="app-header" className="w-full flex flex-col md:flex-row items-center justify-between gap-2 border-b border-slate-200/80 bg-white/70 backdrop-blur-md px-3 py-2 md:px-4 md:py-1.5 rounded-xl shadow-sm z-10 relative">
        <div className="flex items-center gap-2">
          <Beaker className="w-5 h-5 md:w-7 md:h-7 text-indigo-600 animate-pulse flex-shrink-0" />
          <h1 className="text-sm sm:text-base md:text-lg lg:text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-700 to-indigo-500 bg-clip-text text-transparent text-center md:text-left">
            ĐẤU TRƯỜNG HOÁ HỌC 12 - XÀ PHÒNG VÀ CHẤT GIẶT RỬA
          </h1>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
          {/* Dynamic header info */}
          {gameState !== "welcome" && (
            <div className="flex items-center gap-2 md:gap-4 bg-indigo-50/80 border border-indigo-100 px-2.5 py-1 rounded-lg text-xs md:text-sm">
              <div className="flex items-center gap-1 text-slate-700">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                <span className="font-bold max-w-[100px] truncate">{userInfo.name}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-700">
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                <span className="font-bold">Lớp: {userInfo.className}</span>
              </div>
              {gameMode && (
                <div className="border-l border-indigo-200 pl-2">
                  <span className="text-[10px] md:text-xs uppercase tracking-wider font-extrabold bg-indigo-600 text-white px-1.5 py-0.5 rounded">
                    {gameMode === "dinhTinh" ? "Định tính" : "Định lượng"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Sound toggle & Info */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 ${
              soundEnabled
                ? "bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100"
                : "bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200"
            }`}
            title={soundEnabled ? "Tắt âm thanh giọng nói" : "Bật âm thanh giọng nói"}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="text-[10px] md:text-xs font-bold">{soundEnabled ? "BẬT" : "TẮT"}</span>
          </button>
        </div>
      </header>

      {/* CORE DISPLAY STAGE */}
      <main id="main-stage" className="flex-grow flex items-center justify-center py-2 px-1 relative z-10">
        <AnimatePresence mode="wait">
          
          {/* SCREEN 1: WELCOME SCREEN */}
          {gameState === "welcome" && (
            <motion.div
              key="welcome-screen"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-xl bg-white border border-slate-200/80 rounded-2xl shadow-xl p-4 md:p-6 flex flex-col items-center text-center gap-4 md:gap-6 mx-2"
            >
              <div>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] md:text-xs font-extrabold tracking-widest uppercase px-3 py-1 rounded-full">
                  ÔN TẬP HOÁ HỌC 12 CHUYÊN SÂU
                </span>
                <p className="text-xs md:text-base font-bold text-indigo-600 mt-2">
                  Sản phẩm thuộc bản quyền của cô Ngọc Phượng
                </p>
                <h3 className="text-lg md:text-2xl font-bold text-indigo-600 tracking-wide mt-1">
                  ESTER - LIPID & CHẤT GIẶT RỬA
                </h3>
                <p className="text-slate-500 text-xs md:text-sm mt-2 max-w-xl mx-auto leading-relaxed">
                  Chào mừng học sinh lớp 12 đến với thử thách kiểm tra kiến thức tương tác cực lớn. Vui lòng nhập thông tin để tham gia thi tài!
                </p>
              </div>

              {/* Form Input Frame */}
              <div className="w-full max-w-md bg-slate-50 border border-indigo-100 rounded-xl p-4 md:p-5 shadow-inner flex flex-col gap-3 md:gap-4">
                <div>
                  <label className="block text-left text-[10px] md:text-xs font-black uppercase text-indigo-700 mb-1">
                    Họ và tên Học sinh
                  </label>
                  <input
                    type="text"
                    required
                    value={userInfo.name}
                    onChange={(e) => setUserInfo({ ...userInfo, name: e.target.value })}
                    placeholder="Nhập họ và tên của bạn..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm md:text-base font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-left text-[10px] md:text-xs font-black uppercase text-indigo-700 mb-1">
                    Lớp học
                  </label>
                  <input
                    type="text"
                    required
                    value={userInfo.className}
                    onChange={(e) => setUserInfo({ ...userInfo, className: e.target.value })}
                    placeholder="Ví dụ: 12A1, 12 Lý..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm md:text-base font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
                  />
                </div>
              </div>

              <button
                disabled={!userInfo.name.trim() || !userInfo.className.trim()}
                onClick={() => setGameState("select_mode")}
                className="w-full sm:w-auto px-6 py-2.5 md:px-10 md:py-3 bg-indigo-600 text-white font-extrabold text-sm md:text-lg rounded-xl shadow-lg transition-all transform hover:scale-102 active:scale-98 disabled:opacity-50 disabled:pointer-events-none hover:bg-indigo-700 cursor-pointer uppercase tracking-wider"
              >
                Bắt đầu thử thách
              </button>
            </motion.div>
          )}

          {/* SCREEN 2: MODE SELECTION */}
          {gameState === "select_mode" && (
            <motion.div
              key="select-mode-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full max-w-4xl flex flex-col gap-4 md:gap-6 items-center px-2"
            >
              <div className="text-center">
                <span className="text-slate-400 font-extrabold text-[10px] md:text-xs tracking-widest uppercase">
                  CHỌN CHẾ ĐỘ THỬ THÁCH CHÍNH
                </span>
                <h2 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight mt-1">
                  XÁC ĐỊNH PHẠM VI CÂU HỎI
                </h2>
              </div>

              {/* Mode cards horizontal spread */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full">
                {/* Mode 1: Qualitative */}
                <button
                  onClick={() => handleStartMode("dinhTinh")}
                  className="group bg-white border-2 border-slate-200/80 hover:border-indigo-500 rounded-2xl p-4 md:p-6 text-center sm:text-left shadow-md hover:shadow-xl transition-all cursor-pointer flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 transform hover:-translate-y-1"
                >
                  <div className="p-3 md:p-4 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-100 transition-colors flex-shrink-0">
                    <BookOpen className="w-8 h-8 md:w-10 md:h-10" />
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-black text-slate-800 group-hover:text-indigo-700 transition-colors">
                      BÀI TẬP ĐỊNH TÍNH
                    </h3>
                    <span className="inline-block mt-1 bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      Ngân hàng 20 câu lí thuyết
                    </span>
                    <p className="text-slate-500 text-xs md:text-sm mt-2 leading-relaxed">
                      Kiểm tra toàn bộ kiến thức về cấu tạo, đồng phân, danh pháp, tính chất vật lí, tính chất hoá học, phản ứng xà phòng hoá, đặc điểm của xà phòng và chất giặt rửa tổng hợp.
                    </p>
                  </div>
                </button>

                {/* Mode 2: Quantitative */}
                <button
                  onClick={() => handleStartMode("dinhLuong")}
                  className="group bg-white border-2 border-slate-200/80 hover:border-indigo-500 rounded-2xl p-4 md:p-6 text-center sm:text-left shadow-md hover:shadow-xl transition-all cursor-pointer flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 transform hover:-translate-y-1"
                >
                  <div className="p-3 md:p-4 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100 transition-colors flex-shrink-0">
                    <Calculator className="w-8 h-8 md:w-10 md:h-10" />
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-black text-slate-800 group-hover:text-emerald-700 transition-colors">
                      BÀI TẬP ĐỊNH LƯỢNG
                    </h3>
                    <span className="inline-block mt-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      Ngân hàng 10 câu tính toán
                    </span>
                    <p className="text-slate-500 text-xs md:text-sm mt-2 leading-relaxed">
                      Thử thách khả năng giải bài tập tính toán khối lượng muối, xác định công thức cấu tạo ester, hiệu suất phản ứng ester hóa, chỉ số xà phòng hóa, tính toán sản xuất công nghiệp.
                    </p>
                  </div>
                </button>
              </div>

              <div className="mt-2">
                <button
                  onClick={handleResetApp}
                  className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold transition-colors cursor-pointer text-xs uppercase tracking-wider"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Thay đổi thông tin cá nhân
                </button>
              </div>
            </motion.div>
          )}

          {/* SCREEN 3: GAMEPLAY ARENA */}
          {gameState === "gameplay" && playQuestions.length > 0 && (
            <motion.div
              key="gameplay-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-4xl flex flex-col gap-3 md:gap-4 px-2"
            >
              {/* Progress bar inside question view to minimize space */}
              <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 bg-white/80 border border-slate-200 px-3 py-2 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">Tiến trình:</span>
                  <span className="text-base font-black text-indigo-700">
                    Câu {currentQuestionIndex + 1} / {totalQuestions}
                  </span>
                </div>

                {/* Grid indicator dots for questions */}
                <div className="flex-grow max-w-[65%] hidden md:flex items-center gap-1 overflow-x-auto px-2">
                  {playQuestions.map((_, idx) => {
                    const isCurrent = idx === currentQuestionIndex;
                    const isAnswered = userAnswers[idx] !== undefined;
                    const isCorrect = isAnswered && userAnswers[idx] === playQuestions[idx].correctAnswerOriginalIndex;
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => setCurrentQuestionIndex(idx)}
                        className={`h-3 rounded-full transition-all flex-grow min-w-[12px] max-w-[32px] cursor-pointer ${
                          isCurrent
                            ? "bg-indigo-600 ring-2 ring-indigo-300 ring-offset-1"
                            : isAnswered
                            ? isCorrect
                              ? "bg-emerald-500"
                              : "bg-rose-500"
                            : "bg-slate-200 hover:bg-slate-300"
                        }`}
                        title={`Câu ${idx + 1}`}
                      />
                    );
                  })}
                </div>

                <div className="flex items-center gap-4 text-xs md:text-sm font-black border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-4 w-full sm:w-auto justify-around sm:justify-start">
                  <div className="text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ĐÚNG: {correctCount}</span>
                  </div>
                  <div className="text-rose-500 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" />
                    <span>SAI: {answeredCount - correctCount}</span>
                  </div>
                </div>
              </div>

              {/* Central Question Display Panel */}
              <div className="flex-shrink-0 flex flex-col justify-center bg-slate-900 border border-slate-800 text-white px-4 py-4 md:px-8 md:py-6 rounded-2xl shadow-xl relative overflow-hidden min-h-[100px] sm:min-h-[140px]">
                {/* Decorative overlay */}
                <div className="absolute right-4 bottom-2 opacity-5 pointer-events-none">
                  <Beaker className="w-24 h-24 md:w-32 md:h-32" />
                </div>
                
                <span className="absolute top-2 left-4 text-[9px] md:text-xs font-black uppercase text-indigo-400 tracking-widest">
                  {gameMode === "dinhTinh" ? "Câu Hỏi Định Tính (Lí Thuyết)" : "Câu Hỏi Định Lượng (Tính Toán)"}
                </span>

                <div className="text-center mt-2">
                  <p id="mathjax-question-container" className="text-sm sm:text-base md:text-xl font-bold tracking-tight text-slate-100 leading-relaxed max-w-5xl mx-auto">
                    <MathText text={playQuestions[currentQuestionIndex].question} />
                  </p>
                </div>
              </div>

              {/* Answer options container - responsive 1-col on mobile, 2-col on desktop, scrollable for small screens */}
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 w-full overflow-y-auto pr-1.5 py-1 border border-transparent hover:border-slate-100 rounded-xl transition-all custom-scrollbar ${
                  (playQuestions[currentQuestionIndex]?.question || "").length > 100
                    ? "max-h-[160px] sm:max-h-[260px] md:max-h-none"
                    : "max-h-[220px] sm:max-h-[320px] md:max-h-none"
                }`}
              >
                {playQuestions[currentQuestionIndex].shuffledOptions.map((option, sIdx) => {
                  const letterPrefix = ["A", "B", "C", "D"][sIdx];
                  const isSelected = userAnswers[currentQuestionIndex] === option.originalIndex;
                  const isAnswered = userAnswers[currentQuestionIndex] !== undefined;
                  const isCorrect = option.originalIndex === playQuestions[currentQuestionIndex].correctAnswerOriginalIndex;
                  
                  let btnStyle = "bg-white border-slate-300 hover:bg-slate-50 hover:border-indigo-400 text-slate-800";
                  
                  if (isAnswered) {
                    if (isCorrect) {
                      // Correct option always shown as green after answering
                      btnStyle = "bg-emerald-600 border-emerald-500 text-white shadow-emerald-200/50";
                    } else if (isSelected) {
                      // Selected incorrect option shown as red
                      btnStyle = "bg-rose-600 border-rose-500 text-white shadow-rose-200/50";
                    } else {
                      // Unselected non-correct options are dimmed
                      btnStyle = "bg-white/50 border-slate-200 text-slate-400 opacity-50 cursor-not-allowed";
                    }
                  }

                  return (
                    <button
                      key={sIdx}
                      disabled={isAnswered}
                      onClick={() => handleSelectOption(option.originalIndex)}
                      className={`relative flex items-center justify-start text-left px-3 py-2.5 sm:px-5 sm:py-3.5 border-2 rounded-xl text-sm sm:text-base md:text-lg font-bold transition-all transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-sm ${btnStyle}`}
                    >
                      <span className={`inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg mr-2 sm:mr-3 text-xs sm:text-base font-extrabold flex-shrink-0 ${
                        isAnswered
                          ? isCorrect || isSelected
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-400"
                          : "bg-indigo-50 text-indigo-600"
                      }`}>
                        {letterPrefix}
                      </span>
                      
                      <span className="flex-grow tracking-wide leading-snug pr-8">
                        <MathText text={option.text} />
                      </span>

                      {isAnswered && isCorrect && (
                        <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-white absolute right-3 top-1/2 -translate-y-1/2 flex-shrink-0" />
                      )}
                      {isAnswered && isSelected && !isCorrect && (
                        <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white absolute right-3 top-1/2 -translate-y-1/2 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* FOOTER ACTIONS BAR */}
              <div className="w-full flex flex-wrap items-center justify-between px-2 py-2 bg-white/70 backdrop-blur-md border border-slate-200 rounded-xl shadow-sm gap-2">
                <button
                  disabled={currentQuestionIndex === 0}
                  onClick={handlePrevQuestion}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-extrabold rounded-lg transition-all text-xs uppercase cursor-pointer whitespace-nowrap"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Quay lại
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleBackToHome}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-extrabold rounded-lg transition-all text-xs uppercase cursor-pointer whitespace-nowrap"
                  >
                    <Home className="w-4 h-4" />
                    Trang chủ
                  </button>

                  {userAnswers[currentQuestionIndex] !== undefined && playQuestions[currentQuestionIndex].explanation && (
                    <button
                      onClick={() => setShowExplanation(true)}
                      className="flex items-center gap-1 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-extrabold rounded-lg transition-all text-xs uppercase cursor-pointer animate-pulse whitespace-nowrap"
                    >
                      <span>💡 Lời giải</span>
                    </button>
                  )}
                </div>

                {userAnswers[currentQuestionIndex] !== undefined ? (
                  <button
                    onClick={handleNextQuestion}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white font-extrabold rounded-lg hover:bg-indigo-700 transition-all text-xs uppercase cursor-pointer animate-bounce shadow-md whitespace-nowrap"
                  >
                    <span>
                      {currentQuestionIndex === totalQuestions - 1 ? "Kết quả" : "Tiếp theo"}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="text-[10px] md:text-xs font-black uppercase text-indigo-600 px-3 py-2 bg-indigo-50 rounded-lg animate-pulse border border-indigo-100 whitespace-nowrap">
                    Chọn một đáp án
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* SCREEN 4: DETAILED RESULTS REVIEW */}
          {gameState === "result" && (
            <motion.div
              key="result-screen"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-4xl flex flex-col gap-3 px-2"
            >
              {/* Header result row */}
              <div className="bg-white border border-slate-200 px-4 py-3 rounded-xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="text-center md:text-left">
                  <h2 className="text-lg md:text-2xl font-black text-slate-800 leading-tight">KẾT QUẢ ĐẤU TRƯỜNG</h2>
                  <p className="text-slate-500 text-[10px] md:text-xs uppercase tracking-wider font-extrabold mt-1">
                    Thí sinh: {userInfo.name} | Lớp: {userInfo.className} | Chế độ: {gameMode === "dinhTinh" ? "Định tính" : "Định lượng"}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                  {/* Digital Score circle badge */}
                  <div className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg text-center flex items-center justify-around gap-2.5 w-full sm:w-auto">
                    <div>
                      <span className="block text-[9px] font-black text-indigo-500 uppercase leading-none mb-0.5">Điểm số</span>
                      <span className="text-xl md:text-2xl font-black text-indigo-700 leading-none">{scoreBase10}</span>
                      <span className="text-xs font-bold text-indigo-500"> /10</span>
                    </div>
                    <div className="border-l border-indigo-200 pl-2.5">
                      <span className="block text-[9px] font-black text-slate-400 uppercase leading-none mb-0.5">Số câu đúng</span>
                      <span className="text-lg md:text-xl font-extrabold text-slate-700 leading-none">{correctCount}</span>
                      <span className="text-xs font-bold text-slate-400"> / {totalQuestions}</span>
                    </div>
                  </div>

                  {/* Feedback text */}
                  <div className="text-center sm:text-right">
                    <span className="block text-[9px] font-black text-slate-400 uppercase leading-none mb-0.5">Đánh giá</span>
                    <span className={`text-sm md:text-base font-black leading-tight block ${getFeedbackMessage(scoreBase10).color}`}>
                      {getFeedbackMessage(scoreBase10).title}
                    </span>
                  </div>
                </div>
              </div>

              {/* Interactive question detailed logs list inside bounded panel */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-inner max-h-[380px] space-y-3 overflow-y-auto custom-scrollbar">
                <h3 className="text-xs md:text-sm font-extrabold text-indigo-800 uppercase tracking-wider mb-2 sticky top-0 bg-white pb-1.5 border-b border-slate-100 z-10 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" /> Báo cáo chi tiết & Giải đáp câu hỏi
                </h3>

                {playQuestions.map((q, idx) => {
                  const selectedIdx = userAnswers[idx];
                  const isCorrect = selectedIdx === q.correctAnswerOriginalIndex;
                  const correctOptionText = q.shuffledOptions.find(opt => opt.originalIndex === q.correctAnswerOriginalIndex)?.text || "";
                  const selectedOptionText = q.shuffledOptions.find(opt => opt.originalIndex === selectedIdx)?.text || "Chưa trả lời";

                  return (
                    <div
                      key={idx}
                      className={`p-3 border rounded-xl transition-all ${
                        isCorrect
                          ? "bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50"
                          : "bg-rose-50/50 border-rose-200 hover:bg-rose-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-grow">
                          <span className="inline-block text-[9px] font-black uppercase text-slate-500 mb-0.5">
                            Câu hỏi {idx + 1}:
                          </span>
                          <div className="font-bold text-slate-800 text-xs sm:text-sm leading-relaxed">
                            <MathText text={q.question} />
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {isCorrect ? (
                            <span className="flex items-center gap-1 text-emerald-600 font-extrabold text-[10px] bg-emerald-100 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Đúng
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-rose-600 font-extrabold text-[10px] bg-rose-100 px-2 py-0.5 rounded-full">
                              <XCircle className="w-3.5 h-3.5" /> Sai
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Answer details row */}
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] sm:text-xs border-t border-slate-100 pt-2">
                        <div>
                          <span className="text-slate-400 font-bold">Lựa chọn của bạn: </span>
                          <span className={`font-black ${isCorrect ? "text-emerald-700" : "text-rose-700"}`}>
                            <MathText text={selectedOptionText} />
                          </span>
                        </div>
                        {!isCorrect && (
                          <div>
                            <span className="text-slate-400 font-bold">Đáp án đúng: </span>
                            <span className="text-emerald-700 font-black">
                              <MathText text={correctOptionText} />
                            </span>
                          </div>
                        )}
                      </div>

                      {q.explanation && (
                        <div className="mt-2.5 p-2.5 bg-indigo-50/60 border border-indigo-100 rounded-lg text-[11px] sm:text-xs text-indigo-900 shadow-sm">
                          <span className="font-extrabold text-indigo-700 block mb-0.5 flex items-center gap-1">
                            💡 Lời giải chi tiết:
                          </span>
                          <div className="leading-relaxed font-medium">
                            <MathText text={q.explanation} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Play again or change mode footer controls */}
              <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 bg-white/70 border border-slate-200 px-3 py-3 rounded-xl shadow-sm">
                <button
                  onClick={() => gameMode && handleStartMode(gameMode)}
                  className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-6 py-2.5 bg-indigo-600 text-white font-extrabold rounded-xl hover:bg-indigo-700 shadow-md transition-all text-sm cursor-pointer uppercase tracking-wider"
                >
                  <RefreshCw className="w-4 h-4" />
                  Thử lại chế độ này
                </button>

                <button
                  onClick={handleBackToHome}
                  className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-6 py-2.5 bg-slate-200 text-slate-700 font-extrabold border border-slate-300 rounded-xl hover:bg-slate-300 transition-all text-sm cursor-pointer uppercase tracking-wider"
                >
                  <Home className="w-4 h-4" />
                  Chọn chế độ khác
                </button>
              </div>
            </motion.div>
          )}

          {/* EXPLANATION MODAL (REAL-TIME GAMEPLAY) */}
          {showExplanation && playQuestions[currentQuestionIndex] && (
            <motion.div
              key="explanation-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-white rounded-2xl border border-indigo-100 p-4 sm:p-6 shadow-2xl max-w-xl w-full relative max-h-[90vh] flex flex-col"
              >
                <button
                  onClick={() => setShowExplanation(false)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 transition-colors text-xl font-bold cursor-pointer"
                  title="Đóng"
                >
                  &times;
                </button>

                <div className="flex items-center gap-1.5 text-indigo-700 font-black uppercase text-sm sm:text-base tracking-wider mb-2 flex-shrink-0">
                  <span className="text-lg">💡</span> HƯỚNG DẪN GIẢI CHI TIẾT
                </div>

                <div className="border-t border-slate-100 pt-3 flex-grow overflow-y-auto pr-1 custom-scrollbar">
                  <p className="text-[10px] uppercase font-extrabold text-slate-400 mb-0.5">Câu hỏi:</p>
                  <div className="text-slate-800 font-bold mb-3 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs sm:text-sm">
                    <MathText text={playQuestions[currentQuestionIndex].question} />
                  </div>

                  <p className="text-[10px] uppercase font-extrabold text-slate-400 mb-0.5">Phương pháp & các bước giải:</p>
                  <div className="text-slate-700 font-semibold leading-relaxed bg-indigo-50/50 p-3 sm:p-4 rounded-xl border border-indigo-100/80 max-h-[180px] sm:max-h-[240px] overflow-y-auto text-xs sm:text-sm custom-scrollbar">
                    <MathText text={playQuestions[currentQuestionIndex].explanation || ""} />
                  </div>
                </div>

                <div className="mt-4 flex justify-end flex-shrink-0">
                  <button
                    onClick={() => setShowExplanation(false)}
                    className="px-5 py-2 bg-indigo-600 text-white font-extrabold rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all cursor-pointer text-xs uppercase"
                  >
                    Đã hiểu, tiếp tục
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* FOOTER FOOTNOTE */}
      <footer id="app-footer" className="w-full text-center py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-200 bg-white/40 z-10">
        ĐẤU TRƯỜNG HÓA HỌC 12
      </footer>
    </div>
  );
}
