# System Architecture & Technical Specifications

## 1. System Topology

```text
[ Browser: Next.js Client ]
       │  ▲
       │  │ REST (JSON / Multipart Form Data)
       ▼  │
[ Application Server: FastAPI ]
       │
       ├──► [ SQLite Database (`attendance.db`) ]
       │      - Relational tables (Students, Courses, Sessions, Logs)
       │      - Embeddings stored as raw BLOBs (512-D float32)
       │
       └──► [ Local Vision Pipeline (In-Process) ]
              ├── 1. OpenCV Image Decode & Preprocessing
              ├── 2. InsightFace: SCRFD Detector (CPU Execution)
              ├── 3. InsightFace: ArcFace Recognizer (512-D Float Vector)
              └── 4. NumPy Cosine Matcher & Deduplicator
2. Ingestion & Inference Pipeline FlowPlaintextUpload N Images ──► Decode (OpenCV) ──► SCRFD Detection ──► Landmark Alignment
                                                                   │
                                                                   ▼
DB Roster Vector Cache ◄── Load Enrolled Embeddings ◄── ArcFace Vector Extractor
          │                                                        │
          └────────────────► Cosine Matrix Dot Product ◄───────────┘
                                       │
                                       ▼
                       Cross-Image Score Aggregation
                                       │
                                       ▼
                     Deduplication (Winner-Takes-All)
                                       │
                                       ▼
                     JSON Response with BBoxes & Ledger
                     
3. Deduplication AlgorithmIf a student appears in multiple row shots (e.g., photo 1 and photo 2):Compute all match candidates across all uploaded images: (image_index, student_id, score, bbox).Group all detections by student_id.Select the entry with $\max(\text{score})$.If $\max(\text{score}) \ge 0.62$, status = PRESENT.If $0.48 \le \max(\text{score}) < 0.62$, status = REVIEW_NEEDED.Any enrolled student not matched in any image is marked ABSENT.

4. CCTV Abstraction InterfaceTo ensure zero friction when moving to IP cameras:An abstract class FrameIngestionProvider defines fetch_frames() -> List[np.ndarray].Implementation 1 (Current): HTTPUploadFrameProvider extracts frames from uploaded files.Implementation 2 (Future): RTSPStreamFrameProvider captures snapshots from camera endpoints via OpenCV VideoCapture.