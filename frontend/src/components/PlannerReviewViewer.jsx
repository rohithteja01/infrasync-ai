import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, ShieldAlert, AlertCircle, RefreshCw, FileSpreadsheet, Filter, Info, Eye, Layers, Compass, CheckCircle2, Sparkles } from 'lucide-react';

function getPriorityBadge(priority) {
  switch (priority) {
    case 'HIGH':
      return 'bg-rose-50 text-rose-800 border-rose-200 font-bold';
    case 'MEDIUM':
    default:
      return 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
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

function getGranularityBadge(status) {
  switch (status) {
    case 'L6':
      return 'bg-blue-50 text-blue-700 border-blue-200 font-semibold';
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

const AVAILABLE_EXECUTION_FILES = [
  { id: 'test_execution_matches.xlsx', label: 'test_execution_matches.xlsx (Test Suite Progress)' },
  { id: 'test_site_progress.xlsx', label: 'test_site_progress.xlsx (Civil Field DPR)' },
  { id: 'test_multisheet_project.xlsx', label: 'test_multisheet_project.xlsx (Civil & Piping Progress)' },
];

const AVAILABLE_SCHEDULE_FILES = [
  { id: 'baseline_schedule.xlsx', label: 'baseline_schedule.xlsx (Baseline Schedule)' },
];

export default function PlannerReviewViewer({ executionFile: propExecFile, scheduleFile: propSchedFile, projectContext } = {}) {
  const hasNoData = !projectContext && !propExecFile;
  const initialExec = propExecFile || (projectContext?.files?.[0]?.filename || projectContext?.files?.[0]?.name) || (hasNoData ? '' : 'test_execution_matches.xlsx');
  const initialSched = propSchedFile || projectContext?.schedule_info?.filename || propExecFile || (projectContext?.files?.[0]?.filename || projectContext?.files?.[0]?.name) || (hasNoData ? '' : 'baseline_schedule.xlsx');

  const [executionFile, setExecutionFile] = useState(initialExec);
  const [scheduleFile, setScheduleFile] = useState(initialSched);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reviewData, setReviewData] = useState(() => {
    if (projectContext?.validation?.results) {
      const reviewItems = projectContext.validation.results.filter((r) => r.validation_status === 'PLANNER_REVIEW');
      return {
        status: 'success',
        total_review_items: reviewItems.length,
        high_priority_count: reviewItems.filter((r) => r.confidence_score < 0.70).length,
        medium_priority_count: reviewItems.filter((r) => r.confidence_score >= 0.70).length,
        results: reviewItems,
      };
    }
    return null;
  });
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'HIGH' | 'MEDIUM'
  const [selectedItem, setSelectedItem] = useState(null);

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
    if (projectContext?.validation?.results) {
      const reviewItems = projectContext.validation.results.filter((r) => r.validation_status === 'PLANNER_REVIEW');
      setReviewData({
        status: 'success',
        total_review_items: reviewItems.length,
        high_priority_count: reviewItems.filter((r) => r.confidence_score < 0.70).length,
        medium_priority_count: reviewItems.filter((r) => r.confidence_score >= 0.70).length,
        results: reviewItems,
      });
      if (reviewItems.length > 0) setSelectedItem(reviewItems[0]);
    }
  }, [projectContext]);

  const contextFiles = projectContext?.files || projectContext?.files_processed || [];
  const execOptions = [
    ...(contextFiles.map((f) => ({
      id: f.filename || f.name,
      label: `${f.filename || f.name} (Active Project)`,
    }))),
    ...AVAILABLE_EXECUTION_FILES.filter(
      (af) => !contextFiles.some((cf) => (cf.filename || cf.name) === af.id)
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
    ...((propExecFile || (projectContext?.files?.[0]?.filename || projectContext?.files?.[0]?.name)) && (propExecFile || (projectContext?.files?.[0]?.filename || projectContext?.files?.[0]?.name)) !== projectContext?.schedule_info?.filename
      ? [{ id: (propExecFile || (projectContext?.files?.[0]?.filename || projectContext?.files?.[0]?.name)), label: `${(propExecFile || (projectContext?.files?.[0]?.filename || projectContext?.files?.[0]?.name))} (Active Project)` }]
      : []),
    ...AVAILABLE_SCHEDULE_FILES,
  ].filter((item, index, self) => item.id && index === self.findIndex((t) => t.id === item.id));

  const fetchReviewData = useCallback(async (execFile, schedFile) => {
    if (hasNoData || !execFile) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/ingestion/validation/planner-review?execution_file=${encodeURIComponent(execFile)}&schedule_file=${encodeURIComponent(schedFile)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Server returned HTTP ${response.status}`);
      }

      setReviewData(data);
      if (data.results && data.results.length > 0) {
        setSelectedItem(data.results[0]);
      } else {
        setSelectedItem(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load planner review items.');
      setReviewData(null);
      setSelectedItem(null);
    } finally {
      setLoading(false);
    }
  }, [hasNoData]);

  useEffect(() => {
    if (!hasNoData && executionFile) {
      fetchReviewData(executionFile, scheduleFile);
    }
  }, [fetchReviewData, executionFile, scheduleFile, hasNoData]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-xl p-12 text-center shadow-sm max-w-2xl mx-auto my-6">
        <div className="w-14 h-14 bg-slate-100 dark:bg-[#252525] rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400 dark:text-neutral-500">
          <ClipboardCheck className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-neutral-100 mb-2">
          No Project Data Uploaded
        </h3>
        <p className="text-sm text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
          Upload and process a project data file in Project Intelligence to inspect flagged planner review items.
        </p>
      </div>
    );
  }

  const results = reviewData?.results || [];

  const filteredResults = results.filter((r) => {
    if (filter === 'HIGH') return r.review_priority === 'HIGH';
    if (filter === 'MEDIUM') return r.review_priority === 'MEDIUM';
    return true;
  });

  const totalItems = reviewData?.total_review_items ?? 0;
  const highCount = reviewData?.high_priority_count ?? 0;
  const mediumCount = reviewData?.medium_priority_count ?? 0;

  return (
    <div className="space-y-6">
      {/* Demo Fallback Data Banner */}
      {projectContext?.is_fallback && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3.5 flex items-center space-x-3 text-xs text-blue-800 dark:text-blue-300">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span>
            <strong>Demo Fallback Data Mode:</strong> Displaying realistic activities flagged for planner review and governance inspection.
          </span>
        </div>
      )}

      {/* Top Banner / Controls Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">Planner Review</h3>
                <span className="text-[11px] bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded font-mono font-semibold">
                  Feature 2.13
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Validation items requiring planner inspection before downstream action
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Execution File Select */}
            <div className="flex items-center space-x-1.5">
              <label htmlFor="rev-exec-file" className="text-xs font-medium text-slate-500">
                Execution:
              </label>
              <select
                id="rev-exec-file"
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
              <label htmlFor="rev-sched-file" className="text-xs font-medium text-slate-500">
                Schedule:
              </label>
              <select
                id="rev-sched-file"
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
              onClick={() => fetchReviewData(executionFile, scheduleFile)}
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Review Items */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Review Items
            </span>
            <div className="p-1.5 bg-slate-100 rounded text-slate-600 border border-slate-200">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {loading ? '—' : totalItems}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Activities routed to Planner Review register
          </div>
        </div>

        {/* High Priority */}
        <div className="bg-white border border-rose-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-rose-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900 uppercase tracking-wider">
              High Priority
            </span>
            <div className="p-1.5 bg-rose-50 rounded text-rose-700 border border-rose-200">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-2 font-mono">
            {loading ? '—' : highCount}
          </div>
          <div className="text-[11px] text-rose-700/80 mt-1">
            New activity candidates & unmapped items
          </div>
        </div>

        {/* Medium Priority */}
        <div className="bg-white border border-amber-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              Medium Priority
            </span>
            <div className="p-1.5 bg-amber-50 rounded text-amber-700 border border-amber-200">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2 font-mono">
            {loading ? '—' : mediumCount}
          </div>
          <div className="text-[11px] text-amber-700/80 mt-1">
            Matches with confidence below 90% threshold
          </div>
        </div>
      </div>

      {/* Governance Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 flex items-start space-x-3 text-xs text-slate-600">
        <Info className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold text-slate-900">Governance Notice: </span>
          Planner Review is an inspection stage. No schedule or database changes are made from this view.
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-rose-900">Planner Review Notice</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Review Register Table Container */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {/* Table Header Controls */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Planner Review Register
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspection list of execution activities requiring planner review and audit validation
            </p>
          </div>

          {/* Priority Filters */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-md border border-slate-200 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 px-1.5 flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              Priority:
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
              onClick={() => setFilter('HIGH')}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === 'HIGH'
                  ? 'bg-rose-100 text-rose-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              High ({highCount})
            </button>
            <button
              onClick={() => setFilter('MEDIUM')}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === 'MEDIUM'
                  ? 'bg-amber-100 text-amber-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              Medium ({mediumCount})
            </button>
          </div>
        </div>

        {/* Table Body */}
        <div className="p-6">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
              <span>Loading planner review items...</span>
            </div>
          ) : filteredResults.length > 0 ? (
            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100/90 text-slate-800 font-semibold border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 w-10 text-center text-slate-400 font-mono text-[11px] border-r border-slate-200 bg-slate-100">
                        #
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        Activity ID
                      </th>
                      <th className="px-4 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap min-w-[170px]">
                        Activity Name
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Candidate Tier
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Confidence
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Priority
                      </th>
                      <th className="px-4 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap min-w-[170px]">
                        Matched Schedule
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Granularity
                      </th>
                      <th className="px-4 py-2.5 font-semibold text-slate-900 min-w-[240px]">
                        Review Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredResults.map((r, idx) => {
                      const isSelected = selectedItem?.execution_activity_id === r.execution_activity_id;
                      return (
                        <tr
                          key={idx}
                          onClick={() => setSelectedItem(r)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-50/60 ring-1 ring-inset ring-indigo-300'
                              : 'hover:bg-slate-50/60'
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
                          <td className="px-3 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-xs border ${getConfidenceColor(r.confidence_percentage)}`}>
                              {r.confidence_percentage}%
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] border ${getPriorityBadge(r.review_priority)}`}>
                              {r.review_priority}
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
                          <td className="px-4 py-2.5 text-slate-600 text-xs leading-relaxed">
                            {r.review_reason}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span>
                  Showing <strong>{filteredResults.length}</strong> of <strong>{results.length}</strong> review items. Click a row to inspect full validation evidence below.
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  Planner Review • Feature 2.13
                </span>
              </div>
            </div>
          ) : (
            <div className="p-8 border border-dashed border-slate-300 rounded-lg text-center text-slate-500 text-xs bg-slate-50/50">
              No items match the current priority filter ({filter}).
            </div>
          )}
        </div>
      </div>

      {/* Selected Row Read-Only Detail Panel */}
      {selectedItem && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-indigo-600" />
              <h4 className="text-sm font-bold text-slate-900">
                Inspection Detail: <span className="font-mono text-indigo-700">{selectedItem.execution_activity_id}</span>
              </h4>
              <span className="text-xs text-slate-500">({selectedItem.execution_activity_name})</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">Priority:</span>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] border ${getPriorityBadge(selectedItem.review_priority)}`}>
                {selectedItem.review_priority}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Activity Information */}
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2 text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Activity Information
              </span>
              <div className="space-y-1">
                <div>
                  <span className="text-slate-400">Activity ID:</span>{' '}
                  <span className="font-mono font-semibold text-slate-800">{selectedItem.execution_activity_id}</span>
                </div>
                <div>
                  <span className="text-slate-400">Activity Name:</span>{' '}
                  <span className="font-medium text-slate-800">{selectedItem.execution_activity_name}</span>
                </div>
                <div>
                  <span className="text-slate-400">Discipline:</span>{' '}
                  <span className="font-semibold text-slate-700">{selectedItem.discipline}</span>
                </div>
                <div>
                  <span className="text-slate-400">Execution WBS:</span>{' '}
                  <span className="font-mono text-slate-700">{selectedItem.execution_wbs}</span>
                </div>
              </div>
            </div>

            {/* Validation */}
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2 text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Validation Metrics
              </span>
              <div className="space-y-1">
                <div>
                  <span className="text-slate-400">Candidate Tier:</span>{' '}
                  <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] border ${getTierBadge(selectedItem.candidate_tier)}`}>
                    {selectedItem.candidate_tier}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Confidence:</span>{' '}
                  <span className={`inline-block px-1.5 py-0.2 rounded font-mono font-bold text-[10px] border ${getConfidenceColor(selectedItem.confidence_percentage)}`}>
                    {selectedItem.confidence_percentage}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Validation Status:</span>{' '}
                  <span className="font-semibold text-amber-700">{selectedItem.validation_status}</span>
                </div>
                <div>
                  <span className="text-slate-400">Granularity:</span>{' '}
                  <span className="font-semibold text-slate-700">{selectedItem.granularity_status}</span>
                </div>
                <div>
                  <span className="text-slate-400">Discovery Status:</span>{' '}
                  <span className="font-semibold text-slate-700">{selectedItem.discovery_status}</span>
                </div>
              </div>
            </div>

            {/* Schedule Candidate */}
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2 text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Schedule Candidate
              </span>
              <div className="space-y-1">
                <div>
                  <span className="text-slate-400">Schedule ID:</span>{' '}
                  <span className="font-mono font-semibold text-slate-800">
                    {selectedItem.matched_schedule_activity_id || <span className="text-slate-400 italic font-normal">None / Unmapped</span>}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Schedule Name:</span>{' '}
                  <span className="font-medium text-slate-800">
                    {selectedItem.matched_schedule_activity_name || <span className="text-slate-400 italic font-normal">—</span>}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Schedule Level:</span>{' '}
                  <span className="font-semibold text-slate-700">
                    {selectedItem.matched_schedule_level || <span className="text-slate-400 italic font-normal">—</span>}
                  </span>
                </div>
              </div>
            </div>

            {/* Evidence & Inspection Note */}
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2 text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Inspection Guidance
              </span>
              <div className="space-y-1 text-slate-600">
                <div>
                  <span className="text-slate-400">Review Reason:</span>
                  <p className="mt-0.5 text-[11px] text-slate-800 leading-snug">{selectedItem.review_reason}</p>
                </div>
                {selectedItem.evidence_summary?.inspection_note && (
                  <div className="pt-1 border-t border-slate-200/60">
                    <span className="text-slate-400">Planner Action Note:</span>
                    <p className="mt-0.5 text-[11px] text-indigo-900 leading-snug">{selectedItem.evidence_summary.inspection_note}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
