(function () {
    function isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && window.MediaRecorder);
    }

    function pickMimeType() {
        if (!window.MediaRecorder || !window.MediaRecorder.isTypeSupported) return '';
        const candidates = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm'
        ];
        return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
    }

    class Recorder {
        constructor(options) {
            this.options = Object.assign({
                fileNamePrefix: 'screen-recording',
                autoDownload: true,
                onStateChange: null
            }, options || {});
            this.mediaRecorder = null;
            this.stream = null;
            this.chunks = [];
            this.lastBlob = null;
        }

        async start(preferredTarget) {
            if (!isSupported()) throw new Error('Screen recording is not supported in this browser.');
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') return;

            let stream = null;
            if (preferredTarget && typeof preferredTarget.captureStream === 'function') {
                try {
                    stream = preferredTarget.captureStream(25);
                } catch (e) {
                    stream = null;
                }
            }
            if (!stream) {
                stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { frameRate: 30 },
                    audio: true
                });
            }

            this.stream = stream;
            this.chunks = [];
            const mimeType = pickMimeType();
            this.mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) this.chunks.push(event.data);
            };
            this.mediaRecorder.onstop = () => {
                const blobType = mimeType || 'video/webm';
                this.lastBlob = new Blob(this.chunks, { type: blobType });
                if (this.options.autoDownload && this.lastBlob.size > 0) {
                    this.download();
                }
                if (this.stream) {
                    this.stream.getTracks().forEach(track => track.stop());
                    this.stream = null;
                }
                this.#emitState(false);
            };

            this.mediaRecorder.start(250);
            this.#emitState(true);
        }

        stop() {
            if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') return;
            this.mediaRecorder.stop();
        }

        toggle(target) {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.stop();
                return Promise.resolve(false);
            }
            return this.start(target).then(() => true);
        }

        isRecording() {
            return !!(this.mediaRecorder && this.mediaRecorder.state === 'recording');
        }

        download() {
            if (!this.lastBlob) return;
            const url = URL.createObjectURL(this.lastBlob);
            const a = document.createElement('a');
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            a.href = url;
            a.download = `${this.options.fileNamePrefix}-${stamp}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 3000);
        }

        #emitState(recording) {
            if (typeof this.options.onStateChange === 'function') {
                this.options.onStateChange({ recording });
            }
        }
    }

    function createController(options) {
        const opts = Object.assign({
            button: null,
            statusEl: null,
            getTarget: null,
            fileNamePrefix: 'room-viewer',
            onStateChange: null
        }, options || {});

        const recorder = new Recorder({
            fileNamePrefix: opts.fileNamePrefix,
            onStateChange: (state) => {
                if (opts.button) opts.button.textContent = state.recording ? '⏹ Stop Rec' : '⏺ Record';
                if (opts.statusEl) opts.statusEl.textContent = state.recording ? 'REC ●' : 'REC idle';
                if (typeof opts.onStateChange === 'function') opts.onStateChange(state);
            }
        });

        if (opts.button) {
            opts.button.addEventListener('click', async () => {
                try {
                    const target = typeof opts.getTarget === 'function' ? opts.getTarget() : null;
                    await recorder.toggle(target);
                } catch (error) {
                    if (opts.statusEl) opts.statusEl.textContent = 'REC error';
                    console.error('Shared recorder error:', error);
                }
            });
        }
        if (opts.statusEl) opts.statusEl.textContent = 'REC idle';
        return recorder;
    }

    window.SharedScreenRecorder = {
        Recorder,
        createController,
        isSupported
    };
})();
