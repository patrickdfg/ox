// Three.js 0.187.0, MIT license: vendor/three/LICENSE
import * as THREE from "../vendor/three/three.module.js";

const positions = { 3: -3.1, 2: 0, 1: 3.1 };
const heights = { 3: 0.8, 2: 1.3, 1: 1.9 };
const delays = { 3: 0.25, 2: 1.35, 1: 2.45 };
const colors = { 3: 0xc47e58, 2: 0xaabfdc, 1: 0xffcd55 };
const suits = { 3: 0xf17d91, 2: 0x72aafa, 1: 0xb08bff };

function mesh(geometry, material, x, y, z) {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(x, y, z);
  return result;
}

function astronaut(color, rank) {
  const group = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.06 });
  const skin = new THREE.MeshStandardMaterial({ color: { 1: 0xffe0ac, 2: 0xcdeaff, 3: 0xffb58f }[rank], roughness: 0.55 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xfff6ec, roughness: 0.6 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xf59dab, roughness: 0.65 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x302738, roughness: 0.28 });
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const addBall = (material, x, y, z, sx, sy, sz) => {
    const ball = mesh(sphere, material, x, y, z);
    ball.scale.set(sx, sy, sz); group.add(ball); return ball;
  };
  if (rank === 3) {
    const tail = addBall(skin, 0.67, 0.42, -0.26, 0.4, 0.22, 0.2); tail.rotation.z = 0.65;
    const tailTip = addBall(cream, 0.91, 0.58, -0.26, 0.19, 0.16, 0.16); tailTip.rotation.z = 0.65;
  }
  addBall(suit, 0, 0.55, 0, 0.57, 0.6, 0.43);
  addBall(cream, 0, 0.52, 0.39, 0.31, 0.3, 0.07);
  addBall(skin, -0.28, 0.13, 0.13, 0.23, 0.16, 0.27);
  addBall(skin, 0.28, 0.13, 0.13, 0.23, 0.16, 0.27);
  const arm = side => {
    const limb = new THREE.Group(); limb.position.set(side * 0.45, 0.7, 0); limb.rotation.z = -side * 1.1;
    const sleeve = mesh(sphere, suit, 0, 0.17, 0); sleeve.scale.set(0.17, 0.33, 0.17); limb.add(sleeve);
    const paw = mesh(sphere, skin, 0, 0.45, 0.01); paw.scale.set(0.18, 0.18, 0.17); limb.add(paw); group.add(limb);
    return limb;
  };
  const leftArm = arm(-1), rightArm = arm(1);
  if (rank === 2) {
    for (const side of [-1, 1]) {
      const ear = addBall(skin, side * 0.43, 2.05, -0.08, 0.18, 0.42, 0.15); ear.rotation.z = -side * 0.22;
      const inner = addBall(pink, side * 0.43, 2.07, 0.05, 0.09, 0.31, 0.035); inner.rotation.z = -side * 0.22;
    }
  } else if (rank === 3) {
    for (const side of [-1, 1]) {
      const ear = mesh(new THREE.ConeGeometry(0.24, 0.44, 24), skin, side * 0.48, 2.02, -0.05); ear.rotation.z = -side * 0.28; group.add(ear);
      const inner = mesh(new THREE.ConeGeometry(0.12, 0.27, 24), cream, side * 0.48, 2.01, 0.14); inner.rotation.z = -side * 0.28; group.add(inner);
    }
  } else {
    for (const side of [-1, 1]) {
      addBall(skin, side * 0.52, 1.96, -0.06, 0.25, 0.25, 0.16);
      addBall(pink, side * 0.52, 1.96, 0.09, 0.12, 0.12, 0.035);
    }
  }
  addBall(skin, 0, 1.47, 0, 0.76, 0.69, 0.6);
  addBall(cream, 0, 1.27, 0.54, 0.3, 0.18, 0.13);
  for (const x of [-0.25, 0.25]) {
    addBall(dark, x, 1.51, 0.54, 0.105, 0.135, 0.075);
    addBall(white, x - 0.03, 1.56, 0.608, 0.035, 0.043, 0.02);
    addBall(white, x + 0.035, 1.47, 0.61, 0.014, 0.017, 0.01);
  }
  for (const x of [-0.45, 0.45]) addBall(pink, x, 1.29, 0.47, 0.115, 0.065, 0.035);
  addBall(dark, 0, 1.31, 0.665, 0.055, 0.04, 0.025);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.014, 8, 20, Math.PI), dark);
  smile.rotation.z = Math.PI; smile.position.set(0, 1.22, 0.665); group.add(smile);
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.1, 5), new THREE.MeshStandardMaterial({ color: 0xffda75, roughness: 0.4 }));
  badge.rotation.z = Math.PI / 2; badge.position.set(0, 0.55, 0.47); group.add(badge);
  if (rank === 1) {
    const gold = new THREE.MeshStandardMaterial({ color: 0xffd45f, metalness: 0.6, roughness: 0.25 });
    const crown = mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.13, 8), gold, 0, 2.22, 0);
    group.add(crown);
    for (const x of [-0.18, 0, 0.18]) group.add(mesh(new THREE.ConeGeometry(0.095, 0.23, 4), gold, x, 2.36, 0));
  }
  return { group, leftArm, rightArm };
}

function numberPlate(rank, height) {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.font = "900 92px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(rank), 64, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }), 0, height * 0.55, 1.2);
}

function firework(scene, origin, color, glow) {
  const count = 48, vertices = new Float32Array(count * 3), velocities = [];
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1), speed = 1.1 + Math.random() * 2;
    velocities.push(new THREE.Vector3(Math.sin(phi) * Math.cos(theta) * speed, Math.cos(phi) * speed, Math.sin(phi) * Math.sin(theta) * speed));
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  const material = new THREE.PointsMaterial({ color, size: 8, sizeAttenuation: false, map: glow, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geometry, material); points.position.copy(origin); scene.add(points);
  return { points, velocities, born: 0 };
}

export function showPodium(container, groups, replay) {
  const shell = document.createElement("div"); shell.className = "podium-show";
  const sceneArea = document.createElement("div"); sceneArea.className = "podium-scene";
  const bursts = document.createElement("div"); bursts.className = "podium-bursts"; bursts.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 3; i++) bursts.append(document.createElement("i"));
  const caption = document.createElement("div"); caption.className = "podium-captions";
  const replayButton = document.createElement("button"); replayButton.type = "button"; replayButton.className = "podium-replay"; replayButton.textContent = "✦ 축하 다시 보기"; replayButton.onclick = replay;
  sceneArea.append(bursts); shell.append(sceneArea, caption, replayButton);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  shell.classList.toggle("reduced-motion", reduced);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-hidden", "true"); sceneArea.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-7, 7, 4, -4, 0.1, 100);
  camera.position.set(0, 5.1, 13); camera.lookAt(0, 1.9, 0);
  scene.add(new THREE.HemisphereLight(0xd9e8ff, 0x44355f, 2.3));
  const light = new THREE.DirectionalLight(0xffffff, 2.4); light.position.set(-3, 8, 6); scene.add(light);
  const pink = new THREE.PointLight(0xff82cb, 80, 30); pink.position.set(-6, 4, 3); scene.add(pink);
  const blue = new THREE.PointLight(0x67d9ff, 70, 30); blue.position.set(6, 5, -2); scene.add(blue);
  const actors = [];
  for (const rank of [3, 2, 1]) {
    const group = new THREE.Group(), height = heights[rank]; group.position.x = positions[rank]; group.visible = reduced;
    const base = new THREE.MeshStandardMaterial({ color: colors[rank], roughness: 0.32, metalness: 0.55 });
    group.add(mesh(new THREE.CylinderGeometry(0.9, 1.03, height, 8), base, 0, height / 2, 0));
    group.add(mesh(new THREE.CylinderGeometry(0.96, 0.96, 0.13, 8), new THREE.MeshStandardMaterial({ color: 0xfff7da, metalness: 0.35, roughness: 0.28 }), 0, height + 0.02, 0));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.035, 8, 48), new THREE.MeshBasicMaterial({ color: colors[rank] }));
    rim.rotation.x = Math.PI / 2; rim.position.y = height + 0.11; group.add(rim);
    group.add(numberPlate(rank, height));
    const members = groups.filter(player => player.rank === rank);
    let character;
    if (members.length) { character = astronaut(suits[rank], rank); character.group.position.y = height + 0.09; group.add(character.group); }
    scene.add(group); actors.push({ group, character, rank });
    const label = document.createElement("article"); label.className = `podium-caption rank-${rank}`; label.style.setProperty("--podium-delay", `${delays[rank]}s`);
    const heading = document.createElement("strong"); heading.textContent = `${["", "🥇", "🥈", "🥉"][rank]} ${members.length > 1 ? "공동 " : ""}${rank}위`;
    const names = document.createElement("div"); names.className = "podium-names";
    if (!members.length) names.textContent = "—";
    members.forEach(player => { const row = document.createElement("div"), name = document.createElement("span"), score = document.createElement("small"); name.textContent = player.name; score.textContent = `${player.score || 0}점`; row.append(name, score); names.append(row); });
    label.append(heading, names); caption.append(label);
  }
  const sparkles = new THREE.BufferGeometry();
  const stars = new Float32Array(90 * 3);
  for (let i = 0; i < stars.length; i += 3) { stars[i] = (Math.random() - .5) * 15; stars[i + 1] = Math.random() * 7; stars[i + 2] = -3 - Math.random() * 3; }
  sparkles.setAttribute("position", new THREE.BufferAttribute(stars, 3));
  scene.add(new THREE.Points(sparkles, new THREE.PointsMaterial({ color: 0xd6e7ff, size: 2, sizeAttenuation: false, transparent: true, opacity: .8 })));
  const fireworks = [];
  if (!reduced) {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 32;
    const ctx = canvas.getContext("2d"), gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(255,255,255,1)"); gradient.addColorStop(.25, "rgba(255,255,255,.9)"); gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 32, 32);
    const glow = new THREE.CanvasTexture(canvas);
    const burstColors = [0xffcb5a, 0xff75bd, 0x78e6ff, 0xb495ff, 0xffffff];
    for (let i = 0; i < 6; i++) {
      const burst = firework(scene, new THREE.Vector3((i % 3 - 1) * 3, 3.6 + (i % 2) * .55, -1.4), burstColors[i % burstColors.length], glow);
      burst.born = 3.1 + i * 0.65; burst.points.visible = false; fireworks.push(burst);
    }
  }
  const resize = () => {
    const width = sceneArea.clientWidth || 800, height = sceneArea.clientHeight || 460;
    const halfWidth = 4 * width / height; camera.left = -halfWidth; camera.right = halfWidth; camera.top = 4; camera.bottom = -4;
    camera.updateProjectionMatrix(); renderer.setSize(width, height, false); renderer.render(scene, camera);
  };
  const observer = new ResizeObserver(resize);
  let frame = 0, disposed = false, start = performance.now();
  const dispose = () => {
    if (disposed) return; disposed = true; cancelAnimationFrame(frame); observer.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    scene.traverse(object => { object.geometry?.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => { material?.map?.dispose(); material?.dispose(); }); });
    renderer.forceContextLoss(); renderer.dispose(); shell.remove(); container.classList.remove("has-3d");
  };
  const animate = now => {
    if (disposed || document.hidden) return;
    const time = (now - start) / 1000;
    for (const actor of actors) {
      const progress = reduced ? 1 : Math.max(0, Math.min(1, (time - delays[actor.rank]) / .8));
      actor.group.visible = progress > 0;
      const eased = 1 - Math.pow(1 - progress, 3);
      actor.group.position.y = -3.2 * (1 - eased);
      if (actor.character && progress === 1 && !reduced) {
        actor.character.group.position.y = heights[actor.rank] + .09 + Math.sin(time * 3 + actor.rank) * .045;
        actor.character.leftArm.rotation.z = 1.1 + Math.sin(time * 4) * .16;
        actor.character.rightArm.rotation.z = -1.1 - Math.sin(time * 4) * .16;
      }
    }
    for (const burst of fireworks) {
      const age = time - burst.born; burst.points.visible = age >= 0 && age < 2;
      if (!burst.points.visible) continue;
      const values = burst.points.geometry.attributes.position.array;
      burst.velocities.forEach((v, i) => { values[3*i] = v.x * age; values[3*i+1] = v.y * age - .65 * age * age; values[3*i+2] = v.z * age; });
      burst.points.geometry.attributes.position.needsUpdate = true; burst.points.material.opacity = Math.max(0, 1 - age / 2);
    }
    renderer.render(scene, camera);
    if (!reduced && time < 9) frame = requestAnimationFrame(animate);
  };
  const onVisibility = () => { if (!document.hidden && !disposed) frame = requestAnimationFrame(animate); };
  renderer.domElement.addEventListener("webglcontextlost", event => { event.preventDefault(); dispose(); });
  container.prepend(shell); container.classList.add("has-3d");
  document.addEventListener("visibilitychange", onVisibility); observer.observe(sceneArea);
  resize(); requestAnimationFrame(() => shell.classList.add("is-ready")); animate(start);
  return dispose;
}
