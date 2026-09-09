import sqlite3
import os
import uuid
import csv
import io
import numpy as np
from typing import List, Dict, Optional, Tuple, Any

DB_PATH = os.getenv("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "attendance.db"))


def get_db_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    """Returns a SQLite connection with row factory enabled."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def embedding_to_blob(embedding: np.ndarray) -> bytes:
    """Converts a 512-D float32 numpy vector into bytes for SQLite BLOB storage."""
    return embedding.astype(np.float32).tobytes()


def blob_to_embedding(blob: bytes) -> np.ndarray:
    """Converts SQLite BLOB bytes back into a 512-D float32 numpy vector."""
    return np.frombuffer(blob, dtype=np.float32)


def init_db(db_path: str = DB_PATH) -> None:
    """Initializes SQLite database tables and multi-prototype gallery migrations."""
    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        
        # Students table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS students (
                student_id TEXT PRIMARY KEY,
                roll_number TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                embedding BLOB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Multi-Prototype Gallery table (up to 5 vectors per student)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS student_embeddings (
                embedding_id TEXT PRIMARY KEY,
                student_id TEXT NOT NULL,
                embedding BLOB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE CASCADE
            );
        """)
        
        # Courses table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS courses (
                course_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                code TEXT NOT NULL
            );
        """)
        
        # Enrollments table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS enrollments (
                enrollment_id TEXT PRIMARY KEY,
                student_id TEXT NOT NULL,
                course_id TEXT NOT NULL,
                FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES courses (course_id) ON DELETE CASCADE,
                UNIQUE(student_id, course_id)
            );
        """)
        
        # Sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                course_id TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (course_id) REFERENCES courses (course_id) ON DELETE CASCADE
            );
        """)
        
        # Session Records table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS session_records (
                record_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                student_id TEXT NOT NULL,
                status TEXT NOT NULL,
                confidence REAL NOT NULL,
                override INTEGER DEFAULT 0,
                override_reason TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions (session_id) ON DELETE CASCADE,
                FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE CASCADE
            );
        """)

        # Auto-migration: Migrate existing student.embedding into student_embeddings if present
        cursor.execute("SELECT student_id, embedding FROM students WHERE embedding IS NOT NULL")
        legacy_students = cursor.fetchall()
        for row in legacy_students:
            s_id = row["student_id"]
            emb_blob = row["embedding"]
            # Check if student already has prototypes
            cursor.execute("SELECT COUNT(*) as count FROM student_embeddings WHERE student_id = ?", (s_id,))
            if cursor.fetchone()["count"] == 0:
                emb_id = f"emb_{s_id}_initial"
                cursor.execute(
                    "INSERT INTO student_embeddings (embedding_id, student_id, embedding) VALUES (?, ?, ?)",
                    (emb_id, s_id, emb_blob)
                )

        conn.commit()


def save_student_with_enrollment(
    student_id: str,
    roll_number: str,
    name: str,
    embedding: np.ndarray,
    course_id: str,
    db_path: str = DB_PATH
) -> None:
    """Saves student, registers initial prototype vector, and enrolls into course_id."""
    embedding_blob = embedding_to_blob(embedding)
    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        
        # Ensure course exists
        cursor.execute(
            "INSERT OR IGNORE INTO courses (course_id, name, code) VALUES (?, ?, ?)",
            (course_id, f"Course {course_id}", course_id)
        )
        
        # Upsert student
        cursor.execute(
            """
            INSERT INTO students (student_id, roll_number, name, embedding)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(roll_number) DO UPDATE SET
                name=excluded.name,
                embedding=excluded.embedding
            """,
            (student_id, roll_number, name, embedding_blob)
        )
        
        # Fetch actual student_id if roll_number already existed
        cursor.execute("SELECT student_id FROM students WHERE roll_number = ?", (roll_number,))
        actual_student_id = cursor.fetchone()["student_id"]

        # Register prototype embedding
        emb_id = f"emb_{actual_student_id}_{uuid.uuid4().hex[:8]}"
        cursor.execute(
            "INSERT INTO student_embeddings (embedding_id, student_id, embedding) VALUES (?, ?, ?)",
            (emb_id, actual_student_id, embedding_blob)
        )
        
        # Create enrollment
        enrollment_id = f"enr_{actual_student_id}_{course_id}"
        cursor.execute(
            """
            INSERT OR IGNORE INTO enrollments (enrollment_id, student_id, course_id)
            VALUES (?, ?, ?)
            """,
            (enrollment_id, actual_student_id, course_id)
        )
        conn.commit()


def get_enrolled_students(course_id: str, db_path: str = DB_PATH) -> List[Dict]:
    """Retrieves all students enrolled in a course with all active multi-prototype embeddings."""
    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT s.student_id, s.roll_number, s.name, s.embedding
            FROM students s
            JOIN enrollments e ON s.student_id = e.student_id
            WHERE e.course_id = ?
            """,
            (course_id,)
        )
        student_rows = cursor.fetchall()
        
        students = []
        for s_row in student_rows:
            s_id = s_row["student_id"]
            cursor.execute(
                "SELECT embedding_id, embedding FROM student_embeddings WHERE student_id = ? ORDER BY created_at ASC",
                (s_id,)
            )
            emb_rows = cursor.fetchall()
            
            embeddings_list = []
            prototype_records = []
            for e_row in emb_rows:
                vec = blob_to_embedding(e_row["embedding"])
                embeddings_list.append(vec)
                prototype_records.append({
                    "embedding_id": e_row["embedding_id"],
                    "embedding": vec
                })

            # Fallback if student_embeddings table is empty for this student
            if not embeddings_list and s_row["embedding"] is not None:
                vec = blob_to_embedding(s_row["embedding"])
                embeddings_list.append(vec)
                prototype_records.append({
                    "embedding_id": f"emb_{s_id}_legacy",
                    "embedding": vec
                })

            students.append({
                "student_id": s_id,
                "roll_number": s_row["roll_number"],
                "name": s_row["name"],
                "embeddings": embeddings_list,
                "prototypes": prototype_records
            })
        return students


def get_student_prototypes(student_id: str, db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    """Retrieves all prototype embeddings for a student."""
    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT embedding_id, embedding FROM student_embeddings WHERE student_id = ? ORDER BY created_at ASC",
            (student_id,)
        )
        rows = cursor.fetchall()
        return [
            {
                "embedding_id": row["embedding_id"],
                "embedding": blob_to_embedding(row["embedding"])
            }
            for row in rows
        ]


def add_student_prototype(student_id: str, embedding: np.ndarray, conn: Optional[sqlite3.Connection] = None, db_path: str = DB_PATH) -> str:
    """Adds a new prototype embedding for a student."""
    emb_id = f"emb_{student_id}_{uuid.uuid4().hex[:8]}"
    blob = embedding_to_blob(embedding)
    if conn is not None:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO student_embeddings (embedding_id, student_id, embedding) VALUES (?, ?, ?)",
            (emb_id, student_id, blob)
        )
    else:
        with get_db_connection(db_path) as new_conn:
            cursor = new_conn.cursor()
            cursor.execute(
                "INSERT INTO student_embeddings (embedding_id, student_id, embedding) VALUES (?, ?, ?)",
                (emb_id, student_id, blob)
            )
            new_conn.commit()
    return emb_id


def update_student_prototype(embedding_id: str, new_embedding: np.ndarray, conn: Optional[sqlite3.Connection] = None, db_path: str = DB_PATH) -> None:
    """Updates an existing prototype vector row in SQLite."""
    blob = embedding_to_blob(new_embedding)
    if conn is not None:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE student_embeddings SET embedding = ? WHERE embedding_id = ?",
            (blob, embedding_id)
        )
    else:
        with get_db_connection(db_path) as new_conn:
            cursor = new_conn.cursor()
            cursor.execute(
                "UPDATE student_embeddings SET embedding = ? WHERE embedding_id = ?",
                (blob, embedding_id)
            )
            new_conn.commit()


# ==============================================================================
# Production SaaS Extensions: Student Management, History, & Analytics
# ==============================================================================

def get_all_students_summary(course_id: Optional[str] = None, db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    """Retrieves all students with total sessions, present count, attendance %, and prototype count."""
    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        
        if course_id:
            query = """
                SELECT DISTINCT s.student_id, s.roll_number, s.name, s.created_at
                FROM students s
                JOIN enrollments e ON s.student_id = e.student_id
                WHERE e.course_id = ?
                ORDER BY s.roll_number ASC
            """
            cursor.execute(query, (course_id,))
        else:
            query = """
                SELECT DISTINCT s.student_id, s.roll_number, s.name, s.created_at
                FROM students s
                ORDER BY s.roll_number ASC
            """
            cursor.execute(query)

        rows = cursor.fetchall()
        result = []

        for row in rows:
            s_id = row["student_id"]

            # Fetch enrolled course IDs
            cursor.execute("SELECT course_id FROM enrollments WHERE student_id = ?", (s_id,))
            c_rows = cursor.fetchall()
            course_ids = [c["course_id"] for c in c_rows]

            # Fetch attendance stats
            if course_id:
                cursor.execute("""
                    SELECT 
                        COUNT(sr.record_id) as total_sessions,
                        SUM(CASE WHEN sr.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count
                    FROM session_records sr
                    JOIN sessions se ON sr.session_id = se.session_id
                    WHERE sr.student_id = ? AND se.course_id = ?
                """, (s_id, course_id))
            else:
                cursor.execute("""
                    SELECT 
                        COUNT(sr.record_id) as total_sessions,
                        SUM(CASE WHEN sr.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count
                    FROM session_records sr
                    WHERE sr.student_id = ?
                """, (s_id,))

            stat_row = cursor.fetchone()
            total_sessions = stat_row["total_sessions"] or 0
            present_count = stat_row["present_count"] or 0
            pct = round((present_count / total_sessions * 100), 1) if total_sessions > 0 else 100.0

            # Fetch prototype count
            cursor.execute("SELECT COUNT(*) as proto_count FROM student_embeddings WHERE student_id = ?", (s_id,))
            proto_count = cursor.fetchone()["proto_count"] or 1

            result.append({
                "student_id": s_id,
                "roll_number": row["roll_number"],
                "name": row["name"],
                "course_ids": course_ids,
                "total_sessions": total_sessions,
                "present_count": present_count,
                "attendance_percentage": pct,
                "prototype_count": proto_count,
                "num_embeddings": proto_count,
                "created_at": row["created_at"]
            })

        return result


def get_student_detail(student_id: str, db_path: str = DB_PATH) -> Optional[Dict[str, Any]]:
    """Retrieves full student profile, registered prototypes, and chronological attendance history."""
    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT student_id, roll_number, name, created_at FROM students WHERE student_id = ?", (student_id,))
        student = cursor.fetchone()
        if not student:
            return None

        # Courses
        cursor.execute("SELECT course_id FROM enrollments WHERE student_id = ?", (student_id,))
        courses = [c["course_id"] for c in cursor.fetchall()]

        # Prototypes
        cursor.execute("SELECT embedding_id, created_at FROM student_embeddings WHERE student_id = ? ORDER BY created_at ASC", (student_id,))
        prototypes = [{"embedding_id": p["embedding_id"], "created_at": p["created_at"]} for p in cursor.fetchall()]

        # Attendance History
        cursor.execute("""
            SELECT 
                sr.record_id,
                sr.session_id,
                se.course_id,
                se.created_at as session_date,
                sr.status,
                sr.confidence,
                sr.override,
                sr.override_reason
            FROM session_records sr
            JOIN sessions se ON sr.session_id = se.session_id
            WHERE sr.student_id = ?
            ORDER BY se.created_at DESC
        """, (student_id,))
        history_rows = cursor.fetchall()

        history = [
            {
                "record_id": h["record_id"],
                "session_id": h["session_id"],
                "course_id": h["course_id"],
                "timestamp": h["session_date"],
                "session_date": h["session_date"],
                "status": h["status"],
                "confidence_score": round(h["confidence"], 2),
                "confidence": round(h["confidence"], 2),
                "is_override": bool(h["override"]),
                "override": bool(h["override"]),
                "override_reason": h["override_reason"]
            }
            for h in history_rows
        ]

        total_sessions = len(history)
        present_count = sum(1 for h in history if h["status"] == "PRESENT")
        pct = round((present_count / total_sessions * 100), 1) if total_sessions > 0 else 100.0

        return {
            "student_id": student["student_id"],
            "roll_number": student["roll_number"],
            "name": student["name"],
            "created_at": student["created_at"],
            "courses": courses,
            "prototypes": prototypes,
            "embeddings": prototypes,
            "stats": {
                "total_sessions": total_sessions,
                "present_count": present_count,
                "attendance_percentage": pct
            },
            "history": history
        }


def update_student(student_id: str, name: str, roll_number: str, db_path: str = DB_PATH) -> bool:
    """Updates student name or roll number."""
    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE students SET name = ?, roll_number = ? WHERE student_id = ?",
            (name, roll_number, student_id)
        )
        conn.commit()
        return cursor.rowcount > 0


def delete_student(student_id: str, db_path: str = DB_PATH) -> bool:
    """Deletes a student and cascades deletion to student_embeddings, enrollments, and session_records."""
    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM students WHERE student_id = ?", (student_id,))
        conn.commit()
        return cursor.rowcount > 0


def update_session_record(record_id: str, status: str, override_reason: Optional[str] = None, db_path: str = DB_PATH) -> bool:
    """Modifies historical session log status & override flag."""
    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE session_records
            SET status = ?, override = 1, override_reason = ?
            WHERE record_id = ?
            """,
            (status, override_reason or "Manual teacher update", record_id)
        )
        conn.commit()
        return cursor.rowcount > 0


def get_analytics_overview(course_id: Optional[str] = None, db_path: str = DB_PATH) -> Dict[str, Any]:
    """Computes total sessions, class average attendance %, defaulters (<75%), and 14-session daily distribution."""
    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        
        # Total sessions held
        if course_id:
            cursor.execute("SELECT COUNT(DISTINCT session_id) as count FROM sessions WHERE course_id = ?", (course_id,))
        else:
            cursor.execute("SELECT COUNT(DISTINCT session_id) as count FROM sessions")
        total_sessions = cursor.fetchone()["count"] or 0

        # Total enrolled students
        students_summary = get_all_students_summary(course_id, db_path)
        total_enrolled = len(students_summary)

        # Average class attendance rate
        if students_summary:
            avg_rate = round(sum(s["attendance_percentage"] for s in students_summary) / total_enrolled, 1)
        else:
            avg_rate = 100.0

        # Defaulters (< 75% attendance and at least 1 session held)
        defaulters = [s for s in students_summary if s["total_sessions"] > 0 and s["attendance_percentage"] < 75.0]

        # Daily distribution (last 14 sessions)
        if course_id:
            cursor.execute("""
                SELECT 
                    se.session_id,
                    se.created_at as session_date,
                    se.course_id,
                    COUNT(sr.record_id) as total_enrolled,
                    SUM(CASE WHEN sr.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count
                FROM sessions se
                LEFT JOIN session_records sr ON se.session_id = sr.session_id
                WHERE se.course_id = ?
                GROUP BY se.session_id
                ORDER BY se.created_at DESC
                LIMIT 14
            """, (course_id,))
        else:
            cursor.execute("""
                SELECT 
                    se.session_id,
                    se.created_at as session_date,
                    se.course_id,
                    COUNT(sr.record_id) as total_enrolled,
                    SUM(CASE WHEN sr.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count
                FROM sessions se
                LEFT JOIN session_records sr ON se.session_id = sr.session_id
                GROUP BY se.session_id
                ORDER BY se.created_at DESC
                LIMIT 14
            """)

        daily_rows = cursor.fetchall()
        daily_stats = []
        session_trends = []
        for d in reversed(daily_rows):
            enr = d["total_enrolled"] or 1
            prs = d["present_count"] or 0
            rate = round((prs / enr * 100), 1) if enr > 0 else 0.0
            stat_obj = {
                "session_id": d["session_id"],
                "session_date": d["session_date"],
                "date": d["session_date"],
                "course_id": d["course_id"],
                "present_count": prs,
                "total_enrolled": enr,
                "total_sessions": enr,
                "attendance_rate": rate
            }
            daily_stats.append(stat_obj)
            session_trends.append(stat_obj)

        return {
            "total_sessions": total_sessions,
            "total_students": total_enrolled,
            "total_enrolled": total_enrolled,
            "overall_attendance_rate": avg_rate,
            "average_attendance_rate": avg_rate,
            "defaulters_count": len(defaulters),
            "defaulters": defaulters,
            "session_trends": session_trends,
            "daily_stats": daily_stats
        }



def generate_csv_report(course_id: Optional[str] = None, db_path: str = DB_PATH) -> str:
    """Generates formatted CSV spreadsheet string of all student attendance records."""
    students = get_all_students_summary(course_id, db_path)
    output = io.StringIO()
    writer = csv.writer(output)

    # CSV Header
    writer.writerow([
        "Roll Number",
        "Student Name",
        "Enrolled Courses",
        "Total Sessions",
        "Present Count",
        "Attendance Rate (%)",
        "Prototype Embeddings",
        "Status Warning"
    ])

    for s in students:
        status_warning = "DEFECT/AT RISK (<75%)" if s["total_sessions"] > 0 and s["attendance_percentage"] < 75.0 else "GOOD"
        writer.writerow([
            s["roll_number"],
            s["name"],
            ", ".join(s["course_ids"]),
            s["total_sessions"],
            s["present_count"],
            f"{s['attendance_percentage']}%",
            s["prototype_count"],
            status_warning
        ])

    return output.getvalue()
