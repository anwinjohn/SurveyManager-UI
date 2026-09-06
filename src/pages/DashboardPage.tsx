import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Users,
  FileText,
  Star,
  Zap,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/services/api';
import type { DashboardKpi, ResponseTimelinePoint, Survey } from '@/types';
import { Spinner, PageHeader, StatusBadge } from '@/components/ui';
import type { Page } from '@/components/Sidebar';

const sparkColors = ['#0ea5e9', '#0d9488', '#6366f1', '#f59e0b', '#ec4899', '#14b8a6'];

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const points = data.map((v, i) => ({ x: i, y: v }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={points} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="y"
          stroke={color}
          strokeWidth={2}
          fill={`url(#spark-${color})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function KpiCard({ kpi, index }: { kpi: DashboardKpi; index: number }) {
  const color = sparkColors[index % sparkColors.length];
  const icons = [FileText, TrendingUp, Star, Zap, Zap, Clock];
  const Icon = icons[index % icons.length];
  return (
    <div className="card card-hover p-5 animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className={`flex items-center gap-0.5 text-xs font-semibold ${kpi.trend === 'up' ? 'text-green-600' : 'text-red-500'}`}>
          {kpi.trend === 'up' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {kpi.change > 0 ? '+' : ''}{kpi.change}%
        </div>
      </div>
      <p className="text-2xl font-bold font-display text-slate-900">{kpi.value}</p>
      <p className="text-xs text-slate-500 mt-0.5 mb-3">{kpi.label}</p>
      <div className="h-9 -mx-1">
        <Sparkline data={kpi.spark} color={color} />
      </div>
    </div>
  );
}

const npsDistribution = [
  { name: 'Promoters', value: 74, color: '#0d9488' },
  { name: 'Passives', value: 18, color: '#f59e0b' },
  { name: 'Detractors', value: 8, color: '#ef4444' },
];

const channelData = [
  { name: 'Email', responses: 18200, fill: '#0ea5e9' },
  { name: 'SMS', responses: 8400, fill: '#0d9488' },
  { name: 'Web', responses: 5600, fill: '#6366f1' },
  { name: 'QR Code', responses: 3200, fill: '#f59e0b' },
  { name: 'API', responses: 1134, fill: '#ec4899' },
];

export function DashboardPage({ onNavigate }: { onNavigate: (page: Page, params?: Record<string, string>) => void }) {
  const [kpis, setKpis] = useState<DashboardKpi[]>([]);
  const [timeline, setTimeline] = useState<ResponseTimelinePoint[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getDashboardKpis(), api.getResponseTimeline(), api.getSurveys()]).then(
      ([k, t, s]) => {
        setKpis(k);
        setTimeline(t);
        setSurveys(s);
        setLoading(false);
      }
    );
  }, []);

  if (loading) return <Spinner />;

  const activeSurveys = surveys.filter((s) => s.status === 'active').slice(0, 5);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        subtitle="Real-time overview of survey performance and response analytics"
        actions={
          <button className="btn-primary">
            <FileText className="w-4 h-4" />
            New Survey
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {kpis.map((kpi, i) => (
          <KpiCard key={kpi.label} kpi={kpi} index={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="section-title">Response Timeline</h3>
              <p className="text-xs text-slate-500 mt-0.5">Daily responses and completion rate</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Responses
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" /> Completion %
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={timeline} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <defs>
                <linearGradient id="respGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              />
              <Area yAxisId="left" type="monotone" dataKey="responses" stroke="#0ea5e9" strokeWidth={2} fill="url(#respGrad)" />
              <Line yAxisId="right" type="monotone" dataKey="completion" stroke="#0d9488" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="section-title mb-1">NPS Distribution</h3>
          <p className="text-xs text-slate-500 mb-4">Current period breakdown</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={npsDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3}>
                {npsDistribution.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {npsDistribution.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </span>
                <span className="font-semibold text-slate-700">{d.value}%</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm text-slate-500">NPS Score</span>
            <span className="text-2xl font-bold font-display text-teal-600">+66</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="section-title">Responses by Channel</h3>
              <p className="text-xs text-slate-500 mt-0.5">Distribution across delivery methods</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={channelData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <Bar dataKey="responses" radius={[6, 6, 0, 0]} barSize={48}>
                {channelData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Active Surveys</h3>
            <button
              onClick={() => onNavigate('surveys')}
              className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-0.5"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-3">
            {activeSurveys.map((s) => (
              <button
                key={s.id}
                onClick={() => onNavigate('builder', { id: s.id })}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition text-left"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${s.branding.primaryColor}15` }}
                >
                  <FileText className="w-4 h-4" style={{ color: s.branding.primaryColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{s.title}</p>
                  <p className="text-xs text-slate-400">{s.responseCount.toLocaleString()} responses</p>
                </div>
                <StatusBadge status={s.status} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
