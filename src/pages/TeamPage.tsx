import { useEffect, useState } from 'react';
import {
  Users,
  Key,
  ScrollText,
  Plus,
  MoreVertical,
  Trash2,
  Copy,
  Check,
  Shield,
  UserPlus,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { api } from '@/services/api';
import type { TeamMember, ApiKey, AuditLogEntry, Role } from '@/types';
import { Spinner, PageHeader, StatusBadge, Avatar, Modal, Toggle } from '@/components/ui';

const roleColors: Record<Role, string> = {
  'Super Admin': '#0ea5e9',
  'Org Admin': '#0d9488',
  'Survey Manager': '#6366f1',
  Editor: '#f59e0b',
  Analyst: '#ec4899',
};

const rolePermissions: Record<Role, string[]> = {
  'Super Admin': ['Full system access', 'Manage all organizations', 'Manage billing', 'Delete any resource'],
  'Org Admin': ['Manage organization', 'Invite team members', 'Manage all surveys', 'View audit logs'],
  'Survey Manager': ['Create & edit surveys', 'Manage event bindings', 'View analytics', 'Publish surveys'],
  Editor: ['Edit survey content', 'Preview surveys', 'Cannot publish', 'Cannot delete'],
  Analyst: ['View analytics', 'Export reports', 'View responses', 'No edit access'],
};

export function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'members' | 'apikeys' | 'audit' | 'roles'>('members');
  const [showInvite, setShowInvite] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getTeamMembers(), api.getApiKeys(), api.getAuditLog()]).then(
      ([m, k, a]) => {
        setMembers(m);
        setKeys(k);
        setAudit(a);
        setLoading(false);
      }
    );
  }, []);

  function copyText(text: string) {
    navigator.clipboard?.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  if (loading) return <Spinner />;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Team & Access Control"
        subtitle="Manage team members, roles, API keys, and audit trails"
        actions={
          tab === 'members' && (
            <button className="btn-primary" onClick={() => setShowInvite(true)}>
              <UserPlus className="w-4 h-4" /> Invite Member
            </button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-white border border-slate-200 rounded-lg p-1 w-fit">
        {([
          { id: 'members', label: 'Team Members', icon: Users },
          { id: 'roles', label: 'Roles & Permissions', icon: Shield },
          { id: 'apikeys', label: 'API Keys', icon: Key },
          { id: 'audit', label: 'Audit Log', icon: ScrollText },
        ] as const).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition ${
                tab === t.id ? 'bg-sky-50 text-sky-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Team Members */}
      {tab === 'members' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Member</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Active</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name} color={m.avatarColor} size={36} />
                        <div>
                          <p className="text-sm font-medium text-slate-700">{m.name}</p>
                          <p className="text-xs text-slate-400">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="badge" style={{ backgroundColor: `${roleColors[m.role]}15`, color: roleColors[m.role] }}>
                        {m.role}
                      </span>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={m.status} /></td>
                    <td className="px-5 py-3 text-xs text-slate-400">{m.lastActive}</td>
                    <td className="px-5 py-3 text-right">
                      <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition ml-auto">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roles & Permissions */}
      {tab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Object.keys(rolePermissions) as Role[]).map((role) => (
            <div key={role} className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${roleColors[role]}15` }}
                >
                  <Shield className="w-5 h-5" style={{ color: roleColors[role] }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">{role}</h3>
                  <p className="text-xs text-slate-400">
                    {members.filter((m) => m.role === role).length} member{members.filter((m) => m.role === role).length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {rolePermissions[role].map((perm) => (
                  <div key={perm} className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    {perm}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* API Keys */}
      {tab === 'apikeys' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Manage API keys for programmatic access to your surveys and data</p>
            <button className="btn-primary" onClick={() => setShowApiKey(true)}>
              <Plus className="w-4 h-4" /> Generate Key
            </button>
          </div>

          {keys.map((key) => (
            <div key={key.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Key className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">{key.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {key.prefix}{'•'.repeat(20)}
                      </code>
                      <button
                        onClick={() => setRevealKey(revealKey === key.id ? null : key.id)}
                        className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"
                      >
                        {revealKey === key.id ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => copyText(`${key.prefix}••••••••••••••••`)}
                        className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"
                      >
                        {copiedKey?.startsWith(key.prefix) ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
                <StatusBadge status={key.status} />
              </div>

              <div className="flex items-center gap-2 flex-wrap mb-3">
                {key.scopes.map((scope) => (
                  <span key={scope} className="badge-slate font-mono text-xs">{scope}</span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-400">
                <span>Created {new Date(key.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span>Last used {key.lastUsed || 'Never'}</span>
                {key.status === 'active' && (
                  <button className="text-red-500 hover:text-red-600 font-medium flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Audit Log */}
      {tab === 'audit' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="section-title">Audit Trail</h3>
            <span className="text-xs text-slate-400">All actions are logged and immutable</span>
          </div>
          <div className="divide-y divide-slate-100">
            {audit.map((entry) => (
              <div key={entry.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <ScrollText className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{entry.actor}</span>
                    <span className="text-sm text-slate-500">{entry.action}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {entry.target} • {entry.timestamp} • IP: {entry.ip}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <Modal open onClose={() => setShowInvite(false)} title="Invite Team Member" size="md">
          <div className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <input type="email" className="input" placeholder="colleague@company.com" />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input">
                {(Object.keys(rolePermissions) as Role[]).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="p-3 rounded-lg bg-sky-50 border border-sky-100 flex items-start gap-2">
              <Lock className="w-4 h-4 text-sky-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-600">
                An invitation email will be sent with a secure join link valid for 7 days.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setShowInvite(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => setShowInvite(false)} className="btn-primary">
                <UserPlus className="w-4 h-4" /> Send Invitation
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* API Key Modal */}
      {showApiKey && (
        <Modal open onClose={() => setShowApiKey(false)} title="Generate API Key" size="md">
          <div className="space-y-4">
            <div>
              <label className="label">Key Name</label>
              <input type="text" className="input" placeholder="e.g. Production Integration" />
            </div>
            <div>
              <label className="label">Scopes</label>
              <div className="space-y-2">
                {['surveys:read', 'surveys:write', 'events:write', 'responses:read', 'analytics:read'].map((scope) => (
                  <label key={scope} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                    <input type="checkbox" className="rounded" defaultChecked={scope.includes('read')} />
                    <code className="text-xs font-mono text-slate-600">{scope}</code>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setShowApiKey(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => setShowApiKey(false)} className="btn-primary">
                <Key className="w-4 h-4" /> Generate Key
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
