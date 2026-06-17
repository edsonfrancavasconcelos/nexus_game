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
        this.enemyLasers = [];
        
        this.waveTimer = 0;
        this.enemySpeed = 220; 
        this.maxEnemiesOnScreen = 10; 
        this.waveCooldown = 1.6; 
        
        this.isLoaded = false;
        this.loadingCount = 0;
        this.totalToLoad = 7;

        this.naveMaeSpawnada = false;

        this._loadEnemyModel();
    }

    clearAllEnemies() {
        this.enemies.forEach(e => this.scene.remove(e));
        this.enemyProjectiles.forEach(p => this.scene.remove(p.mesh || p));
        this.enemyLasers.forEach(l => this.scene.remove(l));
        
        this.enemies = [];
        this.enemyProjectiles = [];
        this.enemyLasers = [];
        this.naveMaeSpawnada = false;
    }

    _createOrientedTemplate(model, yRotation = 0) {
        const group = new THREE.Group();
        const clonedModel = model.clone();
        clonedModel.rotation.y = yRotation;
        
        clonedModel.traverse((child) => {
            if (child.isMesh) {
                child.frustumCulled = false;
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        group.add(clonedModel);
        return group;
    }

    _markModelLoaded() {
        this.loadingCount++;
        if (this.loadingCount >= this.totalToLoad) {
            this.isLoaded = true;
            console.log("✅ TODOS OS INIMIGOS CARREGADOS COM SUCESSO!");
        }
    }

    _loadEnemyModel() {
        const loader = new GLTFLoader();
        
        loader.load('/assets/models/nave_inimiga.glb', (gltf) => {
            this.enemyTemplate = gltf.scene;
            this.enemyTemplate.rotation.y = Math.PI;
            this.enemyTemplate.scale.set(2.5, 2.5, 2.5);
            this.enemyTemplate.traverse((child) => {
                if (child.isMesh) child.frustumCulled = false;
            });
            console.log("✅ Nave Nível 1 OK");
            this._markModelLoaded();
        });

        loader.load('/assets/models/nave_inim_5.glb', (gltf) => {
            this.enemyTemplate5 = this._createOrientedTemplate(gltf.scene, Math.PI / 2);
            this.enemyTemplate5.scale.set(40, 40, 40);
            console.log("✅ Nave Nível 5 OK");
            this._markModelLoaded();
        });

        loader.load('/assets/models/nave_mae.glb', (gltf) => {
            this.naveMaeTemplate = this._createOrientedTemplate(gltf.scene, 0);
            this.naveMaeTemplate.scale.set(100, 100, 100);
            console.log("✅ Nave Mãe OK");
            this._markModelLoaded();
        });

        loader.load('/assets/models/nave_inim_10.glb', (gltf) => {
            this.enemyTemplate10 = this._createOrientedTemplate(gltf.scene, 0);
            this.enemyTemplate10.scale.set(30, 30, 30);
            console.log("✅ Nave 10 OK");
            this._markModelLoaded();
        });

        loader.load('/assets/models/nave_inim_15.glb', (gltf) => {
            this.enemyTemplate15 = this._createOrientedTemplate(gltf.scene, 0);
            this.enemyTemplate15.scale.set(10, 10, 10);
            console.log("✅ Nave 15 OK");
            this._markModelLoaded();
        });

        loader.load('/assets/models/drone.glb', (gltf) => {
            this.droneTemplate = gltf.scene;
            this.droneTemplate.rotation.y = Math.PI;
            this.droneTemplate.scale.set(80, 80, 80);
            console.log("✅ Drone OK");
            this._markModelLoaded();
        });

        loader.load('/assets/models/meteoro.glb', (gltf) => {
            this.meteoroTemplate = gltf.scene;
            this.meteoroTemplate.scale.set(15, 15, 15);
            console.log("✅ Meteoro OK");
            this._markModelLoaded();
        });
    }

    spawnNaveMae() {
        if (this.naveMaeSpawnada || !this.naveMaeTemplate) return;
        
        const naveMae = this.naveMaeTemplate.clone();
        const camPos = new THREE.Vector3();
        this.camera.getWorldPosition(camPos);

        naveMae.position.copy(camPos).add(new THREE.Vector3(0, 0, -800));
        naveMae.userData = { 
            type: 'nave_mae', 
            speed: 80, 
            hp: 30, 
            moveDir: new THREE.Vector3(0, 0, 1) 
        };

        this.scene.add(naveMae);
        this.enemies.push(naveMae);
        this.naveMaeSpawnada = true;
        console.log("🚀 NAVE MÃE SPAWNADA!");
    }

    enemyShoot(enemy, player, soundManager) {
        if (!enemy || !player?.mesh) return;

        const laser = new THREE.Mesh(ENEMY_LASER_GEO, ENEMY_LASER_MAT);
        laser.position.copy(enemy.position);
        
        const direction = new THREE.Vector3()
            .subVectors(player.mesh.position, enemy.position)
            .normalize();

        laser.userData = { 
            isEnemyLaser: true, 
            speed: 650, 
            direction 
        };

        this.scene.add(laser);
        this.enemyLasers.push(laser);

        if (soundManager && enemy.userData?.laserSound) {
            soundManager.play(enemy.userData.laserSound);
        }
    }

    spawnWave(player, currentLevel = 1) {
        if (!this.isLoaded) {
            console.warn("⏳ Aguardando modelos carregarem...");
            return;
        }

        if (currentLevel === 2) {
            this.spawnNaveMae();
            return; 
        }

        if (!player?.mesh || this.enemies.length >= this.maxEnemiesOnScreen) return;

        const rand = Math.random();
        let selectedTemplate = this.enemyTemplate;
        let type = 'comum';
        let speed = this.enemySpeed + Math.random() * 60;
        let passSound = 'enemyPass';
        let laserSound = 'enemyLaser';
        let hp = 1;

        if (rand < 0.20) {
            selectedTemplate = this.droneTemplate || this.enemyTemplate;
            type = 'drone';
            speed = 410;
            passSound = 'drone';
            hp = 1;
        } else if (rand >= 0.20 && rand < 0.40) {
            selectedTemplate = this.meteoroTemplate || this.enemyTemplate;
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
            } else if (currentLevel >= 21 && currentLevel <= 30) {
                selectedTemplate = this.enemyTemplate5 || this.enemyTemplate;
                type = 'nave_inim_5';
                speed += 40;
                passSound = 'nave_pass_5';
                laserSound = 'laser_inimi_5';
                hp = 2;
            } else if (currentLevel >= 31 && currentLevel <= 50) {
                selectedTemplate = this.enemyTemplate10 || this.enemyTemplate;
                type = 'nave_inim_10';
                speed += 80;
                passSound = 'nave_pss_10';
                laserSound = 'laser_inim_10';
                hp = 3;
            } else if (currentLevel >= 51) {
                selectedTemplate = this.enemyTemplate15 || this.enemyTemplate;
                type = 'nave_inim_15';
                speed += 150;
                passSound = 'nave_pass_15';
                laserSound = 'laser_inim_15';
                hp = 5;
            }
        }

        if (!selectedTemplate) {
            console.warn(`Template não encontrado para tipo: ${type}`);
            return;
        }

        const enemy = selectedTemplate.clone();

        if (type === 'nave_inim_5') {
            enemy.rotation.y = Math.PI;
        }

        const camPos = new THREE.Vector3();
        this.camera.getWorldPosition(camPos);

        const camDirection = new THREE.Vector3();
        this.camera.getWorldDirection(camDirection);

        const camRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();

        const spawnDistance = 2200;
        const centerSpawnPoint = camPos.clone().addScaledVector(camDirection, spawnDistance);

        const sideChoice = Math.random() < 0.5 ? -1 : 1;
        const lateralOffset = sideChoice * (400 + Math.random() * 280);
        const verticalOffset = (Math.random() - 0.5) * 220;

        const finalSpawnPos = centerSpawnPoint.clone()
            .addScaledVector(camRight, lateralOffset)
            .addScaledVector(new THREE.Vector3(0, 1, 0), verticalOffset);

        enemy.position.copy(finalSpawnPos);

        const moveDir = new THREE.Vector3()
            .subVectors(camPos, finalSpawnPos)
            .normalize();

        enemy.userData = {
            type, 
            speed, 
            moveDir, 
            hp,
            shootTimer: type === 'meteoro' ? 99999 : (0.8 + Math.random() * 1.2),
            passSound, 
            laserSound,
            passSoundPlayed: false,
            burstCount: 0,
            burstTimer: 0
        };

        enemy.lookAt(camPos);
        enemy.traverse((child) => {
            if (child.isMesh) child.frustumCulled = false;
        });

        this.scene.add(enemy);
        this.enemies.push(enemy);

        console.log(`✅ Spawn: ${type}`);
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
        
        const playerLasers = laserManager?.lasers || [];

        // Atualiza projéteis inimigos
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const p = this.enemyProjectiles[i];
            if (p && p.mesh) {
                p.mesh.position.addScaledVector(p.dir, p.speed * deltaTime);
            }

            if (p && p.mesh && p.mesh.position.distanceTo(pPos) > 1500) {
                this.scene.remove(p.mesh);
                this.enemyProjectiles.splice(i, 1);
            }
        }

        // Atualiza inimigos
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (!enemy || !enemy.userData) continue;

            const data = enemy.userData;

            // TIRO
            if (data.type !== 'meteoro' && data.shootTimer !== undefined) {
                data.shootTimer -= deltaTime;

                if (data.shootTimer <= 0) {
                    data.burstCount = 3;
                    data.burstTimer = 0;
                    data.shootTimer = 1.5 + Math.random() * 1.5;
                }

                if (data.burstCount > 0) {
                    data.burstTimer -= deltaTime;
                    if (data.burstTimer <= 0) {
                        this.enemyShoot(enemy, player, soundManager);
                        data.burstCount--;
                        data.burstTimer = 0.2;
                    }
                }
            }

            if (data.moveDir) {
                enemy.position.addScaledVector(data.moveDir, data.speed * deltaTime);
            }

            if (data.type === 'drone' || data.type === 'meteoro') {
                enemy.rotation.x += 0.01;
                enemy.rotation.y += 0.01;
            }

            // Colisão com lasers do jogador
            let foiAtingidoPorLaser = false;
            let pontoDoImpactoReal = null;

            for (let j = playerLasers.length - 1; j >= 0; j--) {
                const laser = playerLasers[j];
                if (!laser || laser.userData?.destroyed) continue;

                const distLaser = enemy.position.distanceTo(laser.position);
                const hitbox = data.type === 'meteoro' ? 65 : 35;

                if (distLaser < hitbox) {
                    pontoDoImpactoReal = laser.position.clone();
                    this.scene.remove(laser);
                    laser.userData = { destroyed: true };
                    playerLasers.splice(j, 1);
                    data.hp--;

                    if (data.hp <= 0) {
                        const pontos = data.type === 'meteoro' ? 500 : (data.type === 'drone' ? 250 : 100);
                        if (onScoreIncrease) onScoreIncrease(pontos, pontoDoImpactoReal);
                        foiAtingidoPorLaser = true;
                    }
                    break;
                }
            }

            const distDoPlayer = enemy.position.distanceTo(pPos);
            if (distDoPlayer < 180 && !data.passSoundPlayed) {
                if (soundManager && data.passSound) soundManager.play(data.passSound);
                data.passSoundPlayed = true;
            }

            if (foiAtingidoPorLaser) {
                if (explosionManager && pontoDoImpactoReal) explosionManager.create(pontoDoImpactoReal);
                this.scene.remove(enemy);
                this.enemies.splice(i, 1);
                continue;
            }

            const camPosAtual = new THREE.Vector3();
            this.camera.getWorldPosition(camPosAtual);
            if (enemy.position.distanceTo(camPosAtual) > 2500) {
                this.scene.remove(enemy);
                this.enemies.splice(i, 1);
            }
        }
    }

    // Método init() para evitar o erro
    async init() {
        return Promise.resolve();
    }
}