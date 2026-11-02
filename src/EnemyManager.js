import * as THREE from 'three';
import { markBloom } from './BloomPipeline.js';
import { awardPoints, explosionSizeFor } from './Scoring.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ENEMY_LASER_GEO = new THREE.CylinderGeometry(0.4, 0.4, 8, 4);
ENEMY_LASER_GEO.rotateX(Math.PI / 2);
const ENEMY_LASER_GLOW_GEO = new THREE.CylinderGeometry(0.9, 0.9, 10, 5, 1, true);
ENEMY_LASER_GLOW_GEO.rotateX(Math.PI / 2);
const ENEMY_LASER_MAT = new THREE.MeshBasicMaterial({ color: 0xff2233, toneMapped: false });
const ENEMY_LASER_GLOW_MAT = new THREE.MeshBasicMaterial({
    color: 0x9a22ff,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
});
const _eSide = new THREE.Vector3();
const _eUp = new THREE.Vector3(0, 1, 0);
const _eDesired = new THREE.Vector3();
const _eAim = new THREE.Vector3();

export class EnemyManager {
    constructor(scene, camera, scorePopup, isMobile = false) {
        this.scorePopup = scorePopup;
        this.scene = scene;
        this.camera = camera;
        this.flightPath = null;
        this.ship = null;
        this._spawnWorld = new THREE.Vector3();
        this._pathTmp = new THREE.Vector3();
        this.enemies = [];
        this.enemyProjectiles = [];
        this.templates = {};
        this.isMobile = isMobile;
        this.enemyCollisionBox = new THREE.Box3();
        this.obstacleCollisionBox = new THREE.Box3();

        this.waveTimer = 0;
        this.enemySpeed = 220;
        this.maxEnemiesOnScreen = isMobile ? 8 : 12;
        this.waveCooldown = isMobile ? 1.9 : 1.5;
        this.formationTimer = 3;
        this.loadFactor = 1;
        this.lastWaveSpawnAt = 0;

        // Templates
        this.enemyTemplate = null;
        this.enemyTemplate5 = null;
        this.enemyTemplate10 = null;
        this.enemyTemplate15 = null;
        this.droneTemplate = null;
        this.meteoroTemplate = null;
        this.enemyTemplate6 = null;

        this._loadEnemyModel();
    }

    async init() { 
        return Promise.resolve(); 
    }

    // Inimigos e projéteis vivem no mundo: quando a origem da cena anda em x (a nave deriva no mundo),
    // eles compensam para ficarem parados em relação ao terreno.
    shiftWorld(dx, dy = 0) {
        if (!dx && !dy) return;
        for (let i = 0; i < this.enemies.length; i++) { this.enemies[i].position.x -= dx; this.enemies[i].position.y -= dy; }
        for (let i = 0; i < this.enemyProjectiles.length; i++) {
            const p = this.enemyProjectiles[i].mesh.position;
            p.x -= dx;
            p.y -= dy;
        }
    }

 clearAllEnemies() {
    // Apenas remove da cena se não for o Boss
    this.enemies.forEach(e => {
        // Se o objeto tiver uma propriedade 'isBoss', ele não será removido
        if (!e.userData || !e.userData.isBoss) {
            this.scene.remove(e);
        }
    });

    // Limpa a lista mantendo apenas o Boss (se houver)
    this.enemies = this.enemies.filter(e => e.userData && e.userData.isBoss);

    // Projéteis inimigos comuns podem ser limpos normalmente
    this.enemyProjectiles.forEach(p => {
        if (p.mesh) this.scene.remove(p.mesh);
    });
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
        // Materiais "brilhantes" são criados uma única vez por material original e compartilhados;
        // a PointLight por meteoro foi removida (cada luz dinâmica recompila shaders e encarece todos os fragmentos).
        if (!this._glowCache) this._glowCache = new Map();
        model.traverse((child) => {
            if (!child.isMesh || !child.material) return;

            const materials = Array.isArray(child.material) ? child.material : [child.material];
            const enhancedMaterials = materials.map((material) => {
                const key = `${material.uuid}_${color}_${emissiveIntensity}`;
                let nextMaterial = this._glowCache.get(key);
                if (!nextMaterial) {
                    nextMaterial = material.clone();
                    if (nextMaterial.emissive) {
                        nextMaterial.emissive = new THREE.Color(color);
                        nextMaterial.emissiveIntensity = emissiveIntensity;
                    }
                    this._glowCache.set(key, nextMaterial);
                }
                return nextMaterial;
            });

            child.material = Array.isArray(child.material) ? enhancedMaterials : enhancedMaterials[0];
        });
        return null;
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

        const loadModel = (path, targetKey, scale, rotation = 0) => {
            loader.load(path, (gltf) => {
                const model = this._createOrientedTemplate(gltf.scene, rotation);
                model.scale.set(...scale);
                this[targetKey] = model;
            }, undefined, (error) => {
                console.error(`❌ Erro ao carregar ${path}:`, error);
            });
        };

loadModel('/assets/models/nave_inimiga.glb', 'enemyTemplate', [20, 20, 20], 0);
loadModel('/assets/models/nave_inim_5.glb', 'enemyTemplate5', [20, 20, 20], Math.PI / 2);
loadModel('/assets/models/nave_inim_10.glb', 'enemyTemplate10', [20, 20, 20], 0);
loadModel('/assets/models/nave_inim_15.glb', 'enemyTemplate15', [20, 20, 20], 0);
loadModel('/assets/models/drone.glb', 'droneTemplate', [30, 30, 30], Math.PI);
loadModel('/assets/models/meteoro.glb', 'meteoroTemplate', [5, 5, 5], 0);
loadModel('/assets/models/roblox.glb', 'enemyTemplate6', [7, 7, 7], 0);

        // Asteroid especial
        loader.load('/assets/models/asteroid_ball.glb', (gltf) => {
            const model = gltf.scene;
          model.scale.set(3.5, 3.5, 3.5);
            this._styleAsteroidModel(model);
            this.templates.asteroide = model;
        }, undefined, (error) => {
            console.error('❌ Erro ao carregar asteroid_ball.glb:', error);
        });
    }

    spawnWave(player, currentLevel = 1) {
        if (!this.enemyTemplate || !player?.mesh) return;
        if (this.enemies.length >= this._cap()) return;
        const now = performance.now();
        if (now - this.lastWaveSpawnAt < 120) return;
        this.lastWaveSpawnAt = now;
        this._spawnOne(this._pickConfig(currentLevel), null);
    }

    // Limite efetivo de inimigos; encolhe quando o FPS cai.
    _cap() {
        return Math.max(4, Math.round(this.maxEnemiesOnScreen * this.loadFactor));
    }

    setLoadFactor(fps) {
        this.loadFactor = fps >= 50 || !fps ? 1 : fps >= 40 ? 0.75 : 0.55;
    }

    // Onda em formação: mesmo tipo/velocidade, posições relativas à câmera, convergindo para o jogador.
    spawnFormation(player, currentLevel = 1) {
        if (!this.enemyTemplate || !player?.mesh) return 0;
        const free = this._cap() - this.enemies.length;
        if (free < 3) return 0;
        let cfg = this._pickConfig(currentLevel);
        // Obstáculos não formam esquadrão: viram um campo curto de rochas.
        const hazard = cfg.type === 'meteoro' || cfg.type === 'asteroide';
        const want = Math.min(free, hazard ? 3 : Math.min(3 + Math.floor(currentLevel / 3), 8) + (Math.random() < 0.5 ? 1 : 0));
        const shapes = hazard ? ['line'] : ['v', 'line', 'column', 'diamond', 'grid', 'pincer', 'circle'];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const gap = 95;
        const offsets = [];
        for (let i = 0; i < want; i++) {
            const k = i - (want - 1) / 2;
            let o;
            switch (shape) {
                case 'v': o = [k * gap, -Math.abs(k) * gap * 0.6, Math.abs(k) * 70]; break;
                case 'column': o = [0, k * gap * 0.9, i * 60]; break;
                case 'diamond': {
                    const a = (i / want) * Math.PI * 2;
                    o = [Math.cos(a) * gap * 1.1, Math.sin(a) * gap * 0.8, (i % 2) * 90];
                    break;
                }
                case 'grid': o = [((i % 3) - 1) * gap, (Math.floor(i / 3) - 0.5) * gap, 0]; break;
                case 'pincer': o = [(i % 2 ? 1 : -1) * (260 + Math.floor(i / 2) * 90), Math.floor(i / 2) * 40 - 40, Math.floor(i / 2) * 50]; break;
                case 'circle': {
                    const a = (i / want) * Math.PI * 2;
                    o = [Math.cos(a) * gap * 1.5, Math.sin(a) * gap * 1.1, 0];
                    break;
                }
                default: o = [k * gap * 1.2, 0, 0];
            }
            offsets.push(o);
        }
        const entrySide = Math.floor(Math.random() * 4);
        const baseLat = entrySide < 2 ? (entrySide === 0 ? -1 : 1) * (350 + Math.random() * 300) : (Math.random() - 0.5) * 260;
        const baseVert = entrySide >= 2 ? (entrySide === 2 ? -1 : 1) * (100 + Math.random() * 140) : (Math.random() - 0.5) * 200;
        const converge = shape === 'pincer' ? 1 : 0.55;
        const seed = Math.random() * Math.PI * 2;
        const baseSpeed = cfg.speed;
        offsets.forEach((o, i) => {
            const member = { ...cfg, speed: baseSpeed };
            this._spawnOne(member, {
                lat: baseLat + o[0], vert: baseVert + o[1], depth: o[2],
                converge, seed, delay: i * 0.18
            });
        });
        this.lastWaveSpawnAt = performance.now();
        return want;
    }

    _pickConfig(currentLevel) {
        const rand = Math.random();
        let selectedTemplate = this.enemyTemplate;
        let type = 'comum';
        let speed = this.enemySpeed + Math.random() * 60;
        let passSound = 'enemyPass';
        let laserSound = 'enemyLaser';
        let hp = 1;

        // Lógica de spawn de inimigos normais
        if (rand < 0.25 && this.templates?.asteroide) {
            selectedTemplate = this.templates.asteroide;
            type = 'asteroide';
            speed = 140 + Math.random() * 80;
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
            speed = 180 + Math.random() * 70;
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

        return { selectedTemplate, type, speed, passSound, laserSound, hp };
    }

    // slot: posição de formação ({lat, vert, depth, converge, seed, delay}) ou null para entrada avulsa.
    _spawnOne(cfg, slot) {
        const { selectedTemplate, type, speed, passSound, laserSound, hp } = cfg;
        const enemy = selectedTemplate.clone();
        if (type === 'meteoro') {
            this._addLocalGlow(enemy, 0xff8a3d);
        }

        const camPos = new THREE.Vector3();
        this.camera.getWorldPosition(camPos);
        const camDirection = new THREE.Vector3();
        this.camera.getWorldDirection(camDirection);
        const camRight = new THREE.Vector3();
        camRight.setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();

        let spawnDistance = 2200 + (slot?.depth || 0);
        const entrySide = Math.floor(Math.random() * 4);
        let lateralOffset = slot ? slot.lat : entrySide < 2
            ? (entrySide === 0 ? -1 : 1) * (400 + Math.random() * 280)
            : (Math.random() - 0.5) * 220;
        let verticalOffset = slot ? slot.vert : entrySide >= 2
            ? (entrySide === 2 ? -1 : 1) * (120 + Math.random() * 140)
            : (Math.random() - 0.5) * 220;

        // Entradas avulsas também podem vir pela lateral (flanco) ou por cima, não só de frente.
        if (!slot && this.ship) {
            const roll = Math.random();
            if (roll < 0.2) {
                spawnDistance = 900 + Math.random() * 500;
                lateralOffset = (Math.random() < 0.5 ? -1 : 1) * (520 + Math.random() * 220);
                verticalOffset = (Math.random() - 0.3) * 160;
            } else if (roll < 0.35) {
                spawnDistance = 1400 + Math.random() * 400;
                lateralOffset = (Math.random() - 0.5) * 300;
                verticalOffset = 260 + Math.random() * 120;
            }
        }

        const finalSpawnPos = new THREE.Vector3();
        if (this.ship) {
            // O ponto nasce no mundo 3D (relativo à posição e ao rumo reais da nave) e é convertido para a cena.
            this.ship.worldPointAhead(spawnDistance, lateralOffset, verticalOffset, this._spawnWorld);
            this.ship.toScene(this._spawnWorld, finalSpawnPos);
        } else {
            finalSpawnPos.copy(camPos).addScaledVector(camDirection, spawnDistance)
                .addScaledVector(camRight, lateralOffset)
                .addScaledVector(new THREE.Vector3(0, 1, 0), verticalOffset);
        }

        enemy.position.copy(finalSpawnPos);
        // Em formação cada nave mira um ponto deslocado, mantendo o desenho até chegar perto do jogador.
        const aim = camPos.clone();
        if (slot) {
            const spread = 1 - slot.converge;
            aim.addScaledVector(camRight, lateralOffset * spread).y += verticalOffset * spread;
        }
        const moveDir = new THREE.Vector3().subVectors(aim, enemy.position).normalize();

        const baseShoot = (type === 'meteoro' || type === 'asteroide') ? 99999 : 0.8 + Math.random() * 1.2;
        // Quanto mais inimigos em campo, mais espaçados os tiros (mantém a dificuldade equilibrada).
        const shootTimer = baseShoot + (baseShoot < 9999 ? this.enemies.length * 0.05 + (slot?.delay || 0) : 0);

        enemy.userData = { 
            type, 
            speed, 
            moveDir, 
            shootTimer, 
            hp, 
            passSound, 
            laserSound, 
            passSoundPlayed: false,
            wanderSeed: slot ? slot.seed : Math.random() * Math.PI * 2,
            formation: !!slot,
            attackRange: 900 + Math.random() * 300
        };

        enemy.lookAt(camPos);
        // Frustum culling ativo (exceto malhas com esqueleto, cujo bounding box não acompanha a pose)
        enemy.traverse((child) => { 
            if (child.isMesh) child.frustumCulled = !!child.isSkinnedMesh ? false : true; 
        });

        this.scene.add(enemy);
        this.enemies.push(enemy);
    }

update(laserManager, onScoreIncrease, player, deltaTime, explosionManager, soundManager, currentLevel = 1, onPlayerHit = null) {
    if (!player?.mesh || !deltaTime) return;
    this._frameId = (this._frameId || 0) + 1;
    const camPosAtual = new THREE.Vector3();
    this.camera.getWorldPosition(camPosAtual);

        // Detecção de mudança de nível
        if (this.lastLevel !== currentLevel) {
            this.lastLevel = currentLevel;
            window.dispatchEvent(new CustomEvent('levelChanged', { 
                detail: { level: currentLevel } 
            }));
        }

        // Spawning
        const adjustedCooldown = Math.max(0.6, this.waveCooldown - (currentLevel * 0.015));
        this.waveTimer += deltaTime;
        if (this.waveTimer > adjustedCooldown) {
            this.spawnWave(player, currentLevel);
            this.waveTimer = 0;
        }
        this.formationTimer -= deltaTime;
        if (this.formationTimer <= 0) {
            this.spawnFormation(player, currentLevel);
            this.formationTimer = Math.max(4, 7.5 - currentLevel * 0.05) * (this.loadFactor < 1 ? 1.4 : 1);
        }

        // Projéteis inimigos
        const pPos = new THREE.Vector3();
        player.mesh.getWorldPosition(pPos);
        if (this.enemyProjectiles.length > 0) {
            for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
                const p = this.enemyProjectiles[i];
                if (!p || !p.mesh) {
                    this.enemyProjectiles.splice(i, 1);
                    continue;
                }

                p.mesh.position.addScaledVector(p.dir, p.speed * deltaTime);
                p.life -= deltaTime;

                if (p.life <= 0 || p.mesh.position.distanceTo(camPosAtual) > 2500) {
                    this.scene.remove(p.mesh);
                    this.enemyProjectiles.splice(i, 1);
                    continue;
                }

                if (p.mesh.position.distanceTo(player.mesh.position) < 18) {
                    this.scene.remove(p.mesh);
                    this.enemyProjectiles.splice(i, 1);
                    if (onPlayerHit) onPlayerHit();
                }
            }
        }

        // Atualização dos inimigos
        this._hasObstacles = this.enemies.some((e) => e?.userData?.type === 'asteroide' || e?.userData?.type === 'meteoro');
        const maxEnemyLoop = Math.min(this.enemies.length, this.maxEnemiesOnScreen + 4);
        for (let i = this.enemies.length - 1; i >= 0 && i >= this.enemies.length - maxEnemyLoop; i--) {
        const enemy = this.enemies[i];
        
        // TRAVA DE SEGURANÇA: Se o inimigo não existir, remove do array e pula
        if (!enemy || !enemy.userData) {
            this.enemies.splice(i, 1);
            continue;
        }

        const data = enemy.userData;
        const previousPosition = enemy.position.clone();

        // Shooting
        if (data.type !== 'meteoro' && data.type !== 'asteroide') {
            data.shootTimer -= deltaTime;
            if (data.shootTimer <= 0) {
                this._enemyShoot(enemy, player, soundManager);
                data.shootTimer = (1.4 + Math.random() * 1.2) * (1 + 0.04 * this.enemies.length);
            }
        }


const pPos = player.mesh.position;
const distToPlayer = enemy.position.distanceTo(pPos);

// Mantém a direção original de passagem (não vira de volta)
if (!data.moveDir || data.moveDir.lengthSq() < 0.0001) {
    data.moveDir = new THREE.Vector3().subVectors(pPos, enemy.position).normalize();
}

// Leve oscilação lateral (só pra não ir 100% reto)
const side = _eSide.crossVectors(data.moveDir, _eUp);

if (side.lengthSq() < 0.001) {
    side.set(1, 0, 0);
} else {
    side.normalize();
}

const nowMs = performance.now();
const wander = Math.sin(nowMs * 0.0007 + data.wanderSeed) * 0.12;

// Direção desejada = sempre para frente + leve desvio lateral
const desiredDir = _eDesired.copy(data.moveDir).normalize();
desiredDir.addScaledVector(side, wander);
desiredDir.y += wander * 0.15;
desiredDir.normalize();

// Suaviza bem pouco (não deixa girar bruto)
data.moveDir.lerp(desiredDir, 0.03);
data.moveDir.normalize();

// Avança
enemy.position.addScaledVector(data.moveDir, data.speed * deltaTime);

// Mira visualmente no jogador (só rotação, não muda o caminho)
const aimTarget = _eAim.copy(pPos);
aimTarget.y += Math.sin(nowMs * 0.001 + data.wanderSeed) * 0.8;
enemy.lookAt(aimTarget);

            if (
                data.type !== 'asteroide'
                && data.type !== 'meteoro'
                && !data.playerImpactHandled
                && enemy.position.distanceToSquared(pPos) < 30 * 30
            ) {
                enemy.position.copy(previousPosition);
                data.moveDir.negate();
                data.playerImpactHandled = true;
                const impactPosition = enemy.position.clone();
                if (onPlayerHit) {
                    onPlayerHit(impactPosition);
                } else if (explosionManager) {
                    explosionManager.create(impactPosition, 0.55);
                }
                continue;
            }

// Som de passagem
if (soundManager && !data.passSoundPlayed && data.passSound) {
    if (enemy.position.distanceTo(camPosAtual) < 500) {
        soundManager.play(data.passSound);
        data.passSoundPlayed = true;
    }
}

            // Rotação
            if (data.type === 'drone' || data.type === 'meteoro' || data.type === 'asteroide') {
                enemy.rotation.x += 0.015;
                enemy.rotation.y += 0.015;
            }

            // Colisão com asteroides
          if (data.type !== 'meteoro' && data.type !== 'asteroide' && this._hitsAsteroid(enemy, i, previousPosition)) {
            continue;
        }

     // Dano por laser
        let foiAtingidoPorLaser = false;
        let pontoDoImpactoReal = null;

        const playerLasers = laserManager.lasers || [];
        for (let j = playerLasers.length - 1; j >= 0; j--) {
            const laser = playerLasers[j];
            if (!laser) continue;

            const hitR = (data.type === 'meteoro' || data.type === 'asteroide') ? 70 : 55;
            if (enemy.position.distanceToSquared(laser.position) < hitR * hitR) {
                pontoDoImpactoReal = laser.position.clone();
                laser.userData = { destroyed: true };
                this.scene.remove(laser);
                playerLasers.splice(j, 1);
                data.hp--;
                if (data.hp <= 0) foiAtingidoPorLaser = true;
                break;
            }
        }

// Explosão e remoção
        if (foiAtingidoPorLaser) {
            if (soundManager) soundManager.play('explosao_inimiga');
            if (explosionManager) explosionManager.create(pontoDoImpactoReal, {
                kind: 'plasma',
                scale: (currentLevel >= 50 ? 2.5 : 1.0) * explosionSizeFor(data.type),
                flashColor: 0xeaffff,
                lightColor: 0x24cfff
            });
            
            awardPoints(enemy, 'laser', pontoDoImpactoReal);
            
            this.scene.remove(enemy);
            this.enemies.splice(i, 1);
            continue;
        }

    // Remoção por distância
        if (enemy.position.distanceTo(camPosAtual) > 2800) {
            this.scene.remove(enemy);
            this.enemies.splice(i, 1);
        }
    }
}

    _hitsAsteroid(enemy, enemyIndex, previousPosition) {
        const enemyType = enemy?.userData?.type;
        if (!enemyType || enemyType === 'meteoro' || enemyType === 'asteroide') return false;
        if (!this._hasObstacles) return false;

        enemy.updateMatrixWorld(true);
        const enemyBox = this.enemyCollisionBox.setFromObject(enemy);

        for (let j = 0; j < this.enemies.length; j++) {
            if (j === enemyIndex) continue;

            const obstacle = this.enemies[j];
            const obstacleType = obstacle?.userData?.type;
            if (obstacleType !== 'asteroide' && obstacleType !== 'meteoro') continue;

            const cached = obstacle.userData._box;
            if (!cached || obstacle.userData._boxFrame !== this._frameId) {
                obstacle.updateMatrixWorld(true);
                obstacle.userData._box = (cached || new THREE.Box3()).setFromObject(obstacle);
                obstacle.userData._boxFrame = this._frameId;
            }
            const obstacleBox = obstacle.userData._box;

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

        const laser = new THREE.Group();
        laser.add(new THREE.Mesh(ENEMY_LASER_GEO, ENEMY_LASER_MAT));
        laser.add(new THREE.Mesh(ENEMY_LASER_GLOW_GEO, ENEMY_LASER_GLOW_MAT));
        markBloom(laser);
        laser.position.copy(enemy.position);
        laser.lookAt(pPos);
        this.scene.add(laser);

        const dir = new THREE.Vector3().subVectors(pPos, laser.position).normalize();
        laser.userData = { direction: dir };
        this.enemyProjectiles.push({ mesh: laser, dir, speed: 520, life: 2.2 });

        if (soundManager && enemy.userData.laserSound) {
            soundManager.play(enemy.userData.laserSound);
        }
    }

    damageEnemy(enemy, damage = 22, hitPoint = null) {
        if (!enemy?.userData) return false;
        enemy.userData.hp = (enemy.userData.hp || 1) - damage;

        if (enemy.userData.hp <= 0) {
            return true;
        }
        return false;
    }
}