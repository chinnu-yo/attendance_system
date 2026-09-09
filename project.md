# Project Vision & Scope: VisionAttendance

## 1. Executive Summary
VisionAttendance is an automated classroom attendance system designed for dense academic environments. Instead of relying on manual roll calls, RFID cards, or single-point biometric scanners, an instructor uploads 1 to N high-resolution photos of the classroom (e.g., captured row by row). 

The platform leverages computer vision models running locally on CPU to detect all faces, generate high-dimensional identity embeddings, match them against a registered course roster, deduplicate cross-photo detections, and present a real-time audit/review dashboard for manual sign-off.

## 2. Core Objectives
- Zero-Cost Development: Run entirely on consumer-grade CPU hardware with zero external API fees or paid cloud services.
- Deterministic Identity Resolution: Eliminate identity collisions by scoping face matching strictly to enrolled students in the target class session.
- Multi-Photo Synthesis: Aggregate and deduplicate face detections across multiple images per session to eliminate row occlusion and low-resolution issues.
- Human-in-the-Loop Auditability: Never make automated biometric recognition 100% final without instructor visibility, offering one-click manual overrides over annotated detection bounding boxes.
- Future-Proof Extensibility: Modular architecture allowing direct transition from HTTP multi-file uploads to automated CCTV/RTSP camera frame ingestion without altering core vector pipelines.

## 3. Scope Boundaries
- In Scope:
  - Student enrollment with single/multiple headshot vector extraction.
  - Classroom/Course roster management.
  - Multi-image upload and parallel/sequential inference pipeline.
  - Cosine similarity matching using NumPy-optimized vectorized routines.
  - Review dashboard with HTML5 Canvas bounding-box overlays.
  - Exportable attendance session logs.
- Out of Scope for Initial Version:
  - Role-Based Access Control (RBAC) / Multi-tenant authentication.
  - Direct live RTSP video streaming (interfaces will be scaffolded, but file uploads remain primary).
  - Production cloud infrastructure setup (Docker/Kubernetes/AWS).