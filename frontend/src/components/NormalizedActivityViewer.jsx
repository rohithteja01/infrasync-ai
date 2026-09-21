import React, { useState } from 'react';
import { CheckCheck, Layers, Calendar, ArrowRight, Table, Info, Hash, Bot, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import AIExtractedActivityViewer from './AIExtractedActivityViewer';

function getStatusBadge(status) {
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'in progress':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'planned':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'pending':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'delayed':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export default function NormalizedActivityViewer({ normalizedData, onBackToRaw, onAIExtractSuccess }) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [showMappingDetails, setShowMappingDetails] = useState(true);

  // Feature 2.4: AI Extraction State
  const [aiData, setAiData] = useState(null);
  const [extractingAI, setExtractingAI] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [showAIView, setShowAIView] = useState(false);

  if (!normalizedData || !normalizedData.sheets || normalizedData.sheets.length === 0) {
    return (
      <div className="p-6 bg-white border border-slate-200 rounded-lg text-center text-slate-500 text-sm">
        No normalized activity data available.
      </div>
    );
  }

  const handleAIExtract = async () => {
    if (aiData) {
      if (onAIExtractSuccess) {
        onAIExtractSuccess(aiData);
      } else {
        setShowAIView(true);
      }
      return;
    }

    setExtractingAI(true);
    setAiError(null);

    try {
      const response = await fetch(`/api/ingestion/excel/${encodeURIComponent(normalizedData.filename)}/ai-extract`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || `Server returned HTTP ${response.status}`);
      }

      setAiData(result);
      if (onAIExtractSuccess) {
        onAIExtractSuccess(result);
      } else {
        setShowAIView(true);
      }
    } catch (err) {
      setAiError(err.message || 'Failed to extract activities with AI.');
    } finally {
      setExtractingAI(false);
    }
  };

  if (showAIView && aiData) {
    return (
      <AIExtractedActivityViewer
        aiData={aiData}
        onBackToNormalized={() => setShowAIView(false)}
        onBackToRaw={onBackToRaw}
      />
    );
  }

  const currentSheet = normalizedData.sheets[activeSheetIndex] || normalizedData.sheets[0];
  const mapping = currentSheet.field_mapping || {};
  const activities = currentSheet.activities || [];

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden space-y-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 text-blue-800 rounded-md">
            <CheckCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-semibold text-slate-900">
                Normalized Activity Data
              </h3>
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-medium">
                Feature 2.3 Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Standardized canonical schema • {normalizedData.filename}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Feature 2.4: AI Activity Extraction Trigger */}
          <button
            onClick={handleAIExtract}
            disabled={extractingAI}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs transition-colors disabled:opacity-50"
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

          <button
            onClick={() => setShowMappingDetails(!showMappingDetails)}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-md transition-colors"
          >
            {showMappingDetails ? 'Hide Mapping' : 'Show Mapping'}
          </button>
          {onBackToRaw && (
            <button
              onClick={onBackToRaw}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors flex items-center space-x-1"
            >
              <Table className="w-3.5 h-3.5" />
              <span>Raw View</span>
            </button>
          )}
        </div>
      </div>

      {/* AI Error Notice if any */}
      {aiError && (
        <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-start space-x-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <span>{aiError}</span>
        </div>
      )}

      {/* Multi-sheet Tabs */}
      {normalizedData.sheets.length > 1 && (
        <div className="px-6 pt-3 bg-slate-100/60 border-b border-slate-200 flex items-center space-x-2 overflow-x-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-2 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            Sheets:
          </span>
          {normalizedData.sheets.map((sheet, idx) => {
            const isActive = idx === activeSheetIndex;
            return (
              <button
                key={sheet.sheet_name || idx}
                onClick={() => setActiveSheetIndex(idx)}
                className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors border-t border-l border-r whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-slate-900 border-slate-300 font-semibold shadow-xs -mb-px'
                    : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <span>{sheet.sheet_name}</span>
                <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'}`}>
                  {sheet.total_records}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Field Mapping Card */}
      {showMappingDetails && (
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center space-x-2 mb-2.5">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Detected Field Mapping ({currentSheet.sheet_name})
            </h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {Object.entries(mapping).map(([canonical, origCol]) => (
              <div
                key={canonical}
                className="p-2 bg-white rounded border border-slate-200 flex flex-col justify-between"
              >
                <span className="text-[11px] font-semibold text-slate-700 capitalize">
                  {canonical.replace('_', ' ')}
                </span>
                {origCol ? (
                  <div className="flex items-center space-x-1 mt-1 font-mono text-[11px] text-blue-700 truncate" title={origCol}>
                    <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{origCol}</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400 italic mt-1">Not Detected</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Normalized Activities Table */}
      <div className="p-6">
        {activities.length > 0 ? (
          <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100/90 text-slate-800 font-semibold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 w-12 text-center text-slate-400 font-mono text-[11px] border-r border-slate-200 bg-slate-100">
                      #
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                      Activity ID / WBS
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                      Activity Name / Description
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-slate-900 text-right border-r border-slate-200 whitespace-nowrap">
                      Planned Qty
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-slate-900 text-right border-r border-slate-200 whitespace-nowrap">
                      Actual Qty
                    </th>
                    <th className="px-2.5 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                      Unit
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                      Dates
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                      Other Attributes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {activities.map((act) => (
                    <tr key={act.row_index} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3 py-2 text-center font-mono text-[11px] text-slate-400 bg-slate-50/50 border-r border-slate-200">
                        {act.row_index}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                        {act.activity_id ? (
                          <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {act.activity_id}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 border-r border-slate-100 font-medium text-slate-900 max-w-xs truncate" title={act.activity_name}>
                        {act.activity_name || <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-slate-100 font-mono text-slate-800 whitespace-nowrap">
                        {act.planned_quantity !== null && act.planned_quantity !== undefined ? (
                          act.planned_quantity.toLocaleString()
                        ) : (
                          <span className="text-slate-300 italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-slate-100 font-mono text-slate-800 whitespace-nowrap">
                        {act.actual_quantity !== null && act.actual_quantity !== undefined ? (
                          act.actual_quantity.toLocaleString()
                        ) : (
                          <span className="text-slate-300 italic">—</span>
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-center border-r border-slate-100 font-mono text-slate-600 whitespace-nowrap">
                        {act.unit || <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center border-r border-slate-100 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${getStatusBadge(act.status)}`}>
                          {act.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 border-r border-slate-100 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {act.start_date || act.end_date ? (
                          <div className="space-y-0.5">
                            {act.start_date && <div>Start: {act.start_date}</div>}
                            {act.end_date && <div>End: {act.end_date}</div>}
                          </div>
                        ) : (
                          <span className="text-slate-300 italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {act.unmapped_attributes && Object.keys(act.unmapped_attributes).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(act.unmapped_attributes).map(([k, v]) => (
                              <span
                                key={k}
                                className="inline-block bg-slate-100 text-slate-700 text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200"
                                title={`${k}: ${v}`}
                              >
                                {k}: <strong>{v}</strong>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-300 italic">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>Normalized <strong>{activities.length}</strong> activity records in sheet <strong>{currentSheet.sheet_name}</strong></span>
              <span className="font-mono text-[11px] text-slate-400">Ready for AI Activity Extraction</span>
            </div>
          </div>
        ) : (
          <div className="p-8 border border-dashed border-slate-300 rounded-lg text-center text-slate-500 text-xs bg-slate-50/50">
            No activities detected in sheet &quot;{currentSheet?.sheet_name}&quot;.
          </div>
        )}
      </div>
    </div>
  );
}
