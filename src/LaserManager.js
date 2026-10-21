import * as THREE from 'three';
import { awardPoints, explosionSizeFor } from './Scoring.js';

const LASER_OUTER_GEO = new THREE.CylinderGeometry(0.9, 0.9, 13, 8).rotateX(Math.PI / 2);
const LASER_CORE_GEO = new THREE.CylinderGeometry(0.24, 0.24, 16, 6).rotateX(Math.PI / 2);
const LASER_EDGE_GEO = new THREE.CylinderGeometry(0.52, 0.52, 12, 8, 1, true).rotateX(Math.PI / 2);
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
const LASER_NOSE_MAT = new THREE.MeshBasicMaterial({ color: 0xbdfaff, toneMapped: false });

// Recursos de míssil compartilhados por todas as instâncias (nunca descartados)
const MISSILE_BODY_GEO = new THREE.CylinderGeometry(0.55, 0.55, 5.6, 10).rotateX(Math.PI / 2);
const MISSILE_BAND_GEO = new THREE.CylinderGeometry(0.58, 0.58, 0.7, 10);
const MISSILE_TIP_GEO = new THREE.ConeGeometry(0.65, 1.7, 10);
const MISSILE_GLOW_GEO = new THREE.SphereGeometry(0.22, 8, 8);
const MISSILE_FLAME_GEO = new THREE.ConeGeometry(0.72, 3.6, 8).rotateX(-Math.PI / 2);
const MISSILE_TRAIL_GEO = new THREE.CylinderGeometry(0.04, 0.28, 6.5, 8, 1, true).rotateX(Math.PI / 2);
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
const MISSILE_TRAIL_MAT = new THREE.MeshBasicMaterial({
    color: 0x37efff,
    transparent: true,
    opacity: 0.58,
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
        nose.position.z = 7.5;
        laser.add(glow, edge, core, nose);
        laser.userData = { direction: new THREE.Vector3(), life: 0 };
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
            const trail = new THREE.Mesh(MISSILE_TRAIL_GEO, MISSILE_TRAIL_MAT);
            trail.position.set(0, 0, -5.2);
            missile.add(trail);

            missile.userData = { direction: new THREE.Vector3() };
        }

        missile.position.copy(position);
        missile.quaternion.copy(quaternion);
        missile.userData.direction.set(0, 0, 1).applyQuaternion(quaternion).normalize();
        this.scene.add(missile);
        this.missiles.push({ mesh: missile, speed: 620.0, life: 5.0 });
        this._spawnMuzzleFlash(position, missile.userData.direction);
    }

    update(deltaTime, enemyManager = null, onEnemyDestroyed = null, explosionManager = null) {
    if (!deltaTime) return;

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
                            scale: explosionSizeFor(enemyType),
                            flashColor: 0xd8ffff,
                            lightColor: 0x28cfff,
                            lightIntensity: 2600,
                            smokeColor: 0x123c58
                        });
                    } else {
                        explosionManager.create(hitPoint, {
                            kind: 'plasma',
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
}

// Método auxiliar para manter o código limpo
disposeMissile(mesh) {
    this.scene.remove(mesh);
    if (!this.missilePool.includes(mesh)) this.missilePool.push(mesh);
}
}