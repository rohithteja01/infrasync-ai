import React, { useState, useEffect, useCallback } from 'react';
import { Activity, CheckCircle2, AlertCircle, RefreshCw, Database, Server, Clock } from 'lucide-react';

export default function HealthStatus() {
  const [loading, setLoading] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [error, setError] = useState(null);
  const [latency, setLatency] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    const startTime = performance.now();
    try {
      const response = await fetch('/api/health');
      const endTime = performance.now();
      setLatency(Math.round(endTime - startTime));
      
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setHealthData(data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message || 'Unable to connect to backend server');
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const isConnected = healthData && !error;
  const isDbConnected = healthData?.database?.status === 'connected';

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-100 rounded-md text-slate-700">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Backend API Connectivity</h2>
            <p className="text-xs text-slate-500">Live communication with FastAPI service</p>
          </div>
        </div>

        <button
          onClick={checkHealth}
          disabled={loading}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-md transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-slate-600' : 'text-slate-500'}`} />
          <span>{loading ? 'Pinging...' : 'Check Connection'}</span>
        </button>
      </div>

      {/* Main Card Body */}
      <div className="p-6 space-y-6">
        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* API Health Status */}
          <div className="p-4 rounded-md border border-slate-100 bg-slate-50/70">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-slate-400" />
                API Service
              </span>
              {isConnected ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                  Online
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                  <AlertCircle className="w-3 h-3 mr-1 text-rose-600" />
                  Offline
                </span>
              )}
            </div>
            <div className="text-sm font-semibold text-slate-900">
              {healthData?.service ? healthData.service.replace(/OIL AI Copilot/gi, 'Infrasync AI') : 'Infrasync AI Backend'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Endpoint: <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded font-mono">/api/health</code>
            </div>
          </div>

          {/* Database Health Status */}
          <div className="p-4 rounded-md border border-slate-100 bg-slate-50/70">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                Database Configuration
              </span>
              {isDbConnected ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                  Connected
                </span>
              ) : isConnected ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertCircle className="w-3 h-3 mr-1 text-amber-600" />
                  Not Configured
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
                  Unknown
                </span>
              )}
            </div>
            <div className="text-sm font-semibold text-slate-900">
              PostgreSQL
            </div>
            <div className="text-xs text-slate-500 mt-1 truncate" title={healthData?.database?.message}>
              {healthData?.database?.message || 'Awaiting API response...'}
            </div>
          </div>

          {/* Round-trip Telemetry */}
          <div className="p-4 rounded-md border border-slate-100 bg-slate-50/70">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Telemetry
              </span>
              {latency !== null && (
                <span className="text-xs font-medium text-slate-600">
                  {latency} ms
                </span>
              )}
            </div>
            <div className="text-sm font-semibold text-slate-900">
              {lastChecked ? `Checked at ${lastChecked}` : 'Not checked'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Version: <span className="font-mono text-slate-700">{healthData?.version || '0.1.0'}</span>
            </div>
          </div>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-md">
            <div className="flex items-start">
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 mr-2.5 flex-shrink-0" />
              <div>
                <h3 className="text-xs font-medium text-rose-900">Connection Error</h3>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
                <p className="text-xs text-rose-600 mt-2">
                  Ensure the FastAPI backend is running via{' '}
                  <code className="bg-rose-100 px-1 py-0.5 rounded font-mono text-rose-800">
                    uvicorn app.main:app --reload --port 8000
                  </code>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Raw Response Payload */}
        {healthData && (
          <div>
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Raw Response Payload
            </div>
            <pre className="p-3 bg-slate-900 text-slate-200 rounded-md text-xs font-mono overflow-x-auto border border-slate-800">
              {JSON.stringify(healthData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
