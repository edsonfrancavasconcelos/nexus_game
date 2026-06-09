import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ENEMY_LASER_GEO = new THREE.CylinderGeometry(0.4, 0.4, 8, 4); 
ENEMY_LASER_GEO.rotateX(Math.PI / 2); 
const ENEMY_LASER_MAT = new THREE.MeshBasicMaterial({ color: 0xff2233, toneMapped: false });

export class EnemyManager {
    constructor(scene, camera, scorePopup) {
        this.scorePopup = scorePopup;
        this.scene = scene;
        this.camera = camera;
        this.enemies = [];
        this.enemyProjectiles = []; 
        this.waveTimer = 0;
        this.enemySpeed = 220; 
        this.maxEnemiesOnScreen = 10; 
        this.waveCooldown = 1.6; 
        
        // --- TEMPLATES DE MODELOS ---
        this.enemyTemplate = null;    
        this.enemyTemplate5 = null;   
        this.enemyTemplate10 = null;  
        this.enemyTemplate15 = null;  
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
            console.log("✅ Nave Comum carregada!");
        }, undefined, (err) => console.error("Erro nave comum:", err));

        loader.load('/assets/models/nave_inim_5.glb', (gltf) => {
            this.enemyTemplate5 = gltf.scene;
            this.enemyTemplate5.scale.set(2.5, 2.5, 2.5);
            this.enemyTemplate5.traverse((child) => {
                if (child.isMesh) child.frustumCulled = false;
            });
        }, undefined, (err) => console.error("Erro nave_inim_5:", err));

        loader.load('/assets/models/nave_inim_10.glb', (gltf) => {
            this.enemyTemplate10 = gltf.scene;
            this.enemyTemplate10.scale.set(2.5, 2.5, 2.5);
            this.enemyTemplate10.traverse((child) => {
                if (child.isMesh) child.frustumCulled = false;
            });
        }, undefined, (err) => console.error("Erro nave_inim_10:", err));

        loader.load('/assets/models/nave_inim_15.glb', (gltf) => {
            this.enemyTemplate15 = gltf.scene;
            this.enemyTemplate15.scale.set(2.5, 2.5, 2.5);
            this.enemyTemplate15.traverse((child) => {
                if (child.isMesh) child.frustumCulled = false;
            });
        }, undefined, (err) => console.error("Erro nave_inim_15:", err));

        loader.load('/assets/models/drone.glb', (gltf) => {
            this.droneTemplate = gltf.scene;
            this.droneTemplate.scale.set(12.0, 12.0, 12.0); 
            this.droneTemplate.traverse((child) => {
                if (child.isMesh) child.frustumCulled = false;
            });
        }, undefined, (err) => console.error("Erro drone:", err));

        loader.load('/assets/models/meteoro.glb', (gltf) => {
            this.meteoroTemplate = gltf.scene;
            this.meteoroTemplate.scale.set(15.0, 15.0, 15.0);
            this.meteoroTemplate.traverse((child) => {
                if (child.isMesh) child.frustumCulled = false;
            });
        }, undefined, (err) => console.error("Erro meteoro:", err));
    }

 damageEnemy(enemy, damage, hitPoint) {
    if (!enemy || !enemy.userData) return false;

    // Aplica o dano
    enemy.userData.hp = (enemy.userData.hp || 1) - damage;

    if (enemy.userData.hp <= 0) {
        // Calcula pontos baseados no tipo
        const pontos = enemy.userData.type === 'meteoro' ? 500 : 
                       (enemy.userData.type === 'drone' ? 250 : 100);
        
        // Dispara o popup de score se o manager existir
        if (this.scorePopup && hitPoint) {
            this.scorePopup.show(pontos, hitPoint);
        }
        
        // Retorna TRUE para o Player saber que pode remover o inimigo da lista
        return true; 
    }
    
    // Se o inimigo sobreviveu, apenas retorna false
    return false;
}

    // 🛠️ FUNÇÃO DE DISPARO (mantida igual)
    _enemyShoot(enemy, player, soundManager) {
        if (enemy.userData.type === 'meteoro' || !player?.mesh) return;

        const pPos = new THREE.Vector3();
        player.mesh.getWorldPosition(pPos);

        const forwardDir = new THREE.Vector3();
        enemy.getWorldDirection(forwardDir);

        const rightDir = new THREE.Vector3();
        rightDir.setFromMatrixColumn(enemy.matrixWorld, 0).normalize();

        let bicoOffset = 18;
        let asaOffset = 12;
        let laserSpeed = 520;

        if (enemy.userData.type === 'drone') {
            bicoOffset = 10;
            asaOffset = 0;
            laserSpeed = 680;
        }

        const spawnPoints = [];
        if (asaOffset > 0) {
            const asaEsquerda = enemy.position.clone()
                .addScaledVector(forwardDir, bicoOffset)
                .addScaledVector(rightDir, -asaOffset);
            const asaDireita = enemy.position.clone()
                .addScaledVector(forwardDir, bicoOffset)
                .addScaledVector(rightDir, asaOffset);
            spawnPoints.push(asaEsquerda, asaDireita);
        } else {
            const bicoCentral = enemy.position.clone().addScaledVector(forwardDir, bicoOffset);
            spawnPoints.push(bicoCentral);
        }

        spawnPoints.forEach((posicaoDeSaida) => {
            const laserDir = new THREE.Vector3();
            laserDir.subVectors(pPos, posicaoDeSaida).normalize();

            const laser = new THREE.Mesh(ENEMY_LASER_GEO, ENEMY_LASER_MAT);
            laser.position.copy(posicaoDeSaida);
            laser.lookAt(pPos);
            
            this.scene.add(laser);
            
            this.enemyProjectiles.push({ 
                mesh: laser, 
                dir: laserDir, 
                speed: laserSpeed 
            });
        });
        
        if (soundManager && enemy.userData.laserSound) {
            soundManager.play(enemy.userData.laserSound);
        }
    }

    spawnWave(player, currentLevel = 1) {
        // ... (mantido exatamente igual ao seu código) ...
        // Não alterei nada aqui para não quebrar
        if (!this.enemyTemplate || !player?.mesh || this.enemies.length >= this.maxEnemiesOnScreen) return;

        const rand = Math.random();
        let selectedTemplate = this.enemyTemplate;
        let type = 'comum';
        let speed = this.enemySpeed + Math.random() * 60;
        let passSound = 'enemyPass';
        let laserSound = 'enemyLaser';
        let hp = 1;

        if (rand < 0.20) {
            selectedTemplate = this.droneTemplate ? this.droneTemplate : this.enemyTemplate;
            type = 'drone';
            speed = 410; 
            passSound = 'drone'; 
            laserSound = 'enemyLaser'; 
            hp = 1;
        } else if (rand >= 0.20 && rand < 0.40) {
            selectedTemplate = this.meteoroTemplate ? this.meteoroTemplate : this.enemyTemplate;
            type = 'meteoro';
            speed = 140; 
            passSound = 'meteoro'; 
            laserSound = null; 
            hp = 3;      
        } else {
            if (currentLevel >= 1 && currentLevel <= 20) {
                selectedTemplate = this.enemyTemplate;
                type = 'comum';
                passSound = 'inimiga_passando';
                laserSound = 'laser_inimigo';
                hp = 1;
            } 
            else if (currentLevel >= 21 && currentLevel <= 30) {
                selectedTemplate = this.enemyTemplate5 ? this.enemyTemplate5 : this.enemyTemplate;
                type = 'nave_inim_5';
                speed += 40;
                passSound = 'nave_pass_5';
                laserSound = 'laser_inimi_5';
                hp = 2;
            } 
            else if (currentLevel >= 31 && currentLevel <= 50) {
                selectedTemplate = this.enemyTemplate10 ? this.enemyTemplate10 : this.enemyTemplate;
                type = 'nave_inim_10';
                speed += 80;
                passSound = 'nave_pss_10';
                laserSound = 'laser_inim_10';
                hp = 3;
            } 
            else if (currentLevel >= 51 && currentLevel <= 200) {
                selectedTemplate = this.enemyTemplate15 ? this.enemyTemplate15 : this.enemyTemplate;
                type = 'nave_inim_15';
                speed += 150;
                passSound = 'nave_pass_15';
                laserSound = 'laser_inim_15';
                hp = 5;
            }
        }

        const enemy = selectedTemplate.clone();
        
        const camPos = new THREE.Vector3();
        this.camera.getWorldPosition(camPos);

        const camDirection = new THREE.Vector3();
        this.camera.getWorldDirection(camDirection);
        
        const camRight = new THREE.Vector3();
        camRight.setFromMatrixColumn(this.camera.matrixWorld, 0).normalize(); 
        
        const camUp = new THREE.Vector3();
        camUp.setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();

        const spawnDistance = 1200; 
        const centerSpawnPoint = camPos.clone().addScaledVector(camDirection, spawnDistance);

        const sideChoice = Math.random() < 0.5 ? -1 : 1;

        const lateralOffset = sideChoice * (300 + Math.random() * 150);
        const verticalOffset = (Math.random() - 0.5) * 160;

        const finalSpawnPos = centerSpawnPoint.clone()
            .addScaledVector(camRight, lateralOffset)
            .addScaledVector(camUp, verticalOffset);

        enemy.position.copy(finalSpawnPos);
        
        const targetDistance = 200; 
        const targetCenter = camPos.clone().addScaledVector(camDirection, targetDistance);
        
        const targetLateralOffset = -sideChoice * (50 + Math.random() * 200); 
        const finalTargetPos = targetCenter.clone()
            .addScaledVector(camRight, targetLateralOffset)
            .addScaledVector(camUp, verticalOffset);
        
        const moveDir = new THREE.Vector3();
        moveDir.subVectors(finalTargetPos, enemy.position).normalize();

        enemy.userData = {
            type: type,
            speed: speed,
            moveDir: moveDir, 
            shootTimer: type === 'meteoro' ? 99999 : (0.5 + Math.random() * 1.0), 
            burstCount: 0,        
            burstTimer: 0,        
            hp: hp,
            passSound: passSound,
            laserSound: laserSound,
            passSoundPlayed: false 
        };

        enemy.lookAt(finalTargetPos);

        enemy.traverse((child) => {
            if (child.isMesh) child.frustumCulled = false;
        });

        this.scene.add(enemy);
        this.enemies.push(enemy);
    }

    update(laserManager, onScoreIncrease, player, deltaTime, explosionManager, soundManager, currentLevel = 1) {
        if (!player?.mesh || !deltaTime) return;

        const adjustedCooldown = Math.max(0.4, this.waveCooldown - (currentLevel * 0.012));

        this.waveTimer += deltaTime;
        if (this.waveTimer > adjustedCooldown) {
            this.spawnWave(player, currentLevel);
            this.waveTimer = 0;
        }

        const pPos = new THREE.Vector3();
        player.mesh.getWorldPosition(pPos);
        
        const playerLasers = laserManager.lasers || [];

        // Atualização dos lasers inimigos
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const p = this.enemyProjectiles[i];
            p.mesh.position.addScaledVector(p.dir, p.speed * deltaTime);

            if (p.mesh.position.distanceTo(pPos) > 1500) {
                this.scene.remove(p.mesh);
                this.enemyProjectiles.splice(i, 1);
            }
        }

        // --- LOOP DE ATUALIZAÇÃO DOS INIMIGOS ---
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            const data = enemy.userData;

            // IA de tiro (Burst Fire)
            if (data.type !== 'meteoro') {
                if (data.burstCount > 0) {
                    data.burstTimer -= deltaTime;
                    if (data.burstTimer <= 0) {
                        this._enemyShoot(enemy, player, soundManager);
                        data.burstCount--;
                        data.burstTimer = 0.12; 
                    }
                } else {
                    data.shootTimer -= deltaTime;
                    if (data.shootTimer <= 0) {
                        data.burstCount = 3; 
                        data.burstTimer = 0;
                        data.shootTimer = Math.max(0.4, 0.8 + Math.random() * 1.2 - (currentLevel * 0.008));
                    }
                }
            }

            enemy.position.addScaledVector(data.moveDir, data.speed * deltaTime);

            if (data.type === 'drone' || data.type === 'meteoro') {
                enemy.rotation.x += 0.01;
                enemy.rotation.y += 0.01;
            }

            let foiAtingidoPorLaser = false;
            let pontoDoImpactoReal = null;

            // === DETECÇÃO DE LASERS DO JOGADOR (mantido igual) ===
            if (playerLasers.length > 0) {
                for (let j = playerLasers.length - 1; j >= 0; j--) {
                    const laser = playerLasers[j];
                    if (!laser || !laser.position || laser.userData?.destroyed) continue;

                    const distLaser = enemy.position.distanceTo(laser.position);
                    const hitbox = data.type === 'meteoro' ? 65 : 35; 

                    if (distLaser < hitbox) { 
                        pontoDoImpactoReal = laser.position.clone();

                        this.scene.remove(laser);
                        laser.userData = { destroyed: true };
                        playerLasers.splice(j, 1); 
                        
                        data.hp--; 

                        if (data.hp <= 0) {
                            let pontos = data.type === 'meteoro' ? 500 : (data.type === 'drone' ? 250 : 100);
                            if (onScoreIncrease) onScoreIncrease(pontos, pontoDoImpactoReal);
                            foiAtingidoPorLaser = true; 
                        } else {
                            if (soundManager && data.laserSound) soundManager.play(data.laserSound); 
                        }
                        break; 
                    }
                }
            }

            const distDoPlayer = enemy.position.distanceTo(pPos);
            if (distDoPlayer < 180 && !data.passSoundPlayed) {
                if (soundManager && data.passSound) {
                    soundManager.play(data.passSound);
                }
                data.passSoundPlayed = true;
            }

            if (foiAtingidoPorLaser && pontoDoImpactoReal !== null) {
                if (explosionManager) explosionManager.create(pontoDoImpactoReal);
                this.scene.remove(enemy);
                this.enemies.splice(i, 1);
                continue; 
            }

            const camPosAtual = new THREE.Vector3();
            this.camera.getWorldPosition(camPosAtual);
            if (enemy.position.z > camPosAtual.z + 200 || enemy.position.distanceTo(camPosAtual) > 1600) {
                this.scene.remove(enemy);
                this.enemies.splice(i, 1);
            }
        }
    }
}