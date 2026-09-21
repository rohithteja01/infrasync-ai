import React, { useState, useEffect, useCallback } from 'react';
import { FolderTree, Layers, CheckCircle2, AlertCircle, RefreshCw, FileSpreadsheet, Filter, GitFork, HelpCircle } from 'lucide-react';

function getGranularityBadge(status) {
  switch (status) {
    case 'L6':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'L5_PARENT':
      return 'bg-amber-50 text-amber-800 border-amber-300 font-semibold';
    case 'L5':
      return 'bg-purple-50 text-purple-700 border-purple-200 font-semibold';
    case 'DETAILED':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold';
    case 'UNKNOWN':
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function getLevelBadge(level) {
  switch (level?.toUpperCase()) {
    case 'L5':
      return 'bg-purple-50 text-purple-700 border-purple-200 font-semibold';
    case 'L6':
      return 'bg-blue-50 text-blue-700 border-blue-200 font-semibold';
    default:
      return 'bg-slate-100 text-slate-400 border-slate-200';
  }
}

function getTierBadge(tier) {
  switch (tier) {
    case 'exact_id':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-medium';
    case 'fuzzy':
      return 'bg-amber-50 text-amber-800 border-amber-200 font-medium';
    case 'semantic':
      return 'bg-teal-50 text-teal-800 border-teal-200 font-medium';
    default:
      return 'bg-slate-100 text-slate-400 border-slate-200';
  }
}

function getTierLabel(tier) {
  switch (tier) {
    case 'exact_id':
      return 'Exact ID (2.7)';
    case 'fuzzy':
      return 'Fuzzy (2.8)';
    case 'semantic':
      return 'Semantic (2.9)';
    default:
      return 'None';
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

export default function GranularityResolutionViewer({ executionFile: propExecFile, scheduleFile: propSchedFile, projectContext } = {}) {
  const hasNoData = !projectContext && !propExecFile;
  const getContextFileName = (ctx) => {
    const f = ctx?.files?.[0] || ctx?.files_processed?.[0];
    if (!f) return '';
    return typeof f === 'string' ? f : (f?.filename || f?.name || '');
  };

  const initialExec = propExecFile || getContextFileName(projectContext) || (hasNoData ? '' : 'test_execution_matches.xlsx');
  const initialSched = propSchedFile || projectContext?.schedule_info?.filename || propExecFile || getContextFileName(projectContext) || (hasNoData ? '' : 'baseline_schedule.xlsx');

  const [executionFile, setExecutionFile] = useState(initialExec);
  const [scheduleFile, setScheduleFile] = useState(initialSched);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [granularityData, setGranularityData] = useState(null);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'L6' | 'L5_PARENT' | 'L5' | 'DETAILED' | 'UNKNOWN'

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
    if (projectContext?.is_fallback && projectContext?.activities) {
      const acts = projectContext.activities;
      setGranularityData({
        execution_filename: initialExec || 'demo_fallback_data',
        schedule_filename: initialSched || 'baseline_schedule.xlsx',
        total_evaluated: acts.length,
        l6_count: 8,
        l5_parent_count: 1,
        l5_count: 0,
        detailed_count: 1,
        unknown_count: 0,
        results: acts.map((a, idx) => ({
          execution_activity_id: a.activity_id,
          execution_activity_name: a.activity_name,
          discipline: a.discipline,
          granularity_status: idx === 1 ? 'L5_PARENT' : idx === 2 ? 'DETAILED' : 'L6',
          resolved_level: idx === 1 ? 'L5' : 'L6',
          recommended_mapping: {
            schedule_activity_id: a.matched_schedule_id || a.activity_id,
            schedule_activity_name: a.activity_name,
            level: 'L6',
            resolution_rule: idx === 1 ? 'Parent node rollup to L5' : idx === 2 ? 'Sub-task aggregation to L6' : 'Direct L6 exact correspondence'
          }
        }))
      });
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

  const fetchGranularity = useCallback(async (execFile, schedFile) => {
    if (hasNoData || !execFile || projectContext?.is_fallback) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/ingestion/match/granularity?execution_file=${encodeURIComponent(execFile)}&schedule_file=${encodeURIComponent(schedFile)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Server returned HTTP ${response.status}`);
      }

      setGranularityData(data);
    } catch (err) {
      setError(err.message || 'Failed to resolve activity hierarchy granularity.');
      setGranularityData(null);
    } finally {
      setLoading(false);
    }
  }, [hasNoData, projectContext]);

  useEffect(() => {
    fetchGranularity(executionFile, scheduleFile);
  }, [fetchGranularity, executionFile, scheduleFile]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2e2e2e] rounded-xl p-8 text-center shadow-xs">
        <div className="max-w-md mx-auto space-y-3">
          <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-[#252525] text-slate-400">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-neutral-200">No Active Project Data</h3>
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            Upload a project data file in Project Intelligence to inspect L5/L6 hierarchical granularity resolution.
          </p>
        </div>
      </div>
    );
  }

  const results = granularityData?.results || [];

  const filteredResults = results.filter((r) => {
    if (filter === 'ALL') return true;
    return r.granularity_status === filter;
  });

  const totalEvaluated = granularityData?.total_evaluated ?? 0;
  const l6Count = granularityData?.l6_count ?? 0;
  const l5ParentCount = granularityData?.l5_parent_count ?? 0;
  const l5Count = granularityData?.l5_count ?? 0;
  const detailedCount = granularityData?.detailed_count ?? 0;
  const unknownCount = granularityData?.unknown_count ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Banner / Controls Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">Schedule Granularity Resolution</h3>
                <span className="text-[11px] bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded font-mono font-semibold">
                  Feature 2.10
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Deterministic mapping of execution activities to schedule levels (L5, L6, L5_PARENT, DETAILED, UNKNOWN) across Exact, Fuzzy, and Semantic candidates
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Execution File Select */}
            <div className="flex items-center space-x-1.5">
              <label htmlFor="gran-exec-file" className="text-xs font-medium text-slate-500">
                Execution:
              </label>
              <select
                id="gran-exec-file"
                value={executionFile}
                onChange={(e) => setExecutionFile(e.target.value)}
                disabled={loading}
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              <label htmlFor="gran-sched-file" className="text-xs font-medium text-slate-500">
                Schedule:
              </label>
              <select
                id="gran-sched-file"
                value={scheduleFile}
                onChange={(e) => setScheduleFile(e.target.value)}
                disabled={loading}
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {schedOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => fetchGranularity(executionFile, scheduleFile)}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Evaluated */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Evaluated
            </span>
            <div className="p-1 bg-slate-100 rounded text-slate-600 border border-slate-200">
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1.5 font-mono">
            {loading ? '—' : totalEvaluated}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Total execution tasks
          </div>
        </div>

        {/* L6 Tasks */}
        <div className="bg-white border border-blue-100 rounded-lg p-3.5 shadow-sm bg-gradient-to-br from-white to-blue-50/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-blue-800 uppercase tracking-wider">
              L6 Detailed
            </span>
            <div className="p-1 bg-blue-50 rounded text-blue-600 border border-blue-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-blue-700 mt-1.5 font-mono">
            {loading ? '—' : l6Count}
          </div>
          <div className="text-[10px] text-blue-600/80 mt-0.5">
            Direct Level 6 task match
          </div>
        </div>

        {/* L5 Parent */}
        <div className="bg-white border border-amber-100 rounded-lg p-3.5 shadow-sm bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-amber-800 uppercase tracking-wider">
              L5 Parent
            </span>
            <div className="p-1 bg-amber-50 rounded text-amber-600 border border-amber-200">
              <GitFork className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-700 mt-1.5 font-mono">
            {loading ? '—' : l5ParentCount}
          </div>
          <div className="text-[10px] text-amber-700/80 mt-0.5">
            L5 with child L6 in schedule
          </div>
        </div>

        {/* L5 Package */}
        <div className="bg-white border border-purple-100 rounded-lg p-3.5 shadow-sm bg-gradient-to-br from-white to-purple-50/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-purple-800 uppercase tracking-wider">
              L5 Work Pkg
            </span>
            <div className="p-1 bg-purple-50 rounded text-purple-600 border border-purple-200">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-purple-700 mt-1.5 font-mono">
            {loading ? '—' : l5Count}
          </div>
          <div className="text-[10px] text-purple-700/80 mt-0.5">
            L5 without child L6
          </div>
        </div>

        {/* Detailed Sub-task */}
        <div className="bg-white border border-emerald-100 rounded-lg p-3.5 shadow-sm bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-emerald-800 uppercase tracking-wider">
              Detailed Sub
            </span>
            <div className="p-1 bg-emerald-50 rounded text-emerald-600 border border-emerald-200">
              <FolderTree className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-1.5 font-mono">
            {loading ? '—' : detailedCount}
          </div>
          <div className="text-[10px] text-emerald-700/80 mt-0.5">
            Deeper WBS than schedule L6
          </div>
        </div>

        {/* Unknown */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Unknown
            </span>
            <div className="p-1 bg-slate-100 rounded text-slate-500 border border-slate-200">
              <HelpCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-700 mt-1.5 font-mono">
            {loading ? '—' : unknownCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Unmatched / unresolvable
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-rose-900">Granularity Resolution Notice</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {/* Table Header Controls */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Hierarchy Granularity Register
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Determined schedule level, hierarchy relationship, and architectural granularity rationale
            </p>
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 px-1.5 flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              Filter:
            </span>
            <button
              onClick={() => setFilter('ALL')}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === 'ALL'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({results.length})
            </button>
            <button
              onClick={() => setFilter('L6')}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === 'L6'
                  ? 'bg-blue-100 text-blue-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-blue-700'
              }`}
            >
              L6 ({l6Count})
            </button>
            <button
              onClick={() => setFilter('L5_PARENT')}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === 'L5_PARENT'
                  ? 'bg-amber-100 text-amber-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              L5 Parent ({l5ParentCount})
            </button>
            {l5Count > 0 && (
              <button
                onClick={() => setFilter('L5')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  filter === 'L5'
                    ? 'bg-purple-100 text-purple-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-purple-700'
                }`}
              >
                L5 ({l5Count})
              </button>
            )}
            {detailedCount > 0 && (
              <button
                onClick={() => setFilter('DETAILED')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  filter === 'DETAILED'
                    ? 'bg-emerald-100 text-emerald-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                Detailed ({detailedCount})
              </button>
            )}
            <button
              onClick={() => setFilter('UNKNOWN')}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === 'UNKNOWN'
                  ? 'bg-slate-200 text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Unknown ({unknownCount})
            </button>
          </div>
        </div>

        {/* Table Body */}
        <div className="p-6">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
              <span>Analyzing schedule hierarchy and WBS relationships...</span>
            </div>
          ) : filteredResults.length > 0 ? (
            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
              <div className="overflow-x-auto max-h-[540px]">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100/90 text-slate-800 font-semibold border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 w-10 text-center text-slate-400 font-mono text-[11px] border-r border-slate-200 bg-slate-100">
                        #
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        Execution Activity ID
                      </th>
                      <th className="px-4 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap min-w-[180px]">
                        Execution Activity Name
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        Matched Schedule ID
                      </th>
                      <th className="px-4 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap min-w-[180px]">
                        Matched Schedule Name
                      </th>
                      <th className="px-2.5 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Sched Lvl
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-slate-900 font-mono text-center border-r border-slate-200 whitespace-nowrap">
                        Execution WBS
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-slate-900 font-mono text-center border-r border-slate-200 whitespace-nowrap">
                        Schedule WBS
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Match Tier
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Granularity Status
                      </th>
                      <th className="px-4 py-2.5 font-semibold text-slate-900 min-w-[240px]">
                        Resolution Rationale
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredResults.map((r, idx) => {
                      const isL6 = r.granularity_status === 'L6';
                      const isL5Parent = r.granularity_status === 'L5_PARENT';
                      return (
                        <tr
                          key={idx}
                          className={`transition-colors ${
                            isL6
                              ? 'hover:bg-blue-50/20'
                              : isL5Parent
                              ? 'hover:bg-amber-50/25'
                              : 'hover:bg-slate-50/50'
                          }`}
                        >
                          <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-400 bg-slate-50/50 border-r border-slate-200">
                            {r.index || idx + 1}
                          </td>
                          <td className="px-3.5 py-2.5 border-r border-slate-100 whitespace-nowrap">
                            <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {r.execution_activity_id}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 border-r border-slate-100 font-medium text-slate-900">
                            {r.execution_activity_name}
                          </td>
                          <td className="px-3.5 py-2.5 border-r border-slate-100 whitespace-nowrap">
                            {r.matched_schedule_activity_id ? (
                              <span className="font-mono font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                {r.matched_schedule_activity_id}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Unmatched</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 border-r border-slate-100 text-slate-700">
                            {r.matched_schedule_activity_name || <span className="text-slate-400 italic text-[11px]">—</span>}
                          </td>
                          <td className="px-2.5 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                            {r.matched_schedule_level ? (
                              <span className={`inline-block px-2 py-0.5 rounded text-[11px] border ${getLevelBadge(r.matched_schedule_level)}`}>
                                {r.matched_schedule_level}
                              </span>
                            ) : (
                              <span className="text-slate-300 italic">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center border-r border-slate-100 whitespace-nowrap font-mono text-xs text-slate-600">
                            {r.execution_wbs && r.execution_wbs !== '-' ? (
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                {r.execution_wbs}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center border-r border-slate-100 whitespace-nowrap font-mono text-xs text-slate-600">
                            {r.schedule_wbs && r.schedule_wbs !== '-' ? (
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                {r.schedule_wbs}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] border ${getTierBadge(r.candidate_tier)}`}>
                              {getTierLabel(r.candidate_tier)}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                            <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] border ${getGranularityBadge(r.granularity_status)}`}>
                              {r.granularity_status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 text-xs leading-relaxed">
                            {r.granularity_reason}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span>
                  Showing <strong>{filteredResults.length}</strong> of <strong>{results.length}</strong> execution activities mapped against <strong>{scheduleFile}</strong>
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  Granularity Resolution • Feature 2.10
                </span>
              </div>
            </div>
          ) : (
            <div className="p-8 border border-dashed border-slate-300 rounded-lg text-center text-slate-500 text-xs bg-slate-50/50">
              No activities match the current filter ({filter}).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
