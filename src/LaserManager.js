import * as THREE from 'three';

// CONFIGURAÇÃO DO LASER DO JOGADOR (Mais largo e robusto)
// Caixa interna (Centro do laser)
const LASER_INTERNO_GEO = new THREE.BoxGeometry(0.5, 0.5, 14); 
// Caixa externa (Borda/Aura - Mais larga: de 0.8 foi para 1.3)
const LASER_EXTERNO_GEO = new THREE.BoxGeometry(1.3, 1.3, 14.2); 

// Material do Meio: Ciano Brilhante
const MAT_CIANO_INTERNO = new THREE.MeshBasicMaterial({ 
    color: 0x00ffff, 
    toneMapped: false 
});

// Material da Borda: Vermelho Escarlate com efeito de brilho Neon
const MAT_ESCARLATE_EXTERNO = new THREE.MeshBasicMaterial({ 
    color: 0xff1133, 
    transparent: true,
    opacity: 0.6,                       // Suavidade na borda para parecer luz
    blending: THREE.AdditiveBlending,   // Faz o laser brilhar intensamente no espaço
    toneMapped: false 
});

export class LaserManager {
    constructor(scene, soundManager) {
        this.scene = scene;
        this.soundManager = soundManager; 
        this.lasers = [];
        this.laserSpeed = 850.0; // Velocidade ajustada para dinâmica do game
    }

    fire(worldGunPos, direction) {
        // Criamos um grupo para juntar o meio ciano e a borda escarlate em um único objeto
        const laserGroup = new THREE.Group();
        
        const meshInterno = new THREE.Mesh(LASER_INTERNO_GEO, MAT_CIANO_INTERNO);
        const meshExterno = new THREE.Mesh(LASER_EXTERNO_GEO, MAT_ESCARLATE_EXTERNO);
        
        laserGroup.add(meshInterno);
        laserGroup.add(meshExterno);

        // Define a posição inicial no bico/asa da nave do jogador
        laserGroup.position.copy(worldGunPos);
        
        // Garante o direcionamento correto olhando para a frente do vetor de tiro
        laserGroup.lookAt(worldGunPos.clone().add(direction));

        laserGroup.userData = { 
            direction: direction.clone().normalize(), // .normalize() garante que a velocidade seja constante
            life: 2.0 // Aumentado um pouco o tempo de vida para alcançar os inimigos distantes
        };
        
        this.scene.add(laserGroup);
        this.lasers.push(laserGroup);

        if (this.soundManager) {
            this.soundManager.play('laser');
        }
    }

    update(deltaTime) {
        if (!deltaTime) return;

        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const laser = this.lasers[i];
            
            // Movimentação precisa baseada no delta (move o grupo inteiro)
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
