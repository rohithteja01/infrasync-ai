import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, CheckCircle2, HelpCircle, XCircle, RefreshCw, AlertCircle, FileSpreadsheet, Filter, Percent, Sliders } from 'lucide-react';

function getMatchStatusBadge(status) {
  if (status === 'possible_match') {
    return 'bg-amber-50 text-amber-800 border-amber-200';
  }
  return 'bg-slate-100 text-slate-600 border-slate-200';
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

export default function FuzzyMatchingViewer({ executionFile: propExecFile, scheduleFile: propSchedFile, projectContext } = {}) {
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
  const [threshold, setThreshold] = useState(0.70);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fuzzyData, setFuzzyData] = useState(null);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'POSSIBLE' | 'NO_MATCH'

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
      const nonExact = projectContext.activities.filter(a => a.match_tier !== 'EXACT');
      setFuzzyData({
        execution_filename: initialExec || 'demo_fallback_data',
        schedule_filename: initialSched || 'baseline_schedule.xlsx',
        unmatched_execution_count: nonExact.length,
        possible_fuzzy_matches: 1,
        no_match_count: nonExact.length - 1,
        matches: nonExact.map(a => {
          const isFuzzy = a.match_tier === 'FUZZY';
          return {
            execution_activity_id: a.activity_id,
            execution_activity_name: a.activity_name,
            discipline: a.discipline,
            level: a.activity_id.includes('L5') ? 'L5' : 'L6',
            match_status: isFuzzy ? 'possible_match' : 'unmatched',
            similarity_score: isFuzzy ? 0.74 : 0.38,
            threshold_applied: threshold,
            best_match: isFuzzy ? {
              schedule_activity_id: a.activity_id,
              schedule_activity_name: a.activity_name,
              similarity_score: 0.74,
              discipline: a.discipline,
              level: 'L6'
            } : null,
            candidate_matches: isFuzzy ? [{
              schedule_activity_id: a.activity_id,
              schedule_activity_name: a.activity_name,
              similarity_score: 0.74,
              discipline: a.discipline,
              level: 'L6'
            }] : []
          };
        })
      });
    }
  }, [projectContext, initialExec, initialSched, threshold]);

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

  const fetchFuzzyMatches = useCallback(async (execFile, schedFile, thresh) => {
    if (hasNoData || !execFile || projectContext?.is_fallback) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/ingestion/match/fuzzy?execution_file=${encodeURIComponent(execFile)}&schedule_file=${encodeURIComponent(schedFile)}&threshold=${thresh}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Server returned HTTP ${response.status}`);
      }

      setFuzzyData(data);
    } catch (err) {
      setError(err.message || 'Failed to compute fuzzy activity matches.');
      setFuzzyData(null);
    } finally {
      setLoading(false);
    }
  }, [hasNoData, projectContext]);

  useEffect(() => {
    fetchFuzzyMatches(executionFile, scheduleFile, threshold);
  }, [fetchFuzzyMatches, executionFile, scheduleFile, threshold]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2e2e2e] rounded-xl p-8 text-center shadow-xs">
        <div className="max-w-md mx-auto space-y-3">
          <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-[#252525] text-slate-400">
            <GitCompare className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-neutral-200">No Active Project Data</h3>
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            Upload a project data file in Project Intelligence to inspect probabilistic Fuzzy text matching.
          </p>
        </div>
      </div>
    );
  }

  const matches = fuzzyData?.matches || [];

  const filteredMatches = matches.filter((m) => {
    if (filter === 'POSSIBLE') return m.match_status === 'possible_match';
    if (filter === 'NO_MATCH') return m.match_status === 'unmatched';
    return true;
  });

  const unmatchedExecutionCount = fuzzyData?.unmatched_execution_count ?? 0;
  const possibleFuzzyMatches = fuzzyData?.possible_fuzzy_matches ?? 0;
  const noMatchCount = fuzzyData?.no_match_count ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Banner / Source Selector */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-md border border-amber-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">Fuzzy Activity Matching</h3>
                <span className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-mono font-semibold">
                  Feature 2.8
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Local text similarity for execution activities unmatched by exact ID (isolated from Feature 2.7 exact matches)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Execution File Select */}
            <div className="flex items-center space-x-1.5">
              <label htmlFor="fuzzy-exec-file" className="text-xs font-medium text-slate-500">
                Execution:
              </label>
              <select
                id="fuzzy-exec-file"
                value={executionFile}
                onChange={(e) => setExecutionFile(e.target.value)}
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
              <label htmlFor="fuzzy-sched-file" className="text-xs font-medium text-slate-500">
                Schedule:
              </label>
              <select
                id="fuzzy-sched-file"
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

            {/* Threshold Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <label htmlFor="threshold-select" className="text-xs font-medium text-slate-500">
                Threshold:
              </label>
              <select
                id="threshold-select"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                disabled={loading}
                className="text-xs font-semibold text-slate-800 bg-transparent border-0 focus:ring-0 p-0 cursor-pointer"
              >
                <option value={0.60}>60%</option>
                <option value={0.65}>65%</option>
                <option value={0.70}>70% (Default)</option>
                <option value={0.75}>75%</option>
                <option value={0.80}>80%</option>
              </select>
            </div>

            <button
              onClick={() => fetchFuzzyMatches(executionFile, scheduleFile, threshold)}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-slate-600' : 'text-slate-500'}`} />
              <span>Re-run</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards (Requirement 10) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Unmatched Execution Activities */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Unmatched Execution Activities
            </span>
            <div className="p-1.5 bg-slate-100 rounded text-slate-600 border border-slate-200">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {loading ? '—' : unmatchedExecutionCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Exact matches are excluded
          </div>
        </div>

        {/* Possible Fuzzy Matches */}
        <div className="bg-white border border-amber-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800 uppercase tracking-wider">
              Possible Fuzzy Matches
            </span>
            <div className="p-1.5 bg-amber-50 rounded text-amber-600 border border-amber-200">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2 font-mono">
            {loading ? '—' : possibleFuzzyMatches}
          </div>
          <div className="text-[11px] text-amber-700/80 mt-1">
            Similarity &ge; {Math.round(threshold * 100)}% (Pending review)
          </div>
        </div>

        {/* No Match Found */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              No Match Found
            </span>
            <div className="p-1.5 bg-slate-100 rounded text-slate-600 border border-slate-200">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-700 mt-2 font-mono">
            {loading ? '—' : noMatchCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Similarity &lt; {Math.round(threshold * 100)}%
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-rose-900">Fuzzy Matching Notice</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Fuzzy Matching Table Container */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {/* Table Header Controls */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Candidate Suggestions Register (Fuzzy Similarity)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Suggested schedule baseline activities based on local difflib text similarity
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
              onClick={() => setFilter('POSSIBLE')}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === 'POSSIBLE'
                  ? 'bg-amber-100 text-amber-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              Possible ({possibleFuzzyMatches})
            </button>
            <button
              onClick={() => setFilter('NO_MATCH')}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === 'NO_MATCH'
                  ? 'bg-slate-200 text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              No Match ({noMatchCount})
            </button>
          </div>
        </div>

        {/* Table Body (Requirements 6 & 10) */}
        <div className="p-6">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin text-amber-600" />
              <span>Analyzing text similarity against schedule baseline...</span>
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
                        Suggested Schedule ID
                      </th>
                      <th className="px-4 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap min-w-[200px]">
                        Suggested Schedule Name
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Level
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Discipline
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Similarity
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-slate-900 text-center whitespace-nowrap">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredMatches.map((m, idx) => {
                      const isPossible = m.match_status === 'possible_match';
                      return (
                        <tr key={idx} className={`transition-colors ${isPossible ? 'hover:bg-amber-50/30' : 'hover:bg-slate-50/50'}`}>
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
                            {m.suggested_schedule_activity_id ? (
                              <span className="font-mono font-semibold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                {m.suggested_schedule_activity_id}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">No Candidate</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 border-r border-slate-100 text-slate-700">
                            {m.suggested_schedule_activity_name || <span className="text-slate-400 italic text-[11px]">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                            {m.suggested_schedule_level ? (
                              <span className={`inline-block px-2 py-0.5 rounded text-[11px] border ${getLevelBadge(m.suggested_schedule_level)}`}>
                                {m.suggested_schedule_level}
                              </span>
                            ) : (
                              <span className="text-slate-300 italic">—</span>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getDisciplineBadge(m.suggested_discipline)}`}>
                              {m.suggested_discipline || 'General'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                            <span className={`font-mono font-bold text-xs ${isPossible ? 'text-amber-700' : 'text-slate-500'}`}>
                              {m.similarity_percentage}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getMatchStatusBadge(m.match_status)}`}>
                              {isPossible ? (
                                <>
                                  <HelpCircle className="w-3 h-3 text-amber-600 mr-1" />
                                  <span>Possible Match</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 text-slate-400 mr-1" />
                                  <span>No Match</span>
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
                  Showing <strong>{filteredMatches.length}</strong> of <strong>{matches.length}</strong> unmatched activities evaluated against <strong>{scheduleFile}</strong>
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  Fuzzy Activity Matching • Feature 2.8
                </span>
              </div>
            </div>
          ) : (
            <div className="p-8 border border-dashed border-slate-300 rounded-lg text-center text-slate-500 text-xs bg-slate-50/50">
              No fuzzy candidate activities match the current filter ({filter}).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
