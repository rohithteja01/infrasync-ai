import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  RefreshCw, 
  Search, 
  Eye, 
  Layers, 
  FileText, 
  Clock, 
  MapPin, 
  Tag, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';

const API_BASE = '/api';

export default function ContradictionViewer({ defaultShowAudit = false, projectContext } = {}) {
  const hasNoData = !projectContext;
  const [contradictions, setContradictions] = useState(projectContext?.contradictions || []);
  const [summary, setSummary] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showAuditModal, setShowAuditModal] = useState(defaultShowAudit);

  useEffect(() => {
    if (defaultShowAudit !== undefined) {
      setShowAuditModal(defaultShowAudit);
    }
  }, [defaultShowAudit]);

  useEffect(() => {
    if (projectContext?.contradictions) {
      setContradictions(projectContext.contradictions);
      setSummary({
        total: projectContext.contradictions.length,
        high: projectContext.contradictions.filter(c => c.severity === 'HIGH').length,
        medium: projectContext.contradictions.filter(c => c.severity === 'MEDIUM').length,
        low: projectContext.contradictions.filter(c => c.severity === 'LOW').length,
        planner_review: projectContext.contradictions.length,
        supported: 1,
        conflicting: projectContext.contradictions.length,
        insufficient: 1
      });
    }
  }, [projectContext]);

  const fetchData = useCallback(async () => {
    if (hasNoData || projectContext?.contradictions) return;
    setLoading(true);
    setError(null);
    try {
      const [resSummary, resContradictions, resAudit] = await Promise.all([
        fetch(`${API_BASE}/validation/contradictions/summary`),
        fetch(`${API_BASE}/validation/contradictions`),
        fetch(`${API_BASE}/validation/audit-trail`)
      ]);

      if (!resSummary.ok || !resContradictions.ok) {
        throw new Error('Failed to fetch contradiction validation data.');
      }

      const summaryData = await resSummary.json();
      const contradictionsData = await resContradictions.json();
      const auditData = resAudit.ok ? await resAudit.json() : { audit_trail: [] };

      setSummary(summaryData);
      setContradictions(contradictionsData.contradictions || []);
      setAuditTrail(auditData.audit_trail || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error connecting to validation engine');
    } finally {
      setLoading(false);
    }
  }, [hasNoData, projectContext]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2e2e2e] rounded-xl p-8 text-center shadow-xs">
        <div className="max-w-md mx-auto space-y-3">
          <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-[#252525] text-slate-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-neutral-200">No Active Project Data</h3>
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            Upload a project data file in Project Intelligence to inspect cross-source contradiction detection and audit trail.
          </p>
        </div>
      </div>
    );
  }

  // Filtering
  const filteredContradictions = contradictions.filter((item) => {
    if (severityFilter !== 'ALL' && item.severity !== severityFilter) {
      return false;
    }
    if (typeFilter !== 'ALL' && item.contradiction_type !== typeFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchAct = item.activity_id?.toLowerCase().includes(q);
      const matchName = item.activity_name?.toLowerCase().includes(q);
      const matchType = item.contradiction_type?.toLowerCase().includes(q);
      const matchExpl = item.explanation?.toLowerCase().includes(q);
      return matchAct || matchName || matchType || matchExpl;
    }
    return true;
  });

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'HIGH':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'LOW':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getEvidenceStatusBadge = (status) => {
    switch (status) {
      case 'CONFLICTING':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'SUPPORTED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'INSUFFICIENT':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const formatTypeName = (rawType) => {
    return String(rawType || 'CONTRADICTION').replace('_CONTRADICTION', '').replace(/_/g, ' ');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Governance Disclaimer */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30 flex-shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-semibold tracking-tight text-slate-100">
                  Contradiction Detection & Evidence Governance
                </h2>
                <span className="text-[11px] font-mono uppercase bg-amber-950 text-amber-300 px-2 py-0.5 rounded border border-amber-800">
                  PLANNER REVIEW REQUIRED
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Deterministic cross-source verification across Daily Reports, Site Diaries, Documents, Time Agent updates, and Photo Evidence.
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
              Re-Scan
            </button>
            <button
              onClick={() => setShowAuditModal(!showAuditModal)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-brand-700 hover:bg-brand-600 text-white rounded shadow-sm transition"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Audit Trail ({auditTrail.length})
            </button>
          </div>
        </div>

        {/* Governance Pipeline Flow Indicator */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-300">Pipeline Flow:</span>
            <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-200">1. SYSTEM DETECTED CONFLICT</span>
            <span>&rarr;</span>
            <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-200">2. EVIDENCE COMPARISON</span>
            <span>&rarr;</span>
            <span className="bg-amber-900/60 text-amber-200 px-2 py-0.5 rounded border border-amber-800">3. PLANNER REVIEW REQUIRED</span>
          </div>
          <div className="text-[11px] text-slate-400 italic">
            Zero automatic mutations &bull; In-memory audit
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Total Contradictions</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{summary.total}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Across all sources</div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-rose-200 bg-rose-50/20 shadow-sm">
            <div className="text-xs font-medium text-rose-700 flex items-center justify-between">
              <span>High Severity</span>
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            </div>
            <div className="text-2xl font-bold text-rose-700 mt-1">{summary.high}</div>
            <div className="text-[11px] text-rose-600 mt-0.5">Chronology & Status</div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-amber-200 bg-amber-50/20 shadow-sm">
            <div className="text-xs font-medium text-amber-700 flex items-center justify-between">
              <span>Medium Severity</span>
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            </div>
            <div className="text-2xl font-bold text-amber-700 mt-1">{summary.medium}</div>
            <div className="text-[11px] text-amber-600 mt-0.5">Discipline & Location</div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-blue-200 shadow-sm">
            <div className="text-xs font-medium text-blue-700">Planner Review</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">{summary.planner_review}</div>
            <div className="text-[11px] text-blue-600 mt-0.5">100% routed to planner</div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/20 shadow-sm">
            <div className="text-xs font-medium text-emerald-700">Supported Facts</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{summary.supported}</div>
            <div className="text-[11px] text-emerald-600 mt-0.5">Multi-source alignment</div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Insufficient Data</div>
            <div className="text-2xl font-bold text-slate-600 mt-1">{summary.insufficient}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Single / null source</div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search activity, type, or note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Severity Filter */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded border border-slate-200 text-xs">
            {['ALL', 'HIGH', 'MEDIUM'].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  severityFilter === sev
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="ALL">All Contradiction Types</option>
            <option value="PROGRESS_CONTRADICTION">Progress Quantity Conflict</option>
            <option value="STATUS_CONTRADICTION">Activity Status Conflict</option>
            <option value="START_END_CONTRADICTION">Start &gt; End Chronology</option>
            <option value="DATE_CONTRADICTION">Milestone Date Conflict</option>
            <option value="DISCIPLINE_CONTRADICTION">Discipline Classification</option>
            <option value="LOCATION_CONTRADICTION">Site Location Conflict</option>
          </select>
        </div>
      </div>

      {/* Main Contradictions List */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded-lg border border-slate-200 text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
          <p className="text-sm font-medium">Scanning execution facts across ingested sources...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 p-6 rounded-lg border border-rose-200 text-rose-700 text-sm">
          <AlertTriangle className="w-5 h-5 mb-1 text-rose-600" />
          <p className="font-semibold">Unable to load contradiction validation:</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : filteredContradictions.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-lg border border-slate-200 text-slate-500">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
          <h3 className="text-sm font-semibold text-slate-800">No Contradictions Match Filter</h3>
          <p className="text-xs text-slate-400 mt-1">Adjust search parameters or filters to view all findings.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredContradictions.map((item) => {
            const isExpanded = expandedId === item.contradiction_id;
            return (
              <div
                key={item.contradiction_id}
                className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden transition hover:border-slate-300"
              >
                {/* Header Row */}
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 border-b border-slate-100">
                  <div className="flex items-start md:items-center space-x-3">
                    <span className={`px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border ${getSeverityBadge(item.severity)}`}>
                      {item.severity}
                    </span>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-sm text-slate-900">
                          {item.activity_id}
                        </span>
                        <span className="text-slate-300">&bull;</span>
                        <span className="text-xs font-medium text-slate-700">
                          {item.activity_name || 'Activity'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {item.contradiction_id}
                        </span>
                        <span className="text-xs text-slate-500">
                          Type: <strong className="text-slate-700">{formatTypeName(item.contradiction_type)}</strong>
                        </span>
                        <span className="text-xs text-slate-400">({item.field})</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${getEvidenceStatusBadge(item.evidence_status)}`}>
                      {item.evidence_status}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                      {item.status}
                    </span>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.contradiction_id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition"
                      title={isExpanded ? 'Collapse details' : 'Expand details'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Explanation Strip */}
                <div className="px-4 py-2.5 bg-amber-50/40 border-b border-amber-100/60 text-xs text-amber-900 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>{item.explanation}</span>
                  </div>
                  <div className="text-[11px] text-amber-700 font-medium flex-shrink-0 ml-3">
                    Action: <strong>{item.recommended_action}</strong>
                  </div>
                </div>

                {/* Side-by-Side Conflicting Values Table */}
                <div className="p-4">
                  <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Multi-Source Evidence Comparison ({item.values?.length || 0} Sources)</span>
                    <span className="text-[11px] text-slate-400 font-normal">Deterministic field extraction</span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="py-2 px-3">Source Type</th>
                          <th className="py-2 px-3">Source Document / Reference</th>
                          <th className="py-2 px-3">Evidence ID</th>
                          <th className="py-2 px-3">Reported Value</th>
                          <th className="py-2 px-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {item.values?.map((val, vIdx) => (
                          <tr key={vIdx} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3">
                              <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-semibold">
                                {val.source_type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-800">
                              {val.source_reference}
                            </td>
                            <td className="py-2.5 px-3">
                              {val.evidence_id ? (
                                <span className="text-brand-700 font-semibold bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200 text-[11px]">
                                  {val.evidence_id}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic font-sans text-[11px]">
                                  None (Direct Event)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                {String(val.value)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-sans">
                              {val.date || 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Governance Notice inside Card */}
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    <div className="flex items-center space-x-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                      <span>This finding is flagged for human planner inspection. No automated baseline adjustments applied.</span>
                    </div>
                    <div className="font-mono text-slate-400">
                      Audit: AUD-CTD-{item.contradiction_id ? item.contradiction_id.split('-').pop() : (item.id || '001')}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Audit Trail Modal / Drawer */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Contradiction Detection Audit Trail (In-Memory)
                </h3>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 bg-slate-200 rounded"
              >
                Close
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                    <tr>
                      <th className="py-2 px-3">Audit ID</th>
                      <th className="py-2 px-3">Contradiction ID</th>
                      <th className="py-2 px-3">Action</th>
                      <th className="py-2 px-3">Timestamp (UTC)</th>
                      <th className="py-2 px-3">Actor</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {auditTrail.map((entry) => (
                      <tr key={entry.audit_id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-800">{entry.audit_id}</td>
                        <td className="py-2 px-3 text-brand-700">{entry.contradiction_id}</td>
                        <td className="py-2 px-3 font-sans text-slate-600">{entry.action}</td>
                        <td className="py-2 px-3 text-slate-500">{entry.timestamp}</td>
                        <td className="py-2 px-3 text-slate-600">{entry.actor}</td>
                        <td className="py-2 px-3">
                          <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold text-[10px]">
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 text-right text-xs text-slate-500">
              Zero permanent PostgreSQL writes &bull; Read-only audit log
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
