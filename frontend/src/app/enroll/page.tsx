'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { enrollStudent } from '@/lib/api';
import { EnrollStudentResponse } from '@/types';
import { UserPlus, Upload, X, CheckCircle2, AlertCircle, Loader2, Image as ImageIcon } from 'lucide-react';

export default function EnrollPage() {
  const [courseId, setCourseId] = useState<string>('CS101');
  const [rollNumber, setRollNumber] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<EnrollStudentResponse | null>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);

    if (photos.length + selectedFiles.length > 3) {
      setError('You can upload a maximum of 3 headshot photos per student.');
      return;
    }

    setError(null);
    const newPhotos = [...photos, ...selectedFiles].slice(0, 3);
    setPhotos(newPhotos);

    // Create thumbnail preview URLs
    const newPreviews = newPhotos.map((file) => URL.createObjectURL(file));
    setPreviews(newPreviews);
  };

  const removePhoto = (index: number) => {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    setPhotos(updatedPhotos);
    const updatedPreviews = updatedPhotos.map((file) => URL.createObjectURL(file));
    setPreviews(updatedPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNumber.trim() || !name.trim()) {
      setError('Please provide both Roll Number and Student Name.');
      return;
    }
    if (photos.length === 0) {
      setError('Please upload at least 1 headshot photo for vector embedding.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessResult(null);

    const formData = new FormData();
    formData.append('roll_number', rollNumber.trim());
    formData.append('name', name.trim());
    formData.append('course_id', courseId);
    photos.forEach((photo) => {
      formData.append('photos', photo);
    });

    try {
      const res = await enrollStudent(formData);
      setSuccessResult(res);
      // Reset form
      setRollNumber('');
      setName('');
      setPhotos([]);
      setPreviews([]);
    } catch (err: any) {
      setError(err.message || 'Failed to enroll student.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <Navbar activeCourse={courseId} onCourseChange={setCourseId} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header Title */}
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Student Vector Enrollment</h1>
            <p className="text-xs text-slate-400">
              Register new students and extract 512-D InsightFace ArcFace embeddings into the course roster.
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {successResult && (
          <div className="flex items-start space-x-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <h4 className="font-semibold text-emerald-200">Student Enrolled Successfully!</h4>
              <p>
                <strong>{successResult.name}</strong> ({successResult.roll_number}) registered with{' '}
                <strong>{successResult.embeddings_registered}</strong> averaged 512-D vector embeddings into{' '}
                <strong>{courseId}</strong>.
              </p>
              <p className="text-[11px] text-emerald-400 font-mono">ID: {successResult.student_id}</p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex items-center space-x-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            <p className="text-xs font-medium">{error}</p>
          </div>
        )}

        {/* Enrollment Form */}
        <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Target Course ID
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm font-semibold text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="CS101">CS101 - Computer Science</option>
                <option value="CS202">CS202 - Data Structures</option>
                <option value="EE101">EE101 - Electronics</option>
                <option value="ME301">ME301 - Robotics</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Roll Number
              </label>
              <input
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="e.g. CS2026_042"
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Student Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Photo Dropzone & Preview Strip */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Headshot Photos (1 to 3 Images)
            </label>
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {/* Thumbnail Previews */}
              {previews.map((src, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-900 aspect-square">
                  <img src={src} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-slate-950/80 text-slate-300 hover:text-rose-400 hover:bg-slate-950 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <span className="absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-950/80 text-slate-300 border border-slate-800">
                    Photo {idx + 1}
                  </span>
                </div>
              ))}

              {/* Add Photo Button if < 3 */}
              {photos.length < 3 && (
                <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-emerald-500/50 transition-all cursor-pointer aspect-square p-4 text-center group">
                  <Upload className="h-6 w-6 text-slate-500 group-hover:text-emerald-400 mb-2 transition-colors" />
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-emerald-400 transition-colors">
                    Upload Photo
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">.jpg, .png, .jpeg</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    multiple
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Note: Multiple headshots taken from slightly different angles improve vector match accuracy under classroom lighting.
            </p>
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-semibold text-slate-950 text-sm shadow-lg shadow-emerald-500/10 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                <span>Extracting 512-D Vector & Enrolling...</span>
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                <span>Register & Enroll Student</span>
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
