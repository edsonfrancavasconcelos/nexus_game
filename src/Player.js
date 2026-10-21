import * as THREE from 'three';
import { awardPoints, explosionSizeFor } from './Scoring.js';
import { Afterburner } from './Afterburner.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const _pDir = new THREE.Vector3();
const _pQuat = new THREE.Quaternion();
const _pWorld = new THREE.Vector3();
const _pMove = new THREE.Vector3();
const _pLook = new THREE.Vector3();
const _pSpawn = new THREE.Vector3();
const PDC_POOL_SIZE = 32;
const PDC_BULLET_GEO = new THREE.CylinderGeometry(0.32, 0.22, 6.0, 8).rotateX(Math.PI / 2);
const PDC_CORE_GEO = new THREE.CylinderGeometry(0.11, 0.11, 6.8, 6).rotateX(Math.PI / 2);
const PDC_GLOW_GEO = new THREE.CylinderGeometry(0.62, 0.62, 5.0, 8, 1, true).rotateX(Math.PI / 2);
const PDC_BULLET_MAT = new THREE.MeshBasicMaterial({ color: 0x00bfff, toneMapped: false });
const PDC_CORE_MAT = new THREE.MeshBasicMaterial({ color: 0xeaffff, toneMapped: false });
const PDC_GLOW_MAT = new THREE.MeshBasicMaterial({
    color: 0x1e8fff,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
});

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

        this.afterburner = null;
        this.thrusterLocalPos = null;
        this.wingVacuum = [];
        this.lastShotTime = 0;
        this.fireRate = 110;
        this.thrusterPulse = 0;

        this.pdcRange = 650;
        this.pdcCooldown = 0.12;
        this.pdcTimer = 0;
        this.pdcProjectileLife = 1.2;
        this.pdcProjectiles = [];
        this.pdcProjectilePool = [];
        for (let i = 0; i < PDC_POOL_SIZE; i++) {
            this.pdcProjectilePool.push(this._createPDCProjectile());
        }

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
        const projectile = this.pdcProjectilePool.pop() || this._createPDCProjectile();
        const bullet = projectile.mesh;
        const spawnPos = _pSpawn;
        cannon.container.getWorldPosition(spawnPos);
        bullet.position.copy(spawnPos);
        const spread = 0.26;
        bullet.rotation.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, 0);
        bullet.visible = true;
        this.scene.add(bullet);
        if (window.soundManager) window.soundManager.play('pdc');
        projectile.dir.subVectors(targetPos, spawnPos).normalize();
        projectile.life = this.pdcProjectileLife;
        projectile.startTime = Date.now();
        projectile.offset = Math.random() * Math.PI * 2;
        this.pdcProjectiles.push(projectile);
    }

    _createPDCProjectile() {
        const mesh = new THREE.Group();
        mesh.add(
            new THREE.Mesh(PDC_BULLET_GEO, PDC_BULLET_MAT),
            new THREE.Mesh(PDC_CORE_GEO, PDC_CORE_MAT),
            new THREE.Mesh(PDC_GLOW_GEO, PDC_GLOW_MAT)
        );
        mesh.visible = false;
        return { mesh, dir: new THREE.Vector3(), life: 0, startTime: 0, offset: 0 };
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
            window.soundManager.play('playerShot');
        }
        return true;
    }

    _updatePDCProjectiles(enemyManager, dt, onEnemyDestroyed = null) {
        const now = Date.now();
        for (let i = this.pdcProjectiles.length - 1; i >= 0; i--) {
            const b = this.pdcProjectiles[i];
            const elapsed = (now - b.startTime) * 0.04;
            const moveDir = _pMove.copy(b.dir).multiplyScalar(2000 * dt);
            b.mesh.position.add(moveDir);
            b.mesh.position.x += Math.sin(elapsed * 8 + b.offset) * 3.0 * dt * 5;
            b.mesh.position.y += Math.cos(elapsed * 8 + b.offset) * 3.0 * dt * 5;
            b.mesh.lookAt(_pLook.copy(b.mesh.position).add(b.dir));
            let hit = false;
            if (enemyManager?.enemies) {
                for (let j = enemyManager.enemies.length - 1; j >= 0; j--) {
                    const e = enemyManager.enemies[j];
                    if (!e || e.userData?.type === 'meteoro') continue;

                    const hitRadius = e.userData?.type === 'roblox' ? 64 : 52;
                    if (b.mesh.position.distanceTo(e.position) < hitRadius) {
                        const enemyKilled = enemyManager.damageEnemy ? enemyManager.damageEnemy(e, 15, b.mesh.position) : true;
                        if (window.explosionManager) {
                            window.explosionManager.create(b.mesh.position, {
                                kind: 'plasma',
                                scale: enemyKilled ? explosionSizeFor(e.userData?.type) : 0.45,
                                flashColor: 0xeaffff,
                                lightColor: 0x24cfff
                            });
                        }
                        if (enemyKilled) {
                            this.scene.remove(e);
                            enemyManager.enemies.splice(j, 1);
                            awardPoints(e, 'pdc', b.mesh.position.clone());
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
                        } else {
                            window.explosionManager.create(b.mesh.position, {
                                kind: 'plasma',
                                scale: 0.75,
                                flashColor: 0xeaffff,
                                lightColor: 0x24cfff
                            });
                        }
                    }
                }
            }

            b.life -= dt;
            if (hit || b.life <= 0 || b.mesh.position.distanceTo(this.mesh.position) > this.pdcRange + 200) {
                this.scene.remove(b.mesh);
                this.pdcProjectiles.splice(i, 1);
                b.mesh.visible = false;
                this.pdcProjectilePool.push(b);
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
        this.thrusterLocalPos = new THREE.Vector3(0, 2.0, -9.8);
        const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        this.afterburner = new Afterburner(this.shipModel, this.thrusterLocalPos, { mobile });
    }

    setThrusterActive(active) {
        this.afterburner?.setActive(active);
    }

    _updateAfterburner(dt, moveInput) {
        if (!this.afterburner) return;
        const speed = Math.min(1, this.velocity.length() / 5);
        const input = Math.min(1, Math.hypot(moveInput.x, moveInput.y));
        this.afterburner.update(dt, 0.35 + 0.65 * Math.max(speed, input) + (this.isFiring ? 0.05 : 0));
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
        const direction = _pDir.set(0, 0, 1);
        this.shipModel.getWorldQuaternion(_pQuat);
        direction.applyQuaternion(_pQuat).normalize();
        const guns = this._guns || (this._guns = [this.gunLeft, this.gunRight, this.gunNose]);
        for (let g = 0; g < guns.length; g++) {
            _pWorld.copy(guns[g]).applyMatrix4(this.shipModel.matrixWorld);
            this.laserManager.fire(_pWorld, direction);
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
        this._updateAfterburner(dt, moveInput);

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