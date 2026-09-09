import numpy as np
from typing import List, Dict, Any, Optional

PRESENT_THRESHOLD = 0.58
REVIEW_THRESHOLD = 0.45


def compute_multi_prototype_similarity_matrix(
    detected_embeddings: List[np.ndarray],
    enrolled_students: List[Dict[str, Any]]
) -> np.ndarray:
    """
    Computes an M x N similarity matrix between M detected face embeddings
    and N enrolled students, where each student has a list of prototype vectors (1 to 5).
    Score for (det i, student j) is the MAXIMUM cosine similarity across student j's prototype vectors.
    """
    num_detections = len(detected_embeddings)
    num_students = len(enrolled_students)

    if num_detections == 0 or num_students == 0:
        return np.zeros((num_detections, num_students), dtype=np.float32)

    sim_matrix = np.zeros((num_detections, num_students), dtype=np.float32)

    for d_idx, d_emb in enumerate(detected_embeddings):
        for s_idx, student in enumerate(enrolled_students):
            # Student can have single vector or list of prototype vectors
            prototypes = student.get("embeddings")
            if not prototypes:
                if "embedding" in student:
                    prototypes = [student["embedding"]]
                else:
                    prototypes = []

            if prototypes:
                # Compute dot products against all prototype vectors of student s_idx
                proto_matrix = np.stack(prototypes, axis=0) # (K, 512)
                sims = np.dot(proto_matrix, d_emb) # (K,)
                max_sim = float(np.max(sims))
                sim_matrix[d_idx, s_idx] = np.clip(max_sim, -1.0, 1.0)
            else:
                sim_matrix[d_idx, s_idx] = 0.0

    return sim_matrix


def process_attendance_matching(
    images_data: List[Dict[str, Any]],
    enrolled_students: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Processes face detections across multiple images against enrolled course roster.
    Supports multi-prototype galleries per student and winner-takes-all deduplication.
    
    images_data: List of Dicts with:
        "image_id": str,
        "image_filename": str,
        "faces": List[Dict] with "bbox", "embedding", "det_score"

    enrolled_students: List of Dicts with:
        "student_id": str,
        "roll_number": str,
        "name": str,
        "embeddings": List[np.ndarray] (up to 5 vectors)
    """
    total_enrolled = len(enrolled_students)

    # Flatten all detections to index them
    all_detections = []
    total_detected_faces = 0

    for img_idx, img_info in enumerate(images_data):
        faces = img_info["faces"]
        total_detected_faces += len(faces)
        for face_idx, face in enumerate(faces):
            all_detections.append({
                "global_idx": len(all_detections),
                "image_idx": img_idx,
                "face_idx": face_idx,
                "image_id": img_info["image_id"],
                "bbox": face["bbox"],
                "embedding": face["embedding"],
                "det_score": face["det_score"]
            })

    if total_enrolled == 0:
        # No enrolled students in course
        processed_images = []
        for img_info in images_data:
            processed_images.append({
                "image_id": img_info["image_id"],
                "image_filename": img_info["image_filename"],
                "faces": [
                    {
                        "bbox": f["bbox"],
                        "matched_student_id": None,
                        "roll_number": None,
                        "name": "Unknown",
                        "confidence": float(round(f["det_score"], 2)),
                        "status": "UNRECOGNIZED"
                    }
                    for f in img_info["faces"]
                ]
            })
        return {
            "session_summary": {
                "total_enrolled": 0,
                "total_detected_faces": total_detected_faces,
                "present_count": 0,
                "review_needed_count": 0,
                "absent_count": 0
            },
            "processed_images": processed_images,
            "roster": []
        }

    # Compute similarity matrix using Multi-Prototype Gallery matching
    if all_detections:
        detected_embeddings = [d["embedding"] for d in all_detections]
        sim_matrix = compute_multi_prototype_similarity_matrix(detected_embeddings, enrolled_students)
    else:
        sim_matrix = np.zeros((0, total_enrolled), dtype=np.float32)

    # Collect match candidates (score, det_idx, roster_idx)
    candidates = []
    num_detections = len(all_detections)
    for d_idx in range(num_detections):
        for r_idx in range(total_enrolled):
            score = float(sim_matrix[d_idx, r_idx])
            if score >= REVIEW_THRESHOLD:
                candidates.append((score, d_idx, r_idx))

    # Sort candidates descending by score (Winner-Takes-All)
    candidates.sort(key=lambda x: x[0], reverse=True)

    assigned_detections: Dict[int, Dict[str, Any]] = {}
    assigned_students: Dict[int, Dict[str, Any]] = {}

    for score, d_idx, r_idx in candidates:
        if d_idx in assigned_detections or r_idx in assigned_students:
            continue

        status = "PRESENT" if score >= PRESENT_THRESHOLD else "REVIEW_NEEDED"
        student = enrolled_students[r_idx]
        det = all_detections[d_idx]

        match_info = {
            "student_id": student["student_id"],
            "roll_number": student["roll_number"],
            "name": student["name"],
            "confidence": round(score, 2),
            "status": status,
            "image_id": det["image_id"]
        }

        assigned_detections[d_idx] = match_info
        assigned_students[r_idx] = match_info

    # Build processed_images response structure
    processed_images = []
    for img_idx, img_info in enumerate(images_data):
        img_faces = []
        for face_idx, face in enumerate(img_info["faces"]):
            # Find global detection index
            g_idx = next(
                d["global_idx"] for d in all_detections
                if d["image_idx"] == img_idx and d["face_idx"] == face_idx
            )
            if g_idx in assigned_detections:
                match = assigned_detections[g_idx]
                img_faces.append({
                    "bbox": face["bbox"],
                    "matched_student_id": match["student_id"],
                    "roll_number": match["roll_number"],
                    "name": match["name"],
                    "confidence": match["confidence"],
                    "status": match["status"]
                })
            else:
                max_score = float(sim_matrix[g_idx].max()) if sim_matrix.size > 0 else 0.0
                img_faces.append({
                    "bbox": face["bbox"],
                    "matched_student_id": None,
                    "roll_number": None,
                    "name": "Unknown",
                    "confidence": round(max_score, 2),
                    "status": "UNRECOGNIZED"
                })

        processed_images.append({
            "image_id": img_info["image_id"],
            "image_filename": img_info["image_filename"],
            "faces": img_faces
        })

    # Build roster response structure
    roster_results = []
    present_count = 0
    review_needed_count = 0
    absent_count = 0

    for r_idx, student in enumerate(enrolled_students):
        if r_idx in assigned_students:
            match = assigned_students[r_idx]
            roster_results.append({
                "student_id": student["student_id"],
                "roll_number": student["roll_number"],
                "name": student["name"],
                "status": match["status"],
                "confidence": match["confidence"],
                "detected_in_image": match["image_id"]
            })
            if match["status"] == "PRESENT":
                present_count += 1
            else:
                review_needed_count += 1
        else:
            roster_results.append({
                "student_id": student["student_id"],
                "roll_number": student["roll_number"],
                "name": student["name"],
                "status": "ABSENT",
                "confidence": 0.0,
                "detected_in_image": None
            })
            absent_count += 1

    return {
        "session_summary": {
            "total_enrolled": total_enrolled,
            "total_detected_faces": total_detected_faces,
            "present_count": present_count,
            "review_needed_count": review_needed_count,
            "absent_count": absent_count
        },
        "processed_images": processed_images,
        "roster": roster_results
    }
