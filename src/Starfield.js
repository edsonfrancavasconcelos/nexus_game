import * as THREE from 'three';

export class Starfield {
    constructor(scene, starCount = 3000) {
        this.scene = scene;
        this.starCount = starCount;
        
        // Criamos uma geometria para pontos
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.starCount * 3);

        // Espalhamos as estrelas em um cubo gigante de 4000 unidades
        for (let i = 0; i < this.starCount * 3; i++) {
            positions[i] = (Math.random() - 0.5) * 4000;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        // Material simples e leve (pontos brancos)
        const material = new THREE.PointsMaterial({ 
            color: 0xffffff, 
            size: 1.5, 
            transparent: true, 
            opacity: 0.8,
            sizeAttenuation: true 
        });

        this.stars = new THREE.Points(geometry, material);
        this.scene.add(this.stars);
    }

    // O update faz as estrelas seguirem a câmera para parecerem infinitas
    update(cameraPosition) {
        this.stars.position.copy(cameraPosition);
    }
}