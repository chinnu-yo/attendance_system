import sqlite3
import os
import uuid
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
