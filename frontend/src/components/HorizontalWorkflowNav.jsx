import React from 'react';
import {
  FileText,
  Cpu,
  Link2,
  ShieldCheck,
  UserCheck,
  CalendarRange,
  AlertOctagon,
  Lightbulb,
  BookMarked
} from 'lucide-react';

/**
 * Canonical 9-Stage Primary Horizontal Workflow Navigation for OIL AI Project Intelligence.
 * Strictly aligned with SIH Problem Statement workflow specifications.
 */
export const WORKFLOW_SECTIONS = [
  {
    step: 1,
    id: 'report-voice',
    label: 'Report / Voice',
    icon: FileText,
    description: 'Data upload, DPRs, site diaries, documents, photos & voice ingestion'
  },
  {
    step: 2,
    id: 'ai-extraction',
    label: 'AI Extraction',
    icon: Cpu,
    description: 'OCR, ASR, NLP document parsing & canonical normalization'
  },
  {
    step: 3,
    id: 'activity-linking',
    label: 'Activity Linking',
    icon: Link2,
    description: 'L5/L6 schedule mapping, exact, fuzzy, semantic & granularity resolution'
  },
  {
    step: 4,
    id: 'confidence-evidence',
    label: 'Confidence & Evidence',
    icon: ShieldCheck,
    description: 'Validation confidence scores, evidence & contradiction detection'
  },
  {
    step: 5,
    id: 'human-review',
    label: 'Human Review',
    icon: UserCheck,
    description: 'Planner review cockpit, low-confidence & unmatched activity governance'
  },
  {
    step: 6,
    id: 'schedule-update',
    label: 'Schedule Update',
    icon: CalendarRange,
    description: 'Planned vs actual updates, dependencies, CPM & critical path'
  },
  {
    step: 7,
    id: 'progress-delay-risk',
    label: 'Progress / Delay / Risk',
    icon: AlertOctagon,
    description: 'Physical variance, delay detection, predictive ML risk & root cause'
  },
  {
    step: 8,
    id: 'action-what-if',
    label: 'Action / What-if',
    icon: Lightbulb,
    description: 'Decision center, recommendations, what-if simulator & recovery plans'
  },
  {
    step: 9,
    id: 'institutional-memory',
    label: 'Institutional Memory',
    icon: BookMarked,
    description: 'Historical actuals, productivity, delay patterns & cross-project learning'
  }
];

/**
 * Normalizes any legacy or sub-view ID into one of the 9 canonical primary workflow sections.
 */
export function normalizeWorkflowSection(id) {
  if (!id) return 'report-voice';
  const clean = String(id).toLowerCase().trim();

  // 1. Report / Voice
  if ([
    'report-voice', 'upload', 'data-processing', 'excel', 'excel-upload',
    'excel-ingestion', 'daily-report', 'daily-reports', 'site-diary', 'site-diaries',
    'document', 'documents', 'photo-evidence', 'photos', 'asr', 'voice',
    'execution-capture', 'execution-events'
  ].includes(clean)) {
    return 'report-voice';
  }

  // 2. AI Extraction
  if ([
    'ai-extraction', 'extraction', 'activity-extraction', 'normalization',
    'activity-normalization', 'schedule-activity', 'ocr', 'ocr-extraction'
  ].includes(clean)) {
    return 'ai-extraction';
  }

  // 3. Activity Linking
  if ([
    'activity-linking', 'schedule-linking', 'exact-matching', 'matching',
    'fuzzy-matching', 'fuzzy', 'semantic-matching', 'semantic',
    'granularity', 'discovery', 'new-activity-discovery', 'activity-intelligence'
  ].includes(clean)) {
    return 'activity-linking';
  }

  // 4. Confidence & Evidence
  if ([
    'confidence-evidence', 'validation', 'confidence-validation',
    'validation-governance', 'contradictions', 'risks', 'audit-trail', 'evidence'
  ].includes(clean)) {
    return 'confidence-evidence';
  }

  // 5. Human Review
  if ([
    'human-review', 'planner-review', 'planner-governance', 'human-in-the-loop'
  ].includes(clean)) {
    return 'human-review';
  }

  // 6. Schedule Update
  if ([
    'schedule-update', 'schedule-analysis', 'critical-path',
    'schedule-dependencies', 'dependencies', 'schedule-ingestion', 'primavera-msp'
  ].includes(clean)) {
    return 'schedule-update';
  }

  // 7. Progress / Delay / Risk
  if ([
    'progress-delay-risk', 'overview', 'progress', 'progress-analysis',
    'progress-delays', 'delays', 'delay-detection', 'delay-prediction',
    'root-cause', 'root-cause-analysis', 'schedule-health', 'milestones',
    'milestone-forecasting'
  ].includes(clean)) {
    return 'progress-delay-risk';
  }

  // 8. Action / What-if
  if ([
    'action-what-if', 'what-if', 'impact-propagation', 'recovery-plans',
    'recovery', 'recommendations', 'decision-center', 'decisions',
    'ai-decision-intelligence'
  ].includes(clean)) {
    return 'action-what-if';
  }

  // 9. Institutional Memory
  if ([
    'institutional-memory', 'memory', 'knowledge-base', 'learning'
  ].includes(clean)) {
    return 'institutional-memory';
  }

  // Default to report-voice if unknown
  return 'report-voice';
}

// Backward compatibility helper
export function findAdvancedItem(id) {
  return null;
}

export const ROLE_WORKFLOW_STAGES = {
  SUPERVISOR: ['report-voice', 'ai-extraction', 'confidence-evidence', 'progress-delay-risk'],
  PLANNER: [
    'report-voice',
    'ai-extraction',
    'activity-linking',
    'confidence-evidence',
    'human-review',
    'schedule-update',
    'progress-delay-risk',
    'action-what-if',
    'institutional-memory'
  ],
  PROJECT_MANAGER: ['progress-delay-risk', 'action-what-if', 'institutional-memory']
};

export default function HorizontalWorkflowNav({
  activeSection = 'report-voice',
  onSelectSection,
  className = '',
  userRole = null
}) {
  const currentCanonical = normalizeWorkflowSection(activeSection);

  const allowedStageIds = userRole && ROLE_WORKFLOW_STAGES[userRole]
    ? ROLE_WORKFLOW_STAGES[userRole]
    : null;

  const visibleSections = allowedStageIds
    ? WORKFLOW_SECTIONS.filter((sec) => allowedStageIds.includes(sec.id))
    : WORKFLOW_SECTIONS;

  const handleSelect = (sectionId) => {
    if (onSelectSection) {
      onSelectSection(sectionId);
    }
  };

  const roleLabel = userRole === 'SUPERVISOR'
    ? 'Supervisor (Field Execution)'
    : userRole === 'PLANNER'
    ? 'Planner (All Stages)'
    : userRole === 'PROJECT_MANAGER'
    ? 'Project Manager (Executive Intelligence)'
    : null;

  return (
    <div className={`w-full ${className}`}>
      {/* Container with Project Branding + Dynamic Workflow Bar */}
      <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-xl shadow-xs overflow-hidden">
        {/* Subtle Brand Header */}
        <div className="px-4 py-2 border-b border-slate-100 dark:border-[#282828] bg-slate-50/75 dark:bg-[#161616] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="w-2 h-2 rounded-full bg-brand-600"></span>
            <span className="text-[11px] font-bold tracking-wider text-slate-800 dark:text-neutral-200 uppercase">
              OIL AI Project Intelligence
            </span>
            <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-mono hidden sm:inline">
              • Workflow Pipeline
            </span>
          </div>

          {roleLabel && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border font-medium bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
              {roleLabel}
            </span>
          )}
        </div>

        {/* Workflow Bar (Directly Visible, Horizontally Scrollable) */}
        <div className="p-1.5 overflow-x-auto scrollbar-thin">
          <nav
            aria-label="OIL AI Project Workflow"
            className="flex items-center flex-nowrap min-w-max space-x-1"
          >
            {visibleSections.map((sec) => {
              const Icon = sec.icon;
              const isActive = currentCanonical === sec.id;

              return (
                <button
                  key={sec.id}
                  data-section={sec.id}
                  type="button"
                  onClick={() => handleSelect(sec.id)}
                  title={sec.description}
                  className={`flex items-center space-x-2 px-3 py-2 text-xs rounded-lg transition-all whitespace-nowrap cursor-pointer border ${
                    isActive
                      ? 'bg-brand-600 text-white font-semibold border-brand-700 shadow-xs'
                      : 'text-slate-600 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#252525] border-transparent font-medium'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 dark:text-neutral-400'}`} />
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
