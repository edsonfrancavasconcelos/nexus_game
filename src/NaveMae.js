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

        const nivelSeguro = Math.max(50, Math.min(100, nivel || 50));
        const progressoNivel = (nivelSeguro - 50) / 50;
        const multiplicadorEscala = 1.0 + (progressoNivel * 1.0);

        this.hp = Math.floor(250000 * multiplicadorEscala);
        this.maxHp = this.hp;

        this.startScale = 2 * multiplicadorEscala;
        this.maxScale = 45 * multiplicadorEscala;
        this.currentInternalScale = this.startScale;

        this.spawnTime = Date.now();
        this.invulnerableUntil = Date.now() + 12000;

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

        // Só toma dano quando já está mais perto (escala maior)
        if (this.currentInternalScale < (this.maxScale * 0.55)) return false;
        if (Date.now() < this.invulnerableUntil) return false;

        // Laser: máx 6 | Míssil: máx 25
        const limitedDamage = Math.min(amount, amount >= 30 ? 25 : 6);
        this.hp = Math.max(0, this.hp - limitedDamage);

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
    _criarFogoLocalizado(pontoImpactoMundo, intensidade) {
        if (!this.mesh || !this.fogoTexture) return;

        // Converte o ponto do impacto no mundo para a coordenada interna/local da nave mãe
        const pontoLocal = this.mesh.worldToLocal(pontoImpactoMundo.clone());

        // Criamos o sistema de partículas para a chama local
        const geometria = new THREE.BufferGeometry();
        const posicoes = [];

        // Cria pequenos focos bem concentrados ao redor do furo do impacto
        const contagem = Math.ceil(intensidade * 2);
        for (let i = 0; i < contagem; i++) {
            const x = pontoLocal.x + (Math.random() - 0.5) * 2.0;
            const y = pontoLocal.y + (Math.random() - 0.5) * 1.0;
            const z = pontoLocal.z + (Math.random() - 0.5) * 2.0;
            posicoes.push(x, y, z);
        }

        geometria.setAttribute('position', new THREE.Float32BufferAttribute(posicoes, 3));

        // Material ajustado para tamanho de estilhaço/fogo localizado proporcional à lataria
        const material = new THREE.PointsMaterial({
            size: 4.5, // Tamanho fixo da chama em relação à malha da nave
            map: this.fogoTexture,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        material.color.setHex(0xffaa11); // Cor de explosão quente

        const fogoLocal = new THREE.Points(geometria, material);
        
        // CRÍTICO: Adiciona o fogo dentro da própria nave mãe para ele ficar preso na fuselagem!
        this.mesh.add(fogoLocal);

        const tempoNascimento = Date.now();
        const duracao = 1000 + Math.random() * 500; // Tempo que o buraco fica pegando fogo

        const animarFogoLocal = () => {
            if (!this.isActive || !this.mesh) {
                geometria.dispose();
                material.dispose();
                return;
            }

            const idade = Date.now() - tempoNascimento;
            const progresso = idade / duracao;

            if (progresso >= 1) {
                geometria.dispose();
                material.dispose();
                this.mesh.remove(fogoLocal);
            } else {
                material.opacity = (1 - progresso) * 0.9;
                
                // Faz as labaredas subirem localmente na carcaça
                const posArr = geometria.attributes.position.array;
                for (let i = 1; i < posArr.length; i += 3) {
                    posArr[i] += 0.05; // Sobe levemente na coordenada local da nave
                }
                geometria.attributes.position.needsUpdate = true;

                requestAnimationFrame(animarFogoLocal);
            }
        };
        animarFogoLocal();
    }


    update(deltaTime, playerPosition, laserManager = null, explosionManager = null) {
        if (!this.isAlive || !this.isActive || !this.mesh) return;

        // Aproxima até ficar bem perto do jogador
        const targetZ = (playerPosition?.z ?? 0) - 180;
        const target = new THREE.Vector3(0, 30, targetZ);

        if (playerPosition) {
            target.x = THREE.MathUtils.clamp(playerPosition.x * 0.25, -70, 70);
            target.y = Math.max(15, playerPosition.y + 12);
        }

        const timeSinceSpawn = Date.now() - this.spawnTime;
        const lerpSpeed = timeSinceSpawn < 6000 ? 0.006 : 0.025;

        this.mesh.position.lerp(target, lerpSpeed);

        const totalDistance = Math.abs(this.startZ - targetZ);
        const currentDistance = Math.abs(this.mesh.position.z - targetZ);
        const progress = THREE.MathUtils.clamp(1 - (currentDistance / totalDistance), 0, 1);

        this.currentInternalScale = THREE.MathUtils.lerp(this.startScale, this.maxScale, progress);
        this.mesh.scale.set(this.currentInternalScale, this.currentInternalScale, this.currentInternalScale);

        this.mesh.rotation.y = Math.PI + Math.sin(Date.now() * 0.0003) * 0.08;
        this.mesh.rotation.z = Math.sin(Date.now() * 0.0005) * 0.04;

    

        // Só processa colisão quando já está maior (mais perto)
        if (this.currentInternalScale < (this.maxScale * 0.55)) return;

        const hitRadius = this.currentInternalScale * 3.2;

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