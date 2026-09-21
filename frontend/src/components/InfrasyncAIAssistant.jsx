import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Info
} from 'lucide-react';

export default function InfrasyncAIAssistant({ context }) {
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

  // Fetch initial suggested questions & engine status when context changes
  useEffect(() => {
    if (!context) return;

    // Fetch dynamic suggestions
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
        console.warn('Failed to fetch suggestions from backend:', err);
      }
    };

    // Check engine status
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
        // Local engine offline
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
    const userMessage = { role: 'user', content: question, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    
    // Optimistically update conversation
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
      setErrorMessage('Infrasync AI is currently unavailable because the local AI engine is not running. Please verify your local environment and try again.');
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

  return (
    <div className="infrasync-ai-card bg-white border border-slate-200 rounded-lg shadow-sm p-6 space-y-5 transition-colors">
      {/* Header */}
      <div className="pb-4 border-b border-slate-100 flex items-start justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-slate-900 text-white rounded">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 tracking-tight">Infrasync AI</h3>
            <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-semibold">
              Context-Aware Assistant
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Ask questions about your project execution, schedule, delays, and risks.
          </p>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
            title="Reset conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Offline Alert Banner if applicable */}
      {errorMessage && (
        <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-start space-x-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <p className="font-semibold text-amber-900">Engine Notice</p>
            <p className="mt-0.5 text-amber-800">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Suggested Questions (Dynamic) */}
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
                className="infrasync-ai-suggestion-pill text-xs px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-medium transition-colors text-left disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation Thread */}
      {messages.length > 0 && (
        <div className="space-y-4 pt-2 border-t border-slate-100 max-h-[480px] overflow-y-auto pr-1">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center space-x-1.5 mb-1 text-[11px] text-slate-400">
                <span className="font-semibold">
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
                className={`max-w-[88%] rounded-lg p-3.5 text-xs leading-relaxed ${
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
                <span className="font-semibold">Infrasync AI</span>
              </div>
              <div className="infrasync-ai-loading-bubble bg-slate-50 border border-slate-200 text-slate-600 rounded-lg p-3.5 text-xs flex items-center space-x-2.5">
                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                <span className="font-medium text-slate-700">Infrasync AI is analyzing the project context...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input Area */}
      <div className="pt-2 border-t border-slate-100">
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
            className="infrasync-ai-submit-btn px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span>Ask</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-400">
          <span>Answers are strictly grounded in uploaded project evidence (zero fabrication).</span>
          <span className="font-mono text-[10px]">v1.0.0-final</span>
        </div>
      </div>
    </div>
  );
}
