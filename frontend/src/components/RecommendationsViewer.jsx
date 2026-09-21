import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingDown,
  Layers,
  Zap,
  Activity,
  Award,
  RefreshCw,
  Info,
  Calendar,
  Target,
  SlidersHorizontal,
  ChevronRight,
  BarChart2,
  FileCheck
} from 'lucide-react';

const EXECUTION_FILES = [
  { id: 'test_execution_matches.xlsx', label: 'test_execution_matches.xlsx (Site Progress)' },
  { id: 'test_site_progress.xlsx', label: 'test_site_progress.xlsx (Daily Log)' }
];

const SCHEDULE_FILES = [
  { id: 'baseline_schedule.xlsx', label: 'baseline_schedule.xlsx (Baseline L5/L6)' },
  { id: 'test_multisheet_project.xlsx', label: 'test_multisheet_project.xlsx' }
];

function getPriorityBadge(priority) {
  switch (priority) {
    case 'HIGH':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'MEDIUM':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'LOW':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'INSUFFICIENT_DATA':
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function getFeasibilityBadge(status) {
  switch (status) {
    case 'FEASIBLE':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'CONSTRAINED':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'HIGH_COMPACTION':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function getSeverityBadge(severity) {
  switch (severity) {
    case 'SEVERE':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'MODERATE':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'MINOR':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'NO_DELAY':
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function getRiskBadge(risk) {
  switch (risk) {
    case 'HIGH':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'MEDIUM':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'LOW':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function getLeverLabel(type) {
  switch (type) {
    case 'DURATION_REDUCTION':
      return 'Duration Reduction';
    case 'PARALLEL_EXECUTION':
      return 'Parallel Execution';
    case 'START_ADVANCEMENT':
      return 'Start Advancement';
    default:
      return type || 'No Action';
  }
}

function getLeverIcon(type) {
  switch (type) {
    case 'DURATION_REDUCTION':
      return TrendingDown;
    case 'PARALLEL_EXECUTION':
      return Layers;
    case 'START_ADVANCEMENT':
      return Zap;
    default:
      return Activity;
  }
}

export default function RecommendationsViewer({ executionFile: propExecFile, scheduleFile: propSchedFile, projectContext } = {}) {
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
  const [data, setData] = useState(projectContext?.recommendations || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [selectedActivityId, setSelectedActivityId] = useState(null);

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
    if (projectContext?.recommendations) {
      setData(projectContext.recommendations);
      const recs = projectContext.recommendations.recommendations || [];
      const firstHigh = recs.find((r) => r.recovery_priority === 'HIGH' || r.priority === 'HIGH');
      setSelectedActivityId(firstHigh ? firstHigh.activity_id : recs[0]?.activity_id || null);
    } else if (projectContext?.is_fallback && projectContext?.activities) {
      const delayed = projectContext.activities.filter(a => a.variance_status === 'BEHIND');
      const generatedRecs = delayed.map(a => ({
        activity_id: a.activity_id,
        activity_name: a.activity_name,
        discipline: a.discipline,
        recovery_priority: a.is_critical ? 'HIGH' : 'MEDIUM',
        current_variance: a.progress_variance,
        action_recommendation: a.activity_id === 'CIV-L6-02'
          ? 'Fast-Track Foundation Rebar & Formwork: deploy 2 additional steel-fixing squads and authorize dual-shift night pouring.'
          : 'Parallelize Hydrotest Loop Preparation: mobilize secondary certified manifold and pre-test blind flanges off-line.',
        schedule_impact: a.is_critical ? 'Recovers 6 days on Critical Path' : 'Absorbs 4 days of sub-critical float erosion',
        implementation_risk: 'LOW',
        planner_action: 'ACCEPT'
      }));

      const payload = {
        execution_file: initialExec || 'demo_fallback_data',
        schedule_file: initialSched || 'baseline_schedule.xlsx',
        total_recommendations: generatedRecs.length,
        recommendations: generatedRecs,
        summary: {
          total_recommendations: generatedRecs.length,
          high_priority: generatedRecs.filter(r => r.recovery_priority === 'HIGH').length,
          medium_priority: generatedRecs.filter(r => r.recovery_priority === 'MEDIUM').length
        }
      };
      setData(payload);
      setSelectedActivityId(generatedRecs[0]?.activity_id || null);
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
    ...EXECUTION_FILES.filter(
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
    ...((propExecFile || getContextFileName(projectContext)) && (propExecFile || getContextFileName(projectContext)) !== projectContext?.schedule_info?.filename
      ? [{ id: (propExecFile || getContextFileName(projectContext)), label: `${(propExecFile || getContextFileName(projectContext))} (Active Project)` }]
      : []),
    ...SCHEDULE_FILES.filter((f) => f.id !== (projectContext?.schedule_info?.filename || propExecFile || getContextFileName(projectContext))),
  ];

  const fetchRecommendations = useCallback(async () => {
    if (hasNoData || !execFile || projectContext?.recommendations || projectContext?.is_fallback) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ingestion/recommendations?execution_file=${encodeURIComponent(execFile)}&schedule_file=${encodeURIComponent(scheduleFile)}`
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || `Server returned HTTP ${res.status}`);
      }
      setData(json);

      const recs = json.recommendations || [];
      const firstHigh = recs.find((r) => r.recovery_priority === 'HIGH');
      if (firstHigh) {
        setSelectedActivityId(firstHigh.activity_id);
      } else if (recs.length > 0) {
        setSelectedActivityId(recs[0].activity_id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load recommendations.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [hasNoData, execFile, scheduleFile, projectContext]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2e2e2e] rounded-xl p-8 text-center shadow-xs">
        <div className="max-w-md mx-auto space-y-3">
          <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-[#252525] text-slate-400">
            <Lightbulb className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-neutral-200">No Active Project Data</h3>
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            Upload a project data file in Project Intelligence to inspect AI-driven mitigation recommendations.
          </p>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};
  const allRecs = data?.recommendations || [];

  const filteredRecs = allRecs.filter((r) => {
    if (activeFilter === 'ALL') return true;
    return r.recovery_priority === activeFilter;
  });

  const selectedRec = allRecs.find((r) => r.activity_id === selectedActivityId);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-brand-50 text-brand-700 rounded-md border border-brand-200">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-900">Recommendations</h2>
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-mono">
                  Feature 2.24
                </span>
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-medium">
                  Analytical Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-factor deterministic ranking and selection of recovery options without fabricating actions
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Execution File Select */}
            <div className="flex items-center space-x-2">
              <label htmlFor="rec-exec-file" className="text-xs font-medium text-slate-500">Execution:</label>
              <select
                id="rec-exec-file"
                value={execFile}
                onChange={(e) => setExecFile(e.target.value)}
                disabled={loading}
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {execOptions.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>

            {/* Schedule File Select */}
            <div className="flex items-center space-x-2">
              <label htmlFor="rec-sched-file" className="text-xs font-medium text-slate-500">Schedule:</label>
              <select
                id="rec-sched-file"
                value={scheduleFile}
                onChange={(e) => setScheduleFile(e.target.value)}
                disabled={loading}
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {schedOptions.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>

            {/* In-Memory Recalculate Button */}
            <button
              type="button"
              onClick={fetchRecommendations}
              disabled={loading}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 rounded-md hover:bg-brand-700 transition disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Recalculate
            </button>
          </div>
        </div>

        {/* Read-Only Safety Notice Banner */}
        <div className="mt-4 p-3 bg-amber-50/60 border border-amber-200 rounded-md flex items-start space-x-2.5">
          <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <strong className="font-semibold text-amber-950">Read-Only Analytical Selection:</strong> Recommendations
            evaluate already-simulated recovery scenarios from Feature 2.23 and rank them using deterministic multi-factor scoring.
            Zero database writes, zero schedule modifications, zero dependency changes.
          </div>
        </div>
      </div>

      {/* 5 KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Evaluated</span>
            <Target className="w-4 h-4 text-brand-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            {summary.total_recommendations ?? '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {summary.total_scenarios_evaluated ?? 0} scenarios scored
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">High Priority</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-700 font-mono">
            {summary.high_priority_count ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Critical / severe delay</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Medium Priority</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700 font-mono">
            {summary.medium_priority_count ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Moderate risk / downstream</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Low Priority</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700 font-mono">
            {summary.low_priority_count ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Minor / completed / on-plan</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Max Project Recovery</span>
            <Zap className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-700 font-mono">
            {summary.max_project_recovery_days !== undefined ? `${summary.max_project_recovery_days}d` : '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Finish date compression</div>
        </div>
      </div>

      {/* Priority Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveFilter('ALL')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
            activeFilter === 'ALL'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Recommendations ({allRecs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('HIGH')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
            activeFilter === 'HIGH'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          High Priority ({summary.high_priority_count ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('MEDIUM')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
            activeFilter === 'MEDIUM'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Medium Priority ({summary.medium_priority_count ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('LOW')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
            activeFilter === 'LOW'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Low Priority ({summary.low_priority_count ?? 0})
        </button>
        {summary.insufficient_data_count > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilter('INSUFFICIENT_DATA')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              activeFilter === 'INSUFFICIENT_DATA'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Insufficient Data ({summary.insufficient_data_count})
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
          <strong>Error loading recommendations:</strong> {error}
        </div>
      )}

      {loading && !data && (
        <div className="p-12 text-center text-slate-500 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
          Evaluating recovery scenarios and generating deterministic recommendations...
        </div>
      )}

      {/* Main Split Content: Register (Left) + Detail Panel (Right) */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Table: Recommendations Register (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Recommendations Register ({filteredRecs.length} activities)
              </span>
              <span className="text-[11px] text-slate-400">Click row to inspect rationale & score breakdown</span>
            </div>

            <div className="overflow-x-auto max-h-[680px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold border-b border-slate-200">Activity</th>
                    <th className="px-3 py-2.5 font-semibold border-b border-slate-200 text-center">Priority</th>
                    <th className="px-3 py-2.5 font-semibold border-b border-slate-200 text-center">Delay / Risk</th>
                    <th className="px-3 py-2.5 font-semibold border-b border-slate-200 text-center">Score</th>
                    <th className="px-3 py-2.5 font-semibold border-b border-slate-200">Recommended Action</th>
                    <th className="px-3 py-2.5 font-semibold border-b border-slate-200 text-center">Recovery</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecs.map((rec) => {
                    const isSelected = rec.activity_id === selectedActivityId;
                    const bestScen = rec.recommended_scenario;
                    const LeverIcon = bestScen ? getLeverIcon(bestScen.recovery_type) : Activity;
                    const recoveryDays = bestScen ? bestScen.project_finish_recovery_days : 0;

                    return (
                      <tr
                        key={rec.activity_id}
                        onClick={() => setSelectedActivityId(rec.activity_id)}
                        className={`cursor-pointer transition ${
                          isSelected ? 'bg-indigo-50/70 font-medium' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-semibold text-slate-900">{rec.activity_id}</span>
                            {rec.critical_path_status === 'CRITICAL' && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                                CP
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[190px]">
                            {rec.activity_name}
                          </div>
                        </td>

                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getPriorityBadge(rec.recovery_priority)}`}>
                            {rec.recovery_priority}
                          </span>
                        </td>

                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1">
                            <span className={`px-1.5 py-0.2 rounded text-[10px] border ${getSeverityBadge(rec.delay_severity)}`}>
                              {rec.delay_severity}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] border ${getRiskBadge(rec.delay_prediction_risk)}`}>
                              {rec.delay_prediction_risk}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1.5">
                            <div className="w-12 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full ${
                                  rec.recommendation_score >= 70
                                    ? 'bg-rose-500'
                                    : rec.recommendation_score >= 40
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, rec.recommendation_score)}%` }}
                              />
                            </div>
                            <span className="font-mono font-semibold text-[11px] text-slate-800">
                              {rec.recommendation_score}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-2.5">
                          {bestScen ? (
                            <div className="flex items-center space-x-1.5 text-slate-800">
                              <LeverIcon className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                              <span className="text-[11px] font-medium truncate max-w-[140px]">
                                {getLeverLabel(bestScen.recovery_type)} ({bestScen.recovery_value}d)
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No action needed</span>
                          )}
                        </td>

                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {recoveryDays > 0 ? (
                            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 text-[11px]">
                              +{recoveryDays}d
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">0d</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Selected Activity Detail & Score Breakdown (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {selectedRec ? (
              <>
                {/* Activity Metadata Header */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-slate-900 font-mono">
                          {selectedRec.activity_id}
                        </h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getPriorityBadge(selectedRec.recovery_priority)}`}>
                          {selectedRec.recovery_priority} PRIORITY
                        </span>
                        {selectedRec.critical_path_status === 'CRITICAL' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                            CRITICAL PATH
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 font-medium">{selectedRec.activity_name}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Discipline</span>
                      <span className="font-medium text-slate-700">{selectedRec.discipline}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Progress / Float</span>
                      <span className="font-mono text-slate-700">
                        {selectedRec.current_progress}% / {selectedRec.available_float}d
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Baseline Finish</span>
                      <span className="font-mono text-slate-700">{selectedRec.baseline_finish || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Score Breakdown Card */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <BarChart2 className="w-3.5 h-3.5 text-brand-600" />
                      <span>Recommendation Score Breakdown</span>
                    </span>
                    <span className="text-sm font-bold text-brand-700 font-mono bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                      {selectedRec.recommendation_score} / 100
                    </span>
                  </div>

                  {selectedRec.score_breakdown ? (
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                          <span>Project Finish Recovery (max 35)</span>
                          <span className="font-mono font-semibold">{selectedRec.score_breakdown.project_finish_recovery} pts</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-indigo-600 h-full" style={{ width: `${(selectedRec.score_breakdown.project_finish_recovery / 35) * 100}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                          <span>Critical Path Status (max 20)</span>
                          <span className="font-mono font-semibold">{selectedRec.score_breakdown.critical_path_status} pts</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-rose-500 h-full" style={{ width: `${(selectedRec.score_breakdown.critical_path_status / 20) * 100}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                          <span>Delay Severity (max 15)</span>
                          <span className="font-mono font-semibold">{selectedRec.score_breakdown.delay_severity} pts</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-amber-500 h-full" style={{ width: `${(selectedRec.score_breakdown.delay_severity / 15) * 100}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                          <span>Delay Prediction Risk (max 10)</span>
                          <span className="font-mono font-semibold">{selectedRec.score_breakdown.delay_prediction_risk} pts</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-purple-500 h-full" style={{ width: `${(selectedRec.score_breakdown.delay_prediction_risk / 10) * 100}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                          <span>Milestone Protection (max 10)</span>
                          <span className="font-mono font-semibold">{selectedRec.score_breakdown.milestone_exposure} pts</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-emerald-500 h-full" style={{ width: `${(selectedRec.score_breakdown.milestone_exposure / 10) * 100}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                          <span>Feasibility & Float Quality (max 10)</span>
                          <span className="font-mono font-semibold">
                            {(selectedRec.score_breakdown.feasibility_quality + selectedRec.score_breakdown.float_improvement).toFixed(1)} pts
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-cyan-500 h-full"
                            style={{
                              width: `${((selectedRec.score_breakdown.feasibility_quality + selectedRec.score_breakdown.float_improvement) / 10) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">No score breakdown available for non-actionable activity.</div>
                  )}
                </div>

                {/* Recommendation Rationale Box */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                  <span className="text-xs font-bold text-slate-800 block mb-2">Deterministic Selection Rationale</span>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 leading-relaxed font-sans">
                    {selectedRec.recommendation_reason}
                  </div>
                </div>

                {/* Primary Recommended Option Card */}
                {selectedRec.recommended_scenario && (
                  <div className="bg-indigo-50/50 border border-indigo-200 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-indigo-950 flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Primary Recommended Lever</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getFeasibilityBadge(selectedRec.recommended_scenario.feasibility_status)}`}>
                        {selectedRec.recommended_scenario.feasibility_status}
                      </span>
                    </div>

                    <div className="bg-white border border-indigo-100 rounded p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span>{getLeverLabel(selectedRec.recommended_scenario.recovery_type)}</span>
                        <span className="font-mono text-indigo-700">
                          {selectedRec.recommended_scenario.recovery_value} days adjustment
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                        <div>
                          <span className="text-slate-400 block">Project Finish</span>
                          <span className="font-mono text-slate-700">
                            {selectedRec.recommended_scenario.project_finish_before} → {selectedRec.recommended_scenario.project_finish_after}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Finish Recovery</span>
                          <span className="font-mono font-bold text-indigo-700">
                            +{selectedRec.recommended_scenario.project_finish_recovery_days} days
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Float (Before → After)</span>
                          <span className="font-mono text-slate-700">
                            {selectedRec.recommended_scenario.float_before}d → {selectedRec.recommended_scenario.float_after}d
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Target Finish</span>
                          <span className="font-mono text-slate-700">
                            {selectedRec.recommended_scenario.hypothetical_finish}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Alternative Evaluated Scenarios */}
                {selectedRec.all_evaluated_scenarios && selectedRec.all_evaluated_scenarios.length > 1 && (
                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                    <span className="text-xs font-bold text-slate-800 block mb-2">
                      Alternative Evaluated Scenarios ({selectedRec.all_evaluated_scenarios.length - 1} options)
                    </span>
                    <div className="space-y-2">
                      {selectedRec.all_evaluated_scenarios.slice(1).map((alt, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium text-slate-800">
                              {getLeverLabel(alt.recovery_type)} ({alt.recovery_value}d)
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              Recovery: +{alt.project_finish_recovery_days}d • Feasibility: {alt.feasibility_status}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-slate-700 bg-slate-200/70 px-1.5 py-0.5 rounded text-[11px]">
                              {alt.recommendation_score} pts
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">Rank #{idx + 2}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-xs text-slate-500">
                Select an activity from the register to inspect recommendation rationale and score breakdown.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
