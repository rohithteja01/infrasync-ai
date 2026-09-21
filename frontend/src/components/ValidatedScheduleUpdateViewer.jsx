import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  AlertOctagon,
  ShieldCheck,
  RefreshCw,
  Clock,
  Layers,
  FileSpreadsheet,
  FileCode,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronUp,
  Search
} from 'lucide-react';

const API_BASE = '/api';

export default function ValidatedScheduleUpdateViewer({ projectContext } = {}) {
  const hasNoData = !projectContext;
  const [data, setData] = useState(null);
  const [pmisPayload, setPmisPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filterTab, setFilterTab] = useState('ALL'); // ALL, ELIGIBLE, BLOCKED
  const [searchQuery, setSearchQuery] = useState('');
  const [showPmisModal, setShowPmisModal] = useState(false);

  const fetchData = useCallback(async () => {
    if (hasNoData) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/schedule/validated-updates`);
      if (!res.ok) {
        throw new Error('Failed to fetch validated schedule updates.');
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error communicating with schedule update engine');
    } finally {
      setLoading(false);
    }
  }, [hasNoData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2e2e2e] rounded-xl p-8 text-center shadow-xs">
        <div className="max-w-md mx-auto space-y-3">
          <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-[#252525] text-slate-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-neutral-200">No Active Project Data</h3>
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            Upload a project data file in Project Intelligence to inspect validated schedule updates.
          </p>
        </div>
      </div>
    );
  }

  const generatePreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API_BASE}/schedule/update-preview`, { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setPmisPayload(json);
        setShowPmisModal(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const updates = data?.updates || [];
  const summary = data?.summary || { total: 0, eligible: 0, blocked: 0, contradictions: 0, planner_review: 0, unmatched: 0 };

  const filteredUpdates = updates.filter((u) => {
    if (filterTab === 'ELIGIBLE' && u.validation_status !== 'ELIGIBLE_FOR_UPDATE') return false;
    if (filterTab === 'BLOCKED' && u.validation_status !== 'BLOCKED') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const mAct = u.activity_id?.toLowerCase().includes(q);
      const mName = u.activity_name?.toLowerCase().includes(q);
      const mDisc = u.discipline?.toLowerCase().includes(q);
      const mReason = u.block_reason?.toLowerCase().includes(q);
      return mAct || mName || mDisc || mReason;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Pipeline Flow */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 text-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30 flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Validated Execution &rarr; Schedule / PMIS Update Layer
                </h2>
                <span className="text-[11px] font-mono uppercase bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                  SAFE PREVIEW &bull; NO BASELINE OVERWRITE
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Strict validation gate evaluates execution facts across confidence, contradictions, and L5/L6 baseline mapping before preparing PMIS update packets.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Re-Check Gate
            </button>
            <button
              onClick={generatePreview}
              disabled={previewLoading || summary.eligible === 0}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white rounded shadow-sm transition disabled:opacity-50"
            >
              <FileCode className="w-3.5 h-3.5 mr-1.5" />
              PMIS Update Preview ({summary.eligible})
            </button>
          </div>
        </div>

        {/* Pipeline Architecture Indicator */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-300">Architecture Gate:</span>
            <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-200">1. SYSTEM VALIDATION</span>
            <span>&rarr;</span>
            <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-200">2. SCHEDULE UPDATE PREVIEW</span>
            <span>&rarr;</span>
            <span className="bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded border border-emerald-800">3. PMIS READY (READ-ONLY)</span>
          </div>
          <div className="text-[11px] text-slate-400 italic">
            Zero automated baseline mutations &bull; Baseline MD5 locked
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Total Updates</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{summary.total}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Evaluated candidates</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/20 shadow-sm">
          <div className="text-xs font-medium text-emerald-700 flex items-center justify-between">
            <span>Eligible for Update</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{summary.eligible}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">PMIS Ready</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-rose-200 bg-rose-50/20 shadow-sm">
          <div className="text-xs font-medium text-rose-700 flex items-center justify-between">
            <span>Blocked Updates</span>
            <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-1">{summary.blocked}</div>
          <div className="text-[11px] text-rose-600 mt-0.5">Gated by policy</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-amber-200 bg-amber-50/20 shadow-sm">
          <div className="text-xs font-medium text-amber-700">Contradictions</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{summary.contradictions}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">Unresolved conflicts</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-blue-200 shadow-sm">
          <div className="text-xs font-medium text-blue-700">Planner Review</div>
          <div className="text-2xl font-bold text-blue-700 mt-1">{summary.planner_review}</div>
          <div className="text-[11px] text-blue-600 mt-0.5">Confidence &lt; 90%</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Unmatched Activities</div>
          <div className="text-2xl font-bold text-slate-600 mt-1">{summary.unmatched}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">No baseline task</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search by activity, discipline, reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded border border-slate-200 text-xs">
          {[
            { id: 'ALL', label: `All (${summary.total})` },
            { id: 'ELIGIBLE', label: `Eligible (${summary.eligible})` },
            { id: 'BLOCKED', label: `Blocked (${summary.blocked})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`px-3 py-1 rounded font-medium transition ${
                filterTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded-lg border border-slate-200 text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
          <p className="text-sm font-medium">Evaluating validation gate across execution facts...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 p-6 rounded-lg border border-rose-200 text-rose-700 text-sm">
          <AlertOctagon className="w-5 h-5 mb-1 text-rose-600" />
          <p className="font-semibold">Unable to load validated schedule updates:</p>
          <p className="mt-0.5">{error}</p>
        </div>
      ) : filteredUpdates.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-lg border border-slate-200 text-slate-500">
          <p className="text-sm font-semibold text-slate-700">No updates match current filter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Activity ID & Name</th>
                  <th className="py-2.5 px-3">Discipline</th>
                  <th className="py-2.5 px-3">Planned Dates</th>
                  <th className="py-2.5 px-3">Actual Dates</th>
                  <th className="py-2.5 px-3">Planned Qty</th>
                  <th className="py-2.5 px-3">Actual Qty</th>
                  <th className="py-2.5 px-3">Variance</th>
                  <th className="py-2.5 px-3">Evidence</th>
                  <th className="py-2.5 px-3">Gate Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredUpdates.map((item) => {
                  const isEligible = item.validation_status === 'ELIGIBLE_FOR_UPDATE';
                  return (
                    <tr key={item.update_id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isEligible ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            ELIGIBLE
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertOctagon className="w-3 h-3 mr-1" />
                            BLOCKED
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-sans">
                        <div className="font-mono font-bold text-slate-900 text-xs">{item.activity_id}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">{item.activity_name}</div>
                      </td>

                      <td className="py-2.5 px-3 font-sans text-slate-700 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px]">
                          {item.discipline}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap text-[11px]">
                        <div>S: {item.planned_start || '—'}</div>
                        <div>F: {item.planned_finish || '—'}</div>
                      </td>

                      <td className="py-2.5 px-3 text-slate-800 whitespace-nowrap text-[11px]">
                        <div>S: {item.actual_start || '—'}</div>
                        <div>F: {item.actual_finish || '—'}</div>
                      </td>

                      <td className="py-2.5 px-3 text-slate-600 text-right whitespace-nowrap">
                        {item.planned_quantity} {item.unit}
                      </td>

                      <td className="py-2.5 px-3 font-bold text-slate-900 text-right whitespace-nowrap">
                        {item.actual_quantity} {item.unit}
                      </td>

                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <span className={`font-semibold ${item.variance < 0 ? 'text-rose-600' : item.variance > 0 ? 'text-blue-600' : 'text-slate-600'}`}>
                          {item.variance > 0 ? `+${item.variance}` : item.variance} {item.unit}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {item.evidence_ids?.length > 0 ? (
                          <div className="space-y-0.5">
                            {item.evidence_ids.map((eid, eIdx) => (
                              <span key={eIdx} className="block text-[10px] bg-brand-50 text-brand-700 px-1 py-0.2 rounded border border-brand-200">
                                {eid}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-sans italic">None</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-sans whitespace-nowrap">
                        {isEligible ? (
                          <span className="text-emerald-600 text-[11px] font-medium">Ready for PMIS update</span>
                        ) : (
                          <span className="text-rose-700 text-[11px] font-semibold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            {item.block_reason}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>Safety policy: Only activities with high confidence and zero unresolved contradictions proceed to PMIS preview.</span>
            </div>
            <div className="font-mono text-[11px] text-slate-400">Target: Oracle Primavera P6 / MS Project</div>
          </div>
        </div>
      )}

      {/* Simulated PMIS Modal */}
      {showPmisModal && pmisPayload && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <FileCode className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Simulated PMIS Update Export Payload (Read-Only Preview)
                </h3>
              </div>
              <button
                onClick={() => setShowPmisModal(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 bg-slate-200 rounded"
              >
                Close
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs bg-slate-900 text-slate-100 rounded m-4">
              <pre>{JSON.stringify(pmisPayload, null, 2)}</pre>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 text-right text-xs text-slate-500">
              Zero baseline schedule mutations &bull; Read-only export simulation
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
