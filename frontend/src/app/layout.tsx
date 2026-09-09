import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VisionAttendance - Classroom Face Recognition & Audit System',
  description: 'CPU-Optimized Automated Classroom Attendance System powered by InsightFace and NumPy Vector Matching.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-900 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
