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
        
        this.pitch = 0;
        this.roll = 0;
        this.rotationSpeed = 8.0;

        this.velocity = new THREE.Vector2(0, 0);

        this.thrusters = [];
        this.lastShotTime = 0;
        this.fireRate = 110;

        // --- 🛠️ SISTEMA DE VÁCUO QUENTE CORRIGIDO ---
        this.particles = [];
        this.particleGeometry = new THREE.SphereGeometry(1.2, 5, 5); 
        
        this.particleMaterial = new THREE.MeshBasicMaterial({
            color: 0xdddddd,          
            transparent: true,
            opacity: 0.18,            
            blending: THREE.NormalBlending, 
            depthWrite: false
        });

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
        
        this.thrusterLocalPos = new THREE.Vector3(0, 2.0, -9.8);

        const core = new THREE.Mesh(coreGeo, coreMat);
        const light = new THREE.PointLight(0x33ddff, 120, 100);

        core.position.copy(this.thrusterLocalPos);
        light.position.copy(this.thrusterLocalPos);
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

        // Atualiza as matrizes de transformações globais
        this.mesh.updateMatrixWorld();
        this.shipModel.updateMatrixWorld();

        // Invertido para (0, 0, 1) para compensar o Math.PI de rotação traseira do modelo original
        const direction = new THREE.Vector3(0, 0, 1);
        const modelQuaternion = new THREE.Quaternion();
        this.shipModel.getWorldQuaternion(modelQuaternion);
        direction.applyQuaternion(modelQuaternion).normalize();

        [this.gunLeft, this.gunRight, this.gunNose].forEach(localPos => {
            const worldPos = new THREE.Vector3();
            // Calcula a posição global baseada no shipModel para acompanhar os movimentos do bico
            worldPos.setFromMatrixPosition(
                new THREE.Matrix4().multiplyMatrices(this.shipModel.matrixWorld, new THREE.Matrix4().setPosition(localPos))
            );
            
            this.laserManager.fire(worldPos, direction); 
        });
    }

    // --- 🛠️ SISTEMA DE FLUXO DE VAPOR CORRIGIDO PARA MUNDO 3D ---
    _emitHeatWash() {
        if (!this.mesh || !this.shipModel || !this.thrusterLocalPos) return;

        this.mesh.updateMatrixWorld();
        
        // Pega a posição global correta convertendo o ponto local do motor
        const worldPos = new THREE.Vector3();
        worldPos.copy(this.thrusterLocalPos).applyMatrix4(this.shipModel.matrixWorld);

        for(let k = 0; k < 2; k++) {
            const particleMesh = new THREE.Mesh(this.particleGeometry, this.particleMaterial.clone());
            
            particleMesh.position.set(
                worldPos.x + (Math.random() - 0.5) * 1.5,
                worldPos.y + (Math.random() - 0.5) * 1.5,
                worldPos.z
            );

            // Adiciona no cenário global
            this.scene.add(particleMesh);
            
            this.particles.push({
                mesh: particleMesh,
                life: 1.0,
                speedZ: 180, // Velocidade de ejeção para trás ajustada ao sentido real do mapa
                driftX: (Math.random() - 0.5) * 4, 
                driftY: (Math.random() - 0.5) * 4
            });
        }
    }

    update(moveInput, deltaTime) {
        if (!this.shipModel || this.isPaused) return;

        const inputX = -moveInput.x;
        const inputY = moveInput.y; // Mantém o sinal limpo para subir e descer

        const dt = Math.min(deltaTime, 0.1);
        const acel = 65.0; // Aumentado para garantir força de resposta física
        
        // Movimentação direta corrigida nos eixos
        this.velocity.x += inputX * acel * dt;
        this.velocity.y += inputY * acel * dt;
        
        this.velocity.multiplyScalar(0.88); // Amortecimento de deslize macio
        
        this.mesh.position.x += this.velocity.x * dt * 10;
        this.mesh.position.y += this.velocity.y * dt * 10;

        // --- 🚀 LIMITES AMPLOS DE MAPA (SUBIR E DESCER TOTALMENTE LIVRE) ---
        const limiteX = 350; 
        const limiteY = 250; 

        if (Math.abs(this.mesh.position.x) > limiteX) {
            this.mesh.position.x = limiteX * Math.sign(this.mesh.position.x);
            this.velocity.x = 0;
        }
        if (Math.abs(this.mesh.position.y) > limiteY) {
            this.mesh.position.y = limiteY * Math.sign(this.mesh.position.y);
            this.velocity.y = 0;
        }

        // Sincroniza a inclinação visual (pitch) diretamente com a direção do movimento físico
        const targetPitch = inputY * 0.45;  
        const targetRoll = -inputX * 0.65; 

        this.pitch = THREE.MathUtils.lerp(this.pitch, targetPitch, this.rotationSpeed * dt);
        this.roll = THREE.MathUtils.lerp(this.roll, targetRoll, this.rotationSpeed * dt);

        // Corrigido o sinal para que o bico suba ao se movimentar para cima e desça ao se movimentar para baixo
        this.shipModel.rotation.set(this.pitch, Math.PI, this.roll);

        this.mesh.updateMatrixWorld();
        if (this.isFiring) this._shoot();
        
        // Atualiza a emissão do rastro na traseira
        this._emitHeatWash();

        // Loop atualizado das partículas de calor
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Joga o vapor para trás acompanhando o deslocamento Z global
            p.mesh.position.z += p.speedZ * dt; 
            p.mesh.position.x += p.driftX * dt;
            p.mesh.position.y += p.driftY * dt;
            
            p.life -= dt * 4.0; 

            // Expansão do calor enquanto dissipa no espaço
            const currentScale = (1.0 - p.life) * 4.0 + 1.0; 
            p.mesh.scale.set(currentScale, currentScale, currentScale);
            p.mesh.material.opacity = p.life * 0.18;

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.particles.splice(i, 1);
            }
        }

        const time = Date.now() * 0.003;
        if (this.fuselageLight) this.fuselageLight.intensity = 110 + Math.sin(time * 2) * 20;
        this.thrusters.forEach((t) => {
            t.core.scale.set(0.8, 1 + Math.sin(time * 10) * 0.1, 0.8);
            t.light.intensity = 100 + Math.sin(time * 50) * 30;
        });
    }
}