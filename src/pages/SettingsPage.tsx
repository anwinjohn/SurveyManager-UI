import { useState } from 'react';
import {
  Settings as SettingsIcon,
  Palette,
  Shield,
  Webhook,
  Mail,
  Globe,
  Lock,
  Database,
  Check,
  AlertTriangle,
  Download,
  Trash2,
  Server,
  Key,
} from 'lucide-react';
import { PageHeader, Toggle } from '@/components/ui';

type SettingsTab = 'general' | 'branding' | 'compliance' | 'integrations' | 'security' | 'data';

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('general');

  const tabs: { id: SettingsTab; label: string; icon: typeof SettingsIcon }[] = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'compliance', label: 'GDPR & CCPA', icon: Shield },
    { id: 'integrations', label: 'Integrations', icon: Webhook },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'data', label: 'Data Retention', icon: Database },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Settings"
        subtitle="Configure organization-wide preferences, compliance, and integrations"
      />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tab sidebar */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="flex lg:flex-col gap-1 overflow-x-auto scrollbar-thin">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                    tab === t.id ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === 'general' && <GeneralSettings />}
          {tab === 'branding' && <BrandingSettings />}
          {tab === 'compliance' && <ComplianceSettings />}
          {tab === 'integrations' && <IntegrationsSettings />}
          {tab === 'security' && <SecuritySettings />}
          {tab === 'data' && <DataRetentionSettings />}
        </div>
      </div>
    </div>
  );
}

function GeneralSettings() {
  const [orgName, setOrgName] = useState('Acme Retail');
  const [supportEmail, setSupportEmail] = useState('support@acmeretail.com');
  const [timezone, setTimezone] = useState('America/New_York');
  const [responseMode, setResponseMode] = useState<'anonymous' | 'identified'>('identified');

  return (
    <div className="card p-6 space-y-5">
      <h3 className="section-title">Organization Details</h3>

      <div>
        <label className="label">Organization Name</label>
        <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="input" />
      </div>

      <div>
        <label className="label">Support Email</label>
        <input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className="input" />
      </div>

      <div>
        <label className="label">Default Timezone</label>
        <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="input">
          <option value="America/New_York">Eastern (EST)</option>
          <option value="America/Chicago">Central (CST)</option>
          <option value="America/Denver">Mountain (MST)</option>
          <option value="America/Los_Angeles">Pacific (PST)</option>
          <option value="Europe/London">London (GMT)</option>
          <option value="Europe/Paris">Paris (CET)</option>
          <option value="Asia/Tokyo">Tokyo (JST)</option>
        </select>
      </div>

      <div>
        <label className="label">Default Response Mode</label>
        <div className="grid grid-cols-2 gap-2">
          {(['anonymous', 'identified'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setResponseMode(mode)}
              className={`p-3 rounded-lg border text-sm transition capitalize ${
                responseMode === mode ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100">
        <button className="btn-primary">Save Changes</button>
      </div>
    </div>
  );
}

function BrandingSettings() {
  const [hideBranding, setHideBranding] = useState(true);
  const [customDomain, setCustomDomain] = useState('survey.acmeretail.com');
  const [customCss, setCustomCss] = useState('');

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-5">
        <h3 className="section-title">White-Label Configuration</h3>

        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
          <div>
            <p className="text-sm font-medium text-slate-700">Hide Pulse Branding</p>
            <p className="text-xs text-slate-400">Remove "Powered by Pulse" from all surveys</p>
          </div>
          <Toggle checked={hideBranding} onChange={setHideBranding} />
        </div>

        <div>
          <label className="label">Custom Domain</label>
          <div className="flex items-center gap-2">
            <input type="text" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} className="input flex-1" />
            <button className="btn-secondary">Verify</button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-green-500" /> Domain verified — DNS records configured correctly
          </p>
        </div>

        <div>
          <label className="label">Global Custom CSS</label>
          <textarea
            value={customCss}
            onChange={(e) => setCustomCss(e.target.value)}
            className="input font-mono text-xs"
            rows={5}
            placeholder=".survey-container { border-radius: 16px; }"
          />
        </div>

        <div className="pt-4 border-t border-slate-100">
          <button className="btn-primary">Save Branding</button>
        </div>
      </div>
    </div>
  );
}

function ComplianceSettings() {
  const [gdprEnabled, setGdprEnabled] = useState(true);
  const [ccpaEnabled, setCcpaEnabled] = useState(true);
  const [consentBanner, setConsentBanner] = useState(true);
  const [dataProcessingAgreement, setDataProcessingAgreement] = useState(true);

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-teal-500" />
          <h3 className="section-title">Regulatory Compliance</h3>
        </div>

        <div className="space-y-3">
          <ComplianceToggle
            title="GDPR Compliance"
            description="EU data protection — consent collection, right to access, right to erasure"
            checked={gdprEnabled}
            onChange={setGdprEnabled}
          />
          <ComplianceToggle
            title="CCPA Compliance"
            description="California Consumer Privacy Act — right to know, delete, and opt-out"
            checked={ccpaEnabled}
            onChange={setCcpaEnabled}
          />
          <ComplianceToggle
            title="Consent Banner"
            description="Show GDPR/CCPA consent banner before survey collection"
            checked={consentBanner}
            onChange={setConsentBanner}
          />
          <ComplianceToggle
            title="Data Processing Agreement"
            description="Signed DPA with Pulse — required for EU data processing"
            checked={dataProcessingAgreement}
            onChange={setDataProcessingAgreement}
          />
        </div>
      </div>

      <div className="card p-6">
        <h3 className="section-title mb-4">Encryption & Security</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-slate-500" />
              <p className="text-sm font-medium text-slate-700">AES-256 at Rest</p>
            </div>
            <p className="text-xs text-slate-400">All response data is encrypted with AES-256-GCM</p>
            <span className="badge-green mt-2"><Check className="w-3 h-3" /> Enabled</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-50">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-slate-500" />
              <p className="text-sm font-medium text-slate-700">TLS 1.3 in Transit</p>
            </div>
            <p className="text-xs text-slate-400">All API and survey traffic uses TLS 1.3</p>
            <span className="badge-green mt-2"><Check className="w-3 h-3" /> Enabled</span>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="section-title mb-4">Data Subject Rights</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
            <div>
              <p className="text-sm font-medium text-slate-700">Right to Erasure</p>
              <p className="text-xs text-slate-400">Permanently delete a respondent's data on request</p>
            </div>
            <button className="btn-secondary text-xs">Process Request</button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
            <div>
              <p className="text-sm font-medium text-slate-700">Right to Data Export</p>
              <p className="text-xs text-slate-400">Export all data for a specific respondent (portability)</p>
            </div>
            <button className="btn-secondary text-xs"><Download className="w-3.5 h-3.5" /> Export</button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
            <div>
              <p className="text-sm font-medium text-slate-700">Consent Withdrawal</p>
              <p className="text-xs text-slate-400">Allow respondents to withdraw consent retroactively</p>
            </div>
            <Toggle checked={true} onChange={() => {}} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ComplianceToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
      <div>
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function IntegrationsSettings() {
  const integrations = [
    { name: 'Slack', description: 'Get survey response notifications in Slack channels', connected: true, icon: '💬', color: '#4A154B' },
    { name: 'Zapier', description: 'Connect surveys to 5,000+ apps via Zapier triggers', connected: true, icon: '⚡', color: '#FF4A00' },
    { name: 'Salesforce', description: 'Sync survey responses to Salesforce objects', connected: false, icon: '☁️', color: '#00A1E0' },
    { name: 'HubSpot', description: 'Push response data to HubSpot contacts and deals', connected: false, icon: '🟠', color: '#FF7A59' },
    { name: 'Mailchimp', description: 'Trigger email campaigns based on survey responses', connected: true, icon: '📧', color: '#FFE01B' },
    { name: 'Twilio SMS', description: 'Send survey invitations and reminders via SMS', connected: true, icon: '📱', color: '#F22F46' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((int) => (
          <div key={int.name} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg">
                  {int.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">{int.name}</h3>
                  {int.connected ? (
                    <span className="badge-green text-[10px] mt-0.5"><Check className="w-3 h-3" /> Connected</span>
                  ) : (
                    <span className="badge-slate text-[10px] mt-0.5">Not connected</span>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-4">{int.description}</p>
            <button className={int.connected ? 'btn-secondary w-full text-xs' : 'btn-primary w-full text-xs'}>
              {int.connected ? 'Configure' : 'Connect'}
            </button>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Webhook className="w-5 h-5 text-sky-500" />
          <h3 className="section-title">Webhook Endpoints</h3>
        </div>
        <p className="text-sm text-slate-500 mb-4">Receive real-time event notifications at your endpoints</p>
        <div className="space-y-2">
          {[
            { url: 'https://api.acmeretail.com/webhooks/survey-events', events: 'response.created, response.completed', status: 'active' },
            { url: 'https://hooks.acmeretail.com/nps-updates', events: 'nps.calculated', status: 'active' },
          ].map((hook) => (
            <div key={hook.url} className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
              <div>
                <code className="text-xs font-mono text-slate-600">{hook.url}</code>
                <p className="text-xs text-slate-400 mt-0.5">Events: {hook.events}</p>
              </div>
              <span className="badge-green"><Check className="w-3 h-3" /> Active</span>
            </div>
          ))}
          <button className="btn-secondary text-xs w-full">
            <Webhook className="w-3.5 h-3.5" /> Add Webhook
          </button>
        </div>
      </div>
    </div>
  );
}

function SecuritySettings() {
  const [twoFactor, setTwoFactor] = useState(true);
  const [ssoEnabled, setSsoEnabled] = useState(true);
  const [ipAllowlist, setIpAllowlist] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('30');

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <h3 className="section-title">Authentication</h3>

        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
          <div>
            <p className="text-sm font-medium text-slate-700">Two-Factor Authentication</p>
            <p className="text-xs text-slate-400">Require 2FA for all team members</p>
          </div>
          <Toggle checked={twoFactor} onChange={setTwoFactor} />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
          <div>
            <p className="text-sm font-medium text-slate-700">SSO / SAML</p>
            <p className="text-xs text-slate-400">Single sign-on via your identity provider</p>
          </div>
          <Toggle checked={ssoEnabled} onChange={setSsoEnabled} />
        </div>

        <div>
          <label className="label">Session Timeout (minutes)</label>
          <select value={sessionTimeout} onChange={(e) => setSessionTimeout(e.target.value)} className="input w-48">
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="240">4 hours</option>
          </select>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
          <div>
            <p className="text-sm font-medium text-slate-700">IP Allowlist</p>
            <p className="text-xs text-slate-400">Restrict API access to specific IP addresses</p>
          </div>
          <Toggle checked={ipAllowlist} onChange={setIpAllowlist} />
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Server className="w-5 h-5 text-sky-500" />
          <h3 className="section-title">Infrastructure & Scalability</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50">
            <p className="text-2xl font-bold font-display text-slate-700">10,000+</p>
            <p className="text-xs text-slate-400 mt-1">Concurrent users supported</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50">
            <p className="text-2xl font-bold font-display text-teal-600">&lt;1.5s</p>
            <p className="text-xs text-slate-400 mt-1">Survey load time</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50">
            <p className="text-2xl font-bold font-display text-green-600">99.9%</p>
            <p className="text-xs text-slate-400 mt-1">Uptime SLA</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataRetentionSettings() {
  const [retentionPeriod, setRetentionPeriod] = useState('365');
  const [autoDelete, setAutoDelete] = useState(true);
  const [anonymizeAfter, setAnonymizeAfter] = useState(false);

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-5">
        <h3 className="section-title">Data Retention Policy</h3>

        <div>
          <label className="label">Retention Period</label>
          <select value={retentionPeriod} onChange={(e) => setRetentionPeriod(e.target.value)} className="input w-64">
            <option value="90">90 days</option>
            <option value="180">180 days</option>
            <option value="365">1 year</option>
            <option value="730">2 years</option>
            <option value="1825">5 years</option>
            <option value="0">Indefinite</option>
          </select>
          <p className="text-xs text-slate-400 mt-1.5">Response data will be automatically deleted after this period</p>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
          <div>
            <p className="text-sm font-medium text-slate-700">Auto-Delete Expired Data</p>
            <p className="text-xs text-slate-400">Automatically remove responses past their retention period</p>
          </div>
          <Toggle checked={autoDelete} onChange={setAutoDelete} />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
          <div>
            <p className="text-sm font-medium text-slate-700">Anonymize After 90 Days</p>
            <p className="text-xs text-slate-400">Strip PII from responses while keeping aggregate data</p>
          </div>
          <Toggle checked={anonymizeAfter} onChange={setAnonymizeAfter} />
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="section-title">Danger Zone</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 bg-red-50/50">
            <div>
              <p className="text-sm font-medium text-slate-700">Delete All Response Data</p>
              <p className="text-xs text-slate-400">Permanently delete all survey responses across all surveys</p>
            </div>
            <button className="btn-danger text-xs">
              <Trash2 className="w-3.5 h-3.5" /> Delete All
            </button>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 bg-red-50/50">
            <div>
              <p className="text-sm font-medium text-slate-700">Close & Archive All Surveys</p>
              <p className="text-xs text-slate-400">Stop all active surveys and archive them</p>
            </div>
            <button className="btn-danger text-xs">Archive All</button>
          </div>
        </div>
      </div>
    </div>
  );
}
