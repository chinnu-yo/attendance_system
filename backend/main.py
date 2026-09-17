import uuid
import numpy as np
from typing import List, Optional
from fastapi import FastAPI, Form, File, UploadFile, HTTPException, status, Query, Response
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
        update_student_prototype,
        get_all_students_summary,
        get_student_detail,
        update_student,
        delete_student,
        update_session_record,
        get_analytics_overview,
        generate_csv_report
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
        update_student_prototype,
        get_all_students_summary,
        get_student_detail,
        update_student,
        delete_student,
        update_session_record,
        get_analytics_overview,
        generate_csv_report
    )
    from vision_service import VisionEngine
    from matcher import process_attendance_matching

app = FastAPI(
    title="VisionAttendance SaaS API",
    description="Production-ready automated classroom attendance management platform.",
    version="2.0.0"
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


# ==============================================================================
# Student Enrollment & Attendance Pipeline
# ==============================================================================

@app.post("/api/students/enroll", status_code=status.HTTP_201_CREATED)
async def enroll_student(
    roll_number: str = Form(...),
    name: str = Form(...),
    course_id: str = Form(...),
    photos: List[UploadFile] = File(...)
):
    """
    Enrolls a student into a course with 1 to 3 headshot images.
    Extracts, averages, and L2-normalizes 512-D vectors, then persists into SQLite.
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
    Processes multi-photo classroom attendance against enrolled course roster.
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

        for face_idx, face in enumerate(detected_faces):
            crop_id = f"{image_id}_crop_{face_idx}"
            face["crop_id"] = crop_id
            bbox = face["bbox"]
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            flattened_cached_faces.append({
                "crop_id": crop_id,
                "image_id": image_id,
                "bbox": bbox,
                "width": w,
                "height": h,
                "det_score": face["det_score"],
                "embedding": face["embedding"]
            })

        images_data.append({
            "image_id": image_id,
            "image_filename": img_file.filename or f"photo_{idx + 1}.jpg",
            "faces": detected_faces
        })

    # Cache detections in session memory
    session_token = f"stok_{uuid.uuid4().hex[:12]}"
    vision_engine.store_session_cache(session_token, flattened_cached_faces)

    # 3. Vectorized matching & deduplication using multi-prototype galleries
    results = process_attendance_matching(images_data, enrolled_students)
    results["session_token"] = session_token
    return results


class CropAssignment(BaseModel):
    student_id: str
    crop_id: str


class CommitRecordItem(BaseModel):
    student_id: str
    status: str
    override: bool = False
    override_reason: Optional[str] = None


class CommitAttendanceRequest(BaseModel):
    course_id: str
    records: List[CommitRecordItem]
    assignments: Optional[List[CropAssignment]] = []
    session_token: Optional[str] = None


@app.post("/api/attendance/commit", status_code=status.HTTP_200_OK)
async def commit_attendance(payload: CommitAttendanceRequest):
    """
    Persists finalized attendance records into SQLite and executes the Adaptive Feedback Learning Loop.
    """
    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    vision_engine = VisionEngine.get_instance()
    cached_detections = vision_engine.get_session_cache(payload.session_token) if payload.session_token else []

    # Map student_id -> crop_id from explicit UI assignments
    assignment_map: Dict[str, str] = {}
    if payload.assignments:
        for assg in payload.assignments:
            assignment_map[assg.student_id] = assg.crop_id

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

            # Adaptive Feedback Learning Loop: Trigger when status is PRESENT via override/assignment
            if rec.override and rec.status == 'PRESENT':
                crop_embedding = None

                # Priority 1: Explicit crop assignment for this student_id
                if rec.student_id in assignment_map:
                    target_crop_id = assignment_map[rec.student_id]
                    matching_crops = [d for d in cached_detections if d.get("crop_id") == target_crop_id]
                    if matching_crops:
                        crop_embedding = matching_crops[0]["embedding"]

                # Priority 2: Fallback similarity matching against student's existing prototypes
                if crop_embedding is None:
                    existing_prototypes = get_student_prototypes(rec.student_id)
                    eligible_crops = [
                        d for d in cached_detections
                        if d.get("width", 0) >= 32 and d.get("height", 0) >= 32 and d.get("det_score", 1.0) >= 0.50
                    ]
                    if eligible_crops and existing_prototypes:
                        proto_matrix = np.stack([p["embedding"] for p in existing_prototypes], axis=0) # (K, 512)
                        best_sim = -1.0
                        best_candidate = None
                        for d in eligible_crops:
                            sims = np.dot(proto_matrix, d["embedding"])
                            max_sim = float(np.max(sims))
                            if max_sim > best_sim:
                                best_sim = max_sim
                                best_candidate = d
                        if best_candidate:
                            crop_embedding = best_candidate["embedding"]

                # Perform vector prototype insertion or running average update
                if crop_embedding is not None:
                    existing_prototypes = get_student_prototypes(rec.student_id)
                    if len(existing_prototypes) < 5:
                        add_student_prototype(rec.student_id, crop_embedding, conn=conn)
                        learned_prototypes += 1
                        print(f"[ADAPTIVE] Stored verified prototype for {rec.student_id}")
                    elif len(existing_prototypes) == 5:
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
                        print(f"[ADAPTIVE] Stored verified prototype for {rec.student_id}")
            
        conn.commit()

    return {
        "status": "success",
        "session_id": session_id,
        "committed_records": committed_records,
        "learned_prototypes": learned_prototypes,
        "timestamp": f"{uuid.uuid1()}"
    }


# ==============================================================================
# Production SaaS Extensions: Student Management & History
# ==============================================================================

@app.get("/api/students", status_code=status.HTTP_200_OK)
def get_students(course_id: Optional[str] = Query(None)):
    """Fetch all students with attendance %, present counts, and prototype counts."""
    students = get_all_students_summary(course_id=course_id)
    return {"students": students}


@app.get("/api/students/{student_id}", status_code=status.HTTP_200_OK)
def get_student(student_id: str):
    """Retrieve detailed student info, registered prototypes, and attendance history."""
    student_detail = get_student_detail(student_id)
    if not student_detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")
    return student_detail


class UpdateStudentRequest(BaseModel):
    name: str
    roll_number: str


@app.put("/api/students/{student_id}", status_code=status.HTTP_200_OK)
def update_student_endpoint(student_id: str, payload: UpdateStudentRequest):
    """Update student name or roll number."""
    success = update_student(student_id, payload.name.trim() if hasattr(payload.name, 'trim') else payload.name.strip(), payload.roll_number.strip())
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")
    return {"status": "success", "message": "Student updated successfully."}


@app.delete("/api/students/{student_id}", status_code=status.HTTP_200_OK)
def delete_student_endpoint(student_id: str):
    """Delete student and cascading records."""
    success = delete_student(student_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")
    return {"status": "success", "message": "Student deleted successfully."}


@app.post("/api/students/{student_id}/prototype", status_code=status.HTTP_201_CREATED)
async def add_student_prototype_endpoint(student_id: str, photo: UploadFile = File(...)):
    """Uploads an extra headshot image to add to student's vector prototypes."""
    content = await photo.read()
    vision_engine = VisionEngine.get_instance()
    try:
        embedding = vision_engine.extract_average_embedding([content])
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Face extraction failed: {str(e)}")

    existing_prototypes = get_student_prototypes(student_id)
    if len(existing_prototypes) >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student already has the maximum 5 prototype embeddings registered."
        )

    emb_id = add_student_prototype(student_id, embedding)
    return {
        "status": "success",
        "embedding_id": emb_id,
        "message": "Extra prototype headshot added successfully."
    }


class UpdateRecordRequest(BaseModel):
    status: str
    override_reason: Optional[str] = "Manual teacher override"


@app.put("/api/attendance/records/{record_id}", status_code=status.HTTP_200_OK)
def update_attendance_record_endpoint(record_id: str, payload: UpdateRecordRequest):
    """Modifies historical session log status & override flag."""
    success = update_session_record(record_id, payload.status, payload.override_reason)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found.")
    return {"status": "success", "message": "Attendance record updated successfully."}


# ==============================================================================
# Analytics & CSV Export
# ==============================================================================

@app.get("/api/analytics/overview", status_code=status.HTTP_200_OK)
def get_analytics_overview_endpoint(course_id: Optional[str] = Query(None)):
    """Computes total sessions, average class attendance rate, defaulters list, and daily stats."""
    return get_analytics_overview(course_id=course_id)


@app.get("/api/analytics/export")
def export_csv_report(course_id: Optional[str] = Query(None)):
    """Generates downloadable CSV spreadsheet report of all student attendance records."""
    csv_content = generate_csv_report(course_id=course_id)
    filename = f"attendance_report_{course_id or 'all'}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
