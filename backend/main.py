import uuid
import numpy as np
from typing import List, Optional
from fastapi import FastAPI, Form, File, UploadFile, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from backend.database import (
        init_db,
        save_student_with_enrollment,
        get_enrolled_students,
        get_db_connection,
        get_student_prototypes,
        add_student_prototype,
        update_student_prototype
    )
    from backend.vision_service import VisionEngine
    from backend.matcher import process_attendance_matching
except ImportError:
    from database import (
        init_db,
        save_student_with_enrollment,
        get_enrolled_students,
        get_db_connection,
        get_student_prototypes,
        add_student_prototype,
        update_student_prototype
    )
    from vision_service import VisionEngine
    from matcher import process_attendance_matching

app = FastAPI(
    title="VisionAttendance API",
    description="Automated classroom attendance system using InsightFace, Multi-Prototype Galleries, & Adaptive Feedback Learning.",
    version="1.1.0"
)

# CORS configuration allowing local Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    """Initializes SQLite database schema and multi-prototype migrations on startup."""
    init_db()


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "onnx_engine": "InsightFace CPU (buffalo_l, det_thresh=0.60)"}


@app.post("/api/students/enroll", status_code=status.HTTP_201_CREATED)
async def enroll_student(
    roll_number: str = Form(...),
    name: str = Form(...),
    course_id: str = Form(...),
    photos: List[UploadFile] = File(...)
):
    """
    Enrolls a student into a course with 1 to 3 headshot images.
    Extracts, averages, and L2-normalizes 512-D vectors, then persists into SQLite student_embeddings.
    """
    if not (1 <= len(photos) <= 3):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must upload between 1 and 3 headshot photos for enrollment."
        )

    photos_bytes = []
    for photo in photos:
        content = await photo.read()
        photos_bytes.append(content)

    vision_engine = VisionEngine.get_instance()
    try:
        avg_embedding = vision_engine.extract_average_embedding(photos_bytes)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Face extraction failed during enrollment: {str(e)}"
        )

    student_id = f"std_{uuid.uuid4().hex[:12]}"
    save_student_with_enrollment(
        student_id=student_id,
        roll_number=roll_number,
        name=name,
        embedding=avg_embedding,
        course_id=course_id
    )

    return {
        "status": "success",
        "student_id": student_id,
        "roll_number": roll_number,
        "name": name,
        "embeddings_registered": len(photos)
    }


@app.post("/api/attendance/process", status_code=status.HTTP_200_OK)
async def process_attendance(
    course_id: str = Form(...),
    images: List[UploadFile] = File(...)
):
    """
    Processes multi-photo classroom attendance against enrolled course roster with multi-prototype galleries.
    Caches detected face crops in session memory for adaptive learning on commitment.
    """
    if not images:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one classroom image must be provided."
        )

    # 1. Retrieve enrolled students and their multi-prototype embeddings
    enrolled_students = get_enrolled_students(course_id)

    # 2. Process face detection across all uploaded classroom photos
    vision_engine = VisionEngine.get_instance()
    images_data = []
    flattened_cached_faces = []

    for idx, img_file in enumerate(images):
        content = await img_file.read()
        image_id = f"img_{idx + 1:03d}"
        
        try:
            _, detected_faces = vision_engine.process_image_bytes(content)
        except Exception as e:
            detected_faces = []

        images_data.append({
            "image_id": image_id,
            "image_filename": img_file.filename or f"photo_{idx + 1}.jpg",
            "faces": detected_faces
        })

        for face in detected_faces:
            bbox = face["bbox"]
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            flattened_cached_faces.append({
                "image_id": image_id,
                "bbox": bbox,
                "width": w,
                "height": h,
                "det_score": face["det_score"],
                "embedding": face["embedding"]
            })

    # Cache detections in session memory
    session_token = f"stok_{uuid.uuid4().hex[:12]}"
    vision_engine.store_session_cache(session_token, flattened_cached_faces)

    # 3. Vectorized matching & deduplication using multi-prototype galleries
    results = process_attendance_matching(images_data, enrolled_students)
    results["session_token"] = session_token
    return results


class CommitRecordItem(BaseModel):
    student_id: str
    status: str
    override: bool = False
    override_reason: Optional[str] = None


class CommitAttendanceRequest(BaseModel):
    course_id: str
    records: List[CommitRecordItem]
    session_token: Optional[str] = None


@app.post("/api/attendance/commit", status_code=status.HTTP_200_OK)
async def commit_attendance(payload: CommitAttendanceRequest):
    """
    Persists finalized attendance records into SQLite and executes the Adaptive Feedback Learning Loop
    for instructor manual overrides.
    """
    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    vision_engine = VisionEngine.get_instance()
    cached_detections = vision_engine.get_session_cache(payload.session_token) if payload.session_token else []

    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO sessions (session_id, course_id) VALUES (?, ?)",
            (session_id, payload.course_id)
        )
        
        committed_records = 0
        learned_prototypes = 0

        for rec in payload.records:
            record_id = f"rec_{uuid.uuid4().hex[:12]}"
            cursor.execute(
                """
                INSERT INTO session_records 
                (record_id, session_id, student_id, status, confidence, override, override_reason)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record_id,
                    session_id,
                    rec.student_id,
                    rec.status,
                    1.0 if rec.override else 0.8,
                    1 if rec.override else 0,
                    rec.override_reason
                )
            )
            committed_records += 1

            # Adaptive Feedback Learning Loop: Trigger on manual override to PRESENT
            if rec.override and rec.status == 'PRESENT':
                # Filter quality face crops (size >= 50x50 and det_score >= 0.70)
                eligible_crops = [
                    d for d in cached_detections
                    if d["width"] >= 50 and d["height"] >= 50 and d["det_score"] >= 0.70
                ]

                if eligible_crops:
                    # Pick highest scoring face crop
                    best_crop = max(eligible_crops, key=lambda d: d["det_score"])
                    crop_embedding = best_crop["embedding"]

                    existing_prototypes = get_student_prototypes(rec.student_id)
                    if len(existing_prototypes) < 5:
                        # Insert new prototype vector
                        add_student_prototype(rec.student_id, crop_embedding, conn=conn)
                        learned_prototypes += 1
                    elif len(existing_prototypes) == 5:
                        # Update closest vector using running average: E_new = normalize(0.8 * E_closest + 0.2 * E_crop)
                        sims = [
                            (float(np.dot(p["embedding"], crop_embedding)), p)
                            for p in existing_prototypes
                        ]
                        sims.sort(key=lambda x: x[0], reverse=True)
                        closest_proto = sims[0][1]

                        e_closest = closest_proto["embedding"]
                        e_new = 0.8 * e_closest + 0.2 * crop_embedding
                        norm = np.linalg.norm(e_new)
                        if norm > 0:
                            e_new = e_new / norm
                        
                        update_student_prototype(closest_proto["embedding_id"], e_new.astype(np.float32), conn=conn)
                        learned_prototypes += 1
            
        conn.commit()

    return {
        "status": "success",
        "session_id": session_id,
        "committed_records": committed_records,
        "learned_prototypes": learned_prototypes,
        "timestamp": f"{uuid.uuid1()}"
    }
