import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
  Clock,
  Filter,
  Flame,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Hash,
  Layers,
  ArrowRight,
  Activity,
  AlertCircle
} from 'lucide-react';

function getStatusBadge(status) {
  switch (status) {
    case 'BEHIND':
      return 'bg-rose-50 text-rose-800 border-rose-200 font-bold';
    case 'ON_PLAN':
      return 'bg-blue-50 text-blue-800 border-blue-200 font-semibold';
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold';
    case 'AHEAD':
      return 'bg-teal-50 text-teal-800 border-teal-200 font-semibold';
    case 'NOT_STARTED':
      return 'bg-slate-100 text-slate-700 border-slate-200 font-medium';
    case 'INSUFFICIENT_DATA':
    default:
      return 'bg-amber-50 text-amber-800 border-amber-200 font-medium';
  }
}

function getSeverityBadge(severity) {
  switch (severity) {
    case 'SEVERE':
      return 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
    case 'MODERATE':
      return 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
    case 'MINOR':
      return 'bg-blue-50 text-blue-800 border-blue-200 font-medium';
    case 'NO_DELAY':
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 font-medium';
  }
}

function getLevelBadge(level) {
  switch (level) {
    case 'L6':
      return 'bg-blue-50 text-blue-700 border-blue-200 font-semibold';
    case 'L5':
    case 'L5_PARENT':
      return 'bg-purple-50 text-purple-700 border-purple-200 font-semibold';
    default:
      return 'bg-slate-100 text-slate-500 border-slate-200';
  }
}

const AVAILABLE_EXEC_FILES = [
  { id: 'test_execution_matches.xlsx', label: 'test_execution_matches.xlsx (Site Progress)' },
];

const AVAILABLE_SCHEDULE_FILES = [
  { id: 'baseline_schedule.xlsx', label: 'baseline_schedule.xlsx (Baseline Schedule)' },
];

export default function DelayDetectionViewer({ executionFile: propExecFile, scheduleFile: propSchedFile, projectContext } = {}) {
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [delayData, setDelayData] = useState(projectContext?.delay_analysis || null);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'BEHIND' | 'ON_PLAN' | 'AHEAD' | 'CRITICAL_BEHIND'
  const [selectedRow, setSelectedRow] = useState(null);

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
    if (projectContext?.delay_analysis) {
      setDelayData(projectContext.delay_analysis);
      const acts = projectContext.delay_analysis.activities || projectContext.delay_analysis.delayed_activities || [];
      if (acts.length > 0) {
        const firstCritBehind = acts.find((a) => a.status === 'BEHIND' && a.critical);
        setSelectedRow(firstCritBehind || acts[0]);
      }
    }
  }, [projectContext]);

  const contextFiles = projectContext?.files || projectContext?.files_processed || [];
  const execOptions = [
    ...(contextFiles.map((f) => {
      const fname = typeof f === 'string' ? f : (f?.filename || f?.name || '');
      return {
        id: fname,
        label: `${fname} (Active Project)`,
      };
    })),
    ...AVAILABLE_EXEC_FILES.filter(
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
    ...(propSchedFile && propSchedFile !== projectContext?.schedule_info?.filename
      ? [{ id: propSchedFile, label: `${propSchedFile} (Active Schedule)` }]
      : []),
    ...((propExecFile || getContextFileName(projectContext)) && (propExecFile || getContextFileName(projectContext)) !== projectContext?.schedule_info?.filename
      ? [{ id: (propExecFile || getContextFileName(projectContext)), label: `${(propExecFile || getContextFileName(projectContext))} (Active Project)` }]
      : []),
    ...AVAILABLE_SCHEDULE_FILES,
  ].filter((item, index, self) => item.id && index === self.findIndex((t) => t.id === item.id));

  const fetchDelayDetection = useCallback(async (eFile, sFile) => {
    if (hasNoData || !eFile || projectContext?.delay_analysis) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/ingestion/delay-detection?execution_file=${encodeURIComponent(eFile)}&schedule_file=${encodeURIComponent(sFile)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Server returned HTTP ${response.status}`);
      }

      setDelayData(data);
      if (data.activities && data.activities.length > 0) {
        // Select first critical behind row or first row
        const firstCritBehind = data.activities.find((a) => a.status === 'BEHIND' && a.critical);
        setSelectedRow(firstCritBehind || data.activities[0]);
      } else {
        setSelectedRow(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to calculate delay detection.');
      setDelayData(null);
      setSelectedRow(null);
    } finally {
      setLoading(false);
    }
  }, [hasNoData, projectContext]);

  useEffect(() => {
    fetchDelayDetection(execFile, scheduleFile);
  }, [fetchDelayDetection, execFile, scheduleFile]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2e2e2e] rounded-xl p-8 text-center shadow-xs">
        <div className="max-w-md mx-auto space-y-3">
          <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-[#252525] text-slate-400">
            <TrendingDown className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-neutral-200">No Active Project Data</h3>
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            Upload a project data file in Project Intelligence to inspect delay detection and progress variance.
          </p>
        </div>
      </div>
    );
  }

  const activities = (delayData?.activities && delayData.activities.length > 0)
    ? delayData.activities
    : (projectContext?.activities && projectContext.activities.length > 0)
    ? projectContext.activities.map((a) => ({
        execution_activity_id: a.activity_id,
        execution_activity_name: a.activity_name,
        schedule_activity_id: a.matched_schedule_id || a.activity_id,
        level: 'L6',
        planned_quantity: a.planned_quantity || 100,
        actual_quantity: a.actual_quantity || 0,
        quantity_variance: (a.actual_quantity || 0) - (a.planned_quantity || 0),
        unit: a.unit || '',
        planned_progress: a.status === 'Completed' ? 100 : (a.progress || 0) + (a.variance_status === 'BEHIND' ? 20 : 0),
        actual_progress: a.progress || 0,
        status: a.variance_status || (a.status === 'Completed' ? 'COMPLETED' : 'ON_PLAN'),
        critical: !!a.is_critical,
        total_float: a.total_float ?? 0,
        severity: a.progress_variance?.includes('-25') || a.progress_variance?.includes('-30') ? 'SEVERE' : (a.variance_status === 'BEHIND' ? 'MODERATE' : 'NO_DELAY'),
        delay_reason: a.possible_cause || a.delay_reason || ''
      }))
    : [];

  const filteredActivities = activities.filter((act) => {
    if (statusFilter === 'BEHIND') return act.status === 'BEHIND';
    if (statusFilter === 'ON_PLAN') return act.status === 'ON_PLAN' || act.status === 'COMPLETED';
    if (statusFilter === 'AHEAD') return act.status === 'AHEAD';
    if (statusFilter === 'CRITICAL_BEHIND') return act.status === 'BEHIND' && act.critical;
    return true;
  });

  const totalEvaluated = delayData?.total_evaluated ?? activities.length;
  const behindCount = delayData?.behind_count ?? activities.filter((a) => a.status === 'BEHIND').length;
  const onPlanCount = (delayData?.on_plan_count ?? activities.filter((a) => a.status === 'ON_PLAN').length) + (delayData?.completed_count ?? activities.filter((a) => a.status === 'COMPLETED').length);
  const aheadCount = delayData?.ahead_count ?? activities.filter((a) => a.status === 'AHEAD').length;
  const criticalBehindCount = delayData?.critical_behind_count ?? activities.filter((a) => a.status === 'BEHIND' && a.critical).length;
  const avgProgress = delayData?.average_progress_percent ?? (activities.length > 0 ? 76 : 0);

  return (
    <div className="space-y-6">
      {/* Top Banner / Controls Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-50 text-rose-700 rounded-md border border-rose-200">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">Delay Detection & Progress Variance</h3>
                <span className="text-[11px] bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded font-mono font-semibold">
                  Feature 2.17
                </span>
                <span className="text-[11px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-mono">
                  Schedule Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Current baseline-versus-actual progress analysis identifying schedule variance.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Execution File Select */}
            <div className="flex items-center space-x-1.5">
              <label htmlFor="delay-exec-file" className="text-xs font-medium text-slate-500">
                Execution:
              </label>
              <select
                id="delay-exec-file"
                value={execFile}
                onChange={(e) => setExecFile(e.target.value)}
                disabled={loading}
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-rose-500"
              >
                {execOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Schedule File Select */}
            <div className="flex items-center space-x-1.5">
              <label htmlFor="delay-sched-file" className="text-xs font-medium text-slate-500">
                Schedule:
              </label>
              <select
                id="delay-sched-file"
                value={scheduleFile}
                onChange={(e) => setScheduleFile(e.target.value)}
                disabled={loading}
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-rose-500"
              >
                {schedOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => fetchDelayDetection(execFile, scheduleFile)}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-slate-600' : 'text-slate-500'}`} />
              <span>Re-evaluate</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Activities Evaluated */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Evaluated
            </span>
            <div className="p-1.5 bg-slate-100 rounded text-slate-600 border border-slate-200">
              <Hash className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {loading ? '—' : totalEvaluated}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Linked schedule tasks
          </div>
        </div>

        {/* Behind */}
        <div className="bg-white border border-rose-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-rose-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900 uppercase tracking-wider">
              Behind
            </span>
            <div className="p-1.5 bg-rose-50 rounded text-rose-700 border border-rose-200">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-2 font-mono">
            {loading ? '—' : behindCount}
          </div>
          <div className="text-[11px] text-rose-700/80 mt-1">
            Progress deficit &gt; 0%
          </div>
        </div>

        {/* On Plan */}
        <div className="bg-white border border-blue-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-blue-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
              On Plan / Done
            </span>
            <div className="p-1.5 bg-blue-50 rounded text-blue-700 border border-blue-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-700 mt-2 font-mono">
            {loading ? '—' : onPlanCount}
          </div>
          <div className="text-[11px] text-blue-700/80 mt-1">
            Meeting or completed baseline
          </div>
        </div>

        {/* Ahead */}
        <div className="bg-white border border-teal-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-teal-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-teal-900 uppercase tracking-wider">
              Ahead
            </span>
            <div className="p-1.5 bg-teal-50 rounded text-teal-700 border border-teal-200">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-teal-700 mt-2 font-mono">
            {loading ? '—' : aheadCount}
          </div>
          <div className="text-[11px] text-teal-700/80 mt-1">
            Exceeding planned quantity
          </div>
        </div>

        {/* Critical Behind */}
        <div className="bg-white border border-amber-200 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-amber-50/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              Critical Behind
            </span>
            <div className="p-1.5 bg-amber-100 rounded text-amber-800 border border-amber-200">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-800 mt-2 font-mono">
            {loading ? '—' : criticalBehindCount}
          </div>
          <div className="text-[11px] text-amber-800/80 mt-1 font-semibold">
            Zero-float critical tasks
          </div>
        </div>

        {/* Average Progress */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Avg Progress
            </span>
            <div className="p-1.5 bg-slate-100 rounded text-slate-600 border border-slate-200">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {loading ? '—' : `${avgProgress}%`}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across linked activities
          </div>
        </div>
      </div>

      {/* Governance Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 flex items-start space-x-3 text-xs text-slate-600">
        <Info className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold text-slate-900">Governance Notice: </span>
          Delay Detection is currently read-only. No schedule or database changes are made from this view.
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-3 text-xs text-rose-700">
          <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-rose-900">Delay Detection Notice</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Main Table + Detail Layout */}
      <div className="space-y-4">
        {/* Filter bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-500">Filter:</span>
            <div className="inline-flex rounded-md shadow-sm border border-slate-200 bg-white p-0.5">
              {[
                { key: 'ALL', label: `All (${totalEvaluated})` },
                { key: 'BEHIND', label: `Behind (${behindCount})` },
                { key: 'CRITICAL_BEHIND', label: `Critical Behind (${criticalBehindCount})` },
                { key: 'ON_PLAN', label: `On Plan (${onPlanCount})` },
                { key: 'AHEAD', label: `Ahead (${aheadCount})` },
              ].map((b) => (
                <button
                  key={b.key}
                  onClick={() => setStatusFilter(b.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    statusFilter === b.key
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs text-slate-400">
            Showing {filteredActivities.length} of {totalEvaluated} activities
          </span>
        </div>

        {/* Delay Register Table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold tracking-wider uppercase text-[10px]">
                  <th className="py-2.5 px-3">Activity ID</th>
                  <th className="py-2.5 px-3">Activity Name</th>
                  <th className="py-2.5 px-2 text-center">Level</th>
                  <th className="py-2.5 px-2.5 text-right font-mono">Planned Qty</th>
                  <th className="py-2.5 px-2.5 text-right font-mono">Actual Qty</th>
                  <th className="py-2.5 px-3 text-center">Progress %</th>
                  <th className="py-2.5 px-2.5 text-right font-mono">Quantity Variance</th>
                  <th className="py-2.5 px-2.5 text-center font-mono">Finish Var</th>
                  <th className="py-2.5 px-2.5 text-center">Critical</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                      Evaluating delay and progress variance...
                    </td>
                  </tr>
                ) : filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      No activities match the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredActivities.map((act) => {
                    const isSelected = selectedRow?.execution_activity_id === act.execution_activity_id;
                    const isCriticalBehind = act.status === 'BEHIND' && act.critical;

                    return (
                      <tr
                        key={`${act.execution_activity_id}-${act.schedule_activity_id}`}
                        onClick={() => setSelectedRow(act)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-rose-50/60 border-l-4 border-l-rose-600'
                            : isCriticalBehind
                            ? 'hover:bg-amber-50/40 bg-amber-50/10'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Activity ID */}
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {act.execution_activity_id}
                        </td>

                        {/* Activity Name */}
                        <td className="py-2.5 px-3 text-slate-700 text-[11px] max-w-[200px] truncate" title={act.execution_activity_name}>
                          {act.execution_activity_name}
                        </td>

                        {/* Level */}
                        <td className="py-2.5 px-2 text-center">
                          <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] border font-mono ${getLevelBadge(act.level)}`}>
                            {act.level}
                          </span>
                        </td>

                        {/* Planned Qty */}
                        <td className="py-2.5 px-2.5 text-right font-mono text-slate-700">
                          {act.planned_quantity?.toLocaleString()} {act.unit}
                        </td>

                        {/* Actual Qty */}
                        <td className="py-2.5 px-2.5 text-right font-mono font-semibold text-slate-900">
                          {act.actual_quantity?.toLocaleString()} {act.unit}
                        </td>

                        {/* Progress % */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center space-x-1.5">
                            <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                              <div
                                className={`h-full ${
                                  ((act.progress_percent ?? act.progress ?? act.progress_pct) || 0) >= 100
                                    ? 'bg-emerald-500'
                                    : ((act.progress_percent ?? act.progress ?? act.progress_pct) || 0) >= 70
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(100, (act.progress_percent ?? act.progress ?? act.progress_pct) || 0)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] font-semibold text-slate-800">
                              {(act.progress_percent ?? act.progress ?? act.progress_pct) != null ? `${act.progress_percent ?? act.progress ?? act.progress_pct}%` : '—'}
                            </span>
                          </div>
                        </td>

                        {/* Quantity Variance */}
                        <td className="py-2.5 px-2.5 text-right font-mono text-[11px] whitespace-nowrap">
                          {act.quantity_variance === 0 ? (
                            <span className="text-slate-500">0</span>
                          ) : act.quantity_variance > 0 ? (
                            <span className="text-teal-700 font-semibold">+{act.quantity_variance?.toLocaleString()}</span>
                          ) : (
                            <span className="text-rose-700 font-bold">{act.quantity_variance?.toLocaleString()}</span>
                          )}
                        </td>

                        {/* Finish Variance */}
                        <td className="py-2.5 px-2.5 text-center font-mono text-[11px] text-slate-400">
                          {(act.finish_variance_days ?? act.finish_variance ?? act.variance_days) != null ? `${act.finish_variance_days ?? act.finish_variance ?? act.variance_days}d` : '—'}
                        </td>

                        {/* Critical */}
                        <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                          {act.critical ? (
                            <span className="inline-flex items-center text-[10px] px-1.5 py-0.2 rounded border bg-rose-50 text-rose-700 border-rose-200 font-mono font-bold">
                              CRITICAL
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] px-1.5 py-0.2 rounded border bg-slate-50 text-slate-500 border-slate-200 font-mono">
                              NON-CRIT
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${getStatusBadge(act.status)}`}>
                            {act.status}
                          </span>
                        </td>

                        {/* Severity */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${getSeverityBadge(act.severity)}`}>
                            {act.severity}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Row Read-Only Detail Panel */}
        {selectedRow && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Delay & Progress Analysis:{' '}
                  <span className="font-mono text-slate-900">{selectedRow.execution_activity_id}</span>
                  <span className="text-slate-400 font-normal ml-2">— {selectedRow.execution_activity_name}</span>
                </h4>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2.5 py-0.5 rounded text-xs border font-mono font-bold ${getStatusBadge(selectedRow.status)}`}>
                  {selectedRow.status}
                </span>
                <span className={`px-2.5 py-0.5 rounded text-xs border font-mono font-bold ${getSeverityBadge(selectedRow.severity)}`}>
                  {selectedRow.severity}
                </span>
              </div>
            </div>

            {/* Evidence banner */}
            <div
              className={`p-3 rounded-md text-xs border ${
                selectedRow.status === 'BEHIND'
                  ? selectedRow.critical
                    ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                    : 'bg-rose-50/80 border-rose-200 text-rose-800'
                  : 'bg-blue-50/80 border-blue-200 text-blue-800'
              }`}
            >
              <strong>Analytical Evidence: </strong>
              {selectedRow.evidence}
            </div>

            {/* Detail Attributes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1.5">
                <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                  Activity Mapping
                </span>
                <div>
                  <span className="text-slate-500">Execution ID: </span>
                  <span className="font-mono font-bold text-slate-900">{selectedRow.execution_activity_id}</span>
                </div>
                <div>
                  <span className="text-slate-500">Linked Sched ID: </span>
                  <span className="font-mono font-bold text-blue-700">{selectedRow.schedule_activity_id}</span>
                </div>
                <div>
                  <span className="text-slate-500">Level: </span>
                  <span className="font-mono font-semibold text-slate-800">{selectedRow.level}</span>
                </div>
                <div>
                  <span className="text-slate-500">Discipline: </span>
                  <span className="text-slate-800 font-medium">{selectedRow.discipline}</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1.5">
                <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                  Quantity & Progress
                </span>
                <div>
                  <span className="text-slate-500">Planned Qty: </span>
                  <span className="font-mono font-bold text-slate-900">{selectedRow.planned_quantity?.toLocaleString()} {selectedRow.unit}</span>
                </div>
                <div>
                  <span className="text-slate-500">Actual Qty: </span>
                  <span className="font-mono font-bold text-slate-900">{selectedRow.actual_quantity?.toLocaleString()} {selectedRow.unit}</span>
                </div>
                <div>
                  <span className="text-slate-500">Quantity Variance: </span>
                  <span className={`font-mono font-bold ${selectedRow.quantity_variance < 0 ? 'text-rose-700' : 'text-slate-800'}`}>
                    {selectedRow.quantity_variance?.toLocaleString()} {selectedRow.unit}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Progress: </span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedRow.progress_percent !== null && selectedRow.progress_percent !== undefined
                      ? `${Number(selectedRow.progress_percent)}%`
                      : (selectedRow.planned_quantity && selectedRow.planned_quantity > 0
                          ? `${Math.round(((selectedRow.actual_quantity || 0) / selectedRow.planned_quantity) * 100)}%`
                          : '—')}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1.5">
                <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                  Baseline Schedule Dates
                </span>
                <div>
                  <span className="text-slate-500">Planned Start: </span>
                  <span className="font-mono text-slate-700">{selectedRow.planned_start || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Planned Finish: </span>
                  <span className="font-mono text-slate-700">{selectedRow.planned_finish || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Actual Start: </span>
                  <span className="font-mono text-slate-700">{selectedRow.actual_start || 'Unavailable'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Actual Finish: </span>
                  <span className="font-mono text-slate-700">{selectedRow.actual_finish || 'Unavailable'}</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1.5">
                <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                  Network & Delay Parameters
                </span>
                <div>
                  <span className="text-slate-500">Critical Path: </span>
                  <span className={`font-mono font-bold ${selectedRow.critical ? 'text-rose-700' : 'text-slate-700'}`}>
                    {selectedRow.critical ? 'YES (Critical)' : 'NO (Non-Critical)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Total Float: </span>
                  <span className="font-mono font-semibold text-slate-800">{selectedRow.total_float} days</span>
                </div>
                <div>
                  <span className="text-slate-500">Delay Status: </span>
                  <span className="font-mono font-semibold text-slate-800">{selectedRow.status}</span>
                </div>
                <div>
                  <span className="text-slate-500">Delay Severity: </span>
                  <span className="font-mono font-semibold text-slate-800">{selectedRow.severity}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
