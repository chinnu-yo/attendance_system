'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
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
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <Navbar activeCourse={courseId} onCourseChange={setCourseId} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Error Notification */}
        {processingError && (
          <div className="flex items-center space-x-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            <p className="text-xs font-medium">{processingError}</p>
          </div>
        )}

        {/* Commit Success Notification */}
        {commitSuccess && (
          <div className="flex items-center space-x-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <p className="text-xs font-semibold">{commitSuccess}</p>
          </div>
        )}

        {/* Top Section: Ingestion Pane */}
        <section className="rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Camera className="h-5 w-5 text-emerald-400" />
                <span>Classroom Photo Ingestion ({courseId})</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload 1 to N high-resolution row photos (Front, Middle, Back benches) for multi-photo deduplication.
              </p>
            </div>

            {stagedFiles.length > 0 && (
              <button
                onClick={handleRunPipeline}
                disabled={isProcessing}
                className="py-2.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-semibold text-slate-950 text-sm shadow-lg shadow-emerald-500/10 flex items-center space-x-2 transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
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

          {/* Drag & Drop Staging Area */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-emerald-500/50 transition-all cursor-pointer p-6 text-center group min-h-[140px]">
              <Upload className="h-7 w-7 text-slate-500 group-hover:text-emerald-400 mb-2 transition-colors" />
              <span className="text-xs font-semibold text-slate-300 group-hover:text-emerald-400 transition-colors">
                Drop Classroom Photos
              </span>
              <span className="text-[10px] text-slate-500 mt-1">Accepts .jpg, .png, .jpeg</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            {/* Staged Photo Thumbnails */}
            {filePreviews.map((src, idx) => (
              <div
                key={idx}
                className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-900 min-h-[140px] flex items-center justify-center"
              >
                <img src={src} alt={`Staged ${idx}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeStagedFile(idx)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-950/80 text-slate-300 hover:text-rose-400 hover:bg-slate-950 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <span className="absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-950/80 text-slate-300 border border-slate-800">
                  Row Photo {idx + 1}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Dashboard Split/Tab View */}
        {pipelineData && (
          <section className="space-y-4">
            {/* View Mode Toggle Bar */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <SlidersHorizontal className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-200">Audit & Review Dashboard</h3>
              </div>

              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setActiveTab('split')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeTab === 'split'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Split View
                </button>
                <button
                  onClick={() => setActiveTab('canvas')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeTab === 'canvas'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Canvas Overlay
                </button>
                <button
                  onClick={() => setActiveTab('roster')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeTab === 'roster'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Roster Table
                </button>
              </div>
            </div>

            {/* Metrics Summary Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Total Enrolled</span>
                  <Users className="h-4 w-4 text-slate-500" />
                </div>
                <span className="text-2xl font-bold text-slate-100 mt-2 block">{totalEnrolled}</span>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-emerald-300">Present</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                </div>
                <span className="text-2xl font-bold text-emerald-400 mt-2 block">{presentCount}</span>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-amber-300">Needs Review</span>
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                </div>
                <span className="text-2xl font-bold text-amber-400 mt-2 block">{reviewCount}</span>
              </div>

              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-rose-300">Absent</span>
                  <XCircle className="h-4 w-4 text-rose-400" />
                </div>
                <span className="text-2xl font-bold text-rose-400 mt-2 block">{absentCount}</span>
              </div>
            </div>

            {/* Main Content Area: Canvas & Table */}
            <div
              className={`grid gap-6 ${
                activeTab === 'split'
                  ? 'grid-cols-1 lg:grid-cols-12'
                  : 'grid-cols-1'
              }`}
            >
              {/* Canvas Inspector Component */}
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

              {/* Roster Table Component */}
              {(activeTab === 'split' || activeTab === 'roster') && (
                <div
                  className={`rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-xl flex flex-col space-y-4 ${
                    activeTab === 'split' ? 'lg:col-span-6' : 'w-full'
                  }`}
                >
                  {/* Search Bar */}
                  <div className="flex items-center justify-between">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search student or roll number..."
                        className="w-full rounded-lg border border-slate-800 bg-slate-900 pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <span className="text-xs text-slate-400 font-medium">
                      Showing {filteredRoster.length} of {roster.length}
                    </span>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto rounded-lg border border-slate-850">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-800">
                        <tr>
                          <th className="px-3 py-2.5">Roll Number</th>
                          <th className="px-3 py-2.5">Student Name</th>
                          <th className="px-3 py-2.5">Status</th>
                          <th className="px-3 py-2.5">Score</th>
                          <th className="px-3 py-2.5 text-right">Action Toggle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 bg-slate-950">
                        {filteredRoster.map((student) => {
                          const isSelected = selectedStudentId === student.student_id;
                          const hasOverride = !!overrides[student.student_id];

                          return (
                            <tr
                              key={student.student_id}
                              onClick={() => setSelectedStudentId(student.student_id)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-slate-800/80' : 'hover:bg-slate-900/60'
                              }`}
                            >
                              <td className="px-3 py-2.5 font-mono text-slate-400 font-medium">
                                {student.roll_number}
                              </td>
                              <td className="px-3 py-2.5 font-semibold text-slate-200">
                                {student.name}
                                {hasOverride && (
                                  <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    Manual
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                {student.status === 'PRESENT' && (
                                  <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    <Check className="h-3 w-3" />
                                    <span>PRESENT</span>
                                  </span>
                                )}
                                {student.status === 'REVIEW_NEEDED' && (
                                  <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    <AlertCircle className="h-3 w-3" />
                                    <span>REVIEW</span>
                                  </span>
                                )}
                                {student.status === 'ABSENT' && (
                                  <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                    <X className="h-3 w-3" />
                                    <span>ABSENT</span>
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-slate-400">
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
                                      ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30'
                                      : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30'
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

                  {/* Finalize Action Bar */}
                  <div className="pt-2 border-t border-slate-800 flex justify-end">
                    <button
                      onClick={handleCommitAttendance}
                      disabled={isCommitting}
                      className="py-2.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-semibold text-slate-950 text-sm shadow-lg shadow-emerald-500/10 flex items-center space-x-2 transition-all disabled:opacity-50"
                    >
                      {isCommitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                          <span>Saving Session...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>Finalize & Save Attendance</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
