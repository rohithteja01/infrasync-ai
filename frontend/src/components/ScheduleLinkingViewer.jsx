import React, { useState, useEffect, useCallback } from 'react';
import {
  Link2,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  FileSpreadsheet,
  Info,
  Layers,
  ArrowRight,
  Filter,
  BarChart3,
  Calendar,
  Clock,
  ShieldCheck,
  TrendingDown,
  Sparkles
} from 'lucide-react';

function getVarianceStatusBadge(status) {
  switch (status) {
    case 'ON_PLAN':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold';
    case 'BEHIND':
      return 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
    case 'AHEAD':
      return 'bg-blue-50 text-blue-800 border-blue-200 font-bold';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function getTierBadge(tier) {
  switch (tier) {
    case 'EXACT':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold';
    case 'FUZZY':
      return 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
    case 'SEMANTIC':
      return 'bg-teal-50 text-teal-800 border-teal-200 font-semibold';
    default:
      return 'bg-slate-100 text-slate-500 border-slate-200';
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

const AVAILABLE_EXECUTION_FILES = [
  { id: 'test_execution_matches.xlsx', label: 'test_execution_matches.xlsx (Test Suite Progress)' },
  { id: 'test_site_progress.xlsx', label: 'test_site_progress.xlsx (Civil Field DPR)' },
  { id: 'test_multisheet_project.xlsx', label: 'test_multisheet_project.xlsx (Civil & Piping Progress)' },
];

const AVAILABLE_SCHEDULE_FILES = [
  { id: 'baseline_schedule.xlsx', label: 'baseline_schedule.xlsx (Baseline Schedule)' },
];

export default function ScheduleLinkingViewer({ executionFile: propExecFile, scheduleFile: propSchedFile, projectContext } = {}) {
  const hasNoData = !projectContext && !propExecFile;
  const getContextFileName = (ctx) => {
    const f = ctx?.files?.[0] || ctx?.files_processed?.[0];
    if (!f) return '';
    return typeof f === 'string' ? f : (f.filename || f.name || '');
  };
  const initialExec = propExecFile || getContextFileName(projectContext) || (hasNoData ? '' : 'test_execution_matches.xlsx');
  const initialSched = propSchedFile || projectContext?.schedule_info?.filename || propExecFile || getContextFileName(projectContext) || (hasNoData ? '' : 'baseline_schedule.xlsx');

  const [executionFile, setExecutionFile] = useState(initialExec);
  const [scheduleFile, setScheduleFile] = useState(initialSched);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [linkingData, setLinkingData] = useState(projectContext?.schedule_linking || null);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ON_PLAN' | 'BEHIND' | 'AHEAD'
  const [selectedRow, setSelectedRow] = useState(() => projectContext?.schedule_linking?.results?.[0] || null);

  useEffect(() => {
    if (propExecFile && propExecFile !== executionFile) {
      setExecutionFile(propExecFile);
    }
  }, [propExecFile]);

  useEffect(() => {
    if (propSchedFile && propSchedFile !== scheduleFile) {
      setScheduleFile(propSchedFile);
    }
  }, [propSchedFile]);

  useEffect(() => {
    if (projectContext?.schedule_linking) {
      setLinkingData(projectContext.schedule_linking);
      if (projectContext.schedule_linking.results?.length > 0) {
        setSelectedRow(projectContext.schedule_linking.results[0]);
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
    ...AVAILABLE_EXECUTION_FILES.filter(
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

  const fetchLinkingData = useCallback(async (execFile, schedFile) => {
    if (hasNoData || !execFile) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/ingestion/schedule-linking?execution_file=${encodeURIComponent(execFile)}&schedule_file=${encodeURIComponent(schedFile)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Server returned HTTP ${response.status}`);
      }

      setLinkingData(data);
      if (data.results && data.results.length > 0) {
        setSelectedRow(data.results[0]);
      } else {
        setSelectedRow(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load schedule linking data.');
      setLinkingData(null);
      setSelectedRow(null);
    } finally {
      setLoading(false);
    }
  }, [hasNoData]);

  useEffect(() => {
    if (!hasNoData && executionFile) {
      fetchLinkingData(executionFile, scheduleFile);
    }
  }, [fetchLinkingData, executionFile, scheduleFile, hasNoData]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-xl p-12 text-center shadow-sm max-w-2xl mx-auto my-6">
        <div className="w-14 h-14 bg-slate-100 dark:bg-[#252525] rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400 dark:text-neutral-500">
          <Link2 className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-neutral-100 mb-2">
          No Project Data Uploaded
        </h3>
        <p className="text-sm text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
          Upload and process a project data file in Project Intelligence to inspect schedule linking and quantity variance.
        </p>
      </div>
    );
  }

  const results = linkingData?.results || [];

  const filteredResults = results.filter((r) => {
    if (statusFilter === 'ON_PLAN') return r.variance_status === 'ON_PLAN';
    if (statusFilter === 'BEHIND') return r.variance_status === 'BEHIND';
    if (statusFilter === 'AHEAD') return r.variance_status === 'AHEAD';
    return true;
  });

  const totalLinked = linkingData?.total_linked ?? 0;
  const onPlanCount = linkingData?.on_plan_count ?? 0;
  const behindCount = linkingData?.behind_count ?? 0;
  const aheadCount = linkingData?.ahead_count ?? 0;

  return (
    <div className="space-y-6">
      {/* Demo Fallback Data Banner */}
      {projectContext?.is_fallback && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3.5 flex items-center space-x-3 text-xs text-blue-800 dark:text-blue-300">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span>
            <strong>Demo Fallback Data Mode:</strong> Displaying realistic schedule linking and baseline progress alignment generated from uploaded file.
          </span>
        </div>
      )}

      {/* Top Banner / Controls Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">Schedule Linking</h3>
                <span className="text-[11px] bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded font-mono font-semibold">
                  Feature 2.14
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Planning-to-execution bridge between field progress and baseline schedule
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Execution File Select */}
            <div className="flex items-center space-x-1.5">
              <label htmlFor="link-exec-file" className="text-xs font-medium text-slate-500">
                Execution:
              </label>
              <select
                id="link-exec-file"
                value={executionFile}
                onChange={(e) => setExecutionFile(e.target.value)}
                disabled={loading}
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              <label htmlFor="link-sched-file" className="text-xs font-medium text-slate-500">
                Schedule:
              </label>
              <select
                id="link-sched-file"
                value={scheduleFile}
                onChange={(e) => setScheduleFile(e.target.value)}
                disabled={loading}
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {schedOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => fetchLinkingData(executionFile, scheduleFile)}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Linked */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Linked Activities
            </span>
            <div className="p-1.5 bg-slate-100 rounded text-slate-600 border border-slate-200">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {loading ? '—' : totalLinked}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Validated execution activities mapped to baseline
          </div>
        </div>

        {/* On Plan */}
        <div className="bg-white border border-emerald-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
              On Plan
            </span>
            <div className="p-1.5 bg-emerald-50 rounded text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
            {loading ? '—' : onPlanCount}
          </div>
          <div className="text-[11px] text-emerald-700/80 mt-1">
            Actual quantity equals planned quantity
          </div>
        </div>

        {/* Behind */}
        <div className="bg-white border border-amber-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              Behind
            </span>
            <div className="p-1.5 bg-amber-50 rounded text-amber-700 border border-amber-200">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2 font-mono">
            {loading ? '—' : behindCount}
          </div>
          <div className="text-[11px] text-amber-700/80 mt-1">
            Actual progress is below planned baseline quantity
          </div>
        </div>

        {/* Ahead */}
        <div className="bg-white border border-blue-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-blue-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
              Ahead
            </span>
            <div className="p-1.5 bg-blue-50 rounded text-blue-700 border border-blue-200">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-700 mt-2 font-mono">
            {loading ? '—' : aheadCount}
          </div>
          <div className="text-[11px] text-blue-700/80 mt-1">
            Actual quantity exceeds planned baseline quantity
          </div>
        </div>
      </div>

      {/* Governance Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 flex items-start space-x-3 text-xs text-slate-600">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold text-slate-900">Governance Notice: </span>
          Schedule Linking is currently read-only. No schedule or database changes are made from this view.
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-3 text-xs text-rose-700">
          <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-rose-900">Schedule Linking Error</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Main Table + Row Detail Layout */}
      <div className="space-y-4">
        {/* Filter bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-500">Filter Variance:</span>
            <div className="inline-flex rounded-md shadow-sm border border-slate-200 bg-white p-0.5">
              {[
                { key: 'ALL', label: `All (${totalLinked})` },
                { key: 'ON_PLAN', label: `On Plan (${onPlanCount})` },
                { key: 'BEHIND', label: `Behind (${behindCount})` },
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
            Showing {filteredResults.length} of {totalLinked} linked activities
          </span>
        </div>

        {/* Link Register Table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold tracking-wider uppercase text-[10px]">
                  <th className="py-2.5 px-3">Execution Activity</th>
                  <th className="py-2.5 px-3">Linked Baseline Schedule</th>
                  <th className="py-2.5 px-2.5 text-center">Level</th>
                  <th className="py-2.5 px-2.5 text-center">Candidate Tier</th>
                  <th className="py-2.5 px-2.5 text-center">Confidence</th>
                  <th className="py-2.5 px-3 text-right">Planned Qty</th>
                  <th className="py-2.5 px-3 text-right">Actual Qty</th>
                  <th className="py-2.5 px-3 text-right">Variance</th>
                  <th className="py-2.5 px-2.5 text-center">Progress</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                      Loading schedule linking data...
                    </td>
                  </tr>
                ) : filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No linked activities match the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredResults.map((item) => {
                    const isSelected = selectedRow?.execution_activity_id === item.execution_activity_id;
                    const varColor =
                      item.quantity_variance < 0
                        ? 'text-amber-700 font-semibold'
                        : item.quantity_variance > 0
                        ? 'text-blue-700 font-semibold'
                        : 'text-emerald-700 font-semibold';

                    return (
                      <tr
                        key={item.execution_activity_id}
                        onClick={() => setSelectedRow(item)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/60 border-l-4 border-l-blue-600'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Execution Activity */}
                        <td className="py-2.5 px-3">
                          <div className="font-mono font-bold text-slate-900">
                            {item.execution_activity_id}
                          </div>
                          <div className="text-slate-600 text-[11px] truncate max-w-[200px]" title={item.execution_activity_name}>
                            {item.execution_activity_name}
                          </div>
                        </td>

                        {/* Schedule Activity */}
                        <td className="py-2.5 px-3">
                          <div className="font-mono font-semibold text-slate-800 flex items-center space-x-1.5">
                            <span className="text-blue-600">→</span>
                            <span>{item.schedule_activity_id}</span>
                          </div>
                          <div className="text-slate-500 text-[11px] truncate max-w-[220px]" title={item.schedule_activity_name}>
                            {item.schedule_activity_name}
                          </div>
                        </td>

                        {/* Level */}
                        <td className="py-2.5 px-2.5 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] border font-mono ${getLevelBadge(item.schedule_level)}`}>
                            {item.schedule_level}
                          </span>
                        </td>

                        {/* Tier */}
                        <td className="py-2.5 px-2.5 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] border font-mono ${getTierBadge(item.candidate_tier)}`}>
                            {item.candidate_tier}
                          </span>
                        </td>

                        {/* Confidence */}
                        <td className="py-2.5 px-2.5 text-center font-mono font-semibold text-slate-700">
                          {item.confidence_percentage}%
                        </td>

                        {/* Planned Qty */}
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {item.planned_quantity?.toLocaleString()} <span className="text-[10px] text-slate-400">{item.unit}</span>
                        </td>

                        {/* Actual Qty */}
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                          {item.actual_quantity?.toLocaleString()} <span className="text-[10px] text-slate-400">{item.unit}</span>
                        </td>

                        {/* Variance */}
                        <td className={`py-2.5 px-3 text-right font-mono ${varColor}`}>
                          {item.quantity_variance !== undefined && item.quantity_variance !== null
                            ? (item.quantity_variance > 0 ? `+${item.quantity_variance.toLocaleString()}` : item.quantity_variance.toLocaleString())
                            : (item.actual_quantity !== undefined && item.planned_quantity !== undefined
                                ? (item.actual_quantity - item.planned_quantity > 0
                                    ? `+${(item.actual_quantity - item.planned_quantity).toLocaleString()}`
                                    : (item.actual_quantity - item.planned_quantity).toLocaleString())
                                : '—')}
                        </td>

                        {/* Progress */}
                        <td className="py-2.5 px-2.5 text-center font-mono text-slate-800">
                          {(item.progress_percentage ?? item.progress) !== undefined && (item.progress_percentage ?? item.progress) !== null
                            ? `${item.progress_percentage ?? item.progress}%`
                            : '—'}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${getVarianceStatusBadge(item.variance_status)}`}>
                            {item.variance_status}
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
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Linked Activity Inspection: <span className="font-mono text-blue-700">{selectedRow.execution_activity_id}</span>
                </h4>
              </div>
              <span className={`px-2.5 py-0.5 rounded text-xs border ${getVarianceStatusBadge(selectedRow.variance_status)}`}>
                Variance Status: {selectedRow.variance_status}
              </span>
            </div>

            {/* 4 Detail Grid Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Card 1: EXECUTION */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-md p-3.5 space-y-2">
                <div className="flex items-center space-x-1.5 text-slate-800 font-bold uppercase tracking-wider text-[10px]">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                  <span>Field Execution</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Activity ID & Name</span>
                    <span className="font-mono font-bold text-slate-900">{selectedRow.execution_activity_id}</span>
                    <p className="text-slate-700 leading-tight mt-0.5">{selectedRow.execution_activity_name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Discipline</span>
                      <span className="font-medium text-slate-800">{selectedRow.discipline}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">WBS</span>
                      <span className="font-mono text-slate-800">{selectedRow.execution_wbs}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Unit</span>
                      <span className="text-slate-800 font-mono">{selectedRow.unit}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Execution Status</span>
                      <span className="text-slate-800 font-medium">{selectedRow.execution_status}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: BASELINE SCHEDULE */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-md p-3.5 space-y-2">
                <div className="flex items-center space-x-1.5 text-slate-800 font-bold uppercase tracking-wider text-[10px]">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Baseline Schedule</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Schedule ID & Name</span>
                    <span className="font-mono font-bold text-blue-700">{selectedRow.schedule_activity_id}</span>
                    <p className="text-slate-700 leading-tight mt-0.5">{selectedRow.schedule_activity_name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Schedule Level</span>
                      <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] border font-mono ${getLevelBadge(selectedRow.schedule_level)}`}>
                        {selectedRow.schedule_level}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Duration</span>
                      <span className="text-slate-800 font-medium">{selectedRow.duration}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Planned Start</span>
                      <span className="text-slate-800 font-mono text-[11px]">{selectedRow.planned_start}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Planned Finish</span>
                      <span className="text-slate-800 font-mono text-[11px]">{selectedRow.planned_finish}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: LINK VALIDATION */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-md p-3.5 space-y-2">
                <div className="flex items-center space-x-1.5 text-slate-800 font-bold uppercase tracking-wider text-[10px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Link Validation</span>
                </div>
                <div className="space-y-2 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Candidate Tier</span>
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] border font-mono ${getTierBadge(selectedRow.candidate_tier)}`}>
                      {selectedRow.candidate_tier}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Confidence Score</span>
                    <span className="text-slate-900 font-bold font-mono text-sm">
                      {selectedRow.confidence_percentage}%
                    </span>
                    <span className="text-[11px] text-slate-500 ml-1.5">
                      ({selectedRow.confidence_score})
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Validation Status</span>
                    <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold">
                      {selectedRow.validation_status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Granularity Status</span>
                    <span className="text-slate-700 font-mono">{selectedRow.granularity_status}</span>
                  </div>
                </div>
              </div>

              {/* Card 4: PROGRESS COMPARISON */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-md p-3.5 space-y-2">
                <div className="flex items-center space-x-1.5 text-slate-800 font-bold uppercase tracking-wider text-[10px]">
                  <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Progress Comparison</span>
                </div>
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Planned Qty</span>
                      <span className="font-mono font-semibold text-slate-800 text-sm">
                        {selectedRow.planned_quantity?.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Actual Qty</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {selectedRow.actual_quantity?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Quantity Variance</span>
                      <span
                        className={`font-mono font-bold text-sm ${
                          selectedRow.quantity_variance < 0
                            ? 'text-amber-700'
                            : selectedRow.quantity_variance > 0
                            ? 'text-blue-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {selectedRow.quantity_variance > 0 ? `+${selectedRow.quantity_variance}` : selectedRow.quantity_variance}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Progress %</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {selectedRow.progress_percentage !== null ? `${selectedRow.progress_percentage}%` : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="pt-1">
                    <span className="text-[10px] text-slate-400 block">Variance Classification</span>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] border mt-0.5 ${getVarianceStatusBadge(selectedRow.variance_status)}`}>
                      {selectedRow.variance_status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Read-Only Governance Confirmation (NO action buttons) */}
            <div className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded border border-slate-100 flex items-center justify-between">
              <span>Read-only inspection panel. Linking metrics are derived deterministically from upstream validation.</span>
              <span className="font-mono text-slate-500 font-medium">Auto-Accept Link Verified</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
