import { Bell, Search, HelpCircle, ChevronDown } from 'lucide-react';
import { Avatar } from './ui';

export function Topbar({ title }: { title: string }) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search surveys, events..."
            className="w-64 pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition"
          />
        </div>

        <button className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition relative">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <button className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
          <HelpCircle className="w-[18px] h-[18px]" />
        </button>

        <div className="h-6 w-px bg-slate-200" />

        <button className="flex items-center gap-2.5 hover:bg-slate-50 rounded-lg px-2 py-1 transition">
          <Avatar name="Sarah Chen" color="#0ea5e9" size={32} />
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-slate-700 leading-tight">Sarah Chen</p>
            <p className="text-[11px] text-slate-400 leading-tight">Super Admin</p>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
        </button>
      </div>
    </header>
  );
}
