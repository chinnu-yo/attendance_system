'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Camera, UserPlus, Cpu, CheckCircle2, AlertCircle } from 'lucide-react';
import { checkHealth } from '@/lib/api';

interface NavbarProps {
  activeCourse?: string;
  onCourseChange?: (courseId: string) => void;
}

export function Navbar({ activeCourse = 'CS101', onCourseChange }: NavbarProps) {
  const pathname = usePathname();
  const [engineStatus, setEngineStatus] = useState<'ready' | 'error' | 'loading'>('loading');
  const [engineName, setEngineName] = useState<string>('InsightFace CPU (buffalo_l)');

  useEffect(() => {
    checkHealth()
      .then((data) => {
        setEngineStatus('ready');
        setEngineName(data.onnx_engine || 'InsightFace CPU (buffalo_l)');
      })
      .catch(() => {
        setEngineStatus('error');
      });
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Logo */}
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500/20 transition-all">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-100 group-hover:text-emerald-400 transition-colors">
                VisionAttendance
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                v1.0 CPU
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            <Link
              href="/"
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Camera className="h-4 w-4" />
              <span>Attendance Dashboard</span>
            </Link>
            <Link
              href="/enroll"
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/enroll'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              <span>Student Enrollment</span>
            </Link>
          </nav>
        </div>

        {/* Right Controls: Course Selector & System Status */}
        <div className="flex items-center space-x-4">
          {/* Active Course Selector */}
          <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Course:</span>
            <select
              value={activeCourse}
              onChange={(e) => onCourseChange?.(e.target.value)}
              className="bg-transparent text-sm font-semibold text-emerald-400 focus:outline-none cursor-pointer"
            >
              <option value="CS101" className="bg-slate-800 text-slate-200">CS101 - Computer Science</option>
              <option value="CS202" className="bg-slate-800 text-slate-200">CS202 - Data Structures</option>
              <option value="EE101" className="bg-slate-800 text-slate-200">EE101 - Electronics</option>
              <option value="ME301" className="bg-slate-800 text-slate-200">ME301 - Robotics</option>
            </select>
          </div>

          {/* Date Badge */}
          <div className="hidden lg:flex items-center space-x-2 text-xs font-medium text-slate-400 bg-slate-800/40 px-3 py-1.5 rounded-lg border border-slate-800">
            <span>{today}</span>
          </div>

          {/* Engine Status Indicator */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <Cpu className="h-4 w-4 text-slate-400" />
            <span className="hidden sm:inline text-slate-300 font-mono">{engineName}</span>
            {engineStatus === 'ready' && (
              <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Ready</span>
              </span>
            )}
            {engineStatus === 'loading' && (
              <span className="text-amber-400 font-semibold">Checking...</span>
            )}
            {engineStatus === 'error' && (
              <span className="flex items-center space-x-1 text-rose-400 font-semibold">
                <AlertCircle className="h-3 w-3" />
                <span>Offline</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
