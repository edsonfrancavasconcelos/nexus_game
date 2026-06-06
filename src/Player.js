import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class Player {
    constructor(scene, laserManager) {
        this.scene = scene;
        this.laserManager = laserManager;
        
        this.isFiring = false;
        this.isPaused = false;

        this.mesh = new THREE.Group();
        this.mesh.name = "playerShip";

        this.shipModel = null;
        this.speed = 0.90;
        
        // Parâmetros de rotação profissional (em radianos)
        this.pitch = 0;
        this.roll = 0;
        this.rotationSpeed = 8.0; // Velocidade da resposta da inclinação (Lerp)

        // Variável de velocidade para a física de deslocamento
        this.velocity = new THREE.Vector2(0, 0);

        this.thrusters = [];
        this.lastShotTime = 0;
        this.fireRate = 110;

        this.mesh.position.set(0, 3, 0);
        this.scene.add(this.mesh);

        this._loadModel();
        this._initKeyboard();
        this._initTouchControls();
    }

    _loadModel() {
        const loader = new GLTFLoader();
        loader.load('/assets/models/nave_game.glb', (gltf) => {
            this.shipModel = gltf.scene;
            this.shipModel.scale.set(2, 2, 2);
            
            // Define o Y original invertido e garante os eixos limpos em X e Z
            this.shipModel.rotation.set(0, Math.PI, 0);

            this.shipModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if(child.material) child.material.precision = "mediump";
                }
            });

            this.mesh.add(this.shipModel);
            this._createPlasmaThrusters();
            this._createGunPositions();
            this._createNavigationLights();
        });
    }

    _createNavigationLights() {
        const bottomLight = new THREE.PointLight(0xaaffff, 120, 60);
        bottomLight.position.set(0, -2.5, -4);
        this.shipModel.add(bottomLight);

        const topLight = new THREE.PointLight(0xffffff, 100, 50);
        topLight.position.set(0, 4.5, -4);
        this.shipModel.add(topLight);

        this.fuselageLight = bottomLight;
    }

    _createGunPositions() {
        this.gunLeft = new THREE.Vector3(-8.2, 1.6, -7.5);
        this.gunRight = new THREE.Vector3(8.2, 1.6, -7.5);
        this.gunNose = new THREE.Vector3(0, 2.2, -11.0);
    }

    _createPlasmaThrusters() {
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0x66eeff,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const coreGeo = new THREE.ConeGeometry(0.99, 3.0, 16);
        const pos = new THREE.Vector3(0, 2.0, -9.8);

        const core = new THREE.Mesh(coreGeo, coreMat);
        const light = new THREE.PointLight(0x33ddff, 120, 100);

        core.position.copy(pos);
        light.position.copy(pos);
        core.rotation.x = Math.PI / 2;

        this.shipModel.add(core);
        this.shipModel.add(light);
        this.thrusters.push({ core, light });
    }

    _initKeyboard() {
        const handleKey = (e, val) => {
            if (e.code === 'KeyF' || e.code === 'Space') this.isFiring = val;
        };
        window.addEventListener('keydown', (e) => handleKey(e, true));
        window.addEventListener('keyup', (e) => handleKey(e, false));
    }

    _initTouchControls() {
        const shootBtn = document.getElementById('shootBtn');
        if (shootBtn) {
            shootBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.isFiring = true; });
            shootBtn.addEventListener('pointerup', (e) => { e.preventDefault(); this.isFiring = false; });
            shootBtn.addEventListener('pointerleave', (e) => { this.isFiring = false; });
        }
    }

    _shoot() {
        if (this.isPaused || !this.laserManager || !this.shipModel) return;

        const now = Date.now();
        if (now - this.lastShotTime < this.fireRate) return;
        this.lastShotTime = now;

        this.mesh.updateMatrixWorld();
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(this.mesh.quaternion).normalize();

        [this.gunLeft, this.gunRight, this.gunNose].forEach(localPos => {
            const worldPos = new THREE.Vector3();
            worldPos.setFromMatrixPosition(
                new THREE.Matrix4().multiplyMatrices(this.mesh.matrixWorld, new THREE.Matrix4().setPosition(localPos))
            );
            
            this.laserManager.fire(worldPos, direction); 
        });
    }

update(moveInput, deltaTime) {
    if (!this.shipModel || this.isPaused) return;

    // 🛠️ INVERSÃO DEFINITIVA: Força o input a inverter o sinal aqui na entrada.
    // Se o gerenciador mandar Esquerda (-1), vira Direita (1) e vice-versa.
    const inputX = -moveInput.x;
    const inputY = moveInput.y; // Mantém o Y como está

    const dt = Math.min(deltaTime, 0.1);
    const acel = 5.0; 
    
    // Movimento no plano (Usando o input já corrigido)
    this.velocity.x += inputX * acel * dt;
    this.velocity.y += inputY * acel * dt;
    this.velocity.multiplyScalar(0.95);
    this.mesh.position.x += this.velocity.x;
    this.mesh.position.y += this.velocity.y;

    // Limites do cenário arcades
    const limiteX = 150; 
    const limiteY = 100; 
    if (Math.abs(this.mesh.position.x) > limiteX) {
        this.velocity.x *= -0.5;
        this.mesh.position.x = limiteX * Math.sign(this.mesh.position.x);
    }
    if (Math.abs(this.mesh.position.y) > limiteY) {
        this.velocity.y *= -0.5;
        this.mesh.position.y = limiteY * Math.sign(this.mesh.position.y);
    }

    // --- INTERPOLAÇÃO DE INCLINAÇÃO CINEMATOGRÁFICA ---
    const targetPitch = inputY * 0.45;  
    
    // O Roll (inclinação da asa) também segue o input corrigido para deitar o caça pro lado certo
    const targetRoll = -inputX * 0.65; 

    this.pitch = THREE.MathUtils.lerp(this.pitch, targetPitch, this.rotationSpeed * dt);
    this.roll = THREE.MathUtils.lerp(this.roll, targetRoll, this.rotationSpeed * dt);

    // Aplica as rotações na malha interna 3D
    this.shipModel.rotation.set(this.pitch, Math.PI, this.roll);

    this.mesh.updateMatrixWorld();
    if (this.isFiring) this._shoot();
    
    // Efeitos visuais do motor de Plasma
    const time = Date.now() * 0.003;
    if (this.fuselageLight) this.fuselageLight.intensity = 110 + Math.sin(time * 2) * 20;
    this.thrusters.forEach((t) => {
        t.core.scale.set(0.8, 1 + Math.sin(time * 10) * 0.1, 0.8);
        t.light.intensity = 100 + Math.sin(time * 50) * 30;
    });
}
    }
