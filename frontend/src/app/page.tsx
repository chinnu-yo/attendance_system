'use client';

import React, { useState } from 'react';
import { CanvasInspector } from '@/components/CanvasInspector';
import { processAttendance, commitAttendance } from '@/lib/api';
import {
  ProcessAttendanceResponse,
  RosterStudent,
  CommitAttendancePayload,
} from '@/types';
import {
  Upload,
  Camera,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Loader2,
  Save,
  Trash2,
  Check,
  X,
  RefreshCw,
  Users,
  Eye,
  SlidersHorizontal,
  BookOpen
} from 'lucide-react';

export default function AttendanceDashboardPage() {
  const [courseId, setCourseId] = useState<string>('CS101');
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingError, setProcessingError] = useState<string | null>(null);

  // Processed Pipeline Response
  const [pipelineData, setPipelineData] = useState<ProcessAttendanceResponse | null>(null);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [overrides, setOverrides] = useState<Record<string, { status: 'PRESENT' | 'ABSENT'; reason: string }>>({});
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Commit Status
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null);

  // Tab View Control: 'canvas' vs 'roster' vs 'split'
  const [activeTab, setActiveTab] = useState<'canvas' | 'roster' | 'split'>('split');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    const newFiles = [...stagedFiles, ...selected];
    setStagedFiles(newFiles);
    setFilePreviews(newFiles.map((f) => URL.createObjectURL(f)));
    setProcessingError(null);
  };

  const removeStagedFile = (idx: number) => {
    const newFiles = stagedFiles.filter((_, i) => i !== idx);
    setStagedFiles(newFiles);
    setFilePreviews(newFiles.map((f) => URL.createObjectURL(f)));
  };

  const handleRunPipeline = async () => {
    if (stagedFiles.length === 0) {
      setProcessingError('Please upload at least 1 classroom photo.');
      return;
    }

    setIsProcessing(true);
    setProcessingError(null);
    setCommitSuccess(null);

    const formData = new FormData();
    formData.append('course_id', courseId);
    stagedFiles.forEach((file) => {
      formData.append('images', file);
    });

    try {
      const res = await processAttendance(formData);
      setPipelineData(res);
      setRoster(res.roster);
      setOverrides({});
    } catch (err: any) {
      setProcessingError(err.message || 'Attendance processing failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleStudentStatus = (studentId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'PRESENT' ? 'ABSENT' : 'PRESENT';
    setRoster((prev) =>
      prev.map((s) =>
        s.student_id === studentId
          ? {
              ...s,
              status: newStatus as 'PRESENT' | 'ABSENT',
            }
          : s
      )
    );

    setOverrides((prev) => ({
      ...prev,
      [studentId]: {
        status: newStatus as 'PRESENT' | 'ABSENT',
        reason: 'Manual instructor override',
      },
    }));
  };

  const handleCommitAttendance = async () => {
    if (!pipelineData || roster.length === 0) return;

    setIsCommitting(true);
    setCommitSuccess(null);

    const payload: CommitAttendancePayload = {
      course_id: courseId,
      records: roster.map((student) => ({
        student_id: student.student_id,
        status: student.status,
        override: !!overrides[student.student_id],
        override_reason: overrides[student.student_id]?.reason,
      })),
    };

    try {
      const res = await commitAttendance(payload);
      setCommitSuccess(
        `Session committed successfully! (${res.committed_records} records finalized, Session ID: ${res.session_id})`
      );
    } catch (err: any) {
      setProcessingError(err.message || 'Failed to commit attendance.');
    } finally {
      setIsCommitting(false);
    }
  };

  // Metrics Calculation
  const totalEnrolled = roster.length;
  const presentCount = roster.filter((r) => r.status === 'PRESENT').length;
  const reviewCount = roster.filter((r) => r.status === 'REVIEW_NEEDED').length;
  const absentCount = roster.filter((r) => r.status === 'ABSENT').length;

  const filteredRoster = roster.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 select-none">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 tracking-tight flex items-center gap-2.5">
            <Camera className="w-6 h-6 text-cyan-400" />
            Live Classroom Attendance &amp; Audit Engine
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Multi-photo classroom ingestion powered by InsightFace ArcFace 512D embeddings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-900 px-3.5 py-2 rounded-xl border border-zinc-800 text-xs">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span className="text-zinc-400 font-medium">Active Course:</span>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="bg-zinc-950 text-cyan-400 font-bold font-mono outline-none cursor-pointer rounded px-1.5 py-0.5 border border-zinc-800"
            >
              <option value="CS101">CS101 - Computer Science</option>
              <option value="CS202">CS202 - Data Structures</option>
              <option value="EE101">EE101 - Electronics</option>
              <option value="ME301">ME301 - Robotics</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {processingError && (
        <div className="flex items-center space-x-3 rounded-xl border border-rose-800/80 bg-rose-950/60 p-4 text-rose-300">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          <p className="text-xs font-medium">{processingError}</p>
        </div>
      )}

      {commitSuccess && (
        <div className="flex items-center space-x-3 rounded-xl border border-emerald-800/80 bg-emerald-950/60 p-4 text-emerald-300">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <p className="text-xs font-semibold">{commitSuccess}</p>
        </div>
      )}

      {/* Classroom Ingestion Card */}
      <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/80 p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-zinc-100 flex items-center space-x-2">
              <Camera className="h-5 w-5 text-cyan-400" />
              <span>Classroom Photo Ingestion ({courseId})</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Upload 1 to N high-resolution row photos (Front, Middle, Back benches) for multi-photo vector matching.
            </p>
          </div>

          {stagedFiles.length > 0 && (
            <button
              onClick={handleRunPipeline}
              disabled={isProcessing}
              className="py-2.5 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-semibold text-white text-sm shadow-lg shadow-cyan-600/20 flex items-center space-x-2 transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Running Vision Pipeline...</span>
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  <span>Run Attendance Pipeline</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Drag & Drop Zone */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950 hover:bg-zinc-900/80 hover:border-cyan-500/50 transition-all cursor-pointer p-6 text-center group min-h-[140px]">
            <Upload className="h-7 w-7 text-zinc-500 group-hover:text-cyan-400 mb-2 transition-colors" />
            <span className="text-xs font-semibold text-zinc-300 group-hover:text-cyan-400 transition-colors">
              Drop Classroom Photos
            </span>
            <span className="text-[10px] text-zinc-500 mt-1">Accepts .jpg, .png, .jpeg</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          {filePreviews.map((src, idx) => (
            <div
              key={idx}
              className="relative group rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 min-h-[140px] flex items-center justify-center"
            >
              <img src={src} alt={`Staged ${idx}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeStagedFile(idx)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-zinc-950/80 text-zinc-300 hover:text-rose-400 hover:bg-zinc-950 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <span className="absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-950/90 text-zinc-300 border border-zinc-800">
                Row Photo {idx + 1}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Audit Dashboard Section */}
      {pipelineData && (
        <section className="space-y-6">
          {/* Dashboard Header */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center space-x-2">
              <SlidersHorizontal className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-zinc-200">Audit &amp; Review Dashboard</h3>
            </div>

            <div className="flex items-center space-x-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              <button
                onClick={() => setActiveTab('split')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'split'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Split View
              </button>
              <button
                onClick={() => setActiveTab('canvas')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'canvas'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Canvas Overlay
              </button>
              <button
                onClick={() => setActiveTab('roster')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'roster'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Roster Table
              </button>
            </div>
          </div>

          {/* Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">Total Enrolled</span>
                <Users className="h-4 w-4 text-zinc-500" />
              </div>
              <span className="text-2xl font-bold text-zinc-100 font-mono mt-2 block">{totalEnrolled}</span>
            </div>

            <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-emerald-300">Present</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <span className="text-2xl font-bold text-emerald-400 font-mono mt-2 block">{presentCount}</span>
            </div>

            <div className="rounded-xl border border-amber-800/40 bg-amber-950/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-300">Needs Review</span>
                <AlertCircle className="h-4 w-4 text-amber-400" />
              </div>
              <span className="text-2xl font-bold text-amber-400 font-mono mt-2 block">{reviewCount}</span>
            </div>

            <div className="rounded-xl border border-rose-800/40 bg-rose-950/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-rose-300">Absent</span>
                <XCircle className="h-4 w-4 text-rose-400" />
              </div>
              <span className="text-2xl font-bold text-rose-400 font-mono mt-2 block">{absentCount}</span>
            </div>
          </div>

          {/* Canvas & Table Workspace */}
          <div className={`grid gap-6 ${activeTab === 'split' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
            {(activeTab === 'split' || activeTab === 'canvas') && (
              <div className={activeTab === 'split' ? 'lg:col-span-6' : 'w-full'}>
                <CanvasInspector
                  images={pipelineData.processed_images}
                  imageFiles={stagedFiles}
                  selectedStudentId={selectedStudentId}
                  onSelectStudent={setSelectedStudentId}
                />
              </div>
            )}

            {(activeTab === 'split' || activeTab === 'roster') && (
              <div
                className={`rounded-2xl border border-zinc-800/80 bg-zinc-900/80 p-4 shadow-xl flex flex-col space-y-4 ${
                  activeTab === 'split' ? 'lg:col-span-6' : 'w-full'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search student or roll number..."
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  <span className="text-xs text-zinc-400 font-medium">
                    Showing {filteredRoster.length} of {roster.length}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-zinc-950 text-zinc-400 font-semibold uppercase tracking-wider text-[10px] border-b border-zinc-800">
                      <tr>
                        <th className="px-3 py-2.5">Roll Number</th>
                        <th className="px-3 py-2.5">Student Name</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5">Score</th>
                        <th className="px-3 py-2.5 text-right">Action Toggle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                      {filteredRoster.map((student) => {
                        const isSelected = selectedStudentId === student.student_id;
                        const hasOverride = !!overrides[student.student_id];

                        return (
                          <tr
                            key={student.student_id}
                            onClick={() => setSelectedStudentId(student.student_id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-zinc-800/80' : 'hover:bg-zinc-900/60'
                            }`}
                          >
                            <td className="px-3 py-2.5 font-mono text-zinc-400 font-medium">
                              {student.roll_number}
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-zinc-200">
                              {student.name}
                              {hasOverride && (
                                <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                                  Manual
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              {student.status === 'PRESENT' && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                                  <Check className="h-3 w-3" />
                                  <span>PRESENT</span>
                                </span>
                              )}
                              {student.status === 'REVIEW_NEEDED' && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950 text-amber-400 border border-amber-800">
                                  <AlertCircle className="h-3 w-3" />
                                  <span>REVIEW</span>
                                </span>
                              )}
                              {student.status === 'ABSENT' && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-950 text-rose-400 border border-rose-800">
                                  <X className="h-3 w-3" />
                                  <span>ABSENT</span>
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-zinc-400">
                              {student.confidence > 0 ? `${Math.round(student.confidence * 100)}%` : '0%'}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleStudentStatus(student.student_id, student.status);
                                }}
                                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                                  student.status === 'PRESENT'
                                    ? 'bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-800'
                                    : 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-800'
                                }`}
                              >
                                {student.status === 'PRESENT' ? 'Set ABSENT' : 'Set PRESENT'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pt-2 border-t border-zinc-800 flex justify-end">
                  <button
                    onClick={handleCommitAttendance}
                    disabled={isCommitting}
                    className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-white text-sm shadow-lg shadow-emerald-600/20 flex items-center space-x-2 transition-all disabled:opacity-50"
                  >
                    {isCommitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                        <span>Saving Session...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        <span>Finalize &amp; Save Attendance</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
