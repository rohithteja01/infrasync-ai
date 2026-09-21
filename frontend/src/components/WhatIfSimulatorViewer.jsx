import React, { useState, useEffect, useCallback } from 'react';
import {
  Sliders,
  AlertTriangle,
  Play,
  RotateCcw,
  ShieldCheck,
  Calendar,
  Layers,
  Flame,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Clock,
  Compass,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';

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
    case 'electrical':
      return 'bg-violet-50 text-violet-800 border-violet-200';
    case 'instrumentation':
      return 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}

const AVAILABLE_EXEC_FILES = [
  { id: 'test_execution_matches.xlsx', label: 'test_execution_matches.xlsx (Site Progress)' },
];

const AVAILABLE_SCHEDULE_FILES = [
  { id: 'baseline_schedule.xlsx', label: 'baseline_schedule.xlsx (Baseline Schedule)' },
];

const SCENARIO_TYPES = [
  { id: 'DELAY_DAYS', label: 'Delay Activity (+Days)' },
  { id: 'DURATION_CHANGE', label: 'Extend Duration (+Days)' },
  { id: 'COMPLETION_DATE_SHIFT', label: 'Shift Completion (+Days)' },
];

export default function WhatIfSimulatorViewer({ executionFile: propExecFile, scheduleFile: propSchedFile, projectContext } = {}) {
  const hasNoData = !projectContext && !propExecFile;
  const getContextFileName = (ctx) => {
    const f = ctx?.files?.[0] || ctx?.files_processed?.[0];
    if (!f) return '';
    return typeof f === 'string' ? f : (f?.filename || f?.name || '');
  };

  const activeFileName = projectContext?.schedule_info?.filename || propSchedFile || getContextFileName(projectContext);
  const initialExec = propExecFile || getContextFileName(projectContext) || (hasNoData ? '' : 'test_execution_matches.xlsx');
  const initialSched = propSchedFile || projectContext?.schedule_info?.filename || propExecFile || getContextFileName(projectContext) || (hasNoData ? '' : 'baseline_schedule.xlsx');

  const [execFile, setExecFile] = useState(initialExec);
  const [scheduleFile, setScheduleFile] = useState(initialSched);

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
    ...(activeFileName ? [{ id: activeFileName, label: `${activeFileName} (Active Schedule)` }] : []),
    ...AVAILABLE_SCHEDULE_FILES.filter((f) => f.id !== activeFileName),
  ];
  if (propSchedFile && !schedOptions.some((o) => o.id === propSchedFile)) {
    schedOptions.unshift({ id: propSchedFile, label: `${propSchedFile} (Active File)` });
  }

  // Scenario form inputs
  const [selectedActivityId, setSelectedActivityId] = useState('CIV-L6-02');
  const [scenarioType, setScenarioType] = useState('DELAY_DAYS');
  const [scenarioValue, setScenarioValue] = useState(5);

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scheduleActivities, setScheduleActivities] = useState([]);
  const [simulationResult, setSimulationResult] = useState(null);
  const [activeTab, setActiveTab] = useState('comparison'); // 'comparison' | 'propagation' | 'milestones'

  // Fetch baseline schedule activities on mount or file change
  const fetchBaselineActivities = useCallback(async (sFile) => {
    if (hasNoData || !sFile) return;
    try {
      const url = `/api/ingestion/schedule/${encodeURIComponent(sFile)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.activities) {
        setScheduleActivities(data.activities);
        if (!selectedActivityId && data.activities.length > 0) {
          setSelectedActivityId(data.activities[0].activity_id);
        }
      }
    } catch (e) {
      console.error('Failed to load baseline schedule activities:', e);
    }
  }, [hasNoData, selectedActivityId]);

  useEffect(() => {
    fetchBaselineActivities(scheduleFile);
  }, [fetchBaselineActivities, scheduleFile]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2e2e2e] rounded-xl p-8 text-center shadow-xs">
        <div className="max-w-md mx-auto space-y-3">
          <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-[#252525] text-slate-400">
            <SlidersHorizontal className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-neutral-200">No Active Project Data</h3>
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            Upload a project data file in Project Intelligence to run forward-looking CPM What-If simulations.
          </p>
        </div>
      </div>
    );
  }

  // Run What-If Simulation
  const handleRunSimulation = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const numVal = parseFloat(scenarioValue);
      if (isNaN(numVal) || numVal <= 0) {
        throw new Error('Scenario value must be a positive number greater than 0.');
      }

      const res = await fetch('/api/ingestion/what-if', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          execution_file: execFile,
          schedule_file: scheduleFile,
          activity_id: selectedActivityId,
          scenario_type: scenarioType,
          scenario_value: numVal
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `Server returned HTTP ${res.status}`);
      }

      setSimulationResult(data);
    } catch (err) {
      setError(err.message || 'What-If simulation failed.');
      setSimulationResult(null);
    } finally {
      setLoading(false);
    }
  };

  // Run simulation on mount or when files change
  useEffect(() => {
    handleRunSimulation();
  }, [execFile, scheduleFile]);

  // Reset to baseline view
  const handleReset = () => {
    setSimulationResult(null);
    setScenarioValue(5);
    setScenarioType('DELAY_DAYS');
    setSelectedActivityId('CIV-L6-02');
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & File Pickers */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200 mt-0.5">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-900">What-If Simulator</h2>
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-mono font-semibold">
                  Feature 2.22
                </span>
                <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-mono">
                  Schedule Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Simulate in-memory hypothetical changes to activity duration, delay, or completion date to evaluate
                downstream schedule impact, float buffer consumption, and critical path sensitivity.
              </p>
            </div>
          </div>

          {/* Dual File Pickers */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <label htmlFor="whatif-exec-file" className="text-xs font-medium text-slate-500">Execution:</label>
              <select
                id="whatif-exec-file"
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

            <div className="flex items-center space-x-2">
              <label htmlFor="whatif-sched-file" className="text-xs font-medium text-slate-500">Schedule:</label>
              <select
                id="whatif-sched-file"
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
          </div>
        </div>
      </div>

      {/* Safety & In-Memory Guarantee Alert */}
      <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-sky-700 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-sky-900 space-y-1">
          <p className="font-bold tracking-tight uppercase text-sky-950">
            Hypothetical Scenario Engine • Baseline Schedule Remains Strictly Unmodified
          </p>
          <p className="text-sky-800">
            All scenario calculations are strictly in-memory. The original project baseline schedule, dates, durations,
            dependencies, and database records remain completely unchanged.
          </p>
        </div>
      </div>

      {/* Scenario Input Configuration Panel */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <form onSubmit={handleRunSimulation} className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
              <Sliders className="w-4 h-4 text-blue-600" />
              <span>Configure Hypothetical Scenario</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              In-Memory CPM Recalculation
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
            {/* Target Activity Selection */}
            <div className="sm:col-span-5 space-y-1.5">
              <label htmlFor="sim-activity-select" className="text-xs font-medium text-slate-700">
                Target Activity:
              </label>
              <select
                id="sim-activity-select"
                value={selectedActivityId}
                onChange={(e) => setSelectedActivityId(e.target.value)}
                disabled={loading}
                className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {scheduleActivities.map((a) => (
                  <option key={a.activity_id} value={a.activity_id}>
                    {a.activity_id} — {a.activity_name} ({a.discipline || 'General'}, {a.level || 'L6'})
                  </option>
                ))}
              </select>
            </div>

            {/* Scenario Type */}
            <div className="sm:col-span-3 space-y-1.5">
              <label htmlFor="sim-scenario-type" className="text-xs font-medium text-slate-700">
                Scenario Type:
              </label>
              <select
                id="sim-scenario-type"
                value={scenarioType}
                onChange={(e) => setScenarioType(e.target.value)}
                disabled={loading}
                className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {SCENARIO_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Scenario Value */}
            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="sim-scenario-val" className="text-xs font-medium text-slate-700">
                Shift / Delay (Days):
              </label>
              <input
                id="sim-scenario-val"
                type="number"
                min="1"
                max="365"
                step="1"
                value={scenarioValue}
                onChange={(e) => setScenarioValue(e.target.value)}
                disabled={loading}
                className="w-full text-xs font-bold font-mono text-slate-900 bg-slate-50 border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="sm:col-span-2 flex items-center space-x-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Simulate</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                title="Reset scenario inputs"
                className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-medium transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-sm text-rose-700 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Scenario Evaluation Failed</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Results View */}
      {simulationResult && (
        <div className="space-y-6">
          {/* 5 Comparison Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Scenario Activity */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Simulated Target</span>
                <span className="text-[10px] bg-blue-50 text-blue-700 font-mono px-1.5 py-0.5 rounded border border-blue-200">
                  +{simulationResult.scenario?.scenario_value}d
                </span>
              </div>
              <div className="text-lg font-bold text-slate-900 mt-2 font-mono truncate">
                {simulationResult.scenario?.activity_id}
              </div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                {simulationResult.scenario?.scenario_type.replace(/_/g, ' ')}
              </div>
            </div>

            {/* Project Finish Shift */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Project Finish Shift</span>
                <div className="p-1.5 bg-rose-50 rounded text-rose-600">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono text-rose-700 mt-2">
                +{simulationResult.comparison?.project_finish_shift_days} days
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {simulationResult.comparison?.project_finish_shift_days > 0
                  ? 'Project completion extended'
                  : 'Absorbed by float buffer'}
              </div>
            </div>

            {/* Affected Activities Count */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Affected Activities</span>
                <div className="p-1.5 bg-indigo-50 rounded text-indigo-600">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono text-indigo-700 mt-2">
                {simulationResult.comparison?.total_affected_activities}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {simulationResult.comparison?.direct_impact_count} direct / {simulationResult.comparison?.indirect_impact_count} indirect
              </div>
            </div>

            {/* Critical Path Sensitivity */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Critical Path Impact</span>
                <div className="p-1.5 bg-amber-50 rounded text-amber-600">
                  <Flame className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg font-bold font-mono mt-2 truncate text-amber-800">
                {simulationResult.comparison?.critical_path_changed ? 'Path Altered' : 'Path Maintained'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {simulationResult.hypothetical?.critical_activity_count} critical activities
              </div>
            </div>

            {/* Project Duration Change */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Project Duration</span>
                <div className="p-1.5 bg-purple-50 rounded text-purple-600">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold font-mono text-purple-700 mt-2">
                {simulationResult.baseline?.project_duration_days}d → {simulationResult.hypothetical?.project_duration_days}d
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Baseline vs Hypothetical
              </div>
            </div>
          </div>

          {/* Navigation View Tabs */}
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
            {[
              { id: 'comparison', label: 'Schedule Comparison Table' },
              { id: 'propagation', label: `Downstream Chain (${simulationResult.propagation_chain?.length || 0})` },
              { id: 'milestones', label: `Affected Milestones (${simulationResult.affected_milestones?.length || 0})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Baseline vs Hypothetical Comparison Table */}
          {activeTab === 'comparison' && (
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Baseline vs Hypothetical Schedule Register
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Displaying all 12 schedule activities
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/75 text-slate-600 border-b border-slate-200 font-semibold">
                      <th className="py-2.5 px-3">Activity</th>
                      <th className="py-2.5 px-3 text-center">Baseline Dates</th>
                      <th className="py-2.5 px-3 text-center text-blue-800 bg-blue-50/50">Hypothetical Dates</th>
                      <th className="py-2.5 px-3 text-center">Shift</th>
                      <th className="py-2.5 px-3 text-center">Float ($\Delta$)</th>
                      <th className="py-2.5 px-3 text-right">Criticality</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {simulationResult.activities?.map((a) => {
                      const isTarget = a.activity_id === simulationResult.scenario?.activity_id;
                      return (
                        <tr
                          key={a.activity_id}
                          className={`transition-colors ${
                            isTarget
                              ? 'bg-blue-50/80 font-medium'
                              : a.is_affected
                              ? 'bg-amber-50/40'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-slate-900">{a.activity_id}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] border font-medium ${getDisciplineBadge(a.discipline)}`}>
                                {a.discipline}
                              </span>
                              {isTarget && (
                                <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-1.5 py-0.2 rounded border border-blue-300">
                                  SIMULATED
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                              {a.activity_name}
                            </div>
                          </td>

                          {/* Baseline Dates */}
                          <td className="py-2.5 px-3 text-center font-mono whitespace-nowrap text-slate-600">
                            <div>{a.baseline_start}</div>
                            <div className="text-[10px] text-slate-400">to {a.baseline_finish}</div>
                          </td>

                          {/* Hypothetical Dates */}
                          <td className="py-2.5 px-3 text-center font-mono whitespace-nowrap bg-blue-50/30 font-semibold text-blue-900">
                            <div>{a.hypothetical_start}</div>
                            <div className="text-[10px] text-blue-600">to {a.hypothetical_finish}</div>
                          </td>

                          {/* Shift Days */}
                          <td className="py-2.5 px-3 text-center font-mono whitespace-nowrap font-bold">
                            {a.finish_shift_days > 0 ? (
                              <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                +{a.finish_shift_days}d
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">0d</span>
                            )}
                          </td>

                          {/* Float Change */}
                          <td className="py-2.5 px-3 text-center font-mono whitespace-nowrap">
                            <span className="text-slate-700">{a.baseline_float ?? '—'}d</span>
                            <span className="text-slate-400 mx-1">→</span>
                            <span className="font-semibold text-slate-900">{a.hypothetical_float ?? '—'}d</span>
                            {a.float_change_days !== 0 && a.float_change_days !== null && (
                              <span className={`text-[10px] ml-1 font-bold ${a.float_change_days > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                ({a.float_change_days > 0 ? `+${a.float_change_days}` : a.float_change_days}d)
                              </span>
                            )}
                          </td>

                          {/* Critical Status */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {a.hypothetical_critical ? (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                CRITICAL
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                NON-CRITICAL
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: Downstream Propagation Chain */}
          {activeTab === 'propagation' && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Downstream Cascade Propagation Sequence
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Activities sequentially impacted along Finish-to-Start baseline dependencies
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Max Depth: {simulationResult.propagation_chain?.[simulationResult.propagation_chain.length - 1]?.propagation_depth || 0}
                </span>
              </div>

              <div className="space-y-3">
                {simulationResult.propagation_chain?.map((p, idx) => (
                  <div
                    key={p.activity_id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">{p.activity_id}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          p.role === 'SOURCE'
                            ? 'bg-blue-100 text-blue-900 border-blue-300'
                            : p.impact_type === 'DIRECT_SUCCESSOR'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}>
                          {p.role === 'SOURCE' ? 'SIMULATED SOURCE' : `DEPTH ${p.propagation_depth} • ${p.impact_type.replace(/_/g, ' ')}`}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] border font-medium ${getDisciplineBadge(p.discipline)}`}>
                          {p.discipline}
                        </span>
                      </div>
                      <div className="text-slate-700 font-medium">{p.activity_name}</div>
                    </div>

                    <div className="flex items-center space-x-4 font-mono text-xs">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase">Baseline Finish</div>
                        <div className="text-slate-600 font-semibold">{p.baseline_finish}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                      <div className="text-left">
                        <div className="text-[10px] text-blue-600 uppercase">Hypothetical Finish</div>
                        <div className="text-blue-900 font-bold">{p.hypothetical_finish}</div>
                      </div>
                      <div className="pl-3 border-l border-slate-200 text-rose-700 font-bold">
                        +{p.finish_shift_days}d
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Affected Milestones */}
          {activeTab === 'milestones' && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Parent Milestone Exposures
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Milestones whose supporting activities experience downstream hypothetical delay shifts
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {simulationResult.affected_milestones?.map((m) => (
                  <div
                    key={m.milestone_id}
                    className="p-4 bg-violet-50/50 border border-violet-200 rounded-lg space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-violet-900 text-sm">{m.milestone_id}</span>
                      <span className="px-2 py-0.5 bg-violet-100 text-violet-800 rounded border border-violet-300 font-medium text-[10px]">
                        Milestone Exposed
                      </span>
                    </div>
                    <div className="font-semibold text-slate-800">{m.milestone_name}</div>
                    <div className="text-[11px] text-slate-500 pt-1">
                      Affected Supporting Activities: <strong className="font-mono text-slate-800">{m.affected_activities.join(', ')}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
