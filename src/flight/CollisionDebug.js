import * as THREE from 'three';

const LABELS = {
    terrain: 'terreno', tree: 'árvore', building: 'prédio', bridge: 'ponte',
    rock: 'rocha', spire: 'espira', pylon: 'pilar'
};
const HOLD = 2.5;

// Colisão em modo debug (F7 ou ?debug=collision): só DETECTA e mostra. Não liga FlightCollision.enabled,
// não aplica dano, não destrói a nave e não reinicia a fase. Lê flightCollision.last.contact.
export class CollisionDebug {
    constructor(scene, collision, ship) {
        this.collision = collision;
        this.ship = ship;
        this.enabled = new URLSearchParams(window.location.search).get('debug') === 'collision';
        this.hits = 0;
        this.log = [];
        this._wasHit = false;
        this._hold = 0;
        this._held = null;
        this._hud = null;
        this._clock = performance.now();

        this._group = new THREE.Group();
        this._group.visible = false;
        scene.add(this._group);
        const mat = (c) => new THREE.LineBasicMaterial({ color: c, depthTest: false, transparent: true, opacity: 0.95 });

        const s = 2.5;
        this._marker = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-s, 0, 0), new THREE.Vector3(s, 0, 0),
            new THREE.Vector3(0, -s, 0), new THREE.Vector3(0, s, 0),
            new THREE.Vector3(0, 0, -s), new THREE.Vector3(0, 0, s)
        ]), mat(0xff2244));
        this._link = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), mat(0xff2244));
        this._obsBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), mat(0xff8800));
        this._hull = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), mat(0x44ff88));
        for (const o of [this._marker, this._link, this._obsBox, this._hull]) {
            o.renderOrder = 1002;
            o.frustumCulled = false;
            o.visible = false;
            this._group.add(o);
        }

        window.addEventListener('keydown', (e) => {
            if (e.code === 'F7') {
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
            this._hud.style.cssText = 'position:fixed;left:8px;top:50%;margin:0;padding:6px 9px;z-index:9999;pointer-events:none;'
                + 'font:11px/1.35 monospace;color:#ffd;background:rgba(20,6,0,.66);border:1px solid #c62;border-radius:4px;white-space:pre';
            document.body.appendChild(this._hud);
        }
        if (this._hud) this._hud.style.display = on ? 'block' : 'none';
    }

    update(shipPos) {
        if (!this.enabled) return;
        const now = performance.now();
        const dt = Math.min((now - this._clock) / 1000, 0.1);
        this._clock = now;

        const c = this.collision;
        const contact = c.last.contact;
        const b = c.bounds;
        this._hull.visible = true;
        this._hull.position.copy(shipPos);
        this._hull.scale.set(b.x * 2, b.y * 2, b.z * 2);
        this._hull.material.color.setHex(contact ? 0xff2244 : 0x44ff88);

        let showing = null;
        if (contact) {
            if (!this._wasHit) {
                this.hits++;
                this.log.push({ kind: contact.kind, side: contact.side, speed: contact.speed });
                if (this.log.length > 50) this.log.shift();
            }
            this._held = this._snapshot(contact);
            this._hold = HOLD;
            showing = this._held;
        } else if (this._hold > 0) {
            this._hold -= dt;
            if (this._hold > 0) showing = this._held;
        }
        this._wasHit = !!contact;

        this._marker.visible = this._link.visible = !!showing;
        const live = !!contact;
        if (showing) {
            const p = showing.point;
            this._marker.position.copy(p);
            const g = this._link.geometry.attributes.position;
            g.setXYZ(0, shipPos.x, shipPos.y, shipPos.z);
            g.setXYZ(1, p.x, p.y, p.z);
            g.needsUpdate = true;
            const o = showing.box;
            this._obsBox.visible = !!o;
            if (o) {
                this._obsBox.position.copy(o.center);
                this._obsBox.scale.copy(o.size);
            }
        } else {
            this._obsBox.visible = false;
        }

        const f = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : '--');
        const lines = ['COLISÃO DEBUG  (F7)  só detecta: sem dano', `enabled ${c.enabled}   impactos ${this.hits}`];
        if (showing) {
            lines.push(
                live ? 'ESTADO  TOCARIA AGORA' : `ESTADO  último impacto (${f(this._hold, 1)}s)`,
                `tipo      ${LABELS[showing.kind] || showing.kind}   lado ${showing.side}`,
                `contato   x ${f(showing.point.x)}  y ${f(showing.point.y)}  z ${f(showing.point.z)}  (cena)`,
                `distância até o impacto ${f(showing.distance)} u`,
                `velocidade ${f(showing.speed)} u/s`,
                `obstáculo topo ${f(showing.top)}  base ${Number.isFinite(showing.bottom) ? f(showing.bottom) : 'chão'}`
            );
        } else {
            lines.push('ESTADO  livre', `folga do terreno ${f(c.last.clearance)}`);
        }
        const near = this.log.slice(-3).map((e) => `${LABELS[e.kind] || e.kind}/${e.side}@${f(e.speed, 0)}`).join('  ');
        if (near) lines.push(`recentes ${near}`);
        this._hud.textContent = lines.join('\n');
    }

    _snapshot(contact) {
        const o = contact.obstacle;
        const shiftX = this.collision.obstacles.sceneToWorldX(0);
        let box = null;
        if (o && o.kind !== 'terrain' && Number.isFinite(o.bottom) && Number.isFinite(o.top)) {
            box = {
                center: new THREE.Vector3(o.cx - shiftX, (o.bottom + o.top) / 2, o.cz),
                size: new THREE.Vector3(Math.max(o.hx * 2, 0.1), Math.max(o.top - o.bottom, 0.1), Math.max(o.hz * 2, 0.1))
            };
        }
        return {
            kind: contact.kind, side: contact.side, distance: contact.distance, speed: contact.speed,
            point: new THREE.Vector3(contact.x, contact.y, contact.z),
            top: o ? o.top : NaN, bottom: o ? o.bottom : NaN, box
        };
    }
}
