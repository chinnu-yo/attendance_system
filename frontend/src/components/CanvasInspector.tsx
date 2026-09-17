'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ProcessedImage, DetectedFace, RosterStudent } from '@/types';
import { Eye, Layers, ZoomIn, ZoomOut, RotateCcw, Move, UserCheck, X, Check } from 'lucide-react';

interface CanvasInspectorProps {
  images: ProcessedImage[];
  imageFiles: File[];
  roster?: RosterStudent[];
  selectedStudentId?: string | null;
  onSelectStudent?: (studentId: string | null) => void;
  onAssignCrop?: (cropId: string, studentId: string) => void;
}

export function CanvasInspector({
  images,
  imageFiles,
  roster = [],
  selectedStudentId,
  onSelectStudent,
  onAssignCrop,
}: CanvasInspectorProps) {
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Attribution popover state
  const [clickedFace, setClickedFace] = useState<DetectedFace | null>(null);
  const [targetStudentId, setTargetStudentId] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeProcessedImage = images[activeImageIndex];
  const activeImageFile = imageFiles[activeImageIndex];

  const handleZoomIn = () => setZoom((z) => Math.min(3.0, z + 0.25));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, z - 0.25));
  const handleResetZoom = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Drag panning handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom <= 1.0 && pan.x === 0 && pan.y === 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Canvas click detection for bounding box attribution
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return;
    if (!canvasRef.current || !activeProcessedImage) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Mouse position within the rendered canvas element
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Invert zoom and pan transformations if applied
    const transformedX = (clientX - pan.x) / zoom;
    const transformedY = (clientY - pan.y) / zoom;

    // Scale from display CSS pixels to intrinsic canvas/image resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const imgX = transformedX * scaleX;
    const imgY = transformedY * scaleY;

    // Find all candidate boxes containing (imgX, imgY)
    const hits = activeProcessedImage.faces.filter((face) => {
      const [x1, y1, x2, y2] = face.bbox;
      return imgX >= x1 && imgX <= x2 && imgY >= y1 && imgY <= y2;
    });

    if (hits.length > 0) {
      // Select box whose center is closest to (imgX, imgY)
      const selectedFace = hits.sort((a, b) => {
        const centerA = [(a.bbox[0] + a.bbox[2]) / 2, (a.bbox[1] + a.bbox[3]) / 2];
        const centerB = [(b.bbox[0] + b.bbox[2]) / 2, (b.bbox[1] + b.bbox[3]) / 2];
        const distA = Math.hypot(imgX - centerA[0], imgY - centerA[1]);
        const distB = Math.hypot(imgX - centerB[0], imgY - centerB[1]);
        return distA - distB;
      })[0];

      setClickedFace(selectedFace);
      setTargetStudentId(selectedFace.matched_student_id || '');
      if (onSelectStudent && selectedFace.matched_student_id) {
        onSelectStudent(selectedFace.matched_student_id);
      }
    }
  };

  // Hover cursor feedback handler
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return;
    if (!canvasRef.current || !activeProcessedImage) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const transformedX = (clientX - pan.x) / zoom;
    const transformedY = (clientY - pan.y) / zoom;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const imgX = transformedX * scaleX;
    const imgY = transformedY * scaleY;

    const isHovering = activeProcessedImage.faces.some((face) => {
      const [x1, y1, x2, y2] = face.bbox;
      return imgX >= x1 && imgX <= x2 && imgY >= y1 && imgY <= y2;
    });

    canvas.style.cursor = isHovering ? 'pointer' : zoom > 1.0 ? 'grab' : 'default';
  };

  const handleExecuteAssignment = () => {
    if (!clickedFace || !targetStudentId || !onAssignCrop) return;
    const cropId = clickedFace.crop_id || `img_${activeImageIndex}_crop_${clickedFace.bbox.join('_')}`;
    onAssignCrop(cropId, targetStudentId);
    setClickedFace(null);
    setTargetStudentId('');
  };

  // Draw bounding boxes on canvas whenever active image, zoom, pan, or selected student changes
  useEffect(() => {
    if (!canvasRef.current || !activeImageFile || !activeProcessedImage) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(activeImageFile);
    img.src = objectUrl;

    img.onload = () => {
      // Set canvas intrinsic resolution to original image dimensions
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      // Calculate conversion from CSS display pixels to canvas intrinsic pixels
      const rect = canvas.getBoundingClientRect();
      const cssToCanvasX = rect.width > 0 ? canvas.width / rect.width : 1;
      const cssToCanvasY = rect.height > 0 ? canvas.height / rect.height : 1;

      // Apply Zoom & Pan Transformations
      ctx.translate(pan.x * cssToCanvasX, pan.y * cssToCanvasY);
      ctx.scale(zoom, zoom);

      // Draw original image at 1:1 intrinsic resolution
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

      // Scale UI elements relative to image size so tags remain readable
      const scaleFactor = Math.max(1, img.naturalWidth / 1000);
      const fontSize = Math.max(12, Math.round((14 * scaleFactor) / zoom));
      const padX = Math.round((8 * scaleFactor) / zoom);
      const tagHeight = Math.round((24 * scaleFactor) / zoom);

      // Render detection bounding boxes
      activeProcessedImage.faces.forEach((face) => {
        const [x1, y1, x2, y2] = face.bbox;
        const bw = x2 - x1;
        const bh = y2 - y1;

        const isSelected =
          (selectedStudentId && face.matched_student_id === selectedStudentId) ||
          (clickedFace && clickedFace.crop_id === face.crop_id);

        // Choose color based on status
        let strokeColor = '#f43f5e'; // Rose for UNRECOGNIZED
        let bgColor = 'rgba(244, 63, 94, 0.85)';
        if (face.status === 'PRESENT') {
          strokeColor = '#22c55e'; // Emerald for PRESENT
          bgColor = 'rgba(34, 197, 94, 0.9)';
        } else if (face.status === 'REVIEW_NEEDED') {
          strokeColor = '#f59e0b'; // Amber for REVIEW_NEEDED
          bgColor = 'rgba(245, 158, 11, 0.9)';
        }

        // Draw Bounding Box Rectangle
        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = ((isSelected ? 5 : 3) * scaleFactor) / zoom;
        if (isSelected) {
          ctx.shadowColor = strokeColor;
          ctx.shadowBlur = (12 * scaleFactor) / zoom;
        }
        ctx.strokeRect(x1, y1, bw, bh);
        ctx.restore();

        // Prepare Tag Text
        const confPercent = Math.round(face.confidence * 100);
        const tagText =
          face.status === 'UNRECOGNIZED'
            ? `Unknown (${confPercent}%)`
            : `${face.name} (${confPercent}%)`;

        ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
        const textMetrics = ctx.measureText(tagText);
        const tagWidth = textMetrics.width + padX * 2;

        // Draw Tag Background
        const tagY = y1 - tagHeight > 0 ? y1 - tagHeight : y1;
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        const borderRadius = Math.round((4 * scaleFactor) / zoom);
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x1, tagY, tagWidth, tagHeight, borderRadius);
        } else {
          ctx.rect(x1, tagY, tagWidth, tagHeight);
        }
        ctx.fill();

        // Draw Tag Text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(tagText, x1 + padX, tagY + tagHeight * 0.7);
      });

      ctx.restore();
      URL.revokeObjectURL(objectUrl);
    };
  }, [activeImageIndex, activeImageFile, activeProcessedImage, selectedStudentId, clickedFace, zoom, pan]);

  if (!images || images.length === 0 || !imageFiles || imageFiles.length === 0) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <Eye className="h-12 w-12 text-zinc-600 mb-3" />
        <h3 className="text-sm font-semibold text-zinc-300">No Classroom Photos Loaded</h3>
        <p className="text-xs text-zinc-500 max-w-sm mt-1">
          Upload classroom row photos on the ingestion pane to run InsightFace detection and view bounding boxes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 backdrop-blur relative">
      {/* Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-3 gap-3">
        <div className="flex items-center space-x-2">
          <Layers className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Classroom Shot Inspector
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Zoom & Pan Controls */}
          <div className="flex items-center space-x-1 bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-800">
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono text-cyan-400 px-1 font-semibold">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              title="Reset View"
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition ml-1 border-l border-zinc-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Photo Selection Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto">
            {images.map((img, idx) => (
              <button
                key={img.image_id}
                onClick={() => {
                  setActiveImageIndex(idx);
                  handleResetZoom();
                  setClickedFace(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeImageIndex === idx
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                    : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                Photo {idx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-zinc-950 rounded-lg text-xs border border-zinc-800/80">
        <div className="flex items-center space-x-5">
          <div className="flex items-center space-x-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block shadow-sm"></span>
            <span className="text-zinc-300 font-medium">Present (≥ 0.52)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block shadow-sm"></span>
            <span className="text-zinc-300 font-medium">Review Needed (0.40 - 0.51)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block shadow-sm"></span>
            <span className="text-zinc-300 font-medium">Unrecognized (&lt; 0.40)</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
          <Move className="w-3 h-3 text-cyan-400" />
          <span>Click bounding box to assign student • Drag to pan</span>
        </div>
      </div>

      {/* Interactive Canvas Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative w-full overflow-hidden rounded-lg bg-zinc-950 border border-zinc-800 flex justify-center items-center min-h-[420px]"
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          className="rounded-lg shadow-inner max-w-full"
        />

        {/* Bounding Box Attribution Popover / Modal */}
        {clickedFace && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-zinc-100 text-sm">Assign Visual Crop to Student</h3>
                </div>
                <button
                  onClick={() => setClickedFace(null)}
                  className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Current Identification</span>
                  <span className="font-semibold text-zinc-200">{clickedFace.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Match Confidence</span>
                  <span className="font-mono text-cyan-400 font-bold">{Math.round(clickedFace.confidence * 100)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Crop ID</span>
                  <span className="font-mono text-zinc-400 text-[11px]">{clickedFace.crop_id || 'Detection Crop'}</span>
                </div>
              </div>

              {/* Roster Student Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Select Enrolled Student Roster
                </label>
                <select
                  value={targetStudentId}
                  onChange={(e) => setTargetStudentId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs rounded-xl p-2.5 outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">-- Choose Student to Assign --</option>
                  {roster.map((s) => (
                    <option key={s.student_id} value={s.student_id}>
                      {s.name} ({s.roll_number}) &bull; Current: {s.status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  onClick={() => setClickedFace(null)}
                  className="px-3 py-2 rounded-xl bg-zinc-900 text-zinc-300 text-xs font-semibold hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteAssignment}
                  disabled={!targetStudentId}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-lg shadow-cyan-600/20"
                >
                  <Check className="w-3.5 h-3.5" />
                  Assign to Student &amp; Mark Present
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
