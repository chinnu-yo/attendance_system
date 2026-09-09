# API Contracts & Data Specifications

All endpoints communicate via JSON, except file uploads which use `multipart/form-data`.

---

### 1. Student Enrollment
`POST /api/students/enroll`
- Content-Type: `multipart/form-data`

**Request Parameters:**
- `roll_number`: string (e.g., `"CS2026_042"`)
- `name`: string (e.g., `"John Doe"`)
- `course_id`: string (e.g., `"CS101"`)
- `photos`: List[File] (1 to 3 images)

**Response (201 Created):**
```json
{
  "status": "success",
  "student_id": "uuid-v4-string",
  "roll_number": "CS2026_042",
  "name": "John Doe",
  "embeddings_registered": 2
}
2. Process Classroom Attendance
POST /api/attendance/process

Content-Type: multipart/form-data

Request Parameters:

course_id: string (e.g., "CS101")

images: List[File] (1 to N classroom photos)

Response (200 OK):

JSON
{
  "session_summary": {
    "total_enrolled": 45,
    "total_detected_faces": 42,
    "present_count": 38,
    "review_needed_count": 2,
    "absent_count": 5
  },
  "processed_images": [
    {
      "image_id": "img_001",
      "image_filename": "row_1_2.jpg",
      "faces": [
        {
          "bbox": [120, 85, 230, 210],
          "matched_student_id": "uuid-1",
          "roll_number": "CS2026_001",
          "name": "Alice Smith",
          "confidence": 0.78,
          "status": "PRESENT"
        },
        {
          "bbox": [450, 92, 540, 205],
          "matched_student_id": null,
          "roll_number": null,
          "name": "Unknown",
          "confidence": 0.32,
          "status": "UNRECOGNIZED"
        }
      ]
    }
  ],
  "roster": [
    {
      "student_id": "uuid-1",
      "roll_number": "CS2026_001",
      "name": "Alice Smith",
      "status": "PRESENT",
      "confidence": 0.78,
      "detected_in_image": "img_001"
    },
    {
      "student_id": "uuid-2",
      "roll_number": "CS2026_002",
      "name": "Bob Jones",
      "status": "ABSENT",
      "confidence": 0.0,
      "detected_in_image": null
    }
  ]
}
3. Commit Attendance Record
POST /api/attendance/commit

Content-Type: application/json

Request Body:

JSON
{
  "course_id": "CS101",
  "records": [
    {
      "student_id": "uuid-1",
      "status": "PRESENT",
      "override": false
    },
    {
      "student_id": "uuid-2",
      "status": "PRESENT",
      "override": true,
      "override_reason": "Manual confirmation from back row"
    }
  ]
}
Response (200 OK):

JSON
{
  "status": "success",
  "session_id": "session-uuid-v4",
  "committed_records": 45,
  "timestamp": "2026-09-08T14:30:00Z"
}