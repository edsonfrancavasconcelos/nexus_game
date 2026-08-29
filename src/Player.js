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
        this.firingLightPulse = 0;
        this.fuselageLight = null;
        this.fuselageLights = [];

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
        this.wingVacuum = [];
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

        const boss = window.__NAVE_MAE_ATIVA;
        if (boss?.isActive && boss?.mesh?.visible) {
            const distBoss = this.mesh.position.distanceTo(boss.mesh.position);
            if (distBoss < this.pdcRange && distBoss < closestDist) {
                closestDist = distBoss;
                closestEnemy = boss.mesh;
            }
        }

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
        this.firingLightPulse = Math.max(this.firingLightPulse, 0.8);
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
        if (this.missileCount <= 0) return false;
        if (!this.laserManager || typeof this.laserManager.createMissile !== 'function') return false;

        this.firingLightPulse = Math.max(this.firingLightPulse, 1.2);

        this.mesh.updateMatrixWorld(true);
        if (this.shipModel) this.shipModel.updateMatrixWorld(true);

        const ship = this.shipModel || this.mesh;
        const noseLocal = this.gunNose || new THREE.Vector3(0, 2.2, -11.0);
        const spawnPos = noseLocal.clone().applyMatrix4(ship.matrixWorld);

        const missileQuat = new THREE.Quaternion();
        ship.getWorldQuaternion(missileQuat);
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(missileQuat).normalize();
        spawnPos.addScaledVector(forward, 14);

        this.missileCount--;
        this.missileReloadTimer = 0;
        this.laserManager.createMissile(spawnPos, missileQuat);

        const last = this.laserManager.missiles[this.laserManager.missiles.length - 1];
        if (last?.mesh) {
            last.mesh.userData.direction = forward.clone();
            last.mesh.lookAt(spawnPos.clone().add(forward));
        }

        if (window.soundManager) {
            try { window.soundManager.play('missile'); } catch (e) {}
        }
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
                            window.explosionManager.create(b.mesh.position.clone(), enemyKilled ? undefined : 0.45);
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
                    child.castShadow = false;
                    child.receiveShadow = false;
                    if (child.material) child.material.precision = "mediump";
                }
            });
            this.mesh.add(this.shipModel);
            this._createWingVacuum();
            this._createPlasmaThrusters();
            this._createGunPositions();
            this._createNavigationLights();
        });
    }

    _createWingVacuum() {
        if (!this.shipModel) return;
        this.wingVacuum = [];
    }

    _createGunPositions() {
        this.gunLeft = new THREE.Vector3(-8.2, 1.6, -7.5);
        this.gunRight = new THREE.Vector3(8.2, 1.6, -7.5);
        this.gunNose = new THREE.Vector3(0, 2.2, -11.0);
    }

    _createNavigationLights() {
        const makeLight = (x, y, z) => {
            const light = new THREE.PointLight(0x66e8ff, 10, 22, 2);
            light.castShadow = false;
            light.position.set(x, y, z);
            this.shipModel.add(light);
            return light;
        };

        this.fuselageLights = [
            makeLight(-8.2, 1.8, -8.7),
            makeLight(8.2, 1.8, -8.7),
            makeLight(0, 2.3, -11.8)
        ];
        this.fuselageLight = this.fuselageLights[2];
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

        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 10), this.thrusterGlowMaterial.clone());
        glow.scale.set(1.15, 1.0, 1.6);
        plumeGroup.add(glow);

        const flare = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.8, 14, 1, true), flameMaterial.clone());
        flare.rotation.x = Math.PI / 2;
        flare.position.z = -0.8;
        plumeGroup.add(flare);

        const core = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 12), innerMaterial.clone());
        core.rotation.x = Math.PI / 2;
        core.position.z = -0.6;
        plumeGroup.add(core);

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.8, 0.08, 8, 16),
            new THREE.MeshBasicMaterial({
                color: 0x9eeaff,
                transparent: true,
                opacity: 0.55,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.z = -1.5;
        plumeGroup.add(ring);

        const light = new THREE.PointLight(0x5be8ff, 28, 22, 2);
        light.castShadow = false;
        light.position.set(0, 0, -1.5);
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
        this.firingLightPulse = Math.max(this.firingLightPulse, 1.0);
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

        const pulseStrength = 0.55 + Math.sin(Date.now() * 0.018) * 0.18;
        this.thrusters.forEach((thruster, index) => {
            if (!thruster?.group) return;
            thruster.glow.scale.set(1.0 + pulseStrength * 0.18, 0.9 + pulseStrength * 0.15, 1.25 + pulseStrength * 0.4);
            thruster.flare.scale.set(0.9, 1.0 + pulseStrength * 0.2, 1.0);
            thruster.core.scale.set(0.9, 1.0 + pulseStrength * 0.2, 1.0);
            thruster.ring.scale.set(0.95 + pulseStrength * 0.16, 0.95 + pulseStrength * 0.16, 1.0);
            thruster.light.intensity = 16 + pulseStrength * 12;
            thruster.light.distance = 18 + pulseStrength * 6;
            thruster.group.rotation.z = (index === 0 ? -0.08 : 0.08) + Math.sin(Date.now() * 0.004 + index) * 0.05;
        });

        if (this.particles.length > 18) return;
        for (let k = 0; k < 2; k++) {
            const p = new THREE.Mesh(this.particleGeometry, this.particleMaterial.clone());
            p.position.set(worldPos.x + (Math.random() - 0.5) * 1.6, worldPos.y + (Math.random() - 0.5) * 1.4, worldPos.z);
            p.scale.setScalar(0.7 + Math.random() * 0.9);
            this.scene.add(p);
            this.particles.push({
                mesh: p,
                life: 0.55 + Math.random() * 0.3,
                speedZ: 160 + Math.random() * 70,
                driftX: (Math.random() - 0.5) * 3,
                driftY: (Math.random() - 0.5) * 3
            });
        }
    }

    update(moveInput, deltaTime, enemyManager, onPlayerHit = null, onEnemyDestroyed = null) {
        if (!this.shipModel || this.isPaused) return;
        const dt = Math.min(deltaTime, 0.10);

        const acel = 40.0;
        this.velocity.x += (-moveInput.x) * acel * dt;
        this.velocity.y += (moveInput.y) * acel * dt;
        this.velocity.multiplyScalar(0.90);
        this.mesh.position.x += this.velocity.x * dt * 1;
        this.mesh.position.y += this.velocity.y * dt * 1;

        if (this.isRolling) {
            this.rollTimer += dt;
            const progress = Math.min(this.rollTimer / this.rollDuration, 1.0);
            const smoothProgress = progress * progress * (3 - 2 * progress);
            const angle = smoothProgress * (Math.PI * 2) * this.rollDirection;
            this.shipModel.rotation.set(0, Math.PI, angle);

            if (this.rollTimer >= this.rollDuration) {
                this.isRolling = false;
                this.rollTimer = 0;
                this.shipModel.rotation.set(0, Math.PI, 0);
            }
        } else {
            const suavizacao = 0.01;
            this.pitch = THREE.MathUtils.lerp(this.pitch, moveInput.y * 0.3, suavizacao);
            this.roll = THREE.MathUtils.lerp(this.roll, -moveInput.x * 0.9, suavizacao);
            this.shipModel.rotation.set(this.pitch, Math.PI, this.roll);
        }

        if (this.missileCount < this.maxMissiles) {
            this.missileReloadTimer += dt;
            if (this.missileReloadTimer >= this.missileReloadTime) {
                this.missileCount = Math.min(this.maxMissiles, this.missileCount + 1);
                this.missileReloadTimer = 0;
            }
        }

        this.mesh.updateMatrixWorld();
        if (this.isFiring) this._shoot();
        this._updatePDC(enemyManager, dt, onEnemyDestroyed);
        this._emitHeatWash();

        // ===== AJUSTE AQUI =====
        const FLASH_INTENSITY = 150;
        const FLASH_DISTANCE = 80;
        const IDLE_INTENSITY = 10;
        // =======================

        this.firingLightPulse = Math.max(0, this.firingLightPulse - dt * 5.5);
        const pulse = this.firingLightPulse;

        if (this.fuselageLights && this.fuselageLights.length) {
            for (let i = 0; i < this.fuselageLights.length; i++) {
                this.fuselageLights[i].intensity = IDLE_INTENSITY + pulse * FLASH_INTENSITY;
                this.fuselageLights[i].distance = 14 + pulse * FLASH_DISTANCE;
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.mesh.position.z += p.speedZ * dt;
            p.life -= dt * 4.0;
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
            }
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