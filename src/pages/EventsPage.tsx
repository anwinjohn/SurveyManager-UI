import { useEffect, useState } from 'react';
import {
  Radio,
  Plus,
  Webhook,
  Upload,
  Code2,
  Link2,
  QrCode,
  Mail,
  MessageSquare,
  Bell,
  Copy,
  Check,
  Shield,
  Ban,
  ChevronRight,
  Activity,
  Clock,
  TrendingUp,
  Globe,
  Loader2,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { api } from '@/services/api';
import type { EventBinding, EventRecord, Survey } from '@/types';
import { Spinner, PageHeader, StatusBadge, Toggle, Modal, EmptyState } from '@/components/ui';

const eventTypeIcons: Record<string, typeof Radio> = {
  'customer-satisfaction': Radio,
  transaction: TrendingUp,
  appointment: Clock,
  'ticket-resolution': Shield,
  delivery: Activity,
  onboarding: Plus,
};

const ingestionIcons: Record<string, typeof Code2> = {
  'rest-api': Code2,
  webhook: Webhook,
  'csv-upload': Upload,
  'json-upload': Upload,
};

export function EventsPage() {
  const [bindings, setBindings] = useState<EventBinding[]>([]);
  const [records, setRecords] = useState<EventRecord[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'bindings' | 'events' | 'compliance'>('bindings');
  const [showCreate, setShowCreate] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateBinding, setGenerateBinding] = useState<EventBinding | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getEventBindings(), api.getEventRecords(), api.getSurveys()]).then(
      ([b, r, s]) => {
        setBindings(b);
        setRecords(r);
        setSurveys(s);
        setLoading(false);
      }
    );
  }, []);

  function copyUrl(url: string) {
    navigator.clipboard?.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  }

  if (loading) return <Spinner />;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Event Engine"
        subtitle="Bind survey templates to event types and automate response collection"
        actions={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> New Event Binding
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-white border border-slate-200 rounded-lg p-1 w-fit">
        {(['bindings', 'events', 'compliance'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition capitalize ${
              tab === t ? 'bg-sky-50 text-sky-700' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {t === 'bindings' ? 'Event Bindings' : t === 'events' ? 'Event Log' : 'Compliance & Opt-out'}
          </button>
        ))}
      </div>

      {tab === 'bindings' && (
        <div className="space-y-4">
          {bindings.map((binding) => {
            const Icon = eventTypeIcons[binding.eventTypeId] || Radio;
            return (
              <div key={binding.id} className="card card-hover p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{binding.eventTypeName}</h3>
                      <p className="text-sm text-slate-500">
                        Bound to <span className="font-medium text-slate-700">{binding.surveyTitle}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={binding.active ? 'active' : 'paused'} />
                    <Toggle checked={binding.active} onChange={() => {}} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-xs text-slate-400 mb-1.5">Ingestion Methods</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {binding.ingestionMethods.map((m) => {
                        const MIcon = ingestionIcons[m];
                        return (
                          <span key={m} className="badge-sky">
                            <MIcon className="w-3 h-3" />
                            {m.replace('-', ' ')}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-xs text-slate-400 mb-1.5">Reference ID</p>
                    <p className="text-sm font-medium text-slate-700">{binding.referenceIdLabel}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-xs text-slate-400 mb-1.5">Response Mode</p>
                    <p className="text-sm font-medium text-slate-700 capitalize">{binding.responseMode.replace('-', ' ')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                      <Bell className="w-3 h-3" /> Reminder Schedule
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {binding.reminderChannels.map((ch) => (
                        <span key={ch} className="badge-teal">
                          {ch === 'email' ? <Mail className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                          {ch}
                        </span>
                      ))}
                      <span className="text-sm text-slate-600">{binding.reminderSchedule}</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-xs text-slate-400 mb-1.5">Performance</p>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-lg font-bold text-slate-700">{binding.eventsProcessed.toLocaleString()}</p>
                        <p className="text-xs text-slate-400">events processed</p>
                      </div>
                      <div className="h-8 w-px bg-slate-200" />
                      <div>
                        <p className="text-lg font-bold text-teal-600">{binding.responseRate}%</p>
                        <p className="text-xs text-slate-400">response rate</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                  <button className="btn-secondary text-xs">
                    <Code2 className="w-3.5 h-3.5" /> API Docs
                  </button>
                  <button className="btn-secondary text-xs">
                    <Webhook className="w-3.5 h-3.5" /> Webhook URL
                  </button>
                  <button className="btn-secondary text-xs">
                    <Upload className="w-3.5 h-3.5" /> Bulk Upload
                  </button>
                  <button className="btn-secondary text-xs">
                    <QrCode className="w-3.5 h-3.5" /> QR Code
                  </button>
                  <button className="btn-secondary text-xs">
                    <Link2 className="w-3.5 h-3.5" /> Short URL
                  </button>
                  <button
                    className="btn-primary text-xs"
                    onClick={() => {
                      setGenerateBinding(binding);
                      setShowGenerate(true);
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Generate Instance
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'events' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="section-title">Recent Events</h3>
            <button className="btn-secondary text-xs">
              <Upload className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Event ID</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Payload</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Survey URL</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{rec.id}</td>
                    <td className="px-5 py-3">
                      <span className="badge-slate capitalize">{rec.eventTypeId.replace('-', ' ')}</span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{rec.referenceId}</td>
                    <td className="px-5 py-3">
                      <div className="text-xs text-slate-500 space-y-0.5">
                        {Object.entries(rec.payload).slice(0, 2).map(([k, v]) => (
                          <div key={k}><span className="text-slate-400">{k}:</span> {v}</div>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-sky-600 font-mono truncate max-w-[120px]">{rec.surveyUrl.slice(-20)}</span>
                        <button
                          onClick={() => copyUrl(rec.surveyUrl)}
                          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"
                        >
                          {copiedUrl === rec.surveyUrl ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={rec.status} /></td>
                    <td className="px-5 py-3 text-xs text-slate-400">
                      {new Date(rec.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'compliance' && (
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-teal-500" />
              <h3 className="section-title">Do-Not-Contact (DNC) Registry</h3>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Contacts who have opted out are automatically suppressed from all future survey invitations across all channels.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50">
                <p className="text-2xl font-bold font-display text-slate-700">247</p>
                <p className="text-xs text-slate-400 mt-1">Total opt-outs</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50">
                <p className="text-2xl font-bold font-display text-slate-700">12</p>
                <p className="text-xs text-slate-400 mt-1">Added this month</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50">
                <p className="text-2xl font-bold font-display text-teal-600">100%</p>
                <p className="text-xs text-slate-400 mt-1">Compliance rate</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Ban className="w-5 h-5 text-red-500" />
              <h3 className="section-title">Opt-out Management</h3>
            </div>
            <div className="space-y-3">
              {[
                { channel: 'Email', opted: 142, total: 36534, rate: 0.39 },
                { channel: 'SMS', opted: 89, total: 18400, rate: 0.48 },
                { channel: 'All channels', opted: 16, total: 36534, rate: 0.04 },
              ].map((row) => (
                <div key={row.channel} className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3">
                    {row.channel === 'Email' ? <Mail className="w-4 h-4 text-slate-400" /> : row.channel === 'SMS' ? <MessageSquare className="w-4 h-4 text-slate-400" /> : <Ban className="w-4 h-4 text-slate-400" />}
                    <span className="text-sm font-medium text-slate-700">{row.channel}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-slate-500">{row.opted} opted out</span>
                    <span className="text-slate-400">of {row.total.toLocaleString()}</span>
                    <span className="font-semibold text-red-500">{row.rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-amber-500" />
              <h3 className="section-title">Rate Limiting & Anti-Abuse</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-700">Rate Limit</p>
                  <span className="badge-green">Active</span>
                </div>
                <p className="text-xs text-slate-400">Max 10 requests per minute per IP. reCAPTCHA v3 enabled for suspicious traffic.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-700">Honeypot Fields</p>
                  <span className="badge-green">Active</span>
                </div>
                <p className="text-xs text-slate-400">3 hidden honeypot fields deployed. 42 bot submissions blocked this month.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-700">Edit Window</p>
                  <span className="badge-slate">48 hours</span>
                </div>
                <p className="text-xs text-slate-400">Respondents can edit their submission within 48 hours of submission.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-700">Save & Resume</p>
                  <span className="badge-green">Active</span>
                </div>
                <p className="text-xs text-slate-400">Partial responses are saved automatically and can be resumed via unique link.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Binding Modal */}
      {showCreate && (
        <CreateBindingModal
          surveys={surveys}
          onClose={() => setShowCreate(false)}
          onCreate={(binding) => {
            setBindings([...bindings, binding]);
            setShowCreate(false);
          }}
        />
      )}

      {/* Generate Instance Modal */}
      {showGenerate && generateBinding && (
        <GenerateInstanceModal
          binding={generateBinding}
          surveys={surveys}
          onClose={() => {
            setShowGenerate(false);
            setGenerateBinding(null);
          }}
        />
      )}
    </div>
  );
}

function CreateBindingModal({
  surveys,
  onClose,
  onCreate,
}: {
  surveys: Survey[];
  onClose: () => void;
  onCreate: (binding: EventBinding) => void;
}) {
  const [eventTypeName, setEventTypeName] = useState('');
  const [surveyId, setSurveyId] = useState(surveys[0]?.id || '');
  const [refLabel, setRefLabel] = useState('Order ID');
  const [responseMode, setResponseMode] = useState<'one-time' | 'multi-response'>('one-time');
  const [methods, setMethods] = useState<string[]>(['rest-api']);
  const [channels, setChannels] = useState<string[]>(['email']);

  const methodOptions = [
    { id: 'rest-api', label: 'REST API', icon: Code2 },
    { id: 'webhook', label: 'Webhook', icon: Webhook },
    { id: 'csv-upload', label: 'CSV Upload', icon: Upload },
    { id: 'json-upload', label: 'JSON Upload', icon: Upload },
  ];

  return (
    <Modal open onClose={onClose} title="Create Event Binding" size="lg">
      <div className="space-y-4">
        <div>
          <label className="label">Event Type Name</label>
          <input
            type="text"
            value={eventTypeName}
            onChange={(e) => setEventTypeName(e.target.value)}
            className="input"
            placeholder="e.g. Product Review Request"
          />
        </div>

        <div>
          <label className="label">Bind to Survey</label>
          <select value={surveyId} onChange={(e) => setSurveyId(e.target.value)} className="input">
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Reference ID Label</label>
          <input
            type="text"
            value={refLabel}
            onChange={(e) => setRefLabel(e.target.value)}
            className="input"
            placeholder="e.g. Order ID, Ticket ID"
          />
          <p className="text-xs text-slate-400 mt-1">The unique identifier from your event payload</p>
        </div>

        <div>
          <label className="label">Ingestion Methods</label>
          <div className="grid grid-cols-2 gap-2">
            {methodOptions.map((m) => {
              const Icon = m.icon;
              const selected = methods.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => setMethods(selected ? methods.filter((x) => x !== m.id) : [...methods, m.id])}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition ${
                    selected ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label">Response Mode</label>
          <div className="grid grid-cols-2 gap-2">
            {(['one-time', 'multi-response'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setResponseMode(mode)}
                className={`p-3 rounded-lg border text-sm transition capitalize ${
                  responseMode === mode ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {mode.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Reminder Channels</label>
          <div className="flex items-center gap-2">
            {['email', 'sms'].map((ch) => {
              const Icon = ch === 'email' ? Mail : MessageSquare;
              const selected = channels.includes(ch);
              return (
                <button
                  key={ch}
                  onClick={() => setChannels(selected ? channels.filter((x) => x !== ch) : [...channels, ch])}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition capitalize ${
                    selected ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {ch}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() =>
              onCreate({
                id: `eb_${Date.now()}`,
                eventTypeId: 'customer-satisfaction',
                eventTypeName: eventTypeName || 'New Event',
                surveyId,
                surveyTitle: surveys.find((s) => s.id === surveyId)?.title || '',
                referenceIdLabel: refLabel,
                ingestionMethods: methods as EventBinding['ingestionMethods'],
                responseMode,
                reminderChannels: channels as EventBinding['reminderChannels'],
                reminderSchedule: 'T+2h, T+1d',
                active: true,
                eventsProcessed: 0,
                responseRate: 0,
              })
            }
            className="btn-primary"
          >
            <Plus className="w-4 h-4" /> Create Binding
          </button>
        </div>
      </div>
    </Modal>
  );
}

const LANG_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ar', label: 'Arabic (RTL)' },
  { code: 'he', label: 'Hebrew (RTL)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ru', label: 'Russian' },
];

function GenerateInstanceModal({
  binding,
  surveys,
  onClose,
}: {
  binding: EventBinding;
  surveys: Survey[];
  onClose: () => void;
}) {
  const boundSurvey = surveys.find((s) => s.id === binding.surveyId);
  const availableLangs = boundSurvey?.languages || ['en'];
  const [language, setLanguage] = useState(availableLangs[0] || 'en');
  const [referenceId, setReferenceId] = useState('');
  const [payloadEntries, setPayloadEntries] = useState<{ key: string; value: string }[]>([
    { key: 'customer_name', value: '' },
    { key: 'transaction_id', value: '' },
  ]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ surveyUrl: string; shortCode: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function updatePayloadKey(idx: number, key: string) {
    setPayloadEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, key } : e)));
  }
  function updatePayloadValue(idx: number, value: string) {
    setPayloadEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, value } : e)));
  }
  function addPayloadField() {
    setPayloadEntries((prev) => [...prev, { key: '', value: '' }]);
  }
  function removePayloadField(idx: number) {
    setPayloadEntries((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    const payload: Record<string, string> = {};
    for (const entry of payloadEntries) {
      if (entry.key.trim()) payload[entry.key.trim()] = entry.value;
    }
    const res = await api.generateSurveyInstance({
      eventTypeId: binding.eventTypeId,
      referenceId: referenceId || undefined,
      payload,
      language,
    });
    setGenerating(false);
    if (res) {
      setResult(res);
    } else {
      setError('Failed to generate survey instance. Make sure the survey is published and bound to this event type.');
    }
  }

  function copyUrl() {
    if (!result) return;
    navigator.clipboard?.writeText(result.surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal open onClose={onClose} title="Generate Personalized Survey Instance" size="lg">
      {result ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Survey instance generated successfully</p>
              <p className="text-xs text-green-600 mt-0.5">A personalized survey link has been created and is ready for distribution.</p>
            </div>
          </div>

          <div>
            <label className="label">Survey Access URL</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-sm text-slate-700 truncate">
                {result.surveyUrl}
              </div>
              <button onClick={copyUrl} className="btn-secondary flex-shrink-0">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-slate-50">
              <p className="text-xs text-slate-400 mb-1">Short Code</p>
              <p className="text-sm font-mono font-semibold text-slate-700">{result.shortCode}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50">
              <p className="text-xs text-slate-400 mb-1">Language</p>
              <p className="text-sm font-semibold text-slate-700">{LANG_OPTIONS.find((l) => l.code === language)?.label || language}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary">Close</button>
            <a href={result.surveyUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
              <ExternalLink className="w-4 h-4" /> Open Survey
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-sky-50 border border-sky-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-500 flex-shrink-0" />
            <p className="text-xs text-sky-700">
              This simulates the partner system API call. In production, your partner system would call the API with the event type ID and contextual data to generate a personalized survey instance.
            </p>
          </div>

          <div>
            <label className="label">Event Type</label>
            <div className="px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600">
              {binding.eventTypeName} <span className="text-slate-400 font-mono">({binding.eventTypeId})</span>
            </div>
          </div>

          <div>
            <label className="label">Bound Survey</label>
            <div className="px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600">
              {binding.surveyTitle}
            </div>
          </div>

          <div>
            <label className="label">{binding.referenceIdLabel}</label>
            <input
              type="text"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              className="input"
              placeholder={`e.g. ORD-12345`}
            />
          </div>

          <div>
            <label className="label flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              Personalization Language
            </label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="input">
              {availableLangs.map((lang) => {
                const info = LANG_OPTIONS.find((l) => l.code === lang);
                return (
                  <option key={lang} value={lang}>
                    {info?.label || lang}
                  </option>
                );
              })}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              The survey instance will be generated in this language. The respondent can still switch languages while answering.
            </p>
          </div>

          <div>
            <label className="label">Contextual Data (Payload)</label>
            <p className="text-xs text-slate-400 mb-2">Customer and transaction attributes for survey personalization</p>
            <div className="space-y-2">
              {payloadEntries.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={entry.key}
                    onChange={(e) => updatePayloadKey(idx, e.target.value)}
                    className="input flex-1 text-sm"
                    placeholder="Field name (e.g. customer_name)"
                  />
                  <input
                    type="text"
                    value={entry.value}
                    onChange={(e) => updatePayloadValue(idx, e.target.value)}
                    className="input flex-1 text-sm"
                    placeholder="Value (e.g. John Doe)"
                  />
                  {payloadEntries.length > 1 && (
                    <button
                      onClick={() => removePayloadField(idx)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition flex-shrink-0"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addPayloadField} className="btn-secondary text-xs mt-2">
              <Plus className="w-3.5 h-3.5" /> Add Field
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleGenerate} disabled={generating} className="btn-primary">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Instance
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
