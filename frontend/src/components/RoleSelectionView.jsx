import React, { useState } from 'react';
import {
  HardHat,
  CalendarRange,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  ShieldCheck,
  FileText,
  Layers,
  BarChart3,
  Clock,
  Sparkles,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export const ROLES = [
  {
    id: 'SUPERVISOR',
    title: 'Supervisor',
    tag: 'Field Execution',
    tagColor: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    iconColor: 'bg-amber-500 text-white',
    icon: HardHat,
    tagline: 'Submit field progress and execution updates.',
    description: 'Responsible for capturing real-time site events, submitting daily progress reports, site diaries, photographic evidence, and hands-free voice progress notes directly from the project site.',
    capabilities: [
      'Daily Progress Reports & Site Diaries',
      'Photo Evidence & Field Documentation',
      'Voice Progress & Live ASR Notes',
      'Execution Start / End Time Tracking'
    ]
  },
  {
    id: 'PLANNER',
    title: 'Planner',
    tag: 'Schedule & Planning Controls',
    tagColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    iconColor: 'bg-emerald-600 text-white',
    icon: CalendarRange,
    tagline: 'Review activity matching and manage schedules.',
    description: 'Responsible for master schedule baseline management, L5/L6 activity linking, multi-source matching governance, planner review cockpits, CPM critical path analysis, and PMIS schedule update synchronization.',
    capabilities: [
      'Schedule Baseline Upload (P6 / MSP / Excel)',
      'L5/L6 Activity Linking & Fuzzy/Semantic Matching',
      'Planner Human Review Cockpit Governance',
      'Validated CPM Schedule Updates & What-If'
    ]
  },
  {
    id: 'PROJECT_MANAGER',
    title: 'Project Manager',
    tag: 'Project Intelligence & Oversight',
    tagColor: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
    iconColor: 'bg-indigo-600 text-white',
    icon: Briefcase,
    tagline: 'View project intelligence and project status.',
    description: 'Responsible for executive project monitoring, tracking physical vs planned variance, delay detection and predictive risk forecasting, root cause analysis, decision center recommendations, and stakeholder PDF reporting.',
    capabilities: [
      'Executive Project Intelligence Dashboard',
      'Delay Detection & Predictive Risk Modeling',
      'Decision Center Recommendations & Recovery',
      'Comprehensive Stakeholder PDF Reports'
    ]
  }
];

export default function RoleSelectionView({
  userEmail,
  currentRole = null,
  onRoleConfirmed,
  onLogout,
  isModal = false,
  onClose = null
}) {
  const [selectedRole, setSelectedRole] = useState(
    currentRole ? ROLES.find((r) => r.id === currentRole) || null : null
  );
  const [confirmingRole, setConfirmingRole] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleCardClick = (roleObj) => {
    setErrorMsg(null);
    setSelectedRole(roleObj);
    setConfirmingRole(roleObj);
  };

  const handleConfirmRole = async () => {
    if (!confirmingRole || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.access_token) {
        throw new Error('Authentication session expired. Please sign in again.');
      }

      const res = await fetch('/api/auth/role', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: confirmingRole.id })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || `Failed to assign role (HTTP ${res.status}).`);
      }

      // Successful confirmation
      if (onRoleConfirmed) {
        onRoleConfirmed(confirmingRole.id, data.profile);
      }
    } catch (err) {
      console.error('Role assignment error:', err);
      setErrorMsg(err.message || 'An unexpected error occurred while confirming your role.');
      setIsSubmitting(false);
    }
  };

  const innerContent = (
    <>
      <div className="max-w-5xl w-full mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center font-bold text-white text-base shadow-sm mx-auto">
          OIL
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {isModal ? 'Change Role' : 'Select Your Role'}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          {isModal ? (
            <span>Select your operational role within Infrasync AI.</span>
          ) : (
            <span>
              Welcome, <span className="font-semibold text-slate-800 dark:text-slate-200">{userEmail || 'Engineer'}</span>. Select your primary operational role within Infrasync AI.
            </span>
          )}
        </p>
      </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="max-w-xl mx-auto p-4 rounded-lg bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800 dark:text-rose-300">
              <span className="font-semibold block mb-0.5">Role Assignment Failed</span>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {/* 3 Role Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ROLES.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole?.id === role.id;
            return (
              <div
                key={role.id}
                onClick={() => handleCardClick(role)}
                className={`relative flex flex-col rounded-xl p-6 transition-all duration-150 cursor-pointer bg-white dark:bg-slate-900 border ${
                  isSelected
                    ? 'border-brand-500 ring-2 ring-brand-500/20 shadow-md'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs hover:shadow-sm'
                }`}
              >
                {/* Top Badge & Icon */}
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${role.iconColor} shadow-xs`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${role.tagColor}`}>
                    {role.tag}
                  </span>
                </div>

                {/* Title & Tagline */}
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {role.title}
                </h3>
                <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 mt-1 mb-3">
                  "{role.tagline}"
                </p>

                {/* Description */}
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                  {role.description}
                </p>

                {/* Key Capabilities */}
                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Core Capabilities
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    {role.capabilities.map((cap, i) => (
                      <li key={i} className="flex items-start space-x-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span className="leading-tight">{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Select Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardClick(role);
                  }}
                  className={`mt-6 w-full py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>Select {role.title}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer controls for onboarding */}
        {!isModal && onLogout && (
          <div className="text-center pt-4">
            <button
              type="button"
              onClick={onLogout}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer underline"
            >
              Sign Out & Switch Account
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${confirmingRole.iconColor}`}>
                {React.createElement(confirmingRole.icon, { className: 'w-5 h-5' })}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm Your Role
                </h3>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Selected Role:</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{confirmingRole.title}</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2">
                  "{confirmingRole.tagline}"
                </p>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                <p className="text-sm font-medium">
                  Are you sure you want to continue as <span className="font-bold text-slate-900 dark:text-white">{confirmingRole.title}</span>?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmingRole(null)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmRole}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-colors flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Role</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
        <div className="relative bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-5xl w-full p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto my-auto">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          {innerContent}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 select-none transition-colors">
      {innerContent}
    </div>
  );
}
