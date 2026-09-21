import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, AlertCircle, FileSpreadsheet, Filter, Percent, Info, UserCheck, Sparkles } from 'lucide-react';

function getValidationBadge(status) {
  switch (status) {
    case 'AUTO_ACCEPT':
      return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
    case 'PLANNER_REVIEW':
    default:
      return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
  }
}

function getTierBadge(tier) {
  switch (tier) {
    case 'EXACT':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold';
    case 'FUZZY':
      return 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
    case 'SEMANTIC':
      return 'bg-blue-50 text-blue-800 border-blue-200 font-semibold';
    case 'NEW_ACTIVITY':
      return 'bg-purple-50 text-purple-800 border-purple-200 font-semibold';
    case 'NONE':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

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
      return 'bg-slate-100 text-slate-500 border-slate-200';
  }
}

function getConfidenceColor(pct) {
  if (pct >= 90) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (pct >= 70) return 'text-blue-700 bg-blue-50 border-blue-200';
  if (pct > 0) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-slate-500 bg-slate-100 border-slate-200';
}

function getConfidenceScoreBadge(score) {
  const pct = Math.round(score * 100);
  if (pct >= 90) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (pct >= 70) return 'text-blue-700 bg-blue-50 border-blue-200';
  if (pct > 0) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-slate-500 bg-slate-100 border-slate-200';
}

const AVAILABLE_EXECUTION_FILES = [
  { id: 'test_execution_matches.xlsx', label: 'test_execution_matches.xlsx (Test Suite Progress)' },
  { id: 'test_site_progress.xlsx', label: 'test_site_progress.xlsx (Civil Field DPR)' },
  { id: 'test_multisheet_project.xlsx', label: 'test_multisheet_project.xlsx (Civil & Piping Progress)' },
];

const AVAILABLE_SCHEDULE_FILES = [
  { id: 'baseline_schedule.xlsx', label: 'baseline_schedule.xlsx (Baseline Schedule)' },
];

export default function ConfidenceValidationViewer({ executionFile: propExecFile, scheduleFile: propSchedFile, projectContext } = {}) {
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
  const [validationData, setValidationData] = useState(projectContext?.validation || null);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'AUTO_ACCEPT' | 'PLANNER_REVIEW'

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
    if (projectContext?.validation) {
      setValidationData(projectContext.validation);
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

  const fetchConfidenceData = useCallback(async (execFile, schedFile) => {
    if (hasNoData || !execFile) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/ingestion/validation/confidence?execution_file=${encodeURIComponent(execFile)}&schedule_file=${encodeURIComponent(schedFile)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Server returned HTTP ${response.status}`);
      }

      setValidationData(data);
    } catch (err) {
      setError(err.message || 'Failed to compute validation confidence scores.');
      setValidationData(null);
    } finally {
      setLoading(false);
    }
  }, [hasNoData]);

  useEffect(() => {
    if (!hasNoData && executionFile) {
      fetchConfidenceData(executionFile, scheduleFile);
    }
  }, [fetchConfidenceData, executionFile, scheduleFile, hasNoData]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-xl p-12 text-center shadow-sm max-w-2xl mx-auto my-6">
        <div className="w-14 h-14 bg-slate-100 dark:bg-[#252525] rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400 dark:text-neutral-500">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-neutral-100 mb-2">
          No Project Data Uploaded
        </h3>
        <p className="text-sm text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
          Upload and process a project data file in Project Intelligence to inspect confidence scoring and validation governance.
        </p>
      </div>
    );
  }

  const results = validationData?.results || [];

  const filteredResults = results.filter((r) => {
    if (filter === 'ALL') return true;
    return r.validation_status === filter;
  });

  const totalEvaluated = validationData?.total_evaluated ?? 0;
  const autoAcceptCount = validationData?.auto_accept_count ?? 0;
  const plannerReviewCount = validationData?.planner_review_count ?? 0;
  const avgConfidence = validationData?.average_confidence ? Math.round(validationData.average_confidence * 1000) / 10 : 0;
  const autoAcceptThreshold = validationData?.auto_accept_threshold ? Math.round(validationData.auto_accept_threshold * 100) : 90;

  return (
    <div className="space-y-6">
      {/* Demo Fallback Data Banner */}
      {projectContext?.is_fallback && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3.5 flex items-center space-x-3 text-xs text-blue-800 dark:text-blue-300">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span>
            <strong>Demo Fallback Data Mode:</strong> Displaying realistic cross-discipline engineering dataset generated from uploaded file for validation & governance analysis.
          </span>
        </div>
      )}

      {/* Top Banner / Controls Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">Confidence Score & Validation Classification</h3>
                <span className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-mono font-semibold">
                  Feature 2.12
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Deterministic confidence scoring across matching tiers with validation classification (Auto Accept vs. Planner Review)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Execution File Select */}
            <div className="flex items-center space-x-1.5">
              <label htmlFor="val-exec-file" className="text-xs font-medium text-slate-500">
                Execution:
              </label>
              <select
                id="val-exec-file"
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
              <label htmlFor="val-sched-file" className="text-xs font-medium text-slate-500">
                Schedule:
              </label>
              <select
                id="val-sched-file"
                value={scheduleFile}
                onChange={(e) => setScheduleFile(e.target.value)}
                disabled={loading}
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {AVAILABLE_SCHEDULE_FILES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => fetchConfidenceData(executionFile, scheduleFile)}
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
            Total execution records analyzed
          </div>
        </div>

        {/* Auto Accept */}
        <div className="bg-white border border-emerald-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
              Auto Accept
            </span>
            <div className="p-1.5 bg-emerald-50 rounded text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
            {loading ? '—' : autoAcceptCount}
          </div>
          <div className="text-[11px] text-emerald-700/80 mt-1">
            Confidence &ge; {autoAcceptThreshold}% or Exact ID match
          </div>
        </div>

        {/* Planner Review */}
        <div className="bg-white border border-amber-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              Planner Review
            </span>
            <div className="p-1.5 bg-amber-50 rounded text-amber-700 border border-amber-200">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2 font-mono">
            {loading ? '—' : plannerReviewCount}
          </div>
          <div className="text-[11px] text-amber-700/80 mt-1">
            Confidence &lt; {autoAcceptThreshold}% or New Activity
          </div>
        </div>

        {/* Average Confidence */}
        <div className="bg-white border border-indigo-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-indigo-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-900 uppercase tracking-wider">
              Average Confidence
            </span>
            <div className="p-1.5 bg-indigo-50 rounded text-indigo-700 border border-indigo-200">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-700 mt-2 font-mono">
            {loading ? '—' : `${avgConfidence}%`}
          </div>
          <div className="text-[11px] text-indigo-700/80 mt-1">
            Weighted across all execution items
          </div>
        </div>
      </div>

      {/* Architecture Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 flex items-start space-x-3 text-xs text-slate-600">
        <Info className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold text-slate-900">Validation Governance Policy: </span>
          Confidence scoring supports validation classification. <strong>Auto Accept</strong> is an analytical classification only;
          no schedule modifications or database mutations are executed. Activities requiring <strong>Planner Review</strong> represent low-confidence matches or candidate scope additions pending planner governance in later stages.
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-rose-900">Validation Confidence Notice</p>
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
              Validation Classification Register
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Deterministic validation status and confidence evidence across execution activities
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
              All ({results.length})
            </button>
            <button
              onClick={() => setFilter('AUTO_ACCEPT')}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === 'AUTO_ACCEPT'
                  ? 'bg-emerald-100 text-emerald-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              Auto Accept ({autoAcceptCount})
            </button>
            <button
              onClick={() => setFilter('PLANNER_REVIEW')}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === 'PLANNER_REVIEW'
                  ? 'bg-amber-100 text-amber-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              Planner Review ({plannerReviewCount})
            </button>
          </div>
        </div>

        {/* Table Body */}
        <div className="p-6">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
              <span>Computing deterministic confidence scores and validation classifications...</span>
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
                      <th className="px-4 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap min-w-[170px]">
                        Activity Name
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Match Tier
                      </th>
                      <th className="px-4 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap min-w-[170px]">
                        Matched Schedule Activity
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Granularity
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Confidence
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Validation Status
                      </th>
                      <th className="px-4 py-2.5 font-semibold text-slate-900 min-w-[240px]">
                        Confidence Basis
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredResults.map((r, idx) => {
                      const isAuto = r.validation_status === 'AUTO_ACCEPT';
                      return (
                        <tr
                          key={idx}
                          className={`transition-colors ${
                            isAuto ? 'hover:bg-emerald-50/20' : 'hover:bg-amber-50/25'
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
                          <td className="px-3 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] border ${getGranularityBadge(r.granularity_status)}`}>
                              {r.granularity_status}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                            <div className="inline-flex flex-col items-center">
                              <span className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-xs border ${getConfidenceColor(r.confidence_percentage)}`}>
                                {r.confidence_percentage}%
                              </span>
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                            <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] border ${getValidationBadge(r.validation_status)}`}>
                              {isAuto ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 mr-1" />
                                  <span>Auto Accept</span>
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="w-3 h-3 text-amber-600 mr-1" />
                                  <span>Planner Review</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 text-xs leading-relaxed">
                            {r.confidence_basis}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span>
                  Showing <strong>{filteredResults.length}</strong> of <strong>{results.length}</strong> execution activities validated against <strong>{scheduleFile}</strong>
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  Confidence & Validation • Feature 2.12
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
