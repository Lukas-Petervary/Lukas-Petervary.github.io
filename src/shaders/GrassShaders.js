import * as THREE from '/modules/three.module.min.js';

export const vertexShader = `
varying vec3 vWorldPosition;
varying vec2 vUV;

uniform sampler2D windNoise;
uniform float iTime;
uniform float iPlaneSize;

vec3 sphericalTransform(float m, float d, float h) {
    float sinmy = sin( m * h );
    float cosmy = cos( m * h );
    float sind = sin( d );
    float cosd = cos( d );
    
    return vec3(sinmy * cosd, cosmy, sinmy * sind) * h;
}

void main() {
    vec4 worldPosition = instanceMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vUV = (worldPosition.xz + iPlaneSize * 0.5) / iPlaneSize;
    
    vec3 noise = texture2D(windNoise, vUV / 4.0 + vec2(iTime / 70000.0)).rgb;
    float mag = 1.0 - noise.r * 2.0;
    float dir = noise.b * 3.14159265359;
    
    vec3 offset = sphericalTransform(1.73 - mag, 1.1 * dir, position.y);
    worldPosition.xyz += offset;
    
    vec4 mvPosition = modelViewMatrix * worldPosition;
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const fragmentShader = `
varying vec3 vWorldPosition;
varying vec2 vUV;

uniform float iTime;
uniform sampler2D grassNoise;
uniform sampler2D cloudShadow;

void main() {
    vec3 color = 1.5 * texture2D(grassNoise, vUV).rgb - vec3(0.5);
    color = mix(color, texture2D(cloudShadow, vUV + vec2(iTime / 15000.0)).rgb, 0.4);
    gl_FragColor = vec4(color, 1.0);
}
`;

export const PARAMS = {
    PLANE_SIZE: 30,
    BLADE_COUNT: (2<<17) - 1,
    BLADE_WIDTH: 0.3,
    BLADE_HEIGHT: 1.0,
    BLADE_HEIGHT_VARIATION: 0.8
};

export function generateInstancedGrass(material) {
    const bladeGeometry = new THREE.BufferGeometry();

    const positions = new Float32Array([
        -PARAMS.BLADE_WIDTH / 2, 0, 0,
        PARAMS.BLADE_WIDTH / 2, 0, 0,
        0, 1, 0
    ]);
    const uvs = new Float32Array([
        0, 0,
        1, 0,
        0.5, 1
    ]);

    bladeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    bladeGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    bladeGeometry.computeVertexNormals();

    const instancedMesh = new THREE.InstancedMesh(bladeGeometry, material, PARAMS.BLADE_COUNT);

    const dummy = new THREE.Object3D();
    for (let i = 0; i < PARAMS.BLADE_COUNT; ++i) {
        const r = PARAMS.PLANE_SIZE * Math.sqrt(Math.random()) / 2;
        const theta = Math.random() * 2 * Math.PI;
        const x = r * Math.cos(theta);
        const z = r * Math.sin(theta);

        const scaleVariation = 2 * (Math.random() - 0.5) * PARAMS.BLADE_HEIGHT_VARIATION;
        dummy.scale.set(1, 1 + scaleVariation, 1);

        // update instanceMatrix with position & rotation
        dummy.position.set(x, 0, z);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
    }

    return instancedMesh;
}