'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ProcessedImage, DetectedFace } from '@/types';
import { Eye, Layers, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';

interface CanvasInspectorProps {
  images: ProcessedImage[];
  imageFiles: File[];
  selectedStudentId?: string | null;
  onSelectStudent?: (studentId: string | null) => void;
}

export function CanvasInspector({
  images,
  imageFiles,
  selectedStudentId,
  onSelectStudent,
}: CanvasInspectorProps) {
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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
      // Determine canvas display dimensions
      const containerWidth = containerRef.current?.clientWidth || 800;
      const aspectRatio = img.naturalHeight / img.naturalWidth;
      const baseCanvasWidth = containerWidth;
      const baseCanvasHeight = containerWidth * aspectRatio;

      canvas.width = baseCanvasWidth * zoom;
      canvas.height = baseCanvasHeight * zoom;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      // Apply Zoom & Pan Transformations
      ctx.translate(pan.x, pan.y);

      // Draw scaled image
      ctx.drawImage(img, 0, 0, baseCanvasWidth * zoom, baseCanvasHeight * zoom);

      const scaleX = (baseCanvasWidth * zoom) / img.naturalWidth;
      const scaleY = (baseCanvasHeight * zoom) / img.naturalHeight;

      // Render detection bounding boxes
      activeProcessedImage.faces.forEach((face) => {
        const [x1, y1, x2, y2] = face.bbox;
        const bx = x1 * scaleX;
        const by = y1 * scaleY;
        const bw = (x2 - x1) * scaleX;
        const bh = (y2 - y1) * scaleY;

        const isSelected = selectedStudentId && face.matched_student_id === selectedStudentId;

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
        ctx.lineWidth = isSelected ? 4 : 2;
        if (isSelected) {
          ctx.shadowColor = strokeColor;
          ctx.shadowBlur = 12;
        }
        ctx.strokeRect(bx, by, bw, bh);
        ctx.restore();

        // Prepare Tag Text
        const confPercent = Math.round(face.confidence * 100);
        const tagText =
          face.status === 'UNRECOGNIZED'
            ? `Unknown (${confPercent}%)`
            : `${face.name} (${confPercent}%)`;

        ctx.font = 'bold 12px system-ui, sans-serif';
        const textMetrics = ctx.measureText(tagText);
        const padX = 8;
        const tagHeight = 20;
        const tagWidth = textMetrics.width + padX * 2;

        // Draw Tag Background
        const tagY = by - tagHeight > 0 ? by - tagHeight : by;
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx, tagY, tagWidth, tagHeight, 4);
        } else {
          ctx.rect(bx, tagY, tagWidth, tagHeight);
        }
        ctx.fill();

        // Draw Tag Text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(tagText, bx + padX, tagY + 14);
      });

      ctx.restore();
      URL.revokeObjectURL(objectUrl);
    };
  }, [activeImageIndex, activeImageFile, activeProcessedImage, selectedStudentId, zoom, pan]);

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
    <div className="flex flex-col space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 backdrop-blur">
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

      {/* Legend & Pan Notice Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-zinc-950 rounded-lg text-xs border border-zinc-800/80">
        <div className="flex items-center space-x-5">
          <div className="flex items-center space-x-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block shadow-sm"></span>
            <span className="text-zinc-300 font-medium">Present (≥ 0.58)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block shadow-sm"></span>
            <span className="text-zinc-300 font-medium">Review Needed (0.45 - 0.57)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block shadow-sm"></span>
            <span className="text-zinc-300 font-medium">Unrecognized (&lt; 0.45)</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
          <Move className="w-3 h-3 text-cyan-400" />
          <span>Click &amp; drag canvas to pan when zoomed</span>
        </div>
      </div>

      {/* Interactive Canvas Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative w-full overflow-hidden rounded-lg bg-zinc-950 border border-zinc-800 flex justify-center items-center min-h-[420px] ${
          zoom > 1.0 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
      >
        <canvas ref={canvasRef} className="rounded-lg shadow-inner max-w-full" />
      </div>
    </div>
  );
}
