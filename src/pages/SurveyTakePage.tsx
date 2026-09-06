import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  FileUp,
  Globe,
  Loader2,
  RefreshCw,
  Star,
  Trash2,
  X,
  XCircle,
  Smile,
  Heart,
  Image as ImageIcon,
  PenTool,
  MapPin,
} from 'lucide-react';
import { api } from '@/services/api';
import { evaluateSkipRules, shouldDisplayQuestion } from '@/utils/logic';
import type { Question, Survey } from '@/types';

interface SurveyInstanceRow {
  id: string;
  survey_id: string;
  short_code: string;
  payload: Record<string, any> | null;
  language: string | null;
  status: string;
  responded_at: string | null;
}

/* ---------- Language helpers ---------- */

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  zh: '中文',
  pt: 'Português',
  it: 'Italiano',
  nl: 'Nederlands',
  ko: '한국어',
  ar: 'العربية',
  hi: 'हिन्दी',
  ru: 'Русский',
};

const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

function languageLabel(code: string): string {
  return LANGUAGE_LABELS[code] || code.toUpperCase();
}

/* ---------- Question piping ---------- */

function applyPiping(
  text: string,
  question: Question,
  answers: Record<string, any>,
  allQuestions: Question[],
): string {
  if (!question.pipeFrom) return text;
  const sourceAnswer = answers[question.pipeFrom];
  if (sourceAnswer === undefined || sourceAnswer === null || sourceAnswer === '') return text;

  let displayValue = '';
  const sourceQuestion = allQuestions.find((q) => q.id === question.pipeFrom);
  if (Array.isArray(sourceAnswer)) {
    if (sourceQuestion?.options) {
      displayValue = sourceAnswer
        .map((v) => sourceQuestion.options?.find((o) => o.id === v)?.label || v)
        .join(', ');
    } else {
      displayValue = sourceAnswer.join(', ');
    }
  } else if (sourceQuestion?.options) {
    displayValue = sourceQuestion.options.find((o) => o.id === sourceAnswer)?.label || String(sourceAnswer);
  } else {
    displayValue = String(sourceAnswer);
  }

  return text.replace(/\{piped\}/g, displayValue).replace(/\$\{answer\}/g, displayValue);
}

/* ---------- Validation ---------- */

function validateField(question: Question, value: any): string | null {
  if (question.required) {
    const isEmpty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
    if (isEmpty) return 'This question is required.';
  }
  if (question.validation && typeof value === 'string' && value.trim() !== '') {
    const v = value.trim();
    if (question.validation === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Please enter a valid email address.';
    } else if (question.validation === 'phone') {
      if (!/^[+]?[\d\s\-()]{7,}$/.test(v)) return 'Please enter a valid phone number.';
    } else if (question.validation === 'url') {
      try {
        new URL(v);
      } catch {
        return 'Please enter a valid URL.';
      }
    } else if (question.validation === 'number') {
      if (isNaN(Number(v))) return 'Please enter a valid number.';
    } else if (question.validation === 'decimal') {
      if (isNaN(Number(v))) return 'Please enter a valid decimal number.';
    }
  }
  return null;
}

/* ---------- Font helpers ---------- */

function resolveFontFamily(font: string): string {
  const map: Record<string, string> = {
    Inter: "'Inter', system-ui, sans-serif",
    'Plus Jakarta Sans': "'Plus Jakarta Sans', 'Inter', sans-serif",
    'system-ui': 'system-ui, sans-serif',
    Georgia: 'Georgia, serif',
    'Times New Roman': "'Times New Roman', serif",
    Arial: 'Arial, sans-serif',
    Helvetica: 'Helvetica, sans-serif',
    Courier: "'Courier New', monospace",
    Verdana: 'Verdana, sans-serif',
  };
  return map[font] || `'${font}', system-ui, sans-serif`;
}

/* ---------- Main component ---------- */

type Phase = 'loading' | 'not-found' | 'already-completed' | 'survey' | 'captcha' | 'submitting' | 'completed';

export function SurveyTakePage({ shortCode }: { shortCode: string }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [instance, setInstance] = useState<SurveyInstanceRow | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [language, setLanguage] = useState<string>('en');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [captchaId, setCaptchaId] = useState<string | null>(null);
  const [captchaImage, setCaptchaImage] = useState<string | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, Record<string, any>>>({});
  const topRef = useRef<HTMLDivElement>(null);

  /* Load survey instance */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await api.getSurveyInstance(shortCode);
      if (cancelled) return;
      if (!result || !result.survey) {
        setPhase('not-found');
        return;
      }
      const srv = result.survey as Survey;
      const inst = result.instance as SurveyInstanceRow | null;
      if (inst && inst.status === 'responded') {
        setInstance(inst);
        setSurvey(srv);
        setPhase('already-completed');
        return;
      }
      const startLang = (inst?.language) || srv.defaultLanguage || 'en';
      setInstance(inst);
      setSurvey(srv);
      setLanguage(startLang);
      setPhase('survey');

      // Load translations for this survey
      if (srv.id) {
        api.getTranslations(srv.id).then((trs) => {
          if (cancelled) return;
          const map: Record<string, Record<string, any>> = {};
          for (const t of trs) map[t.languageCode] = t.translations;
          setTranslations(map);
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shortCode]);

  /* Apply branding via CSS variables + custom CSS */
  useEffect(() => {
    if (!survey) return;
    const branding = survey.branding;
    const root = document.documentElement;
    root.style.setProperty('--survey-primary', branding.primaryColor);
    root.style.setProperty('--survey-accent', branding.accentColor);
    root.style.setProperty('--survey-font', resolveFontFamily(branding.fontFamily));

    let styleEl: HTMLStyleElement | null = null;
    if (branding.customCss) {
      styleEl = document.createElement('style');
      styleEl.setAttribute('data-survey-custom', 'true');
      styleEl.textContent = branding.customCss;
      document.head.appendChild(styleEl);
    }
    return () => {
      if (styleEl) document.head.removeChild(styleEl);
    };
  }, [survey]);

  /* Load CAPTCHA when entering captcha phase */
  useEffect(() => {
    if (phase === 'captcha') {
      loadCaptcha();
    }
  }, [phase]);

  async function loadCaptcha() {
    setCaptchaLoading(true);
    setCaptchaError(null);
    const captcha = await api.getCaptcha();
    setCaptchaLoading(false);
    if (!captcha) {
      setCaptchaError('Could not load CAPTCHA. Please try again.');
      return;
    }
    setCaptchaId(captcha.captchaId);
    setCaptchaImage(captcha.image);
    setCaptchaAnswer('');
  }

  const allQuestions = useMemo(() => {
    if (!survey) return [];
    return survey.pages.flatMap((p) => p.questions);
  }, [survey]);

  const isRTL = RTL_LANGUAGES.includes(language);
  const dir = isRTL ? 'rtl' : 'ltr';

  const activeTranslation = translations[language] || {};

  function tr(key: string, fallback: string): string {
    return activeTranslation[key] || fallback;
  }

  function trOption(question: Question, option: { id: string; label: string }): string {
    return activeTranslation[`opt_${option.id}`] || option.label;
  }

  function trRow(question: Question, row: string, idx: number): string {
    return activeTranslation[`row_${question.id}_${idx}`] || row;
  }

  function trColumn(question: Question, col: string, idx: number): string {
    return activeTranslation[`col_${question.id}_${idx}`] || col;
  }

  const pages = survey?.pages || [];
  const currentPage = pages[currentPageIndex];
  const isLastPage = currentPageIndex === pages.length - 1;

  function setAnswer(questionId: string, value: any) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setErrors((prev) => {
      if (!prev[questionId]) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }

  function validateCurrentPage(): boolean {
    if (!currentPage) return true;
    const newErrors: Record<string, string> = {};
    for (const q of currentPage.questions) {
      if (!shouldDisplayQuestion(q, answers)) continue;
      const err = validateField(q, answers[q.id]);
      if (err) newErrors[q.id] = err;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function scrollToTop() {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleNext() {
    if (!validateCurrentPage()) {
      scrollToTop();
      return;
    }
    if (!currentPage) return;

    const skipTarget = evaluateSkipRules(currentPage, answers);
    if (skipTarget) {
      const targetIndex = pages.findIndex((p) => p.id === skipTarget);
      if (targetIndex >= 0) {
        setDirection('forward');
        setCurrentPageIndex(targetIndex);
        scrollToTop();
        return;
      }
    }

    if (isLastPage) {
      setPhase('captcha');
      scrollToTop();
      return;
    }

    setDirection('forward');
    setCurrentPageIndex((i) => i + 1);
    scrollToTop();
  }

  function handleBack() {
    if (phase === 'captcha') {
      setPhase('survey');
      setCaptchaAnswer('');
      setCaptchaError(null);
      scrollToTop();
      return;
    }
    if (currentPageIndex === 0) return;
    setDirection('back');
    setCurrentPageIndex((i) => i - 1);
    scrollToTop();
  }

  async function handleCaptchaSubmit() {
    if (!captchaId || !captchaAnswer.trim()) {
      setCaptchaError('Please enter the code shown in the image.');
      return;
    }
    setCaptchaLoading(true);
    setCaptchaError(null);
    const valid = await api.verifyCaptcha(captchaId, captchaAnswer.trim());
    setCaptchaLoading(false);

    if (!valid) {
      setCaptchaError('Incorrect code. A new CAPTCHA has been loaded — please try again.');
      await loadCaptcha();
      return;
    }

    await submitResponse();
  }

  async function submitResponse() {
    if (!survey) return;
    setPhase('submitting');
    setSubmitError(null);
    const ok = await api.submitSurveyResponse(instance?.id || null, survey.id, answers, language);
    if (ok) {
      setPhase('completed');
      scrollToTop();
    } else {
      setSubmitError('Something went wrong while submitting your response. Please try again.');
      setPhase('captcha');
      await loadCaptcha();
    }
  }

  /* ---------- Render: Loading ---------- */
  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Loading survey…</p>
        </div>
      </div>
    );
  }

  /* ---------- Render: Not found ---------- */
  if (phase === 'not-found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center animate-slide-up">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold font-display text-slate-900 mb-2">Survey not found</h1>
          <p className="text-sm text-slate-500">
            The survey link you followed may have expired or is no longer available. Please check the link and try again.
          </p>
        </div>
      </div>
    );
  }

  /* ---------- Render: Already completed ---------- */
  if (phase === 'already-completed' && survey) {
    const completion = survey.completionMessage?.[language] || survey.completionMessage?.[survey.defaultLanguage];
    const title = completion?.title || 'Already completed';
    const body = completion?.body || 'Thank you for your response. This survey has already been submitted.';
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4" dir={RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center animate-slide-up">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: `${survey.branding.primaryColor}15` }}
          >
            <CheckCircle2 className="w-7 h-7" style={{ color: survey.branding.primaryColor }} />
          </div>
          <h1 className="text-xl font-semibold font-display text-slate-900 mb-2">{title}</h1>
          <p className="text-sm text-slate-500">{body}</p>
        </div>
      </div>
    );
  }

  if (!survey) {
    return null;
  }

  const branding = survey.branding;
  const primary = branding.primaryColor;
  const accent = branding.accentColor;

  /* ---------- Render: Completed ---------- */
  if (phase === 'completed') {
    const completion = survey.completionMessage?.[language] || survey.completionMessage?.[survey.defaultLanguage];
    const title = completion?.title || 'Thank you!';
    const body = completion?.body || 'Your response has been recorded. We appreciate your feedback.';
    const redirectUrl = completion?.redirectUrl || null;
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 py-10"
        dir={dir}
        style={{ backgroundColor: `${primary}0a`, fontFamily: resolveFontFamily(branding.fontFamily) }}
      >
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 sm:p-10 text-center animate-slide-up">
          {(branding.logoUrl || !branding.hidePulseBranding) && (
            <div className="flex items-center justify-center mb-6">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="max-h-12 max-w-[160px] object-contain" />
              ) : (
                <span className="text-lg font-bold font-display" style={{ color: primary }}>
                  Pulse
                </span>
              )}
            </div>
          )}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: `${primary}15` }}
          >
            <CheckCircle2 className="w-9 h-9" style={{ color: primary }} />
          </div>
          <h1 className="text-2xl font-semibold font-display text-slate-900 mb-3">{title}</h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">{body}</p>
          {redirectUrl && (
            <a
              href={redirectUrl}
              className="btn inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white shadow-sm transition-all"
              style={{ backgroundColor: primary }}
            >
              Continue
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          {!branding.hidePulseBranding && (
            <p className="text-xs text-slate-400 mt-8">
              Powered by <span className="font-semibold" style={{ color: primary }}>Pulse</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ---------- Render: Submitting ---------- */
  if (phase === 'submitting') {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-slate-50"
        style={{ fontFamily: resolveFontFamily(branding.fontFamily) }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: primary }} />
          <p className="text-sm text-slate-500">Submitting your response…</p>
        </div>
      </div>
    );
  }

  /* ---------- Personalized greeting ---------- */
  const payload = instance?.payload || {};
  const customerName = payload.customer_name || payload.customerName || payload.name || '';
  const greeting = customerName
    ? `Hi ${customerName.split(' ')[0]}, we'd love your feedback.`
    : "We'd love your feedback.";

  const progress = pages.length > 0 ? ((currentPageIndex + 1) / pages.length) * 100 : 100;

  /* ---------- Render: CAPTCHA ---------- */
  if (phase === 'captcha') {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 py-10"
        dir={dir}
        style={{ backgroundColor: `${primary}0a`, fontFamily: resolveFontFamily(branding.fontFamily) }}
      >
        <div className="max-w-lg w-full">
          {(branding.logoUrl || !branding.hidePulseBranding) && (
            <div className="flex items-center justify-center mb-6">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="max-h-10 max-w-[140px] object-contain" />
              ) : (
                <span className="text-base font-bold font-display" style={{ color: primary }}>
                  Pulse
                </span>
              )}
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 sm:p-8 animate-slide-up">
            <h2 className="text-xl font-semibold font-display text-slate-900 mb-2">Almost done!</h2>
            <p className="text-sm text-slate-500 mb-6">
              Please verify you're human by entering the code below.
            </p>

            {submitError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <div className="mb-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center min-h-[80px]">
                  {captchaLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  ) : captchaImage ? (
                    <img src={captchaImage} alt="CAPTCHA" className="max-h-20 w-full object-contain" />
                  ) : (
                    <span className="text-sm text-slate-400">No image</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={loadCaptcha}
                  disabled={captchaLoading}
                  className="btn btn-secondary !px-3 !py-3"
                  title="Refresh CAPTCHA"
                >
                  <RefreshCw className={`w-4 h-4 ${captchaLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="label">Enter the code</label>
              <input
                type="text"
                value={captchaAnswer}
                onChange={(e) => {
                  setCaptchaAnswer(e.target.value);
                  setCaptchaError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCaptchaSubmit();
                }}
                placeholder="Type the characters shown"
                className="input"
                autoComplete="off"
                autoFocus
              />
            </div>

            {captchaError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{captchaError}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleBack}
                className="btn btn-secondary"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                type="button"
                onClick={handleCaptchaSubmit}
                disabled={captchaLoading || !captchaAnswer.trim()}
                className="btn inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: primary }}
              >
                {captchaLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  <>
                    Submit Response
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
          {!branding.hidePulseBranding && (
            <p className="text-center text-xs text-slate-400 mt-6">
              Powered by <span className="font-semibold" style={{ color: primary }}>Pulse</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ---------- Render: Survey (page navigation) ---------- */
  return (
    <div
      className="min-h-screen"
      dir={dir}
      style={{
        backgroundColor: `${primary}0a`,
        fontFamily: resolveFontFamily(branding.fontFamily),
      }}
    >
      <div ref={topRef} className="scroll-mt-4" />

      {/* Top bar: logo + language selector */}
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="Logo" className="max-h-9 max-w-[120px] object-contain" />
            ) : !branding.hidePulseBranding ? (
              <span className="text-base font-bold font-display" style={{ color: primary }}>
                Pulse
              </span>
            ) : null}
          </div>
          {survey.languages.length > 1 && (
            <div className="relative">
              <Globe className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="appearance-none pl-8 pr-8 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition cursor-pointer"
              >
                {survey.languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {languageLabel(lang)}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="max-w-2xl mx-auto px-4 mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-500">
            Page {currentPageIndex + 1} of {pages.length}
          </span>
          <span className="text-xs font-medium text-slate-400">
            {Math.round(progress)}% complete
          </span>
        </div>
        <div className="w-full bg-slate-200/70 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: primary }}
          />
        </div>
      </div>

      {/* Survey card */}
      <div className="max-w-2xl mx-auto px-4 pb-10">
        <div
          key={currentPageIndex}
          className={`bg-white rounded-2xl shadow-lg border border-slate-200 p-6 sm:p-8 ${
            direction === 'forward' ? 'animate-slide-up' : 'animate-fade-in'
          }`}
        >
          {currentPage?.title && (
            <h2 className="text-lg font-semibold font-display text-slate-900 mb-1">
              {tr(`page_${currentPage.id}_title`, currentPage.title)}
            </h2>
          )}

          {/* Greeting on first page */}
          {currentPageIndex === 0 && (
            <div className="mb-5">
              <h1 className="text-2xl font-semibold font-display text-slate-900 mb-1">
                {tr('title', survey.title)}
              </h1>
              <p className="text-sm text-slate-500">{greeting}</p>
              {survey.description && (
                <p className="text-sm text-slate-500 mt-2">{tr('description', survey.description)}</p>
              )}
            </div>
          )}

          {/* Questions */}
          <div className="space-y-6">
            {currentPage?.questions
              .filter((question) => shouldDisplayQuestion(question, answers))
              .map((question) => (
              <QuestionRenderer
                key={question.id}
                question={question}
                value={answers[question.id]}
                onChange={(v) => setAnswer(question.id, v)}
                error={errors[question.id]}
                allQuestions={allQuestions}
                answers={answers}
                primaryColor={primary}
                accentColor={accent}
                translation={activeTranslation}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3 mt-8 pt-5 border-t border-slate-100">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentPageIndex === 0}
              className="btn btn-secondary"
            >
              {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              {tr('btn_back', 'Back')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="btn inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white shadow-sm transition-all"
              style={{ backgroundColor: primary }}
            >
              {isLastPage ? (
                <>
                  {tr('btn_submit', 'Submit')}
                  {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </>
              ) : (
                <>
                  {tr('btn_next', 'Next')}
                  {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </>
              )}
            </button>
          </div>
        </div>

        {!branding.hidePulseBranding && (
          <p className="text-center text-xs text-slate-400 mt-6">
            Powered by <span className="font-semibold" style={{ color: primary }}>Pulse</span>
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------- Question renderer ---------- */

interface QuestionRendererProps {
  question: Question;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  allQuestions: Question[];
  answers: Record<string, any>;
  primaryColor: string;
  accentColor: string;
  translation: Record<string, any>;
}

function QuestionRenderer({
  question,
  value,
  onChange,
  error,
  allQuestions,
  answers,
  primaryColor,
  accentColor,
  translation,
}: QuestionRendererProps) {
  const rawTitle = translation[`q_${question.id}_title`] || question.title;
  const title = useMemo(
    () => applyPiping(rawTitle, question, answers, allQuestions),
    [rawTitle, question, answers, allQuestions],
  );
  const rawDesc = translation[`q_${question.id}_desc`] || question.description;
  const description = rawDesc
    ? applyPiping(rawDesc, question, answers, allQuestions)
    : undefined;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-semibold text-slate-800">
          {title}
          {question.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-sm text-red-600">
          <XCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <QuestionInput
        question={question}
        value={value}
        onChange={onChange}
        primaryColor={primaryColor}
        accentColor={accentColor}
        translation={translation}
      />
    </div>
  );
}

/* ---------- Per-type input ---------- */

interface QuestionInputProps {
  question: Question;
  value: any;
  onChange: (value: any) => void;
  primaryColor: string;
  accentColor: string;
  translation: Record<string, any>;
}

function QuestionInput({ question, value, onChange, primaryColor, accentColor, translation }: QuestionInputProps) {
  switch (question.type) {
    case 'single-choice':
    case 'yes-no':
    case 'true-false':
      return <SingleChoiceInput question={question} value={value} onChange={onChange} primaryColor={primaryColor} translation={translation} />;
    case 'multiple-choice':
    case 'multi-select-dropdown':
      return <MultipleChoiceInput question={question} value={value} onChange={onChange} primaryColor={primaryColor} translation={translation} />;
    case 'dropdown':
      return <DropdownInput question={question} value={value} onChange={onChange} translation={translation} />;
    case 'rating':
      return <RatingInput question={question} value={value} onChange={onChange} primaryColor={primaryColor} />;
    case 'numeric-rating':
      return <NumericRatingInput question={question} value={value} onChange={onChange} primaryColor={primaryColor} />;
    case 'emoji-rating':
      return <EmojiRatingInput question={question} value={value} onChange={onChange} primaryColor={primaryColor} />;
    case 'nps':
    case 'customer-satisfaction':
    case 'customer-effort':
      return <NpsInput question={question} value={value} onChange={onChange} primaryColor={primaryColor} />;
    case 'slider':
      return <SliderInput question={question} value={value} onChange={onChange} primaryColor={primaryColor} />;
    case 'likert-scale':
      return <LikertScaleInput question={question} value={value} onChange={onChange} primaryColor={primaryColor} translation={translation} />;
    case 'matrix':
    case 'matrix-rating':
      return <MatrixInput question={question} value={value} onChange={onChange} primaryColor={primaryColor} translation={translation} />;
    case 'ranking':
    case 'drag-ranking':
      return <RankingInput question={question} value={value} onChange={onChange} primaryColor={primaryColor} translation={translation} />;
    case 'text':
    case 'email':
    case 'phone':
    case 'url':
    case 'number':
    case 'decimal':
      return <TextInput question={question} value={value} onChange={onChange} />;
    case 'long-text':
      return <LongTextInput question={question} value={value} onChange={onChange} />;
    case 'date':
      return <DateInput question={question} value={value} onChange={onChange} />;
    case 'datetime':
      return <DateTimeInput question={question} value={value} onChange={onChange} />;
    case 'time':
      return <TimeInput question={question} value={value} onChange={onChange} />;
    case 'file-upload':
      return <FileUploadInput question={question} value={value} onChange={onChange} primaryColor={primaryColor} />;
    case 'image-selection':
      return <ImageSelectionInput question={question} value={value} onChange={onChange} primaryColor={primaryColor} translation={translation} />;
    case 'signature':
      return <SignatureInput question={question} value={value} onChange={onChange} primaryColor={primaryColor} />;
    case 'address':
      return <AddressInput question={question} value={value} onChange={onChange} />;
    case 'location':
      return <LocationInput question={question} value={value} onChange={onChange} />;
    case 'contact-info':
      return <ContactInfoInput question={question} value={value} onChange={onChange} />;
    case 'semantic-differential':
      return <SemanticDifferentialInput question={question} value={value} onChange={onChange} primaryColor={primaryColor} />;
    default:
      return <TextInput question={question} value={value} onChange={onChange} />;
  }
}

/* ---------- Single choice ---------- */

function SingleChoiceInput({
  question,
  value,
  onChange,
  primaryColor,
  translation,
}: {
  question: Question;
  value: any;
  onChange: (v: string) => void;
  primaryColor: string;
  translation: Record<string, any>;
}) {
  return (
    <div className="space-y-2">
      {question.options?.map((option) => {
        const selected = value === option.id;
        const label = translation[`opt_${option.id}`] || option.label;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left text-sm transition-all"
            style={{
              borderColor: selected ? primaryColor : '#e2e8f0',
              backgroundColor: selected ? `${primaryColor}0d` : 'white',
              boxShadow: selected ? `0 0 0 1px ${primaryColor}` : 'none',
            }}
          >
            <span
              className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
              style={{ borderColor: selected ? primaryColor : '#cbd5e1' }}
            >
              {selected && (
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
              )}
            </span>
            <span className={selected ? 'text-slate-900 font-medium' : 'text-slate-700'}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Multiple choice ---------- */

function MultipleChoiceInput({
  question,
  value,
  onChange,
  primaryColor,
  translation,
}: {
  question: Question;
  value: any;
  onChange: (v: string[]) => void;
  primaryColor: string;
  translation: Record<string, any>;
}) {
  const selected: string[] = Array.isArray(value) ? value : [];

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((v) => v !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="space-y-2">
      {question.options?.map((option) => {
        const isSel = selected.includes(option.id);
        const label = translation[`opt_${option.id}`] || option.label;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => toggle(option.id)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left text-sm transition-all"
            style={{
              borderColor: isSel ? primaryColor : '#e2e8f0',
              backgroundColor: isSel ? `${primaryColor}0d` : 'white',
              boxShadow: isSel ? `0 0 0 1px ${primaryColor}` : 'none',
            }}
          >
            <span
              className="w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center"
              style={{ borderColor: isSel ? primaryColor : '#cbd5e1' }}
            >
              {isSel && <CheckCircle2 className="w-3 h-3" style={{ color: primaryColor }} />}
            </span>
            <span className={isSel ? 'text-slate-900 font-medium' : 'text-slate-700'}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Dropdown ---------- */

function DropdownInput({
  question,
  value,
  onChange,
  translation,
}: {
  question: Question;
  value: any;
  onChange: (v: string) => void;
  translation: Record<string, any>;
}) {
  return (
    <div className="relative">
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="input appearance-none pr-10"
      >
        <option value="">Select an option…</option>
        {question.options?.map((option) => (
          <option key={option.id} value={option.id}>
            {translation[`opt_${option.id}`] || option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

/* ---------- Rating (stars) ---------- */

function RatingInput({
  question,
  value,
  onChange,
  primaryColor,
}: {
  question: Question;
  value: any;
  onChange: (v: number) => void;
  primaryColor: string;
}) {
  const max = question.max || 5;
  const stars = Array.from({ length: max }, (_, i) => i + 1);
  const current = typeof value === 'number' ? value : 0;

  return (
    <div>
      <div className="flex items-center gap-1.5">
        {stars.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-1 transition-transform hover:scale-110"
            title={`${n} star${n > 1 ? 's' : ''}`}
          >
            <Star
              className="w-7 h-7 transition-colors"
              style={{ color: n <= current ? primaryColor : '#cbd5e1' }}
              fill={n <= current ? primaryColor : 'none'}
            />
          </button>
        ))}
      </div>
      {current > 0 && (
        <p className="text-xs text-slate-500 mt-2">
          {current} / {max}
        </p>
      )}
    </div>
  );
}

/* ---------- NPS (0-10) ---------- */

function NpsInput({
  question,
  value,
  onChange,
  primaryColor,
}: {
  question: Question;
  value: any;
  onChange: (v: number) => void;
  primaryColor: string;
}) {
  const current = typeof value === 'number' ? value : null;
  const scale = Array.from({ length: 11 }, (_, i) => i);

  function labelFor(n: number): string {
    if (n <= 6) return 'Detractor';
    if (n <= 8) return 'Passive';
    return 'Promoter';
  }
  function colorFor(n: number): string {
    if (n <= 6) return '#ef4444';
    if (n <= 8) return '#f59e0b';
    return '#22c55e';
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {scale.map((n) => {
          const selected = current === n;
          const isSet = current !== null;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className="w-9 h-9 rounded-lg border text-sm font-medium transition-all"
              style={{
                borderColor: selected ? primaryColor : '#e2e8f0',
                backgroundColor: selected ? primaryColor : 'white',
                color: selected ? 'white' : isSet ? colorFor(n) : '#475569',
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
        <span>Not at all likely</span>
        <span>Extremely likely</span>
      </div>
      {current !== null && (
        <p className="text-xs mt-2" style={{ color: colorFor(current) }}>
          {labelFor(current)}
        </p>
      )}
    </div>
  );
}

/* ---------- Slider ---------- */

function SliderInput({
  question,
  value,
  onChange,
  primaryColor,
}: {
  question: Question;
  value: any;
  onChange: (v: number) => void;
  primaryColor: string;
}) {
  const min = question.min ?? 0;
  const max = question.max ?? 100;
  const step = question.step ?? 1;
  const current = typeof value === 'number' ? value : min;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">{min}</span>
        <span className="text-sm font-semibold" style={{ color: primaryColor }}>
          {current}
        </span>
        <span className="text-xs text-slate-400">{max}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${
            ((current - min) / (max - min)) * 100
          }%, #e2e8f0 ${((current - min) / (max - min)) * 100}%, #e2e8f0 100%)`,
        }}
      />
    </div>
  );
}

/* ---------- Matrix ---------- */

function MatrixInput({
  question,
  value,
  onChange,
  primaryColor,
  translation,
}: {
  question: Question;
  value: any;
  onChange: (v: Record<string, string>) => void;
  primaryColor: string;
  translation: Record<string, any>;
}) {
  const rows = question.rows || [];
  const columns = question.columns || [];
  const current: Record<string, string> = value && typeof value === 'object' ? value : {};

  function setCell(row: string, col: string) {
    onChange({ ...current, [row]: col });
  }

  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left text-xs font-medium text-slate-500 p-2 sticky left-0 bg-white min-w-[140px]">
              &nbsp;
            </th>
            {columns.map((col, cIdx) => (
              <th key={col} className="text-center text-xs font-medium text-slate-600 p-2 min-w-[80px]">
                {translation[`col_${question.id}_${cIdx}`] || col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={row}>
              <td className="text-sm text-slate-700 p-2 sticky left-0 bg-white min-w-[140px]">
                {translation[`row_${question.id}_${rIdx}`] || row}
              </td>
              {columns.map((col) => {
                const selected = current[row] === col;
                return (
                  <td key={col} className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => setCell(row, col)}
                      className="w-5 h-5 rounded-full border-2 mx-auto flex items-center justify-center transition-all"
                      style={{ borderColor: selected ? primaryColor : '#cbd5e1' }}
                    >
                      {selected && (
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Ranking ---------- */

function RankingInput({
  question,
  value,
  onChange,
  primaryColor,
  translation,
}: {
  question: Question;
  value: any;
  onChange: (v: string[]) => void;
  primaryColor: string;
  translation: Record<string, any>;
}) {
  const options = question.options || [];
  const ranked: string[] = Array.isArray(value) ? value : [];
  const rankedSet = new Set(ranked);
  const available = options.filter((o) => !rankedSet.has(o.id));

  function add(id: string) {
    onChange([...ranked, id]);
  }
  function remove(id: string) {
    onChange(ranked.filter((r) => r !== id));
  }
  function move(index: number, dir: -1 | 1) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex > ranked.length - 1) return;
    const next = [...ranked];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {available.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Click to add to ranking:</p>
          <div className="flex flex-wrap gap-2">
            {available.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => add(option.id)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition"
              >
                {translation[`opt_${option.id}`] || option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {ranked.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">Your ranking:</p>
          {ranked.map((id, index) => {
            const option = options.find((o) => o.id === id);
            if (!option) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-white"
                style={{ borderColor: `${primaryColor}40` }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  {index + 1}
                </span>
                <span className="flex-1 text-sm text-slate-800">{translation[`opt_${option.id}`] || option.label}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition"
                    title="Move up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === ranked.length - 1}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition"
                    title="Move down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ranked.length === 0 && available.length === 0 && (
        <p className="text-sm text-slate-400">No options available.</p>
      )}
    </div>
  );
}

/* ---------- Text ---------- */

function TextInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: any;
  onChange: (v: string) => void;
}) {
  const type =
    question.validation === 'email'
      ? 'email'
      : question.validation === 'phone'
        ? 'tel'
        : question.validation === 'url'
          ? 'url'
          : question.validation === 'number'
            ? 'number'
            : question.validation === 'decimal'
              ? 'number'
              : 'text';
  const step = question.validation === 'decimal' ? '0.01' : question.validation === 'number' ? '1' : undefined;
  return (
    <input
      type={type}
      step={step}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Your answer…"
      className="input"
    />
  );
}

/* ---------- Long text ---------- */

function LongTextInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: any;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Your answer…"
      rows={4}
      className="input resize-y min-h-[100px]"
    />
  );
}

/* ---------- Date ---------- */

function DateInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: any;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="input max-w-xs"
    />
  );
}

/* ---------- Time ---------- */

function TimeInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: any;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative max-w-sm">
      <input
        type="time"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="input pr-10"
      />
      <Clock className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

/* ---------- File upload ---------- */

function FileUploadInput({
  question,
  value,
  onChange,
  primaryColor,
}: {
  question: Question;
  value: any;
  onChange: (v: any) => void;
  primaryColor: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileName: string | null =
    value && typeof value === 'object' && value.name ? value.name : typeof value === 'string' ? value : null;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange({ name: file.name, size: file.size, type: file.type });
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFile}
        className="hidden"
      />
      {fileName ? (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg border"
          style={{ borderColor: `${primaryColor}40`, backgroundColor: `${primaryColor}0d` }}
        >
          <FileUp className="w-5 h-5 flex-shrink-0" style={{ color: primaryColor }} />
          <span className="flex-1 text-sm text-slate-800 truncate">{fileName}</span>
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
            title="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-lg border-2 border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition"
        >
          <FileUp className="w-6 h-6 text-slate-400" />
          <span className="text-sm text-slate-600 font-medium">Click to upload a file</span>
          <span className="text-xs text-slate-400">No file selected</span>
        </button>
      )}
    </div>
  );
}

/* ---------- Numeric Rating ---------- */

function NumericRatingInput({
  question,
  value,
  onChange,
  primaryColor,
}: {
  question: Question;
  value: any;
  onChange: (v: number) => void;
  primaryColor: string;
}) {
  const min = question.min ?? 1;
  const max = question.max ?? 5;
  const current = typeof value === 'number' ? value : 0;
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="w-10 h-10 rounded-lg border text-sm font-medium transition-all hover:scale-110"
          style={{
            borderColor: current === n ? primaryColor : '#e2e8f0',
            backgroundColor: current === n ? primaryColor : 'white',
            color: current === n ? 'white' : '#475569',
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

/* ---------- Emoji Rating ---------- */

function EmojiRatingInput({
  question,
  value,
  onChange,
  primaryColor,
}: {
  question: Question;
  value: any;
  onChange: (v: number) => void;
  primaryColor: string;
}) {
  const emojis = question.emojiSet || ['😕', '😐', '🙂', '😀', '😄'];
  const current = typeof value === 'number' ? value : 0;
  return (
    <div className="flex items-center gap-2">
      {emojis.map((emoji, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1)}
          className="text-3xl p-2 rounded-lg border transition-all hover:scale-110"
          style={{
            borderColor: current === i + 1 ? primaryColor : '#e2e8f0',
            backgroundColor: current === i + 1 ? `${primaryColor}0d` : 'white',
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/* ---------- Likert Scale ---------- */

function LikertScaleInput({
  question,
  value,
  onChange,
  primaryColor,
  translation,
}: {
  question: Question;
  value: any;
  onChange: (v: string) => void;
  primaryColor: string;
  translation: Record<string, any>;
}) {
  const labels = question.scaleLabels || ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];
  return (
    <div className="space-y-2">
      {labels.map((label, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(label)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left text-sm transition-all"
          style={{
            borderColor: value === label ? primaryColor : '#e2e8f0',
            backgroundColor: value === label ? `${primaryColor}0d` : 'white',
            boxShadow: value === label ? `0 0 0 1px ${primaryColor}` : 'none',
          }}
        >
          <span
            className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
            style={{ borderColor: value === label ? primaryColor : '#cbd5e1' }}
          >
            {value === label && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />}
          </span>
          <span className={value === label ? 'text-slate-900 font-medium' : 'text-slate-700'}>
            {translation[`scale_${i}`] || label}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Date/Time ---------- */

function DateTimeInput({
  question: _question,
  value,
  onChange,
}: {
  question: Question;
  value: any;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="datetime-local"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="input max-w-xs"
    />
  );
}

/* ---------- Image Selection ---------- */

function ImageSelectionInput({
  question,
  value,
  onChange,
  primaryColor,
  translation,
}: {
  question: Question;
  value: any;
  onChange: (v: string) => void;
  primaryColor: string;
  translation: Record<string, any>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {question.options?.map((option) => {
        const selected = value === option.id;
        const label = translation[`opt_${option.id}`] || option.label;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className="rounded-xl border-2 overflow-hidden transition-all"
            style={{
              borderColor: selected ? primaryColor : '#e2e8f0',
              boxShadow: selected ? `0 0 0 1px ${primaryColor}` : 'none',
            }}
          >
            <div className="aspect-video bg-slate-100 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-xs text-slate-600 py-2 text-center font-medium">{label}</p>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Signature ---------- */

function SignatureInput({
  question: _question,
  value: _value,
  onChange: _onChange,
  primaryColor,
}: {
  question: Question;
  value: any;
  onChange: (v: any) => void;
  primaryColor: string;
}) {
  return (
    <div className="border-2 border-dashed rounded-xl p-6 text-center" style={{ borderColor: `${primaryColor}40` }}>
      <PenTool className="w-6 h-6 mx-auto mb-2" style={{ color: primaryColor }} />
      <p className="text-sm text-slate-500 font-medium">Click to sign</p>
      <p className="text-xs text-slate-400 mt-1">Draw your signature in the pad</p>
    </div>
  );
}

/* ---------- Address ---------- */

function AddressInput({
  question: _question,
  value,
  onChange,
}: {
  question: Question;
  value: any;
  onChange: (v: any) => void;
}) {
  const v = (typeof value === 'object' && value !== null) ? value as Record<string, string> : {};
  return (
    <div className="space-y-3">
      <input type="text" placeholder="Street Address" className="input" value={v.street || ''} onChange={(e) => onChange({ ...v, street: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <input type="text" placeholder="City" className="input" value={v.city || ''} onChange={(e) => onChange({ ...v, city: e.target.value })} />
        <input type="text" placeholder="State / Province" className="input" value={v.state || ''} onChange={(e) => onChange({ ...v, state: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input type="text" placeholder="ZIP / Postal Code" className="input" value={v.zip || ''} onChange={(e) => onChange({ ...v, zip: e.target.value })} />
        <input type="text" placeholder="Country" className="input" value={v.country || ''} onChange={(e) => onChange({ ...v, country: e.target.value })} />
      </div>
    </div>
  );
}

/* ---------- Location ---------- */

function LocationInput({
  question: _question,
  value: _value,
  onChange: _onChange,
}: {
  question: Question;
  value: any;
  onChange: (v: any) => void;
}) {
  return (
    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
      <MapPin className="w-6 h-6 text-slate-400 mx-auto mb-2" />
      <p className="text-sm text-slate-500 font-medium">Capture location</p>
      <p className="text-xs text-slate-400 mt-1">Click to share your location</p>
    </div>
  );
}

/* ---------- Contact Info ---------- */

function ContactInfoInput({
  question: _question,
  value,
  onChange,
}: {
  question: Question;
  value: any;
  onChange: (v: any) => void;
}) {
  const v = (typeof value === 'object' && value !== null) ? value as Record<string, string> : {};
  return (
    <div className="space-y-3">
      <input type="text" placeholder="Full Name" className="input" value={v.name || ''} onChange={(e) => onChange({ ...v, name: e.target.value })} />
      <input type="email" placeholder="Email Address" className="input" value={v.email || ''} onChange={(e) => onChange({ ...v, email: e.target.value })} />
      <input type="tel" placeholder="Phone Number" className="input" value={v.phone || ''} onChange={(e) => onChange({ ...v, phone: e.target.value })} />
    </div>
  );
}

/* ---------- Semantic Differential ---------- */

function SemanticDifferentialInput({
  question,
  value,
  onChange,
  primaryColor,
}: {
  question: Question;
  value: any;
  onChange: (v: any) => void;
  primaryColor: string;
}) {
  const v = (typeof value === 'object' && value !== null) ? value as Record<string, number> : {};
  return (
    <div className="space-y-4">
      {question.options?.map((pair, pIdx) => {
        const nextPair = question.options?.[(pIdx + 1) % (question.options?.length || 1)];
        return (
          <div key={pair.id}>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span>{pair.label}</span>
              <span>{nextPair?.label || ''}</span>
            </div>
            <input
              type="range"
              min={1}
              max={7}
              step={1}
              value={v[pair.id] ?? 4}
              onChange={(e) => onChange({ ...v, [pair.id]: Number(e.target.value) })}
              className="w-full"
              style={{ accentColor: primaryColor }}
            />
          </div>
        );
      })}
    </div>
  );
}
