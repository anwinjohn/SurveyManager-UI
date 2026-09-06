import { useEffect, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  MousePointerClick,
  Plus,
  Trash2,
  GripVertical,
  Copy,
  Settings2,
  Palette,
  GitBranch,
  History,
  Languages,
  Target,
  ChevronDown,
  ChevronRight,
  Type,
  CheckSquare,
  ListChecks,
  ChevronDownSquare,
  Star,
  Gauge,
  Grid3x3,
  FileText,
  AlignLeft,
  Calendar,
  Clock,
  Upload,
  ArrowUpDown,
  Save,
  Eye,
  Send,
  X,
  ListOrdered,
  Check,
  Loader2,
  AlertCircle,
  ArrowLeft,
  PartyPopper,
  Globe,
  MessageSquare,
  ExternalLink,
  Hash,
  AtSign,
  Phone,
  Link2,
  CalendarClock,
  ToggleLeft,
  ThumbsUp,
  Smile,
  Image,
  PenTool,
  MapPin,
  Contact,
  Heart,
  Activity,
  Hand,
  Columns3,
  Repeat,
  Search,
  Info,
  Asterisk,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/services/api';
import type {
  Survey,
  Question,
  QuestionType,
  SurveyPage,
  SurveySection,
  Branding,
  Quota,
  SkipRule,
  LogicOperator,
  LogicCondition,
  LogicConditionGroup,
  DisplayRule,
  BranchRule,
  CompletionMessage,
} from '@/types';
import {
  LOGIC_OPERATORS,
  getOperatorLabel,
  operatorNeedsValue,
  isNumericOperator,
  evaluateSkipRules,
  shouldDisplayQuestion,
  getVisibleQuestions,
  evaluateConditionGroup,
} from '@/utils/logic';
import { Spinner, Modal, Toggle, ProgressBar } from '@/components/ui';
import type { Page } from '@/components/Sidebar';

const questionTypeMeta: Record<
  QuestionType,
  { label: string; icon: typeof Type; group: string }
> = {
  text: { label: 'Single-line Text', icon: Type, group: 'Basic' },
  'long-text': { label: 'Multi-line Text', icon: AlignLeft, group: 'Basic' },
  number: { label: 'Number', icon: Hash, group: 'Basic' },
  decimal: { label: 'Decimal', icon: Hash, group: 'Basic' },
  email: { label: 'Email', icon: AtSign, group: 'Basic' },
  phone: { label: 'Phone', icon: Phone, group: 'Basic' },
  url: { label: 'URL', icon: Link2, group: 'Basic' },
  date: { label: 'Date', icon: Calendar, group: 'Basic' },
  datetime: { label: 'Date/Time', icon: CalendarClock, group: 'Basic' },
  time: { label: 'Time', icon: Clock, group: 'Basic' },
  'single-choice': {
    label: 'Single Choice',
    icon: CheckSquare,
    group: 'Choice',
  },
  'multiple-choice': {
    label: 'Multiple Choice',
    icon: ListChecks,
    group: 'Choice',
  },
  dropdown: { label: 'Dropdown', icon: ChevronDownSquare, group: 'Choice' },
  'multi-select-dropdown': {
    label: 'Multi-select Dropdown',
    icon: ChevronDownSquare,
    group: 'Choice',
  },
  'yes-no': { label: 'Yes/No', icon: ToggleLeft, group: 'Choice' },
  'true-false': { label: 'True/False', icon: CheckSquare, group: 'Choice' },
  rating: { label: 'Star Rating', icon: Star, group: 'Rating' },
  'numeric-rating': {
    label: 'Numeric Rating',
    icon: ArrowUpDown,
    group: 'Rating',
  },
  'emoji-rating': { label: 'Emoji Rating', icon: Smile, group: 'Rating' },
  slider: { label: 'Slider', icon: ArrowUpDown, group: 'Rating' },
  'likert-scale': { label: 'Likert Scale', icon: ThumbsUp, group: 'Rating' },
  nps: { label: 'NPS', icon: Gauge, group: 'Rating' },
  matrix: { label: 'Matrix', icon: Grid3x3, group: 'Advanced' },
  'matrix-rating': {
    label: 'Matrix Rating',
    icon: Columns3,
    group: 'Advanced',
  },
  ranking: { label: 'Ranking', icon: ListOrdered, group: 'Advanced' },
  'drag-ranking': {
    label: 'Drag & Drop Ranking',
    icon: ListOrdered,
    group: 'Advanced',
  },
  'image-selection': {
    label: 'Image Selection',
    icon: Image,
    group: 'Advanced',
  },
  'file-upload': { label: 'File Upload', icon: Upload, group: 'Advanced' },
  signature: { label: 'Signature', icon: PenTool, group: 'Advanced' },
  address: { label: 'Address', icon: MapPin, group: 'Advanced' },
  location: { label: 'Location', icon: MapPin, group: 'Advanced' },
  'contact-info': {
    label: 'Contact Information',
    icon: Contact,
    group: 'Advanced',
  },
  'customer-satisfaction': {
    label: 'Customer Satisfaction (CSAT)',
    icon: Heart,
    group: 'Specialized',
  },
  'customer-effort': {
    label: 'Customer Effort Score (CES)',
    icon: Activity,
    group: 'Specialized',
  },
  'semantic-differential': {
    label: 'Semantic Differential',
    icon: Hand,
    group: 'Specialized',
  },
};

const questionGroups = ['Basic', 'Choice', 'Rating', 'Advanced', 'Specialized'];

const skipOperators = LOGIC_OPERATORS;

// Question types whose stored answer is a complex/structured value (an object, file,
// or drawing) that can't be rendered as a short piece of text inside another
// question's title. These are excluded as sources for answer piping.
const NON_PIPEABLE_TYPES: QuestionType[] = [
  'matrix',
  'matrix-rating',
  'file-upload',
  'location',
  'address',
  'contact-info',
  'semantic-differential',
  'signature',
];

let qIdCounter = 100;
function newQuestion(type: QuestionType): Question {
  const id = `q_${qIdCounter++}`;
  const base: Question = { id, type, title: 'New Question', required: false };
  const optionTypes = [
    'single-choice',
    'multiple-choice',
    'dropdown',
    'multi-select-dropdown',
    'ranking',
    'drag-ranking',
    'image-selection',
  ];
  if (optionTypes.includes(type)) {
    base.options = [
      { id: `o_${qIdCounter++}`, label: 'Option 1' },
      { id: `o_${qIdCounter++}`, label: 'Option 2' },
    ];
  }
  if (type === 'matrix' || type === 'matrix-rating') {
    base.rows = ['Row 1', 'Row 2'];
    base.columns =
      type === 'matrix-rating'
        ? ['1', '2', '3', '4', '5']
        : ['Poor', 'Fair', 'Good', 'Excellent'];
  }
  if (type === 'rating' || type === 'slider' || type === 'numeric-rating') {
    base.min = 1;
    base.max = 5;
    base.step = 1;
  }
  if (
    type === 'nps' ||
    type === 'customer-satisfaction' ||
    type === 'customer-effort'
  ) {
    base.min = 0;
    base.max = 10;
  }
  if (
    type === 'text' ||
    type === 'email' ||
    type === 'phone' ||
    type === 'url' ||
    type === 'number' ||
    type === 'decimal'
  ) {
    base.validation =
      type === 'text' ? 'none' : (type as Question['validation']);
  }
  if (type === 'emoji-rating') {
    base.emojiSet = ['😕', '😐', '🙂', '😀', '😄'];
  }
  if (type === 'likert-scale') {
    base.scaleLabels = [
      'Strongly Disagree',
      'Disagree',
      'Neutral',
      'Agree',
      'Strongly Agree',
    ];
  }
  if (type === 'semantic-differential') {
    base.scaleLabels = ['Low', 'High'];
    base.options = [
      { id: `o_${qIdCounter++}`, label: 'Cheap' },
      { id: `o_${qIdCounter++}`, label: 'Expensive' },
    ];
  }
  if (type === 'address' || type === 'contact-info') {
    base.fields =
      type === 'address'
        ? ['street', 'city', 'state', 'zip', 'country']
        : ['name', 'email', 'phone'];
  }
  if (type === 'signature') {
    base.signatureFormat = 'draw';
  }
  if (type === 'file-upload') {
    base.maxFileSize = 10;
    base.allowedFileTypes = ['image/*', 'application/pdf'];
  }
  if (type === 'location') {
    base.locationType = 'coordinates';
  }
  if (type === 'yes-no' || type === 'true-false') {
    base.options = [
      { id: `o_${qIdCounter++}`, label: type === 'yes-no' ? 'Yes' : 'True' },
      { id: `o_${qIdCounter++}`, label: type === 'yes-no' ? 'No' : 'False' },
    ];
  }
  return base;
}

let pIdCounter = 10;
function newPage(): SurveyPage {
  return { id: `pg_${pIdCounter++}`, title: 'New Page', questions: [] };
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

type BuilderTab =
  | 'design'
  | 'logic'
  | 'branding'
  | 'quotas'
  | 'languages'
  | 'versions';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function BuilderPage({
  surveyId,
  onNavigate,
}: {
  surveyId?: string;
  onNavigate: (page: Page, params?: Record<string, string>) => void;
}) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<BuilderTab>('design');
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('');
  const [draggedType, setDraggedType] = useState<QuestionType | null>(null);
  const [draggedQuestionId, setDraggedQuestionId] = useState<string | null>(
    null
  );
  const [showPreview, setShowPreview] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [publishChangelog, setPublishChangelog] = useState('');
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (surveyId) {
      api.getSurvey(surveyId).then((s) => {
        if (s) {
          setSurvey(s);
          setSelectedPageId(s.pages[0]?.id || '');
        }
        setLoading(false);
      });
    } else {
      const fresh: Survey = {
        id: genId('srv'),
        title: 'Untitled Survey',
        description: '',
        status: 'draft',
        mode: 'generic',
        organization: 'Acme Retail',
        owner: 'Sarah Chen',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pages: [{ id: 'pg_1', title: 'Page 1', questions: [] }],
        sections: [],
        versions: [],
        branding: {
          logoUrl: null,
          primaryColor: '#0ea5e9',
          accentColor: '#0d9488',
          fontFamily: 'Inter',
          customCss: '',
          hidePulseBranding: false,
          customDomain: null,
        },
        quotas: [],
        languages: ['en'],
        defaultLanguage: 'en',
        completionMessage: {},
        responseCount: 0,
        completionRate: 0,
        avgTimeSec: 0,
      };
      setSurvey(fresh);
      setSelectedPageId('pg_1');
      setLoading(false);
    }
  }, [surveyId]);

  const updateSurvey = useCallback((updater: (s: Survey) => Survey) => {
    setSurvey((prev) =>
      prev ? updater({ ...prev, updatedAt: new Date().toISOString() }) : prev
    );
    setDirty(true);
    setSaveState('idle');
  }, []);

  const updatePage = useCallback(
    (pageId: string, updater: (p: SurveyPage) => SurveyPage) => {
      updateSurvey((s) => ({
        ...s,
        pages: s.pages.map((p) => (p.id === pageId ? updater({ ...p }) : p)),
      }));
    },
    [updateSurvey]
  );

  const updateQuestion = useCallback(
    (pageId: string, qId: string, updater: (q: Question) => Question) => {
      updatePage(pageId, (p) => ({
        ...p,
        questions: p.questions.map((q) =>
          q.id === qId ? updater({ ...q }) : q
        ),
      }));
    },
    [updatePage]
  );

  const addQuestionToPage = useCallback(
    (pageId: string, type: QuestionType) => {
      const q = newQuestion(type);
      updatePage(pageId, (p) => ({ ...p, questions: [...p.questions, q] }));
      setSelectedQuestionId(q.id);
    },
    [updatePage]
  );

  const deleteQuestion = useCallback(
    (pageId: string, qId: string) => {
      updatePage(pageId, (p) => ({
        ...p,
        questions: p.questions.filter((q) => q.id !== qId),
      }));
      setSelectedQuestionId('');
    },
    [updatePage]
  );

  const duplicateQuestion = useCallback(
    (pageId: string, q: Question) => {
      const copy = { ...q, id: genId('q'), title: `${q.title} (copy)` };
      updatePage(pageId, (p) => {
        const idx = p.questions.findIndex((x) => x.id === q.id);
        const next = [...p.questions];
        next.splice(idx + 1, 0, copy);
        return { ...p, questions: next };
      });
      setSelectedQuestionId(copy.id);
    },
    [updatePage]
  );

  const reorderQuestions = useCallback(
    (pageId: string, fromId: string, toId: string) => {
      updatePage(pageId, (p) => {
        const qs = [...p.questions];
        const fromIdx = qs.findIndex((q) => q.id === fromId);
        const toIdx = qs.findIndex((q) => q.id === toId);
        if (fromIdx === -1 || toIdx === -1) return p;
        const [moved] = qs.splice(fromIdx, 1);
        qs.splice(toIdx, 0, moved);
        return { ...p, questions: qs };
      });
    },
    [updatePage]
  );

  const addPage = useCallback(() => {
    const p = newPage();
    updateSurvey((s) => ({ ...s, pages: [...s.pages, p] }));
    setSelectedPageId(p.id);
  }, [updateSurvey]);

  const deletePage = useCallback(
    (pageId: string) => {
      setSurvey((prev) => {
        if (!prev || prev.pages.length <= 1) return prev;
        const next = {
          ...prev,
          pages: prev.pages.filter((p) => p.id !== pageId),
          updatedAt: new Date().toISOString(),
        };
        return next;
      });
      setDirty(true);
      setSelectedPageId((prev) => {
        const s = survey;
        if (s && prev === pageId)
          return s.pages.find((p) => p.id !== pageId)?.id || '';
        return prev;
      });
    },
    [survey]
  );

  const handleDropOnPage = useCallback(
    (pageId: string) => {
      if (draggedType) {
        addQuestionToPage(pageId, draggedType);
        setDraggedType(null);
      }
    },
    [draggedType, addQuestionToPage]
  );

  const handleQuestionDrop = useCallback(
    (pageId: string, targetQId: string) => {
      if (draggedQuestionId && draggedQuestionId !== targetQId) {
        reorderQuestions(pageId, draggedQuestionId, targetQId);
        setDraggedQuestionId(null);
      }
    },
    [draggedQuestionId, reorderQuestions]
  );

  async function handleSaveDraft() {
    if (!survey) return;
    setSaveState('saving');
    try {
      const saved = await api.saveSurvey(survey);
      setSurvey(saved);
      setSaveState('saved');
      setDirty(false);
      setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  }

  async function handlePublish() {
    if (!survey) return;
    setSaveState('saving');
    try {
      const saved = await api.saveSurvey(survey);
      const published = await api.publishSurvey(saved.id, publishChangelog);
      if (published) {
        setSurvey(published);
        setDirty(false);
        if (published.shortCode) {
          setPublishedUrl(`${window.location.origin}/s/${published.shortCode}`);
        }
      }
      setSaveState('saved');
      setPublishChangelog('');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  }

  async function handleRollback(version: number) {
    if (!survey) return;
    const updated = await api.rollbackVersion(survey.id, version);
    if (updated) {
      setSurvey(updated);
    }
  }

  if (loading || !survey) return <Spinner />;

  const selectedPage = survey.pages.find((p) => p.id === selectedPageId);
  const selectedQuestion = selectedPage?.questions.find(
    (q) => q.id === selectedQuestionId
  );

  const tabs: { id: BuilderTab; label: string; icon: typeof Settings2 }[] = [
    { id: 'design', label: 'Design', icon: MousePointerClick },
    { id: 'logic', label: 'Logic', icon: GitBranch },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'quotas', label: 'Quotas', icon: Target },
    { id: 'languages', label: 'Languages', icon: Languages },
    { id: 'versions', label: 'Versions', icon: History },
  ];

  return (
    <div className="flex flex-col h-screen">
      {/* Builder Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => onNavigate('surveys')}
            className="btn-ghost px-2"
            title="Back to surveys"
          >
            <X className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={survey.title}
            onChange={(e) =>
              updateSurvey((s) => ({ ...s, title: e.target.value }))
            }
            className="text-base font-semibold font-display text-slate-900 bg-transparent border-none rounded-md px-1.5 -mx-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:bg-slate-50 max-w-md transition"
          />
          <span className="badge-slate capitalize">{survey.status}</span>
          {dirty && (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Unsaved
              changes
            </span>
          )}
          {saveState === 'saved' && (
            <span className="text-xs text-green-600 font-medium flex items-center gap-1 animate-fade-in">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          {saveState === 'error' && (
            <span className="text-xs text-red-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Save failed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary"
            onClick={() => setShowPreview(true)}
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Preview</span>
          </button>
          {survey.status === 'active' && survey.shortCode && (
            <a
              href={`${window.location.origin}/s/${survey.shortCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Open Survey</span>
            </a>
          )}
          <button
            className="btn-secondary"
            onClick={handleSaveDraft}
            disabled={saveState === 'saving'}
          >
            {saveState === 'saving' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {saveState === 'saving' ? 'Saving...' : 'Save Draft'}
            </span>
          </button>
          <button className="btn-primary" onClick={() => setShowPublish(true)}>
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Publish</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-1 flex-shrink-0 overflow-x-auto scrollbar-thin">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                tab === t.id
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'design' && (
          <DesignTab
            survey={survey}
            selectedPageId={selectedPageId}
            selectedQuestionId={selectedQuestionId}
            onAddPage={addPage}
            onDeletePage={deletePage}
            onSelectPage={setSelectedPageId}
            onSelectQuestion={setSelectedQuestionId}
            onUpdatePage={updatePage}
            onUpdateQuestion={updateQuestion}
            onDeleteQuestion={deleteQuestion}
            onDuplicateQuestion={duplicateQuestion}
            onDropOnPage={handleDropOnPage}
            onQuestionDrop={handleQuestionDrop}
            onDraggedType={setDraggedType}
            onDraggedQuestionId={setDraggedQuestionId}
            onAddQuestionType={addQuestionToPage}
          />
        )}
        {tab === 'logic' && (
          <LogicTab survey={survey} onUpdateQuestion={updateQuestion} />
        )}
        {tab === 'branding' && (
          <BrandingTab
            branding={survey.branding}
            onChange={(b) => updateSurvey((s) => ({ ...s, branding: b }))}
          />
        )}
        {tab === 'quotas' && (
          <QuotasTab
            quotas={survey.quotas}
            onChange={(q) => updateSurvey((s) => ({ ...s, quotas: q }))}
          />
        )}
        {tab === 'languages' && (
          <LanguagesTab
            survey={survey}
            onChange={(langs, def) =>
              updateSurvey((s) => ({
                ...s,
                languages: langs,
                defaultLanguage: def,
              }))
            }
            onCompletionMessageChange={(cm) =>
              updateSurvey((s) => ({ ...s, completionMessage: cm }))
            }
          />
        )}
        {tab === 'versions' && (
          <VersionsTab survey={survey} onRollback={handleRollback} />
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <PreviewModal survey={survey} onClose={() => setShowPreview(false)} />
      )}

      {/* Publish Modal */}
      {showPublish && (
        <PublishModal
          survey={survey}
          changelog={publishChangelog}
          onChangelogChange={setPublishChangelog}
          onClose={() => {
            setShowPublish(false);
            setPublishedUrl(null);
          }}
          onPublish={handlePublish}
          saving={saveState === 'saving'}
          publishedUrl={publishedUrl}
        />
      )}
    </div>
  );
}

/* =================== Design Tab =================== */

function DesignTab({
  survey,
  selectedPageId,
  selectedQuestionId,
  onAddPage,
  onDeletePage,
  onSelectPage,
  onSelectQuestion,
  onUpdatePage,
  onUpdateQuestion,
  onDeleteQuestion,
  onDuplicateQuestion,
  onDropOnPage,
  onQuestionDrop,
  onDraggedType,
  onDraggedQuestionId,
  onAddQuestionType,
}: {
  survey: Survey;
  selectedPageId: string;
  selectedQuestionId: string;
  onAddPage: () => void;
  onDeletePage: (id: string) => void;
  onSelectPage: (id: string) => void;
  onSelectQuestion: (id: string) => void;
  onUpdatePage: (id: string, updater: (p: SurveyPage) => SurveyPage) => void;
  onUpdateQuestion: (
    pid: string,
    qid: string,
    updater: (q: Question) => Question
  ) => void;
  onDeleteQuestion: (pid: string, qid: string) => void;
  onDuplicateQuestion: (pid: string, q: Question) => void;
  onDropOnPage: (pageId: string) => void;
  onQuestionDrop: (pageId: string, qId: string) => void;
  onDraggedType: (t: QuestionType | null) => void;
  onDraggedQuestionId: (id: string | null) => void;
  onAddQuestionType: (pageId: string, type: QuestionType) => void;
}) {
  const selectedPage = survey.pages.find((p) => p.id === selectedPageId);
  const selectedQuestion = selectedPage?.questions.find(
    (q) => q.id === selectedQuestionId
  );
  const [librarySearch, setLibrarySearch] = useState('');
  const searchTerm = librarySearch.trim().toLowerCase();

  return (
    <div className="flex h-full">
      {/* Question Library */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-100 flex-shrink-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Question Library
          </p>
          <div className="relative mt-2.5">
            <Search className="w-3.5 h-3.5 text-slate-300 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              placeholder="Search question types"
              className="input pl-8 text-xs py-1.5"
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Drag onto the canvas, or click to add to the current page
          </p>
        </div>
        <div className="p-3 space-y-4 overflow-y-auto scrollbar-thin flex-1">
          {questionGroups.map((group) => {
            const items = Object.entries(questionTypeMeta).filter(
              ([, meta]) =>
                meta.group === group &&
                (!searchTerm || meta.label.toLowerCase().includes(searchTerm))
            );
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                  {group}
                </p>
                <div className="space-y-1">
                  {items.map(([type, meta]) => {
                    const Icon = meta.icon;
                    return (
                      <button
                        type="button"
                        key={type}
                        draggable
                        onDragStart={() => onDraggedType(type as QuestionType)}
                        onDragEnd={() => onDraggedType(null)}
                        onClick={() =>
                          selectedPage &&
                          onAddQuestionType(
                            selectedPage.id,
                            type as QuestionType
                          )
                        }
                        title={
                          selectedPage
                            ? `Add to ${selectedPage.title}`
                            : 'Select a page first'
                        }
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-slate-600 hover:bg-sky-50/70 hover:text-slate-800 cursor-grab active:cursor-grabbing transition border border-transparent hover:border-sky-100 text-left"
                      >
                        <span className="w-6 h-6 rounded-md bg-slate-50 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-3.5 h-3.5 text-slate-400" />
                        </span>
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {searchTerm &&
            questionGroups.every(
              (group) =>
                Object.entries(questionTypeMeta).filter(
                  ([, meta]) =>
                    meta.group === group &&
                    meta.label.toLowerCase().includes(searchTerm)
                ).length === 0
            ) && (
              <p className="text-xs text-slate-400 text-center py-6">
                No question types match "{librarySearch}"
              </p>
            )}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-y-auto scrollbar-thin bg-slate-50">
        <div className="max-w-2xl mx-auto p-6">
          {/* Pages bar */}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-thin pb-1">
            {survey.pages.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => onSelectPage(p.id)}
                className={`flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                  selectedPageId === p.id
                    ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/20'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold ${selectedPageId === p.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}
                >
                  {idx + 1}
                </span>
                {p.title}
                <span
                  className={`text-[11px] ${selectedPageId === p.id ? 'text-white/70' : 'text-slate-400'}`}
                >
                  {p.questions.length}
                </span>
              </button>
            ))}
            <button
              onClick={onAddPage}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 border border-dashed border-slate-300 hover:border-sky-400 hover:text-sky-600 transition whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Add Page
            </button>
          </div>

          {/* Page content */}
          {selectedPage && (
            <div
              className="card p-6 min-h-[400px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDropOnPage(selectedPage.id)}
            >
              <div className="flex items-center justify-between mb-4">
                <input
                  type="text"
                  value={selectedPage.title}
                  onChange={(e) =>
                    onUpdatePage(selectedPage.id, (p) => ({
                      ...p,
                      title: e.target.value,
                    }))
                  }
                  className="text-lg font-semibold font-display text-slate-900 bg-transparent border-none focus:outline-none focus:ring-0 w-full"
                />
                {survey.pages.length > 1 && (
                  <button
                    onClick={() => onDeletePage(selectedPage.id)}
                    className="text-slate-300 hover:text-red-500 transition p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {selectedPage.questions.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                    <MousePointerClick className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">
                      Drag a question type here to get started
                    </p>
                  </div>
                )}
                {selectedPage.questions.map((q, idx) => {
                  const meta = questionTypeMeta[q.type];
                  const Icon = meta.icon;
                  const isSelected = selectedQuestionId === q.id;
                  return (
                    <div
                      key={q.id}
                      draggable
                      onDragStart={() => onDraggedQuestionId(q.id)}
                      onDragEnd={() => onDraggedQuestionId(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.stopPropagation();
                        onQuestionDrop(selectedPage.id, q.id);
                      }}
                      onClick={() => onSelectQuestion(q.id)}
                      className={`group relative flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-sky-400 bg-sky-50/50 ring-2 ring-sky-500/10'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-2 pt-0.5">
                        <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-400 cursor-grab transition" />
                        <span className="text-xs font-semibold text-slate-400 w-5">
                          {idx + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="flex items-center gap-1 text-slate-400">
                            <Icon className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider">
                              {meta.label}
                            </span>
                          </span>
                          {q.required && (
                            <span className="badge-red text-[9px] px-1.5 py-0">
                              Required
                            </span>
                          )}
                          {q.requiredRule && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-700 text-[9px] font-medium px-1.5 py-0">
                              <Asterisk className="w-2.5 h-2.5" /> Required
                              if...
                            </span>
                          )}
                          {q.skipRules && q.skipRules.length > 0 && (
                            <span className="badge-amber text-[9px] px-1.5 py-0">
                              <GitBranch className="w-2.5 h-2.5" />{' '}
                              {q.skipRules.length} skip rule
                              {q.skipRules.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {q.displayRule && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 text-sky-700 text-[9px] font-medium px-1.5 py-0">
                              <Eye className="w-2.5 h-2.5" /> Conditional
                            </span>
                          )}
                          {q.pipeFrom && (
                            <span className="badge-teal text-[9px] px-1.5 py-0">
                              <Repeat className="w-2.5 h-2.5" /> Piped
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-800">
                          {q.title}
                        </p>
                        {q.options && q.options.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {q.options.slice(0, 3).map((o) => (
                              <div
                                key={o.id}
                                className="flex items-center gap-2 text-xs text-slate-500"
                              >
                                <div className="w-3 h-3 rounded border border-slate-300" />
                                {o.label}
                              </div>
                            ))}
                            {q.options.length > 3 && (
                              <p className="text-xs text-slate-400">
                                +{q.options.length - 3} more
                              </p>
                            )}
                          </div>
                        )}
                        {q.rows && (
                          <p className="text-xs text-slate-400 mt-1">
                            {q.rows.length} rows × {q.columns?.length} columns
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateQuestion(selectedPage.id, q);
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteQuestion(selectedPage.id, q.id);
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Properties Panel */}
      <div className="w-96 bg-white border-l border-slate-200 flex flex-col flex-shrink-0">
        <div className="px-4 py-3 border-b border-slate-100 flex-shrink-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Properties
          </p>
        </div>
        <div className="overflow-y-auto scrollbar-thin flex-1">
          {selectedQuestion ? (
            <QuestionProperties
              question={selectedQuestion}
              survey={survey}
              onUpdate={(updater) =>
                onUpdateQuestion(selectedPageId, selectedQuestion.id, updater)
              }
            />
          ) : (
            <div className="p-6 text-center mt-6">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Settings2 className="w-5 h-5 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                No question selected
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Select a question on the canvas to edit its content, options and
                logic.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =================== Property Section (collapsible) =================== */

function PropertySection({
  title,
  icon: Icon,
  hint,
  badge,
  defaultOpen = true,
  tone = 'slate',
  children,
}: {
  title: string;
  icon: typeof Settings2;
  hint?: string;
  badge?: string;
  defaultOpen?: boolean;
  tone?: 'slate' | 'amber' | 'sky';
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toneText =
    tone === 'amber'
      ? 'text-amber-500'
      : tone === 'sky'
        ? 'text-sky-500'
        : 'text-slate-400';

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50/80 transition"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Icon className={`w-4 h-4 flex-shrink-0 ${toneText}`} />
          <span className="text-sm font-semibold text-slate-700 truncate">
            {title}
          </span>
          {badge && (
            <span className="badge-slate text-[10px] px-1.5 py-0 flex-shrink-0">
              {badge}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-slate-100">
          {hint && (
            <p className="text-xs text-slate-400 leading-relaxed">{hint}</p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

/* =================== Question Properties =================== */

function QuestionProperties({
  question,
  survey,
  onUpdate,
}: {
  question: Question;
  survey: Survey;
  onUpdate: (updater: (q: Question) => Question) => void;
}) {
  const meta = questionTypeMeta[question.type];
  const Icon = meta.icon;
  const allQuestions = survey.pages.flatMap((p) => p.questions);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);

  // ---- Answer piping -------------------------------------------------
  // Any question that produces a simple, displayable value (text, number,
  // a single choice label, a list of chosen labels, etc.) can be piped
  // into a later question's title. Structured/attachment-style answers
  // (matrices, files, signatures, addresses...) are excluded because they
  // don't reduce to a short readable string. We also only offer questions
  // that appear earlier in the survey, since a later question won't have
  // an answer yet when this one is shown.
  const currentIndex = allQuestions.findIndex((q) => q.id === question.id);
  const pipeableQuestions = allQuestions.filter(
    (q, idx) => idx < currentIndex && !NON_PIPEABLE_TYPES.includes(q.type)
  );
  const pipeSource = allQuestions.find((q) => q.id === question.pipeFrom);
  const titleHasPlaceholder = /\{piped\}/.test(question.title);

  function insertPipedPlaceholder() {
    const el = titleRef.current;
    const start = el?.selectionStart ?? question.title.length;
    const end = el?.selectionEnd ?? question.title.length;
    const nextTitle = `${question.title.slice(0, start)}{piped}${question.title.slice(end)}`;
    onUpdate((q) => ({ ...q, title: nextTitle }));
    requestAnimationFrame(() => {
      const node = titleRef.current;
      if (!node) return;
      const caret = start + '{piped}'.length;
      node.focus();
      node.setSelectionRange(caret, caret);
    });
  }

  const hasTypeConfig = Boolean(
    question.options ||
    question.rows ||
    question.type === 'rating' ||
    question.type === 'slider' ||
    question.type === 'nps' ||
    question.type === 'numeric-rating' ||
    question.type === 'customer-satisfaction' ||
    question.type === 'customer-effort' ||
    question.type === 'text' ||
    question.type === 'email' ||
    question.type === 'phone' ||
    question.type === 'url' ||
    question.type === 'number' ||
    question.type === 'decimal' ||
    (question.type === 'emoji-rating' && question.emojiSet) ||
    ((question.type === 'likert-scale' ||
      question.type === 'semantic-differential') &&
      question.scaleLabels) ||
    question.type === 'file-upload' ||
    question.type === 'signature'
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2.5 pb-1">
        <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-sky-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 leading-tight">
            {meta.label}
          </p>
          <p className="text-[11px] text-slate-400 leading-tight">
            Question properties
          </p>
        </div>
      </div>

      {/* Content */}
      <PropertySection title="Content" icon={Type} tone="slate">
        <div>
          <label className="label">Question Title</label>
          <textarea
            ref={titleRef}
            value={question.title}
            onChange={(e) => onUpdate((q) => ({ ...q, title: e.target.value }))}
            className="input resize-none"
            rows={2}
          />
          {question.pipeFrom && (
            <div className="mt-1.5">
              {titleHasPlaceholder ? (
                <p className="text-[11px] text-teal-600 flex items-start gap-1">
                  <Repeat className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>
                    Will show{' '}
                    <span className="font-medium">
                      {pipeSource?.title.slice(0, 30) || 'the source answer'}
                    </span>
                    's response wherever{' '}
                    <code className="px-1 py-0.5 rounded bg-teal-50 text-teal-700">
                      {'{piped}'}
                    </code>{' '}
                    appears above.
                  </span>
                </p>
              ) : (
                <p className="text-[11px] text-amber-600 flex items-start gap-1">
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>
                    A piping source is set, but the title doesn't include{' '}
                    <code className="px-1 py-0.5 rounded bg-amber-50 text-amber-700">
                      {'{piped}'}
                    </code>{' '}
                    yet — use the button in the Answer Piping section below to
                    insert it.
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="label">Description (optional)</label>
          <textarea
            value={question.description || ''}
            onChange={(e) =>
              onUpdate((q) => ({ ...q, description: e.target.value }))
            }
            className="input resize-none"
            rows={2}
            placeholder="Help text for respondents"
          />
        </div>

        <div className="pt-1">
          <label className="text-sm font-medium text-slate-700 block mb-1.5">
            Required
          </label>
          <div className="flex w-full rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(
              [
                { key: 'never', label: 'Never' },
                { key: 'always', label: 'Always' },
                { key: 'conditional', label: 'Conditionally' },
              ] as const
            ).map(({ key, label }) => {
              const isActive =
                key === 'always'
                  ? question.required
                  : key === 'conditional'
                    ? Boolean(question.requiredRule) && !question.required
                    : !question.required && !question.requiredRule;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === 'never') {
                      onUpdate((q) => ({
                        ...q,
                        required: false,
                        requiredRule: undefined,
                      }));
                    } else if (key === 'always') {
                      onUpdate((q) => ({
                        ...q,
                        required: true,
                        requiredRule: undefined,
                      }));
                    } else {
                      const sourceQuestions = allQuestions.filter(
                        (q) => q.id !== question.id
                      );
                      onUpdate((q) => ({
                        ...q,
                        required: false,
                        requiredRule: q.requiredRule || {
                          id: genId('rr'),
                          conditionGroup: {
                            id: genId('cg'),
                            connector: 'and',
                            conditions: [
                              {
                                id: genId('cond'),
                                sourceQuestionId:
                                  sourceQuestions[0]?.id || question.id,
                                operator: 'equals',
                                value: '',
                              },
                            ],
                          },
                        },
                      }));
                    }
                  }}
                  className={`flex-1 text-xs font-medium py-1.5 rounded-md transition ${
                    isActive
                      ? 'bg-white shadow-sm text-slate-800'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {question.requiredRule && (
            <div className="mt-2.5">
              <ConditionGroupEditor
                group={question.requiredRule.conditionGroup}
                survey={survey}
                currentQuestionId={question.id}
                label="Require IF"
                tone="rose"
                onChange={(g) =>
                  onUpdate((q) => ({
                    ...q,
                    requiredRule: {
                      id: q.requiredRule?.id || genId('rr'),
                      conditionGroup: g,
                    },
                  }))
                }
                onDelete={() =>
                  onUpdate((q) => ({
                    ...q,
                    required: false,
                    requiredRule: undefined,
                  }))
                }
              />
              <p className="text-[11px] text-slate-400 mt-1.5 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                Stays optional until the condition above is met — then this
                question becomes required before the respondent can continue.
              </p>
            </div>
          )}
        </div>
      </PropertySection>

      {/* Type-specific configuration */}
      {hasTypeConfig && (
        <PropertySection
          title="Answer Configuration"
          icon={Settings2}
          tone="slate"
        >
          {/* Options editor */}
          {question.options && (
            <div>
              <label className="label">Options</label>
              <div className="space-y-2">
                {question.options.map((o) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    <input
                      type="text"
                      value={o.label}
                      onChange={(e) =>
                        onUpdate((q) => ({
                          ...q,
                          options: q.options?.map((x) =>
                            x.id === o.id ? { ...x, label: e.target.value } : x
                          ),
                        }))
                      }
                      className="input flex-1"
                    />
                    <button
                      onClick={() =>
                        onUpdate((q) => ({
                          ...q,
                          options: q.options?.filter((x) => x.id !== o.id),
                        }))
                      }
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    onUpdate((q) => ({
                      ...q,
                      options: [
                        ...(q.options || []),
                        {
                          id: genId('o'),
                          label: `Option ${(q.options?.length || 0) + 1}`,
                        },
                      ],
                    }))
                  }
                  className="btn-secondary w-full text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Option
                </button>
              </div>
            </div>
          )}

          {/* Matrix rows/columns */}
          {question.rows && (
            <>
              <div>
                <label className="label">Matrix Rows</label>
                <div className="space-y-2">
                  {question.rows.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={r}
                        onChange={(e) =>
                          onUpdate((q) => ({
                            ...q,
                            rows: q.rows?.map((x, idx) =>
                              idx === i ? e.target.value : x
                            ),
                          }))
                        }
                        className="input flex-1"
                      />
                      <button
                        onClick={() =>
                          onUpdate((q) => ({
                            ...q,
                            rows: q.rows?.filter((_, idx) => idx !== i),
                          }))
                        }
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      onUpdate((q) => ({
                        ...q,
                        rows: [
                          ...(q.rows || []),
                          `Row ${(q.rows?.length || 0) + 1}`,
                        ],
                      }))
                    }
                    className="btn-secondary w-full text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Matrix Columns</label>
                <div className="space-y-2">
                  {question.columns?.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={c}
                        onChange={(e) =>
                          onUpdate((q) => ({
                            ...q,
                            columns: q.columns?.map((x, idx) =>
                              idx === i ? e.target.value : x
                            ),
                          }))
                        }
                        className="input flex-1"
                      />
                      <button
                        onClick={() =>
                          onUpdate((q) => ({
                            ...q,
                            columns: q.columns?.filter((_, idx) => idx !== i),
                          }))
                        }
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      onUpdate((q) => ({
                        ...q,
                        columns: [...(q.columns || []), 'New Column'],
                      }))
                    }
                    className="btn-secondary w-full text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Column
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Min/Max for scales */}
          {(question.type === 'rating' ||
            question.type === 'slider' ||
            question.type === 'nps' ||
            question.type === 'numeric-rating' ||
            question.type === 'customer-satisfaction' ||
            question.type === 'customer-effort') && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">Min</label>
                <input
                  type="number"
                  value={question.min ?? 0}
                  onChange={(e) =>
                    onUpdate((q) => ({ ...q, min: Number(e.target.value) }))
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label">Max</label>
                <input
                  type="number"
                  value={question.max ?? 10}
                  onChange={(e) =>
                    onUpdate((q) => ({ ...q, max: Number(e.target.value) }))
                  }
                  className="input"
                />
              </div>
              {question.type === 'slider' && (
                <div>
                  <label className="label">Step</label>
                  <input
                    type="number"
                    value={question.step ?? 1}
                    onChange={(e) =>
                      onUpdate((q) => ({ ...q, step: Number(e.target.value) }))
                    }
                    className="input"
                  />
                </div>
              )}
            </div>
          )}

          {/* Text validation */}
          {(question.type === 'text' ||
            question.type === 'email' ||
            question.type === 'phone' ||
            question.type === 'url' ||
            question.type === 'number' ||
            question.type === 'decimal') && (
            <div>
              <label className="label">Validation</label>
              <select
                value={question.validation || 'none'}
                onChange={(e) =>
                  onUpdate((q) => ({
                    ...q,
                    validation: e.target.value as Question['validation'],
                  }))
                }
                className="input"
              >
                <option value="none">None</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="url">URL</option>
                <option value="number">Number</option>
                <option value="decimal">Decimal</option>
              </select>
            </div>
          )}

          {/* Emoji set for emoji rating */}
          {question.type === 'emoji-rating' && question.emojiSet && (
            <div>
              <label className="label">Emoji Set</label>
              <div className="flex items-center gap-2">
                {question.emojiSet.map((emoji, i) => (
                  <input
                    key={i}
                    type="text"
                    value={emoji}
                    onChange={(e) =>
                      onUpdate((q) => ({
                        ...q,
                        emojiSet: q.emojiSet?.map((em, idx) =>
                          idx === i ? e.target.value : em
                        ),
                      }))
                    }
                    className="input w-12 text-center text-lg"
                    maxLength={2}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Scale labels for likert / semantic differential */}
          {(question.type === 'likert-scale' ||
            question.type === 'semantic-differential') &&
            question.scaleLabels && (
              <div>
                <label className="label">Scale Labels</label>
                <div className="space-y-2">
                  {question.scaleLabels.map((label, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={label}
                        onChange={(e) =>
                          onUpdate((q) => ({
                            ...q,
                            scaleLabels: q.scaleLabels?.map((sl, idx) =>
                              idx === i ? e.target.value : sl
                            ),
                          }))
                        }
                        className="input flex-1"
                      />
                      <button
                        onClick={() =>
                          onUpdate((q) => ({
                            ...q,
                            scaleLabels: q.scaleLabels?.filter(
                              (_, idx) => idx !== i
                            ),
                          }))
                        }
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      onUpdate((q) => ({
                        ...q,
                        scaleLabels: [...(q.scaleLabels || []), 'New Label'],
                      }))
                    }
                    className="btn-secondary w-full text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Label
                  </button>
                </div>
              </div>
            )}

          {/* File upload settings */}
          {question.type === 'file-upload' && (
            <>
              <div>
                <label className="label">Max File Size (MB)</label>
                <input
                  type="number"
                  value={question.maxFileSize ?? 10}
                  onChange={(e) =>
                    onUpdate((q) => ({
                      ...q,
                      maxFileSize: Number(e.target.value),
                    }))
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label">Allowed File Types</label>
                <input
                  type="text"
                  value={(question.allowedFileTypes || []).join(', ')}
                  onChange={(e) =>
                    onUpdate((q) => ({
                      ...q,
                      allowedFileTypes: e.target.value
                        .split(',')
                        .map((t) => t.trim()),
                    }))
                  }
                  className="input"
                  placeholder="image/*, application/pdf"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Comma-separated MIME types
                </p>
              </div>
            </>
          )}

          {/* Signature format */}
          {question.type === 'signature' && (
            <div>
              <label className="label">Signature Format</label>
              <select
                value={question.signatureFormat || 'draw'}
                onChange={(e) =>
                  onUpdate((q) => ({
                    ...q,
                    signatureFormat: e.target.value as 'draw' | 'type',
                  }))
                }
                className="input"
              >
                <option value="draw">Draw</option>
                <option value="type">Type</option>
              </select>
            </div>
          )}
        </PropertySection>
      )}

      {/* Answer Piping */}
      <PropertySection
        title="Answer Piping"
        icon={Repeat}
        tone="sky"
        badge={question.pipeFrom ? 'On' : undefined}
        hint="Reuse a respondent's earlier answer inside this question's title — great for personalizing follow-up questions."
      >
        <div>
          <label className="label">Pipe answer from</label>
          <select
            value={question.pipeFrom || ''}
            onChange={(e) =>
              onUpdate((q) => ({ ...q, pipeFrom: e.target.value || undefined }))
            }
            className="input"
          >
            <option value="">None</option>
            {pipeableQuestions.map((q) => (
              <option key={q.id} value={q.id}>
                {questionTypeMeta[q.type].label} — {q.title.slice(0, 40)}
              </option>
            ))}
          </select>
          {pipeableQuestions.length === 0 && (
            <p className="text-xs text-slate-400 mt-1.5 flex items-start gap-1">
              <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
              No eligible earlier questions yet. Add a question before this one
              (with a simple text, number or choice answer) to pipe from it.
            </p>
          )}
        </div>
        {question.pipeFrom && (
          <button
            type="button"
            onClick={insertPipedPlaceholder}
            className="btn-secondary w-full text-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Insert placeholder at cursor
          </button>
        )}
      </PropertySection>

      {/* Skip Logic */}
      <PropertySection
        title="Skip Logic"
        icon={GitBranch}
        tone="amber"
        badge={
          question.skipRules && question.skipRules.length > 0
            ? String(question.skipRules.length)
            : undefined
        }
        hint={`Sends respondents to a different page after they answer this question, based on ${question.type === 'text' || question.type === 'number' ? 'what' : 'how'} they (or an earlier question) responded.`}
      >
        {question.skipRules && question.skipRules.length > 0 ? (
          <div className="space-y-2">
            {question.skipRules.map((rule) => (
              <SkipRuleEditor
                key={rule.id}
                rule={rule}
                survey={survey}
                currentQuestionId={question.id}
                onChange={(updated) =>
                  onUpdate((q) => ({
                    ...q,
                    skipRules: q.skipRules?.map((r) =>
                      r.id === rule.id ? updated : r
                    ),
                  }))
                }
                onDelete={() =>
                  onUpdate((q) => ({
                    ...q,
                    skipRules: q.skipRules?.filter((r) => r.id !== rule.id),
                  }))
                }
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">No skip rules defined</p>
        )}
        <button
          onClick={() => {
            const newRule: SkipRule = {
              id: genId('s'),
              sourceQuestionId: question.id,
              operator: 'equals',
              value: '',
              targetPageId: survey.pages[0]?.id || '',
            };
            onUpdate((q) => ({
              ...q,
              skipRules: [...(q.skipRules || []), newRule],
            }));
          }}
          className="btn-secondary w-full text-xs"
        >
          <Plus className="w-3.5 h-3.5" /> Add Skip Rule
        </button>
      </PropertySection>

      {/* Display Logic */}
      <PropertySection
        title="Display Logic"
        icon={Eye}
        tone="sky"
        badge={question.displayRule ? 'On' : undefined}
        hint="Show this question only when conditions on earlier questions are met."
      >
        {question.displayRule ? (
          <ConditionGroupEditor
            group={question.displayRule.conditionGroup}
            survey={survey}
            currentQuestionId={question.id}
            onChange={(g) =>
              onUpdate((q) => ({
                ...q,
                displayRule: {
                  id: q.displayRule?.id || genId('dr'),
                  conditionGroup: g,
                },
              }))
            }
            onDelete={() => onUpdate((q) => ({ ...q, displayRule: undefined }))}
          />
        ) : (
          <button
            onClick={() => {
              const sourceQuestions = allQuestions.filter(
                (q) => q.id !== question.id
              );
              const newGroup: LogicConditionGroup = {
                id: genId('cg'),
                connector: 'and',
                conditions: [
                  {
                    id: genId('cond'),
                    sourceQuestionId: sourceQuestions[0]?.id || question.id,
                    operator: 'equals',
                    value: '',
                  },
                ],
              };
              onUpdate((q) => ({
                ...q,
                displayRule: { id: genId('dr'), conditionGroup: newGroup },
              }));
            }}
            className="btn-secondary w-full text-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Add Display Rule
          </button>
        )}
      </PropertySection>
    </div>
  );
}

/* =================== Condition Group Editor (AND/OR) =================== */

function ConditionGroupEditor({
  group,
  survey,
  currentQuestionId,
  onChange,
  onDelete,
  label = 'Show IF',
  tone = 'sky',
}: {
  group: LogicConditionGroup;
  survey: Survey;
  currentQuestionId: string;
  onChange: (group: LogicConditionGroup) => void;
  onDelete?: () => void;
  label?: string;
  tone?: 'sky' | 'rose';
}) {
  const wrapClass =
    tone === 'rose'
      ? 'p-3 rounded-lg bg-rose-50 border border-rose-100 space-y-2'
      : 'p-3 rounded-lg bg-sky-50 border border-sky-100 space-y-2';
  const labelClass =
    tone === 'rose'
      ? 'text-[10px] font-semibold text-rose-700 uppercase tracking-wider'
      : 'text-[10px] font-semibold text-sky-700 uppercase tracking-wider';
  const deleteClass =
    tone === 'rose'
      ? 'text-rose-400 hover:text-red-500'
      : 'text-sky-400 hover:text-red-500';
  const allQuestions = survey.pages.flatMap((p) => p.questions);

  function updateCondition(condId: string, patch: Partial<LogicCondition>) {
    onChange({
      ...group,
      conditions: group.conditions.map((c) =>
        c.id === condId ? { ...c, ...patch } : c
      ),
    });
  }

  function deleteCondition(condId: string) {
    if (group.conditions.length <= 1) {
      onDelete?.();
      return;
    }
    onChange({
      ...group,
      conditions: group.conditions.filter((c) => c.id !== condId),
    });
  }

  function addCondition() {
    const sourceQuestions = allQuestions.filter(
      (q) => q.id !== currentQuestionId
    );
    onChange({
      ...group,
      conditions: [
        ...group.conditions,
        {
          id: genId('cond'),
          sourceQuestionId: sourceQuestions[0]?.id || currentQuestionId,
          operator: 'equals',
          value: '',
        },
      ],
    });
  }

  return (
    <div className={wrapClass}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={labelClass}>{label}</span>
          <select
            value={group.connector}
            onChange={(e) =>
              onChange({ ...group, connector: e.target.value as 'and' | 'or' })
            }
            className="input text-[10px] py-0.5 px-1.5 w-16"
          >
            <option value="and">AND</option>
            <option value="or">OR</option>
          </select>
        </div>
        {onDelete && (
          <button onClick={onDelete} className={deleteClass}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {group.conditions.map((cond, idx) => {
        const sourceQ = allQuestions.find(
          (q) => q.id === cond.sourceQuestionId
        );
        const needsValue = operatorNeedsValue(cond.operator);
        const isNumeric = isNumericOperator(cond.operator);
        return (
          <div key={cond.id} className="space-y-1.5">
            {idx > 0 && (
              <div className="flex items-center justify-center">
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 text-[10px] font-semibold uppercase">
                  {group.connector}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <select
                value={cond.sourceQuestionId}
                onChange={(e) =>
                  updateCondition(cond.id, { sourceQuestionId: e.target.value })
                }
                className="input text-xs py-1 flex-1"
              >
                {allQuestions
                  .filter((q) => q.id !== currentQuestionId)
                  .map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title.slice(0, 40)}
                    </option>
                  ))}
              </select>
              <button
                onClick={() => deleteCondition(cond.id)}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-red-500 flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <select
                value={cond.operator}
                onChange={(e) =>
                  updateCondition(cond.id, {
                    operator: e.target.value as LogicOperator,
                  })
                }
                className="input text-xs py-1 flex-1"
              >
                {skipOperators.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              {needsValue &&
                (sourceQ?.options ? (
                  <select
                    value={cond.value}
                    onChange={(e) =>
                      updateCondition(cond.id, { value: e.target.value })
                    }
                    className="input text-xs py-1 flex-1"
                  >
                    <option value="">Select...</option>
                    {sourceQ.options.map((o) => (
                      <option key={o.id} value={o.label}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={isNumeric ? 'number' : 'text'}
                    value={cond.value}
                    onChange={(e) =>
                      updateCondition(cond.id, { value: e.target.value })
                    }
                    className="input text-xs py-1 flex-1"
                    placeholder="Value"
                  />
                ))}
            </div>
          </div>
        );
      })}

      <button onClick={addCondition} className="btn-secondary w-full text-xs">
        <Plus className="w-3 h-3" /> Add Condition
      </button>
    </div>
  );
}

function SkipRuleEditor({
  rule,
  survey,
  currentQuestionId,
  onChange,
  onDelete,
}: {
  rule: SkipRule;
  survey: Survey;
  currentQuestionId: string;
  onChange: (rule: SkipRule) => void;
  onDelete: () => void;
}) {
  const allQuestions = survey.pages.flatMap((p) => p.questions);
  // The source of a skip rule can be the current question itself (the most
  // common case: "if the answer to THIS question is X, jump to page Y") or
  // any question that has already been answered by the time this one is
  // reached. Questions that come later in the survey aren't offered, since
  // they won't have an answer yet.
  const currentIndex = allQuestions.findIndex(
    (q) => q.id === currentQuestionId
  );
  const sourceCandidates =
    currentIndex === -1
      ? allQuestions
      : allQuestions.filter((_, idx) => idx <= currentIndex);
  const sourceQuestion = allQuestions.find(
    (q) => q.id === rule.sourceQuestionId
  );
  const needsValue = operatorNeedsValue(rule.operator);
  const isNumeric = isNumericOperator(rule.operator);

  return (
    <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-100 space-y-2.5">
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">
          Skip Rule
        </span>
        <button
          onClick={onDelete}
          className="text-amber-400 hover:text-red-500 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        {/* Source question */}
        <div>
          <span className="text-[10px] font-medium text-amber-700/80">
            If the answer to
          </span>
          <select
            value={rule.sourceQuestionId}
            onChange={(e) =>
              onChange({ ...rule, sourceQuestionId: e.target.value })
            }
            className="input text-xs py-1.5 mt-0.5"
          >
            {sourceCandidates.map((q) => (
              <option key={q.id} value={q.id}>
                {q.id === currentQuestionId ? 'This question — ' : ''}
                {q.title.slice(0, 50)}
              </option>
            ))}
          </select>
        </div>

        {/* Operator + Value */}
        <div>
          <span className="text-[10px] font-medium text-amber-700/80">
            Matches
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <select
              value={rule.operator}
              onChange={(e) =>
                onChange({ ...rule, operator: e.target.value as LogicOperator })
              }
              className="input text-xs py-1.5 flex-1"
            >
              {skipOperators.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>

            {needsValue &&
              (sourceQuestion?.options ? (
                <select
                  value={rule.value}
                  onChange={(e) => onChange({ ...rule, value: e.target.value })}
                  className="input text-xs py-1.5 flex-1"
                >
                  <option value="">Select value...</option>
                  {sourceQuestion.options.map((o) => (
                    <option key={o.id} value={o.label}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={isNumeric ? 'number' : 'text'}
                  value={rule.value}
                  onChange={(e) => onChange({ ...rule, value: e.target.value })}
                  className="input text-xs py-1.5 flex-1"
                  placeholder="Value"
                />
              ))}
          </div>
        </div>

        {/* Target page */}
        <div>
          <span className="text-[10px] font-medium text-amber-700/80">
            Then skip to
          </span>
          <select
            value={rule.targetPageId}
            onChange={(e) =>
              onChange({ ...rule, targetPageId: e.target.value })
            }
            className="input text-xs py-1.5 mt-0.5"
          >
            {survey.pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

/* =================== Logic Tab =================== */

type LogicIssue = {
  id: string;
  questionId: string;
  kind:
    | 'skip-duplicate'
    | 'skip-conflict'
    | 'condition-duplicate'
    | 'condition-contradiction';
  message: string;
};

// Scans every question's skip rules, display-logic conditions and
// conditionally-required conditions for duplicate or contradictory setups
// that are almost always a mistake:
//  - two skip rules with the identical condition pointing at the same page
//    (harmless but redundant)
//  - two skip rules with the identical condition pointing at DIFFERENT pages
//    (ambiguous — only one can ever apply)
//  - a display/required condition group that repeats the exact same
//    condition more than once (redundant)
//  - an AND-connected group that requires one question to equal two
//    different values at the same time (impossible — can never be true)
function findLogicIssues(survey: Survey): LogicIssue[] {
  const issues: LogicIssue[] = [];
  const allQuestions = survey.pages.flatMap((p) => p.questions);

  const conditionKey = (
    sourceQuestionId: string,
    operator: string,
    value: string
  ) => `${sourceQuestionId}|${operator}|${value}`;

  for (const q of allQuestions) {
    // ---- Skip rules ----
    if (q.skipRules && q.skipRules.length > 1) {
      const grouped = new Map<string, SkipRule[]>();
      for (const rule of q.skipRules) {
        const key = conditionKey(
          rule.sourceQuestionId,
          rule.operator,
          rule.value
        );
        grouped.set(key, [...(grouped.get(key) || []), rule]);
      }
      for (const rules of grouped.values()) {
        if (rules.length < 2) continue;
        const sourceQ = allQuestions.find(
          (sq) => sq.id === rules[0].sourceQuestionId
        );
        const sourceLabel =
          rules[0].sourceQuestionId === q.id
            ? "this question's answer"
            : `"${sourceQ?.title.slice(0, 30) || 'a question'}"`;
        const opLabel = getOperatorLabel(rules[0].operator);
        const distinctTargets = new Set(rules.map((r) => r.targetPageId));
        if (distinctTargets.size === 1) {
          issues.push({
            id: genId('issue'),
            questionId: q.id,
            kind: 'skip-duplicate',
            message: `"${q.title.slice(0, 40)}" has ${rules.length} identical skip rules (${sourceLabel} ${opLabel} "${rules[0].value}") going to the same page — the extras can be removed.`,
          });
        } else {
          const targets = [...distinctTargets]
            .map(
              (tid) =>
                survey.pages.find((p) => p.id === tid)?.title || 'Unknown page'
            )
            .join(' vs. ');
          issues.push({
            id: genId('issue'),
            questionId: q.id,
            kind: 'skip-conflict',
            message: `"${q.title.slice(0, 40)}" has conflicting skip rules — ${sourceLabel} ${opLabel} "${rules[0].value}" points to different pages (${targets}). Only one can apply, so the extra rule is probably a mistake.`,
          });
        }
      }
    }

    // ---- Display logic & conditionally-required conditions ----
    const conditionGroups: { label: string; group: LogicConditionGroup }[] = [];
    if (q.displayRule)
      conditionGroups.push({
        label: 'Display Logic',
        group: q.displayRule.conditionGroup,
      });
    if (q.requiredRule)
      conditionGroups.push({
        label: 'Conditionally Required',
        group: q.requiredRule.conditionGroup,
      });

    for (const { label, group } of conditionGroups) {
      // Exact duplicate conditions within the same group
      const grouped = new Map<string, LogicCondition[]>();
      for (const cond of group.conditions) {
        grouped.set(
          conditionKey(cond.sourceQuestionId, cond.operator, cond.value),
          [
            ...(grouped.get(
              conditionKey(cond.sourceQuestionId, cond.operator, cond.value)
            ) || []),
            cond,
          ]
        );
      }
      for (const conds of grouped.values()) {
        if (conds.length > 1) {
          issues.push({
            id: genId('issue'),
            questionId: q.id,
            kind: 'condition-duplicate',
            message: `${label} on "${q.title.slice(0, 40)}" repeats the same condition ${conds.length} times — the duplicates can be removed.`,
          });
        }
      }

      // Impossible AND combinations: same source required to equal two different values at once
      if (group.connector === 'and') {
        const bySource = new Map<string, LogicCondition[]>();
        for (const cond of group.conditions) {
          if (cond.operator !== 'equals') continue;
          bySource.set(cond.sourceQuestionId, [
            ...(bySource.get(cond.sourceQuestionId) || []),
            cond,
          ]);
        }
        for (const [srcId, conds] of bySource) {
          const distinctValues = new Set(conds.map((c) => c.value));
          if (conds.length > 1 && distinctValues.size > 1) {
            const sourceQ = allQuestions.find((sq) => sq.id === srcId);
            issues.push({
              id: genId('issue'),
              questionId: q.id,
              kind: 'condition-contradiction',
              message: `${label} on "${q.title.slice(0, 40)}" requires "${sourceQ?.title.slice(0, 30) || 'a question'}" to equal ${[...distinctValues].map((v) => `"${v}"`).join(' and ')} at the same time — that can never be true, so this condition will never trigger.`,
            });
          }
        }
      }
    }
  }

  return issues;
}

function LogicTab({
  survey,
  onUpdateQuestion,
}: {
  survey: Survey;
  onUpdateQuestion: (
    pid: string,
    qid: string,
    updater: (q: Question) => Question
  ) => void;
}) {
  const allQuestions = survey.pages.flatMap((p) =>
    p.questions.map((q) => ({ ...q, pageTitle: p.title, pageId: p.id }))
  );
  const logicIssues = findLogicIssues(survey);

  return (
    <div className="overflow-y-auto scrollbar-thin h-full bg-slate-50">
      <div className="max-w-3xl mx-auto p-6">
        {logicIssues.length > 0 && (
          <div className="card p-6 mb-6 border-amber-200 bg-amber-50/50">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="section-title">Potential Logic Issues</h3>
              <span className="badge-amber text-[10px] px-1.5 py-0">
                {logicIssues.length}
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              These look like duplicate or contradictory rules — worth a second
              look before publishing.
            </p>
            <div className="space-y-2">
              {logicIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="flex items-start gap-2.5 p-3 rounded-lg bg-white border border-amber-100"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {issue.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="w-5 h-5 text-sky-500" />
            <h3 className="section-title">
              Conditional Branching & Skip Logic
            </h3>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Define rules that control how respondents navigate through your
            survey based on their answers. Rules are evaluated when the
            respondent clicks "Next".
          </p>

          {allQuestions.filter((q) => q.skipRules && q.skipRules.length > 0)
            .length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
              <GitBranch className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">
                No skip logic defined yet
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Select a question in the Design tab to add skip rules
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {allQuestions
                .filter((q) => q.skipRules && q.skipRules.length > 0)
                .map((q) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <p className="text-sm font-medium text-slate-700 mb-1">
                      {q.title}
                    </p>
                    <p className="text-xs text-slate-400 mb-3">
                      On page: {q.pageTitle}
                    </p>
                    <div className="space-y-2">
                      {q.skipRules!.map((rule) => {
                        const sourceQ = allQuestions.find(
                          (sq) => sq.id === rule.sourceQuestionId
                        );
                        const isSelfReferencing =
                          rule.sourceQuestionId === q.id;
                        const targetPage = survey.pages.find(
                          (p) => p.id === rule.targetPageId
                        );
                        const opLabel =
                          skipOperators.find((o) => o.value === rule.operator)
                            ?.label || rule.operator;
                        return (
                          <div
                            key={rule.id}
                            className="flex items-center gap-2 text-sm flex-wrap"
                          >
                            <div className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-medium">
                              IF
                            </div>
                            <span className="text-slate-600 font-medium">
                              {isSelfReferencing
                                ? 'this answer'
                                : sourceQ?.title?.slice(0, 30) || 'Unknown'}
                            </span>
                            <span className="text-slate-400 text-xs">
                              {opLabel}
                            </span>
                            <span className="text-slate-600 font-medium">
                              "{rule.value}"
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                            <div className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-700 text-xs font-medium">
                              GO TO
                            </div>
                            <span className="text-slate-600 font-medium">
                              {targetPage?.title || 'Unknown'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Repeat className="w-5 h-5 text-teal-500" />
            <h3 className="section-title">Answer Piping</h3>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Questions below reuse an earlier answer inside their title to
            personalize the question for each respondent.
          </p>
          {allQuestions.filter((q) => q.pipeFrom).length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
              <Repeat className="w-7 h-7 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No piped questions yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Open a question's Answer Piping section in the Design tab
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {allQuestions
                .filter((q) => q.pipeFrom)
                .map((q) => {
                  const sourceQ = allQuestions.find(
                    (sq) => sq.id === q.pipeFrom
                  );
                  return (
                    <div
                      key={q.id}
                      className="flex items-center gap-2 text-sm flex-wrap p-3 rounded-lg border border-slate-200 bg-slate-50"
                    >
                      <span className="text-slate-600 font-medium">
                        {sourceQ?.title?.slice(0, 30) || 'Unknown'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                      <div className="px-2.5 py-1 rounded-lg bg-teal-100 text-teal-700 text-xs font-medium">
                        PIPED INTO
                      </div>
                      <span className="text-slate-600 font-medium">
                        {q.title.slice(0, 40)}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Asterisk className="w-5 h-5 text-rose-500" />
            <h3 className="section-title">Conditionally Required</h3>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            These questions stay optional until a condition on an earlier answer
            is met, at which point respondents must answer before continuing.
          </p>
          {allQuestions.filter((q) => q.requiredRule).length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
              <Asterisk className="w-7 h-7 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">
                No conditionally required questions yet
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Set "Required" to "Conditionally" on a question in the Design
                tab
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {allQuestions
                .filter((q) => q.requiredRule)
                .map((q) => (
                  <div
                    key={q.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50"
                  >
                    <p className="text-sm font-medium text-slate-700 mb-1">
                      {q.title}
                    </p>
                    <div className="space-y-1.5">
                      {q.requiredRule!.conditionGroup.conditions.map(
                        (cond, i) => {
                          const sourceQ = allQuestions.find(
                            (sq) => sq.id === cond.sourceQuestionId
                          );
                          const opLabel =
                            skipOperators.find((o) => o.value === cond.operator)
                              ?.label || cond.operator;
                          return (
                            <div
                              key={cond.id}
                              className="flex items-center gap-2 text-xs flex-wrap"
                            >
                              {i > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500 font-semibold uppercase text-[9px]">
                                  {q.requiredRule!.conditionGroup.connector}
                                </span>
                              )}
                              <span className="text-slate-600 font-medium">
                                {sourceQ?.title?.slice(0, 30) || 'Unknown'}
                              </span>
                              <span className="text-slate-400">{opLabel}</span>
                              <span className="text-slate-600 font-medium">
                                "{cond.value}"
                              </span>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h3 className="section-title mb-4">Page Flow</h3>
          <div className="space-y-2">
            {survey.pages.map((p, idx) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 p-3 rounded-lg border border-slate-200">
                  <p className="text-sm font-medium text-slate-700">
                    {p.title}
                  </p>
                  <p className="text-xs text-slate-400">
                    {p.questions.length} questions
                  </p>
                </div>
                {idx < survey.pages.length - 1 && (
                  <div className="flex flex-col items-center text-slate-300">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =================== Branding Tab =================== */

function BrandingTab({
  branding,
  onChange,
}: {
  branding: Branding;
  onChange: (b: Branding) => void;
}) {
  const fonts = [
    'Inter',
    'Plus Jakarta Sans',
    'Georgia',
    'Courier New',
    'Arial',
    'Times New Roman',
  ];
  const colorPresets = [
    { primary: '#0ea5e9', accent: '#0d9488' },
    { primary: '#6366f1', accent: '#ec4899' },
    { primary: '#0d9488', accent: '#f59e0b' },
    { primary: '#dc2626', accent: '#0ea5e9' },
    { primary: '#7c3aed', accent: '#14b8a6' },
    { primary: '#1e293b', accent: '#64748b' },
  ];

  return (
    <div className="overflow-y-auto scrollbar-thin h-full bg-slate-50">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-sky-500" />
            <h3 className="section-title">Brand Customization</h3>
          </div>

          <div className="space-y-5">
            <div>
              <label className="label">Logo</label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400">
                  <Upload className="w-5 h-5" />
                </div>
                <button className="btn-secondary">Upload Logo</button>
              </div>
            </div>

            <div>
              <label className="label">Color Presets</label>
              <div className="flex items-center gap-2 flex-wrap">
                {colorPresets.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() =>
                      onChange({
                        ...branding,
                        primaryColor: preset.primary,
                        accentColor: preset.accent,
                      })
                    }
                    className={`w-12 h-12 rounded-xl border-2 transition ${
                      branding.primaryColor === preset.primary
                        ? 'border-slate-800'
                        : 'border-transparent'
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${preset.primary}, ${preset.accent})`,
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={branding.primaryColor}
                    onChange={(e) =>
                      onChange({ ...branding, primaryColor: e.target.value })
                    }
                    className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={branding.primaryColor}
                    onChange={(e) =>
                      onChange({ ...branding, primaryColor: e.target.value })
                    }
                    className="input flex-1"
                  />
                </div>
              </div>
              <div>
                <label className="label">Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={branding.accentColor}
                    onChange={(e) =>
                      onChange({ ...branding, accentColor: e.target.value })
                    }
                    className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={branding.accentColor}
                    onChange={(e) =>
                      onChange({ ...branding, accentColor: e.target.value })
                    }
                    className="input flex-1"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="label">Font Family</label>
              <select
                value={branding.fontFamily}
                onChange={(e) =>
                  onChange({ ...branding, fontFamily: e.target.value })
                }
                className="input"
              >
                {fonts.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Custom Domain (White-label)</label>
              <input
                type="text"
                value={branding.customDomain || ''}
                onChange={(e) =>
                  onChange({
                    ...branding,
                    customDomain: e.target.value || null,
                  })
                }
                className="input"
                placeholder="survey.yourcompany.com"
              />
            </div>

            <div>
              <label className="label">Custom CSS</label>
              <textarea
                value={branding.customCss}
                onChange={(e) =>
                  onChange({ ...branding, customCss: e.target.value })
                }
                className="input font-mono text-xs"
                rows={5}
                placeholder=".survey-container { border-radius: 16px; }"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Hide Pulse Branding
                </p>
                <p className="text-xs text-slate-400">
                  Remove "Powered by Pulse" from surveys
                </p>
              </div>
              <Toggle
                checked={branding.hidePulseBranding}
                onChange={(v) =>
                  onChange({ ...branding, hidePulseBranding: v })
                }
              />
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="card p-6">
          <h3 className="section-title mb-4">Live Preview</h3>
          <div
            className="rounded-2xl p-8 border"
            style={{
              borderColor: `${branding.primaryColor}30`,
              fontFamily: branding.fontFamily,
            }}
          >
            <div className="flex items-center gap-2 mb-6">
              <div
                className="w-8 h-8 rounded-lg"
                style={{ backgroundColor: branding.primaryColor }}
              />
              <span
                className="font-bold text-lg"
                style={{ color: branding.primaryColor }}
              >
                Your Brand
              </span>
            </div>
            <p className="text-lg font-semibold mb-4 text-slate-900">
              How likely are you to recommend us?
            </p>
            <div className="flex items-center gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  className="w-9 h-9 rounded-lg border text-sm font-medium transition hover:scale-110"
                  style={{
                    borderColor: `${branding.primaryColor}40`,
                    color:
                      n >= 9
                        ? branding.accentColor
                        : n <= 6
                          ? '#ef4444'
                          : '#64748b',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              className="mt-6 px-6 py-2.5 rounded-lg text-white font-medium text-sm"
              style={{ backgroundColor: branding.primaryColor }}
            >
              Submit
            </button>
            {!branding.hidePulseBranding && (
              <p className="text-xs text-slate-400 mt-4">Powered by Pulse</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =================== Quotas Tab =================== */

function QuotasTab({
  quotas,
  onChange,
}: {
  quotas: Quota[];
  onChange: (q: Quota[]) => void;
}) {
  return (
    <div className="overflow-y-auto scrollbar-thin h-full bg-slate-50">
      <div className="max-w-3xl mx-auto p-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-sky-500" />
              <h3 className="section-title">Quota Management</h3>
            </div>
            <button
              onClick={() =>
                onChange([
                  ...quotas,
                  {
                    id: genId('qt'),
                    name: 'New Quota',
                    target: 100,
                    filled: 0,
                    condition: 'attribute == "value"',
                  },
                ])
              }
              className="btn-primary text-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add Quota
            </button>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Control how many responses you collect from specific audience
            segments.
          </p>

          {quotas.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
              <Target className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No quotas defined</p>
            </div>
          ) : (
            <div className="space-y-4">
              {quotas.map((q) => (
                <div
                  key={q.id}
                  className="p-4 rounded-xl border border-slate-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <input
                      type="text"
                      value={q.name}
                      onChange={(e) =>
                        onChange(
                          quotas.map((x) =>
                            x.id === q.id ? { ...x, name: e.target.value } : x
                          )
                        )
                      }
                      className="text-sm font-medium text-slate-700 bg-transparent border-none focus:outline-none focus:ring-0 w-full"
                    />
                    <button
                      onClick={() =>
                        onChange(quotas.filter((x) => x.id !== q.id))
                      }
                      className="text-slate-400 hover:text-red-500 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="text"
                      value={q.condition}
                      onChange={(e) =>
                        onChange(
                          quotas.map((x) =>
                            x.id === q.id
                              ? { ...x, condition: e.target.value }
                              : x
                          )
                        )
                      }
                      className="input text-xs font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-slate-500">Target:</span>
                    <input
                      type="number"
                      value={q.target}
                      onChange={(e) =>
                        onChange(
                          quotas.map((x) =>
                            x.id === q.id
                              ? { ...x, target: Number(e.target.value) }
                              : x
                          )
                        )
                      }
                      className="input text-xs w-24"
                    />
                    <span className="text-xs text-slate-400">responses</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500">
                      {q.filled} / {q.target} responses
                    </span>
                    <span className="font-semibold text-slate-700">
                      {q.target > 0
                        ? Math.round((q.filled / q.target) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <ProgressBar value={q.filled} max={q.target} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =================== Languages Tab =================== */

const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

const AVAILABLE_LANGUAGES = [
  { code: 'en', label: 'English', flag: 'EN' },
  { code: 'es', label: 'Spanish', flag: 'ES' },
  { code: 'fr', label: 'French', flag: 'FR' },
  { code: 'de', label: 'German', flag: 'DE' },
  { code: 'it', label: 'Italian', flag: 'IT' },
  { code: 'pt', label: 'Portuguese', flag: 'PT' },
  { code: 'ar', label: 'Arabic (RTL)', flag: 'AR' },
  { code: 'he', label: 'Hebrew (RTL)', flag: 'HE' },
  { code: 'ja', label: 'Japanese', flag: 'JA' },
  { code: 'zh', label: 'Chinese', flag: 'ZH' },
  { code: 'hi', label: 'Hindi', flag: 'HI' },
  { code: 'ru', label: 'Russian', flag: 'RU' },
  { code: 'ko', label: 'Korean', flag: 'KO' },
  { code: 'nl', label: 'Dutch', flag: 'NL' },
];

function LanguagesTab({
  survey,
  onChange,
  onCompletionMessageChange,
}: {
  survey: Survey;
  onChange: (langs: string[], def: string) => void;
  onCompletionMessageChange: (cm: Record<string, CompletionMessage>) => void;
}) {
  const [activeLang, setActiveLang] = useState<string>(
    survey.defaultLanguage || 'en'
  );
  const [translations, setTranslations] = useState<
    Record<string, Record<string, any>>
  >({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (survey.id && !loaded) {
      api.getTranslations(survey.id).then((trs) => {
        const map: Record<string, Record<string, any>> = {};
        for (const t of trs) map[t.languageCode] = t.translations;
        setTranslations(map);
        setLoaded(true);
      });
    } else if (!survey.id) {
      setLoaded(true);
    }
  }, [survey.id, loaded]);

  const enabledLangs = survey.languages;
  const isRTL = RTL_LANGUAGES.includes(activeLang);

  function updateTranslationField(lang: string, key: string, value: string) {
    setTranslations((prev) => ({
      ...prev,
      [lang]: { ...(prev[lang] || {}), [key]: value },
    }));
  }

  function updateCompletionMessage(
    lang: string,
    field: keyof CompletionMessage,
    value: string
  ) {
    onCompletionMessageChange({
      ...survey.completionMessage,
      [lang]: {
        ...(survey.completionMessage[lang] || { title: '', body: '' }),
        [field]: value,
      } as CompletionMessage,
    });
  }

  async function saveTranslations() {
    if (!survey.id) return;
    for (const lang of enabledLangs) {
      if (lang === survey.defaultLanguage) continue;
      const tr = translations[lang];
      if (tr) {
        await api.saveTranslation(survey.id, lang, tr);
      }
    }
  }

  const activeTranslation = translations[activeLang] || {};

  return (
    <div className="overflow-y-auto scrollbar-thin h-full bg-slate-50">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Language Enable/Disable Card */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Languages className="w-5 h-5 text-sky-500" />
            <h3 className="section-title">Multi-Language Support</h3>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Enable languages for your survey. RTL languages (Arabic, Hebrew) are
            automatically rendered right-to-left for respondents.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {AVAILABLE_LANGUAGES.map((lang) => {
              const enabled = enabledLangs.includes(lang.code);
              const isDefault = survey.defaultLanguage === lang.code;
              const isRTLLang = RTL_LANGUAGES.includes(lang.code);
              return (
                <div
                  key={lang.code}
                  className={`p-4 rounded-xl border transition ${
                    enabled ? 'border-sky-300 bg-sky-50/50' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                        {lang.flag}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {lang.label}
                        </p>
                        {isRTLLang && (
                          <span className="text-[10px] text-teal-600 font-medium">
                            RTL
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {enabled && !isDefault && (
                        <button
                          onClick={() => onChange(enabledLangs, lang.code)}
                          className="text-[10px] font-medium px-2 py-1 rounded text-slate-500 hover:bg-slate-100 transition"
                        >
                          Set default
                        </button>
                      )}
                      <Toggle
                        checked={enabled}
                        onChange={(v) => {
                          if (v) {
                            onChange(
                              [...enabledLangs, lang.code],
                              survey.defaultLanguage
                            );
                          } else {
                            const next = enabledLangs.filter(
                              (l) => l !== lang.code
                            );
                            const def =
                              survey.defaultLanguage === lang.code
                                ? next[0] || 'en'
                                : survey.defaultLanguage;
                            onChange(next, def);
                            if (activeLang === lang.code) setActiveLang(def);
                          }
                        }}
                      />
                    </div>
                  </div>
                  {isDefault && (
                    <div className="mt-2">
                      <span className="badge-sky text-[10px]">
                        Default language
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Translation Content Editor */}
        {enabledLangs.length > 1 && (
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-5 h-5 text-teal-500" />
              <h3 className="section-title">Translation Editor</h3>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Enter translated content for each enabled language. The default
              language (
              {AVAILABLE_LANGUAGES.find(
                (l) => l.code === survey.defaultLanguage
              )?.label || 'English'}
              ) uses the content from the Design tab.
            </p>

            {/* Language tabs */}
            <div className="flex items-center gap-1.5 mb-5 overflow-x-auto scrollbar-thin pb-1">
              {enabledLangs
                .filter((l) => l !== survey.defaultLanguage)
                .map((lang) => {
                  const info = AVAILABLE_LANGUAGES.find((l) => l.code === lang);
                  const isActive = activeLang === lang;
                  return (
                    <button
                      key={lang}
                      onClick={() => setActiveLang(lang)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                        isActive
                          ? 'bg-sky-500 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-[10px] font-bold opacity-70">
                        {info?.flag || lang.toUpperCase()}
                      </span>
                      {info?.label || lang}
                      {RTL_LANGUAGES.includes(lang) && (
                        <span
                          className={`text-[9px] px-1 py-0.5 rounded ${isActive ? 'bg-white/20' : 'bg-teal-50 text-teal-600'}`}
                        >
                          RTL
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>

            {/* Translation fields for active language */}
            {activeLang !== survey.defaultLanguage && (
              <div className={`space-y-5 ${isRTL ? 'text-right' : ''}`}>
                {/* Survey title & description */}
                <div className="border-b border-slate-100 pb-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Survey Overview
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="label flex items-center gap-1.5">
                        Survey Title
                        <span className="text-[10px] text-slate-400 font-normal">
                          (default: {survey.title})
                        </span>
                      </label>
                      <input
                        type="text"
                        dir={isRTL ? 'rtl' : 'ltr'}
                        value={activeTranslation.title || ''}
                        onChange={(e) =>
                          updateTranslationField(
                            activeLang,
                            'title',
                            e.target.value
                          )
                        }
                        placeholder={survey.title}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Survey Description</label>
                      <textarea
                        dir={isRTL ? 'rtl' : 'ltr'}
                        value={activeTranslation.description || ''}
                        onChange={(e) =>
                          updateTranslationField(
                            activeLang,
                            'description',
                            e.target.value
                          )
                        }
                        placeholder={survey.description}
                        className="input"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                {/* Pages and questions */}
                {survey.pages.map((page, pIdx) => (
                  <div key={page.id} className="border-b border-slate-100 pb-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                      Page {pIdx + 1}: {page.title}
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="label">Page Title</label>
                        <input
                          type="text"
                          dir={isRTL ? 'rtl' : 'ltr'}
                          value={
                            activeTranslation[`page_${page.id}_title`] || ''
                          }
                          onChange={(e) =>
                            updateTranslationField(
                              activeLang,
                              `page_${page.id}_title`,
                              e.target.value
                            )
                          }
                          placeholder={page.title}
                          className="input"
                        />
                      </div>
                      {page.questions.map((q) => (
                        <div
                          key={q.id}
                          className="pl-3 border-l-2 border-slate-100"
                        >
                          <div>
                            <label className="label flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 font-mono">
                                {q.type}
                              </span>
                              Question: {q.title}
                            </label>
                            <input
                              type="text"
                              dir={isRTL ? 'rtl' : 'ltr'}
                              value={activeTranslation[`q_${q.id}_title`] || ''}
                              onChange={(e) =>
                                updateTranslationField(
                                  activeLang,
                                  `q_${q.id}_title`,
                                  e.target.value
                                )
                              }
                              placeholder={q.title}
                              className="input"
                            />
                          </div>
                          {q.description && (
                            <div className="mt-2">
                              <label className="label">Description</label>
                              <input
                                type="text"
                                dir={isRTL ? 'rtl' : 'ltr'}
                                value={
                                  activeTranslation[`q_${q.id}_desc`] || ''
                                }
                                onChange={(e) =>
                                  updateTranslationField(
                                    activeLang,
                                    `q_${q.id}_desc`,
                                    e.target.value
                                  )
                                }
                                placeholder={q.description}
                                className="input"
                              />
                            </div>
                          )}
                          {q.options && q.options.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              <label className="label">Answer Options</label>
                              {q.options.map((opt) => (
                                <input
                                  key={opt.id}
                                  type="text"
                                  dir={isRTL ? 'rtl' : 'ltr'}
                                  value={
                                    activeTranslation[`opt_${opt.id}`] || ''
                                  }
                                  onChange={(e) =>
                                    updateTranslationField(
                                      activeLang,
                                      `opt_${opt.id}`,
                                      e.target.value
                                    )
                                  }
                                  placeholder={opt.label}
                                  className="input text-sm py-1.5"
                                />
                              ))}
                            </div>
                          )}
                          {q.rows && q.rows.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              <label className="label">Matrix Rows</label>
                              {q.rows.map((row, rIdx) => (
                                <input
                                  key={rIdx}
                                  type="text"
                                  dir={isRTL ? 'rtl' : 'ltr'}
                                  value={
                                    activeTranslation[`row_${q.id}_${rIdx}`] ||
                                    ''
                                  }
                                  onChange={(e) =>
                                    updateTranslationField(
                                      activeLang,
                                      `row_${q.id}_${rIdx}`,
                                      e.target.value
                                    )
                                  }
                                  placeholder={row}
                                  className="input text-sm py-1.5"
                                />
                              ))}
                            </div>
                          )}
                          {q.columns && q.columns.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              <label className="label">Matrix Columns</label>
                              {q.columns.map((col, cIdx) => (
                                <input
                                  key={cIdx}
                                  type="text"
                                  dir={isRTL ? 'rtl' : 'ltr'}
                                  value={
                                    activeTranslation[`col_${q.id}_${cIdx}`] ||
                                    ''
                                  }
                                  onChange={(e) =>
                                    updateTranslationField(
                                      activeLang,
                                      `col_${q.id}_${cIdx}`,
                                      e.target.value
                                    )
                                  }
                                  placeholder={col}
                                  className="input text-sm py-1.5"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Button labels */}
                <div className="border-b border-slate-100 pb-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Button Labels
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Next Button</label>
                      <input
                        type="text"
                        dir={isRTL ? 'rtl' : 'ltr'}
                        value={activeTranslation.btn_next || ''}
                        onChange={(e) =>
                          updateTranslationField(
                            activeLang,
                            'btn_next',
                            e.target.value
                          )
                        }
                        placeholder="Next"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Back Button</label>
                      <input
                        type="text"
                        dir={isRTL ? 'rtl' : 'ltr'}
                        value={activeTranslation.btn_back || ''}
                        onChange={(e) =>
                          updateTranslationField(
                            activeLang,
                            'btn_back',
                            e.target.value
                          )
                        }
                        placeholder="Back"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Submit Button</label>
                      <input
                        type="text"
                        dir={isRTL ? 'rtl' : 'ltr'}
                        value={activeTranslation.btn_submit || ''}
                        onChange={(e) =>
                          updateTranslationField(
                            activeLang,
                            'btn_submit',
                            e.target.value
                          )
                        }
                        placeholder="Submit"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Start Button</label>
                      <input
                        type="text"
                        dir={isRTL ? 'rtl' : 'ltr'}
                        value={activeTranslation.btn_start || ''}
                        onChange={(e) =>
                          updateTranslationField(
                            activeLang,
                            'btn_start',
                            e.target.value
                          )
                        }
                        placeholder="Start Survey"
                        className="input"
                      />
                    </div>
                  </div>
                </div>

                {/* Completion message */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Completion Message
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="label">Thank-You Title</label>
                      <input
                        type="text"
                        dir={isRTL ? 'rtl' : 'ltr'}
                        value={
                          survey.completionMessage[activeLang]?.title || ''
                        }
                        onChange={(e) =>
                          updateCompletionMessage(
                            activeLang,
                            'title',
                            e.target.value
                          )
                        }
                        placeholder="Thank you!"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Thank-You Message</label>
                      <textarea
                        dir={isRTL ? 'rtl' : 'ltr'}
                        value={survey.completionMessage[activeLang]?.body || ''}
                        onChange={(e) =>
                          updateCompletionMessage(
                            activeLang,
                            'body',
                            e.target.value
                          )
                        }
                        placeholder="Your feedback is valuable to us."
                        className="input"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="label">Redirect URL (optional)</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={
                          survey.completionMessage[activeLang]?.redirectUrl ||
                          ''
                        }
                        onChange={(e) =>
                          updateCompletionMessage(
                            activeLang,
                            'redirectUrl',
                            e.target.value
                          )
                        }
                        placeholder="https://example.com/thank-you"
                        className="input"
                      />
                    </div>
                  </div>
                </div>

                {/* Save translations button */}
                <div className="pt-2">
                  <button onClick={saveTranslations} className="btn-primary">
                    <Save className="w-4 h-4" />
                    Save Translations
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Default language completion message */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-5 h-5 text-sky-500" />
            <h3 className="section-title">
              Completion Message —{' '}
              {AVAILABLE_LANGUAGES.find(
                (l) => l.code === survey.defaultLanguage
              )?.label || 'Default'}
            </h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Configure the thank-you message shown after respondents complete the
            survey in the default language.
          </p>
          <div className="space-y-3">
            <div>
              <label className="label">Thank-You Title</label>
              <input
                type="text"
                value={
                  survey.completionMessage[survey.defaultLanguage]?.title || ''
                }
                onChange={(e) =>
                  onCompletionMessageChange({
                    ...survey.completionMessage,
                    [survey.defaultLanguage]: {
                      ...(survey.completionMessage[survey.defaultLanguage] || {
                        title: '',
                        body: '',
                      }),
                      title: e.target.value,
                    } as CompletionMessage,
                  })
                }
                placeholder="Thank you!"
                className="input"
              />
            </div>
            <div>
              <label className="label">Thank-You Message</label>
              <textarea
                value={
                  survey.completionMessage[survey.defaultLanguage]?.body || ''
                }
                onChange={(e) =>
                  onCompletionMessageChange({
                    ...survey.completionMessage,
                    [survey.defaultLanguage]: {
                      ...(survey.completionMessage[survey.defaultLanguage] || {
                        title: '',
                        body: '',
                      }),
                      body: e.target.value,
                    } as CompletionMessage,
                  })
                }
                placeholder="Your feedback is valuable to us."
                className="input"
                rows={3}
              />
            </div>
            <div>
              <label className="label">Redirect URL (optional)</label>
              <input
                type="text"
                value={
                  survey.completionMessage[survey.defaultLanguage]
                    ?.redirectUrl || ''
                }
                onChange={(e) =>
                  onCompletionMessageChange({
                    ...survey.completionMessage,
                    [survey.defaultLanguage]: {
                      ...(survey.completionMessage[survey.defaultLanguage] || {
                        title: '',
                        body: '',
                      }),
                      redirectUrl: e.target.value,
                    } as CompletionMessage,
                  })
                }
                placeholder="https://example.com/thank-you"
                className="input"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =================== Versions Tab =================== */

function VersionsTab({
  survey,
  onRollback,
}: {
  survey: Survey;
  onRollback: (version: number) => void;
}) {
  return (
    <div className="overflow-y-auto scrollbar-thin h-full bg-slate-50">
      <div className="max-w-3xl mx-auto p-6">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-sky-500" />
            <h3 className="section-title">Version History</h3>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Track every published version of this survey. Roll back to any
            previous version.
          </p>

          {survey.versions.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
              <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">
                No versions published yet
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Publish your survey to create the first version
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {survey.versions.map((v, idx) => (
                <div
                  key={v.version}
                  className={`flex items-start gap-4 p-4 rounded-xl border ${
                    idx === 0
                      ? 'border-sky-200 bg-sky-50/30'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 flex-shrink-0">
                    v{v.version}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-slate-700">
                        {v.changelog}
                      </p>
                      {idx === 0 && <span className="badge-sky">Current</span>}
                    </div>
                    <p className="text-xs text-slate-400">
                      Published by {v.publishedBy} on{' '}
                      {new Date(v.publishedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {idx !== 0 && (
                    <button
                      onClick={() => onRollback(v.version)}
                      className="btn-secondary text-xs"
                    >
                      Roll back
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =================== Preview Modal (Interactive) =================== */

type AnswerValue =
  | string
  | string[]
  | number
  | Record<string, string>
  | Record<string, number>
  | null;

const PIPE_PLACEHOLDER_PATTERN = /\{piped\}|\$\{answer\}/g;

function applyPiping(
  title: string,
  pipeFrom: string | undefined,
  answers: Record<string, AnswerValue>,
  allQuestions: Question[]
): string {
  if (!pipeFrom) return title;
  const sourceAnswer = answers[pipeFrom];
  const hasAnswer = !(
    sourceAnswer == null ||
    sourceAnswer === '' ||
    (Array.isArray(sourceAnswer) && sourceAnswer.length === 0)
  );

  if (!hasAnswer) {
    // The source question hasn't been answered yet (e.g. the very first
    // render of a preview, or the respondent skipped an optional source
    // question). Rather than leaking the raw "{piped}" token into the
    // title, quietly drop the placeholder and tidy up the leftover spacing
    // so the title still reads as a complete sentence.
    // (Plain substring checks here on purpose — testing a shared `g`-flag
    // regex with .test() mutates its lastIndex and misbehaves on repeat
    // calls; .replace() below is safe since it always resets lastIndex.)
    if (!title.includes('{piped}') && !title.includes('${answer}'))
      return title;
    return title
      .replace(PIPE_PLACEHOLDER_PATTERN, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([,.!?])/g, '$1')
      .trim();
  }

  const sourceQuestion = allQuestions.find((q) => q.id === pipeFrom);
  let displayValue: string;
  if (Array.isArray(sourceAnswer)) {
    if (sourceQuestion?.options) {
      displayValue = sourceAnswer
        .map((v) => sourceQuestion.options?.find((o) => o.id === v)?.label || v)
        .join(', ');
    } else {
      displayValue = sourceAnswer.join(', ');
    }
  } else if (sourceQuestion?.options) {
    displayValue =
      sourceQuestion.options.find((o) => o.id === sourceAnswer)?.label ||
      String(sourceAnswer);
  } else {
    displayValue = String(sourceAnswer);
  }
  return title.replace(PIPE_PLACEHOLDER_PATTERN, displayValue);
}

// A question is required either unconditionally (question.required), or
// conditionally via requiredRule — the same condition-group shape used by
// displayRule, evaluated against the answers collected so far. This lets a
// question stay optional by default and only become mandatory once, say,
// an earlier "Are you satisfied?" question was answered "No".
function isQuestionRequired(
  q: Question,
  answers: Record<string, AnswerValue>
): boolean {
  if (q.required) return true;
  if (q.requiredRule)
    return evaluateConditionGroup(q.requiredRule.conditionGroup, answers);
  return false;
}

function PreviewModal({
  survey,
  onClose,
}: {
  survey: Survey;
  onClose: () => void;
}) {
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [completed, setCompleted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const page = survey.pages[currentPageIdx];

  function setAnswer(qId: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
  }

  function validatePage(): boolean {
    const errs: Record<string, string> = {};
    for (const q of page.questions) {
      if (!shouldDisplayQuestion(q, answers as Record<string, any>)) continue;
      const answer = answers[q.id];
      if (isQuestionRequired(q, answers)) {
        if (
          answer == null ||
          answer === '' ||
          (Array.isArray(answer) && answer.length === 0)
        ) {
          errs[q.id] = 'This question is required';
        }
      }
      if (
        q.type === 'text' &&
        q.validation &&
        q.validation !== 'none' &&
        answer
      ) {
        const val = String(answer);
        if (
          q.validation === 'email' &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
        ) {
          errs[q.id] = 'Please enter a valid email address';
        }
        if (q.validation === 'phone' && !/^[\d\s+()-]{7,}$/.test(val)) {
          errs[q.id] = 'Please enter a valid phone number';
        }
        if (q.validation === 'url' && !/^https?:\/\/.+/.test(val)) {
          errs[q.id] = 'Please enter a valid URL';
        }
        if (q.validation === 'number' && isNaN(Number(val))) {
          errs[q.id] = 'Please enter a valid number';
        }
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (!validatePage()) return;
    const skipTarget = evaluateSkipRules(page, answers as Record<string, any>);
    if (skipTarget) {
      const targetIdx = survey.pages.findIndex((p) => p.id === skipTarget);
      if (targetIdx >= 0) {
        setCurrentPageIdx(targetIdx);
        return;
      }
    }
    if (currentPageIdx < survey.pages.length - 1) {
      setCurrentPageIdx(currentPageIdx + 1);
    } else {
      setCompleted(true);
    }
  }

  function handlePrev() {
    if (currentPageIdx > 0) {
      setCurrentPageIdx(currentPageIdx - 1);
    }
  }

  if (completed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
          onClick={onClose}
        />
        <div
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl animate-slide-up overflow-hidden text-center py-12 px-8"
          style={{ fontFamily: survey.branding.fontFamily }}
        >
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{ backgroundColor: `${survey.branding.primaryColor}15` }}
          >
            <PartyPopper
              className="w-8 h-8"
              style={{ color: survey.branding.primaryColor }}
            />
          </div>
          <h2 className="text-xl font-bold font-display text-slate-900 mb-2">
            Thank you!
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Your response has been recorded.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 text-left mb-6">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Your Answers ({Object.keys(answers).length})
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
              {survey.pages
                .flatMap((p) => p.questions)
                .map((q) => {
                  const ans = answers[q.id];
                  if (ans == null) return null;
                  const ansStr = Array.isArray(ans)
                    ? ans.join(', ')
                    : typeof ans === 'object'
                      ? Object.values(ans).join(', ')
                      : String(ans);
                  return (
                    <div key={q.id} className="text-xs">
                      <span className="text-slate-500">
                        {q.title.slice(0, 40)}:{' '}
                      </span>
                      <span className="font-medium text-slate-700">
                        {ansStr}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-primary"
            style={{ backgroundColor: survey.branding.primaryColor }}
          >
            Close Preview
          </button>
        </div>
      </div>
    );
  }

  const isLast = currentPageIdx === survey.pages.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl my-8 animate-slide-up overflow-hidden">
        <div
          className="px-8 py-6"
          style={{
            backgroundColor: `${survey.branding.primaryColor}08`,
            borderBottom: `1px solid ${survey.branding.primaryColor}20`,
          }}
        >
          <div className="flex items-center justify-between">
            <h2
              className="text-xl font-bold font-display"
              style={{ color: survey.branding.primaryColor }}
            >
              {survey.title}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-slate-500 mt-1">{survey.description}</p>
          <div className="flex items-center gap-1.5 mt-4">
            {survey.pages.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === currentPageIdx ? 32 : 12,
                  backgroundColor:
                    i <= currentPageIdx
                      ? survey.branding.primaryColor
                      : '#e2e8f0',
                }}
              />
            ))}
          </div>
        </div>

        <div
          className="px-8 py-8"
          style={{ fontFamily: survey.branding.fontFamily }}
        >
          <p className="text-xs text-slate-400 mb-1">
            Page {currentPageIdx + 1} of {survey.pages.length}
          </p>
          <h3 className="text-lg font-semibold text-slate-900 mb-6">
            {page.title}
          </h3>

          <div className="space-y-6">
            {page.questions
              .filter((q) =>
                shouldDisplayQuestion(q, answers as Record<string, any>)
              )
              .map((q) => (
                <InteractiveQuestion
                  key={q.id}
                  question={q}
                  answer={answers[q.id]}
                  error={errors[q.id]}
                  primaryColor={survey.branding.primaryColor}
                  accentColor={survey.branding.accentColor}
                  allAnswers={answers}
                  allQuestions={survey.pages.flatMap((p) => p.questions)}
                  onAnswer={(val) => setAnswer(q.id, val)}
                />
              ))}
          </div>

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
            <button
              onClick={handlePrev}
              disabled={currentPageIdx === 0}
              className="btn-secondary"
            >
              <ArrowLeft className="w-4 h-4" /> Previous
            </button>
            {isLast ? (
              <button
                onClick={handleNext}
                className="btn-primary"
                style={{ backgroundColor: survey.branding.primaryColor }}
              >
                <Check className="w-4 h-4" /> Submit
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="btn-primary"
                style={{ backgroundColor: survey.branding.primaryColor }}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =================== Interactive Question (Preview) =================== */

function InteractiveQuestion({
  question: q,
  answer,
  error,
  primaryColor,
  accentColor,
  allAnswers,
  allQuestions,
  onAnswer,
}: {
  question: Question;
  answer: AnswerValue;
  error?: string;
  primaryColor: string;
  accentColor: string;
  allAnswers: Record<string, AnswerValue>;
  allQuestions: Question[];
  onAnswer: (val: AnswerValue) => void;
}) {
  const displayTitle = applyPiping(
    q.title,
    q.pipeFrom,
    allAnswers,
    allQuestions
  );

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {displayTitle}
        {isQuestionRequired(q, allAnswers) && (
          <span className="text-red-500 ml-1">*</span>
        )}
      </label>
      {q.description && (
        <p className="text-xs text-slate-400 mb-3">{q.description}</p>
      )}
      {error && (
        <p className="text-xs text-red-500 mb-2 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}

      {(q.type === 'single-choice' ||
        q.type === 'dropdown' ||
        q.type === 'yes-no' ||
        q.type === 'true-false') &&
        q.options &&
        (q.type === 'dropdown' ? (
          <select
            value={String(answer ?? '')}
            onChange={(e) => onAnswer(e.target.value)}
            className="input"
          >
            <option value="">Select an option...</option>
            {q.options.map((o) => (
              <option key={o.id} value={o.label}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-2">
            {q.options.map((o) => (
              <label
                key={o.id}
                className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                  answer === o.label
                    ? 'border-2'
                    : 'border border-slate-200 hover:border-slate-300'
                }`}
                style={
                  answer === o.label
                    ? {
                        borderColor: primaryColor,
                        backgroundColor: `${primaryColor}08`,
                      }
                    : {}
                }
              >
                <input
                  type="radio"
                  name={q.id}
                  checked={answer === o.label}
                  onChange={() => onAnswer(o.label)}
                  className="accent-sky-500"
                  style={{ accentColor: primaryColor }}
                />
                <span className="text-sm text-slate-700">{o.label}</span>
              </label>
            ))}
          </div>
        ))}

      {(q.type === 'multiple-choice' || q.type === 'multi-select-dropdown') &&
        q.options &&
        (q.type === 'multi-select-dropdown' ? (
          <select
            multiple
            value={(Array.isArray(answer) ? answer : []).map(String)}
            onChange={(e) =>
              onAnswer(Array.from(e.target.selectedOptions).map((o) => o.value))
            }
            className="input min-h-[120px]"
          >
            {q.options.map((o) => (
              <option key={o.id} value={o.label}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-2">
            {q.options.map((o) => {
              const selected =
                Array.isArray(answer) && answer.includes(o.label);
              return (
                <label
                  key={o.id}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                    selected
                      ? 'border-2'
                      : 'border border-slate-200 hover:border-slate-300'
                  }`}
                  style={
                    selected
                      ? {
                          borderColor: primaryColor,
                          backgroundColor: `${primaryColor}08`,
                        }
                      : {}
                  }
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      const current = Array.isArray(answer) ? answer : [];
                      if (e.target.checked) {
                        onAnswer([...current, o.label]);
                      } else {
                        onAnswer(current.filter((v) => v !== o.label));
                      }
                    }}
                    style={{ accentColor: primaryColor }}
                  />
                  <span className="text-sm text-slate-700">{o.label}</span>
                </label>
              );
            })}
          </div>
        ))}

      {q.type === 'text' && (
        <input
          type="text"
          value={String(answer ?? '')}
          onChange={(e) => onAnswer(e.target.value)}
          className="input"
          placeholder="Type your answer..."
        />
      )}
      {q.type === 'long-text' && (
        <textarea
          value={String(answer ?? '')}
          onChange={(e) => onAnswer(e.target.value)}
          className="input resize-none"
          rows={3}
          placeholder="Type your answer..."
        />
      )}
      {q.type === 'number' && (
        <input
          type="number"
          step="1"
          value={String(answer ?? '')}
          onChange={(e) => onAnswer(e.target.value)}
          className="input"
          placeholder="Enter a number..."
        />
      )}
      {q.type === 'decimal' && (
        <input
          type="number"
          step="0.01"
          value={String(answer ?? '')}
          onChange={(e) => onAnswer(e.target.value)}
          className="input"
          placeholder="Enter a decimal..."
        />
      )}
      {q.type === 'email' && (
        <input
          type="email"
          value={String(answer ?? '')}
          onChange={(e) => onAnswer(e.target.value)}
          className="input"
          placeholder="name@example.com"
        />
      )}
      {q.type === 'phone' && (
        <input
          type="tel"
          value={String(answer ?? '')}
          onChange={(e) => onAnswer(e.target.value)}
          className="input"
          placeholder="+1 (555) 000-0000"
        />
      )}
      {q.type === 'url' && (
        <input
          type="url"
          value={String(answer ?? '')}
          onChange={(e) => onAnswer(e.target.value)}
          className="input"
          placeholder="https://..."
        />
      )}
      {q.type === 'date' && (
        <input
          type="date"
          value={String(answer ?? '')}
          onChange={(e) => onAnswer(e.target.value)}
          className="input"
        />
      )}
      {q.type === 'datetime' && (
        <input
          type="datetime-local"
          value={String(answer ?? '')}
          onChange={(e) => onAnswer(e.target.value)}
          className="input"
        />
      )}
      {q.type === 'time' && (
        <input
          type="time"
          value={String(answer ?? '')}
          onChange={(e) => onAnswer(e.target.value)}
          className="input"
        />
      )}
      {q.type === 'file-upload' && (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
          <Upload className="w-6 h-6 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Click or drag to upload</p>
          {q.maxFileSize && (
            <p className="text-xs text-slate-300 mt-1">Max {q.maxFileSize}MB</p>
          )}
        </div>
      )}

      {/* Star Rating */}
      {q.type === 'rating' && (
        <div className="flex items-center gap-1.5">
          {Array.from({ length: q.max || 5 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onAnswer(n)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className="w-7 h-7 transition-colors"
                style={{
                  color: n <= Number(answer) ? primaryColor : '#cbd5e1',
                }}
                fill={n <= Number(answer) ? primaryColor : 'none'}
              />
            </button>
          ))}
        </div>
      )}

      {/* Numeric Rating */}
      {q.type === 'numeric-rating' && (
        <div className="flex items-center gap-2">
          {Array.from(
            { length: (q.max || 5) - (q.min || 1) + 1 },
            (_, i) => i + (q.min || 1)
          ).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onAnswer(n)}
              className={`w-10 h-10 rounded-lg border text-sm font-medium transition hover:scale-110 ${answer === n ? 'text-white' : ''}`}
              style={
                answer === n
                  ? { backgroundColor: primaryColor, borderColor: primaryColor }
                  : { borderColor: '#e2e8f0', color: primaryColor }
              }
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {/* Emoji Rating */}
      {q.type === 'emoji-rating' &&
        (q.emojiSet || ['😕', '😐', '🙂', '😀', '😄']).map((emoji, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAnswer(i + 1)}
              className={`text-3xl p-2 rounded-lg border transition hover:scale-110 ${answer === i + 1 ? 'border-2' : 'border border-slate-200'}`}
              style={
                answer === i + 1
                  ? {
                      borderColor: primaryColor,
                      backgroundColor: `${primaryColor}08`,
                    }
                  : {}
              }
            >
              {emoji}
            </button>
          </div>
        ))}

      {/* NPS */}
      {q.type === 'nps' && (
        <div>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 11 }, (_, i) => i).map((n) => (
              <button
                key={n}
                onClick={() => onAnswer(n)}
                className={`w-9 h-9 rounded-lg border text-sm font-medium transition hover:scale-110 ${answer === n ? 'text-white' : ''}`}
                style={
                  answer === n
                    ? {
                        backgroundColor:
                          n >= 9 ? accentColor : n <= 6 ? '#ef4444' : '#64748b',
                        borderColor: 'transparent',
                      }
                    : {
                        borderColor: `${primaryColor}40`,
                        color:
                          n >= 9 ? accentColor : n <= 6 ? '#ef4444' : '#64748b',
                      }
                }
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-1.5">
            <span>Detractors</span>
            <span>Passives</span>
            <span>Promoters</span>
          </div>
        </div>
      )}

      {/* Slider */}
      {q.type === 'slider' && (
        <div>
          <input
            type="range"
            min={q.min || 0}
            max={q.max || 100}
            step={q.step || 1}
            value={Number(answer ?? (q.min || 0))}
            onChange={(e) => onAnswer(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: primaryColor }}
          />
          <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
            <span>{q.min || 0}</span>
            <span
              className="font-semibold text-slate-600"
              style={{ color: primaryColor }}
            >
              Current: {Number(answer ?? (q.min || 0))}
            </span>
            <span>{q.max || 100}</span>
          </div>
        </div>
      )}

      {/* Likert Scale */}
      {q.type === 'likert-scale' && (
        <div className="space-y-2">
          {(
            q.scaleLabels || [
              'Strongly Disagree',
              'Disagree',
              'Neutral',
              'Agree',
              'Strongly Agree',
            ]
          ).map((label, i) => (
            <label
              key={i}
              className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${answer === label ? 'border-2' : 'border border-slate-200 hover:border-slate-300'}`}
              style={
                answer === label
                  ? {
                      borderColor: primaryColor,
                      backgroundColor: `${primaryColor}08`,
                    }
                  : {}
              }
            >
              <input
                type="radio"
                name={q.id}
                checked={answer === label}
                onChange={() => onAnswer(label)}
                style={{ accentColor: primaryColor }}
              />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
        </div>
      )}

      {/* Matrix */}
      {(q.type === 'matrix' || q.type === 'matrix-rating') &&
        q.rows &&
        q.columns && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th></th>
                  {q.columns.map((c) => (
                    <th
                      key={c}
                      className="px-2 py-2 text-xs font-medium text-slate-500 text-center"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {q.rows.map((r) => {
                  const rowAnswer =
                    typeof answer === 'object' &&
                    answer !== null &&
                    !Array.isArray(answer)
                      ? (answer as Record<string, string>)[r] || ''
                      : '';
                  return (
                    <tr key={r}>
                      <td className="px-2 py-2 text-sm text-slate-700">{r}</td>
                      {q.columns!.map((c) => (
                        <td key={c} className="px-2 py-2 text-center">
                          <input
                            type="radio"
                            name={`${q.id}-${r}`}
                            checked={rowAnswer === c}
                            onChange={() => {
                              const current =
                                typeof answer === 'object' &&
                                answer !== null &&
                                !Array.isArray(answer)
                                  ? (answer as Record<string, string>)
                                  : {};
                              onAnswer({ ...current, [r]: c });
                            }}
                            style={{ accentColor: primaryColor }}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      {/* Ranking */}
      {(q.type === 'ranking' || q.type === 'drag-ranking') && q.options && (
        <RankingPreview
          options={q.options}
          answer={answer}
          onAnswer={onAnswer}
        />
      )}

      {/* Image Selection */}
      {q.type === 'image-selection' && q.options && (
        <div className="grid grid-cols-2 gap-3">
          {q.options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onAnswer(o.label)}
              className={`rounded-xl border-2 overflow-hidden transition ${answer === o.label ? '' : 'border-slate-200 hover:border-slate-300'}`}
              style={answer === o.label ? { borderColor: primaryColor } : {}}
            >
              <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                {o.label}
              </div>
              <p className="text-xs text-slate-600 py-1.5 text-center">
                {o.label}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Signature */}
      {q.type === 'signature' && (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
          <PenTool className="w-6 h-6 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Sign here</p>
        </div>
      )}

      {/* Address */}
      {q.type === 'address' && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Street Address"
            className="input"
            value={(answer as Record<string, string>)?.street || ''}
            onChange={(e) =>
              onAnswer({
                ...((answer as Record<string, string>) || {}),
                street: e.target.value,
              })
            }
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="City"
              className="input"
              value={(answer as Record<string, string>)?.city || ''}
              onChange={(e) =>
                onAnswer({
                  ...((answer as Record<string, string>) || {}),
                  city: e.target.value,
                })
              }
            />
            <input
              type="text"
              placeholder="State / Province"
              className="input"
              value={(answer as Record<string, string>)?.state || ''}
              onChange={(e) =>
                onAnswer({
                  ...((answer as Record<string, string>) || {}),
                  state: e.target.value,
                })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="ZIP / Postal Code"
              className="input"
              value={(answer as Record<string, string>)?.zip || ''}
              onChange={(e) =>
                onAnswer({
                  ...((answer as Record<string, string>) || {}),
                  zip: e.target.value,
                })
              }
            />
            <input
              type="text"
              placeholder="Country"
              className="input"
              value={(answer as Record<string, string>)?.country || ''}
              onChange={(e) =>
                onAnswer({
                  ...((answer as Record<string, string>) || {}),
                  country: e.target.value,
                })
              }
            />
          </div>
        </div>
      )}

      {/* Location */}
      {q.type === 'location' && (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
          <MapPin className="w-6 h-6 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Location capture</p>
        </div>
      )}

      {/* Contact Info */}
      {q.type === 'contact-info' && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Full Name"
            className="input"
            value={(answer as Record<string, string>)?.name || ''}
            onChange={(e) =>
              onAnswer({
                ...((answer as Record<string, string>) || {}),
                name: e.target.value,
              })
            }
          />
          <input
            type="email"
            placeholder="Email Address"
            className="input"
            value={(answer as Record<string, string>)?.email || ''}
            onChange={(e) =>
              onAnswer({
                ...((answer as Record<string, string>) || {}),
                email: e.target.value,
              })
            }
          />
          <input
            type="tel"
            placeholder="Phone Number"
            className="input"
            value={(answer as Record<string, string>)?.phone || ''}
            onChange={(e) =>
              onAnswer({
                ...((answer as Record<string, string>) || {}),
                phone: e.target.value,
              })
            }
          />
        </div>
      )}

      {/* CSAT */}
      {q.type === 'customer-satisfaction' && (
        <div>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onAnswer(n)}
                className={`p-1 transition-transform hover:scale-110`}
              >
                <Heart
                  className="w-7 h-7 transition-colors"
                  style={{ color: n <= Number(answer) ? '#ec4899' : '#cbd5e1' }}
                  fill={n <= Number(answer) ? '#ec4899' : 'none'}
                />
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-1.5">
            <span>Very Dissatisfied</span>
            <span>Very Satisfied</span>
          </div>
        </div>
      )}

      {/* CES */}
      {q.type === 'customer-effort' && (
        <div>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 7 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onAnswer(n)}
                className={`w-9 h-9 rounded-lg border text-sm font-medium transition hover:scale-110 ${answer === n ? 'text-white' : ''}`}
                style={
                  answer === n
                    ? {
                        backgroundColor:
                          n <= 2 ? '#22c55e' : n >= 5 ? '#ef4444' : '#f59e0b',
                        borderColor: 'transparent',
                      }
                    : { borderColor: '#e2e8f0' }
                }
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-1.5">
            <span>Strongly Disagree</span>
            <span>Strongly Agree</span>
          </div>
        </div>
      )}

      {/* Semantic Differential */}
      {q.type === 'semantic-differential' && q.options && (
        <div className="space-y-3">
          {q.options.map((pair, pIdx) => (
            <div key={pair.id}>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>{pair.label}</span>
                <span>
                  {q.options?.[(pIdx + 1) % q.options.length]?.label || ''}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={7}
                step={1}
                value={Number(
                  (answer as unknown as Record<string, number>)?.[pair.id] ?? 4
                )}
                onChange={(e) =>
                  onAnswer({
                    ...((answer as unknown as Record<string, number>) || {}),
                    [pair.id]: Number(e.target.value),
                  })
                }
                className="w-full"
                style={{ accentColor: primaryColor }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RankingPreview({
  options,
  answer,
  onAnswer,
}: {
  options: { id: string; label: string }[];
  answer: AnswerValue;
  onAnswer: (val: AnswerValue) => void;
}) {
  const ranked = Array.isArray(answer) ? answer : [];
  const unranked = options.filter((o) => !ranked.includes(o.label));

  function moveUp(idx: number) {
    if (idx <= 0) return;
    const next = [...ranked];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onAnswer(next);
  }

  function moveDown(idx: number) {
    if (idx >= ranked.length - 1) return;
    const next = [...ranked];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onAnswer(next);
  }

  function add(label: string) {
    onAnswer([...ranked, label]);
  }

  function remove(label: string) {
    onAnswer(ranked.filter((r) => r !== label));
  }

  return (
    <div className="space-y-3">
      {ranked.length > 0 && (
        <div className="space-y-1.5">
          {ranked.map((label, idx) => {
            const opt = options.find((o) => o.label === label);
            return (
              <div
                key={label}
                className="flex items-center gap-3 p-3 rounded-lg border-2 border-sky-200 bg-sky-50/50"
              >
                <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </div>
                <span className="text-sm text-slate-700 flex-1">
                  {opt?.label || label}
                </span>
                <button
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                >
                  <ChevronRight className="w-3.5 h-3.5 rotate-[-90deg]" />
                </button>
                <button
                  onClick={() => moveDown(idx)}
                  disabled={idx === ranked.length - 1}
                  className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                >
                  <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                </button>
                <button
                  onClick={() => remove(label)}
                  className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {unranked.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-1.5">Click to rank:</p>
          <div className="space-y-1">
            {unranked.map((o) => (
              <button
                key={o.id}
                onClick={() => add(o.label)}
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition w-full text-left"
              >
                <Plus className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm text-slate-600">{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* =================== Publish Modal =================== */

function PublishModal({
  survey,
  changelog,
  onChangelogChange,
  onClose,
  onPublish,
  saving,
  publishedUrl,
}: {
  survey: Survey;
  changelog: string;
  onChangelogChange: (v: string) => void;
  onClose: () => void;
  onPublish: () => void;
  saving: boolean;
  publishedUrl: string | null;
}) {
  const [copied, setCopied] = useState(false);

  function copyUrl() {
    if (!publishedUrl) return;
    navigator.clipboard.writeText(publishedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Modal open onClose={onClose} title="Publish Survey" size="md">
      <div className="space-y-4">
        {publishedUrl ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-50 mx-auto">
              <Check className="w-7 h-7 text-green-600" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold font-display text-slate-900">
                Survey is live!
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Share this link with your customers to collect responses.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={publishedUrl}
                className="input flex-1 text-sm font-mono"
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={copyUrl}
                className="btn-secondary whitespace-nowrap"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex items-center justify-between pt-2">
              <a
                href={publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                <ExternalLink className="w-4 h-4" />
                Open Survey
              </a>
              <button onClick={onClose} className="btn-primary">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 rounded-xl bg-sky-50 border border-sky-100">
              <p className="text-sm font-medium text-sky-700">
                Publishing version {survey.versions.length + 1}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                This will save the current draft and make the survey live.
                Previous responses will be preserved.
              </p>
            </div>
            <div>
              <label className="label">Changelog</label>
              <textarea
                value={changelog}
                onChange={(e) => onChangelogChange(e.target.value)}
                className="input resize-none"
                rows={3}
                placeholder="What changed in this version?"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="btn-secondary"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={onPublish}
                className="btn-primary"
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {saving
                  ? 'Publishing...'
                  : `Publish v${survey.versions.length + 1}`}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
