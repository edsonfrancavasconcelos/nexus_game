import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class Player {
    constructor(scene, laserManager) {
        this.scene = scene;
        this.laserManager = laserManager;
        this.pdcActive = false; // Estado do PDC
        this.missileCount = 3;  // Munição inicial de mísseis        
        this.pdcDurability = 100;
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

        this.particles = [];
        this.particleGeometry = new THREE.SphereGeometry(1.2, 5, 5); 
        this.particleMaterial = new THREE.MeshBasicMaterial({
            color: 0xdddddd,          
            transparent: true,
            opacity: 0.18,            
            blending: THREE.NormalBlending, 
            depthWrite: false
        });

        // 🛰️ CONFIGURAÇÃO PDC
        this.pdcRange = 650;
        this.pdcCooldown = 0.08;
        this.pdcTimer = 0;
        this.pdcProjectiles = [];
        this.pdcBulletGeo = new THREE.CylinderGeometry(0.35, 0.15, 6.0, 8);
        this.pdcBulletGeo.rotateX(Math.PI / 2);
        
        // CORREÇÃO: Usando MeshStandardMaterial para evitar erros de console
        this.pdcBulletMat = new THREE.MeshStandardMaterial({ 
            color: 0xffff00, 
            emissive: 0xff4400, 
            emissiveIntensity: 5.0, 
            toneMapped: false 
        });

        this.pdcCannons = [
            { container: new THREE.Group(), offset: new THREE.Vector3(-3.5, 4.5, -3) },
            { container: new THREE.Group(), offset: new THREE.Vector3(3.5, 4.5, -3) }
        ];

        const pdcGeo = new THREE.CylinderGeometry(0.3, 0.3, 2.5, 5);
        pdcGeo.rotateX(Math.PI / 2);
        const pdcMat = new THREE.MeshBasicMaterial({ color: 0x555566 });

        this.pdcCannons.forEach(c => {
            c.container.position.copy(c.offset);
            const mesh = new THREE.Mesh(pdcGeo, pdcMat);
            c.container.add(mesh);
            this.mesh.add(c.container);
        });

        this.mesh.position.set(0, 3, 0);
        this.scene.add(this.mesh);

        this._loadModel();
        this._initKeyboard();
        this._initTouchControls();
    }

    repairPDC() {
        this.pdcDurability = 100;
        console.log("PDC em 100%");
    }

_updatePDC(enemyManager, dt) {
        // 1. SE O PDC ESTIVER DESLIGADO, NÃO FAZ NADA (além de limpar projéteis antigos)
        if (!this.pdcActive) {
            this._updatePDCProjectiles(enemyManager, dt);
            return;
        }

        // 2. Lógica de busca de alvo
        this.pdcTimer += dt;
        let closestEnemy = null;
        let closestDist = Infinity;

        if (enemyManager?.enemies) {
            enemyManager.enemies.forEach((enemy) => {
                const dist = this.mesh.position.distanceTo(enemy.position);
                if (dist < this.pdcRange && dist < closestDist) {
                    closestDist = dist;
                    closestEnemy = enemy;
                }
            });
        }

        // 3. Só dispara se encontrar um inimigo E o timer permitir
        if (closestEnemy) {
            const targetPos = new THREE.Vector3();
            closestEnemy.getWorldPosition(targetPos);
            this.pdcCannons.forEach(c => c.container.lookAt(targetPos));

            if (this.pdcTimer >= this.pdcCooldown) {
                this.pdcCannons.forEach(c => this._firePDCShot(targetPos, c));
                this.pdcTimer = 0; // Reseta o timer
            }
        }

        this._updatePDCProjectiles(enemyManager, dt);
    }

    _firePDCShot(targetPos, cannon) {
        for (let i = 0; i < 4; i++) {
            const bullet = new THREE.Mesh(this.pdcBulletGeo, this.pdcBulletMat);
            const spawnPos = new THREE.Vector3();
            cannon.container.getWorldPosition(spawnPos);
            bullet.position.copy(spawnPos);
            
            const spread = 0.4; 
            bullet.rotation.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, 0);
            this.scene.add(bullet);
            
            if (i === 0 && window.soundManager) window.soundManager.play('pdc');

            const dir = new THREE.Vector3().subVectors(targetPos, spawnPos).normalize();
            this.pdcProjectiles.push({ 
                mesh: bullet, 
                dir: dir, 
                startTime: Date.now(),
                offset: Math.random() * Math.PI * 2 
            });
        }
    }

    togglePDC() {
        this.pdcActive = !this.pdcActive;
        console.log("PDC está agora:", this.pdcActive ? "ATIVO" : "DESATIVADO");
        return this.pdcActive;
    }

fireMissile() {
    console.log("DEBUG [Player]: Função fireMissile iniciada.");
    
    if (this.missileCount <= 0) {
        console.log("DEBUG [Player]: Sem mísseis disponíveis! Count:", this.missileCount);
        return;
    }

    this.missileCount--;
    console.log("DEBUG [Player]: Míssil lançado! Restam:", this.missileCount);

    // 1. Referência do objeto
    const ship = this.shipModel || this.mesh; 
    console.log("DEBUG [Player]: Usando ship mesh/model:", ship ? "OK" : "ERRO (null)");

    // 2. Cálculo do offset
    const side = (this.missileCount % 2 === 0) ? 2.5 : -2.5;
    const wingOffset = new THREE.Vector3(side, 0, 0); 
    
    // 3. Aplica rotação e calcula posição
    wingOffset.applyQuaternion(ship.quaternion);
    const spawnPos = ship.position.clone().add(wingOffset);
    console.log("DEBUG [Player]: Posição de spawn calculada:", spawnPos);

    // 4. Captura rotação
    const missileQuat = new THREE.Quaternion();
    ship.getWorldQuaternion(missileQuat);
    console.log("DEBUG [Player]: Quaternion gerado:", missileQuat);
    
    // 5. Disparo
    if (this.laserManager && typeof this.laserManager.createMissile === 'function') {
        console.log("DEBUG [Player]: Chamando laserManager.createMissile...");
        this.laserManager.createMissile(spawnPos, missileQuat);
    } else {
        console.error("DEBUG [Player]: ERRO! laserManager ou createMissile não encontrado.");
    }
}

    _updatePDCProjectiles(enemyManager, dt) {
        const now = Date.now();
        for (let i = this.pdcProjectiles.length - 1; i >= 0; i--) {
            const b = this.pdcProjectiles[i];
            const elapsed = (now - b.startTime) * 0.04;
            const waveX = Math.sin(elapsed * 8 + b.offset) * 3.0; 
            const waveY = Math.cos(elapsed * 8 + b.offset) * 3.0;
            
            const moveDir = b.dir.clone().multiplyScalar(2000 * dt);
            b.mesh.position.add(moveDir);
            b.mesh.position.x += waveX * dt * 5;
            b.mesh.position.y += waveY * dt * 5;
            
            b.mesh.lookAt(b.mesh.position.clone().add(b.dir));
            b.mesh.scale.set(1.5, 1.5, 1.5);

            let hit = false;
            if (enemyManager?.enemies) {
                for (let j = enemyManager.enemies.length - 1; j >= 0; j--) {
                    const e = enemyManager.enemies[j];
                    if (!e || e.userData?.type === 'meteoro') continue;
                    if (b.mesh.position.distanceTo(e.position) < 30) {
                        const canExplode = enemyManager.damageEnemy ? enemyManager.damageEnemy(e, 15, b.mesh.position) : true;
                        if (canExplode) {
                            if (window.explosionManager) window.explosionManager.create(b.mesh.position.clone());
                            this.scene.remove(e);
                            enemyManager.enemies.splice(j, 1);
                        }
                        hit = true; break;
                    }
                }
            }

            if (hit || b.mesh.position.distanceTo(this.mesh.position) > this.pdcRange + 200) {
                this.scene.remove(b.mesh);
                this.pdcProjectiles.splice(i, 1);
            }
        }
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
        const coreMat = new THREE.MeshBasicMaterial({ color: 0x66eeff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
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
        const handleKey = (e, val) => { if (e.code === 'KeyF' || e.code === 'Space') this.isFiring = val; };
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
        this.shipModel.updateMatrixWorld();
        const direction = new THREE.Vector3(0, 0, 1);
        const modelQuaternion = new THREE.Quaternion();
        this.shipModel.getWorldQuaternion(modelQuaternion);
        direction.applyQuaternion(modelQuaternion).normalize();
        [this.gunLeft, this.gunRight, this.gunNose].forEach(localPos => {
            const worldPos = new THREE.Vector3();
            worldPos.setFromMatrixPosition(new THREE.Matrix4().multiplyMatrices(this.shipModel.matrixWorld, new THREE.Matrix4().setPosition(localPos)));
            this.laserManager.fire(worldPos, direction); 
        });
    }

    _emitHeatWash() {
        if (!this.mesh || !this.shipModel || !this.thrusterLocalPos) return;
        this.mesh.updateMatrixWorld();
        const worldPos = new THREE.Vector3();
        worldPos.copy(this.thrusterLocalPos).applyMatrix4(this.shipModel.matrixWorld);
        for(let k = 0; k < 2; k++) {
            const particleMesh = new THREE.Mesh(this.particleGeometry, this.particleMaterial.clone());
            particleMesh.position.set(worldPos.x + (Math.random() - 0.5) * 1.5, worldPos.y + (Math.random() - 0.5) * 1.5, worldPos.z);
            this.scene.add(particleMesh);
            this.particles.push({ mesh: particleMesh, life: 1.0, speedZ: 180, driftX: (Math.random() - 0.5) * 4, driftY: (Math.random() - 0.5) * 4 });
        }
    }

    update(moveInput, deltaTime, enemyManager) { 
        if (!this.shipModel || this.isPaused) return;
        
        const inputX = -moveInput.x;
        const inputY = moveInput.y; 
        const dt = Math.min(deltaTime, 0.1);
        const acel = 65.0; 
        
        this.velocity.x += inputX * acel * dt;
        this.velocity.y += inputY * acel * dt;
        this.velocity.multiplyScalar(0.88); 
        this.mesh.position.x += this.velocity.x * dt * 10;
        this.mesh.position.y += this.velocity.y * dt * 10;

        const limiteX = 350;
        const limiteY = 250;
        if (this.mesh.position.x > limiteX) this.mesh.position.x = -limiteX;
        else if (this.mesh.position.x < -limiteX) this.mesh.position.x = limiteX;
        if (this.mesh.position.y > limiteY) this.mesh.position.y = -limiteY;
        else if (this.mesh.position.y < -limiteY) this.mesh.position.y = limiteY;

        this.pitch = THREE.MathUtils.lerp(this.pitch, inputY * 0.45, this.rotationSpeed * dt);
        this.roll = THREE.MathUtils.lerp(this.roll, -inputX * 0.65, this.rotationSpeed * dt);
        this.shipModel.rotation.set(this.pitch, Math.PI, this.roll);
        this.mesh.updateMatrixWorld();
        
        if (this.isFiring) this._shoot();
        this._updatePDC(enemyManager, dt);
        this._emitHeatWash();
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.mesh.position.z += p.speedZ * dt; 
            p.mesh.position.x += p.driftX * dt;
            p.mesh.position.y += p.driftY * dt;
            p.life -= dt * 4.0; 
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

        const debugPanel = document.getElementById('debugPanel');
    const shootBtn = document.getElementById('shootBtn');
    
    const isMoving = Math.abs(inputX) > 0.05 || Math.abs(inputY) > 0.05;

    if (debugPanel) {
        if (isMoving) {
            debugPanel.style.opacity = '0';
            debugPanel.style.pointerEvents = 'none';
        } else {
            debugPanel.style.opacity = '1';
            debugPanel.style.pointerEvents = 'auto';
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