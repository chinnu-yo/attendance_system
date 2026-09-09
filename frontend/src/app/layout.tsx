import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'VisionAttendance SaaS - AI Face Recognition & Management Platform',
  description: 'Production SaaS Automated Attendance Platform powered by InsightFace ArcFace 512D vectors.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased min-h-screen flex font-sans">
        <Sidebar />
        <main className="flex-1 overflow-y-auto min-h-screen bg-zinc-950">
          {children}
        </main>
      </body>
    </html>
  );
}
