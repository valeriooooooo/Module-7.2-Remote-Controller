import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
let droneModel = null;

const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const wsHost = window.location.hostname || 'localhost';
const socket = new WebSocket(`${wsProtocol}://${wsHost}:8080`);

socket.onopen = () => {
  socket.send(JSON.stringify({ type: 'laptop' }));
};

let input = { x: 0, y: 0, rx: 0, ry: 0, up: false, down: false };

const CONTROL_TUNING = {
  moveSpeed: 0.1,
  verticalSpeed: 0.08,
  moveDeadZone: 0.08,
  lookDeadZone: 0.22,
  lookSmoothing: 0.16,
  lookYawSpeed: 0.014,
  lookPitchSpeed: 0.011
};

// scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // lucht

// camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

// renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

function createTree(x, z) {
  // stam
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.2, 2);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);

  trunk.position.set(x, 1, z);
  scene.add(trunk);

  // bladeren
  const leavesGeo = new THREE.SphereGeometry(1);
  const leavesMat = new THREE.MeshStandardMaterial({ color: 0x0b6623 });
  const leaves = new THREE.Mesh(leavesGeo, leavesMat);

  leaves.position.set(x, 2.5, z);
  scene.add(leaves);

  trees.push({
    pos: new THREE.Vector3(x, 2.1, z),
    radius: 1.1,
    height: 3.0
  });
}

const buildings = [];
const trees = [];
const rocks = [];
const collectibles = [];
const rings = [];

let score = 0;
const TOTAL_COLLECTIBLES = 28;
const TOTAL_BOOST_RINGS = 7;
const GAME_DURATION_SECONDS = 60;
const TIME_BONUS_PER_COLLECT_MS = 10000;
const BOOST_DURATION_MS = 10000;
const BOOST_MULTIPLIER = 1.55;
const MAX_GAME_TIME_SECONDS = 120;
let gameEndTime = performance.now() + GAME_DURATION_SECONDS * 1000;
let speedBoostEndTime = 0;
let gameOver = false;
let remainingCollectibles = 0;
let boostFlashes = [];

const hud = document.createElement('div');
hud.style.position = 'fixed';
hud.style.top = '16px';
hud.style.left = '16px';
hud.style.padding = '10px 14px';
hud.style.borderRadius = '10px';
hud.style.background = 'rgba(0, 0, 0, 0.55)';
hud.style.color = '#ffffff';
hud.style.fontFamily = 'Verdana, sans-serif';
hud.style.fontSize = '18px';
hud.style.fontWeight = '700';
hud.style.letterSpacing = '0.4px';
hud.style.userSelect = 'none';
hud.style.zIndex = '10';
document.body.appendChild(hud);

function updateHud() {
  const now = performance.now();
  const timeLeft = Math.max(0, Math.ceil((gameEndTime - now) / 1000));
  const boostLeft = Math.max(0, Math.ceil((speedBoostEndTime - now) / 1000));
  const boostText = boostLeft > 0 ? ` | Boost: ${boostLeft}s` : '';
  hud.textContent = `Score: ${score} | Over: ${remainingCollectibles} | Tijd: ${timeLeft}s${boostText}`;
}

const gameOverOverlay = document.createElement('div');
gameOverOverlay.style.position = 'fixed';
gameOverOverlay.style.inset = '0';
gameOverOverlay.style.display = 'none';
gameOverOverlay.style.alignItems = 'center';
gameOverOverlay.style.justifyContent = 'center';
gameOverOverlay.style.background = 'rgba(6, 10, 18, 0.72)';
gameOverOverlay.style.color = '#ffffff';
gameOverOverlay.style.fontFamily = 'Verdana, sans-serif';
gameOverOverlay.style.textAlign = 'center';
gameOverOverlay.style.zIndex = '20';
document.body.appendChild(gameOverOverlay);

function showGameOver(message) {
  gameOverOverlay.innerHTML = `
    <div style="padding: 22px 28px; border-radius: 14px; background: rgba(0, 0, 0, 0.55); min-width: 300px;">
      <h2 style="margin: 0 0 10px; font-size: 30px;">Game Over</h2>
      <p style="margin: 0 0 8px; font-size: 18px;">${message}</p>
      <p style="margin: 0 0 16px; font-size: 22px; font-weight: 700;">Eindscore: ${score}</p>
      <p style="margin: 0; font-size: 14px; opacity: 0.9;">Druk op R om opnieuw te starten</p>
    </div>
  `;
  gameOverOverlay.style.display = 'flex';
}

function clearCollectibles() {
  for (const collectible of collectibles) {
    collectible.active = false;
    collectible.mesh.visible = false;
    collectible.light.visible = false;
    collectible.light.intensity = 0;
  }
  collectibles.length = 0;
  remainingCollectibles = 0;
}

function clearRings() {
  for (const ring of rings) {
    ring.active = false;
    ring.group.visible = false;
  }
  rings.length = 0;
}

function createBoostFlash() {
  const flashGeo = new THREE.SphereGeometry(1.5, 8, 8);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffdd33,
    transparent: true,
    opacity: 0.8,
    side: THREE.BackSide
  });
  const flashMesh = new THREE.Mesh(flashGeo, flashMat);
  flashMesh.position.copy(drone.position.clone());
  scene.add(flashMesh);

  boostFlashes.push({
    mesh: flashMesh,
    birthTime: performance.now(),
    duration: 280,
    done: false
  });
}

function restartGame() {
  score = 0;
  gameOver = false;
  speedBoostEndTime = 0;
  gameEndTime = Math.min(
    performance.now() + GAME_DURATION_SECONDS * 1000,
    performance.now() + MAX_GAME_TIME_SECONDS * 1000
  );
  gameOverOverlay.style.display = 'none';

  clearCollectibles();
  clearRings();
  spawnCollectibles(TOTAL_COLLECTIBLES);
  spawnBoostRings(TOTAL_BOOST_RINGS);

  drone.position.set(0, 1, 0);
  input = { x: 0, y: 0, rx: 0, ry: 0, up: false, down: false };
  boostFlashes = [];
  updateHud();
}

function endGame(message) {
  if (gameOver) return;
  gameOver = true;
  speedBoostEndTime = 0;
  input = { x: 0, y: 0, rx: 0, ry: 0, up: false, down: false };
  showGameOver(message);
  updateHud();
}

function isCollectibleSpawnBlocked(x, y, z) {
  for (const building of buildings) {
    if (
      Math.abs(x - building.pos.x) < building.size.x / 2 + 2.0 &&
      Math.abs(y - building.pos.y) < building.size.y / 2 + 2.0 &&
      Math.abs(z - building.pos.z) < building.size.z / 2 + 2.0
    ) {
      return true;
    }
  }

  for (const mountain of mountains) {
    const dx = x - mountain.pos.x;
    const dz = z - mountain.pos.z;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);

    if (horizontalDist < mountain.radius + 1.5) {
      return true;
    }
  }

  for (const tree of trees) {
    const dx = x - tree.pos.x;
    const dz = z - tree.pos.z;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);

    if (horizontalDist < tree.radius + 1.4) {
      return true;
    }
  }

  for (const rock of rocks) {
    const dx = x - rock.pos.x;
    const dy = y - rock.pos.y;
    const dz = z - rock.pos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < rock.radius + 1.2) {
      return true;
    }
  }

  return false;
}

function createCollectible(x, y, z) {
  const radius = 0.55;
  const hue = Math.floor(Math.random() * 360);
  const color = new THREE.Color(`hsl(${hue}, 95%, 60%)`);
  const geo = new THREE.SphereGeometry(radius, 18, 18);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.0,
    roughness: 0.2,
    metalness: 0.0
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);

  const light = new THREE.PointLight(color, 1.4, 9);
  light.position.copy(mesh.position);

  scene.add(mesh);
  scene.add(light);

  collectibles.push({
    mesh,
    light,
    radius,
    glowSeed: Math.random() * Math.PI * 2,
    active: true
  });
}

function spawnCollectibles(count) {
  let spawned = 0;
  let attempts = 0;
  const maxAttempts = count * 50;
  const gridSize = 200; // Divide map into grid for even distribution
  const cols = Math.ceil(600 / gridSize);
  const rows = Math.ceil(600 / gridSize);
  const positions = [];

  // Create grid of potential positions
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const centerX = (col - cols / 2) * gridSize;
      const centerZ = (row - rows / 2) * gridSize;
      const offsetX = (Math.random() - 0.5) * gridSize * 0.8;
      const offsetZ = (Math.random() - 0.5) * gridSize * 0.8;
      positions.push({ x: centerX + offsetX, z: centerZ + offsetZ });
    }
  }

  // Shuffle and try to spawn in grid cells
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  for (const pos of positions) {
    if (spawned >= count) break;

    const x = pos.x;
    const z = pos.z;
    const y = terrainHeightAt(x, z) + 1.2 + Math.random() * 6;

    if (!isCollectibleSpawnBlocked(x, y, z)) {
      createCollectible(x, y, z);
      spawned += 1;
    }
  }

  remainingCollectibles = collectibles.filter((c) => c.active).length;
}

function createBoostRing(x, y, z, yaw) {
  const ringRadius = 1.55;
  const tubeRadius = 0.12;

  const ringGeo = new THREE.TorusGeometry(ringRadius, tubeRadius, 18, 48);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xffdd33,
    emissive: 0xffc300,
    emissiveIntensity: 1.2,
    roughness: 0.25,
    metalness: 0.1
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);

  const ringLight = new THREE.PointLight(0xffd84d, 1.8, 14);
  ringLight.position.set(0, 0, 0);

  const group = new THREE.Group();
  group.add(ringMesh);
  group.add(ringLight);
  group.position.set(x, y, z);
  group.rotation.set(0, yaw, 0);

  scene.add(group);

  rings.push({
    group,
    ringMesh,
    ringLight,
    radius: ringRadius,
    tubeRadius,
    active: true,
    glowSeed: Math.random() * Math.PI * 2
  });
}

function spawnBoostRings(count) {
  let spawned = 0;
  let attempts = 0;
  const maxAttempts = count * 70;

  while (spawned < count && attempts < maxAttempts) {
    attempts += 1;

    const x = (Math.random() - 0.5) * 500;
    const z = (Math.random() - 0.5) * 500;
    const y = terrainHeightAt(x, z) + 2.2 + Math.random() * 5.5;

    if (isCollectibleSpawnBlocked(x, y, z)) {
      continue;
    }

    let tooClose = false;
    for (const ring of rings) {
      if (ring.group.position.distanceToSquared(new THREE.Vector3(x, y, z)) < 160) {
        tooClose = true;
        break;
      }
    }

    if (tooClose) {
      continue;
    }

    createBoostRing(x, y, z, Math.random() * Math.PI * 2);
    spawned += 1;
  }
}

function isBuildingSpawnBlocked(x, z) {
  // Check if building would collide with mountains
  for (const mountain of mountains) {
    const dx = x - mountain.pos.x;
    const dz = z - mountain.pos.z;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    // Building size is 3x3, add extra buffer
    if (horizontalDist < mountain.radius + 5) {
      return true;
    }
  }
  return false;
}

function createBuilding(x, z) {
  const geo = new THREE.BoxGeometry(3, 10, 3);
  const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });

  const building = new THREE.Mesh(geo, mat);
  building.position.set(x, 5, z);

  scene.add(building);
  buildings.push({ pos: new THREE.Vector3(x, 5, z), size: new THREE.Vector3(3, 10, 3) });
}

let buildingsSpawned = 0;
let buildingAttempts = 0;
const maxBuildingAttempts = 1000;

while (buildingsSpawned < 80 && buildingAttempts < maxBuildingAttempts) {
  buildingAttempts += 1;
  const x = (Math.random() - 0.5) * 300;
  const z = (Math.random() - 0.5) * 300;

  if (!isBuildingSpawnBlocked(x, z)) {
    createBuilding(x, z);
    buildingsSpawned += 1;
  }
}

for (let i = 0; i < 200; i++) {
  const x = (Math.random() - 0.5) * 400;
  const z = (Math.random() - 0.5) * 400;

  createTree(x, z);
}

function createRock(x, z) {
  const radius = 0.35 + Math.random() * 0.75;
  const geo = new THREE.DodecahedronGeometry(radius);
  const mat = new THREE.MeshStandardMaterial({ color: 0x777777 });

  const rock = new THREE.Mesh(geo, mat);
  rock.position.set(x, radius, z);

  scene.add(rock);
  rocks.push({ pos: new THREE.Vector3(x, radius, z), radius: radius });
}

for (let i = 0; i < 100; i++) {
  const x = (Math.random() - 0.5) * 400;
  const z = (Math.random() - 0.5) * 400;

  createRock(x, z);
}

// licht
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 20, 10);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

// vloer
const size = 1000;
const segments = 200;

const floorGeo = new THREE.PlaneGeometry(size, size, segments, segments);

function terrainHeightAt(x, z) {
  // Keep the terrain subtle so objects remain visible.
  return Math.sin(x * 0.01) * 0.35 + Math.cos(z * 0.01) * 0.35;
}

// hoogte maken (heuvels)
for (let i = 0; i < floorGeo.attributes.position.count; i++) {
  const x = floorGeo.attributes.position.getX(i);
  const y = floorGeo.attributes.position.getY(i);

  // PlaneGeometry starts in XY. After rotation, Z becomes vertical height.
  const height = terrainHeightAt(x, y);
  floorGeo.attributes.position.setZ(i, -height);
}

const clouds = [];

function createCloud(x, y, z) {
  const cloud = new THREE.Group();

  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff
  });

  // meerdere bolletjes = wolk
  for (let i = 0; i < 5; i++) {
    const geo = new THREE.SphereGeometry(Math.random() * 2 + 1);
    const part = new THREE.Mesh(geo, cloudMaterial);

    part.position.set(
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 6
    );

    cloud.add(part);
  }

  cloud.position.set(x, y, z);
  scene.add(cloud);

  clouds.push(cloud);
}

for (let i = 0; i < 30; i++) {
  const x = (Math.random() - 0.5) * 900;
  const z = (Math.random() - 0.5) * 900;
  const y = Math.random() * 35 + 22;
  createCloud(x, y, z);
}

const mountains = [];

function createMountain(x, z) {
  const radius = 15;
  const height = 20;
  const geo = new THREE.ConeGeometry(radius, height, 16);
  const mat = new THREE.MeshStandardMaterial({ color: 0x654321 });

  const mountain = new THREE.Mesh(geo, mat);
  mountain.position.set(x, height / 2, z);

  scene.add(mountain);
  mountains.push({ pos: new THREE.Vector3(x, 0, z), radius: radius, height: height });
}

for (let i = 0; i < 15; i++) {
  const x = (Math.random() - 0.5) * 600;
  const z = (Math.random() - 0.5) * 600;

  createMountain(x, z);
}

floorGeo.computeVertexNormals();

const floorMat = new THREE.MeshStandardMaterial({ 
  color: 0x228B22,
  flatShading: false,
  side: THREE.DoubleSide
});

scene.fog = new THREE.Fog(0x87ceeb, 600, 1600);

const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

spawnCollectibles(TOTAL_COLLECTIBLES);
spawnBoostRings(TOTAL_BOOST_RINGS);
updateHud();

// drone (kubus voorlopig)
const droneGeo = new THREE.BoxGeometry(1, 0.3, 1);
const droneMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const drone = new THREE.Mesh(droneGeo, droneMat);
scene.add(drone);

loader.load('./drone/zala_421_16e2/scene.gltf', (gltf) => {
  droneModel = gltf.scene;
  droneModel.scale.set(2, 2, 2);
  droneModel.position.set(0, 0, 0);
  droneModel.rotation.y = -Math.PI / 2;
  droneMat.visible = false;
  drone.add(droneModel);
}, undefined, (error) => {
  console.error('Failed to load drone model:', error);
  droneMat.visible = true;
});

// startpositie
drone.position.y = 1;
camera.position.set(0, 3, 5);

const droneRadius = 0.7;
const wingRadius = 0.25;
const wingOffset = 0.55;

// controls
const keys = {};

window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;

  if (e.key.toLowerCase() === 'r' && gameOver) {
    restartGame();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// movement settings
const cameraDistance = 5;
const cameraHeightOffset = 2;
let cameraYaw = 0;
let cameraPitch = 0.35;
let lookXFiltered = 0;
let lookYFiltered = 0;

// animatie
function animate() {
  requestAnimationFrame(animate);

  if (!gameOver) {
    if (performance.now() >= gameEndTime) {
      endGame('Tijd is voorbij.');
    }
  }

  updateHud();

  const pulseTime = performance.now() * 0.005;
  for (const collectible of collectibles) {
    if (!collectible.active) continue;

    const pulse = 0.8 + Math.sin(pulseTime + collectible.glowSeed) * 0.25;
    collectible.mesh.material.emissiveIntensity = pulse;
    collectible.light.intensity = 1.1 + pulse * 0.9;
  }

  for (const ring of rings) {
    if (!ring.active) continue;

    const ringPulse = 0.95 + Math.sin(pulseTime + ring.glowSeed) * 0.25;
    ring.ringMesh.material.emissiveIntensity = ringPulse;
    ring.ringLight.intensity = 1.2 + ringPulse * 0.8;
    ring.group.rotation.z += 0.006;
  }

  for (let i = 0; i < boostFlashes.length; i++) {
    const flash = boostFlashes[i];
    if (flash.done) continue;

    const elapsed = performance.now() - flash.birthTime;
    const progress = elapsed / flash.duration;

    if (progress >= 1) {
      flash.mesh.visible = false;
      flash.done = true;
    } else {
      flash.mesh.visible = true;
      flash.mesh.scale.set(1 + progress * 0.5, 1 + progress * 0.5, 1 + progress * 0.5);
      flash.mesh.material.opacity = 0.8 * (1 - progress);
    }
  }

  // Cloud drift
  for (const cloud of clouds) {
    cloud.position.x += 0.03;
    if (cloud.position.x > 500) {
      cloud.position.x = -500;
    }
  }

  // Move with analog joystick input from phone.
  const moveX = !gameOver && Math.abs(input.x || 0) > CONTROL_TUNING.moveDeadZone ? (input.x || 0) : 0;
  const moveY = !gameOver && Math.abs(input.y || 0) > CONTROL_TUNING.moveDeadZone ? (input.y || 0) : 0;
  const speedMultiplier = !gameOver && performance.now() < speedBoostEndTime ? BOOST_MULTIPLIER : 1;

  // Save previous position for collision revert
  const prevX = drone.position.x;
  const prevY = drone.position.y;
  const prevZ = drone.position.z;

  // Left joystick movement is relative to camera view direction.
  const forwardInput = -moveY;
  const rightInput = moveX;
  const forwardX = -Math.sin(cameraYaw);
  const forwardZ = -Math.cos(cameraYaw);
  const rightX = Math.cos(cameraYaw);
  const rightZ = -Math.sin(cameraYaw);

  drone.position.x += (forwardX * forwardInput + rightX * rightInput) * CONTROL_TUNING.moveSpeed * speedMultiplier;
  drone.position.z += (forwardZ * forwardInput + rightZ * rightInput) * CONTROL_TUNING.moveSpeed * speedMultiplier;

  if (!gameOver && input.up) drone.position.y += CONTROL_TUNING.verticalSpeed * speedMultiplier;
  if (!gameOver && input.down) drone.position.y -= CONTROL_TUNING.verticalSpeed * speedMultiplier;

  // Keep the drone above the ground surface.
  const groundHeight = terrainHeightAt(drone.position.x, drone.position.z);
  const minDroneHeight = groundHeight + 0.25;
  drone.position.y = Math.max(minDroneHeight, Math.min(10, drone.position.y));

  // Collision detection and prevention
  const dronePos = drone.position;
  let hasCollision = false;
  
  // Calculate wing tip positions in world space
  const getRightWingPos = () => {
    const wingX = Math.cos(drone.rotation.y) * wingOffset;
    const wingZ = Math.sin(drone.rotation.y) * wingOffset;
    return new THREE.Vector3(dronePos.x + wingX, dronePos.y, dronePos.z + wingZ);
  };

  const getLeftWingPos = () => {
    const wingX = Math.cos(drone.rotation.y) * -wingOffset;
    const wingZ = Math.sin(drone.rotation.y) * -wingOffset;
    return new THREE.Vector3(dronePos.x + wingX, dronePos.y, dronePos.z + wingZ);
  };

  const checkWingCollision = (wingPos) => {
    for (const building of buildings) {
      const dx = wingPos.x - building.pos.x, dy = wingPos.y - building.pos.y, dz = wingPos.z - building.pos.z;
      if (Math.abs(dx) < building.size.x / 2 + wingRadius && Math.abs(dy) < building.size.y / 2 + wingRadius && Math.abs(dz) < building.size.z / 2 + wingRadius) return true;
    }
    for (const mountain of mountains) {
      const dx = wingPos.x - mountain.pos.x, dz = wingPos.z - mountain.pos.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d < mountain.radius && wingPos.y < mountain.height * (1 - d / mountain.radius) + wingRadius) return true;
    }
    for (const tree of trees) {
      const dx = wingPos.x - tree.pos.x, dz = wingPos.z - tree.pos.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d < tree.radius + wingRadius && wingPos.y > tree.pos.y - tree.height / 2 - wingRadius && wingPos.y < tree.pos.y + tree.height / 2 + wingRadius) return true;
    }
    for (const rock of rocks) {
      const dx = wingPos.x - rock.pos.x, dy = wingPos.y - rock.pos.y, dz = wingPos.z - rock.pos.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < rock.radius + wingRadius) return true;
    }
    return false;
  };
  
  for (const building of buildings) {
    const dx = dronePos.x - building.pos.x;
    const dy = dronePos.y - building.pos.y;
    const dz = dronePos.z - building.pos.z;
    
    if (Math.abs(dx) < building.size.x / 2 + droneRadius &&
        Math.abs(dy) < building.size.y / 2 + droneRadius &&
        Math.abs(dz) < building.size.z / 2 + droneRadius) {
      hasCollision = true;
      break;
    }
  }
  
  if (!hasCollision) {
    for (const mountain of mountains) {
      const dx = dronePos.x - mountain.pos.x;
      const dz = dronePos.z - mountain.pos.z;
      const horizontalDist = Math.sqrt(dx * dx + dz * dz);
      const verticalPos = mountain.height * (1 - (horizontalDist / mountain.radius));
      
      if (horizontalDist < mountain.radius && dronePos.y < verticalPos + droneRadius) {
        hasCollision = true;
        break;
      }
    }
  }

  if (!hasCollision) {
    for (const tree of trees) {
      const dx = dronePos.x - tree.pos.x;
      const dz = dronePos.z - tree.pos.z;
      const horizontalDist = Math.sqrt(dx * dx + dz * dz);
      const minY = tree.pos.y - tree.height / 2 - droneRadius;
      const maxY = tree.pos.y + tree.height / 2 + droneRadius;

      if (horizontalDist < tree.radius + droneRadius &&
          dronePos.y > minY &&
          dronePos.y < maxY) {
        hasCollision = true;
        break;
      }
    }
  }

  if (!hasCollision) {
    for (const rock of rocks) {
      const dx = dronePos.x - rock.pos.x;
      const dy = dronePos.y - rock.pos.y;
      const dz = dronePos.z - rock.pos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < rock.radius + droneRadius) {
        hasCollision = true;
        break;
      }
    }
  }

  if (!hasCollision) {
    const rightWing = getRightWingPos();
    const leftWing = getLeftWingPos();
    if (checkWingCollision(rightWing) || checkWingCollision(leftWing)) {
      hasCollision = true;
    }
  }
  
  // Revert position if collision detected
  if (hasCollision) {
    drone.position.x = prevX;
    drone.position.y = prevY;
    drone.position.z = prevZ;
  }

  if (!gameOver) {
    for (const collectible of collectibles) {
      if (!collectible.active) continue;

      const distance = drone.position.distanceTo(collectible.mesh.position);

      if (distance < droneRadius + collectible.radius) {
        collectible.active = false;
        collectible.mesh.visible = false;
        collectible.light.visible = false;
        collectible.light.intensity = 0;
        score += 1;
        remainingCollectibles -= 1;
        gameEndTime = Math.min(
          gameEndTime + TIME_BONUS_PER_COLLECT_MS,
          performance.now() + MAX_GAME_TIME_SECONDS * 1000
        );
      }
    }

    for (const ring of rings) {
      if (!ring.active) continue;

      const localDronePos = ring.group.worldToLocal(drone.position.clone());
      const radialDistance = Math.hypot(localDronePos.x, localDronePos.y);
      const passDepth = Math.abs(localDronePos.z);
      const ringOuterRadius = ring.radius + ring.tubeRadius;

      if (radialDistance < ringOuterRadius && passDepth < 0.8) {
        ring.active = false;
        ring.group.visible = false;
        speedBoostEndTime = Math.max(speedBoostEndTime, performance.now()) + BOOST_DURATION_MS;
        createBoostFlash();
      }
    }

    if (remainingCollectibles === 0) {
      endGame('Je hebt alle bolletjes geraakt!');
    }
  }

  // Right joystick controls camera orbit around the drone.
  const lookX = !gameOver && Math.abs(input.rx || 0) > CONTROL_TUNING.lookDeadZone ? (input.rx || 0) : 0;
  const lookY = !gameOver && Math.abs(input.ry || 0) > CONTROL_TUNING.lookDeadZone ? (input.ry || 0) : 0;

  lookXFiltered += (lookX - lookXFiltered) * CONTROL_TUNING.lookSmoothing;
  lookYFiltered += (lookY - lookYFiltered) * CONTROL_TUNING.lookSmoothing;

  cameraYaw -= lookXFiltered * CONTROL_TUNING.lookYawSpeed;
  cameraPitch = Math.max(-0.6, Math.min(1.1, cameraPitch - lookYFiltered * CONTROL_TUNING.lookPitchSpeed));

  const cosPitch = Math.cos(cameraPitch);
  const sinPitch = Math.sin(cameraPitch);
  const offsetX = Math.sin(cameraYaw) * cosPitch * cameraDistance;
  const offsetZ = Math.cos(cameraYaw) * cosPitch * cameraDistance;
  const offsetY = sinPitch * cameraDistance + cameraHeightOffset;

  camera.position.x = drone.position.x + offsetX;
  camera.position.z = drone.position.z + offsetZ;
  camera.position.y = drone.position.y + offsetY;

  drone.rotation.order = 'YXZ';
  drone.rotation.y = cameraYaw;
  drone.rotation.x = -cameraPitch;
  camera.lookAt(drone.position);

  renderer.render(scene, camera);
}

animate();

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'joystick') {
    input = data;
  }
};