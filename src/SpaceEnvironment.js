import * as THREE from 'three';
import { SpaceFX } from './SpaceFX.js';
import { BackgroundEvents } from './BackgroundEvents.js';
import { BiomeManager } from './environments/BiomeManager.js';

function createCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
}

const cloudTexture = createCloudTexture();

export class SpaceEnvironment {
    constructor(scene, starCount = 2000, cloudCount = 400, farDistance = 30000) {
        const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
        this.scene = scene;
        this.isMobile = isMobile;
        this.ambientLight = null;
        this.currentThemeIndex = 0;
        this.themes = [
            { background: 0x002244, cloud: 0x446688, ambient: 0xffffff },
            { background: 0x10182f, cloud: 0x6b7cff, ambient: 0xb8c7ff },
            { background: 0x1a0828, cloud: 0xb05cff, ambient: 0xf1c2ff },
            { background: 0x2a1207, cloud: 0xff8a3d, ambient: 0xffd1a3 },
            { background: 0x06251a, cloud: 0x42d6a4, ambient: 0xc2ffe7 },
            { background: 0x24060a, cloud: 0xff4f7b, ambient: 0xffc0cf }
        ];
        this.starCount = this.isMobile ? Math.min(starCount, 900) : starCount;
        this.cloudCount = this.isMobile ? Math.min(cloudCount, 120) : cloudCount;
        this.starPositions = new Float32Array(this.starCount * 3);
        this.starColors = new Float32Array(this.starCount * 3);
        this.starSizes = new Float32Array(this.starCount);
        this.starVelocities = new Float32Array(this.starCount);
        this.cloudPositions = new Float32Array(this.cloudCount * 3);
        this.cloudVelocities = new Float32Array(this.cloudCount);
        this.cloudSizes = new Float32Array(this.cloudCount);
        this.dustCount = this.isMobile ? 70 : 150;
        this.dustPositions = new Float32Array(this.dustCount * 3);
        this.dustVelocities = new Float32Array(this.dustCount);

        this.initParticles();
        this.initEnvironment();
        // Cenário principal: viagem por biomas (planície, floresta, cidade, região extrema).
        // Estrelas, nebulosas, nuvens espaciais e eventos de fundo ficam desligados.
        this.biomes = new BiomeManager(this.scene, { isMobile, far: farDistance });
        this.fx.setSpaceVisible(false);
        this.clouds.visible = false;
        this.events.root.visible = false;
        this.fx.dust.lines.material.color.set(0xffe2b8);
        this._syncAmbient();
    }

    attachPost(bloomPipeline) {
        this.biomes.attachPost(bloomPipeline);
    }

    _syncAmbient() {
        if (this.ambientLight) this.ambientLight.color.copy(this.biomes.ambientColor);
    }

    initParticles() {
        this.fx = new SpaceFX(this.scene, this.starCount, this.isMobile);
        this.events = new BackgroundEvents(this.scene, this.isMobile);

        this.cloudGeometry = new THREE.BufferGeometry();
        for (let i = 0; i < this.cloudCount; i++) {
            this.resetParticle(i, this.cloudPositions, this.cloudVelocities, 8, 4);
            this.cloudSizes[i] = Math.random() * 500 + 200;
        }
        this.cloudGeometry.setAttribute('position', new THREE.BufferAttribute(this.cloudPositions, 3));
        const cloudMat = new THREE.PointsMaterial({ map: cloudTexture, sizeAttenuation: true, transparent: true, depthWrite: false, color: 0x446688, blending: THREE.NormalBlending });
        this.clouds = new THREE.Points(this.cloudGeometry, cloudMat);
        this.scene.add(this.clouds);

    }

    setStarColor(i) {
        const i3 = i * 3;
        const rand = Math.random();
        if (rand < 0.45) { this.starColors[i3] = 0.95 + Math.random() * 0.05; this.starColors[i3 + 1] = 0.95 + Math.random() * 0.05; this.starColors[i3 + 2] = 1.0; }
        else if (rand < 0.75) { this.starColors[i3] = 1.0; this.starColors[i3 + 1] = 0.9 + Math.random() * 0.1; this.starColors[i3 + 2] = 0.65 + Math.random() * 0.25; }
        else if (rand < 0.9) { this.starColors[i3] = 0.55 + Math.random() * 0.35; this.starColors[i3 + 1] = 0.8 + Math.random() * 0.2; this.starColors[i3 + 2] = 1.0; }
        else { this.starColors[i3] = 1.0; this.starColors[i3 + 1] = 0.45 + Math.random() * 0.35; this.starColors[i3 + 2] = 0.25 + Math.random() * 0.25; }
    }

    resetParticle(i, posArray, velArray, speedMax, speedMin) {
        const i3 = i * 3;
        posArray[i3] = (Math.random() - 0.5) * 4000;
        posArray[i3 + 1] = (Math.random() - 0.5) * 4000;
        posArray[i3 + 2] = (Math.random() - 0.5) * 4000;
        velArray[i] = Math.random() * speedMax + speedMin;
    }

    initEnvironment() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(this.ambientLight);
        this.applyTheme(this.themes[0]);
    }

    applyTheme(theme) {
        this.scene.background = new THREE.Color(theme.background);
        if (this.ambientLight) {
            this.ambientLight.color.setHex(theme.ambient);
            this.ambientLight.intensity = 0.75 + Math.random() * 0.15;
        }
        if (this.clouds?.material) this.clouds.material.color.setHex(theme.cloud);
        this.fx?.setTheme(theme.cloud);
    }

    // Os biomas são determinísticos por nível (sem tema aleatório); a transição é gradual.
    setLevelTheme(level, instant = false) {
        this.biomes.setLevel(level, { instant });
    }

    update(deltaTime, playerPosition, moveInput, currentLevel = 1, playerMesh = null, soundManager = null) {
        this.biomes.update(deltaTime, playerPosition, moveInput, currentLevel);
        this._syncAmbient();
        this.fx.update(deltaTime, playerPosition, moveInput);
    }

    moveParticles(pos, vel, count, points, dt, moveInput, playerPos = null) {
        for (let i = 0; i < count; i++) {
            let i3 = i * 3;
            pos[i3 + 2] += vel[i] * 32 * dt;
            pos[i3] -= moveInput.x * 20.0 * dt;
            pos[i3 + 1] -= moveInput.y * 20.0 * dt;
            if (playerPos) {
                const dx = pos[i3] - playerPos.x; const dy = pos[i3 + 1] - playerPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 250 && dist > 0) {
                    const pushForce = (250 - dist) / 250 * 5.0;
                    pos[i3] += (dx / dist) * pushForce; pos[i3 + 1] += (dy / dist) * pushForce;
                }
            }
            if (pos[i3 + 2] > 50) { 
                pos[i3 + 2] = -2000; 
                pos[i3] = (Math.random() - 0.5) * 1000; 
                pos[i3 + 1] = (Math.random() - 0.5) * 1000; 
                this.setStarColor(i); 
            }
        }
        points.geometry.attributes.position.        needsUpdate = true;
            }
        }