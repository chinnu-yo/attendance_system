'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Camera, 
  Users, 
  BarChart3, 
  UserPlus, 
  Eye, 
  Activity, 
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { checkHealth } from '@/lib/api';

export default function Sidebar() {
  const pathname = usePathname();
  const [engineStatus, setEngineStatus] = useState<{ status: string; engine: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    checkHealth()
      .then((data) => {
        if (isMounted) {
          setEngineStatus({ status: data.status, engine: data.onnx_engine });
        }
      })
      .catch(() => {
        if (isMounted) {
          setEngineStatus({ status: 'offline', engine: 'InsightFace (Disconnected)' });
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const navItems = [
    {
      label: 'Live Audit',
      href: '/',
      icon: Camera,
      badge: 'Vision Engine',
    },
    {
      label: 'Students Directory',
      href: '/students',
      icon: Users,
    },
    {
      label: 'Analytics & Reports',
      href: '/analytics',
      icon: BarChart3,
    },
    {
      label: 'Enroll Student',
      href: '/enroll',
      icon: UserPlus,
    },
  ];

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800/80 flex flex-col justify-between shrink-0 h-screen sticky top-0 z-40 select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-zinc-800/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/10">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-zinc-100 text-base tracking-tight leading-none flex items-center gap-1.5">
              VisionAttendance
              <span className="text-[10px] font-semibold tracking-wider text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50 uppercase">
                SaaS
              </span>
            </h1>
            <p className="text-xs text-zinc-500 mt-1 font-medium">ArcFace 512D AI</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1">
          <p className="px-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Main Management
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-zinc-800/90 text-cyan-400 border border-zinc-700/60 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-zinc-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span className="text-[10px] bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-semibold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                ) : (
                  isActive && <ChevronRight className="w-4 h-4 text-cyan-400/60" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Engine / System Health Badge */}
      <div className="p-4 m-3 rounded-xl bg-zinc-900/90 border border-zinc-800/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Engine Status</span>
          </div>
          <span className="flex h-2 w-2 relative">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                engineStatus?.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                engineStatus?.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            ></span>
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 truncate">
          {engineStatus ? engineStatus.engine : 'Checking model state...'}
        </p>
        <div className="mt-2 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" /> Active Vector DB
          </span>
          <span className="font-mono">SQLite 512-D</span>
        </div>
      </div>
    </aside>
  );
}
