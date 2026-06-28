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

const cloudTexture = createCloudTexture();

export class SpaceEnvironment {
    constructor(scene, starCount = 2000, cloudCount = 400) {
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.planets = [];
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
        this.starCount = starCount;
        this.starPositions = new Float32Array(starCount * 3);
        this.starColors = new Float32Array(starCount * 3);
        this.starSizes = new Float32Array(starCount);
        this.starVelocities = new Float32Array(starCount);
        this.cloudCount = cloudCount;
        this.cloudPositions = new Float32Array(cloudCount * 3);
        this.cloudVelocities = new Float32Array(cloudCount);
        this.cloudSizes = new Float32Array(cloudCount);

        this.initParticles();
        this.initEnvironment();
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
            this.loader.load(
                path, 
                (gltf) => {
                    const p = gltf.scene;
                    console.log(`✅ Planeta carregado: ${path} (índice ${index})`); // debug

                    // Posições bem separadas
                    const zPos = -45000 - (index * 35000);
                    const lanes = [-4500, -1500, 1500, 4500];
                    const xPos = lanes[index] + (Math.random() - 0.5) * 800;
                    const yPos = -700 + (Math.random() * 1400);

                    p.position.set(xPos, yPos, zPos);
                    p.scale.set(100, 100, 100);   // pode precisar ajustar por modelo
                    p.visible = false;
                    this.scene.add(p);
                    this.planets.push(p);
                },
                undefined,
                (error) => {
                    console.error(`❌ Erro ao carregar ${path}:`, error);
                }
            );
        });
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
        this.starGeometry.setAttribute('size', new THREE.BufferAttribute(this.starSizes, 1));
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
        this.planets.forEach((p, index) => {
            const shouldBeVisible = (currentLevel >= 5 && currentLevel <= 20);
            p.visible = shouldBeVisible;
            
            if (p.visible) {
                p.position.z += 60 * deltaTime;

                if (p.position.z > 1800) { 
                    this.resetPlanetPosition(p, index);
                }
                
                const distZ = Math.abs(p.position.z);
                const scale = Math.max(50, 820 - (distZ / 110));
                p.scale.set(scale, scale, scale);
                
               if (playerMesh && p.position.z > -2800 && p.position.z < 500) {
    this._avoidPlanetCollision(playerMesh, p, soundManager);
}
            }
        });

        const pulse = Math.sin(Date.now() * 0.002) * 0.1 + 0.9;
        this.stars.material.opacity = 0.85 * pulse;
        this.clouds.material.opacity = 0.3 * pulse;
        this.moveParticles(this.starPositions, this.starVelocities, this.starCount, this.stars, deltaTime, moveInput, playerPosition);
        this.moveParticles(this.cloudPositions, this.cloudVelocities, this.cloudCount, this.clouds, deltaTime, moveInput);
    }

    resetPlanetPosition(planet, index) {
        planet.position.z = -100000 - Math.random() * 18000;
        
        const lanes = [-4800, -1600, 1600, 4800];
        planet.position.x = lanes[index] + (Math.random() - 0.5) * 700;
        
        planet.position.y = -800 + (Math.random() * 1700) - (index * 100);
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

  
     _avoidPlanetCollision(playerMesh, planet, soundManager) {
        const dx = playerMesh.position.x - planet.position.x;
        const dy = playerMesh.position.y - planet.position.y;
        const dist2D = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const effectiveRadius = planet.scale.x * 0.55; // aumentado

        if (dist2D < effectiveRadius + 80) {
            if (soundManager && !playerMesh.userData?.planetSoundPlayed) {
                soundManager.play('meteoro');
                playerMesh.userData.planetSoundPlayed = true;
            }

            const pushForce = (effectiveRadius + 80 - dist2D) * 5.5;
            const pushX = (dx / dist2D) * pushForce * 0.95;
            const pushY = (dy / dist2D) * pushForce * 2.4;   // força vertical MUITO forte

            playerMesh.position.x += pushX;
            playerMesh.position.y += pushY;

            // Sobrevoo obrigatório
            if (playerMesh.position.y < planet.position.y + effectiveRadius * 0.9) {
                playerMesh.position.y = planet.position.y + effectiveRadius * 0.95 + 80;
            }

            // Empurrão forte para trás
            if (planet.position.z < playerMesh.position.z + 200) {
                playerMesh.position.z -= 45;
            }
        } else {
            if (playerMesh.userData) playerMesh.userData.planetSoundPlayed = false;
        }
    }}