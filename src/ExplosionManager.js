import * as THREE from 'three';

export class ExplosionManager {
    constructor(scene, soundManager, isMobile = false) {
        this.scene = scene;
        this.soundManager = soundManager;
        this.isMobile = isMobile;
        this.explosions = [];
        this.maxActiveExplosions = isMobile ? 16 : 28;

        this.spriteColumns = 3;
        this.spriteRows = 4;
        this.totalFrames = this.spriteColumns * this.spriteRows;

        const textureLoader = new THREE.TextureLoader();
        this.explosionTexture = textureLoader.load('/assets/img/explosion.png');
        this.explosionTexture.wrapS = THREE.RepeatWrapping;
        this.explosionTexture.wrapT = THREE.RepeatWrapping;
        this.explosionTexture.repeat.set(1 / this.spriteColumns, 1 / this.spriteRows);

        this.spritePool = [];
        this.debrisPool = [];
        this.debrisGeometry = new THREE.TetrahedronGeometry(1);
        this.debrisMaterial = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.88, metalness: 0.12 });
        this._dir = new THREE.Vector3();
    }

    _acquireSprite() {
        let sprite = this.spritePool.pop();
        if (!sprite) {
            // clone() compartilha a mesma imagem/upload de GPU; só o offset UV é por sprite
            const map = this.explosionTexture.clone();
            map.repeat.copy(this.explosionTexture.repeat);
            const mat = new THREE.SpriteMaterial({
                map,
                transparent: true,
                opacity: 0.7,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            sprite = new THREE.Sprite(mat);
            sprite.frustumCulled = true;
        }
        return sprite;
    }

    _acquireDebris() {
        let mesh = this.debrisPool.pop();
        if (!mesh) mesh = new THREE.Mesh(this.debrisGeometry, this.debrisMaterial);
        return mesh;
    }

    create(position, multiplicador = 1.0) {
        if (this.explosions.length > this.maxActiveExplosions) return;
        if (this.soundManager) this.soundManager.play('explosion');

        const safePosition = position instanceof THREE.Vector3 ? position.clone() : new THREE.Vector3(0, 0, 0);
        if (typeof multiplicador === 'object') multiplicador = 1.0;

        const distancia = Math.abs(safePosition.z);
        const escalaBase = this.isMobile ? 18 : 28;
        const fatorEscala = (escalaBase * multiplicador) * (80 / (distancia + 100));

        const sprite = this._acquireSprite();
        sprite.material.map.offset.set(0, 1 - 1 / this.spriteRows);
        sprite.position.copy(safePosition);
        sprite.scale.set(fatorEscala, fatorEscala, 1);
        this.scene.add(sprite);

        this.explosions.push({
            sprite: sprite,
            life: 0.55,
            maxLife: 0.55
        });

        this.createDebris(safePosition, this.isMobile ? 2 : 4);
    }

    createBigExplosion(position) {
        const safePosition = position instanceof THREE.Vector3 ? position.clone() : new THREE.Vector3(0, 0, 0);
        this.create(safePosition, this.isMobile ? 1.0 : 1.3);
        this.createDebris(safePosition, this.isMobile ? 4 : 6);
    }

    createDebris(position, count = 5) {
        const safeCount = Math.min(count, this.isMobile ? 3 : count);
        for (let i = 0; i < safeCount; i++) {
            const debris = this._acquireDebris();
            debris.position.copy(position);
            debris.rotation.set(0, 0, 0);
            debris.scale.setScalar(Math.random() * 1 + 0.5);
            this.scene.add(debris);

            const direction = this._dir.set(
                (Math.random() - 0.5) * 2,
                Math.random() * 1.2 + 0.4,
                (Math.random() - 0.5) * 2
            ).normalize();
            const strength = this.isMobile ? 9 + Math.random() * 6 : 18 + Math.random() * 12;
            const velocity = direction.clone().multiplyScalar(strength);
            const rotationSpeed = new THREE.Vector3(
                Math.random() * 0.05,
                Math.random() * 0.05,
                Math.random() * 0.05
            );

            this.explosions.push({
                isDebris: true,
                mesh: debris,
                velocity: velocity,
                rotationSpeed: rotationSpeed,
                life: this.isMobile ? 0.7 : 1.05
            });
        }
    }

    update(deltaTime) {
        if (!deltaTime) return;

        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];

            if (exp.isDebris) {
                exp.life -= deltaTime;
                exp.velocity.y -= 0.5 * deltaTime;
                exp.mesh.position.addScaledVector(exp.velocity, deltaTime);
                exp.mesh.rotation.x += exp.rotationSpeed.x;
                exp.mesh.rotation.y += exp.rotationSpeed.y;
                exp.mesh.rotation.z += exp.rotationSpeed.z;

                if (exp.life <= 0 || exp.mesh.position.length() > 4500) {
                    this.scene.remove(exp.mesh);
                    this.debrisPool.push(exp.mesh);
                    this.explosions.splice(i, 1);
                }
                continue;
            }

            exp.life -= deltaTime;

            if (exp.life <= 0) {
                this.scene.remove(exp.sprite);
                this.spritePool.push(exp.sprite);
                this.explosions.splice(i, 1);
                continue;
            }

            const progress = 1 - (exp.life / exp.maxLife);
            const currentFrame = Math.min(this.totalFrames - 1, Math.floor(progress * this.totalFrames));
            const col = currentFrame % this.spriteColumns;
            const row = Math.floor(currentFrame / this.spriteColumns);

            const texture = exp.sprite.material.map;
            texture.offset.set(col / this.spriteColumns, 1 - (row + 1) / this.spriteRows);
        }
    }
}
