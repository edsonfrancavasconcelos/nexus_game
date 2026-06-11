import * as THREE from 'three';

export class PickupManager {
    constructor(scene) {
        this.scene = scene;
        this.pickups = [];
    }

    spawnPickup(position) {
        // Criando um cubo simples giratório como item (você pode carregar um GLTF depois)
        const geo = new THREE.BoxGeometry(20, 20, 20);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
        const mesh = new THREE.Mesh(geo, mat);
        
        mesh.position.copy(position);
        this.scene.add(mesh);
        
        this.pickups.push({ mesh, type: 'PDC_REPAIR', life: 10 }); // 10 segundos de vida
    }

    update(deltaTime, player) {
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];
            p.mesh.rotation.x += 0.05;
            p.mesh.rotation.y += 0.05;
            p.life -= deltaTime;

            // Colisão com o jogador
            if (p.mesh.position.distanceTo(player.mesh.position) < 50) {
                this._applyEffect(p.type, player);
                this._remove(i);
            } else if (p.life <= 0) {
                this._remove(i);
            }
        }
    }

    _applyEffect(type, player) {
        if (type === 'PDC_REPAIR') {
            console.log("🛠️ PDC REPARADO!");
            player.repairPDC(); // Vamos criar esse método no Player
        }
    }

    _remove(index) {
        const p = this.pickups[index];
        this.scene.remove(p.mesh);
        this.pickups.splice(index, 1);
    }
}