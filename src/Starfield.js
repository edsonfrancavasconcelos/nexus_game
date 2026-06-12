import * as THREE from 'three';

export class Starfield {
    constructor(scene, count = 2000) {
        this.scene = scene;
        this.count = count;
        this.speed = 10; // Velocidade de deslocamento

        // Geometria única para todos os elementos
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.count * 3);
        this.velocities = new Float32Array(this.count);

        for (let i = 0; i < this.count; i++) {
            this.resetParticle(i, true); // true = espalhar no início
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

        // Material com partículas de tamanhos diferentes
        this.material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2,
            transparent: true,
            sizeAttenuation: true
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.points);
    }

    resetParticle(i, randomZ = false) {
        const i3 = i * 3;
        // Espalha em um cubo
        this.positions[i3] = (Math.random() - 0.5) * 2000;
        this.positions[i3 + 1] = (Math.random() - 0.5) * 2000;
        // Se randomZ, espalha no fundo, se não, coloca no limite do fundo
        this.positions[i3 + 2] = randomZ ? (Math.random() - 0.5) * 2000 : 1000;
        
        // Define velocidade individual para dar efeito de profundidade
        this.velocities[i] = Math.random() * 5 + 2;
    }

    update() {
        const pos = this.points.geometry.attributes.position.array;
        
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            // Move a partícula na direção da tela
            pos[i3 + 2] -= this.velocities[i] * this.speed;

            // Se passar da nave (z > 0), reseta lá atrás
            if (pos[i3 + 2] > 0) {
                this.resetParticle(i, false);
            }
        }
        
        this.points.geometry.attributes.position.needsUpdate = true;
    }
}