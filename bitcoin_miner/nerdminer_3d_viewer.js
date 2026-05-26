(async () => {
  const MODEL_DEFS = [
    { label: 'NerdMinerv2 case body', path: './3d_files/NerdMinerv2_CAJA.stl', accent: 0xf7931a },
    { label: 'NerdMinerv2 top cover', path: './3d_files/NerdMinerv2_TAPA.stl', accent: 0x74b9ff },
    { label: 'NerdMinerv2 support mount', path: './3d_files/NerdMinerv2-Soporte1.stl', accent: 0x00b894 },
    { label: 'NerdMinerv2 secure pins', path: './3d_files/NerdMinerv2_SecurePins.stl', accent: 0xa29bfe },
    { label: 'NerdCase with buttons', path: './3d_files/NerdCase_withButtons_byJoaquin.stl', accent: 0xd63031 },
  ];

  const state = {
    loadingToken: 0,
    currentIndex: 0,
    autoRotate: true,
    wireframe: false,
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    loader: null,
    group: null,
    mesh: null,
    wire: null,
    box: null,
  };

  const el = {
    select: document.getElementById('stl-model-select'),
    prev: document.getElementById('stl-prev-btn'),
    next: document.getElementById('stl-next-btn'),
    rotate: document.getElementById('stl-rotate-btn'),
    wire: document.getElementById('stl-wire-btn'),
    reset: document.getElementById('stl-reset-btn'),
    canvas: document.getElementById('stl-canvas'),
    stage: document.querySelector('.stl-stage'),
    modelName: document.getElementById('stl-model-name'),
    faceCount: document.getElementById('stl-model-face-count'),
    triangles: document.getElementById('stl-triangles'),
    fileSize: document.getElementById('stl-file-size'),
    width: document.getElementById('stl-width'),
    height: document.getElementById('stl-height'),
    depth: document.getElementById('stl-depth'),
    status: document.getElementById('stl-status'),
  };

  if (!el.select || !el.canvas || !el.stage) return;

  const fmtBytes = (value) => {
    if (!Number.isFinite(value)) return '—';
    if (value >= 1024 * 1024) return (value / (1024 * 1024)).toFixed(2) + ' MB';
    if (value >= 1024) return (value / 1024).toFixed(1) + ' KB';
    return String(value) + ' B';
  };

  const fmtDim = (value) => {
    if (!Number.isFinite(value)) return '—';
    return (value >= 100 ? value.toFixed(0) : value.toFixed(1)) + ' mm';
  };

  const setStatus = (message) => {
    if (el.status) el.status.textContent = message;
  };

  const setButtonState = () => {
    el.rotate.innerHTML = '<i class="fa fa-rotate-right me-1"></i>Auto-rotate ' + (state.autoRotate ? 'on' : 'off');
    el.wire.innerHTML = '<i class="fa fa-vector-square me-1"></i>Wireframe ' + (state.wireframe ? 'on' : 'off');
  };

  try {
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
    const { STLLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/STLLoader.js');
    const { OrbitControls } = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js');

    state.loader = new STLLoader();
    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0x07111d);
    state.scene.fog = new THREE.Fog(0x07111d, 6, 18);

    const ambient = new THREE.HemisphereLight(0xfff1dd, 0x19324b, 1.8);
    state.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(4, 6, 7);
    state.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x74b9ff, 1.2);
    rimLight.position.set(-6, 2, -4);
    state.scene.add(rimLight);

    state.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
    state.camera.position.set(0.8, 0.6, 4.2);

    state.renderer = new THREE.WebGLRenderer({
      canvas: el.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    state.renderer.setClearColor(0x07111d, 1);
    state.renderer.outputColorSpace = THREE.SRGBColorSpace;

    state.controls = new OrbitControls(state.camera, el.canvas);
    state.controls.enableDamping = true;
    state.controls.dampingFactor = 0.08;
    state.controls.autoRotate = state.autoRotate;
    state.controls.autoRotateSpeed = 0.9;
    state.controls.enablePan = false;
    state.controls.minDistance = 1.4;
    state.controls.maxDistance = 12;
    state.controls.target.set(0, 0, 0);
    state.controls.update();

    for (const model of MODEL_DEFS) {
      const option = document.createElement('option');
      option.value = model.path;
      option.textContent = model.label;
      el.select.appendChild(option);
    }

    const resizeRenderer = () => {
      const width = Math.max(1, el.stage.clientWidth);
      const height = Math.max(1, el.stage.clientHeight);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const targetWidth = Math.floor(width * pixelRatio);
      const targetHeight = Math.floor(height * pixelRatio);
      if (el.canvas.width !== targetWidth || el.canvas.height !== targetHeight) {
        state.renderer.setPixelRatio(pixelRatio);
        state.renderer.setSize(width, height, false);
        state.camera.aspect = width / height;
        state.camera.updateProjectionMatrix();
      }
    };

    const clearModel = () => {
      if (state.group) {
        state.scene.remove(state.group);
        state.group.traverse((object) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((material) => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
      }
      state.group = null;
      state.mesh = null;
      state.wire = null;
      state.box = null;
    };

    const fitModelToCamera = (geometry) => {
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const box = geometry.boundingBox.clone();
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      geometry.translate(-center.x, -center.y, -center.z);

      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = 2.2 / maxDim;
      geometry.scale(scale, scale, scale);
      geometry.computeBoundingSphere();

      return { size, scale };
    };

    const loadModel = async (index) => {
      const token = ++state.loadingToken;
      const model = MODEL_DEFS[index];
      if (!model) return;

      state.currentIndex = index;
      el.select.value = model.path;
      el.modelName.textContent = model.label;
      setStatus('Loading ' + model.label + '…');

      try {
        const response = await fetch(model.path, { cache: 'force-cache' });
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ' while loading ' + model.path);
        }
        const fileSize = Number(response.headers.get('content-length') || 0) || 0;
        const buffer = await response.arrayBuffer();
        if (token !== state.loadingToken) return;

        const geometry = state.loader.parse(buffer);
        geometry.computeVertexNormals();

        const { size } = fitModelToCamera(geometry);

        if (token !== state.loadingToken) return;
        clearModel();

        const material = new THREE.MeshStandardMaterial({
          color: model.accent,
          metalness: 0.18,
          roughness: 0.38,
        });
        const mesh = new THREE.Mesh(geometry, material);
        const wire = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry, 28),
          new THREE.LineBasicMaterial({ color: 0x9fb3c8, transparent: true, opacity: 0.72 })
        );

        const group = new THREE.Group();
        group.add(mesh);
        group.add(wire);
        state.scene.add(group);

        state.group = group;
        state.mesh = mesh;
        state.wire = wire;
        state.box = size;

        const triangles = Math.max(0, Math.floor((geometry.attributes.position.count || 0) / 3));
        const radius = geometry.boundingSphere?.radius || 1;

        state.camera.position.set(radius * 0.85, radius * 0.55, radius * 3.1);
        state.camera.near = Math.max(0.01, radius / 100);
        state.camera.far = Math.max(50, radius * 100);
        state.camera.updateProjectionMatrix();

        state.controls.target.set(0, 0, 0);
        state.controls.maxDistance = radius * 10;
        state.controls.autoRotate = state.autoRotate;
        state.controls.update();
        state.controls.saveState();

        wire.visible = state.wireframe;
        setButtonState();

        el.triangles.textContent = triangles.toLocaleString();
        el.fileSize.textContent = fmtBytes(fileSize || buffer.byteLength);
        el.width.textContent = fmtDim(size.x);
        el.height.textContent = fmtDim(size.y);
        el.depth.textContent = fmtDim(size.z);
        el.faceCount.textContent = 'Faces: ' + triangles.toLocaleString();
        setStatus('Loaded ' + model.label + ' (' + triangles.toLocaleString() + ' triangles). Drag to orbit, scroll to zoom.');
      } catch (error) {
        console.error('[bitcoin_miner 3d viewer] failed to load model', error);
        setStatus('Failed to load ' + model.label + '. Check that the STL files are present and served over HTTP.');
        el.faceCount.textContent = 'Faces: error';
        el.triangles.textContent = '—';
        el.fileSize.textContent = '—';
        el.width.textContent = '—';
        el.height.textContent = '—';
        el.depth.textContent = '—';
      }
    };

    el.prev.addEventListener('click', () => {
      const nextIndex = (state.currentIndex - 1 + MODEL_DEFS.length) % MODEL_DEFS.length;
      loadModel(nextIndex);
    });
    el.next.addEventListener('click', () => {
      const nextIndex = (state.currentIndex + 1) % MODEL_DEFS.length;
      loadModel(nextIndex);
    });
    el.rotate.addEventListener('click', () => {
      state.autoRotate = !state.autoRotate;
      state.controls.autoRotate = state.autoRotate;
      setButtonState();
      setStatus(state.autoRotate ? 'Auto-rotate restored. Drag to override momentarily.' : 'Auto-rotate paused. Drag the model to inspect it.');
    });
    el.wire.addEventListener('click', () => {
      state.wireframe = !state.wireframe;
      if (state.wire) state.wire.visible = state.wireframe;
      setButtonState();
      setStatus(state.wireframe ? 'Wireframe overlay enabled.' : 'Wireframe overlay hidden.');
    });
    el.reset.addEventListener('click', () => {
      if (state.group) state.group.rotation.set(0, 0, 0);
      if (state.controls) state.controls.reset();
      if (state.controls) state.controls.autoRotate = state.autoRotate;
      setStatus('View reset to the default angle.');
    });
    el.select.addEventListener('change', (event) => {
      const index = MODEL_DEFS.findIndex((model) => model.path === event.target.value);
      loadModel(index >= 0 ? index : 0);
    });

    window.addEventListener('resize', resizeRenderer);

    const animate = () => {
      resizeRenderer();
      if (state.group && state.autoRotate) {
        state.group.rotation.y += 0.0055;
      }
      if (state.controls) state.controls.update();
      if (state.renderer && state.scene && state.camera) {
        state.renderer.render(state.scene, state.camera);
      }
      requestAnimationFrame(animate);
    };

    setButtonState();
    resizeRenderer();
    await loadModel(0);
    animate();
  } catch (error) {
    console.warn('[bitcoin_miner 3d viewer] viewer unavailable', error);
    setStatus('3D viewer unavailable in this browser session. Open the page through HTTP(S) and ensure CDN access is available.');
    el.modelName.textContent = 'Viewer unavailable';
    el.faceCount.textContent = 'Faces: —';
    el.triangles.textContent = '—';
    el.fileSize.textContent = '—';
    el.width.textContent = '—';
    el.height.textContent = '—';
    el.depth.textContent = '—';
  }
})();