### `agent_instructions.md`

```markdown
# Agent Instructions: Antigravity Code Assistant

## 1. Core Operating Principles
- Zero Paid Tools: Never introduce external APIs (OpenAI, AWS Rekognition, Pinecone). Everything must run local and open-source.
- Lightweight Local-First: Use SQLite and NumPy for all storage and vector math. Do not install Docker or external database engines.
- Type Safety & Resilience: Python code must strictly use Pydantic v2 schemas and type annotations. Next.js code must use TypeScript with strict null checks.
- CPU Optimization: Always initialize InsightFace with `providers=['CPUExecutionProvider']`. Do not assume CUDA is present.

## 2. Phase-by-Phase Development Instructions

### Phase 1: Backend Foundation
1. Initialize FastAPI app inside `/backend`.
2. Create SQLite database initialization script in `database.py`:
   - Tables: `students`, `courses`, `enrollments`, `sessions`, `session_records`.
   - Store embeddings as SQLite `BLOB` fields (`np.ndarray.tobytes()`).
3. Build the `VisionEngine` singleton in `vision_service.py`:
   - Initialize `insightface.app.FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])`.
   - Prepare model with detection size `(640, 640)`.

### Phase 2: Enrollment & Matching Logic
1. Implement `/api/students/enroll`:
   - Accept student roll number, name, course IDs, and 1-3 headshot photos.
   - Extract embeddings for each face, average them, normalize, and store.
2. Implement `/api/attendance/process`:
   - Accept `course_id` and `List[UploadFile]` (multi-photo).
   - Fetch embeddings only for students enrolled in `course_id`.
   - Execute detection and feature extraction.
   - Run vector matching, threshold evaluation, and cross-photo deduplication.
   - Return structured detection coordinates and attendance status list.

### Phase 3: Frontend Implementation
1. Initialize Next.js app in `/frontend` with Tailwind CSS and Lucide icons.
2. Build Student Registration view (`/enroll`) with preview and file drop.
3. Build Multi-Photo Attendance Session view (`/` and `/session/[id]`):
   - Multi-file dropzone with thumbnail staging.
   - HTML5 Canvas overlay rendering image with color-coded bounding boxes.
   - Roster table with inline status toggles.
   - Save button sending confirmed updates to `/api/attendance/commit`.