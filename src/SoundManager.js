export class SoundManager {
    constructor() {
        this.sounds = {
            laser: new Audio('/assets/sounds/laser.mp3'),
            enemyLaser: new Audio('/assets/sounds/laser_inimigo.mp3'),
            explosion: new Audio('/assets/sounds/explosao_inimiga.mp3'),
            nave: new Audio('/assets/sounds/nave.mp3'), // Som do motor principal
            enemyPass: new Audio('/assets/sounds/inimiga_passando.mp3')
        };

        Object.values(this.sounds).forEach(sound => {
            sound.preload = 'auto';
        });

        this.lastLaserTime = 0;
    }

    init() {
        console.log('Inicializando sons...');
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

        const baseSound = this.sounds[name];
        if (!baseSound) return;

        // Trava de spam para o laser do jogador
        if (name === 'laser') {
            const now = Date.now();
            if (now - this.lastLaserTime < 60) return;
            this.lastLaserTime = now;
        }

        // Sistema de canais dinâmicos para tiros e explosões
        const soundClone = baseSound.cloneNode(true);

        if (name === 'laser' || name === 'enemyLaser') {
            soundClone.volume = 0.25;
        } else if (name === 'explosion') {
            soundClone.volume = 0.55;
        } else {
            soundClone.volume = 0.40;
        }

        soundClone.play().catch(e =>
            console.warn("Áudio bloqueado pelo navegador:", e)
        );

        soundClone.onended = () => {
            soundClone.remove();
        };
    }
}