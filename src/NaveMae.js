import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class NaveMae {
    constructor(scene) {
        if (window.__NAVE_MAE_ATIVA) {
            console.warn('⚠️ Nave Mãe duplicada bloqueada');
            this.isAlive = false;
            this.isActive = false;
            return;
        }
        window.__NAVE_MAE_ATIVA = this;

        this.scene = scene;
        this.mesh = null;
        this.explosionModel = null;
        this.hp = 250000;
        this.maxHp = 250000;
        this.isBoss = true;
        this.isAlive = false;
        this.isActive = false;
        this.invulnerableUntil = 0;
        this.spawnTime = 0;
        this.currentInternalScale = 2;
        this.lastFireTime = 0;
        this.fireRate = 2.2; // segundos entre tiros de boss
        this.bossLaserSound = 'laser_inimigo';

        this.startScale = 45;
        this.maxScale = 350;
        this.startZ = -1800;
        this.cannonOffsets = [
            new THREE.Vector3(80, 55, 0),
            new THREE.Vector3(-80, 55, 0),
            new THREE.Vector3(0, 55, 70),
            new THREE.Vector3(0, 55, -70)
        ];

        this.loader = new GLTFLoader();
        this.textureLoader = new THREE.TextureLoader();
        this.fogoTexture = this.textureLoader.load('/assets/img/fire_prev.png');

        this._loadModel();
        this._loadExplosionModel();
    }

    _loadModel() {
        this.loader.load('/assets/models/nave_mae/scene.gltf', (gltf) => {
            if (window.__NAVE_MAE_ATIVA !== this) return;

            this.mesh = gltf.scene;
            this.mesh.userData = { isBoss: true, type: 'boss', laserSound: this.bossLaserSound };
            this.mesh.visible = false;
            this.mesh.position.set(0, 40, this.startZ);
            this.mesh.scale.set(this.startScale, this.startScale, this.startScale);
            this.mesh.rotation.y = Math.PI;

            this.mesh.traverse((child) => {
                if (child.isMesh) {
                    child.frustumCulled = false;
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            this.scene.add(this.mesh);
            console.log('✅ Nave Mãe adicionada e pronta para o combate');
        }, undefined, (error) => {
            console.error('❌ Erro ao carregar nave_mae:', error);
        });
    }

    _loadExplosionModel() {
        this.loader.load('/assets/models/nave_mae/explosion.glb', (gltf) => {
            if (window.__NAVE_MAE_ATIVA !== this) return;

            this.explosionModel = gltf.scene;
            this.explosionModel.visible = false;
            this.explosionModel.position.set(0, 0, -100);
            this.explosionModel.scale.set(5, 5, 5);
            this.scene.add(this.explosionModel);
        });
    }

  ativarNave(nivel) {
    this.isAlive = true;
    this.isActive = true;

    // Sempre começa no “modo nível 50” (pequena) e cresce com o tempo
    this.hp = 10;          // 10 acertos para zerar o boss
    this.maxHp = 10;
    this.requiredDestructionLevel = 98;

    this.startScale = 12;       // já aparece, mas ainda pequena
    this.maxScale = 320;        // fica GIGANTE (estilo da imagem)
    this.currentInternalScale = this.startScale;

    this.spawnTime = Date.now();
    this.invulnerableUntil = Date.now() + 2500; // 2,5 segundos de invulnerabilidade inicial
    this.lastHpPercentLog = 100;

    if (this.mesh) {
        if (!this.mesh.parent) this.scene.add(this.mesh);
        this.mesh.visible = true;
        this.mesh.position.set(0, 50, this.startZ);
        this.mesh.scale.set(this.startScale, this.startScale, this.startScale);
    } else {
        setTimeout(() => {
            if (this.mesh) {
                if (!this.mesh.parent) this.scene.add(this.mesh);
                this.mesh.visible = true;
                this.mesh.position.set(0, 50, this.startZ);
                this.mesh.scale.set(this.startScale, this.startScale, this.startScale);
            }
        }, 500);
    }

    console.log(`💀 [BOSS] Nave Mãe ativada | HP: ${this.hp} | escala ${this.startScale} → ${this.maxScale}`);
    return true;
}

    _calculateVulnerability(level) {
        if (level < 50) return 0;
        return Math.min(10, Math.floor((level - 50) / 5) + 1);
    }

    takeDamage(amount, hitPoint = null, explosionManager = null) {
        if (!this.isAlive || !this.isActive) return false;
        if (Date.now() < this.invulnerableUntil) return false;

        const currentLevel = window.currentLevel || 50;
        const allowedSegments = this._calculateVulnerability(currentLevel);
        const minHp = Math.max(0, this.maxHp - allowedSegments);

        if (this.hp <= minHp) {
            return false;
        }

        this.hp = Math.max(minHp, this.hp - 1);

        const percent = Math.floor((this.hp / this.maxHp) * 100);
        if (percent >= 0 && percent % 10 === 0 && percent < this.lastHpPercentLog) {
            console.log(`🩸 Boss HP: ${percent}% (${this.hp})`);
            this.lastHpPercentLog = percent;
        }

        if (explosionManager && hitPoint) {
            explosionManager.create(hitPoint.clone(), {
                kind: 'boss',
                flashColor: 0xff6600,
                lightColor: 0xffbb33,
                lightIntensity: 1800,
                smokeColor: 0x662200
            });
        }

        if (this.hp <= 0) {
            this.explode(hitPoint, explosionManager);
            return true;
        }
        return false;
    }

explode(hitPoint = null, explosionManager = null) {
    this.isAlive = false;
    this.isActive = false;
    if (explosionManager && hitPoint) {
        explosionManager.create(hitPoint, {
            kind: 'boss',
            flashColor: 0xff6600,
            lightColor: 0xffbb33,
            lightIntensity: 2800,
            smokeColor: 0x662200
        });
    }
}

update(deltaTime, playerPosition, laserManager = null, explosionManager = null, player = null, enemyManager = null, soundManager = null) {
    if (!this.isAlive || !this.isActive || !this.mesh) return;    

    const timeSinceSpawn = (Date.now() - this.spawnTime) / 1000; // segundos

    // ===== CRESCIMENTO GRADUAL POR TEMPO (principal) =====
    // Demora ~4–5 minutos para chegar no tamanho máximo
    const growthDuration = 280; // segundos (~4,5 min)
    const timeProgress = Math.min(1, timeSinceSpawn / growthDuration);

    // Também considera a aproximação (mas com peso menor)
    const targetZ = (playerPosition?.z ?? 0) - 220;
    const totalDistance = Math.abs(this.startZ - targetZ);
    const currentDistance = Math.abs(this.mesh.position.z - targetZ);
    const approachProgress = THREE.MathUtils.clamp(1 - (currentDistance / totalDistance), 0, 1);

    // 70% tempo + 30% aproximação → cresce bem devagar e fica gigante
    const progress = timeProgress * 0.70 + approachProgress * 0.30;

    this.currentInternalScale = THREE.MathUtils.lerp(this.startScale, this.maxScale, progress);
    this.mesh.scale.set(
        this.currentInternalScale,
        this.currentInternalScale,
        this.currentInternalScale
    );

    // ===== MOVIMENTO (aproximação lenta) =====
    const target = new THREE.Vector3(0, 40, targetZ);
    if (playerPosition) {
        const bossOrbitX = Math.sin(timeSinceSpawn * 0.14) * 90;
        const bossOrbitY = Math.cos(timeSinceSpawn * 0.08) * 16;
        target.x = THREE.MathUtils.clamp((playerPosition.x ?? 0) * 0.05 + bossOrbitX, -120, 120);
        target.y = Math.max(26, (playerPosition.y ?? 20) + 24 + bossOrbitY);
    }

    // Bem mais lenta no começo
    const lerpSpeed = timeSinceSpawn < 25 ? 0.002 : 0.008;
    this.mesh.position.lerp(target, lerpSpeed);

    // Leve balanço
    this.mesh.rotation.y = Math.PI + Math.sin(Date.now() * 0.00025) * 0.06;
    this.mesh.rotation.z = Math.sin(Date.now() * 0.0004) * 0.03;

    if (player && enemyManager && soundManager) {
        this._attemptShoot(player, enemyManager, soundManager);
    }

    const hitRadius = Math.min(this.currentInternalScale * 0.9, 220);

    // ----- Lasers -----
if (laserManager?.lasers) {
    for (let i = laserManager.lasers.length - 1; i >= 0; i--) {
        const laser = laserManager.lasers[i];
        if (!laser?.position) continue;

        if (laser.position.distanceTo(this.mesh.position) < hitRadius) {
            laserManager.scene.remove(laser);
            laserManager.lasers.splice(i, 1);
            this.takeDamage(8, laser.position.clone(), explosionManager);
            break;
        }
    }
}

// ----- Mísseis -----
if (laserManager?.missiles) {
    for (let i = laserManager.missiles.length - 1; i >= 0; i--) {
        const missile = laserManager.missiles[i];
        if (!missile?.mesh?.position) continue;

        if (missile.mesh.position.distanceTo(this.mesh.position) < hitRadius * 1.3) {
            const hitPoint = missile.mesh.position.clone();
            this.takeDamage(120, hitPoint, explosionManager);

            // Remove o míssil direito
            if (typeof laserManager.disposeMissile === 'function') {
                laserManager.disposeMissile(missile.mesh);
            } else {
                laserManager.scene.remove(missile.mesh);
            }
            laserManager.missiles.splice(i, 1);
            break;
        }
    }
}

// ----- PDC (projéteis do jogador) -----
// O Player guarda os projéteis em player.pdcProjectiles
if (player?.pdcProjectiles) {
    const projectiles = player.pdcProjectiles;
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const b = projectiles[i];
        if (!b?.mesh?.position) continue;

        if (b.mesh.position.distanceTo(this.mesh.position) < hitRadius) {
            this.takeDamage(4, b.mesh.position.clone(), explosionManager); // dano leve por projétil PDC
            this.scene.remove(b.mesh);
            projectiles.splice(i, 1);
        }
    }
}
}

    _getCannonWorldPositions() {
        if (!this.mesh) return [];
        this.mesh.updateMatrixWorld(true);
        return this.cannonOffsets.map((offset) => offset.clone().applyMatrix4(this.mesh.matrixWorld));
    }

    _attemptShoot(player, enemyManager, soundManager) {
        if (!this.mesh || !this.isAlive || !this.isActive) return;
        if (this.currentInternalScale < (this.maxScale * 0.35)) return;

        const now = Date.now();
        if (now - this.lastFireTime < this.fireRate * 1000) return;
        if (!player?.mesh || !enemyManager || typeof enemyManager._enemyShoot !== 'function') return;

        const targetPos = new THREE.Vector3();
        player.mesh.getWorldPosition(targetPos);
        const dist = this.mesh.position.distanceTo(targetPos);
        if (dist > 2200) return;

        this.lastFireTime = now;
        const cannonPositions = this._getCannonWorldPositions();
        cannonPositions.forEach((pos) => {
            const fakeEnemy = {
                position: pos,
                userData: { type: 'boss', laserSound: this.bossLaserSound }
            };
            enemyManager._enemyShoot(fakeEnemy, player, soundManager);
        });
    }

    dispose() {
        if (window.__NAVE_MAE_ATIVA === this) {
            window.__NAVE_MAE_ATIVA = null;
        }

        this.isAlive = false;
        this.isActive = false;

        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh = null;
        }
        if (this.explosionModel) {
            this.scene.remove(this.explosionModel);
            this.explosionModel = null;
        }
    }
}