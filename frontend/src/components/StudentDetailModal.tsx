'use client';

import React, { useEffect, useState, useRef } from 'react';
import { 
  X, 
  User, 
  Calendar, 
  Image as ImageIcon, 
  Upload, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Check,
  Plus,
  History,
  ShieldAlert
} from 'lucide-react';
import { 
  getStudentDetail, 
  updateStudent, 
  deleteStudent, 
  addStudentPrototype, 
  updateAttendanceRecord 
} from '@/lib/api';
import { StudentDetail, AttendanceRecord } from '@/types';

interface StudentDetailModalProps {
  studentId: string | null;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function StudentDetailModal({ studentId, onClose, onRefresh }: StudentDetailModalProps) {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'prototypes' | 'history'>('overview');

  // Edit fields
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editRoll, setEditRoll] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Prototype upload
  const [uploadingProto, setUploadingProto] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Status override state
  const [updatingRecordId, setUpdatingRecordId] = useState<string | null>(null);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  const fetchDetails = async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getStudentDetail(studentId);
      setStudent(data);
      setEditName(data.name);
      setEditRoll(data.roll_number);
    } catch (err: any) {
      setError(err.message || 'Failed to load student details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [studentId]);

  if (!studentId) return null;

  const handleSaveEdit = async () => {
    if (!studentId) return;
    setSavingEdit(true);
    try {
      await updateStudent(studentId, { name: editName, roll_number: editRoll });
      setIsEditing(false);
      await fetchDetails();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || 'Update failed');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!studentId) return;
    setDeleting(true);
    try {
      await deleteStudent(studentId);
      if (onRefresh) onRefresh();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Deletion failed');
      setDeleting(false);
    }
  };

  const handleUploadPrototype = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !studentId) return;

    setUploadingProto(true);
    try {
      await addStudentPrototype(studentId, file);
      await fetchDetails();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to upload prototype photo');
    } finally {
      setUploadingProto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggleRecordStatus = async (record: AttendanceRecord, newStatus: string) => {
    setUpdatingRecordId(record.record_id);
    try {
      await updateAttendanceRecord(record.record_id, {
        status: newStatus,
        override_reason: `Manual toggle in SaaS Directory`,
      });
      await fetchDetails();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update record');
    } finally {
      setUpdatingRecordId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-2xl bg-zinc-950 border-l border-zinc-800 h-full flex flex-col justify-between shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
        
        {/* Modal Header */}
        <div>
          <div className="p-6 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-400 font-bold text-lg">
                {student ? student.name.slice(0, 2).toUpperCase() : 'ST'}
              </div>
              <div>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-cyan-500 outline-none"
                      placeholder="Student Name"
                    />
                    <input
                      type="text"
                      value={editRoll}
                      onChange={(e) => setEditRoll(e.target.value)}
                      className="bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-cyan-500 outline-none w-28 font-mono"
                      placeholder="Roll No"
                    />
                    <button
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                      className="p-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                      {student?.name || 'Loading...'}
                      <button
                        onClick={() => setIsEditing(true)}
                        className="text-zinc-500 hover:text-cyan-400 p-1 rounded"
                        title="Edit Info"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </h2>
                    <p className="text-xs font-mono text-cyan-400">
                      Roll: {student?.roll_number}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-zinc-800 px-6 bg-zinc-900/20 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-4 border-b-2 transition ${
                activeTab === 'overview'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Overview &amp; Stats
            </button>
            <button
              onClick={() => setActiveTab('prototypes')}
              className={`py-3 px-4 border-b-2 transition ${
                activeTab === 'prototypes'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Face Gallery ({student?.embeddings.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-3 px-4 border-b-2 transition ${
                activeTab === 'history'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Attendance History ({student?.history.length || 0})
            </button>
          </div>

          {/* Modal Content Body */}
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="flex justify-center items-center py-16 text-zinc-500 text-sm">
                Loading student telemetry...
              </div>
            ) : error ? (
              <div className="p-4 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-xl text-sm">
                {error}
              </div>
            ) : student && (
              <>
                {/* TAB 1: OVERVIEW */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                        <span className="text-xs text-zinc-500 block">Total Sessions</span>
                        <span className="text-xl font-bold text-zinc-100 font-mono">
                          {student.history.length}
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                        <span className="text-xs text-zinc-500 block">Present Count</span>
                        <span className="text-xl font-bold text-emerald-400 font-mono">
                          {student.history.filter((h) => h.status === 'PRESENT').length}
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                        <span className="text-xs text-zinc-500 block">Attendance Rate</span>
                        <span className="text-xl font-bold text-cyan-400 font-mono">
                          {student.history.length > 0
                            ? Math.round(
                                (student.history.filter((h) => h.status === 'PRESENT').length /
                                  student.history.length) *
                                  100
                              )
                            : 100}
                          %
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Enrollment Telemetry
                      </h4>
                      <div className="text-sm space-y-2 text-zinc-300">
                        <div className="flex justify-between border-b border-zinc-800/80 pb-2">
                          <span className="text-zinc-500">Student ID</span>
                          <span className="font-mono text-xs text-zinc-300">{student.student_id}</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-800/80 pb-2">
                          <span className="text-zinc-500">Enrolled On</span>
                          <span>{new Date(student.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Face Vector Prototypes</span>
                          <span className="text-cyan-400 font-semibold">{student.embeddings.length} / 5 registered</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: PROTOTYPES */}
                {activeTab === 'prototypes' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-zinc-400">
                        Up to 5 face vector prototypes can be registered per student to increase vision accuracy across lighting and angles.
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingProto || student.embeddings.length >= 5}
                        className="px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-semibold hover:bg-cyan-500 transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {uploadingProto ? 'Processing...' : 'Add Prototype'}
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleUploadPrototype}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>

                    <div className="space-y-2">
                      {student.embeddings.map((emb, idx) => (
                        <div
                          key={emb.embedding_id}
                          className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-cyan-400 font-mono">
                              #{idx + 1}
                            </div>
                            <div>
                              <p className="font-mono text-zinc-200">{emb.embedding_id.slice(0, 16)}...</p>
                              <span className="text-zinc-500 text-[11px]">
                                Added {new Date(emb.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-semibold">
                            Active 512D Vector
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: ATTENDANCE HISTORY */}
                {activeTab === 'history' && (
                  <div className="space-y-3">
                    {student.history.length === 0 ? (
                      <div className="text-center py-12 text-zinc-500 text-xs">
                        No session records logged yet for this student.
                      </div>
                    ) : (
                      student.history.map((record) => (
                        <div
                          key={record.record_id}
                          className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-zinc-200">Course: {record.course_id}</span>
                              {record.is_override && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950 text-amber-400 border border-amber-800">
                                  Manual Override
                                </span>
                              )}
                            </div>
                            <p className="text-zinc-500 text-[11px]">
                              {new Date(record.timestamp).toLocaleString()} • Conf: {Math.round(record.confidence_score * 100)}%
                            </p>
                            {record.override_reason && (
                              <p className="text-zinc-400 text-[11px] italic">
                                Reason: &quot;{record.override_reason}&quot;
                              </p>
                            )}
                          </div>

                          {/* Inline Action Buttons to flip status */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleRecordStatus(record, 'PRESENT')}
                              disabled={updatingRecordId === record.record_id}
                              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                                record.status === 'PRESENT'
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'bg-zinc-800 text-zinc-400 hover:text-emerald-400'
                              }`}
                            >
                              Present
                            </button>
                            <button
                              onClick={() => handleToggleRecordStatus(record, 'ABSENT')}
                              disabled={updatingRecordId === record.record_id}
                              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                                record.status === 'ABSENT'
                                  ? 'bg-rose-600 text-white shadow-sm'
                                  : 'bg-zinc-800 text-zinc-400 hover:text-rose-400'
                              }`}
                            >
                              Absent
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Modal Footer / Danger Zone */}
        <div className="p-6 border-t border-zinc-800/80 bg-zinc-900/40">
          {confirmDelete ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-rose-950/60 border border-rose-800">
              <div className="flex items-center gap-2 text-rose-300 text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Confirm permanent deletion of student &amp; embeddings?</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition"
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-rose-500 hover:text-rose-400 flex items-center gap-1.5 font-semibold transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Student Profile
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition"
              >
                Close Drawer
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
