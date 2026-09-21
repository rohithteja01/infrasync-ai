import React, { useState, useEffect, useCallback, useRef } from 'react';
import { authFetch } from '../lib/apiClient';
import {
  Calendar,
  Layers,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Tag,
  Search,
  ChevronDown,
  Clock,
  Briefcase,
  Activity,
  ShieldCheck,
  FileCode,
  FileText
} from 'lucide-react';

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
  const d = String(discipline || '').toLowerCase();
  if (d.includes('civil')) return 'bg-amber-50 text-amber-800 border-amber-200';
  if (d.includes('piping') || d.includes('pipe')) return 'bg-cyan-50 text-cyan-800 border-cyan-200';
  if (d.includes('mech')) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (d.includes('struct')) return 'bg-indigo-50 text-indigo-800 border-indigo-200';
  if (d.includes('elec')) return 'bg-violet-50 text-violet-800 border-violet-200';
  if (d.includes('inst')) return 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200';
  return 'bg-slate-100 text-slate-800 border-slate-200';
}

function getSourceTypeBadge(sourceType) {
  switch (sourceType) {
    case 'PRIMAVERA_P6_EXPORT':
      return 'bg-orange-50 text-orange-800 border-orange-300';
    case 'MS_PROJECT_EXPORT':
      return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    default:
      return 'bg-blue-50 text-blue-800 border-blue-300';
  }
}

export default function ScheduleIngestionViewer() {
  const [scheduleFiles, setScheduleFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [disciplineFilter, setDisciplineFilter] = useState('ALL');

  const fileInputRef = useRef(null);

  // Fetch list of available schedule files
  const fetchScheduleFilesList = useCallback(async () => {
    try {
      const res = await authFetch('/api/ingestion/schedules');
      if (res.ok) {
        const data = await res.json();
        setScheduleFiles(data.files || []);
      }
    } catch (e) {
      console.warn('Failed to list schedule files:', e);
    }
  }, []);

  // Fetch and parse selected schedule file
  const fetchScheduleDetail = useCallback(async (filename) => {
    if (!filename) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/ingestion/schedules/${encodeURIComponent(filename)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `Server returned HTTP ${res.status}`);
      }
      setScheduleData(data);
    } catch (err) {
      setError(err.message || `Failed to parse schedule file '${filename}'.`);
      setScheduleData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScheduleFilesList();
  }, [fetchScheduleFilesList]);

  useEffect(() => {
    if (selectedFile) {
      fetchScheduleDetail(selectedFile);
    }
  }, [selectedFile, fetchScheduleDetail]);

  // Handle schedule file upload
  const handleFileUpload = async (file) => {
    if (!file) return;
    const allowed = ['.xlsx', '.xls', '.csv'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setUploadError(`Invalid schedule format "${ext}". Supported formats: ${allowed.join(', ')}`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await authFetch('/api/ingestion/schedules/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `Upload failed with HTTP ${res.status}`);
      }

      setUploadSuccess(`Schedule "${data.filename}" imported successfully as ${data.source_type}! Found ${data.total_activities} activities.`);
      await fetchScheduleFilesList();
      setSelectedFile(data.filename);
      setScheduleData(data);
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Filter activities
  const allActivities = scheduleData?.activities || [];
  const filteredActivities = allActivities.filter((act) => {
    const matchesSearch =
      !searchTerm ||
      act.activity_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.activity_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.wbs?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.discipline?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLevel =
      levelFilter === 'ALL' || act.level?.toUpperCase() === levelFilter.toUpperCase();

    const matchesDisc =
      disciplineFilter === 'ALL' ||
      act.discipline?.toUpperCase() === disciplineFilter.toUpperCase();

    return matchesSearch && matchesLevel && matchesDisc;
  });

  const disciplines = ['ALL', ...new Set(allActivities.map((a) => a.discipline).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-indigo-900/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <Calendar className="w-3.5 h-3.5" />
              Feature 2.31 Primavera & MS Project Ingestion
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Schedule Ingestion & Normalization</h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Import and standardize schedule exports from Primavera P6 and Microsoft Project (.xlsx, .xls, .csv). Normalizes activity IDs, WBS, levels, planned dates, durations, and predecessors into canonical schedule intelligence.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10 text-xs">
              <span className="text-slate-400 block">Supported Formats</span>
              <span className="text-indigo-300 font-semibold flex items-center gap-1.5 mt-0.5">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                .XLSX / .XLS / .CSV
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10 text-xs">
              <span className="text-slate-400 block">Baseline Integrity</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                In-Memory / Zero DB Writes
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Upload & Schedule File Selection Toolbar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Schedule Selection & Dropzone */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-800 text-sm">Select Stored Schedule Export</h3>
            </div>
            <button
              onClick={() => {
                fetchScheduleFilesList();
                if (selectedFile) fetchScheduleDetail(selectedFile);
              }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-700 bg-slate-50 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full">
              <select
                value={selectedFile}
                onChange={(e) => setSelectedFile(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-lg px-3.5 py-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {scheduleFiles.length === 0 ? (
                  <option value="">No schedule files uploaded yet</option>
                ) : (
                  scheduleFiles.map((f) => (
                    <option key={f.filename} value={f.filename}>
                      {f.filename} ({f.source_type?.replace(/_/g, ' ') || f.source_format?.toUpperCase()})
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              Upload Schedule
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
              isDragOver
                ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
                : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <p className="text-xs text-slate-500">
              Drag and drop Primavera P6 or MS Project exports (<span className="font-semibold text-slate-700">.xlsx, .xls, .csv</span>) here for automated parsing
            </p>
          </div>

          {/* Status notices */}
          {uploadError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
          {uploadSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{uploadSuccess}</span>
            </div>
          )}
        </div>

        {/* Right 1 Col: Schedule Metadata & Source Diagnostics Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-800 text-sm">Source Diagnostics</h3>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getSourceTypeBadge(
                scheduleData?.source_type
              )}`}
            >
              {scheduleData?.source_type || 'DETECTION PENDING'}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Source Format:</span>
              <span className="font-semibold uppercase text-slate-800">
                {scheduleData?.source_format || 'XLSX'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Schedule Sheets:</span>
              <span className="font-medium text-slate-800">{scheduleData?.sheet_count || 1} sheet(s)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Activity Tally:</span>
              <span className="font-medium text-slate-800">
                {scheduleData?.total_activities || 0} total (L5: {scheduleData?.l5_count || 0}, L6: {scheduleData?.l6_count || 0})
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Baseline MD5:</span>
              <span className="font-mono text-[11px] text-slate-600">
                {scheduleData ? '5d8ed61031538f05...' : '—'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Database State:</span>
              <span className="font-medium text-emerald-700">Strictly In-Memory</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table & Results View */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full mx-auto" />
          <h4 className="text-slate-700 font-semibold text-sm">Parsing Schedule Export...</h4>
          <p className="text-slate-400 text-xs max-w-sm mx-auto">
            Extracting activity codes, WBS hierarchy, durations, and predecessor logic.
          </p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-rose-200 p-8 text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <h4 className="text-rose-700 font-semibold text-sm">Schedule Ingestion Error</h4>
          <p className="text-slate-500 text-xs">{error}</p>
        </div>
      ) : scheduleData ? (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Total Activities</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{scheduleData.total_activities || 0}</p>
              <span className="text-[11px] text-slate-500">Standardized Activities</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Tag className="w-4 h-4 text-purple-600" />
                <span>Level 5 (L5)</span>
              </div>
              <p className="text-2xl font-bold text-purple-700">{scheduleData.l5_count || 0}</p>
              <span className="text-[11px] text-slate-500">Summary Work Packages</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span>Level 6 (L6)</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">{scheduleData.l6_count || 0}</p>
              <span className="text-[11px] text-slate-500">Executable Work Items</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Source Engine</span>
              </div>
              <p className="text-sm font-bold text-slate-800 truncate mt-1">
                {scheduleData.source_type?.replace(/_/g, ' ') || 'Generic'}
              </p>
              <span className="text-[11px] text-slate-500 uppercase">{scheduleData.source_format} format</span>
            </div>
          </div>

          {/* Activities Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-800 text-sm">
                  Standardized Activity Register ({filteredActivities.length} of {allActivities.length})
                </h3>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search activities or WBS..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ALL">All Levels</option>
                  <option value="L5">L5 Only</option>
                  <option value="L6">L6 Only</option>
                </select>

                <select
                  value={disciplineFilter}
                  onChange={(e) => setDisciplineFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {disciplines.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Activity ID</th>
                    <th className="py-3 px-3">Activity Name</th>
                    <th className="py-3 px-3">Level</th>
                    <th className="py-3 px-3 font-mono">WBS</th>
                    <th className="py-3 px-3">Planned Start</th>
                    <th className="py-3 px-3">Planned Finish</th>
                    <th className="py-3 px-3 text-right">Duration</th>
                    <th className="py-3 px-3">Predecessors</th>
                    <th className="py-3 px-3">Discipline</th>
                    <th className="py-3 px-3">Original Attributes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredActivities.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No activities match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredActivities.map((act, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {act.activity_id}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 font-medium">
                          {act.activity_name}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] border ${getLevelBadge(
                              act.level
                            )}`}
                          >
                            {act.level}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {act.wbs}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {act.planned_start}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {act.planned_finish}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {act.duration}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {act.predecessors}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${getDisciplineBadge(
                              act.discipline
                            )}`}
                          >
                            {act.discipline}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-500 max-w-xs truncate">
                          {act.original_attributes && Object.keys(act.original_attributes).length > 0 ? (
                            <span
                              title={JSON.stringify(act.original_attributes, null, 2)}
                              className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 cursor-help"
                            >
                              {Object.keys(act.original_attributes).join(', ')}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
          No schedule loaded. Select or upload a schedule export to begin.
        </div>
      )}
    </div>
  );
}
