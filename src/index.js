import * as THREE from '/modules/three.module.min.js';
import * as Blob from '/src/shaders/BlobShaders.js';
import * as Grass from '/src/shaders/GrassShaders.js';
import * as Skybox from '/src/shaders/SkyboxShaders.js';
import {PARAMS} from "/src/shaders/GrassShaders.js";

// Scene, Camera, and Renderer setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

camera.position.z = 2;

const skyGeometry = new THREE.SphereGeometry(500, 60, 40);
const skyMaterial = new THREE.ShaderMaterial({
    vertexShader: Skybox.vertexShader,
    fragmentShader: Skybox.fragmentShader,
    uniforms: {
        iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        timeOfDay: { value: 0.0 } // Initialize with a default time
    },
    side: THREE.BackSide // Render the inside of the sphere
});
const skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
scene.add(skyDome);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const startTime = Date.now();

// Variables for box dimensions
let boxWidth, boxHeight;
function updateBoxDimensions() {
    const aspect = window.innerWidth / window.innerHeight;
    const fovRadians = (camera.fov * Math.PI) / 180;

    boxHeight = 4 * Math.tan(fovRadians / 2);
    boxWidth = boxHeight * aspect;
}
updateBoxDimensions();
let geometry = new THREE.BoxGeometry(boxWidth, boxHeight, 0.1); // Placeholder, will be updated in updateBoxDimensions
const material = new THREE.ShaderMaterial({
    uniforms: {
        u_mouse: { value: new THREE.Vector2(0, 0) },
        u_time: { value: 0.0 },
        u_boxSize: { value: new THREE.Vector2(boxWidth, boxHeight) }
    },
    vertexShader: Blob.vertexShader,
    fragmentShader: Blob.fragmentShader
});

let boxMesh = new THREE.Mesh(geometry, material);
boxMesh.position.z = 0;
boxMesh.castShadow = true;
scene.add(boxMesh);

// ground plane
const grassNoise = new THREE.TextureLoader().load('./src/assets/grass.jpg');
grassNoise.wrapS = grassNoise.wrapT = THREE.RepeatWrapping;
const cloudShadow = new THREE.TextureLoader().load('./src/assets/cloud.jpg');
cloudShadow.wrapS = cloudShadow.wrapT = THREE.RepeatWrapping;

const grassUniforms = {
    grassNoise: {value: grassNoise},
    cloudShadow: {value: cloudShadow},
    iTime: { type: 'f', value: 0.0 },
    iPlaneSize: {type: 'f', value: PARAMS.PLANE_SIZE }
};

const grassMaterial = new THREE.ShaderMaterial({
    uniforms: grassUniforms,
    vertexShader: Grass.vertexShader,
    fragmentShader: Grass.fragmentShader,
    side: THREE.DoubleSide
});

const grassMesh = Grass.generateInstancedGrass(grassMaterial);
grassMesh.position.y -= 5;
grassMesh.castShadow = grassMesh.receiveShadow = true;
scene.add(grassMesh);


// lighting
{
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true; // Enable shadow casting for the light

    // Configure shadow settings
    directionalLight.shadow.mapSize.set(1024, 1024); // Set shadow map size for better quality
    directionalLight.shadow.camera.near = 0.5; // Near clipping plane
    directionalLight.shadow.camera.far = 50; // Far clipping plane
    directionalLight.shadow.bias = -0.01; // Adjust to reduce shadow acne

    scene.add(directionalLight); // Add the light to the scene
}

let debugSphere = new THREE.Mesh(
    new THREE.SphereGeometry(.01, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x0077ff })
);
scene.add(debugSphere);

function mapToMeshCoordinates(mouseX, mouseY, camera, boxMesh) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

    const intersects = raycaster.intersectObject(boxMesh);
    if (intersects.length > 0) {
        const intersectionPoint = new THREE.Vector3();
        intersectionPoint.copy(intersects[0].point);
        debugSphere.position.copy(intersectionPoint);

        const localPoint = boxMesh.worldToLocal(intersectionPoint);

        const normalizedX = 2 * localPoint.x / boxWidth;
        const normalizedY = 2 * localPoint.y / boxHeight;

        return new THREE.Vector2(normalizedX, normalizedY);
    }

    return new THREE.Vector2(0, 0);  // Default value if no intersection
}

// Mouse event listener
window.addEventListener('mousemove', (event) => {
    const mouseX = (event.clientX / window.innerWidth) * 2 - 1; // NDC X [-1, 1]
    const mouseY = -(event.clientY / window.innerHeight) * 2 + 1; // NDC Y [-1, 1]

    // Project mouse position onto the box mesh and get normalized coordinates
    const meshCoords = mapToMeshCoordinates(mouseX, mouseY, camera, boxMesh);

    // Update the shader's uniform with the correct mapped coordinates
    material.uniforms.u_mouse.value.set(meshCoords.x, meshCoords.y);
});

// Handle resizing
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    updateBoxDimensions();
    geometry.dispose();  // Dispose old geometry
    geometry = new THREE.BoxGeometry(boxWidth, boxHeight, 0.1);
    boxMesh.geometry = geometry;

    material.uniforms.u_boxSize.value.set(boxWidth, boxHeight);
});

// Animation loop
const DAY_NIGHT_TIME = 10;
function animate() {
    const elapsedTime = Date.now() - startTime;

    material.uniforms.u_time.value = elapsedTime;
    grassMaterial.uniforms.iTime.value = elapsedTime;
    skyMaterial.uniforms.timeOfDay.value = (elapsedTime % 10000) / 10000;
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// Camera control
document.addEventListener('keydown', (event) => {
const moveSpeed = 0.1;
const rotateSpeed = 0.02;

switch (event.key) {
    case 'w': camera.position.z -= moveSpeed; break;
    case 's': camera.position.z += moveSpeed; break;
    case 'a': camera.position.x -= moveSpeed; break;
    case 'd': camera.position.x += moveSpeed; break;
    case 'q': camera.position.y -= moveSpeed; break;
    case 'e': camera.position.y += moveSpeed; break;
    case 'ArrowUp': camera.rotation.x += rotateSpeed; break;
    case 'ArrowDown': camera.rotation.x -= rotateSpeed; break;
    case 'ArrowLeft': camera.rotation.y += rotateSpeed; break;
    case 'ArrowRight': camera.rotation.y -= rotateSpeed; break;
}
});

// Initialize dimensions and start animation
updateBoxDimensions();
animate();
