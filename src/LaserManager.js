import * as THREE from 'three';
import { markBloom } from './BloomPipeline.js';
import { awardPoints, explosionSizeFor } from './Scoring.js';

const LASER_OUTER_GEO = new THREE.CylinderGeometry(0.9, 0.9, 13, 8).rotateX(Math.PI / 2);
const LASER_CORE_GEO = new THREE.CylinderGeometry(0.24, 0.24, 16, 6).rotateX(Math.PI / 2);
const LASER_EDGE_GEO = new THREE.CylinderGeometry(0.52, 0.52, 12, 8, 1, true).rotateX(Math.PI / 2);
const LASER_TRAIL_GEO = new THREE.CylinderGeometry(0.08, 0.52, 26, 8, 1, true).rotateX(Math.PI / 2);
const LASER_NOSE_GEO = new THREE.SphereGeometry(0.36, 8, 6);
const LASER_OUTER_MAT = new THREE.MeshBasicMaterial({
    color: 0x087dff,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
});
const LASER_CORE_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
const LASER_EDGE_MAT = new THREE.MeshBasicMaterial({
    color: 0x00eaff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
});
const LASER_TRAIL_MAT = new THREE.MeshBasicMaterial({
    color: 0x137cff,
    transparent: true,
    opacity: 0.19,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
});
const LASER_NOSE_MAT = new THREE.MeshBasicMaterial({ color: 0xbdfaff, toneMapped: false });

// Recursos de míssil compartilhados por todas as instâncias (nunca descartados)
const MISSILE_BODY_GEO = new THREE.CylinderGeometry(0.55, 0.55, 5.6, 10).rotateX(Math.PI / 2);
const MISSILE_BAND_GEO = new THREE.CylinderGeometry(0.58, 0.58, 0.7, 10);
const MISSILE_TIP_GEO = new THREE.ConeGeometry(0.65, 1.7, 10);
const MISSILE_GLOW_GEO = new THREE.SphereGeometry(0.22, 8, 8);
const MISSILE_FLAME_GEO = new THREE.ConeGeometry(0.72, 3.6, 8).rotateX(-Math.PI / 2);
const MISSILE_FLAME_CORE_GEO = new THREE.ConeGeometry(0.28, 2.6, 6).rotateX(-Math.PI / 2);
const MISSILE_TRAIL_GEO = new THREE.CylinderGeometry(0.04, 0.28, 6.5, 8, 1, true).rotateX(Math.PI / 2);
const MISSILE_HEAT_GEO = new THREE.ConeGeometry(0.9, 7.0, 8).rotateX(-Math.PI / 2);
const MISSILE_BODY_MAT = new THREE.MeshStandardMaterial({
    color: 0x163849,
    emissive: 0x062332,
    emissiveIntensity: 0.9,
    metalness: 0.7,
    roughness: 0.3,
    toneMapped: false
});
const MISSILE_BAND_MAT = new THREE.MeshBasicMaterial({ color: 0x00d9ff, toneMapped: false });
const MISSILE_TIP_MAT = new THREE.MeshBasicMaterial({ color: 0xd9fcff, toneMapped: false });
const MISSILE_GLOW_MAT = new THREE.MeshBasicMaterial({
    color: 0x19dfff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
});
const MISSILE_FLAME_MAT = new THREE.MeshBasicMaterial({
    color: 0x168bff,
    transparent: true,
    opacity: 0.62,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
});
const MISSILE_FLAME_CORE_MAT = new THREE.MeshBasicMaterial({
    color: 0xeaffff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
});
const MISSILE_TRAIL_MAT = new THREE.MeshBasicMaterial({
    color: 0x37efff,
    transparent: true,
    opacity: 0.58,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
});
const MISSILE_HEAT_MAT = new THREE.MeshBasicMaterial({
    color: 0x5ceaff,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide
});
const MISSILE_PARTICLE_COUNT = 96;
const MISSILE_PARTICLE_GEO = new THREE.SphereGeometry(0.18, 6, 4);
const MISSILE_PARTICLE_MAT = new THREE.MeshBasicMaterial({
    color: 0x78eaff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
});
const MUZZLE_POOL_SIZE = 12;
const MUZZLE_GLOW_GEO = new THREE.SphereGeometry(1, 8, 6);
const MUZZLE_RING_GEO = new THREE.TorusGeometry(0.72, 0.12, 5, 12);
const _muzzlePoolSeed = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _fwd = new THREE.Vector3();

export class LaserManager {
    constructor(scene, soundManager) {
        this.scene = scene;
        this.soundManager = soundManager; 
        this.lasers = [];
        this.missiles = [];
        this.laserSpeed = 760.0;
        this.maxLasers = 120;
        this.maxMissiles = 24;
        this.missilePool = [];
        this.laserPool = [];
        this.muzzlePool = [];
        this.activeMuzzleFlashes = [];
        this.visualTime = 0;
        this.missileParticlePool = [];
        this.activeMissileParticles = [];
        for (let i = 0; i < MISSILE_PARTICLE_COUNT; i++) {
            this.missileParticlePool.push({
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                life: 0,
                maxLife: 0
            });
        }
        this.missileParticleMesh = new THREE.InstancedMesh(
            MISSILE_PARTICLE_GEO,
            MISSILE_PARTICLE_MAT,
            MISSILE_PARTICLE_COUNT
        );
        this.missileParticleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.missileParticleMesh.instanceColor = new THREE.InstancedBufferAttribute(
            new Float32Array(MISSILE_PARTICLE_COUNT * 3),
            3
        );
        this.missileParticleMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        this.missileParticleMesh.count = 0;
        this.missileParticleMesh.frustumCulled = false;
        markBloom(this.missileParticleMesh);
        this.scene.add(this.missileParticleMesh);
        this._particleDummy = new THREE.Object3D();
        this._particleColor = new THREE.Color();
        this._particleSide = new THREE.Vector3();
        for (let i = 0; i < MUZZLE_POOL_SIZE; i++) {
            const flash = new THREE.Group();
            const glowMat = new THREE.MeshBasicMaterial({
                color: 0x5ceaff,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                toneMapped: false
            });
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0xd8ffff,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                toneMapped: false
            });
            flash.add(new THREE.Mesh(MUZZLE_GLOW_GEO, glowMat));
            const ring = new THREE.Mesh(MUZZLE_RING_GEO, ringMat);
            ring.rotation.x = Math.PI / 2;
            flash.add(ring);
            flash.userData = { life: 0, glowMat, ringMat };
            markBloom(flash);
            flash.visible = false;
            this.muzzlePool.push(flash);
        }
    }

    _createLaserVisual() {
        const laser = new THREE.Group();
        const glow = new THREE.Mesh(LASER_OUTER_GEO, LASER_OUTER_MAT);
        const edge = new THREE.Mesh(LASER_EDGE_GEO, LASER_EDGE_MAT);
        const core = new THREE.Mesh(LASER_CORE_GEO, LASER_CORE_MAT);
        const nose = new THREE.Mesh(LASER_NOSE_GEO, LASER_NOSE_MAT);
        const trail = new THREE.Mesh(LASER_TRAIL_GEO, LASER_TRAIL_MAT);
        trail.position.z = -17;
        nose.position.z = 7.5;
        laser.add(trail, glow, edge, core, nose);
        markBloom(laser);
        laser.userData = { direction: new THREE.Vector3(), life: 0, trail };
        return laser;
    }

    _spawnMuzzleFlash(position, direction) {
        const flash = this.muzzlePool.pop();
        if (!flash) return;
        flash.position.copy(position);
        flash.position.addScaledVector(direction, 5);
        flash.lookAt(_muzzlePoolSeed.copy(position).add(direction));
        flash.scale.setScalar(0.35);
        flash.userData.life = 0.11;
        flash.visible = true;
        flash.userData.glowMat.opacity = 0.95;
        flash.userData.ringMat.opacity = 0.9;
        this.scene.add(flash);
        this.activeMuzzleFlashes.push(flash);
    }

    fire(worldGunPos, direction) {
        if (this.lasers.length >= this.maxLasers) return;

        let laser = this.laserPool.pop();
        if (!laser) laser = this._createLaserVisual();
        laser.position.copy(worldGunPos);
        laser.lookAt(_aim.copy(worldGunPos).add(direction));
        laser.userData.direction.copy(direction).normalize();
        laser.userData.life = 1.8;

        this.scene.add(laser);
        this.lasers.push(laser);
        this._spawnMuzzleFlash(worldGunPos, direction);

        if (this.soundManager) this.soundManager.play('playerShot');
    }

    createMissile(position, quaternion) {
        if (this.missiles.length >= this.maxMissiles) return null;

        let missile = this.missilePool.pop();
        if (!missile) {
            missile = new THREE.Mesh(MISSILE_BODY_GEO, MISSILE_BODY_MAT);
            missile.add(new THREE.Mesh(MISSILE_BAND_GEO, MISSILE_BAND_MAT));

            const tip = new THREE.Mesh(MISSILE_TIP_GEO, MISSILE_TIP_MAT);
            tip.rotation.x = Math.PI / 2;
            tip.position.set(0, 0, 3.15);
            missile.add(tip);

            const rearGlow = new THREE.Mesh(MISSILE_GLOW_GEO, MISSILE_GLOW_MAT);
            rearGlow.position.set(0, 0, -2.8);
            missile.add(rearGlow);
            const flame = new THREE.Mesh(MISSILE_FLAME_GEO, MISSILE_FLAME_MAT);
            flame.position.set(0, 0, -4.5);
            missile.add(flame);
            const flameCore = new THREE.Mesh(MISSILE_FLAME_CORE_GEO, MISSILE_FLAME_CORE_MAT);
            flameCore.position.set(0, 0, -4.25);
            missile.add(flameCore);
            const trail = new THREE.Mesh(MISSILE_TRAIL_GEO, MISSILE_TRAIL_MAT);
            trail.position.set(0, 0, -5.2);
            missile.add(trail);
            const heat = new THREE.Mesh(MISSILE_HEAT_GEO, MISSILE_HEAT_MAT);
            heat.position.set(0, 0, -6.4);
            missile.add(heat);

            missile.userData = { direction: new THREE.Vector3(), flame, flameCore, trail, heat };
            [tip, rearGlow, flame, flameCore, trail, heat].forEach(markBloom);
        }

        missile.position.copy(position);
        missile.quaternion.copy(quaternion);
        missile.userData.direction.set(0, 0, 1).applyQuaternion(quaternion).normalize();
        this.scene.add(missile);
        this.missiles.push({ mesh: missile, speed: 620.0, life: 5.0, particleTimer: 0 });
        this._spawnMuzzleFlash(position, missile.userData.direction);
        this.soundManager?.play('missileLaunch', { volume: 0.52, playbackRate: 0.88 });
        this.soundManager?.startLoop('missileEngine', missile.uuid, {
            volume: 0.18,
            playbackRate: 1.12,
            maxDistance: 1200
        });
    }

    update(deltaTime, enemyManager = null, onEnemyDestroyed = null, explosionManager = null, listenerPosition = null) {
    if (!deltaTime) return;
    this.visualTime += deltaTime;

    for (let i = this.activeMuzzleFlashes.length - 1; i >= 0; i--) {
        const flash = this.activeMuzzleFlashes[i];
        flash.userData.life -= deltaTime;
        const progress = Math.max(0, flash.userData.life / 0.11);
        flash.scale.setScalar(0.35 + (1 - progress) * 1.1);
        flash.userData.glowMat.opacity = progress * 0.95;
        flash.userData.ringMat.opacity = progress * 0.9;
        if (flash.userData.life <= 0) {
            this.scene.remove(flash);
            flash.visible = false;
            this.muzzlePool.push(flash);
            this.activeMuzzleFlashes.splice(i, 1);
        }
    }

    // Atualizar Lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
        const laser = this.lasers[i];
        laser.position.addScaledVector(laser.userData.direction, this.laserSpeed * deltaTime);
        laser.userData.life -= deltaTime;

        if (laser.userData.life <= 0) {
            this.scene.remove(laser);
            this.laserPool.push(laser);
            this.lasers.splice(i, 1);
        }
    }

    // Atualizar Mísseis
   for (let i = this.missiles.length - 1; i >= 0; i--) {
    const m = this.missiles[i];  
    const forward = _fwd.copy(m.mesh.userData.direction);
    m.mesh.position.addScaledVector(forward, m.speed * deltaTime);
    if (listenerPosition) {
        this.soundManager?.updateLoop(m.mesh.uuid, m.mesh.position.distanceTo(listenerPosition));
    }
    const flamePulse = 0.88 + Math.sin(this.visualTime * 24 + i) * 0.12;
    m.mesh.userData.flame.scale.setScalar(flamePulse);
    m.mesh.userData.flameCore.scale.setScalar(0.9 + Math.sin(this.visualTime * 19 + i) * 0.08);
    m.mesh.userData.trail.scale.set(1, 0.82 + flamePulse * 0.18, 1);
    m.mesh.userData.heat.scale.setScalar(0.92 + Math.sin(this.visualTime * 12 + i) * 0.08);
    m.particleTimer += deltaTime;
    while (m.particleTimer >= 0.075) {
        m.particleTimer -= 0.075;
        this._spawnMissileParticle(m);
    }

    let hitEnemy = false;
    if (enemyManager?.enemies?.length) {
        for (let j = enemyManager.enemies.length - 1; j >= 0; j--) {
            const enemy = enemyManager.enemies[j];
            if (!enemy) continue;

            const enemyType = enemy.userData?.type;
            const hitRadius = (enemyType === 'meteoro' || enemyType === 'asteroide') ? 110 : 70;
            if (m.mesh.position.distanceTo(enemy.position) <= hitRadius) {
                const hitPoint = m.mesh.position.clone();
                const destroyed = enemyManager.damageEnemy
                    ? enemyManager.damageEnemy(enemy, 35, hitPoint)
                    : true;

                if (explosionManager) {
                    if (destroyed) {
                        explosionManager.create(hitPoint, {
                            kind: 'missile',
                            sound: 'missileImpact',
                            scale: explosionSizeFor(enemyType),
                            flashColor: 0xd8ffff,
                            lightColor: 0x28cfff,
                            lightIntensity: 2600,
                            smokeColor: 0x123c58
                        });
                    } else {
                        explosionManager.create(hitPoint, {
                            kind: 'plasma',
                            sound: 'missileImpact',
                            scale: 0.6,
                            flashColor: 0xd8ffff,
                            lightColor: 0x28cfff
                        });
                    }
                }

                if (destroyed) {
                    awardPoints(enemy, 'missile', hitPoint);
                    enemyManager.scene.remove(enemy);
                    enemyManager.enemies.splice(j, 1);
                }

                hitEnemy = true;
                break;
            }
        }
    }

        m.life -= deltaTime;

        if (hitEnemy || m.life <= 0) {
            this.disposeMissile(m.mesh);
            this.missiles.splice(i, 1);
        }
    }

    this._updateMissileParticles(deltaTime);
}

    _spawnMissileParticle(missile) {
        const particle = this.missileParticlePool.pop();
        if (!particle) return;
        const direction = missile.mesh.userData.direction;
        particle.position.copy(missile.mesh.position).addScaledVector(direction, -6.5);
        particle.position.x += (Math.random() - 0.5) * 1.2;
        particle.position.y += (Math.random() - 0.5) * 1.2;
        this._particleSide.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
        particle.velocity.copy(direction).multiplyScalar(-20 - Math.random() * 16)
            .addScaledVector(this._particleSide, 7);
        particle.maxLife = particle.life = 0.2 + Math.random() * 0.16;
        this.activeMissileParticles.push(particle);
    }

    _updateMissileParticles(deltaTime) {
        const dummy = this._particleDummy;
        const mesh = this.missileParticleMesh;
        let count = 0;
        for (let i = this.activeMissileParticles.length - 1; i >= 0; i--) {
            const particle = this.activeMissileParticles[i];
            particle.life -= deltaTime;
            if (particle.life <= 0) {
                this.activeMissileParticles.splice(i, 1);
                this.missileParticlePool.push(particle);
                continue;
            }
            particle.position.addScaledVector(particle.velocity, deltaTime);
            const alpha = particle.life / particle.maxLife;
            dummy.position.copy(particle.position);
            dummy.scale.setScalar(0.35 + alpha * 0.65);
            dummy.updateMatrix();
            mesh.setMatrixAt(count, dummy.matrix);
            mesh.setColorAt(count, this._particleColor.setRGB(0.18 * alpha, 0.58 * alpha, alpha));
            count++;
        }
        mesh.count = count;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
    }

    disposeMissile(mesh) {
        this.scene.remove(mesh);
        this.soundManager?.stopLoop(mesh.uuid);
        if (!this.missilePool.includes(mesh)) this.missilePool.push(mesh);
    }
}