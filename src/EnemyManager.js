import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ENEMY_LASER_GEO = new THREE.SphereGeometry(1.5, 6, 6);
const ENEMY_LASER_MAT = new THREE.MeshBasicMaterial({ color: 0xff0033, toneMapped: false });

export class EnemyManager {
    constructor(scene, camera, scorePopup) {
        this.scorePopup = scorePopup;
        this.scene = scene;
        this.camera = camera;
        this.enemies = [];
        this.enemyProjectiles = []; 
        this.waveTimer = 0;
        this.enemySpeed = 190;
        this.maxEnemiesOnScreen = 8; 
        this.waveCooldown = 1.8; 
        
        // --- SEUS TEMPLATES DE MODELOS ---
        this.enemyTemplate = null;
        this.droneTemplate = null;
        this.meteoroTemplate = null;

        this._loadEnemyModel();
    }

    async init() { return Promise.resolve(); }

    clearAllEnemies() {
        this.enemies.forEach(e => this.scene.remove(e));
        this.enemyProjectiles.forEach(p => this.scene.remove(p.mesh));
        this.enemies = [];
        this.enemyProjectiles = [];
    }

    _loadEnemyModel() {
        const loader = new GLTFLoader();
        
        // 1. Carrega sua nave comum original
        loader.load('/assets/models/nave_inimiga.glb', (gltf) => {
            this.enemyTemplate = gltf.scene;
            this.enemyTemplate.scale.set(2.5, 2.5, 2.5);
            this.enemyTemplate.traverse((child) => {
                if (child.isMesh) {
                    child.frustumCulled = false;
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            console.log("✅ Modelo inimigo carregado!");
        }, undefined, (err) => console.error("Erro inimigo:", err));

  // 2. Carrega o Drone (Turbinado para forçar visibilidade)
        loader.load('/assets/models/drone.glb', (gltf) => {
            this.droneTemplate = gltf.scene;
            
            // Aumentamos bem o tamanho dele para testar se ele era apenas pequeno demais!
            this.droneTemplate.scale.set(12.0, 12.0, 12.0); 
            
            this.droneTemplate.traverse((child) => {
                if (child.isMesh) {
                    child.frustumCulled = false;
                    child.visible = true;
                    
                    // Se o material dele veio quebrado ou transparente, isso força uma cor vermelha básica para teste!
                    if (child.material) {
                        child.material.depthWrite = true;
                        child.material.transparent = false;
                    }
                }
            });
            console.log("✅ Modelo Drone carregado e ampliado!");
        }, undefined, (err) => console.error("Erro drone:", err));
        // 3. Carrega o Meteoro
        loader.load('/assets/models/meteoro.glb', (gltf) => {
            this.meteoroTemplate = gltf.scene;
            this.meteoroTemplate.scale.set(15.0, 15.0, 15.0);
            this.meteoroTemplate.traverse((child) => {
                if (child.isMesh) child.frustumCulled = false;
            });
            console.log("✅ Modelo Meteoro carregado!");
        }, undefined, (err) => console.error("Erro meteoro:", err));
    }

    _enemyShoot(enemy, soundManager) {
        // Meteoros não atiram lasers!
        if (enemy.userData.type === 'meteoro') return;

        const laser = new THREE.Mesh(ENEMY_LASER_GEO, ENEMY_LASER_MAT);
        laser.position.copy(enemy.position);
        this.scene.add(laser);
        
        let laserSpeed = 420;
        if (enemy.userData.type === 'drone') laserSpeed = 600; // Drone atira mais rápido

        this.enemyProjectiles.push({ mesh: laser, speed: laserSpeed });
        if (soundManager) soundManager.play('enemyLaser');
    }

    spawnWave(player) {
        // Se a nave comum base ainda não carregou, espera para não dar erro de nulo
        if (!this.enemyTemplate || this.enemies.length >= this.maxEnemiesOnScreen) return;

        // --- SORTEIO DA ONDA ---
        // Sorteia o que vai surgir: 50% nave comum, 25% drone, 25% meteoro
        const rand = Math.random();
        let selectedTemplate = this.enemyTemplate;
        let type = 'comum';
        let speed = this.enemySpeed + Math.random() * 50;
        let passSound = 'enemyPass';
        let hp = 1;

        if (rand < 0.25) {
            // Se o modelo do drone já carregou usa ele, senão usa a nave comum para não sumir o inimigo
            selectedTemplate = this.droneTemplate ? this.droneTemplate : this.enemyTemplate;
            type = 'drone';
            speed = 380; // Drone voa muito rápido!
            passSound = 'dronePass';
        } else if (rand >= 0.25 && rand < 0.50) {
            selectedTemplate = this.meteoroTemplate ? this.meteoroTemplate : this.enemyTemplate;
            type = 'meteoro';
            speed = 110; // Meteoro é lentão
            passSound = 'meteoroPass';
            hp = 3;      // Meteoro precisa de 3 tiros para quebrar!
        }

        const enemy = selectedTemplate.clone();
        const cameraPos = new THREE.Vector3();
        this.camera.getWorldPosition(cameraPos);

        // 🛠️ CORREÇÃO DE POSIÇÃO: Empurrado para o fundo (1000) e zerado a altura (offsetY = 0)
        const spawnDistance = 1000; 
        const spawnZ = cameraPos.z - spawnDistance;
        const offsetX = (Math.random() - 0.5) * 350; 
        const offsetY = 0; // Alinhado perfeitamente no centro da visão, sem nascer lá no teto!

        enemy.position.set(cameraPos.x + offsetX, cameraPos.y + offsetY, spawnZ);
        
        // Guarda as propriedades customizadas do tipo sorteado
        enemy.userData = {
            type: type,
            speed: speed,
            shootTimer: type === 'meteoro' ? 99999 : (1.8 + Math.random() * 2), // Meteoro não atira
            hp: hp,
            passSound: passSound,
            passSoundPlayed: false 
        };

        enemy.traverse((child) => {
            if (child.isMesh) {
                child.frustumCulled = false;
                child.visible = true;
            }
        });

        this.scene.add(enemy);
        this.enemies.push(enemy);
    }

    update(laserManager, onScoreIncrease, player, deltaTime, explosionManager, soundManager) {
        if (!player?.mesh || !deltaTime) return;

        this.waveTimer += deltaTime;
        if (this.waveTimer > this.waveCooldown) {
            this.spawnWave(player);
            this.waveTimer = 0;
        }

        const pPos = player.mesh.position;
        const playerLasers = laserManager.lasers || [];

        // Avanço dos tiros inimigos
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const p = this.enemyProjectiles[i];
            p.mesh.position.z += p.speed * deltaTime;
            if (p.mesh.position.z > pPos.z + 150) {
                this.scene.remove(p.mesh);
                this.enemyProjectiles.splice(i, 1);
            }
        }

        // --- LOOP PRINCIPAL DE INIMIGOS ---
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            const data = enemy.userData;

            // Faz o inimigo atirar baseado no timer dele
            if (data.shootTimer !== undefined && data.type !== 'meteoro') {
                data.shootTimer -= deltaTime;
                if (data.shootTimer <= 0) {
                    this._enemyShoot(enemy, soundManager);
                    data.shootTimer = 1.8 + Math.random() * 2;
                }
            }

            // Movimento dos Inimigos
            if (enemy.position.z >= pPos.z - 20) {
                enemy.position.z += data.speed * deltaTime;
                if (data.type === 'meteoro') {
                    enemy.rotation.x += 0.01; // Rotaciona o meteoro no espaço
                    enemy.rotation.y += 0.01;
                }
            } else {
                if (data.type === 'meteoro') {
                    // Meteoro cai reto e não persegue
                    enemy.position.z += data.speed * deltaTime;
                    enemy.rotation.x += 0.01;
                    enemy.rotation.y += 0.01;
                } else {
                    // Naves e Drones miram no player
                    enemy.lookAt(pPos);
                    const directionToPlayer = new THREE.Vector3();
                    directionToPlayer.subVectors(pPos, enemy.position).normalize();
                    enemy.position.addScaledVector(directionToPlayer, data.speed * deltaTime);
                }
            }

            let foiAtingidoPorLaser = false;
            let pontoDoImpactoReal = null;

            // 1. COLISÃO CONTRA OS SEUS TIROS
            if (playerLasers.length > 0) {
                for (let j = playerLasers.length - 1; j >= 0; j--) {
                    const laser = playerLasers[j];
                    if (!laser || !laser.position || laser.userData?.destroyed) continue;

                    const distLaser = enemy.position.distanceTo(laser.position);
                    const hitbox = data.type === 'meteoro' ? 65 : 35; // Hitbox maior para o meteoro

                    if (distLaser < hitbox) { 
                        pontoDoImpactoReal = laser.position.clone();

                        this.scene.remove(laser);
                        laser.userData = { destroyed: true };
                        playerLasers.splice(j, 1); 
                        
                        data.hp--; // Desconta vida

                        if (data.hp <= 0) {
                            let pontos = data.type === 'meteoro' ? 500 : (data.type === 'drone' ? 250 : 100);
                            if (onScoreIncrease) onScoreIncrease(pontos, pontoDoImpactoReal);
                            foiAtingidoPorLaser = true; 
                        } else {
                            if (soundManager) soundManager.play('enemyLaser'); // Som de impacto
                        }
                        break; 
                    }
                }
            }

            // --- 2. SOM DE PASSAR RASPANDO ---
            const distDoPlayer = enemy.position.distanceTo(pPos);

            if (enemy.position.z > pPos.z) {
                if (!data.passSoundPlayed && distDoPlayer < 120) {
                    if (soundManager && data.passSound) {
                        soundManager.play(data.passSound);
                    }
                    data.passSoundPlayed = true;
                }
            }

            // --- 3. REGRAS DE REMOÇÃO DA TELA ---

            // Caso A: O inimigo morreu por tiro
            if (foiAtingidoPorLaser && pontoDoImpactoReal !== null) {
                if (explosionManager) {
                    explosionManager.create(pontoDoImpactoReal);
                }
                this.scene.remove(enemy);
                this.enemies.splice(i, 1);
                continue; 
            }

            // Caso C: O inimigo passou direto por você 
            if (enemy.position.z > pPos.z + 500) {
                this.scene.remove(enemy);
                this.enemies.splice(i, 1);
            }
        }
    }
}