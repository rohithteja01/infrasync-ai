import React, { useState, useEffect, useCallback } from 'react';
import { GitCompare, CheckCircle2, XCircle, RefreshCw, AlertCircle, FileSpreadsheet, Tag, Filter } from 'lucide-react';

function getMatchStatusBadge(status) {
  if (status === 'matched') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  return 'bg-rose-50 text-rose-700 border-rose-200';
}

function getLevelBadge(level) {
  switch (level?.toUpperCase()) {
    case 'L5':
      return 'bg-purple-50 text-purple-700 border-purple-200 font-semibold';
    case 'L6':
      return 'bg-blue-50 text-blue-700 border-blue-200 font-semibold';
    default:
      return 'bg-slate-100 text-slate-500 border-slate-200';
  }
}

function getDisciplineBadge(discipline) {
  switch (discipline?.toLowerCase()) {
    case 'civil':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'piping':
      return 'bg-cyan-50 text-cyan-800 border-cyan-200';
    case 'mechanical':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'structural':
      return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
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

export default function ExactIdMatchingViewer({ executionFile: propExecFile, scheduleFile: propSchedFile, projectContext } = {}) {
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
  const [matchData, setMatchData] = useState(null);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'MATCHED' | 'UNMATCHED'

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
      const exacts = acts.filter(a => a.match_tier === 'EXACT');
      const unmat = acts.filter(a => a.match_tier !== 'EXACT');
      setMatchData({
        execution_filename: initialExec || 'demo_fallback_data',
        schedule_filename: initialSched || 'baseline_schedule.xlsx',
        total_execution_activities: acts.length,
        exact_matches: exacts.length,
        unmatched_activities: unmat.length,
        matches: acts.map(a => ({
          execution_activity_id: a.activity_id,
          execution_activity_name: a.activity_name,
          discipline: a.discipline,
          level: a.activity_id.includes('L5') ? 'L5' : 'L6',
          match_status: a.match_tier === 'EXACT' ? 'matched' : 'unmatched',
          matched_schedule_id: a.match_tier === 'EXACT' ? a.matched_schedule_id : null,
          matched_schedule_name: a.match_tier === 'EXACT' ? a.activity_name : null,
          confidence: a.match_tier === 'EXACT' ? a.confidence_score : 0,
          unmatched_reason: a.match_tier !== 'EXACT' ? (a.match_tier === 'FUZZY' ? 'No exact ID match in schedule (Matched via Fuzzy)' : a.match_tier === 'SEMANTIC' ? 'No exact ID match in schedule (Matched via Semantic)' : 'Discovered Scope / New Activity') : null
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

  const fetchMatches = useCallback(async (execFile, schedFile) => {
    if (hasNoData || !execFile || projectContext?.is_fallback) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/ingestion/match/exact-id?execution_file=${encodeURIComponent(execFile)}&schedule_file=${encodeURIComponent(schedFile)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Server returned HTTP ${response.status}`);
      }

      setMatchData(data);
    } catch (err) {
      setError(err.message || 'Failed to calculate exact ID matches.');
      setMatchData(null);
    } finally {
      setLoading(false);
    }
  }, [hasNoData, projectContext]);

  useEffect(() => {
    fetchMatches(executionFile, scheduleFile);
  }, [fetchMatches, executionFile, scheduleFile]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2e2e2e] rounded-xl p-8 text-center shadow-xs">
        <div className="max-w-md mx-auto space-y-3">
          <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-[#252525] text-slate-400">
            <GitCompare className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-neutral-200">No Active Project Data</h3>
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            Upload a project data file in Project Intelligence to inspect deterministic Exact ID schedule matches.
          </p>
        </div>
      </div>
    );
  }

  const matches = matchData?.matches || [];

  const filteredMatches = matches.filter((m) => {
    if (filter === 'MATCHED') return m.match_status === 'matched';
    if (filter === 'UNMATCHED') return m.match_status === 'unmatched';
    return true;
  });

  const totalExecution = matchData?.total_execution_activities ?? 0;
  const exactMatches = matchData?.exact_matches ?? 0;
  const unmatchedCount = matchData?.unmatched_activities ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Banner / Source Selector */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">Exact ID Matching</h3>
                <span className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-mono font-semibold">
                  Feature 2.7
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Deterministic matching between field execution activities and baseline schedule by Activity ID
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Execution File Select */}
            <div className="flex items-center space-x-1.5">
              <label htmlFor="match-exec-file" className="text-xs font-medium text-slate-500">
                Execution:
              </label>
              <select
                id="match-exec-file"
                value={executionFile}
                onChange={(e) => setExecutionFile(e.target.value)}
                disabled={loading}
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
              <label htmlFor="match-sched-file" className="text-xs font-medium text-slate-500">
                Schedule:
              </label>
              <select
                id="match-sched-file"
                value={scheduleFile}
                onChange={(e) => setScheduleFile(e.target.value)}
                disabled={loading}
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {schedOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => fetchMatches(executionFile, scheduleFile)}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-slate-600' : 'text-slate-500'}`} />
              <span>Run Match</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Execution Activities */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Execution Activities
            </span>
            <div className="p-1.5 bg-slate-100 rounded text-slate-600 border border-slate-200">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {loading ? '—' : totalExecution}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Source: {executionFile}
          </div>
        </div>

        {/* Exact Matches */}
        <div className="bg-white border border-emerald-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-800 uppercase tracking-wider">
              Exact Matches
            </span>
            <div className="p-1.5 bg-emerald-50 rounded text-emerald-600 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
            {loading ? '—' : exactMatches}
          </div>
          <div className="text-[11px] text-emerald-700/80 mt-1">
            {totalExecution > 0 ? `${Math.round((exactMatches / totalExecution) * 100)}% match rate` : '0%'}
          </div>
        </div>

        {/* Unmatched Activities */}
        <div className="bg-white border border-rose-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-rose-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-800 uppercase tracking-wider">
              Unmatched Activities
            </span>
            <div className="p-1.5 bg-rose-50 rounded text-rose-600 border border-rose-200">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-2 font-mono">
            {loading ? '—' : unmatchedCount}
          </div>
          <div className="text-[11px] text-rose-700/80 mt-1">
            {totalExecution > 0 ? `${Math.round((unmatchedCount / totalExecution) * 100)}% unmapped` : '0%'}
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-rose-900">Matching Error</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Matching Results Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {/* Table Header Controls */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Activity Matching Register (Exact ID)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Strict identity equality between execution and schedule Activity IDs
            </p>
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-md border border-slate-200 text-xs">
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
              All ({matches.length})
            </button>
            <button
              onClick={() => setFilter('MATCHED')}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === 'MATCHED'
                  ? 'bg-emerald-100 text-emerald-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              Matched ({exactMatches})
            </button>
            <button
              onClick={() => setFilter('UNMATCHED')}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === 'UNMATCHED'
                  ? 'bg-rose-100 text-rose-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              Unmatched ({unmatchedCount})
            </button>
          </div>
        </div>

        {/* Table Body */}
        <div className="p-6">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
              <span>Comparing execution activity IDs against schedule baseline...</span>
            </div>
          ) : filteredMatches.length > 0 ? (
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
                      <th className="px-4 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap min-w-[200px]">
                        Execution Activity Name
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        Schedule Activity ID
                      </th>
                      <th className="px-4 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap min-w-[200px]">
                        Schedule Activity Name
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Level
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Discipline
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-slate-900 text-center whitespace-nowrap">
                        Match Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredMatches.map((m, idx) => {
                      const isMatched = m.match_status === 'matched';
                      return (
                        <tr key={idx} className={`transition-colors ${isMatched ? 'hover:bg-emerald-50/30' : 'hover:bg-rose-50/30 bg-rose-50/10'}`}>
                          <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-400 bg-slate-50/50 border-r border-slate-200">
                            {m.index || idx + 1}
                          </td>
                          <td className="px-3.5 py-2.5 border-r border-slate-100 whitespace-nowrap">
                            <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {m.execution_activity_id}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 border-r border-slate-100 font-medium text-slate-900">
                            {m.execution_activity_name}
                          </td>
                          <td className="px-3.5 py-2.5 border-r border-slate-100 whitespace-nowrap">
                            {m.schedule_activity_id ? (
                              <span className="font-mono font-semibold text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                {m.schedule_activity_id}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">No Schedule Match</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 border-r border-slate-100 text-slate-700">
                            {m.schedule_activity_name || <span className="text-slate-400 italic text-[11px]">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                            {m.schedule_level ? (
                              <span className={`inline-block px-2 py-0.5 rounded text-[11px] border ${getLevelBadge(m.schedule_level)}`}>
                                {m.schedule_level}
                              </span>
                            ) : (
                              <span className="text-slate-300 italic">—</span>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getDisciplineBadge(m.discipline)}`}>
                              {m.discipline || 'General'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getMatchStatusBadge(m.match_status)}`}>
                              {isMatched ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 mr-1" />
                                  <span>Matched</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 text-rose-600 mr-1" />
                                  <span>Unmatched</span>
                                </>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span>
                  Showing <strong>{filteredMatches.length}</strong> of <strong>{matches.length}</strong> execution activities matched against <strong>{scheduleFile}</strong>
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  Exact ID Matching Engine • Feature 2.7
                </span>
              </div>
            </div>
          ) : (
            <div className="p-8 border border-dashed border-slate-300 rounded-lg text-center text-slate-500 text-xs bg-slate-50/50">
              No matching records found for filter ({filter}).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
