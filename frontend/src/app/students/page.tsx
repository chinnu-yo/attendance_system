'use client';

import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  UserPlus, 
  ExternalLink, 
  ShieldAlert, 
  CheckCircle2, 
  MoreHorizontal, 
  Sparkles,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { getStudents } from '@/lib/api';
import { StudentSummary } from '@/types';
import StudentDetailModal from '@/components/StudentDetailModal';

export default function StudentsDirectoryPage() {
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const fetchStudentsList = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStudents();
      setStudents(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch students directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentsList();
  }, []);

  const filteredStudents = (Array.isArray(students) ? students : []).filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.roll_number || '').toLowerCase().includes(q) ||
      (s.student_id || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 select-none">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-cyan-400" />
            Students Directory &amp; Roster
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage student enrollment profiles, face vector prototypes, and historical attendance metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStudentsList}
            className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl transition"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/enroll"
            className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm rounded-xl transition flex items-center gap-2 shadow-lg shadow-cyan-600/20"
          >
            <UserPlus className="w-4 h-4" />
            Enroll New Student
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/80">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student by name or roll..."
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition"
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <span>Showing <strong className="text-zinc-200 font-mono">{filteredStudents.length}</strong> of {students.length} students</span>
          <span className="h-4 w-px bg-zinc-800"></span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Normal (&ge;75%)
            </span>
            <span className="flex items-center gap-1 text-rose-400 font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" /> Defaulter (&lt;75%)
            </span>
          </div>
        </div>
      </div>

      {/* Main Directory Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-sm">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          Loading student profiles and vector telemetry...
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-xl text-sm">
          {error}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/40 rounded-2xl border border-zinc-800/80 p-8 space-y-3">
          <Users className="w-12 h-12 text-zinc-600 mx-auto" />
          <h3 className="text-base font-semibold text-zinc-300">No Students Found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            No enrolled students match your search criteria. Click &quot;Enroll New Student&quot; to register a student face embedding.
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800/80 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-950 text-xs uppercase font-semibold text-zinc-500 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4">Student Profile</th>
                  <th className="px-6 py-4">Roll Number</th>
                  <th className="px-6 py-4">Face Prototypes</th>
                  <th className="px-6 py-4">Sessions Attended</th>
                  <th className="px-6 py-4">Attendance Rate</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredStudents.map((student) => {
                  const isDefaulter = student.attendance_percentage < 75;
                  return (
                    <tr
                      key={student.student_id}
                      className="hover:bg-zinc-800/40 transition group"
                    >
                      {/* Profile Name */}
                      <td className="px-6 py-4 font-medium text-zinc-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center font-bold text-cyan-400 shrink-0">
                          {student.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-100 group-hover:text-cyan-400 transition">
                            {student.name}
                          </p>
                          <p className="text-[11px] text-zinc-500 font-mono">
                            ID: {student.student_id.slice(0, 8)}...
                          </p>
                        </div>
                      </td>

                      {/* Roll Number */}
                      <td className="px-6 py-4 font-mono text-zinc-300 font-semibold">
                        {student.roll_number}
                      </td>

                      {/* Vector Prototypes Badge */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-zinc-950 border border-zinc-800 font-mono text-cyan-400 font-semibold">
                          <Sparkles className="w-3 h-3 text-cyan-400" />
                          {student.num_embeddings} / 5 Embeddings
                        </span>
                      </td>

                      {/* Present Count */}
                      <td className="px-6 py-4">
                        <span className="font-mono text-zinc-200">
                          <strong className="text-emerald-400">{student.present_count}</strong> / {student.total_sessions} sessions
                        </span>
                      </td>

                      {/* Attendance Percentage Progress Bar */}
                      <td className="px-6 py-4">
                        <div className="w-36 space-y-1.5">
                          <div className="flex justify-between text-xs font-mono font-semibold">
                            <span className={isDefaulter ? 'text-rose-400' : 'text-emerald-400'}>
                              {Math.round(student.attendance_percentage)}%
                            </span>
                            {isDefaulter && (
                              <span className="text-[10px] bg-rose-950 text-rose-400 px-1.5 rounded uppercase font-bold border border-rose-800">
                                Defaulter
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-800">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isDefaulter ? 'bg-rose-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, student.attendance_percentage))}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedStudentId(student.student_id)}
                          className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                          Telemetry
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student Detail Slide-Over Modal */}
      {selectedStudentId && (
        <StudentDetailModal
          studentId={selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
          onRefresh={fetchStudentsList}
        />
      )}
    </div>
  );
}
