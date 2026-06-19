import * as THREE from 'three';

// CONFIGURAÇÃO DOS LASERS
const LASER_INTERNO_GEO = new THREE.BoxGeometry(0.5, 0.5, 14); 
const LASER_EXTERNO_GEO = new THREE.BoxGeometry(1.3, 1.3, 14.2); 
const MAT_CIANO_INTERNO = new THREE.MeshBasicMaterial({ color: 0x00ffff, toneMapped: false });
const MAT_ESCARLATE_EXTERNO = new THREE.MeshBasicMaterial({ 
    color: 0xff1133, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, toneMapped: false 
});

export class LaserManager {
    constructor(scene, soundManager) {
        this.scene = scene;
        this.soundManager = soundManager; 
        this.lasers = [];
        this.missiles = [];
        this.laserSpeed = 850.0;
    }

    fire(worldGunPos, direction) {
        const laserGroup = new THREE.Group();
        const meshInterno = new THREE.Mesh(LASER_INTERNO_GEO, MAT_CIANO_INTERNO);
        const meshExterno = new THREE.Mesh(LASER_EXTERNO_GEO, MAT_ESCARLATE_EXTERNO);
        
        laserGroup.add(meshInterno);
        laserGroup.add(meshExterno);
        laserGroup.position.copy(worldGunPos);
        laserGroup.lookAt(worldGunPos.clone().add(direction));

        laserGroup.userData = { direction: direction.clone().normalize(), life: 2.0 };
        
        this.scene.add(laserGroup);
        this.lasers.push(laserGroup);

        if (this.soundManager) this.soundManager.play('laser');
    }

    createMissile(position, quaternion) {
        const bodyGeometry = new THREE.CylinderGeometry(0.55, 0.55, 5.6, 10);
        bodyGeometry.rotateX(Math.PI / 2);
        const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x0f3d1f, toneMapped: false });

        const missile = new THREE.Mesh(bodyGeometry, bodyMaterial);

        const band = new THREE.Mesh(
            new THREE.CylinderGeometry(0.58, 0.58, 0.7, 10),
            new THREE.MeshBasicMaterial({ color: 0x39ff14, toneMapped: false })
        );
        missile.add(band);

        const tip = new THREE.Mesh(
            new THREE.ConeGeometry(0.65, 1.7, 10),
            new THREE.MeshBasicMaterial({ color: 0x9dff57, toneMapped: false })
        );
        tip.rotation.x = Math.PI / 2;
        tip.position.set(0, 0, 3.15);
        missile.add(tip);

        const rearGlow = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 10, 10),
            new THREE.MeshBasicMaterial({ color: 0x00ffa8, toneMapped: false })
        );
        rearGlow.position.set(0, 0, -2.8);
        missile.add(rearGlow);

        const missileLight = new THREE.PointLight(0x66ff33, 3.5, 30);
        missileLight.position.set(0, 0, 0);
        missile.add(missileLight);

        missile.position.copy(position);
        missile.quaternion.copy(quaternion);       
        missile.scale.set(1, 1, 1); // Garanta escala 1        
        missile.userData = {
            direction: new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).normalize()
        };
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
            laser.traverse(child => { if (child.geometry) child.geometry.dispose(); });
            this.lasers.splice(i, 1);
        }
    }

    // Atualizar Mísseis
   for (let i = this.missiles.length - 1; i >= 0; i--) {
    const m = this.missiles[i];  
    const forward = m.mesh.userData?.direction || new THREE.Vector3(0, 0, 1).applyQuaternion(m.mesh.quaternion).normalize();

    m.mesh.position.addScaledVector(forward, m.speed * deltaTime);

    let hitEnemy = false;
    if (enemyManager?.enemies?.length) {
        for (let j = enemyManager.enemies.length - 1; j >= 0; j--) {
            const enemy = enemyManager.enemies[j];
            if (!enemy) continue;

            const enemyType = enemy.userData?.type;
            const hitRadius = (enemyType === 'meteoro' || enemyType === 'asteroide') ? 90 : 55;
            if (m.mesh.position.distanceTo(enemy.position) <= hitRadius) {
                const hitPoint = m.mesh.position.clone();
                const destroyed = enemyManager.damageEnemy
                    ? enemyManager.damageEnemy(enemy, 35, hitPoint)
                    : true;

                if (destroyed) {
                    const points = (enemyType === 'meteoro' || enemyType === 'asteroide') ? 500 : (enemyType === 'drone' ? 250 : (enemyType === 'roblox' ? 150 : 100));
                    if (explosionManager) explosionManager.create(hitPoint, {
                        kind: 'missile',
                        flashColor: 0xd8ffb8,
                        lightColor: 0x66ff33,
                        lightIntensity: 2600,
                        smokeColor: 0x254b20
                    });
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
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
        Array.isArray(mesh.material) 
            ? mesh.material.forEach(mat => mat.dispose()) 
            : mesh.material.dispose();
    }
    // Remove filhos (como a faixa preta) para limpar memória
    mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
    });
}}