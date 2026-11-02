import * as THREE from 'three';
import { MAP_LIMITS } from './ShipFlight.js';

const MAX_BOXES = 14;
const SCAN_STEPS = [0, 120, 260, 420, 620, 880, 1200];
const SCAN_X = [-60, 0, 60];

// Modo debug do voo (F3 ou ?debug=flight): mostra posição, altitude, altura do terreno e distância
// até o chão, e desenha no mundo o ponto de chão medido e as caixas de colisão dos obstáculos.
// Serve para conferir o cálculo com o que aparece na tela; não altera o jogo.
export class FlightDebug {
    constructor(scene, ship, collision, biomes) {
        this.ship = ship;
        this.collision = collision;
        this.biomes = biomes;
        this.enabled = new URLSearchParams(window.location.search).get('debug') === 'flight';
        this._scan = 0;
        this._list = [];
        this._hud = null;
        this._group = new THREE.Group();
        this._group.visible = false;
        scene.add(this._group);

        const mat = (c) => new THREE.LineBasicMaterial({ color: c, depthTest: false, transparent: true, opacity: 0.9 });
        const ringPts = Array.from({ length: 33 }, (_, i) => {
            const a = (i / 32) * Math.PI * 2;
            return new THREE.Vector3(Math.cos(a) * 6, 0, Math.sin(a) * 6);
        });
        this._ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts), mat(0x00ff88));
        this._line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), mat(0xffee00));
        this._ring.renderOrder = this._line.renderOrder = 999;
        this._ring.frustumCulled = this._line.frustumCulled = false;
        this._group.add(this._ring, this._line);

        const boxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
        this._boxes = [];
        for (let i = 0; i < MAX_BOXES; i++) {
            const b = new THREE.LineSegments(boxGeo, mat(0xff4466));
            b.visible = false;
            b.renderOrder = 998;
            b.frustumCulled = false;
            this._group.add(b);
            this._boxes.push(b);
        }

        window.addEventListener('keydown', (e) => {
            if (e.code === 'F2') {
                e.preventDefault();
                this.setEnabled(!this.enabled);
            }
        });
        this.setEnabled(this.enabled);
    }

    setEnabled(on) {
        this.enabled = on;
        this._group.visible = on;
        if (on && !this._hud) {
            this._hud = document.createElement('pre');
            this._hud.style.cssText = 'position:fixed;left:8px;top:8px;margin:0;padding:8px 10px;z-index:9999;pointer-events:none;'
                + 'font:11px/1.35 monospace;color:#9fffcf;background:rgba(0,10,8,.62);border:1px solid #2a6;border-radius:4px;white-space:pre';
            document.body.appendChild(this._hud);
        }
        if (this._hud) this._hud.style.display = on ? 'block' : 'none';
    }

    update(shipPos) {
        if (!this.enabled) return;
        const s = this.ship;
        const c = this.collision;
        const groundScene = this.biomes.groundHeightAt(shipPos.x, shipPos.z);

        this._ring.position.set(shipPos.x, groundScene + 0.5, shipPos.z);
        const p = this._line.geometry.attributes.position;
        p.setXYZ(0, shipPos.x, shipPos.y, shipPos.z);
        p.setXYZ(1, shipPos.x, groundScene, shipPos.z);
        p.needsUpdate = true;

        if (--this._scan <= 0) {
            this._scan = 15;
            this._scanObstacles(shipPos);
        }

        const f = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : '--');
        const w = s.worldPosition;
        const near = c.last.nearest;
        this._hud.textContent = [
            'FLIGHT DEBUG  (F2)',
            `mundo   x ${f(w.x)}  y ${f(w.y)}  z ${f(w.z, 0)}`,
            `cena    x ${f(shipPos.x)}  y ${f(shipPos.y)}  z ${f(shipPos.z)}`,
            `origem  x ${f(s.renderOrigin.x)}  y ${f(s.renderOrigin.y)}`,
            `terreno (cena) ${f(groundScene)}   (mundo) ${f(groundScene + s.renderOrigin.y)}`,
            `altitude (AGL) ${f(shipPos.y - groundScene)}   ship.altitude ${f(s.altitude)}`,
            `folga do casco ${f(c.last.clearance)}   norm ${f(s.altitudeNorm, 2)}`,
            `vel  x ${f(s.velocity.x)}  y ${f(s.velocity.y)}  subida ${f(s.climbRate, 2)}`,
            `y local [${f(MAP_LIMITS.minY, 0)}, ${f(MAP_LIMITS.maxY, 0)}]  teto ${f(MAP_LIMITS.worldCeiling, 0)}  piso ${s.terrainFloor ? 'on' : 'off'}`,
            `colisão ${c.enabled ? 'ATIVA' : 'desligada'}  terreno ${c.last.terrainHit ? 'TOCARIA' : 'ok'}  estrutura ${c.last.structureHit ? 'TOCARIA' : 'ok'}`,
            `obstáculo ${near ? `${near.kind} topo ${f(near.top)} base ${f(near.bottom)}` : '--'}`,
            `caixa da nave ${f(c.bounds.x * 2)} x ${f(c.bounds.y * 2)} x ${f(c.bounds.z * 2)}`
        ].join('\n');
    }

    _scanObstacles(shipPos) {
        const obs = this.collision.obstacles;
        let n = 0;
        if (obs) {
            for (const dz of SCAN_STEPS) {
                for (const dx of SCAN_X) {
                    this._list.length = 0;
                    obs.sampleScene(shipPos.x + dx, shipPos.z - dz, this._list, { terrain: false });
                    for (const o of this._list) {
                        if (n >= MAX_BOXES) break;
                        let dup = false;
                        for (let i = 0; i < n; i++) {
                            const q = this._boxes[i].userData.o;
                            if (q.cx === o.cx && q.cz === o.cz && q.top === o.top) { dup = true; break; }
                        }
                        if (dup) continue;
                        const b = this._boxes[n++];
                        b.userData.o = o;
                        b.position.set(o.cx - this.biomes.shift.x, (o.top + o.bottom) / 2, o.cz);
                        b.scale.set(o.hx * 2, o.top - o.bottom, o.hz * 2);
                        b.visible = true;
                    }
                }
            }
        }
        for (let i = n; i < MAX_BOXES; i++) this._boxes[i].visible = false;
    }
}
