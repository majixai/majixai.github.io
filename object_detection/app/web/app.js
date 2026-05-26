(() => {
  const statusEl = document.getElementById("status");
  const videoEl = document.getElementById("video");
  const detectionsEl = document.getElementById("detections");
  const annotatedEl = document.getElementById("annotated");
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  let ws = null;
  let stream = null;
  let rafId = null;
  let awaitingResult = false;

  const setStatus = (text) => {
    statusEl.textContent = text;
  };

  const renderDetections = (detections) => {
    detectionsEl.innerHTML = "";
    detections.forEach((det) => {
      const li = document.createElement("li");
      const label = det.label || det.class;
      li.textContent = `${label} (${(det.conf || 0).toFixed(2)}) [${Math.round(det.x1)}, ${Math.round(det.y1)} -> ${Math.round(det.x2)}, ${Math.round(det.y2)}]`;
      detectionsEl.appendChild(li);
    });
  };

  const scheduleFrame = () => {
    if (rafId !== null) return;

    const tick = () => {
      rafId = window.requestAnimationFrame(tick);
      if (!ws || ws.readyState !== WebSocket.OPEN || awaitingResult) return;
      if (!videoEl.videoWidth || !videoEl.videoHeight) return;

      awaitingResult = true;
      ws.send(JSON.stringify({ type: "frame", data: frameToJpegDataUrl() }));
    };

    rafId = window.requestAnimationFrame(tick);
  };

  const connectWs = () => {
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${scheme}://${window.location.host}/ws`);

    ws.onopen = () => setStatus("Connected");
    ws.onclose = () => setStatus("Disconnected");
    ws.onerror = () => setStatus("WebSocket error");
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type !== "result") return;

      awaitingResult = false;
      renderDetections(payload.detections || []);
      if (payload.annotated) {
        annotatedEl.src = `data:image/jpeg;base64,${payload.annotated}`;
      }
    };
  };

  const frameToJpegDataUrl = () => {
    const canvas = document.createElement("canvas");
    const maxWidth = 320;
    const scale = Math.min(1, maxWidth / Math.max(1, videoEl.videoWidth));
    canvas.width = Math.max(1, Math.round(videoEl.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(videoEl.videoHeight * scale));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.6);
  };

  const start = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      videoEl.srcObject = stream;
      if (!ws || ws.readyState > 1) {
        connectWs();
      }
      scheduleFrame();
    } catch (err) {
      setStatus(`Camera error: ${err.message || err}`);
    }
  };

  const stop = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    awaitingResult = false;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    if (ws && ws.readyState <= 1) {
      ws.close();
    }
    setStatus("Stopped");
  };

  startBtn.addEventListener("click", start);
  stopBtn.addEventListener("click", stop);
})();
