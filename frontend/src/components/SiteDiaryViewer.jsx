import React, { useState, useEffect, useCallback, useRef } from 'react';
import { authFetch } from '../lib/apiClient';
import {
  BookOpen,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  MapPin,
  HardHat,
  CloudSun,
  Clock,
  Briefcase,
  Activity,
  ArrowRight,
  ShieldCheck,
  Search,
  Filter,
  Layers,
  FileCheck,
  ChevronDown,
  AlertTriangle,
  ClipboardList
} from 'lucide-react';

function getStatusBadge(status) {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'completed' || s === 'complete' || s === 'done') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (s === 'in progress' || s === 'in-progress' || s === 'ongoing' || s === 'executing') {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
  if (s === 'delayed' || s === 'behind' || s === 'critical') {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
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

export default function SiteDiaryViewer() {
  const [diariesList, setDiariesList] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [diaryData, setDiaryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('ALL');

  const fileInputRef = useRef(null);

  // Fetch list of available site diaries
  const fetchDiariesList = useCallback(async () => {
    try {
      const res = await authFetch('/api/ingestion/site-diaries');
      if (res.ok) {
        const data = await res.json();
        setDiariesList(data.files || []);
      }
    } catch (e) {
      console.warn('Failed to list site diaries:', e);
    }
  }, []);

  // Fetch & parse the selected site diary
  const fetchDiaryData = useCallback(async (filename) => {
    if (!filename) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/ingestion/site-diaries/${encodeURIComponent(filename)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `Server returned HTTP ${res.status}`);
      }
      setDiaryData(data);
    } catch (err) {
      setError(err.message || `Failed to read and parse site diary '${filename}'.`);
      setDiaryData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiariesList();
  }, [fetchDiariesList]);

  useEffect(() => {
    if (selectedFile) {
      fetchDiaryData(selectedFile);
    }
  }, [selectedFile, fetchDiaryData]);

  // Handle file upload
  const handleFileUpload = async (file) => {
    if (!file) return;

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.pdf', '.xlsx', '.xls'].includes(ext)) {
      setUploadError(`Unsupported file format '${ext}'. Please upload a .pdf, .xlsx, or .xls Site Diary.`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await authFetch('/api/ingestion/site-diaries/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || `Upload failed with HTTP ${res.status}`);
      }

      setUploadSuccess(`Successfully uploaded ${data.filename} (${(data.file_size / 1024).toFixed(1)} KB)`);
      await fetchDiariesList();
      setSelectedFile(data.filename);
    } catch (err) {
      setUploadError(err.message || 'Error uploading site diary.');
    } finally {
      setIsUploading(false);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const metadata = diaryData?.diary_metadata || diaryData?.report_metadata || {};
  const activities = diaryData?.activities || [];

  // Filter activities
  const filteredActivities = activities.filter((act) => {
    const matchesSearch =
      searchTerm === '' ||
      act.activity_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.activity_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.work_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.remarks?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDiscipline =
      disciplineFilter === 'ALL' ||
      act.discipline?.toLowerCase() === disciplineFilter.toLowerCase();

    return matchesSearch && matchesDiscipline;
  });

  const availableDisciplines = Array.from(
    new Set(activities.map((a) => a.discipline).filter(Boolean))
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200 rounded">
                Feature 2.27
              </span>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-teal-600" />
                Site Diary Ingestion
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Ingest, validate, and parse Clerk of Works & Resident Engineer Site Diaries into standardized Activity Intelligence format.
            </p>
          </div>

          {/* Top Status Indicators */}
          <div className="flex items-center space-x-2 text-xs text-slate-600">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              In-Memory Field Log Parser
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Zero Baseline Mutations
            </span>
          </div>
        </div>

        {/* File Control Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <label htmlFor="site-diary-select" className="text-xs font-medium text-slate-700 whitespace-nowrap">
              Active Site Diary:
            </label>
            <div className="relative">
              <select
                id="site-diary-select"
                value={selectedFile}
                onChange={(e) => setSelectedFile(e.target.value)}
                disabled={loading}
                className="text-xs bg-slate-50 border border-slate-300 rounded-md pl-3 pr-8 py-1.5 font-medium text-slate-800 focus:ring-1 focus:ring-teal-500 focus:border-teal-500 appearance-none cursor-pointer"
              >
                {diariesList.map((f) => (
                  <option key={f.filename} value={f.filename}>
                    {f.filename} ({f.file_type.toUpperCase()} • {(f.file_size / 1024).toFixed(1)} KB)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              onClick={() => fetchDiaryData(selectedFile)}
              disabled={loading}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
              title="Reload diary data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md transition-colors shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5 text-teal-600" />
              <span>{isUploading ? 'Uploading...' : 'Upload Site Diary'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Upload Feedback Messages */}
      {uploadSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
          <button
            onClick={() => setUploadSuccess(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {uploadError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="text-rose-600 hover:text-rose-900 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Drag & Drop Upload Dropzone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragOver
            ? 'border-teal-500 bg-teal-50/50'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-1">
          <Upload className="w-5 h-5 text-slate-400" />
          <p className="text-xs font-medium text-slate-700">
            Drag & drop Site Diary (.pdf, .xlsx, .xls) or click to browse
          </p>
          <p className="text-[11px] text-slate-400">
            Extracts field log metadata, work locations, inspector remarks, and progress records directly into Activity Intelligence
          </p>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-lg shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin text-teal-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Parsing Site Diary stream and extracting inspection activities...</p>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start space-x-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold">Failed to parse Site Diary</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {/* Parsed Diary Content */}
      {diaryData && !loading && (
        <div className="space-y-5">
          {/* Metadata Grid Card */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-slate-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Site Diary Metadata & Field Conditions
                </h3>
              </div>
              <span className="text-xs font-medium text-slate-500">
                Extracted: {diaryData.total_activities} Activities
              </span>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> Diary ID & Date
                </span>
                <p className="text-xs font-bold text-slate-900">{metadata.diary_id || 'N/A'}</p>
                <p className="text-xs text-slate-600">{metadata.diary_date || 'Date Unspecified'}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Briefcase className="w-3 h-3 text-slate-400" /> Project & Site
                </span>
                <p className="text-xs font-bold text-slate-900">{metadata.project_name || 'Project Unspecified'}</p>
                <p className="text-xs text-slate-600 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{metadata.site_location || 'Site Location Unspecified'}</span>
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <ClipboardList className="w-3 h-3 text-slate-400" /> Work Location & Discipline
                </span>
                <p className="text-xs font-bold text-slate-900">{metadata.work_location || 'General Site'}</p>
                <p className="text-xs text-slate-600">{metadata.discipline || 'Multi-Discipline'}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <CloudSun className="w-3 h-3 text-slate-400" /> Weather & Shift
                </span>
                <p className="text-xs font-bold text-slate-900">{metadata.weather || 'Normal Conditions'}</p>
                <p className="text-xs text-slate-600 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  {metadata.shift || 'Day Shift'}
                </p>
              </div>
            </div>

            {/* Contractor & Inspector row */}
            <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
              <div>
                <span className="font-semibold text-slate-700">Contractor:</span> {metadata.contractor || 'EPC Contractor'}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Prepared By:</span> {metadata.prepared_by || 'Resident Engineer'}
              </div>
            </div>

            {/* Remarks & Issues Section */}
            {(metadata.remarks || metadata.issues || metadata.work_summary) && (
              <div className="px-4 py-3 border-t border-slate-100 space-y-2 bg-slate-50/30">
                {metadata.remarks && (
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Field Remarks:
                    </span>
                    <p className="text-xs text-slate-700 mt-0.5 bg-white p-2 rounded border border-slate-200">
                      {metadata.remarks}
                    </p>
                  </div>
                )}
                {metadata.issues && (
                  <div>
                    <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" /> Site Issues Log:
                    </span>
                    <p className="text-xs text-slate-700 mt-0.5 bg-white p-2 rounded border border-slate-200">
                      {metadata.issues}
                    </p>
                  </div>
                )}
                {metadata.work_summary && !metadata.remarks && (
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Work Summary:
                    </span>
                    <p className="text-xs text-slate-700 mt-0.5 bg-white p-2 rounded border border-slate-200">
                      {metadata.work_summary}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Activities Card */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Extracted Progress Activities ({filteredActivities.length} of {activities.length})
                </h3>
              </div>

              {/* Filters */}
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search activities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="text-xs pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-md w-36 sm:w-48 focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                {availableDisciplines.length > 0 && (
                  <select
                    value={disciplineFilter}
                    onChange={(e) => setDisciplineFilter(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="ALL">All Disciplines</option>
                    {availableDisciplines.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Activities Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-4">Activity ID</th>
                    <th className="py-2.5 px-4">Activity Name</th>
                    <th className="py-2.5 px-4">Discipline</th>
                    <th className="py-2.5 px-4 text-right">Planned Qty</th>
                    <th className="py-2.5 px-4 text-right">Actual Qty</th>
                    <th className="py-2.5 px-4">Unit</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Work Scope / Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredActivities.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                        No activities match the specified search or discipline filter.
                      </td>
                    </tr>
                  ) : (
                    filteredActivities.map((act, index) => {
                      const planned = act.planned_quantity;
                      const actual = act.actual_quantity;
                      const pct = planned && actual ? Math.min(100, Math.round((actual / planned) * 100)) : null;

                      return (
                        <tr key={act.activity_id || index} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                            {act.activity_id}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800">
                            {act.activity_name}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium border ${getDisciplineBadge(act.discipline)}`}>
                              {act.discipline || 'General'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600 whitespace-nowrap">
                            {planned !== null && planned !== undefined ? planned.toLocaleString() : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-900 font-semibold whitespace-nowrap">
                            {actual !== null && actual !== undefined ? actual.toLocaleString() : '—'}
                            {pct !== null && (
                              <span className="text-[10px] text-slate-400 font-normal ml-1">
                                ({pct}%)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            {act.unit || 'units'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium border ${getStatusBadge(act.status)}`}>
                              {act.status || 'In Progress'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={act.work_description || act.remarks || act.activity_name}>
                            {act.remarks ? `${act.remarks} — ` : ''}{act.work_description || act.activity_name}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pipeline Integration Banner */}
            <div className="p-3 bg-teal-50/60 border-t border-teal-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-teal-900">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-teal-600 flex-shrink-0" />
                <span>
                  <strong>Standardized Activity Schema:</strong> Ingested site diary records are structured for direct consumption by Exact Matching, Schedule Linking, Critical Path, and the Decision Center.
                </span>
              </div>
              <span className="text-[11px] font-medium text-teal-600 whitespace-nowrap">
                Engine: {diaryData.sheets?.[0]?.engine || 'site_diary_parser'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
