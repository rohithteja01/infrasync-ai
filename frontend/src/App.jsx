import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Activity,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  User,
  Settings,
  Layers,
  Sparkles,
  FileText,
  HardHat,
  CalendarRange,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import ActivityIntelligenceView from './components/ActivityIntelligenceView';
import ProjectIntelligenceView from './components/ProjectIntelligenceView';
import InfrasyncAIView from './components/InfrasyncAIView';
import PDFReportView from './components/PDFReportView';
import ProfileView from './components/ProfileView';
import SettingsView from './components/SettingsView';
import ExecutionCaptureViewer from './components/ExecutionCaptureViewer';
import LoginView from './components/LoginView';
import RoleSelectionView from './components/RoleSelectionView';
import { supabase } from './lib/supabaseClient';
import { authFetch } from './lib/apiClient';

const NAV_ITEMS = [
  { id: 'project-intelligence', label: 'Project Intelligence', icon: Briefcase },
  { id: 'infrasync-ai', label: 'OIL AI Assistant', icon: Sparkles },
  { id: 'activity-intelligence', label: 'Workflow Pipeline', icon: Layers },
  { id: 'pdf-report', label: 'PDF Report', icon: FileText },
];

const ROLE_DISPLAY = {
  SUPERVISOR: {
    name: 'Supervisor',
    badge: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    icon: HardHat
  },
  PLANNER: {
    name: 'Planner',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    icon: CalendarRange
  },
  PROJECT_MANAGER: {
    name: 'Project Manager',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
    icon: Briefcase
  }
};

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('project-intelligence'); // Default to User-First Project Intelligence
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [projectContext, setProjectContext] = useState(null);
  const [accountDeletedNotice, setAccountDeletedNotice] = useState(null);

  // Initialize Supabase Auth Session and subscribe to auth state changes
  useEffect(() => {
    let isMounted = true;

    // Check active session on initial load
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (isMounted) {
        setSession(initialSession);
        setAuthLoading(false);
      }
    }).catch((err) => {
      console.error('Failed to get Supabase auth session:', err);
      if (isMounted) {
        setAuthLoading(false);
      }
    });

    // Listen for real-time auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isMounted) {
        setSession(newSession);
        setAuthLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Fetch confirmed role profile whenever session changes
  useEffect(() => {
    if (!session || !session.access_token) {
      setUserRole(null);
      setRoleLoading(false);
      return;
    }

    let isMounted = true;
    const fetchProfile = async () => {
      setRoleLoading(true);
      try {
        const res = await fetch('/api/auth/profile', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setUserRole(data.role || null);
          }
        } else {
          if (isMounted) {
            setUserRole(null);
          }
        }
      } catch (err) {
        console.error('Failed to fetch user role profile:', err);
        if (isMounted) {
          setUserRole(null);
        }
      } finally {
        if (isMounted) {
          setRoleLoading(false);
        }
      }
    };

    fetchProfile();
    return () => { isMounted = false; };
  }, [session]);

  // Initialize and listen to saved theme
  useEffect(() => {
    const applyTheme = () => {
      const savedTheme = localStorage.getItem('infrasync_theme') || 'light';
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    applyTheme();
    window.addEventListener('themechange', applyTheme);
    return () => window.removeEventListener('themechange', applyTheme);
  }, []);

  // Restore active project context from persistent backend storage on mount/refresh (when authenticated)
  useEffect(() => {
    if (!session) return;
    let isMounted = true;
    const restoreActiveProject = async () => {
      try {
        const res = await authFetch('/api/files/active');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.active && data.projectContext) {
            setProjectContext(data.projectContext);
          }
        }
      } catch (err) {
        console.error('Failed to restore persistent project context:', err);
      }
    };
    restoreActiveProject();
    return () => { isMounted = false; };
  }, [session]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Failed to sign out from Supabase:', err);
    } finally {
      setSession(null);
      setUserRole(null);
      setAccountDeletedNotice(null);
    }
  };

  const handleAccountDeleted = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Failed to sign out after account deletion:', err);
    } finally {
      setSession(null);
      setUserRole(null);
      setProjectContext(null);
      setAccountDeletedNotice('Your account has been permanently deleted.');
    }
  };

  const handleRoleChange = (newRole) => {
    setUserRole(newRole);
    if (newRole === 'PROJECT_MANAGER' && activeTab === 'execution-capture') {
      setActiveTab('project-intelligence');
    }
  };

  // Auth Loading State
  if (authLoading || (session && roleLoading)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 select-none">
        <div className="w-10 h-10 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white text-sm shadow-sm mb-4">
          OIL
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
          <span className="w-2 h-2 rounded-full bg-brand-600 animate-ping"></span>
          <span>{authLoading ? 'Verifying OIL AI workspace session...' : 'Loading verified operational role...'}</span>
        </div>
      </div>
    );
  }

  // Unauthenticated -> Render Login Page
  if (!session) {
    return (
      <LoginView
        onLoginSuccess={(userSession) => {
          setAccountDeletedNotice(null);
          setSession(userSession);
        }}
        initialNotice={accountDeletedNotice}
      />
    );
  }

  // Authenticated BUT Role not assigned -> Render Role Selection View
  if (!userRole) {
    return (
      <RoleSelectionView
        userEmail={session.user?.email}
        onRoleConfirmed={(confirmedRole) => {
          setUserRole(confirmedRole);
          if (confirmedRole === 'PROJECT_MANAGER' && activeTab === 'execution-capture') {
            setActiveTab('project-intelligence');
          }
        }}
        onLogout={handleLogout}
      />
    );
  }

  const roleMeta = ROLE_DISPLAY[userRole] || {
    name: userRole,
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
    icon: User
  };
  const RoleHeaderIcon = roleMeta.icon;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      {/* Collapsible Left Sidebar */}
      <aside
        className={`bg-slate-900 border-r border-slate-800 text-white flex flex-col flex-shrink-0 sticky top-0 h-screen z-30 transition-[width] duration-200 ease-in-out select-none ${
          sidebarOpen ? 'w-64' : 'w-[70px]'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          {sidebarOpen ? (
            <>
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-8 h-8 rounded bg-brand-600 flex items-center justify-center font-bold text-white text-xs shadow-sm flex-shrink-0" title="OIL AI Project Intelligence">
                  OIL
                </div>
                <div className="min-w-0 overflow-hidden">
                  <div className="flex items-center space-x-1.5">
                    <h1 className="text-sm font-bold tracking-tight text-white truncate">OIL AI</h1>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.2 rounded font-mono flex-shrink-0">
                      v1.0.0
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 mt-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border truncate ${roleMeta.badge}`}>
                      {roleMeta.name}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors flex-shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="w-full flex justify-center items-center">
              <div className="relative group w-8 h-8 flex items-center justify-center">
                {/* Logo mark */}
                <div
                  className="w-8 h-8 rounded bg-brand-600 flex items-center justify-center font-bold text-white text-xs shadow-sm transition-opacity duration-150 group-hover:opacity-0 group-focus-within:opacity-0"
                  title="OIL AI Project Intelligence"
                >
                  OIL
                </div>

                {/* Expand button */}
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open sidebar"
                  className="absolute inset-0 w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-all duration-150 border border-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Navigation */}
        <nav className={`flex-1 py-4 space-y-1.5 overflow-y-auto ${sidebarOpen ? 'px-3' : 'px-2 flex flex-col items-center'}`}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                title={!sidebarOpen ? item.label : undefined}
                aria-label={item.label}
                className={`flex items-center rounded-lg text-xs transition-all ${
                  sidebarOpen
                    ? `w-full space-x-3 px-3 py-2.5 text-left font-medium ${
                        isActive
                          ? 'bg-brand-600 text-white shadow-sm font-semibold'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                      }`
                    : `w-10 h-10 justify-center ${
                        isActive
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Current Role Display */}
        {sidebarOpen ? (
          <div className="px-4 py-2.5 border-t border-slate-800/80">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              Current Role
            </span>
            <div className="text-xs font-semibold text-slate-200 flex items-center space-x-2 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${
                userRole === 'SUPERVISOR'
                  ? 'bg-amber-400'
                  : userRole === 'PROJECT_MANAGER'
                  ? 'bg-indigo-400'
                  : 'bg-emerald-400'
              }`} />
              <span>{roleMeta.name}</span>
            </div>
          </div>
        ) : (
          <div
            className="py-2.5 border-t border-slate-800/80 flex justify-center"
            title={`Current Role: ${roleMeta.name}`}
          >
            <span className={`w-2 h-2 rounded-full ${
              userRole === 'SUPERVISOR'
                ? 'bg-amber-400'
                : userRole === 'PROJECT_MANAGER'
                ? 'bg-indigo-400'
                : 'bg-emerald-400'
            }`} />
          </div>
        )}

        {/* Sidebar Bottom Navigation — Profile & Settings */}
        <div className={`py-2 border-t border-slate-800/80 space-y-1 ${sidebarOpen ? 'px-3' : 'px-2 flex flex-col items-center'}`}>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            title={!sidebarOpen ? 'Profile' : undefined}
            aria-label="Profile"
            className={`flex items-center rounded-lg text-xs transition-all ${
              sidebarOpen
                ? `w-full space-x-3 px-3 py-2.5 text-left font-medium ${
                    activeTab === 'profile'
                      ? 'bg-brand-600 text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`
                : `w-10 h-10 justify-center ${
                    activeTab === 'profile'
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`
            }`}
          >
            <User className="w-4 h-4 flex-shrink-0" />
            {sidebarOpen && <span className="truncate">Profile</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            title={!sidebarOpen ? 'Settings' : undefined}
            aria-label="Settings"
            className={`flex items-center rounded-lg text-xs transition-all ${
              sidebarOpen
                ? `w-full space-x-3 px-3 py-2.5 text-left font-medium ${
                    activeTab === 'settings'
                      ? 'bg-brand-600 text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`
                : `w-10 h-10 justify-center ${
                    activeTab === 'settings'
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`
            }`}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            {sidebarOpen && <span className="truncate">Settings</span>}
          </button>
        </div>

        {/* Sidebar Bottom / Status Footer */}
        <div className={`p-3 border-t border-slate-800 text-[11px] text-slate-400 ${sidebarOpen ? '' : 'flex justify-center'}`}>
          {sidebarOpen ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>System Online</span>
              </div>
              <span className="font-mono text-[10px] text-slate-500">:8000</span>
            </div>
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="System Online (localhost:8000)" />
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 font-medium">OIL AI Project Intelligence</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {activeTab === 'project-intelligence'
                ? 'Project Intelligence'
                : activeTab === 'execution-capture'
                ? 'Execution Capture'
                : activeTab === 'infrasync-ai'
                ? 'OIL AI Assistant'
                : activeTab === 'activity-intelligence'
                ? 'Workflow Pipeline'
                : activeTab === 'profile'
                ? 'Profile'
                : activeTab === 'settings'
                ? 'Settings'
                : 'System Foundation'}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {/* Active Operational Role Badge in Header */}
            <span className={`inline-flex items-center space-x-1.5 text-xs font-bold px-2.5 py-1 rounded border ${roleMeta.badge}`}>
              <RoleHeaderIcon className="w-3.5 h-3.5" />
              <span>{roleMeta.name}</span>
            </span>

            {(activeTab === 'activity-intelligence' || activeTab === 'infrasync-ai' || activeTab === 'execution-capture') && (
              <button
                type="button"
                onClick={() => setActiveTab('project-intelligence')}
                className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium hidden sm:inline-block cursor-pointer"
              >
                ← Return to Project Intelligence
              </button>
            )}
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hidden sm:inline-block">
              localhost:5173 ↔ localhost:8000
            </span>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {activeTab === 'project-intelligence' && (
            <section>
              <ProjectIntelligenceView
                externalResult={projectContext}
                onResultUpdate={setProjectContext}
                onClearProject={() => setProjectContext(null)}
                onOpenAdvancedPipeline={() => setActiveTab('activity-intelligence')}
                onOpenInfrasyncAI={() => setActiveTab('infrasync-ai')}
                userRole={userRole}
              />
            </section>
          )}

          {activeTab === 'execution-capture' && (
            <section>
              {userRole === 'PROJECT_MANAGER' ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Access Restricted</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Direct field execution capture is reserved for Supervisors and Planners. As Project Manager, view the analyzed progress and risk forecasts in Project Intelligence.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('project-intelligence')}
                    className="mt-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Return to Project Intelligence
                  </button>
                </div>
              ) : (
                <ExecutionCaptureViewer
                  projectContext={projectContext}
                  selectedFile={projectContext?.files_processed?.[0] || projectContext?.files?.[0]}
                />
              )}
            </section>
          )}

          {activeTab === 'infrasync-ai' && (
            <section>
              <InfrasyncAIView
                context={projectContext}
                onNavigateToProjectIntelligence={() => setActiveTab('project-intelligence')}
              />
            </section>
          )}

          {activeTab === 'activity-intelligence' && (
            <section>
              <ActivityIntelligenceView
                projectContext={projectContext}
                onResultUpdate={setProjectContext}
                onClearProject={() => setProjectContext(null)}
                onNavigateToProjectIntelligence={() => setActiveTab('project-intelligence')}
                userRole={userRole}
              />
            </section>
          )}

          {activeTab === 'pdf-report' && (
            <section>
              <PDFReportView
                projectContext={projectContext}
                onNavigateToProjectIntelligence={() => setActiveTab('project-intelligence')}
              />
            </section>
          )}

          {activeTab === 'profile' && (
            <section>
              <ProfileView
                projectContext={projectContext}
                user={session?.user}
                userRole={userRole}
                onLogout={handleLogout}
              />
            </section>
          )}

          {activeTab === 'settings' && (
            <section>
              <SettingsView
                userRole={userRole}
                userEmail={session?.user?.email}
                onRoleChanged={handleRoleChange}
                onAccountDeleted={handleAccountDeleted}
              />
            </section>
          )}

          {activeTab === 'foundation' && (
            <section>
              <SettingsView
                userRole={userRole}
                initialTab="foundation"
                userEmail={session?.user?.email}
                onRoleChanged={handleRoleChange}
                onAccountDeleted={handleAccountDeleted}
              />
            </section>
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
            <div>
              <span>OIL AI Project Intelligence — Infrastructure Planning-to-Execution Platform</span>
            </div>
            <div className="flex items-center space-x-4">
              <span>FastAPI • PostgreSQL • React • Vite • Tailwind</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
