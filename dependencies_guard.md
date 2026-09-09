### `dependencies_guard.md`

```markdown
# Dependencies Guard & Environment Constraints

## 1. Runtime Environment Rules
- Python Runtime: Strictly use **Python 3.10** or **Python 3.11**. 
  - *Warning:* Do not use Python 3.12+ as ONNX Runtime and InsightFace compiled binary wheels have unresolved compatibility breaks on newer interpreters.
- Node.js Runtime: Use **Node.js LTS (v20.x or v22.x)**.

## 2. Python Backend Dependencies (`backend/requirements.txt`)
Pin versions to prevent runtime wheel mismatch during local builds:

```text
fastapi==0.111.0
uvicorn[standard]==0.30.1
pydantic==2.7.4
python-multipart==0.0.9
numpy>=1.24.3,<2.0.0
opencv-python-headless==4.9.0.80
insightface==0.7.3
onnxruntime==1.18.0
Notes on Packages:

opencv-python-headless is used instead of standard opencv-python to avoid GUI library dependencies (X11/Qt) on local servers.

numpy<2.0.0 is strictly enforced because insightface and onnxruntime C-extensions are compiled against NumPy 1.x ABI.

onnxruntime (CPU variant) is used. Do not install onnxruntime-gpu unless CUDA 11.8/12.x and cuDNN are explicitly pre-configured on the host machine.

## 3. Frontend Dependencies (frontend/package.json)
JSON
{
  "dependencies": {
    "next": "14.2.4",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.395.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/node": "^20.14.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4"
  }
}
## 4. Hardware Safety & Build Prerequisites
Windows OS Prerequisite: If installing insightface throws a compilation error during pip install, ensure the Microsoft C++ Build Tools (MSVC v143 or later) are installed.

Model Weight Cache: On the initial run, the application will download ~300 MB of model weights into ~/.insightface/models/buffalo_l/. Ensure unrestricted network access during the first start.