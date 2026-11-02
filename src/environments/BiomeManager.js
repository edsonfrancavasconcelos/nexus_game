import * as THREE from 'three';
import { BIOME_PARAMS, COLOR_KEYS, MANHATTAN_PALETTE, PALETTES, SCALAR_KEYS, biomeOf, levelToPalette, nyOf } from './biomeData.js';
import { SkyDome } from './SkyDome.js';
import { Terrain } from './Terrain.js';
import { PropLayers } from './PropLayers.js';
import { AirParticles } from './AirParticles.js';
import { FlightPath } from '../flight/FlightPath.js';
import { WorldSectors } from '../flight/WorldSectors.js';
import { RAPTOR_FLIGHT_FEEL } from '../flight/RaptorFlightFeel.js';
import { terrainHeightAt } from './terrainHeight.js';

// Distância (em unidades de chão) à frente da câmera onde um novo bioma nasce, e meia largura
// da faixa de mistura. Com ~360 u/s, a viagem de um bioma ao outro leva ~20 s.
const SPAWN_AHEAD = 7000;
const BLEND_HALF = 1400;
const PALETTE_TRIGGER_AHEAD = 2600;
const MAX_SEGMENTS = 4;
// Quanto do deslocamento vertical da nave o chão acompanha (menor = altitude real mais sentida).
const GROUND_FOLLOW = 0.5;

const smooth = (a, b, x) => {
    const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
    return t * t * (3 - 2 * t);
};

export class BiomeManager {
    constructor(scene, { isMobile = false, far = 30000 } = {}) {
        this.scene = scene;
        this.time = 0;
        this.scroll = 0;
        this.baseSpeed = 360;
        this.speed = this.baseSpeed;
        this.speedMul = 1;
        this.flightBoost = 0;
        this.speedScale = RAPTOR_FLIGHT_FEEL.speed.cruiseScale;
        this.ship = null;
        this.forcedBiome = BiomeManager.readForcedBiome();

        this._cam = new THREE.Vector3(0, 11, 63);
        // Câmera em coordenadas do mundo (cena + deslocamento da trajetória), usada por névoa e terreno.
        this._camL = new THREE.Vector3(0, 11, 63);
        this.shift = new THREE.Vector3();
        this.flight = new FlightPath();
        this.sectors = new WorldSectors();
        this._baseL = new THREE.Vector3(-0.62, 0.35, -0.70).normalize();
        this._shipLightDir = new THREE.Vector3(-0.4, 0.8, 0.6).normalize();
        this._weights = [0, 0, 0, 0];
        this._ids = [0, 0, 0, 0];
        this._ny = [0, 0, 0, 0];
        this._visibleDirty = true;

        this.colors = {};
        for (const key of COLOR_KEYS) this.colors[key] = new THREE.Color();
        this.tint = new THREE.Vector3(1, 1, 1);
        this.scalars = {};
        for (const key of SCALAR_KEYS) this.scalars[key] = 0;
        this.sunCol = new THREE.Color();
        this.amb = new THREE.Color();
        this.ambientColor = new THREE.Color(0xffffff);
        this.target = null;

        this.u = {
            uTime: { value: 0 },
            uScroll: { value: 0 },
            uL: { value: this._baseL.clone() },
            uCamPos: { value: this._camL },
            uShift: { value: this.shift },
            uCamXZ: { value: new THREE.Vector2() },
            uGroundY: { value: -90 },
            uFogK: { value: 1 / 5400 },
            uGroundFog: { value: 0 },
            uSunCol: { value: this.sunCol },
            uAmb: { value: this.amb },
            uZenith: { value: this.colors.zenith },
            uMid: { value: this.colors.mid },
            uHorizon: { value: this.colors.horizon },
            uSun: { value: this.colors.sun },
            uHaze: { value: this.colors.haze },
            uGlow: { value: this.colors.glow },
            uBIdx: { value: new THREE.Vector4() },
            uBB: { value: new THREE.Vector3(-1e9, -1e9, -1e9) },
            uBNy: { value: new THREE.Vector4() },
            uBW: { value: BLEND_HALF },
            uSnow: { value: 3000 },
            uLava: { value: 0 },
            uNight: { value: 0 },
            uWinE: { value: 0 }
        };
        this.cloud = new THREE.Vector2(0.46, 0.78);

        this.group = new THREE.Group();
        this.group.name = 'BiomeEnvironment';
        scene.add(this.group);

        this.sky = new SkyDome(this.u, this.group, this.cloud, this.u.uNight);
        this.terrain = new Terrain(this.u, this.group, this.colors, { isMobile, far });
        this.props = new PropLayers(this.u, this.group, this.colors, { isMobile });
        this.air = new AirParticles(this.u, this.group, this._cam, { isMobile });

        this.sunLight = new THREE.DirectionalLight(0xffd9a0, 1.4);
        this.sunLight.castShadow = false;
        scene.add(this.sunLight);

        this.segments = [];
        this.setLevel(1, { instant: true });
    }

    static readForcedBiome() {
        if (typeof window === 'undefined') return null;
        const v = new URLSearchParams(window.location.search).get('biome');
        if (v === null) return null;
        if (v.toLowerCase() === 'manhattan') return MANHATTAN_PALETTE;
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? Math.max(0, Math.min(PALETTES.length - 1, n - 1)) : null;
    }

    attachPost(bloomPipeline) {
        this.post = bloomPipeline?.grade?.uniforms || null;
    }

    get currentPalette() {
        return this.segments[this.segments.length - 1].pal;
    }

    // Troca de nível: nasce um novo segmento de bioma lá na frente; o cenário chega gradualmente.
    setLevel(level, { instant = false } = {}) {
        if (this.forcedBiome !== null && this.segments.length) return;
        const pal = this.forcedBiome !== null ? this.forcedBiome : levelToPalette(level);
        if (instant || this.segments.length === 0) {
            this.segments = [{ pal, b: 0, applied: true }];
            this._setTarget(pal, true);
            this._writeSegmentUniforms();
            return;
        }
        if (this.segments[this.segments.length - 1].pal === pal) return;
        if (this.segments.length >= MAX_SEGMENTS) this.segments.splice(1, 1);
        const sb = this.sectors.boundaryAfter(this.scroll, SPAWN_AHEAD);
        this.segments.push({ pal, b: this._cam.z - sb, applied: false });
        this._writeSegmentUniforms();
    }

    _writeSegmentUniforms() {
        const segs = this.segments;
        for (let i = 0; i < 4; i++) this._ids[i] = biomeOf(segs[Math.min(i, segs.length - 1)].pal);
        this.u.uBIdx.value.set(this._ids[0], this._ids[1], this._ids[2], this._ids[3]);
        for (let i = 0; i < 4; i++) this._ny[i] = nyOf(segs[Math.min(i, segs.length - 1)].pal);
        this.u.uBNy.value.set(this._ny[0], this._ny[1], this._ny[2], this._ny[3]);
        this.u.uBB.value.set(
            segs.length > 1 ? segs[1].b : -1e9,
            segs.length > 2 ? segs[2].b : -1e9,
            segs.length > 3 ? segs[3].b : -1e9
        );
        this.props.setVisibility(segs.map((s) => biomeOf(s.pal)));
        this._visibleDirty = false;
    }

    _setTarget(pal, instant = false) {
        const p = PALETTES[pal];
        this.target = { colors: {}, scalars: p.scalars, tint: p.colors.tint };
        for (const key of COLOR_KEYS) if (key !== 'tint') this.target.colors[key] = new THREE.Color(p.colors[key]);
        if (instant) this._applyPalette(1);
    }

    _applyPalette(k) {
        const t = this.target;
        for (const key of COLOR_KEYS) if (key !== 'tint') this.colors[key].lerp(t.colors[key], k);
        for (const key of SCALAR_KEYS) this.scalars[key] += (t.scalars[key] - this.scalars[key]) * k;
        this.tint.x += (t.tint[0] - this.tint.x) * k;
        this.tint.y += (t.tint[1] - this.tint.y) * k;
        this.tint.z += (t.tint[2] - this.tint.z) * k;

        const c = this.colors;
        const s = this.scalars;
        this.sunCol.copy(c.sun).multiplyScalar(s.sunI);
        this.amb.copy(c.mid).lerp(c.horizon, 0.45).multiplyScalar(s.ambI);
        this.ambientColor.set(0xffffff).lerp(c.horizon, 0.35);
        this.sunLight.color.copy(c.sun);
        this.u.uFogK.value = s.fog;
        this.u.uGroundFog.value = s.gfog;
        this.u.uNight.value = s.night;
        this.u.uWinE.value = s.win;
        this.u.uSnow.value = s.snow;
        this.u.uLava.value = s.lava;
        this.cloud.set(s.cLo, s.cHi);
        this.props.setColors(c);
        this.air.setColors(c);
        if (this.post) {
            this.post.uTint.value.copy(this.tint);
            this.post.uSat.value = s.sat;
            this.post.uCon.value = s.con;
        }
    }

    // Mesma função do shader (biomeAt): pesos [planície, floresta, cidade, extremo] em g.
    _weightsAt(g, out) {
        const segs = this.segments;
        out[0] = out[1] = out[2] = out[3] = 0;
        out[biomeOf(segs[0].pal)] = 1;
        for (let i = 1; i < segs.length; i++) {
            const t = 1 - smooth(segs[i].b - BLEND_HALF, segs[i].b + BLEND_HALF, g);
            for (let j = 0; j < 4; j++) out[j] *= 1 - t;
            out[biomeOf(segs[i].pal)] += t;
        }
        return out;
    }

    _dot(values) {
        const w = this._weights;
        return w[0] * values[0] + w[1] * values[1] + w[2] * values[2] + w[3] * values[3];
    }

    // Altura visual real do terreno (Y de cena) em x/z de cena; sem argumentos, sob a nave.
    // O terreno e os props vivem em x de mundo e são desenhados com "- uShift", daí a conversão.
    groundHeightAt(x = this._camL.x - this.shift.x, z = 8) {
        return terrainHeightAt(this.u, x + this.shift.x, z, this.terrain.material.uniforms.uMtnH.value);
    }

    update(dt, playerPosition, moveInput, level = 1) {
        this.time += dt;
        const px = playerPosition?.x || 0;
        const py = playerPosition?.y || 0;
        const pz = playerPosition?.z || 0;
        this._cam.set(px, py + 11, pz + 63);
        this._camL.set(px, py + 11, pz + 63);
        const camZ = this._cam.z;

        // Segmentos cujas fronteiras já passaram pela câmera deixam de existir.
        const segs = this.segments;
        while (segs.length > 1 && segs[1].b + this.scroll - BLEND_HALF > camZ + 300) {
            segs.shift();
            this._visibleDirty = true;
        }
        // A paleta (céu, luz, neblina) muda quando a fronteira do bioma está em primeiro plano.
        for (const seg of segs) {
            if (!seg.applied && seg.b + this.scroll >= camZ - PALETTE_TRIGGER_AHEAD) {
                seg.applied = true;
                this._setTarget(seg.pal);
            }
        }
        this._applyPalette(1 - Math.exp(-dt / 2.5));

        if (this._visibleDirty) this._writeSegmentUniforms();

        // Pesos perto da câmera: velocidade, poeira/folhas/neve e rastros de vento.
        this._weightsAt(camZ - 300 - this.scroll, this._weights);
        const mulTarget = this._dot(BIOME_PARAMS.speedMul);
        this.speedMul += (mulTarget - this.speedMul) * (1 - Math.exp(-dt));
        this.speed = (this.baseSpeed + Math.min(level, 50) * 3) * this.speedMul * this.speedScale;
        // A posição real da nave (ShipFlight) é a referência do mundo: o avanço vem dela.
        if (this.ship) {
            this.scroll = this.ship.distance;
            this.shift.x = this.ship.renderOrigin.x;
        } else {
            this.scroll += this.speed * dt;
        }
        this._camL.x = px + this.shift.x;

        // A trajetória é só referência (direção/curvatura); ela não desloca o mundo nem a nave.
        this.flight.update(dt, this.scroll);
        this.sectors.update(this.scroll);

        // Altitude real: o chão responde à altura da nave (rasante = chão próximo, alto = visão ampla).
        const groundY = py * GROUND_FOLLOW - 85 - (this.ship ? this.ship.renderOrigin.y : 0);
        this._groundY = groundY;
        const low = this.ship ? 1 - this.ship.altitudeNorm : 0.5;
        const u = this.u;
        u.uTime.value = this.time;
        u.uScroll.value = this.scroll;
        u.uGroundY.value = groundY;
        u.uCamXZ.value.set(this._camL.x, this._camL.z);

        // Oscilação lenta do sol: luz dinâmica sobre o terreno e a nave.
        u.uL.value.copy(this._baseL);
        u.uL.value.x += Math.sin(this.time * 0.05) * 0.1;
        u.uL.value.normalize();
        this.sunLight.position.copy(this._shipLightDir).multiplyScalar(200);
        this.sunLight.intensity = 1.1 + 0.3 * Math.min(this.scalars.sunI / 2.2, 1);

        this.terrain.update(camZ);
        this.air.update({
            streak: (this.speed / this.baseSpeed) * this._dot(BIOME_PARAMS.streakMul) / this.speedMul * (1 + 0.25 * this.flightBoost) * (0.9 + 0.3 * low),
            height: this._dot(BIOME_PARAMS.dustHeight),
            fall: this._dot(BIOME_PARAMS.fall),
            size: this._dot(BIOME_PARAMS.dustSize),
            leaf: this._weights[1]
        });
        if (this.post) this.post.uSpeed.value = Math.min(this.speed / 420 + 0.08 * this.flightBoost, 1.6);
    }
}
