export class SoundManager {
    constructor() {
        this.sounds = {
            // --- JOGADOR ---
            laser: new Audio('/assets/sounds/laser.mp3'),
            nave: new Audio('/assets/sounds/nave.mp3'),
            pdc: new Audio('/assets/sounds/pdc_shot.mp3'), // ADICIONADO: Som do PDC

            // --- INIMIGOS COMUNS / GERAIS ---
            enemyLaser: new Audio('/assets/sounds/laser_inimigo.mp3'),
            explosion: new Audio('/assets/sounds/explosao_inimiga.mp3'),
            enemyPass: new Audio('/assets/sounds/inimiga_passando.mp3'),

            // --- LASERS DOS INIMIGOS DE NÍVEL ---
            laserInimi5: new Audio('/assets/sounds/laser_inimi_5.mp3'),
            laserInim10: new Audio('/assets/sounds/laser_inim_10.mp3'),
            laserInim15: new Audio('/assets/sounds/laser_inim_15.mp3'), 

            // --- SONS DE NAVE PASSANDO RASPANDO ---
            navePass5: new Audio('/assets/sounds/nave_pass_5.mp3'),
            navePss10: new Audio('/assets/sounds/nave_pass_10.mp3'),
            navePass15: new Audio('/assets/sounds/nave_pass_15.mp3'),

            // --- DRONE E METEORO ---
            dronePass: new Audio('/assets/sounds/drone.mp3'), 
            meteoroPass: new Audio('/assets/sounds/meteoro.mp3')
        };

        Object.values(this.sounds).forEach(sound => {
            sound.preload = 'auto';
        });

        this.lastLaserTime = 0;
        this.lastPdcTime = 0; // Trava de spam para o PDC
    }

    init() {
        console.log('🔊 Inicializando todos os sons do jogo...');
        Object.values(this.sounds).forEach(sound => sound.load());
    }

    startShipEngine() {
        const engine = this.sounds['nave'];
        if (engine) {
            engine.loop = true;
            engine.volume = 0.15;
            engine.play().catch(e => console.warn("Áudio do motor aguardando interação:", e));
        }
    }

    stopShipEngine() {
        const engine = this.sounds['nave'];
        if (engine) engine.pause();
    }

    play(name) {
        if (name === 'nave') {
            this.startShipEngine();
            return;
        }

        const soundKey = name === 'explosaoInimiga' ? 'explosion' : name;
        const baseSound = this.sounds[soundKey];
        
        if (!baseSound) {
            console.warn(`Som não encontrado no SoundManager: ${name}`);
            return;
        }

        // --- TRAVAS DE SPAM ---
        const now = Date.now();
        if (soundKey === 'laser' && now - this.lastLaserTime < 60) return;
        if (soundKey === 'pdc' && now - this.lastPdcTime < 40) return; // Limita o som do PDC
        
        if (soundKey === 'laser') this.lastLaserTime = now;
        if (soundKey === 'pdc') this.lastPdcTime = now;

        // --- SISTEMA DE CANAIS ---
        const soundClone = baseSound.cloneNode(true);

        // --- CONTROLE DE VOLUMES ---
        if (soundKey === 'pdc') {
            soundClone.volume = 0.10; // PDC é rápido e constante, mantém baixo
        } else if (soundKey.toLowerCase().includes('laser')) {
            soundClone.volume = 0.20;
        } else if (soundKey === 'explosion') {
            soundClone.volume = 0.55;
        } else if (soundKey === 'dronePass' || soundKey === 'meteoroPass') {
            soundClone.volume = 0.45;
        } else {
            soundClone.volume = 0.35;
        }

        soundClone.play().catch(e => console.warn("Áudio bloqueado:", e));
        soundClone.onended = () => soundClone.remove();
    }
}