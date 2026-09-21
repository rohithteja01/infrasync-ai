import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  Zap,
  Activity,
  Award,
  TrendingDown,
  ChevronRight,
  BarChart2,
  FileCheck,
  Compass,
  AlertOctagon,
  ArrowUpRight,
  GitBranch,
  Target
} from 'lucide-react';

const EXECUTION_FILES = [
  { id: 'test_execution_matches.xlsx', label: 'test_execution_matches.xlsx (Site Progress)' },
  { id: 'test_site_progress.xlsx', label: 'test_site_progress.xlsx (Daily Log)' }
];

const SCHEDULE_FILES = [
  { id: 'baseline_schedule.xlsx', label: 'baseline_schedule.xlsx (Baseline L5/L6)' },
  { id: 'test_multisheet_project.xlsx', label: 'test_multisheet_project.xlsx' }
];

function getPriorityBadge(priority) {
  switch (priority) {
    case 'HIGH':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'MEDIUM':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'LOW':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function getAlertTypeBadge(type) {
  switch (type) {
    case 'CRITICAL_PATH_DELAY':
      return 'bg-rose-50 text-rose-800 border-rose-200';
    case 'HIGH_DELAY_RISK':
      return 'bg-purple-50 text-purple-800 border-purple-200';
    case 'MILESTONE_RISK':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'PROJECT_DURATION_EXPOSURE':
      return 'bg-orange-50 text-orange-800 border-orange-200';
    case 'SEVERE_PROGRESS_SHORTFALL':
      return 'bg-blue-50 text-blue-800 border-blue-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function getFeasibilityBadge(status) {
  switch (status) {
    case 'FEASIBLE':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'CONSTRAINED':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'HIGH_COMPACTION':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function getLeverLabel(type) {
  switch (type) {
    case 'DURATION_REDUCTION':
      return 'Duration Reduction';
    case 'PARALLEL_EXECUTION':
      return 'Parallel Execution';
    case 'START_ADVANCEMENT':
      return 'Start Advancement';
    default:
      return type || 'No Action';
  }
}

export default function DecisionCenterViewer({ selectedFile, projectContext } = {}) {
  const hasNoData = !projectContext && !selectedFile;
  const getContextFileName = (ctx) => {
    const f = ctx?.files?.[0] || ctx?.files_processed?.[0];
    if (!f) return '';
    return typeof f === 'string' ? f : (f?.filename || f?.name || '');
  };

  const initialExec = selectedFile || getContextFileName(projectContext) || (hasNoData ? '' : 'test_execution_matches.xlsx');
  const initialSched = projectContext?.schedule_info?.filename || projectContext?.schedule_file || selectedFile || getContextFileName(projectContext) || (hasNoData ? '' : 'baseline_schedule.xlsx');

  const [execFile, setExecFile] = useState(initialExec);
  const [scheduleFile, setScheduleFile] = useState(initialSched);

  useEffect(() => {
    if (selectedFile && selectedFile !== execFile) {
      setExecFile(selectedFile);
    }
  }, [selectedFile]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Active section filter: ALL, ALERTS, INSIGHTS, RECOMMENDATIONS, AFFECTED
  const [activeSection, setActiveSection] = useState('ALL');
  // Priority filter: ALL, HIGH, MEDIUM, LOW
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Selected item for detail inspection
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (projectContext?.is_fallback && projectContext?.activities) {
      const acts = projectContext.activities;
      const delayed = acts.filter(a => a.variance_status === 'BEHIND');
      const alerts = delayed.map((a, idx) => ({
        id: `ALERT-${idx + 1}`,
        type: a.is_critical ? 'CRITICAL_DELAY' : 'PROGRESS_LAG',
        priority: a.is_critical ? 'HIGH' : 'MEDIUM',
        activity_id: a.activity_id,
        activity_name: a.activity_name,
        discipline: a.discipline,
        message: `${a.activity_id} is running ${a.progress_variance} behind baseline (${a.progress}% actual). Root cause: ${a.possible_cause || 'Progress lag'}`,
        timestamp: new Date().toISOString()
      }));

      const recommendations = (projectContext.recommendations?.recommendations || []).map((r, idx) => ({
        id: `REC-${idx + 1}`,
        activity_id: r.activity_id || 'CIV-L6-02',
        activity_name: r.activity_name || 'Foundation rebar fixing',
        priority: r.recovery_priority || 'HIGH',
        recommendation: r.action_recommendation || 'Deploy auxiliary workfront crews to compress lead time.',
        impact: r.schedule_impact || 'Protects downstream commissioning window',
        status: 'OPEN'
      }));

      const payload = {
        execution_file: initialExec || 'demo_fallback_data',
        schedule_file: initialSched || 'baseline_schedule.xlsx',
        summary: {
          total_alerts: alerts.length,
          critical_alerts: alerts.filter(al => al.priority === 'HIGH').length,
          active_recommendations: recommendations.length,
          affected_activities_count: 4
        },
        alerts,
        recommendations,
        insights: [
          {
            title: 'Critical Path Compression Risk',
            detail: 'Foundation Civil works delay (CIV-L6-02) directly threatens downstream Mechanical compressor erection (MEC-L6-01).',
            level: 'HIGH'
          },
          {
            title: 'Cross-Discipline Handover',
            detail: 'Piping hydrotesting (PIP-L6-03) holds predecessor constraint for instrumentation loop checking.',
            level: 'MEDIUM'
          }
        ]
      };
      setData(payload);
      if (alerts.length > 0) setSelectedItem({ type: 'ALERT', data: alerts[0] });
    }
  }, [projectContext, initialExec, initialSched]);

  const contextFiles = projectContext?.files || projectContext?.files_processed || [];
  const execOptions = [
    ...(contextFiles.map((f) => {
      const fname = typeof f === 'string' ? f : (f?.filename || f?.name || '');
      return {
        id: fname,
        label: `${fname} (Active Project)`,
      };
    })),
    ...EXECUTION_FILES.filter(
      (af) => !contextFiles.some((cf) => (typeof cf === 'string' ? cf : (cf?.filename || cf?.name)) === af.id)
    ),
  ];
  if (selectedFile && !execOptions.some((o) => o.id === selectedFile)) {
    execOptions.unshift({ id: selectedFile, label: `${selectedFile} (Active File)` });
  }

  const schedOptions = [
    ...(projectContext?.schedule_info?.filename
      ? [{ id: projectContext.schedule_info.filename, label: `${projectContext.schedule_info.filename} (Active Schedule)` }]
      : []),
    ...((selectedFile || getContextFileName(projectContext)) && (selectedFile || getContextFileName(projectContext)) !== projectContext?.schedule_info?.filename
      ? [{ id: (selectedFile || getContextFileName(projectContext)), label: `${(selectedFile || getContextFileName(projectContext))} (Active Project)` }]
      : []),
    ...SCHEDULE_FILES.filter((f) => f.id !== (projectContext?.schedule_info?.filename || selectedFile || getContextFileName(projectContext))),
  ];

  const fetchDecisionCenter = useCallback(async () => {
    if (hasNoData || !execFile) return;
    setLoading(true);
    setError(null);
    try {
      const targetExec = (projectContext?.is_fallback || !execFile.endsWith('.xlsx')) ? 'test_execution_matches.xlsx' : execFile;
      const res = await fetch(
        `/api/ingestion/decision-center?execution_file=${encodeURIComponent(targetExec)}&schedule_file=${encodeURIComponent(scheduleFile)}`
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || `Server returned HTTP ${res.status}`);
      }
      setData(json);

      if (json.alerts && json.alerts.length > 0) {
        setSelectedItem({ type: 'ALERT', data: json.alerts[0] });
      } else if (json.recommendations && json.recommendations.length > 0) {
        setSelectedItem({ type: 'RECOMMENDATION', data: json.recommendations[0] });
      }
    } catch (err) {
      setError(err.message || 'Failed to load Decision Center data.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [hasNoData, execFile, scheduleFile, projectContext]);

  useEffect(() => {
    fetchDecisionCenter();
  }, [fetchDecisionCenter]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2e2e2e] rounded-xl p-8 text-center shadow-xs">
        <div className="max-w-md mx-auto space-y-3">
          <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-[#252525] text-slate-400">
            <Cpu className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-neutral-200">No Active Project Data</h3>
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            Upload a project data file in Project Intelligence to inspect unified AI project decision intelligence.
          </p>
        </div>
      </div>
    );
  }

  const overview = data?.project_overview || {};
  const summary = data?.summary || {};
  const alerts = data?.alerts || [];
  const insights = data?.insights || [];
  const recommendations = data?.recommendations || [];
  const affected = data?.affected_activities || [];
  const governance = data?.governance || {};

  // Filtered lists based on priority filter
  const filteredAlerts = alerts.filter((a) => {
    if (priorityFilter === 'ALL') return true;
    return a.priority === priorityFilter;
  });

  const filteredInsights = insights.filter((i) => {
    if (priorityFilter === 'ALL') return true;
    return i.priority === priorityFilter;
  });

  const filteredRecs = recommendations.filter((r) => {
    if (priorityFilter === 'ALL') return true;
    return r.recovery_priority === priorityFilter;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-900">Decision Center</h2>
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-mono">
                  Feature 2.25
                </span>
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-semibold">
                  Executive Cockpit
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Project-level alerts, insights and recommendations consolidated for executive decision governance
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Execution File Select */}
            <div className="flex items-center space-x-2">
              <label htmlFor="dc-exec-file" className="text-xs font-medium text-slate-500">Execution:</label>
              <select
                id="dc-exec-file"
                value={execFile}
                onChange={(e) => setExecFile(e.target.value)}
                disabled={loading}
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {execOptions.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>

            {/* Schedule File Select */}
            <div className="flex items-center space-x-2">
              <label htmlFor="dc-sched-file" className="text-xs font-medium text-slate-500">Schedule:</label>
              <select
                id="dc-sched-file"
                value={scheduleFile}
                onChange={(e) => setScheduleFile(e.target.value)}
                disabled={loading}
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {schedOptions.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>

            {/* In-Memory Recalculate Button */}
            <button
              type="button"
              onClick={fetchDecisionCenter}
              disabled={loading}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Recalculate
            </button>
          </div>
        </div>

        {/* Action Status Banner & Read-Only Governance Notice */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 p-3 bg-amber-50/70 border border-amber-200 rounded-md flex items-center space-x-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-amber-800 block">
                Action Governance Status
              </span>
              <span className="text-sm font-bold text-amber-950 font-mono">
                {governance.action_status || 'PENDING MANAGEMENT DECISION'}
              </span>
            </div>
          </div>

          <div className="md:col-span-8 p-3 bg-slate-50 border border-slate-200 rounded-md flex items-start space-x-2.5">
            <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 leading-relaxed">
              <strong className="font-semibold text-slate-800">Analytical Decision Governance:</strong> The Decision Center
              consolidates deterministic intelligence from Features 2.16 through 2.24. All recommendations remain
              in review status pending formal change control approval. Zero database writes, zero schedule modifications.
            </div>
          </div>
        </div>
      </div>

      {/* 6 Project Overview KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Schedule Health</span>
            <Activity className="w-4 h-4 text-brand-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-1.5">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {overview.schedule_health_score !== undefined ? overview.schedule_health_score : '—'}
            </span>
            <span className="text-xs text-slate-400">/100</span>
          </div>
          <div className="mt-1">
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
              {overview.schedule_health_status || 'AT_RISK'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Project Finish</span>
            <Calendar className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 font-mono truncate">
            {overview.project_finish || '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {overview.project_duration_days ? `${overview.project_duration_days} days baseline` : '—'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Delayed Activities</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700 font-mono">
            {overview.delayed_activities_count ?? '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Behind baseline progress</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Critical Delays</span>
            <AlertOctagon className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-700 font-mono">
            {overview.critical_delay_count ?? '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">0 days total float</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">High-Risk Activities</span>
            <ShieldAlert className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-700 font-mono">
            {overview.high_risk_activities_count ?? '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Predictive delay risk</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Milestone Risks</span>
            <Target className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-700 font-mono">
            {overview.milestone_risks_count ?? '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            +{overview.available_recovery_potential_days || 0}d recovery potential
          </div>
        </div>
      </div>

      {/* Navigation & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        {/* Section Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSection('ALL')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeSection === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Consolidated View
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('ALERTS')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeSection === 'ALERTS'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Alerts ({summary.total_alerts ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('INSIGHTS')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeSection === 'INSIGHTS'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Insights ({summary.total_insights ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('RECOMMENDATIONS')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeSection === 'RECOMMENDATIONS'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Recommendations ({summary.total_recommendations ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('AFFECTED')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeSection === 'AFFECTED'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Affected Network ({summary.total_affected_activities ?? 0})
          </button>
        </div>

        {/* Priority Filter */}
        <div className="flex items-center space-x-1">
          <span className="text-[11px] text-slate-400 mr-1.5 font-medium">Priority:</span>
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriorityFilter(p)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                priorityFilter === p
                  ? p === 'HIGH'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : p === 'MEDIUM'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : p === 'LOW'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
          <strong>Error loading Decision Center:</strong> {error}
        </div>
      )}

      {loading && !data && (
        <div className="p-12 text-center text-slate-500 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
          Aggregating analytical intelligence into Decision Center...
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Content Area (Left 8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Section 1: Analytical Insights (Visible on ALL or INSIGHTS) */}
            {(activeSection === 'ALL' || activeSection === 'INSIGHTS') && (
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center space-x-2">
                    <BarChart2 className="w-4 h-4 text-indigo-600" />
                    <span>Analytical Insights ({filteredInsights.length})</span>
                  </span>
                  <span className="text-[11px] text-slate-400">Deterministic synthesis from Schedule Intelligence</span>
                </div>

                <div className="p-4 space-y-3">
                  {filteredInsights.map((ins) => (
                    <div
                      key={ins.insight_id}
                      onClick={() => setSelectedItem({ type: 'INSIGHT', data: ins })}
                      className="p-3.5 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 rounded-lg transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadge(ins.priority)}`}>
                            {ins.priority}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">{ins.insight_id}</span>
                          <span className="text-xs font-bold text-slate-900">{ins.title}</span>
                        </div>
                        <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-mono border border-indigo-100">
                          {ins.source_feature}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{ins.description}</p>
                      <div className="mt-2 text-[11px] text-slate-500 bg-white p-2 rounded border border-slate-100 font-mono">
                        <strong className="text-slate-700">Evidence:</strong> {ins.evidence}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 2: Alerts Register (Visible on ALL or ALERTS) */}
            {(activeSection === 'ALL' || activeSection === 'ALERTS') && (
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>Active Alerts Register ({filteredAlerts.length})</span>
                  </span>
                  <span className="text-[11px] text-slate-400">Click alert to inspect evidence & downstream context</span>
                </div>

                <div className="overflow-x-auto max-h-[480px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold border-b border-slate-200">Alert</th>
                        <th className="px-3 py-2.5 font-semibold border-b border-slate-200 text-center">Priority</th>
                        <th className="px-3 py-2.5 font-semibold border-b border-slate-200">Alert Type</th>
                        <th className="px-3 py-2.5 font-semibold border-b border-slate-200">Activity</th>
                        <th className="px-3 py-2.5 font-semibold border-b border-slate-200">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAlerts.map((alt) => {
                        const isSelected = selectedItem?.type === 'ALERT' && selectedItem?.data?.alert_id === alt.alert_id;
                        return (
                          <tr
                            key={alt.alert_id}
                            onClick={() => setSelectedItem({ type: 'ALERT', data: alt })}
                            className={`cursor-pointer transition ${
                              isSelected ? 'bg-indigo-50/70 font-medium' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="px-3 py-2.5 font-mono font-bold text-slate-800">
                              {alt.alert_id}
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadge(alt.priority)}`}>
                                {alt.priority}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getAlertTypeBadge(alt.alert_type)}`}>
                                {String(alt.alert_type || 'ALERT').replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="font-mono font-semibold text-slate-900">{alt.activity_id}</div>
                              <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{alt.activity_name}</div>
                            </td>
                            <td className="px-3 py-2.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                              {alt.source_feature}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Section 3: Recommendations Summary (Visible on ALL or RECOMMENDATIONS) */}
            {(activeSection === 'ALL' || activeSection === 'RECOMMENDATIONS') && (
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center space-x-2">
                    <Award className="w-4 h-4 text-indigo-600" />
                    <span>Verified Recommendations ({filteredRecs.length})</span>
                  </span>
                  <span className="text-[11px] text-slate-400">From Feature 2.24 Recommendations Layer</span>
                </div>

                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold border-b border-slate-200">Activity</th>
                        <th className="px-3 py-2.5 font-semibold border-b border-slate-200 text-center">Priority</th>
                        <th className="px-3 py-2.5 font-semibold border-b border-slate-200 text-center">Score</th>
                        <th className="px-3 py-2.5 font-semibold border-b border-slate-200">Primary Recovery Lever</th>
                        <th className="px-3 py-2.5 font-semibold border-b border-slate-200 text-center">Recovery</th>
                        <th className="px-3 py-2.5 font-semibold border-b border-slate-200 text-center">Feasibility</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRecs.map((rec) => {
                        const isSelected = selectedItem?.type === 'RECOMMENDATION' && selectedItem?.data?.activity_id === rec.activity_id;
                        const best = rec.recommended_scenario;
                        return (
                          <tr
                            key={rec.activity_id}
                            onClick={() => setSelectedItem({ type: 'RECOMMENDATION', data: rec })}
                            className={`cursor-pointer transition ${
                              isSelected ? 'bg-indigo-50/70 font-medium' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="px-3 py-2.5">
                              <div className="font-mono font-bold text-slate-900">{rec.activity_id}</div>
                              <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{rec.activity_name}</div>
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadge(rec.recovery_priority)}`}>
                                {rec.recovery_priority}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                                {rec.recommendation_score}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              {best ? (
                                <span className="font-medium text-slate-800">
                                  {getLeverLabel(best.recovery_type)} ({best.recovery_value}d)
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">No action needed</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              {best && best.project_finish_recovery_days > 0 ? (
                                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                  +{best.project_finish_recovery_days}d
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono">0d</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              {best ? (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getFeasibilityBadge(best.feasibility_status)}`}>
                                  {best.feasibility_status}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Section 4: Affected Downstream Network (Visible on ALL or AFFECTED) */}
            {(activeSection === 'ALL' || activeSection === 'AFFECTED') && (
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center space-x-2">
                    <GitBranch className="w-4 h-4 text-purple-600" />
                    <span>Downstream Exposed Network ({affected.length} activities)</span>
                  </span>
                  <span className="text-[11px] text-slate-400">Successor chain derived via Topological Propagation</span>
                </div>

                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {affected.map((aff) => (
                    <div
                      key={aff.activity_id}
                      onClick={() => setSelectedItem({ type: 'AFFECTED', data: aff })}
                      className="p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 rounded-lg transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-bold text-slate-900">{aff.activity_id}</span>
                          {aff.is_on_critical_path && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                              CRITICAL
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">
                          {aff.impact_type} (depth {aff.depth})
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1 font-medium">{aff.activity_name}</div>
                      <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Float: {aff.total_float}d</span>
                        <span>Milestone: {aff.milestone_id || 'None'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Detail Inspector (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Compass className="w-4 h-4 text-indigo-600" />
                  <span>Decision Detail Inspector</span>
                </span>
                {selectedItem && (
                  <span className="text-[10px] uppercase font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                    {selectedItem.type}
                  </span>
                )}
              </div>

              {selectedItem ? (
                <div className="space-y-3 text-xs">
                  {selectedItem.type === 'ALERT' && (
                    <>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sm text-slate-900">
                            {selectedItem.data.alert_id}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadge(selectedItem.data.priority)}`}>
                            {selectedItem.data.priority}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 mt-1">{selectedItem.data.title}</h4>
                      </div>

                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-slate-700">
                        <strong className="block text-[11px] text-slate-900 mb-1">Description:</strong>
                        {selectedItem.data.description}
                      </div>

                      <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded text-slate-800 font-mono text-[11px]">
                        <strong className="block text-[11px] text-indigo-950 mb-1 font-sans">Quantitative Evidence:</strong>
                        {selectedItem.data.evidence}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Source Feature:</span>
                        <span className="font-mono font-semibold text-slate-700">{selectedItem.data.source_feature}</span>
                      </div>
                    </>
                  )}

                  {selectedItem.type === 'INSIGHT' && (
                    <>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sm text-slate-900">
                            {selectedItem.data.insight_id}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadge(selectedItem.data.priority)}`}>
                            {selectedItem.data.priority}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 mt-1">{selectedItem.data.title}</h4>
                      </div>

                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-slate-700">
                        <strong className="block text-[11px] text-slate-900 mb-1">Analytical Takeaway:</strong>
                        {selectedItem.data.description}
                      </div>

                      <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded text-slate-800 font-mono text-[11px]">
                        <strong className="block text-[11px] text-indigo-950 mb-1 font-sans">Supporting Evidence:</strong>
                        {selectedItem.data.evidence}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Source Feature:</span>
                        <span className="font-mono font-semibold text-slate-700">{selectedItem.data.source_feature}</span>
                      </div>
                    </>
                  )}

                  {selectedItem.type === 'RECOMMENDATION' && (
                    <>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sm text-slate-900">
                            {selectedItem.data.activity_id}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadge(selectedItem.data.recovery_priority)}`}>
                            {selectedItem.data.recovery_priority}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 mt-1">{selectedItem.data.activity_name}</h4>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px]">
                        <div>
                          <span className="text-slate-400 block">Critical Path</span>
                          <span className="font-semibold text-slate-800">{selectedItem.data.critical_path_status}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Recommendation Score</span>
                          <span className="font-mono font-bold text-indigo-700">{selectedItem.data.recommendation_score} / 100</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Delay Severity</span>
                          <span className="font-semibold text-slate-800">{selectedItem.data.delay_severity}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Prediction Risk</span>
                          <span className="font-semibold text-slate-800">{selectedItem.data.delay_prediction_risk}</span>
                        </div>
                      </div>

                      {selectedItem.data.recommended_scenario && (
                        <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-indigo-950">
                              {getLeverLabel(selectedItem.data.recommended_scenario.recovery_type)}
                            </span>
                            <span className="font-mono font-bold text-indigo-700">
                              +{selectedItem.data.recommended_scenario.project_finish_recovery_days}d finish
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600">
                            Project Finish: {selectedItem.data.recommended_scenario.project_finish_before} → {selectedItem.data.recommended_scenario.project_finish_after}
                          </div>
                        </div>
                      )}

                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-700 leading-relaxed">
                        <strong className="block text-slate-900 mb-1">Deterministic Rationale:</strong>
                        {selectedItem.data.recommendation_reason}
                      </div>
                    </>
                  )}

                  {selectedItem.type === 'AFFECTED' && (
                    <>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sm text-slate-900">
                            {selectedItem.data.activity_id}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            {selectedItem.data.impact_type}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 mt-1">{selectedItem.data.activity_name}</h4>
                      </div>

                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded space-y-1.5 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Propagation Depth:</span>
                          <span className="font-mono font-semibold">{selectedItem.data.depth}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Critical Path:</span>
                          <span className="font-semibold">{selectedItem.data.is_on_critical_path ? 'YES (0d float)' : 'NO'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Milestone Exposure:</span>
                          <span className="font-semibold">{selectedItem.data.milestone_id || 'None'}</span>
                        </div>
                      </div>

                      {selectedItem.data.evidence && selectedItem.data.evidence.length > 0 && (
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-700 space-y-1">
                          <strong className="block text-slate-900 mb-1">Impact Evidence:</strong>
                          {selectedItem.data.evidence.map((ev, idx) => (
                            <div key={idx} className="text-slate-600 font-mono text-[10px]">
                              • {ev}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-400 text-center py-8 italic">
                  Select an alert, insight, recommendation, or affected activity to view details.
                </div>
              )}
            </div>

            {/* Action Decision Card */}
            <div className="bg-slate-900 text-white border border-slate-800 rounded-lg p-4 shadow-sm space-y-2.5">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider">Change Governance</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Management decision required to endorse recovery options. Execution of schedule revisions is governed by formal baseline change control procedures.
              </p>
              <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 font-mono">
                Status: PENDING_MANAGEMENT_DECISION • No mutation permitted
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
