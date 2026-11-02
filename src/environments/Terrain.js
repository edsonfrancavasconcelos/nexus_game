import * as THREE from 'three';
import { ATMOS, BIOME, LIGHTING, NOISE, OUTPUT, shaderMaterial } from './glsl.js';

// Um único mesh de terreno cujo relevo e superfície mudam por bioma (mistura contínua em g = z - scroll).

const VERT = /* glsl */`
precision highp float;
uniform float uScroll;
uniform float uOriginZ;
uniform float uGroundY;
uniform float uMtnH;
uniform vec2 uCamXZ;
varying vec3 vWP;
varying vec2 vQ;
varying vec3 vN;
varying float vM;
varying vec4 vW;
varying float vNy;
${NOISE}
${BIOME}
float mountains(vec2 w, float dist, vec4 B) {
    vec2 q = vec2(w.x, w.y - uScroll);
    vec2 qf = vec2(w.x, w.y - uScroll * 0.08);
    float sideA = dot(B, vec4(750.0, 900.0, 2600.0, 450.0));
    float sideB = dot(B, vec4(2200.0, 2300.0, 4200.0, 1100.0));
    float nearAmp = dot(B, vec4(1.0, 0.5, 0.0, 2.2));
    float farAmp = dot(B, vec4(1.8, 1.2, 0.45, 2.2));
    float side = smoothstep(sideA, sideB, abs(w.x));
    float nearM = smoothstep(300.0, 1400.0, dist);
    float far = smoothstep(4500.0, 8000.0, dist);
    float n = ridged(q * 0.00052);
    float terr = floor(n * 7.0) / 7.0 + smoothstep(0.0, 0.35, fract(n * 7.0)) / 7.0;
    n = mix(n, terr, B.w * 0.7);
    return (n * side * nearM * nearAmp + ridged(qf * 0.00032 + vec2(31.7, 4.1)) * far * farAmp) * uMtnH;
}
float heightAt(vec2 w, float dist) {
    vec4 B = biomeAt(w.y - uScroll);
    return baseH(vec2(w.x, w.y - uScroll), B) + mountains(w, dist, B);
}
void main() {
    vec2 w = vec2(position.x, position.z + uOriginZ);
    float dist = length(w - uCamXZ);
    float e = 12.0 + dist * 0.02;
    vec4 B = biomeAt(w.y - uScroll);
    float m = mountains(w, dist, B);
    float h = baseH(vec2(w.x, w.y - uScroll), B) + m;
    vN = normalize(vec3(
        heightAt(w - vec2(e, 0.0), dist) - heightAt(w + vec2(e, 0.0), dist),
        2.0 * e,
        heightAt(w - vec2(0.0, e), dist) - heightAt(w + vec2(0.0, e), dist)));
    vM = m / uMtnH;
    vQ = vec2(w.x, w.y - uScroll);
    vW = B;
    vNy = nyAt(vQ.y);
    vWP = vec3(w.x, uGroundY + h, w.y);
    gl_Position = projectionMatrix * viewMatrix * vec4(vWP - uShift, 1.0);
}`;

const FRAG = /* glsl */`
precision highp float;
uniform vec3 uFieldA;
uniform vec3 uFieldB;
uniform vec3 uFieldC;
uniform vec3 uRock;
uniform vec3 uGlow;
uniform float uSnow;
uniform float uLava;
varying vec3 vWP;
varying vec2 vQ;
varying vec3 vN;
varying float vM;
varying vec4 vW;
varying float vNy;
${ATMOS}
${NOISE}
${LIGHTING}
void main() {
    vec3 V = vWP - uCamPos;
    vec3 vd = normalize(V);
    vec4 W = vW;
    float fp = length(fwidth(vQ));
    float far = smoothstep(0.5, 3.0, fp);
    float grain = vnoise(vQ * 0.08) * 0.5 + vnoise(vQ * 0.9) * 0.5 * (1.0 - far);

    vec3 base = vec3(0.0);
    vec3 emissive = vec3(0.0);
    float gloss = 0.0;

    // Planície: campos, fileiras de cultivo, círculos de irrigação e linhas de energia.
    if (W.x > 0.01) {
        const float CS = 420.0;
        vec2 cq = (vQ + vec2(CS * 0.5, 0.0)) / CS;
        vec2 id = floor(cq);
        vec2 f = fract(cq);
        float r = hash21(id);
        float r2 = hash21(id + 17.3);
        vec3 b = r < 0.34 ? uFieldA : (r < 0.67 ? uFieldB : uFieldC);
        b *= 0.8 + 0.4 * r2;
        float ang = r2 * 6.2832;
        float rows = 0.5 + 0.5 * sin(dot(vQ, vec2(cos(ang), sin(ang))) * 0.35);
        b *= 1.0 + (rows - 0.5) * 0.5 * (1.0 - smoothstep(1.2, 4.0, fp));
        vec3 em = vec3(0.0);
        if (r > 0.62) {
            vec2 c = f - 0.5;
            float d = length(c);
            float pw = fwidth(d) + 0.002;
            float disc = 1.0 - smoothstep(0.40 - pw, 0.40 + pw, d);
            float ring = smoothstep(0.40 - pw * 2.0, 0.40, d) * (1.0 - smoothstep(0.40, 0.40 + pw * 2.0, d));
            b = mix(b, b.gbr * 0.9 + b * 0.3, disc);
            float sweep = pow(max(cos(atan(c.y, c.x) - uTime * 0.6), 0.0), 40.0) * disc * (1.0 - far);
            em += uGlow * (ring * 0.25 + sweep * 0.25);
        }
        float ed = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
        float fpc = fp / CS;
        float line = (1.0 - smoothstep(0.0, 0.012 + fpc * 1.5, ed)) * (0.012 / (0.012 + fpc * 1.5));
        float pulse = 0.5 + 0.5 * sin(vQ.y * 0.02 + uTime * 2.5);
        em += uGlow * line * (0.35 + 0.65 * pulse) * 0.9;
        base += b * (0.85 + 0.3 * grain) * W.x;
        emissive += em * W.x;
    }

    // Floresta: musgo, clareiras e solo escuro sob as copas.
    if (W.y > 0.01) {
        float m1 = vnoise(vQ * 0.004);
        float m2 = vnoise(vQ * 0.02 + 5.0);
        vec3 b = mix(uFieldA, uFieldB, m1);
        b = mix(b, uFieldC, smoothstep(0.55, 0.8, m2) * 0.6);
        b *= 0.55 + 0.5 * grain;
        base += b * W.y;
    }

    // Cidade: avenida central, malha de ruas, asfalto molhado, faixas luminosas e tráfego.
    if (W.z > 0.01) {
        float ny = vNy;
        vec2 S2 = mix(vec2(220.0), vec2(168.0, 128.0), ny);
        vec2 cq = vQ / S2;
        vec2 fr = fract(cq);
        float pw = fp / S2.x + 0.002;
        float dx = min(fr.x, 1.0 - fr.x);
        float dy = min(fr.y, 1.0 - fr.y);
        float roadX = 1.0 - smoothstep(0.1, 0.1 + pw, dx);
        float roadY = 1.0 - smoothstep(0.1, 0.1 + pw * 1.3, dy);
        float avenue = 1.0 - smoothstep(215.0, 235.0, abs(vQ.x));
        float road = max(max(roadX, roadY), avenue);
        vec3 asphalt = uRock * mix(0.45, 0.3, ny) * (0.8 + 0.4 * grain);
        vec3 lot = mix(uFieldA, uFieldB, hash21(floor(cq))) * mix(0.55, 0.7, ny) * (0.8 + 0.3 * grain);
        vec3 b = mix(lot, asphalt, road);
        vec3 em = vec3(0.0);
        float edgeX = (1.0 - smoothstep(0.0, 0.012 + pw, abs(dx - 0.1))) * roadX * (1.0 - avenue);
        float edgeY = (1.0 - smoothstep(0.0, 0.012 + pw, abs(dy - 0.1))) * roadY * (1.0 - avenue);
        float edgeA = (1.0 - smoothstep(0.0, 1.2 + fp, abs(abs(vQ.x) - 212.0))) * (1.0 - far);
        em += uGlow * (edgeX + edgeY + edgeA) * 0.55 * (0.7 + 0.3 * sin(vQ.y * 0.02 + uTime * 2.0));
        float lane = step(abs(vQ.x), 205.0) * (1.0 - far);
        float pk = fract(vQ.y / 70.0 + sign(vQ.x) * uTime * 0.35);
        float car = smoothstep(0.0, 0.06, pk) * (1.0 - smoothstep(0.1, 0.16, pk));
        float laneX = max(smoothstep(60.0, 30.0, abs(abs(vQ.x) - 110.0)), 0.0);
        // Nova York: táxis amarelos misturados ao tráfego da avenida.
        vec3 headC = mix(vec3(1.0, 0.92, 0.75), vec3(1.0, 0.15, 0.1), step(0.0, vQ.x));
        vec3 taxi = vec3(1.0, 0.72, 0.08);
        headC = mix(headC, taxi, ny * step(0.45, hash21(vec2(floor(vQ.y / 70.0), sign(vQ.x)))));
        em += headC * car * laneX * lane * 0.9;
        // Faixas de pedestres nos cruzamentos.
        float zebra = step(0.5, fract(vQ.x / 6.0)) * roadX * (1.0 - smoothstep(0.1, 0.16, dy)) * (1.0 - far) * (1.0 - avenue) * ny;
        b = mix(b, vec3(0.75), zebra * 0.4);
        base += b * W.z;
        emissive += em * W.z;
        gloss += road * W.z * (1.0 + ny * 1.5);
    }

    // Região extrema: estratos, neve acima da linha de neve e veios de lava nas zonas planas.
    float lavaE = 0.0;
    if (W.w > 0.01) {
        float hy = vWP.y - uGroundY;
        float strata = 0.5 + 0.5 * sin(hy * 0.09 + vnoise(vQ * 0.004) * 4.0);
        vec3 b = mix(uRock, uFieldC, strata * 0.45) * (0.7 + 0.5 * grain);
        float sn = smoothstep(uSnow, uSnow + 70.0, hy + (vnoise(vQ * 0.02) - 0.5) * 80.0) * smoothstep(0.55, 0.85, vN.y);
        b = mix(b, uFieldA, sn);
        float flatness = 1.0 - smoothstep(0.05, 0.35, 1.0 - vN.y);
        float vein = pow(1.0 - abs(2.0 * vnoise(vQ * 0.006 + vnoise(vQ * 0.02) * 2.0) - 1.0), 14.0);
        lavaE = vein * flatness * uLava * (1.0 - sn);
        base += b * W.w;
        emissive += uGlow * lavaE * (0.8 + 0.5 * sin(uTime * 1.5 + vQ.y * 0.01)) * 2.2 * W.w;
        gloss += sn * 0.4 * W.w;
    }

    vec3 N = vN;
    N.xz += (vec2(vnoise(vQ * 0.25), vnoise(vQ * 0.25 + 7.3)) - 0.5) * 0.35 * (1.0 - far) * (1.0 - W.z);
    N = normalize(N);

    float slope = 1.0 - N.y;
    float rockMix = clamp(smoothstep(0.12, 0.4, slope) + smoothstep(0.03, 0.25, vM), 0.0, 1.0) * (1.0 - W.z) * (1.0 - W.w * 0.6);
    vec3 rock = uRock * (0.7 + 0.5 * vnoise(vWP.xz * 0.01 + vWP.y * 0.02)) * (0.9 + 0.1 * sin(vWP.y * 0.15));
    base = mix(base, rock, rockMix);
    emissive *= 1.0 - rockMix;

    float diff = max(dot(N, uL), 0.0);
    // Sombra falsa de nuvens deslizando sobre o chão.
    float cs = vnoise(vQ * 0.0007 + vec2(uTime * 0.004, 0.0)) * 0.65 + vnoise(vQ * 0.002) * 0.35;
    float shadow = 1.0 - 0.45 * smoothstep(0.5, 0.72, cs);
    vec3 amb = uAmb * (0.55 + 0.45 * N.y);
    vec3 col = base * (amb + uSunCol * diff * shadow);
    col += uSun * pow(max(dot(reflect(vd, N), uL), 0.0), 24.0) * 0.15 * (1.0 - rockMix) * shadow;

    // Reflexo Fresnel do céu em superfícies molhadas / geladas.
    float fres = pow(1.0 - max(dot(-vd, N), 0.0), 4.0);
    col += skyReflect(reflect(vd, N)) * gloss * (0.05 + 0.6 * fres);
    col += emissive;

    gl_FragColor = vec4(applyFog(col, vWP), 1.0);
${OUTPUT}
}`;

export class Terrain {
    constructor(shared, group, colors, { isMobile = false, far = 30000 } = {}) {
        const cols = isMobile ? 96 : 128;
        const rows = isMobile ? 80 : 110;
        const halfWidth = 9500;
        const nearZ = 400;
        const depth = Math.min(15900, far * 0.78);
        const positions = new Float32Array((cols + 1) * (rows + 1) * 3);
        let p = 0;
        for (let r = 0; r <= rows; r++) {
            const z = nearZ - depth * Math.pow(r / rows, 2.2);
            for (let c = 0; c <= cols; c++) {
                const u = (c / cols) * 2 - 1;
                positions[p++] = Math.sign(u) * Math.pow(Math.abs(u), 2) * halfWidth;
                positions[p++] = 0;
                positions[p++] = z;
            }
        }
        const indices = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const a = r * (cols + 1) + c;
                const b = a + cols + 1;
                indices.push(a, a + 1, b, b, a + 1, b + 1);
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(indices);

        this.material = shaderMaterial(shared, VERT, FRAG, {
            uOriginZ: { value: 0 },
            uMtnH: { value: 900 },
            uFieldA: { value: colors.fieldA },
            uFieldB: { value: colors.fieldB },
            uFieldC: { value: colors.fieldC },
            uRock: { value: colors.rock }
        });
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -10;
        group.add(this.mesh);
    }

    update(camZ) {
        this.material.uniforms.uOriginZ.value = camZ;
    }
}

