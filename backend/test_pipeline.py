import os
import sys

# Ensure clean test database for reproducible smoke test
TEST_DB = os.path.abspath("test_attendance.db")
if os.path.exists(TEST_DB):
    try:
        os.remove(TEST_DB)
    except Exception:
        pass

os.environ["DATABASE_PATH"] = TEST_DB
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.main import app
from backend.database import init_db

import io
import cv2
import numpy as np
from fastapi.testclient import TestClient

client = TestClient(app)


def create_sample_face_image() -> bytes:
    """Retrieves InsightFace sample face image ('t1') and returns encoded JPEG bytes."""
    import insightface
    img = insightface.data.get_image('t1')
    _, encoded = cv2.imencode('.jpg', img)
    return encoded.tobytes()


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_full_attendance_pipeline():
    # 1. Initialize Database
    init_db()

    sample_img_bytes = create_sample_face_image()

    # 2. Enroll Student
    enroll_response = client.post(
        "/api/students/enroll",
        data={
            "roll_number": "CS2026_001",
            "name": "Alice Smith",
            "course_id": "CS101"
        },
        files=[
            ("photos", ("alice_headshot.jpg", sample_img_bytes, "image/jpeg"))
        ]
    )
    
    assert enroll_response.status_code == 201, enroll_response.text
    enroll_data = enroll_response.json()
    assert enroll_data["status"] == "success"
    assert enroll_data["roll_number"] == "CS2026_001"
    student_id = enroll_data["student_id"]

    # 3. Process Attendance
    process_response = client.post(
        "/api/attendance/process",
        data={
            "course_id": "CS101"
        },
        files=[
            ("images", ("classroom_row_1.jpg", sample_img_bytes, "image/jpeg"))
        ]
    )

    assert process_response.status_code == 200, process_response.text
    data = process_response.json()

    assert "session_token" in data
    session_token = data["session_token"]

    summary = data["session_summary"]
    assert summary["total_enrolled"] == 1
    assert len(data["processed_images"]) == 1
    assert len(data["roster"]) == 1
    assert data["roster"][0]["student_id"] == student_id

    # Check multi-prototype database retrieval
    from backend.database import get_student_prototypes
    prototypes_before = get_student_prototypes(student_id)
    assert len(prototypes_before) >= 1

    # 4. Commit Attendance with Manual Override to trigger Adaptive Feedback Learning Loop
    commit_response = client.post(
        "/api/attendance/commit",
        json={
            "course_id": "CS101",
            "session_token": session_token,
            "records": [
                {
                    "student_id": student_id,
                    "status": "PRESENT",
                    "override": True,
                    "override_reason": "Manual confirmation from back row"
                }
            ]
        }
    )

    assert commit_response.status_code == 200, commit_response.text
    commit_data = commit_response.json()
    assert commit_data["status"] == "success"
    assert commit_data["committed_records"] == 1
    assert commit_data["learned_prototypes"] >= 1

    prototypes_after = get_student_prototypes(student_id)
    assert len(prototypes_after) >= 2

    print("\n[SUCCESS] End-to-End Pipeline & Adaptive Feedback Learning Test Passed Successfully!")


if __name__ == "__main__":
    test_health_check()
    test_full_attendance_pipeline()
