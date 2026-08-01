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

        this.startScale = 45;
        this.maxScale = 350;
        this.startZ = -1800;

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
            this.mesh.userData = { isBoss: true };
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
    this.hp = 1800000;          // HP bem alto → aguenta até perto do 100
    this.maxHp = 1800000;

    this.startScale = 12;       // já aparece, mas ainda pequena
    this.maxScale = 320;        // fica GIGANTE (estilo da imagem)
    this.currentInternalScale = this.startScale;

    this.spawnTime = Date.now();
    this.invulnerableUntil = Date.now() + 8000; // 8 segundos de invulnerabilidade inicial

    this.startZ = -2200;        // nasce mais longe

    if (this.mesh) {
        if (!this.mesh.parent) this.scene.add(this.mesh);
        this.mesh.visible = true;
        this.mesh.position.set(0, 50, this.startZ);
        this.mesh.scale.set(this.startScale, this.startScale, this.startScale);
        console.log('📍 Nave Mãe visível em:', this.mesh.position);
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

takeDamage(amount, hitPoint = null, explosionManager = null) {
    if (!this.isAlive || !this.isActive) return false;

    // Só toma dano depois de crescer um pouco
    if (this.currentInternalScale < (this.maxScale * 0.35)) return false;
    if (Date.now() < this.invulnerableUntil) return false;

    // Laser máx 5 | Míssil máx 18  (dano um pouco menor para durar mais)
    const limitedDamage = Math.min(amount, amount >= 30 ? 18 : 5);
    this.hp = Math.max(0, this.hp - limitedDamage);

    const percent = Math.floor((this.hp / this.maxHp) * 100);
    // Log a cada 10% (e evita spam de 0%)
    if (percent > 0 && percent % 10 === 0) {
        console.log(`🩸 Boss HP: ${percent}% (${this.hp})`);
    }

    if (this.hp <= 0) {
        this.explode(hitPoint, explosionManager);
        return true;
    }
    return false;
}

update(deltaTime, playerPosition, laserManager = null, explosionManager = null) {
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
        target.x = THREE.MathUtils.clamp(playerPosition.x * 0.18, -60, 60);
        target.y = Math.max(20, playerPosition.y + 18);
    }

    // Bem mais lenta no começo
    const lerpSpeed = timeSinceSpawn < 25 ? 0.003 : 0.012;
    this.mesh.position.lerp(target, lerpSpeed);

    // Leve balanço
    this.mesh.rotation.y = Math.PI + Math.sin(Date.now() * 0.00025) * 0.06;
    this.mesh.rotation.z = Math.sin(Date.now() * 0.0004) * 0.03;

    // ===== DANO só depois de crescer um pouco =====
    if (this.currentInternalScale < (this.maxScale * 0.35)) return;

    const hitRadius = Math.min(this.currentInternalScale * 0.9, 180);

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
            this.takeDamage(40, hitPoint, explosionManager);

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
// Precisamos do player – veja o ajuste no index.js abaixo
if (this._playerRef?.pdcProjectiles) {
    const projectiles = this._playerRef.pdcProjectiles;
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