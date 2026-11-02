import * as THREE from 'three';

// Modo teste de voo (?flighttest ou F4): planície aberta, montanhas ao fundo, pilares de referência
// no mundo 3D e uma cidade distante (Nova York) à frente. Serve para validar a sensação de voo
// antes de ligar a colisão. Não altera armas, inimigos, boss nem o GLB; a colisão segue desligada.
//
// Teclas: 1/2/3 = altitude baixa/média/alta (altitude hold; qualquer comando vertical cancela),
// 4 = soltar, 5 = inimigos liga/desliga, 6 = explosão no pilar à frente (deve ficar ancorada),
// -/= = velocidade de cruzeiro, [/] = atraso da câmera, ;/' = FOV base.

const ROW_SPACING = 800;
const ROWS = [
    [{ x: -90, h: 80 }],
    [{ x: 70, h: 220 }],
    [{ x: -62, h: 150 }, { x: 62, h: 150 }], // portal: 124 de vão (a nave tem ~12)
    [{ x: 0, h: 380 }],
    [{ x: -110, h: 60 }, { x: 110, h: 300 }],
    [{ x: 30, h: 120 }]
];
const CYCLE = ROW_SPACING * ROWS.length;
const PRESETS = { Digit1: 35, Digit2: 160, Digit3: 520 };
const PRESET_NAMES = { Digit1: 'baixa', Digit2: 'média', Digit3: 'alta' };
const PYLON_W = 14;

function stripeTexture() {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#ff7a2a';
    g.fillRect(0, 0, 4, 32);
    g.fillStyle = '#f4f4f4';
    g.fillRect(0, 32, 4, 32);
    const t = new THREE.CanvasTexture(c);
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export class FlightTestMode {
    constructor({ scene, biomes, ship, collision, obstacles, chaseCamera, enemyManager, explosionManager, debug }) {
        Object.assign(this, { scene, biomes, ship, collision, obstacles, chaseCamera, enemyManager, explosionManager, debug });
        this.enabled = new URLSearchParams(window.location.search).has('flighttest');
        this.targetAlt = null;
        this.targetName = '';
        this.enemiesOn = false;
        this.speedMul = 1;
        this.extras = [];
        this._pylons = [];
        this._group = new THREE.Group();
        this._group.visible = false;
        scene.add(this._group);
        this._panel = null;
        this._frame = 0;
        this._tmpA = new THREE.Vector3();
        this._checks = { origin: 0, anchor: 0, enemies: 0, enemyBad: 0 };

        window.addEventListener('keydown', (e) => {
            if (e.code === 'F4') {
                e.preventDefault();
                this.setEnabled(!this.enabled);
                return;
            }
            if (this.enabled && !e.repeat) this._key(e.code);
        });
    }

    setEnabled(on) {
        this.enabled = on;
        this._group.visible = on;
        if (on) {
            this.begin();
        } else {
            this.obstacles.extras = null;
            this.targetAlt = null;
            this.biomes.speedMul = 1;
            if (this._panel) this._panel.style.display = 'none';
        }
    }

    // Monta o cenário de teste: planície agora, cidade distante à frente (a transição é a normal do jogo).
    begin() {
        if (!this.enabled) return;
        this._build();
        this._group.visible = true;
        this.biomes.setLevel(1, { instant: true });
        this.biomes.setLevel(5);
        this.debug.setEnabled(true);
        this._respawnPylons();
        this.obstacles.extras = this.extras;
        this._panel.style.display = 'block';
    }

    _build() {
        if (this._pylons.length) return;
        const tex = stripeTexture();
        for (let r = 0; r < ROWS.length; r++) {
            for (const spec of ROWS[r]) {
                const geo = new THREE.BoxGeometry(PYLON_W, spec.h, PYLON_W);
                const uv = geo.attributes.uv;
                for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (spec.h / 60));
                const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, fog: false }));
                mesh.frustumCulled = false;
                this._group.add(mesh);
                this._pylons.push({ mesh, row: r, x: spec.x, h: spec.h, worldZ: 0 });
                // cz distante até o primeiro update posicionar o pilar (evita contato falso na origem).
                this.extras.push({ kind: 'pylon', bottom: 0, top: 0, cx: spec.x, cz: 1e9, hx: PYLON_W / 2, hz: PYLON_W / 2 });
            }
        }
        const p = document.createElement('pre');
        p.style.cssText = 'position:fixed;right:8px;top:8px;margin:0;padding:8px 10px;z-index:9999;pointer-events:none;display:none;'
            + 'font:11px/1.35 monospace;color:#ffe9a8;background:rgba(10,6,0,.62);border:1px solid #c80;border-radius:4px;white-space:pre';
        document.body.appendChild(p);
        this._panel = p;
    }

    _respawnPylons() {
        const z0 = this.ship.renderOrigin.z;
        for (const p of this._pylons) p.worldZ = z0 - 700 - p.row * ROW_SPACING;
    }

    _key(code) {
        const tune = this.chaseCamera.tuning;
        if (PRESETS[code] !== undefined) {
            this.targetAlt = PRESETS[code];
            this.targetName = PRESET_NAMES[code];
        } else if (code === 'Digit4') {
            this.targetAlt = null;
        } else if (code === 'Digit5') {
            this.enemiesOn = !this.enemiesOn;
        } else if (code === 'Digit6') {
            this._explodeAtNextPylon();
        } else if (code === 'Minus') {
            this.speedMul = Math.max(0.5, this.speedMul - 0.1);
        } else if (code === 'Equal') {
            this.speedMul = Math.min(2, this.speedMul + 0.1);
        } else if (code === 'BracketLeft') {
            tune.lag = Math.max(1.5, tune.lag - 0.5);
        } else if (code === 'BracketRight') {
            tune.lag = Math.min(12, tune.lag + 0.5);
        } else if (code === 'Semicolon') {
            tune.baseFov = Math.max(55, tune.baseFov - 2);
        } else if (code === 'Quote') {
            tune.baseFov = Math.min(95, tune.baseFov + 2);
        }
    }

    _explodeAtNextPylon() {
        let best = null;
        for (let i = 0; i < this._pylons.length; i++) {
            const sz = this._pylons[i].worldZ - this.ship.renderOrigin.z;
            if (sz < 0 && (!best || sz > best.sz)) best = { i, sz };
        }
        if (!best) return;
        const p = this._pylons[best.i];
        this.explosionManager.create(this._tmpA.set(p.x - this.ship.renderOrigin.x, this.extras[best.i].top, best.sz), 2.5);
    }

    // Altitude hold: só atua sem comando vertical do jogador e entra como input normal (o jogador manda).
    assist(input) {
        if (!this.enabled) return;
        if (Math.abs(input.y) > 0.1) {
            this.targetAlt = null;
        } else if (this.targetAlt !== null) {
            input.y = THREE.MathUtils.clamp((this.targetAlt - this.ship.altitude) * 0.02, -1, 1);
        }
        this.biomes.speedMul = this.speedMul;
        const em = this.enemyManager;
        if (!this.enemiesOn) {
            em.waveTimer = -1e6;
            em.formationTimer = 1e6;
        } else if (em.waveTimer < 0) {
            em.waveTimer = 0;
            em.formationTimer = 1;
        }
    }

    update(shipPos) {
        if (!this.enabled || !this._panel) return;
        const ro = this.ship.renderOrigin;

        let anchor = 0;
        for (let i = 0; i < this._pylons.length; i++) {
            const p = this._pylons[i];
            if (p.worldZ - ro.z > 260) p.worldZ -= CYCLE;
            const sx = p.x - ro.x;
            const sz = p.worldZ - ro.z;
            const ground = this.biomes.groundHeightAt(sx, sz);
            p.mesh.position.set(sx, ground - 3 + p.h / 2, sz);
            const e = this.extras[i];
            e.cx = p.x;
            e.cz = sz;
            e.bottom = ground - 3;
            e.top = ground - 3 + p.h;
            // O pilar tem de continuar no mesmo ponto do mundo definido, qualquer que seja a origem.
            anchor = Math.max(anchor, Math.abs(sx + ro.x - p.x), Math.abs(sz + ro.z - p.worldZ));
        }

        const w = this.ship.worldPosition;
        this._checks.origin = Math.max(
            Math.abs(w.x - (ro.x + shipPos.x)), Math.abs(w.y - (ro.y + shipPos.y)), Math.abs(w.z - (ro.z + shipPos.z))
        );
        this._checks.anchor = anchor;

        const en = this.enemyManager.enemies;
        let bad = 0;
        for (let i = 0; i < en.length; i++) {
            const q = en[i].position;
            if (!Number.isFinite(q.x + q.y + q.z) || Math.abs(q.z - shipPos.z) > 6000) bad++;
        }
        this._checks.enemies = en.length;
        this._checks.enemyBad = bad;

        if (++this._frame % 6 === 0) this._render(shipPos);
    }

    _render(shipPos) {
        const s = this.ship;
        const cam = this.chaseCamera;
        const f = (n, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : '--');
        const alt = s.altitude;
        const band = alt < 70 ? 'RASANTE' : alt < 280 ? 'MÉDIA' : 'ALTA';
        const nextP = this._nextPylon();
        const ok = (v) => (v ? 'OK  ' : 'ERRO');
        this._panel.textContent = [
            'MODO TESTE DE VOO  (F4)',
            '1/2/3 altitude baixa/média/alta   4 soltar',
            `5 inimigos ${this.enemiesOn ? 'ON' : 'off'}   6 explosão no pilar`,
            "-/= velocidade   [/] atraso cam   ;/' FOV",
            '',
            `altitude ${f(alt)} (${band})  hold ${this.targetAlt === null ? '--' : `${this.targetName} ${this.targetAlt}`}`,
            `avanço ${f(s.cruiseSpeed)} u/s (x${this.speedMul.toFixed(1)})  FOV ${f(cam.camera.fov, 1)} (base ${cam.tuning.baseFov})`,
            `atraso câmera ${cam.tuning.lag.toFixed(1)}  folga câmera-nave x ${f(Math.abs(cam.pos.x - shipPos.x), 1)}`,
            nextP
                ? `próximo pilar ${f(nextP.dz)} u (${f(nextP.dz / Math.max(s.cruiseSpeed, 1), 1)} s)  topo ${f(nextP.top)}  ${nextP.top > shipPos.y ? 'ACIMA da nave' : 'abaixo da nave'}`
                : 'próximo pilar --',
            '',
            `[${ok(this._checks.origin < 1e-3)}] nave: mundo = origem + cena (${this._checks.origin.toExponential(1)})`,
            `[${ok(this._checks.anchor < 1e-2)}] pilares ancorados no mundo (${this._checks.anchor.toExponential(1)})`,
            `[${ok(this._checks.enemyBad === 0)}] inimigos ${this._checks.enemies}, fora do espaço: ${this._checks.enemyBad}`,
            `colisão: ${this.collision.enabled ? 'ATIVA' : 'desligada'}`
        ].join('\n');
    }

    _nextPylon() {
        let best = null;
        for (let i = 0; i < this._pylons.length; i++) {
            const dz = this.ship.renderOrigin.z - this._pylons[i].worldZ;
            if (dz > 0 && (!best || dz < best.dz)) best = { dz, top: this.extras[i].top };
        }
        return best;
    }
}
