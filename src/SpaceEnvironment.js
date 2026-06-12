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
        this.nebula = null;
        
        this.starCount = starCount;
        this.starPositions = new Float32Array(starCount * 3);
        this.starVelocities = new Float32Array(starCount);
        
        this.cloudCount = cloudCount;
        this.cloudPositions = new Float32Array(cloudCount * 3);
        this.cloudVelocities = new Float32Array(cloudCount);
        // ATRIBUTOS PARA DIVERSIFICAÇÃO
        this.cloudSizes = new Float32Array(cloudCount);
        this.cloudOpacities = new Float32Array(cloudCount);
        
        this.initParticles();
        this.initEnvironment();
        this.loadNebula(); 
    }

    initParticles() {
        // --- ESTRELAS ---
        this.starGeometry = new THREE.BufferGeometry();
        for (let i = 0; i < this.starCount; i++) this.resetParticle(i, this.starPositions, this.starVelocities, 40, 20);
        this.starGeometry.setAttribute('position', new THREE.BufferAttribute(this.starPositions, 3));
        this.stars = new THREE.Points(this.starGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, transparent: true, opacity: 0.8 }));
        this.scene.add(this.stars);

        // --- NUVENS DIVERSIFICADAS ---
        this.cloudGeometry = new THREE.BufferGeometry();
        for (let i = 0; i < this.cloudCount; i++) {
            this.resetParticle(i, this.cloudPositions, this.cloudVelocities, 8, 4);
            this.cloudSizes[i] = Math.random() * 300 + 100; // Tamanhos aleatórios
            this.cloudOpacities[i] = Math.random() * 0.2 + 0.05; // Opacidades aleatórias (mais escuro)
        }
        this.cloudGeometry.setAttribute('position', new THREE.BufferAttribute(this.cloudPositions, 3));
        this.cloudGeometry.setAttribute('size', new THREE.BufferAttribute(this.cloudSizes, 1));
        this.cloudGeometry.setAttribute('opacity', new THREE.BufferAttribute(this.cloudOpacities, 1));
        
        const cloudMat = new THREE.PointsMaterial({ 
            map: cloudTexture, 
            sizeAttenuation: true,
            transparent: true, 
            depthWrite: false,
            color: 0x446688, // Tom azulado escuro mais realista
            blending: THREE.NormalBlending // Normal blending evita o "brilho branco" excessivo
        });
        
        this.clouds = new THREE.Points(this.cloudGeometry, cloudMat);
        this.scene.add(this.clouds);
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
        this.scene.background = new THREE.Color(0x000000);
    }

    loadNebula() {
        this.loader.load('/assets/models/spaco.glb', (gltf) => {
            this.nebula = gltf.scene;
            this.nebula.scale.set(80, 80, 80);
            this.nebula.position.set(0, 0, -1500); 
            this.nebula.traverse(child => { if(child.isMesh) child.material.depthWrite = false; });
            this.scene.add(this.nebula);
        });
    }

    update(deltaTime) {
        if (this.nebula) this.nebula.rotation.z += (0.002 * deltaTime);
        this.moveParticles(this.starPositions, this.starVelocities, this.starCount, this.stars, deltaTime);
        this.moveParticles(this.cloudPositions, this.cloudVelocities, this.cloudCount, this.clouds, deltaTime);
    }

    moveParticles(pos, vel, count, points, dt) {
        for (let i = 0; i < count; i++) {
            pos[i * 3 + 2] += vel[i] * dt;
            if (pos[i * 3 + 2] > 200) pos[i * 3 + 2] = -3000;
        }
        points.geometry.attributes.position.needsUpdate = true;
    }
}