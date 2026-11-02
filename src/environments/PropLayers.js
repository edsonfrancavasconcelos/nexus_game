import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ATMOS, BIOME, LIGHTING, NOISE, OUTPUT, randomAttribute, shaderMaterial } from './glsl.js';
import { markBloom } from '../BloomPipeline.js';

// Todas as camadas são InstancedMesh movidos só por uniforms. Cada instância pertence a uma
// posição fixa do chão (g = z - scroll) e só aparece se o bioma naquele ponto permitir, com
// fade por dither: objetos nascem longe, na névoa, e a densidade sobe com a mistura de biomas.

const PROP_VERT = /* glsl */`
precision highp float;
attribute vec4 aData;
attribute float aTrunk;
uniform float uScroll;
uniform float uRange;
uniform float uFarZ;
uniform float uGroundY;
uniform float uLane;
uniform float uSpread;
uniform vec2 uSizeRange;
uniform float uYScale;
uniform float uLift;
uniform vec4 uMask;
uniform float uDensity;
uniform float uYaw;
varying vec3 vWP;
varying float vH;
varying float vLocalY;
varying float vFade;
varying float vTrunk;
${NOISE}
${BIOME}
void main() {
    float a = aData.y * uRange + uScroll;
    float depth = mod(a, uRange);
    float cyc = floor(a / uRange);
    float t = depth / uRange;
    float wz = uFarZ + depth;
    float rx = hash21(vec2(aData.w * 57.3, cyc));
    float wx = (aData.x < 0.5 ? -1.0 : 1.0) * (uLane + rx * uSpread);
    float rr = hash21(vec2(aData.w * 31.1 + 9.0, cyc));
    vec4 B = biomeAt(wz - uScroll);
    float pres = dot(B, uMask) * uDensity;
    float fade = clamp((pres - rr) * 8.0, 0.0, 1.0) * smoothstep(0.0, 0.14, t) * (1.0 - smoothstep(0.9, 1.0, t));
    float sc = mix(uSizeRange.x, uSizeRange.y, hash21(vec2(aData.w * 13.7 + 3.0, cyc))) * aData.z;
    float yaw = hash21(vec2(cyc, aData.w * 91.0)) * 6.2832 * uYaw;
    float c = cos(yaw), s = sin(yaw);
    vec3 lp = position;
    lp.xz = mat2(c, -s, s, c) * lp.xz;
    lp.y *= uYScale;
    lp *= sc * step(0.001, fade);
    float g = uGroundY + baseH(vec2(wx, wz - uScroll), B);
    vWP = vec3(wx, g + sc * uYScale * uLift, wz) + lp;
    vH = hash21(vec2(aData.w * 7.1, cyc + 5.0));
    vLocalY = position.y;
    vFade = fade;
    vTrunk = aTrunk;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWP - uShift, 1.0);
}`;

const PROP_FRAG = /* glsl */`
precision highp float;
uniform vec3 uColor;
uniform vec3 uGlow;
uniform vec3 uTrunkCol;
uniform float uEmit;
uniform float uLeaf;
varying vec3 vWP;
varying float vH;
varying float vLocalY;
varying float vFade;
varying float vTrunk;
${ATMOS}
${NOISE}
${LIGHTING}
void main() {
    if (hash21(gl_FragCoord.xy) > vFade) discard;
    vec3 N = normalize(cross(dFdx(vWP), dFdy(vWP)));
    vec3 vd = normalize(vWP - uCamPos);
    vec3 base = mix(uColor * (0.75 + 0.5 * vH), uTrunkCol, vTrunk);
    float diff = max(dot(N, uL), 0.0);
    // Contraluz translúcido nas copas e oclusão por altura.
    float back = pow(max(dot(vd, uL), 0.0), 3.0) * (1.0 - vTrunk) * uLeaf;
    float ao = mix(1.0, 0.45 + 0.55 * smoothstep(-0.2, 0.9, vLocalY), uLeaf);
    vec3 col = base * (uAmb * (0.6 + 0.4 * N.y) * ao + uSunCol * (diff + back * 0.6) * ao);
    if (uEmit > 0.0) {
        float tip = smoothstep(-0.2, 1.0, vLocalY);
        col += uGlow * uEmit * tip * (0.7 + 0.3 * sin(uTime * 2.0 + vH * 6.2832));
    }
    gl_FragColor = vec4(applyFog(col, vWP), 1.0);
${OUTPUT}
}`;

// Prédios alinhados à malha de ruas do terreno (S = 220): coluna e linha fixas no chão.
const BUILD_VERT = /* glsl */`
precision highp float;
attribute vec4 aData;
attribute float aTier;
uniform float uScroll;
uniform float uFarZ;
uniform float uGroundY;
uniform float uCol0;
uniform float uCols;
uniform float uRows;
uniform float uHScale;
uniform float uDensity;
varying vec3 vWP;
varying vec3 vLP;
varying vec3 vSize;
varying vec3 vNrm;
varying float vFade;
varying float vId;
varying float vW;
varying float vNy;
${NOISE}
${BIOME}
void main() {
    const float S = 220.0;
    float k = aData.w;
    float col = mod(k, uCols * 2.0);
    float slot = floor(k / (uCols * 2.0));
    float side = col < uCols ? -1.0 : 1.0;
    float ci = mod(col, uCols);
    float jmin = ceil((uFarZ - uScroll) / S - 0.5);
    float j = jmin + mod(slot - jmin, uRows);
    float g = (j + 0.5) * S;
    float wz = g + uScroll;
    float wx = side * (uCol0 + ci * S);
    vec4 B = biomeAt(g);
    float ny = nyAt(g);
    float rh = hash21(vec2(j * 1.7, k * 3.1));
    float rr = hash21(vec2(k * 5.3, j * 0.7 + 4.0));
    float t = (wz - uFarZ) / (uRows * S);
    float city = B.z;
    float pres = (B.z + B.y * 0.07 + B.x * 0.03) * uDensity;
    float fade = clamp((pres - rr) * 8.0, 0.0, 1.0) * smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.93, 1.0, t));
    // Casas baixas surgem primeiro; arranha-céus só no coração da cidade.
    float hf = 0.14 + 0.86 * smoothstep(0.35, 0.95, city);
    float hgt = (30.0 + 430.0 * pow(rh, mix(2.3, 1.7, ny))) * hf * uHScale * mix(1.0, 1.3, ny);
    // Perto das pontes os prédios ficam abaixo do tabuleiro, deixando a passagem livre.
    float bk = abs(mod(g + 1600.0, 3200.0) - 1600.0);
    hgt = mix(hgt, min(hgt, 140.0), step(0.75, B.z * ny) * step(bk, 170.0) * step(uCol0, 1000.0));
    float w = (96.0 + 56.0 * hash21(vec2(k, j))) * mix(0.55, 1.0, hf);
    float d = (96.0 + 56.0 * hash21(vec2(j, k + 2.0))) * mix(0.55, 1.0, hf);
    vec3 size = vec3(w, hgt, d) * step(0.001, fade);
    float gy = uGroundY + baseH(vec2(wx, g), B) - 4.0;
    vec3 lp = position;
    lp.y += 0.5;
    // Nova York: recuos escalonados (Art Déco) com agulha no topo; fora dela os blocos se fundem numa caixa.
    float shrink = 1.0 - 0.2 * step(0.5, aTier) - 0.22 * step(1.5, aTier) - 0.42 * step(2.5, aTier);
    lp.xz *= mix(1.0, shrink, ny);
    vLP = lp;
    vSize = size;
    vNrm = normal;
    vWP = vec3(wx, gy, wz) + lp * size;
    vFade = fade;
    vId = hash21(vec2(k * 0.37, j * 0.91));
    vW = city;
    vNy = ny;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWP - uShift, 1.0);
}`;

const BUILD_FRAG = /* glsl */`
precision highp float;
uniform vec3 uRock;
uniform vec3 uGlow;
uniform float uWinE;
varying vec3 vWP;
varying vec3 vLP;
varying vec3 vSize;
varying vec3 vNrm;
varying float vFade;
varying float vId;
varying float vW;
varying float vNy;
${ATMOS}
${NOISE}
${LIGHTING}
void main() {
    if (hash21(gl_FragCoord.xy) > vFade) discard;
    vec3 N = normalize(vNrm);
    vec3 vd = normalize(vWP - uCamPos);
    float fres = pow(1.0 - max(dot(-vd, N), 0.0), 3.0);
    vec3 base = mix(uRock * 0.9, uMid * 0.5, 0.35) * (0.7 + 0.5 * vId);
    // Fachadas de pedra/tijolo misturadas ao vidro nos prédios de Nova York.
    vec3 stone = vec3(0.46, 0.33, 0.27) * (0.7 + 0.5 * vId);
    base = mix(base, stone, vNy * step(0.55, vId) * 0.8);
    float diff = max(dot(N, uL), 0.0);
    vec3 col = base * (uAmb * (0.5 + 0.5 * N.y) + uSunCol * diff);
    float side = 1.0 - step(0.5, abs(N.y));
    if (side > 0.5) {
        // Janelas em grade; somem com a distância para evitar moiré.
        float u = abs(N.x) > 0.5 ? vLP.z * vSize.z : vLP.x * vSize.x;
        vec2 wq = vec2(u / 5.5, vLP.y * vSize.y / 7.5);
        vec2 fw = fwidth(wq);
        float aa = 1.0 - smoothstep(0.35, 0.9, max(fw.x, fw.y));
        vec2 cid = floor(wq);
        vec2 f = fract(wq);
        float inside = step(0.18, f.x) * step(f.x, 0.82) * step(0.22, f.y) * step(f.y, 0.78);
        float lit = step(0.42 - 0.1 * vNy, hash21(cid + vId * 91.0));
        float flick = 0.85 + 0.15 * sin(uTime * 1.3 + hash21(cid) * 40.0);
        vec3 wc = mix(vec3(1.0, 0.78, 0.45), uGlow, step(0.7, hash21(cid + 3.0)));
        col += wc * inside * lit * flick * uWinE * aa * 1.4;
        col = mix(col, col * 0.55, inside * (1.0 - lit) * aa);
        col += skyReflect(reflect(vd, N)) * (0.08 + 0.55 * fres) * (1.0 + 0.7 * vNy);
        // Faixa luminosa no topo.
        col += uGlow * smoothstep(0.985, 1.0, vLP.y) * 1.5 * vW;
    } else {
        col += skyReflect(reflect(vd, N)) * 0.06;
        // Luz de aviso vermelha pulsando no topo da agulha.
        float spire = step(0.99, vLP.y) * step(0.5, N.y) * vNy;
        col += vec3(1.0, 0.1, 0.05) * spire * (0.6 + 0.4 * sin(uTime * 2.0 + vId * 20.0)) * 2.0;
    }
    gl_FragColor = vec4(applyFog(col, vWP), 1.0);
${OUTPUT}
}`;

// Pontes suspensas de Nova York: uma a cada 3200 unidades de chão, crescendo do solo quando a cidade se firma.
const BRIDGE_VERT = /* glsl */`
precision highp float;
attribute vec4 aData;
attribute float aPart;
uniform float uScroll;
uniform float uFarZ;
uniform float uRows;
uniform float uGroundY;
varying vec3 vWP;
varying vec3 vNrm;
varying vec3 vLP;
varying float vPart;
${NOISE}
${BIOME}
void main() {
    const float SP = 3200.0;
    float jmin = ceil((uFarZ - uScroll) / SP);
    float j = jmin + mod(aData.w - jmin, uRows);
    float g = j * SP;
    float wz = g + uScroll;
    vec4 B = biomeAt(g);
    float pres = smoothstep(0.75, 0.97, B.z * nyAt(g));
    float t = (wz - uFarZ) / (uRows * SP);
    pres *= smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.94, 1.0, t));
    vec3 p = position;
    p.y *= pres;
    vLP = position;
    vNrm = normal;
    vPart = aPart;
    vWP = vec3(0.0, uGroundY - 4.0, wz) + p;
    gl_Position = pres < 0.002 ? vec4(0.0, 0.0, 2.0, 1.0) :     projectionMatrix * viewMatrix * vec4(vWP - uShift, 1.0);
}`;

const BRIDGE_FRAG = /* glsl */`
precision highp float;
uniform vec3 uRock;
uniform vec3 uGlow;
varying vec3 vWP;
varying vec3 vNrm;
varying vec3 vLP;
varying float vPart;
${ATMOS}
${NOISE}
${LIGHTING}
void main() {
    vec3 N = normalize(vNrm);
    vec3 vd = normalize(vWP - uCamPos);
    float diff = max(dot(N, uL), 0.0);
    vec3 stone = vec3(0.5, 0.42, 0.36);
    vec3 steel = vec3(0.2, 0.22, 0.28);
    vec3 deck = vec3(0.1, 0.1, 0.13);
    vec3 base = vPart < 0.5 ? stone : vPart < 1.5 ? steel : deck;
    vec3 col = base * (uAmb * (0.5 + 0.5 * N.y) + uSunCol * diff);
    col += skyReflect(reflect(vd, N)) * 0.1 * step(0.5, vPart);
    if (vPart > 2.5) col = uGlow * 2.2;
    gl_FragColor = vec4(applyFog(col, vWP), 1.0);
${OUTPUT}
}`;

const VEH_VERT = /* glsl */`
precision highp float;
attribute vec4 aData;
uniform float uScroll;
uniform float uFarZ;
uniform float uRange;
uniform float uGroundY;
varying vec3 vLP;
varying float vFade;
varying float vTint;
varying vec3 vWP;
${NOISE}
${BIOME}
void main() {
    // Velocidade relativa própria: paralaxe e cruzamento com o fluxo do chão.
    float spd = 0.2 + aData.z * 1.7;
    float a = aData.y * uRange + uScroll * spd;
    float depth = mod(a, uRange);
    float cyc = floor(a / uRange);
    float t = depth / uRange;
    float wz = uFarZ + depth;
    float side = aData.x < 0.5 ? -1.0 : 1.0;
    float rx = hash21(vec2(aData.w * 17.0, cyc));
    float wx = side * (90.0 + rx * rx * 900.0);
    float alt = 40.0 + hash21(vec2(aData.w * 3.3, cyc + 2.0)) * 320.0;
    vec4 B = biomeAt(wz - uScroll);
    float fade = smoothstep(0.35, 0.8, B.z) * smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.9, 1.0, t));
    vec3 lp = position * vec3(3.2, 1.4, 12.0) * (0.8 + aData.z * 0.8) * step(0.01, fade);
    vLP = position;
    vTint = hash21(vec2(aData.w, 4.0));
    vFade = fade;
    vWP = vec3(wx, uGroundY + alt, wz) + lp;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWP - uShift, 1.0);
}`;

const VEH_FRAG = /* glsl */`
precision highp float;
uniform vec3 uGlow;
varying vec3 vLP;
varying float vFade;
varying float vTint;
varying vec3 vWP;
${ATMOS}
${NOISE}
${LIGHTING}
void main() {
    vec3 body = vec3(0.12, 0.13, 0.18);
    vec3 head = vec3(1.0, 0.95, 0.8) * 2.2;
    vec3 tail = vec3(1.0, 0.12, 0.08) * 2.0;
    vec3 col = mix(body, mix(tail, head, step(0.0, vLP.z)), smoothstep(0.35, 0.5, abs(vLP.z)));
    col += uGlow * 0.6 * step(vTint, 0.3) * smoothstep(0.3, 0.5, 1.0 - abs(vLP.y * 2.0));
    gl_FragColor = vec4(applyFog(col, vWP), vFade);
${OUTPUT}
}`;

const SHAFT_VERT = /* glsl */`
precision highp float;
attribute vec4 aData;
uniform float uScroll;
uniform float uFarZ;
uniform float uRange;
uniform float uGroundY;
uniform vec3 uL;
varying vec2 vUV;
varying float vFade;
varying vec3 vWP;
${NOISE}
${BIOME}
void main() {
    float a = aData.y * uRange + uScroll;
    float depth = mod(a, uRange);
    float cyc = floor(a / uRange);
    float t = depth / uRange;
    float wz = uFarZ + depth;
    float side = aData.x < 0.5 ? -1.0 : 1.0;
    float wx = side * (60.0 + hash21(vec2(aData.w * 9.1, cyc)) * 650.0);
    vec4 B = biomeAt(wz - uScroll);
    vFade = B.y * smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.85, 1.0, t));
    vec3 axis = normalize(vec3(-uL.x * 0.5, -0.9, -uL.z * 0.5));
    vec3 sideV = normalize(cross(axis, vec3(0.0, 0.0, 1.0)));
    float width = 30.0 + aData.z * 40.0;
    float len = 260.0 + aData.z * 120.0;
    vec3 top = vec3(wx, uGroundY + 330.0, wz);
    vWP = top + sideV * position.x * width + axis * position.y * len;
    vUV = vec2(position.x + 0.5, position.y);
    gl_Position = projectionMatrix * viewMatrix * vec4(vWP - uShift, 1.0);
}`;

const SHAFT_FRAG = /* glsl */`
precision highp float;
uniform vec3 uSun;
varying vec2 vUV;
varying float vFade;
varying vec3 vWP;
uniform float uTime;
${NOISE}
void main() {
    float across = 1.0 - pow(abs(vUV.x * 2.0 - 1.0), 2.0);
    float along = sin(vUV.y * 3.14159);
    float n = 0.75 + 0.25 * sin(uTime * 0.6 + vWP.x * 0.02);
    gl_FragColor = vec4(uSun, across * along * vFade * 0.08 * n);
${OUTPUT}
}`;

function buildTreeGeometry(kind) {
    const trunk = new THREE.CylinderGeometry(0.07, 0.12, 0.55, 5, 1);
    trunk.translate(0, 0.27, 0);
    const parts = [trunk];
    const levels = kind === 'giant' ? 4 : 3;
    for (let i = 0; i < levels; i++) {
        const t = i / levels;
        const cone = new THREE.ConeGeometry(0.62 - t * 0.38, 0.62, 6, 1);
        cone.translate(0, 0.45 + t * 0.95, 0);
        parts.push(cone);
    }
    const geos = parts.map((g, i) => {
        const ng = g.index ? g.toNonIndexed() : g;
        const count = ng.attributes.position.count;
        ng.setAttribute('aTrunk', new THREE.BufferAttribute(new Float32Array(count).fill(i === 0 ? 1 : 0), 1));
        ng.deleteAttribute('uv');
        ng.deleteAttribute('normal');
        return ng;
    });
    return mergeGeometries(geos);
}

function nonIndexedPart(geo, attr, value) {
    const ng = geo.index ? geo.toNonIndexed() : geo;
    ng.deleteAttribute('uv');
    ng.setAttribute(attr, new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count).fill(value), 1));
    return ng;
}

// Torre em 4 blocos empilhados (y em [-0.5, 0.5]); o shader recua os blocos superiores só em Nova York.
function buildTieredGeometry() {
    const edges = [0, 0.58, 0.82, 0.94, 1];
    const parts = [];
    for (let i = 0; i < 4; i++) {
        const h = edges[i + 1] - edges[i];
        const box = new THREE.BoxGeometry(1, h, 1);
        box.translate(0, edges[i] + h / 2 - 0.5, 0);
        parts.push(nonIndexedPart(box, 'aTier', i));
    }
    return mergeGeometries(parts);
}

// Ponte suspensa (unidades de mundo): tabuleiro a 190, torres de pedra em x = ±560, cabos e pendurais.
function buildBridgeGeometry() {
    const parts = [];
    const add = (w, h, d, x, y, z, part, rotZ = 0) => {
        const box = new THREE.BoxGeometry(w, h, d);
        if (rotZ) box.rotateZ(rotZ);
        box.translate(x, y, z);
        parts.push(nonIndexedPart(box, 'aPart', part));
    };
    const DECK = 190, TOP = 330, HALF = 560, END = 1100;
    add(END * 2, 7, 46, 0, DECK, 0, 2);
    for (const z of [-22, 22]) {
        add(END * 2, 3, 2, 0, DECK + 4, z, 1);
        for (let x = -END; x <= END; x += 36) add(2.2, 2.2, 2.2, x, DECK + 6, z, 3);
    }
    for (const s of [-1, 1]) {
        for (const lx of [-24, 24]) add(22, TOP, 24, s * HALF + lx, TOP / 2, 0, 0);
        add(70, 12, 26, s * HALF, 150, 0, 0);
        add(70, 14, 26, s * HALF, TOP - 8, 0, 0);
    }
    const cable = (x0, y0, x1, y1, z) => {
        const len = Math.hypot(x1 - x0, y1 - y0);
        add(len, 3, 3, (x0 + x1) / 2, (y0 + y1) / 2, z, 1, Math.atan2(y1 - y0, x1 - x0));
    };
    const sag = (x) => 205 + (TOP - 205) * Math.pow(x / HALF, 2);
    for (const z of [-20, 20]) {
        const N = 14;
        for (let i = 0; i < N; i++) {
            const x0 = -HALF + (2 * HALF * i) / N, x1 = -HALF + (2 * HALF * (i + 1)) / N;
            cable(x0, sag(x0), x1, sag(x1), z);
        }
        for (const s of [-1, 1]) cable(s * HALF, TOP, s * END, DECK + 6, z);
        for (let x = -HALF + 40; x < HALF; x += 40) add(1.4, sag(x) - DECK - 6, 1.4, x, (sag(x) + DECK + 6) / 2, z, 1);
    }
    return mergeGeometries(parts);
}

function instancedData(count, tweak) {
    const data = randomAttribute(count, 4);
    for (let i = 0; i < count; i++) {
        data[i * 4 + 2] = 0.6 + data[i * 4 + 2] * 0.4;
        data[i * 4 + 1] = (i + data[i * 4 + 1]) / count; // estratificado: cobre toda a profundidade
        data[i * 4 + 3] = i;
        tweak?.(data, i);
    }
    return new THREE.InstancedBufferAttribute(data, 4);
}

export class PropLayers {
    constructor(shared, group, colors, { isMobile = false } = {}) {
        this.shared = shared;
        this.group = group;
        this.colors = colors;
        this.layers = [];
        const m = isMobile ? 0.5 : 1;

        // mask: densidade por bioma [planície, floresta, cidade, extremo].
        const defs = [
            { geometry: new THREE.IcosahedronGeometry(1, 0), count: 80, size: [4, 16], yScale: 0.55, lift: 0.45, color: 'rock', mult: 1, spread: 380, mask: [1, 0.5, 0, 0.9], range: 2400 },
            { geometry: new THREE.OctahedronGeometry(1, 0), count: 28, size: [5, 16], yScale: 3.2, lift: 0.9, color: 'rock', mult: 0.6, emit: 1.6, spread: 380, mask: [0.6, 0.3, 0, 0.45], range: 2400 },
            { geometry: new THREE.ConeGeometry(1, 1.6, 5, 1), count: 100, size: [4, 11], yScale: 1.0, lift: 0.8, color: 'fieldA', mult: 1.6, spread: 600, mask: [1, 0.7, 0, 0], range: 2400 },
            { geometry: buildTreeGeometry('tree'), count: 240, size: [22, 52], yScale: 1.0, lift: 0.0, color: 'fieldA', mult: 1.0, spread: 650, lane: 55, mask: [0.1, 1, 0, 0], range: 2600, leaf: 1, trunk: true },
            { geometry: buildTreeGeometry('giant'), count: 46, size: [70, 130], yScale: 1.0, lift: 0.0, color: 'fieldB', mult: 0.9, spread: 520, lane: 120, mask: [0, 0.3, 0, 0], range: 3200, leaf: 1, trunk: true },
            { geometry: new THREE.ConeGeometry(1, 1.0, 4, 1), count: 60, size: [30, 90], yScale: 4.5, lift: 0.0, color: 'rock', mult: 0.9, spread: 330, lane: 90, mask: [0, 0, 0, 0.8], range: 2800 }
        ];

        for (const def of defs) {
            const count = Math.max(8, Math.round(def.count * m));
            const geometry = def.geometry;
            if (!def.trunk) {
                geometry.setAttribute('aTrunk', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count), 1));
            }
            geometry.setAttribute('aData', instancedData(count));
            const color = new THREE.Color();
            const trunkCol = new THREE.Color();
            const material = shaderMaterial(shared, PROP_VERT, PROP_FRAG, {
                uRange: { value: def.range },
                uFarZ: { value: -def.range + 100 },
                uLane: { value: def.lane ?? 70 },
                uSpread: { value: def.spread },
                uSizeRange: { value: new THREE.Vector2(def.size[0], def.size[1]) },
                uYScale: { value: def.yScale },
                uLift: { value: def.lift },
                uColor: { value: color },
                uTrunkCol: { value: trunkCol },
                uEmit: { value: def.emit || 0 },
                uLeaf: { value: def.leaf || 0 },
                uMask: { value: new THREE.Vector4(...def.mask) },
                uDensity: { value: 1 },
                uYaw: { value: def.trunk ? 0.2 : 1 }
            });
            const mesh = new THREE.InstancedMesh(geometry, material, count);
            mesh.frustumCulled = false;
            mesh.renderOrder = -5;
            geometry.computeBoundingBox();
            // Dados para o espelho em CPU (WorldObstacles): árvores, pedras e espiras.
            mesh.userData.collider = {
                kind: def.trunk ? 'tree' : (def.yScale >= 4 ? 'spire' : 'rock'),
                aData: geometry.attributes.aData.array,
                count,
                bbox: geometry.boundingBox,
                def
            };
            group.add(mesh);
            this.layers.push({ mesh, color, trunkCol, source: def.color, mult: def.mult, mask: def.mask });
        }

        this._createBuildings(shared, group, isMobile);
        this._createBridges(shared, group);
        this._createVehicles(shared, group, m);
        this._createShafts(shared, group, m);
    }

    _createBuildings(shared, group, isMobile) {
        const geometry = buildTieredGeometry();
        const sets = [
            { cols: 6, rows: 11, col0: 330, hScale: 1, farZ: -2300 },
            { cols: 5, rows: isMobile ? 18 : 28, col0: 1650, hScale: 2.3, farZ: -6300 }
        ];
        this.buildings = sets.map((cfg) => {
            const count = cfg.cols * 2 * cfg.rows;
            const aData = new Float32Array(count * 4);
            for (let i = 0; i < count; i++) aData[i * 4 + 3] = i;
            const geo = geometry.clone();
            geo.setAttribute('aData', new THREE.InstancedBufferAttribute(aData, 4));
            const material = shaderMaterial(shared, BUILD_VERT, BUILD_FRAG, {
                uFarZ: { value: cfg.farZ },
                uCol0: { value: cfg.col0 },
                uCols: { value: cfg.cols },
                uRows: { value: cfg.rows },
                uHScale: { value: cfg.hScale },
                uDensity: { value: 1 },
                uRock: { value: this.colors.rock }
            });
            const mesh = new THREE.InstancedMesh(geo, material, count);
            mesh.frustumCulled = false;
            mesh.renderOrder = -4;
            mesh.userData.collider = { kind: 'building', cfg };
            group.add(mesh);
            return mesh;
        });
        this.layers.push(...this.buildings.map((mesh) => ({ mesh, mask: [0.03, 0.07, 1, 0], color: null })));
    }

    _createBridges(shared, group) {
        const rows = 4;
        const geo = buildBridgeGeometry();
        const aData = new Float32Array(rows * 4);
        for (let i = 0; i < rows; i++) aData[i * 4 + 3] = i;
        geo.setAttribute('aData', new THREE.InstancedBufferAttribute(aData, 4));
        const material = shaderMaterial(shared, BRIDGE_VERT, BRIDGE_FRAG, {
            uFarZ: { value: -9000 },
            uRows: { value: rows },
            uRock: { value: this.colors.rock }
        });
        const mesh = new THREE.InstancedMesh(geo, material, rows);
        mesh.frustumCulled = false;
        mesh.renderOrder = -4;
        group.add(mesh);
        this.bridges = mesh;
        this.layers.push({ mesh, mask: [0, 0, 1, 0], color: null });
    }

    _createVehicles(shared, group, m) {
        const count = Math.round(70 * m);
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        geometry.setAttribute('aData', instancedData(count));
        const material = shaderMaterial(shared, VEH_VERT, VEH_FRAG, {
            uFarZ: { value: -3800 },
            uRange: { value: 3900 }
        }, { transparent: true, depthWrite: false });
        this.vehicles = new THREE.InstancedMesh(geometry, material, count);
        this.vehicles.frustumCulled = false;
        this.vehicles.renderOrder = 5;
        markBloom(this.vehicles);
        group.add(this.vehicles);
        this.layers.push({ mesh: this.vehicles, mask: [0, 0, 1, 0], color: null });
    }

    _createShafts(shared, group, m) {
        const count = Math.round(22 * m);
        const geometry = new THREE.PlaneGeometry(1, 1);
        geometry.translate(0, 0.5, 0);
        geometry.setAttribute('aData', instancedData(count));
        const material = shaderMaterial(shared, SHAFT_VERT, SHAFT_FRAG, {
            uFarZ: { value: -1900 },
            uRange: { value: 2000 }
        }, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
        this.shafts = new THREE.InstancedMesh(geometry, material, count);
        this.shafts.frustumCulled = false;
        this.shafts.renderOrder = 7;
        group.add(this.shafts);
        this.layers.push({ mesh: this.shafts, mask: [0, 1, 0, 0], color: null });
    }

    setColors(c) {
        for (const layer of this.layers) {
            if (!layer.color) continue;
            layer.color.copy(c[layer.source]).multiplyScalar(layer.mult);
            layer.trunkCol.copy(c.rock).multiplyScalar(0.55);
        }
    }

    // Esconde camadas sem nenhum bioma relevante na linha do tempo (economiza draw calls).
    setVisibility(biomeIds) {
        for (const layer of this.layers) {
            layer.mesh.visible = biomeIds.some((id) => layer.mask[id] > 0.05);
        }
    }
}
