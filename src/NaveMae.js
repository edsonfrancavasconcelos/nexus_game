import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class NaveMae {
    constructor(scene) {
        this.scene = scene;
        this.mesh = new THREE.Group();
        this.scene.add(this.mesh);
        
        this.hp = 1000;
        this.speed = 180;
        this.isAlive = true;
        
        this._loadModel();
    }

    _loadModel() {
        const loader = new GLTFLoader();
        loader.load('/assets/models/nave_mae.glb', (gltf) => {
            this.mesh = gltf.scene;
            this.mesh.position.set(0, 10, -8000);
            this.mesh.scale.set(80, 80, 80);
            this.mesh.rotation.y = Math.PI;
            this.scene.add(this.mesh);
        }, undefined, (error) => {
            console.error('Erro ao carregar Nave Mãe:', error);
        });
    }

    update(deltaTime, playerPosition) {
        if (!this.mesh || !this.isAlive) return;

        if (this.mesh.position.z < -300) {
            this.mesh.position.z += this.speed * deltaTime * 2;
        } else {
            this.mesh.position.x = Math.sin(Date.now() * 0.0008) * 250;
            this.mesh.position.z = -250;
        }
    }

    takeDamage(damage = 50) {
        this.hp -= damage;
        if (this.hp <= 0 && this.isAlive) {
            this.isAlive = false;
            console.log("💥 Nave Mãe destruída!");
        }
    }
}