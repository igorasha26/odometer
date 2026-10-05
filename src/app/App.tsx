import { useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  Gauge, LayoutDashboard, Receipt, FileText, Car, Settings2, Plus,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { StoreProvider, useStore } from './store';
import { useTheme } from './theme';
import { repository } from '../repository';
import { DashboardPage } from '../pages/DashboardPage';
import { EntriesPage } from '../pages/EntriesPage';
import { DocumentsPage } from '../pages/DocumentsPage';
import { CarsPage } from '../pages/CarsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { EntryDialog } from '../shared/ui/EntryDialog';
import { Onboarding } from '../shared/ui/Onboarding';
import { AuthScreen } from '../shared/ui/AuthScreen';

const NAV = [
  { to: '/', label: 'Обзор', icon: LayoutDashboard, end: true },
  { to: '/entries', label: 'Расходы', icon: Receipt, end: false },
  { to: '/documents', label: 'Документы', icon: FileText, end: false },
  { to: '/cars', label: 'Гараж', icon: Car, end: false },
  { to: '/settings', label: 'Настройки', icon: Settings2, end: false },
];

function Shell() {
  const { activeCar, categories, settings, user, hasUsers, loading, refreshing, refresh } = useStore();
  const [isEntryOpen, setEntryOpen] = useState(false);
  const location = useLocation();

  useTheme(settings?.theme ?? 'system');

  const collapsed = settings?.sidebarCollapsed ?? false;
  const needsOnboarding = settings !== undefined && !settings.onboardingDone;
  const showFab = activeCar && ['/', '/entries'].includes(location.pathname);

  async function toggleSidebar() {
    await repository.settings.update({ sidebarCollapsed: !collapsed });
    refresh();
  }

  if (loading) return null;
  if (!user) return <AuthScreen hasUsers={hasUsers} onDone={refresh} />;

  return (
    <div className="shell" data-collapsed={collapsed}>
      <aside className="sidebar">
        <div className="brand">
          {!collapsed && (
            <>
              <Gauge size={22} />
              <span className="brand-text">Одометр</span>
            </>
          )}
          <button
            className="icon-btn sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
            title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </button>
        </div>

        <nav className="nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} title={label}>
              <Icon />
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          Данные хранятся в этом браузере. Делайте экспорт в настройках.
        </div>
      </aside>

      <main className="main" data-refreshing={refreshing}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/entries" element={<EntriesPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/reminders" element={<Navigate to="/documents" replace />} />
          <Route path="/cars" element={<CarsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {showFab && (
        <button className="fab" onClick={() => setEntryOpen(true)} aria-label="Добавить расход">
          <Plus />
        </button>
      )}

      {needsOnboarding && <Onboarding userId={user.id} onDone={refresh} />}

      {isEntryOpen && activeCar && (
        <EntryDialog
          car={activeCar}
          categories={categories}
          onClose={() => setEntryOpen(false)}
          onSaved={() => { setEntryOpen(false); refresh(); }}
        />
      )}
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Shell />
      </BrowserRouter>
    </StoreProvider>
  );
}
