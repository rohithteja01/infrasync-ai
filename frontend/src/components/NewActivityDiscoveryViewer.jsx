import React, { useState, useEffect, useCallback } from 'react';
import { Compass, CheckCircle2, HelpCircle, RefreshCw, AlertCircle, FileSpreadsheet, Filter, FilePlus2, Search, Info } from 'lucide-react';

function getDiscoveryBadge(status) {
  switch (status) {
    case 'NEW_ACTIVITY_CANDIDATE':
      return 'bg-amber-50 text-amber-900 border-amber-300 font-bold';
    case 'EXISTING_ACTIVITY':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold';
    case 'POSSIBLE_EXISTING_ACTIVITY':
      return 'bg-blue-50 text-blue-800 border-blue-200 font-semibold';
    case 'UNKNOWN':
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 font-medium';
  }
}

function getDiscoveryLabel(status) {
  switch (status) {
    case 'NEW_ACTIVITY_CANDIDATE':
      return 'New Activity Candidate';
    case 'EXISTING_ACTIVITY':
      return 'Existing Activity';
    case 'POSSIBLE_EXISTING_ACTIVITY':
      return 'Possible Existing';
    case 'UNKNOWN':
    default:
      return 'Unknown';
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
    case 'NONE':
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

export default function NewActivityDiscoveryViewer({ executionFile: propExecFile, scheduleFile: propSchedFile, projectContext } = {}) {
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
  const [discoveryData, setDiscoveryData] = useState(null);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'EXISTING_ACTIVITY' | 'POSSIBLE_EXISTING_ACTIVITY' | 'NEW_ACTIVITY_CANDIDATE' | 'UNKNOWN'

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
      setDiscoveryData({
        execution_filename: initialExec || 'demo_fallback_data',
        schedule_filename: initialSched || 'baseline_schedule.xlsx',
        total_evaluated: acts.length,
        existing_activities: 9,
        possible_existing_activities: 0,
        new_activity_candidates: 1,
        unknown_count: 0,
        results: acts.map((a) => {
          const isDiscovered = a.match_tier === 'DISCOVERED';
          return {
            execution_activity_id: a.activity_id,
            execution_activity_name: a.activity_name,
            discipline: a.discipline,
            discovery_status: isDiscovered ? 'NEW_ACTIVITY_CANDIDATE' : 'EXISTING_ACTIVITY',
            confidence_score: a.confidence_score,
            review_required: isDiscovered,
            reason: isDiscovered
              ? 'Zero schedule correspondence across ID, fuzzy tokens, or embeddings. Discovered field activity requiring Planner Review.'
              : `Matched to baseline schedule node (${a.match_tier})`,
            suggested_action: isDiscovered ? 'FLAG_FOR_PLANNER_REVIEW' : 'MAP_TO_EXISTING_SCHEDULE_NODE'
          };
        })
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

  const fetchDiscoveries = useCallback(async (execFile, schedFile) => {
    if (hasNoData || !execFile || projectContext?.is_fallback) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/ingestion/match/new-activities?execution_file=${encodeURIComponent(execFile)}&schedule_file=${encodeURIComponent(schedFile)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Server returned HTTP ${response.status}`);
      }

      setDiscoveryData(data);
    } catch (err) {
      setError(err.message || 'Failed to evaluate new activity candidates.');
      setDiscoveryData(null);
    } finally {
      setLoading(false);
    }
  }, [hasNoData, projectContext]);

  useEffect(() => {
    fetchDiscoveries(executionFile, scheduleFile);
  }, [fetchDiscoveries, executionFile, scheduleFile]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2e2e2e] rounded-xl p-8 text-center shadow-xs">
        <div className="max-w-md mx-auto space-y-3">
          <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-[#252525] text-slate-400">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-neutral-200">No Active Project Data</h3>
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            Upload a project data file in Project Intelligence to inspect new unmapped activity candidate discovery.
          </p>
        </div>
      </div>
    );
  }

  const results = discoveryData?.results || [];

  const filteredResults = results.filter((r) => {
    if (filter === 'ALL') return true;
    return r.discovery_status === filter;
  });

  const totalEvaluated = discoveryData?.total_evaluated ?? 0;
  const existingCount = discoveryData?.existing_activity_count ?? 0;
  const possibleExistingCount = discoveryData?.possible_existing_count ?? 0;
  const newCandidateCount = discoveryData?.new_activity_candidate_count ?? 0;
  const unknownCount = discoveryData?.unknown_count ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Banner / Controls Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-md border border-amber-200">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">New Activity Discovery</h3>
                <span className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-mono font-semibold">
                  Feature 2.11
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Identifies unmapped field execution activities proposed as new schedule activities based on descriptive field evidence
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Execution File Select */}
            <div className="flex items-center space-x-1.5">
              <label htmlFor="disc-exec-file" className="text-xs font-medium text-slate-500">
                Execution:
              </label>
              <select
                id="disc-exec-file"
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
              <label htmlFor="disc-sched-file" className="text-xs font-medium text-slate-500">
                Schedule:
              </label>
              <select
                id="disc-sched-file"
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
              onClick={() => fetchDiscoveries(executionFile, scheduleFile)}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Evaluated */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Activities Evaluated
            </span>
            <div className="p-1.5 bg-slate-100 rounded text-slate-600 border border-slate-200">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {loading ? '—' : totalEvaluated}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Total execution tasks analyzed
          </div>
        </div>

        {/* Existing Activities */}
        <div className="bg-white border border-emerald-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-800 uppercase tracking-wider">
              Existing Activities
            </span>
            <div className="p-1.5 bg-emerald-50 rounded text-emerald-600 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
            {loading ? '—' : existingCount}
          </div>
          <div className="text-[11px] text-emerald-700/80 mt-1">
            Exact match in schedule (Not New)
          </div>
        </div>

        {/* Possible Existing */}
        <div className="bg-white border border-blue-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-blue-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-800 uppercase tracking-wider">
              Possible Existing
            </span>
            <div className="p-1.5 bg-blue-50 rounded text-blue-600 border border-blue-200">
              <Search className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-700 mt-2 font-mono">
            {loading ? '—' : possibleExistingCount}
          </div>
          <div className="text-[11px] text-blue-700/80 mt-1">
            Fuzzy / Semantic candidate (Not New)
          </div>
        </div>

        {/* New Activity Candidates */}
        <div className="bg-white border border-amber-200 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-amber-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              New Activity Candidates
            </span>
            <div className="p-1.5 bg-amber-100 rounded text-amber-700 border border-amber-300">
              <FilePlus2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2 font-mono">
            {loading ? '—' : newCandidateCount}
          </div>
          <div className="text-[11px] text-amber-800/90 mt-1 font-medium">
            Unmapped with descriptive evidence
          </div>
        </div>

        {/* Unknown */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Unknown
            </span>
            <div className="p-1.5 bg-slate-100 rounded text-slate-500 border border-slate-200">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-700 mt-2 font-mono">
            {loading ? '—' : unknownCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Insufficient information to propose
          </div>
        </div>
      </div>

      {/* Discovery Governance Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 flex items-start space-x-3 text-xs text-slate-600">
        <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold text-slate-900">Governance & Proposal Policy: </span>
          New Activity Candidates are analytical proposals generated because no baseline schedule activity corresponds to the execution scope.
          This system does <strong>not</strong> auto-create activities in the database or modify schedule files. Formal planner approval and schedule baseline change controls occur in later governance stages.
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-rose-900">New Activity Discovery Notice</p>
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
              New Activity Discovery Register
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluation of unmapped execution records against existing baseline schedule hierarchy
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
              onClick={() => setFilter('EXISTING_ACTIVITY')}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === 'EXISTING_ACTIVITY'
                  ? 'bg-emerald-100 text-emerald-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              Existing ({existingCount})
            </button>
            <button
              onClick={() => setFilter('POSSIBLE_EXISTING_ACTIVITY')}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === 'POSSIBLE_EXISTING_ACTIVITY'
                  ? 'bg-blue-100 text-blue-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-blue-700'
              }`}
            >
              Possible Existing ({possibleExistingCount})
            </button>
            <button
              onClick={() => setFilter('NEW_ACTIVITY_CANDIDATE')}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === 'NEW_ACTIVITY_CANDIDATE'
                  ? 'bg-amber-100 text-amber-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-amber-800'
              }`}
            >
              New Candidates ({newCandidateCount})
            </button>
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
              <RefreshCw className="w-5 h-5 animate-spin text-amber-600" />
              <span>Analyzing matching hierarchy and evaluating new activity candidates...</span>
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
                        Activity Name
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Discipline
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-slate-900 font-mono text-center border-r border-slate-200 whitespace-nowrap">
                        WBS
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Discovery Status
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Candidate Tier
                      </th>
                      <th className="px-4 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap min-w-[180px]">
                        Matched Schedule Activity
                      </th>
                      <th className="px-4 py-2.5 font-semibold text-slate-900 min-w-[260px]">
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredResults.map((r, idx) => {
                      const isCandidate = r.discovery_status === 'NEW_ACTIVITY_CANDIDATE';
                      const isExisting = r.discovery_status === 'EXISTING_ACTIVITY';
                      const isPossible = r.discovery_status === 'POSSIBLE_EXISTING_ACTIVITY';

                      return (
                        <tr
                          key={idx}
                          className={`transition-colors ${
                            isCandidate
                              ? 'bg-amber-50/20 hover:bg-amber-50/40'
                              : isExisting
                              ? 'hover:bg-slate-50/60'
                              : isPossible
                              ? 'hover:bg-blue-50/25'
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
                          <td className="px-3.5 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getDisciplineBadge(r.discipline)}`}>
                              {r.discipline || 'General'}
                            </span>
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
                          <td className="px-3.5 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                            <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] border ${getDiscoveryBadge(r.discovery_status)}`}>
                              {getDiscoveryLabel(r.discovery_status)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] border ${getTierBadge(r.candidate_tier)}`}>
                              {r.candidate_tier}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 border-r border-slate-100 whitespace-nowrap">
                            {r.matched_schedule_activity_id ? (
                              <div>
                                <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mr-1.5">
                                  {r.matched_schedule_activity_id}
                                </span>
                                <span className="text-slate-600 text-xs">
                                  {r.matched_schedule_activity_name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">None / Unmapped</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 text-xs leading-relaxed">
                            {r.new_activity_reason}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span>
                  Showing <strong>{filteredResults.length}</strong> of <strong>{results.length}</strong> execution activities analyzed against <strong>{scheduleFile}</strong>
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  New Activity Discovery • Feature 2.11
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
