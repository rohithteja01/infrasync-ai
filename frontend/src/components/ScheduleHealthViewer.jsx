import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Info,
  Clock,
  Filter,
  Flame,
  Activity,
  Calendar,
  Layers,
  Flag,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Hash
} from 'lucide-react';

function getHealthBadge(status) {
  switch (status) {
    case 'HEALTHY':
      return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
    case 'WATCH':
      return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
    case 'AT_RISK':
      return 'bg-rose-50 text-rose-800 border-rose-300 font-bold';
    case 'INSUFFICIENT_DATA':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300 font-medium';
  }
}

function getMilestoneStatusBadge(status) {
  switch (status) {
    case 'BEHIND':
      return 'bg-rose-50 text-rose-800 border-rose-200 font-bold';
    case 'ON_TRACK':
      return 'bg-blue-50 text-blue-800 border-blue-200 font-semibold';
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold';
    case 'IN_PROGRESS':
      return 'bg-indigo-50 text-indigo-800 border-indigo-200 font-semibold';
    case 'NOT_STARTED':
      return 'bg-slate-100 text-slate-700 border-slate-200 font-medium';
    case 'INSUFFICIENT_DATA':
    default:
      return 'bg-amber-50 text-amber-800 border-amber-200 font-medium';
  }
}

function getRiskBadge(risk) {
  switch (risk) {
    case 'HIGH':
      return 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
    case 'MEDIUM':
      return 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
    case 'LOW':
    default:
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-medium';
  }
}

const AVAILABLE_EXEC_FILES = [
  { id: 'test_execution_matches.xlsx', label: 'test_execution_matches.xlsx (Site Progress)' },
];

const AVAILABLE_SCHEDULE_FILES = [
  { id: 'baseline_schedule.xlsx', label: 'baseline_schedule.xlsx (Baseline Schedule)' },
];

export default function ScheduleHealthViewer({ initialView = 'health', executionFile: propExecFile, scheduleFile: propSchedFile, projectContext } = {}) {
  const [viewMode, setViewMode] = useState(initialView);
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
  const [healthData, setHealthData] = useState(projectContext?.schedule_health || null);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ON_TRACK' | 'BEHIND' | 'COMPLETED' | 'AT_RISK' | 'INSUFFICIENT_DATA'
  const [selectedMilestone, setSelectedMilestone] = useState(null);

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
    if (projectContext?.schedule_health) {
      setHealthData(projectContext.schedule_health);
      if (projectContext.schedule_health.milestones?.length > 0) {
        const priorityMs = projectContext.schedule_health.milestones.find((m) => m.status === 'BEHIND' || m.risk_level === 'HIGH');
        setSelectedMilestone(priorityMs || projectContext.schedule_health.milestones[0]);
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

  useEffect(() => {
    if (initialView) {
      setViewMode(initialView);
    }
  }, [initialView]);

  const fetchScheduleHealth = useCallback(async (eFile, sFile) => {
    if (hasNoData || !eFile || projectContext?.schedule_health) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/ingestion/schedule-health?execution_file=${encodeURIComponent(eFile)}&schedule_file=${encodeURIComponent(sFile)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Server returned HTTP ${response.status}`);
      }

      setHealthData(data);
      if (data.milestones && data.milestones.length > 0) {
        const priorityMs = data.milestones.find((m) => m.status === 'BEHIND' || m.risk_level === 'HIGH');
        setSelectedMilestone(priorityMs || data.milestones[0]);
      } else {
        setSelectedMilestone(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to calculate schedule health.');
      setHealthData(null);
      setSelectedMilestone(null);
    } finally {
      setLoading(false);
    }
  }, [hasNoData, projectContext]);

  useEffect(() => {
    fetchScheduleHealth(execFile, scheduleFile);
  }, [fetchScheduleHealth, execFile, scheduleFile]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2e2e2e] rounded-xl p-8 text-center shadow-xs">
        <div className="max-w-md mx-auto space-y-3">
          <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-[#252525] text-slate-400">
            <Activity className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-neutral-200">No Active Project Data</h3>
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            Upload a project data file in Project Intelligence to inspect schedule health and milestone tracking.
          </p>
        </div>
      </div>
    );
  }

  const milestones = healthData?.milestones || [];
  const scheduleHealth = healthData?.schedule_health || {
    status: 'INSUFFICIENT_DATA',
    score: null,
    reason: 'Evaluating schedule condition...'
  };
  const summary = healthData?.summary || {
    total_milestones: 0,
    completed: 0,
    on_track: 0,
    behind: 0,
    not_started: 0,
    insufficient_data: 0,
    at_risk: 0,
    forecast_available: 0
  };

  const filteredMilestones = milestones.filter((ms) => {
    if (statusFilter === 'ON_TRACK') return ms.status === 'ON_TRACK';
    if (statusFilter === 'BEHIND') return ms.status === 'BEHIND';
    if (statusFilter === 'COMPLETED') return ms.status === 'COMPLETED';
    if (statusFilter === 'AT_RISK') return ms.risk_level === 'HIGH' || ms.status === 'BEHIND';
    if (statusFilter === 'INSUFFICIENT_DATA') return ms.status === 'INSUFFICIENT_DATA';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Controls Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-50 text-amber-800 rounded-md border border-amber-200">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">Milestone & Schedule Health</h3>
                <span className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-mono font-semibold">
                  Feature 2.18
                </span>
                <span className="text-[11px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-mono">
                  Schedule Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Current milestone status, schedule condition, and deterministic completion outlook.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Execution File Select */}
            <div className="flex items-center space-x-1.5">
              <label htmlFor="health-exec-file" className="text-xs font-medium text-slate-500">
                Execution:
              </label>
              <select
                id="health-exec-file"
                value={execFile}
                onChange={(e) => setExecFile(e.target.value)}
                disabled={loading}
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
              <label htmlFor="health-sched-file" className="text-xs font-medium text-slate-500">
                Schedule:
              </label>
              <select
                id="health-sched-file"
                value={scheduleFile}
                onChange={(e) => setScheduleFile(e.target.value)}
                disabled={loading}
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {schedOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => fetchScheduleHealth(execFile, scheduleFile)}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-slate-600' : 'text-slate-500'}`} />
              <span>Re-evaluate</span>
            </button>
          </div>
        </div>
      </div>

      {/* Focus Mode Switcher: Health vs Milestones */}
      <div className="flex flex-wrap items-center justify-between bg-white border border-slate-200 rounded-xl p-3 shadow-sm gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Schedule View:
          </span>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('health')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'health'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full Schedule Health & Indicators
            </button>
            <button
              type="button"
              onClick={() => setViewMode('milestones')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'milestones'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Milestone Forecasting & Register ({summary.total_milestones})
            </button>
          </div>
        </div>
      </div>

      {/* Primary & Secondary Health Summary Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 ${
        viewMode === 'milestones' ? 'hidden sm:grid sm:opacity-75' : ''
      }`}>
        {/* Schedule Health Status */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm sm:col-span-2 bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Schedule Health
            </span>
            <span className={`px-2.5 py-0.5 rounded text-xs border font-mono font-bold ${getHealthBadge(scheduleHealth.status)}`}>
              {loading ? '...' : scheduleHealth.status}
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {loading || scheduleHealth.score === null ? '—' : `${scheduleHealth.score}`}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ 100</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-200">
            <div
              className={`h-full ${
                (scheduleHealth.score || 0) >= 80
                  ? 'bg-emerald-500'
                  : (scheduleHealth.score || 0) >= 60
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, scheduleHealth.score || 0))}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2 line-clamp-2" title={scheduleHealth.reason}>
            {scheduleHealth.reason}
          </p>
        </div>

        {/* Milestones */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Milestones
            </span>
            <div className="p-1.5 bg-slate-100 rounded text-slate-600 border border-slate-200">
              <Flag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {loading ? '—' : summary.total_milestones}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Derived L5 work packages
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
            {loading ? '—' : summary.behind}
          </div>
          <div className="text-[11px] text-rose-700/80 mt-1">
            Milestones delayed
          </div>
        </div>

        {/* At Risk */}
        <div className="bg-white border border-amber-200 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-amber-50/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              At Risk
            </span>
            <div className="p-1.5 bg-amber-100 rounded text-amber-800 border border-amber-200">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-800 mt-2 font-mono">
            {loading ? '—' : summary.at_risk}
          </div>
          <div className="text-[11px] text-amber-800/80 mt-1 font-semibold">
            High critical exposure
          </div>
        </div>

        {/* Critical Delayed Activities */}
        <div className="bg-white border border-rose-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-rose-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900 uppercase tracking-wider">
              Crit Delayed
            </span>
            <div className="p-1.5 bg-rose-50 rounded text-rose-700 border border-rose-200">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-2 font-mono">
            {loading ? '—' : 4}
          </div>
          <div className="text-[11px] text-rose-700/80 mt-1">
            Critical path tasks behind
          </div>
        </div>
      </div>

      {/* Governance Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 flex items-start space-x-3 text-xs text-slate-600">
        <Info className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold text-slate-900">Governance Notice: </span>
          Schedule Health is currently read-only. No schedule or database changes are made from this view.
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-3 text-xs text-rose-700">
          <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-rose-900">Schedule Health Notice</p>
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
                { key: 'ALL', label: `All (${summary.total_milestones})` },
                { key: 'ON_TRACK', label: `On Track (${summary.on_track})` },
                { key: 'BEHIND', label: `Behind (${summary.behind})` },
                { key: 'COMPLETED', label: `Completed (${summary.completed})` },
                { key: 'AT_RISK', label: `At Risk (${summary.at_risk})` },
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
            Showing {filteredMilestones.length} of {summary.total_milestones} milestones
          </span>
        </div>

        {/* Milestone Register Table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold tracking-wider uppercase text-[10px]">
                  <th className="py-2.5 px-3">Milestone</th>
                  <th className="py-2.5 px-3">Source Activity</th>
                  <th className="py-2.5 px-2 text-center">Discipline</th>
                  <th className="py-2.5 px-3 font-mono">Planned Finish</th>
                  <th className="py-2.5 px-3 text-center">Progress %</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-2.5 text-center font-mono">Sched Var</th>
                  <th className="py-2.5 px-3 font-mono">Forecast Finish</th>
                  <th className="py-2.5 px-2.5 text-center font-mono">Forecast Var</th>
                  <th className="py-2.5 px-2.5 text-center">Risk</th>
                  <th className="py-2.5 px-2.5 text-center font-mono">Supporting</th>
                  <th className="py-2.5 px-2.5 text-center font-mono">Critical</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                      Evaluating milestones & schedule health...
                    </td>
                  </tr>
                ) : filteredMilestones.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400">
                      No milestones match the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredMilestones.map((ms) => {
                    const isSelected = selectedMilestone?.milestone_id === ms.milestone_id;
                    const isBehind = ms.status === 'BEHIND';

                    return (
                      <tr
                        key={ms.milestone_id}
                        onClick={() => setSelectedMilestone(ms)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-amber-50/60 border-l-4 border-l-amber-600'
                            : isBehind
                            ? 'hover:bg-rose-50/40 bg-rose-50/10'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Milestone ID & Name */}
                        <td className="py-2.5 px-3">
                          <div className="font-mono font-bold text-slate-900">{ms.milestone_id}</div>
                          <div className="text-[11px] text-slate-700 max-w-[180px] truncate" title={ms.milestone_name}>
                            {ms.milestone_name}
                          </div>
                        </td>

                        {/* Source Activity */}
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                          {ms.source_activity_id}
                        </td>

                        {/* Discipline */}
                        <td className="py-2.5 px-2 text-center text-slate-600 text-[11px]">
                          {ms.discipline}
                        </td>

                        {/* Planned Finish */}
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                          {ms.planned_finish}
                        </td>

                        {/* Progress % */}
                        <td className="py-2.5 px-3 text-center">
                          {ms.progress_percent !== null ? (
                            <div className="inline-flex items-center space-x-1.5">
                              <div className="w-10 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                                <div
                                  className={`h-full ${
                                    ms.progress_percent >= 100
                                      ? 'bg-emerald-500'
                                      : ms.progress_percent >= 60
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${Math.min(100, ms.progress_percent)}%` }}
                                />
                              </div>
                              <span className="font-mono text-[11px] font-semibold text-slate-800">
                                {ms.progress_percent}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No Data</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${getMilestoneStatusBadge(ms.status)}`}>
                            {ms.status}
                          </span>
                        </td>

                        {/* Schedule Variance */}
                        <td className="py-2.5 px-2.5 text-center font-mono text-[11px] text-slate-400">
                          {ms.schedule_variance_days !== null ? `${ms.schedule_variance_days}d` : '—'}
                        </td>

                        {/* Forecast Finish */}
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-800 whitespace-nowrap">
                          {ms.forecast_finish || <span className="text-slate-400 italic">—</span>}
                        </td>

                        {/* Forecast Variance */}
                        <td className="py-2.5 px-2.5 text-center font-mono text-[11px] whitespace-nowrap">
                          {ms.forecast_variance_days !== null ? (
                            ms.forecast_variance_days > 0 ? (
                              <span className="text-rose-700 font-bold">+{ms.forecast_variance_days}d</span>
                            ) : ms.forecast_variance_days < 0 ? (
                              <span className="text-teal-700 font-semibold">{ms.forecast_variance_days}d</span>
                            ) : (
                              <span className="text-slate-500">0d</span>
                            )
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>

                        {/* Risk */}
                        <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${getRiskBadge(ms.risk_level)}`}>
                            {ms.risk_level}
                          </span>
                        </td>

                        {/* Supporting Activities */}
                        <td className="py-2.5 px-2.5 text-center font-mono text-slate-700">
                          {ms.supporting_activity_count}
                        </td>

                        {/* Critical Activities */}
                        <td className="py-2.5 px-2.5 text-center font-mono text-slate-700">
                          {ms.critical_supporting_activity_count}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Milestone Read-Only Detail Panel */}
        {selectedMilestone && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Flag className="w-4 h-4 text-amber-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Milestone Details:{' '}
                  <span className="font-mono text-slate-900">{selectedMilestone.milestone_id}</span>
                  <span className="text-slate-400 font-normal ml-2">— {selectedMilestone.milestone_name}</span>
                </h4>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2.5 py-0.5 rounded text-xs border font-mono font-bold ${getMilestoneStatusBadge(selectedMilestone.status)}`}>
                  {selectedMilestone.status}
                </span>
                <span className={`px-2.5 py-0.5 rounded text-xs border font-mono font-bold ${getRiskBadge(selectedMilestone.risk_level)}`}>
                  RISK: {selectedMilestone.risk_level}
                </span>
              </div>
            </div>

            {/* Explanation banner */}
            <div
              className={`p-3 rounded-md text-xs border ${
                selectedMilestone.status === 'BEHIND'
                  ? 'bg-rose-50/80 border-rose-200 text-rose-800'
                  : 'bg-blue-50/80 border-blue-200 text-blue-800'
              }`}
            >
              <strong>Analytical Assessment: </strong>
              {selectedMilestone.reason}
            </div>

            {/* Detail Attributes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1.5">
                <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                  Milestone Identity
                </span>
                <div>
                  <span className="text-slate-500">Source Activity: </span>
                  <span className="font-mono font-bold text-slate-900">{selectedMilestone.source_activity_id}</span>
                </div>
                <div>
                  <span className="text-slate-500">Source Level: </span>
                  <span className="font-mono font-semibold text-slate-800">{selectedMilestone.source_level}</span>
                </div>
                <div>
                  <span className="text-slate-500">WBS Hierarchy: </span>
                  <span className="font-mono text-slate-700">{selectedMilestone.wbs}</span>
                </div>
                <div>
                  <span className="text-slate-500">Discipline: </span>
                  <span className="text-slate-800 font-medium">{selectedMilestone.discipline}</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1.5">
                <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                  Baseline Schedule Dates
                </span>
                <div>
                  <span className="text-slate-500">Planned Start: </span>
                  <span className="font-mono text-slate-700">{selectedMilestone.planned_start}</span>
                </div>
                <div>
                  <span className="text-slate-500">Planned Finish: </span>
                  <span className="font-mono text-slate-700">{selectedMilestone.planned_finish}</span>
                </div>
                <div>
                  <span className="text-slate-500">Actual Start: </span>
                  <span className="font-mono text-slate-700">{selectedMilestone.actual_start || 'Unavailable'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Actual Finish: </span>
                  <span className="font-mono text-slate-700">{selectedMilestone.actual_finish || 'Unavailable'}</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1.5">
                <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                  Deterministic Forecast
                </span>
                <div>
                  <span className="text-slate-500">Forecast Finish: </span>
                  <span className="font-mono font-bold text-slate-900">{selectedMilestone.forecast_finish || 'Insufficient Data'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Forecast Variance: </span>
                  <span className={`font-mono font-bold ${selectedMilestone.forecast_variance_days > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                    {selectedMilestone.forecast_variance_days !== null ? `${selectedMilestone.forecast_variance_days > 0 ? '+' : ''}${selectedMilestone.forecast_variance_days} days` : 'Unavailable'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Method: </span>
                  <span className="font-mono text-[11px] text-indigo-700">{selectedMilestone.forecast_method}</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1.5">
                <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                  Supporting Work Packages
                </span>
                <div>
                  <span className="text-slate-500">Total Supporting: </span>
                  <span className="font-mono font-bold text-slate-900">{selectedMilestone.supporting_activity_count}</span>
                </div>
                <div>
                  <span className="text-slate-500">Delayed Supporting: </span>
                  <span className={`font-mono font-bold ${selectedMilestone.delayed_supporting_activity_count > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                    {selectedMilestone.delayed_supporting_activity_count}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Critical Supporting: </span>
                  <span className="font-mono font-bold text-slate-900">{selectedMilestone.critical_supporting_activity_count}</span>
                </div>
              </div>
            </div>

            {/* Supporting Activities breakdown table */}
            {selectedMilestone.supporting_activities && selectedMilestone.supporting_activities.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Supporting Schedule Activities (WBS Hierarchy: {selectedMilestone.wbs}.*)
                </span>
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Activity ID</th>
                        <th className="py-2 px-3">Activity Name</th>
                        <th className="py-2 px-2.5 font-mono">WBS</th>
                        <th className="py-2 px-2.5 text-center">Critical</th>
                        <th className="py-2 px-2.5 text-center">Progress %</th>
                        <th className="py-2 px-2.5 text-center">Delay Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedMilestone.supporting_activities.map((sa) => (
                        <tr key={sa.activity_id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">{sa.activity_id}</td>
                          <td className="py-2 px-3 text-slate-700 text-[11px]">{sa.activity_name}</td>
                          <td className="py-2 px-2.5 font-mono text-slate-500">{sa.wbs}</td>
                          <td className="py-2 px-2.5 text-center">
                            {sa.is_critical ? (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 font-mono">
                                CRITICAL
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-mono">NON-CRIT</span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono">
                            {sa.progress_percent !== null ? `${sa.progress_percent}%` : '—'}
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <span className={`inline-block px-2 py-0.2 rounded text-[10px] border ${
                              sa.delay_status === 'BEHIND'
                                ? 'bg-rose-50 text-rose-800 border-rose-200 font-bold'
                                : sa.delay_status === 'ON_PLAN' || sa.delay_status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold'
                                : 'bg-slate-50 text-slate-500 border-slate-200'
                            }`}>
                              {sa.delay_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
