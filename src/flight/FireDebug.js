import * as THREE from 'three';

const LEN = 260;

// Debug opcional dos tiros (F6 ou ?debug=fire). Só lê o estado do Player: não altera armas nem disparos.
// Verde = direção do tiro (mira), ciano = direção do nariz do modelo, amarelo = pontos de spawn (bico e asas).
export class FireDebug {
    constructor(scene, player) {
        this.player = player;
        this.enabled = new URLSearchParams(window.location.search).get('debug') === 'fire';
        this._group = new THREE.Group();
        this._group.visible = false;
        scene.add(this._group);
        this._hud = null;
        this._q = new THREE.Quaternion();
        this._d = new THREE.Vector3();
        this._n = new THREE.Vector3();
        this._p = new THREE.Vector3();

        const mat = (c) => new THREE.LineBasicMaterial({ color: c, depthTest: false, transparent: true, opacity: 0.95 });
        const line = (c) => {
            const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), mat(c));
            l.renderOrder = 1000;
            l.frustumCulled = false;
            this._group.add(l);
            return l;
        };
        this._shotLines = [line(0x44ff44), line(0x44ff44), line(0x44ff44)];
        this._noseLine = line(0x22ddff);
        const crossGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-1.5, 0, 0), new THREE.Vector3(1.5, 0, 0),
            new THREE.Vector3(0, -1.5, 0), new THREE.Vector3(0, 1.5, 0),
            new THREE.Vector3(0, 0, -1.5), new THREE.Vector3(0, 0, 1.5)
        ]);
        this._crosses = [0, 1, 2].map(() => {
            const c = new THREE.LineSegments(crossGeo, mat(0xffee00));
            c.renderOrder = 1001;
            c.frustumCulled = false;
            this._group.add(c);
            return c;
        });

        window.addEventListener('keydown', (e) => {
            if (e.code === 'F6') {
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
            this._hud.style.cssText = 'position:fixed;left:8px;bottom:8px;margin:0;padding:6px 9px;z-index:9999;pointer-events:none;'
                + 'font:11px/1.35 monospace;color:#bff;background:rgba(0,10,12,.62);border:1px solid #2aa;border-radius:4px;white-space:pre';
            document.body.appendChild(this._hud);
        }
        if (this._hud) this._hud.style.display = on ? 'block' : 'none';
    }

    update() {
        const pl = this.player;
        if (!this.enabled || !pl.shipModel) return;
        pl.mesh.updateMatrixWorld();
        pl.shipModel.updateMatrixWorld();

        pl._getAimQuat(this._q);
        this._d.set(0, 0, 1).applyQuaternion(this._q).normalize();
        pl.shipModel.getWorldQuaternion(this._q);
        this._n.set(0, 0, 1).applyQuaternion(this._q).normalize();

        const spawns = [pl.gunLeft, pl.gunRight, pl.gunNose];
        for (let i = 0; i < 3; i++) {
            this._p.copy(spawns[i]).applyMatrix4(pl.shipModel.matrixWorld);
            this._crosses[i].position.copy(this._p);
            const g = this._shotLines[i].geometry.attributes.position;
            g.setXYZ(0, this._p.x, this._p.y, this._p.z);
            g.setXYZ(1, this._p.x + this._d.x * LEN, this._p.y + this._d.y * LEN, this._p.z + this._d.z * LEN);
            g.needsUpdate = true;
            if (i === 2) {
                const n = this._noseLine.geometry.attributes.position;
                n.setXYZ(0, this._p.x, this._p.y, this._p.z);
                n.setXYZ(1, this._p.x + this._n.x * LEN, this._p.y + this._n.y * LEN, this._p.z + this._n.z * LEN);
                n.needsUpdate = true;
            }
        }

        // Diferença entre a mira e o nariz visual (o roll não entra: gira em torno do eixo de tiro).
        const err = THREE.MathUtils.radToDeg(this._d.angleTo(this._n));
        const f = (v) => v.toFixed(2);
        this._hud.textContent = [
            'FIRE DEBUG  (F6)',
            `tiro  (${f(this._d.x)}, ${f(this._d.y)}, ${f(this._d.z)})`,
            `nariz (${f(this._n.x)}, ${f(this._n.y)}, ${f(this._n.z)})`,
            `erro mira x nariz ${err.toFixed(2)}°`,
            `bico  (${f(this._crosses[2].position.x)}, ${f(this._crosses[2].position.y)}, ${f(this._crosses[2].position.z)})`
        ].join('\n');
        this.lastError = err;
    }
}
