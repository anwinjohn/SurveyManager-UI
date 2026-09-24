import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock,
  ExternalLink,
  FileUp,
  UploadCloud,
  Globe,
  Loader2,
  RefreshCw,
  Star,
  Trash2,
  X,
  XCircle,
  Smile,
  Image as ImageIcon,
  PenTool,
  MapPin,
  LocateFixed,
  Sparkles,
  Timer,
  ListChecks,
  ShieldCheck,
  Check,
  RotateCcw,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { api } from '@/services/api';
import { evaluateSkipRules, shouldDisplayQuestion, evaluateConditionGroup } from '@/utils/logic';
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

const PIPE_PLACEHOLDER_PATTERN = /\{piped\}|\$\{answer\}/g;

function applyPiping(
  text: string,
  question: Question,
  answers: Record<string, any>,
  allQuestions: Question[],
): string {
  if (!question.pipeFrom) return text;
  const sourceAnswer = answers[question.pipeFrom];
  const hasAnswer = !(
    sourceAnswer === undefined ||
    sourceAnswer === null ||
    sourceAnswer === '' ||
    (Array.isArray(sourceAnswer) && sourceAnswer.length === 0)
  );

  if (!hasAnswer) {
    // The source question hasn't been answered yet — never show the raw
    // "{piped}" token to a respondent. Strip it and tidy up the spacing
    // so the sentence still reads cleanly.
    if (!text.includes('{piped}') && !text.includes('${answer}')) return text;
    return text
      .replace(PIPE_PLACEHOLDER_PATTERN, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([,.!?])/g, '$1')
      .trim();
  }

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

  return text.replace(PIPE_PLACEHOLDER_PATTERN, displayValue);
}

/* ---------- Required (incl. conditional) ---------- */

// A question is required either unconditionally (question.required) or
// conditionally via requiredRule — evaluated against the answers collected
// so far, exactly the way the builder's preview evaluates it. This keeps
// the live survey and the builder's preview in lockstep.
function isQuestionRequired(question: Question, answers: Record<string, any>): boolean {
  if (question.required) return true;
  const rule = (question as any).requiredRule;
  if (rule?.conditionGroup) return evaluateConditionGroup(rule.conditionGroup, answers);
  return false;
}

/* ---------- Validation ---------- */

function validateField(question: Question, value: any, required: boolean): string | null {
  if (required) {
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
  // File upload constraints (size / accepted types), configured in the builder.
  if (question.type === 'file-upload' && value && typeof value === 'object') {
    const file = value as { name?: string; size?: number; type?: string };
    const maxFileSize = (question as any).maxFileSize as number | undefined;
    const allowedFileTypes = (question as any).allowedFileTypes as string[] | undefined;
    if (maxFileSize && typeof file.size === 'number' && file.size > maxFileSize * 1024 * 1024) {
      return `File is too large. Maximum size is ${maxFileSize}MB.`;
    }
    if (allowedFileTypes && allowedFileTypes.length > 0 && file.type) {
      const ok = allowedFileTypes.some((pattern) => {
        const p = pattern.trim();
        if (!p) return false;
        if (p.endsWith('/*')) return file.type!.startsWith(p.slice(0, -1));
        return file.type === p;
      });
      if (!ok) return 'This file type is not accepted.';
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

/* ---------- Misc helpers ---------- */

function estimateMinutes(questionCount: number): number {
  // Rough heuristic: ~15 seconds per question, rounded up, minimum 1 minute.
  return Math.max(1, Math.round((questionCount * 15) / 60));
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  if (Number.isNaN(bigint)) return `rgba(15, 23, 42, ${alpha})`;
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ---------- Main component ---------- */

type Phase = 'loading' | 'not-found' | 'already-completed' | 'intro' | 'survey' | 'captcha' | 'submitting' | 'completed';

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
      setPhase('intro');

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

  const pages = survey?.pages || [];
  const currentPage = pages[currentPageIndex];
  const isLastPage = currentPageIndex === pages.length - 1;
  const visibleQuestionCount = useMemo(
    () => allQuestions.filter((q) => shouldDisplayQuestion(q, answers)).length,
    [allQuestions, answers],
  );

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
      const err = validateField(q, answers[q.id], isQuestionRequired(q, answers));
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

  function handleStart() {
    setPhase('survey');
    scrollToTop();
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
    if (currentPageIndex === 0) {
      setPhase('intro');
      scrollToTop();
      return;
    }
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
          <Loader2 className="w-7 h-7 animate-spin text-slate-300" />
          <p className="text-sm text-slate-400">Loading survey…</p>
        </div>
      </div>
    );
  }

  /* ---------- Render: Not found ---------- */
  if (phase === 'not-found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-900/5 border border-slate-100 p-8 sm:p-10 text-center animate-slide-up">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold font-display text-slate-900 mb-2">Survey not found</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
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
    const primaryC = survey.branding.primaryColor;
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        dir={RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr'}
        style={{ background: `linear-gradient(180deg, ${hexToRgba(primaryC, 0.06)} 0%, #f8fafc 40%)` }}
      >
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-900/5 border border-slate-100 p-8 sm:p-10 text-center animate-slide-up">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: hexToRgba(primaryC, 0.12) }}
          >
            <CheckCircle2 className="w-8 h-8" style={{ color: primaryC }} />
          </div>
          <h1 className="text-xl font-semibold font-display text-slate-900 mb-2">{title}</h1>
          <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
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
  const fontFamily = resolveFontFamily(branding.fontFamily);
  const pageBackground = `radial-gradient(1200px circle at 15% -10%, ${hexToRgba(primary, 0.10)}, transparent 45%), radial-gradient(900px circle at 100% 0%, ${hexToRgba(accent, 0.10)}, transparent 40%), #f8fafc`;

  const payload = instance?.payload || {};
  const customerName = payload.customer_name || payload.customerName || payload.name || '';
  const greeting = customerName
    ? `Hi ${customerName.split(' ')[0]}, we'd love your feedback.`
    : "We'd love to hear your feedback.";

  /* Shared brand mark used across every screen */
  function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const dims = size === 'lg' ? 'max-h-14 max-w-[200px]' : size === 'sm' ? 'max-h-8 max-w-[110px]' : 'max-h-10 max-w-[140px]';
    if (branding.logoUrl) {
      return <img src={branding.logoUrl} alt="Logo" className={`${dims} object-contain`} />;
    }
    if (branding.hidePulseBranding) return null;
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: primary }}
        >
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <span className="text-base font-bold font-display" style={{ color: primary }}>
          Pulse
        </span>
      </div>
    );
  }

  function PoweredByFooter() {
    if (branding.hidePulseBranding) return null;
    return (
      <p className="text-center text-xs text-slate-400 mt-6 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" />
        Secured &amp; powered by <span className="font-semibold" style={{ color: primary }}>Pulse</span>
      </p>
    );
  }

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
        style={{ background: pageBackground, fontFamily }}
      >
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl shadow-slate-900/5 border border-slate-100 p-8 sm:p-12 text-center animate-slide-up relative overflow-hidden">
          <div
            className="absolute -top-24 -right-24 w-56 h-56 rounded-full opacity-40 blur-3xl pointer-events-none"
            style={{ backgroundColor: hexToRgba(primary, 0.5) }}
          />
          <div
            className="absolute -bottom-24 -left-24 w-56 h-56 rounded-full opacity-30 blur-3xl pointer-events-none"
            style={{ backgroundColor: hexToRgba(accent, 0.5) }}
          />
          <div className="relative">
            {(branding.logoUrl || !branding.hidePulseBranding) && (
              <div className="flex items-center justify-center mb-7">
                <BrandMark size="md" />
              </div>
            )}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 relative"
              style={{ backgroundColor: hexToRgba(primary, 0.12) }}
            >
              <div
                className="absolute inset-0 rounded-full animate-ping-slow opacity-30"
                style={{ backgroundColor: primary }}
              />
              <CheckCircle2 className="w-10 h-10 relative" style={{ color: primary }} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold font-display text-slate-900 mb-3">{title}</h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-8 max-w-sm mx-auto">{body}</p>
            {redirectUrl && (
              <a
                href={redirectUrl}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 hover:-translate-y-0.5"
                style={{ backgroundColor: primary, boxShadow: `0 10px 25px -5px ${hexToRgba(primary, 0.4)}` }}
              >
                Continue
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <PoweredByFooter />
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Render: Submitting ---------- */
  if (phase === 'submitting') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: pageBackground, fontFamily }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
            <div
              className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
              style={{ borderTopColor: primary }}
            />
          </div>
          <p className="text-sm text-slate-500 font-medium">Submitting your response…</p>
        </div>
      </div>
    );
  }

  /* ---------- Render: Intro / cover screen ---------- */
  if (phase === 'intro') {
    const minutes = estimateMinutes(allQuestions.length);
    return (
      <div className="min-h-screen flex flex-col" dir={dir} style={{ background: pageBackground, fontFamily }}>
        <div ref={topRef} className="scroll-mt-4" />
        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="max-w-xl w-full">
            <div className="flex items-center justify-between mb-8">
              <BrandMark size="md" />
              {survey.languages.length > 1 && (
                <LanguageSelect language={language} languages={survey.languages} onChange={setLanguage} />
              )}
            </div>

            <div className="bg-white rounded-3xl shadow-xl shadow-slate-900/5 border border-slate-100 p-8 sm:p-12 animate-slide-up relative overflow-hidden">
              <div
                className="absolute -top-20 -right-20 w-52 h-52 rounded-full opacity-30 blur-3xl pointer-events-none"
                style={{ backgroundColor: hexToRgba(primary, 0.6) }}
              />
              <div className="relative">
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-5"
                  style={{ backgroundColor: hexToRgba(primary, 0.1), color: primary }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Survey
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 mb-3 leading-tight">
                  {tr('title', survey.title)}
                </h1>
                <p className="text-sm sm:text-base text-slate-600 mb-2">{greeting}</p>
                {survey.description && (
                  <p className="text-sm text-slate-500 leading-relaxed mt-2">{tr('description', survey.description)}</p>
                )}

                <div className="flex flex-wrap items-center gap-4 mt-7 mb-8 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <ListChecks className="w-4 h-4 text-slate-400" />
                    {allQuestions.length} question{allQuestions.length === 1 ? '' : 's'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Timer className="w-4 h-4 text-slate-400" />
                    About {minutes} min{minutes === 1 ? '' : 's'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                    Your responses are confidential
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleStart}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 hover:-translate-y-0.5"
                  style={{ backgroundColor: primary, boxShadow: `0 10px 25px -5px ${hexToRgba(primary, 0.45)}` }}
                >
                  {tr('btn_start', 'Start Survey')}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <PoweredByFooter />
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Render: CAPTCHA ---------- */
  if (phase === 'captcha') {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 py-10"
        dir={dir}
        style={{ background: pageBackground, fontFamily }}
      >
        <div className="max-w-lg w-full">
          <div className="flex items-center justify-center mb-6">
            <BrandMark size="sm" />
          </div>
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-900/5 border border-slate-100 p-6 sm:p-8 animate-slide-up">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: hexToRgba(primary, 0.1) }}
            >
              <ShieldCheck className="w-6 h-6" style={{ color: primary }} />
            </div>
            <h2 className="text-xl font-semibold font-display text-slate-900 mb-2">Almost done!</h2>
            <p className="text-sm text-slate-500 mb-6">
              Please verify you're human by entering the code below.
            </p>

            {submitError && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="mb-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center min-h-[84px]">
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
                  className="btn btn-secondary !px-3 !py-3.5 !rounded-xl"
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
                className="input !rounded-xl"
                autoComplete="off"
                autoFocus
              />
            </div>

            {captchaError && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700 flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{captchaError}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <button type="button" onClick={handleBack} className="btn btn-secondary !rounded-xl">
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                type="button"
                onClick={handleCaptchaSubmit}
                disabled={captchaLoading || !captchaAnswer.trim()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                style={{ backgroundColor: primary, boxShadow: `0 8px 20px -6px ${hexToRgba(primary, 0.4)}` }}
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
          <PoweredByFooter />
        </div>
      </div>
    );
  }

  /* ---------- Render: Survey (page navigation) ---------- */
  const progress = pages.length > 0 ? ((currentPageIndex + 1) / pages.length) * 100 : 100;

  return (
    <div className="min-h-screen" dir={dir} style={{ background: pageBackground, fontFamily }}>
      <div ref={topRef} className="scroll-mt-4" />

      {/* Sticky top bar: logo + progress + language selector */}
      <div className="sticky top-0 z-10 backdrop-blur-md bg-white/80 border-b border-slate-200/70">
        <div className="max-w-2xl mx-auto px-4 py-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <BrandMark size="sm" />
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-400 hidden sm:inline">
                Page {currentPageIndex + 1} of {pages.length}
              </span>
              {survey.languages.length > 1 && (
                <LanguageSelect language={language} languages={survey.languages} onChange={setLanguage} />
              )}
            </div>
          </div>
          <SegmentedProgress current={currentPageIndex} total={pages.length} color={primary} />
        </div>
      </div>

      {/* Survey card */}
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-10">
        <div
          key={currentPageIndex}
          className={`bg-white rounded-3xl shadow-xl shadow-slate-900/5 border border-slate-100 overflow-hidden ${
            direction === 'forward' ? 'animate-slide-up' : 'animate-fade-in'
          }`}
        >
          <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${primary}, ${accent})` }} />
          <div className="p-6 sm:p-9">
            {currentPage?.title && (
              <h2 className="text-lg font-semibold font-display text-slate-900 mb-1">
                {tr(`page_${currentPage.id}_title`, currentPage.title)}
              </h2>
            )}

            {/* Questions */}
            <div className="space-y-8 mt-1">
              {currentPage?.questions
                .filter((question) => shouldDisplayQuestion(question, answers))
                .map((question, idx) => (
                <QuestionRenderer
                  key={question.id}
                  index={idx}
                  question={question}
                  value={answers[question.id]}
                  onChange={(v) => setAnswer(question.id, v)}
                  error={errors[question.id]}
                  required={isQuestionRequired(question, answers)}
                  allQuestions={allQuestions}
                  answers={answers}
                  primaryColor={primary}
                  accentColor={accent}
                  translation={activeTranslation}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3 mt-9 pt-6 border-t border-slate-100">
              <button type="button" onClick={handleBack} className="btn btn-secondary !rounded-xl">
                {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                {tr('btn_back', 'Back')}
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 hover:-translate-y-0.5"
                style={{ backgroundColor: primary, boxShadow: `0 8px 20px -6px ${hexToRgba(primary, 0.4)}` }}
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
        </div>

        {visibleQuestionCount > 0 && (
          <p className="text-center text-xs text-slate-400 mt-4">
            {Math.round(progress)}% complete
          </p>
        )}
        <PoweredByFooter />
      </div>
    </div>
  );
}

/* ---------- Language select ---------- */

function LanguageSelect({
  language,
  languages,
  onChange,
}: {
  language: string;
  languages: string[];
  onChange: (lang: string) => void;
}) {
  return (
    <div className="relative">
      <Globe className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <select
        value={language}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-7.5 pr-7 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition cursor-pointer"
        style={{ paddingLeft: '1.75rem' }}
      >
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {languageLabel(lang)}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

/* ---------- Segmented progress bar ---------- */

function SegmentedProgress({ current, total, color }: { current: number; total: number; color: string }) {
  if (total <= 0) return null;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex-1 h-1.5 rounded-full bg-slate-200/70 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: i < current ? '100%' : i === current ? '100%' : '0%',
              backgroundColor: i <= current ? color : 'transparent',
              opacity: i <= current ? 1 : 0,
            }}
          />
        </div>
      ))}
    </div>
  );
}

/* ---------- Question renderer ---------- */

interface QuestionRendererProps {
  question: Question;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  required: boolean;
  index: number;
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
  required,
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
    <div className="space-y-3.5">
      <div>
        <label className="block text-[15px] font-semibold text-slate-800 leading-snug">
          {title}
          {required && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 ml-1.5 align-middle" title="Required" />
          )}
        </label>
        {description && <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{description}</p>}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
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
      return <LocationInput question={question} value={value} onChange={onChange} primaryColor={primaryColor} />;
    case 'contact-info':
      return <ContactInfoInput question={question} value={value} onChange={onChange} />;
    case 'semantic-differential':
      return <SemanticDifferentialInput question={question} value={value} onChange={onChange} primaryColor={primaryColor} />;
    default:
      return <TextInput question={question} value={value} onChange={onChange} />;
  }
}

/* ---------- Shared option button ---------- */

function OptionButton({
  selected,
  onClick,
  primaryColor,
  letter,
  multi,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  primaryColor: string;
  letter?: string;
  multi?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full group flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left text-sm transition-all duration-150 ${
        selected ? '' : 'hover:border-slate-300 hover:bg-slate-50/80'
      }`}
      style={{
        borderColor: selected ? primaryColor : '#e2e8f0',
        backgroundColor: selected ? hexToRgba(primaryColor, 0.06) : 'white',
        boxShadow: selected ? `0 0 0 1px ${primaryColor}, 0 4px 12px -4px ${hexToRgba(primaryColor, 0.35)}` : 'none',
      }}
    >
      {letter && (
        <span
          className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-colors"
          style={{
            backgroundColor: selected ? primaryColor : '#f1f5f9',
            color: selected ? 'white' : '#94a3b8',
          }}
        >
          {letter}
        </span>
      )}
      {!letter && (
        <span
          className={`w-[18px] h-[18px] border-2 flex-shrink-0 flex items-center justify-center transition-colors ${multi ? 'rounded-md' : 'rounded-full'}`}
          style={{ borderColor: selected ? primaryColor : '#cbd5e1', backgroundColor: selected ? primaryColor : 'transparent' }}
        >
          {selected && (multi ? <Check className="w-3 h-3 text-white" strokeWidth={3} /> : <span className="w-1.5 h-1.5 rounded-full bg-white" />)}
        </span>
      )}
      <span className={`flex-1 ${selected ? 'text-slate-900 font-medium' : 'text-slate-700'}`}>{children}</span>
    </button>
  );
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

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
      {question.options?.map((option, i) => (
        <OptionButton
          key={option.id}
          selected={value === option.id}
          onClick={() => onChange(option.id)}
          primaryColor={primaryColor}
          letter={(question.options?.length || 0) <= 8 ? LETTERS[i] : undefined}
        >
          {translation[`opt_${option.id}`] || option.label}
        </OptionButton>
      ))}
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
      {question.options?.map((option) => (
        <OptionButton
          key={option.id}
          selected={selected.includes(option.id)}
          onClick={() => toggle(option.id)}
          primaryColor={primaryColor}
          multi
        >
          {translation[`opt_${option.id}`] || option.label}
        </OptionButton>
      ))}
      {selected.length > 0 && (
        <p className="text-xs text-slate-400 pt-1">{selected.length} selected</p>
      )}
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
        className="input appearance-none pr-10 !rounded-xl"
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
  const [hover, setHover] = useState(0);
  const shown = hover || current;

  return (
    <div>
      <div className="flex items-center gap-1.5" onMouseLeave={() => setHover(0)}>
        {stars.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            className="p-1 transition-transform hover:scale-125"
            title={`${n} star${n > 1 ? 's' : ''}`}
          >
            <Star
              className="w-8 h-8 transition-colors"
              style={{ color: n <= shown ? primaryColor : '#e2e8f0' }}
              fill={n <= shown ? primaryColor : 'none'}
            />
          </button>
        ))}
      </div>
      {current > 0 && (
        <p className="text-xs font-medium mt-2.5" style={{ color: primaryColor }}>
          {current} out of {max}
        </p>
      )}
    </div>
  );
}

/* ---------- NPS (0-10) ---------- */

function NpsInput({
  question: _question,
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
      <div className="grid grid-cols-11 gap-1 sm:gap-1.5">
        {scale.map((n) => {
          const selected = current === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className="aspect-square rounded-lg border text-xs sm:text-sm font-semibold transition-all hover:-translate-y-0.5"
              style={{
                borderColor: selected ? primaryColor : '#e2e8f0',
                backgroundColor: selected ? primaryColor : 'white',
                color: selected ? 'white' : '#475569',
                boxShadow: selected ? `0 4px 12px -4px ${hexToRgba(primaryColor, 0.5)}` : 'none',
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-2.5 text-[11px] text-slate-400">
        <span>Not at all likely</span>
        <span>Extremely likely</span>
      </div>
      {current !== null && (
        <p className="text-xs font-semibold mt-2" style={{ color: colorFor(current) }}>
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
  const pct = ((current - min) / (max - min || 1)) * 100;

  return (
    <div className="pt-2">
      <div className="relative mb-1">
        <div
          className="absolute -top-8 px-2 py-1 rounded-lg text-xs font-semibold text-white transition-all"
          style={{ left: `calc(${pct}% - 14px)`, backgroundColor: primaryColor }}
        >
          {current}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-current"
        style={{
          background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`,
        }}
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-slate-400">{min}</span>
        <span className="text-xs text-slate-400">{max}</span>
      </div>
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
    <div className="overflow-x-auto -mx-2 px-2 rounded-xl border border-slate-100">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50/80">
            <th className="text-left text-xs font-medium text-slate-500 p-3 sticky left-0 bg-slate-50/80 min-w-[140px]">
              &nbsp;
            </th>
            {columns.map((col, cIdx) => (
              <th key={col} className="text-center text-xs font-medium text-slate-600 p-3 min-w-[80px]">
                {translation[`col_${question.id}_${cIdx}`] || col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={row} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
              <td className="text-sm text-slate-700 font-medium p-3 sticky left-0 bg-white min-w-[140px]">
                {translation[`row_${question.id}_${rIdx}`] || row}
              </td>
              {columns.map((col) => {
                const selected = current[row] === col;
                return (
                  <td key={col} className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => setCell(row, col)}
                      className="w-5 h-5 rounded-full border-2 mx-auto flex items-center justify-center transition-all hover:scale-110"
                      style={{ borderColor: selected ? primaryColor : '#cbd5e1', backgroundColor: selected ? hexToRgba(primaryColor, 0.1) : 'transparent' }}
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
          <p className="text-xs font-medium text-slate-500 mb-2">Tap to add to your ranking:</p>
          <div className="flex flex-wrap gap-2">
            {available.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => add(option.id)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition"
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
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl border bg-white shadow-sm"
                style={{ borderColor: hexToRgba(primaryColor, 0.25) }}
              >
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  {index + 1}
                </span>
                <span className="flex-1 text-sm text-slate-800 font-medium">{translation[`opt_${option.id}`] || option.label}</span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition"
                    title="Move up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === ranked.length - 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition"
                    title="Move down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
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
      className="input !rounded-xl"
    />
  );
}

/* ---------- Long text ---------- */

function LongTextInput({
  question: _question,
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
      className="input !rounded-xl resize-y min-h-[110px]"
    />
  );
}

/* ---------- Date ---------- */

function DateInput({
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
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="input !rounded-xl max-w-xs"
    />
  );
}

/* ---------- Time ---------- */

function TimeInput({
  question: _question,
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
        className="input !rounded-xl pr-10"
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
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileName: string | null =
    value && typeof value === 'object' && value.name ? value.name : typeof value === 'string' ? value : null;
  const fileSize: number | null = value && typeof value === 'object' && typeof value.size === 'number' ? value.size : null;

  const maxFileSize = (question as any).maxFileSize as number | undefined;
  const allowedFileTypes = (question as any).allowedFileTypes as string[] | undefined;

  function acceptFile(file: File) {
    setLocalError(null);
    if (maxFileSize && file.size > maxFileSize * 1024 * 1024) {
      setLocalError(`File is too large. Maximum size is ${maxFileSize}MB.`);
      return;
    }
    if (allowedFileTypes && allowedFileTypes.length > 0) {
      const ok = allowedFileTypes.some((pattern) => {
        const p = pattern.trim();
        if (!p) return false;
        if (p.endsWith('/*')) return file.type.startsWith(p.slice(0, -1));
        return file.type === p;
      });
      if (!ok) {
        setLocalError('This file type is not accepted.');
        return;
      }
    }
    onChange({ name: file.name, size: file.size, type: file.type });
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    acceptFile(file);
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div>
      <input ref={fileInputRef} type="file" onChange={handleFile} className="hidden" accept={allowedFileTypes?.join(',')} />
      {fileName ? (
        <div
          className="flex items-center gap-3 px-4 py-3.5 rounded-xl border"
          style={{ borderColor: hexToRgba(primaryColor, 0.3), backgroundColor: hexToRgba(primaryColor, 0.05) }}
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: hexToRgba(primaryColor, 0.15) }}>
            <FileUp className="w-4.5 h-4.5" style={{ color: primaryColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-800 font-medium truncate">{fileName}</p>
            {fileSize != null && <p className="text-xs text-slate-400">{formatSize(fileSize)}</p>}
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setLocalError(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
            title="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) acceptFile(file);
          }}
          className="w-full flex flex-col items-center justify-center gap-2 px-4 py-9 rounded-xl border-2 border-dashed transition-colors"
          style={{
            borderColor: dragOver ? primaryColor : '#e2e8f0',
            backgroundColor: dragOver ? hexToRgba(primaryColor, 0.05) : 'transparent',
          }}
        >
          <UploadCloud className="w-7 h-7" style={{ color: dragOver ? primaryColor : '#94a3b8' }} />
          <span className="text-sm text-slate-600 font-medium">Click or drag a file to upload</span>
          <span className="text-xs text-slate-400">
            {allowedFileTypes && allowedFileTypes.length > 0 ? allowedFileTypes.join(', ') + ' · ' : ''}
            {maxFileSize ? `Up to ${maxFileSize}MB` : 'No file selected'}
          </span>
        </button>
      )}
      {localError && (
        <p className="text-xs text-red-500 mt-2 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> {localError}
        </p>
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
    <div className="flex flex-wrap items-center gap-2">
      {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="w-11 h-11 rounded-xl border text-sm font-semibold transition-all hover:-translate-y-0.5"
          style={{
            borderColor: current === n ? primaryColor : '#e2e8f0',
            backgroundColor: current === n ? primaryColor : 'white',
            color: current === n ? 'white' : '#475569',
            boxShadow: current === n ? `0 4px 12px -4px ${hexToRgba(primaryColor, 0.5)}` : 'none',
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
          className="text-3xl p-2.5 rounded-xl border transition-all hover:scale-110"
          style={{
            borderColor: current === i + 1 ? primaryColor : '#e2e8f0',
            backgroundColor: current === i + 1 ? hexToRgba(primaryColor, 0.08) : 'white',
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
        <OptionButton key={i} selected={value === label} onClick={() => onChange(label)} primaryColor={primaryColor}>
          {translation[`scale_${i}`] || label}
        </OptionButton>
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
      className="input !rounded-xl max-w-xs"
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
            className="rounded-xl border-2 overflow-hidden transition-all hover:-translate-y-0.5"
            style={{
              borderColor: selected ? primaryColor : '#e2e8f0',
              boxShadow: selected ? `0 0 0 1px ${primaryColor}, 0 8px 20px -6px ${hexToRgba(primaryColor, 0.4)}` : 'none',
            }}
          >
            <div className="aspect-video bg-slate-100 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-slate-300" />
            </div>
            <p className={`text-xs py-2.5 text-center font-medium ${selected ? 'text-slate-900' : 'text-slate-600'}`}>{label}</p>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Signature ---------- */

function SignatureInput({
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
  const format = (question as any).signatureFormat === 'type' ? 'type' : 'draw';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStroke = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || format !== 'draw') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Restore a previously captured signature if present.
    if (typeof value === 'string' && value.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = value;
    }
  }, [format]); // eslint-disable-line react-hooks/exhaustive-deps

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawing.current = true;
    hasStroke.current = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.25;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function endDraw() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasStroke.current) {
      onChange(canvas.toDataURL('image/png'));
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStroke.current = false;
    onChange(undefined);
  }

  if (format === 'type') {
    return (
      <div>
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your full name"
          className="input !rounded-xl italic"
          style={{ fontFamily: "'Georgia', serif", fontSize: '1.15rem' }}
        />
        <p className="text-xs text-slate-400 mt-1.5">This will be recorded as your signature.</p>
      </div>
    );
  }

  return (
    <div>
      <div
        className="rounded-xl border-2 border-dashed overflow-hidden relative bg-white"
        style={{ borderColor: hexToRgba(primaryColor, 0.3) }}
      >
        <canvas
          ref={canvasRef}
          width={520}
          height={160}
          className="w-full h-40 touch-none cursor-crosshair"
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
        />
        {!value && !hasStroke.current && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <PenTool className="w-5 h-5 mb-1.5" style={{ color: hexToRgba(primaryColor, 0.6) }} />
            <p className="text-xs text-slate-400 font-medium">Sign here</p>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-500 transition"
      >
        <RotateCcw className="w-3.5 h-3.5" /> Clear signature
      </button>
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
      <input type="text" placeholder="Street Address" className="input !rounded-xl" value={v.street || ''} onChange={(e) => onChange({ ...v, street: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <input type="text" placeholder="City" className="input !rounded-xl" value={v.city || ''} onChange={(e) => onChange({ ...v, city: e.target.value })} />
        <input type="text" placeholder="State / Province" className="input !rounded-xl" value={v.state || ''} onChange={(e) => onChange({ ...v, state: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input type="text" placeholder="ZIP / Postal Code" className="input !rounded-xl" value={v.zip || ''} onChange={(e) => onChange({ ...v, zip: e.target.value })} />
        <input type="text" placeholder="Country" className="input !rounded-xl" value={v.country || ''} onChange={(e) => onChange({ ...v, country: e.target.value })} />
      </div>
    </div>
  );
}

/* ---------- Location ---------- */

function LocationInput({
  question: _question,
  value,
  onChange,
  primaryColor,
}: {
  question: Question;
  value: any;
  onChange: (v: any) => void;
  primaryColor: string;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const captured = value && typeof value === 'object' ? (value as { lat: number; lng: number; accuracy?: number }) : null;

  function capture() {
    if (!('geolocation' in navigator)) {
      setStatus('error');
      setErrorMsg('Location is not supported on this device.');
      return;
    }
    setStatus('loading');
    setErrorMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus('idle');
        onChange({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        setStatus('error');
        setErrorMsg(err.code === err.PERMISSION_DENIED ? 'Location access was denied.' : 'Could not determine your location.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  if (captured) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3.5 rounded-xl border"
        style={{ borderColor: hexToRgba(primaryColor, 0.3), backgroundColor: hexToRgba(primaryColor, 0.05) }}
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: hexToRgba(primaryColor, 0.15) }}>
          <MapPin className="w-4.5 h-4.5" style={{ color: primaryColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-800 font-medium">Location captured</p>
          <p className="text-xs text-slate-400">
            {captured.lat.toFixed(5)}, {captured.lng.toFixed(5)}
            {captured.accuracy ? ` · ±${Math.round(captured.accuracy)}m` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={capture}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition"
          title="Update location"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={capture}
        disabled={status === 'loading'}
        className="w-full flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition disabled:opacity-60"
      >
        {status === 'loading' ? (
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        ) : (
          <LocateFixed className="w-6 h-6" style={{ color: primaryColor }} />
        )}
        <span className="text-sm text-slate-600 font-medium">
          {status === 'loading' ? 'Getting your location…' : 'Share your current location'}
        </span>
        <span className="text-xs text-slate-400">Your browser will ask for permission</span>
      </button>
      {status === 'error' && errorMsg && (
        <p className="text-xs text-red-500 mt-2 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> {errorMsg}
        </p>
      )}
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
      <input type="text" placeholder="Full Name" className="input !rounded-xl" value={v.name || ''} onChange={(e) => onChange({ ...v, name: e.target.value })} />
      <input type="email" placeholder="Email Address" className="input !rounded-xl" value={v.email || ''} onChange={(e) => onChange({ ...v, email: e.target.value })} />
      <input type="tel" placeholder="Phone Number" className="input !rounded-xl" value={v.phone || ''} onChange={(e) => onChange({ ...v, phone: e.target.value })} />
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
    <div className="space-y-5">
      {question.options?.map((pair, pIdx) => {
        const nextPair = question.options?.[(pIdx + 1) % (question.options?.length || 1)];
        return (
          <div key={pair.id}>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1.5">
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