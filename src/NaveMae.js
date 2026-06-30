import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class NaveMae {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.hp = 2500;
        this.isAlive = true;
        this.speed = 32;
        this.isApproaching = true;
        
        this._loadModel();
    }

    _loadModel() {
        const loader = new GLTFLoader();
        
        // Caminho correto para o seu projeto
      loader.load('/assets/models/nave_mae/scene.gltf', (gltf) => {
            this.mesh = gltf.scene;
            
            this.mesh.position.set(0, 25, -14000);   // bem longe no fundo
            this.mesh.scale.set(85, 85, 85);
            this.mesh.rotation.y = Math.PI;
            
            this.scene.add(this.mesh);
            console.log("✅ Nave Mãe carregada com sucesso!");
        }, undefined, (error) => {
            console.error('❌ Erro ao carregar nave_mae.glb:', error);
        });
    }

    update(deltaTime) {
        if (!this.mesh || !this.isAlive) return;

        if (this.isApproaching) {
            this.mesh.position.z += this.speed * deltaTime;
            if (this.mesh.position.z >= -900) {
                this.isApproaching = false;
                this.mesh.position.z = -900;
            }
        } else {
            this.mesh.position.x = Math.sin(Date.now() * 0.0007) * 220;
        }
    }

    takeDamage(damage = 60, hitPoint = null) {
        if (!this.mesh || !this.isAlive) return;
        this.hp -= damage;

        // Efeito de dano (destruir partes)
        this.mesh.traverse((child) => {
            if (child.isMesh && Math.random() < 0.25) {
                if (Math.random() < 0.5) child.visible = false;
                else child.scale.setScalar(0.5);
            }
        });

        if (hitPoint && window.explosionManager) {
            window.explosionManager.create(hitPoint);
        }

        if (this.hp <= 0) {
            this.destroy();
        }
    }

    destroy() {
        this.isAlive = false;
        if (window.explosionManager) {
            window.explosionManager.createBigExplosion(this.mesh.position);
        }
        this.mesh.visible = false;
        console.log("💥 Nave Mãe destruída!");
    }
}