import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Layers, CheckSquare, Clock, RefreshCw, AlertCircle, FileSpreadsheet, Tag } from 'lucide-react';

function getLevelBadge(level) {
  switch (level?.toUpperCase()) {
    case 'L5':
      return 'bg-purple-50 text-purple-700 border-purple-200 font-semibold';
    case 'L6':
      return 'bg-blue-50 text-blue-700 border-blue-200 font-semibold';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
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

const AVAILABLE_SCHEDULE_FILES = [
  { id: 'baseline_schedule.xlsx', label: 'baseline_schedule.xlsx (Project Baseline Schedule)' },
  { id: 'test_site_progress.xlsx', label: 'test_site_progress.xlsx (Civil Progress File)' },
  { id: 'test_multisheet_project.xlsx', label: 'test_multisheet_project.xlsx (Civil & Piping File)' },
];

export default function ScheduleActivityViewer({ scheduleFile: propSchedFile, projectContext } = {}) {
  const getContextFileName = (ctx) => {
    const f = ctx?.files?.[0] || ctx?.files_processed?.[0];
    if (!f) return '';
    return typeof f === 'string' ? f : (f?.filename || f?.name || '');
  };
  const activeFileName = propSchedFile || projectContext?.schedule_info?.filename || getContextFileName(projectContext);
  const [selectedFile, setSelectedFile] = useState(activeFileName || 'baseline_schedule.xlsx');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scheduleData, setScheduleData] = useState(null);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [levelFilter, setLevelFilter] = useState('ALL'); // 'ALL', 'L5', 'L6'

  const fetchSchedule = useCallback(async (filename) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ingestion/schedule/${encodeURIComponent(filename)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Server returned HTTP ${response.status}`);
      }

      setScheduleData(data);
      setActiveSheetIndex(0);
    } catch (err) {
      setError(err.message || `Failed to load schedule data for '${filename}'.`);
      setScheduleData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeFileName && activeFileName !== selectedFile) {
      setSelectedFile(activeFileName);
    }
  }, [activeFileName]);

  useEffect(() => {
    fetchSchedule(selectedFile);
  }, [fetchSchedule, selectedFile]);

  const schedOptions = [
    ...(activeFileName ? [{ id: activeFileName, label: `${activeFileName} (Active Schedule)` }] : []),
    ...AVAILABLE_SCHEDULE_FILES.filter((f) => f.id !== activeFileName),
  ];

  const currentSheet = scheduleData?.sheets?.[activeSheetIndex] || scheduleData?.sheets?.[0];
  const allActivities = currentSheet?.activities || [];

  // Summary counts for current sheet or overall
  const totalScheduleActivities = currentSheet?.total_schedule_activities ?? scheduleData?.total_schedule_activities ?? 0;
  const l5Activities = currentSheet?.l5_count ?? scheduleData?.l5_count ?? 0;
  const l6Activities = currentSheet?.l6_count ?? scheduleData?.l6_count ?? 0;

  // Filter activities by Level if active
  const filteredActivities = allActivities.filter((act) => {
    if (levelFilter === 'ALL') return true;
    return act.level?.toUpperCase() === levelFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Source & Action Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">Schedule Activities (L5 / L6)</h3>
                <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-mono font-semibold">
                  Baseline Master Schedule
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Structured schedule activity baseline for upcoming L5 / L6 mapping and validation
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <label htmlFor="sched-file-select" className="text-xs font-medium text-slate-500">
                Schedule File:
              </label>
              <select
                id="sched-file-select"
                value={selectedFile}
                onChange={(e) => setSelectedFile(e.target.value)}
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
              onClick={() => fetchSchedule(selectedFile)}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-slate-600' : 'text-slate-500'}`} />
              <span>Reload</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards (Requirement 6) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Schedule Activities */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Schedule Activities
            </span>
            <div className="p-1.5 bg-slate-100 rounded text-slate-600 border border-slate-200">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {loading ? '—' : totalScheduleActivities}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Worksheet: {currentSheet?.sheet_name || 'Loading...'}
          </div>
        </div>

        {/* L5 Activities */}
        <div className="bg-white border border-purple-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-purple-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-purple-700 uppercase tracking-wider">
              L5 Activities (Work Packages)
            </span>
            <div className="p-1.5 bg-purple-50 rounded text-purple-600 border border-purple-200">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-800 mt-2 font-mono">
            {loading ? '—' : l5Activities}
          </div>
          <div className="text-[11px] text-purple-600/80 mt-1">
            {totalScheduleActivities > 0 ? `${Math.round((l5Activities / totalScheduleActivities) * 100)}% of total schedule` : '0%'}
          </div>
        </div>

        {/* L6 Activities */}
        <div className="bg-white border border-blue-100 rounded-lg p-4 shadow-sm bg-gradient-to-br from-white to-blue-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-700 uppercase tracking-wider">
              L6 Activities (Detailed Tasks)
            </span>
            <div className="p-1.5 bg-blue-50 rounded text-blue-600 border border-blue-200">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-800 mt-2 font-mono">
            {loading ? '—' : l6Activities}
          </div>
          <div className="text-[11px] text-blue-600/80 mt-1">
            {totalScheduleActivities > 0 ? `${Math.round((l6Activities / totalScheduleActivities) * 100)}% of total schedule` : '0%'}
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-rose-900">Schedule Ingestion Notice</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Schedule Table Container */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {/* Table Header Controls */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Baseline Schedule Activity Register
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Identified L5/L6 activities from <span className="font-mono font-medium text-slate-700">{selectedFile}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Level Filter Buttons */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-md border border-slate-200 text-xs">
              <span className="text-[11px] font-semibold text-slate-500 px-1.5">Filter:</span>
              <button
                onClick={() => setLevelFilter('ALL')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  levelFilter === 'ALL'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({allActivities.length})
              </button>
              <button
                onClick={() => setLevelFilter('L5')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  levelFilter === 'L5'
                    ? 'bg-purple-100 text-purple-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-purple-700'
                }`}
              >
                L5 ({l5Activities})
              </button>
              <button
                onClick={() => setLevelFilter('L6')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  levelFilter === 'L6'
                    ? 'bg-blue-100 text-blue-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-blue-700'
                }`}
              >
                L6 ({l6Activities})
              </button>
            </div>

            {/* Multi-sheet Tabs if workbook has multiple sheets */}
            {scheduleData?.sheets?.length > 1 && (
              <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-md border border-slate-200">
                {scheduleData.sheets.map((sheet, idx) => (
                  <button
                    key={sheet.sheet_name || idx}
                    onClick={() => setActiveSheetIndex(idx)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                      idx === activeSheetIndex
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sheet.sheet_name} ({sheet.total_schedule_activities})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Table Body (Requirements 3, 4, 5) */}
        <div className="p-6">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
              <span>Reading and parsing schedule activities...</span>
            </div>
          ) : filteredActivities.length > 0 ? (
            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
              <div className="overflow-x-auto max-h-[540px]">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100/90 text-slate-800 font-semibold border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 w-10 text-center text-slate-400 font-mono text-[11px] border-r border-slate-200 bg-slate-100">
                        #
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        Activity ID
                      </th>
                      <th className="px-4 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap min-w-[200px]">
                        Activity Name
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        WBS
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Level
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        Planned Start
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        Planned Finish
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                        Duration
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-slate-900 text-center whitespace-nowrap">
                        Discipline
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredActivities.map((act, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-400 bg-slate-50/50 border-r border-slate-200">
                          {act.index || idx + 1}
                        </td>
                        <td className="px-3.5 py-2.5 border-r border-slate-100 whitespace-nowrap">
                          <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {act.activity_id}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 border-r border-slate-100 font-semibold text-slate-900">
                          {act.activity_name}
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-100 font-mono text-slate-600 whitespace-nowrap">
                          {act.wbs}
                        </td>
                        <td className="px-3 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] border ${getLevelBadge(act.level)}`}>
                            {act.level}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 border-r border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                          {act.planned_start}
                        </td>
                        <td className="px-3.5 py-2.5 border-r border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                          {act.planned_finish}
                        </td>
                        <td className="px-3 py-2.5 text-center border-r border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                          {act.duration}
                        </td>
                        <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getDisciplineBadge(act.discipline)}`}>
                            {act.discipline}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span>
                  Showing <strong>{filteredActivities.length}</strong> of <strong>{allActivities.length}</strong> schedule activities in <strong>{currentSheet?.sheet_name}</strong>
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  Schedule Activity Layer • Feature 2.6
                </span>
              </div>
            </div>
          ) : (
            <div className="p-8 border border-dashed border-slate-300 rounded-lg text-center text-slate-500 text-xs bg-slate-50/50">
              No schedule activities match the current filter ({levelFilter}).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
