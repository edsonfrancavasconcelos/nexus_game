import * as THREE from 'three';

const GEO = {
    debris: new THREE.IcosahedronGeometry(3, 1), // Reduzido o raio base de 6 para 3
    smoke: new THREE.SphereGeometry(5, 8, 8),    // Reduzido o raio base de 10 para 5 e simplificado segmentos
    // 🛠️ NOVA GEOMETRIA PARA METAIS: Um cone de 3 lados gera estilhaços triangulares pontiagudos e totalmente assimétricos
    shard: new THREE.ConeGeometry(2, 6, 3)
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

        const addPart = (geo, color, isSmoke, count, isMetallicDebris = false) => {
            // Se estiver colado na cara do jogador, diminui a contagem de fumaça e detritos para não cegar
            const contagemFinal = proximoAoJogador ? Math.ceil(count * 0.4) : count;

            for (let i = 0; i < contagemFinal; i++) {
                // Destroços metálicos usam NormalBlending para parecerem pedaços sólidos e não luz brilhante
                const mat = new THREE.MeshBasicMaterial({
                    color,
                    transparent: true,
                    blending: isMetallicDebris ? THREE.NormalBlending : THREE.AdditiveBlending,
                    depthWrite: false
                });

                const mesh = new THREE.Mesh(geo, mat);

                // Aplica o modificador de escala global do filtro de proximidade
                let s = isSmoke
                    ? (14 + Math.random() * 10) * modificadorEscala
                    : (5 + Math.random() * 8) * modificadorEscala;

                // Destroços metálicos variam mais de tamanho (estilhaços pequenos e pedaços maiores)
                if (isMetallicDebris) {
                    s = (1 + Math.random() * 5) * modificadorEscala;
                    // Rotação inicial aleatória para os estilhaços de metal
                    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                    
                    // 🛠️ ESCALA NÃO-UNIFORME: Achata e estica os eixos de forma independente para deformar o triângulo,
                    // transformando o cone regular em pedaços retorcidos, finos, compridos ou lascas metálicas brutas.
                    mesh.scale.set(
                        s * (0.3 + Math.random() * 1.2),
                        s * (0.3 + Math.random() * 1.5),
                        s * (0.2 + Math.random() * 0.8)
                    );
                } else {
                    mesh.scale.set(s, s, s);
                }

                group.add(mesh);

                // 🛠️ EFEITO SAIR DA TELA: Força o eixo Z a ser predominantemente positivo para os metais virem para frente
                const zVelocity = isMetallicDebris 
                    ? (Math.random() * 35 + 20)  // Metais ganham um empurrão forte para frente (Z positivo)
                    : (Math.random() - 0.5) * 25;

                fragments.push({
                    mesh,
                    isSmoke,
                    isMetallicDebris, // Marcação para a física e rotação no update
                    velocity: new THREE.Vector3(
                        (Math.random() - 0.5) * (isMetallicDebris ? 55 : 25), 
                        (Math.random() - 0.5) * (isMetallicDebris ? 55 : 25),
                        zVelocity
                    ),
                    initialScaleX: mesh.scale.x, // Armazena as escalas individuais deformadas para o efeito do update
                    initialScaleY: mesh.scale.y,
                    initialScaleZ: mesh.scale.z,
                    initialScale: s
                });
            }
        };

        // Otimização das frações de partículas para evitar superposição excessive
        addPart(GEO.debris, 0xffffff, false, 15);
        addPart(GEO.debris, 0xffff00, false, 20);
        addPart(GEO.debris, 0xff8800, false, 25);
        addPart(GEO.debris, 0xff2200, false, 20);
        addPart(GEO.debris, 0xffdd66, false, 30);
        
        // --- 🛠️ CAMADAS DE METAIS ALTERADAS PARA GEO.SHARD (ESTILHAÇOS RETORCIDOS ASSIMÉTRICOS) ---
        addPart(GEO.shard, 0x1a1a1a, false, 30, true); // Pedaços de metal queimado/carbonizado fosco
        addPart(GEO.shard, 0x555555, false, 25, true); // Pedaços de fuselagem cinza metálica
        addPart(GEO.shard, 0x888888, false, 15, true);  // Placas de metal claro da estrutura interna

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
                } else if (frag.isMetallicDebris) {
                    // Pedaços de metal sofrem menos arrasto para manter a projeção 3D em direção à câmera
                    frag.velocity.multiplyScalar(0.96);
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
                    // Pedaços metálicos giram muito mais rápido (efeito caótico de estilhaço)
                    const velocidadeRotacao = frag.isMetallicDebris ? 35 : 10;
                    frag.mesh.rotation.x += deltaTime * velocidadeRotacao;
                    frag.mesh.rotation.y += deltaTime * velocidadeRotacao;
                    frag.mesh.rotation.z += deltaTime * (frag.isMetallicDebris ? 20 : 0);

                    frag.mesh.material.opacity = Math.max(0, exp.life);

                    // 🛠️ MANUTENÇÃO DA DEFORMAÇÃO: Mantém a proporção irregular/retorcida original enquanto escalona
                    if (frag.isMetallicDebris) {
                        const progressoProjecao = 1.0 + (1.2 - exp.life) * 1.5;
                        const fatorEncolhimento = Math.max(0, exp.life) * progressoProjecao;
                        
                        frag.mesh.scale.set(
                            frag.initialScaleX * fatorEncolhimento,
                            frag.initialScaleY * fatorEncolhimento,
                            frag.initialScaleZ * fatorEncolhimento
                        );
                    } else {
                        frag.mesh.scale.setScalar(
                            frag.initialScale * Math.max(0, exp.life)
                        );
                    }
                }
            }

            if (exp.flash) {
                exp.flash.material.opacity = Math.max(0, exp.life * 0.6);
                exp.flash.scale.multiplyScalar(1.04);
            }

            if (exp.life <= 0) {
                this.scene.remove(exp.group);
                
                // Remove os filhos do grupo para ajudar o Garbage Collector
                exp.group.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material.dispose();
                    }
                });

                this.explosions.splice(i, 1);
            }
        }
    }
}