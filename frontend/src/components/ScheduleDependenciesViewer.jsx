import React, { useState, useEffect, useCallback } from 'react';
import {
  GitFork,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  Info,
  Layers,
  ArrowRight,
  Filter,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Network,
  Sparkles
} from 'lucide-react';

function getValidationBadge(status) {
  switch (status) {
    case 'VALID':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold';
    case 'INVALID_PREDECESSOR':
    case 'INVALID_CIRCULAR':
    case 'INVALID_SUCCESSOR':
    case 'INVALID':
      return 'bg-rose-50 text-rose-800 border-rose-200 font-bold';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function getLevelBadge(level) {
  switch (level) {
    case 'L6':
      return 'bg-blue-50 text-blue-700 border-blue-200 font-semibold';
    case 'L5':
    case 'L5_PARENT':
      return 'bg-purple-50 text-purple-700 border-purple-200 font-semibold';
    default:
      return 'bg-slate-100 text-slate-500 border-slate-200';
  }
}

const AVAILABLE_SCHEDULE_FILES = [
  { id: 'baseline_schedule.xlsx', label: 'baseline_schedule.xlsx (Baseline Schedule)' },
];

export default function ScheduleDependenciesViewer({ scheduleFile: propSchedFile, projectContext } = {}) {
  const hasNoData = !projectContext && !propSchedFile;
  const getContextFileName = (ctx) => {
    const f = ctx?.files?.[0] || ctx?.files_processed?.[0];
    if (!f) return '';
    return typeof f === 'string' ? f : (f?.filename || f?.name || '');
  };
  const activeFileName = projectContext?.schedule_info?.filename || getContextFileName(projectContext);
  const initialSched = propSchedFile || activeFileName || (hasNoData ? '' : 'baseline_schedule.xlsx');
  const [scheduleFile, setScheduleFile] = useState(initialSched);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dependencyData, setDependencyData] = useState(projectContext?.schedule_dependencies || null);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'VALID' | 'INVALID'
  const [selectedRow, setSelectedRow] = useState(() => projectContext?.schedule_dependencies?.dependencies?.[0] || null);

  useEffect(() => {
    if (propSchedFile && propSchedFile !== scheduleFile) {
      setScheduleFile(propSchedFile);
    }
  }, [propSchedFile]);

  useEffect(() => {
    if (projectContext?.schedule_dependencies) {
      setDependencyData(projectContext.schedule_dependencies);
      if (projectContext.schedule_dependencies.dependencies?.length > 0) {
        setSelectedRow(projectContext.schedule_dependencies.dependencies[0]);
      }
    }
  }, [projectContext]);

  const fetchDependencies = useCallback(async (schedFile) => {
    if (hasNoData || !schedFile) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/ingestion/schedule-dependencies?schedule_file=${encodeURIComponent(schedFile)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Server returned HTTP ${response.status}`);
      }

      setDependencyData(data);
      if (data.dependencies && data.dependencies.length > 0) {
        setSelectedRow(data.dependencies[0]);
      } else {
        setSelectedRow(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load schedule dependencies.');
      setDependencyData(null);
      setSelectedRow(null);
    } finally {
      setLoading(false);
    }
  }, [hasNoData]);

  useEffect(() => {
    if (!hasNoData && scheduleFile) {
      fetchDependencies(scheduleFile);
    }
  }, [fetchDependencies, scheduleFile, hasNoData]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-xl p-12 text-center shadow-sm max-w-2xl mx-auto my-6">
        <div className="w-14 h-14 bg-slate-100 dark:bg-[#252525] rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400 dark:text-neutral-500">
          <GitFork className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-neutral-100 mb-2">
          No Active Project Loaded
        </h3>
        <p className="text-sm text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
          Upload and process a project data file in Project Intelligence to view schedule dependencies and relationship validation.
        </p>
      </div>
    );
  }

  const dependencies = dependencyData?.dependencies || [];

  const filteredDependencies = dependencies.filter((dep) => {
    if (statusFilter === 'VALID') return dep.validation_status === 'VALID';
    if (statusFilter === 'INVALID') return dep.validation_status !== 'VALID';
    return true;
  });

  const totalDeps = dependencyData?.total_dependencies ?? 0;
  const validDeps = dependencyData?.valid_dependencies ?? 0;
  const invalidDeps = dependencyData?.invalid_dependencies ?? 0;

  const schedOptions = [
    ...(activeFileName ? [{ id: activeFileName, label: `${activeFileName} (Active Schedule)` }] : []),
    ...AVAILABLE_SCHEDULE_FILES.filter((f) => f.id !== activeFileName),
  ];

  return (
    <div className="space-y-6">
      {/* Demo Fallback Data Banner */}
      {projectContext?.is_fallback && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3.5 flex items-center space-x-3 text-xs text-blue-800 dark:text-blue-300">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span>
            <strong>Demo Fallback Data Mode:</strong> Displaying realistic schedule dependency register and activity relationship links generated from uploaded file.
          </span>
        </div>
      )}

      {/* Top Banner / Controls Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200">
              <GitFork className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">Schedule Dependencies</h3>
                <span className="text-[11px] bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded font-mono font-semibold">
                  Feature 2.15
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Baseline activity relationships showing predecessor and successor flow
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Schedule File Select */}
            <div className="flex items-center space-x-1.5">
              <label htmlFor="dep-sched-file" className="text-xs font-medium text-slate-500">
                Schedule:
              </label>
              <select
                id="dep-sched-file"
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
              onClick={() => fetchDependencies(scheduleFile)}
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
        {/* Total Dependencies */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Dependencies
            </span>
            <div className="p-1.5 bg-slate-100 rounded text-slate-600 border border-slate-200">
              <Network className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {loading ? '—' : totalDeps}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Predecessor → successor baseline links
          </div>
        </div>

        {/* Valid Dependencies */}
        <div className="bg-white border border-emerald-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
              Valid Dependencies
            </span>
            <div className="p-1.5 bg-emerald-50 rounded text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
            {loading ? '—' : validDeps}
          </div>
          <div className="text-[11px] text-emerald-700/80 mt-1">
            Referenced activities exist in baseline schedule
          </div>
        </div>

        {/* Invalid Dependencies */}
        <div className="bg-white border border-rose-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-rose-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900 uppercase tracking-wider">
              Invalid Dependencies
            </span>
            <div className="p-1.5 bg-rose-50 rounded text-rose-700 border border-rose-200">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-2 font-mono">
            {loading ? '—' : invalidDeps}
          </div>
          <div className="text-[11px] text-rose-700/80 mt-1">
            Dangling or non-existent activity references
          </div>
        </div>
      </div>

      {/* Governance Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 flex items-start space-x-3 text-xs text-slate-600">
        <Info className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold text-slate-900">Governance Notice: </span>
          Schedule Dependencies is currently read-only. No schedule or database changes are made from this view.
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-3 text-xs text-rose-700">
          <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-rose-900">Schedule Dependencies Notice</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Main Table + Detail Layout */}
      <div className="space-y-4">
        {/* Filter bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-500">Filter:</span>
            <div className="inline-flex rounded-md shadow-sm border border-slate-200 bg-white p-0.5">
              {[
                { key: 'ALL', label: `All (${totalDeps})` },
                { key: 'VALID', label: `Valid (${validDeps})` },
                { key: 'INVALID', label: `Invalid (${invalidDeps})` },
              ].map((b) => (
                <button
                  key={b.key}
                  onClick={() => setStatusFilter(b.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    statusFilter === b.key
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs text-slate-400">
            Showing {filteredDependencies.length} of {totalDeps} dependencies
          </span>
        </div>

        {/* Dependencies Register Table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold tracking-wider uppercase text-[10px]">
                  <th className="py-2.5 px-3">Predecessor ID</th>
                  <th className="py-2.5 px-3">Predecessor Activity</th>
                  <th className="py-2.5 px-2 text-center">Flow</th>
                  <th className="py-2.5 px-3">Successor ID</th>
                  <th className="py-2.5 px-3">Successor Activity</th>
                  <th className="py-2.5 px-2.5 text-center">Levels</th>
                  <th className="py-2.5 px-3 text-center">Type</th>
                  <th className="py-2.5 px-3 text-center">Validation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                      Loading schedule dependencies...
                    </td>
                  </tr>
                ) : filteredDependencies.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No schedule dependencies match the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredDependencies.map((dep, idx) => {
                    const isSelected =
                      selectedRow?.predecessor_activity_id === dep.predecessor_activity_id &&
                      selectedRow?.successor_activity_id === dep.successor_activity_id;

                    return (
                      <tr
                        key={`${dep.predecessor_activity_id}->${dep.successor_activity_id}-${idx}`}
                        onClick={() => setSelectedRow(dep)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-indigo-50/60 border-l-4 border-l-indigo-600'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Predecessor ID */}
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {dep.predecessor_activity_id}
                        </td>

                        {/* Predecessor Activity */}
                        <td className="py-2.5 px-3 text-slate-700 text-[11px] max-w-[200px] truncate" title={dep.predecessor_activity_name}>
                          {dep.predecessor_activity_name}
                        </td>

                        {/* Flow Arrow */}
                        <td className="py-2.5 px-2 text-center text-indigo-500 font-bold">
                          →
                        </td>

                        {/* Successor ID */}
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                          {dep.successor_activity_id}
                        </td>

                        {/* Successor Activity */}
                        <td className="py-2.5 px-3 text-slate-700 text-[11px] max-w-[220px] truncate" title={dep.successor_activity_name}>
                          {dep.successor_activity_name}
                        </td>

                        {/* Levels */}
                        <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                          <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] border font-mono ${getLevelBadge(dep.predecessor_level)}`}>
                            {dep.predecessor_level}
                          </span>
                          <span className="text-slate-300 mx-1">→</span>
                          <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] border font-mono ${getLevelBadge(dep.successor_level)}`}>
                            {dep.successor_level}
                          </span>
                        </td>

                        {/* Dependency Type */}
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {dep.dependency_type === 'FINISH_TO_START' ? 'Finish-to-Start (FS)' : dep.dependency_type}
                          </span>
                        </td>

                        {/* Validation Status */}
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${getValidationBadge(dep.validation_status)}`}>
                            {dep.validation_status}
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

        {/* Selected Row Read-Only Detail Panel */}
        {selectedRow && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <GitFork className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Dependency Link Details:{' '}
                  <span className="font-mono text-slate-900">{selectedRow.predecessor_activity_id}</span>
                  <span className="text-indigo-600 mx-1.5">→</span>
                  <span className="font-mono text-blue-700">{selectedRow.successor_activity_id}</span>
                </h4>
              </div>
              <span className={`px-2.5 py-0.5 rounded text-xs border ${getValidationBadge(selectedRow.validation_status)}`}>
                Validation: {selectedRow.validation_status}
              </span>
            </div>

            {/* 3 Detail Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Card 1: PREDECESSOR ACTIVITY */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-md p-3.5 space-y-2">
                <div className="flex items-center space-x-1.5 text-slate-800 font-bold uppercase tracking-wider text-[10px]">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                  <span>Predecessor (Preceding Task)</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Activity ID & Name</span>
                    <span className="font-mono font-bold text-slate-900">{selectedRow.predecessor_activity_id}</span>
                    <p className="text-slate-700 leading-tight mt-0.5">{selectedRow.predecessor_activity_name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Level</span>
                      <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] border font-mono ${getLevelBadge(selectedRow.predecessor_level)}`}>
                        {selectedRow.predecessor_level}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">WBS</span>
                      <span className="font-mono text-slate-800">{selectedRow.predecessor?.wbs || '-'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Discipline</span>
                      <span className="text-slate-800 font-medium">{selectedRow.predecessor?.discipline || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Duration</span>
                      <span className="text-slate-800 font-medium">{selectedRow.predecessor?.duration || '-'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Planned Start</span>
                      <span className="text-slate-800 font-mono text-[11px]">{selectedRow.predecessor?.planned_start || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Planned Finish</span>
                      <span className="text-slate-800 font-mono text-[11px]">{selectedRow.predecessor?.planned_finish || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: SUCCESSOR ACTIVITY */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-md p-3.5 space-y-2">
                <div className="flex items-center space-x-1.5 text-slate-800 font-bold uppercase tracking-wider text-[10px]">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
                  <span>Successor (Dependent Task)</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Activity ID & Name</span>
                    <span className="font-mono font-bold text-blue-700">{selectedRow.successor_activity_id}</span>
                    <p className="text-slate-700 leading-tight mt-0.5">{selectedRow.successor_activity_name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Level</span>
                      <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] border font-mono ${getLevelBadge(selectedRow.successor_level)}`}>
                        {selectedRow.successor_level}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">WBS</span>
                      <span className="font-mono text-slate-800">{selectedRow.successor?.wbs || '-'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Discipline</span>
                      <span className="text-slate-800 font-medium">{selectedRow.successor?.discipline || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Duration</span>
                      <span className="text-slate-800 font-medium">{selectedRow.successor?.duration || '-'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Planned Start</span>
                      <span className="text-slate-800 font-mono text-[11px]">{selectedRow.successor?.planned_start || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Planned Finish</span>
                      <span className="text-slate-800 font-mono text-[11px]">{selectedRow.successor?.planned_finish || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: RELATIONSHIP & INTEGRITY */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-md p-3.5 space-y-2">
                <div className="flex items-center space-x-1.5 text-slate-800 font-bold uppercase tracking-wider text-[10px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Relationship & Integrity</span>
                </div>
                <div className="space-y-2 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Dependency Type</span>
                    <span className="font-mono font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 inline-block mt-0.5">
                      {selectedRow.dependency_type} (FS)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Relationship Flow</span>
                    <span className="font-mono text-slate-800 font-semibold text-xs">
                      {selectedRow.predecessor_activity_id} → {selectedRow.successor_activity_id}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Integrity Status</span>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] border mt-0.5 ${getValidationBadge(selectedRow.validation_status)}`}>
                      {selectedRow.validation_status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Validation Note</span>
                    <p className="text-slate-600 text-[11px] leading-tight mt-0.5">
                      {selectedRow.validation_reason || 'Verified baseline relationship.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Read-Only Governance Confirmation (NO action buttons) */}
            <div className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded border border-slate-100 flex items-center justify-between">
              <span>Read-only inspection panel. Schedule relationships reflect baseline network logic.</span>
              <span className="font-mono text-slate-500 font-medium">Deterministic Baseline Link</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
