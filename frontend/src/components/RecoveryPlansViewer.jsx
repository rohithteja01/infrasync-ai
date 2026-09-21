import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Layers,
  Calendar,
  Activity,
  Zap,
  Info,
  SlidersHorizontal,
  ChevronRight,
  Target,
  FileCheck
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
    case 'INSUFFICIENT_DATA':
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
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

function getSeverityBadge(severity) {
  switch (severity) {
    case 'SEVERE':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'MODERATE':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'MINOR':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'NO_DELAY':
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
      return type;
  }
}

function getLeverIcon(type) {
  switch (type) {
    case 'DURATION_REDUCTION':
      return TrendingDown;
    case 'PARALLEL_EXECUTION':
      return Layers;
    case 'START_ADVANCEMENT':
      return Zap;
    default:
      return Activity;
  }
}

export default function RecoveryPlansViewer({ executionFile: propExecFile, scheduleFile: propSchedFile, projectContext } = {}) {
  const hasNoData = !projectContext && !propExecFile;
  const getContextFileName = (ctx) => {
    const f = ctx?.files?.[0] || ctx?.files_processed?.[0];
    if (!f) return '';
    return typeof f === 'string' ? f : (f?.filename || f?.name || '');
  };

  const initialExec = propExecFile || getContextFileName(projectContext) || (hasNoData ? '' : 'test_execution_matches.xlsx');
  const initialSched = propSchedFile || projectContext?.schedule_info?.filename || propExecFile || getContextFileName(projectContext) || (hasNoData ? '' : 'baseline_schedule.xlsx');

  const [execFile, setExecFile] = useState(initialExec);
  const [scheduleFile, setScheduleFile] = useState(initialSched);
  const [data, setData] = useState(projectContext?.recovery_plans || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [selectedActivityId, setSelectedActivityId] = useState(null);

  useEffect(() => {
    if (propExecFile && propExecFile !== execFile) {
      setExecFile(propExecFile);
    }
  }, [propExecFile]);

  useEffect(() => {
    if (propSchedFile && propSchedFile !== scheduleFile) {
      setScheduleFile(propSchedFile);
    }
  }, [propSchedFile]);

  useEffect(() => {
    if (projectContext?.recovery_plans) {
      setData(projectContext.recovery_plans);
      const plans = projectContext.recovery_plans.recovery_plans || [];
      const firstHigh = plans.find((p) => p.recovery_priority === 'HIGH');
      setSelectedActivityId(firstHigh ? firstHigh.activity_id : plans[0]?.activity_id || null);
    } else if (projectContext?.is_fallback && projectContext?.activities) {
      const delayed = projectContext.activities.filter(a => a.variance_status === 'BEHIND');
      const generatedPlans = delayed.map(a => ({
        activity_id: a.activity_id,
        activity_name: a.activity_name,
        discipline: a.discipline,
        recovery_priority: a.is_critical ? 'HIGH' : 'MEDIUM',
        current_variance: a.progress_variance,
        proposed_action: a.activity_id === 'CIV-L6-02'
          ? 'Fast-track rebar fabrication: deploy 2 extra steel-fixing squads and authorize double-shift overtime.'
          : 'Parallelize loop hydrotesting: mobilize secondary calibrated test manifold and pre-test blind flanges.',
        estimated_recovery_days: a.is_critical ? 6 : 4,
        cost_impact_level: 'MODERATE',
        approval_status: 'PENDING_REVIEW'
      }));

      const payload = {
        execution_file: initialExec || 'demo_fallback_data',
        schedule_file: initialSched || 'baseline_schedule.xlsx',
        total_recovery_plans: generatedPlans.length,
        recovery_plans: generatedPlans,
        summary: {
          total_plans: generatedPlans.length,
          high_priority: generatedPlans.filter(p => p.recovery_priority === 'HIGH').length,
          medium_priority: generatedPlans.filter(p => p.recovery_priority === 'MEDIUM').length
        }
      };
      setData(payload);
      setSelectedActivityId(generatedPlans[0]?.activity_id || null);
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
  if (propExecFile && !execOptions.some((o) => o.id === propExecFile)) {
    execOptions.unshift({ id: propExecFile, label: `${propExecFile} (Active File)` });
  }

  const schedOptions = [
    ...(projectContext?.schedule_info?.filename
      ? [{ id: projectContext.schedule_info.filename, label: `${projectContext.schedule_info.filename} (Active Schedule)` }]
      : []),
    ...((propExecFile || getContextFileName(projectContext)) && (propExecFile || getContextFileName(projectContext)) !== projectContext?.schedule_info?.filename
      ? [{ id: (propExecFile || getContextFileName(projectContext)), label: `${(propExecFile || getContextFileName(projectContext))} (Active Project)` }]
      : []),
    ...SCHEDULE_FILES.filter((f) => f.id !== (projectContext?.schedule_info?.filename || propExecFile || getContextFileName(projectContext))),
  ];

  const fetchRecoveryPlans = useCallback(async () => {
    if (hasNoData || !execFile || projectContext?.recovery_plans || projectContext?.is_fallback) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ingestion/recovery-plans?execution_file=${encodeURIComponent(execFile)}&schedule_file=${encodeURIComponent(scheduleFile)}`
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || `Server returned HTTP ${res.status}`);
      }
      setData(json);
      const plans = json.recovery_plans || [];
      const firstHigh = plans.find((p) => p.recovery_priority === 'HIGH');
      if (firstHigh) {
        setSelectedActivityId(firstHigh.activity_id);
      } else if (plans.length > 0) {
        setSelectedActivityId(plans[0].activity_id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load recovery plans.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [hasNoData, execFile, scheduleFile, projectContext]);

  useEffect(() => {
    fetchRecoveryPlans();
  }, [fetchRecoveryPlans]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2e2e2e] rounded-xl p-8 text-center shadow-xs">
        <div className="max-w-md mx-auto space-y-3">
          <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-[#252525] text-slate-400">
            <RotateCcw className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-neutral-200">No Active Project Data</h3>
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            Upload a project data file in Project Intelligence to inspect actionable schedule recovery options.
          </p>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};
  const allPlans = data?.recovery_plans || [];

  const filteredPlans = allPlans.filter((p) => {
    if (activeFilter === 'ALL') return true;
    return p.recovery_priority === activeFilter;
  });

  const selectedPlan = allPlans.find((p) => p.activity_id === selectedActivityId);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-brand-50 text-brand-700 rounded-md border border-brand-200">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-900">Recovery Plans</h2>
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-mono">
                  Feature 2.23
                </span>
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-medium">
                  Schedule Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Deterministic in-memory recovery scenarios using duration reduction, parallel execution, and start advancement
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Execution File Select */}
            <div className="flex items-center space-x-2">
              <label htmlFor="exec-file-select" className="text-xs font-medium text-slate-500">Execution:</label>
              <select
                id="exec-file-select"
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
              <label htmlFor="sched-file-select" className="text-xs font-medium text-slate-500">Schedule:</label>
              <select
                id="sched-file-select"
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

            <button
              onClick={fetchRecoveryPlans}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-slate-600' : 'text-slate-500'}`} />
              <span>Recalculate</span>
            </button>
          </div>
        </div>
      </div>

      {/* Prominent Read-Only In-Memory Safety Banner */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-4 flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <span className="font-semibold uppercase tracking-wider text-[11px] block text-amber-800">
            Read-Only Analytical Sandbox Mode
          </span>
          Recovery plans are strictly hypothetical analytical scenarios evaluated in memory. Baseline schedules,
          Excel workbooks, and PostgreSQL databases remain 100% unaltered. No recovery plans are automatically committed or applied.
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-center space-x-3 text-rose-800 text-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Eligible */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Eligible Activities</span>
            <div className="p-1.5 bg-slate-100 rounded text-slate-600">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {summary.total_eligible_activities ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Linked schedule scope</span>
        </div>

        {/* High Priority */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-600 uppercase tracking-wider">High Priority</span>
            <div className="p-1.5 bg-rose-50 rounded text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-2 font-mono">
            {summary.high_priority_count ?? 0}
          </div>
          <span className="text-[11px] text-rose-500/80 mt-1 block">Critical / severe delays</span>
        </div>

        {/* Max Recoverable Days */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Max Project Recovery</span>
            <div className="p-1.5 bg-emerald-50 rounded text-emerald-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2 font-mono">
            +{summary.max_project_recovery_days ?? 0}d
          </div>
          <span className="text-[11px] text-emerald-600/80 mt-1 block">Recovers project finish</span>
        </div>

        {/* Total Scenarios */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-600 uppercase tracking-wider">Scenarios Generated</span>
            <div className="p-1.5 bg-indigo-50 rounded text-indigo-600">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-600 mt-2 font-mono">
            {summary.total_scenarios_generated ?? 0}
          </div>
          <span className="text-[11px] text-indigo-500 mt-1 block">3 levers per activity</span>
        </div>

        {/* Sandbox Status */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sandbox State</span>
            <div className="p-1.5 bg-emerald-50 rounded text-emerald-600">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-bold text-emerald-700 mt-2 font-mono flex items-center space-x-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>100% ISOLATED</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">0 database / file writes</span>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Register Table (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            {/* Filter Tabs */}
            <div className="p-3 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: 'All', count: allPlans.length },
                { id: 'HIGH', label: 'High Priority', count: summary.high_priority_count ?? 0 },
                { id: 'MEDIUM', label: 'Medium Priority', count: summary.medium_priority_count ?? 0 },
                { id: 'LOW', label: 'Low Priority', count: summary.low_priority_count ?? 0 },
                { id: 'INSUFFICIENT_DATA', label: 'Insufficient Data', count: summary.insufficient_data_count ?? 0 }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs rounded font-medium transition-colors flex items-center space-x-1.5 ${
                    activeFilter === tab.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1 rounded-full ${
                    activeFilter === tab.id ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* List / Register */}
            <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
              {filteredPlans.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No activities found for this filter.
                </div>
              ) : (
                filteredPlans.map((plan) => {
                  const isSelected = plan.activity_id === selectedActivityId;
                  const maxRecov = plan.scenarios.reduce(
                    (acc, s) => Math.max(acc, s.project_finish_recovery_days || 0),
                    0
                  );

                  return (
                    <div
                      key={plan.activity_id}
                      onClick={() => setSelectedActivityId(plan.activity_id)}
                      className={`p-4 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50/60 border-l-4 border-indigo-600'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {plan.activity_id}
                            </span>
                            {plan.schedule_activity_id && plan.schedule_activity_id !== plan.activity_id && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({plan.schedule_activity_id})
                              </span>
                            )}
                            <span className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold ${getPriorityBadge(plan.recovery_priority)}`}>
                              {plan.recovery_priority}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-1 font-medium">
                            {plan.activity_name}
                          </p>
                        </div>

                        {maxRecov > 0 ? (
                          <div className="text-right flex-shrink-0">
                            <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                              +{maxRecov}d recov
                            </span>
                          </div>
                        ) : (
                          <div className="text-right flex-shrink-0">
                            <span className="text-[11px] font-mono text-slate-400">
                              {plan.critical_path_status === 'CRITICAL' ? 'Critical' : 'Float buffer'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 mt-2.5 text-[11px] text-slate-500">
                        <span className={`px-1.5 py-0.2 rounded border text-[10px] ${getSeverityBadge(plan.delay_severity)}`}>
                          {plan.delay_severity}
                        </span>
                        <span>Dur: <strong className="text-slate-700">{plan.current_duration}d</strong></span>
                        <span>Progress: <strong className="text-slate-700">{plan.current_progress}%</strong></span>
                        <span>Scenarios: <strong className="text-slate-700">{plan.scenarios.length}</strong></span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Scenario Inspector (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedPlan ? (
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
              {/* Selected Plan Header */}
              <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-base font-bold text-slate-900 font-mono">
                      {selectedPlan.activity_id}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${getPriorityBadge(selectedPlan.recovery_priority)}`}>
                      {selectedPlan.recovery_priority} Priority Recovery
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-medium">
                      {selectedPlan.discipline}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 mt-1">
                    {selectedPlan.activity_name}
                  </h3>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-400">Baseline Finish:</span>
                  <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {selectedPlan.baseline_finish}
                  </span>
                </div>
              </div>

              {/* Analytical Evidence Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Critical Path</span>
                  <span className={`font-semibold ${selectedPlan.critical_path_status === 'CRITICAL' ? 'text-rose-600' : 'text-slate-700'}`}>
                    {selectedPlan.critical_path_status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Available Float</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {selectedPlan.available_float} days
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Prediction Risk</span>
                  <span className="font-semibold text-amber-700">
                    {selectedPlan.delay_prediction_risk}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Root Cause Driver</span>
                  <span className="font-semibold text-slate-800 truncate block">
                    {selectedPlan.root_cause_category}
                  </span>
                </div>
              </div>

              {/* Downstream Impact Context */}
              <div className="text-xs text-slate-600 bg-slate-50/60 border border-slate-200 rounded-md p-3 flex items-start space-x-2.5">
                <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="text-slate-700">Downstream Context: </strong>
                  {selectedPlan.impact_summary}
                </div>
              </div>

              {/* Recovery Scenarios Register */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                    <Target className="w-4 h-4 text-indigo-600" />
                    <span>Hypothetical Recovery Scenarios ({selectedPlan.scenarios.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 italic">
                    All calculations in memory
                  </span>
                </div>

                {selectedPlan.scenarios.length === 0 ? (
                  <div className="p-8 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400">
                    No active recovery scenarios required for this activity (activity is on-plan or completed).
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedPlan.scenarios.map((scen, idx) => {
                      const LeverIcon = getLeverIcon(scen.recovery_type);
                      const recoversDays = scen.project_finish_recovery_days > 0;

                      return (
                        <div
                          key={idx}
                          className={`border rounded-lg p-4 transition-all ${
                            recoversDays
                              ? 'border-emerald-200 bg-emerald-50/20 shadow-xs'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div className="flex items-center space-x-2">
                              <div className="p-1.5 bg-slate-100 rounded text-slate-700">
                                <LeverIcon className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-xs font-bold text-slate-900">
                                  {getLeverLabel(scen.recovery_type)}
                                </span>
                                <span className="ml-2 font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                  {scen.recovery_value} days
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${getFeasibilityBadge(scen.feasibility_status)}`}>
                                {scen.feasibility_status}
                              </span>
                              {recoversDays ? (
                                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100/80 border border-emerald-300 px-2 py-0.5 rounded">
                                  +{scen.project_finish_recovery_days}d project finish recovery
                                </span>
                              ) : (
                                <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                  Float absorbed (0d finish shift)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Comparison Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 text-xs border-b border-slate-100">
                            <div>
                              <span className="text-slate-400 block text-[11px]">Activity Finish</span>
                              <span className="font-mono font-semibold text-slate-800">
                                {scen.hypothetical_finish}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px]">Project Finish</span>
                              <div className="font-mono text-xs flex items-center space-x-1">
                                <span className="text-slate-400 line-through">{scen.project_finish_before}</span>
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <span className="font-bold text-emerald-700">{scen.project_finish_after}</span>
                              </div>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px]">Total Float</span>
                              <span className="font-mono font-semibold text-slate-800">
                                {scen.float_before}d → {scen.float_after}d
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px]">Critical Path</span>
                              <span className="font-mono text-[11px] text-slate-700">
                                {scen.critical_path_after.length} critical acts
                              </span>
                            </div>
                          </div>

                          {/* Plain-Language Quantitative Explanation */}
                          <div className="mt-2.5 text-xs text-slate-600 leading-relaxed bg-slate-50/50 p-2.5 rounded border border-slate-150">
                            <span className="font-semibold text-slate-700">Analysis: </span>
                            {scen.explanation}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-xs text-slate-400">
              Select an activity from the register on the left to inspect recovery scenarios.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
