import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';
import {
  TrendingUp,
  Globe,
  MessageSquare,
  Table2,
  FileDown,
  Calendar,
  Smile,
  Meh,
  Frown,
  Gauge,
  Download,
  Mail,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '@/services/api';
import type {
  NpsTrendPoint,
  GeoDataPoint,
  WordCloudItem,
  CrossTabResult,
  Survey,
} from '@/types';
import { Spinner, PageHeader } from '@/components/ui';

const sentimentColors: Record<string, string> = {
  positive: '#0d9488',
  neutral: '#f59e0b',
  negative: '#ef4444',
};

export function AnalyticsPage() {
  const [npsTrend, setNpsTrend] = useState<NpsTrendPoint[]>([]);
  const [geoData, setGeoData] = useState<GeoDataPoint[]>([]);
  const [wordCloud, setWordCloud] = useState<WordCloudItem[]>([]);
  const [crossTab, setCrossTab] = useState<CrossTabResult[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSurvey, setSelectedSurvey] = useState('all');
  const [dateRange, setDateRange] = useState('30d');
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getNpsTrend(),
      api.getGeoData(),
      api.getWordCloud(),
      api.getCrossTab(),
      api.getSurveys(),
    ]).then(([n, g, w, c, s]) => {
      setNpsTrend(n);
      setGeoData(g);
      setWordCloud(w);
      setCrossTab(c);
      setSurveys(s);
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner />;

  const totalResponses = geoData.reduce((acc, g) => acc + g.responses, 0);
  const maxGeo = Math.max(...geoData.map((g) => g.responses));

  const crossTabRows = [...new Set(crossTab.map((c) => c.rowLabel))];
  const crossTabCols = [...new Set(crossTab.map((c) => c.colLabel))];

  const sentimentCounts = {
    positive: wordCloud.filter((w) => w.sentiment === 'positive').length,
    neutral: wordCloud.filter((w) => w.sentiment === 'neutral').length,
    negative: wordCloud.filter((w) => w.sentiment === 'negative').length,
  };

  const npsScore = npsTrend[npsTrend.length - 1]?.nps || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Analytics"
        subtitle="Real-time insights, NPS scoring, sentiment analysis, and geographic breakdowns"
        actions={
          <>
            <select
              value={selectedSurvey}
              onChange={(e) => setSelectedSurvey(e.target.value)}
              className="input w-auto"
            >
              <option value="all">All Surveys</option>
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="input w-auto"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
            <button className="btn-primary" onClick={() => setShowExport(!showExport)}>
              <FileDown className="w-4 h-4" /> Export
            </button>
          </>
        }
      />

      {showExport && (
        <div className="card p-4 mb-6 animate-slide-up flex items-center gap-3">
          <span className="text-sm text-slate-600">Export report as:</span>
          <button className="btn-secondary text-xs">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button className="btn-secondary text-xs">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          <button className="btn-secondary text-xs">
            <Mail className="w-4 h-4" /> Schedule Email
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <span className="text-xs text-slate-400">Schedule recurring reports (daily, weekly, monthly)</span>
        </div>
      )}

      {/* NPS Score + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card p-6 flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="w-5 h-5 text-teal-500" />
            <p className="text-sm font-medium text-slate-500">Current NPS</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <RadialBarChart
              data={[{ value: npsScore, fill: '#0d9488' }]}
              startAngle={180}
              endAngle={0}
              innerRadius="70%"
              outerRadius="100%"
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" background={{ fill: '#f1f5f9' }} cornerRadius={20} />
            </RadialBarChart>
          </ResponsiveContainer>
          <p className="text-3xl font-bold font-display text-teal-600 -mt-10">+{npsScore}</p>
          <div className="flex items-center gap-1 text-xs text-green-600 mt-2">
            <TrendingUp className="w-3.5 h-3.5" /> +5 from last period
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="section-title">NPS Trend Analysis</h3>
              <p className="text-xs text-slate-500 mt-0.5">6-month score breakdown</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" /> Promoters
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Passives
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Detractors
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={npsTrend} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <Bar dataKey="promoters" stackId="a" fill="#0d9488" radius={[0, 0, 0, 0]} barSize={36} />
              <Bar dataKey="passives" stackId="a" fill="#f59e0b" barSize={36} />
              <Bar dataKey="detractors" stackId="a" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={36} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <ResponsiveContainer width="100%" height={60}>
              <LineChart data={npsTrend} margin={{ top: 0, right: 5, bottom: 0, left: -20 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Line type="monotone" dataKey="nps" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Geographic Heatmap + Sentiment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-sky-500" />
            <h3 className="section-title">Geographic Heatmap</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">Response distribution and NPS by region</p>
          <div className="space-y-3">
            {geoData.map((g) => {
              const intensity = g.responses / maxGeo;
              const bgOpacity = 0.1 + intensity * 0.4;
              return (
                <div key={g.region} className="flex items-center gap-3">
                  <div className="w-28 text-sm text-slate-600 flex-shrink-0">{g.region}</div>
                  <div className="flex-1">
                    <div
                      className="h-8 rounded-lg flex items-center justify-end px-3 transition-all"
                      style={{
                        backgroundColor: `rgba(14, 165, 233, ${bgOpacity})`,
                        width: `${30 + intensity * 70}%`,
                      }}
                    >
                      <span className="text-xs font-semibold text-slate-700">{g.responses.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="w-16 text-right">
                    <span className={`text-xs font-semibold ${g.nps >= 60 ? 'text-teal-600' : g.nps >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                      NPS {g.nps}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">Total Responses</span>
            <span className="font-bold text-slate-700">{totalResponses.toLocaleString()}</span>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-indigo-500" />
            <h3 className="section-title">Sentiment Analysis</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">AI-powered sentiment from open-text responses</p>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="p-4 rounded-xl bg-teal-50 border border-teal-100 text-center">
              <Smile className="w-6 h-6 text-teal-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-teal-600">{sentimentCounts.positive}</p>
              <p className="text-xs text-teal-700">Positive</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-center">
              <Meh className="w-6 h-6 text-amber-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-amber-600">{sentimentCounts.neutral}</p>
              <p className="text-xs text-amber-700">Neutral</p>
            </div>
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-center">
              <Frown className="w-6 h-6 text-red-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-600">{sentimentCounts.negative}</p>
              <p className="text-xs text-red-700">Negative</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-center min-h-[120px]">
            {wordCloud.map((w) => (
              <span
                key={w.text}
                className="font-semibold cursor-default transition hover:scale-110"
                style={{
                  fontSize: `${12 + w.weight / 4}px`,
                  color: sentimentColors[w.sentiment],
                  opacity: 0.5 + w.weight / 200,
                }}
              >
                {w.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Cross-Tabulation */}
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Table2 className="w-5 h-5 text-sky-500" />
          <h3 className="section-title">Cross-Tabulation</h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Checkout experience vs NPS category — shows how response distribution varies across segments
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  Checkout Experience
                </th>
                {crossTabCols.map((col) => (
                  <th key={col} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {crossTabRows.map((row) => (
                <tr key={row} className="border-b border-slate-100">
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">{row}</td>
                  {crossTabCols.map((col) => {
                    const cell = crossTab.find((c) => c.rowLabel === row && c.colLabel === col);
                    const value = cell?.value || 0;
                    const bgIntensity = value / 100;
                    return (
                      <td key={col} className="px-4 py-3 text-center">
                        <div
                          className="inline-flex items-center justify-center w-14 h-9 rounded-lg text-sm font-semibold"
                          style={{
                            backgroundColor: col === 'Promoters' ? `rgba(13, 148, 136, ${bgIntensity})` : col === 'Passives' ? `rgba(245, 158, 11, ${bgIntensity})` : `rgba(239, 68, 68, ${bgIntensity})`,
                            color: value > 40 ? '#fff' : '#475569',
                          }}
                        >
                          {value}%
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event-specific metrics */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-title">Response Rate by Event Type</h3>
            <p className="text-xs text-slate-500 mt-0.5">Event-specific performance metrics</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={[
              { name: 'Transaction', rate: 78.4, fill: '#0ea5e9' },
              { name: 'Appointment', rate: 82.1, fill: '#0d9488' },
              { name: 'Ticket Resolution', rate: 71.3, fill: '#6366f1' },
              { name: 'Delivery', rate: 55.8, fill: '#f59e0b' },
            ]}
            margin={{ top: 5, right: 5, bottom: 5, left: -20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
            />
            <Bar dataKey="rate" radius={[6, 6, 0, 0]} barSize={56}>
              <Cell fill="#0ea5e9" />
              <Cell fill="#0d9488" />
              <Cell fill="#6366f1" />
              <Cell fill="#f59e0b" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
