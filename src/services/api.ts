import type {
  Survey,
  SurveyVersion,
  SurveyTranslation,
  EventBinding,
  EventRecord,
  TeamMember,
  ApiKey,
  AuditLogEntry,
  NpsTrendPoint,
  GeoDataPoint,
  WordCloudItem,
  CrossTabResult,
  DashboardKpi,
  ResponseTimelinePoint,
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/* ---------- HTTP helpers ---------- */

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

async function http<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`API ${response.status}: ${text || response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function iso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

/* ---------- Surveys API ---------- */

export const api = {
  async getSurveys(): Promise<Survey[]> {
    return http<Survey[]>('/surveys');
  },

  async getSurvey(id: string): Promise<Survey | null> {
    try {
      return await http<Survey>(`/surveys/${id}`);
    } catch {
      return null;
    }
  },

  async saveSurvey(survey: Survey): Promise<Survey> {
    return http<Survey>(`/surveys/${survey.id}`, {
      method: 'PUT',
      body: JSON.stringify(survey),
    });
  },

  async publishSurvey(id: string, changelog: string): Promise<Survey | null> {
    try {
      return await http<Survey>(`/surveys/${id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ changelog }),
      });
    } catch {
      return null;
    }
  },

  async getSurveyByShortCode(shortCode: string): Promise<{ survey: Survey; instance: null } | null> {
    try {
      const survey = await http<Survey>(`/surveys/short-code/${shortCode}`);
      return { survey, instance: null };
    } catch {
      return null;
    }
  },

  async rollbackVersion(id: string, version: number): Promise<Survey | null> {
    try {
      return await http<Survey>(`/surveys/${id}/rollback`, {
        method: 'POST',
        body: JSON.stringify({ version }),
      });
    } catch {
      return null;
    }
  },

  async getTranslations(surveyId: string): Promise<SurveyTranslation[]> {
    try {
      return await http<SurveyTranslation[]>(`/surveys/${surveyId}/translations`);
    } catch {
      return [];
    }
  },

  async saveTranslation(surveyId: string, languageCode: string, translations: Record<string, any>): Promise<void> {
    await http<void>(`/surveys/${surveyId}/translations/${languageCode}`, {
      method: 'PUT',
      body: JSON.stringify(translations),
    });
  },

  async deleteTranslation(surveyId: string, languageCode: string): Promise<void> {
    await http<void>(`/surveys/${surveyId}/translations/${languageCode}`, {
      method: 'DELETE',
    });
  },

  async getMasterSetting(key: string): Promise<string | null> {
    try {
      const result = await http<{ value: string }>(`/settings/${key}`);
      return result.value;
    } catch {
      return null;
    }
  },

  async setMasterSetting(key: string, value: string): Promise<void> {
    await http<void>(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  },

  async getAuditLog(): Promise<AuditLogEntry[]> {
    try {
      return await http<AuditLogEntry[]>('/audit-log');
    } catch {
      return [];
    }
  },

  async generateSurveyInstance(params: {
    eventTypeId: string;
    referenceId?: string;
    payload?: Record<string, any>;
    language?: string;
  }): Promise<{ surveyUrl: string; shortCode: string; instanceId: string } | null> {
    try {
      return await http<{ surveyUrl: string; shortCode: string; instanceId: string }>(
        '/survey-instances',
        { method: 'POST', body: JSON.stringify(params) },
      );
    } catch {
      return null;
    }
  },

  async getSurveyInstance(shortCode: string): Promise<{ instance: any; survey: Survey } | null> {
    try {
      return await http<{ instance: any; survey: Survey }>(`/survey-instances/${shortCode}`);
    } catch {
      return null;
    }
  },

  async submitSurveyResponse(
    instanceId: string | null,
    surveyId: string,
    answers: Record<string, any>,
    language: string,
  ): Promise<boolean> {
    try {
      await http<void>('/survey-responses', {
        method: 'POST',
        body: JSON.stringify({ instanceId, surveyId, answers, language }),
      });
      return true;
    } catch {
      return false;
    }
  },

  async getCaptcha(): Promise<{ captchaId: string; image: string } | null> {
    try {
      return await http<{ captchaId: string; image: string }>('/captcha');
    } catch {
      return null;
    }
  },

  async verifyCaptcha(captchaId: string, answer: string): Promise<boolean> {
    try {
      const result = await http<{ success: boolean }>('/captcha/verify', {
        method: 'POST',
        body: JSON.stringify({ captchaId, answer }),
      });
      return result.success === true;
    } catch {
      return false;
    }
  },

  /* ---------- Static demo data (unchanged) ---------- */

  async getEventBindings(): Promise<EventBinding[]> {
    await delay(300);
    return [...eventBindings];
  },
  async getEventRecords(): Promise<EventRecord[]> {
    await delay(300);
    return [...eventRecords];
  },
  async getTeamMembers(): Promise<TeamMember[]> {
    await delay(200);
    return [...teamMembers];
  },
  async getApiKeys(): Promise<ApiKey[]> {
    await delay(200);
    return [...apiKeys];
  },
  async getNpsTrend(): Promise<NpsTrendPoint[]> {
    await delay(300);
    return [...npsTrend];
  },
  async getGeoData(): Promise<GeoDataPoint[]> {
    await delay(300);
    return [...geoData];
  },
  async getWordCloud(): Promise<WordCloudItem[]> {
    await delay(300);
    return [...wordCloud];
  },
  async getCrossTab(): Promise<CrossTabResult[]> {
    await delay(300);
    return [...crossTab];
  },
  async getDashboardKpis(): Promise<DashboardKpi[]> {
    await delay(200);
    return [...dashboardKpis];
  },
  async getResponseTimeline(): Promise<ResponseTimelinePoint[]> {
    await delay(300);
    return [...responseTimeline];
  },
};

/* ---------- Static demo data ---------- */

const eventBindings: EventBinding[] = [
  {
    id: 'eb_001',
    eventTypeId: 'transaction',
    eventTypeName: 'Transaction Completed',
    surveyId: 'srv_001',
    surveyTitle: 'Post-Purchase Satisfaction',
    referenceIdLabel: 'Order ID',
    ingestionMethods: ['rest-api', 'webhook', 'csv-upload'],
    responseMode: 'one-time',
    reminderChannels: ['email', 'sms'],
    reminderSchedule: 'T+2h, T+1d, T+3d',
    active: true,
    eventsProcessed: 12847,
    responseRate: 78.4,
  },
  {
    id: 'eb_002',
    eventTypeId: 'appointment',
    eventTypeName: 'Appointment Completed',
    surveyId: 'srv_003',
    surveyTitle: 'Appointment Experience',
    referenceIdLabel: 'Appointment ID',
    ingestionMethods: ['rest-api', 'webhook'],
    responseMode: 'one-time',
    reminderChannels: ['email'],
    reminderSchedule: 'T+1h, T+1d',
    active: true,
    eventsProcessed: 8932,
    responseRate: 82.1,
  },
  {
    id: 'eb_003',
    eventTypeId: 'ticket-resolution',
    eventTypeName: 'Ticket Resolved',
    surveyId: 'srv_005',
    surveyTitle: 'Support Ticket Resolution',
    referenceIdLabel: 'Ticket ID',
    ingestionMethods: ['rest-api', 'webhook', 'json-upload'],
    responseMode: 'multi-response',
    reminderChannels: ['email'],
    reminderSchedule: 'T+4h, T+2d',
    active: false,
    eventsProcessed: 3421,
    responseRate: 71.3,
  },
  {
    id: 'eb_004',
    eventTypeId: 'delivery',
    eventTypeName: 'Package Delivered',
    surveyId: 'srv_006',
    surveyTitle: 'Delivery Experience',
    referenceIdLabel: 'Tracking Number',
    ingestionMethods: ['rest-api', 'webhook'],
    responseMode: 'one-time',
    reminderChannels: ['email', 'sms'],
    reminderSchedule: 'T+1h, T+1d, T+5d',
    active: false,
    eventsProcessed: 6100,
    responseRate: 55.8,
  },
];

const eventRecords: EventRecord[] = Array.from({ length: 12 }, (_, i) => {
  const statuses: EventRecord['status'][] = ['pending', 'sent', 'responded', 'responded', 'responded', 'expired', 'opted-out'];
  const status = statuses[i % statuses.length];
  return {
    id: `ev_${String(i + 1).padStart(4, '0')}`,
    eventTypeId: (['transaction', 'appointment', 'ticket-resolution', 'delivery'] as const)[i % 4],
    referenceId: `ORD-${10000 + i * 137}`,
    payload: {
      customer_name: ['John Doe', 'Jane Smith', 'Carlos Ruiz', 'Mei Chen', 'Ahmed Hassan'][i % 5],
      amount: `$${(49.99 + i * 23.5).toFixed(2)}`,
      store: ['Downtown', 'Uptown', 'Online', 'Suburb'][i % 4],
    },
    surveyUrl: `https://survey.acmeretail.com/s/${Math.random().toString(36).slice(2, 10)}`,
    status,
    createdAt: iso(i),
    respondedAt: status === 'responded' ? iso(i - 1) : null,
  };
});

const teamMembers: TeamMember[] = [
  { id: 'tm_1', name: 'Sarah Chen', email: 'sarah.chen@acme.com', role: 'Super Admin', status: 'active', lastActive: '2 min ago', avatarColor: '#0ea5e9' },
  { id: 'tm_2', name: 'Mike Ross', email: 'mike.ross@acme.com', role: 'Org Admin', status: 'active', lastActive: '1 hour ago', avatarColor: '#0d9488' },
  { id: 'tm_3', name: 'James Wilson', email: 'james.wilson@acme.com', role: 'Survey Manager', status: 'active', lastActive: '3 hours ago', avatarColor: '#f59e0b' },
  { id: 'tm_4', name: 'Lisa Park', email: 'lisa.park@acme.com', role: 'Editor', status: 'active', lastActive: '5 hours ago', avatarColor: '#8b5cf6' },
  { id: 'tm_5', name: 'Tom Anderson', email: 'tom.anderson@acme.com', role: 'Analyst', status: 'active', lastActive: '1 day ago', avatarColor: '#ec4899' },
  { id: 'tm_6', name: 'Nina Patel', email: 'nina.patel@acme.com', role: 'Editor', status: 'invited', lastActive: 'Never', avatarColor: '#14b8a6' },
  { id: 'tm_7', name: 'Robert King', email: 'robert.king@acme.com', role: 'Analyst', status: 'suspended', lastActive: '2 weeks ago', avatarColor: '#ef4444' },
];

const apiKeys: ApiKey[] = [
  { id: 'ak_1', name: 'Production API', prefix: 'pk_live_8f2a', scopes: ['surveys:write', 'events:write', 'responses:read'], createdAt: iso(60), lastUsed: '5 min ago', status: 'active' },
  { id: 'ak_2', name: 'Analytics Read-Only', prefix: 'pk_live_3c1b', scopes: ['responses:read', 'analytics:read'], createdAt: iso(30), lastUsed: '1 hour ago', status: 'active' },
  { id: 'ak_3', name: 'Webhook Ingestion', prefix: 'pk_live_9d4e', scopes: ['events:write'], createdAt: iso(15), lastUsed: '2 min ago', status: 'active' },
  { id: 'ak_4', name: 'Legacy Integration', prefix: 'pk_live_1a2b', scopes: ['surveys:read'], createdAt: iso(120), lastUsed: null, status: 'revoked' },
];

const npsTrend: NpsTrendPoint[] = [
  { month: 'Mar', promoters: 62, passives: 24, detractors: 14, nps: 48 },
  { month: 'Apr', promoters: 65, passives: 22, detractors: 13, nps: 52 },
  { month: 'May', promoters: 68, passives: 20, detractors: 12, nps: 56 },
  { month: 'Jun', promoters: 64, passives: 23, detractors: 13, nps: 51 },
  { month: 'Jul', promoters: 71, passives: 19, detractors: 10, nps: 61 },
  { month: 'Aug', promoters: 74, passives: 18, detractors: 8, nps: 66 },
];

const geoData: GeoDataPoint[] = [
  { region: 'North America', responses: 15420, nps: 68 },
  { region: 'Europe', responses: 8230, nps: 54 },
  { region: 'Asia Pacific', responses: 6100, nps: 49 },
  { region: 'Latin America', responses: 3450, nps: 58 },
  { region: 'Middle East', responses: 2100, nps: 52 },
  { region: 'Africa', responses: 980, nps: 44 },
];

const wordCloud: WordCloudItem[] = [
  { text: 'excellent', weight: 94, sentiment: 'positive' },
  { text: 'fast', weight: 82, sentiment: 'positive' },
  { text: 'easy', weight: 76, sentiment: 'positive' },
  { text: 'smooth', weight: 71, sentiment: 'positive' },
  { text: 'helpful', weight: 65, sentiment: 'positive' },
  { text: 'great', weight: 60, sentiment: 'positive' },
  { text: 'reliable', weight: 48, sentiment: 'positive' },
  { text: 'okay', weight: 42, sentiment: 'neutral' },
  { text: 'average', weight: 38, sentiment: 'neutral' },
  { text: 'fine', weight: 35, sentiment: 'neutral' },
  { text: 'slow', weight: 52, sentiment: 'negative' },
  { text: 'confusing', weight: 44, sentiment: 'negative' },
  { text: 'difficult', weight: 38, sentiment: 'negative' },
  { text: 'expensive', weight: 30, sentiment: 'negative' },
  { text: 'delayed', weight: 28, sentiment: 'negative' },
  { text: 'broken', weight: 22, sentiment: 'negative' },
];

const crossTab: CrossTabResult[] = [
  { rowLabel: 'Very smooth', colLabel: 'Promoters', value: 82 },
  { rowLabel: 'Very smooth', colLabel: 'Passives', value: 14 },
  { rowLabel: 'Very smooth', colLabel: 'Detractors', value: 4 },
  { rowLabel: 'Somewhat smooth', colLabel: 'Promoters', value: 58 },
  { rowLabel: 'Somewhat smooth', colLabel: 'Passives', value: 30 },
  { rowLabel: 'Somewhat smooth', colLabel: 'Detractors', value: 12 },
  { rowLabel: 'Neutral', colLabel: 'Promoters', value: 35 },
  { rowLabel: 'Neutral', colLabel: 'Passives', value: 45 },
  { rowLabel: 'Neutral', colLabel: 'Detractors', value: 20 },
  { rowLabel: 'Somewhat difficult', colLabel: 'Promoters', value: 12 },
  { rowLabel: 'Somewhat difficult', colLabel: 'Passives', value: 28 },
  { rowLabel: 'Somewhat difficult', colLabel: 'Detractors', value: 60 },
  { rowLabel: 'Very difficult', colLabel: 'Promoters', value: 5 },
  { rowLabel: 'Very difficult', colLabel: 'Passives', value: 15 },
  { rowLabel: 'Very difficult', colLabel: 'Detractors', value: 80 },
];

const dashboardKpis: DashboardKpi[] = [
  { label: 'Total Responses', value: '36,534', change: 12.4, trend: 'up', spark: [120, 135, 128, 150, 165, 172, 180] },
  { label: 'Avg Completion Rate', value: '74.2%', change: 3.8, trend: 'up', spark: [65, 68, 66, 70, 72, 73, 74] },
  { label: 'Active Surveys', value: '12', change: 2, trend: 'up', spark: [8, 9, 10, 10, 11, 12, 12] },
  { label: 'NPS Score', value: '+66', change: 5, trend: 'up', spark: [48, 52, 56, 51, 61, 66, 66] },
  { label: 'Events Processed', value: '31,300', change: 8.1, trend: 'up', spark: [200, 250, 280, 310, 340, 360, 380] },
  { label: 'Avg Response Time', value: '1.2s', change: -0.3, trend: 'down', spark: [1.8, 1.6, 1.5, 1.4, 1.3, 1.2, 1.2] },
];

const responseTimeline: ResponseTimelinePoint[] = Array.from({ length: 14 }, (_, i) => {
  const base = 800 + Math.sin(i / 2) * 200;
  return {
    day: `Aug ${i + 10}`,
    responses: Math.round(base + Math.random() * 150),
    completion: Math.round(60 + Math.cos(i / 3) * 15 + Math.random() * 10),
  };
});
