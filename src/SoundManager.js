export class SoundManager {
    constructor() {
        this.sounds = {
            // --- JOGADOR ---
            laser: new Audio('/assets/sounds/laser.mp3'),
            nave: new Audio('/assets/sounds/nave.mp3'), // Som do motor principal

            // --- INIMIGOS COMUNS / GERAIS ---
            enemyLaser: new Audio('/assets/sounds/laser_inimigo.mp3'),
            explosion: new Audio('/assets/sounds/explosao_inimiga.mp3'),
            enemyPass: new Audio('/assets/sounds/inimiga_passando.mp3'),

            // --- LASERS DOS INIMIGOS DE NÍVEL ---
            laserInimi5: new Audio('/assets/sounds/laser_inimi_5.mp3'),
            laserInim10: new Audio('/assets/sounds/laser_inim_10.mp3'),
            // 🛠️ Corrigido de 'laser_invert_15.mp3' para o nome real do seu arquivo
            laserInim15: new Audio('/assets/sounds/laser_inim_15.mp3'), 

            // --- SONS DE NAVE PASSANDO RASPANDO ---
            navePass5: new Audio('/assets/sounds/nave_pass_5.mp3'),
            // 🛠️ Corrigido de 'nave_pss_10.mp3' para 'nave_pass_10.mp3' para bater com seu arquivo do windows
            navePss10: new Audio('/assets/sounds/nave_pass_10.mp3'),
            navePass15: new Audio('/assets/sounds/nave_pass_15.mp3'),

            // --- DRONE E METEORO ---
            dronePass: new Audio('/assets/sounds/drone.mp3'),       // Usando o som físico do drone
            meteoroPass: new Audio('/assets/sounds/meteoro.mp3')    // Usando o som físico do meteoro
        };

        Object.values(this.sounds).forEach(sound => {
            sound.preload = 'auto';
        });

        this.lastLaserTime = 0;
    }

    init() {
        console.log('🔊 Inicializando todos os sons do jogo...');
        Object.values(this.sounds).forEach(sound => sound.load());
    }

    /**
     * Liga o som do motor da nave de forma contínua (Loop)
     */
    startShipEngine() {
        const engine = this.sounds['nave'];
        if (engine) {
            engine.loop = true;      // Força o som a recomeçar sozinho quando terminar
            engine.volume = 0.15;    // Volume baixo para ser um som de fundo agradável
            
            engine.play().catch(e =>
                console.warn("Áudio do motor aguardando clique do jogador:", e)
            );
        }
    }

    /**
     * Desliga o motor se o jogo for pausado ou der GameOver
     */
    stopShipEngine() {
        const engine = this.sounds['nave'];
        if (engine) {
            engine.pause();
        }
    }

    play(name) {
        // Se tentarem tocar o som da nave pelo play normal, joga para a função de loop
        if (name === 'nave') {
            this.startShipEngine();
            return;
        }

        // Caso o EnemyManager chame 'explosaoInimiga', redireciona para a chave certa 'explosion'
        const soundKey = name === 'explosaoInimiga' ? 'explosion' : name;

        const baseSound = this.sounds[soundKey];
        if (!baseSound) {
            console.warn(`Som não encontrado no SoundManager: ${name}`);
            return;
        }

        // Trava de spam para o laser do jogador
        if (soundKey === 'laser') {
            const now = Date.now();
            if (now - this.lastLaserTime < 60) return;
            this.lastLaserTime = now;
        }

        // Sistema de canais dinâmicos para tiros e explosões
        const soundClone = baseSound.cloneNode(true);

        // --- CONTROLE DE VOLUMES INDIVIDUAIS POR CATEGORIA ---
        if (soundKey.toLowerCase().includes('laser')) {
            soundClone.volume = 0.20; // Lasers de todo mundo um pouco mais baixos para não irritar
        } else if (soundKey === 'explosion') {
            soundClone.volume = 0.55; // Explosão bem forte para dar impacto
        } else if (soundKey === 'dronePass' || soundKey === 'meteoroPass') {
            soundClone.volume = 0.45; // Drones e meteoros ganham destaque ao passar raspando
        } else {
            soundClone.volume = 0.35; // Volume padrão para passagens de naves de nível
        }

        soundClone.play().catch(e =>
            console.warn("Áudio bloqueado pelo navegador:", e)
        );

        soundClone.onended = () => {
            soundClone.remove();
        };
    }
}