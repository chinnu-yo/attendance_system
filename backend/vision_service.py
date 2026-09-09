import cv2
import numpy as np
import insightface
from insightface.app import FaceAnalysis
from typing import List, Dict, Optional, Tuple

class VisionEngine:
    _instance: Optional['VisionEngine'] = None
    _session_cache: Dict[str, List[Dict]] = {}

    def __init__(self) -> None:
        """Initializes InsightFace buffalo_l pipeline with CPUExecutionProvider."""
        self.app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
        self.app.prepare(ctx_id=0, det_size=(640, 640), det_thresh=0.60)

    @classmethod
    def get_instance(cls) -> 'VisionEngine':
        """Singleton pattern for VisionEngine to avoid re-loading ONNX models."""
        if cls._instance is None:
            cls._instance = VisionEngine()
        return cls._instance

    def store_session_cache(self, session_token: str, detections: List[Dict]) -> None:
        """Caches session face detections for adaptive learning on manual commit."""
        self._session_cache[session_token] = detections

    def get_session_cache(self, session_token: str) -> List[Dict]:
        """Retrieves cached session face detections."""
        return self._session_cache.get(session_token, [])

    def process_image_bytes(self, image_bytes: bytes) -> Tuple[np.ndarray, List[Dict]]:
        """
        Decodes image bytes and extracts all detected faces with 512-D L2-normalized embeddings.
        Returns:
            Tuple of (opencv_bgr_image, List[Dict])
            where each dict contains 'bbox' [x1, y1, x2, y2], 'embedding' (512-D normalized), and 'det_score'.
        """
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image bytes with OpenCV")

        faces = self.app.get(img)
        detected_faces = []
        for face in faces:
            bbox = [int(x) for x in face.bbox]
            emb = face.embedding
            norm = np.linalg.norm(emb)
            if norm > 0:
                norm_emb = (emb / norm).astype(np.float32)
            else:
                norm_emb = emb.astype(np.float32)

            detected_faces.append({
                "bbox": bbox,
                "embedding": norm_emb,
                "det_score": float(face.det_score) if hasattr(face, 'det_score') else 1.0
            })

        return img, detected_faces

    def extract_average_embedding(self, photos_bytes: List[bytes]) -> np.ndarray:
        """
        Extracts 512-D embedding from 1 to N headshots, selects the primary face per photo,
        averages them, and returns an L2-normalized 512-D vector.
        """
        embeddings = []
        for photo_bytes in photos_bytes:
            _, detected = self.process_image_bytes(photo_bytes)
            if detected:
                # Select face with highest detection score
                primary_face = max(detected, key=lambda f: f["det_score"])
                embeddings.append(primary_face["embedding"])

        if not embeddings:
            raise ValueError("No valid faces detected in the provided headshot photos.")

        avg_emb = np.mean(embeddings, axis=0)
        norm = np.linalg.norm(avg_emb)
        if norm > 0:
            avg_emb = avg_emb / norm
        return avg_emb.astype(np.float32)
