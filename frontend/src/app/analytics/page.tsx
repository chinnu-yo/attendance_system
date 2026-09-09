'use client';

import React, { useEffect, useState } from 'react';
import { 
  BarChart3, 
  Download, 
  ShieldAlert, 
  Users, 
  Calendar, 
  TrendingUp, 
  CheckCircle2, 
  RefreshCw,
  ExternalLink,
  FileSpreadsheet
} from 'lucide-react';
import { getAnalyticsOverview, getExportCsvUrl } from '@/lib/api';
import { AnalyticsOverview } from '@/types';
import StudentDetailModal from '@/components/StudentDetailModal';

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAnalyticsOverview();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-cyan-400" />
            Analytics &amp; Executive Reports
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time attendance metrics, defaulter radar alerts, and CSV spreadsheet exports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAnalytics}
            className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl transition"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <a
            href={getExportCsvUrl()}
            download
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export CSV Report
          </a>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-sm">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          Calculating attendance analytics &amp; defaulters radar...
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-xl text-sm">
          {error}
        </div>
      ) : data && (
        <>
          {/* Top 4 KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* KPI 1 */}
            <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                  Total Students
                </span>
                <span className="text-2xl font-extrabold text-zinc-100 font-mono mt-1 block">
                  {data.total_students}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                <Users className="w-6 h-6" />
              </div>
            </div>

            {/* KPI 2 */}
            <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                  Sessions Conducted
                </span>
                <span className="text-2xl font-extrabold text-zinc-100 font-mono mt-1 block">
                  {data.total_sessions}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-950 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
                <Calendar className="w-6 h-6" />
              </div>
            </div>

            {/* KPI 3 */}
            <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                  Overall Attendance
                </span>
                <span className="text-2xl font-extrabold text-emerald-400 font-mono mt-1 block">
                  {Math.round(data.overall_attendance_rate)}%
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            {/* KPI 4 */}
            <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                  Defaulters (&lt;75%)
                </span>
                <span className="text-2xl font-extrabold text-rose-400 font-mono mt-1 block">
                  {data.defaulters_count}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-950 border border-rose-800/60 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Section: Defaulters Warning Radar */}
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">
                    Defaulter Radar Warning (&lt; 75% Attendance)
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Students flagged below institutional compliance threshold requiring intervention.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-950 text-rose-400 border border-rose-800 font-mono">
                {data.defaulters.length} Flagged
              </span>
            </div>

            {(!data.defaulters || data.defaulters.length === 0) ? (
              <div className="text-center py-8 text-xs text-zinc-500 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                All enrolled students meet or exceed the 75% attendance requirement.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.defaulters.map((student) => (
                  <div
                    key={student.student_id}
                    className="p-4 rounded-xl bg-zinc-950 border border-rose-900/40 hover:border-rose-700/60 transition flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-bold text-zinc-200 text-sm">{student.name}</h4>
                      <p className="text-xs font-mono text-zinc-500">Roll: {student.roll_number}</p>
                      <p className="text-xs font-mono text-rose-400 font-semibold mt-1">
                        Attendance: {Math.round(student.attendance_percentage)}% ({student.present_count}/{student.total_sessions})
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedStudentId(student.student_id)}
                      className="p-2 bg-zinc-900 hover:bg-zinc-800 text-cyan-400 rounded-lg transition"
                      title="Inspect Student Telemetry"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Session Chronological Trends */}
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-4">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Recent Attendance Session Trends
            </h3>

            {(!data.session_trends || data.session_trends.length === 0) ? (
              <div className="text-center py-8 text-xs text-zinc-500">
                No session logs recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {data.session_trends.map((trend, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-zinc-900 flex items-center justify-center font-mono text-cyan-400 font-bold">
                        #{data.session_trends.length - idx}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-200">{trend.date}</p>
                        <span className="text-zinc-500 text-[11px] font-mono">
                          {trend.total_sessions} logged records
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-32 bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
                        <div
                          className="h-full bg-cyan-500 rounded-full"
                          style={{ width: `${Math.min(100, trend.attendance_rate)}%` }}
                        ></div>
                      </div>
                      <span className="font-mono font-bold text-cyan-400 text-sm w-12 text-right">
                        {Math.round(trend.attendance_rate)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Student Detail Slide-Over Modal */}
      {selectedStudentId && (
        <StudentDetailModal
          studentId={selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
          onRefresh={fetchAnalytics}
        />
      )}
    </div>
  );
}
