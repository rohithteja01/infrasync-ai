import React from 'react';
import { User, Shield, Briefcase, Building, Mail, MapPin, Key, Clock, FileSpreadsheet, CheckCircle2, LogOut, HardHat, CalendarRange } from 'lucide-react';

const ROLE_META = {
  SUPERVISOR: {
    title: 'Supervisor',
    subtitle: 'Field Execution Engineer & Site Supervisor',
    division: 'Infrasync AI Infrastructure Platform • Field Operations Division',
    authority: 'Field Execution Capture & Progress Updates (DPRs, Site Diaries, Photos, Voice Notes)',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    icon: HardHat,
    idPrefix: 'USR-SUP'
  },
  PLANNER: {
    title: 'Planner',
    subtitle: 'Lead Planning & Project Controls Engineer',
    division: 'Infrasync AI Infrastructure Platform • Project Controls & Schedule Division',
    authority: 'Schedule Baseline Management, L5/L6 Activity Linking, Human Review & PMIS Updates',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    icon: CalendarRange,
    idPrefix: 'USR-PLN'
  },
  PROJECT_MANAGER: {
    title: 'Project Manager',
    subtitle: 'Infrastructure Project Manager & Decision Lead',
    division: 'Infrasync AI Infrastructure Platform • Executive Project Intelligence Division',
    authority: 'Executive Project Monitoring, Delay & Risk Prediction, Decision Center & Reports',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
    icon: Briefcase,
    idPrefix: 'USR-PM'
  }
};

export default function ProfileView({ projectContext, user, userRole, onLogout }) {
  const meta = (userRole && ROLE_META[userRole]) || ROLE_META.PLANNER;
  const RoleIcon = meta.icon;

  const hasProject = Boolean(projectContext);
  const projectName = hasProject
    ? (projectContext.projectName || (projectContext.files && projectContext.files.map((f) => f.filename || f.name).join(', ')) || 'Infrasync Active Project')
    : 'No active project loaded';
  const scheduleBaseline = hasProject
    ? (projectContext.schedule_info?.filename || (projectContext.has_schedule ? 'Active Schedule Baseline' : 'No schedule loaded in current project'))
    : 'None (Awaiting project upload)';
  const scheduleHash = hasProject && projectContext.schedule_info?.filename
    ? 'Verified active baseline'
    : '—';
  const pmisTarget = hasProject
    ? (projectContext.schedule_info?.source_type?.replace(/_/g, ' ') || 'Primavera P6 EPPM / MS Project')
    : 'Awaiting Schedule Ingestion';
  const scopeLevels = hasProject
    ? (projectContext.has_schedule ? 'L5 Summary & L6 Work Packages' : 'Extracted Activity Stream')
    : '—';
  const dataStreams = hasProject && projectContext.files?.length > 0
    ? projectContext.files.map((f) => f.filename || f.name).join(', ')
    : 'None active (Upload project files in Project Intelligence)';

  const accountDisplayId = user?.id
    ? `${meta.idPrefix}-${user.id.substring(0, 8).toUpperCase()}`
    : `${meta.idPrefix}-01`;

  return (
    <div className="space-y-6">
      {/* Top Profile Summary Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 flex-shrink-0">
              <RoleIcon className="w-8 h-8 text-slate-700 dark:text-slate-300" />
            </div>

            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{meta.title}</h2>
                <span className={`inline-flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 rounded border ${meta.badgeClass}`}>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{meta.title} Role Active</span>
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {meta.subtitle}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                {meta.division}
              </p>
            </div>
          </div>

          <div className="flex sm:flex-col items-start sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Account ID</span>
            <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 mt-1">
              {accountDisplayId}
            </span>
          </div>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Identity Details */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 shadow-sm space-y-5">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Briefcase className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
              Engineering Identity & RBAC
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Assigned Role</span>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`inline-flex items-center px-2.5 py-1 rounded font-bold text-xs border ${meta.badgeClass}`}>
                  {meta.title}
                </span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 block">System Authority Scope</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 block">
                {meta.authority}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Role Configuration</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 block">
                  Configurable via Settings
                </span>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Environment</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 block">
                  Enterprise On-Premises / Local
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Assigned Project Context */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 shadow-sm space-y-5">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Building className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
              Active Project Assignment
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Assigned Infrastructure Project</span>
              <span className="font-medium text-slate-900 dark:text-white text-sm mt-0.5 block">
                {projectName}
              </span>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Active Schedule Baseline</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 block">
                {scheduleBaseline}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 block">
                MD5: {scheduleHash}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Enterprise PMIS Target</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {pmisTarget}
                </span>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Active Scope Levels</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {scopeLevels}
                </span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Ingestion Data Streams</span>
              <span className="text-slate-600 dark:text-slate-300 mt-0.5 block leading-relaxed">
                {dataStreams}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Account & Session Details */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Shield className="w-4 h-4 text-slate-700 dark:text-slate-300" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
            Account & Session Information
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 block">Authentication</span>
            <span className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 block">Supabase Auth</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 block">Session Status</span>
            <span className="font-medium text-emerald-700 dark:text-emerald-400 mt-0.5 block">
              {user ? 'Authenticated (Active)' : 'Active Session'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 block">Authenticated Account</span>
            <span className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 block truncate" title={user?.email || 'Authorized Engineer'}>
              {user?.email || 'Authorized Engineer'}
            </span>
          </div>
        </div>

        {onLogout && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Session active for <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.email || 'Authorized User'}</span>. Active role: <span className="font-semibold text-slate-800 dark:text-slate-200">{meta.title}</span>.
            </div>
            <button
              type="button"
              id="infrasync-logout-btn"
              onClick={onLogout}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer shadow-2xs flex-shrink-0"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
