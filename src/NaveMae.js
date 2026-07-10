import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class NaveMae {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.explosionModel = null;
        this.hp = 2500;
        this.maxHp = 2500;
        this.isBoss = true;
        this.isAlive = false;
        this.isActive = false;
        this.invulnerableUntil = 0;
        this.loader = new GLTFLoader();

        this._loadModel();
        this._loadExplosionModel();
    }

    _loadModel() {
        this.loader.load('/assets/models/nave_mae/scene.gltf', (gltf) => {
            this.mesh = gltf.scene;
            this.mesh.userData = { isBoss: true };
            
            this.mesh.visible = false;
            this.mesh.position.set(0, 40, -1800);
            this.mesh.scale.set(12, 12, 12);
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
            this.explosionModel = gltf.scene;
            this.explosionModel.visible = false;
            this.explosionModel.position.set(0, 0, -100);
            this.explosionModel.scale.set(5, 5, 5);
            this.scene.add(this.explosionModel);
        });
    }

ativarNave(nivel) {
    this.isAlive = true;
    this.hp = 8000 + ((nivel - 50) * 300);   // HP alto
    this.maxHp = this.hp;
    this.invulnerableUntil = Date.now() + 6000; // 6 segundos

    if (this.mesh) {
        this.isActive = true;
        this.mesh.visible = true;
        this.mesh.position.set(0, 80, -3200); // Começa bem longe
        this.mesh.scale.set(15, 15, 15);      // Fica grande
        console.log(`💀 Nave Mãe nível ${nivel} apareceu com ${this.hp} de HP!`);
    }
    return true;
}

 takeDamage(amount, hitPoint = null, explosionManager = null) {
    if (!this.isAlive || !this.isActive) return false;
    
    if (Date.now() < this.invulnerableUntil) {
        return false; // Ignora dano
    }

    this.hp = Math.max(0, this.hp - amount);

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
            const position = hitPoint || (this.mesh ? this.mesh.position.clone() : new THREE.Vector3());
            this.explosionModel.visible = true;
            this.explosionModel.position.copy(position);
            this.explosionModel.scale.set(16, 16, 16);
        }

        if (explosionManager?.createBigExplosion) {
            explosionManager.createBigExplosion(hitPoint || this.mesh?.position);
        } else if (explosionManager?.create) {
            explosionManager.create(hitPoint || this.mesh?.position, 3.2);
        }

        console.log("🌌 Nave Mãe destruída. Liberando recursos...");
    }

    update(deltaTime, playerPosition, laserManager = null, explosionManager = null) {
        if (!this.mesh || !this.isAlive || !this.isActive) return;

        // Movimento
        const target = new THREE.Vector3(0, 6, (playerPosition?.z ?? 0) - 700);
        if (playerPosition) {
            target.x = THREE.MathUtils.clamp(playerPosition.x * 0.45, -120, 120);
            target.y = Math.max(6, playerPosition.y + 8);
        }

        this.mesh.position.lerp(target, 0.018);

        this.mesh.rotation.y = Math.PI + Math.sin(Date.now() * 0.0008) * 0.15;
        this.mesh.rotation.z = Math.sin(Date.now() * 0.001) * 0.08;

        // === LASERS ===
        if (laserManager?.lasers) {
            for (let i = laserManager.lasers.length - 1; i >= 0; i--) {
                const laser = laserManager.lasers[i];
                if (!laser?.position) continue;

                if (laser.position.distanceTo(this.mesh.position) < 95) {
                    laserManager.scene.remove(laser);
                    laserManager.lasers.splice(i, 1);
                    this.takeDamage(35, laser.position.clone(), explosionManager); // dano reduzido
                    break;
                }
            }
        }

        // === MISSILES ===
        if (laserManager?.missiles) {
            for (let i = laserManager.missiles.length - 1; i >= 0; i--) {
                const missile = laserManager.missiles[i];   // variável corrigida
                if (!missile?.mesh?.position) continue;

                if (missile.mesh.position.distanceTo(this.mesh.position) < 120) {
                    this.takeDamage(120, missile.mesh.position.clone(), explosionManager); // dano reduzido
                    break;
                }
            }
        }
    }

    dispose() {
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