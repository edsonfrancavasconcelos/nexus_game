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

        this.particles = [];
        this.particleGeometry = new THREE.SphereGeometry(1.2, 5, 5); 
        this.particleMaterial = new THREE.MeshBasicMaterial({
            color: 0xdddddd,          
            transparent: true,
            opacity: 0.18,            
            blending: THREE.NormalBlending, 
            depthWrite: false
        });

        // 🛰️ CONFIGURAÇÃO PDC (DOIS CANHÕES)
        this.pdcRange = 650;
        this.pdcCooldown = 0.05;
        this.pdcTimer = 0;
        this.pdcProjectiles = [];
        this.pdcBulletGeo = new THREE.CylinderGeometry(0.10, 0.10, 5, 6);
        this.pdcBulletGeo.rotateX(Math.PI / 2);
        this.pdcBulletMat = new THREE.MeshBasicMaterial({ color: 0xffee88, toneMapped: false });

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

    _updatePDC(enemyManager, dt) {
        this.pdcTimer += dt;
        if (!this.shipModel || !enemyManager?.enemies?.length) {
            this._updatePDCProjectiles(enemyManager, dt);
            return;
        }
        let closestEnemy = null;
        let closestDist = Infinity;
        enemyManager.enemies.forEach((enemy) => {
            if (!enemy || enemy.userData?.type === 'meteoro') return;
            const dist = this.mesh.position.distanceTo(enemy.position);
            if (dist < this.pdcRange && dist < closestDist) {
                closestDist = dist;
                closestEnemy = enemy;
            }
        });
        if (closestEnemy) {
            const targetPos = new THREE.Vector3();
            closestEnemy.getWorldPosition(targetPos);
            this.pdcCannons.forEach(c => c.container.lookAt(targetPos));
            if (this.pdcTimer >= this.pdcCooldown) {
                this.pdcCannons.forEach(c => this._firePDCShot(targetPos, c));
                this.pdcTimer = 0;
            }
        }
        this._updatePDCProjectiles(enemyManager, dt);
    }

_firePDCShot(targetPos, cannon) {
    const bullet = new THREE.Mesh(this.pdcBulletGeo, this.pdcBulletMat);
    const spawnPos = new THREE.Vector3();
    cannon.container.getWorldPosition(spawnPos);
    bullet.position.copy(spawnPos);
    bullet.lookAt(targetPos);
    this.scene.add(bullet);
    
    // --- CORREÇÃO AQUI: Acessando o soundManager via window ---
    if (window.soundManager) {
        window.soundManager.play('pdc');
    }
    // ---------------------------------------------------------

    const dir = new THREE.Vector3().subVectors(targetPos, spawnPos).normalize();
    this.pdcProjectiles.push({ mesh: bullet, dir: dir });
}

    _updatePDCProjectiles(enemyManager, dt) {
        for (let i = this.pdcProjectiles.length - 1; i >= 0; i--) {
            const b = this.pdcProjectiles[i];
            b.mesh.position.addScaledVector(b.dir, 950 * dt);
            let hit = false;
            if (enemyManager?.enemies) {
                for (let j = enemyManager.enemies.length - 1; j >= 0; j--) {
                    const e = enemyManager.enemies[j];
                    if (!e || e.userData?.type === 'meteoro') continue;
                    if (b.mesh.position.distanceTo(e.position) < 38) {
                        // Aplica dano e verifica se deve explodir
                        const canExplode = enemyManager.damageEnemy ? enemyManager.damageEnemy(e, 22, b.mesh.position) : true;
                    // ... dentro do seu _updatePDCProjectiles, substitua o bloco 'if (canExplode)' por este:

// Substitua o bloco if (canExplode) no seu arquivo Player.js por este aqui:

if (canExplode) {
    // Tenta disparar a explosão de 3 formas diferentes para garantir que funcione
    try {
        if (window.explosionManager) {
            window.explosionManager.create(b.mesh.position.clone());
        } else if (typeof explosionManager !== 'undefined') {
            explosionManager.create(b.mesh.position.clone());
        } else {
            console.error("ExplosionManager não encontrado no escopo global!");
        }
    } catch (err) {
        console.error("Erro ao tentar executar a explosão:", err);
    }

    this.scene.remove(e);
    enemyManager.enemies.splice(j, 1);
}
                        hit = true; 
                        break;
                    }
                }
            }
            if (hit || b.mesh.position.distanceTo(this.mesh.position) > this.pdcRange + 200) {
                this.scene.remove(b.mesh);
                this.pdcProjectiles.splice(i, 1);
            }
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
        if (Math.abs(this.mesh.position.x) > 350) { this.mesh.position.x = 350 * Math.sign(this.mesh.position.x); this.velocity.x = 0; }
        if (Math.abs(this.mesh.position.y) > 250) { this.mesh.position.y = 250 * Math.sign(this.mesh.position.y); this.velocity.y = 0; }
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
            if (p.life <= 0) { this.scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); this.particles.splice(i, 1); }
        }
        const time = Date.now() * 0.003;
        if (this.fuselageLight) this.fuselageLight.intensity = 110 + Math.sin(time * 2) * 20;
        this.thrusters.forEach((t) => { t.core.scale.set(0.8, 1 + Math.sin(time * 10) * 0.1, 0.8); t.light.intensity = 100 + Math.sin(time * 50) * 30; });
    }
}