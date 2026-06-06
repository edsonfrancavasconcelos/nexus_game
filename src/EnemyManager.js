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
        this.enemyTemplate = null;
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
            console.log("✅ Modelo inimigo carregado!");
        }, undefined, (err) => console.error("Erro inimigo:", err));
    }

    _enemyShoot(enemy, soundManager) {
        const laser = new THREE.Mesh(ENEMY_LASER_GEO, ENEMY_LASER_MAT);
        laser.position.copy(enemy.position);
        this.scene.add(laser);
        this.enemyProjectiles.push({ mesh: laser, speed: 420 });
        if (soundManager) soundManager.play('enemyLaser');
    }

    spawnWave(player) {
        if (!this.enemyTemplate || this.enemies.length >= this.maxEnemiesOnScreen) return;

        const enemy = this.enemyTemplate.clone();
        const cameraPos = new THREE.Vector3();
        this.camera.getWorldPosition(cameraPos);

        // 🛠️ COORDENADAS AJUSTADAS: Agora elas nascem perto e no rumo certo da tela!
        const spawnDistance = 600; // Trouxe de 3400 para 600
        const spawnZ = cameraPos.z - spawnDistance;
        const offsetX = (Math.random() - 0.5) * 350; // Reduzido o espalhamento lateral
        const offsetY = (Math.random() - 0.5) * 200 + 10;

        enemy.position.set(cameraPos.x + offsetX, cameraPos.y + offsetY, spawnZ);
        enemy.userData = {
            speed: this.enemySpeed + Math.random() * 50,
            shootTimer: 1.8 + Math.random() * 2,
            passSoundPlayed: false // Controla para o som tocar só uma vez
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

        // Se o inimigo já passou da sua nave (Z maior ou muito perto), ele para de te seguir
        // e apenas voa reto para frente no eixo Z para ir embora sem tremer!
        if (enemy.position.z >= pPos.z - 20) {
            enemy.position.z += data.speed * deltaTime;
        } else {
            enemy.lookAt(pPos);
            const directionToPlayer = new THREE.Vector3();
            directionToPlayer.subVectors(pPos, enemy.position).normalize();
            enemy.position.addScaledVector(directionToPlayer, data.speed * deltaTime);
        }

        let foiAtingidoPorLaser = false;
        let pontoDoImpactoReal = null;

        // 1. COLISÃO CONTRA OS SEUS TIROS
        if (playerLasers.length > 0) {
            for (let j = playerLasers.length - 1; j >= 0; j--) {
                const laser = playerLasers[j];
                if (!laser || !laser.position || laser.userData?.destroyed) continue;

                const distLaser = enemy.position.distanceTo(laser.position);

                if (distLaser < 35) { 
                    pontoDoImpactoReal = laser.position.clone();

                    if (onScoreIncrease) onScoreIncrease(100, pontoDoImpactoReal);
                    
                    this.scene.remove(laser);
                    laser.userData = { destroyed: true };
                    playerLasers.splice(j, 1); 
                    
                    foiAtingidoPorLaser = true; 
                    break; 
                }
            }
        }

        // --- 2. SOM DE PASSAR RASPANDO ---
        const distDoPlayer = enemy.position.distanceTo(pPos);

        if (enemy.position.z > pPos.z) {
            if (!data.passSoundPlayed && distDoPlayer < 120) {
                if (soundManager) soundManager.play('enemyPass');
                data.passSoundPlayed = true;
            }
        }

        // --- 3. REGRAS DE REMOÇÃO DA TELA (AJUSTADO PARA A PASSAGEM LONGA) ---

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
        // 🛠️ CORREÇÃO DA PASSAGEM: Mudado de +60 para +500! 
        // Agora ele viaja bastante espaço depois que passa por você antes de sumir limpo.
        if (enemy.position.z > pPos.z + 500) {
            this.scene.remove(enemy);
            this.enemies.splice(i, 1);
        }
    }
}}
