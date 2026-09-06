import { useState, useEffect } from 'react';
import { Sidebar, type Page } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { DashboardPage } from '@/pages/DashboardPage';
import { SurveysPage } from '@/pages/SurveysPage';
import { BuilderPage } from '@/pages/BuilderPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { EventsPage } from '@/pages/EventsPage';
import { TeamPage } from '@/pages/TeamPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SurveyTakePage } from '@/pages/SurveyTakePage';

const pageTitles: Record<Page, string> = {
  dashboard: 'Dashboard',
  surveys: 'Surveys',
  builder: 'Survey Builder',
  analytics: 'Analytics',
  events: 'Event Engine',
  team: 'Team & Access',
  settings: 'Settings',
};

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [params, setParams] = useState<Record<string, string>>({});
  const [shortCode, setShortCode] = useState<string | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/s\/([A-Za-z0-9]+)/);
    if (match) {
      setShortCode(match[1]);
    }
  }, []);

  function navigate(next: Page, p?: Record<string, string>) {
    setPage(next);
    setParams(p || {});
  }

  const isBuilder = page === 'builder';

  if (shortCode) {
    return <SurveyTakePage shortCode={shortCode} />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar current={page} onNavigate={(p) => navigate(p)} />
      <div className="flex-1 flex flex-col min-w-0">
        {isBuilder ? (
          <BuilderPage surveyId={params.id} onNavigate={navigate} />
        ) : (
          <>
            <Topbar title={pageTitles[page]} />
            <main className="flex-1 overflow-y-auto scrollbar-thin">
              {page === 'dashboard' && <DashboardPage onNavigate={navigate} />}
              {page === 'surveys' && <SurveysPage onNavigate={navigate} />}
              {page === 'analytics' && <AnalyticsPage />}
              {page === 'events' && <EventsPage />}
              {page === 'team' && <TeamPage />}
              {page === 'settings' && <SettingsPage />}
            </main>
          </>
        )}
      </div>
    </div>
  );
}
