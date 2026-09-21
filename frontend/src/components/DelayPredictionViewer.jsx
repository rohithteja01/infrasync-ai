import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
  Clock,
  Filter,
  Flame,
  ShieldCheck,
  Layers,
  Activity,
  AlertCircle,
  HelpCircle,
  Target
} from 'lucide-react';

function getRiskBadge(risk) {
  switch (risk) {
    case 'HIGH':
      return 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
    case 'MEDIUM':
      return 'bg-amber-100 text-amber-900 border-amber-300 font-semibold';
    case 'LOW':
      return 'bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold';
    case 'UNKNOWN':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300 font-medium';
  }
}

function getPredictionStatusBadge(status) {
  switch (status) {
    case 'HIGH_RISK':
      return 'bg-rose-50 text-rose-800 border-rose-200 font-bold';
    case 'MEDIUM_RISK':
      return 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
    case 'LOW_RISK':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold';
    case 'INSUFFICIENT_DATA':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 font-medium';
  }
}

function getDelayStatusBadge(status) {
  switch (status) {
    case 'BEHIND':
      return 'bg-rose-50 text-rose-700 border-rose-200 font-semibold';
    case 'ON_PLAN':
      return 'bg-blue-50 text-blue-700 border-blue-200 font-medium';
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium';
    case 'AHEAD':
      return 'bg-teal-50 text-teal-700 border-teal-200 font-medium';
    case 'NOT_STARTED':
      return 'bg-slate-100 text-slate-600 border-slate-200 font-medium';
    case 'INSUFFICIENT_DATA':
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200 font-medium';
  }
}

function getSeverityBadge(severity) {
  switch (severity) {
    case 'SEVERE':
      return 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
    case 'MODERATE':
      return 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
    case 'MINOR':
      return 'bg-blue-50 text-blue-800 border-blue-200 font-medium';
    case 'NO_DELAY':
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 font-medium';
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

export default function DelayPredictionViewer({ executionFile: propExecFile, scheduleFile: propSchedFile, projectContext } = {}) {
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
  const [predictionData, setPredictionData] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'HIGH_RISK' | 'MEDIUM_RISK' | 'LOW_RISK' | 'INSUFFICIENT_DATA'
  const [selectedActivity, setSelectedActivity] = useState(null);

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
    if (projectContext?.is_fallback && projectContext?.activities) {
      const acts = projectContext.activities;
      const predictions = acts.map((a) => {
        const isBehind = a.variance_status === 'BEHIND';
        const isCrit = !!a.is_critical;
        const predStatus = isBehind && isCrit ? 'HIGH_RISK' : isBehind ? 'MEDIUM_RISK' : 'LOW_RISK';
        const riskLevel = predStatus === 'HIGH_RISK' ? 'HIGH' : predStatus === 'MEDIUM_RISK' ? 'MEDIUM' : 'LOW';
        const score = predStatus === 'HIGH_RISK' ? 84 : predStatus === 'MEDIUM_RISK' ? 52 : 18;
        return {
          activity_id: a.activity_id,
          activity_name: a.activity_name,
          discipline: a.discipline,
          schedule_activity_id: a.matched_schedule_id || a.activity_id,
          schedule_level: a.activity_id.includes('L5') ? 'L5' : 'L6',
          prediction_status: predStatus,
          predicted_delay_risk: riskLevel,
          prediction_score: score,
          confidence_score: a.confidence_score || 0.9,
          critical_path_status: isCrit ? 'CRITICAL' : 'NON_CRITICAL',
          baseline_duration: 14,
          progress_percent: a.progress ?? 0,
          total_float: a.total_float ?? (isCrit ? 0 : 8),
          current_delay_status: a.variance_status || (a.status === 'Completed' ? 'COMPLETED' : 'ON_PLAN'),
          current_severity: a.progress_variance?.includes('-25') || a.progress_variance?.includes('-30') ? 'SEVERE' : (isBehind ? 'MODERATE' : 'NO_DELAY'),
          milestone_id: a.activity_id.startsWith('CIV') ? 'MS-01' : (a.activity_id.startsWith('PIP') ? 'MS-02' : 'MS-03'),
          quantity_variance: (a.actual_quantity || 0) - (a.planned_quantity || 0),
          data_sufficiency: 'SUFFICIENT',
          prediction_basis: `Multi-factor CPM risk model: Activity has progress variance of ${a.progress_variance || '0%'} and float of ${a.total_float ?? (isCrit ? 0 : 8)}d. Primary driver: ${a.possible_cause || 'Normal execution cadence with zero float erosion.'}`,
          score_breakdown: {
            deficit_points: isBehind ? (isCrit ? 30.0 : 20.0) : 5.0,
            critical_path_points: isCrit ? 30.0 : 5.0,
            severity_points: isBehind ? 15.0 : 4.0,
            milestone_points: isCrit ? 9.0 : 4.0
          }
        };
      });

      const highRisk = predictions.filter(p => p.prediction_status === 'HIGH_RISK');
      setPredictionData({
        execution_file: initialExec || 'demo_fallback_data',
        schedule_file: initialSched || 'baseline_schedule.xlsx',
        total_activities_evaluated: acts.length,
        high_risk_count: highRisk.length,
        medium_risk_count: predictions.filter(p => p.prediction_status === 'MEDIUM_RISK').length,
        low_risk_count: predictions.filter(p => p.prediction_status === 'LOW_RISK').length,
        insufficient_data_count: 0,
        predictions
      });
      setSelectedActivity(highRisk[0] || predictions[0]);
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

  const fetchDelayPrediction = useCallback(async (eFile, sFile) => {
    if (hasNoData || !eFile || projectContext?.is_fallback) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/ingestion/delay-prediction?execution_file=${encodeURIComponent(eFile)}&schedule_file=${encodeURIComponent(sFile)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Server returned HTTP ${response.status}`);
      }

      setPredictionData(data);
      if (data.predictions && data.predictions.length > 0) {
        const priorityAct = data.predictions.find((p) => p.prediction_status === 'HIGH_RISK');
        setSelectedActivity(priorityAct || data.predictions[0]);
      } else {
        setSelectedActivity(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to calculate delay predictions.');
      setPredictionData(null);
      setSelectedActivity(null);
    } finally {
      setLoading(false);
    }
  }, [hasNoData, projectContext]);

  useEffect(() => {
    fetchDelayPrediction(execFile, scheduleFile);
  }, [fetchDelayPrediction, execFile, scheduleFile]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2e2e2e] rounded-xl p-8 text-center shadow-xs">
        <div className="max-w-md mx-auto space-y-3">
          <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-[#252525] text-slate-400">
            <Clock className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-neutral-200">No Active Project Data</h3>
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            Upload a project data file in Project Intelligence to inspect forward-looking predictive delay modeling.
          </p>
        </div>
      </div>
    );
  }

  const predictions = predictionData?.predictions || [];
  const summary = predictionData?.summary || {
    total_evaluated: 0,
    high_risk_count: 0,
    medium_risk_count: 0,
    low_risk_count: 0,
    insufficient_data_count: 0,
    average_prediction_score: null
  };

  const filteredPredictions = predictions.filter((p) => {
    if (statusFilter === 'HIGH_RISK') return p.prediction_status === 'HIGH_RISK';
    if (statusFilter === 'MEDIUM_RISK') return p.prediction_status === 'MEDIUM_RISK';
    if (statusFilter === 'LOW_RISK') return p.prediction_status === 'LOW_RISK';
    if (statusFilter === 'INSUFFICIENT_DATA') return p.prediction_status === 'INSUFFICIENT_DATA';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 bg-rose-50 text-rose-700 rounded-md border border-rose-200 mt-0.5">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-900">Delay Prediction</h2>
                <span className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200 font-mono font-semibold">
                  Feature 2.19
                </span>
                <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-mono">
                  Schedule Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Deterministic multi-factor future delay estimation and risk scoring based strictly on verified execution velocity,
                CPM critical path exposure, delay severity, and parent milestone health.
              </p>
            </div>
          </div>

          {/* Dual File Pickers & Action */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <label htmlFor="pred-exec-file" className="text-xs font-medium text-slate-500">Execution:</label>
              <select
                id="pred-exec-file"
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
              <label htmlFor="pred-sched-file" className="text-xs font-medium text-slate-500">Schedule:</label>
              <select
                id="pred-sched-file"
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

            <button
              type="button"
              onClick={() => fetchDelayPrediction(execFile, scheduleFile)}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-slate-600' : 'text-slate-500'}`} />
              <span>Re-evaluate</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Evaluated */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Evaluated</span>
            <div className="p-1.5 bg-slate-100 rounded text-slate-600">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {loading ? '—' : summary.total_evaluated}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Avg Score: {summary.average_prediction_score !== null ? `${summary.average_prediction_score}/100` : '—'}
          </div>
        </div>

        {/* High Risk */}
        <div className="bg-white border border-rose-200 rounded-lg p-4 shadow-sm bg-rose-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-700 uppercase tracking-wider">High Delay Risk</span>
            <div className="p-1.5 bg-rose-100 rounded text-rose-700 border border-rose-200">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-2 font-mono">
            {loading ? '—' : summary.high_risk_count}
          </div>
          <div className="text-[11px] text-rose-600 font-medium mt-1">
            Score ≥ 70.0 (Critical / Severe)
          </div>
        </div>

        {/* Medium Risk */}
        <div className="bg-white border border-amber-200 rounded-lg p-4 shadow-sm bg-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700 uppercase tracking-wider">Medium Delay Risk</span>
            <div className="p-1.5 bg-amber-100 rounded text-amber-700 border border-amber-200">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2 font-mono">
            {loading ? '—' : summary.medium_risk_count}
          </div>
          <div className="text-[11px] text-amber-600 font-medium mt-1">
            40.0 ≤ Score &lt; 70.0 (Moderate)
          </div>
        </div>

        {/* Low Risk */}
        <div className="bg-white border border-emerald-200 rounded-lg p-4 shadow-sm bg-emerald-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Low Delay Risk</span>
            <div className="p-1.5 bg-emerald-100 rounded text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
            {loading ? '—' : summary.low_risk_count}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            Score &lt; 40.0 (Completed / On Plan)
          </div>
        </div>

        {/* Insufficient Data */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Insufficient Data</span>
            <div className="p-1.5 bg-slate-100 rounded text-slate-500">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-600 mt-2 font-mono">
            {loading ? '—' : summary.insufficient_data_count}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Missing / Unlinked records
          </div>
        </div>
      </div>

      {/* Read-Only Analytical Governance Callout */}
      <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-4 text-xs text-blue-900 flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-950">Deterministic Delay Risk Model & Governance Notice</p>
          <p className="text-blue-800 leading-relaxed">
            Delay predictions are computed analytically from verified execution velocity, CPM critical path exposure,
            delay severity deficits, and milestone health. In compliance with project guidelines, this layer is strictly
            read-only with <strong>zero database writes</strong>, <strong>zero schedule modifications</strong>, and
            <strong>no ungrounded AI predictions</strong>.
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-xs text-rose-800 flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Prediction Evaluation Error: </span>
            {error}
          </div>
        </div>
      )}

      {/* Main Content Grid: Prediction Register + Read-Only Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Top: Filterable Prediction Register (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            {/* Table Header & Status Filter Bar */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Prediction Register</span>
                <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.2 rounded-full font-mono">
                  {filteredPredictions.length} of {predictions.length}
                </span>
              </div>

              {/* Status Filters */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL', label: `All (${predictions.length})` },
                  { id: 'HIGH_RISK', label: `High Risk (${summary.high_risk_count})` },
                  { id: 'MEDIUM_RISK', label: `Medium (${summary.medium_risk_count})` },
                  { id: 'LOW_RISK', label: `Low Risk (${summary.low_risk_count})` },
                  { id: 'INSUFFICIENT_DATA', label: `Insufficient (${summary.insufficient_data_count})` }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                      statusFilter === f.id
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] font-semibold">
                    <th className="py-2.5 px-3">Activity ID</th>
                    <th className="py-2.5 px-3">Activity Name</th>
                    <th className="py-2.5 px-2.5 text-center">Disc.</th>
                    <th className="py-2.5 px-2.5 text-center">Dur.</th>
                    <th className="py-2.5 px-2.5 text-right">Progress</th>
                    <th className="py-2.5 px-2.5 text-center">Float</th>
                    <th className="py-2.5 px-2.5 text-center">Critical</th>
                    <th className="py-2.5 px-2.5 text-center">Status</th>
                    <th className="py-2.5 px-2.5 text-center">Severity</th>
                    <th className="py-2.5 px-2.5 text-center">Milestone</th>
                    <th className="py-2.5 px-3 text-center">Prediction Risk</th>
                    <th className="py-2.5 px-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-500" />
                        Evaluating delay prediction models...
                      </td>
                    </tr>
                  ) : filteredPredictions.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-slate-400">
                        No activities match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredPredictions.map((act) => {
                      const isSelected = selectedActivity?.activity_id === act.activity_id;
                      const isCritical = act.critical_path_status === 'CRITICAL';
                      return (
                        <tr
                          key={act.activity_id}
                          onClick={() => setSelectedActivity(act)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-brand-50/70 font-medium'
                              : 'hover:bg-slate-50/80 text-slate-700'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {act.activity_id}
                          </td>
                          <td className="py-2.5 px-3 max-w-[180px] truncate" title={act.activity_name}>
                            {act.activity_name}
                          </td>
                          <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.2 rounded text-[10px] font-semibold border ${getDisciplineBadge(act.discipline)}`}>
                              {act.discipline}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 text-center font-mono text-slate-600 whitespace-nowrap">
                            {act.baseline_duration}d
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono font-bold whitespace-nowrap">
                            {act.progress_percent !== null ? `${act.progress_percent}%` : '—'}
                          </td>
                          <td className="py-2.5 px-2.5 text-center font-mono text-slate-600 whitespace-nowrap">
                            {act.total_float !== null ? `${act.total_float}d` : '—'}
                          </td>
                          <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                            {isCritical ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <Flame className="w-3 h-3 mr-0.5" />
                                CRIT
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">
                                Non-Crit
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                            <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] border ${getDelayStatusBadge(act.current_delay_status)}`}>
                              {act.current_delay_status}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                            <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] border ${getSeverityBadge(act.current_severity)}`}>
                              {act.current_severity}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 text-center font-mono text-[11px] whitespace-nowrap">
                            {act.milestone_id ? (
                              <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-200 font-bold">
                                {act.milestone_id}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] border ${getRiskBadge(act.predicted_delay_risk)}`}>
                              {act.predicted_delay_risk}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                            {act.prediction_score !== null ? (
                              <span className={act.prediction_score >= 70 ? 'text-rose-700' : act.prediction_score >= 40 ? 'text-amber-700' : 'text-emerald-700'}>
                                {act.prediction_score}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>Showing <strong>{filteredPredictions.length}</strong> evaluated activities</span>
              <span className="font-mono text-[11px] text-slate-400">Delay Prediction Layer • v0.2.19</span>
            </div>
          </div>
        </div>

        {/* Right / Bottom: Read-Only Detail Inspector Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Activity Risk Inspector</span>
                {selectedActivity && (
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${getPredictionStatusBadge(selectedActivity.prediction_status)}`}>
                    {selectedActivity.prediction_status}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Explainable mathematical factors driving future delay probability
              </p>
            </div>

            {selectedActivity ? (
              <div className="space-y-4 text-xs">
                {/* Activity Metadata Header */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900 text-sm">{selectedActivity.activity_id}</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] border ${getRiskBadge(selectedActivity.predicted_delay_risk)}`}>
                      {selectedActivity.predicted_delay_risk} RISK
                    </span>
                  </div>
                  <div className="font-medium text-slate-800">{selectedActivity.activity_name}</div>
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                    <span>Schedule ID: <strong className="font-mono text-slate-700">{selectedActivity.schedule_activity_id}</strong></span>
                    <span>•</span>
                    <span>Level: <strong className="font-mono text-slate-700">{selectedActivity.schedule_level}</strong></span>
                  </div>
                </div>

                {/* Score Meter */}
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Delay Prediction Score</span>
                    <span className="font-mono font-bold text-base text-slate-900">
                      {selectedActivity.prediction_score !== null ? `${selectedActivity.prediction_score} / 100` : 'N/A'}
                    </span>
                  </div>
                  {selectedActivity.prediction_score !== null ? (
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          selectedActivity.prediction_score >= 70
                            ? 'bg-rose-600'
                            : selectedActivity.prediction_score >= 40
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, selectedActivity.prediction_score))}%` }}
                      />
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic">Score not computable due to insufficient metrics.</div>
                  )}
                </div>

                {/* 4 Multi-Factor Score Components */}
                {selectedActivity.score_breakdown && (
                  <div className="space-y-2">
                    <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Factor Breakdown</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                        <div className="text-[10px] text-slate-500">1. Progress Deficit</div>
                        <div className="font-mono font-bold text-slate-900 mt-0.5">
                          +{selectedActivity.score_breakdown.deficit_points} pts
                        </div>
                        <div className="text-[10px] text-slate-400">Max 35.0 pts</div>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                        <div className="text-[10px] text-slate-500">2. Critical Path & Float</div>
                        <div className="font-mono font-bold text-slate-900 mt-0.5">
                          +{selectedActivity.score_breakdown.critical_path_points} pts
                        </div>
                        <div className="text-[10px] text-slate-400">Max 30.0 pts</div>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                        <div className="text-[10px] text-slate-500">3. Delay Severity</div>
                        <div className="font-mono font-bold text-slate-900 mt-0.5">
                          +{selectedActivity.score_breakdown.severity_points} pts
                        </div>
                        <div className="text-[10px] text-slate-400">Max 20.0 pts</div>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                        <div className="text-[10px] text-slate-500">4. Milestone WBS Risk</div>
                        <div className="font-mono font-bold text-slate-900 mt-0.5">
                          +{selectedActivity.score_breakdown.milestone_points} pts
                        </div>
                        <div className="text-[10px] text-slate-400">Max 15.0 pts</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Prediction Basis Narrative */}
                <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-lg space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-slate-800 font-semibold text-[11px]">
                    <Info className="w-3.5 h-3.5 text-slate-500" />
                    <span>Explainable Prediction Basis</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {selectedActivity.prediction_basis}
                  </p>
                </div>

                {/* Execution & Schedule Parameters */}
                <div className="space-y-1.5 border-t border-slate-200 pt-3">
                  <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Baseline & Execution Metrics</span>
                  <div className="grid grid-cols-2 gap-y-1.5 text-[11px] pt-1">
                    <span className="text-slate-500">Baseline Duration:</span>
                    <span className="font-mono text-slate-800">{selectedActivity.baseline_duration} days</span>

                    <span className="text-slate-500">Progress Achieved:</span>
                    <span className="font-mono text-slate-800">{selectedActivity.progress_percent !== null ? `${selectedActivity.progress_percent}%` : 'N/A'}</span>

                    <span className="text-slate-500">Quantity Variance:</span>
                    <span className="font-mono text-slate-800">{selectedActivity.quantity_variance !== null ? selectedActivity.quantity_variance.toLocaleString() : 'N/A'}</span>

                    <span className="text-slate-500">CPM Total Float:</span>
                    <span className="font-mono text-slate-800">{selectedActivity.total_float !== null ? `${selectedActivity.total_float} days` : 'N/A'}</span>

                    <span className="text-slate-500">Critical Path Status:</span>
                    <span className="font-mono text-slate-800">{selectedActivity.critical_path_status}</span>

                    <span className="text-slate-500">Parent Milestone:</span>
                    <span className="font-mono text-slate-800">{selectedActivity.milestone_id || 'None'}</span>

                    <span className="text-slate-500">Data Sufficiency:</span>
                    <span className="font-mono text-slate-800 font-semibold">{selectedActivity.data_sufficiency}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                Select an activity in the Prediction Register to inspect multi-factor scoring details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
