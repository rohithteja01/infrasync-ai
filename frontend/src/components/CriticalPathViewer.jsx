import React, { useState, useEffect, useCallback } from 'react';
import {
  Route,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Info,
  Layers,
  ArrowRight,
  Filter,
  Calendar,
  Clock,
  Flame,
  Network,
  ShieldCheck,
  CheckCircle,
  XCircle,
  TrendingUp,
  Hash,
  Sparkles
} from 'lucide-react';

function getCriticalBadge(isCritical) {
  if (isCritical) {
    return 'bg-rose-50 text-rose-800 border-rose-200 font-bold';
  }
  return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-medium';
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

const AVAILABLE_SCHEDULE_FILES = [
  { id: 'baseline_schedule.xlsx', label: 'baseline_schedule.xlsx (Baseline Schedule)' },
];

export default function CriticalPathViewer({ scheduleFile: propSchedFile, projectContext } = {}) {
  const hasNoData = !projectContext && !propSchedFile;
  const getContextFileName = (ctx) => {
    const f = ctx?.files?.[0] || ctx?.files_processed?.[0];
    if (!f) return '';
    return typeof f === 'string' ? f : (f?.filename || f?.name || '');
  };
  const activeFileName = projectContext?.schedule_info?.filename || getContextFileName(projectContext);
  const initialSched = propSchedFile || activeFileName || (hasNoData ? '' : 'baseline_schedule.xlsx');
  const [scheduleFile, setScheduleFile] = useState(initialSched);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cpmData, setCpmData] = useState(projectContext?.cpm_analysis || null);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'NON_CRITICAL'
  const [selectedRow, setSelectedRow] = useState(() => {
    const acts = projectContext?.cpm_analysis?.activities || [];
    return acts.find((a) => a.is_critical) || acts[0] || null;
  });

  useEffect(() => {
    if (propSchedFile && propSchedFile !== scheduleFile) {
      setScheduleFile(propSchedFile);
    }
  }, [propSchedFile]);

  useEffect(() => {
    if (projectContext?.cpm_analysis) {
      setCpmData(projectContext.cpm_analysis);
      const acts = projectContext.cpm_analysis.activities || [];
      const firstCrit = acts.find((a) => a.is_critical) || acts[0] || null;
      setSelectedRow(firstCrit);
    }
  }, [projectContext]);

  const fetchCriticalPath = useCallback(async (schedFile) => {
    if (hasNoData || !schedFile) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/ingestion/critical-path?schedule_file=${encodeURIComponent(schedFile)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Server returned HTTP ${response.status}`);
      }

      setCpmData(data);
      if (data.activities && data.activities.length > 0) {
        const firstCrit = data.activities.find((a) => a.is_critical) || data.activities[0];
        setSelectedRow(firstCrit);
      } else {
        setSelectedRow(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to calculate critical path.');
      setCpmData(null);
      setSelectedRow(null);
    } finally {
      setLoading(false);
    }
  }, [hasNoData]);

  useEffect(() => {
    if (!hasNoData && scheduleFile) {
      fetchCriticalPath(scheduleFile);
    }
  }, [fetchCriticalPath, scheduleFile, hasNoData]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-xl p-12 text-center shadow-sm max-w-2xl mx-auto my-6">
        <div className="w-14 h-14 bg-slate-100 dark:bg-[#252525] rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400 dark:text-neutral-500">
          <Route className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-neutral-100 mb-2">
          No Active Project Loaded
        </h3>
        <p className="text-sm text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
          Upload and process a project data file in Project Intelligence to view Critical Path Method (CPM) analysis and schedule float.
        </p>
      </div>
    );
  }

  const summary = cpmData?.summary || {
    total_activities: 0,
    critical_activities: 0,
    non_critical_activities: 0,
    critical_paths_count: 0,
    project_start: '-',
    project_finish: '-',
    project_duration_days: 0,
    total_dependencies: 0,
    valid_dependencies: 0,
  };

  const criticalPaths = cpmData?.critical_paths || [];
  const activities = cpmData?.activities || [];

  const filteredActivities = activities.filter((act) => {
    if (statusFilter === 'CRITICAL') return act.is_critical;
    if (statusFilter === 'NON_CRITICAL') return !act.is_critical;
    return true;
  });

  const schedOptions = [
    ...(activeFileName ? [{ id: activeFileName, label: `${activeFileName} (Active Schedule)` }] : []),
    ...AVAILABLE_SCHEDULE_FILES.filter((f) => f.id !== activeFileName),
  ];

  return (
    <div className="space-y-6">
      {/* Demo Fallback Data Banner */}
      {projectContext?.is_fallback && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3.5 flex items-center space-x-3 text-xs text-blue-800 dark:text-blue-300">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span>
            <strong>Demo Fallback Data Mode:</strong> Displaying realistic Critical Path Method (CPM) forward/backward pass and total float metrics generated from uploaded file.
          </span>
        </div>
      )}

      {/* Top Banner / Controls Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-50 text-rose-700 rounded-md border border-rose-200">
              <Route className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">Critical Path Analysis</h3>
                <span className="text-[11px] bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded font-mono font-semibold">
                  Feature 2.16
                </span>
                <span className="text-[11px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-mono">
                  CPM Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Deterministic forward/backward pass calculating ES, EF, LS, LF, total float, and driving critical paths
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Schedule File Select */}
            <div className="flex items-center space-x-1.5">
              <label htmlFor="cpm-sched-file" className="text-xs font-medium text-slate-500">
                Schedule:
              </label>
              <select
                id="cpm-sched-file"
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
              onClick={() => fetchCriticalPath(scheduleFile)}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Activities */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Activities
            </span>
            <div className="p-1.5 bg-slate-100 rounded text-slate-600 border border-slate-200">
              <Hash className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {loading ? '—' : summary.total_activities}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Baseline L5/L6 activities evaluated
          </div>
        </div>

        {/* Critical Activities */}
        <div className="bg-white border border-rose-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-rose-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900 uppercase tracking-wider">
              Critical Activities
            </span>
            <div className="p-1.5 bg-rose-50 rounded text-rose-700 border border-rose-200">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-2 font-mono">
            {loading ? '—' : summary.critical_activities}
          </div>
          <div className="text-[11px] text-rose-700/80 mt-1">
            Zero float (0 days) driving tasks
          </div>
        </div>

        {/* Non-Critical Activities */}
        <div className="bg-white border border-emerald-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
              Non-Critical
            </span>
            <div className="p-1.5 bg-emerald-50 rounded text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
            {loading ? '—' : summary.non_critical_activities}
          </div>
          <div className="text-[11px] text-emerald-700/80 mt-1">
            Float buffer available (≥ 21 days)
          </div>
        </div>

        {/* Critical Paths */}
        <div className="bg-white border border-indigo-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-indigo-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
              Critical Paths
            </span>
            <div className="p-1.5 bg-indigo-50 rounded text-indigo-700 border border-indigo-200">
              <Route className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-700 mt-2 font-mono">
            {loading ? '—' : summary.critical_paths_count}
          </div>
          <div className="text-[11px] text-indigo-700/80 mt-1">
            Independent driving chains identified
          </div>
        </div>

        {/* Project Duration */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Project Duration
            </span>
            <div className="p-1.5 bg-slate-100 rounded text-slate-600 border border-slate-200">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {loading ? '—' : `${summary.project_duration_days}d`}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate" title={`${summary.project_start} to ${summary.project_finish}`}>
            {summary.project_start} → {summary.project_finish}
          </div>
        </div>
      </div>

      {/* Governance Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 flex items-start space-x-3 text-xs text-slate-600">
        <Info className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold text-slate-900">Governance Notice: </span>
          Critical Path Analysis is purely analytical and read-only. Calculations are deterministic based on baseline schedule relationships and durations. No database writes or schedule mutations are performed from this view.
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-3 text-xs text-rose-700">
          <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-rose-900">Critical Path Analysis Notice</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Critical Paths Chain Visual Cards */}
      {criticalPaths.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Route className="w-4 h-4 text-rose-600" />
              Identified Critical Path Sequences ({criticalPaths.length})
            </h4>
            <span className="text-[11px] text-slate-500">
              Driving chains spanning from project start to project finish with zero total float
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {criticalPaths.map((cp) => (
              <div
                key={cp.path_id}
                className="bg-white border border-rose-200/80 rounded-lg p-4 shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-[11px] font-mono font-bold border border-rose-200">
                      {cp.path_id}
                    </span>
                    <h5 className="text-sm font-bold text-slate-900">{cp.path_name}</h5>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] border font-mono ${getLevelBadge(cp.level)}`}>
                      {cp.level}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-slate-500">
                    <span>
                      Activities: <strong className="text-slate-800 font-mono">{cp.activity_count}</strong>
                    </span>
                    <span>
                      Span: <strong className="text-slate-800 font-mono">{cp.start_date}</strong> to{' '}
                      <strong className="text-slate-800 font-mono">{cp.finish_date}</strong> ({cp.calendar_span_days}d)
                    </span>
                  </div>
                </div>

                {/* Sequence Flow visualization */}
                <div className="flex items-center flex-wrap gap-2 pt-1">
                  {cp.activities.map((act, aIdx) => {
                    const isLast = aIdx === cp.activities.length - 1;
                    const isSelected = selectedRow?.activity_id === act.activity_id;
                    return (
                      <React.Fragment key={act.activity_id}>
                        <button
                          type="button"
                          onClick={() => {
                            const fullAct = activities.find((a) => a.activity_id === act.activity_id);
                            if (fullAct) setSelectedRow(fullAct);
                          }}
                          className={`text-left px-3 py-2 rounded border transition-all text-xs ${
                            isSelected
                              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400/40 shadow-xs'
                              : 'bg-slate-50/80 hover:bg-rose-50/50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-bold text-slate-900">{act.activity_id}</span>
                            <span className="text-[10px] text-slate-500 font-mono">({act.duration_days}d)</span>
                          </div>
                          <div className="text-[11px] text-slate-600 max-w-[150px] truncate" title={act.activity_name}>
                            {act.activity_name}
                          </div>
                        </button>
                        {!isLast && (
                          <ArrowRight className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            ))}
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
                { key: 'ALL', label: `All (${summary.total_activities})` },
                { key: 'CRITICAL', label: `Critical Only (${summary.critical_activities})` },
                { key: 'NON_CRITICAL', label: `Non-Critical (${summary.non_critical_activities})` },
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
            Showing {filteredActivities.length} of {summary.total_activities} activities
          </span>
        </div>

        {/* Schedule Register Table with CPM Metrics */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold tracking-wider uppercase text-[10px]">
                  <th className="py-2.5 px-3">Activity ID</th>
                  <th className="py-2.5 px-3">Activity Name</th>
                  <th className="py-2.5 px-2 text-center">Level</th>
                  <th className="py-2.5 px-2.5 text-center">Dur</th>
                  <th className="py-2.5 px-3">Planned Dates</th>
                  <th className="py-2.5 px-2.5 text-center font-mono text-slate-700">ES</th>
                  <th className="py-2.5 px-2.5 text-center font-mono text-slate-700">EF</th>
                  <th className="py-2.5 px-2.5 text-center font-mono text-slate-700">LS</th>
                  <th className="py-2.5 px-2.5 text-center font-mono text-slate-700">LF</th>
                  <th className="py-2.5 px-2.5 text-center font-mono text-slate-800 font-bold">Total Float</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                      Computing Critical Path Method network...
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
                    const isSelected = selectedRow?.activity_id === act.activity_id;
                    return (
                      <tr
                        key={act.activity_id}
                        onClick={() => setSelectedRow(act)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-rose-50/60 border-l-4 border-l-rose-600'
                            : act.is_critical
                            ? 'hover:bg-rose-50/30'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Activity ID */}
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {act.activity_id}
                        </td>

                        {/* Activity Name */}
                        <td className="py-2.5 px-3 text-slate-700 text-[11px] max-w-[200px] truncate" title={act.activity_name}>
                          {act.activity_name}
                        </td>

                        {/* Level */}
                        <td className="py-2.5 px-2 text-center">
                          <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] border font-mono ${getLevelBadge(act.level)}`}>
                            {act.level}
                          </span>
                        </td>

                        {/* Duration */}
                        <td className="py-2.5 px-2.5 text-center font-mono text-slate-700">
                          {act.duration_days}d
                        </td>

                        {/* Planned Dates */}
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {act.planned_start} → {act.planned_finish}
                        </td>

                        {/* ES */}
                        <td className="py-2.5 px-2.5 text-center font-mono text-[11px] text-slate-700 whitespace-nowrap">
                          {act.early_start}
                        </td>

                        {/* EF */}
                        <td className="py-2.5 px-2.5 text-center font-mono text-[11px] text-slate-700 whitespace-nowrap">
                          {act.early_finish}
                        </td>

                        {/* LS */}
                        <td className="py-2.5 px-2.5 text-center font-mono text-[11px] text-slate-700 whitespace-nowrap">
                          {act.late_start}
                        </td>

                        {/* LF */}
                        <td className="py-2.5 px-2.5 text-center font-mono text-[11px] text-slate-700 whitespace-nowrap">
                          {act.late_finish}
                        </td>

                        {/* Total Float */}
                        <td className="py-2.5 px-2.5 text-center font-mono text-[11px] whitespace-nowrap font-bold">
                          {act.total_float === 0 ? (
                            <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              0 days
                            </span>
                          ) : (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {act.total_float} days
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${getCriticalBadge(act.is_critical)}`}>
                            {act.critical_status}
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

        {/* Selected Activity Read-Only Detail Panel */}
        {selectedRow && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Route className="w-4 h-4 text-rose-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Critical Path Parameters:{' '}
                  <span className="font-mono text-slate-900">{selectedRow.activity_id}</span>
                  <span className="text-slate-400 font-normal ml-2">— {selectedRow.activity_name}</span>
                </h4>
              </div>
              <span className={`px-2.5 py-0.5 rounded text-xs border font-mono font-bold ${getCriticalBadge(selectedRow.is_critical)}`}>
                {selectedRow.critical_status}
              </span>
            </div>

            {/* Criticality explanation banner */}
            <div
              className={`p-3 rounded-md text-xs border ${
                selectedRow.is_critical
                  ? 'bg-rose-50/70 border-rose-200 text-rose-800'
                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
              }`}
            >
              <strong>Evaluation: </strong>
              {selectedRow.criticality_reason}
            </div>

            {/* Detail Attributes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1.5">
                <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                  Schedule Identity
                </span>
                <div>
                  <span className="text-slate-500">Activity ID: </span>
                  <span className="font-mono font-bold text-slate-900">{selectedRow.activity_id}</span>
                </div>
                <div>
                  <span className="text-slate-500">Level: </span>
                  <span className="font-mono font-semibold text-slate-800">{selectedRow.level}</span>
                </div>
                <div>
                  <span className="text-slate-500">WBS: </span>
                  <span className="font-mono text-slate-700">{selectedRow.wbs}</span>
                </div>
                <div>
                  <span className="text-slate-500">Discipline: </span>
                  <span className="text-slate-800 font-medium">{selectedRow.discipline}</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1.5">
                <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                  Duration & Planned Dates
                </span>
                <div>
                  <span className="text-slate-500">Planned Duration: </span>
                  <span className="font-mono font-bold text-slate-900">{selectedRow.duration_display}</span>
                </div>
                <div>
                  <span className="text-slate-500">Planned Start: </span>
                  <span className="font-mono text-slate-700">{selectedRow.planned_start}</span>
                </div>
                <div>
                  <span className="text-slate-500">Planned Finish: </span>
                  <span className="font-mono text-slate-700">{selectedRow.planned_finish}</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1.5">
                <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                  Early Dates (Forward Pass)
                </span>
                <div>
                  <span className="text-slate-500">Early Start (ES): </span>
                  <span className="font-mono font-bold text-blue-700">{selectedRow.early_start}</span>
                </div>
                <div>
                  <span className="text-slate-500">Early Finish (EF): </span>
                  <span className="font-mono font-bold text-blue-700">{selectedRow.early_finish}</span>
                </div>
                <div className="pt-1 text-[11px] text-slate-400">
                  Calculated from predecessor constraints
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1.5">
                <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                  Late Dates (Backward Pass)
                </span>
                <div>
                  <span className="text-slate-500">Late Start (LS): </span>
                  <span className="font-mono font-bold text-purple-700">{selectedRow.late_start}</span>
                </div>
                <div>
                  <span className="text-slate-500">Late Finish (LF): </span>
                  <span className="font-mono font-bold text-purple-700">{selectedRow.late_finish}</span>
                </div>
                <div>
                  <span className="text-slate-500">Total Float: </span>
                  <span className={`font-mono font-bold ${selectedRow.total_float === 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {selectedRow.total_float} days
                  </span>
                </div>
              </div>
            </div>

            {/* Network Connections */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
              <div className="border border-slate-200 rounded p-3">
                <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block mb-1">
                  Predecessors ({selectedRow.predecessors?.length || 0})
                </span>
                <span className="font-mono text-slate-800 text-xs">
                  {selectedRow.predecessors_display}
                </span>
              </div>

              <div className="border border-slate-200 rounded p-3">
                <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block mb-1">
                  Successors ({selectedRow.successors?.length || 0})
                </span>
                <span className="font-mono text-slate-800 text-xs">
                  {selectedRow.successors_display}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
