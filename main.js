import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
let droneModel = null;

const socket = new WebSocket('ws://localhost:8080');

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

function createBuilding(x, z) {
  const geo = new THREE.BoxGeometry(3, 10, 3);
  const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });

  const building = new THREE.Mesh(geo, mat);
  building.position.set(x, 5, z);

  scene.add(building);
  buildings.push({ pos: new THREE.Vector3(x, 5, z), size: new THREE.Vector3(3, 10, 3) });
}

for (let i = 0; i < 80; i++) {
  const x = (Math.random() - 0.5) * 300;
  const z = (Math.random() - 0.5) * 300;

  createBuilding(x, z);
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

// drone (kubus voorlopig)
const droneGeo = new THREE.BoxGeometry(1, 0.3, 1);
const droneMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const drone = new THREE.Mesh(droneGeo, droneMat);
scene.add(drone);

loader.load('./drone/zala_421_16e2/scene.gltf', (gltf) => {
  droneModel = gltf.scene;
  droneModel.scale.set(2, 2, 2);
  droneModel.position.set(0, 0, 0);
  // GLTF model forward axis correction + 180deg flip.
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

// controls
const keys = {};

window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
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

  // Cloud drift
  for (const cloud of clouds) {
    cloud.position.x += 0.03;
    if (cloud.position.x > 500) {
      cloud.position.x = -500;
    }
  }

  // Move with analog joystick input from phone.
  const moveX = Math.abs(input.x || 0) > CONTROL_TUNING.moveDeadZone ? (input.x || 0) : 0;
  const moveY = Math.abs(input.y || 0) > CONTROL_TUNING.moveDeadZone ? (input.y || 0) : 0;

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

  drone.position.x += (forwardX * forwardInput + rightX * rightInput) * CONTROL_TUNING.moveSpeed;
  drone.position.z += (forwardZ * forwardInput + rightZ * rightInput) * CONTROL_TUNING.moveSpeed;

  if (input.up) drone.position.y += CONTROL_TUNING.verticalSpeed;
  if (input.down) drone.position.y -= CONTROL_TUNING.verticalSpeed;

  // Keep the drone above the ground surface.
  const groundHeight = terrainHeightAt(drone.position.x, drone.position.z);
  const minDroneHeight = groundHeight + 0.25;
  drone.position.y = Math.max(minDroneHeight, Math.min(10, drone.position.y));

  // Collision detection and prevention
  const dronePos = drone.position;
  let hasCollision = false;
  
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
  
  // Revert position if collision detected
  if (hasCollision) {
    drone.position.x = prevX;
    drone.position.y = prevY;
    drone.position.z = prevZ;
  }

  // Right joystick controls camera orbit around the drone.
  const lookX = Math.abs(input.rx || 0) > CONTROL_TUNING.lookDeadZone ? (input.rx || 0) : 0;
  const lookY = Math.abs(input.ry || 0) > CONTROL_TUNING.lookDeadZone ? (input.ry || 0) : 0;

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