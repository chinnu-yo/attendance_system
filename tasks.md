# Tasks Checklist: VisionAttendance

## Phase 1: Backend Foundation & Vision Engine
- [x] Environment Verification & Setup: Checked Python version compatibility, initialized Python 3.11 environment with `uv`, and scaffolded `backend/requirements.txt` with pinned dependencies.
- [x] Database Layer (`backend/database.py`): SQLite schema & migrations for `students`, `courses`, `enrollments`, `sessions`, and `session_records` storing 512-D embeddings as `BLOB`.
- [x] Vision Engine (`backend/vision_service.py`): Initialized InsightFace `buffalo_l` pipeline using `CPUExecutionProvider` with `det_size=(640, 640)`. Implemented face detection, crop/alignment, and 512-D L2-normalized embedding extraction.
- [x] Matching & Deduplication Engine (`backend/matcher.py`): Vectorized NumPy cosine similarity matrix multiplication, multi-image score aggregation, threshold routing (`PRESENT` >= 0.62, `REVIEW` 0.48–0.61, `ABSENT`/`UNRECOGNIZED` < 0.48), and winner-takes-all deduplication.
- [x] API Server & Endpoints (`backend/main.py`): FastAPI server with CORS for `http://localhost:3000`, implementing `POST /api/students/enroll` and `POST /api/attendance/process` per `api_contracts.md`.
- [x] Phase 1 Verification (`backend/test_pipeline.py`): Lightweight smoke test script creating mock course/student and running attendance processing end-to-end.

## Phase 2: Next.js Frontend Implementation
- [x] Next.js Frontend Setup (`/frontend`): Initialized Next.js 14 App Router project with TypeScript, Tailwind CSS, and Lucide React icons.
- [x] Student Registration Page (`/enroll`): Headshot upload dropzone with previews, roll number/name/course form, submitting to `POST /api/students/enroll`.
- [x] Attendance Ingestion Page (`/`): Multi-file drag-and-drop photo uploader with thumbnail staging and pipeline trigger.
- [x] Review & Audit Dashboard (`/`):
  - Split-pane / Canvas / Table tabbed layout.
  - HTML5 Canvas overlay component rendering scaled bounding boxes (Green for `PRESENT` >= 0.62, Yellow for `REVIEW_NEEDED` 0.48–0.61, Red for `UNRECOGNIZED` < 0.48).
  - Summary metrics bar (Total Enrolled, Present, Absent, Needs Review).
  - Searchable roster table with inline status override toggles (`PRESENT` $\leftrightarrow$ `ABSENT`).
  - "Finalize & Save Attendance" committing updates to `POST /api/attendance/commit`.
