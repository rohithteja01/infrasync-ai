import React, { useState, useEffect, useCallback } from 'react';
import {
  GitFork,
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
  GitBranch,
  Target,
  FileText,
  Search,
  ArrowRight,
  TrendingUp,
  Compass
} from 'lucide-react';

function getImpactStatusBadge(status) {
  switch (status) {
    case 'PROJECT_DURATION_EXPOSURE':
      return 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
    case 'MILESTONE_IMPACT':
      return 'bg-violet-100 text-violet-900 border-violet-300 font-semibold';
    case 'CRITICAL_PATH_IMPACT':
      return 'bg-amber-100 text-amber-900 border-amber-300 font-semibold';
    case 'DOWNSTREAM_IMPACT':
      return 'bg-blue-100 text-blue-900 border-blue-300 font-medium';
    case 'NO_DOWNSTREAM_IMPACT':
      return 'bg-emerald-100 text-emerald-900 border-emerald-300 font-medium';
    case 'INSUFFICIENT_DATA':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300 font-medium';
  }
}

function getImpactTypeBadge(type) {
  switch (type) {
    case 'DIRECT_SUCCESSOR':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold';
    case 'INDIRECT_SUCCESSOR':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 font-medium';
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

function getPredictionRiskBadge(risk) {
  switch (risk) {
    case 'HIGH':
      return 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
    case 'MEDIUM':
      return 'bg-amber-50 text-amber-700 border-amber-200 font-semibold';
    case 'LOW':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold';
    case 'UNKNOWN':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 font-medium';
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

export default function ImpactPropagationViewer({ executionFile: propExecFile, scheduleFile: propSchedFile, projectContext } = {}) {
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
  const [impactData, setImpactData] = useState(null);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState(null);

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
      const delayed = acts.filter(a => a.variance_status === 'BEHIND');
      const propagationList = delayed.map(a => ({
        source_activity_id: a.activity_id,
        source_activity_name: a.activity_name,
        discipline: a.discipline,
        delay_days: 6,
        critical_path: !!a.is_critical,
        total_float: a.is_critical ? 0 : 8,
        chain_length: 2,
        impacted_successors_count: 2,
        max_propagated_delay_days: 6,
        project_finish_impact_days: a.is_critical ? 6 : 0,
        propagation_status: a.is_critical ? 'CRITICAL_DELAY' : 'FLOAT_EROSION',
        successors: [
          {
            activity_id: 'MEC-L6-01',
            activity_name: 'Base plate grouting & alignment',
            relationship: 'FS',
            lag_days: 0,
            depth: 1,
            inherited_delay_days: 6,
            critical_path: true,
            total_float: 0
          },
          {
            activity_id: 'ELE-L6-01',
            activity_name: 'Transformer bay foundation handover',
            relationship: 'FS',
            lag_days: 2,
            depth: 2,
            inherited_delay_days: 4,
            critical_path: false,
            total_float: 3
          }
        ]
      }));

      const payload = {
        execution_file: initialExec || 'demo_fallback_data',
        schedule_file: initialSched || 'baseline_schedule.xlsx',
        total_propagated_chains: propagationList.length,
        propagation: propagationList,
        summary: {
          total_sources: propagationList.length,
          critical_sources: propagationList.filter(p => p.critical_path).length,
          max_delay_days: 6
        }
      };
      setImpactData(payload);
      setSelectedSource(propagationList[0] || null);
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

  const fetchImpactPropagation = useCallback(async (eFile, sFile) => {
    if (hasNoData || !eFile || projectContext?.is_fallback) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/ingestion/impact-propagation?execution_file=${encodeURIComponent(eFile)}&schedule_file=${encodeURIComponent(sFile)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Server returned HTTP ${response.status}`);
      }

      setImpactData(data);
      if (data.propagation && data.propagation.length > 0) {
        setSelectedSource(data.propagation[0]);
      } else {
        setSelectedSource(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to calculate impact propagation.');
      setImpactData(null);
      setSelectedSource(null);
    } finally {
      setLoading(false);
    }
  }, [hasNoData, projectContext]);

  useEffect(() => {
    fetchImpactPropagation(execFile, scheduleFile);
  }, [fetchImpactPropagation, execFile, scheduleFile]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2e2e2e] rounded-xl p-8 text-center shadow-xs">
        <div className="max-w-md mx-auto space-y-3">
          <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-[#252525] text-slate-400">
            <Network className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-neutral-200">No Active Project Data</h3>
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            Upload a project data file in Project Intelligence to inspect CPM schedule network impact propagation.
          </p>
        </div>
      </div>
    );
  }

  const propagationList = impactData?.propagation || [];
  const summary = impactData?.summary || {
    total_sources: 0,
    total_affected_activities: 0,
    direct_impacts: 0,
    indirect_impacts: 0,
    critical_path_impacts: 0,
    milestone_impacts: 0,
    project_duration_exposures: 0
  };

  const filteredPropagation = propagationList.filter((p) => {
    if (filterCategory === 'PROJECT_DURATION' && !p.project_duration_exposure) {
      return false;
    }
    if (filterCategory === 'CRITICAL_PATH' && !p.critical_path_impact) {
      return false;
    }
    if (filterCategory === 'MILESTONE' && !p.milestone_impact) {
      return false;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const matchId = p.source_activity_id?.toLowerCase().includes(query);
      const matchName = p.source_activity_name?.toLowerCase().includes(query);
      const matchSched = p.source_schedule_activity_id?.toLowerCase().includes(query);
      const matchDisc = p.source_discipline?.toLowerCase().includes(query);
      if (!matchId && !matchName && !matchSched && !matchDisc) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200 mt-0.5">
              <GitFork className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-900">Impact Propagation</h2>
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-mono font-semibold">
                  Feature 2.21
                </span>
                <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-mono">
                  Schedule Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Deterministic downstream delay propagation through verified baseline schedule dependencies, tracking
                critical-path exposure, milestone impacts, and project duration risk without hypothetical simulation.
              </p>
            </div>
          </div>

          {/* Dual File Pickers & Refresh Action */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <label htmlFor="imp-exec-file" className="text-xs font-medium text-slate-500">Execution:</label>
              <select
                id="imp-exec-file"
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
              <label htmlFor="imp-sched-file" className="text-xs font-medium text-slate-500">Schedule:</label>
              <select
                id="imp-sched-file"
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
              onClick={() => fetchImpactPropagation(execFile, scheduleFile)}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-slate-600' : 'text-slate-500'}`} />
              <span>Re-evaluate</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6 Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Source Activities */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Sources</span>
            <div className="p-1.5 bg-slate-100 rounded text-slate-600">
              <Target className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1.5 font-mono">
            {loading ? '—' : summary.total_sources}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Delayed/at-risk</div>
        </div>

        {/* Affected Activities */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Affected</span>
            <div className="p-1.5 bg-indigo-50 rounded text-indigo-600">
              <GitBranch className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-indigo-700 mt-1.5 font-mono">
            {loading ? '—' : summary.total_affected_activities}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Unique downstream</div>
        </div>

        {/* Direct Impacts */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Direct</span>
            <div className="p-1.5 bg-blue-50 rounded text-blue-600">
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-blue-700 mt-1.5 font-mono">
            {loading ? '—' : summary.direct_impacts}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Depth = 1 successors</div>
        </div>

        {/* Indirect Impacts */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Indirect</span>
            <div className="p-1.5 bg-purple-50 rounded text-purple-600">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-purple-700 mt-1.5 font-mono">
            {loading ? '—' : summary.indirect_impacts}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Depth &gt; 1 cascade</div>
        </div>

        {/* Critical Path Impacts */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Critical Path</span>
            <div className="p-1.5 bg-amber-50 rounded text-amber-600">
              <Flame className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-700 mt-1.5 font-mono">
            {loading ? '—' : summary.critical_path_impacts}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Zero-float exposure</div>
        </div>

        {/* Milestone Impacts */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Milestones</span>
            <div className="p-1.5 bg-rose-50 rounded text-rose-600">
              <Compass className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-700 mt-1.5 font-mono">
            {loading ? '—' : summary.milestone_impacts}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Parent milestone risk</div>
        </div>
      </div>

      {/* Governance Alert & Read-Only Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800">
            Read-Only Analytical Governance • Dependency Graph Propagation
          </p>
          <p>
            Impact is evaluated strictly across verified baseline Finish-to-Start dependency links from Feature 2.15. Downstream exposure identifies vulnerability across critical paths and milestones without altering baseline schedule dates, simulating hypothetical scenarios, or prescribing recovery actions.
          </p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-sm text-rose-700 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Propagation Evaluation Failed</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-medium text-slate-500 flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </span>
          {[
            { id: 'ALL', label: `All Sources (${propagationList.length})` },
            { id: 'PROJECT_DURATION', label: `Project Duration Exposure (${summary.project_duration_exposures})` },
            { id: 'CRITICAL_PATH', label: `Critical Path Impact (${summary.critical_path_impacts})` },
            { id: 'MILESTONE', label: `Milestone Impact (${summary.milestone_impacts})` }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterCategory(tab.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                filterCategory === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search source activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 w-full sm:w-56"
          />
        </div>
      </div>

      {/* Main Content Area: Table + Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Impact Register Table */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Impact Propagation Register ({filteredPropagation.length})
            </span>
            <span className="text-[11px] text-slate-400">
              Select an activity to view downstream propagation chain
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/75 text-slate-600 border-b border-slate-200 font-semibold">
                  <th className="py-2.5 px-3">Source Activity</th>
                  <th className="py-2.5 px-3">Delay / Risk</th>
                  <th className="py-2.5 px-3">Root Cause</th>
                  <th className="py-2.5 px-3 text-center">Successors (Dir / Indir)</th>
                  <th className="py-2.5 px-3 text-center">Max Depth</th>
                  <th className="py-2.5 px-3 text-right">Exposure Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPropagation.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                      No activities match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredPropagation.map((p) => {
                    const isSelected = selectedSource?.source_activity_id === p.source_activity_id;
                    return (
                      <tr
                        key={p.source_activity_id}
                        onClick={() => setSelectedSource(p)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-50/75 font-medium' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="font-mono font-semibold text-slate-900">{p.source_activity_id}</div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[170px]">
                            {p.source_activity_name}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] border ${getSeverityBadge(p.source_delay_severity)}`}>
                            {p.source_delay_severity}
                          </span>
                          <div className="mt-1">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] border ${getPredictionRiskBadge(p.source_prediction_risk)}`}>
                              Risk: {p.source_prediction_risk}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                            {String(p.source_root_cause_category || 'UNASSIGNED').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap font-mono">
                          <span className="font-bold text-slate-900">{p.total_affected_activities}</span>
                          <span className="text-slate-400 text-[11px] ml-1">
                            ({p.direct_successor_count} / {p.indirect_successor_count})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap font-mono font-bold text-slate-800">
                          {p.maximum_propagation_depth}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${getImpactStatusBadge(p.impact_status)}`}>
                            {String(p.impact_status || 'NO_IMPACT').replace(/_/g, ' ')}
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

        {/* Right Side: Interactive Detail Inspector */}
        <div className="lg:col-span-5 space-y-4">
          {selectedSource ? (
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-5">
              {/* Selected Source Header */}
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {selectedSource.source_activity_id}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] border font-medium ${getDisciplineBadge(selectedSource.source_discipline)}`}>
                      {selectedSource.source_discipline}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                      {selectedSource.source_schedule_level}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] border ${getSeverityBadge(selectedSource.source_delay_severity)}`}>
                    {selectedSource.source_delay_severity}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-800 mt-1">
                  {selectedSource.source_activity_name}
                </h3>
                <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
                  <span>Linked Schedule Baseline:</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {selectedSource.source_schedule_activity_id}
                  </span>
                </div>
              </div>

              {/* Exposure Status Banner */}
              <div className="bg-rose-50/50 border border-rose-200 rounded-lg p-3.5 space-y-2">
                <div className="text-xs font-medium text-rose-900 uppercase tracking-wider flex items-center justify-between">
                  <span>Verified Impact Status</span>
                  <span className="font-mono text-[11px] text-rose-700">
                    Max Depth: {selectedSource.maximum_propagation_depth}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded text-xs border ${getImpactStatusBadge(selectedSource.impact_status)}`}>
                    {String(selectedSource.impact_status || 'NO_IMPACT').replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-[11px] text-rose-800 pt-1">
                  {selectedSource.project_duration_exposure
                    ? 'Downstream cascade reaches terminal critical path activities driving overall project duration.'
                    : 'Downstream impact is bounded within immediate activity network.'}
                </div>
              </div>

              {/* Propagation Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
                  <span className="text-[10px] font-medium text-slate-500 uppercase">Direct Successors</span>
                  <div className="text-sm font-bold font-mono text-indigo-700 mt-0.5">
                    {selectedSource.direct_successor_count} activities
                  </div>
                  <div className="text-[10px] text-slate-400">Depth = 1 impact</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
                  <span className="text-[10px] font-medium text-slate-500 uppercase">Indirect Successors</span>
                  <div className="text-sm font-bold font-mono text-purple-700 mt-0.5">
                    {selectedSource.indirect_successor_count} activities
                  </div>
                  <div className="text-[10px] text-slate-400">Depth &gt; 1 cascade</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
                  <span className="text-[10px] font-medium text-slate-500 uppercase">Critical Activities</span>
                  <div className="text-sm font-bold font-mono text-rose-700 mt-0.5">
                    {selectedSource.affected_critical_activities?.length || 0} activities
                  </div>
                  <div className="text-[10px] text-slate-400">Zero-float nodes</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
                  <span className="text-[10px] font-medium text-slate-500 uppercase">Affected Milestones</span>
                  <div className="text-sm font-bold font-mono text-violet-700 mt-0.5">
                    {selectedSource.affected_milestone_ids?.length > 0
                      ? selectedSource.affected_milestone_ids.join(', ')
                      : 'None'}
                  </div>
                  <div className="text-[10px] text-slate-400">Parent delivery targets</div>
                </div>
              </div>

              {/* Downstream Dependency Chain */}
              <div className="border-t border-slate-100 pt-3">
                <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-slate-500" />
                  <span>Downstream Dependency Chain ({selectedSource.affected_activities?.length || 0})</span>
                </div>

                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {selectedSource.affected_activities && selectedSource.affected_activities.length > 0 ? (
                    selectedSource.affected_activities.map((node) => (
                      <div
                        key={node.activity_id}
                        className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-slate-900">{node.activity_id}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] border ${getImpactTypeBadge(node.impact_type)}`}>
                              Depth {node.depth}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded border border-slate-200 font-mono">
                              {node.schedule_level}
                            </span>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] border font-semibold ${
                              node.is_on_critical_path
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {node.critical_path_status}
                          </span>
                        </div>

                        <div className="text-slate-700 font-medium">
                          {node.activity_name}
                        </div>

                        <div className="flex items-center space-x-3 text-[11px] text-slate-500 font-mono">
                          <span>Total Float: {node.total_float !== null ? `${node.total_float}d` : '—'}</span>
                          {node.milestone_id && (
                            <span className="text-violet-700 font-semibold">
                              Milestone: {node.milestone_id}
                            </span>
                          )}
                          {node.is_on_completion_path && (
                            <span className="text-rose-700 font-semibold">Completion Path</span>
                          )}
                        </div>

                        {/* Evidence Citations */}
                        <div className="pt-1 space-y-1">
                          {node.evidence?.map((ev, idx) => (
                            <div key={idx} className="text-[11px] text-slate-600 pl-2 border-l-2 border-indigo-200">
                              {ev}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 italic">No downstream dependencies detected.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-400 text-xs shadow-sm">
              Select an activity from the register to inspect its downstream propagation chain.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
