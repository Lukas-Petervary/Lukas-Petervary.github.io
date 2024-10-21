export const vertexShader = `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
    vUv = uv; // Pass UV coordinates to the fragment shader

    // Pass the world position to the fragment shader
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;

    // Standard vertex transformation
    gl_Position = projectionMatrix * viewMatrix * vec4(vPosition, 1.0);
}
`;

export const fragmentShader = `
uint manip(uint val) {
    const uint hC = 0x5bd1e995U;
    uint ret = val;
    ret *= hC;
    ret ^= ret >> 24;
    ret *= hC;
    return ret;
}

uint hash(uint x, uint seed) {
    uint hash = seed;
    hash ^= manip(x);

    hash ^= hash >> 13;
    hash ^= hash >> 15;
    return hash;
}

uint hash(uvec3 x, uint seed){
    uint hash = seed;

    hash ^= manip(x.x);
    hash ^= manip(x.y);
    hash ^= manip(x.z);

    hash ^= hash >> 13;
    hash ^= hash >> 15;
    return hash;
}


vec3 gradientDirection(uint hash) {
    int vHash = int(hash);
    float neg = ((vHash >> 3) & 1) == 1 ? 1. : -1.;
    return vec3( (vHash >> 2) & 1, (vHash >> 1) & 1, vHash & 1) * neg;
}

float interpolate(float value1, float value2, float value3, float value4, float value5, float value6, float value7, float value8, vec3 t) {
    return mix(
        mix(mix(value1, value2, t.x), mix(value3, value4, t.x), t.y),
        mix(mix(value5, value6, t.x), mix(value7, value8, t.x), t.y),
        t.z
    );
}

vec3 fade(vec3 t) {
    return t * t * t * (t * (t * 6. - 15.) + 10.);
}

float perlinNoise(vec3 position, uint seed) {
    vec3 floorPosition = floor(position);
    vec3 fractPosition = position - floorPosition;
    uvec3 cellCoordinates = uvec3(floorPosition);
    float value1 = dot(gradientDirection(hash(cellCoordinates, seed)), fractPosition);
    float value2 = dot(gradientDirection(hash((cellCoordinates + uvec3(1, 0, 0)), seed)), fractPosition - vec3(1, 0, 0));
    float value3 = dot(gradientDirection(hash((cellCoordinates + uvec3(0, 1, 0)), seed)), fractPosition - vec3(0, 1, 0));
    float value4 = dot(gradientDirection(hash((cellCoordinates + uvec3(1, 1, 0)), seed)), fractPosition - vec3(1, 1, 0));
    float value5 = dot(gradientDirection(hash((cellCoordinates + uvec3(0, 0, 1)), seed)), fractPosition - vec3(0, 0, 1));
    float value6 = dot(gradientDirection(hash((cellCoordinates + uvec3(1, 0, 1)), seed)), fractPosition - vec3(1, 0, 1));
    float value7 = dot(gradientDirection(hash((cellCoordinates + uvec3(0, 1, 1)), seed)), fractPosition - vec3(0, 1, 1));
    float value8 = dot(gradientDirection(hash((cellCoordinates + uvec3(1, 1, 1)), seed)), fractPosition - vec3(1, 1, 1));
    return interpolate(value1, value2, value3, value4, value5, value6, value7, value8, fade(fractPosition));
}

float perlinNoise(vec3 position, float frequency, int octaveCount, float persistence, float lacunarity, uint seed) {
    float value = 0.0;
    float amplitude = 1.0;
    float currentFrequency = float(frequency);
    uint currentSeed = seed;
    for (int i = 0; i < octaveCount; i++) {
        currentSeed = hash(currentSeed, 0x0U); // create a new seed for each octave
        value += perlinNoise(position * currentFrequency, currentSeed) * amplitude;
        amplitude *= persistence;
        currentFrequency *= lacunarity;
    }
    return value;
}

float rand(vec2 co){
    return fract(sin(dot(co, vec2(8.935, 79.169))) * 40811.576);
}

uniform vec2 u_mouse;
uniform float u_time;
uniform vec2 u_boxSize;

varying vec2 vUv;
varying vec3 vPosition;

void main() {
    vec2 position = vPosition.xy / u_boxSize * 2.0;
    uint seed = 0x578437adU;
    float value = perlinNoise(vec3(vUv, u_time / 10000.), 0.75, 4, 1.0, 1.2, seed);
    
    float repulsionStrength = 0.3;
    float influenceRadius = 0.5;
    float repulsionEffect = smoothstep(influenceRadius, 0.0, distance(position, u_mouse)) * repulsionStrength;

    // Apply the repulsion effect to the noise value
    if (value < 0.) value = min(0., value + repulsionEffect);
    else value = max(0., value - repulsionEffect);

    float mult = abs(value) - .25;
    vec3 color = value < -0.25 ? vec3(1., 0., 1.) : value > 0.25 ? vec3(0., 1., 1.) : vec3(0.);
    color *= mult * 1.5;
    gl_FragColor = vec4(color, 1.);
}
`;