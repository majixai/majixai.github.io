document.addEventListener('DOMContentLoaded', () => {
  const video = document.getElementById('video');
  const startButton = document.getElementById('start-button');
  const stopButton = document.getElementById('stop-button');
  const downloadLink = document.getElementById('download-link');
  const errorMessage = document.getElementById('error-message');
  const urlInput = document.getElementById('url-input');
  const urlSuggestions = document.getElementById('url-suggestions');
  const loadButton = document.getElementById('load-button');
  const iframe = document.getElementById('iframe');
  const quarterWindowButton = document.getElementById('quarter-window-button');
  const halfWindowButton = document.getElementById('half-window-button');
  const threeQuartersWindowButton = document.getElementById('three-quarters-window-button');
  const fullWindowButton = document.getElementById('full-window-button');
  const customSizeInput = document.getElementById('custom-size-input');
  const customSizeButton = document.getElementById('custom-size-button');

  let recorder;
  let db;

  async function initDB() {
    const sqlPromise = initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/${file}`
    });
    const [SQL] = await Promise.all([sqlPromise]);
    const dbFile = localStorage.getItem("history.db");
    if (dbFile) {
      const dbArray = dbFile.split(",").map(Number);
      db = new SQL.Database(new Uint8Array(dbArray));
    } else {
      db = new SQL.Database();
      db.run("CREATE TABLE urls (url TEXT);");
    }
    loadHistory();
  }

  function loadHistory() {
    const res = db.exec("SELECT * FROM urls");
    if (res.length > 0) {
      const urls = res[0].values;
      urlSuggestions.innerHTML = '';
      urls.forEach(url => {
        const option = document.createElement('option');
        option.value = url[0];
        urlSuggestions.appendChild(option);
      });
    }
  }

  function saveUrl(url) {
    const stmt = db.prepare("SELECT * FROM urls WHERE url=?");
    stmt.bind([url]);
    const exists = stmt.step();
    stmt.free();
    if (!exists) {
      const insertStmt = db.prepare("INSERT INTO urls VALUES (?)");
      insertStmt.run([url]);
      insertStmt.free();
      loadHistory();
      const data = db.export();
      localStorage.setItem("history.db", data);
    }
  }

  loadButton.addEventListener('click', () => {
    const url = urlInput.value;
    if (url) {
      iframe.src = url;
      saveUrl(url);
    }
  });

  function clearWindowClasses() {
    iframe.classList.remove('quarter-window', 'half-window', 'three-quarters-window', 'full-window');
    iframe.style.width = '';
    iframe.style.height = '';
  }

  quarterWindowButton.addEventListener('click', () => {
    clearWindowClasses();
    iframe.classList.add('quarter-window');
  });

  halfWindowButton.addEventListener('click', () => {
    clearWindowClasses();
    iframe.classList.add('half-window');
  });

  threeQuartersWindowButton.addEventListener('click', () => {
    clearWindowClasses();
    iframe.classList.add('three-quarters-window');
  });

  fullWindowButton.addEventListener('click', () => {
    clearWindowClasses();
    iframe.classList.add('full-window');
  });

  customSizeButton.addEventListener('click', () => {
    clearWindowClasses();
    const [width, height] = customSizeInput.value.split('x');
    if (width && height) {
      iframe.style.width = `${width}px`;
      iframe.style.height = `${height}px`;
    }
  });


  startButton.addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true
      });
      video.srcObject = stream;
      recorder = RecordRTC(stream, {
        type: 'video'
      });
      recorder.startRecording();
    } catch (err) {
      if (err.name === 'NotSupportedError') {
        errorMessage.textContent = 'Screen recording is not supported in this browser or environment.';
        errorMessage.style.display = 'block';
        startButton.disabled = true;
        stopButton.disabled = true;
      } else {
        errorMessage.textContent = `Error: ${err.message}`;
        errorMessage.style.display = 'block';
      }
    }
  });

  stopButton.addEventListener('click', () => {
    if (recorder) {
      recorder.stopRecording(() => {
        const blob = recorder.getBlob();
        const videoURL = URL.createObjectURL(blob);
        downloadLink.href = videoURL;
        downloadLink.style.display = 'block';
        downloadLink.download = 'recording.webm';
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        recorder = null;
      });
    }
  });

  initDB();
});
