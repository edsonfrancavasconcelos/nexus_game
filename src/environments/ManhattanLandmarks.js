import * as THREE from 'three';

import { MANHATTAN_PALETTE } from './biomeData.js';

// Estátua da Liberdade como ponto de referência de Manhattan: objeto só visual (fora de WorldObstacles,
// sem colisão), numa ilha ao lado da cidade. Acompanha o avanço do cenário (scroll) e o deslocamento da origem.

const LATERAL_X = 300; // x de mundo: no fim da avenida, ao lado da ponte; some na névoa bem antes de chegar à nave
const FAR_Z = -5400;
const FADE_IN_FAR = -6200;
const FADE_IN_NEAR = -5400;
const FADE_OUT_FAR = -4000;
const FADE_OUT_NEAR = -3200;
const DESPAWN_Z = -3100;
const SCALE = 1.8;

function buildStatue() {
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0xc9c2b2, roughness: 0.9, emissive: 0x2a2620, emissiveIntensity: 0.6 });
    const copper = new THREE.MeshStandardMaterial({ color: 0x6fb5a0, roughness: 0.65, metalness: 0.1, emissive: 0x1d4a40, emissiveIntensity: 0.7 });
    const island = new THREE.MeshStandardMaterial({ color: 0x4f6a48, roughness: 1, emissive: 0x16200f, emissiveIntensity: 0.5 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false });
    const mats = [stone, copper, island, flameMat];

    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.rotation.set(rx, ry, rz);
        g.add(m);
        return m;
    };

    // Ilha e forte em estrela (base).
    add(new THREE.CylinderGeometry(190, 215, 26, 24), island, 0, 0, 0);
    add(new THREE.CylinderGeometry(120, 150, 22, 8), stone, 0, 24, 0, 0, Math.PI / 8, 0);
    // Pedestal.
    add(new THREE.CylinderGeometry(58, 70, 100, 4), stone, 0, 85, 0, 0, Math.PI / 4, 0);
    add(new THREE.CylinderGeometry(50, 58, 26, 4), stone, 0, 148, 0, 0, Math.PI / 4, 0);
    // Corpo: túnica, torso, cabeça e coroa.
    add(new THREE.CylinderGeometry(19, 33, 92, 14), copper, 0, 207, 0);
    add(new THREE.CylinderGeometry(15, 19, 40, 14), copper, 0, 273, 0);
    add(new THREE.SphereGeometry(11, 14, 12), copper, 0, 303, 0);
    for (let i = 0; i < 7; i++) {
        const a = (i / 6) * Math.PI - Math.PI / 2;
        add(new THREE.ConeGeometry(2.4, 17, 5), copper, Math.sin(a) * 11, 314 + Math.cos(a) * 3, Math.cos(a) * 8, Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.9);
    }
    // Braço direito erguido com a tocha.
    add(new THREE.CylinderGeometry(4.5, 5.5, 74, 8), copper, 20, 330, 0, 0, 0, -0.2);
    add(new THREE.CylinderGeometry(9, 5, 11, 10), copper, 27, 372, 0);
    add(new THREE.ConeGeometry(7, 22, 8), flameMat, 27, 389, 0);
    // Tábua no braço esquerdo.
    add(new THREE.BoxGeometry(24, 32, 5), copper, -23, 265, 14, 0.2, 0, 0.1);

    g.userData.mats = mats;
    g.scale.setScalar(SCALE);
    g.visible = false;
    return g;
}

export class ManhattanLandmarks {
    constructor(scene, biomes) {
        this.scene = scene;
        this.biomes = biomes;
        this.statue = buildStatue();
        scene.add(this.statue);
        this.active = false;
        this._done = false;
        this._scroll = 0;
        for (const m of this.statue.userData.mats) m.transparent = true;
    }

    _spawn() {
        const b = this.biomes;
        const seg = b.segments[b.segments.length - 1];
        // Perto da fronteira da cidade, nunca mais perto que FAR_Z.
        const z = Math.min(seg.b + b.scroll - 1200, FAR_Z);
        this.statue.position.set(LATERAL_X - b.shift.x, 0, z);
        this.statue.rotation.y = 0.25;
        this._scroll = b.scroll;
        this.active = true;
        this._done = true;
        this._place();
    }

    _place() {
        const s = this.statue;
        s.position.y = this.biomes.groundHeightAt(s.position.x, s.position.z) + 10;
    }

    update() {
        const b = this.biomes;
        const manhattan = b.segments.length > 0 && b.segments[b.segments.length - 1].pal === MANHATTAN_PALETTE;
        if (!manhattan) { this._done = false; if (this.active) this._hide(); return; }
        if (!this.active) {
            if (this._done) return;
            this._spawn();
        }
        const ds = b.scroll - this._scroll;
        this._scroll = b.scroll;
        const s = this.statue;
        if (Number.isFinite(ds) && Math.abs(ds) < 2000) s.position.z += ds;
        if (s.position.z > DESPAWN_Z) { this._hide(); return; }
        this._place();
        s.visible = true;
        const o = THREE.MathUtils.clamp((s.position.z - FADE_IN_FAR) / (FADE_IN_NEAR - FADE_IN_FAR), 0, 1)
            * (1 - THREE.MathUtils.clamp((s.position.z - FADE_OUT_FAR) / (FADE_OUT_NEAR - FADE_OUT_FAR), 0, 1));
        for (const m of s.userData.mats) m.opacity = o;
        s.visible = o > 0.01;
    }

    _hide() {
        this.active = false;
        this.statue.visible = false;
    }

    shiftWorld(dx) {
        if (dx) this.statue.position.x -= dx;
    }
}
