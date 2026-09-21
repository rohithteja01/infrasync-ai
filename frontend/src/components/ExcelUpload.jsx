import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, Eye, Table } from 'lucide-react';
import ExcelViewer from './ExcelViewer';
import { authFetch } from '../lib/apiClient';

function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function ExcelUpload({ onUploadSuccess, onResultUpdate, projectContext } = {}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  
  // Feature 2.2: Excel Reading / Parsing State
  const [parsedData, setParsedData] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(null);

  const fileInputRef = useRef(null);

  const handleFileValidation = (file) => {
    setErrorMessage(null);
    setUploadResult(null);
    setParsedData(null);
    setParseError(null);

    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
      setErrorMessage(`Invalid file format "${file.name}". Please select a valid Excel spreadsheet (.xlsx or .xls).`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileValidation(e.target.files[0]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileValidation(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select an Excel file first.');
      return;
    }

    setUploading(true);
    setErrorMessage(null);
    setUploadResult(null);
    setParsedData(null);
    setParseError(null);

    const formData = new FormData();
    formData.append('files', selectedFile);

    try {
      const response = await authFetch('/api/ingestion/unified-process', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Server returned HTTP ${response.status}`);
      }

      setUploadResult({
        filename: selectedFile.name,
        file_size: selectedFile.size,
        file_type: 'excel',
        stored_location: `backend/storage/${selectedFile.name}`,
        ...data,
      });

      if (onUploadSuccess) onUploadSuccess(data);
      if (onResultUpdate) onResultUpdate(data);

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to upload Excel file.');
    } finally {
      setUploading(false);
    }
  };

  const handleViewData = async (filename) => {
    if (!filename) return;

    setParsing(true);
    setParseError(null);

    try {
      const response = await authFetch(`/api/ingestion/excel/${encodeURIComponent(filename)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Server returned HTTP ${response.status}`);
      }

      setParsedData(data);
    } catch (err) {
      setParseError(err.message || `Failed to read Excel file '${filename}'.`);
      setParsedData(null);
    } finally {
      setParsing(false);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setErrorMessage(null);
    setParsedData(null);
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Box Card */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-md">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Excel Upload & Parsing</h2>
              <p className="text-xs text-slate-500">Feature 2.1 (Upload) & Feature 2.2 (Read & Parse Worksheets)</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">
              GET /api/ingestion/excel/:file
            </span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-brand-500 bg-brand-50/50'
                : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="p-3 bg-white rounded-full border border-slate-200 shadow-sm text-slate-600">
                <UploadCloud className="w-6 h-6 text-brand-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Click to browse or drag and drop your Excel spreadsheet
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Supported formats: <span className="font-semibold text-slate-700">.xlsx</span>, <span className="font-semibold text-slate-700">.xls</span>
                </p>
              </div>
            </div>
          </div>

          {/* Selected File Card */}
          {selectedFile && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between">
              <div className="flex items-center space-x-3 truncate">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <p className="text-sm font-semibold text-slate-900 truncate">{selectedFile.name}</p>
                  <p className="text-xs text-slate-500">{formatBytes(selectedFile.size)}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                  onClick={resetUpload}
                  disabled={uploading}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded bg-white hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="inline-flex items-center space-x-1.5 px-4 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Upload to Backend</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Upload Error Notice */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-3">
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-rose-900">Upload Failed: </span>
                <span className="text-rose-700">{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Upload Success Card with "View Data" Action */}
          {uploadResult && (
            <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-emerald-950">
                    File Uploaded Successfully
                  </h3>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleViewData(uploadResult.filename)}
                    disabled={parsing}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md shadow-xs transition-colors disabled:opacity-50"
                  >
                    {parsing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Reading Excel...</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Data</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={resetUpload}
                    className="text-xs font-medium text-emerald-800 hover:text-emerald-950 underline"
                  >
                    Upload Another
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-md border border-emerald-100">
                <div>
                  <span className="text-xs text-slate-500 font-medium">Filename</span>
                  <p className="text-sm font-mono font-semibold text-slate-800 truncate" title={uploadResult.filename}>
                    {uploadResult.filename}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-medium">File Size</span>
                  <p className="text-sm font-semibold text-slate-800">
                    {formatBytes(uploadResult.file_size)}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-medium">File Type</span>
                  <p className="text-sm font-semibold text-slate-800 uppercase">
                    {uploadResult.file_type}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-medium">Local Storage Path</span>
                  <p className="text-xs font-mono font-semibold text-slate-800 truncate" title={uploadResult.stored_location}>
                    {uploadResult.stored_location}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Parse Error Notice */}
      {parseError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-3">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <span className="font-semibold text-rose-900">Parsing Error: </span>
            <span className="text-rose-700">{parseError}</span>
          </div>
        </div>
      )}

      {/* Feature 2.2 Extracted Data Table Display */}
      {parsedData && (
        <ExcelViewer
          data={parsedData}
          onClose={() => setParsedData(null)}
        />
      )}
    </div>
  );
}
