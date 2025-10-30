const video = document.getElementById('video');
const startButton = document.getElementById('start-button');
const stopButton = document.getElementById('stop-button');
const downloadLink = document.getElementById('download-link');

let mediaRecorder;
let chunks = [];

startButton.addEventListener('click', async () => {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { mediaSource: 'screen' }
  });
  video.srcObject = stream;

  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = e => chunks.push(e.data);
  mediaRecorder.onstop = e => {
    const blob = new Blob(chunks, { 'type' : 'video/webm' });
    chunks = [];
    const videoURL = URL.createObjectURL(blob);
    downloadLink.href = videoURL;
    downloadLink.style.display = 'block';
    downloadLink.download = 'recording.webm';
  };
  mediaRecorder.start();
});

stopButton.addEventListener('click', () => {
  mediaRecorder.stop();
  video.srcObject.getTracks().forEach(track => track.stop());
  video.srcObject = null;
});
