import * as THREE from 'three';

export class ExplosionManager {
    constructor(scene, soundManager, isMobile = false) {
        this.scene = scene;
        this.soundManager = soundManager;
        this.explosions = [];
        
        this.spriteColumns = 3;
        this.spriteRows = 4;
        this.totalFrames = this.spriteColumns * this.spriteRows;

        const textureLoader = new THREE.TextureLoader();
        this.explosionTexture = textureLoader.load('/assets/img/explosion.png');
        this.explosionTexture.repeat.set(1 / this.spriteColumns, 1 / this.spriteRows);
    }

create(position, multiplicador = 1.0) {
    if (this.soundManager) this.soundManager.play('explosion');

    const safePosition = position instanceof THREE.Vector3 ? position.clone() : new THREE.Vector3(0, 0, 0);
    if (typeof multiplicador === 'object') multiplicador = 1.0;

    // 1. Lógica do Fogo (Sprite Animado)
    const distancia = Math.abs(safePosition.z);
    // Adicionamos o multiplicador aqui na base da escala
    const escalaBase = 100 * multiplicador; 
    const fatorEscala = escalaBase * (100 / (distancia + 100)); 

    const mat = new THREE.SpriteMaterial({
        map: this.explosionTexture.clone(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(safePosition);
    sprite.scale.set(fatorEscala, fatorEscala, 1);
    
    this.scene.add(sprite);

        this.explosions.push({
            sprite: sprite,
            life: 1.6,
            maxLife: 1.6
        });

        // 2. DISPARAR OS ESTILHAÇOS (Corrigido: agora a função é chamada)
        this.createDebris(safePosition, 12); 
    }

    createBigExplosion(position) {
        const safePosition = position instanceof THREE.Vector3 ? position.clone() : new THREE.Vector3(0, 0, 0);
        this.create(safePosition, 3.2);
        this.createDebris(safePosition, 24);
    }

    createDebris(position, count = 10) {
        for (let i = 0; i < count; i++) {
            const geometry = new THREE.TetrahedronGeometry(Math.random() * 2 + 1);
            const material = new THREE.MeshStandardMaterial({ 
                color: 0x555555, 
                roughness: 0.8 
            });
            const debris = new THREE.Mesh(geometry, material);
            
            debris.position.copy(position);
            this.scene.add(debris);

            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 40
            );
            const rotationSpeed = new THREE.Vector3(
                Math.random() * 0.2, 
                Math.random() * 0.2, 
                Math.random() * 0.2
            );

            this.explosions.push({
                isDebris: true,
                mesh: debris,
                velocity: velocity,
                rotationSpeed: rotationSpeed,
                life: 2.0
            });
        }
    }

    update(deltaTime) {
        if (!deltaTime) return;

        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            
            // Lógica para Estilhaços
            if (exp.isDebris) {
                exp.life -= deltaTime;
                exp.velocity.y -= 0.5 * deltaTime; 
                exp.mesh.position.addScaledVector(exp.velocity, deltaTime);
                exp.mesh.rotation.x += exp.rotationSpeed.x;
                exp.mesh.rotation.y += exp.rotationSpeed.y;
                
                if (exp.life <= 0) {
                    this.scene.remove(exp.mesh);
                    exp.mesh.geometry.dispose();
                    exp.mesh.material.dispose();
                    this.explosions.splice(i, 1);
                }
                continue;
            }

            // Lógica para o Fogo
            exp.life -= deltaTime;

            if (exp.life <= 0) {
                this.scene.remove(exp.sprite);
                exp.sprite.material.map.dispose();
                exp.sprite.material.dispose();
                this.explosions.splice(i, 1);
                continue;
            }

            const progress = 1 - (exp.life / exp.maxLife);
            const currentFrame = Math.min(this.totalFrames - 1, Math.floor(progress * this.totalFrames));
            
            const col = currentFrame % this.spriteColumns;
            const row = Math.floor(currentFrame / this.spriteColumns);
            
            exp.sprite.material.map.offset.set(
                col / this.spriteColumns, 
                1 - (row + 1) / this.spriteRows
            );
        }
    }
}