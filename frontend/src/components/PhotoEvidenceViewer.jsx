import React, { useState, useEffect, useCallback, useRef } from 'react';
import { authFetch } from '../lib/apiClient';
import {
  Camera,
  CameraOff,
  SwitchCamera,
  RotateCw,
  Image as ImageIcon,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  MapPin,
  Tag,
  Layers,
  ShieldCheck,
  FileImage,
  Info,
  Maximize2
} from 'lucide-react';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export default function PhotoEvidenceViewer() {
  const [photoFiles, setPhotoFiles] = useState([]);
  const [selectedFilename, setSelectedFilename] = useState('');
  const [selectedPhotoMeta, setSelectedPhotoMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Upload form state (optional metadata)
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadActivityId, setUploadActivityId] = useState('');
  const [uploadDiscipline, setUploadDiscipline] = useState('');
  const [uploadCaptureDate, setUploadCaptureDate] = useState('');
  const [uploadSiteLocation, setUploadSiteLocation] = useState('');
  const [uploadWorkLocation, setUploadWorkLocation] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // Real-time camera access state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (rear) or 'user' (front)
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [capturedMeta, setCapturedMeta] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // Fetch list of available photo evidence files
  const fetchPhotosList = useCallback(async () => {
    try {
      const res = await authFetch('/api/ingestion/photos');
      if (res.ok) {
        const data = await res.json();
        setPhotoFiles(data.photos || []);
      }
    } catch (err) {
      console.warn('Failed to fetch photo evidence list:', err);
    }
  }, []);

  // Fetch detail metadata for a specific photo
  const fetchPhotoDetail = useCallback(async (filename) => {
    if (!filename) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/ingestion/photos/${encodeURIComponent(filename)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `Server returned HTTP ${res.status}`);
      }
      setSelectedPhotoMeta(data.evidence || data);
    } catch (err) {
      setError(err.message || `Failed to load evidence metadata for '${filename}'.`);
      setSelectedPhotoMeta(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPhotosList();
  }, [fetchPhotosList]);

  useEffect(() => {
    if (selectedFilename) {
      fetchPhotoDetail(selectedFilename);
    }
  }, [selectedFilename, fetchPhotoDetail]);

  // Stop active camera stream safely
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore error on stop
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraLoading(false);
  }, []);

  // Request camera access and start live preview
  const startCamera = useCallback(async (requestedFacing = facingMode) => {
    setCameraError(null);
    setCameraLoading(true);
    stopCamera();

    if (localStorage.getItem('infrasync_camera_enabled') === 'false') {
      setCameraError('Camera access is disabled in Infrasync Settings. Please enable it in Settings.');
      setCameraLoading(false);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported in this browser.');
      setCameraLoading(false);
      return;
    }

    try {
      // Enumerate devices to check if camera flip is supported
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      } catch {
        // Enumerate errors non-fatal
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: requestedFacing,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch (err) {
        if (err.name === 'OverconstrainedError') {
          // Fallback to any camera without facingMode constraint
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw err;
        }
      }

      streamRef.current = stream;
      setCameraActive(true);
      setFacingMode(requestedFacing);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access was denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera was detected on this device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('Camera is already in use by another application.');
      } else {
        setCameraError(`Camera error: ${err.message || 'Unable to access camera.'}`);
      }
      setCameraActive(false);
    } finally {
      setCameraLoading(false);
    }
  }, [facingMode, stopCamera]);

  // Connect video element to stream when camera becomes active
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  // Switch between front and rear cameras
  const switchCamera = useCallback(() => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    startCamera(nextMode);
  }, [facingMode, startCamera]);

  // Capture current video frame to canvas and prepare image file
  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    if (!width || !height) {
      setCameraError('Video feed not ready for capture. Please try again.');
      return;
    }

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('Failed to capture photo frame.');
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `camera_capture_${timestamp}.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });

      if (capturedPreview) {
        URL.revokeObjectURL(capturedPreview);
      }

      const previewUrl = URL.createObjectURL(blob);
      setCapturedPreview(previewUrl);
      setCapturedMeta({
        width,
        height,
        timestamp: new Date().toLocaleString(),
        sizeKb: (blob.size / 1024).toFixed(1),
        filename,
      });

      // Populate file for registration
      setUploadFile(file);
      setUploadError(null);
      setUploadSuccess(null);

      // Auto-set capture date to today if blank
      if (!uploadCaptureDate) {
        const today = new Date().toISOString().split('T')[0];
        setUploadCaptureDate(today);
      }

      // Stop camera stream safely now that photo is captured
      stopCamera();
    }, 'image/jpeg', 0.92);
  }, [capturedPreview, stopCamera, uploadCaptureDate]);

  // Retake photo: clear previous capture and reopen camera
  const retakePhoto = useCallback(() => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
    }
    setCapturedPreview(null);
    setCapturedMeta(null);
    setUploadFile(null);
    startCamera(facingMode);
  }, [capturedPreview, facingMode, startCamera]);

  // Clear captured photo and revert to standard file selection
  const clearCapturedPhoto = useCallback(() => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
    }
    setCapturedPreview(null);
    setCapturedMeta(null);
    setUploadFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [capturedPreview]);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (capturedPreview) {
        URL.revokeObjectURL(capturedPreview);
      }
    };
  }, [stopCamera, capturedPreview]);

  // Handle upload form submission
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please choose an image file or capture a photo.');
      return;
    }

    const ext = '.' + uploadFile.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setUploadError(`Unsupported format '${ext}'. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('file', uploadFile);
    if (uploadCaptureDate.trim()) formData.append('capture_date', uploadCaptureDate.trim());
    if (uploadActivityId.trim()) formData.append('activity_id', uploadActivityId.trim());
    if (uploadDiscipline.trim()) formData.append('discipline', uploadDiscipline.trim());
    if (uploadSiteLocation.trim()) formData.append('site_location', uploadSiteLocation.trim());
    if (uploadWorkLocation.trim()) formData.append('work_location', uploadWorkLocation.trim());
    if (uploadDescription.trim()) formData.append('description', uploadDescription.trim());

    try {
      const res = await authFetch('/api/ingestion/photos/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `Upload failed with status ${res.status}`);
      }

      setUploadSuccess(`Photo '${data.filename}' registered as execution evidence.`);
      setUploadFile(null);
      if (capturedPreview) {
        URL.revokeObjectURL(capturedPreview);
        setCapturedPreview(null);
        setCapturedMeta(null);
      }
      setUploadActivityId('');
      setUploadDiscipline('');
      setUploadCaptureDate('');
      setUploadSiteLocation('');
      setUploadWorkLocation('');
      setUploadDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      await fetchPhotosList();
      setSelectedFilename(data.filename);
    } catch (err) {
      setUploadError(err.message || 'Failed to upload photo evidence.');
    } finally {
      setUploading(false);
    }
  };

  const currentMeta = selectedPhotoMeta;

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-xl p-6 shadow-sm border border-slate-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg border border-indigo-400/30">
                <Camera className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Photo Ingestion & Execution Evidence
              </h2>
              <span className="text-xs bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-400/30 font-mono">
                Feature A
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Receives, validates, and stores site progress photographs as verifiable execution evidence metadata.
              Operates strictly in-memory without computer vision, OCR, automatic activity matching, or progress inference.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10 text-xs">
              <span className="text-slate-400 block">Supported Formats</span>
              <span className="text-indigo-300 font-semibold flex items-center gap-1.5 mt-0.5">
                <FileImage className="w-3.5 h-3.5" />
                .JPG / .JPEG / .PNG / .WEBP
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10 text-xs">
              <span className="text-slate-400 block">Evidence Governance</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Zero DB Writes / Metadata Only
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Upload Form + Stored Photo Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Upload Evidence Form */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-800 text-sm">Upload Photo Evidence</h3>
            </div>
            {cameraActive && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE CAMERA
              </span>
            )}
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-3.5 text-xs">
            {/* Camera Error Message */}
            {cameraError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-start gap-2 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{cameraError}</span>
              </div>
            )}

            {/* Mode 1: Live Camera Viewport Active */}
            {cameraActive ? (
              <div className="space-y-3 bg-slate-900/5 rounded-xl p-3 border border-slate-300">
                <div className="flex items-center justify-between text-xs text-slate-700 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-indigo-600" />
                    <span>Live Camera</span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    STREAMING
                  </span>
                </div>

                <div className="relative bg-slate-900 rounded-lg overflow-hidden border border-slate-700 aspect-[4/3] flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {facingMode && (
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded border border-white/20 uppercase">
                      {facingMode === 'user' ? 'Front Camera' : 'Rear Camera'}
                    </div>
                  )}
                </div>

                {/* Camera Action Controls */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3 rounded-lg shadow-sm transition-colors text-xs cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capture Photo</span>
                  </button>

                  {hasMultipleCameras && (
                    <button
                      type="button"
                      onClick={switchCamera}
                      title="Switch Camera (Front / Rear)"
                      className="flex items-center justify-center gap-1 bg-white hover:bg-slate-50 text-slate-700 font-medium py-2 px-3 rounded-lg border border-slate-300 transition-colors text-xs cursor-pointer"
                    >
                      <SwitchCamera className="w-4 h-4 text-slate-600" />
                      <span className="hidden sm:inline">Switch</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={stopCamera}
                    title="Close Camera"
                    className="flex items-center justify-center gap-1 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 font-medium py-2 px-3 rounded-lg border border-slate-300 transition-colors text-xs cursor-pointer"
                  >
                    <CameraOff className="w-4 h-4" />
                    <span>Close</span>
                  </button>
                </div>
              </div>
            ) : capturedPreview ? (
              /* Mode 2: Photo Captured & Ready Preview */
              <div className="space-y-3 bg-indigo-50/40 rounded-xl p-3 border border-indigo-200">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-950">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Captured Photo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={retakePhoto}
                      className="text-[11px] text-indigo-700 hover:text-indigo-900 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCw className="w-3 h-3" />
                      Retake
                    </button>
                    <button
                      type="button"
                      onClick={clearCapturedPhoto}
                      className="text-[11px] text-slate-500 hover:text-slate-700 font-medium hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="relative bg-slate-900 rounded-lg overflow-hidden border border-slate-700 aspect-[4/3] flex items-center justify-center">
                  <img
                    src={capturedPreview}
                    alt="Captured execution frame"
                    className="w-full h-full object-contain"
                  />
                </div>

                {capturedMeta && (
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Dimensions:</span>
                      <span className="font-mono font-medium text-slate-800">{capturedMeta.width} × {capturedMeta.height} px</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Captured At:</span>
                      <span className="font-medium text-slate-800">{capturedMeta.timestamp}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">File Size:</span>
                      <span className="font-mono text-slate-800">{capturedMeta.sizeKb} KB (JPEG)</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Mode 3: Normal File Selection or Open Camera */
              <div className="space-y-2">
                <label className="block font-medium text-slate-700">
                  Select Photo Image or Open Camera <span className="text-rose-500">*</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      id="photo-file-upload-input"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setUploadFile(e.target.files[0]);
                          setUploadError(null);
                          if (capturedPreview) {
                            URL.revokeObjectURL(capturedPreview);
                            setCapturedPreview(null);
                            setCapturedMeta(null);
                          }
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="photo-file-upload-input"
                      className="w-full flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium py-2 px-3 rounded-lg border border-slate-300 transition-colors cursor-pointer text-xs"
                    >
                      <FileImage className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                      <span className="truncate">{uploadFile ? uploadFile.name : 'Choose File'}</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    disabled={cameraLoading}
                    className="w-full flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-2 px-3 rounded-lg border border-indigo-200 transition-colors cursor-pointer text-xs disabled:opacity-50"
                  >
                    <Camera className={`w-4 h-4 ${cameraLoading ? 'animate-spin' : ''}`} />
                    <span>{cameraLoading ? 'Connecting...' : 'Open Camera'}</span>
                  </button>
                </div>

                {uploadFile && !capturedPreview && (
                  <div className="p-2 bg-indigo-50/60 border border-indigo-200 rounded-lg flex items-center justify-between text-[11px] text-indigo-900">
                    <span className="truncate font-medium">Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)</span>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-slate-400 hover:text-slate-600 ml-2 font-bold cursor-pointer"
                      title="Clear selection"
                    >
                      ×
                    </button>
                  </div>
                )}

                <span className="text-[11px] text-slate-400 block">
                  Choose a file (.jpg, .jpeg, .png, .webp up to 25MB) or click Open Camera to capture live evidence.
                </span>
              </div>
            )}

            {/* Hidden canvas for video frame extraction */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Optional Metadata: Activity ID & Discipline */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Activity ID <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. CIV-L6-01"
                  value={uploadActivityId}
                  onChange={(e) => setUploadActivityId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Discipline <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Civil, Piping"
                  value={uploadDiscipline}
                  onChange={(e) => setUploadDiscipline(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Optional Metadata: Capture Date */}
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Capture Date <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={uploadCaptureDate}
                onChange={(e) => setUploadCaptureDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Optional Metadata: Locations */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Site Location <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sector 4"
                  value={uploadSiteLocation}
                  onChange={(e) => setUploadSiteLocation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Work Location <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Grid B-4 Pit"
                  value={uploadWorkLocation}
                  onChange={(e) => setUploadWorkLocation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Optional Metadata: Description */}
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Description / Remarks <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Brief description of the visual execution evidence..."
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Upload Feedback Messages */}
            {uploadError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}
            {uploadSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || !uploadFile}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className={`w-4 h-4 ${uploading ? 'animate-bounce' : ''}`} />
              {uploading ? 'Registering Evidence...' : 'Register Execution Evidence'}
            </button>
          </form>
        </div>

        {/* Center & Right 2 Cols: Stored Photos Selector & Evidence Preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photos Selector Bar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-800 text-sm">Select Stored Photo Evidence</h3>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                  {photoFiles.length} file(s)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedFilename}
                  onChange={(e) => setSelectedFilename(e.target.value)}
                  className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {photoFiles.length === 0 ? (
                    <option value="">No photos uploaded yet</option>
                  ) : (
                    photoFiles.map((p) => (
                      <option key={p.filename} value={p.filename}>
                        {p.filename} ({p.file_type.toUpperCase()} • {p.size_kb} KB)
                      </option>
                    ))
                  )}
                </select>

                <button
                  onClick={() => {
                    fetchPhotosList();
                    if (selectedFilename) fetchPhotoDetail(selectedFilename);
                  }}
                  disabled={loading}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-indigo-700 bg-slate-50 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors"
                  title="Refresh photo list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Photo Preview & Evidence Metadata View */}
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center text-slate-500 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
              Loading photo evidence metadata...
            </div>
          ) : currentMeta ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Photo Display Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium truncate">
                    <FileImage className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <span className="truncate">{currentMeta.filename}</span>
                  </div>
                  <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-mono flex-shrink-0">
                    {currentMeta.width && currentMeta.height ? `${currentMeta.width} × ${currentMeta.height} px` : currentMeta.file_type.toUpperCase()}
                  </span>
                </div>

                <div className="p-4 bg-slate-900 flex items-center justify-center min-h-[300px] flex-1">
                  <img
                    src={`/api/ingestion/photos/file/${encodeURIComponent(currentMeta.filename)}`}
                    alt={currentMeta.filename}
                    className="max-h-[380px] max-w-full object-contain rounded shadow-sm border border-slate-700"
                    loading="lazy"
                  />
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex justify-between">
                  <span>MIME: {currentMeta.mime_type}</span>
                  <span>Size: {currentMeta.size_kb} KB ({currentMeta.size_bytes?.toLocaleString()} bytes)</span>
                </div>
              </div>

              {/* Structured Metadata Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-mono text-indigo-600 uppercase tracking-wider block font-semibold">
                      Evidence ID
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                      {currentMeta.evidence_id || 'EVD-UNSPECIFIED'}
                    </h4>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-mono font-medium">
                      {currentMeta.evidence_type}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      Source: {currentMeta.source_type}
                    </span>
                  </div>
                </div>

                {/* Core Attributes Table */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-50">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-slate-400" />
                      Associated Activity ID:
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {currentMeta.activity_id || (
                        <span className="text-slate-400 font-normal italic">None (Metadata Only)</span>
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-50">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      Discipline:
                    </span>
                    <span className="font-semibold text-slate-800">
                      {currentMeta.discipline || (
                        <span className="text-slate-400 font-normal italic">Unspecified</span>
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-50">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Capture Date:
                    </span>
                    <span className="font-medium text-slate-800">
                      {currentMeta.capture_date || (
                        <span className="text-slate-400 font-normal italic">Unspecified</span>
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-50">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      Site Location:
                    </span>
                    <span className="font-medium text-slate-800">
                      {currentMeta.site_location || (
                        <span className="text-slate-400 font-normal italic">Unspecified</span>
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-50">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      Work Location:
                    </span>
                    <span className="font-medium text-slate-800">
                      {currentMeta.work_location || (
                        <span className="text-slate-400 font-normal italic">Unspecified</span>
                      )}
                    </span>
                  </div>

                  {currentMeta.project_name && (
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-500">Project:</span>
                      <span className="font-medium text-slate-800 truncate max-w-[200px]">
                        {currentMeta.project_name}
                      </span>
                    </div>
                  )}

                  {currentMeta.description && (
                    <div className="pt-2">
                      <span className="text-slate-500 block mb-1 font-medium">Evidence Description / Notes:</span>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 leading-relaxed text-[11px]">
                        {currentMeta.description}
                      </div>
                    </div>
                  )}
                </div>

                {/* Analytical Governance Notice */}
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-amber-800 text-[11px] leading-relaxed flex items-start gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-semibold block">Analytical Governance Notice:</span>
                    This photo is stored strictly as execution evidence metadata. It does not perform computer vision, OCR, activity matching, progress inference, or automatic validation.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center text-slate-400 text-xs">
              No photo evidence selected.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
