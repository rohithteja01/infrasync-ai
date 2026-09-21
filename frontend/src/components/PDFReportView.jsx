import React, { useState } from 'react';
import {
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Briefcase,
  Layers,
  AlertOctagon,
  ShieldAlert,
  CalendarRange,
  FileCheck,
  Sparkles
} from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function PDFReportView({
  projectContext,
  onNavigateToProjectIntelligence
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSuccess, setGenerationSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleGeneratePDF = async () => {
    if (!projectContext) return;

    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationSuccess(false);

    try {
      const response = await fetch('/api/reports/project-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_context: projectContext,
        }),
      });

      if (!response.ok) {
        let errDetail = 'Failed to generate PDF report.';
        try {
          const errData = await response.json();
          errDetail = errData.detail || errDetail;
        } catch {
          errDetail = `Server returned HTTP ${response.status}`;
        }
        throw new Error(errDetail);
      }

      // Extract filename from Content-Disposition header if available
      let filename = 'Infrasync_AI_Project_Report.pdf';
      const disposition = response.headers.get('Content-Disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename=["']?([^"';]+)["']?/);
        if (match && match[1]) {
          filename = match[1].trim();
        }
      }

      // Convert response to blob and trigger direct browser download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(downloadUrl);
      link.remove();

      setGenerationSuccess(true);
    } catch (err) {
      console.error('PDF generation error:', err);
      setErrorMessage(err.message || 'An error occurred while generating the PDF report.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-[#252525] px-2.5 py-1 rounded border border-brand-200 dark:border-[#383838] mb-2">
              <FileText className="w-3.5 h-3.5" />
              <span>Executive Reporting</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-neutral-100">
              PDF Report
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
              Generate a detailed project report from the currently processed project data.
            </p>
          </div>

          {projectContext && (
            <div className="flex items-center space-x-2">
              {projectContext.is_fallback && (
                <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Demo Fallback Mode
                </span>
              )}
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Active Project Ready
              </span>
            </div>
          )}
        </div>
      </div>

      {/* View State 1: Clean Empty State when no project is loaded */}
      {!projectContext ? (
        <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-xl p-12 text-center shadow-sm max-w-2xl mx-auto my-6">
          <div className="w-16 h-16 bg-slate-100 dark:bg-[#252525] border border-slate-200 dark:border-[#383838] rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400 dark:text-neutral-500 shadow-2xs">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-neutral-100 mb-2">
            No Active Project Loaded
          </h3>
          <p className="text-sm text-slate-500 dark:text-neutral-400 mb-6 leading-relaxed max-w-md mx-auto">
            Upload and process project data in Project Intelligence before generating a report.
          </p>
          {onNavigateToProjectIntelligence && (
            <button
              type="button"
              onClick={onNavigateToProjectIntelligence}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <span>Go to Project Intelligence</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        /* View State 2: Active Project Report Generation Screen */
        <div className="space-y-6">
          {/* Project Information Card */}
          <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-lg p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-neutral-100 uppercase tracking-wider flex items-center space-x-2">
              <Briefcase className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>Loaded Project Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="p-3 bg-slate-50 dark:bg-[#222222] rounded-lg border border-slate-200 dark:border-[#333333]">
                <span className="text-[11px] font-medium text-slate-500 dark:text-neutral-400 uppercase tracking-wider block">
                  Project Name
                </span>
                <div className="text-sm font-bold text-slate-900 dark:text-neutral-100 mt-1 truncate">
                  {projectContext.project_name || 'Project Execution & Delay Intelligence'}
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-[#222222] rounded-lg border border-slate-200 dark:border-[#333333]">
                <span className="text-[11px] font-medium text-slate-500 dark:text-neutral-400 uppercase tracking-wider block">
                  Processing Status
                </span>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Analysis Complete</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-[#222222] rounded-lg border border-slate-200 dark:border-[#333333]">
                <span className="text-[11px] font-medium text-slate-500 dark:text-neutral-400 uppercase tracking-wider block">
                  Baseline Schedule
                </span>
                <div className="text-sm font-bold mt-1">
                  {projectContext.has_schedule ? (
                    <span className="text-indigo-600 dark:text-indigo-400 flex items-center space-x-1">
                      <CalendarRange className="w-4 h-4" />
                      <span>Connected</span>
                    </span>
                  ) : (
                    <span className="text-slate-500 dark:text-neutral-400">
                      Not Available (Site Records Only)
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-[#222222] rounded-lg border border-slate-200 dark:border-[#333333]">
                <span className="text-[11px] font-medium text-slate-500 dark:text-neutral-400 uppercase tracking-wider block">
                  Extracted Activities
                </span>
                <div className="text-sm font-bold text-slate-900 dark:text-neutral-100 mt-1 font-mono">
                  {projectContext.summary?.activities_identified || projectContext.activities?.length || 0} tasks
                </div>
              </div>
            </div>

            {/* Available Source Files */}
            {projectContext.files_processed && projectContext.files_processed.length > 0 && (
              <div className="pt-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-neutral-300 block mb-2">
                  Source Files Included in Report ({projectContext.files_processed.length}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {projectContext.files_processed.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center space-x-2.5 p-2 bg-slate-50 dark:bg-[#222222] rounded border border-slate-200 dark:border-[#333333] text-xs"
                    >
                      <FileCheck className="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono font-medium text-slate-900 dark:text-neutral-100 truncate">
                          {file.filename}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-neutral-400">
                          {file.file_type} • {formatBytes(file.size_bytes)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Report Sections Included Specification Card */}
          <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-lg p-6 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-neutral-100 uppercase tracking-wider">
              Report Contents Structure
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs text-slate-600 dark:text-neutral-300">
              <div className="flex items-center space-x-2 p-2 rounded bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#333333]">
                <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-[#333333] text-[10px] font-bold flex items-center justify-center font-mono">1</span>
                <span>Executive Summary & KPIs</span>
              </div>
              <div className="flex items-center space-x-2 p-2 rounded bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#333333]">
                <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-[#333333] text-[10px] font-bold flex items-center justify-center font-mono">2</span>
                <span>Execution Activities Master Table</span>
              </div>
              <div className="flex items-center space-x-2 p-2 rounded bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#333333]">
                <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-[#333333] text-[10px] font-bold flex items-center justify-center font-mono">3</span>
                <span>Progress Analysis by Discipline</span>
              </div>
              <div className="flex items-center space-x-2 p-2 rounded bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#333333]">
                <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-[#333333] text-[10px] font-bold flex items-center justify-center font-mono">4</span>
                <span>Delay Analysis & Variance Causes</span>
              </div>
              <div className="flex items-center space-x-2 p-2 rounded bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#333333]">
                <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-[#333333] text-[10px] font-bold flex items-center justify-center font-mono">5</span>
                <span>Risk & Multi-Source Discrepancies</span>
              </div>
              <div className="flex items-center space-x-2 p-2 rounded bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#333333]">
                <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-[#333333] text-[10px] font-bold flex items-center justify-center font-mono">6</span>
                <span>AI Actionable Recommendations</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-neutral-400 italic pt-1">
              Generated locally using ReportLab with multi-page table wrapping, running headers, and page numbering. Zero AI re-extraction is triggered during generation.
            </p>
          </div>

          {/* Action & Generation Status Card */}
          <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-lg p-6 shadow-sm space-y-4">
            {/* Error Message */}
            {errorMessage && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-lg text-xs text-rose-800 dark:text-rose-300 flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold">Generation Failed: </span>
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Success Message */}
            {generationSuccess && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span className="font-semibold">PDF generated successfully. The report has been downloaded to your system.</span>
              </div>
            )}

            {/* Trigger Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={handleGeneratePDF}
                disabled={isGenerating}
                className={`inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer shadow-sm ${
                  isGenerating
                    ? 'bg-slate-300 dark:bg-[#333333] text-slate-500 dark:text-neutral-400 cursor-not-allowed'
                    : generationSuccess
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-brand-600 hover:bg-brand-700 text-white'
                }`}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generating PDF...</span>
                  </>
                ) : generationSuccess ? (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download PDF Again</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Generate PDF Report</span>
                  </>
                )}
              </button>

              <span className="text-[11px] text-slate-500 dark:text-neutral-400">
                Print-ready format • Standard Letter • Auto-scaled tables
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
