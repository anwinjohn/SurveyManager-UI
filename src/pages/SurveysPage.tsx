import { useEffect, useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit3,
  BarChart3,
  Copy,
  Trash2,
  Play,
  Pause,
  Radio,
  Calendar,
  Clock,
  Users as UsersIcon,
  ExternalLink,
  Check,
} from 'lucide-react';
import { api } from '@/services/api';
import type { Survey, SurveyStatus } from '@/types';
import { Spinner, PageHeader, StatusBadge, EmptyState, ProgressBar } from '@/components/ui';
import type { Page } from '@/components/Sidebar';

const statusFilters: (SurveyStatus | 'all')[] = ['all', 'active', 'draft', 'paused', 'closed'];

function SurveyCard({
  survey,
  onEdit,
  onAnalytics,
}: {
  survey: Survey;
  onEdit: () => void;
  onAnalytics: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const questionCount = survey.pages.reduce((acc, p) => acc + p.questions.length, 0);
  const shareUrl = survey.shortCode ? `${window.location.origin}/s/${survey.shortCode}` : null;

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="card card-hover p-5 group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${survey.branding.primaryColor}15` }}
          >
            {survey.mode === 'event' ? (
              <Radio className="w-5 h-5" style={{ color: survey.branding.primaryColor }} />
            ) : (
              <FileText className="w-5 h-5" style={{ color: survey.branding.primaryColor }} />
            )}
          </div>
          <div>
            <StatusBadge status={survey.status} />
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-20 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 animate-fade-in">
                <button onClick={() => { onEdit(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
                  <Edit3 className="w-4 h-4" /> Edit
                </button>
                <button onClick={() => { onAnalytics(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
                  <BarChart3 className="w-4 h-4" /> Analytics
                </button>
                {shareUrl && (
                  <button onClick={() => { copyLink(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Link Copied!' : 'Copy Share Link'}
                  </button>
                )}
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
                  <Copy className="w-4 h-4" /> Duplicate
                </button>
                <div className="h-px bg-slate-100 my-1" />
                {survey.status === 'active' ? (
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
                    <Pause className="w-4 h-4" /> Pause
                  </button>
                ) : (
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
                    <Play className="w-4 h-4" /> Activate
                  </button>
                )}
                <div className="h-px bg-slate-100 my-1" />
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <h3 className="text-base font-semibold text-slate-900 mb-1 line-clamp-1">{survey.title}</h3>
      <p className="text-sm text-slate-500 line-clamp-2 mb-4 h-10">{survey.description}</p>

      <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
        <span className="flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" /> {questionCount} questions
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" /> {survey.pages.length} pages
        </span>
        {survey.mode === 'event' && (
          <span className="badge-teal">Event-based</span>
        )}
      </div>

      <div className="space-y-2.5 mb-4">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-500">Completion rate</span>
            <span className="font-semibold text-slate-700">{survey.completionRate}%</span>
          </div>
          <ProgressBar value={survey.completionRate} max={100} color="bg-teal-500" />
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <UsersIcon className="w-3.5 h-3.5" /> {survey.responseCount.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {survey.avgTimeSec > 0 ? `${Math.floor(survey.avgTimeSec / 60)}m ${survey.avgTimeSec % 60}s` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {survey.status === 'active' && survey.shortCode && (
            <a
              href={`${window.location.origin}/s/${survey.shortCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-teal-600 hover:text-teal-700 transition flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open
            </a>
          )}
          <button onClick={onEdit} className="text-xs font-medium text-sky-600 hover:text-sky-700 transition">
            Edit survey →
          </button>
        </div>
      </div>
    </div>
  );
}

export function SurveysPage({ onNavigate }: { onNavigate: (page: Page, params?: Record<string, string>) => void }) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SurveyStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getSurveys().then((s) => {
      setSurveys(s);
      setLoading(false);
    });
  }, []);

  const filtered = surveys.filter((s) => {
    const matchesFilter = filter === 'all' || s.status === filter;
    const matchesSearch = s.title.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Surveys"
        subtitle="Create and manage all your surveys in one place"
        actions={
          <button className="btn-primary" onClick={() => onNavigate('builder')}>
            <Plus className="w-4 h-4" />
            New Survey
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search surveys..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1">
          <Filter className="w-4 h-4 text-slate-400 ml-2 mr-1" />
          {statusFilters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition capitalize ${
                filter === f ? 'bg-sky-50 text-sky-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="No surveys found"
          description="Try adjusting your filters or create a new survey to get started."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((survey) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              onEdit={() => onNavigate('builder', { id: survey.id })}
              onAnalytics={() => onNavigate('analytics', { id: survey.id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
