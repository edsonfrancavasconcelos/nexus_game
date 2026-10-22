import * as THREE from 'three';

// Campo de estrelas em camadas (parallax), poeira espacial em "streaks" e nebulosas procedurais.

function createStarSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(canvas);
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Ruído de valor com fBm, gerado uma única vez em canvas pequeno e esticado pela GPU.
function createNebulaTexture(seed, size) {
    const rand = mulberry32(seed);
    const grid = 16;
    const lattice = new Float32Array((grid + 1) * (grid + 1));
    for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
    const smooth = (t) => t * t * (3 - 2 * t);
    const noise = (x, y) => {
        const gx = ((x % grid) + grid) % grid;
        const gy = ((y % grid) + grid) % grid;
        const x0 = Math.floor(gx), y0 = Math.floor(gy);
        const x1 = (x0 + 1) % grid, y1 = (y0 + 1) % grid;
        const tx = smooth(gx - x0), ty = smooth(gy - y0);
        const at = (xi, yi) => lattice[yi * (grid + 1) + xi];
        const a = at(x0, y0) + (at(x1, y0) - at(x0, y0)) * tx;
        const b = at(x0, y1) + (at(x1, y1) - at(x0, y1)) * tx;
        return a + (b - a) * ty;
    };

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);
    const half = size / 2;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let v = 0, amp = 0.5, freq = 2.2;
            for (let o = 0; o < 4; o++) {
                v += noise((x / size) * freq * 4, (y / size) * freq * 4) * amp;
                amp *= 0.5;
                freq *= 2;
            }
            const dx = (x - half) / half, dy = (y - half) / half;
            const falloff = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
            const a = Math.pow(Math.max(0, v - 0.28) * 1.9, 1.6) * smooth(falloff);
            const i = (y * size + x) * 4;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
            img.data[i + 3] = Math.min(255, a * 255);
        }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

const STAR_LAYERS = [
    // share: fração das estrelas; follow: quanto a camada acompanha o jogador (1 = fixa no fundo)
    { share: 0.4, speed: 10, size: 1.4, spread: 2600, zNear: 100, zFar: -3000, follow: 0.98, opacity: 0.7 },
    { share: 0.3, speed: 35, size: 2.0, spread: 1800, zNear: 100, zFar: -2200, follow: 0.85, opacity: 0.8 },
    { share: 0.2, speed: 110, size: 2.8, spread: 1000, zNear: 80, zFar: -1500, follow: 0.6, opacity: 0.85 },
    { share: 0.1, speed: 260, size: 3.8, spread: 450, zNear: 60, zFar: -900, follow: 0.3, opacity: 0.9 }
];

export class SpaceFX {
    constructor(scene, starCount = 1000, isMobile = false) {
        this.scene = scene;
        this.time = 0;
        this.layers = [];
        this.sprite = createStarSprite();

        STAR_LAYERS.forEach((cfg, index) => this._createStarLayer(cfg, Math.max(40, Math.round(starCount * cfg.share)), index));
        this._createDust(isMobile ? 60 : 140);
        this._createNebulae(isMobile);
    }

    _createStarLayer(cfg, count, index) {
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const color = new THREE.Color();
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * cfg.spread * 2;
            positions[i * 3 + 1] = (Math.random() - 0.5) * cfg.spread * 2;
            positions[i * 3 + 2] = cfg.zFar + Math.random() * (cfg.zNear - cfg.zFar);
            const r = Math.random();
            if (r < 0.5) color.setRGB(1, 1, 1);
            else if (r < 0.75) color.setRGB(1, 0.9, 0.7);
            else if (r < 0.92) color.setRGB(0.65, 0.82, 1);
            else color.setRGB(1, 0.6, 0.45);
            color.multiplyScalar(0.7 + Math.random() * 0.3);
            colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const material = new THREE.PointsMaterial({
            size: cfg.size,
            map: this.sprite,
            vertexColors: true,
            transparent: true,
            opacity: cfg.opacity,
            sizeAttenuation: false,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false
        });
        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        points.renderOrder = -40;
        const group = new THREE.Group();
        group.add(points);
        this.scene.add(group);
        this.layers.push({ cfg, count, positions, geometry, material, group, phase: index * 1.7 });
    }

    _createDust(count) {
        this.dust = {
            count,
            heads: new Float32Array(count * 3),
            speeds: new Float32Array(count),
            positions: new Float32Array(count * 6),
            box: { x: 200, y: 120, zNear: 40, zFar: -420 }
        };
        const { heads, speeds, box } = this.dust;
        for (let i = 0; i < count; i++) {
            heads[i * 3] = (Math.random() - 0.5) * box.x * 2;
            heads[i * 3 + 1] = (Math.random() - 0.5) * box.y * 2;
            heads[i * 3 + 2] = box.zFar + Math.random() * (box.zNear - box.zFar);
            speeds[i] = 80 + Math.random() * 180;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.dust.positions, 3));
        this.dust.geometry = geometry;
        this.dust.lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
            color: 0x9fdcff,
            transparent: true,
            opacity: 0.28,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false
        }));
        this.dust.lines.frustumCulled = false;
        this.dust.lines.renderOrder = -5;
        this.scene.add(this.dust.lines);
        this._writeDust(0);
    }

    _writeDust(boost) {
        const { count, heads, speeds, positions } = this.dust;
        for (let i = 0; i < count; i++) {
            const len = 1.5 + (speeds[i] + boost) * 0.05;
            const h = i * 3, p = i * 6;
            positions[p] = heads[h]; positions[p + 1] = heads[h + 1]; positions[p + 2] = heads[h + 2];
            positions[p + 3] = heads[h]; positions[p + 4] = heads[h + 1]; positions[p + 5] = heads[h + 2] - len;
        }
        this.dust.geometry.attributes.position.needsUpdate = true;
    }

    _createNebulae(isMobile) {
        const size = isMobile ? 96 : 192;
        const defs = [
            { seed: 11, x: -1700, y: 900, z: -4200, scale: 3800, rot: 0.2, opacity: 0.22 },
            { seed: 29, x: 1900, y: -700, z: -4600, scale: 4200, rot: -0.6, opacity: 0.2 },
            { seed: 47, x: 200, y: 200, z: -5200, scale: 5200, rot: 1.1, opacity: 0.14 }
        ];
        this.nebulae = new THREE.Group();
        this.nebulaSprites = defs.map((d) => {
            const material = new THREE.SpriteMaterial({
                map: createNebulaTexture(d.seed, size),
                color: 0x6b7cff,
                transparent: true,
                opacity: d.opacity,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                rotation: d.rot,
                fog: false
            });
            const sprite = new THREE.Sprite(material);
            sprite.position.set(d.x, d.y, d.z);
            sprite.scale.set(d.scale, d.scale, 1);
            sprite.renderOrder = -50;
            sprite.userData = { rotSpeed: (d.seed % 2 ? 1 : -1) * 0.004, baseRot: d.rot };
            this.nebulae.add(sprite);
            return sprite;
        });
        this.scene.add(this.nebulae);
    }

    setTheme(color) {
        const tint = new THREE.Color(color);
        this.nebulaSprites.forEach((sprite, i) => {
            sprite.material.color.copy(tint).offsetHSL(i * 0.07 - 0.07, 0, 0.1);
        });
    }

    update(dt, playerPosition, moveInput) {
        this.time += dt;
        const px = playerPosition?.x || 0, py = playerPosition?.y || 0, pz = playerPosition?.z || 0;
        const mx = moveInput?.x || 0, my = moveInput?.y || 0;
        const strafe = Math.min(1, Math.hypot(mx, my));

        for (const layer of this.layers) {
            const { cfg, count, positions, geometry, material, group } = layer;
            // A camada fica parcialmente "para trás" quando o jogador se move -> parallax lateral.
            group.position.set(px * cfg.follow, py * cfg.follow, pz);
            const advance = cfg.speed * (1 + strafe * 0.5) * dt;
            for (let i = 0; i < count; i++) {
                const z = positions[i * 3 + 2] + advance;
                positions[i * 3 + 2] = z > cfg.zNear ? cfg.zFar : z;
            }
            geometry.attributes.position.needsUpdate = true;
            material.opacity = cfg.opacity * (0.9 + 0.1 * Math.sin(this.time * 1.3 + layer.phase));
        }

        const dust = this.dust;
        dust.lines.position.set(px, py, pz + 55);
        const boost = strafe * 120;
        const { heads, speeds, box } = dust;
        for (let i = 0; i < dust.count; i++) {
            const h = i * 3;
            heads[h + 2] += (speeds[i] + boost) * dt;
            heads[h] -= mx * 30 * dt;
            heads[h + 1] -= my * 30 * dt;
            if (heads[h + 2] > box.zNear) {
                heads[h] = (Math.random() - 0.5) * box.x * 2;
                heads[h + 1] = (Math.random() - 0.5) * box.y * 2;
                heads[h + 2] = box.zFar;
                speeds[i] = 80 + Math.random() * 180;
            }
        }
        this._writeDust(boost);

        this.nebulae.position.set(px * 0.97, py * 0.97, pz);
        for (const sprite of this.nebulaSprites) {
            sprite.material.rotation += sprite.userData.rotSpeed * dt;
        }
    }
}
