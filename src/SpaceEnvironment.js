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
        this.globe = null;
     
        this.starCount = starCount;
        this.starPositions = new Float32Array(starCount * 3);
        this.starColors = new Float32Array(starCount * 3);
        this.starSizes = new Float32Array(starCount);        // Tamanhos variados
        this.starVelocities = new Float32Array(starCount);
     
        this.cloudCount = cloudCount;
        this.cloudPositions = new Float32Array(cloudCount * 3);
        this.cloudVelocities = new Float32Array(cloudCount);
        this.cloudSizes = new Float32Array(cloudCount);
        this.cloudOpacities = new Float32Array(cloudCount);
     
        this.initParticles();
        this.initEnvironment();
        this.initGlobe();
    }

    initGlobe() {
        this.loader.load('/assets/models/planeta.glb', (gltf) => {
            this.globe = gltf.scene;
            this.globe.position.set(0, -620, -22000);
            this.globe.scale.set(28, 28, 28);
            this.scene.add(this.globe);
            console.log("✅ Planeta carregado e posicionado");
        }, undefined, (error) => console.error("Erro ao carregar planeta:", error));
    }

    initParticles() {
        this.starGeometry = new THREE.BufferGeometry();
        
        for (let i = 0; i < this.starCount; i++) {
            this.resetParticle(i, this.starPositions, this.starVelocities, 40, 20);
            this.setStarColor(i);
            this.starSizes[i] = Math.random() * 1.8 + 0.6; // Tamanhos variados
        }

        this.starGeometry.setAttribute('position', new THREE.BufferAttribute(this.starPositions, 3));
        this.starGeometry.setAttribute('color', new THREE.BufferAttribute(this.starColors, 3));
        this.starGeometry.setAttribute('size', new THREE.BufferAttribute(this.starSizes, 1));

        const starMaterial = new THREE.PointsMaterial({ 
            size: 1.4,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            depthTest: true,
            depthWrite: false,
            sizeAttenuation: true
        });

        this.stars = new THREE.Points(this.starGeometry, starMaterial);
        this.scene.add(this.stars);

        // Nuvens (mantido)
        this.cloudGeometry = new THREE.BufferGeometry();
        for (let i = 0; i < this.cloudCount; i++) {
            this.resetParticle(i, this.cloudPositions, this.cloudVelocities, 8, 4);
            this.cloudSizes[i] = Math.random() * 300 + 100;
        }
        this.cloudGeometry.setAttribute('position', new THREE.BufferAttribute(this.cloudPositions, 3));
      
        const cloudMat = new THREE.PointsMaterial({
            map: cloudTexture,
            sizeAttenuation: true,
            transparent: true,
            depthWrite: false,
            color: 0x446688,
            blending: THREE.NormalBlending
        });
        this.clouds = new THREE.Points(this.cloudGeometry, cloudMat);
        this.scene.add(this.clouds);
    }

    setStarColor(i) {
        const i3 = i * 3;
        const rand = Math.random();
        
        if (rand < 0.45) {
            this.starColors[i3]     = 0.95 + Math.random() * 0.05;
            this.starColors[i3 + 1] = 0.95 + Math.random() * 0.05;
            this.starColors[i3 + 2] = 1.0;
        } else if (rand < 0.75) {
            this.starColors[i3]     = 1.0;
            this.starColors[i3 + 1] = 0.9 + Math.random() * 0.1;
            this.starColors[i3 + 2] = 0.65 + Math.random() * 0.25;
        } else if (rand < 0.9) {
            this.starColors[i3]     = 0.55 + Math.random() * 0.35;
            this.starColors[i3 + 1] = 0.8 + Math.random() * 0.2;
            this.starColors[i3 + 2] = 1.0;
        } else {
            this.starColors[i3]     = 1.0;
            this.starColors[i3 + 1] = 0.45 + Math.random() * 0.35;
            this.starColors[i3 + 2] = 0.25 + Math.random() * 0.25;
        }
    }

    resetParticle(i, posArray, velArray, speedMax, speedMin) {
        const i3 = i * 3;
        posArray[i3] = (Math.random() - 0.5) * 4000;
        posArray[i3 + 1] = (Math.random() - 0.5) * 4000;
        posArray[i3 + 2] = (Math.random() - 0.5) * 4000;
        velArray[i] = Math.random() * speedMax + speedMin;
    }

    initEnvironment() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        this.scene.background = new THREE.Color(0x002244);
    }

    update(deltaTime, playerPosition, moveInput) {
        if (this.globe) {
            this.globe.position.z += 28 * deltaTime;
            this.globe.position.x *= 0.993;
            this.globe.position.y = -620 + Math.sin(Date.now() * 0.00035) * 90;

            const distance = Math.abs(this.globe.position.z);
            const scaleFactor = Math.max(28, 28 + (22000 - distance) / 320);
            this.globe.scale.set(scaleFactor, scaleFactor, scaleFactor);

            if (this.globe.position.z > 2800) {
                this.scene.remove(this.globe);
                this.globe = null;
            }
        }

        const pulse = Math.sin(Date.now() * 0.002) * 0.1 + 0.9;
        this.stars.material.opacity = 0.85 * pulse;
        this.clouds.material.opacity = 0.3 * pulse;

        this.moveParticles(this.starPositions, this.starVelocities, this.starCount, this.stars, deltaTime, moveInput, playerPosition);
        this.moveParticles(this.cloudPositions, this.cloudVelocities, this.cloudCount, this.clouds, deltaTime, moveInput);
    }

    moveParticles(pos, vel, count, points, dt, moveInput, playerPos = null) {
        for (let i = 0; i < count; i++) {
            let i3 = i * 3;

            // Movimento normal
            pos[i3 + 2] += vel[i] * 32 * dt;
            pos[i3] -= moveInput.x * 20.0 * dt;
            pos[i3 + 1] -= moveInput.y * 20.0 * dt;

            // Efeito de "abrir caminho" quando a nave passa perto
            if (playerPos) {
                const dx = pos[i3] - playerPos.x;
                const dy = pos[i3 + 1] - playerPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 180 && dist > 0) {
                    const pushForce = (180 - dist) / 180 * 2.5;
                    pos[i3] += (dx / dist) * pushForce;
                    pos[i3 + 1] += (dy / dist) * pushForce;
                }
            }

            // Reset
            if (pos[i3 + 2] > 50) {
                pos[i3 + 2] = -2000;
                pos[i3] = (Math.random() - 0.5) * 1000;
                pos[i3 + 1] = (Math.random() - 0.5) * 1000;
                this.setStarColor(i);
                this.starSizes[i] = Math.random() * 1.8 + 0.6;
            }
        }
        points.geometry.attributes.position.needsUpdate = true;
        if (points.geometry.attributes.color) points.geometry.attributes.color.needsUpdate = true;
    }
}