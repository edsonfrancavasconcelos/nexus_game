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
        this.nebulaPivot = new THREE.Group(); 
        this.scene.add(this.nebulaPivot);
        
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
        this.loadNebula(); 
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

    loadNebula() {
        this.loader.load('/assets/models/spaco.glb', (gltf) => {
            this.nebula = gltf.scene;
            this.nebula.scale.set(80, 80, 80);
            this.nebula.position.set(0, 0, -1500); 
            this.nebula.traverse(child => { if(child.isMesh) child.material.depthWrite = false; });
            this.nebulaPivot.add(this.nebula);
        });
    }
update(deltaTime, playerPosition, moveInput) {
    // 1. Rotação do PIVÔ
    if (this.nebulaPivot) {
        this.nebulaPivot.rotation.z += (moveInput.x * 0.5) * deltaTime;
        this.nebulaPivot.rotation.x += (moveInput.y * 0.3) * deltaTime;
    }

    // 2. Nebulosa (Muito lenta para dar sensação de distância)
    if (this.nebula) {
        this.nebula.position.z += 5.0 * deltaTime; // Reduzido para 5
        if (this.nebula.position.z > 500) this.nebula.position.z = -1500;
    }

    // 3. MOVIMENTO DAS ESTRELAS E NUVENS (Ajuste aqui para diminuir)
    // O último parâmetro é o speedMultiplier. 
    // Diminua esses valores para deixar o movimento mais lento.
    // Antes estava 80.0 e 40.0, agora coloquei 20.0 e 10.0
    this.moveParticles(this.starPositions, this.starVelocities, this.starCount, this.stars, deltaTime, moveInput, 20.0);
    this.moveParticles(this.cloudPositions, this.cloudVelocities, this.cloudCount, this.clouds, deltaTime, moveInput, 10.0);
}

moveParticles(pos, vel, count, points, dt, moveInput, speedMultiplier) {
    for (let i = 0; i < count; i++) {
        let i3 = i * 3;
        
        // Movimento Z (Profundidade) - Controlado pelo speedMultiplier
        pos[i3 + 2] += vel[i] * speedMultiplier * dt;
        
        // Drift lateral (reduzido para não ficar agressivo)
        pos[i3] -= moveInput.x * 20.0 * dt; 
        pos[i3 + 1] -= moveInput.y * 20.0 * dt;

        // Reset
        if (pos[i3 + 2] > 50) {
            pos[i3 + 2] = -2000;
            pos[i3] = (Math.random() - 0.5) * 1000;
            pos[i3 + 1] = (Math.random() - 0.5) * 1000;
        }
    }
    points.geometry.attributes.position.needsUpdate = true;
}
}