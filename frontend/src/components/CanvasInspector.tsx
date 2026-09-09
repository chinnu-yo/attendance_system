'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ProcessedImage, DetectedFace } from '@/types';
import { Eye, Layers, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeProcessedImage = images[activeImageIndex];
  const activeImageFile = imageFiles[activeImageIndex];

  // Draw bounding boxes on canvas whenever active image or selected student changes
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
      const canvasWidth = containerWidth;
      const canvasHeight = containerWidth * aspectRatio;

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // Draw original image
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

      const scaleX = canvasWidth / img.naturalWidth;
      const scaleY = canvasHeight / img.naturalHeight;

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
        ctx.roundRect(bx, tagY, tagWidth, tagHeight, 4);
        ctx.fill();

        // Draw Tag Text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(tagText, bx + padX, tagY + 14);
      });

      URL.revokeObjectURL(objectUrl);
    };
  }, [activeImageIndex, activeImageFile, activeProcessedImage, selectedStudentId]);

  if (!images || images.length === 0 || !imageFiles || imageFiles.length === 0) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/50 p-8 text-center">
        <Eye className="h-12 w-12 text-slate-600 mb-3" />
        <h3 className="text-sm font-semibold text-slate-300">No Classroom Photos Loaded</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Upload 1 to N classroom row photos on the left pane to run InsightFace detection and view bounding boxes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur">
      {/* Image Selection Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Layers className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Classroom Shot Inspector
          </span>
        </div>
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          {images.map((img, idx) => (
            <button
              key={img.image_id}
              onClick={() => setActiveImageIndex(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeImageIndex === idx
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
              }`}
            >
              Photo {idx + 1} ({img.image_filename})
            </button>
          ))}
        </div>
      </div>

      {/* Legend Bar */}
      <div className="flex items-center space-x-6 px-3 py-2 bg-slate-950/60 rounded-lg text-xs border border-slate-850">
        <div className="flex items-center space-x-2">
          <span className="h-3 w-3 rounded-full bg-emerald-500 inline-block shadow-sm"></span>
          <span className="text-slate-300 font-medium">Present (≥ 0.62)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="h-3 w-3 rounded-full bg-amber-500 inline-block shadow-sm"></span>
          <span className="text-slate-300 font-medium">Review Needed (0.48 - 0.61)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="h-3 w-3 rounded-full bg-rose-500 inline-block shadow-sm"></span>
          <span className="text-slate-300 font-medium">Unrecognized (&lt; 0.48)</span>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div ref={containerRef} className="relative w-full overflow-hidden rounded-lg bg-slate-950 border border-slate-800 flex justify-center">
        <canvas ref={canvasRef} className="max-w-full h-auto rounded-lg" />
      </div>
    </div>
  );
}
