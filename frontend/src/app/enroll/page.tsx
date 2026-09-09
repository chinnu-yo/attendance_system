'use client';

import React, { useState } from 'react';
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
    <div className="p-8 max-w-4xl mx-auto space-y-8 select-none">
      {/* Header Title */}
      <div className="flex items-center space-x-3 border-b border-zinc-800/80 pb-6">
        <div className="p-3 bg-cyan-950 border border-cyan-800/60 text-cyan-400 rounded-2xl shadow-lg shadow-cyan-950/50">
          <UserPlus className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 tracking-tight">Student Vector Enrollment</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Register new students and extract 512-D InsightFace ArcFace embeddings into the vector database.
          </p>
        </div>
      </div>

      {/* Success Alert */}
      {successResult && (
        <div className="flex items-start space-x-3 rounded-2xl border border-emerald-800/80 bg-emerald-950/60 p-4 text-emerald-300">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-emerald-200">Student Enrolled Successfully!</h4>
            <p>
              <strong>{successResult.name}</strong> ({successResult.roll_number}) registered with{' '}
              <strong>{successResult.embeddings_registered}</strong> active 512-D vector prototype(s) into{' '}
              <strong>{courseId}</strong>.
            </p>
            <p className="text-[11px] text-cyan-400 font-mono">ID: {successResult.student_id}</p>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="flex items-center space-x-3 rounded-2xl border border-rose-800/80 bg-rose-950/60 p-4 text-rose-300">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          <p className="text-xs font-medium">{error}</p>
        </div>
      )}

      {/* Enrollment Form */}
      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/80 p-6 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Target Course ID
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-zinc-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="CS101">CS101 - Computer Science</option>
              <option value="CS202">CS202 - Data Structures</option>
              <option value="EE101">EE101 - Electronics</option>
              <option value="ME301">ME301 - Robotics</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Roll Number
            </label>
            <input
              type="text"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              placeholder="e.g. CS2026_042"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-200 font-mono placeholder-zinc-600 focus:border-cyan-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Student Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-cyan-500 focus:outline-none"
              required
            />
          </div>
        </div>

        {/* Photo Dropzone & Preview Strip */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Headshot Reference Photos (1 to 3 Images)
          </label>
          
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {previews.map((src, idx) => (
              <div key={idx} className="relative group rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 aspect-square">
                <img src={src} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute top-2 right-2 p-1 rounded-full bg-zinc-950/80 text-zinc-300 hover:text-rose-400 hover:bg-zinc-950 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <span className="absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-950/90 text-zinc-300 border border-zinc-800">
                  Photo {idx + 1}
                </span>
              </div>
            ))}

            {photos.length < 3 && (
              <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950 hover:bg-zinc-900 hover:border-cyan-500/50 transition-all cursor-pointer aspect-square p-4 text-center group">
                <Upload className="h-6 w-6 text-zinc-500 group-hover:text-cyan-400 mb-2 transition-colors" />
                <span className="text-xs font-semibold text-zinc-300 group-hover:text-cyan-400 transition-colors">
                  Upload Headshot
                </span>
                <span className="text-[10px] text-zinc-500 mt-1">.jpg, .png, .jpeg</span>
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
          <p className="text-[11px] text-zinc-500 mt-2">
            Note: Multiple headshots taken from slightly different angles improve vector match accuracy under classroom lighting.
          </p>
        </div>

        {/* Submit CTA */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-semibold text-white text-sm shadow-lg shadow-cyan-600/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              <span>Extracting 512-D Vectors &amp; Enrolling...</span>
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              <span>Register &amp; Enroll Student</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
