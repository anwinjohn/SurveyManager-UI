export type SurveyStatus = 'draft' | 'active' | 'paused' | 'closed' | 'archived';
export type SurveyMode = 'generic' | 'event';

export type QuestionType =
  | 'text'
  | 'long-text'
  | 'number'
  | 'decimal'
  | 'email'
  | 'phone'
  | 'url'
  | 'date'
  | 'datetime'
  | 'time'
  | 'single-choice'
  | 'multiple-choice'
  | 'dropdown'
  | 'multi-select-dropdown'
  | 'yes-no'
  | 'true-false'
  | 'rating'
  | 'numeric-rating'
  | 'emoji-rating'
  | 'slider'
  | 'likert-scale'
  | 'nps'
  | 'matrix'
  | 'matrix-rating'
  | 'ranking'
  | 'drag-ranking'
  | 'image-selection'
  | 'file-upload'
  | 'signature'
  | 'address'
  | 'location'
  | 'contact-info'
  | 'customer-satisfaction'
  | 'customer-effort'
  | 'semantic-differential';

export interface QuestionOption {
  id: string;
  label: string;
}

export type LogicOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_equal'
  | 'less_equal'
  | 'is_empty'
  | 'is_not_empty';

/** Keep old name as alias for backward compatibility */
export type SkipOperator = LogicOperator;

export type LogicConnector = 'and' | 'or';

/** A single condition: "Q5 equals Yes" */
export interface LogicCondition {
  id: string;
  sourceQuestionId: string;
  operator: LogicOperator;
  value: string;
}

/** A group of conditions joined by AND or OR */
export interface LogicConditionGroup {
  id: string;
  connector: LogicConnector;
  conditions: LogicCondition[];
}

/** Skip logic: if condition(s) met, jump to a target page */
export interface SkipRule {
  id: string;
  /** Legacy single-condition fields (still used for simple rules) */
  sourceQuestionId: string;
  operator: LogicOperator;
  value: string;
  targetPageId: string;
  /** New: compound conditions with AND/OR */
  conditionGroup?: LogicConditionGroup;
}

/** Display logic: show this question only if condition(s) met */
export interface DisplayRule {
  id: string;
  conditionGroup: LogicConditionGroup;
}

/** Branch logic: route to a specific page based on condition(s) */
export interface BranchRule {
  id: string;
  conditionGroup: LogicConditionGroup;
  targetPageId: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  options?: QuestionOption[];
  /** For matrix questions */
  rows?: string[];
  columns?: string[];
  /** For rating/slider */
  min?: number;
  max?: number;
  step?: number;
  /** For text validation */
  validation?: 'email' | 'phone' | 'url' | 'number' | 'decimal' | 'none';
  /** Piped source question id */
  pipeFrom?: string;
  skipRules?: SkipRule[];
  /** Show this question only when conditions are met */
  displayRule?: DisplayRule;
  /** For emoji rating */
  emojiSet?: string[];
  /** For likert / semantic differential */
  scaleLabels?: string[];
  /** For image selection */
  imageUrls?: string[];
  /** For address / contact-info */
  fields?: string[];
  /** For signature */
  signatureFormat?: 'draw' | 'type';
  /** For file upload */
  maxFileSize?: number;
  allowedFileTypes?: string[];
  /** For location */
  locationType?: 'coordinates' | 'address';
}

export interface SurveyPage {
  id: string;
  title: string;
  questions: Question[];
  /** Section this page belongs to (optional, for grouping) */
  sectionId?: string;
}

/** A section groups multiple pages together for large surveys */
export interface SurveySection {
  id: string;
  title: string;
  description?: string;
  /** Branch rule: route respondents to this section based on conditions */
  branchRule?: BranchRule;
}

export interface SurveyVersion {
  version: number;
  publishedAt: string;
  publishedBy: string;
  changelog: string;
}

export interface Branding {
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  customCss: string;
  hidePulseBranding: boolean;
  customDomain: string | null;
}

export interface Quota {
  id: string;
  name: string;
  target: number;
  filled: number;
  condition: string;
}

export interface CompletionMessage {
  title: string;
  body: string;
  redirectUrl?: string | null;
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  status: SurveyStatus;
  mode: SurveyMode;
  organization: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  pages: SurveyPage[];
  sections: SurveySection[];
  versions: SurveyVersion[];
  branding: Branding;
  quotas: Quota[];
  languages: string[];
  defaultLanguage: string;
  completionMessage: Record<string, CompletionMessage>;
  responseCount: number;
  completionRate: number;
  avgTimeSec: number;
  eventTypeId?: string;
  shortCode?: string;
}

export interface SurveyTranslation {
  languageCode: string;
  translations: Record<string, any>;
}

export type EventType =
  | 'customer-satisfaction'
  | 'transaction'
  | 'appointment'
  | 'ticket-resolution'
  | 'delivery'
  | 'onboarding';

export interface EventBinding {
  id: string;
  eventTypeId: EventType;
  eventTypeName: string;
  surveyId: string;
  surveyTitle: string;
  referenceIdLabel: string;
  ingestionMethods: ('rest-api' | 'webhook' | 'csv-upload' | 'json-upload')[];
  responseMode: 'one-time' | 'multi-response';
  reminderChannels: ('email' | 'sms')[];
  reminderSchedule: string;
  active: boolean;
  eventsProcessed: number;
  responseRate: number;
}

export interface EventRecord {
  id: string;
  eventTypeId: EventType;
  referenceId: string;
  payload: Record<string, string>;
  surveyUrl: string;
  status: 'pending' | 'sent' | 'responded' | 'expired' | 'opted-out';
  createdAt: string;
  respondedAt: string | null;
}

export type Role = 'Super Admin' | 'Org Admin' | 'Survey Manager' | 'Editor' | 'Analyst';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'active' | 'invited' | 'suspended';
  lastActive: string;
  avatarColor: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsed: string | null;
  status: 'active' | 'revoked';
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  ip: string;
}

export interface NpsTrendPoint {
  month: string;
  promoters: number;
  passives: number;
  detractors: number;
  nps: number;
}

export interface GeoDataPoint {
  region: string;
  responses: number;
  nps: number;
}

export interface WordCloudItem {
  text: string;
  weight: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface CrossTabResult {
  rowLabel: string;
  colLabel: string;
  value: number;
}

export interface DashboardKpi {
  label: string;
  value: string;
  change: number;
  trend: 'up' | 'down' | 'flat';
  spark: number[];
}

export interface ResponseTimelinePoint {
  day: string;
  responses: number;
  completion: number;
}
