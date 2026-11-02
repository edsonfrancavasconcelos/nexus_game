// Porta para CPU do relevo do vertex shader do Terrain (glsl.js NOISE/BIOME + Terrain.js mountains).
// Mantenha em sincronia com o shader: é a "altura visual real" usada pela nave.
// Coordenadas: x/z de cena (as mesmas do mesh do terreno); retorna Y de cena.

const AMP = [1.0, 2.4, 0.06, 1.6];
const MTN_SIDE_A = [750, 900, 2600, 450];
const MTN_SIDE_B = [2200, 2300, 4200, 1100];
const MTN_NEAR = [1, 0.5, 0, 2.2];
const MTN_FAR = [1.8, 1.2, 0.45, 2.2];

const fract = (x) => x - Math.floor(x);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
};
const dot4 = (w, k) => w[0] * k[0] + w[1] * k[1] + w[2] * k[2] + w[3] * k[3];

function hash21(x, y) {
    let a = fract(x * 0.1031);
    let b = fract(y * 0.1031);
    let c = a;
    const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
    a += d; b += d; c += d;
    return fract((a + b) * c);
}

function vnoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = hash21(ix, iy), b = hash21(ix + 1, iy);
    const c = hash21(ix, iy + 1), d = hash21(ix + 1, iy + 1);
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

function ridged(x, y) {
    let s = 0, a = 0.55;
    for (let i = 0; i < 4; i++) {
        const n = 1 - Math.abs(2 * vnoise(x, y) - 1);
        s += n * n * a;
        const nx = x * 2.03 + 17.1;
        y = y * 2.03 + 9.2;
        x = nx;
        a *= 0.5;
    }
    return s;
}

function h0(qx, qy) {
    return 5 * Math.sin(qx * 0.0023 + Math.sin(qy * 0.0011) * 2)
        + 4 * Math.sin(qy * 0.0031 + qx * 0.0017)
        + 2 * Math.sin(qx * 0.011 + qy * 0.007);
}

const _w = [0, 0, 0, 0];
export { hash21, smooth, dot4, h0, AMP };

// Neblina/"ny" (Nova York) na coordenada de chão g, igual ao nyAt do shader.
export function nyAt(g, u) {
    const ny = u.uBNy.value, bb = u.uBB.value, bw = u.uBW.value;
    let v = ny.x;
    v += (ny.y - v) * (1 - smooth(bb.x - bw, bb.x + bw, g));
    v += (ny.z - v) * (1 - smooth(bb.y - bw, bb.y + bw, g));
    v += (ny.w - v) * (1 - smooth(bb.z - bw, bb.z + bw, g));
    return v;
}

// Relevo suave por bioma (sem montanhas), igual ao baseH do shader.
export function baseHeight(wx, g, B) {
    return h0(wx, g) * dot4(B, AMP);
}
function oneHotMix(w, i, t) {
    for (let k = 0; k < 4; k++) w[k] += ((Math.abs(i - k) < 0.5 ? 1 : 0) - w[k]) * t;
}

// Pesos [planície, floresta, cidade, extremo] na coordenada de chão g (= z - scroll).
export function biomeWeightsAt(g, u, out = _w) {
    const idx = u.uBIdx.value, bb = u.uBB.value, bw = u.uBW.value;
    for (let k = 0; k < 4; k++) out[k] = Math.abs(idx.x - k) < 0.5 ? 1 : 0;
    oneHotMix(out, idx.y, 1 - smooth(bb.x - bw, bb.x + bw, g));
    oneHotMix(out, idx.z, 1 - smooth(bb.y - bw, bb.y + bw, g));
    oneHotMix(out, idx.w, 1 - smooth(bb.z - bw, bb.z + bw, g));
    return out;
}

function mountains(x, z, dist, B, scroll, mtnH) {
    const qx = x, qy = z - scroll;
    const fy = z - scroll * 0.08;
    const sideA = dot4(B, MTN_SIDE_A), sideB = dot4(B, MTN_SIDE_B);
    const nearAmp = dot4(B, MTN_NEAR), farAmp = dot4(B, MTN_FAR);
    const side = smooth(sideA, sideB, Math.abs(x));
    const nearM = smooth(300, 1400, dist);
    const far = smooth(4500, 8000, dist);
    let n = ridged(qx * 0.00052, qy * 0.00052);
    const sc = n * 7;
    const terr = Math.floor(sc) / 7 + smooth(0, 0.35, fract(sc)) / 7;
    n = n + (terr - n) * (B[3] * 0.7);
    return (n * side * nearM * nearAmp + ridged(qx * 0.00032 + 31.7, fy * 0.00032 + 4.1) * far * farAmp) * mtnH;
}

// Y de cena do terreno em (x, z). camX/camZ: referência de distância usada pelo shader (uCamXZ).
export function terrainHeightAt(u, x, z, mtnH = 900) {
    const scroll = u.uScroll.value;
    const cam = u.uCamXZ.value;
    const B = biomeWeightsAt(z - scroll, u);
    const dist = Math.hypot(x - cam.x, z - cam.y);
    const h = h0(x, z - scroll) * dot4(B, AMP) + mountains(x, z, dist, B, scroll, mtnH);
    return u.uGroundY.value + h;
}
