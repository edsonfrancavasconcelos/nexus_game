import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class Player {
    constructor(scene, laserManager) {
        this.scene = scene;
        this.laserManager = laserManager;
        this.pdcActive = false;
        this.missileCount = 10;
        this.maxMissiles = 10;
        this.missileReloadTime = 1.6;
        this.missileReloadTimer = 0;
        this.pdcBurstCount = Infinity;
        this.maxPdcBursts = Infinity;
        this.pdcDurability = 100;
        this.isFiring = false;
        this.isPaused = false;
        this.collisionCooldown = 0;
        
        this.isRolling = false;
        this.rollTimer = 0;
        this.rollDuration = 4.0;
        this.rollDirection = 1;

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
        this.thrusterPulse = 0;

        this.particles = [];
        this.particleGeometry = new THREE.SphereGeometry(1.2, 5, 5); 
        this.particleMaterial = new THREE.MeshBasicMaterial({
            color: 0xdddddd,
            transparent: true,
            opacity: 0.18,
            blending: THREE.NormalBlending,
            depthWrite: false
        });
        this.thrusterGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0x66eaff,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.pdcRange = 650;
        this.pdcCooldown = 0.12;
        this.pdcTimer = 0;
        this.pdcProjectileLife = 1.2;
        this.pdcProjectiles = [];
        this.pdcBulletGeo = new THREE.CylinderGeometry(0.35, 0.15, 6.0, 8);
        this.pdcBulletGeo.rotateX(Math.PI / 2);
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

    repairPDC() { this.pdcDurability = 100; }

    setLevelLoadout(loadout = {}) {
        this.maxMissiles = loadout.missiles ?? 10;
        this.missileCount = Math.min(this.maxMissiles, loadout.missiles ?? 10);
        this.maxPdcBursts = Infinity;
        this.pdcBurstCount = Infinity;
    }

    startBarrelRoll(dir) {
        if (!this.isRolling) {
            this.isRolling = true;
            this.rollTimer = 0;
            this.rollDirection = dir || 1;
            console.log("Direção do Roll definida como:", this.rollDirection);
        }
    }

    getAmmoStatus() {
        return {
            missiles: this.missileCount,
            pdcBursts: this.pdcBurstCount === Infinity ? '∞' : this.pdcBurstCount,
            missileMax: this.maxMissiles,
            missileReloadProgress: this.missileReloadTimer / Math.max(this.missileReloadTime, 0.001)
        };
    }

_updatePDC(enemyManager, dt, onEnemyDestroyed = null) {
        if (!this.pdcActive || this.pdcBurstCount <= 0) {
            this._updatePDCProjectiles(enemyManager, dt, onEnemyDestroyed);
            return;
        }
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

    // ===== NOVO: também mira na Nave Mãe =====
    const boss = window.__NAVE_MAE_ATIVA;
    if (boss?.isActive && boss?.mesh?.visible) {
        const distBoss = this.mesh.position.distanceTo(boss.mesh.position);
        if (distBoss < this.pdcRange && distBoss < closestDist) {
            closestDist = distBoss;
            closestEnemy = boss.mesh; // usa o mesh do boss como alvo
        }
    }
    // ==========================================

    if (closestEnemy) {
        const targetPos = new THREE.Vector3();
        closestEnemy.getWorldPosition(targetPos);
        this.pdcCannons.forEach(c => c.container.lookAt(targetPos));
        if (this.pdcTimer >= this.pdcCooldown) {
            this.pdcBurstCount = Math.max(0, this.pdcBurstCount - 1);
            this.pdcCannons.forEach(c => this._firePDCShot(targetPos, c));
            this.pdcTimer = 0;
        }
    }
    this._updatePDCProjectiles(enemyManager, dt, onEnemyDestroyed);
}

    _firePDCShot(targetPos, cannon) {
        const bullet = new THREE.Mesh(this.pdcBulletGeo, this.pdcBulletMat);
        const spawnPos = new THREE.Vector3();
        cannon.container.getWorldPosition(spawnPos);
        bullet.position.copy(spawnPos);
        const spread = 0.26;
        bullet.rotation.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, 0);
        this.scene.add(bullet);
        if (window.soundManager) window.soundManager.play('pdc');
        const dir = new THREE.Vector3().subVectors(targetPos, spawnPos).normalize();
        this.pdcProjectiles.push({ mesh: bullet, dir: dir, life: this.pdcProjectileLife, startTime: Date.now(), offset: Math.random() * Math.PI * 2 });
    }

    togglePDC() { this.pdcActive = !this.pdcActive; return this.pdcActive; }

   fireMissile() {
    if (this.missileCount <= 0) {
        console.log('🚫 Sem mísseis');
        return false;
    }
    if (!this.laserManager || typeof this.laserManager.createMissile !== 'function') {
        console.log('🚫 LaserManager sem createMissile');
        return false;
    }

    // Garante que a matriz do mundo está atualizada
    this.mesh.updateMatrixWorld(true);
    if (this.shipModel) this.shipModel.updateMatrixWorld(true);

    const ship = this.shipModel || this.mesh;

    // Posição de saída (nariz da nave)
    const noseLocal = this.gunNose || new THREE.Vector3(0, 2.2, -11.0);
    const spawnPos = noseLocal.clone().applyMatrix4(ship.matrixWorld);

    // Direção para frente da nave
    // A nave usa rotation.y = Math.PI e o laser usa +Z local como frente
    const missileQuat = new THREE.Quaternion();
    ship.getWorldQuaternion(missileQuat);

    // Direção visual da nave (frente)
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(missileQuat).normalize();

    // Empurra um pouco para frente para não nascer dentro da nave
    spawnPos.addScaledVector(forward, 14);

    this.missileCount--;
    this.missileReloadTimer = 0;

    this.laserManager.createMissile(spawnPos, missileQuat);

    // Garante que o míssil use a mesma direção para frente
    const last = this.laserManager.missiles[this.laserManager.missiles.length - 1];
    if (last?.mesh) {
        last.mesh.userData.direction = forward.clone();
        // Alinha o modelo do míssil com a direção
        last.mesh.lookAt(spawnPos.clone().add(forward));
    }

    if (window.soundManager) {
        try { window.soundManager.play('missile'); } catch (e) {}
    }

    console.log('🚀 Míssil disparado | restantes:', this.missileCount);
    return true;
}

    _updatePDCProjectiles(enemyManager, dt, onEnemyDestroyed = null) {
        const now = Date.now();
        for (let i = this.pdcProjectiles.length - 1; i >= 0; i--) {
            const b = this.pdcProjectiles[i];
            const elapsed = (now - b.startTime) * 0.04;
            const moveDir = b.dir.clone().multiplyScalar(2000 * dt);
            b.mesh.position.add(moveDir);
            b.mesh.position.x += Math.sin(elapsed * 8 + b.offset) * 3.0 * dt * 5;
            b.mesh.position.y += Math.cos(elapsed * 8 + b.offset) * 3.0 * dt * 5;
            b.mesh.lookAt(b.mesh.position.clone().add(b.dir));
            let hit = false;
            if (enemyManager?.enemies) {
                for (let j = enemyManager.enemies.length - 1; j >= 0; j--) {
                    const e = enemyManager.enemies[j];
                    if (!e || e.userData?.type === 'meteoro') continue;

                    const hitRadius = e.userData?.type === 'roblox' ? 64 : 52;
                    if (b.mesh.position.distanceTo(e.position) < hitRadius) {
                        const enemyKilled = enemyManager.damageEnemy ? enemyManager.damageEnemy(e, 15, b.mesh.position) : true;
                        if (window.explosionManager) {
                            if (enemyKilled) {
                                window.explosionManager.create(b.mesh.position.clone());
                            } else {
                                window.explosionManager.create(b.mesh.position.clone(), 0.45);
                            }
                        }
                        if (enemyKilled) {
                            this.scene.remove(e);
                            enemyManager.enemies.splice(j, 1);

                            if (onEnemyDestroyed) {
                                const enemyType = e.userData?.type;
                                const points = (enemyType === 'meteoro' || enemyType === 'asteroide') ? 500 :
                                               (enemyType === 'drone' ? 250 :
                                               (enemyType === 'roblox' ? 150 : 100));
                                onEnemyDestroyed(points, b.mesh.position.clone());
                            }
                        }
                        hit = true;
                        break;
                    }
                }
            }

            const boss = window.__NAVE_MAE_ATIVA;
            if (!hit && boss?.isActive && boss?.mesh?.visible) {
                const bossHitRadius = Math.min(boss.currentInternalScale * 0.9, 210);
                if (b.mesh.position.distanceTo(boss.mesh.position) < bossHitRadius) {
                    const bossDestroyed = boss.takeDamage(25, b.mesh.position.clone(), window.explosionManager);
                    hit = true;
                    if (window.explosionManager) {
                        if (bossDestroyed) {
                            window.explosionManager.createBigExplosion(b.mesh.position.clone());
                            if (onEnemyDestroyed) onEnemyDestroyed(5000, b.mesh.position.clone());
                        } else {
                            window.explosionManager.create(b.mesh.position.clone(), 0.75);
                        }
                    }
                }
            }

            b.life -= dt;
            if (hit || b.life <= 0 || b.mesh.position.distanceTo(this.mesh.position) > this.pdcRange + 200) {
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
            this.shipModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) child.material.precision = "mediump";
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
        this.fuselageLight = bottomLight;
    }

    _createGunPositions() {
        this.gunLeft = new THREE.Vector3(-8.2, 1.6, -7.5);
        this.gunRight = new THREE.Vector3(8.2, 1.6, -7.5);
        this.gunNose = new THREE.Vector3(0, 2.2, -11.0);
    }

    _createPlasmaThrusters() {
        const flameMaterial = new THREE.MeshBasicMaterial({
            color: 0x8fe9ff,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const innerMaterial = new THREE.MeshBasicMaterial({
            color: 0x33d4ff,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.thrusterLocalPos = new THREE.Vector3(0, 2.0, -9.8);

        const plumeGroup = new THREE.Group();
        plumeGroup.position.copy(this.thrusterLocalPos);

        const glow = new THREE.Mesh(new THREE.SphereGeometry(1.25, 12, 12), this.thrusterGlowMaterial.clone());
        glow.scale.set(1.6, 1.4, 2.2);
        plumeGroup.add(glow);

        const flare = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.2, 18, 1, true), flameMaterial.clone());
        flare.rotation.x = Math.PI / 2;
        flare.position.z = -1.2;
        plumeGroup.add(flare);

        const core = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 16), innerMaterial.clone());
        core.rotation.x = Math.PI / 2;
        core.position.z = -0.8;
        plumeGroup.add(core);

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(1.15, 0.12, 8, 20),
            new THREE.MeshBasicMaterial({
                color: 0x9eeaff,
                transparent: true,
                opacity: 0.7,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.z = -2.0;
        plumeGroup.add(ring);

        const light = new THREE.PointLight(0x5be8ff, 110, 60, 2);
        light.position.set(0, 0, -2);
        plumeGroup.add(light);

        this.shipModel.add(plumeGroup);
        this.thrusters.push({ group: plumeGroup, glow, flare, core, ring, light });
    }

    _initKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyF' || e.code === 'Space') this.isFiring = true;
            if (!e.repeat && (e.code === 'KeyM' || e.code === 'KeyA')) this.fireMissile();
            if (e.code === 'KeyR') this.startBarrelRoll();
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'KeyF' || e.code === 'Space') this.isFiring = false;
        });
    }

    _initTouchControls() {
        const shootBtn = document.getElementById('shootBtn');
        if (shootBtn) {
            shootBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.isFiring = true; });
            shootBtn.addEventListener('pointerup', (e) => { e.preventDefault(); this.isFiring = false; });
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
            const worldPos = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().multiplyMatrices(this.shipModel.matrixWorld, new THREE.Matrix4().setPosition(localPos)));
            this.laserManager.fire(worldPos, direction);
        });
    }

    _emitHeatWash() {
        if (!this.mesh || !this.shipModel || !this.thrusterLocalPos) return;
        this.mesh.updateMatrixWorld();
        const worldPos = new THREE.Vector3().copy(this.thrusterLocalPos).applyMatrix4(this.shipModel.matrixWorld);

        const pulseStrength = 0.75 + Math.sin(Date.now() * 0.02) * 0.25;
        this.thrusters.forEach((thruster, index) => {
            if (!thruster?.group) return;
            const t = 0.7 + index * 0.12 + pulseStrength * 0.3;
            thruster.glow.scale.set(1.4 + pulseStrength * 0.35, 1.2 + pulseStrength * 0.25, 2.0 + pulseStrength * 0.7);
            thruster.flare.scale.set(1.0, 1.0 + pulseStrength * 0.4, 1.0);
            thruster.core.scale.set(1.0, 1.0 + pulseStrength * 0.35, 1.0);
            thruster.ring.scale.set(1.0 + pulseStrength * 0.25, 1.0 + pulseStrength * 0.25, 1.0);
            thruster.light.intensity = 80 + pulseStrength * 60;
            thruster.light.distance = 52 + pulseStrength * 18;
            thruster.group.rotation.z = (index === 0 ? -0.12 : 0.12) + Math.sin(Date.now() * 0.004 + index) * 0.08;
        });

        if (this.particles.length > 24) return;
        for (let k = 0; k < 3; k++) {
            const p = new THREE.Mesh(this.particleGeometry, this.particleMaterial.clone());
            p.position.set(worldPos.x + (Math.random() - 0.5) * 2.2, worldPos.y + (Math.random() - 0.5) * 2, worldPos.z);
            p.scale.setScalar(0.9 + Math.random() * 1.4);
            this.scene.add(p);
            this.particles.push({
                mesh: p,
                life: 0.75 + Math.random() * 0.45,
                speedZ: 200 + Math.random() * 100,
                driftX: (Math.random() - 0.5) * 4,
                driftY: (Math.random() - 0.5) * 4
            });
        }
    }

    update(moveInput, deltaTime, enemyManager, onPlayerHit = null, onEnemyDestroyed = null) {
        if (!this.shipModel || this.isPaused) return;
        const dt = Math.min(deltaTime, 0.10);

        // 1. MOVIMENTO
        const acel = 40.0;
        this.velocity.x += (-moveInput.x) * acel * dt;
        this.velocity.y += (moveInput.y) * acel * dt;
        this.velocity.multiplyScalar(0.90);
        this.mesh.position.x += this.velocity.x * dt * 1;
        this.mesh.position.y += this.velocity.y * dt * 1;

        // 2. LÓGICA DE ROTAÇÃO (Centralizada no Pivot)
        if (this.isRolling) {
            this.rollTimer += dt;
            let progress = Math.min(this.rollTimer / this.rollDuration, 1.0);
            const smoothProgress = progress * progress * (3 - 2 * progress);
            const angle = smoothProgress * (Math.PI * 2) * this.rollDirection;
            this.shipModel.rotation.set(0, Math.PI, angle);

            if (this.rollTimer >= this.rollDuration) {
                this.isRolling = false;
                this.rollTimer = 0;
                this.shipModel.rotation.set(0, Math.PI, 0);
            }
        } else {
            // Controle normal
            const suavizacao = 0.01;
             this.pitch = THREE.MathUtils.lerp(this.pitch, moveInput.y * 0.3,suavizacao);
            this.roll = THREE.MathUtils.lerp(this.roll, -moveInput.x * 0.9, suavizacao);
            this.shipModel.rotation.set(this.pitch, Math.PI, this.roll);
        }

        // 3. RECARGA DE MÍSSEIS
        if (this.missileCount < this.maxMissiles) {
            this.missileReloadTimer += dt;
            if (this.missileReloadTimer >= this.missileReloadTime) {
                this.missileCount = Math.min(this.maxMissiles, this.missileCount + 1);
                this.missileReloadTimer = 0;
            }
        }

        // 4. RESTO DA LÓGICA
        this.mesh.updateMatrixWorld();
        if (this.isFiring) this._shoot();
        this._updatePDC(enemyManager, dt, onEnemyDestroyed);
        this._emitHeatWash();

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.mesh.position.z += p.speedZ * dt;
            p.life -= dt * 4.0;
            if (p.life <= 0) { this.scene.remove(p.mesh); this.particles.splice(i, 1); }
        }
    }

    _isCollidingWithAsteroid(enemyManager) {
        this.mesh.updateMatrixWorld(true);
        const playerBox = new THREE.Box3().setFromObject(this.mesh);
        for (const enemy of enemyManager.enemies) {
            if (enemy?.userData?.type === 'asteroide' || enemy?.userData?.type === 'meteoro') {
                enemy.updateMatrixWorld(true);
                if (playerBox.intersectsBox(new THREE.Box3().setFromObject(enemy))) return true;
            }
        }
        return false;
    }
}