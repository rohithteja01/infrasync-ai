import React, { useState, useEffect, useCallback, useRef } from 'react';
import { authFetch } from '../lib/apiClient';
import {
  Mic,
  Volume2,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  MapPin,
  Clock,
  Briefcase,
  Activity,
  ShieldCheck,
  Search,
  ChevronDown,
  AlertTriangle,
  FileCheck,
  Eye,
  Cpu,
  Layers,
  FileAudio,
  Radio,
  Square,
  Copy,
  Trash2,
  Check
} from 'lucide-react';

function getStatusBadge(status) {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'completed' || s === 'complete' || s === 'done') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (s === 'in progress' || s === 'in-progress' || s === 'ongoing' || s === 'executing') {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
  if (s === 'delayed' || s === 'behind' || s === 'critical') {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function getDisciplineBadge(discipline) {
  const d = String(discipline || '').toLowerCase();
  if (d.includes('civil')) return 'bg-amber-50 text-amber-800 border-amber-200';
  if (d.includes('piping') || d.includes('pipe')) return 'bg-cyan-50 text-cyan-800 border-cyan-200';
  if (d.includes('mech')) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (d.includes('struct')) return 'bg-indigo-50 text-indigo-800 border-indigo-200';
  if (d.includes('elec')) return 'bg-violet-50 text-violet-800 border-violet-200';
  if (d.includes('inst')) return 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200';
  return 'bg-slate-100 text-slate-800 border-slate-200';
}

export default function ASRViewer() {
  const [asrFilesList, setAsrFilesList] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [asrData, setAsrData] = useState(null);
  const [asrEngineStatus, setAsrEngineStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSegments, setShowSegments] = useState(false);

  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('ALL');

  const fileInputRef = useRef(null);

  // Live Voice Execution Capture states
  const [liveStatus, setLiveStatus] = useState('IDLE'); // 'IDLE' | 'LISTENING' | 'TRANSCRIBING' | 'COMPLETE' | 'ERROR'
  const [recordingTime, setRecordingTime] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [extractedEvent, setExtractedEvent] = useState(null);
  const [liveError, setLiveError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isFinalTranscript, setIsFinalTranscript] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const isProcessingChunkRef = useRef(false);
  const liveTranscriptRef = useRef('');

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const sendAudioChunk = async (isFinal = false) => {
    if (audioChunksRef.current.length === 0) {
      if (isFinal) {
        setLiveStatus('COMPLETE');
        setIsFinalTranscript(true);
      }
      return;
    }

    const mime = mediaRecorderRef.current?.mimeType || 'audio/webm';
    const blob = new Blob(audioChunksRef.current, { type: mime });
    if (blob.size === 0) return;

    let ext = '.webm';
    if (mime.includes('ogg')) ext = '.ogg';
    else if (mime.includes('mp4')) ext = '.m4a';
    else if (mime.includes('wav')) ext = '.wav';

    const formData = new FormData();
    formData.append('file', blob, `live_recording${ext}`);
    formData.append('is_final', isFinal ? 'true' : 'false');

    isProcessingChunkRef.current = true;
    if (!isFinal) {
      setLiveStatus('TRANSCRIBING');
    }

    try {
      const res = await authFetch('/api/ingestion/asr/live-chunk', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          setLiveTranscript(data.text);
          liveTranscriptRef.current = data.text;
        }
        if (data.extracted_event) {
          setExtractedEvent(data.extracted_event);
        }
        if (isFinal) {
          setLiveStatus('COMPLETE');
          setIsFinalTranscript(true);
        } else if (mediaRecorderRef.current?.state === 'recording') {
          setLiveStatus('LISTENING');
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (isFinal) {
          setLiveStatus('ERROR');
          setLiveError(errData.detail || `Local ASR transcription failed (HTTP ${res.status})`);
        }
      }
    } catch (err) {
      console.warn('Live chunk ASR error:', err);
      if (isFinal) {
        setLiveStatus('ERROR');
        setLiveError(`Network or ASR error: ${err.message}`);
      }
    } finally {
      isProcessingChunkRef.current = false;
    }
  };

  const startLiveRecording = async () => {
    setLiveError(null);
    setIsFinalTranscript(false);
    setLiveTranscript('');
    setExtractedEvent(null);
    audioChunksRef.current = [];
    liveTranscriptRef.current = '';

    if (localStorage.getItem('infrasync_mic_enabled') === 'false') {
      setLiveStatus('ERROR');
      setLiveError('Microphone access is disabled in Infrasync Settings. Please enable it in Settings.');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setLiveStatus('ERROR');
      setLiveError('Microphone access is not supported in this browser. Please use a modern browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      let options = {};
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          options = { mimeType: 'audio/ogg;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      setRecordingTime(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          if (!isProcessingChunkRef.current && mediaRecorder.state === 'recording') {
            await sendAudioChunk(false);
          }
        }
      };

      mediaRecorder.onstop = async () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }
        await sendAudioChunk(true);
      };

      mediaRecorder.start(2500);
      setLiveStatus('LISTENING');
    } catch (err) {
      console.error('Microphone access error:', err);
      setLiveStatus('ERROR');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setLiveError('Microphone permission was denied. Please enable microphone permissions in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setLiveError('No microphone detected. Please connect an audio input device.');
      } else {
        setLiveError(`Microphone error: ${err.message || 'Unable to start recording'}`);
      }
    }
  };

  const stopLiveRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      setLiveStatus('TRANSCRIBING');
      mediaRecorderRef.current.stop();
    }
  };

  const clearLiveTranscript = () => {
    setLiveTranscript('');
    setExtractedEvent(null);
    setLiveStatus('IDLE');
    setLiveError(null);
    setRecordingTime(0);
    setIsFinalTranscript(false);
    audioChunksRef.current = [];
  };

  const copyLiveTranscript = () => {
    if (!liveTranscript) return;
    navigator.clipboard.writeText(liveTranscript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Fetch local ASR engine status
  const fetchEngineStatus = useCallback(async () => {
    try {
      const res = await authFetch('/api/ingestion/asr/status');
      if (res.ok) {
        const data = await res.json();
        setAsrEngineStatus(data);
      }
    } catch (e) {
      console.warn('Failed to fetch ASR engine status:', e);
    }
  }, []);

  // Fetch list of available audio files
  const fetchAsrFilesList = useCallback(async () => {
    try {
      const res = await authFetch('/api/ingestion/asr/files');
      if (res.ok) {
        const data = await res.json();
        setAsrFilesList(data.files || []);
      }
    } catch (e) {
      console.warn('Failed to list ASR audio files:', e);
    }
  }, []);

  // Fetch and run ASR on selected file
  const fetchAsrData = useCallback(async (filename) => {
    if (!filename) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/ingestion/asr/${encodeURIComponent(filename)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `Server returned HTTP ${res.status}`);
      }
      setAsrData(data);
    } catch (err) {
      setError(err.message || `Failed to process ASR on audio file '${filename}'.`);
      setAsrData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEngineStatus();
    fetchAsrFilesList();
  }, [fetchEngineStatus, fetchAsrFilesList]);

  useEffect(() => {
    if (selectedFile) {
      fetchAsrData(selectedFile);
    }
  }, [selectedFile, fetchAsrData]);

  // Handle file upload
  const handleFileUpload = async (file) => {
    if (!file) return;
    const allowed = ['.wav', '.mp3', '.m4a', '.ogg', '.webm'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setUploadError(`Invalid audio format "${ext}". Supported formats: ${allowed.join(', ')}`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await authFetch('/api/ingestion/asr/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `Upload failed with HTTP ${res.status}`);
      }

      setUploadSuccess(`Audio "${data.filename}" transcribed successfully! Found ${data.total_activities} activities.`);
      await fetchAsrFilesList();
      setSelectedFile(data.filename);
      setAsrData(data);
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Filter activities
  const rawActivities = asrData?.activities || [];
  const filteredActivities = rawActivities.filter((act) => {
    const matchesSearch =
      !searchTerm ||
      act.activity_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.activity_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.work_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.remarks?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDisc =
      disciplineFilter === 'ALL' ||
      act.discipline?.toUpperCase() === disciplineFilter.toUpperCase();

    return matchesSearch && matchesDisc;
  });

  const disciplines = ['ALL', ...new Set(rawActivities.map((a) => a.discipline).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-teal-800/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              Feature 2.30 Voice / ASR Engine
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Voice Execution Capture & ASR</h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Deterministic Automated Speech Recognition for hands-free voice logs. Transcribes site audio recordings offline using CPU-quantized Faster-Whisper and extracts standardized progress activities.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10 text-xs">
              <span className="text-slate-400 block">ASR Engine</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5 mt-0.5">
                <Cpu className="w-3.5 h-3.5" />
                Faster-Whisper (CPU Int8)
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10 text-xs">
              <span className="text-slate-400 block">Privacy & Security</span>
              <span className="text-teal-300 font-semibold flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                100% Local / Free
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Voice Execution Capture Section */}
      <div className="bg-white rounded-xl border border-teal-200 shadow-sm p-5 space-y-4">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-lg text-teal-700">
              <Mic className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">Live Voice Execution Capture</h3>
                <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                  Real-Time Hands-Free
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Speak an execution update and see the transcription appear in real time.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600 font-mono bg-slate-50 border border-slate-200 px-2.5 py-1 rounded">
              Local Faster-Whisper (CPU int8)
            </span>
          </div>
        </div>

        {/* Recording Controls & Status Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            {liveStatus === 'LISTENING' || liveStatus === 'TRANSCRIBING' ? (
              <button
                onClick={stopLiveRecording}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop Recording
              </button>
            ) : (
              <button
                onClick={startLiveRecording}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
              >
                <Mic className="w-3.5 h-3.5" />
                Start Recording
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Status:</span>
              {liveStatus === 'LISTENING' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-300">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  LISTENING
                </span>
              ) : liveStatus === 'TRANSCRIBING' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-300">
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                  TRANSCRIBING
                </span>
              ) : liveStatus === 'COMPLETE' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  COMPLETE
                </span>
              ) : liveStatus === 'ERROR' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-300">
                  <AlertCircle className="w-3 h-3 text-rose-600" />
                  ERROR
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  IDLE
                </span>
              )}
            </div>

            {(liveStatus === 'LISTENING' || liveStatus === 'TRANSCRIBING' || recordingTime > 0) && (
              <div className="flex items-center gap-1 text-xs">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {formatTime(recordingTime)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Error Notice */}
        {liveError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{liveError}</span>
          </div>
        )}

        {/* Main Content Grid: Live Transcription + Extracted Event */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Live Transcription Panel */}
          <div className="bg-slate-50/50 rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2 flex-wrap">
                <Radio className="w-4 h-4 text-teal-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Live Transcription
                </h4>
                <span className="text-[10px] font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  Local live transcription
                </span>
                {isFinalTranscript && (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Final Transcript
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyLiveTranscript}
                  disabled={!liveTranscript}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-teal-700 disabled:opacity-40 disabled:hover:text-slate-600 bg-white hover:bg-teal-50 px-2.5 py-1 rounded border border-slate-200 transition-colors"
                  title="Copy transcript"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
                <button
                  onClick={clearLiveTranscript}
                  disabled={!liveTranscript && !extractedEvent && liveStatus === 'IDLE'}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-rose-700 disabled:opacity-40 disabled:hover:text-slate-600 bg-white hover:bg-rose-50 px-2.5 py-1 rounded border border-slate-200 transition-colors"
                  title="Clear transcript"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-900 rounded-lg p-3.5 text-slate-200 font-mono text-xs leading-relaxed border border-slate-800 min-h-[110px] max-h-48 overflow-y-auto">
              {liveTranscript ? (
                <p className="whitespace-pre-wrap">{liveTranscript}</p>
              ) : liveStatus === 'LISTENING' || liveStatus === 'TRANSCRIBING' ? (
                <span className="italic text-teal-400 flex items-center gap-2 py-2">
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                  Listening...
                </span>
              ) : (
                <span className="text-slate-500 italic py-2 block">
                  Click &quot;Start Recording&quot; and speak an execution update (e.g. &quot;Started CIV L6 01 at Sector 4 Pump Station&quot;) to view live transcription.
                </span>
              )}
            </div>
          </div>

          {/* Extracted Execution Event Panel */}
          <div className="bg-slate-50/50 rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Extracted Execution Event
                </h4>
              </div>
              {extractedEvent && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Confidence: {Math.round((extractedEvent.confidence || 0.9) * 100)}%
                </span>
              )}
            </div>

            {extractedEvent ? (
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Activity</span>
                  <span className="font-mono font-bold text-slate-900 mt-0.5 block text-sm">
                    {extractedEvent.activity_id}
                  </span>
                  <span className="text-[11px] text-slate-600 truncate block mt-0.5">
                    {extractedEvent.activity_name}
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Event</span>
                  <span
                    className={`inline-block font-mono font-bold mt-1 px-2 py-0.5 rounded text-xs border ${
                      extractedEvent.event_type === 'START'
                        ? 'bg-teal-50 text-teal-800 border-teal-200'
                        : extractedEvent.event_type === 'END'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-blue-50 text-blue-800 border-blue-200'
                    }`}
                  >
                    {extractedEvent.event_type}
                  </span>
                  {extractedEvent.progress_percent !== null && extractedEvent.progress_percent !== undefined && (
                    <span className="text-[11px] text-teal-700 font-mono block mt-0.5">
                      Progress: {extractedEvent.progress_percent}%
                    </span>
                  )}
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Location</span>
                  <span className="font-medium text-slate-800 mt-0.5 block truncate">
                    {extractedEvent.location || 'Main Site'}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Discipline: {extractedEvent.discipline || 'General'}
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Source</span>
                  <span className="font-semibold text-teal-700 mt-0.5 block">
                    {extractedEvent.source || 'Live Voice'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 block mt-0.5 truncate">
                    {extractedEvent.quantity || extractedEvent.evidence_id || 'Direct Mic Capture'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-white rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-500 space-y-1">
                <p className="font-medium text-slate-700">No execution event extracted yet</p>
                <p className="text-[11px] text-slate-400">
                  Speak e.g. <span className="font-mono text-slate-600 font-semibold">&quot;Started CIV L6 01 at Sector 4 Pump Station&quot;</span> to extract structured event data.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Engine Status & File Selection Toolbar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: File Selection & Actions */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileAudio className="w-5 h-5 text-teal-600" />
              <h3 className="font-semibold text-slate-800 text-sm">Select Stored Voice Recording</h3>
            </div>
            <button
              onClick={() => {
                fetchAsrFilesList();
                if (selectedFile) fetchAsrData(selectedFile);
              }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-teal-700 bg-slate-50 hover:bg-teal-50 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full">
              <select
                value={selectedFile}
                onChange={(e) => setSelectedFile(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-lg px-3.5 py-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              >
                {asrFilesList.length === 0 ? (
                  <option value="">Select or upload an audio file</option>
                ) : (
                  asrFilesList.map((f) => (
                    <option key={f.filename} value={f.filename}>
                      {f.filename} ({f.size_kb} KB)
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              Upload Audio
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              accept=".wav,.mp3,.m4a,.ogg,.webm"
              className="hidden"
            />
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
              isDragOver
                ? 'border-teal-500 bg-teal-50/50 scale-[0.99]'
                : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <p className="text-xs text-slate-500">
              Drag and drop voice recordings (<span className="font-semibold text-slate-700">.wav, .mp3, .m4a, .ogg, .webm</span>) here for automatic local transcription
            </p>
          </div>

          {/* Status notices */}
          {uploadError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
          {uploadSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{uploadSuccess}</span>
            </div>
          )}
        </div>

        {/* Right 1 Col: Engine Info & Diagnostics Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-800 text-sm">ASR Engine Status</h3>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                asrEngineStatus?.asr_available
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {asrEngineStatus?.asr_available ? 'OPERATIONAL' : 'UNAVAILABLE'}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Model:</span>
              <span className="font-medium text-slate-800">{asrEngineStatus?.model || 'tiny.en'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Device & Mode:</span>
              <span className="font-medium text-slate-800">CPU (int8 quantized)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Cloud APIs:</span>
              <span className="font-semibold text-emerald-600">None (0% external calls)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Schedule Hash:</span>
              <span className="font-mono text-[11px] text-slate-600">5d8ed61031538f05...</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Database State:</span>
              <span className="font-medium text-emerald-700">Untouched (In-Memory)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Results View */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full mx-auto" />
          <h4 className="text-slate-700 font-semibold text-sm">Transcribing Audio Locally...</h4>
          <p className="text-slate-400 text-xs max-w-sm mx-auto">
            Whisper CPU model is transcribing voice logs and parsing activities.
          </p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-rose-200 p-8 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <h4 className="text-rose-700 font-semibold text-sm">ASR Processing Failed</h4>
          <p className="text-slate-500 text-xs">{error}</p>
        </div>
      ) : asrData ? (
        <div className="space-y-6">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Clock className="w-4 h-4 text-teal-600" />
                <span>Audio Duration</span>
              </div>
              <p className="text-lg font-bold text-slate-800">
                {asrData.asr?.duration_seconds ? `${asrData.asr.duration_seconds}s` : 'N/A'}
              </p>
              <span className="text-[11px] text-slate-500">Language: {asrData.asr?.language?.toUpperCase() || 'EN'}</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <MapPin className="w-4 h-4 text-cyan-600" />
                <span>Site Location</span>
              </div>
              <p className="text-sm font-bold text-slate-800 truncate">
                {asrData.document_metadata?.site_location || 'Main Site'}
              </p>
              <span className="text-[11px] text-slate-500 truncate block">
                {asrData.document_metadata?.document_date || 'Current Date'}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Activity className="w-4 h-4 text-indigo-600" />
                <span>Activities Parsed</span>
              </div>
              <p className="text-lg font-bold text-indigo-700">{asrData.total_activities || 0}</p>
              <span className="text-[11px] text-slate-500">Standardized L5/L6</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>ASR Status</span>
              </div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {asrData.asr?.asr_status || 'SUCCESS'}
              </span>
              <p className="text-[11px] text-slate-500 mt-1 truncate">Pure-Local In-Memory</p>
            </div>
          </div>

          {/* Audio Player and Transcribed Natural Language Text */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-teal-600" />
                <h3 className="font-semibold text-slate-800 text-sm">Field Voice Recording & Transcription</h3>
              </div>
              <button
                onClick={() => setShowSegments(!showSegments)}
                className="text-xs font-medium text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-3 py-1 rounded-lg border border-teal-200 transition-colors"
              >
                {showSegments ? 'Hide Timing Segments' : 'Show Timing Segments'}
              </button>
            </div>

            {/* Native Audio Preview */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-600 font-medium whitespace-nowrap">
                <Volume2 className="w-4 h-4 text-teal-600" />
                Playback:
              </div>
              <audio
                controls
                className="w-full h-8"
                src={`/api/ingestion/asr/stream/${encodeURIComponent(selectedFile)}`}
                onError={(e) => {
                  // Fallback if direct streaming endpoint not used
                  e.target.style.display = 'none';
                }}
              />
              <span className="text-[11px] text-slate-500">{selectedFile}</span>
            </div>

            {/* Transcribed Text */}
            <div className="bg-slate-900 rounded-xl p-4 text-slate-200 font-mono text-xs leading-relaxed border border-slate-800 relative">
              <div className="text-[10px] uppercase font-bold text-teal-400 tracking-wider mb-2 flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-teal-400" />
                Transcribed Audio Text ({asrData.asr?.text_length || 0} characters)
              </div>
              <p className="whitespace-pre-wrap">{asrData.asr?.text || 'No transcription available.'}</p>
            </div>

            {/* Collapsible Timing Segments */}
            {showSegments && asrData.asr?.segments?.length > 0 && (
              <div className="mt-3 border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-2 max-h-60 overflow-y-auto">
                <span className="text-xs font-semibold text-slate-700 block mb-1">
                  Timing Segments ({asrData.asr.segments.length})
                </span>
                {asrData.asr.segments.map((seg) => (
                  <div key={seg.id} className="text-xs flex items-start gap-2 py-1 border-b border-slate-100 last:border-0">
                    <span className="text-[11px] font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 whitespace-nowrap">
                      {seg.start}s - {seg.end}s
                    </span>
                    <span className="text-slate-700">{seg.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activities Extracted Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-600" />
                <h3 className="font-semibold text-slate-800 text-sm">
                  Parsed Activity Intelligence ({filteredActivities.length} of {rawActivities.length})
                </h3>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search activities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <select
                  value={disciplineFilter}
                  onChange={(e) => setDisciplineFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  {disciplines.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Activity ID</th>
                    <th className="py-3 px-3">Activity Name</th>
                    <th className="py-3 px-3">Discipline</th>
                    <th className="py-3 px-3 text-right">Actual Qty</th>
                    <th className="py-3 px-3 text-right">Progress %</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3">Work Scope / Observation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredActivities.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No activities match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredActivities.map((act, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                          {act.activity_id}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 font-medium">
                          {act.activity_name}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${getDisciplineBadge(
                              act.discipline
                            )}`}
                          >
                            {act.discipline}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {act.actual_quantity !== null && act.actual_quantity !== undefined
                            ? `${act.actual_quantity} ${act.unit || ''}`
                            : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-700">
                          {act.progress_percent !== null && act.progress_percent !== undefined
                            ? `${act.progress_percent}%`
                            : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusBadge(
                              act.status
                            )}`}
                          >
                            {act.status || 'In Progress'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-[11px] max-w-xs truncate">
                          {act.work_description || act.remarks || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
          No voice data loaded. Select or upload an audio file to begin.
        </div>
      )}
    </div>
  );
}
