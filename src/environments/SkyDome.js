import * as THREE from 'three';
import { ATMOS, NOISE, OUTPUT, shaderMaterial } from './glsl.js';

const VERT = /* glsl */`
varying vec3 vDir;
void main() {
    vDir = position;
    vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
    gl_Position = p.xyww;
}`;

const FRAG = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform float uNight;
uniform vec2 uCloud;
${ATMOS}
${NOISE}
float fbm3(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { s += vnoise(p) * a; p = p * 2.07 + 11.3; a *= 0.5; }
    return s;
}
void main() {
    vec3 d = normalize(vDir);
    float hz = max(d.y, 0.0);
    float s = max(dot(d, uL), 0.0);
    vec3 col = mix(horizonColor(d.xz), uMid, smoothstep(0.0, 0.28, hz));
    col = mix(col, uZenith, smoothstep(0.12, 0.85, hz));
    col += uHaze * pow(max(dot(normalize(d.xz + 1e-4), normalize(uL.xz)), 0.0), 3.0) * exp(-hz * 7.0) * 0.5;
    col += uSun * (pow(s, 6.0) * 0.25 + pow(s, 48.0) * 0.8 + smoothstep(0.9990, 0.9996, s) * 3.0);

    float cover = 0.0;
    if (d.y > 0.01) {
        vec2 uv = d.xz / (d.y + 0.12);
        float t = uTime * 0.012;
        float n = fbm3(uv * 0.55 + vec2(3.0, -t));
        cover = smoothstep(uCloud.x, uCloud.y, n) * smoothstep(0.0, 0.12, d.y);
        float lit = 0.3 + 0.7 * pow(s, 2.0);
        vec3 cc = mix(uHorizon * 0.75, uSun, lit);
        cc = mix(cc, uMid, 0.25 * smoothstep(0.2, 0.7, d.y));
        col = mix(col, cc, cover * 0.85);
        // Camada fina e rápida: dá paralaxe entre as nuvens.
        float n2 = fbm3(vec2(uv.x * 0.22, uv.y * 1.5) + vec2(7.0, -t * 2.5));
        col += uHaze * smoothstep(0.55, 0.85, n2) * 0.25 * smoothstep(0.02, 0.25, d.y) * (1.0 - smoothstep(0.3, 0.7, d.y));

        // Estrelas procedurais, visíveis à noite e entre as nuvens.
        if (uNight > 0.01) {
            vec2 sp = vec2(atan(d.z, d.x) * 70.0, asin(clamp(d.y, 0.0, 1.0)) * 70.0);
            vec2 id = floor(sp);
            vec2 f = fract(sp) - 0.5;
            float star = step(0.975, hash21(id)) * smoothstep(0.35, 0.0, length(f));
            col += vec3(0.85, 0.9, 1.0) * star * uNight * smoothstep(0.05, 0.35, d.y) * (1.0 - cover);
        }
    }
    gl_FragColor = vec4(col, 1.0);
${OUTPUT}
}`;

export class SkyDome {
    constructor(shared, group, cloudUniform, nightUniform) {
        const material = shaderMaterial(shared, VERT, FRAG, {
            uCloud: { value: cloudUniform },
            uNight: nightUniform
        }, { side: THREE.BackSide, depthWrite: false });
        this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), material);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 100;
        group.add(this.mesh);
    }
}
