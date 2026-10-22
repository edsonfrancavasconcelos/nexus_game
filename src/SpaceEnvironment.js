import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

function createCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
}

function createPlanetCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < 52; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = 4 + Math.random() * 13;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(255,255,255,0.18)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function createNebulaTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(112,145,255,0.32)');
    gradient.addColorStop(0.4, 'rgba(82,85,190,0.16)');
    gradient.addColorStop(1, 'rgba(38,40,120,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
}

// Inicializa o loader padrão sem nenhuma modificação quebrada
const loader = new GLTFLoader();

const cloudTexture = createCloudTexture();
const planetCloudTexture = createPlanetCloudTexture();
const nebulaTexture = createNebulaTexture();
const planetLayerGeometry = new THREE.SphereGeometry(1, 24, 16);
const atmosphereMaterial = new THREE.MeshBasicMaterial({
    color: 0x59bfff,
    transparent: true,
    opacity: 0.19,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false
});
const planetCloudMaterial = new THREE.MeshBasicMaterial({
    map: planetCloudTexture,
    color: 0xc9efff,
    transparent: true,
    opacity: 0.24,
    depthWrite: false
});
const distantHullGeometry = new THREE.BoxGeometry(1, 0.8, 7);
const distantWingGeometry = new THREE.BoxGeometry(6, 0.3, 2.1);
const distantEngineGeometry = new THREE.SphereGeometry(0.42, 8, 6);
const distantDebrisGeometry = new THREE.TetrahedronGeometry(1, 0);
const distantHullMaterial = new THREE.MeshStandardMaterial({
    color: 0x182739,
    emissive: 0x122c45,
    emissiveIntensity: 0.55,
    metalness: 0.7,
    roughness: 0.48,
    depthTest: false,
    depthWrite: false
});
const distantWingMaterial = new THREE.MeshStandardMaterial({
    color: 0x243346,
    emissive: 0x10253a,
    emissiveIntensity: 0.35,
    metalness: 0.62,
    roughness: 0.5,
    depthTest: false,
    depthWrite: false
});
const distantEngineMaterial = new THREE.MeshBasicMaterial({
    color: 0x51dfff,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
const distantFlashMaterial = new THREE.MeshBasicMaterial({
    color: 0x8bdfff,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
});
const distantDebrisMaterial = new THREE.MeshStandardMaterial({
    color: 0x283746,
    emissive: 0x101c29,
    emissiveIntensity: 0.25,
    depthTest: false,
    depthWrite: false,
    roughness: 0.9
});
const nebulaMaterial = new THREE.SpriteMaterial({
    map: nebulaTexture,
    color: 0x8d9fff,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const PLANET_FOV_HALF_ANGLE = THREE.MathUtils.degToRad(35);
const PLANET_START_DISTANCE = 15000;
const PLANET_MIN_DISTANCE = 8000;

function getPlanetHalfWidth(distance) {
    return distance * Math.tan(PLANET_FOV_HALF_ANGLE) * (window.innerWidth / window.innerHeight);
}

function getPlanetVisualScale(baseRadius, distance, initialDistance) {
    const initialRadius = getPlanetHalfWidth(initialDistance) * 0.035;
    const approachGrowth = Math.pow(initialDistance / Math.max(distance, PLANET_MIN_DISTANCE), 1.5);
    return (initialRadius / baseRadius) * approachGrowth;
}

function preparePlanetRendering(planet) {
    planet.renderOrder = -100;
    const materials = [];
    planet.traverse((child) => {
        if (!child.isMesh) return;
        child.renderOrder = -100;
        const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
        childMaterials.forEach((material) => {
            if (!material) return;
            materials.push({
                material,
                opacity: material.opacity,
                transparent: material.transparent
            });
            material.depthTest = true;
            material.depthWrite = false;
        });
    });
    planet.userData.visualMaterials = materials;
    planet.userData.visualOpacity = 1;
}

function setPlanetOpacity(planet, opacity) {
    if (planet.userData.visualOpacity === opacity) return;
    planet.userData.visualOpacity = opacity;
    planet.userData.visualMaterials.forEach(({ material, opacity: baseOpacity, transparent }) => {
        const nextTransparent = opacity < 1 || transparent;
        if (material.transparent !== nextTransparent) {
            material.transparent = nextTransparent;
            material.needsUpdate = true;
        }
        material.opacity = baseOpacity * opacity;
    });
}


export class SpaceEnvironment {
    constructor(scene, starCount = 2000, cloudCount = 400) {
        const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.planets = [];
        this._pendingLoads = [];
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
        this.initBattleBackdrop();
        this.initPlanets();
    }

    initPlanets() {
        const planetFiles = [
            '/assets/models/planeta.glb',
            '/assets/models/planeta_dourado.glb',
            '/assets/models/moon.glb',
            '/assets/models/green_planeta.glb'
        ];

        planetFiles.forEach((path, index) => {
            const placeholderGeo = new THREE.SphereGeometry(50, 32, 32);
            const placeholderMat = new THREE.MeshPhongMaterial({ 
                color: Math.random() * 0xffffff,
                emissive: 0x111111
            });
            const placeholder = new THREE.Mesh(placeholderGeo, placeholderMat);
            placeholder.userData = { laneIndex: index, baseRadius: 50 };
            this._positionPlanetAtHorizon(placeholder, index);
            this._addPlanetVisualLayers(placeholder, placeholder.userData.baseRadius);
            preparePlanetRendering(placeholder);
            this.scene.add(placeholder);
            this.planets.push(placeholder);
            
            this._pendingLoads.push(() => this.loader.load(
                path, 
                (gltf) => {
                    const p = gltf.scene;
                    p.position.copy(placeholder.position);
                    const box = new THREE.Box3().setFromObject(p);
                    const sphere = new THREE.Sphere();
                    box.getBoundingSphere(sphere);
                    p.updateMatrixWorld(true);
                    p.userData = {
                        ...p.userData,
                        ...placeholder.userData,
                        baseRadius: sphere.radius || 50,
                        transitionPlaceholder: placeholder,
                        transitionElapsed: 0,
                        visualOpacity: 1
                    };
                    p.userData.visualCenter = p.worldToLocal(sphere.center.clone());
                    p.scale.copy(placeholder.scale).multiplyScalar(
                        (placeholder.userData.baseRadius || 50) / (p.userData.baseRadius || 50)
                    );
                    p.visible = true;
                    this._addPlanetVisualLayers(p, p.userData.baseRadius);
                    preparePlanetRendering(p);
                    setPlanetOpacity(p, 0);
                    this.scene.add(p);

                    const idx = this.planets.indexOf(placeholder);
                    if (idx !== -1) {
                        this.planets[idx] = p;
                    }
                },
                undefined,
                (error) => {
                    console.error(`❌ Erro ao carregar ${path}:`, error);
                }
            ));
        });
    }

    _addPlanetVisualLayers(planet, radius) {
        const layers = new THREE.Group();
        if (planet.userData.visualCenter) layers.position.copy(planet.userData.visualCenter);
        const atmosphere = new THREE.Mesh(planetLayerGeometry, atmosphereMaterial.clone());
        atmosphere.scale.setScalar(radius * 1.075);
        atmosphere.renderOrder = -99;
        const clouds = new THREE.Mesh(planetLayerGeometry, planetCloudMaterial.clone());
        clouds.scale.setScalar(radius * 1.012);
        clouds.rotation.set(0.28, Math.random() * Math.PI * 2, 0.12);
        clouds.renderOrder = -98;
        layers.add(atmosphere, clouds);
        layers.userData.clouds = clouds;
        planet.add(layers);
        planet.userData.visualLayers = layers;
    }

    _loadPlanetModels() {
        const pending = this._pendingLoads;
        this._pendingLoads = [];
        pending.forEach((fn) => fn());
    }

    _positionPlanetAtHorizon(planet, index, playerPosition = null) {
        const initialDistance = PLANET_START_DISTANCE;
        const halfWidth = getPlanetHalfWidth(initialDistance);
        const halfHeight = initialDistance * Math.tan(PLANET_FOV_HALF_ANGLE);
        const xOffsets = [-0.34, -0.25, 0.25, 0.34];
        const yOffsets = [-0.12, 0.12, 0.12, -0.12];
        const playerX = playerPosition?.x || 0;
        const playerY = playerPosition?.y || 0;
        const playerZ = playerPosition?.z || 0;
        const baseRadius = planet.userData.baseRadius || 50;

        planet.userData.initialDistance = initialDistance;
        planet.userData.visualOffsetX = xOffsets[index % xOffsets.length] * halfWidth;
        planet.userData.visualOffsetY = yOffsets[index % yOffsets.length] * halfHeight;
        planet.userData.done = false;
        planet.userData.offscreen = false;
        planet.userData.offscreenElapsed = 0;
        planet.position.set(
            playerX + planet.userData.visualOffsetX,
            playerY + planet.userData.visualOffsetY,
            playerZ - initialDistance
        );
        planet.scale.setScalar(getPlanetVisualScale(baseRadius, initialDistance, initialDistance));
    }

    initParticles() {
        this.starGeometry = new THREE.BufferGeometry();
        for (let i = 0; i < this.starCount; i++) {
            this.resetParticle(i, this.starPositions, this.starVelocities, 40, 20);
            this.setStarColor(i);
            this.starSizes[i] = Math.random() * 2.5 + 1.0;
        }
        this.starGeometry.setAttribute('position', new THREE.BufferAttribute(this.starPositions, 3));
        this.starGeometry.setAttribute('color', new THREE.BufferAttribute(this.starColors, 3));
        const starMaterial = new THREE.PointsMaterial({ size: 2.0, vertexColors: true, transparent: true, opacity: 0.85, depthTest: true, depthWrite: false, sizeAttenuation: true });
        this.stars = new THREE.Points(this.starGeometry, starMaterial);
        this.scene.add(this.stars);

        this.cloudGeometry = new THREE.BufferGeometry();
        for (let i = 0; i < this.cloudCount; i++) {
            this.resetParticle(i, this.cloudPositions, this.cloudVelocities, 8, 4);
            this.cloudSizes[i] = Math.random() * 500 + 200;
        }
        this.cloudGeometry.setAttribute('position', new THREE.BufferAttribute(this.cloudPositions, 3));
        const cloudMat = new THREE.PointsMaterial({ map: cloudTexture, sizeAttenuation: true, transparent: true, depthWrite: false, color: 0x446688, blending: THREE.NormalBlending });
        this.clouds = new THREE.Points(this.cloudGeometry, cloudMat);
        this.scene.add(this.clouds);

        for (let i = 0; i < this.dustCount; i++) {
            const i3 = i * 3;
            this.dustPositions[i3] = (Math.random() - 0.5) * 1800;
            this.dustPositions[i3 + 1] = (Math.random() - 0.5) * 1200;
            this.dustPositions[i3 + 2] = -80 - Math.random() * 1700;
            this.dustVelocities[i] = 22 + Math.random() * 62;
        }
        this.dustGeometry = new THREE.BufferGeometry();
        this.dustGeometry.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));
        this.dustPoints = new THREE.Points(this.dustGeometry, new THREE.PointsMaterial({
            color: 0x8edfff,
            size: this.isMobile ? 2.3 : 3.2,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.36,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        }));
        this.dustPoints.renderOrder = -5;
        this.scene.add(this.dustPoints);
    }

    initBattleBackdrop() {
        this.battleBackdrop = new THREE.Group();
        this.battleBackdrop.renderOrder = -20;
        this.backdropTime = 0;
        this.distantShips = [];
        const shipOffsets = [
            [-820, 260, -760],
            [720, -330, -1020],
            [-90, 520, -1220]
        ];
        shipOffsets.forEach(([x, y, z], index) => {
            const ship = new THREE.Group();
            const hull = new THREE.Mesh(distantHullGeometry, distantHullMaterial);
            hull.scale.set(3.2, 2.6, 1);
            const leftWing = new THREE.Mesh(distantWingGeometry, distantWingMaterial);
            leftWing.position.set(-2.4, 0, 0.8);
            const rightWing = new THREE.Mesh(distantWingGeometry, distantWingMaterial);
            rightWing.position.set(2.4, 0, 0.8);
            const engine = new THREE.Mesh(distantEngineGeometry, distantEngineMaterial);
            engine.position.set(0, 0, -4);
            engine.scale.set(1.1, 0.55, 1.4);
            ship.add(hull, leftWing, rightWing, engine);
            ship.position.set(x, y, z);
            ship.scale.setScalar(index === 2 ? 1.35 : 1);
            ship.rotation.y = index === 1 ? Math.PI * 0.28 : -Math.PI * 0.2;
            ship.traverse((object) => {
                if (object.isMesh) object.renderOrder = -20;
            });
            this.battleBackdrop.add(ship);
            this.distantShips.push(ship);
        });

        this.distantFlashes = [];
        for (let i = 0; i < 2; i++) {
            const flash = new THREE.Mesh(distantEngineGeometry, distantFlashMaterial.clone());
            flash.position.set(i === 0 ? -720 : 730, i === 0 ? 350 : -300, i === 0 ? -940 : -1180);
            flash.scale.setScalar(12);
            flash.renderOrder = -20;
            this.battleBackdrop.add(flash);
            this.distantFlashes.push(flash);
        }

        this.distantDebris = [];
        for (let i = 0; i < 4; i++) {
            const debris = new THREE.Mesh(distantDebrisGeometry, distantDebrisMaterial);
            debris.position.set(-560 + i * 390, 210 - (i % 2) * 430, -790 - i * 180);
            debris.scale.set(4 + (i % 3) * 2, 2.5 + (i % 2), 5 + (i % 2) * 2);
            debris.rotation.set(i * 0.4, i * 0.7, i * 0.2);
            debris.renderOrder = -20;
            this.battleBackdrop.add(debris);
            this.distantDebris.push(debris);
        }

        this.nebulaSprites = [];
        for (let i = 0; i < 2; i++) {
            const nebula = new THREE.Sprite(nebulaMaterial);
            nebula.position.set(i === 0 ? -950 : 970, i === 0 ? 540 : -450, -1850);
            nebula.scale.set(2300, 1500, 1);
            nebula.renderOrder = -30;
            this.battleBackdrop.add(nebula);
            this.nebulaSprites.push(nebula);
        }
        this.scene.add(this.battleBackdrop);
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
    }

    setLevelTheme(level) {
        if (level <= 1) { this.currentThemeIndex = 0; this.applyTheme(this.themes[0]); return; }
        let nextIndex = 1 + Math.floor(Math.random() * (this.themes.length - 1));
        if (nextIndex === this.currentThemeIndex) nextIndex = 1 + ((nextIndex + 1) % (this.themes.length - 1));
        this.currentThemeIndex = nextIndex;
        this.applyTheme(this.themes[nextIndex]);
    }

    update(deltaTime, playerPosition, moveInput, currentLevel = 1, playerMesh = null, soundManager = null) {
        if (this._pendingLoads.length) this._loadPlanetModels();
        this.planets.forEach((p) => {
            if (p.userData?.done) return;
            if (p.userData.visualLayers?.userData.clouds) {
                p.userData.visualLayers.userData.clouds.rotation.y += deltaTime * 0.012;
            }

            const playerX = playerPosition?.x || 0;
            const playerY = playerPosition?.y || 0;
            const playerZ = playerPosition?.z || 0;
            p.position.z = Math.min(
                p.position.z + 80 * deltaTime,
                playerZ - PLANET_MIN_DISTANCE
            );

            const distance = Math.max(PLANET_MIN_DISTANCE, playerZ - p.position.z);
            const baseRadius = p.userData.baseRadius || 50;
            p.scale.setScalar(getPlanetVisualScale(
                baseRadius,
                distance,
                p.userData.initialDistance || PLANET_START_DISTANCE
            ));

            const halfWidth = getPlanetHalfWidth(distance);
            const radius = baseRadius * p.scale.x;
            if (distance <= 9000 && !p.userData.offscreen) {
                const direction = Math.sign(p.userData.visualOffsetX) || 1;
                const targetOffset = direction * (halfWidth + radius + 400);
                p.userData.visualOffsetX = THREE.MathUtils.damp(
                    p.userData.visualOffsetX,
                    targetOffset,
                    0.8,
                    deltaTime
                );
            }

            p.position.x = playerX + p.userData.visualOffsetX;
            p.position.y = playerY + p.userData.visualOffsetY;

            const fullyOutsideView = Math.abs(p.userData.visualOffsetX) - radius > halfWidth;
            if (fullyOutsideView) {
                p.userData.offscreen = true;
                p.userData.offscreenElapsed += deltaTime;
            }
            const fadeOpacity = p.userData.offscreen
                ? 1 - THREE.MathUtils.smoothstep(p.userData.offscreenElapsed, 0, 2.5)
                : 1;

            let modelOpacity = 1;
            const transitionPlaceholder = p.userData.transitionPlaceholder;
            if (transitionPlaceholder) {
                p.userData.transitionElapsed += deltaTime;
                modelOpacity = THREE.MathUtils.smoothstep(p.userData.transitionElapsed, 0, 0.8);
                transitionPlaceholder.position.copy(p.position);
                transitionPlaceholder.scale.copy(p.scale);
                setPlanetOpacity(transitionPlaceholder, fadeOpacity * (1 - modelOpacity));
            }
            setPlanetOpacity(p, fadeOpacity * modelOpacity);

            if (transitionPlaceholder && modelOpacity >= 1) {
                this.scene.remove(transitionPlaceholder);
                p.userData.transitionPlaceholder = null;
            }

            if (p.userData.offscreenElapsed >= 2.5) {
                p.userData.done = true;
                p.visible = false;
                this.scene.remove(p);
            }
        });

        const pulse = Math.sin(Date.now() * 0.002) * 0.1 + 0.9;
        this.stars.material.opacity = 0.85 * pulse;
        this.clouds.material.opacity = 0.3 * pulse;
        this.moveParticles(this.starPositions, this.starVelocities, this.starCount, this.stars, deltaTime, moveInput, playerPosition);
        this.moveParticles(this.cloudPositions, this.cloudVelocities, this.cloudCount, this.clouds, deltaTime, moveInput);
        if (playerPosition) {
            this.battleBackdrop.position.set(playerPosition.x, playerPosition.y, playerPosition.z - 320);
            this.dustPoints.position.copy(playerPosition);
        }
        this.backdropTime += deltaTime;
        this.distantFlashes.forEach((flash, index) => {
            const pulse = (Math.sin(this.backdropTime * 2.6 + index * 2.3) + 1) * 0.5;
            flash.scale.setScalar(9 + pulse * 8);
            flash.material.opacity = 0.08 + pulse * 0.2;
        });
        this.distantDebris.forEach((debris, index) => {
            debris.rotation.x += deltaTime * (0.012 + index * 0.002);
            debris.rotation.y += deltaTime * (0.018 + index * 0.003);
        });
        const inputSpeed = Math.min(1, Math.hypot(moveInput?.x || 0, moveInput?.y || 0));
        for (let i = 0; i < this.dustCount; i++) {
            const i3 = i * 3;
            this.dustPositions[i3 + 2] += (this.dustVelocities[i] + inputSpeed * 90) * deltaTime;
            this.dustPositions[i3] -= (moveInput?.x || 0) * 18 * deltaTime;
            this.dustPositions[i3 + 1] -= (moveInput?.y || 0) * 18 * deltaTime;
            if (this.dustPositions[i3 + 2] > -45) {
                this.dustPositions[i3] = (Math.random() - 0.5) * 1800;
                this.dustPositions[i3 + 1] = (Math.random() - 0.5) * 1200;
                this.dustPositions[i3 + 2] = -1500 - Math.random() * 250;
                this.dustVelocities[i] = 22 + Math.random() * 62;
            }
        }
        this.dustGeometry.attributes.position.needsUpdate = true;
    }

    resetPlanetPosition(planet, index) {
        if (planet.userData.transitionPlaceholder) {
            this.scene.remove(planet.userData.transitionPlaceholder);
            planet.userData.transitionPlaceholder = null;
        }
        this._positionPlanetAtHorizon(planet, index);
        planet.visible = true;
        this.scene.add(planet);
        setPlanetOpacity(planet, 1);
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
        points.geometry.attributes.position.needsUpdate = true;
    }

}