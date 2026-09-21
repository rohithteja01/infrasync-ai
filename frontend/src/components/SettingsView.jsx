import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Sliders,
  Database,
  FileSpreadsheet,
  CheckCircle2,
  Cpu,
  Lock,
  Layers,
  Circle,
  Sun,
  Moon,
  Mic,
  Camera,
  AlertTriangle,
  Trash2,
  AlertCircle,
  RefreshCw,
  Activity,
  ShieldCheck
} from 'lucide-react';
import HealthStatus from './HealthStatus';
import RoleSelectionView from './RoleSelectionView';
import { supabase } from '../lib/supabaseClient';

const ARCHITECTURE_LAYERS = [
  { name: 'Project Foundation', desc: 'FastAPI, React + Vite, Tailwind CSS, PostgreSQL setup & Health API', status: 'completed' },
  { name: 'Data Ingestion Layer', desc: 'Excel spreadsheet, Daily Report, Site Diary (PDF/Excel), Document (PDF/Docx/Txt), Scanned PDF/Image OCR (Feature 2.29), Voice / ASR (Feature 2.30), Primavera / MSP Schedule (Feature 2.31), and Photo Evidence Ingestion (Feature A)', status: 'completed' },
  { name: 'Execution Capture Layer', desc: 'Daily execution logs, site diaries, documents, scanned progress OCR, hands-free voice recordings, photographic execution evidence (Feature A), and Time Agent conversational start/end execution events', status: 'completed' },
  { name: 'Activity Intelligence Layer', desc: 'Project activity master table, L5/L6 schedule register, Exact ID, Fuzzy, Semantic Matching, Granularity Resolution, New Activity Discovery, Confidence Validation & Planner Review (Feature 2.13)', status: 'completed' },
  { name: 'Validation & Governance', desc: 'Confidence scoring, validation classification, Planner Review inspection workspace, Contradiction Detection & Evidence Governance, and audit guardrails', status: 'completed' },
  { name: 'Schedule Linking Layer', desc: 'Execution-to-schedule mapping, quantity variance & baseline dependency relationships (Feature 2.15)', status: 'completed' },
  { name: 'Schedule Intelligence', desc: 'Critical path (Feature 2.16), delay detection (Feature 2.17), milestone / schedule health (Feature 2.18), delay prediction (Feature 2.19), root cause analysis (Feature 2.20), impact propagation (Feature 2.21), what-if simulator (Feature 2.22), recovery plans (Feature 2.23), and recommendations (Feature 2.24 completed)', status: 'completed' },
  { name: 'Decision Center', desc: 'Executive decision cockpit and unified management interface (Feature 2.25 completed)', status: 'completed' },
  { name: 'Validated Schedule / PMIS Update Layer', desc: 'Validation gate, blocked vs eligible discrepancy filtering, and safe simulated PMIS export without baseline mutation', status: 'completed' },
  { name: 'Institutional Memory', desc: 'Empirical knowledge retention, actual durations, bottlenecks, delay causes, and discipline productivity benchmarks', status: 'completed' },
];

export default function SettingsView({
  onAccountDeleted,
  initialTab = 'account',
  userRole = null,
  onRoleChanged = null,
  userEmail = ''
}) {
  const [activeSettingsTab, setActiveSettingsTab] = useState(initialTab);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('infrasync_theme') || 'light';
  });

  const [micEnabled, setMicEnabled] = useState(() => {
    return localStorage.getItem('infrasync_mic_enabled') !== 'false';
  });

  const [cameraEnabled, setCameraEnabled] = useState(() => {
    return localStorage.getItem('infrasync_camera_enabled') !== 'false';
  });

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('infrasync_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    window.dispatchEvent(new Event('themechange'));
  };

  const toggleMic = () => {
    setMicEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('infrasync_mic_enabled', String(next));
      return next;
    });
  };

  const toggleCamera = () => {
    setCameraEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('infrasync_camera_enabled', String(next));
      return next;
    });
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const handleDeleteAccount = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.access_token) {
        throw new Error('Authentication session expired. Please sign in again.');
      }

      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `Failed to delete account (HTTP ${res.status}).`);
      }

      setShowDeleteModal(false);
      if (onAccountDeleted) {
        onAccountDeleted();
      }
    } catch (err) {
      setDeleteError(err.message || 'An unexpected error occurred while deleting your account.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-700">
              <Settings className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-xl font-bold text-slate-900">Platform Settings</h2>
                <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-medium">
                  v1.0.0-final
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Configuration overview and local execution environment parameters
              </p>
            </div>
          </div>

          <div className="flex sm:flex-col items-start sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
            <span className="text-xs font-medium text-slate-500">Operation Mode</span>
            <span className="inline-flex items-center space-x-1.5 text-xs font-mono font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>100% Local / Offline</span>
            </span>
          </div>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          data-settings-tab="account"
          onClick={() => setActiveSettingsTab('account')}
          className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSettingsTab === 'account'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Account & Preferences</span>
        </button>

        <button
          type="button"
          data-settings-tab="foundation"
          onClick={() => setActiveSettingsTab('foundation')}
          className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSettingsTab === 'foundation'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>System Foundation</span>
        </button>

        <button
          type="button"
          data-settings-tab="danger"
          onClick={() => setActiveSettingsTab('danger')}
          className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSettingsTab === 'danger'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-rose-600 hover:text-rose-800 hover:bg-rose-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Danger Zone</span>
        </button>
      </div>

      {/* TAB 1: ACCOUNT & PREFERENCES */}
      {activeSettingsTab === 'account' && (
        <div className="space-y-6">
          {/* Role Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <ShieldCheck className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
                Role
              </h3>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Current Role</span>
                <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
                  {userRole === 'SUPERVISOR' ? 'Supervisor' : userRole === 'PROJECT_MANAGER' ? 'Project Manager' : 'Planner'}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                  {userRole === 'SUPERVISOR'
                    ? 'Field Execution — Submit daily progress reports, site diaries, photo evidence, and voice updates.'
                    : userRole === 'PROJECT_MANAGER'
                    ? 'Executive Intelligence — View project intelligence, delay predictions, root cause analysis, and PDF reports.'
                    : 'Schedule & Planning Controls — Manage schedule baseline ingestion, L5/L6 activity linking, human review cockpits, and CPM updates.'}
                </p>
              </div>
              <div>
                <button
                  type="button"
                  id="infrasync-change-role-btn"
                  onClick={() => setShowRoleModal(true)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-colors flex items-center space-x-2 cursor-pointer whitespace-nowrap"
                >
                  <span>Change Role</span>
                </button>
              </div>
            </div>
          </div>

          {/* Appearance Section */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
          <Sun className="w-4 h-4 text-slate-700" />
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Appearance
          </h3>
        </div>

        <div>
          <p className="text-xs text-slate-500">
            Choose how Infrasync AI looks on your device.
          </p>

          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2.5">
              Theme
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
              {/* Light Theme Option */}
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`flex items-start space-x-3 p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'border-brand-600 bg-brand-50/50 ring-1 ring-brand-500 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50/80 hover:border-slate-300'
                }`}
              >
                <div className={`p-2 rounded-md ${theme === 'light' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <Sun className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Light</span>
                    {theme === 'light' && (
                      <span className="w-2 h-2 rounded-full bg-brand-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Clean light theme
                  </p>
                </div>
              </button>

              {/* Dark Theme Option */}
              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`flex items-start space-x-3 p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'border-indigo-500 bg-slate-900/40 ring-1 ring-indigo-500 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50/80 hover:border-slate-300'
                }`}
              >
                <div className={`p-2 rounded-md ${theme === 'dark' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <Moon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Dark</span>
                    {theme === 'dark' && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Dark enterprise UI
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Access & Permissions Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
          <Shield className="w-4 h-4 text-slate-700" />
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Access & Permissions
          </h3>
        </div>

        <p className="text-xs text-slate-500">
          Hardware input permissions for field execution capture modalities. Disabling hardware access blocks real-time capture while preserving stored file ingestion.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Microphone Access */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2 rounded-md ${micEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Microphone Access</h4>
                  <span className="text-[10px] text-slate-500 block">Speech to Text / Voice & ASR</span>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleMic}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  micEnabled ? 'bg-brand-600' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={micEnabled}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    micEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {micEnabled
                ? 'Real-time microphone recording is enabled for voice execution updates.'
                : 'Microphone is blocked. Stored audio file upload remains accessible.'}
            </p>
          </div>

          {/* Camera Access */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2 rounded-md ${cameraEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Camera Access</h4>
                  <span className="text-[10px] text-slate-500 block">Photo Evidence</span>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleCamera}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  cameraEnabled ? 'bg-brand-600' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={cameraEnabled}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    cameraEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {cameraEnabled
                ? 'Real-time camera feed is enabled for capturing photo execution evidence.'
                : 'Camera is blocked. File upload (.jpg, .png, .webp) remains accessible.'}
            </p>
          </div>
        </div>
      </div>

      {/* Settings Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Environment & Services */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <Cpu className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
              Local Execution Services
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">FastAPI Backend</span>
              <span className="font-mono text-slate-800 font-medium">http://localhost:8000</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">React + Vite Frontend</span>
              <span className="font-mono text-slate-800 font-medium">http://localhost:5173</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Local OCR Engine</span>
              <span className="font-mono text-slate-800 font-medium">Tesseract OCR v5.4.0 (Offline)</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Local ASR Engine</span>
              <span className="font-mono text-slate-800 font-medium">Faster-Whisper (CPU int8)</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">PostgreSQL Database</span>
              <span className="font-mono text-slate-800 font-medium">Local Instance (Port 5432)</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-slate-500">State Storage Mode</span>
              <span className="font-mono text-emerald-700 font-medium">In-Memory / Local Files</span>
            </div>
          </div>
        </div>

        {/* Baseline Schedule Guardrails */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <FileSpreadsheet className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
              Schedule Baseline Guardrails
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Reference Benchmark Baseline</span>
              <span className="font-mono text-slate-800 font-medium">baseline_schedule.xlsx</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Baseline MD5 Checksum</span>
              <span className="font-mono text-[11px] text-slate-700 font-medium">5d8ed61031538f056d33aadcd603a06c</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Baseline Immutability</span>
              <span className="font-mono text-emerald-700 font-medium">Enforced (Read-Only)</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">PMIS Update Preview</span>
              <span className="font-mono text-slate-800 font-medium">Simulated P6 XML / MS Project</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Direct Baseline Mutation</span>
              <span className="font-mono text-slate-600 font-medium">Strictly Disabled</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-slate-500">Schedule Update Gate</span>
              <span className="font-mono text-emerald-700 font-medium">Pre-Update Validation Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Governance & Policy Parameters */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
          <Shield className="w-4 h-4 text-slate-700" />
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Validation & Governance Policies
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded border border-slate-100">
            <span className="text-slate-500 block">Contradiction Auto-Resolution</span>
            <span className="font-mono text-slate-900 font-semibold mt-1 block">Disabled (Strict)</span>
            <span className="text-[11px] text-slate-500 mt-1 block">Requires manual planner review</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded border border-slate-100">
            <span className="text-slate-500 block">Confidence Validation Threshold</span>
            <span className="font-mono text-slate-900 font-semibold mt-1 block">0.85 (85%)</span>
            <span className="text-[11px] text-slate-500 mt-1 block">Sub-threshold items held for review</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded border border-slate-100">
            <span className="text-slate-500 block">External Cloud APIs</span>
            <span className="font-mono text-emerald-700 font-semibold mt-1 block">None (0 Dependencies)</span>
            <span className="text-[11px] text-slate-500 mt-1 block">Zero external network transmission</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded border border-slate-100">
            <span className="text-slate-500 block">Database Safety Policy</span>
            <span className="font-mono text-emerald-700 font-semibold mt-1 block">Zero Test Writes</span>
            <span className="text-[11px] text-slate-500 mt-1 block">database_modified = false enforced</span>
          </div>
        </div>
      </div>

      {/* Target Platform Architecture Roadmap */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
              Target Platform Architecture Roadmap
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">Feature 2.9 Active</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ARCHITECTURE_LAYERS.map((layer, idx) => {
            const isCompleted = layer.status === 'completed';
            const isInProgress = layer.status === 'in_progress';
            return (
              <div
                key={layer.name}
                className={`p-3.5 rounded-md border text-sm transition-colors ${
                  isInProgress
                    ? 'bg-brand-50/60 border-brand-300 text-slate-900'
                    : isCompleted
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-slate-50/50 border-slate-200 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-medium">
                    <span className="text-xs font-mono text-slate-400 w-5">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className={isInProgress ? 'text-brand-900 font-semibold' : isCompleted ? 'text-slate-800 font-medium' : 'text-slate-700'}>
                      {layer.name}
                    </span>
                  </div>

                  {isInProgress ? (
                    <span className="inline-flex items-center text-xs font-semibold text-brand-700 bg-brand-100 px-2 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-brand-600" />
                      In Progress
                    </span>
                  ) : isCompleted ? (
                    <span className="inline-flex items-center text-xs font-medium text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-slate-600" />
                      Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs text-slate-400">
                      <Circle className="w-2.5 h-2.5 mr-1" />
                      Planned
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 pl-7">
                  {layer.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>
      </div>
      )}

      {/* TAB 2: SYSTEM FOUNDATION */}
      {activeSettingsTab === 'foundation' && (
        <div className="space-y-6">
          {/* Foundation Overview */}
          <section className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded mb-2 border border-brand-200">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Project Foundation Status</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  System Foundation & Connectivity
                </h2>
                <p className="text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
                  FastAPI backend, PostgreSQL configuration structure, React + Vite frontend, and Tailwind styling are operational.
                </p>
              </div>

              <div className="flex sm:flex-col items-start sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                <span className="text-xs font-medium text-slate-500">Local Environment</span>
                <span className="text-xs font-mono font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200 mt-1">
                  localhost:5173 ↔ localhost:8000
                </span>
              </div>
            </div>
          </section>

          {/* Health Status Component */}
          <section>
            <HealthStatus />
          </section>

          {/* Local Execution Services & Baseline Guardrails */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Environment & Services */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
                <Cpu className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                  Local Execution Services
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500">FastAPI Backend</span>
                  <span className="font-mono text-slate-800 font-medium">http://localhost:8000</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500">React + Vite Frontend</span>
                  <span className="font-mono text-slate-800 font-medium">http://localhost:5173</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500">Local OCR Engine</span>
                  <span className="font-mono text-slate-800 font-medium">Tesseract OCR v5.4.0 (Offline)</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500">Local ASR Engine</span>
                  <span className="font-mono text-slate-800 font-medium">Faster-Whisper (CPU int8)</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500">PostgreSQL Database</span>
                  <span className="font-mono text-slate-800 font-medium">Local Instance (Port 5432)</span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-500">State Storage Mode</span>
                  <span className="font-mono text-emerald-700 font-medium">In-Memory / Local Files</span>
                </div>
              </div>
            </div>

            {/* Baseline Schedule Guardrails */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
                <FileSpreadsheet className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                  Schedule Baseline Guardrails
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500">Reference Benchmark Baseline</span>
                  <span className="font-mono text-slate-800 font-medium">baseline_schedule.xlsx</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500">Baseline MD5 Checksum</span>
                  <span className="font-mono text-[11px] text-slate-700 font-medium">5d8ed61031538f056d33aadcd603a06c</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500">Baseline Immutability</span>
                  <span className="font-mono text-emerald-700 font-medium">Enforced (Read-Only)</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500">PMIS Update Preview</span>
                  <span className="font-mono text-slate-800 font-medium">Simulated P6 XML / MS Project</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500">Direct Baseline Mutation</span>
                  <span className="font-mono text-slate-600 font-medium">Strictly Disabled</span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-500">Schedule Update Gate</span>
                  <span className="font-mono text-emerald-700 font-medium">Pre-Update Validation Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DANGER ZONE */}
      {activeSettingsTab === 'danger' && (
        <div className="space-y-6">
          {/* Danger Zone Section */}
          <section className="bg-white border border-rose-200 rounded-lg p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-rose-100">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-semibold text-rose-900 uppercase tracking-wide">
                Danger Zone
              </h3>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Permanent account actions. These changes cannot be undone.
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Permanently delete your Infrasync AI account and revoke active authentication sessions.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setShowDeleteModal(true);
                }}
                className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account Permanently</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Confirmation Dialog / Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start space-x-3.5">
              <div className="p-2.5 bg-rose-100 border border-rose-200 rounded-lg text-rose-600 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="delete-account-modal-title" className="text-base font-bold text-slate-900">
                  Delete your account permanently?
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  This will permanently delete your Infrasync AI account. This action cannot be undone.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <span className="leading-tight">{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) {
                    setShowDeleteModal(false);
                    setDeleteError(null);
                  }
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting account...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Account Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Selection Modal */}
      {showRoleModal && (
        <RoleSelectionView
          isModal={true}
          userEmail={userEmail}
          currentRole={userRole}
          onClose={() => setShowRoleModal(false)}
          onRoleConfirmed={(newRole, profile) => {
            setShowRoleModal(false);
            if (onRoleChanged) {
              onRoleChanged(newRole, profile);
            }
          }}
        />
      )}
    </div>
  );
}
