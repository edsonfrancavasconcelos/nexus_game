import * as THREE from 'three';
import { markBloom } from './BloomPipeline.js';
import { awardPoints, explosionSizeFor } from './Scoring.js';
import { Afterburner } from './Afterburner.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RAPTOR_FLIGHT_FEEL } from './flight/RaptorFlightFeel.js';

const _pDir = new THREE.Vector3();
const _pQuat = new THREE.Quaternion();
const _pWorld = new THREE.Vector3();
const _pMove = new THREE.Vector3();
const _pLook = new THREE.Vector3();
const _pSpawn = new THREE.Vector3();
const PDC_POOL_SIZE = 32;
// Movimento lateral: ~30% mais rápido que o original (acel 40, amortecimento 0.90 por frame a 60 Hz).
const FEEL = RAPTOR_FLIGHT_FEEL;
const STEER_ACCEL = FEEL.steer.accel;
const STEER_ACCEL_Y = FEEL.steer.vertAccel;
const STEER_DAMPING = FEEL.steer.damping;
const STEER_BRAKE = FEEL.steer.brake;
const BANK_RESPONSE = FEEL.roll.response;
const AFTERBURNER_SPEED_REF = 6.5;
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
        this._yaw = 0;
        this._bankExtra = 0;
        this._pitchExtra = 0;
        this._prevVyN = 0;
        this._swayTime = 0;
        this.flight = null;
        this.worldPosition = new THREE.Vector3();
        this._aimEuler = new THREE.Euler(0, Math.PI, 0);
        this._aimQuat = new THREE.Quaternion();
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

    shiftWorld(dx, dy = 0) {
        if (!dx && !dy) return;
        for (const p of this.pdcProjectiles) { p.mesh.position.x -= dx; p.mesh.position.y -= dy; }
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
        markBloom(mesh);
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
        const noseLocal = this.gunNose || new THREE.Vector3(0, 2.2, 11.0);
        const spawnPos = noseLocal.clone().applyMatrix4(ship.matrixWorld);

        const missileQuat = new THREE.Quaternion();
        if (this.shipModel && !this.isRolling) this._getAimQuat(missileQuat);
        else ship.getWorldQuaternion(missileQuat);
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
            // Caixa do modelo (antes de entrar na cena) para posicionar luzes de navegação nas asas.
            this._shipBounds = new THREE.Box3().setFromObject(this.shipModel);
            this.shipModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = false;
                    child.receiveShadow = false;
                }
            });
            this.mesh.add(this.shipModel);
            this._createWingVacuum();
            this._createPlasmaThrusters();
            this._createGunPositions();
            this._createNavigationLights();
            this._enhanceShip();
        });
    }

    // Qualidade visual da nave: { renderer, shadows }. Pode ser chamado antes ou depois do modelo carregar.
    applyQuality(opts) {
        this._shipQuality = opts;
        if (this.shipModel) this._enhanceShip();
    }

    _enhanceShip() {
        const q = this._shipQuality;
        if (!q || !this.shipModel || this._shipEnhanced) return;
        this._shipEnhanced = true;
        const renderer = q.renderer;
        const aniso = renderer.capabilities.getMaxAnisotropy();

        // Reflexos sutis: cubemap de estúdio aplicado só aos materiais da nave.
        const pmrem = new THREE.PMREMGenerator(renderer);
        const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();

        if (q.shadows) {
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }

        this.shipModel.traverse((child) => {
            if (!child.isMesh) return;
            child.castShadow = !!q.shadows;
            child.receiveShadow = !!q.shadows;
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((material) => {
                if (!material) return;
                material.precision = null;
                for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
                    if (material[key]) material[key].anisotropy = aniso;
                }
                if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
                if (material.isMeshStandardMaterial) {
                    material.envMap = envMap;
                    material.envMapIntensity = 0.55;
                    material.metalness = Math.min(1, material.metalness * 1.05 + 0.04);
                    material.roughness = Math.max(0.18, material.roughness * 0.9);
                }
                material.needsUpdate = true;
            });
        });

        // Luz principal com sombra (acompanha a nave) e contraluz ciano para separar do cenário.
        const key = new THREE.DirectionalLight(0xfff1dc, 1.5);
        key.position.set(-14, 34, 12);
        key.target.position.set(0, 0, 0);
        key.castShadow = !!q.shadows;
        if (q.shadows) {
            const s = key.shadow;
            s.mapSize.set(q.mobile ? 512 : 1024, q.mobile ? 512 : 1024);
            s.camera.left = -30; s.camera.right = 30; s.camera.top = 30; s.camera.bottom = -30;
            s.camera.near = 1; s.camera.far = 90;
            s.bias = -0.0004;
            s.normalBias = 0.05;
        }
        const rim = new THREE.DirectionalLight(0x7fe9ff, 0.9);
        rim.position.set(16, 10, -30);
        this.mesh.add(key, key.target, rim);
        this.shipKeyLight = key;

        this._createWingBeacons();
    }

    // Luzes de posição (vermelha/verde) e strobe branco; materiais básicos pequenos, fora do bloom.
    _createWingBeacons() {
        const b = this._shipBounds;
        if (!b || this.beacons) return;
        const half = 0.5;
        const y = (b.min.y + b.max.y) * 0.5 * half;
        const z = (b.min.z + b.max.z) * 0.5 * half - 1.5;
        const make = (x, zz, color, size) => {
            const m = new THREE.Mesh(
                new THREE.SphereGeometry(size, 8, 6),
                new THREE.MeshBasicMaterial({ color, toneMapped: false })
            );
            m.position.set(x, y + 0.4, zz);
            this.shipModel.add(m);
            return m;
        };
        const tipL = b.min.x * half * 0.76;
        const tipR = b.max.x * half * 0.76;
        this.beacons = {
            left: make(tipL, z, 0xff2a2a, 0.28),
            right: make(tipR, z, 0x2aff6a, 0.28),
            strobeL: make(tipL, z + 1.2, 0xffffff, 0.2),
            strobeR: make(tipR, z + 1.2, 0xffffff, 0.2)
        };
    }

    _updateBeacons(dt) {
        if (!this.beacons) return;
        this._beaconT = (this._beaconT || 0) + dt;
        const t = this._beaconT;
        const pulse = 0.65 + 0.35 * Math.sin(t * 3.2);
        this.beacons.left.material.color.setRGB(1 * pulse, 0.16 * pulse, 0.16 * pulse);
        this.beacons.right.material.color.setRGB(0.16 * pulse, 1 * pulse, 0.42 * pulse);
        const on = (t % 1.3) < 0.09 || ((t + 0.18) % 1.3) < 0.07;
        this.beacons.strobeL.visible = this.beacons.strobeR.visible = on;
    }

    _createWingVacuum() {
        if (!this.shipModel) return;
        this.wingVacuum = [];
    }

    _createGunPositions() {
        this.gunLeft = new THREE.Vector3(-8.2, 1.6, -7.5);
        this.gunRight = new THREE.Vector3(8.2, 1.6, -7.5);
        // O modelo é girado 180 graus no eixo Y; +Z local é o nariz no mundo.
        // Os pontos das asas permanecem inalterados para preservar o disparo existente.
        this.gunNose = new THREE.Vector3(0, 2.2, 11.0);
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
        this.thrusterLocalPos =         new THREE.Vector3(0, 2.0, -10.4);
        const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        this.afterburner = new Afterburner(this.shipModel, this.thrusterLocalPos, { mobile });
    }

    setThrusterActive(active) {
        this.afterburner?.setActive(active);
    }

    _updateAfterburner(dt, moveInput) {
        if (!this.afterburner) return;
        const speed = Math.min(1, this.velocity.length() / AFTERBURNER_SPEED_REF);
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

    // Direção de mira independente da guinada/balanço visuais: mantém o comportamento original dos tiros.
    _getAimQuat(out) {
        if (this.isRolling) return this.shipModel.getWorldQuaternion(out);
        this.mesh.getWorldQuaternion(out);
        return out.multiply(this._aimQuat.setFromEuler(this._aimEuler));
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
        this._getAimQuat(_pQuat);
        direction.applyQuaternion(_pQuat).normalize();
        const guns = this._guns || (this._guns = [this.gunLeft, this.gunRight]);
        for (let g = 0; g < guns.length; g++) {
            _pWorld.copy(guns[g]).applyMatrix4(this.shipModel.matrixWorld);
            this.laserManager.fire(_pWorld, direction);
        }
        _pWorld.copy(this.gunNose).applyMatrix4(this.shipModel.matrixWorld);
        this.laserManager.fire(_pWorld, direction);
    }

    update(moveInput, deltaTime, enemyManager, onPlayerHit = null, onEnemyDestroyed = null) {
        if (!this.shipModel || this.isPaused) return;
        const dt = Math.min(deltaTime, 0.10);

        // Aceleração e amortecimento independentes da taxa de quadros (mesmo comportamento em 60/144 Hz).
        // Ao inverter a direção a frenagem é mais forte, para manter o controle preciso.
        const frames = dt * 60;
        const dir = moveInput.x; // +x = direita da tela (a câmera olha para -z)
        const brakeX = dir * this.velocity.x < 0 ? STEER_BRAKE : 1;
        // Vertical: segue a atitude (pitch) da nave, não o comando direto; sem ShipFlight usa o comando.
        const vertCmd = this.shipFlight ? this.shipFlight.pitchCmd : moveInput.y;
        const brakeY = vertCmd * this.velocity.y < 0 ? STEER_BRAKE : 1;
        this.velocity.x += dir * STEER_ACCEL * brakeX * dt;
        this.velocity.y += vertCmd * STEER_ACCEL_Y * brakeY * dt;
        this.velocity.multiplyScalar(Math.pow(STEER_DAMPING, frames));
        this.mesh.position.x += this.velocity.x * dt;
        this.mesh.position.y += this.velocity.y * dt;

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
            // Inclinação ao virar: proporcional à velocidade lateral real, com resposta rápida e limitada.
            const bankX = THREE.MathUtils.clamp(moveInput.x, -1.2, 1.2);
            const bankY = THREE.MathUtils.clamp(vertCmd, -1.2, 1.2);
            const suavizacao = 1 - Math.exp(-dt * BANK_RESPONSE);
            // Euler XYZ: o pitch é aplicado por último no mundo (sem a inversão do giro de 180°), então +pitch = nariz para cima.
            // O roll é aplicado antes do giro de 180°, por isso +roll = asa direita para baixo.
            const rollCfg = FEEL.roll;
            const rollTarget = Math.sign(bankX) * Math.pow(Math.abs(bankX), rollCfg.curve) * rollCfg.max;
            this.pitch = THREE.MathUtils.lerp(this.pitch, bankY * rollCfg.pitchMax, suavizacao);
            this.roll = THREE.MathUtils.lerp(this.roll, rollTarget, suavizacao);
            this._aimEuler.set(this.pitch, Math.PI, this.roll);

            // Tudo aqui é consequência do comando do jogador (velocidade lateral/vertical real).
            // Sem balanço ou correção automática: sem input a nave fica estável.
            const vxN = THREE.MathUtils.clamp(this.velocity.x / FEEL.steer.refSpeed, -1.2, 1.2);
            const vyN = THREE.MathUtils.clamp(this.velocity.y / FEEL.steer.refSpeed, -1.2, 1.2);
            const flightK = 1 - Math.exp(-dt * rollCfg.followRate);
            this._yaw += (-vxN * rollCfg.yawFromSpeed - this._yaw) * flightK;
            this._bankExtra += (vxN * rollCfg.bankFromSpeed - this._bankExtra) * flightK;
            const vyAccel = THREE.MathUtils.clamp((vyN - this._prevVyN) / Math.max(dt, 1e-3) * 0.02, -0.15, 0.15);
            this._pitchExtra += (vyAccel - this._pitchExtra) * flightK;
            this._prevVyN = vyN;
            // A mira segue o nariz (pitch + yaw): o tiro sai na direção para onde a nave aponta.
            this._aimEuler.set(this.pitch + this._pitchExtra, Math.PI + this._yaw, this.roll);
            this.shipModel.rotation.set(
                this.pitch + this._pitchExtra,
                Math.PI + this._yaw,
                this.roll + this._bankExtra
            );
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
        this._updateBeacons(dt);

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