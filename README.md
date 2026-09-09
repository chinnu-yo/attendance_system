# 👁️ VisionAttendance SaaS

> **Automated, Zero-Cost CPU-Optimized Classroom Attendance & Telemetry Platform powered by InsightFace ArcFace 512-D Vectors and Next.js 14.**

![Python Version](https://img.shields.io/badge/Python-3.10%20%7C%203.11-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109.0-009688?style=flat-square&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14.2.4-000000?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-3178C6?style=flat-square&logo=typescript&logoColor=white)
![ONNX Runtime](https://img.shields.io/badge/ONNX%20Runtime-CPU-005CED?style=flat-square&logo=onnx&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## 📌 1. Project Overview & Key Features

**VisionAttendance** is a production-ready, local-first Automated Attendance System designed to replace manual roll calls and expensive proprietary hardware. Powered by **InsightFace (SCRFD + ArcFace)** models executing on standard consumer CPU threads via ONNX Runtime, VisionAttendance processes multi-photo classroom row captures (Front, Middle, Back benches), performs spatial deduplication, matches 512-D vector embeddings, and maintains an adaptive learning loop.

### 🌟 Highlights

- 💻 **Zero-Cost Local CPU Architecture**: Built to execute efficiently on standard host CPUs without requiring expensive cloud GPU instances.
- 🎯 **InsightFace Deep Learning Engine**: Combines **SCRFD** ultra-fast face detection with **ArcFace (ResNet-50)** for generating discriminative 512-D face feature embeddings.
- 📸 **Multi-Photo Row Deduplication**: Handles multiple classroom captures per session (e.g., front, middle, back bench shots). Integrates spatial matrix deduplication to prevent double-counting students.
- 🔁 **Adaptive Feedback Learning Loop**: Automatically updates a student's active vector prototype gallery (up to 5 embeddings per student) whenever an instructor manually overrides a face status to `PRESENT`.
- 📊 **Zinc-950 Dark SaaS Dashboard**: Built with Next.js 14 App Router, Lucide icons, HTML5 Canvas overlay with interactive Zoom (+ / - / Reset) & Drag-to-Pan, Student Roster Directory, and Defaulter Warning Radar (< 75% attendance threshold).
- 📄 **One-Click CSV Export**: Dynamic report generator producing instant spreadsheet downloads of course attendance records.

---

## 🏗️ 2. Architecture & Technology Stack

```
                                  +-------------------------------------------------------+
                                  |              Next.js 14 Web Frontend                  |
                                  |        (TypeScript, Tailwind CSS, Lucide)             |
                                  +---------------------------+---------------------------+
                                                              |
                                                    HTTP REST / JSON APIs
                                                              |
                                  +---------------------------v---------------------------+
                                  |               FastAPI Python Server                   |
                                  |                 (backend/main.py)                     |
                                  +--------------+--------------------------+-------------+
                                                 |                          |
                                 ONNX Runtime (CPU)             SQLite Vector Database
                                                 |                          |
                                  +--------------v-------------+ +----------v-------------+
                                  |    InsightFace Engine      | |   SQLite Storage       |
                                  |  - SCRFD Face Detection    | | - 512D Embeddings    |
                                  |  - ArcFace 512D Feature Ex | | - Sessions & Overrides |
                                  +----------------------------+ +------------------------+
```

### 💻 Stack Breakdown

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 14 (App Router)** | Server & Client Components, React 18, Dynamic Routes |
| **Styling & Icons** | **Tailwind CSS + Lucide** | Custom `Zinc-950` high-contrast dark theme UI design system |
| **Canvas Engine** | **HTML5 Canvas API** | Render bounding boxes, status tags, interactive zoom & drag-to-pan |
| **Backend API** | **FastAPI + Uvicorn** | Asynchronous Python REST endpoints, CORS enabled |
| **Vision Engine** | **InsightFace (`buffalo_l`)** | SCRFD 10G detection + ArcFace `w600k_r50` recognition |
| **Inference Engine** | **ONNX Runtime (CPU)** | CPU-optimized model execution (`CPUExecutionProvider`) |
| **Data Persistence** | **SQLite 3** | Local storage for student profiles, 512-D BLOB vectors, and session logs |

---

## ⚙️ 3. System Prerequisites

Before setting up VisionAttendance, ensure your environment meets the following requirements:

- **Python Version**: **Python 3.10 or Python 3.11** *(Strict Requirement)*.
  > ⚠️ **Important**: Do **NOT** use Python 3.12+ or NumPy 2.x. `insightface` and `onnxruntime` require **NumPy < 2.0.0** (`1.26.4` recommended) to prevent C-API binary incompatibility crashes.
- **Node.js**: **Node.js LTS v20.0.0+** and `npm` v10+.
- **Git**: Installed and available in terminal path.
- **Windows C++ Build Tools** *(Windows Users Only)*:
  - If compiling `insightface` from source on Windows, install the **Desktop development with C++** workload via Visual Studio Installer (MSVC C++ v14.x build tools).

---

## 🚀 4. Step-by-Step Installation & Setup

Follow these instructions to clone, configure, and launch the application from a clean repository state.

### Step 4.1: Clone the Repository

```bash
git clone https://github.com/chinnu-yo/attendance_system.git
cd attendance_system
```

---

### Step 4.2: Backend Setup (Python FastAPI)

1. **Create Virtual Environment**:
   ```bash
   # Windows
   python -m venv backend/venv

   # Linux / macOS
   python3.11 -m venv backend/venv
   ```

2. **Activate Virtual Environment**:
   ```bash
   # Windows (PowerShell)
   .\backend\venv\Scripts\Activate.ps1

   # Windows (Command Prompt)
   .\backend\venv\Scripts\activate.bat

   # Linux / macOS
   source backend/venv/bin/activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install --upgrade pip setuptools wheel
   pip install -r backend/requirements.txt
   ```

   > 💡 **Model Download Note**: On first launch, InsightFace will automatically download the `buffalo_l` model weights (~300 MB) into `~/.insightface/models/buffalo_l/`. Ensure internet access during initial startup.

4. **Launch Backend Server**:
   ```bash
   # Windows (PowerShell)
   $env:PYTHONPATH="."
   .\backend\venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000

   # Linux / macOS
   PYTHONPATH="." uvicorn backend.main:app --reload --port 8000
   ```
   *The FastAPI server will start at `http://localhost:8000`. Verify health by opening `http://localhost:8000/api/health`.*

---

### Step 4.3: Frontend Setup (Next.js 14)

1. Open a new terminal window and navigate to the `/frontend` directory:
   ```bash
   cd frontend
   ```

2. **Install Node Dependencies**:
   ```bash
   npm install
   ```

3. **Launch Development Server**:
   ```bash
   npm run dev
   ```
   *The Next.js application will start at `http://localhost:3000`.*

---

## 📖 5. Quick Start Walkthrough

### 1️⃣ Step 1: Enroll Student Profiles
- Open `http://localhost:3000/enroll` in your browser.
- Select the Target Course (e.g., `CS101`), enter the **Roll Number** (e.g., `CS2026_001`), and **Student Full Name**.
- Upload 1 to 3 reference headshot photos taken under good lighting.
- Click **Register & Enroll Student**. The backend extracts 512-D ArcFace feature vectors and persists them to SQLite.

---

### 2️⃣ Step 2: Live Classroom Audit
- Navigate to `http://localhost:3000` (**Live Audit**).
- Select your course code (`CS101`).
- Drag and drop 1 or more classroom row photos (Front bench, Back bench captures).
- Click **Run Attendance Pipeline**.
- **Inspect Results**:
  - View detected bounding boxes in the **Canvas Inspector**.
  - Use **Zoom** (`+` / `-` / `Reset`) and **Mouse Drag Panning** to examine distant faces.
  - Inspect status tags:
    - 🟢 `PRESENT` (Green)
    - 🟡 `REVIEW_NEEDED` (Amber)
    - 🔴 `UNRECOGNIZED` (Rose)
  - Toggle student statuses manually in the Roster table if needed.
- Click **Finalize & Save Attendance** to commit records and trigger the Adaptive Learning Loop.

---

### 3️⃣ Step 3: Roster Management & Analytics
- Navigate to `http://localhost:3000/students` (**Students Directory**) to inspect total sessions, attendance percentages, registered embeddings, and open telemetry drawers.
- Navigate to `http://localhost:3000/analytics` (**Analytics & Reports**) to check class averages, review the **Defaulter Warning Radar** (< 75% attendance), and click **Export CSV Report** for spreadsheet downloads.

---

## 🎯 6. Key Decision Boundaries & Thresholds

VisionAttendance calculates Cosine Similarity scores between detected face vectors and student prototype galleries:

$$\text{Similarity Score} = \frac{\mathbf{v}_{\text{detect}} \cdot \mathbf{v}_{\text{proto}}}{\|\mathbf{v}_{\text{detect}}\| \|\mathbf{v}_{\text{proto}}\|}$$

| Match Status | Cosine Similarity Range | Visual Indicator | Action Taken |
| :--- | :---: | :---: | :--- |
| **PRESENT** | $\ge 0.58$ | 🟢 Green Box | Automatically marked Present in session log. |
| **REVIEW_NEEDED** | $0.45 \le \text{Score} < 0.58$ | 🟡 Amber Box | Flagged for manual teacher review in dashboard. |
| **UNRECOGNIZED** | $< 0.45$ | 🔴 Rose Box | Unknown face or unregistered guest student. |

---

## ⚠️ 7. Troubleshooting & FAQ

### 🐛 Issue 1: `ImportError: cannot import name 'triu' from 'scipy.linalg'` or NumPy ABI Error
- **Cause**: Installing NumPy 2.0+ breaks binary compatibility with C extensions built for NumPy 1.x (`insightface` & `onnxruntime`).
- **Solution**: Force NumPy to version `< 2.0.0`:
  ```bash
  pip install "numpy<2.0.0" --force-reinstall
  ```

---

### 🐛 Issue 2: `error: Microsoft Visual C++ 14.0 or greater is required` on Windows
- **Cause**: Compiling C++ extensions during `pip install insightface` requires MSVC compilers.
- **Solution**:
  1. Download Visual Studio Installer from [visualstudio.microsoft.com](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
  2. Select **Desktop development with C++** and install.
  3. Re-run `pip install -r backend/requirements.txt`.

---

### 🐛 Issue 3: Low Detection or Recognition Rate on Back Benches
- **Cause**: Dark classroom lighting, extreme angles, or blurry photos.
- **Best Practices**:
  - Ensure classroom photos are captured at minimum `1080p` resolution (higher resolution captures finer face landmarks on distant seats).
  - Enroll students with up to **3 to 5 reference headshots** across different lighting conditions and slight angle variations.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
