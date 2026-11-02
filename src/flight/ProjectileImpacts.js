import * as THREE from 'three';

// Camada visual de impactos (separada dos tiros, da colisão e do movimento). Segue cada laser do jogador e
// detecta quando ele entra em prédio, ponte, árvore, rocha ou terreno (via WorldObstacles) e mostra a reação:
// faíscas, clarão, destroços, fumaça, fogo persistente e marcas de queimado. Nada altera o tiro nem o obstáculo.
// Também expõe primitivas (burst, puffs, debris, emissores) usadas por EnemyDamageFX para aeronaves.
// O que pertence ao cenário acompanha o scroll; o que pertence a inimigos fica na cena (como as explosões).

const POOL = 16;
const SPARKS = 14;
const LIFE = 0.5;
const STEP = 24;
const REFINE = 7;
const MAX_Y = 1600;
const BUILD_S = 220;

const MAX_DAMAGED = 10; // obstáculos com dano visual ao mesmo tempo (a cidade não é destruída)
const MAX_EMITTERS = 16;
const SMOKE_POOL = 160;
const DEBRIS_POOL = 40;
const DEBRIS_LIFE = 1.8;
const DECAL_POOL = 20;
const DECAL_LIFE = 16;
const PROP_BUDGET = 48; // amostras de árvores/rochas por quadro (cada uma varre as instâncias)
const PROP_MAX_HEIGHT = 130;
const FACADE_BLAST_GAP = 0.45; // s entre explosões de fachada (reuso do ExplosionManager)

const DEBRIS_COLORS = { concrete: 0x6a6a74, metal: 0x3a404c, rock: 0x5a5148, wood: 0x4a3a28 };

const _prev = new THREE.Vector3();
const _p = new THREE.Vector3();
const _lo = new THREE.Vector3();
const _hi = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _n = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
const _list = [];

function radialTexture(stops) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    for (const [o, col] of stops) gr.addColorStop(o, col);
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export class ProjectileImpacts {
    constructor(scene, laserManager, obstacles, explosionManager = null) {
        this.scene = scene;
        this.laserManager = laserManager;
        this.obstacles = obstacles;
        this.explosionManager = explosionManager;
        this.enabled = true;
        this.count = 0;
        this.last = null; // { kind, point, hits } do último impacto detectado
        this.vanished = []; // posições finais de lasers removidos antes de expirar (acertaram algo)
        this._state = new Map();
        this._cur = new Set();
        this._active = [];
        this._pool = [];
        this._damaged = new Map();
        this._emitters = [];
        this._puffs = [];
        this._debris = [];
        this._decals = [];
        this._glowPool = [];
        this._scroll = null;
        this._propBudget = PROP_BUDGET;
        this._blastCool = 0;
        this._terrainHit = { kind: 'terrain', bottom: -Infinity, top: 0, cx: 0, cz: 0, hx: 0, hz: 0 };

        const glow = radialTexture([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,200,120,0.85)'], [1, 'rgba(255,120,40,0)']]);
        const smoke = radialTexture([[0, 'rgba(90,90,96,0.8)'], [0.55, 'rgba(70,70,76,0.45)'], [1, 'rgba(50,50,56,0)']]);
        const scorch = radialTexture([[0, 'rgba(0,0,0,0.9)'], [0.5, 'rgba(10,8,6,0.6)'], [1, 'rgba(0,0,0,0)']]);
        this._glow = glow;

        for (let i = 0; i < POOL; i++) {
            const flash = new THREE.Sprite(new THREE.SpriteMaterial({
                map: glow, color: 0xffc27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
            }));
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
            const sparks = new THREE.Points(geo, new THREE.PointsMaterial({
                color: 0xffe0a0, size: 3.2, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false
            }));
            sparks.frustumCulled = false;
            const group = new THREE.Group();
            group.add(flash, sparks);
            group.visible = false;
            group.userData = { flash, sparks, vel: new Float32Array(SPARKS * 3), life: 0, base: 26, world: true };
            this._pool.push(group);
        }

        this._smokePool = [];
        for (let i = 0; i < SMOKE_POOL; i++) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smoke, transparent: true, depthWrite: false, fog: false }));
            s.visible = false;
            s.userData = { life: 0, max: 1, vel: new THREE.Vector3(), size: 10, world: true };
            this._smokePool.push(s);
        }

        const debrisGeo = new THREE.BoxGeometry(1, 1, 1);
        this._debrisMats = {};
        for (const k of Object.keys(DEBRIS_COLORS)) this._debrisMats[k] = new THREE.MeshLambertMaterial({ color: DEBRIS_COLORS[k] });
        this._debrisPool = [];
        for (let i = 0; i < DEBRIS_POOL; i++) {
            const m = new THREE.Mesh(debrisGeo, this._debrisMats.concrete);
            m.visible = false;
            m.userData = { life: 0, vel: new THREE.Vector3(), spin: new THREE.Vector3(), world: true };
            this._debrisPool.push(m);
        }

        const decalGeo = new THREE.PlaneGeometry(1, 1);
        this._decalPool = [];
        for (let i = 0; i < DECAL_POOL; i++) {
            const d = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({
                map: scorch, transparent: true, depthWrite: false, fog: true,
                polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
            }));
            d.visible = false;
            d.userData = { life: 0 };
            this._decalPool.push(d);
        }
    }

    // Obstáculo (terreno, estrutura, árvore, rocha) que contém o ponto de cena, ou null.
    _hitAt(p) {
        if (p.y > MAX_Y) return null;
        const b = this.obstacles.biomes;
        const ground = b.groundHeightAt(p.x, p.z);
        if (p.y <= ground) {
            this._terrainHit.top = ground;
            this._terrainHit.cx = this.obstacles.sceneToWorldX(p.x);
            this._terrainHit.cz = p.z;
            return this._terrainHit;
        }
        const withProps = p.y - ground < PROP_MAX_HEIGHT && this._propBudget > 0;
        if (withProps) this._propBudget--;
        _list.length = 0;
        this.obstacles.sampleScene(p.x, p.z, _list, { terrain: false, props: withProps });
        for (const o of _list) if (p.y >= o.bottom && p.y <= o.top) return o;
        return null;
    }

    update(dt) {
        const scroll = this.obstacles?.biomes?.u?.uScroll?.value ?? 0;
        let ds = this._scroll === null ? 0 : scroll - this._scroll;
        this._scroll = scroll;
        if (!Number.isFinite(ds) || Math.abs(ds) > 2000) ds = 0;
        if (ds) this._followScroll(ds);
        this._propBudget = PROP_BUDGET;
        this._blastCool = Math.max(0, this._blastCool - dt);
        this.vanished.length = 0;
        if (this.enabled && this.obstacles) this._detect();
        this._animate(dt);
        this._animateDamage(dt);
        this._animateDecals(dt);
    }

    // O cenário avança em +z; o que está preso a ele avança junto.
    _followScroll(ds) {
        for (const g of this._active) if (g.userData.world) g.position.z += ds;
        for (const e of this._emitters) if (e.world && !e.target) e.pos.z += ds;
        for (const s of this._puffs) if (s.userData.world) s.position.z += ds;
        for (const d of this._debris) if (d.userData.world) d.position.z += ds;
        for (const d of this._decals) d.position.z += ds;
    }

    _detect() {
        const lasers = this.laserManager.lasers;
        this._cur.clear();
        for (let i = 0; i < lasers.length; i++) this._cur.add(lasers[i]);

        // Laser que sumiu com vida sobrando acertou algo (inimigo, boss...): guarda onde.
        for (const [laser, st] of this._state) {
            if (this._cur.has(laser)) continue;
            if (st.life > 0.15) this.vanished.push(st.prev.clone());
            this._state.delete(laser);
        }

        for (let i = 0; i < lasers.length; i++) {
            const laser = lasers[i];
            let st = this._state.get(laser);
            const life = laser.userData.life;
            // Lasers são reaproveitados do pool: vida maior que a registrada = novo disparo.
            if (!st) { st = { prev: laser.position.clone(), life, hit: false }; this._state.set(laser, st); continue; }
            if (life > st.life) { st.prev.copy(laser.position); st.hit = false; st.life = life; continue; }
            st.life = life;
            _prev.copy(st.prev);
            st.prev.copy(laser.position);
            if (st.hit) continue;

            const dist = _prev.distanceTo(laser.position);
            const n = Math.max(1, Math.ceil(dist / STEP));
            _lo.copy(_prev);
            for (let s = 1; s <= n; s++) {
                _p.lerpVectors(_prev, laser.position, s / n);
                const o = this._hitAt(_p);
                if (o) {
                    _hi.copy(_p);
                    this._spawn(_lo, _hi, o, laser.userData.direction);
                    st.hit = true;
                    break;
                }
                _lo.copy(_p);
            }
        }
    }

    _spawn(outside, inside, obstacle, dir) {
        // Refina o ponto de entrada entre a última amostra fora e a primeira dentro.
        _lo.copy(outside);
        _hi.copy(inside);
        for (let i = 0; i < REFINE; i++) {
            _mid.addVectors(_lo, _hi).multiplyScalar(0.5);
            if (this._hitAt(_mid)) _hi.copy(_mid); else _lo.copy(_mid);
        }
        const point = _hi.clone();

        // Normal da face atingida: eixo com menor penetração relativa na caixa do obstáculo.
        const wx = this.obstacles.sceneToWorldX(point.x);
        const fx = obstacle.hx ? Math.abs(wx - obstacle.cx) / obstacle.hx : 0;
        const fz = obstacle.hz ? Math.abs(point.z - obstacle.cz) / obstacle.hz : 0;
        const fy = Math.abs(point.y - obstacle.top) / Math.max(1, (obstacle.top - obstacle.bottom) * 0.5);
        _n.set(0, 0, 0);
        if (fy < 0.05 && fy <= Math.max(fx, fz)) _n.y = 1;
        else if (fx > fz) _n.x = Math.sign(wx - obstacle.cx) || 1;
        else _n.z = Math.sign(point.z - obstacle.cz) || 1;
        if (_n.dot(dir) > 0) _n.negate();
        const normal = _n.clone();

        this.count++;
        const kind = obstacle.kind;
        let hits = 0;
        if (kind === 'building') hits = this._damageBuilding(obstacle, point, normal);
        else if (kind === 'tree') hits = this._damageTree(obstacle, point, normal);
        else if (kind === 'terrain') this._dust(point);
        else if (kind !== 'bridge') this._debrisAt(point, normal, 3, { type: 'rock' });
        if (kind === 'building' || kind === 'bridge') this._addDecal(point, normal, hits);
        this.last = { kind, point: point.clone(), hits };
        this._emit(point, normal, hits ? 1 + Math.min(hits, 5) * 0.35 : 1);
    }

    _keyFor(obstacle) {
        const rel = (obstacle.cz - this._scroll);
        return obstacle.kind === 'building'
            ? `b|${Math.round(obstacle.cx)}|${Math.round(rel / BUILD_S)}`
            : `${obstacle.kind}|${Math.round(obstacle.cx / 12)}|${Math.round(rel / 12)}`;
    }

    _touch(key) {
        let d = this._damaged.get(key);
        if (!d) {
            if (this._damaged.size >= MAX_DAMAGED) this._damaged.delete(this._damaged.keys().next().value);
            d = { hits: 0 };
            this._damaged.set(key, d);
        }
        d.hits++;
        return d.hits;
    }

    // Prédio: faíscas, explosão na fachada (ExplosionManager), fumaça preta, fogo, destroços e pedaços da fachada.
    _damageBuilding(obstacle, point, normal) {
        const key = this._keyFor(obstacle);
        const hits = this._touch(key);
        this._attachEmitter(key, point, normal, { level: hits, life: 4 + Math.min(hits, 6) * 2.5, dark: true, scale: 1, world: true });
        this._debrisAt(point, normal, Math.min(3 + hits * 2, 10), { type: 'concrete' });
        if (hits >= 3) this._debrisAt(point, normal, 1 + Math.min(hits, 5), { type: 'concrete', size: 9, speed: 0.55 });
        this._facadeBlast(point, hits);
        return hits;
    }

    // Árvore: pega fogo no primeiro impacto e fica queimando alguns segundos.
    _damageTree(obstacle, point, normal) {
        const key = this._keyFor(obstacle);
        const hits = this._touch(key);
        this._attachEmitter(key, point, normal, { level: 3 + Math.min(hits, 2), life: 6, dark: false, scale: 0.7, world: true });
        this._debrisAt(point, normal, 3, { type: 'wood', size: 2.5 });
        return hits;
    }

    _facadeBlast(point, hits) {
        if (!this.explosionManager || this._blastCool > 0 || hits < 2) return;
        this._blastCool = FACADE_BLAST_GAP;
        this.explosionManager.create(point, {
            scale: hits >= 4 ? 1.0 : 0.6,
            flashColor: 0xfff0d0,
            lightColor: 0xff8a30
        });
    }

    _attachEmitter(key, point, normal, o) {
        let em = this._emitters.find((e) => e.key === key && e.pos.distanceToSquared(point) < 80 * 80);
        if (!em) {
            if (this._emitters.length >= MAX_EMITTERS) this.releaseEmitter(this._emitters.shift());
            em = { key, pos: new THREE.Vector3(), life: 0, timer: 0, level: 0, glow: null, target: null, vz: 0, dark: true, scale: 1, world: true };
            this._emitters.push(em);
        }
        em.pos.copy(point).addScaledVector(normal, 2);
        em.level = Math.max(em.level, o.level);
        em.life = Math.max(em.life, o.life);
        em.dark = o.dark;
        em.scale = o.scale;
        em.world = o.world;
        return em;
    }

    // ---- API usada também por EnemyDamageFX ----
    addEmitter(key, point, o) {
        return this._attachEmitter(key, point, _z, o);
    }

    releaseEmitter(e) {
        if (!e) return;
        if (e.glow) {
            this.scene.remove(e.glow);
            this._glowPool.push(e.glow);
            e.glow = null;
        }
        const i = this._emitters.indexOf(e);
        if (i >= 0) this._emitters.splice(i, 1);
    }

    burst(point, normal, strength = 1, world = true) {
        this._emit(point, normal, strength, world);
    }

    debris(point, normal, n, opts) {
        this._debrisAt(point, normal, n, opts);
    }

    puffs(point, n, { color = 0xffffff, size = 8, life = 1.6, drift = 0, world = true } = {}) {
        for (let i = 0; i < n; i++) this._puff(point, { color, size, life, drift, world });
    }

    _debrisAt(point, normal, n, { type = 'concrete', size = 0, speed = 1, drift = 0, world = true } = {}) {
        for (let i = 0; i < n; i++) {
            const m = this._debrisPool.pop();
            if (!m) return;
            const u = m.userData;
            m.material = this._debrisMats[type] || this._debrisMats.concrete;
            u.life = DEBRIS_LIFE * (0.6 + Math.random() * 0.4);
            u.world = world;
            const s = size || 2 + Math.random() * 5;
            const sp = (25 + Math.random() * 85) * speed;
            u.vel.set(
                (normal.x * 0.8 + (Math.random() - 0.5)) * sp,
                (normal.y * 0.8 + Math.random() * 0.7) * sp,
                (normal.z * 0.8 + (Math.random() - 0.5)) * sp + drift
            );
            u.spin.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
            m.position.copy(point);
            m.scale.set(s, s * (0.5 + Math.random()), s);
            m.visible = true;
            this.scene.add(m);
            this._debris.push(m);
        }
    }

    _dust(point) {
        for (let i = 0; i < 3; i++) this._puff(point, { color: 0x9a8a70, size: 7, life: 1.1, drift: 0, world: true });
    }

    _puff(point, { color, size, life, drift, world }) {
        const s = this._smokePool.pop();
        if (!s) return;
        const u = s.userData;
        u.max = u.life = life * (0.8 + Math.random() * 0.4);
        u.size = size * (0.8 + Math.random() * 0.5);
        u.world = world;
        u.vel.set((Math.random() - 0.5) * 10, 18 + Math.random() * 16, (Math.random() - 0.5) * 10 + drift);
        s.position.copy(point);
        s.material.color.setHex(color);
        s.material.opacity = 0.8;
        s.visible = true;
        this.scene.add(s);
        this._puffs.push(s);
    }

    // Marca de queimado na face atingida, com fade; mais escura/maior em prédios muito atingidos.
    _addDecal(point, normal, hits) {
        const d = this._decalPool.pop() || this._decals.shift();
        if (!d) return;
        const u = d.userData;
        u.life = DECAL_LIFE;
        const size = 12 + Math.random() * 8 + Math.min(hits, 6) * 2.5;
        d.scale.set(size, size, 1);
        d.position.copy(point).addScaledVector(normal, 0.8);
        d.quaternion.setFromUnitVectors(_z, normal);
        d.rotateZ(Math.random() * Math.PI * 2);
        d.material.opacity = 0.9;
        d.visible = true;
        if (!d.parent) this.scene.add(d);
        this._decals.push(d);
    }

    _emit(point, normal, strength = 1, world = true) {
        const g = this._active.length >= POOL ? this._active.shift() : this._pool.pop();
        if (!g) return;
        const { flash, sparks, vel } = g.userData;
        g.position.copy(point).addScaledVector(normal, 1.5);
        g.userData.life = LIFE;
        g.userData.base = 26 * strength;
        g.userData.world = world;
        g.visible = true;
        if (!g.parent) this.scene.add(g);
        flash.scale.setScalar(g.userData.base);
        flash.material.opacity = 1;
        sparks.material.opacity = 1;
        const pos = sparks.geometry.attributes.position.array;
        const spd = strength > 1 ? 1.4 : 1;
        for (let i = 0; i < SPARKS; i++) {
            const sp = (40 + Math.random() * 90) * spd;
            vel[i * 3] = (normal.x * 0.9 + (Math.random() - 0.5) * 1.3) * sp;
            vel[i * 3 + 1] = (normal.y * 0.9 + Math.random() * 0.6 + (Math.random() - 0.5) * 0.9) * sp;
            vel[i * 3 + 2] = (normal.z * 0.9 + (Math.random() - 0.5) * 1.3) * sp;
            pos[i * 3] = pos[i * 3 + 1] = pos[i * 3 + 2] = 0;
        }
        sparks.geometry.attributes.position.needsUpdate = true;
        this._active.push(g);
    }

    _animate(dt) {
        for (let i = this._active.length - 1; i >= 0; i--) {
            const g = this._active[i];
            const d = g.userData;
            d.life -= dt;
            if (d.life <= 0) {
                g.visible = false;
                this.scene.remove(g);
                this._pool.push(g);
                this._active.splice(i, 1);
                continue;
            }
            const k = d.life / LIFE;
            d.flash.scale.setScalar(d.base + (1 - k) * d.base * 0.7);
            d.flash.material.opacity = k * k;
            d.sparks.material.opacity = k;
            const pos = d.sparks.geometry.attributes.position.array;
            for (let j = 0; j < SPARKS; j++) {
                d.vel[j * 3 + 1] -= 90 * dt;
                pos[j * 3] += d.vel[j * 3] * dt;
                pos[j * 3 + 1] += d.vel[j * 3 + 1] * dt;
                pos[j * 3 + 2] += d.vel[j * 3 + 2] * dt;
            }
            d.sparks.geometry.attributes.position.needsUpdate = true;
        }
    }

    _animateDamage(dt) {
        const now = performance.now();
        for (let i = this._emitters.length - 1; i >= 0; i--) {
            const e = this._emitters[i];
            e.life -= dt;
            if (e.target) {
                if (e.target.parent) e.pos.copy(e.target.position);
                else e.target = null;
            } else if (e.vz) {
                e.pos.z += e.vz * dt;
            }
            if (e.life <= 0) {
                this.releaseEmitter(e);
                continue;
            }
            const fade = Math.min(1, e.life / 1.5);
            // Fogo visível a partir do nível 3 (3º impacto em prédio, ou direto em árvore/aeronave crítica).
            if (e.level >= 3) {
                if (!e.glow) e.glow = this._takeGlow();
                e.glow.position.copy(e.pos);
                e.glow.scale.setScalar((14 + e.level * 3 + Math.sin(now * 0.03 + i) * 3) * e.scale);
                e.glow.material.opacity = 0.85 * fade;
            }
            e.timer -= dt;
            if (e.timer <= 0) {
                e.timer = Math.max(0.08, 0.26 - e.level * 0.03);
                const lvl = Math.min(e.level, 6);
                this._puff(e.pos, {
                    color: e.dark ? 0x1c1c20 : 0xb4b4b8,
                    size: (7 + lvl * 2.2) * e.scale,
                    life: 2 + lvl * 0.25,
                    drift: e.vz || 0,
                    world: e.world
                });
            }
        }

        for (let i = this._puffs.length - 1; i >= 0; i--) {
            const s = this._puffs[i];
            const u = s.userData;
            u.life -= dt;
            if (u.life <= 0) {
                s.visible = false;
                this.scene.remove(s);
                this._smokePool.push(s);
                this._puffs.splice(i, 1);
                continue;
            }
            const k = u.life / u.max;
            s.position.addScaledVector(u.vel, dt);
            s.scale.setScalar(u.size * (1.4 - k * 0.9) * 2);
            s.material.opacity = Math.min(1, k * 1.6) * 0.85;
        }

        for (let i = this._debris.length - 1; i >= 0; i--) {
            const m = this._debris[i];
            const u = m.userData;
            u.life -= dt;
            if (u.life <= 0) {
                m.visible = false;
                this.scene.remove(m);
                this._debrisPool.push(m);
                this._debris.splice(i, 1);
                continue;
            }
            u.vel.y -= 140 * dt;
            m.position.addScaledVector(u.vel, dt);
            m.rotation.x += u.spin.x * dt;
            m.rotation.y += u.spin.y * dt;
            m.rotation.z += u.spin.z * dt;
        }
    }

    _animateDecals(dt) {
        for (let i = this._decals.length - 1; i >= 0; i--) {
            const d = this._decals[i];
            d.userData.life -= dt;
            if (d.userData.life <= 0) {
                d.visible = false;
                this.scene.remove(d);
                this._decalPool.push(d);
                this._decals.splice(i, 1);
                continue;
            }
            d.material.opacity = 0.9 * Math.min(1, d.userData.life / 3);
        }
    }

    _takeGlow() {
        const s = this._glowPool.pop() || new THREE.Sprite(new THREE.SpriteMaterial({
            map: this._glow, color: 0xff7a30, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
        }));
        this.scene.add(s);
        return s;
    }

    // Os efeitos ficam parados no mundo quando a origem de render se desloca.
    shiftWorld(dx, dy = 0) {
        if (!dx && !dy) return;
        for (const g of this._active) { g.position.x -= dx; g.position.y -= dy; }
        for (const e of this._emitters) if (!e.target) { e.pos.x -= dx; e.pos.y -= dy; }
        for (const s of this._puffs) { s.position.x -= dx; s.position.y -= dy; }
        for (const m of this._debris) { m.position.x -= dx; m.position.y -= dy; }
        for (const d of this._decals) { d.position.x -= dx; d.position.y -= dy; }
        for (const st of this._state.values()) { st.prev.x -= dx; st.prev.y -= dy; }
    }
}
