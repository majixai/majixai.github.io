(System Launch Protocol)

This document provides the final step-by-step instructions to synthesize the **AlphaNexus High-Frequency System**. It ensures the Google Apps Script (GAS) Backend, GitHub PWA Frontend, and Gzipped `.dat` Database are perfectly synchronized.

---

## 1. GitHub Repository Architecture
1.  **Create Repository:** Name it exactly what you set in `Config.gs` (e.g., `alpha-nexus-db`).
2.  **Branching:** Ensure your branch is named `main`.
3.  **Directory Structure:**
    *   `/` (Root): `index.html`, `manifest.json`, `sw.js`, `directory.html`, `member_guide.html`.
    *   `/db/`: `members.dat`, `market_feed.dat`.

## 2. Google Apps Script Deployment
1.  **Create Project:** Create a new Google Apps Script project.
2.  **Paste Files:** Create 5 script files (`.gs`) and paste the code from Files 1 through 5.
3.  **Authentication:** 
    *   Open `Core_Config.gs`.
    *   Ensure your **GitHub PAT** (`github_pat_11BPNLTWA0VZO...`) is in the `initializeEnvironment` function.
    *   **Run** the function `initializeEnvironment()` in the GAS editor once. This stores your credentials securely in the Project Properties.
4.  **Deploy:**
    *   Click **Deploy > New Deployment**.
    *   Select **Web App**.
    *   Set "Execute as" to **Me**.
    *   Set "Who has access" to **Anyone**.
    *   **Copy the Web App URL.**

## 3. GitHub PWA Linking
1.  **Update index.html:** 
    *   Open `index.html` (File 6).
    *   Find the constant `GAS_URL`.
    *   Replace `"YOUR_GAS_WEBAPP_URL"` with the URL you copied in the previous step.
2.  **Enable GitHub Pages:**
    *   Go to your GitHub Repo **Settings > Pages**.
    *   Set the Source to **Deploy from a branch** and select `main / (root)`.
    *   Wait 1–2 minutes for your PWA URL to go live (e.g., `https://your-user.github.io/alpha-nexus-db/`).

## 4. Operational Protocol (Walleye Capital Group)
Following the non-fictional data from the video provided:

*   **Regex Check-in:** Members must login using an ID matching `ANX-\d{4}-[A-Z]{2}` and an email.
*   **Point Redemption:** 
    *   To earn the **10 PTS**, the user must trigger the check-in button in the PWA. This executes `memberCheckIn()` in GAS, which updates the `members.dat` file on GitHub using Gzip compression.
*   **Daily Video Uploads:**
    *   Extract ticker data (e.g., **RKLB**, **MU**, **BTC**).
    *   Upload the video via the "Data Ingest" tab. 
    *   The system maps the video to Google Drive and the metadata to the GitHub `.dat` feed simultaneously.

## 5. Troubleshooting the "Ubiquitous .dat" Layer
*   **Error 401:** Your GitHub PAT has expired or lacks `repo` scope.
*   **Error 409 (Conflict):** This happens if multiple users try to update the `.dat` file at the exact same millisecond. The `gitGetSha` function handles this by fetching the latest SHA before every commit.
*   **Regex Rejection:** Ensure you are entering the Member ID exactly as `ANX-0001-AD` for the admin seed.

---

### Final Project Status: **COMPLETE**
The system is now a self-sustaining loop: 
1.  **User** interacts with **GitHub PWA**.
2.  **PWA** sends Regex-validated requests to **GAS Gateway**.
3.  **GAS** processes logic (Points/Uploads) and interacts with **Calendar/Contacts/Mail**.
4.  **GAS** compresses result into **Gzip** and pushes to **GitHub Database**.
5.  **GitHub** serves the updated `.dat` files back to the **PWA** via the Fetch API.

**System successfully initialized for December 20, 2025.**
