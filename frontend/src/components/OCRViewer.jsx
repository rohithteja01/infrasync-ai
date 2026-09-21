import React, { useState, useEffect, useCallback, useRef } from 'react';
import { authFetch } from '../lib/apiClient';
import {
  Scan,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  MapPin,
  Clock,
  Briefcase,
  Activity,
  ShieldCheck,
  Search,
  ChevronDown,
  AlertTriangle,
  FileCheck,
  Eye,
  Cpu,
  Layers,
  FileText,
  Image as ImageIcon
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

export default function OCRViewer() {
  const [ocrFilesList, setOcrFilesList] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [ocrData, setOcrData] = useState(null);
  const [ocrEngineStatus, setOcrEngineStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showRawText, setShowRawText] = useState(true);

  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Filter state for activities
  const [searchTerm, setSearchTerm] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('ALL');

  const fileInputRef = useRef(null);

  // Fetch OCR engine status
  const fetchEngineStatus = useCallback(async () => {
    try {
      const res = await authFetch('/api/ingestion/ocr/status');
      if (res.ok) {
        const data = await res.json();
        setOcrEngineStatus(data);
      }
    } catch (e) {
      console.warn('Failed to fetch OCR engine status:', e);
    }
  }, []);

  // Fetch list of available OCR files
  const fetchOcrFilesList = useCallback(async () => {
    try {
      const res = await authFetch('/api/ingestion/ocr/files');
      if (res.ok) {
        const data = await res.json();
        setOcrFilesList(data.files || []);
      }
    } catch (e) {
      console.warn('Failed to list OCR files:', e);
    }
  }, []);

  // Fetch & run OCR on the selected file
  const fetchOcrData = useCallback(async (filename) => {
    if (!filename) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/ingestion/ocr/${encodeURIComponent(filename)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `Server returned HTTP ${res.status}`);
      }
      setOcrData(data);
    } catch (err) {
      setError(err.message || `Failed to process OCR on file '${filename}'.`);
      setOcrData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEngineStatus();
    fetchOcrFilesList();
  }, [fetchEngineStatus, fetchOcrFilesList]);

  useEffect(() => {
    if (selectedFile) {
      fetchOcrData(selectedFile);
    }
  }, [selectedFile, fetchOcrData]);

  // Handle file upload
  const handleFileUpload = async (file) => {
    if (!file) return;

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.pdf', '.png', '.jpg', '.jpeg'].includes(ext)) {
      setUploadError(`Unsupported file format '${ext}'. Please upload a scanned PDF or image (.pdf, .png, .jpg, .jpeg).`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await authFetch('/api/ingestion/ocr/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || `Upload failed with HTTP ${res.status}`);
      }

      setUploadSuccess(`Uploaded ${data.filename} (${(data.file_size / 1024).toFixed(1)} KB) and executed local OCR`);
      await fetchOcrFilesList();
      setSelectedFile(data.filename);
    } catch (err) {
      setUploadError(err.message || 'Error uploading file for OCR.');
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

  const ocrResult = ocrData?.ocr || {};
  const metadata = ocrData?.document_metadata || {};
  const activities = ocrData?.activities || [];

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
              <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-violet-50 text-violet-700 border border-violet-200 rounded">
                Feature 2.29
              </span>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Scan className="w-5 h-5 text-violet-600" />
                Optical Character Recognition (OCR)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Pure-local OCR processing for scanned PDF documents and field images (.pdf, .png, .jpg, .jpeg) using Tesseract OCR.
            </p>
          </div>

          {/* Engine Status Badge */}
          <div className="flex items-center space-x-2 text-xs">
            {ocrEngineStatus?.ocr_available ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                OCR Operational ({ocrEngineStatus.engine?.split(' ')[0] || 'Tesseract'})
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                OCR Engine Offline
              </span>
            )}
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-slate-400" />
              100% Local (Zero Cloud)
            </span>
          </div>
        </div>

        {/* File Control Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <label htmlFor="ocr-file-select" className="text-xs font-medium text-slate-700 whitespace-nowrap">
              Active Scanned Source:
            </label>
            <div className="relative">
              <select
                id="ocr-file-select"
                value={selectedFile}
                onChange={(e) => setSelectedFile(e.target.value)}
                disabled={loading}
                className="text-xs bg-slate-50 border border-slate-300 rounded-md pl-3 pr-8 py-1.5 font-medium text-slate-800 focus:ring-1 focus:ring-violet-500 focus:border-violet-500 appearance-none cursor-pointer"
              >
                {ocrFilesList.map((f) => (
                  <option key={f.filename} value={f.filename}>
                    {f.filename} ({f.file_type.toUpperCase()} • {(f.file_size / 1024).toFixed(1)} KB)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              onClick={() => fetchOcrData(selectedFile)}
              disabled={loading}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
              title="Rerun OCR on selected file"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-md transition-colors shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5 text-violet-600" />
              <span>{isUploading ? 'Processing...' : 'Upload Scanned File'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
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
            ? 'border-violet-500 bg-violet-50/50'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-1">
          <Upload className="w-5 h-5 text-slate-400" />
          <p className="text-xs font-medium text-slate-700">
            Drag & drop Scanned Document (.pdf) or Image (.png, .jpg, .jpeg) for local OCR
          </p>
          <p className="text-[11px] text-slate-400">
            Converts raster pages to high-resolution bitmaps and extracts machine-readable engineering progress text locally
          </p>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-lg shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin text-violet-600 mx-auto mb-2" />
          <p className="text-xs text-slate-600 font-medium">Running local Tesseract OCR engine on raster stream...</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Extracting character glyphs, layout blocks, and engineering activities</p>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start space-x-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold">OCR Processing Error</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {/* OCR Result & Metadata Card */}
      {ocrData && !loading && (
        <div className="space-y-5">
          {/* Engine Execution Metrics Card */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-violet-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  OCR Engine Execution Metrics
                </h3>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                ocrResult.ocr_status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {ocrResult.ocr_status === 'SUCCESS' ? 'OCR Complete' : ocrResult.ocr_status}
              </span>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3 h-3 text-slate-400" /> Source File
                </span>
                <p className="text-xs font-bold text-slate-900 truncate" title={ocrResult.source_file}>
                  {ocrResult.source_file || selectedFile}
                </p>
                <p className="text-xs text-slate-600">
                  {ocrResult.page_count} Page(s) Processed
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-slate-400" /> Engine & Path
                </span>
                <p className="text-xs font-bold text-slate-900 truncate" title={ocrResult.engine}>
                  {ocrResult.engine || 'Tesseract OCR'}
                </p>
                <p className="text-[11px] text-slate-500 truncate" title={ocrEngineStatus?.tesseract_path}>
                  {ocrEngineStatus?.tesseract_path || 'Local Executable'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Eye className="w-3 h-3 text-slate-400" /> Extracted Text
                </span>
                <p className="text-xs font-bold text-slate-900">
                  {ocrResult.text_length?.toLocaleString() || 0} Characters
                </p>
                <p className="text-xs text-slate-600">
                  {ocrResult.text_extracted ? 'Text Detected & Parsed' : 'No Text Found'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Activity className="w-3 h-3 text-slate-400" /> Activity Intelligence
                </span>
                <p className="text-xs font-bold text-slate-900">
                  {ocrData.total_activities || 0} Activities Extracted
                </p>
                <p className="text-xs text-slate-600">
                  Standardized Schema Ingested
                </p>
              </div>
            </div>

            {/* Notice Footer */}
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="truncate">{ocrData.notice || ocrResult.notice}</span>
              <button
                onClick={() => setShowRawText(!showRawText)}
                className="text-xs font-medium text-violet-600 hover:text-violet-800 ml-2 whitespace-nowrap"
              >
                {showRawText ? 'Hide Raw OCR Text' : 'View Raw OCR Text'}
              </button>
            </div>

            {/* Collapsible Raw OCR Text Viewer */}
            {showRawText && ocrResult.text && (
              <div className="p-4 border-t border-slate-200 bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed max-h-72 overflow-y-auto">
                <div className="flex items-center justify-between text-slate-400 mb-2 font-sans font-semibold uppercase tracking-wider text-[10px]">
                  <span>Raw Recognized OCR Stream</span>
                  <span>{ocrResult.text_length} chars</span>
                </div>
                <pre className="whitespace-pre-wrap">{ocrResult.text}</pre>
              </div>
            )}
          </div>

          {/* Extracted Activities Card (Passed into Activity Intelligence) */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-violet-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  OCR-Ingested Progress Activities ({filteredActivities.length} of {activities.length})
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
                    className="text-xs pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-md w-36 sm:w-48 focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
                  />
                </div>

                {availableDisciplines.length > 0 && (
                  <select
                    value={disciplineFilter}
                    onChange={(e) => setDisciplineFilter(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:ring-1 focus:ring-violet-500"
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
                        No activities recognized or matching filter.
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
            <div className="p-3 bg-violet-50/60 border-t border-violet-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-violet-900">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-violet-600 flex-shrink-0" />
                <span>
                  <strong>Standardized Activity Schema:</strong> OCR text is structured into canonical Activity Intelligence records, enabling downstream Exact Matching, Schedule Linking, Critical Path, and Decision Center.
                </span>
              </div>
              <span className="text-[11px] font-medium text-violet-600 whitespace-nowrap">
                Engine: {ocrResult.engine || 'Tesseract OCR'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
