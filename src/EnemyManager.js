import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ENEMY_LASER_GEO = new THREE.CylinderGeometry(0.4, 0.4, 8, 4);
ENEMY_LASER_GEO.rotateX(Math.PI / 2);
const ENEMY_LASER_MAT = new THREE.MeshBasicMaterial({ color: 0xff2233, toneMapped: false });

export class EnemyManager {
    constructor(scene, camera, scorePopup, isMobile = false) {
        this.scorePopup = scorePopup;
        this.scene = scene;
        this.camera = camera;
        this.enemies = [];
        this.enemyProjectiles = [];
        this.templates = {};
        this.isMobile = isMobile;
        this.enemyCollisionBox = new THREE.Box3();
        this.obstacleCollisionBox = new THREE.Box3();

        this.waveTimer = 0;
        this.enemySpeed = 220;
        this.maxEnemiesOnScreen = isMobile ? 6 : 10;
        this.waveCooldown = isMobile ? 2.0 : 1.6;

        this.enemyTemplate = null;
        this.enemyTemplate5 = null;
        this.enemyTemplate10 = null;
        this.enemyTemplate15 = null;
        this.droneTemplate = null;
        this.meteoroTemplate = null;
        this.naveMaeTemplate = null;
        this.enemyTemplate6 = null;

        this._loadEnemyModel();
    }

    async init() { return Promise.resolve(); }

    clearAllEnemies() {
        this.enemies.forEach(e => this.scene.remove(e));
        this.enemyProjectiles.forEach(p => this.scene.remove(p.mesh));
        this.enemies = [];
        this.enemyProjectiles = [];
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

    _addLocalGlow(model, color = 0xffaa66, intensity = 1.2, distance = 240, emissiveIntensity = 0.45) {
        model.traverse((child) => {
            if (!child.isMesh || !child.material) return;

            const materials = Array.isArray(child.material) ? child.material : [child.material];
            const enhancedMaterials = materials.map((material) => {
                const nextMaterial = material.clone();
                if (nextMaterial.emissive) {
                    nextMaterial.emissive = new THREE.Color(color);
                    nextMaterial.emissiveIntensity = emissiveIntensity;
                }
                nextMaterial.needsUpdate = true;
                return nextMaterial;
            });

            child.material = Array.isArray(child.material) ? enhancedMaterials : enhancedMaterials[0];
        });

        const glow = new THREE.PointLight(color, intensity, distance);
        glow.position.set(0, 0, 0);
        model.add(glow);
        return glow;
    }

    _styleRockModel(model, baseColor = 0x6f6a63) {
        model.traverse((child) => {
            if (!child.isMesh || !child.material) return;

            const materials = Array.isArray(child.material) ? child.material : [child.material];
            const styledMaterials = materials.map((material) => {
                const nextMaterial = material.clone();
                if (nextMaterial.color) nextMaterial.color.setHex(baseColor);
                if (nextMaterial.map) nextMaterial.map.colorSpace = THREE.SRGBColorSpace;
                if ('roughness' in nextMaterial) nextMaterial.roughness = 1.0;
                if ('metalness' in nextMaterial) nextMaterial.metalness = 0.02;
                if ('emissive' in nextMaterial) {
                    nextMaterial.emissive.setHex(0x050505);
                    nextMaterial.emissiveIntensity = 0.08;
                }
                nextMaterial.needsUpdate = true;
                return nextMaterial;
            });

            child.material = Array.isArray(child.material) ? styledMaterials : styledMaterials[0];
        });
    }

    _styleAsteroidModel(model) {
        model.traverse((child) => {
            if (!child.isMesh || !child.material) return;

            const materials = Array.isArray(child.material) ? child.material : [child.material];
            const styledMaterials = materials.map((material) => {
                const nextMaterial = material.clone();
                if (nextMaterial.color) nextMaterial.color.setHex(0x161616);
                if (nextMaterial.map) nextMaterial.map.colorSpace = THREE.SRGBColorSpace;
                if ('roughness' in nextMaterial) nextMaterial.roughness = 1.0;
                if ('metalness' in nextMaterial) nextMaterial.metalness = 0.0;
                if ('emissive' in nextMaterial) {
                    nextMaterial.emissive.setHex(0x000000);
                    nextMaterial.emissiveIntensity = 0;
                }
                if ('envMapIntensity' in nextMaterial) nextMaterial.envMapIntensity = 0.15;
                nextMaterial.needsUpdate = true;
                return nextMaterial;
            });

            child.material = Array.isArray(child.material) ? styledMaterials : styledMaterials[0];
        });
    }

    _loadEnemyModel() {
        const loader = new GLTFLoader();

        const loadModel = (path, targetKey, scale, rotation = 0, isTemplate = false) => {
            loader.load(path, (gltf) => {
                const model = isTemplate ? gltf.scene : this._createOrientedTemplate(gltf.scene, rotation);
                model.scale.set(...scale);

                if (isTemplate) {
                    this.templates[targetKey] = model;
                } else {
                    this[targetKey] = model;
                }
            }, undefined, (error) => {
                console.error(`❌ Erro ao carregar ${path}:`, error);
            });
        };

        loadModel('/assets/models/nave_inimiga.glb', 'enemyTemplate', [30, 30, 30], 0);
        loadModel('/assets/models/nave_inim_5.glb', 'enemyTemplate5', [30, 30, 30], Math.PI / 2);
        loadModel('/assets/models/nave_inim_10.glb', 'enemyTemplate10', [30, 30, 30], 0);
        loadModel('/assets/models/nave_inim_15.glb', 'enemyTemplate15', [30, 30, 30], 0);
        loadModel('/assets/models/nave_mae.glb', 'naveMaeTemplate', [100, 100, 100], 0);
        loadModel('/assets/models/drone.glb', 'droneTemplate', [80, 80, 80], Math.PI);
        loadModel('/assets/models/meteoro.glb', 'meteoroTemplate', [15, 15, 15], 0);
        loader.load('/assets/models/asteroid_ball.glb', (gltf) => {
            const model = gltf.scene;
            model.scale.set(6, 6, 6);
            this._styleAsteroidModel(model);
            this.templates.asteroide = model;
        }, undefined, (error) => {
            console.error('❌ Erro ao carregar /assets/models/asteroid_ball.glb:', error);
        });
        loadModel('/assets/models/roblox.glb', 'enemyTemplate6', [35, 35, 35], 0);
    }

    spawnWave(player, currentLevel = 1) {
        if (!this.enemyTemplate || !player?.mesh || this.enemies.length >= this.maxEnemiesOnScreen) return;

        const rand = Math.random();
        let selectedTemplate = this.enemyTemplate;
        let type = 'comum';
        let speed = this.enemySpeed + Math.random() * 60;
        let passSound = 'enemyPass';
        let laserSound = 'enemyLaser';
        let hp = 1;

        if (rand < 0.25 && this.templates?.asteroide) {
            selectedTemplate = this.templates.asteroide;
            type = 'asteroide';
            speed = 65 + Math.random() * 35;
            passSound = 'meteoro';
            laserSound = null;
            hp = 3;
        } else if (rand < 0.45) {
            selectedTemplate = this.droneTemplate || this.enemyTemplate;
            type = 'drone';
            speed = 410;
            passSound = 'drone';
            laserSound = 'enemyLaser';
            hp = 1;
        } else if (rand < 0.60) {
            selectedTemplate = this.meteoroTemplate || this.enemyTemplate;
            type = 'meteoro';
            speed = 110;
            passSound = 'meteoro';
            laserSound = null;
            hp = 3;
        } else {
            const r = Math.random();
            if (currentLevel >= 51 && r < 0.6) {
                selectedTemplate = this.enemyTemplate15 || this.enemyTemplate;
                type = 'nave_inim_15';
                speed += 150;
                passSound = 'nave_pass_15';
                laserSound = 'laser_inim_15';
                hp = 5;
            } else if (currentLevel >= 31 && r < 0.5) {
                selectedTemplate = this.enemyTemplate10 || this.enemyTemplate;
                type = 'nave_inim_10';
                speed += 80;
                passSound = 'nave_pss_10';
                laserSound = 'laser_inim_10';
                hp = 3;
            } else if (currentLevel >= 21 && r < 0.4) {
                selectedTemplate = this.enemyTemplate5 || this.enemyTemplate;
                type = 'nave_inim_5';
                speed += 40;
                passSound = 'nave_pass_5';
                laserSound = 'laser_inimi_5';
                hp = 2;
            } else if (currentLevel >= 6 && r < 0.3) {
                selectedTemplate = this.enemyTemplate6 || this.enemyTemplate;
                type = 'roblox';
                speed += 20;
                passSound = 'nave_pass_6';
                laserSound = 'laser_inim_6';
                hp = 2;
            } else {
                selectedTemplate = this.enemyTemplate;
                type = 'comum';
                passSound = 'inimiga_passando';
                laserSound = 'laser_inimigo';
                hp = 1;
            }
        }

        const enemy = selectedTemplate.clone();
        if (type === 'asteroide') {
        } else if (type === 'meteoro') {
            this._addLocalGlow(enemy, 0xff8a3d);
        }

        const camPos = new THREE.Vector3();
        this.camera.getWorldPosition(camPos);
        const camDirection = new THREE.Vector3();
        this.camera.getWorldDirection(camDirection);
        const camRight = new THREE.Vector3();
        camRight.setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();

        const spawnDistance = 2200;
        const centerSpawnPoint = camPos.clone().addScaledVector(camDirection, spawnDistance);
        const sideChoice = Math.random() < 0.5 ? -1 : 1;
        const lateralOffset = sideChoice * (400 + Math.random() * 280);
        const verticalOffset = (Math.random() - 0.5) * 220;

        const finalSpawnPos = centerSpawnPoint.clone()
            .addScaledVector(camRight, lateralOffset)
            .addScaledVector(new THREE.Vector3(0, 1, 0), verticalOffset);

        enemy.position.copy(finalSpawnPos);
        const moveDir = new THREE.Vector3().subVectors(camPos, enemy.position).normalize();

        enemy.userData = { type, speed, moveDir, shootTimer: (type === 'meteoro' || type === 'asteroide') ? 99999 : (0.8 + Math.random() * 1.2), hp, passSound, laserSound, passSoundPlayed: false };
        enemy.lookAt(camPos);
        enemy.traverse((child) => { if (child.isMesh) child.frustumCulled = false; });

        this.scene.add(enemy);
        this.enemies.push(enemy);
    }

  update(laserManager, onScoreIncrease, player, deltaTime, explosionManager, soundManager, currentLevel = 1) {
    if (!player?.mesh || !deltaTime) return;

    // 1. Lógica de detecção de mudança de nível (Para disparar o Card)
    if (this.lastLevel !== currentLevel) {
        this.lastLevel = currentLevel;
        // Dispara evento global que seu UI pode escutar para mostrar o card
        window.dispatchEvent(new CustomEvent('levelChanged', { 
            detail: { level: currentLevel } 
        }));
    }

    // 2. Lógica de Spawning
    const adjustedCooldown = Math.max(0.45, this.waveCooldown - (currentLevel * 0.012));
    this.waveTimer += deltaTime;
    if (this.waveTimer > adjustedCooldown) {
        this.spawnWave(player, currentLevel);
        this.waveTimer = 0;
    }

    // 3. Gerenciamento de Projéteis Inimigos
    const pPos = new THREE.Vector3();
    player.mesh.getWorldPosition(pPos);
    const playerLasers = laserManager.lasers || [];

    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
        const p = this.enemyProjectiles[i];
        p.mesh.position.addScaledVector(p.dir, p.speed * deltaTime);
        
        // Verificação de distância otimizada
        if (p.mesh.position.distanceTo(pPos) > 1500) {
            this.scene.remove(p.mesh);
            this.enemyProjectiles.splice(i, 1);
        }
    }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            const data = enemy.userData;
            const previousPosition = enemy.position.clone();

            if (data.type !== 'meteoro' && data.type !== 'asteroide') {
                data.shootTimer -= deltaTime;
                if (data.shootTimer <= 0) {
                    this._enemyShoot(enemy, player, soundManager);
                    data.shootTimer = 1.4 + Math.random() * 1.2;
                }
            }

            enemy.position.addScaledVector(data.moveDir, data.speed * deltaTime);

            if (data.type === 'drone' || data.type === 'meteoro' || data.type === 'asteroide') {
                enemy.rotation.x += 0.015;
                enemy.rotation.y += 0.015;
            }

            if (data.type !== 'meteoro' && data.type !== 'asteroide' && this._hitsAsteroid(enemy, i, previousPosition)) {
                continue;
            }

            let foiAtingidoPorLaser = false;
            let pontoDoImpactoReal = null;

            if (playerLasers.length > 0) {
                for (let j = playerLasers.length - 1; j >= 0; j--) {
                    const laser = playerLasers[j];
                    if (!laser || laser.userData?.destroyed) continue;

                    const distLaser = enemy.position.distanceTo(laser.position);
                    const hitbox = (data.type === 'meteoro' || data.type === 'asteroide') ? 70 : 35;

                    if (distLaser < hitbox) {
                        pontoDoImpactoReal = laser.position.clone();
                        this.scene.remove(laser);
                        laser.userData = { destroyed: true };
                        playerLasers.splice(j, 1);
                        data.hp--;

                        if (data.hp <= 0) {
                            let pontos = (data.type === 'meteoro' || data.type === 'asteroide') ? 500 : (data.type === 'drone' ? 300 : (data.type === 'roblox' ? 250 : 1000));
                            if (onScoreIncrease) onScoreIncrease(pontos, pontoDoImpactoReal);
                            foiAtingidoPorLaser = true;
                        }
                        break;
                    }
                }
            }

            if (foiAtingidoPorLaser && pontoDoImpactoReal) {
                if (explosionManager) explosionManager.create(pontoDoImpactoReal);
                this.scene.remove(enemy);
                this.enemies.splice(i, 1);
                continue;
            }

            const camPosAtual = new THREE.Vector3();
            this.camera.getWorldPosition(camPosAtual);
            if (enemy.position.z > camPosAtual.z + 200 || enemy.position.distanceTo(camPosAtual) > 2800) {
                this.scene.remove(enemy);
                this.enemies.splice(i, 1);
            }
        }
    }

    _hitsAsteroid(enemy, enemyIndex, previousPosition) {
        const enemyType = enemy?.userData?.type;
        if (!enemyType || enemyType === 'meteoro' || enemyType === 'asteroide') return false;

        enemy.updateMatrixWorld(true);
        const enemyBox = this.enemyCollisionBox.setFromObject(enemy);

        for (let j = 0; j < this.enemies.length; j++) {
            if (j === enemyIndex) continue;

            const obstacle = this.enemies[j];
            const obstacleType = obstacle?.userData?.type;
            if (obstacleType !== 'asteroide' && obstacleType !== 'meteoro') continue;

            obstacle.updateMatrixWorld(true);
            const obstacleBox = this.obstacleCollisionBox.setFromObject(obstacle);

            if (enemyBox.intersectsBox(obstacleBox)) {
                enemy.position.copy(previousPosition);
                enemy.userData.moveDir = enemy.userData.moveDir.clone().multiplyScalar(-0.15).normalize();
                return true;
            }
        }

        return false;
    }

    _enemyShoot(enemy, player, soundManager) {
        if (enemy.userData.type === 'meteoro' || enemy.userData.type === 'asteroide' || !player?.mesh) return;
        const pPos = new THREE.Vector3();
        player.mesh.getWorldPosition(pPos);

        const laser = new THREE.Mesh(ENEMY_LASER_GEO, ENEMY_LASER_MAT);
        laser.position.copy(enemy.position);
        laser.lookAt(pPos);
        this.scene.add(laser);

        const dir = new THREE.Vector3().subVectors(pPos, laser.position).normalize();
        this.enemyProjectiles.push({ mesh: laser, dir, speed: 520 });

        if (soundManager && enemy.userData.laserSound) {
            soundManager.play(enemy.userData.laserSound);
        }
    }

    damageEnemy(enemy, damage = 22, hitPoint = null) {
        if (!enemy?.userData) return false;
        enemy.userData.hp = (enemy.userData.hp || 1) - damage;

        if (enemy.userData.hp <= 0) {
            let pontos = (enemy.userData.type === 'meteoro' || enemy.userData.type === 'asteroide') ? 500 : (enemy.userData.type === 'drone' ? 250 : (enemy.userData.type === 'roblox' ? 150 : 100));
            if (this.scorePopup && hitPoint) this.scorePopup.show(pontos, hitPoint);
            return true;
        }
        return false;
    }
}