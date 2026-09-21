import React, { useState } from 'react';
import { Bot, Layers, CheckCheck, Table, ChevronDown, ChevronUp, Sparkles, Hash } from 'lucide-react';

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

export default function AIExtractedActivityViewer({ aiData, onBackToNormalized, onBackToRaw }) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [expandedRow, setExpandedRow] = useState(null);

  if (!aiData || !aiData.sheets || aiData.sheets.length === 0) {
    return (
      <div className="p-6 bg-white border border-slate-200 rounded-lg text-center text-slate-500 text-sm">
        No AI-extracted activity data available.
      </div>
    );
  }

  const currentSheet = aiData.sheets[activeSheetIndex] || aiData.sheets[0];
  const activities = currentSheet.activities || [];

  const toggleRow = (idx) => {
    setExpandedRow(expandedRow === idx ? null : idx);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden space-y-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-100 text-indigo-800 rounded-md">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-semibold text-slate-900">
                AI Extracted Activities
              </h3>
              <span className="inline-flex items-center space-x-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-medium">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                <span>Feature 2.4 • AI Interpreted</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Engine: <span className="font-semibold text-slate-700">{currentSheet.engine}</span> • {currentSheet.total_extracted} activities identified in {currentSheet.execution_time_ms} ms
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onBackToNormalized && (
            <button
              onClick={onBackToNormalized}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-md transition-colors flex items-center space-x-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Normalized View</span>
            </button>
          )}
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

      {/* Multi-sheet Tabs */}
      {aiData.sheets.length > 1 && (
        <div className="px-6 pt-3 bg-slate-100/60 border-b border-slate-200 flex items-center space-x-2 overflow-x-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-2 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            Sheets:
          </span>
          {aiData.sheets.map((sheet, idx) => {
            const isActive = idx === activeSheetIndex;
            return (
              <button
                key={sheet.sheet_name || idx}
                onClick={() => {
                  setActiveSheetIndex(idx);
                  setExpandedRow(null);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors border-t border-l border-r whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-slate-900 border-slate-300 font-semibold shadow-xs -mb-px'
                    : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <span>{sheet.sheet_name}</span>
                <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-600'}`}>
                  {sheet.total_extracted}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Table Content */}
      <div className="p-6">
        {activities.length > 0 ? (
          <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100/90 text-slate-800 font-semibold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 w-10 text-center text-slate-400 font-mono text-[11px] border-r border-slate-200 bg-slate-100">
                      #
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                      Activity ID
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                      Activity Name
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                      Discipline
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap min-w-[220px]">
                      Work Description
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-slate-900 text-right border-r border-slate-200 whitespace-nowrap">
                      Planned Quantity
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-slate-900 text-right border-r border-slate-200 whitespace-nowrap">
                      Actual Quantity
                    </th>
                    <th className="px-2.5 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                      Unit
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-slate-900 text-center border-r border-slate-200 whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-2.5 py-2.5 font-semibold text-slate-900 text-center whitespace-nowrap w-16">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {activities.map((act, idx) => {
                    const isExpanded = expandedRow === idx;
                    return (
                      <React.Fragment key={idx}>
                        <tr className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-slate-400 bg-slate-50/50 border-r border-slate-200">
                            {act.source_row_index || idx + 1}
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
                          <td className="px-4 py-2 border-r border-slate-100 font-semibold text-slate-900 whitespace-nowrap">
                            {act.activity_name}
                          </td>
                          <td className="px-3 py-2 text-center border-r border-slate-100 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getDisciplineBadge(act.discipline)}`}>
                              {act.discipline}
                            </span>
                          </td>
                          <td className="px-4 py-2 border-r border-slate-100 text-slate-700 leading-relaxed">
                            {act.work_description}
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
                          <td className="px-2.5 py-2 text-center">
                            <button
                              onClick={() => toggleRow(idx)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                              title="Toggle source record details"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>

                        {/* Collapsible Source Record Detail */}
                        {isExpanded && (
                          <tr className="bg-slate-50 border-t border-b border-slate-200">
                            <td colSpan="10" className="p-4 text-xs">
                              <div className="space-y-2">
                                <div className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                                  Original Source Row (Unprocessed Excel Input)
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white p-3 rounded border border-slate-200 font-mono text-[11px]">
                                  {act.original_record?.raw_values && Object.entries(act.original_record.raw_values).map(([k, v]) => (
                                    <div key={k} className="p-1 bg-slate-50 rounded border border-slate-100">
                                      <span className="text-slate-500">{k}:</span> <strong className="text-slate-900">{String(v)}</strong>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>Extracted <strong>{activities.length}</strong> project activities in <strong>{currentSheet.sheet_name}</strong></span>
              <span className="font-mono text-[11px] text-slate-400">Ready for Future L5/L6 Mapping Layer</span>
            </div>
          </div>
        ) : (
          <div className="p-8 border border-dashed border-slate-300 rounded-lg text-center text-slate-500 text-xs bg-slate-50/50">
            No activities extracted in sheet &quot;{currentSheet?.sheet_name}&quot;.
          </div>
        )}
      </div>
    </div>
  );
}
