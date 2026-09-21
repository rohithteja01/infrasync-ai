import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  FileCheck,
  CheckCircle2,
  CalendarRange,
  Activity,
  AlertTriangle,
  Layers,
  FileText
} from 'lucide-react';

export default function InfrasyncAIView({ context, onNavigateToProjectIntelligence }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [engineStatus, setEngineStatus] = useState({ online: true, model: '' });
  const [errorMessage, setErrorMessage] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Track context to reset conversation on project removal or project change
  const prevContextRef = useRef(context);
  useEffect(() => {
    if (prevContextRef.current !== context) {
      setMessages([]);
      setErrorMessage(null);
      setInputValue('');
      prevContextRef.current = context;
    }
  }, [context]);

  // Fetch dynamic suggestions & engine status whenever context changes
  useEffect(() => {
    if (!context) {
      setSuggestedQuestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        const res = await fetch('/api/ingestion/assistant/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.suggestions && data.suggestions.length > 0) {
            setSuggestedQuestions(data.suggestions);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch suggestions:', err);
      }
    };

    const checkStatus = async () => {
      try {
        const res = await fetch('/api/ingestion/assistant/status');
        if (res.ok) {
          const data = await res.json();
          setEngineStatus({
            online: data.ollama_available,
            model: data.model || 'gemma4:26b'
          });
        }
      } catch {
        setEngineStatus({ online: false, model: '' });
      }
    };

    fetchSuggestions();
    checkStatus();
  }, [context]);

  const handleSendMessage = async (textToSend) => {
    const question = (textToSend || inputValue).trim();
    if (!question || isLoading) return;

    setErrorMessage(null);
    const userMessage = {
      role: 'user',
      content: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInputValue('');
    setIsLoading(true);

    try {
      const payload = {
        message: question,
        context: context || {},
        history: updatedHistory.map((m) => ({ role: m.role, content: m.content })),
        force_offline_error: false
      };

      const res = await fetch('/api/ingestion/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.status === 'unavailable') {
        setErrorMessage(data.answer);
      }

      const assistantMessage = {
        role: 'assistant',
        content: data.answer || 'No response returned.',
        engine: data.engine || 'Infrasync AI',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Error querying Infrasync AI:', err);
      setErrorMessage(
        'Infrasync AI is currently unavailable because the local AI engine is not running. Please ensure Ollama is started locally on your device to enable conversational AI.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    handleSendMessage(suggestion);
  };

  const handleReset = () => {
    setMessages([]);
    setErrorMessage(null);
  };

  // Helper summary metrics from current context
  const hasSchedule = Boolean(context?.has_schedule);
  const filesList = context?.files_processed || [];
  const activitiesCount = context?.summary?.activities_identified || context?.activities?.length || 0;
  const healthStatus = context?.schedule_health?.overall_health || (hasSchedule ? 'HEALTHY' : 'BASELINE REQUIRED');
  const delayedCount = context?.summary?.delayed_activities || 0;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="infrasync-ai-card bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded mb-2 border border-brand-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Project Intelligence Conversational Layer</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Infrasync AI</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Ask questions about your project execution, schedule, delays, and risks.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Conversation</span>
            </button>
          )}
          <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
            v1.0.0-final
          </span>
        </div>
      </div>

      {/* =========================================================================
          STATE 1: EMPTY STATE (NO PROJECT CONTEXT AVAILABLE YET)
         ========================================================================= */}
      {!context ? (
        <div className="infrasync-ai-card bg-white border border-slate-200 rounded-lg p-10 shadow-sm text-center max-w-3xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center mx-auto shadow-2xs">
            <Sparkles className="w-8 h-8 text-slate-500" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">No project context is available yet.</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Upload and process project data in Project Intelligence to start asking project-specific questions.
            </p>
          </div>

          <div className="pt-3">
            <button
              type="button"
              onClick={onNavigateToProjectIntelligence}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <span>Go to Project Intelligence</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400">
            <span>Infrasync AI strictly avoids fabricating answers and only operates on verified project evidence.</span>
          </div>
        </div>
      ) : (
        /* =========================================================================
           STATE 2: ACTIVE PROJECT CONTEXT & CONVERSATIONAL INTERFACE
           ========================================================================= */
        <div className="space-y-6">
          {/* Active Project Context Status Bar */}
          <div className="infrasync-ai-card bg-white border border-slate-200 rounded-lg p-4 shadow-sm text-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-slate-900">Active Project Context Loaded</span>
                <span className="text-[11px] text-slate-400">({filesList.length} file(s) analyzed)</span>
              </div>
              <div className="text-[11px] text-slate-500">
                All answers are grounded strictly in this uploaded project evidence (zero fabrication).
              </div>
            </div>

            {/* Context Summary Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded border border-slate-200 bg-slate-50 flex items-center space-x-2">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Activities</div>
                  <div className="font-bold text-slate-800 font-mono text-xs">{activitiesCount} Extracted</div>
                </div>
              </div>

              <div className="p-2.5 rounded border border-slate-200 bg-slate-50 flex items-center space-x-2">
                <CalendarRange className="w-3.5 h-3.5 text-purple-600" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Baseline Schedule</div>
                  <div className="font-bold text-slate-800 text-xs">{hasSchedule ? 'Connected' : 'No Schedule'}</div>
                </div>
              </div>

              <div className="p-2.5 rounded border border-slate-200 bg-slate-50 flex items-center space-x-2">
                <Activity className="w-3.5 h-3.5 text-indigo-600" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Schedule Health</div>
                  <div className={`font-bold text-xs ${healthStatus === 'CRITICAL' ? 'text-rose-700' : 'text-slate-800'}`}>
                    {healthStatus}
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded border border-slate-200 bg-slate-50 flex items-center space-x-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Delays Detected</div>
                  <div className="font-bold text-slate-800 font-mono text-xs">{delayedCount} Activity(ies)</div>
                </div>
              </div>
            </div>

            {/* Sources List */}
            {filesList.length > 0 && (
              <div className="flex items-center space-x-2 text-[11px] text-slate-500 pt-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate">
                  Sources: {filesList.map((f) => f.filename).join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Assistant Chat Card */}
          <div className="infrasync-ai-card bg-white border border-slate-200 rounded-lg shadow-sm p-6 space-y-5">
            {/* Offline Alert Banner */}
            {errorMessage && (
              <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">
                  <p className="font-semibold text-amber-900">Engine Notice</p>
                  <p className="mt-0.5 text-amber-800">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Dynamic Suggested Questions */}
            {suggestedQuestions.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Suggested Questions for this Project Context</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSuggestionClick(q)}
                      disabled={isLoading}
                      className="infrasync-ai-suggestion-pill text-xs px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-medium transition-colors text-left disabled:opacity-50 cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation Thread */}
            {messages.length > 0 ? (
              <div className="space-y-4 pt-3 border-t border-slate-100 max-h-[500px] overflow-y-auto pr-1">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1 text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-600">
                        {m.role === 'user' ? 'You' : 'Infrasync AI'}
                      </span>
                      <span>•</span>
                      <span>{m.timestamp}</span>
                      {m.engine && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-[10px] text-slate-500">{m.engine}</span>
                        </>
                      )}
                    </div>

                    <div
                      className={`max-w-[88%] rounded-lg p-4 text-xs leading-relaxed ${
                        m.role === 'user'
                          ? 'infrasync-ai-user-bubble bg-slate-900 text-white shadow-sm'
                          : 'infrasync-ai-bot-bubble bg-slate-50 border border-slate-200 text-slate-800 shadow-sm'
                      }`}
                    >
                      <div className="whitespace-pre-wrap font-sans space-y-1">
                        {m.content}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Loading Indicator */}
                {isLoading && (
                  <div className="flex flex-col items-start">
                    <div className="flex items-center space-x-1.5 mb-1 text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-600">Infrasync AI</span>
                    </div>
                    <div className="infrasync-ai-loading-bubble bg-slate-50 border border-slate-200 text-slate-600 rounded-lg p-3.5 text-xs flex items-center space-x-2.5">
                      <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                      <span className="font-medium text-slate-700">
                        Infrasync AI is analyzing the project context...
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 border-t border-slate-100">
                Click a suggested question above or type below to inquire about activities, delays, and schedule health.
              </div>
            )}

            {/* Input Area */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center space-x-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  placeholder="Ask Infrasync AI about this project..."
                  className="infrasync-ai-input flex-1 text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !inputValue.trim()}
                  className="infrasync-ai-submit-btn px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <span>Ask</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-400">
                <span>Answers are strictly grounded in uploaded project evidence (zero fabrication).</span>
                <span className="font-mono text-[10px]">localhost:11434</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
