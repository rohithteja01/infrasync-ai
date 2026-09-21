import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { authFetch } from '../lib/apiClient';
import {
  Play,
  Square,
  Camera,
  CameraOff,
  Mic,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Tag,
  RefreshCw,
  FileText,
  AlertTriangle,
  RotateCcw,
  Check,
  RotateCw,
  Layers,
  Send,
  Trash2,
  Volume2
} from 'lucide-react';

export default function ExecutionCaptureViewer({ projectContext, selectedFile } = {}) {
  // -------------------------------------------------------------
  // SECTION 1: ACTIVITY SELECTION STATE
  // -------------------------------------------------------------
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [fetchedActivities, setFetchedActivities] = useState([]);

  // -------------------------------------------------------------
  // SECTION 2: EXECUTION TIME STATE
  // -------------------------------------------------------------
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [timeSubmitting, setTimeSubmitting] = useState(false);

  // -------------------------------------------------------------
  // SECTION 3: CAMERA EVIDENCE STATE
  // -------------------------------------------------------------
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [uploadedEvidenceFilename, setUploadedEvidenceFilename] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadSuccess, setPhotoUploadSuccess] = useState(false);

  // -------------------------------------------------------------
  // SECTION 4: VOICE UPDATE STATE
  // -------------------------------------------------------------
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const [voiceError, setVoiceError] = useState(null);

  // -------------------------------------------------------------
  // SECTION 5: EXECUTION DETAILS STATE
  // -------------------------------------------------------------
  const [what, setWhat] = useState('');
  const [location, setLocation] = useState('');
  const [discipline, setDiscipline] = useState('Civil');
  const [evidenceType, setEvidenceType] = useState('Photo Evidence');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('m3');
  const [crewLead, setCrewLead] = useState('Site Supervisor');
  const [description, setDescription] = useState('');
  const [detailsSubmitting, setDetailsSubmitting] = useState(false);

  // -------------------------------------------------------------
  // GENERAL STATUS & LOGS STATE
  // -------------------------------------------------------------
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [eventsData, setEventsData] = useState({ events: [], paired_activities: [] });
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Refs for Camera and Audio
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  // Derive project activities from projectContext
  const allActivities = useMemo(() => {
    if (projectContext?.activities && Array.isArray(projectContext.activities) && projectContext.activities.length > 0) {
      return projectContext.activities;
    }
    if (projectContext?.extracted_activities && Array.isArray(projectContext.extracted_activities) && projectContext.extracted_activities.length > 0) {
      return projectContext.extracted_activities;
    }
    if (fetchedActivities.length > 0) {
      return fetchedActivities;
    }
    return [];
  }, [projectContext, fetchedActivities]);

  // Fallback fetch if activities aren't in memory but selectedFile is known
  useEffect(() => {
    let isMounted = true;
    if (allActivities.length === 0 && selectedFile) {
      authFetch(`/api/ingestion/extracted/${encodeURIComponent(selectedFile)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!isMounted || !data || !data.sheets) return;
          const acts = [];
          data.sheets.forEach((s) => {
            if (Array.isArray(s.activities)) acts.push(...s.activities);
          });
          if (acts.length > 0) setFetchedActivities(acts);
        })
        .catch(() => {});
    }
    return () => { isMounted = false; };
  }, [allActivities.length, selectedFile]);

  // Reset all local capture states when projectContext or selectedFile changes
  useEffect(() => {
    const firstAct = (projectContext?.activities?.[0]) || (projectContext?.extracted_activities?.[0]) || null;
    const firstActId = firstAct?.activity_id || '';
    setSelectedActivityId(firstActId);
    setWhat(firstAct?.activity_name || firstAct?.work_description || firstAct?.name || '');
    setLocation(firstAct?.location || 'Site');
    setDiscipline(firstAct?.discipline || 'Civil');
    setStartTime('');
    setEndTime('');
    setIsStarted(false);
    setIsCompleted(false);
    setCapturedPhotoUrl(null);
    setCapturedBlob(null);
    setUploadedEvidenceFilename(null);
    setPhotoUploadSuccess(false);
    setVoiceTranscript('');
    setRecordedAudioUrl(null);
    setIsCameraActive(false);
    setIsRecording(false);
    setRecordingSeconds(0);
    setCameraError(null);
    setVoiceError(null);
    setErrorMessage(null);
    setStatusMessage(null);
    setEvidenceReference('');
    setQuantity('');
    setDescription('');
  }, [projectContext?.files_processed, projectContext?.files, selectedFile]);

  // Auto-select first activity if loaded and none selected
  useEffect(() => {
    if (!selectedActivityId && allActivities.length > 0) {
      const first = allActivities[0];
      setSelectedActivityId(first.activity_id);
      setWhat(first.activity_name || first.work_description || first.name || '');
      setLocation(first.location || 'Site');
      setDiscipline(first.discipline || 'Civil');
    }
  }, [allActivities, selectedActivityId]);

  // Selected Activity Object
  const selectedActivity = useMemo(() => {
    return allActivities.find((a) => a.activity_id === selectedActivityId) || null;
  }, [allActivities, selectedActivityId]);

  // When activity dropdown changes, auto-fill metadata
  const handleActivitySelect = (id) => {
    setSelectedActivityId(id);
    setErrorMessage(null);
    setStatusMessage(null);
    const match = allActivities.find((a) => a.activity_id === id);
    if (match) {
      setWhat(match.activity_name || match.work_description || match.name || id);
      if (match.discipline) setDiscipline(match.discipline);
      if (match.location) setLocation(match.location);
    }
  };

  // Format timer into mm:ss
  const formatTimer = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Computed Duration
  const computedDuration = useMemo(() => {
    if (!startTime || !endTime) return null;
    try {
      const s = new Date(startTime).getTime();
      const e = new Date(endTime).getTime();
      if (!isNaN(s) && !isNaN(e) && e >= s) {
        const hours = (e - s) / (1000 * 60 * 60);
        return `${hours.toFixed(1)} hrs`;
      }
    } catch (_) {}
    return null;
  }, [startTime, endTime]);

  // Fetch all execution events
  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const res = await authFetch('/api/execution/events');
      if (res.ok) {
        const data = await res.json();
        setEventsData(data);
      }
    } catch (_) {}
    finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Reset Memory Handler
  const handleResetMemory = async () => {
    try {
      const res = await authFetch('/api/execution/time-agent/reset', { method: 'POST' });
      if (res.ok) {
        setStatusMessage('In-memory execution events cleared.');
        fetchEvents();
      }
    } catch (err) {
      setErrorMessage('Failed to reset execution events memory.');
    }
  };

  // -------------------------------------------------------------
  // SECTION 2: EXECUTION TIME HANDLERS
  // -------------------------------------------------------------
  const handleRecordStart = async () => {
    if (!selectedActivity) {
      setErrorMessage('Please select an activity first.');
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setTimeSubmitting(true);

    const now = new Date().toISOString();
    const effectiveStartTime = startTime || now;
    if (!startTime) setStartTime(now);

    try {
      const res = await authFetch('/api/execution/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: selectedActivity.activity_id,
          activity_name: what || selectedActivity.activity_name || selectedActivity.activity_id,
          event_type: 'START',
          event_time: effectiveStartTime,
          start_time: effectiveStartTime,
          discipline: discipline || selectedActivity.discipline || 'Civil',
          location: location || selectedActivity.location || 'Site',
          evidence_id: evidenceReference || uploadedEvidenceFilename || undefined,
          evidence_type: evidenceType || undefined,
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);

      setIsStarted(true);
      setStatusMessage('Activity Started');
      fetchEvents();
    } catch (err) {
      setErrorMessage(err.message || 'Unable to record START event.');
    } finally {
      setTimeSubmitting(false);
    }
  };

  const handleRecordEnd = async () => {
    if (!selectedActivity) {
      setErrorMessage('Please select an activity first.');
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setTimeSubmitting(true);

    const now = new Date().toISOString();
    const effectiveEndTime = endTime || now;
    if (!endTime) setEndTime(now);

    try {
      const res = await authFetch('/api/execution/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: selectedActivity.activity_id,
          activity_name: what || selectedActivity.activity_name || selectedActivity.activity_id,
          event_type: 'END',
          event_time: effectiveEndTime,
          end_time: effectiveEndTime,
          discipline: discipline || selectedActivity.discipline || 'Civil',
          location: location || selectedActivity.location || 'Site',
          evidence_id: evidenceReference || uploadedEvidenceFilename || undefined,
          evidence_type: evidenceType || undefined,
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);

      setIsCompleted(true);
      setStatusMessage('Activity Completed');
      fetchEvents();
    } catch (err) {
      setErrorMessage(err.message || 'Unable to record END event.');
    } finally {
      setTimeSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // SECTION 3: CAMERA EVIDENCE HANDLERS
  // -------------------------------------------------------------
  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => {
        try { track.stop(); } catch (_) {}
      });
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const openCamera = async () => {
    if (!selectedActivity) {
      setCameraError('Please select an activity first.');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported in this browser.');
      return;
    }

    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      cameraStreamRef.current = stream;
      if (capturedPhotoUrl) {
        try { URL.revokeObjectURL(capturedPhotoUrl); } catch (_) {}
        setCapturedPhotoUrl(null);
        setPhotoUploadSuccess(false);
      }
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser.');
      } else {
        setCameraError('Camera access is required to capture evidence.');
      }
    }
  };

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setCameraError('Failed to capture frame from camera.');
        return;
      }

      if (capturedPhotoUrl) {
        URL.revokeObjectURL(capturedPhotoUrl);
      }
      const previewUrl = URL.createObjectURL(blob);
      setCapturedPhotoUrl(previewUrl);
      setCapturedBlob(blob);
      stopCamera();

      // Upload to POST /api/ingestion/photos/upload
      setPhotoUploading(true);
      setCameraError(null);
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeActId = (selectedActivity?.activity_id || 'ACTIVITY').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `evidence_${safeActId}_${timestamp}.jpg`;
        const file = new File([blob], filename, { type: 'image/jpeg' });

        const formData = new FormData();
        formData.append('file', file);
        if (selectedActivity?.activity_id) formData.append('activity_id', selectedActivity.activity_id);
        if (discipline) formData.append('discipline', discipline);
        if (location) formData.append('site_location', location);
        formData.append('capture_date', new Date().toISOString().split('T')[0]);
        formData.append('description', `Field camera evidence for ${selectedActivity?.activity_id || 'activity'}`);

        const res = await authFetch('/api/ingestion/photos/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        const finalFilename = (data && data.filename) || filename;
        setUploadedEvidenceFilename(finalFilename);
        setPhotoUploadSuccess(true);

        // Auto-sync into Section 5 Execution Details
        setEvidenceReference(finalFilename);
        setEvidenceType('Photo Evidence');
      } catch (uploadErr) {
        console.warn('Photo upload warning:', uploadErr);
      } finally {
        setPhotoUploading(false);
      }
    }, 'image/jpeg', 0.92);
  }, [capturedPhotoUrl, selectedActivity, discipline, location, stopCamera]);

  // Clean up camera on unmount or navigation
  useEffect(() => {
    return () => {
      stopCamera();
      if (capturedPhotoUrl) {
        URL.revokeObjectURL(capturedPhotoUrl);
      }
    };
  }, [stopCamera, capturedPhotoUrl]);

  // -------------------------------------------------------------
  // SECTION 4: VOICE UPDATE HANDLERS
  // -------------------------------------------------------------
  const startVoiceUpdate = async () => {
    if (!selectedActivity) {
      setVoiceError('Please select an activity first.');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVoiceError('Microphone access is not supported in this browser.');
      return;
    }

    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (recordedAudioUrl) {
          URL.revokeObjectURL(recordedAudioUrl);
        }
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(audioUrl);

        // Upload to POST /api/ingestion/asr/upload (Faster-Whisper tiny.en)
        setIsTranscribing(true);
        setVoiceError(null);

        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const audioFile = new File([audioBlob], `voice_${timestamp}.webm`, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('file', audioFile);

          const res = await authFetch('/api/ingestion/asr/upload', {
            method: 'POST',
            body: formData
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.detail || 'ASR transcription failed.');
          }

          const extractedText = (data.asr?.text || data.text || '').trim();
          const finalText = extractedText || '(No speech detected in audio recording)';
          setVoiceTranscript(finalText);

          // Auto-sync into Section 5 Description
          setDescription((prev) => {
            if (!prev.trim()) return finalText;
            return `${prev}\n[Voice Update]: ${finalText}`;
          });
        } catch (asrErr) {
          setVoiceError('ASR transcription failed: ' + (asrErr.message || 'Unable to connect to local ASR engine.'));
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setVoiceError('Microphone permission denied. Please allow microphone access in your browser.');
      } else {
        setVoiceError('Microphone access is required for voice updates.');
      }
    }
  };

  const stopVoiceUpdate = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => {
        try { track.stop(); } catch (_) {}
      });
      audioStreamRef.current = null;
    }
    setIsRecording(false);
  };

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => {
          try { track.stop(); } catch (_) {}
        });
      }
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [recordedAudioUrl]);

  // -------------------------------------------------------------
  // SECTION 5: SAVE/COMPLETE EXECUTION EVENT HANDLER
  // -------------------------------------------------------------
  const handleSaveCompleteEvent = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedActivity) {
      setErrorMessage('Please select an activity first.');
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setDetailsSubmitting(true);

    try {
      const payload = {
        activity_id: selectedActivity.activity_id,
        activity_name: what || selectedActivity.activity_name || selectedActivity.activity_id,
        schedule_code: selectedActivity.activity_id,
        what: what || selectedActivity.activity_name || selectedActivity.activity_id,
        event_type: 'COMPLETED',
        start_time: startTime || undefined,
        end_time: endTime || new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        discipline: discipline || selectedActivity.discipline || 'Civil',
        location: location || selectedActivity.location || 'Site',
        evidence_type: evidenceType || 'Photo Evidence',
        evidence_id: evidenceReference || uploadedEvidenceFilename || undefined,
        evidence_files: (evidenceReference || uploadedEvidenceFilename) ? [evidenceReference || uploadedEvidenceFilename] : undefined,
        quantity_reported: quantity ? `${quantity} ${unit}`.trim() : undefined,
        crew_lead: crewLead || undefined,
        message: description.trim() || undefined,
        project_id: projectContext?.project_id || 'PRJ-CURRENT'
      };

      const res = await authFetch('/api/execution/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      setIsCompleted(true);
      setStatusMessage('Execution event successfully saved and verified.');
      fetchEvents();
    } catch (err) {
      setErrorMessage(err.message || 'Unable to save execution event.');
    } finally {
      setDetailsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-[#2D2D2D] pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-neutral-100 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>Execution Capture</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
            Capture field execution progress using live camera evidence, voice updates, and time tracking.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={fetchEvents}
            disabled={loadingEvents}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-neutral-300 bg-white dark:bg-[#252525] border border-slate-300 dark:border-[#383838] rounded-md hover:bg-slate-50 transition cursor-pointer"
            title="Refresh recorded events"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingEvents ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleResetMemory}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-neutral-300 bg-white dark:bg-[#252525] border border-slate-300 dark:border-[#383838] rounded-md hover:bg-slate-50 hover:text-rose-600 transition cursor-pointer"
            title="Reset in-memory test events"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Memory</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {statusMessage && (
        <div className="flex items-center space-x-2 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-medium">{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center space-x-2 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* -------------------------------------------------------------
          SECTION 1: ACTIVITY SELECTION
          ------------------------------------------------------------- */}
      <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-[#2E2E2E] pb-3">
          <Tag className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
            1. Activity Selection
          </h3>
        </div>

        {allActivities.length === 0 ? (
          <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-3">
            No project activities loaded. Please upload a project Excel spreadsheet in Data Processing first.
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="activity-selector" className="block text-xs font-medium text-slate-600 dark:text-neutral-400 mb-1">
                Select Active Project Activity
              </label>
              <select
                id="activity-selector"
                value={selectedActivityId}
                onChange={(e) => handleActivitySelect(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-[#252525] border border-slate-300 dark:border-[#3E3E3E] rounded-md px-3 py-2 text-slate-900 dark:text-neutral-100 font-medium focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">-- Choose an activity from active project --</option>
                {allActivities.map((act) => (
                  <option key={act.activity_id} value={act.activity_id}>
                    {act.activity_id} - {act.activity_name || act.work_description || act.name} ({act.discipline || 'General'})
                  </option>
                ))}
              </select>
            </div>

            {selectedActivity && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#323232] rounded-lg p-3 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-neutral-500 block">Activity ID</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-neutral-100 mt-0.5 block">
                    {selectedActivity.activity_id}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-neutral-500 block">Activity Name</span>
                  <span className="font-medium text-slate-800 dark:text-neutral-200 mt-0.5 block truncate" title={selectedActivity.activity_name || selectedActivity.work_description}>
                    {selectedActivity.activity_name || selectedActivity.work_description || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-neutral-500 block">Discipline</span>
                  <span className="font-medium text-slate-800 dark:text-neutral-200 mt-0.5 block">
                    {selectedActivity.discipline || 'General'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-neutral-500 block">Location</span>
                  <span className="font-medium text-slate-800 dark:text-neutral-200 mt-0.5 block">
                    {selectedActivity.location || 'Site'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------
          SECTION 2: EXECUTION TIME
          ------------------------------------------------------------- */}
      <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-[#2E2E2E] pb-3">
          <Clock className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
            2. Execution Time
          </h3>
        </div>

        {/* Time Inputs & Computed Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-600 dark:text-neutral-400 font-medium">Start Time</label>
              <button
                type="button"
                onClick={() => setStartTime(new Date().toISOString())}
                className="text-[10px] text-brand-600 hover:text-brand-700 dark:text-brand-400 font-semibold cursor-pointer"
              >
                Set Now
              </button>
            </div>
            <input
              type="text"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="e.g. 2026-09-17T08:00:00Z"
              className="w-full bg-slate-50 dark:bg-[#252525] border border-slate-300 dark:border-[#3E3E3E] rounded px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-600 dark:text-neutral-400 font-medium">End Time</label>
              <button
                type="button"
                onClick={() => setEndTime(new Date().toISOString())}
                className="text-[10px] text-brand-600 hover:text-brand-700 dark:text-brand-400 font-semibold cursor-pointer"
              >
                Set Now
              </button>
            </div>
            <input
              type="text"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              placeholder="e.g. 2026-09-17T16:30:00Z"
              className="w-full bg-slate-50 dark:bg-[#252525] border border-slate-300 dark:border-[#3E3E3E] rounded px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-slate-600 dark:text-neutral-400 font-medium mb-1">Duration</label>
            <div className="h-8 flex items-center px-3 bg-slate-100 dark:bg-[#222222] border border-slate-200 dark:border-[#323232] rounded font-mono font-bold text-slate-800 dark:text-neutral-200">
              {computedDuration || '—'}
            </div>
          </div>
        </div>

        {/* Action Buttons: Record Start / Record End / Save/Complete */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleRecordStart}
            disabled={!selectedActivity || timeSubmitting}
            className={`inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-md transition cursor-pointer shadow-xs ${
              isStarted
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {timeSubmitting && !isStarted ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : isStarted ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>{isStarted ? 'Activity Started' : 'Record Start'}</span>
          </button>

          <button
            type="button"
            onClick={handleRecordEnd}
            disabled={!selectedActivity || timeSubmitting}
            className={`inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-md transition cursor-pointer shadow-xs ${
              isCompleted
                ? 'bg-emerald-700 text-white cursor-default'
                : 'bg-slate-800 dark:bg-neutral-700 hover:bg-slate-900 text-white disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {timeSubmitting && !isCompleted ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : isCompleted ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span>{isCompleted ? 'Activity Completed' : 'Record End'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveCompleteEvent}
            disabled={!selectedActivity || detailsSubmitting}
            className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            <span>Save/Complete</span>
          </button>
        </div>

        {/* Timestamps Badges */}
        {(startTime || endTime) && (
          <div className="flex flex-wrap gap-3 pt-1 text-xs font-mono">
            {startTime && (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1 rounded">
                <span className="font-semibold">Start:</span> {new Date(startTime).toLocaleString()}
              </div>
            )}
            {endTime && (
              <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 px-2.5 py-1 rounded">
                <span className="font-semibold">End:</span> {new Date(endTime).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------
          RESPONSIVE 2-COLUMN GRID: CAMERA EVIDENCE | VOICE UPDATE
          ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 3: CAMERA EVIDENCE */}
        <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-lg p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-[#2E2E2E] pb-3">
              <Camera className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
                3. Camera Evidence
              </h3>
            </div>

            {cameraError && (
              <div className="text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded p-3">
                {cameraError}
              </div>
            )}

            {photoUploadSuccess && (
              <div className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded p-2.5 flex items-center space-x-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Photo captured successfully</span>
              </div>
            )}

            {/* Before Camera Permission: Visible Open Camera button */}
            {!isCameraActive && !capturedPhotoUrl && (
              <div className="py-6 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-[#323232] rounded-lg bg-slate-50 dark:bg-[#222222]">
                <Camera className="w-10 h-10 text-slate-400 dark:text-neutral-500 mb-3" />
                <p className="text-xs text-slate-500 dark:text-neutral-400 mb-4 text-center max-w-xs">
                  Capture live visual field evidence directly from your device camera.
                </p>
                <button
                  type="button"
                  onClick={openCamera}
                  disabled={!selectedActivity}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-800 dark:bg-neutral-700 hover:bg-slate-900 rounded-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                >
                  <Camera className="w-4 h-4" />
                  <span>Open Camera</span>
                </button>
              </div>
            )}

            {/* Live Camera Stream */}
            {isCameraActive && (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-300 dark:border-[#3E3E3E]">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2 left-2 text-[10px] bg-red-600 text-white font-semibold px-2 py-0.5 rounded tracking-wide animate-pulse">
                    LIVE CAMERA
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={photoUploading}
                    className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-md transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{photoUploading ? 'Saving...' : 'Capture Photo'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={stopCamera}
                    className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-neutral-300 bg-slate-100 dark:bg-[#2A2A2A] hover:bg-slate-200 rounded-md transition cursor-pointer"
                  >
                    <CameraOff className="w-4 h-4" />
                    <span>Stop Camera</span>
                  </button>
                </div>
              </div>
            )}

            {/* Captured Photo Evidence Preview */}
            {capturedPhotoUrl && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#323232] rounded-lg flex flex-col sm:flex-row gap-4 items-start">
                  <img
                    src={capturedPhotoUrl}
                    alt="Captured field evidence"
                    className="h-32 w-auto object-cover rounded border border-slate-300 dark:border-[#383838]"
                  />
                  <div className="space-y-1.5 text-xs flex-1">
                    <div className="font-semibold text-slate-900 dark:text-neutral-100">
                      Visual Evidence Attached
                    </div>
                    {uploadedEvidenceFilename && (
                      <div className="font-mono text-[11px] text-slate-600 dark:text-neutral-400 break-all">
                        {uploadedEvidenceFilename}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={openCamera}
                      className="mt-2 inline-flex items-center space-x-1.5 px-3 py-1.5 text-[11px] font-medium text-slate-700 dark:text-neutral-300 bg-white dark:bg-[#2B2B2B] border border-slate-300 dark:border-[#3E3E3E] rounded hover:bg-slate-50 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retake Photo</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 4: VOICE UPDATE */}
        <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-lg p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-[#2E2E2E] pb-3">
              <Mic className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
                4. Voice Update
              </h3>
            </div>

            {voiceError && (
              <div className="text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded p-3">
                {voiceError}
              </div>
            )}

            {/* Before Recording: Start Voice Update button */}
            {!isRecording && (
              <div className="py-6 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-[#323232] rounded-lg bg-slate-50 dark:bg-[#222222]">
                <Mic className="w-10 h-10 text-slate-400 dark:text-neutral-500 mb-3" />
                <p className="text-xs text-slate-500 dark:text-neutral-400 mb-4 text-center max-w-xs">
                  Record verbal site progress and automatically transcribe with Faster-Whisper.
                </p>
                <button
                  type="button"
                  onClick={startVoiceUpdate}
                  disabled={!selectedActivity || isTranscribing}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-800 dark:bg-neutral-700 hover:bg-slate-900 rounded-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Voice Update</span>
                </button>
              </div>
            )}

            {/* Live Recording State */}
            {isRecording && (
              <div className="space-y-4 py-4 px-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg text-rose-700 dark:text-rose-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-wider">Recording...</span>
                  </div>
                  <span className="font-mono text-sm font-bold bg-white dark:bg-neutral-800 px-3 py-1 rounded border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                    {formatTimer(recordingSeconds)}
                  </span>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={stopVoiceUpdate}
                    className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition cursor-pointer shadow-xs"
                  >
                    <Square className="w-4 h-4" />
                    <span>Stop Recording</span>
                  </button>
                </div>
              </div>
            )}

            {/* ASR Transcription Spinner */}
            {isTranscribing && (
              <div className="flex items-center space-x-2 text-xs text-brand-700 dark:text-brand-400 p-3 bg-brand-50 dark:bg-brand-950/30 rounded border border-brand-200 dark:border-brand-800 font-medium">
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                <span>Transcribing audio with local Faster-Whisper tiny.en...</span>
              </div>
            )}

            {/* Transcript & Audio Playback Box */}
            {voiceTranscript && (
              <div className="space-y-2 p-3.5 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#323232] rounded-lg">
                {recordedAudioUrl && (
                  <div className="mb-2">
                    <audio controls src={recordedAudioUrl} className="h-8 w-full" />
                  </div>
                )}
                <div className="text-xs space-y-1">
                  <span className="font-bold text-slate-700 dark:text-neutral-300 uppercase text-[11px] tracking-wider block">
                    Transcript
                  </span>
                  <div className="border-t border-slate-200 dark:border-[#383838] my-1" />
                  <p className="text-slate-900 dark:text-neutral-100 bg-white dark:bg-[#1A1A1A] p-3 rounded border border-slate-200 dark:border-[#343434] leading-relaxed text-xs">
                    {voiceTranscript}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          SECTION 5: EXECUTION DETAILS
          ------------------------------------------------------------- */}
      <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-[#2E2E2E] pb-3">
          <FileText className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
            5. Execution Details
          </h3>
        </div>

        <form onSubmit={handleSaveCompleteEvent} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            {/* What */}
            <div>
              <label className="block text-slate-600 dark:text-neutral-400 font-medium mb-1">
                What (Work Description)
              </label>
              <input
                type="text"
                value={what}
                onChange={(e) => setWhat(e.target.value)}
                placeholder="e.g. Subgrade excavation and compaction"
                className="w-full bg-slate-50 dark:bg-[#252525] border border-slate-300 dark:border-[#3E3E3E] rounded px-3 py-1.5 text-xs text-slate-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
              />
            </div>

            {/* Where */}
            <div>
              <label className="block text-slate-600 dark:text-neutral-400 font-medium mb-1">
                Where (Site Location)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Station 4 Sector B"
                className="w-full bg-slate-50 dark:bg-[#252525] border border-slate-300 dark:border-[#3E3E3E] rounded px-3 py-1.5 text-xs text-slate-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
              />
            </div>

            {/* Discipline */}
            <div>
              <label className="block text-slate-600 dark:text-neutral-400 font-medium mb-1">
                Discipline
              </label>
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#252525] border border-slate-300 dark:border-[#3E3E3E] rounded px-3 py-1.5 text-xs text-slate-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
              >
                <option value="Civil">Civil</option>
                <option value="Piping">Piping</option>
                <option value="Mechanical">Mechanical</option>
                <option value="Electrical">Electrical</option>
                <option value="Instrumentation">Instrumentation</option>
                <option value="Structural">Structural</option>
                <option value="General">General</option>
              </select>
            </div>

            {/* Evidence Type */}
            <div>
              <label className="block text-slate-600 dark:text-neutral-400 font-medium mb-1">
                Evidence Type
              </label>
              <select
                value={evidenceType}
                onChange={(e) => setEvidenceType(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#252525] border border-slate-300 dark:border-[#3E3E3E] rounded px-3 py-1.5 text-xs text-slate-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
              >
                <option value="Photo Evidence">Photo Evidence</option>
                <option value="Voice / Audio Note">Voice / Audio Note</option>
                <option value="Daily Progress Report">Daily Progress Report</option>
                <option value="Site Diary">Site Diary</option>
                <option value="Inspection Document">Inspection Document</option>
                <option value="Handover Sign-off">Handover Sign-off</option>
              </select>
            </div>

            {/* Evidence Reference */}
            <div>
              <label className="block text-slate-600 dark:text-neutral-400 font-medium mb-1">
                Evidence Reference
              </label>
              <input
                type="text"
                value={evidenceReference}
                onChange={(e) => setEvidenceReference(e.target.value)}
                placeholder="e.g. evidence_CIV-001.jpg"
                className="w-full bg-slate-50 dark:bg-[#252525] border border-slate-300 dark:border-[#3E3E3E] rounded px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Quantity & Unit */}
            <div>
              <label className="block text-slate-600 dark:text-neutral-400 font-medium mb-1">
                Quantity & Unit
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 150"
                  className="w-2/3 bg-slate-50 dark:bg-[#252525] border border-slate-300 dark:border-[#3E3E3E] rounded px-3 py-1.5 text-xs text-slate-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="m3"
                  className="w-1/3 bg-slate-50 dark:bg-[#252525] border border-slate-300 dark:border-[#3E3E3E] rounded px-2 py-1.5 text-xs text-slate-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Description / Field Notes */}
          <div>
            <label className="block text-slate-600 dark:text-neutral-400 font-medium mb-1">
              Description / Notes (Populated from Voice Update or manual entry)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Record any field notes, issues, material delivery delays, or supervisor comments..."
              className="w-full bg-slate-50 dark:bg-[#252525] border border-slate-300 dark:border-[#3E3E3E] rounded p-2.5 text-xs text-slate-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-brand-500 leading-relaxed"
            />
          </div>

          {/* Save/Complete Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!selectedActivity || detailsSubmitting}
              className="inline-flex items-center space-x-2 px-6 py-2.5 text-xs font-semibold rounded-md bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {detailsSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Save & Complete Execution Event</span>
            </button>
          </div>
        </form>
      </div>

      {/* -------------------------------------------------------------
          RECENT EXECUTION EVENTS & TIME AGENT HISTORY
          ------------------------------------------------------------- */}
      <div className="bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#323232] rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2E2E2E] pb-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
              Captured Events & Time Agent History
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500 bg-slate-100 dark:bg-[#2A2A2A] px-2 py-0.5 rounded">
            Total: {eventsData.events?.length || 0} events
          </span>
        </div>

        {eventsData.events?.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 dark:text-neutral-500">
            No execution events captured yet. Use Record Start / Record End or Save & Complete to log field events.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#252525] text-slate-600 dark:text-neutral-400 border-b border-slate-200 dark:border-[#383838]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Event ID</th>
                  <th className="py-2.5 px-3 font-semibold">Activity</th>
                  <th className="py-2.5 px-3 font-semibold">Type</th>
                  <th className="py-2.5 px-3 font-semibold">Timestamp / Date</th>
                  <th className="py-2.5 px-3 font-semibold">Discipline</th>
                  <th className="py-2.5 px-3 font-semibold">Location</th>
                  <th className="py-2.5 px-3 font-semibold">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2E2E2E]">
                {eventsData.events.slice(-8).reverse().map((ev, idx) => (
                  <tr key={ev.event_id || idx} className="hover:bg-slate-50 dark:hover:bg-[#222222]">
                    <td className="py-2 px-3 font-mono font-medium text-slate-700 dark:text-neutral-300">
                      {ev.event_id}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900 dark:text-neutral-100">
                      {ev.activity_id}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        ev.event_type === 'START'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : ev.event_type === 'END'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                      }`}>
                        {ev.event_type}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-neutral-400">
                      {ev.event_time ? new Date(ev.event_time).toLocaleTimeString() : (ev.date || '—')}
                    </td>
                    <td className="py-2 px-3 text-slate-700 dark:text-neutral-300">
                      {ev.discipline || '—'}
                    </td>
                    <td className="py-2 px-3 text-slate-700 dark:text-neutral-300">
                      {ev.location || '—'}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500 dark:text-neutral-400 truncate max-w-[140px]">
                      {ev.evidence_id || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
