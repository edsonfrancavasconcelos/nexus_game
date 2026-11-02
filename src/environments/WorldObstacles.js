import { AMP, baseHeight, biomeWeightsAt, dot4, hash21, nyAt, smooth, terrainHeightAt } from './terrainHeight.js';

// Espelho em CPU dos objetos do ambiente (terreno, prédios, pontes, árvores, rochas, espiras).
// Usa as mesmas fórmulas dos vertex shaders (Terrain.js / PropLayers.js), então responde onde o
// objeto aparece na tela. Tudo em x de MUNDO e y/z de cena (como os shaders); use sampleScene()
// para consultar com coordenadas de cena.
//
// Cada obstáculo é { kind, bottom, top, cx, cz, hx, hz } (bottom = -Infinity para o terreno).

const TIER_EDGES = [0, 0.58, 0.82, 0.94, 1];
const TIER_SHRINK = [1, 0.8, 0.58, 0.16];
const BUILD_S = 220;
const BRIDGE_SP = 3200;

const posMod = (a, m) => ((a % m) + m) % m;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

export class WorldObstacles {
    constructor(biomes) {
        this.biomes = biomes;
        this.extras = null; // obstáculos extras (modo teste) em { cx (x de mundo), cz (z de cena), bottom, top, hx, hz }
        this._B = [0, 0, 0, 0];
        this._Bb = [0, 0, 0, 0];
    }

    // x de cena -> x de mundo.
    sceneToWorldX(x) {
        return x + this.biomes.shift.x;
    }

    sampleScene(xScene, zScene, out, opts) {
        return this.sample(this.sceneToWorldX(xScene), zScene, out, opts);
    }

    // Preenche `out` com todos os obstáculos que cobrem o ponto (xWorld, z). Retorna out.
    sample(x, z, out, { terrain = true, structures = true, props: withProps = true } = {}) {
        const u = this.biomes.u;
        if (terrain) {
            out.push({
                kind: 'terrain', bottom: -Infinity,
                top: terrainHeightAt(u, x, z, this.biomes.terrain.material.uniforms.uMtnH.value),
                cx: x, cz: z, hx: 0, hz: 0
            });
        }
        if (!structures) return out;
        if (this.extras) {
            for (const e of this.extras) {
                if (Math.abs(x - e.cx) <= e.hx && Math.abs(z - e.cz) <= e.hz) out.push(e);
            }
        }
        const props = this.biomes.props;
        for (const mesh of props.buildings) {
            if (mesh.visible) this._buildings(mesh.userData.collider.cfg, mesh.material.uniforms, x, z, out);
        }
        if (props.bridges?.visible) this._bridges(props.bridges.material.uniforms, x, z, out);
        if (!withProps) return out;
        for (const layer of props.layers) {
            const c = layer.mesh.userData.collider;
            if (c && c.aData && layer.mesh.visible) this._props(c, layer.mesh.material.uniforms, x, z, out);
        }
        return out;
    }

    _buildings(cfg, mu, x, z, out) {
        const u = this.biomes.u;
        const scroll = u.uScroll.value;
        const { cols, col0, rows, farZ, hScale } = cfg;
        const density = mu.uDensity.value;
        const ax = Math.abs(x);
        const ci = Math.round((ax - col0) / BUILD_S);
        if (ci < 0 || ci >= cols) return;
        const g = z - scroll;
        const j = Math.floor(g / BUILD_S);
        const jmin = Math.ceil((farZ - scroll) / BUILD_S - 0.5);
        if (j < jmin || j >= jmin + rows) return;
        const gc = (j + 0.5) * BUILD_S;
        const wz = gc + scroll;
        const side = x < 0 ? -1 : 1;
        const wx = side * (col0 + ci * BUILD_S);
        const slot = posMod(j, rows);
        const k = slot * cols * 2 + (side < 0 ? ci : cols + ci);

        const B = biomeWeightsAt(gc, u, this._B);
        const ny = nyAt(gc, u);
        const rh = hash21(j * 1.7, k * 3.1);
        const rr = hash21(k * 5.3, j * 0.7 + 4);
        const t = (wz - farZ) / (rows * BUILD_S);
        const pres = (B[2] + B[1] * 0.07 + B[0] * 0.03) * density;
        const fade = clamp01((pres - rr) * 8) * smooth(0, 0.1, t) * (1 - smooth(0.93, 1, t));
        if (fade < 0.5) return;

        const hf = 0.14 + 0.86 * smooth(0.35, 0.95, B[2]);
        let hgt = (30 + 430 * Math.pow(rh, 2.3 + (1.7 - 2.3) * ny)) * hf * hScale * (1 + 0.3 * ny);
        const bk = Math.abs(posMod(gc + 1600, 3200) - 1600);
        if (B[2] * ny >= 0.75 && bk <= 170 && col0 <= 1000) hgt = Math.min(hgt, 140);
        const w = (96 + 56 * hash21(k, j)) * (0.55 + 0.45 * hf);
        const d = (96 + 56 * hash21(j, k + 2)) * (0.55 + 0.45 * hf);
        const gy = u.uGroundY.value + baseHeight(wx, gc, B) - 4;

        for (let i = 0; i < 4; i++) {
            const sc = 1 + (TIER_SHRINK[i] - 1) * ny;
            const hx = (w * sc) / 2, hz = (d * sc) / 2;
            if (Math.abs(x - wx) <= hx && Math.abs(z - wz) <= hz) {
                out.push({
                    kind: 'building', bottom: gy + TIER_EDGES[i] * hgt, top: gy + TIER_EDGES[i + 1] * hgt,
                    cx: wx, cz: wz, hx, hz
                });
            }
        }
    }

    _bridges(mu, x, z, out) {
        const u = this.biomes.u;
        const scroll = u.uScroll.value;
        const rows = mu.uRows.value, farZ = mu.uFarZ.value;
        const g0 = z - scroll;
        const j = Math.round(g0 / BRIDGE_SP);
        const jmin = Math.ceil((farZ - scroll) / BRIDGE_SP);
        if (j < jmin || j >= jmin + rows) return;
        const g = j * BRIDGE_SP;
        const wz = g + scroll;
        if (Math.abs(z - wz) > 30) return;
        const B = biomeWeightsAt(g, u, this._B);
        const t = (wz - farZ) / (rows * BRIDGE_SP);
        const pres = smooth(0.75, 0.97, B[2] * nyAt(g, u)) * smooth(0, 0.06, t) * (1 - smooth(0.94, 1, t));
        if (pres < 0.5) return;
        const gy = u.uGroundY.value - 4;
        const box = (kind, cx, hx, hz, y0, y1) => {
            if (Math.abs(x - cx) <= hx && Math.abs(z - wz) <= hz) {
                out.push({ kind, bottom: gy + y0 * pres, top: gy + y1 * pres, cx, cz: wz, hx, hz });
            }
        };
        box('bridge', 0, 1100, 23, 186.5, 193.5);
        for (const s of [-1, 1]) {
            for (const lx of [-24, 24]) box('bridge', s * 560 + lx, 11, 12, 0, 330);
            box('bridge', s * 560, 35, 13, 144, 156);
            box('bridge', s * 560, 35, 13, 322, 336);
        }
    }

    _props(c, mu, x, z, out) {
        const u = this.biomes.u;
        const scroll = u.uScroll.value;
        const def = c.def;
        const range = mu.uRange.value, farZ = mu.uFarZ.value;
        const density = mu.uDensity.value;
        const lane = mu.uLane.value, spread = mu.uSpread.value;
        const bb = c.bbox;
        const radiusUnit = Math.max(bb.max.x, -bb.min.x, bb.max.z, -bb.min.z);
        const reach = radiusUnit * def.size[1] * (c.kind === 'tree' ? 0.8 : 1);
        const a = c.aData;
        const mask = def.mask;
        const sx = mu.uSizeRange.value.x, sy = mu.uSizeRange.value.y;
        const yScale = mu.uYScale.value, lift = mu.uLift.value;
        for (let i = 0; i < c.count; i++) {
            const o = i * 4;
            const aa = a[o + 1] * range + scroll;
            const depth = posMod(aa, range);
            const wz = farZ + depth;
            if (Math.abs(z - wz) > reach) continue;
            const cyc = Math.floor(aa / range);
            const rx = hash21(a[o + 3] * 57.3, cyc);
            const wx = (a[o] < 0.5 ? -1 : 1) * (lane + rx * spread);
            if (Math.abs(x - wx) > reach) continue;

            const g = wz - scroll;
            const B = biomeWeightsAt(g, u, this._Bb);
            const pres = (B[0] * mask[0] + B[1] * mask[1] + B[2] * mask[2] + B[3] * mask[3]) * density;
            const rr = hash21(a[o + 3] * 31.1 + 9, cyc);
            const t = depth / range;
            const fade = clamp01((pres - rr) * 8) * smooth(0, 0.14, t) * (1 - smooth(0.9, 1, t));
            if (fade < 0.5) continue;
            const sc = (sx + (sy - sx) * hash21(a[o + 3] * 13.7 + 3, cyc)) * a[o + 2];
            const radius = radiusUnit * sc * (c.kind === 'tree' ? 0.8 : 1);
            if (Math.abs(x - wx) > radius || Math.abs(z - wz) > radius) continue;

            const base = u.uGroundY.value + baseHeight(wx, g, B) + sc * yScale * lift;
            out.push({
                kind: c.kind, bottom: base + bb.min.y * sc * yScale, top: base + bb.max.y * sc * yScale,
                cx: wx, cz: wz, hx: radius, hz: radius
            });
        }
    }
}

export { AMP, dot4 };
