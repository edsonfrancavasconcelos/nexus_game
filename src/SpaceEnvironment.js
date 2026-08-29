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

// Inicializa o loader padrão sem nenhuma modificação quebrada
const loader = new GLTFLoader();

const cloudTexture = createCloudTexture();


export class SpaceEnvironment {
    constructor(scene, starCount = 2000, cloudCount = 400) {
        const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.planets = [];
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

        // Criar placeholders enquanto os modelos carregam
        const lanes = [-4800, -1600, 1600, 4800];
        planetFiles.forEach((path, index) => {
            // Criar um placeholder simples
            const placeholderGeo = new THREE.SphereGeometry(50, 32, 32);
            const placeholderMat = new THREE.MeshPhongMaterial({ 
                color: Math.random() * 0xffffff,
                emissive: 0x111111
            });
            const placeholder = new THREE.Mesh(placeholderGeo, placeholderMat);
            // marca de controle para evitar reaparecimento (loop)
            placeholder.userData = { done: false, laneIndex: index };
            
            const xPos = lanes[index] + (Math.random() - 0.5) * 700;
            const yPos = -800 + (Math.random() * 1700);
            
            placeholder.position.set(xPos, yPos, -6000 - Math.random() * 2000);
            placeholder.visible = false;
            this.scene.add(placeholder);
            this.planets.push(placeholder);
            
            // Tentar carregar o modelo real
            this.loader.load(
                path, 
                (gltf) => {
                    const p = gltf.scene;
                    console.log(`✅ Planeta carregado: ${path} (índice ${index})`);

                    // Copiar posição do placeholder
                    p.position.copy(placeholder.position);
                    p.visible = placeholder.visible;
                    p.userData = p.userData || {};
                    // preserva o estado 'done' do placeholder para evitar reaparecimento
                    p.userData.done = placeholder.userData?.done || false;
                    p.userData.laneIndex = placeholder.userData?.laneIndex || index;
                    // Calcular um raio base do modelo para colisões mais precisas
                    try {
                        const box = new THREE.Box3().setFromObject(p);
                        const sphere = new THREE.Sphere();
                        box.getBoundingSphere(sphere);
                        p.userData = p.userData || {};
                        p.userData.baseRadius = sphere.radius || 50;
                    } catch (e) {
                        p.userData = p.userData || {};
                        p.userData.baseRadius = 50;
                    }
                    
                    this.scene.add(p);
                    this.scene.remove(placeholder);
                    
                    // Substituir na array
                    const idx = this.planets.indexOf(placeholder);
                    if (idx !== -1) {
                        this.planets[idx] = p;
                    }
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
        // Só aparece no nível 5
        const shouldBeVisible = (currentLevel === 5);

            if (shouldBeVisible) {
            // Ignora planetas marcados como concluídos
            if (p.userData?.done) return;
            p.position.z += 80 * deltaTime;

            // Calcular distância Z relativa ao jogador (evita aparecer em cima do jogador)
            const playerZ = (playerMesh && playerMesh.position) ? playerMesh.position.z : (playerPosition?.z || 0);
            const relZ = p.position.z - playerZ;

            // Quando passar da nave (relativo) → some e NÃO reseta (evita o loop)
            if (relZ > 1800) {
                p.visible = false;
                // marca como concluído para nunca mais reaparecer
                p.userData = p.userData || {};
                p.userData.done = true;
                // remover do scene para evitar atualizações desnecessárias
                try { this.scene.remove(p); } catch (e) {}
            } else {
                const distZ = Math.abs(relZ);

                // Fade in gradual
                let opacity = 1.0;
                if (distZ > 8000) {
                    opacity = 0;
                    p.visible = false;
                } else {
                    p.visible = true;
                    if (distZ > 6000) {
                        opacity = (8000 - distZ) / 2000;
                    }
                }

                // Aplicar opacidade
                p.traverse((child) => {
                    if (child.isMesh && child.material) {
                        child.material.transparent = true;
                        child.material.opacity = opacity;
                    }
                });

                // Crescimento gradual (baseado na distância relativa ao jogador)
                let scale;
                if (distZ > 7500) {
                    scale = 1;
                } else if (distZ > 6000) {
                    const progress = (7500 - distZ) / 1500;
                    scale = 1 + (30 - 1) * progress;
                } else if (distZ > 3000) {
                    const progress = (6000 - distZ) / 3000;
                    scale = 30 + (150 - 30) * (progress * progress);
                } else if (distZ < 500) {
                    scale = 200;
                } else {
                    const progress = (3000 - distZ) / 2500;
                    scale = 150 + (200 - 150) * progress;
                }

                p.scale.set(scale, scale, scale);

                // Proteção extra: se o planeta estiver surgindo já sobre a nave,
                // reposicionar para uma lane lateral e recuar no Z para evitar sobreposição e flicker.
                if (playerMesh) {
                    const pdx = playerMesh.position.x - p.position.x;
                    const pdy = playerMesh.position.y - p.position.y;
                    const pdz = playerMesh.position.z - p.position.z;
                    const pDist3 = Math.sqrt(pdx * pdx + pdy * pdy + pdz * pdz) || 1;
                    const approxRadius = (p.userData?.baseRadius || 50) * p.scale.x + 150;
                    if (pDist3 < approxRadius * 0.95 && !p.userData?.repositioned) {
                        // Marcar para não reposicionar várias vezes
                        p.userData = p.userData || {};
                        p.userData.repositioned = true;

                        // Escolher uma lane distante do jogador em X
                        const lanes = [-4800, -1600, 1600, 4800];
                        let farthest = lanes[0];
                        let maxDist = -Infinity;
                        for (let ln of lanes) {
                            const d = Math.abs(ln - playerMesh.position.x);
                            if (d > maxDist) { maxDist = d; farthest = ln; }
                        }

                        // Posicionar consistentemente bem atrás do jogador para evitar flash
                        const backZ = (playerMesh.position.z || 0) - (8000 + Math.random() * 2000);
                        p.position.x = farthest + (Math.random() - 0.5) * 200;
                        p.position.z = backZ;
                        // Esconder até que o fade natural traga o planeta
                        p.visible = false;
                    }
                }

                // Colisão (usar distZ relativo)
                if (playerMesh && distZ < 3500) {
                    this._avoidPlanetCollision(playerMesh, p, soundManager);
                }
            }
        } else {
            // Fora do nível 5 → fica invisível
            p.visible = false;
        }
    });

        const pulse = Math.sin(Date.now() * 0.002) * 0.1 + 0.9;
        this.stars.material.opacity = 0.85 * pulse;
        this.clouds.material.opacity = 0.3 * pulse;
        this.moveParticles(this.starPositions, this.starVelocities, this.starCount, this.stars, deltaTime, moveInput, playerPosition);
        this.moveParticles(this.cloudPositions, this.cloudVelocities, this.cloudCount, this.clouds, deltaTime, moveInput);
    }

    resetPlanetPosition(planet, index) {
        planet.position.z = -8500 - Math.random() * 2500;
        
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
        const dz = playerMesh.position.z - planet.position.z;
        const dist2D = Math.sqrt(dx * dx + dy * dy) || 1;
        const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        
        // Use um raio base calculado a partir do modelo, se disponível
        const baseRadius = (planet.userData && planet.userData.baseRadius) ? planet.userData.baseRadius : 50;
        const effectiveRadius = baseRadius * planet.scale.x + 150;
        const detectionRadius = effectiveRadius * 1.6;

        if (dist3D < detectionRadius) {
            // Som apenas uma vez
            if (soundManager && !playerMesh.userData?.planetSoundPlayed) {
                soundManager.play('meteoro');
                playerMesh.userData.planetSoundPlayed = true;
            }

            // Se já penetrou, forçar para fora
            if (dist3D < effectiveRadius) {
                // Empurra a nave para fora favorecendo movimento para o lado ou para cima,
                // em vez de colocá-la exatamente na superfície radial.
                const escapeDir = new THREE.Vector3(dx, dy, dz).normalize();
                // Se a nave estiver muito alinhada verticalmente, priorizar empurrar para cima/baixo
                const verticalBias = Math.abs(dy) < effectiveRadius * 0.6 ? (playerMesh.position.y < planet.position.y ? 1.6 : -1.6) : 1.0;
                const biasedDir = new THREE.Vector3(escapeDir.x * 0.7, escapeDir.y * verticalBias, escapeDir.z * 0.9).normalize();
                playerMesh.position.copy(planet.position.clone().addScaledVector(biasedDir, effectiveRadius + 120));
                return;
            }
            
            // Caso contrário, push suave
            let pushForce = Math.max(0.5, (detectionRadius - dist3D) / (detectionRadius - effectiveRadius) * 6);

            // Se a nave estiver muito centrada verticalmente, incentive passar por cima
            const centeredVertically = Math.abs(dy) < effectiveRadius * 0.5;
            const signY = (playerMesh.position.y < planet.position.y) ? 1 : -1;
            const pushX = (dx / dist3D) * pushForce * 0.6;
            const pushY = (dy / dist3D) * pushForce * (centeredVertically ? (1.8 * signY) : 1.0);
            const pushZ = (dz / dist3D) * pushForce * 0.7;

            playerMesh.position.x += pushX;
            playerMesh.position.y += pushY;
            playerMesh.position.z += pushZ;
        } else {
            if (playerMesh.userData) playerMesh.userData.planetSoundPlayed = false;
        }
    }}