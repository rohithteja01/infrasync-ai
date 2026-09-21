import React, { useState, useEffect, useCallback } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertCircle,
  Layers,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  BarChart3,
  ChevronRight,
  Sparkles,
  ShieldAlert,
  FileCheck,
  CalendarRange,
  SlidersHorizontal,
  Network,
  GitBranch,
  ArrowRight,
  ShieldCheck,
  Milestone,
  AlertOctagon,
  Cpu,
  ListTodo,
  FileText,
  UserCheck,
  BookMarked,
  Link2,
  Camera,
  Mic,
  ScanText,
  BookOpen,
  ClipboardList,
  Target
} from 'lucide-react';
import HorizontalWorkflowNav, { normalizeWorkflowSection, ROLE_WORKFLOW_STAGES } from './HorizontalWorkflowNav';
import ExcelUpload from './ExcelUpload';
import ScheduleActivityViewer from './ScheduleActivityViewer';
import NormalizedActivityViewer from './NormalizedActivityViewer';
import ExactIdMatchingViewer from './ExactIdMatchingViewer';
import FuzzyMatchingViewer from './FuzzyMatchingViewer';
import SemanticMatchingViewer from './SemanticMatchingViewer';
import GranularityResolutionViewer from './GranularityResolutionViewer';
import NewActivityDiscoveryViewer from './NewActivityDiscoveryViewer';
import ConfidenceValidationViewer from './ConfidenceValidationViewer';
import PlannerReviewViewer from './PlannerReviewViewer';
import ScheduleLinkingViewer from './ScheduleLinkingViewer';
import ScheduleDependenciesViewer from './ScheduleDependenciesViewer';
import CriticalPathViewer from './CriticalPathViewer';
import DelayDetectionViewer from './DelayDetectionViewer';
import ScheduleHealthViewer from './ScheduleHealthViewer';
import DelayPredictionViewer from './DelayPredictionViewer';
import RootCauseAnalysisViewer from './RootCauseAnalysisViewer';
import ImpactPropagationViewer from './ImpactPropagationViewer';
import WhatIfSimulatorViewer from './WhatIfSimulatorViewer';
import RecoveryPlansViewer from './RecoveryPlansViewer';
import RecommendationsViewer from './RecommendationsViewer';
import DecisionCenterViewer from './DecisionCenterViewer';
import DailyReportViewer from './DailyReportViewer';
import SiteDiaryViewer from './SiteDiaryViewer';
import DocumentViewer from './DocumentViewer';
import OCRViewer from './OCRViewer';
import ASRViewer from './ASRViewer';
import ScheduleIngestionViewer from './ScheduleIngestionViewer';
import PhotoEvidenceViewer from './PhotoEvidenceViewer';
import TimeAgentViewer from './TimeAgentViewer';
import ExecutionCaptureViewer from './ExecutionCaptureViewer';
import ContradictionViewer from './ContradictionViewer';
import ValidatedScheduleUpdateViewer from './ValidatedScheduleUpdateViewer';
import InstitutionalMemoryViewer from './InstitutionalMemoryViewer';

function mapToSimpleStatus(rawStatus) {
  if (!rawStatus) return 'Not Started';
  const lower = String(rawStatus).toLowerCase().trim();
  if (lower.includes('complete') || lower.includes('done')) return 'Completed';
  if (lower.includes('delay') || lower.includes('behind') || lower.includes('critical')) return 'Delayed';
  if (lower.includes('progress') || lower.includes('ongoing') || lower.includes('executing')) return 'In Progress';
  return 'Not Started';
}

function getStatusBadge(status) {
  const s = mapToSimpleStatus(status);
  switch (s) {
    case 'Completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50';
    case 'Delayed':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50';
    case 'In Progress':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#252525] dark:text-neutral-300 dark:border-[#383838]';
  }
}

function getDisciplineBadge(discipline) {
  const d = String(discipline || '').toLowerCase();
  if (d.includes('civil')) return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50';
  if (d.includes('piping') || d.includes('pipe')) return 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-800/50';
  if (d.includes('mech')) return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50';
  if (d.includes('struct')) return 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/50';
  if (d.includes('elec')) return 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800/50';
  if (d.includes('inst')) return 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-400 dark:border-fuchsia-800/50';
  return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-[#252525] dark:text-neutral-300 dark:border-[#383838]';
}

export default function ActivityIntelligenceView({
  activeStage = 'report-voice',
  onStageChange,
  projectContext = null,
  onResultUpdate,
  onNavigateToProjectIntelligence,
  onClearProject,
  userRole = null
} = {}) {
  // Helper to clamp section to user's permitted stages
  const getClampedSection = (requested) => {
    const canonical = normalizeWorkflowSection(requested);
    if (userRole && ROLE_WORKFLOW_STAGES[userRole]) {
      const allowed = ROLE_WORKFLOW_STAGES[userRole];
      if (!allowed.includes(canonical)) {
        return allowed[0];
      }
    }
    return canonical;
  };

  // Main Canonical Workflow Section (1 to 9)
  const initialSection = getClampedSection(activeStage || (projectContext ? 'progress-delay-risk' : (userRole === 'PROJECT_MANAGER' ? 'progress-delay-risk' : 'report-voice')));
  const [activeTab, setActiveTab] = useState(initialSection);

  // Role clamping effect
  useEffect(() => {
    if (userRole && ROLE_WORKFLOW_STAGES[userRole]) {
      const allowed = ROLE_WORKFLOW_STAGES[userRole];
      if (!allowed.includes(activeTab)) {
        setActiveTab(allowed[0]);
      }
    }
  }, [userRole, activeTab]);

  // Internal Sub-tabs for Sections with Multiple Modules
  const [reportVoiceSubTab, setReportVoiceSubTab] = useState('upload');
  const [aiExtractionSubTab, setAiExtractionSubTab] = useState('structured-fields');
  const [activityLinkingSubTab, setActivityLinkingSubTab] = useState('linking');
  const [confidenceEvidenceSubTab, setConfidenceEvidenceSubTab] = useState('validation');
  const [scheduleUpdateSubTab, setScheduleUpdateSubTab] = useState('update');
  const [progressDelaysSubTab, setProgressDelaysSubTab] = useState('progress-overview');
  const [actionWhatIfSubTab, setActionWhatIfSubTab] = useState('decision-center');

  // Synchronize incoming activeStage prop
  useEffect(() => {
    if (!activeStage) return;
    const clean = String(activeStage).toLowerCase().trim();
    const canonical = normalizeWorkflowSection(clean);
    setActiveTab(canonical);

    // Map sub-tabs based on specific target
    if (['upload', 'excel', 'excel-upload', 'excel-ingestion'].includes(clean)) setReportVoiceSubTab('upload');
    else if (['daily-report', 'daily-reports'].includes(clean)) setReportVoiceSubTab('daily-report');
    else if (['site-diary', 'site-diaries'].includes(clean)) setReportVoiceSubTab('site-diary');
    else if (['document', 'documents'].includes(clean)) setReportVoiceSubTab('document');
    else if (['photo-evidence', 'photos'].includes(clean)) setReportVoiceSubTab('photo-evidence');
    else if (['asr', 'voice'].includes(clean)) setReportVoiceSubTab('asr');
    else if (['execution-capture', 'execution-events', 'time-agent'].includes(clean)) setReportVoiceSubTab('execution-capture');

    else if (['structured-fields', 'activity-extraction', 'extraction'].includes(clean)) setAiExtractionSubTab('structured-fields');
    else if (['normalization', 'activity-normalization'].includes(clean)) setAiExtractionSubTab('normalization');
    else if (['ocr', 'ocr-extraction'].includes(clean)) setAiExtractionSubTab('ocr');
    else if (['asr-extraction'].includes(clean)) setAiExtractionSubTab('asr');
    else if (['nlp-documents'].includes(clean)) setAiExtractionSubTab('nlp-documents');

    else if (['linking', 'schedule-linking'].includes(clean)) setActivityLinkingSubTab('linking');
    else if (['exact-matching', 'matching'].includes(clean)) setActivityLinkingSubTab('exact-matching');
    else if (['fuzzy-matching', 'fuzzy'].includes(clean)) setActivityLinkingSubTab('fuzzy-matching');
    else if (['semantic-matching', 'semantic'].includes(clean)) setActivityLinkingSubTab('semantic-matching');
    else if (['granularity'].includes(clean)) setActivityLinkingSubTab('granularity');
    else if (['discovery', 'new-activity-discovery'].includes(clean)) setActivityLinkingSubTab('discovery');

    else if (['validation', 'confidence-validation'].includes(clean)) setConfidenceEvidenceSubTab('validation');
    else if (['contradictions', 'risks'].includes(clean)) setConfidenceEvidenceSubTab('contradictions');
    else if (['audit-trail', 'evidence'].includes(clean)) setConfidenceEvidenceSubTab('audit-trail');

    else if (['update', 'validated-update', 'schedule-update'].includes(clean)) setScheduleUpdateSubTab('update');
    else if (['critical-path', 'schedule-analysis'].includes(clean)) setScheduleUpdateSubTab('critical-path');
    else if (['dependencies', 'schedule-dependencies'].includes(clean)) setScheduleUpdateSubTab('dependencies');
    else if (['schedule-ingestion', 'primavera-msp'].includes(clean)) setScheduleUpdateSubTab('schedule-ingestion');

    else if (['progress-overview', 'overview', 'progress', 'progress-analysis'].includes(clean)) setProgressDelaysSubTab('progress-overview');
    else if (['delay-detection', 'delays', 'delay-variance', 'progress-delays'].includes(clean)) setProgressDelaysSubTab('delay-detection');
    else if (['delay-prediction'].includes(clean)) setProgressDelaysSubTab('delay-prediction');
    else if (['root-cause', 'root-cause-analysis'].includes(clean)) setProgressDelaysSubTab('root-cause');
    else if (['schedule-health', 'milestones', 'milestone-forecasting'].includes(clean)) setProgressDelaysSubTab('schedule-health');

    else if (['decision-center', 'decisions'].includes(clean)) setActionWhatIfSubTab('decision-center');
    else if (['recommendations'].includes(clean)) setActionWhatIfSubTab('recommendations');
    else if (['what-if'].includes(clean)) setActionWhatIfSubTab('what-if');
    else if (['impact-propagation'].includes(clean)) setActionWhatIfSubTab('impact-propagation');
    else if (['recovery-plans', 'recovery'].includes(clean)) setActionWhatIfSubTab('recovery-plans');
  }, [activeStage]);

  const handleSelectSection = (sectionId) => {
    const canonical = normalizeWorkflowSection(sectionId);
    setActiveTab(canonical);
    if (onStageChange) onStageChange(sectionId);
  };

  // Derive active execution file safely
  const contextFiles = projectContext?.files || projectContext?.files_processed || [];
  const selectedFile =
    contextFiles.length > 0
      ? (typeof contextFiles[0] === 'string' ? contextFiles[0] : (contextFiles[0]?.filename || contextFiles[0]?.name))
      : null;

  // Derive Discipline stats for Overview
  const projectActivities = projectContext?.activities || [];
  const disciplineStats = projectActivities.reduce((acc, act) => {
    const disc = act.discipline || 'General';
    if (!acc[disc]) {
      acc[disc] = { total: 0, progressSum: 0, completed: 0, delayed: 0 };
    }
    acc[disc].total += 1;
    acc[disc].progressSum += Number(act.progress || 0);
    const s = mapToSimpleStatus(act.status);
    if (s === 'Completed') acc[disc].completed += 1;
    if (s === 'Delayed') acc[disc].delayed += 1;
    return acc;
  }, {});

  // Sub-Navigation Tab Button Helper
  const renderSubTabs = (tabs, activeSubTab, setSubTab) => (
    <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-lg p-1.5 flex items-center space-x-1 overflow-x-auto scrollbar-thin shadow-2xs">
      {tabs.map((tab) => {
        const isCurrent = activeSubTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs rounded font-medium transition-colors cursor-pointer whitespace-nowrap ${
              isCurrent
                ? 'bg-brand-600 text-white shadow-xs font-semibold'
                : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-[#252525] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {Icon && <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-white' : 'text-slate-400 dark:text-neutral-400'}`} />}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );

  // Reusable Clean Empty State for analytical pipeline stages
  const renderEmptyState = (sectionName) => (
    <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-xl p-12 text-center shadow-sm max-w-2xl mx-auto my-6">
      <div className="w-14 h-14 bg-slate-100 dark:bg-[#252525] rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500 dark:text-neutral-400">
        <Briefcase className="w-7 h-7 text-slate-400 dark:text-neutral-500" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-neutral-100 mb-2">
        No Active Project Loaded
      </h3>
      <p className="text-sm text-slate-500 dark:text-neutral-400 mb-6 leading-relaxed max-w-md mx-auto">
        Upload and process project documents (schedules, daily reports, site diaries, or spreadsheets) in <strong>Report / Voice</strong> to populate {sectionName}.
      </p>
      <button
        type="button"
        onClick={() => setActiveTab('report-voice')}
        className="inline-flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
      >
        Go to Report / Voice →
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Primary Canonical 9-Stage Horizontal Workflow Navigation */}
      <HorizontalWorkflowNav
        activeSection={activeTab}
        onSelectSection={handleSelectSection}
        userRole={userRole}
      />

      {/* =========================================================================
          SECTION 1: REPORT / VOICE
         ========================================================================= */}
      {activeTab === 'report-voice' && (
        <div className="space-y-6">
          {renderSubTabs([
            { id: 'upload', label: 'Upload & Files', icon: FileText },
            { id: 'daily-report', label: 'Daily Reports', icon: ClipboardList },
            { id: 'site-diary', label: 'Site Diaries', icon: BookOpen },
            { id: 'document', label: 'Documents', icon: FileCheck },
            { id: 'photo-evidence', label: 'Field Photos', icon: Camera },
            { id: 'asr', label: 'Voice / ASR', icon: Mic },
            { id: 'execution-capture', label: 'Execution Events', icon: Clock },
          ], reportVoiceSubTab, setReportVoiceSubTab)}

          {reportVoiceSubTab === 'daily-report' ? (
            <DailyReportViewer />
          ) : reportVoiceSubTab === 'site-diary' ? (
            <SiteDiaryViewer />
          ) : reportVoiceSubTab === 'document' ? (
            <DocumentViewer />
          ) : reportVoiceSubTab === 'photo-evidence' ? (
            <PhotoEvidenceViewer />
          ) : reportVoiceSubTab === 'asr' ? (
            <ASRViewer />
          ) : reportVoiceSubTab === 'execution-capture' ? (
            <ExecutionCaptureViewer projectContext={projectContext} selectedFile={selectedFile} />
          ) : (
            <ExcelUpload
              projectContext={projectContext}
              onResultUpdate={onResultUpdate}
              onUploadSuccess={onResultUpdate}
            />
          )}
        </div>
      )}

      {/* =========================================================================
          SECTION 2: AI EXTRACTION
         ========================================================================= */}
      {activeTab === 'ai-extraction' && (
        !projectContext ? (
          renderEmptyState('AI Extraction intelligence')
        ) : (
          <div className="space-y-6">
            {renderSubTabs([
              { id: 'structured-fields', label: 'Structured Fields', icon: ListTodo },
              { id: 'normalization', label: 'Activity Normalization', icon: Cpu },
              { id: 'ocr', label: 'OCR Extraction', icon: ScanText },
              { id: 'asr', label: 'ASR Audio Parsing', icon: Mic },
              { id: 'nlp-documents', label: 'Document Parsing', icon: FileCheck },
            ], aiExtractionSubTab, setAiExtractionSubTab)}

            {aiExtractionSubTab === 'normalization' ? (
              <NormalizedActivityViewer />
            ) : aiExtractionSubTab === 'ocr' ? (
              <OCRViewer />
            ) : aiExtractionSubTab === 'asr' ? (
              <ASRViewer />
            ) : aiExtractionSubTab === 'nlp-documents' ? (
              <DocumentViewer />
            ) : (
              <ScheduleActivityViewer />
            )}
          </div>
        )
      )}

      {/* =========================================================================
          SECTION 3: ACTIVITY LINKING
         ========================================================================= */}
      {activeTab === 'activity-linking' && (
        !projectContext ? (
          renderEmptyState('Activity Linking pipeline')
        ) : (
          <div className="space-y-6">
            {renderSubTabs([
              { id: 'linking', label: 'Schedule Linking (L5/L6)', icon: Link2 },
              { id: 'exact-matching', label: 'Exact Matching', icon: Target },
              { id: 'fuzzy-matching', label: 'Fuzzy Matching', icon: ListTodo },
              { id: 'semantic-matching', label: 'Semantic Matching', icon: Cpu },
              { id: 'granularity', label: 'Granularity Resolution', icon: GitBranch },
              { id: 'discovery', label: 'Activity Discovery', icon: Sparkles },
            ], activityLinkingSubTab, setActivityLinkingSubTab)}

            {activityLinkingSubTab === 'exact-matching' ? (
              <ExactIdMatchingViewer executionFile={selectedFile} projectContext={projectContext} />
            ) : activityLinkingSubTab === 'fuzzy-matching' ? (
              <FuzzyMatchingViewer executionFile={selectedFile} projectContext={projectContext} />
            ) : activityLinkingSubTab === 'semantic-matching' ? (
              <SemanticMatchingViewer executionFile={selectedFile} projectContext={projectContext} />
            ) : activityLinkingSubTab === 'granularity' ? (
              <GranularityResolutionViewer executionFile={selectedFile} projectContext={projectContext} />
            ) : activityLinkingSubTab === 'discovery' ? (
              <NewActivityDiscoveryViewer executionFile={selectedFile} projectContext={projectContext} />
            ) : (
              <ScheduleLinkingViewer executionFile={selectedFile} projectContext={projectContext} />
            )}
          </div>
        )
      )}

      {/* =========================================================================
          SECTION 4: CONFIDENCE & EVIDENCE
         ========================================================================= */}
      {activeTab === 'confidence-evidence' && (
        !projectContext ? (
          renderEmptyState('Confidence & Evidence Governance')
        ) : (
          <div className="space-y-6">
            {renderSubTabs([
              { id: 'validation', label: 'Confidence Validation', icon: ShieldCheck },
              { id: 'contradictions', label: 'Contradiction Detection', icon: AlertTriangle },
              { id: 'audit-trail', label: 'Evidence & Audit Trail', icon: FileCheck },
            ], confidenceEvidenceSubTab, setConfidenceEvidenceSubTab)}

            {confidenceEvidenceSubTab === 'contradictions' ? (
              <ContradictionViewer projectContext={projectContext} />
            ) : confidenceEvidenceSubTab === 'audit-trail' ? (
              <ContradictionViewer defaultShowAudit={true} projectContext={projectContext} />
            ) : (
              <ConfidenceValidationViewer executionFile={selectedFile} projectContext={projectContext} />
            )}
          </div>
        )
      )}

      {/* =========================================================================
          SECTION 5: HUMAN REVIEW
         ========================================================================= */}
      {activeTab === 'human-review' && (
        !projectContext ? (
          renderEmptyState('Human Review & Planner Governance')
        ) : (
          <PlannerReviewViewer executionFile={selectedFile} projectContext={projectContext} />
        )
      )}

      {/* =========================================================================
          SECTION 6: SCHEDULE UPDATE
         ========================================================================= */}
      {activeTab === 'schedule-update' && (
        !projectContext ? (
          renderEmptyState('Schedule Update intelligence')
        ) : (
          <div className="space-y-6">
            {renderSubTabs([
              { id: 'update', label: 'Validated Schedule Update', icon: CalendarRange },
              { id: 'critical-path', label: 'Critical Path Analysis', icon: Network },
              { id: 'dependencies', label: 'Schedule Dependencies', icon: GitBranch },
              { id: 'schedule-ingestion', label: 'Multi-Source Schedule Ingestion', icon: FileCheck },
            ], scheduleUpdateSubTab, setScheduleUpdateSubTab)}

            {scheduleUpdateSubTab === 'critical-path' ? (
              <CriticalPathViewer executionFile={selectedFile} projectContext={projectContext} />
            ) : scheduleUpdateSubTab === 'dependencies' ? (
              <ScheduleDependenciesViewer executionFile={selectedFile} projectContext={projectContext} />
            ) : scheduleUpdateSubTab === 'schedule-ingestion' ? (
              <ScheduleIngestionViewer />
            ) : (
              <ValidatedScheduleUpdateViewer projectContext={projectContext} />
            )}
          </div>
        )
      )}

      {/* =========================================================================
          SECTION 7: PROGRESS / DELAY / RISK
         ========================================================================= */}
      {activeTab === 'progress-delay-risk' && (
        !projectContext ? (
          renderEmptyState('Progress, Delay & Risk intelligence')
        ) : (
          <div className="space-y-6">
            {renderSubTabs([
              { id: 'progress-overview', label: 'Progress Overview', icon: BarChart3 },
              { id: 'delay-detection', label: 'Delay Detection & Variance', icon: AlertOctagon },
              { id: 'delay-prediction', label: 'Predictive Delay Modeling', icon: TrendingUp },
              { id: 'root-cause', label: 'Root Cause Analysis', icon: Lightbulb },
              { id: 'schedule-health', label: 'Schedule Health & Milestones', icon: Milestone },
            ], progressDelaysSubTab, setProgressDelaysSubTab)}

            {progressDelaysSubTab === 'delay-detection' ? (
              <DelayDetectionViewer executionFile={selectedFile} projectContext={projectContext} />
            ) : progressDelaysSubTab === 'delay-prediction' ? (
              <DelayPredictionViewer executionFile={selectedFile} projectContext={projectContext} />
            ) : progressDelaysSubTab === 'root-cause' ? (
              <RootCauseAnalysisViewer executionFile={selectedFile} projectContext={projectContext} />
            ) : progressDelaysSubTab === 'schedule-health' ? (
              <ScheduleHealthViewer initialView="milestones" executionFile={selectedFile} projectContext={projectContext} />
            ) : (
              /* Progress Overview Cards & Discipline Breakdown */
              <div className="space-y-6">
                {/* Executive Intelligence Header Card */}
                <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-lg p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-200 dark:border-emerald-800/50 mb-2">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Executive Progress & Variance Intelligence</span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-neutral-100">
                        {projectContext?.project_name || 'Project Execution & Delay Intelligence'}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
                        Synthesized executive progress across {projectContext?.files_processed?.length || 1} project file(s)
                      </p>
                    </div>

                    {onNavigateToProjectIntelligence && (
                      <button
                        type="button"
                        onClick={onNavigateToProjectIntelligence}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                      >
                        <span>Manage Project Files</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Demo Fallback Data Notice */}
                {projectContext?.is_fallback && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-lg p-3.5 flex items-center space-x-3 text-xs text-blue-800 dark:text-blue-300 shadow-2xs">
                    <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <span>
                      <strong>Demo Fallback Data Mode:</strong> Displaying realistic cross-discipline engineering dataset generated from uploaded file for pipeline evaluation.
                    </span>
                  </div>
                )}

                {/* Top Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
                  <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-lg p-4 shadow-sm">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
                      Identified
                    </span>
                    <div className="text-2xl font-bold text-slate-900 dark:text-neutral-100 mt-2 font-mono">
                      {projectActivities.length || projectContext?.summary?.activities_identified || 0}
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-neutral-500 mt-0.5 block">Execution Activities</span>
                  </div>

                  <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-lg p-4 shadow-sm">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
                      Matched
                    </span>
                    <div className="text-2xl font-bold text-brand-600 dark:text-brand-400 mt-2 font-mono">
                      {projectActivities.filter(a => a.is_matched).length || projectContext?.summary?.activities_matched || 0}
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-neutral-500 mt-0.5 block">Linked to L6 Schedule</span>
                  </div>

                  <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-lg p-4 shadow-sm">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
                      Avg Progress
                    </span>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
                      {projectActivities.length > 0
                        ? `${(projectActivities.reduce((s, a) => s + (Number(a.progress) || 0), 0) / projectActivities.length).toFixed(1)}%`
                        : (projectContext?.summary?.overall_progress ? `${projectContext.summary.overall_progress}%` : '0%')}
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-neutral-500 mt-0.5 block">Physical Completion</span>
                  </div>

                  <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-lg p-4 shadow-sm">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
                      Delayed
                    </span>
                    <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2 font-mono">
                      {projectActivities.filter(a => mapToSimpleStatus(a.status) === 'Delayed' || a.variance_status === 'BEHIND').length ||
                       projectContext?.delay_analysis?.total_delayed ||
                       projectContext?.summary?.delayed_activities || 0}
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-neutral-500 mt-0.5 block">Behind Baseline</span>
                  </div>

                  <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-lg p-4 shadow-sm col-span-2 sm:col-span-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
                      Critical Delays
                    </span>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2 font-mono">
                      {projectActivities.filter(a => a.is_critical && (mapToSimpleStatus(a.status) === 'Delayed' || a.variance_status === 'BEHIND')).length ||
                       projectContext?.schedule_health?.critical_delays || 0}
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-neutral-500 mt-0.5 block">Zero Float Impact</span>
                  </div>
                </div>

                {/* Discipline Progress Summary Cards */}
                {Object.keys(disciplineStats).length > 0 && (
                  <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-lg p-6 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-neutral-100 uppercase tracking-wider mb-4">
                      Discipline Progress & Variance Breakdown
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(disciplineStats).map(([disc, stats]) => {
                        const avg = stats.total > 0 ? (stats.progressSum / stats.total).toFixed(1) : 0;
                        return (
                          <div
                            key={disc}
                            className="p-4 rounded-lg border border-slate-200 dark:border-[#323232] bg-slate-50/50 dark:bg-[#202020] space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getDisciplineBadge(disc)}`}>
                                {disc}
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-800 dark:text-neutral-200">
                                {avg}%
                              </span>
                            </div>

                            <div className="w-full bg-slate-200 dark:bg-[#333333] h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-brand-600 h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(Number(avg), 100)}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-neutral-400 pt-1">
                              <span>Total: <strong>{stats.total}</strong></span>
                              <span>Completed: <strong className="text-emerald-600 dark:text-emerald-400">{stats.completed}</strong></span>
                              <span>Delayed: <strong className={stats.delayed > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-neutral-300'}>{stats.delayed}</strong></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      )}

      {/* =========================================================================
          SECTION 8: ACTION / WHAT-IF
         ========================================================================= */}
      {activeTab === 'action-what-if' && (
        !projectContext ? (
          renderEmptyState('Action & What-If Decision Intelligence')
        ) : (
          <div className="space-y-6">
            {renderSubTabs([
              { id: 'decision-center', label: 'Decision Center Cockpit', icon: Cpu },
              { id: 'recommendations', label: 'AI Recommendations', icon: Lightbulb },
              { id: 'what-if', label: 'What-If Simulator', icon: SlidersHorizontal },
              { id: 'impact-propagation', label: 'Impact Propagation DAG', icon: GitBranch },
              { id: 'recovery-plans', label: 'Recovery Plans', icon: RefreshCw },
            ], actionWhatIfSubTab, setActionWhatIfSubTab)}

            {actionWhatIfSubTab === 'recommendations' ? (
              <RecommendationsViewer executionFile={selectedFile} projectContext={projectContext} />
            ) : actionWhatIfSubTab === 'what-if' ? (
              <WhatIfSimulatorViewer executionFile={selectedFile} projectContext={projectContext} />
            ) : actionWhatIfSubTab === 'impact-propagation' ? (
              <ImpactPropagationViewer executionFile={selectedFile} projectContext={projectContext} />
            ) : actionWhatIfSubTab === 'recovery-plans' ? (
              <RecoveryPlansViewer executionFile={selectedFile} projectContext={projectContext} />
            ) : (
              <DecisionCenterViewer selectedFile={selectedFile} projectContext={projectContext} />
            )}
          </div>
        )
      )}

      {/* =========================================================================
          SECTION 9: INSTITUTIONAL MEMORY
         ========================================================================= */}
      {activeTab === 'institutional-memory' && (
        !projectContext ? (
          renderEmptyState('Institutional Memory')
        ) : (
          <InstitutionalMemoryViewer />
        )
      )}
    </div>
  );
}
