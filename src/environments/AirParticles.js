import * as THREE from 'three';
import { OUTPUT, randomAttribute, shaderMaterial } from './glsl.js';

const WIND_VERT = /* glsl */`
attribute vec4 aSeed;
attribute float aEnd;
uniform vec3 uCam;
uniform float uScroll;
uniform float uStreakLen;
varying float vA;
void main() {
    const float R = 800.0;
    float depth = mod(aSeed.z * R + uScroll * (1.1 + aSeed.w * 0.9), R);
    float x = (aSeed.x - 0.5) * 520.0;
    x += (x < 0.0 ? -70.0 : 70.0);
    float y = (aSeed.y - 0.5) * 150.0 - 10.0;
    float len = (20.0 + aSeed.w * 90.0) * uStreakLen;
    vec3 p = vec3(uCam.x + x, uCam.y + y, uCam.z - R + depth - aEnd * len);
    float t = depth / R;
    vA = (1.0 - aEnd) * smoothstep(0.0, 0.15, t) *     (1.0 - smoothstep(0.65, 0.95, t));
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const WIND_FRAG = /* glsl */`
uniform vec3 uColor;
varying float vA;
void main() {
    gl_FragColor = vec4(uColor, vA * 0.2);
${OUTPUT}
}`;

// Poeira, folhas, neve e brasas: um único sistema de pontos cuja altura, queda e forma
// vêm dos pesos de bioma perto da câmera (uniforms atualizados pela CPU).
const MOTE_VERT = /* glsl */`
precision highp float;
attribute vec4 aSeed;
uniform vec3 uCam;
uniform float uScroll;
uniform float uGroundY;
uniform float uTime;
uniform float uPx;
uniform float uFogK;
uniform float uHeight;
uniform float uFall;
uniform float uSize;
varying float vA;
varying float vSpin;
void main() {
    const float R = 1800.0;
    float depth = mod(aSeed.z * R + uScroll * (0.9 + aSeed.w * 0.2), R);
    float x = (aSeed.x - 0.5) * 1600.0 + sin(uTime * 0.7 + aSeed.w * 30.0) * 12.0 * uFall * 10.0;
    float rise = aSeed.y * aSeed.y;
    float fall = 1.0 - fract(aSeed.y + uTime * uFall * (0.6 + aSeed.w));
    float hn = mix(rise, fall, step(0.001, uFall));
    float y = uGroundY + 3.0 + hn * uHeight + 5.0 * sin(uTime * 0.5 + aSeed.w * 20.0);
    vec4 mv = viewMatrix * vec4(x, y, uCam.z + 100.0 - R + depth, 1.0);
    float dist = -mv.z;
    float t = depth / R;
    float fog = 1.0 - exp(-pow(max(dist, 1.0) * uFogK, 1.5));
    vA = (0.1 + 0.14 * aSeed.w) * smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.9, 1.0, t))
       * smoothstep(140.0, 360.0, dist) * 0.7 * (1.0 - fog) * step(0.02, uSize);
    vSpin = aSeed.w * 6.2832 + uTime * (0.6 + aSeed.x);
    gl_PointSize = clamp((14.0 + 22.0 * aSeed.w) * uSize * uPx / max(dist, 1.0), 1.0, 22.0);
    gl_Position = projectionMatrix * mv;
}`;

const MOTE_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uLeaf;
varying float vA;
varying float vSpin;
void main() {
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vSpin), s = sin(vSpin);
    vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    // Folhas: elipse girando; demais: círculo suave.
    float d = mix(length(p), length(q * vec2(0.55, 1.8)), uLeaf);
    gl_FragColor = vec4(uColor, vA * smoothstep(0.5, 0.0, d) * mix(1.0, 3.0, uLeaf));
${OUTPUT}
}`;

export class AirParticles {
    constructor(shared, group, cam, { isMobile = false } = {}) {
        this.windColor = new THREE.Color();
        this.moteColor = new THREE.Color();

        const windCount = isMobile ? 50 : 110;
        const seeds = randomAttribute(windCount, 4);
        const pairs = new Float32Array(windCount * 8);
        const ends = new Float32Array(windCount * 2);
        for (let i = 0; i < windCount; i++) {
            pairs.set(seeds.subarray(i * 4, i * 4 + 4), i * 8);
            pairs.set(seeds.subarray(i * 4, i * 4 + 4), i * 8 + 4);
            ends[i * 2 + 1] = 1;
        }
        const wg = new THREE.BufferGeometry();
        wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(windCount * 6), 3));
        wg.setAttribute('aSeed', new THREE.BufferAttribute(pairs, 4));
        wg.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
        const wm = shaderMaterial(shared, WIND_VERT, WIND_FRAG, {
            uCam: { value: cam },
            uStreakLen: { value: 1 },
            uColor: { value: this.windColor }
        }, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        this.wind = new THREE.LineSegments(wg, wm);
        this.wind.frustumCulled = false;
        this.wind.renderOrder = 8;
        group.add(this.wind);

        const count = isMobile ? 90 : 190;
        const mg = new THREE.BufferGeometry();
        mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
        mg.setAttribute('aSeed', new THREE.BufferAttribute(randomAttribute(count, 4), 4));
        const mm = shaderMaterial(shared, MOTE_VERT, MOTE_FRAG, {
            uCam: { value: cam },
            uPx: { value: 800 },
            uHeight: { value: 28 },
            uFall: { value: 0 },
            uSize: { value: 1 },
            uLeaf: { value: 0 },
            uColor: { value: this.moteColor }
        }, { transparent: true, depthWrite: false });
        this.motes = new THREE.Points(mg, mm);
        this.motes.frustumCulled = false;
        this.motes.renderOrder = 6;
        group.add(this.motes);
    }

    setColors(c) {
        this.moteColor.copy(c.dust);
        this.windColor.copy(c.sun).lerp(c.haze, 0.3);
    }

    update({ streak, height, fall, size, leaf }) {
        this.wind.material.uniforms.uStreakLen.value = streak;
        const u = this.motes.material.uniforms;
        u.uHeight.value = height;
        u.uFall.value = fall;
        u.uSize.value = size;
        u.uLeaf.value = leaf;
        u.uPx.value = window.innerHeight * 0.9;
    }
}
