/* =========================================================
   복지인사이트 3D 로고 (Three.js)
   - 로고 벡터(LOGO_PATH)를 돌출(Extrude)시켜 광택 있는 입체로 렌더링
   - 마우스/터치에 따라 기울고, 천천히 떠다니는 애니메이션
   - WebGL을 쓸 수 없으면 정적 이미지(fallback)가 그대로 보입니다.
   ========================================================= */
window.initLogo3D = function initLogo3D({ THREE, SVGLoader, RoomEnvironment, RoundedBoxGeometry }) {
  const host = document.getElementById("logo3d");
  if (!host || !window.LOGO_PATH) return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
  } catch (e) {
    return; // WebGL 미지원 → fallback 이미지 유지
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10.4);

  /* ---------- 로고 마크 (돌출) ---------- */
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080"><path d="${window.LOGO_PATH}"/></svg>`;
  const data = new SVGLoader().parse(svg);
  const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
  const markGeo = new THREE.ExtrudeGeometry(shapes, {
    depth: 70,
    bevelEnabled: true,
    bevelThickness: 16,
    bevelSize: 9,
    bevelSegments: 8,
    curveSegments: 28,
  });
  markGeo.rotateX(Math.PI); // SVG는 y축이 아래 방향 → 뒤집기 (면 방향 유지)
  markGeo.center();
  markGeo.computeBoundingBox();
  const bb = markGeo.boundingBox;
  const S = 3.15 / Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y); // 타일 안에 꽉 차게
  markGeo.scale(S, S, S);

  const cream = new THREE.MeshPhysicalMaterial({
    color: 0xfaf6dc,
    roughness: 0.28,
    metalness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    sheen: 0.4,
    sheenColor: new THREE.Color(0xffd29a),
  });
  const mark = new THREE.Mesh(markGeo, cream);
  mark.position.z = 0.3;

  /* ---------- 앱 아이콘 형태의 받침 타일 ---------- */
  const tileGeo = new RoundedBoxGeometry(4.3, 4.3, 0.5, 8, 0.62);
  const tileMat = new THREE.MeshPhysicalMaterial({
    color: 0x1d2008,
    roughness: 0.32,
    metalness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const tile = new THREE.Mesh(tileGeo, tileMat);

  // 타일 테두리의 은은한 주황 림
  const rimGeo = new RoundedBoxGeometry(4.42, 4.42, 0.36, 8, 0.66);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xff8a1f, emissive: 0xff7a10, emissiveIntensity: 0.55, roughness: 0.4 });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.z = -0.12;

  const group = new THREE.Group();
  group.add(rim, tile, mark);
  scene.add(group);

  /* ---------- 조명 ---------- */
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.DirectionalLight(0xfff4e0, 2.2);
  key.position.set(-4, 5, 6);
  scene.add(key);
  const warm = new THREE.PointLight(0xff8a1f, 60, 20, 2);
  warm.position.set(4.5, -2, 3);
  scene.add(warm);
  const lime = new THREE.PointLight(0xd4e85a, 30, 20, 2);
  lime.position.set(-4.5, -3, 2);
  scene.add(lime);

  /* ---------- 크기 대응 ---------- */
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  /* ---------- 인터랙션 ---------- */
  const target = { x: 0, y: 0 };
  const cur = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    target.y = (e.clientX / window.innerWidth - 0.5) * 0.9;
    target.x = (e.clientY / window.innerHeight - 0.5) * 0.6;
  }, { passive: true });

  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0 }).observe(host);

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = clock.getElapsedTime();
    cur.x += (target.x - cur.x) * 0.06;
    cur.y += (target.y - cur.y) * 0.06;
    const sway = reduceMotion ? 0 : 1;
    group.rotation.y = -0.3 + cur.y + Math.sin(t * 0.6) * 0.18 * sway;
    group.rotation.x = 0.12 + cur.x + Math.sin(t * 0.8) * 0.05 * sway;
    group.position.y = Math.sin(t * 1.1) * 0.08 * sway;
    warm.position.x = 4.5 + Math.sin(t * 0.7) * 1.5 * sway;
    renderer.render(scene, camera);
  }
  frame();
  host.classList.add("ready");
};
