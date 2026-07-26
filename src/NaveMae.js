import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class NaveMae {
    constructor(scene) {
        // Trava global absoluta
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
        this.hp = 85000; 
        this.maxHp = 85000;
        this.isBoss = true;
        this.isAlive = false;
        this.isActive = false;
        this.invulnerableUntil = 0;
        this.spawnTime = 0;
        this.currentInternalScale = 0.5; 

        this.startScale = 0.5;
        this.maxScale = 35;
        this.startZ = -2500;
        
        this.loader = new GLTFLoader();
        this._loadModel();
        this._loadExplosionModel();
    }

    _loadModel() {
        this.loader.load('/assets/models/nave_mae/scene.gltf', (gltf) => {
            if (window.__NAVE_MAE_ATIVA !== this) return;

            this.mesh = gltf.scene;
            this.mesh.userData = { isBoss: true };
            this.mesh.visible = this.isActive;
            this.mesh.position.set(0, 60, this.startZ);
            this.mesh.scale.set(this.currentInternalScale, this.currentInternalScale, this.currentInternalScale);
            this.mesh.rotation.y = Math.PI;

            this.mesh.traverse((child) => {
                if (child.isMesh) {
                    child.frustumCulled = false;
                    child.castShadow = true;
                }
            });
            this.scene.add(this.mesh);
            console.log('✅ Nave Mãe adicionada e pronta para o combate');
        }, undefined, (error) => {
            console.error('❌ Erro crítico ao carregar nave_mae:', error);
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

        // CÁLCULO DE CRESCIMENTO GRADATIVO (Nível 50 ao 100)
        // Se o nível for menor que 50, o multiplicador vira 1.0x (segurança)
        const nivelSeguro = Math.max(50, Math.min(100, nivel));
        const progressoNivel = (nivelSeguro - 50) / (100 - 50); // Valor entre 0.0 e 1.0
        const multiplicadorEscala = 1.0 + (progressoNivel * 1.0); // Vai de 1.0x até 2.0x

        // Multiplica a vida base pelo tamanho do nível
        this.hp = Math.floor(85000 * multiplicadorEscala); 
        this.maxHp = this.hp;

        // Atualiza os limites de escala baseados no crescimento gradativo
        this.startScale = 0.5 * multiplicadorEscala;
        this.maxScale = 35 * multiplicadorEscala;

        this.currentInternalScale = this.startScale;
        this.spawnTime = Date.now(); 
        this.invulnerableUntil = Date.now() + 12000; 

        if (this.mesh) {
            this.mesh.visible = true;
            this.mesh.position.set(0, 60, this.startZ); 
            this.mesh.scale.set(this.startScale, this.startScale, this.startScale); 
        }
        console.log(`💀 [BOSS DE VERDADE] Nave Mãe Nível ${nivel} (Multiplicador: ${multiplicadorEscala.toFixed(2)}x) iniciando aproximação!`);
        return true;
    }

    takeDamage(amount, hitPoint = null, explosionManager = null) {
        if (!this.isAlive || !this.isActive) return false;
        
        // Ajuste dinâmico do bloqueio de dano proporcional ao tamanho máximo da nave
        if (this.currentInternalScale < (this.maxScale * 0.57)) return false; 
        if (Date.now() < this.invulnerableUntil) return false;
        if (this.mesh && this.mesh.position.z < -600) return false;

        const limitedDamage = Math.min(amount, 30);
        this.hp = Math.max(0, this.hp - limitedDamage);

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

        if (this.mesh) this.mesh.visible = false;

        if (this.explosionModel) {
            const position = hitPoint || (this.mesh ? this.mesh.position.clone() : new THREE.Vector3(0, 0, 0));
            this.explosionModel.visible = true;
            this.explosionModel.position.copy(position);
            const currentScale = this.currentInternalScale * 1.4;
            this.explosionModel.scale.set(currentScale, currentScale, currentScale);
        }

        if (explosionManager?.createBigExplosion) {
            explosionManager.createBigExplosion(hitPoint || this.mesh?.position);
        } else if (explosionManager?.create) {
            explosionManager.create(hitPoint || this.mesh?.position, 6.0);
        }
        console.log("🌌 Nave Mãe destruída majestosamente cara a cara!");
    }

    update(deltaTime, playerPosition, laserManager = null, explosionManager = null) {
        if (!this.isAlive || !this.isActive) return;

        const targetZ = (playerPosition?.z ?? 0) - 450; 
        const target = new THREE.Vector3(0, 35, targetZ);
        
        if (playerPosition) {
            target.x = THREE.MathUtils.clamp(playerPosition.x * 0.35, -90, 90);
            target.y = Math.max(25, playerPosition.y + 15);
        }

        const timeSinceSpawn = Date.now() - this.spawnTime;
        const lerpSpeed = timeSinceSpawn < 6000 ? 0.009 : 0.035; 

        if (this.mesh) {
            this.mesh.position.lerp(target, lerpSpeed);
            
            const totalDistance = Math.abs(this.startZ - targetZ);
            const currentDistance = Math.abs(this.mesh.position.z - targetZ);
            const progress = THREE.MathUtils.clamp(1 - (currentDistance / totalDistance), 0, 1);
            
            this.currentInternalScale = THREE.MathUtils.lerp(this.startScale, this.maxScale, progress);
            this.mesh.scale.set(this.currentInternalScale, this.currentInternalScale, this.currentInternalScale);

            this.mesh.rotation.y = Math.PI + Math.sin(Date.now() * 0.0004) * 0.12;
            this.mesh.rotation.z = Math.sin(Date.now() * 0.0006) * 0.06;
            
            if (this.mesh.position.z < -600) return;
        } else {
            const timeProgress = THREE.MathUtils.clamp(timeSinceSpawn / 8000, 0, 1);
            this.currentInternalScale = THREE.MathUtils.lerp(this.startScale, this.maxScale, timeProgress);
        }

        // Ajuste dinâmico do raio de colisão baseado no tamanho atualizado
        if (this.currentInternalScale < (this.maxScale * 0.57)) return;

        const hitRadius = this.currentInternalScale * 3.8; 

        if (this.mesh && laserManager?.lasers) {
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

        if (this.mesh && laserManager?.missiles) {
            for (let i = laserManager.missiles.length - 1; i >= 0; i--) {
                const missile = laserManager.missiles[i];
                if (!missile?.mesh?.position) continue;

                if (missile.mesh.position.distanceTo(this.mesh.position) < hitRadius * 1.2) {
                    this.takeDamage(35, missile.mesh.position.clone(), explosionManager);
                    break;
                }
            }
        }
    }

    dispose() {
        if (window.__NAVE_MAE_ATIVA === this) {
            window.__NAVE_MAE_ATIVA = null;
        }

        if (this.mesh) {
            this.mesh.traverse((child) => {
                if (child.isMesh) {
                    child.geometry?.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else if (child.material) {
                        child.material.dispose();
                    }
                }
            });
            this.scene.remove(this.mesh);
        }
        if (this.explosionModel) this.scene.remove(this.explosionModel);
    }
}
