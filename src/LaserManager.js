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
        const geometry = new THREE.CylinderGeometry(0.3, 0.3, 4, 8);
   const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        
        const missile = new THREE.Mesh(geometry, material);
        
        const band = new THREE.Mesh(
            new THREE.CylinderGeometry(0.32, 0.32, 0.5, 8),
            new THREE.MeshBasicMaterial({ color: 0x000000 })
        );
        missile.add(band);

        missile.position.copy(position);
        missile.quaternion.copy(quaternion);       
        missile.scale.set(1, 1, 1); // Garanta escala 1        
        this.scene.add(missile);

        console.log("DEBUG [LM]: Míssil adicionado à cena na posição:", position.x, position.y, position.z);
    console.log("DEBUG [LM]: Total de mísseis no array:", this.missiles.length)
        this.missiles.push({ mesh: missile, speed: 600.0, life: 5.0 });
    }

    update(deltaTime) {
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
    const forward = new THREE.Vector3(0, 0, -1); 
    forward.applyQuaternion(m.mesh.quaternion);
    
    // Move o míssil
    m.mesh.position.addScaledVector(forward, m.speed * deltaTime);
        
        m.life -= deltaTime;

        if (m.life <= 0) {
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