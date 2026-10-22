import * as THREE from 'three';
import { markBloom } from './BloomPipeline.js';

// Eventos raros de cenário (cruzadores, satélites, explosões e destroços). Não interagem com o jogo.

const hullMaterial = new THREE.MeshStandardMaterial({ color: 0x1b2a3b, emissive: 0x0b1726, emissiveIntensity: 0.6, metalness: 0.7, roughness: 0.5 });
const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x23406a, emissive: 0x0a1c36, emissiveIntensity: 0.7, metalness: 0.5, roughness: 0.4 });
const debrisMaterial = new THREE.MeshStandardMaterial({ color: 0x2a3644, emissive: 0x0c141d, emissiveIntensity: 0.5, roughness: 0.9 });
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const debrisGeometry = new THREE.TetrahedronGeometry(1, 0);
const dishGeometry = new THREE.ConeGeometry(2.4, 2, 10);

let glowTexture = null;
function getGlowTexture() {
    if (glowTexture) return glowTexture;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,200,120,0.8)');
    grad.addColorStop(0.7, 'rgba(255,100,40,0.25)');
    grad.addColorStop(1, 'rgba(255,60,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glowTexture = new THREE.CanvasTexture(c);
    return glowTexture;
}

// Só os sprites luminosos entram no bloom; cascos e destroços não brilham.
function makeGlow(color, opacity, scale) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false
    }));
    sprite.scale.set(scale, scale, 1);
    return markBloom(sprite);
}

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class BackgroundEvents {
    constructor(scene, isMobile = false) {
        this.isMobile = isMobile;
        this.root = new THREE.Group();
        scene.add(this.root);
        this.events = [];
        this.timer = rand(12, 20);
    }

    update(dt, playerPosition) {
        if (playerPosition) {
            this.root.position.set(playerPosition.x * 0.95, playerPosition.y * 0.95, playerPosition.z);
        }

        this.timer -= dt;
        if (this.timer <= 0) {
            this.timer = rand(18, 40);
            if (this.events.length < 2) this._spawn();
        }

        for (let i = this.events.length - 1; i >= 0; i--) {
            if (this.events[i].update(dt)) {
                this._remove(this.events[i]);
                this.events.splice(i, 1);
            }
        }
    }

    _remove(event) {
        this.root.remove(event.object);
        event.object.traverse((child) => {
            if (child.isSprite) child.material.dispose();
        });
    }

    _spawn() {
        const hasCruiser = this.events.some((e) => e.kind === 'cruiser');
        const roll = Math.random();
        let event;
        if (roll < 0.2 && !hasCruiser) event = this._cruiser();
        else if (roll < 0.45) event = this._satellite();
        else if (roll < 0.72) event = this._explosion();
        else event = this._debrisField();
        this.root.add(event.object);
        this.events.push(event);
    }

    // Cruzador: casco longo cruzando o fundo devagar, com motores brilhando.
    _cruiser() {
        const ship = new THREE.Group();
        const part = (sx, sy, sz, x, y, z) => {
            const mesh = new THREE.Mesh(boxGeometry, hullMaterial);
            mesh.scale.set(sx, sy, sz);
            mesh.position.set(x, y, z);
            ship.add(mesh);
        };
        part(60, 16, 340, 0, 0, 0);
        part(24, 14, 200, 0, 14, -30);
        part(30, 22, 44, 0, 22, -110);
        part(70, 4, 120, -60, -2, -70);
        part(70, 4, 120, 60, -2, -70);
        const engines = [-18, 0, 18].map((x) => {
            const glow = makeGlow(0x6fd6ff, 0.9, 46);
            glow.position.set(x, 0, -178);
            ship.add(glow);
            return glow;
        });
        const lights = [[-30, 9, 100], [30, 9, 100], [0, 36, -118]].map(([x, y, z]) => {
            const light = makeGlow(0xff4a4a, 0.8, 14);
            light.position.set(x, y, z);
            ship.add(light);
            return light;
        });

        const dir = Math.random() < 0.5 ? 1 : -1;
        const z = rand(-3600, -2600);
        const half = Math.abs(z) * 1.25 + 500;
        ship.position.set(-dir * half, rand(-300, 700), z);
        // O nariz (+z local) aponta para onde o cruzador viaja.
        ship.rotation.y = dir * Math.PI / 2 + rand(-0.08, 0.08);
        const speed = rand(70, 100);
        let t = 0;
        return {
            kind: 'cruiser',
            object: ship,
            update: (dt) => {
                t += dt;
                ship.position.x += dir * speed * dt;
                const blink = (Math.sin(t * 3) + 1) * 0.5;
                lights.forEach((l, i) => { l.material.opacity = 0.2 + 0.8 * ((blink + i * 0.33) % 1); });
                engines.forEach((e, i) => { e.material.opacity = 0.8 + Math.sin(t * 5 + i) * 0.1; });
                return Math.abs(ship.position.x) > half + 300;
            }
        };
    }

    // Satélite: corpo pequeno com painéis solares, girando devagar.
    _satellite() {
        const sat = new THREE.Group();
        const body = new THREE.Mesh(boxGeometry, hullMaterial);
        body.scale.set(5, 5, 8);
        const panelL = new THREE.Mesh(boxGeometry, panelMaterial);
        panelL.scale.set(16, 0.3, 6);
        panelL.position.x = -11;
        const panelR = panelL.clone();
        panelR.position.x = 11;
        const dish = new THREE.Mesh(dishGeometry, hullMaterial);
        dish.rotation.x = Math.PI / 2;
        dish.position.z = 5.5;
        const beacon = makeGlow(0x9fffd0, 0.9, 9);
        beacon.position.set(0, 3.4, -3);
        sat.add(body, panelL, panelR, dish, beacon);

        const dir = Math.random() < 0.5 ? 1 : -1;
        const z = rand(-1500, -900);
        const half = Math.abs(z) * 1.25 + 100;
        sat.position.set(-dir * half, rand(-350, 450), z);
        sat.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
        const speed = rand(22, 34);
        const spin = new THREE.Vector3(rand(-0.15, 0.15), rand(-0.2, 0.2), rand(-0.1, 0.1));
        let t = 0;
        return {
            kind: 'satellite',
            object: sat,
            update: (dt) => {
                t += dt;
                sat.position.x += dir * speed * dt;
                sat.rotation.x += spin.x * dt;
                sat.rotation.y += spin.y * dt;
                sat.rotation.z += spin.z * dt;
                beacon.material.opacity = (Math.sin(t * 2.4) + 1) * 0.45 + 0.1;
                return Math.abs(sat.position.x) > half + 100;
            }
        };
    }

    // Explosão distante: clarão que cresce e some; às vezes com 2 clarões secundários.
    _explosion() {
        const group = new THREE.Group();
        const z = rand(-4200, -2400);
        const spread = Math.abs(z) * 0.9;
        group.position.set(rand(-spread, spread), rand(-spread * 0.4, spread * 0.5), z);
        const flashes = [];
        const count = Math.random() < 0.4 ? 3 : 1;
        for (let i = 0; i < count; i++) {
            const glow = makeGlow(pick([0xffd6a0, 0xffb070, 0x9fe4ff]), 0, 1);
            if (i) glow.position.set(rand(-90, 90), rand(-60, 60), 0);
            group.add(glow);
            flashes.push({ glow, delay: i * rand(0.3, 0.7), size: rand(260, 480) / (i ? 1.8 : 1) });
        }
        const duration = 1.8;
        const total = duration + flashes[flashes.length - 1].delay;
        let t = 0;
        return {
            kind: 'explosion',
            object: group,
            update: (dt) => {
                t += dt;
                flashes.forEach((f) => {
                    const k = (t - f.delay) / duration;
                    if (k < 0 || k > 1) { f.glow.material.opacity = 0; return; }
                    const grow = 1 - Math.pow(1 - k, 3);
                    f.glow.scale.setScalar(f.size * (0.2 + grow * 0.8));
                    f.glow.material.opacity = Math.min(1, k * 14) * Math.pow(1 - k, 1.5) * 0.75;
                });
                return t > total;
            }
        };
    }

    // Campo de destroços à deriva, girando lentamente.
    _debrisField() {
        const field = new THREE.Group();
        const pieces = [];
        const count = this.isMobile ? 7 : 14;
        for (let i = 0; i < count; i++) {
            const piece = new THREE.Mesh(debrisGeometry, debrisMaterial);
            piece.position.set(rand(-160, 160), rand(-80, 80), rand(-160, 160));
            piece.scale.set(rand(3, 11), rand(2, 7), rand(3, 11));
            piece.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
            field.add(piece);
            pieces.push({ piece, spin: new THREE.Vector3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.2, 0.2)) });
        }
        const dir = Math.random() < 0.5 ? 1 : -1;
        const z = rand(-2200, -1300);
        const half = Math.abs(z) * 1.25 + 250;
        field.position.set(-dir * half, rand(-300, 450), z);
        const speed = rand(18, 30);
        return {
            kind: 'debris',
            object: field,
            update: (dt) => {
                field.position.x += dir * speed * dt;
                pieces.forEach(({ piece, spin }) => {
                    piece.rotation.x += spin.x * dt;
                    piece.rotation.y += spin.y * dt;
                    piece.rotation.z += spin.z * dt;
                });
                return Math.abs(field.position.x) > half + 250;
            }
        };
    }
}
