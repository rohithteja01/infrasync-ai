import React, { useState } from 'react';
import { Table, Layers, FileSpreadsheet, X, CheckCheck, RefreshCw, AlertCircle, Sparkles, Bot } from 'lucide-react';
import NormalizedActivityViewer from './NormalizedActivityViewer';
import AIExtractedActivityViewer from './AIExtractedActivityViewer';

export default function ExcelViewer({ data, onClose }) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [viewMode, setViewMode] = useState('raw'); // 'raw' | 'normalized' | 'ai'
  
  // Feature 2.3: Normalization State
  const [normalizedData, setNormalizedData] = useState(null);
  const [normalizing, setNormalizing] = useState(false);
  const [normalizeError, setNormalizeError] = useState(null);

  // Feature 2.4: AI Extraction State
  const [aiData, setAiData] = useState(null);
  const [extractingAI, setExtractingAI] = useState(false);
  const [aiError, setAiError] = useState(null);

  if (!data || !data.sheets || data.sheets.length === 0) {
    return (
      <div className="p-6 bg-white border border-slate-200 rounded-lg text-center text-slate-500 text-sm">
        No worksheet data available to display.
      </div>
    );
  }

  const handleNormalize = async () => {
    if (normalizedData) {
      setViewMode('normalized');
      return;
    }

    setNormalizing(true);
    setNormalizeError(null);

    try {
      const response = await fetch(`/api/ingestion/excel/${encodeURIComponent(data.filename)}/normalize`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || `Server returned HTTP ${response.status}`);
      }

      setNormalizedData(result);
      setViewMode('normalized');
    } catch (err) {
      setNormalizeError(err.message || 'Failed to normalize activity data.');
    } finally {
      setNormalizing(false);
    }
  };

  const handleAIExtract = async () => {
    if (aiData) {
      setViewMode('ai');
      return;
    }

    setExtractingAI(true);
    setAiError(null);

    try {
      const response = await fetch(`/api/ingestion/excel/${encodeURIComponent(data.filename)}/ai-extract`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || `Server returned HTTP ${response.status}`);
      }

      setAiData(result);
      setViewMode('ai');
    } catch (err) {
      setAiError(err.message || 'Failed to extract activities with AI.');
    } finally {
      setExtractingAI(false);
    }
  };

  // Render AI Extracted Activities View
  if (viewMode === 'ai' && aiData) {
    return (
      <div className="space-y-4">
        {aiError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-3 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
            <span>{aiError}</span>
          </div>
        )}
        <AIExtractedActivityViewer
          aiData={aiData}
          onBackToNormalized={normalizedData ? () => setViewMode('normalized') : null}
          onBackToRaw={() => setViewMode('raw')}
        />
      </div>
    );
  }

  // Render Normalized Activities View
  if (viewMode === 'normalized' && normalizedData) {
    return (
      <div className="space-y-4">
        {normalizeError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-3 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
            <span>{normalizeError}</span>
          </div>
        )}
        <NormalizedActivityViewer
          normalizedData={normalizedData}
          onBackToRaw={() => setViewMode('raw')}
          onAIExtractSuccess={(extractedResult) => {
            setAiData(extractedResult);
            setViewMode('ai');
          }}
        />
      </div>
    );
  }

  const currentSheet = data.sheets[activeSheetIndex] || data.sheets[0];
  const hasRows = currentSheet && currentSheet.rows && currentSheet.rows.length > 0;
  const hasColumns = currentSheet && currentSheet.columns && currentSheet.columns.length > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-100 text-emerald-800 rounded-md">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-semibold text-slate-900">{data.filename}</h3>
              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-medium">
                Parsed Successfully
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {data.sheet_count} Worksheet{data.sheet_count > 1 ? 's' : ''} • {currentSheet?.row_count || 0} Rows • {currentSheet?.column_count || 0} Columns
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Feature 2.4: AI Extract Activities Action Button */}
          <button
            onClick={handleAIExtract}
            disabled={extractingAI}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs transition-colors disabled:opacity-50"
          >
            {extractingAI ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>AI Extracting...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Extract Activities</span>
              </>
            )}
          </button>

          {/* Feature 2.3: Normalize Data Action Button */}
          <button
            onClick={handleNormalize}
            disabled={normalizing}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition-colors disabled:opacity-50"
          >
            {normalizing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Normalizing...</span>
              </>
            ) : (
              <>
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Normalize Data</span>
              </>
            )}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-md transition-colors"
              title="Close viewer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error Notices */}
      {aiError && (
        <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-start space-x-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <span>{aiError}</span>
        </div>
      )}

      {normalizeError && (
        <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-start space-x-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <span>{normalizeError}</span>
        </div>
      )}

      {/* Sheet Tabs */}
      <div className="px-6 pt-3 bg-slate-100/60 border-b border-slate-200 flex items-center space-x-2 overflow-x-auto">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-2 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          Sheets:
        </span>
        {data.sheets.map((sheet, idx) => {
          const isActive = idx === activeSheetIndex;
          return (
            <button
              key={sheet.name || idx}
              onClick={() => setActiveSheetIndex(idx)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors border-t border-l border-r whitespace-nowrap ${
                isActive
                  ? 'bg-white text-slate-900 border-slate-300 font-semibold shadow-xs -mb-px'
                  : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <span>{sheet.name}</span>
              <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                {sheet.row_count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table Content */}
      <div className="p-6">
        {hasRows && hasColumns ? (
          <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100/90 text-slate-800 font-semibold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 w-12 text-center text-slate-400 font-mono text-[11px] border-r border-slate-200 bg-slate-100">
                      #
                    </th>
                    {currentSheet.columns.map((col, cIdx) => (
                      <th
                        key={cIdx}
                        className="px-4 py-2.5 font-semibold text-slate-900 whitespace-nowrap border-r border-slate-200 last:border-r-0"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {currentSheet.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-3 py-2 text-center font-mono text-[11px] text-slate-400 bg-slate-50/50 border-r border-slate-200">
                        {rIdx + 1}
                      </td>
                      {currentSheet.columns.map((col, cIdx) => {
                        const val = row[col];
                        return (
                          <td
                            key={cIdx}
                            className="px-4 py-2 whitespace-nowrap border-r border-slate-100 last:border-r-0 font-medium text-slate-800"
                          >
                            {val !== null && val !== undefined && val !== '' ? (
                              String(val)
                            ) : (
                              <span className="text-slate-300 italic">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>Showing {currentSheet.row_count} rows in <strong>{currentSheet.name}</strong></span>
              <span className="font-mono text-[11px] text-slate-400">{currentSheet.column_count} columns detected</span>
            </div>
          </div>
        ) : (
          <div className="p-8 border border-dashed border-slate-300 rounded-lg text-center text-slate-500 text-xs bg-slate-50/50">
            Worksheet &quot;{currentSheet?.name}&quot; does not contain any data rows.
          </div>
        )}
      </div>
    </div>
  );
}
