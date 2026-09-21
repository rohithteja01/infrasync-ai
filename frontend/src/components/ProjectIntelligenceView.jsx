import React, { useState, useRef, useEffect } from 'react';
import { authFetch } from '../lib/apiClient';
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  CalendarRange,
  Image,
  Mic,
  CheckCircle2,
  AlertCircle,
  Clock,
  Briefcase,
  Layers,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  RefreshCw,
  X,
  FileCheck,
  ChevronRight,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Download,
  Cloud,
  Database
} from 'lucide-react';

const PROCESSING_STEPS = [
  { id: 'uploading', label: 'Uploading' },
  { id: 'extracting', label: 'Extracting' },
  { id: 'identifying', label: 'Identifying Activities' },
  { id: 'matching', label: 'Matching Schedule' },
  { id: 'validating', label: 'Validating' },
  { id: 'progress', label: 'Analyzing Progress' },
  { id: 'delays', label: 'Checking Delays' },
  { id: 'complete', label: 'Complete' }
];

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    if (filename.toLowerCase().includes('schedule') || filename.toLowerCase().includes('p6') || filename.toLowerCase().includes('msp')) {
      return <CalendarRange className="w-4 h-4 text-purple-600" />;
    }
    return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
  }
  if (['pdf', 'docx', 'txt'].includes(ext)) {
    return <FileText className="w-4 h-4 text-blue-600" />;
  }
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return <Image className="w-4 h-4 text-amber-600" />;
  }
  if (['wav', 'mp3', 'm4a', 'webm', 'ogg'].includes(ext)) {
    return <Mic className="w-4 h-4 text-teal-600" />;
  }
  return <FileText className="w-4 h-4 text-slate-500" />;
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

function getStatusBadge(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('complete') || s.includes('done')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (s.includes('delay') || s.includes('behind') || s.includes('critical')) {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  if (s.includes('progress') || s.includes('executing') || s.includes('active')) {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export default function ProjectIntelligenceView({
  onOpenAdvancedPipeline,
  onOpenInfrasyncAI,
  externalResult = null,
  onResultUpdate,
  onClearProject
}) {
  // Mode: 'EMPTY' | 'UPLOADING' | 'RESULTS'
  const [viewState, setViewState] = useState(externalResult ? 'RESULTS' : 'EMPTY');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [intelligenceResult, setIntelligenceResult] = useState(externalResult);
  const [processingError, setProcessingError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [currentSection, setCurrentSection] = useState(externalResult ? 'progress-delay-risk' : 'report-voice');

  // Supabase Storage & PostgreSQL Persistent Files
  const [persistentFiles, setPersistentFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [actionFileId, setActionFileId] = useState(null);

  const fileInputRef = useRef(null);

  const fetchPersistentFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await authFetch('/api/files');
      if (res.ok) {
        const data = await res.json();
        setPersistentFiles(data.files || []);
      }
    } catch (err) {
      console.error('Error fetching persistent files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchPersistentFiles();
  }, []);

  // Synchronize when externalResult changes from parent
  useEffect(() => {
    if (externalResult) {
      setIntelligenceResult(externalResult);
      setViewState('RESULTS');
    } else if (externalResult === null) {
      setIntelligenceResult(null);
      setViewState('EMPTY');
      setCurrentSection('report-voice');
    }
  }, [externalResult]);

  const handleFilesSelected = (files) => {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (indexToRemove) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  // Switch / Activate persistent project file
  const handleSelectPersistentFile = async (file) => {
    setActionFileId(file.id);
    setProcessingError(null);
    try {
      const res = await authFetch(`/api/files/${file.id}/activate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to activate selected file.');
      if (data.projectContext) {
        setIntelligenceResult(data.projectContext);
        if (onResultUpdate) onResultUpdate(data.projectContext);
        setViewState('RESULTS');
      }
      fetchPersistentFiles();
    } catch (err) {
      console.error('Error activating file:', err);
      setProcessingError(err.message || 'Failed to switch to selected project file.');
    } finally {
      setActionFileId(null);
    }
  };

  // Download persistent file from Supabase Storage
  const handleDownloadPersistentFile = (file) => {
    const downloadUrl = `/api/files/${file.id}/download`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', file.original_filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delete persistent file from Supabase Storage & PostgreSQL
  const handleDeletePersistentFile = async (file) => {
    if (!window.confirm(`Are you sure you want to permanently delete '${file.original_filename}' from cloud storage and database?`)) {
      return;
    }
    setActionFileId(file.id);
    try {
      const res = await authFetch(`/api/files/${file.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to delete file.');

      if (file.is_active) {
        const activeRes = await authFetch('/api/files/active');
        if (activeRes.ok) {
          const activeData = await activeRes.json();
          if (activeData.active && activeData.projectContext) {
            setIntelligenceResult(activeData.projectContext);
            if (onResultUpdate) onResultUpdate(activeData.projectContext);
          } else {
            handleRemoveFileSession();
          }
        } else {
          handleRemoveFileSession();
        }
      }
      fetchPersistentFiles();
    } catch (err) {
      console.error('Error deleting file:', err);
      alert('Delete failed: ' + err.message);
    } finally {
      setActionFileId(null);
    }
  };

  const handleStartProcessing = async () => {
    if (selectedFiles.length === 0) return;

    setViewState('UPLOADING');
    setCurrentStepIndex(0);
    setProcessingError(null);

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      setCurrentStepIndex(0);

      const stepInterval = setInterval(() => {
        setCurrentStepIndex((prev) => (prev < 6 ? prev + 1 : prev));
      }, 500);

      const response = await authFetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(stepInterval);

      const data = await response.json();

      if (!response.ok) {
        const errMsg = data.detail || 'Cloud upload failed. The file was not processed as a persistent project file.';
        throw new Error(errMsg);
      }

      setCurrentStepIndex(6);
      await new Promise((r) => setTimeout(r, 400));

      setCurrentStepIndex(7);
      await new Promise((r) => setTimeout(r, 300));

      const context = data.projectContext || data;
      setIntelligenceResult(context);
      if (onResultUpdate) onResultUpdate(context);
      setViewState('RESULTS');
      fetchPersistentFiles();
    } catch (err) {
      console.error('Processing error:', err);
      const errMsg = err.message || 'Cloud upload failed. The file was not processed as a persistent project file.';
      setProcessingError(errMsg);
      setIntelligenceResult(null);
      if (onClearProject) {
        onClearProject();
      } else if (onResultUpdate) {
        onResultUpdate(null);
      }
      setViewState('EMPTY');
      fetchPersistentFiles();
    }
  };

  const handleRemoveFileSession = () => {
    setIntelligenceResult(null);
    setSelectedFiles([]);
    setProcessingError(null);
    setCurrentStepIndex(0);
    setCurrentSection('report-voice');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onClearProject) {
      onClearProject();
    } else if (onResultUpdate) {
      onResultUpdate(null);
    }
    setViewState('EMPTY');
  };

  const handleUploadMoreData = () => {
    setViewState('EMPTY');
    setCurrentSection('report-voice');
  };

  const handleReset = () => {
    handleRemoveFileSession();
  };

  const renderProjectFilesCard = () => {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded bg-brand-50 text-brand-700 border border-brand-200">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">Project Files</h3>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-mono font-medium">
                  Supabase Cloud Storage & PostgreSQL
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Previously uploaded project documents with persistent cloud storage. Open, download, or switch active projects.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchPersistentFiles}
            disabled={loadingFiles}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors self-start sm:self-auto cursor-pointer"
            title="Refresh persistent files"
          >
            <RefreshCw className={`w-3 h-3 ${loadingFiles ? 'animate-spin text-brand-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="mt-4">
          {persistentFiles.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 bg-slate-50/50 rounded border border-dashed border-slate-200">
              No files in cloud storage yet. Upload a project file above to enable persistent storage.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-3">File Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Uploaded</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {persistentFiles.map((file) => {
                    const isCurrentActive = file.is_active;
                    const dateStr = file.uploaded_at
                      ? new Date(file.uploaded_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : '—';

                    return (
                      <tr
                        key={file.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isCurrentActive ? 'bg-brand-50/20 font-medium' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            {getFileIcon(file.original_filename)}
                            <span className="truncate max-w-xs text-slate-900" title={file.original_filename}>
                              {file.original_filename}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              ({formatBytes(file.file_size)})
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="capitalize px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {file.file_type || 'project_file'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {dateStr}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {isCurrentActive ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              Processed
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center space-x-1.5">
                            {isCurrentActive ? (
                              <span className="text-[11px] text-emerald-700 font-semibold px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                                Current Active
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSelectPersistentFile(file)}
                                disabled={actionFileId === file.id}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 transition-colors cursor-pointer"
                                title="Open this file and restore its project intelligence analysis"
                              >
                                {actionFileId === file.id ? 'Loading...' : 'Open / Select'}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDownloadPersistentFile(file)}
                              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="Download file from Supabase Storage"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeletePersistentFile(file)}
                              disabled={actionFileId === file.id}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Delete from Supabase Storage and PostgreSQL"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const activitiesList = Array.isArray(intelligenceResult?.activities)
    ? intelligenceResult.activities
    : Array.isArray(intelligenceResult?.master_activities)
    ? intelligenceResult.master_activities
    : Array.isArray(intelligenceResult?.data?.activities)
    ? intelligenceResult.data.activities
    : [];

  const avgProgress = activitiesList.length > 0
    ? activitiesList.reduce((acc, a) => acc + Number(a.progress ?? a.actual_progress ?? 0), 0) / activitiesList.length
    : 0;

  const delayedCount = activitiesList.filter((a) => {
    const s = String(a.status || a.delay_status || '').toLowerCase();
    return s.includes('delay') || s.includes('behind') || s.includes('critical');
  }).length;

  const avgConfidence = activitiesList.length > 0
    ? (activitiesList.reduce((acc, a) => acc + Number(a.confidence_score ?? 0.9), 0) / activitiesList.length) * 100
    : 92;

  return (
    <div className="space-y-6">
      {/* =========================================================================
          VIEW STATE 1: EMPTY / UPLOAD SCREEN
         ========================================================================= */}
      {viewState === 'EMPTY' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm text-center max-w-4xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center mx-auto mb-4 shadow-2xs">
              <Briefcase className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Start a Project Intelligence Analysis
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-xl mx-auto leading-relaxed">
              Upload project reports, schedules, spreadsheets, documents, site diaries, photos, or voice updates to begin.
            </p>

            {processingError && (
              <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 max-w-lg mx-auto flex items-start space-x-2 text-left">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                <span>{processingError}</span>
              </div>
            )}

            {/* Drag and Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-6 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-150 ${
                dragOver
                  ? 'border-brand-500 bg-brand-50/50'
                  : 'border-slate-300 hover:border-brand-400 bg-slate-50/60 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp,.wav,.mp3,.m4a,.webm"
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
              />

              <div className="flex flex-col items-center">
                <div className="p-3 bg-white rounded-full shadow-xs border border-slate-200 text-brand-600 mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold text-slate-800">
                  Click to select files or drag and drop here
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Supports Schedules, Daily Reports, Spreadsheets, Documents, Site Diaries, Photos, and Audio
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11px] text-slate-500">
                  <span className="bg-slate-200/80 px-2 py-0.5 rounded border border-slate-300">PDF</span>
                  <span className="bg-slate-200/80 px-2 py-0.5 rounded border border-slate-300">DOCX</span>
                  <span className="bg-slate-200/80 px-2 py-0.5 rounded border border-slate-300">TXT</span>
                  <span className="bg-slate-200/80 px-2 py-0.5 rounded border border-slate-300">XLSX</span>
                  <span className="bg-slate-200/80 px-2 py-0.5 rounded border border-slate-300">CSV</span>
                  <span className="bg-slate-200/80 px-2 py-0.5 rounded border border-slate-300">Images (JPG/PNG)</span>
                  <span className="bg-slate-200/80 px-2 py-0.5 rounded border border-slate-300">Voice Audio</span>
                </div>
              </div>
            </div>

            {/* Selected Files Queue */}
            {selectedFiles.length > 0 && (
              <div className="mt-6 text-left border border-slate-200 rounded-lg p-4 bg-white shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-slate-800">
                      Selected Files ({selectedFiles.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFiles([])}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Clear All
                  </button>
                </div>

                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto mt-2">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2.5 min-w-0 pr-3">
                        {getFileIcon(file.name)}
                        <span className="font-medium text-slate-800 truncate">{file.name}</span>
                        <span className="text-slate-400 font-mono text-[11px]">({formatBytes(file.size)})</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemoveFile(idx); }}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded"
                        title="Remove file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Submit button */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={handleStartProcessing}
                    className="inline-flex items-center space-x-2 px-5 py-2 text-xs font-semibold rounded-md bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Run Project Intelligence</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Persistent Project Files in Supabase Storage & PostgreSQL */}
          <div className="max-w-4xl mx-auto">
            {renderProjectFilesCard()}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW STATE 2: CLEAN PROCESSING STATUS FLOW
         ========================================================================= */}
      {viewState === 'UPLOADING' && (
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-lg p-8 shadow-sm text-center space-y-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="w-6 h-6 text-brand-600 animate-spin" />
            <h3 className="text-lg font-bold text-slate-900">Processing Project Intelligence</h3>
          </div>
          <p className="text-xs text-slate-500">
            Analyzing uploaded project data, matching execution activities against schedule, and evaluating delay risks.
          </p>

          {/* Sequential Step Indicator */}
          <div className="py-4 space-y-3">
            {PROCESSING_STEPS.map((step, idx) => {
              const isPast = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div
                  key={step.id}
                  className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-xs transition-colors ${
                    isPast
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                      : isCurrent
                      ? 'bg-brand-50 border-brand-200 text-brand-800 font-semibold shadow-2xs'
                      : 'bg-slate-50/40 border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] border">
                      {isPast ? '✓' : idx + 1}
                    </span>
                    <span>{step.label}</span>
                  </div>

                  <div>
                    {isPast && <span className="text-[11px] font-medium text-emerald-600">Done</span>}
                    {isCurrent && (
                      <span className="flex items-center space-x-1.5 text-[11px] text-brand-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-ping" />
                        <span>In Progress...</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW STATE 3: EXECUTIVE RESULT SCREEN
         ========================================================================= */}
      {viewState === 'RESULTS' && intelligenceResult && (
        <div className="space-y-6">
          {/* Top Header & Action Controls */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Project Intelligence Analysis Complete</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">Project Execution & Delay Intelligence</h2>
              <p className="text-xs text-slate-500 mt-1">
                Synthesized intelligence across {intelligenceResult.files_processed?.length || 1} project file(s)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={handleRemoveFileSession}
                className="infrasync-remove-file-btn inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 hover:text-rose-800 bg-white hover:bg-rose-50 border border-rose-200 hover:border-rose-300 rounded transition-colors cursor-pointer shadow-2xs"
                title="Remove current project session from view"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Remove File</span>
              </button>

              <button
                type="button"
                onClick={handleUploadMoreData}
                className="infrasync-upload-more-btn inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded transition-colors cursor-pointer shadow-2xs"
                title="Add more project documents to analyze"
              >
                <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
                <span>Upload More Data</span>
              </button>

              {onOpenAdvancedPipeline && (
                <button
                  type="button"
                  onClick={onOpenAdvancedPipeline}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded transition-colors cursor-pointer shadow-2xs"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Open Workflow Pipeline →</span>
                </button>
              )}
            </div>
          </div>

          {/* Workflow Pipeline Action Callout */}
          <div className="bg-white border border-brand-200 rounded-lg p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  OIL AI 9-Stage Workflow Pipeline Available
                </h3>
              </div>
              <p className="text-xs text-slate-600 max-w-2xl">
                Inspect full planning-to-execution pipeline across Report / Voice, AI Extraction, Activity Linking, Confidence & Evidence, Human Review, Schedule Update, Progress / Delay / Risk, Action / What-if, and Institutional Memory.
              </p>
            </div>
            {onOpenAdvancedPipeline && (
              <button
                type="button"
                onClick={onOpenAdvancedPipeline}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer flex-shrink-0"
              >
                <span>Go to Workflow Pipeline</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Executive Overview KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Activities Ingested</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {activitiesList.length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Across all disciplines</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Avg Progress</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {avgProgress.toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Physical completion</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Delayed / At Risk</div>
              <div className="text-2xl font-bold text-rose-600 mt-1">
                {delayedCount}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Activities flagged</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Avg Confidence</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {avgConfidence.toFixed(0)}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Linking validation score</div>
            </div>
          </div>

          {/* Activity Snapshot Table */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Project Activity Master Snapshot</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  High-level activity execution summary. Open Workflow Pipeline for L5/L6 linking, delay modeling, and what-if simulation.
                </p>
              </div>
              {onOpenAdvancedPipeline && (
                <button
                  type="button"
                  onClick={onOpenAdvancedPipeline}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 cursor-pointer hidden sm:inline"
                >
                  Inspect in Workflow Pipeline →
                </button>
              )}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Activity ID</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Discipline</th>
                    <th className="py-2.5 px-3">Progress</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activitiesList.slice(0, 10).map((act, idx) => {
                    const progressVal = Number(act.progress ?? act.actual_progress ?? 0);
                    const confVal = Math.round(Number(act.confidence_score ?? 0.9) * 100);
                    return (
                      <tr key={act.activity_id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                          {act.activity_id || `ACT-${idx + 1}`}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 max-w-xs truncate" title={act.activity_name || act.name || act.work_description}>
                          {act.activity_name || act.name || act.work_description || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getDisciplineBadge(act.discipline)}`}>
                            {act.discipline || 'General'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium">
                          {progressVal.toFixed(0)}%
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusBadge(act.status || act.delay_status)}`}>
                            {act.status || act.delay_status || 'Active'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                          {confVal}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {Math.min(10, activitiesList.length)} of {activitiesList.length} activities</span>
              {onOpenAdvancedPipeline && (
                <button
                  type="button"
                  onClick={onOpenAdvancedPipeline}
                  className="font-semibold text-brand-600 hover:text-brand-700 cursor-pointer"
                >
                  View full linking & delay details in Workflow Pipeline →
                </button>
              )}
            </div>
          </div>

          {/* Persistent Project Files in Supabase Storage & PostgreSQL */}
          {renderProjectFilesCard()}
        </div>
      )}
    </div>
  );
}
