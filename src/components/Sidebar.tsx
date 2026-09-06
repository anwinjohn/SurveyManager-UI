import { useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  MousePointerClick,
  BarChart3,
  Radio,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export type Page =
  | 'dashboard'
  | 'surveys'
  | 'builder'
  | 'analytics'
  | 'events'
  | 'team'
  | 'settings';

interface NavItem {
  id: Page;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'surveys', label: 'Surveys', icon: FileText, badge: '6' },
  { id: 'builder', label: 'Survey Builder', icon: MousePointerClick },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'events', label: 'Event Engine', icon: Radio, badge: '4' },
  { id: 'team', label: 'Team & Access', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({
  current,
  onNavigate,
}: {
  current: Page;
  onNavigate: (page: Page) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-60'} flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-200 h-screen sticky top-0`}
    >
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-slate-100 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-display font-bold text-slate-900 leading-tight">Pulse</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Survey Manager</p>
          </div>
        )}
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`nav-item w-full ${active ? 'nav-item-active' : 'nav-item-inactive'} ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
              {!collapsed && item.badge && (
                <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t border-slate-100 flex-shrink-0">
        {!collapsed && (
          <div className="px-3 py-2.5 rounded-lg bg-gradient-to-br from-sky-50 to-teal-50 border border-sky-100">
            <p className="text-xs font-semibold text-sky-700">Acme Retail</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Enterprise Plan</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="nav-item nav-item-inactive w-full mt-2 justify-center"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
