# Design System & UI/UX Specifications

## 1. Visual Language
- Aesthetics: Clean, high-contrast, minimalist engineering dashboard.
- Theme: Dark slate backdrop with emerald (present), amber (flagged/review), and rose (absent/unrecognized) accents.
- Typography: Inter or standard system sans-serif stack for maximum legibility in dense tabular datasets.

## 2. Page & Component Layouts

### A. Navigation & Shell
- Top header: Active course selector, current date/session badge, and system status indicator (e.g., "ONNX Engine: Ready (CPU)").

### B. Upload & Ingestion Pane (`/session/new`)
- Multi-File Drag-and-Drop Area:
  - Accepts `.jpg`, `.jpeg`, `.png`.
  - Displays thumbnail strip of all staged classroom shots with individual remove actions.
  - Clear guidance note: "Upload 2-4 row-wise photos covering Front, Middle, and Back benches."
  - Primary CTA: "Run Attendance Pipeline" with real-time processing spinners and progress steps.

### C. Review & Audit Dashboard (`/session/[id]`)
- Split-Pane / Tabbed View:
  - Canvas Inspection Tab:
    - High-resolution viewer of uploaded photos with toggles to switch between images.
    - HTML5 Canvas overlay drawing bounding boxes:
      - Green Box: Matched with high confidence ($\ge 0.62$). Shows Name + Confidence.
      - Yellow Box: Review needed ($0.48 \le \text{Score} < 0.62$). Clicking highlights student in table.
      - Red Box: Unrecognized face ($< 0.48$).
  - Tabular Roster Tab:
    - Metrics row: Total Enrolled | Present | Absent | Flagged.
    - Searchable table: Roll Number, Student Name, Status badge (Present / Absent / Review Needed), Confidence Score, Action Toggle (Switch between Present / Absent with one click).
  - Final Action Bar:
    - "Save & Finalize Attendance" committing all statuses to the database.