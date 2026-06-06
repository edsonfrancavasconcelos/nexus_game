import * as THREE from 'three';

// Alterado para BoxGeometry: evita bugs de pivô rotacionado e melhora a detecção do Box3
const LASER_GEO = new THREE.BoxGeometry(0.8, 0.8, 14); 

export class LaserManager {
    constructor(scene, soundManager) {
        this.scene = scene;
        this.soundManager = soundManager; 
        this.lasers = [];
        this.laserSpeed = 850.0; // Velocidade ajustada para dinâmica do game
        this.matWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
    }

    fire(worldGunPos, direction) {
        const laser = new THREE.Mesh(LASER_GEO, this.matWhite);
        laser.position.copy(worldGunPos);
        
        // Garante o direcionamento correto olhando para a frente do vetor de tiro
        laser.lookAt(worldGunPos.clone().add(direction));

        laser.userData = { 
            direction: direction.clone().normalize(), // .normalize() garante que a velocidade seja constante
            life: 2.0 // Aumentado um pouco o tempo de vida para alcançar os inimigos distantes
        };
        
        this.scene.add(laser);
        this.lasers.push(laser);

        if (this.soundManager) {
            this.soundManager.play('laser');
        }
    }

    update(deltaTime) {
        if (!deltaTime) return;

        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const laser = this.lasers[i];
            
            // Movimentação precisa baseada no delta
            laser.position.addScaledVector(laser.userData.direction, this.laserSpeed * deltaTime);
            laser.userData.life -= deltaTime;

            // Força a atualização da matriz antes que o EnemyManager leia a posição neste frame
            laser.updateMatrixWorld();

            // Remove se o tempo de vida acabar
            if (laser.userData.life <= 0) {
                this.scene.remove(laser);
                this.lasers.splice(i, 1);
            }
        }
    }
}