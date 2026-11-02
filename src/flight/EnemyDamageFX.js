import * as THREE from 'three';

// Camada visual de dano em inimigos aéreos. Só observa EnemyManager (hp e lista de inimigos); não altera
// tiros, dano nem colisão. Reutiliza as primitivas de ProjectileImpacts e o ExplosionManager (via ele).
// Pequeno dano: faíscas + fumaça. Dano crítico: fogo no motor + perda de peças. Morte: destroços, fumaça
// preta e fogo persistente (a explosão final continua sendo a do EnemyManager).

const ROCK = (u) => u.type === 'asteroide' || u.type === 'meteoro' || u.isAsteroid;
const DEBRIS_DRIFT = 110; // inimigos vêm em +z; destroços acompanham essa deriva
const _n = new THREE.Vector3();
const _pt = new THREE.Vector3();

export class EnemyDamageFX {
    constructor(enemyManager, impacts) {
        this.enemyManager = enemyManager;
        this.fx = impacts;
        this._track = new Map();
        this._seq = 0;
    }

    _hitPoint(enemy, hitR) {
        let best = null;
        let bd = (hitR + 60) * (hitR + 60);
        for (const v of this.fx.vanished) {
            const d = v.distanceToSquared(enemy.position);
            if (d < bd) { bd = d; best = v; }
        }
        _pt.copy(best || enemy.position);
        return _pt;
    }

    update(dt) {
        const enemies = this.enemyManager.enemies;
        const seen = new Set();
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            const u = e.userData || {};
            if (u.isBoss || typeof u.hp !== 'number') continue;
            seen.add(e);
            let t = this._track.get(e);
            if (!t) {
                t = { maxHp: Math.max(1, u.hp), lastHp: u.hp, emitter: null, lastPos: new THREE.Vector3(), partTimer: 0, id: ++this._seq };
                this._track.set(e, t);
            }
            t.lastPos.copy(e.position);
            if (u.hp < t.lastHp && u.hp > 0) this._onHit(e, u, t);
            t.lastHp = u.hp;
            if (t.emitter) {
                const ratio = u.hp / t.maxHp;
                if (ratio <= 0.34 || u.hp <= 1) {
                    t.emitter.dark = true;
                    t.partTimer -= dt;
                    if (t.partTimer <= 0) {
                        t.partTimer = 0.9 + Math.random() * 0.6;
                        _n.set(Math.random() - 0.5, 0.3, Math.random() - 0.5).normalize();
                        this.fx.debris(e.position, _n, 1, { type: 'metal', size: 3, drift: DEBRIS_DRIFT, world: false });
                    }
                }
                t.emitter.life = Math.max(t.emitter.life, 1);
            }
        }

        for (const [e, t] of this._track) {
            if (seen.has(e)) continue;
            this._track.delete(e);
            const u = e.userData || {};
            if (t.emitter) this.fx.releaseEmitter(t.emitter);
            if (typeof u.hp === 'number' && u.hp <= 0) this._onDeath(u, t);
        }
    }

    _onHit(e, u, t) {
        const hitR = ROCK(u) ? 70 : 55;
        const p = this._hitPoint(e, hitR);
        _n.copy(p).sub(e.position);
        if (_n.lengthSq() < 1) _n.set(0, 0.3, 1);
        _n.normalize();
        const rock = ROCK(u);
        this.fx.burst(p, _n, 1, false);
        this.fx.debris(p, _n, rock ? 3 : 2, { type: rock ? 'rock' : 'metal', size: rock ? 5 : 2.5, drift: DEBRIS_DRIFT, world: false });
        if (rock) return;
        this.fx.puffs(p, 1, { color: 0x6a6a72, size: 7, life: 1.2, drift: DEBRIS_DRIFT * 0.6, world: false });
        const ratio = u.hp / t.maxHp;
        if (!t.emitter && (ratio <= 0.5 || u.hp <= 1)) {
            // Avaria: fogo e fumaça seguem a nave até ela cair ou sair da área.
            t.emitter = this.fx.addEmitter(`enemy${t.id}`, e.position, { level: 3, life: 3, dark: false, scale: 1.6, world: false });
            t.emitter.target = e;
        }
        if (t.emitter && ratio <= 0.34) t.emitter.level = 5;
    }

    _onDeath(u, t) {
        const p = t.lastPos;
        const rock = ROCK(u);
        _n.set(0, 1, 0);
        this.fx.burst(p, _n, 1.4, false);
        this.fx.debris(p, _n, rock ? 7 : 9, { type: rock ? 'rock' : 'metal', size: rock ? 7 : 4, speed: 1.2, drift: DEBRIS_DRIFT, world: false });
        if (rock) return;
        this.fx.puffs(p, 5, { color: 0x1c1c20, size: 14, life: 2.6, drift: DEBRIS_DRIFT, world: false });
        // Carcaça em chamas por alguns segundos, deslizando para trás da cena.
        const em = this.fx.addEmitter(`wreck${t.id}`, p, { level: 5, life: 4, dark: true, scale: 2, world: false });
        em.vz = DEBRIS_DRIFT;
    }
}
