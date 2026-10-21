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

        this.glowTexture = this._makeGlowTexture();
        this.ringTexture = this._makeRingTexture();
        this.fxSpritePool = [];

        // Faíscas: um único InstancedMesh de riscos alongados, compactado a cada frame.
        this.maxSparks = isMobile ? 70 : 170;
        this.sparks = [];
        this.sparkPool = [];
        for (let i = 0; i < this.maxSparks; i++) {
            this.sparkPool.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, maxLife: 1, len: 1, thick: 1, r: 1, g: 1, b: 1 });
        }
        const sparkGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 1, true);
        sparkGeo.rotateX(Math.PI / 2);
        this.sparkMesh = new THREE.InstancedMesh(
            sparkGeo,
            new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
            this.maxSparks
        );
        this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.sparkMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.maxSparks * 3), 3);
        this.sparkMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        this.sparkMesh.frustumCulled = false;
        this.sparkMesh.count = 0;
        this.scene.add(this.sparkMesh);
        this._dummy = new THREE.Object3D();
        this._color = new THREE.Color();
        this._zAxis = new THREE.Vector3(0, 0, 1);
    }

    _makeGlowTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.25, 'rgba(255,240,170,0.9)');
        grad.addColorStop(0.6, 'rgba(255,140,40,0.35)');
        grad.addColorStop(1, 'rgba(255,60,0,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
    }

    _makeRingTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255,160,60,0)');
        grad.addColorStop(0.72, 'rgba(255,170,70,0)');
        grad.addColorStop(0.88, 'rgba(255,225,160,0.95)');
        grad.addColorStop(0.95, 'rgba(255,120,40,0.35)');
        grad.addColorStop(1, 'rgba(255,80,0,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(c);
    }

    _acquireFxSprite(texture) {
        let sprite = this.fxSpritePool.pop();
        if (!sprite) {
            sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            }));
        }
        sprite.material.map = texture;
        sprite.material.needsUpdate = true;
        return sprite;
    }

    _spawnSparks(position, count, speed, size) {
        const tint = this._sparkTint || (this._sparkTint = new THREE.Color());
        tint.setHex(this._sparkColor ?? 0xffa52f);
        for (let i = 0; i < count; i++) {
            const sp = this.sparkPool.pop();
            if (!sp) return;
            sp.pos.copy(position);
            sp.vel.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
                .multiplyScalar(speed * (0.5 + Math.random() * 0.9));
            sp.maxLife = sp.life = 0.3 + Math.random() * 0.35;
            sp.len = size * (0.6 + Math.random() * 0.9);
            sp.thick = size * 0.045;
            sp.r = tint.r;
            sp.g = tint.g;
            sp.b = tint.b;
            this.sparks.push(sp);
        }
    }

    _updateSparks(dt) {
        const mesh = this.sparkMesh;
        const d = this._dummy;
        let n = 0;
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const sp = this.sparks[i];
            sp.life -= dt;
            if (sp.life <= 0) {
                this.sparks.splice(i, 1);
                this.sparkPool.push(sp);
                continue;
            }
            sp.pos.addScaledVector(sp.vel, dt);
            sp.vel.multiplyScalar(1 - Math.min(1, dt * 2.2));
        }
        for (let i = 0; i < this.sparks.length; i++) {
            const sp = this.sparks[i];
            const t = sp.life / sp.maxLife;
            const speed = Math.max(sp.vel.length(), 0.001);
            d.position.copy(sp.pos);
            d.quaternion.setFromUnitVectors(this._zAxis, this._dir.copy(sp.vel).divideScalar(speed));
            d.scale.set(sp.thick, sp.thick, sp.len * (0.4 + 0.6 * t));
            d.updateMatrix();
            mesh.setMatrixAt(n, d.matrix);
            mesh.setColorAt(n, this._color.setRGB(sp.r * t, sp.g * t, sp.b * t));
            n++;
        }
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
        mesh.visible = n > 0;
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

    // multiplicador: número (tamanho relativo) ou { kind: 'missile' | 'boss' }.
    // Acertos leves (<= 0.75) usam só o núcleo; mortes ganham flash, onda e faíscas.
    create(position, multiplicador = 1.0) {
        let visualOptions = null;
        let kindBoost = 1.0;
        if (multiplicador && typeof multiplicador === 'object') {
            visualOptions = multiplicador;
            kindBoost = (multiplicador.kind === 'boss' ? 2.4 : multiplicador.kind === 'missile' ? 1.35 : 1.0) * (multiplicador.scale ?? 1);
            multiplicador = 1.0;
        }
        multiplicador *= kindBoost;

        const isHit = multiplicador <= 0.75;
        if (this.explosions.length > this.maxActiveExplosions) return;
        if (this.soundManager) this.soundManager.play('explosion');

        const safePosition = position instanceof THREE.Vector3 ? position.clone() : new THREE.Vector3(0, 0, 0);

        // Tamanho em unidades de mundo proporcional à distância da câmera, para a explosão
        // continuar visível (inclusive em telas pequenas) tanto de perto quanto de longe.
        const distCam = this.camera ? this.camera.position.distanceTo(safePosition) : Math.abs(safePosition.z) + 75;
        const escalaBase = Math.min(160, Math.max(40, distCam * 0.085)) * (this.isMobile ? 0.9 : 1);
        const size = Math.min(escalaBase * multiplicador, 420);

        const sprite = this._acquireSprite();
        sprite.material.map.offset.set(0, 1 - 1 / this.spriteRows);
        sprite.material.color.setHex(visualOptions?.kind === 'plasma' ? (visualOptions.flashColor ?? 0x70dfff) : 0xffffff);
        sprite.material.opacity = 1;
        sprite.position.copy(safePosition);
        sprite.scale.set(size * 0.6, size * 0.6, 1);
        this.scene.add(sprite);

        const exp = { sprite, life: 0.7, maxLife: 0.7, size, flash: null, ring: null };

        if (!isHit) {
            this._sparkColor = visualOptions?.kind === 'plasma' ? (visualOptions.lightColor ?? 0x24cfff) : 0xffa52f;
            const flash = this._acquireFxSprite(this.glowTexture);
            flash.position.copy(safePosition);
            flash.scale.set(size * 0.5, size * 0.5, 1);
            flash.material.color.setHex(visualOptions?.kind === 'plasma' ? (visualOptions.lightColor ?? 0x24cfff) : 0xffffff);
            flash.material.opacity = 1;
            this.scene.add(flash);
            exp.flash = flash;

            const ring = this._acquireFxSprite(this.ringTexture);
            ring.position.copy(safePosition);
            ring.scale.set(size * 0.3, size * 0.3, 1);
            ring.material.color.setHex(visualOptions?.kind === 'plasma' ? (visualOptions.flashColor ?? 0x70dfff) : 0xffffff);
            ring.material.opacity = 0.9;
            this.scene.add(ring);
            exp.ring = ring;

            const sparkCount = Math.min(Math.round((this.isMobile ? 8 : 14) * Math.min(multiplicador, 2.5)), this.isMobile ? 18 : 40);
            this._spawnSparks(safePosition, sparkCount, size * 5.5, Math.max(size * 0.28, 2));
        } else {
            this._sparkColor = visualOptions?.kind === 'plasma' ? (visualOptions.lightColor ?? 0x24cfff) : 0xffa52f;
            this._spawnSparks(safePosition, this.isMobile ? 3 : 5, size * 4, Math.max(size * 0.22, 1.5));
        }

        this.explosions.push(exp);
        this.createDebris(safePosition, isHit ? 1 : (this.isMobile ? 2 : 4));
    }

    createBigExplosion(position) {
        const safePosition = position instanceof THREE.Vector3 ? position.clone() : new THREE.Vector3(0, 0, 0);
        this.create(safePosition, this.isMobile ? 1.8 : 2.2);
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
                for (const fx of [exp.flash, exp.ring]) {
                    if (fx) {
                        this.scene.remove(fx);
                        this.fxSpritePool.push(fx);
                    }
                }
                this.explosions.splice(i, 1);
                continue;
            }

            const progress = 1 - (exp.life / exp.maxLife);
            const grow = 0.6 + 0.65 * (1 - Math.pow(1 - Math.min(1, progress * 1.6), 3));
            exp.sprite.scale.set(exp.size * grow, exp.size * grow, 1);
            exp.sprite.material.opacity = progress < 0.6 ? 1 : Math.max(0, 1 - (progress - 0.6) / 0.4);

            if (exp.flash) {
                const t = Math.min(1, progress / 0.25);
                const s = exp.size * (0.5 + 1.1 * t);
                exp.flash.scale.set(s, s, 1);
                exp.flash.material.opacity = Math.max(0, 1 - t);
                if (t >= 1 && exp.flash.parent) this.scene.remove(exp.flash);
            }
            if (exp.ring) {
                const t = Math.min(1, progress / 0.55);
                const s = exp.size * (0.3 + 2.0 * (1 - Math.pow(1 - t, 2)));
                exp.ring.scale.set(s, s, 1);
                exp.ring.material.opacity = 0.9 * (1 - t);
                if (t >= 1 && exp.ring.parent) this.scene.remove(exp.ring);
            }

            const currentFrame = Math.min(this.totalFrames - 1, Math.floor(progress * this.totalFrames));
            const col = currentFrame % this.spriteColumns;
            const row = Math.floor(currentFrame / this.spriteColumns);

            const texture = exp.sprite.material.map;
            texture.offset.set(col / this.spriteColumns, 1 - (row + 1) / this.spriteRows);
        }

        this._updateSparks(deltaTime);
    }
}
