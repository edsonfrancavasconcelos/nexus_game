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
        this.globe = null; // Apenas o globo agora
        
        this.starCount = starCount;
        this.starPositions = new Float32Array(starCount * 3);
        this.starVelocities = new Float32Array(starCount);
        
        this.cloudCount = cloudCount;
        this.cloudPositions = new Float32Array(cloudCount * 3);
        this.cloudVelocities = new Float32Array(cloudCount);
        this.cloudSizes = new Float32Array(cloudCount);
        this.cloudOpacities = new Float32Array(cloudCount);
        
        this.initParticles();
        this.initEnvironment();
        this.initGlobe(); // Carrega apenas o planeta
    }

initGlobe() {
    this.loader.load('/assets/models/planeta.glb', (gltf) => {
        this.globe = gltf.scene;
        
        // Ajuste: Y positivo (ex: 2000) coloca ele acima da nave.
        // Ajuste: X positivo (ex: 1000) coloca ele levemente à direita.
        // Isso garante que a trajetória não passe pelo centro da câmera (0,0).
        this.globe.position.set(1000, 2000, -10000); 
        
        this.globe.scale.set(1, 1, 1); 
        this.scene.add(this.globe);
    }, undefined, (error) => console.error("Erro ao carregar planeta:", error));
}

    initParticles() {
        this.starGeometry = new THREE.BufferGeometry();
        for (let i = 0; i < this.starCount; i++) this.resetParticle(i, this.starPositions, this.starVelocities, 40, 20);
        this.starGeometry.setAttribute('position', new THREE.BufferAttribute(this.starPositions, 3));
        this.stars = new THREE.Points(this.starGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, transparent: true, opacity: 0.8 }));
        this.scene.add(this.stars);

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
update(deltaTime, playerPosition, moveInput) {
    // 1. Lógica do Planeta
    if (this.globe) {
        this.globe.position.z += 25.0 * deltaTime; 
        
        const distanceFactor = Math.max(0, 1 - (Math.abs(this.globe.position.z) / 10000));
        const scale = 5 + (distanceFactor * 150);
        this.globe.scale.set(scale, scale, scale);

        this.globe.position.x -= 2.0 * deltaTime; 
        this.globe.position.y -= 2.0 * deltaTime; 

        if (this.globe.position.z > 2000) {
            this.scene.remove(this.globe);
            this.globe = null;
        }
    }

    // 2. Efeito de Realismo: Opacidade variável em vez de tamanho
    // Isso evita o "borrado" estático e cria um "pulso" no espaço
    const pulse = Math.sin(Date.now() * 0.002) * 0.1 + 0.9;
    this.stars.material.opacity = 0.5 * pulse;
    this.clouds.material.opacity = 0.3 * pulse;

    // 3. Movimento das partículas
    this.moveParticles(this.starPositions, this.starVelocities, this.starCount, this.stars, deltaTime, moveInput, 20.0);
    this.moveParticles(this.cloudPositions, this.cloudVelocities, this.cloudCount, this.clouds, deltaTime, moveInput, 10.0);
}

    moveParticles(pos, vel, count, points, dt, moveInput, speedMultiplier) {
        for (let i = 0; i < count; i++) {
            let i3 = i * 3;
            pos[i3 + 2] += vel[i] * speedMultiplier * dt;
            pos[i3] -= moveInput.x * 20.0 * dt; 
            pos[i3 + 1] -= moveInput.y * 20.0 * dt;
            if (pos[i3 + 2] > 50) {
                pos[i3 + 2] = -2000;
                pos[i3] = (Math.random() - 0.5) * 1000;
                pos[i3 + 1] = (Math.random() - 0.5) * 1000;
            }
        }
        points.geometry.attributes.position.needsUpdate = true;
    }
}