import * as THREE from 'three';

// CONFIGURAÇÃO DOS LASERS
const LASER_INTERNO_GEO = new THREE.BoxGeometry(0.5, 0.5, 14); 
const MAT_CIANO_INTERNO = new THREE.MeshBasicMaterial({ color: 0x00ffff, toneMapped: false });

// Recursos de míssil compartilhados por todas as instâncias (nunca descartados)
const MISSILE_BODY_GEO = new THREE.CylinderGeometry(0.55, 0.55, 5.6, 10).rotateX(Math.PI / 2);
const MISSILE_BAND_GEO = new THREE.CylinderGeometry(0.58, 0.58, 0.7, 10);
const MISSILE_TIP_GEO = new THREE.ConeGeometry(0.65, 1.7, 10);
const MISSILE_GLOW_GEO = new THREE.SphereGeometry(0.22, 8, 8);
const MISSILE_BODY_MAT = new THREE.MeshBasicMaterial({ color: 0x0f3d1f, toneMapped: false });
const MISSILE_BAND_MAT = new THREE.MeshBasicMaterial({ color: 0x39ff14, toneMapped: false });
const MISSILE_TIP_MAT = new THREE.MeshBasicMaterial({ color: 0x9dff57, toneMapped: false });
const MISSILE_GLOW_MAT = new THREE.MeshBasicMaterial({ color: 0x00ffa8, toneMapped: false });
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
    }

    fire(worldGunPos, direction) {
        if (this.lasers.length >= this.maxLasers) return;

        let laser = this.laserPool.pop();
        if (!laser) {
            laser = new THREE.Mesh(LASER_INTERNO_GEO, MAT_CIANO_INTERNO);
            laser.userData = { direction: new THREE.Vector3(), life: 0 };
        }
        laser.position.copy(worldGunPos);
        laser.lookAt(_aim.copy(worldGunPos).add(direction));
        laser.userData.direction.copy(direction).normalize();
        laser.userData.life = 1.8;

        this.scene.add(laser);
        this.lasers.push(laser);

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

            missile.userData = { direction: new THREE.Vector3() };
        }

        missile.position.copy(position);
        missile.quaternion.copy(quaternion);
        missile.userData.direction.set(0, 0, 1).applyQuaternion(quaternion).normalize();
        this.scene.add(missile);
        this.missiles.push({ mesh: missile, speed: 620.0, life: 5.0 });
    }

    update(deltaTime, enemyManager = null, onEnemyDestroyed = null, explosionManager = null) {
    if (!deltaTime) return;

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
                            flashColor: 0xd8ffb8,
                            lightColor: 0x66ff33,
                            lightIntensity: 2600,
                            smokeColor: 0x254b20
                        });
                    } else {
                        explosionManager.create(hitPoint, 0.6);
                    }
                }

                if (destroyed) {
                    const points = (enemyType === 'meteoro' || enemyType === 'asteroide') ? 500 : (enemyType === 'drone' ? 250 : (enemyType === 'roblox' ? 150 : 100));
                    if (onEnemyDestroyed) onEnemyDestroyed(points, hitPoint);
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
}}