import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  Clock,
  Zap,
  AlertTriangle,
  Layers,
  Search,
  RefreshCw,
  Info,
  TrendingUp,
  FileText,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

const API_BASE = '/api';

export default function InstitutionalMemoryViewer() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [disciplineFilter, setDisciplineFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/institutional-memory`);
      if (!res.ok) {
        throw new Error('Failed to fetch institutional memory records.');
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error communicating with institutional memory engine');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const records = data?.records || [];
  const summary = data?.summary || {};
  const disciplinePerf = summary.discipline_performance || {};
  const benchmarks = summary.productivity_benchmarks || [];

  const filteredRecords = records.filter((r) => {
    if (disciplineFilter !== 'ALL' && r.discipline?.toLowerCase() !== disciplineFilter.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const mAct = r.activity_id?.toLowerCase().includes(q);
      const mName = r.activity_name?.toLowerCase().includes(q);
      const mBottle = r.bottleneck?.toLowerCase().includes(q);
      const mDelay = r.delay_cause?.toLowerCase().includes(q);
      return mAct || mName || mBottle || mDelay;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Knowledge System */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 text-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30 flex-shrink-0">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Institutional Memory & Execution Knowledge Register
                </h2>
                <span className="text-[11px] font-mono uppercase bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800">
                  EMPIRICAL LEARNING
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Preserves field-tested actual durations, empirical productivity rates, site bottlenecks, and discipline performance derived from validated execution events.
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
              Refresh Memory
            </button>
          </div>
        </div>

        {/* Cross-Project Limitation Notice */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-300">Data Boundary:</span>
            <span className="bg-slate-800 px-2 py-0.5 rounded text-indigo-300 font-mono">CURRENT_PROJECT</span>
            <span>&bull;</span>
            <span className="text-slate-400">Cross-project learning repository initialized &amp; ready for multi-project ingestion</span>
          </div>
          <div className="text-[11px] text-slate-400 italic">
            Zero fabricated historical records &bull; Verified empirical data only
          </div>
        </div>
      </div>

      {/* Discipline Performance Scorecards */}
      <div>
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
          Discipline Performance Benchmarks
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(disciplinePerf).map(([disc, stats]) => (
            <div key={disc} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-900 text-sm">{disc} Engineering</span>
                <span className="text-xs text-slate-500 font-mono">{stats.total_activities} Activities</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs font-mono">
                <div className="bg-slate-50 p-2 rounded">
                  <div className="text-[10px] text-slate-400 font-sans uppercase">Avg Progress</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">{stats.average_progress_percent}%</div>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                  <div className="text-[10px] text-slate-400 font-sans uppercase">Avg Delay</div>
                  <div className={`text-base font-bold mt-0.5 ${stats.average_delay_days > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {stats.average_delay_days} days
                  </div>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                  <div className="text-[10px] text-slate-400 font-sans uppercase">Completed</div>
                  <div className="text-base font-bold text-emerald-700 mt-0.5">{stats.completed_activities}</div>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                  <div className="text-[10px] text-slate-400 font-sans uppercase">Avg Duration</div>
                  <div className="text-base font-bold text-indigo-700 mt-0.5">
                    {stats.average_duration_hours ? `${stats.average_duration_hours}h` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search by activity, bottleneck, cause..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded border border-slate-200 text-xs">
          {['ALL', 'Civil', 'Piping', 'Mechanical'].map((disc) => (
            <button
              key={disc}
              onClick={() => setDisciplineFilter(disc)}
              className={`px-3 py-1 rounded font-medium transition ${
                disciplineFilter.toLowerCase() === disc.toLowerCase()
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {disc}
            </button>
          ))}
        </div>
      </div>

      {/* Knowledge Records Table */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded-lg border border-slate-200 text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
          <p className="text-sm font-medium">Querying empirical execution knowledge base...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 p-6 rounded-lg border border-rose-200 text-rose-700 text-sm">
          <p className="font-semibold">Unable to load institutional memory:</p>
          <p className="mt-0.5">{error}</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-lg border border-slate-200 text-slate-500">
          <p className="text-sm font-semibold text-slate-700">No memory records match current filter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Memory ID & Activity</th>
                  <th className="py-2.5 px-3">Discipline</th>
                  <th className="py-2.5 px-3">Actual Duration</th>
                  <th className="py-2.5 px-3">Productivity Pattern</th>
                  <th className="py-2.5 px-3">Delay & Cause</th>
                  <th className="py-2.5 px-3">Field Bottleneck</th>
                  <th className="py-2.5 px-3">Evidence Ref</th>
                  <th className="py-2.5 px-3">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredRecords.map((rec) => (
                  <tr key={rec.memory_id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 text-xs">{rec.activity_id}</div>
                      <div className="text-[11px] text-slate-500 font-sans truncate max-w-xs">{rec.activity_name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{rec.memory_id}</div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap font-sans">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                        {rec.discipline}
                      </span>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {rec.actual_duration_hours !== null ? (
                        <div className="text-indigo-700 font-bold flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                          {rec.actual_duration_hours} hrs
                        </div>
                      ) : (
                        <span className="text-slate-400 italic font-sans text-[11px]">In progress</span>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {rec.productivity_pattern ? (
                        <span className="bg-emerald-50 text-emerald-800 font-semibold px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                          {rec.productivity_pattern}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic font-sans text-[11px]">Insufficient data</span>
                      )}
                    </td>

                    <td className="py-3 px-3 font-sans">
                      {rec.delay_days > 0 ? (
                        <div>
                          <span className="text-amber-700 font-bold font-mono">+{rec.delay_days} days</span>
                          <div className="text-[11px] text-slate-500 mt-0.5">{rec.delay_cause || 'Identified by Delay Detection'}</div>
                        </div>
                      ) : (
                        <span className="text-emerald-700 font-medium text-[11px] flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> On schedule
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 font-sans max-w-xs">
                      {rec.bottleneck ? (
                        <div className="text-[11px] text-slate-700 leading-tight">
                          {rec.bottleneck}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">None recorded</span>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {rec.evidence_ids?.length > 0 ? (
                        <div className="space-y-0.5">
                          {rec.evidence_ids.map((eid, eIdx) => (
                            <span key={eIdx} className="block text-[10px] bg-brand-50 text-brand-700 px-1 py-0.2 rounded border border-brand-200">
                              {eid}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic font-sans text-[11px]">None</span>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-bold text-slate-800">
                        {Math.round(rec.confidence * 100)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>Execution knowledge records update reactively when verified Time Agent events or field reports arrive.</span>
            </div>
            <div className="font-mono text-[11px] text-slate-400">Total records: {records.length}</div>
          </div>
        </div>
      )}
    </div>
  );
}
