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

        this.startScale = 2;
        this.maxScale = 45;
        this.startZ = -1400;

        this.loader = new GLTFLoader();
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

    const nivelSeguro = Math.max(50, Math.min(100, nivel || 50));
    const progressoNivel = (nivelSeguro - 50) / 50;
    const multiplicadorEscala = 1.0 + (progressoNivel * 1.0);

    // Vida bem alta
    this.hp = Math.floor(250000 * multiplicadorEscala);
    this.maxHp = this.hp;

    this.startScale = 2 * multiplicadorEscala;
    this.maxScale = 45 * multiplicadorEscala;
    this.currentInternalScale = this.startScale;

    this.spawnTime = Date.now();
    this.invulnerableUntil = Date.now() + 12000; // 12 segundos de invulnerabilidade

    if (this.mesh) {
        if (!this.mesh.parent) this.scene.add(this.mesh);
        this.mesh.visible = true;
        this.mesh.position.set(0, 40, this.startZ);
        this.mesh.scale.set(this.startScale, this.startScale, this.startScale);
        console.log('📍 Nave Mãe visível em:', this.mesh.position);
    } else {
        setTimeout(() => {
            if (this.mesh) {
                if (!this.mesh.parent) this.scene.add(this.mesh);
                this.mesh.visible = true;
                this.mesh.position.set(0, 40, this.startZ);
                this.mesh.scale.set(this.startScale, this.startScale, this.startScale);
            }
        }, 500);
    }

    console.log(`💀 [BOSS] Nave Mãe Nível ${nivel} | HP: ${this.hp} | x${multiplicadorEscala.toFixed(2)}`);
    return true;
}

   takeDamage(amount, hitPoint = null, explosionManager = null) {
    if (!this.isAlive || !this.isActive) return false;

    // Só começa a tomar dano depois de crescer bastante (mais perto do jogador)
    if (this.currentInternalScale < (this.maxScale * 0.55)) return false;

    // Invulnerabilidade inicial
    if (Date.now() < this.invulnerableUntil) return false;

    // Dano bem reduzido
    // Laser normal: máximo 6 de dano
    // Míssil: máximo 25 de dano
    const limitedDamage = Math.min(amount, amount >= 30 ? 25 : 6);
    
    this.hp = Math.max(0, this.hp - limitedDamage);

    // Log a cada 10% de vida perdida (opcional)
    const percent = Math.floor((this.hp / this.maxHp) * 100);
    if (percent % 10 === 0) {
        console.log(`🩸 Boss HP: ${percent}% (${this.hp})`);
    }

    if (this.hp <= 0) {
        this.explode(hitPoint, explosionManager);
        return true;
    }
    return false;
}

    explode(hitPoint = null, explosionManager = null) {
        if (!this.isAlive) return;

        this.isAlive = false;
        this.isActive = false;

        // Esconde e REMOVE da cena (não fica fantasma no fundo)
        if (this.mesh) {
            this.mesh.visible = false;
            this.scene.remove(this.mesh);
        }

        if (this.explosionModel) {
            const position = hitPoint || new THREE.Vector3(0, 40, -500);
            this.explosionModel.visible = true;
            this.explosionModel.position.copy(position);
            const s = this.currentInternalScale * 1.4;
            this.explosionModel.scale.set(s, s, s);

            // Esconde a explosão depois de 3 segundos
            setTimeout(() => {
                if (this.explosionModel) {
                    this.explosionModel.visible = false;
                }
            }, 3000);
        }

        if (explosionManager?.createBigExplosion) {
            explosionManager.createBigExplosion(hitPoint);
        } else if (explosionManager?.create) {
            explosionManager.create(hitPoint, 6.0);
        }

        console.log('🌌 Nave Mãe destruída e removida da cena!');
    }

    update(deltaTime, playerPosition, laserManager = null, explosionManager = null) {
        if (!this.isAlive || !this.isActive || !this.mesh) return;

        const targetZ = (playerPosition?.z ?? 0) - 500;
        const target = new THREE.Vector3(0, 35, targetZ);

        if (playerPosition) {
            target.x = THREE.MathUtils.clamp(playerPosition.x * 0.3, -100, 100);
            target.y = Math.max(20, playerPosition.y + 20);
        }

        const timeSinceSpawn = Date.now() - this.spawnTime;
        const lerpSpeed = timeSinceSpawn < 5000 ? 0.012 : 0.04;

        this.mesh.position.lerp(target, lerpSpeed);

        const totalDistance = Math.abs(this.startZ - targetZ);
        const currentDistance = Math.abs(this.mesh.position.z - targetZ);
        const progress = THREE.MathUtils.clamp(1 - (currentDistance / totalDistance), 0, 1);

        this.currentInternalScale = THREE.MathUtils.lerp(this.startScale, this.maxScale, progress);
        this.mesh.scale.set(this.currentInternalScale, this.currentInternalScale, this.currentInternalScale);

        this.mesh.rotation.y = Math.PI + Math.sin(Date.now() * 0.0004) * 0.1;
        this.mesh.rotation.z = Math.sin(Date.now() * 0.0006) * 0.05;

      // Só registra hit quando já está bem grande (mais perto)
if (this.currentInternalScale < (this.maxScale * 0.55)) return;

const hitRadius = this.currentInternalScale * 3.2; // hitbox um pouco menor

        // Lasers
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

        // Mísseis
        if (laserManager?.missiles) {
            for (let i = laserManager.missiles.length - 1; i >= 0; i--) {
                const missile = laserManager.missiles[i];
                if (!missile?.mesh?.position) continue;

                if (missile.mesh.position.distanceTo(this.mesh.position) < hitRadius * 1.3) {
                    this.takeDamage(40, missile.mesh.position.clone(), explosionManager);
                    break;
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