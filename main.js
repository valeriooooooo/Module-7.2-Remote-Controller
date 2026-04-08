const socket = new WebSocket('ws://localhost:8080');

socket.onopen = () => {
  socket.send(JSON.stringify({ type: 'laptop' }));
};

let input = { x: 0, y: 0, rx: 0, ry: 0, up: false, down: false };

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

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

// licht
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);

// vloer
const floorGeo = new THREE.PlaneGeometry(50, 50);
const floorMat = new THREE.MeshBasicMaterial({ color: 0x555555, side: THREE.DoubleSide });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = Math.PI / 2;
scene.add(floor);

// drone (kubus voorlopig)
const droneGeo = new THREE.BoxGeometry(1, 0.3, 1);
const droneMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const drone = new THREE.Mesh(droneGeo, droneMat);
scene.add(drone);

// startpositie
drone.position.y = 1;
camera.position.set(0, 3, 5);

// controls
const keys = {};

window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// movement settings
const speed = 0.1;
const verticalSpeed = 0.08;
const cameraDistance = 5;
const cameraHeightOffset = 2;
let cameraYaw = 0;
let cameraPitch = 0.35;

// animatie
function animate() {
  requestAnimationFrame(animate);

  // Move with analog joystick input from phone.
  const deadZone = 0.05;
  const moveX = Math.abs(input.x || 0) > deadZone ? (input.x || 0) : 0;
  const moveY = Math.abs(input.y || 0) > deadZone ? (input.y || 0) : 0;
  drone.position.x += moveX * speed;
  drone.position.z += moveY * speed;

  if (input.up) drone.position.y += verticalSpeed;
  if (input.down) drone.position.y -= verticalSpeed;
  drone.position.y = Math.max(0.6, Math.min(10, drone.position.y));

  // Right joystick controls camera orbit around the drone.
  const lookX = Math.abs(input.rx || 0) > deadZone ? (input.rx || 0) : 0;
  const lookY = Math.abs(input.ry || 0) > deadZone ? (input.ry || 0) : 0;

  cameraYaw -= lookX * 0.05;
  cameraPitch = Math.max(-0.6, Math.min(1.1, cameraPitch - lookY * 0.03));

  const cosPitch = Math.cos(cameraPitch);
  const sinPitch = Math.sin(cameraPitch);
  const offsetX = Math.sin(cameraYaw) * cosPitch * cameraDistance;
  const offsetZ = Math.cos(cameraYaw) * cosPitch * cameraDistance;
  const offsetY = sinPitch * cameraDistance + cameraHeightOffset;

  camera.position.x = drone.position.x + offsetX;
  camera.position.z = drone.position.z + offsetZ;
  camera.position.y = drone.position.y + offsetY;

  drone.rotation.y = cameraYaw;
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