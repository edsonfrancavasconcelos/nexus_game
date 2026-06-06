import * as THREE from 'three';

const GEO = {
    debris: new THREE.IcosahedronGeometry(3, 1), // Reduzido o raio base de 6 para 3
    smoke: new THREE.SphereGeometry(5, 8, 8)    // Reduzido o raio base de 10 para 5 e simplificado segmentos
};

export class ExplosionManager {
    constructor(scene, soundManager) {
        this.scene = scene;
        this.soundManager = soundManager;
        this.explosions = [];
    }

    create(position) {
        if (this.soundManager) {
            this.soundManager.play('explosion');
        }

        const group = new THREE.Group();
        group.position.copy(position);
        this.scene.add(group);

        // --- FILTRO DE PROXIMIDADE ---
        // Se a explosão acontecer muito perto da câmera/player (Z maior que -50), suaviza o visual
        const proximoAoJogador = position.z > -50;
        const modificadorEscala = proximoAoJogador ? 0.35 : 1.0;

        const flashGeo = new THREE.SphereGeometry(12 * modificadorEscala, 12, 12);
        const flash = new THREE.Mesh(
            flashGeo,
            new THREE.MeshBasicMaterial({
                color: 0xfff0dd,
                transparent: true,
                opacity: proximoAoJogador ? 0.4 : 0.9,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        group.add(flash);

        const fragments = [];

        const addPart = (geo, color, isSmoke, count) => {
            // Se estiver colado na cara do jogador, diminui a contagem de fumaça e detritos para não cegar
            const contagemFinal = proximoAoJogador ? Math.ceil(count * 0.4) : count;

            for (let i = 0; i < contagemFinal; i++) {
                const mat = new THREE.MeshBasicMaterial({
                    color,
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });

                const mesh = new THREE.Mesh(geo, mat);

                // Aplica o modificador de escala global do filtro de proximidade
                const s = isSmoke
                    ? (14 + Math.random() * 10) * modificadorEscala
                    : (5 + Math.random() * 8) * modificadorEscala;

                mesh.scale.set(s, s, s);
                group.add(mesh);

                fragments.push({
                    mesh,
                    isSmoke,
                    velocity: new THREE.Vector3(
                        (Math.random() - 0.5) * 25,
                        (Math.random() - 0.5) * 25,
                        (Math.random() - 0.5) * 25
                    ),
                    initialScale: s
                });
            }
        };

        // Otimização das frações de partículas para evitar superposição excessiva
        addPart(GEO.debris, 0xffffff, false, 5);
        addPart(GEO.debris, 0xffff00, false, 8);
        addPart(GEO.debris, 0xff8800, false, 10);
        addPart(GEO.debris, 0xff2200, false, 8);
        addPart(GEO.debris, 0xffdd66, false, 12);
        addPart(GEO.smoke, 0x222222, true, proximoAoJogador ? 4 : 10);

        const mainLight = new THREE.PointLight(
            0xffaa33,
            proximoAoJogador ? 300 : 1500,
            150
        );
        group.add(mainLight);

        this.explosions.push({
            group,
            flash,
            mainLight,
            fragments,
            life: 1.2, // Reduzido o tempo de vida de 2.5 para 1.2 segundos (explosão mais rápida e limpa)
            flashGeo // Guardado para descarte de memória correto
        });
    }

    update(deltaTime) {
        if (!deltaTime) return;

        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            exp.life -= deltaTime;

            // Suavização da luz
            exp.mainLight.intensity = exp.life > 0.5 ? 800 : exp.life * 1600;

            for (const frag of exp.fragments) {
                if (frag.isSmoke) {
                    frag.velocity.multiplyScalar(0.94);
                } else {
                    frag.velocity.multiplyScalar(0.90);
                }

                frag.mesh.position.addScaledVector(frag.velocity, deltaTime * 50);

                if (frag.isSmoke) {
                    frag.mesh.scale.setScalar(
                        frag.initialScale * (1 + (1.2 - exp.life) * 2)
                    );
                    frag.mesh.material.opacity = Math.max(0, exp.life * 0.35);
                } else {
                    frag.mesh.rotation.x += deltaTime * 10;
                    frag.mesh.rotation.y += deltaTime * 10;

                    frag.mesh.material.opacity = Math.max(0, exp.life);
                    frag.mesh.scale.setScalar(
                        frag.initialScale * Math.max(0, exp.life)
                    );
                }
            }

            if (exp.flash) {
                exp.flash.material.opacity = Math.max(0, exp.life * 0.6);
                exp.flash.scale.multiplyScalar(1.04);
            }

            if (exp.life <= 0) {
                this.scene.remove(exp.group);

                // Limpeza correta apenas de materiais e geometrias dinâmicas locais
                if (exp.flashGeo) exp.flashGeo.dispose();
                if (exp.flash && exp.flash.material) exp.flash.material.dispose();

                exp.fragments.forEach(f => {
                    if (f.mesh.material) f.mesh.material.dispose();
                    // Não damos dispose no GEO global para evitar quebrar as próximas explosões
                });

                this.explosions.splice(i, 1);
            }
        }
    }
}