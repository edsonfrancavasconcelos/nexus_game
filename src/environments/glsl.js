import * as THREE from 'three';

// Trechos GLSL compartilhados por céu, terreno, props e partículas.

export const NOISE = /* glsl */`
float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
               mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float ridged(vec2 p) {
    float s = 0.0, a = 0.55;
    for (int i = 0; i < 4; i++) {
        float n = 1.0 - abs(2.0 * vnoise(p) - 1.0);
        s += n * n * a;
        p = p * 2.03 + vec2(17.1, 9.2);
        a *= 0.5;
    }
    return s;
}
// Relevo suave; q = (x, coordenada de chão). Compartilhado por terreno e props para pousarem no solo.
float h0(vec2 q) {
    return 5.0 * sin(q.x * 0.0023 + sin(q.y * 0.0011) * 2.0)
         + 4.0 * sin(q.y * 0.0031 + q.x * 0.0017)
         + 2.0 * sin(q.x * 0.011 + q.y * 0.007);
}`;

// Linha do tempo de biomas ao longo da coordenada de chão g (= z - scroll).
// Até 4 segmentos; cada fronteira mistura os biomas numa faixa de largura 2*uBW,
// então tudo (terreno, props, partículas) muda gradualmente e sem "pop".
export const BIOME = /* glsl */`
uniform vec4 uBIdx;
uniform vec3 uBB;
uniform vec4 uBNy;
uniform vec3 uShift;
uniform float uBW;
float nyAt(float g) {
    float v = uBNy.x;
    v = mix(v, uBNy.y, 1.0 - smoothstep(uBB.x - uBW, uBB.x + uBW, g));
    v = mix(v, uBNy.z, 1.0 - smoothstep(uBB.y - uBW, uBB.y + uBW, g));
    v = mix(v, uBNy.w, 1.0 - smoothstep(uBB.z - uBW, uBB.z + uBW, g));
    return v;
}
vec4 oneHot(float i) {
    return vec4(step(abs(i), 0.5), step(abs(i - 1.0), 0.5), step(abs(i - 2.0), 0.5), step(abs(i - 3.0), 0.5));
}
vec4 biomeAt(float g) {
    vec4 w = oneHot(uBIdx.x);
    w = mix(w, oneHot(uBIdx.y), 1.0 - smoothstep(uBB.x - uBW, uBB.x + uBW, g));
    w = mix(w, oneHot(uBIdx.z), 1.0 - smoothstep(uBB.y - uBW, uBB.y + uBW, g));
    w = mix(w, oneHot(uBIdx.w), 1.0 - smoothstep(uBB.z - uBW, uBB.z + uBW, g));
    return w;
}
// Amplitude do relevo por bioma: planície, floresta, cidade, extremo.
const vec4 AMP = vec4(1.0, 2.4, 0.06, 1.6);
float baseH(vec2 q, vec4 w) { return h0(q) * dot(w, AMP); }`;

export const ATMOS = /* glsl */`
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uSun;
uniform vec3 uHaze;
uniform vec3 uL;
uniform float uTime;
vec3 horizonColor(vec2 dxz) {
    float sh = pow(max(dot(normalize(dxz + 1e-4), normalize(uL.xz)), 0.0), 3.0);
    return uHorizon + uHaze * sh * 0.8;
}`;

export const LIGHTING = /* glsl */`
uniform vec3 uCamPos;
uniform vec3 uSunCol;
uniform vec3 uAmb;
uniform float uFogK;
uniform float uGroundFog;
uniform float uGroundY;
vec3 skyReflect(vec3 R) {
    vec3 c = mix(horizonColor(R.xz), uMid, clamp(R.y * 2.5, 0.0, 1.0));
    c = mix(c, uZenith, clamp(R.y * 1.2 - 0.4, 0.0, 1.0));
    return c + uSun * pow(max(dot(R, uL), 0.0), 40.0) * 1.5;
}
// Neblina de distância + neblina baixa (acumula perto do chão, sobretudo na floresta).
vec3 applyFog(vec3 col, vec3 wp) {
    vec3 V = wp - uCamPos;
    float dist = length(V);
    float f = 1.0 - exp(-pow(dist * uFogK, 1.5));
    f = max(f, smoothstep(9500.0, 13500.0, dist));
    float hf = exp(-max(wp.y - uGroundY, 0.0) * 0.011) * uGroundFog * (1.0 - exp(-dist * 0.0016));
    f = clamp(f + hf * 0.85, 0.0, 1.0);
    return mix(col, horizonColor(V.xz), f);
}`;

export const OUTPUT = /* glsl */`
#include <tonemapping_fragment>
#include <colorspace_fragment>`;

export function shaderMaterial(shared, vertexShader, fragmentShader, uniforms = {}, extra = {}) {
    return new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { ...shared, ...uniforms },
        ...extra
    });
}

export function randomAttribute(count, size) {
    const data = new Float32Array(count * size);
    for (let i = 0; i < data.length; i++) data[i] = Math.random();
    return data;
}
