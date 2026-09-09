export interface DetectedFace {
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  matched_student_id: string | null;
  roll_number: string | null;
  name: string;
  confidence: number;
  status: 'PRESENT' | 'REVIEW_NEEDED' | 'UNRECOGNIZED';
}

export interface ProcessedImage {
  image_id: string;
  image_filename: string;
  faces: DetectedFace[];
}

export interface RosterStudent {
  student_id: string;
  roll_number: string;
  name: string;
  status: 'PRESENT' | 'REVIEW_NEEDED' | 'ABSENT';
  confidence: number;
  detected_in_image: string | null;
}

export interface SessionSummary {
  total_enrolled: number;
  total_detected_faces: number;
  present_count: number;
  review_needed_count: number;
  absent_count: number;
}

export interface ProcessAttendanceResponse {
  session_summary: SessionSummary;
  processed_images: ProcessedImage[];
  roster: RosterStudent[];
}

export interface EnrollStudentResponse {
  status: string;
  student_id: string;
  roll_number: string;
  name: string;
  embeddings_registered: number;
}

export interface CommitRecordItem {
  student_id: string;
  status: 'PRESENT' | 'ABSENT' | 'REVIEW_NEEDED';
  override: boolean;
  override_reason?: string;
}

export interface CommitAttendancePayload {
  course_id: string;
  records: CommitRecordItem[];
}

export interface CommitAttendanceResponse {
  status: string;
  session_id: string;
  committed_records: number;
  timestamp: string;
}
