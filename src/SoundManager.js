export class SoundManager {
    constructor() {
        this.sounds = {
            // --- JOGADOR ---
            laser: new Audio('/assets/sounds/laser.mp3'),
            nave: new Audio('/assets/sounds/nave.mp3'),
            pdc: new Audio('/assets/sounds/pdc_shot.mp3'),

            // --- INIMIGOS GERAIS ---
            enemyLaser: new Audio('/assets/sounds/laser_inimigo.mp3'),
            explosion: new Audio('/assets/sounds/explosao_inimiga.mp3'),
            enemyPass: new Audio('/assets/sounds/inimiga_passando.mp3'),

            // --- LASERS DOS INIMIGOS ---
            laser_inim_15: new Audio('/assets/sounds/laser_inim_15.mp3'),
            laser_inim_10: new Audio('/assets/sounds/laser_inim_10.mp3'),
            laser_inimi_5: new Audio('/assets/sounds/laser_inimi_5.mp3'),
            laser_inim_6: new Audio('/assets/sounds/laser_inimigo.mp3'), // fallback
            laser_inimigo: new Audio('/assets/sounds/laser_inimigo.mp3'),
            missile: new Audio('/assets/sounds/laser.mp3'),

            // --- SONS DE PASSAGEM ---
            nave_pass_15: new Audio('/assets/sounds/nave_pass_15.mp3'),
            nave_pss_10: new Audio('/assets/sounds/nave_pass_10.mp3'),  // nome exato do arquivo
            nave_pass_5: new Audio('/assets/sounds/nave_pass_5.mp3'),
            nave_pass_6: new Audio('/assets/sounds/inimiga_passando.mp3'), // fallback

            drone: new Audio('/assets/sounds/drone.mp3'),
            dronePass: new Audio('/assets/sounds/drone.mp3'),

            meteoro: new Audio('/assets/sounds/meteoro.mp3'),
            meteoroPass: new Audio('/assets/sounds/meteoro.mp3'),

            inimiga_passando: new Audio('/assets/sounds/inimiga_passando.mp3'),
        };

        // ==================== ALIASES PARA COMPATIBILIDADE ====================
        this.sounds.laserInimi5 = this.sounds.laser_inimi_5;
        this.sounds.laserInim10 = this.sounds.laser_inim_10;
        this.sounds.laserInim15 = this.sounds.laser_inim_15;
        this.sounds.navePass5 = this.sounds.nave_pass_5;
        this.sounds.navePss10 = this.sounds.nave_pss_10;
        this.sounds.navePass15 = this.sounds.nave_pass_15;
        this.sounds.nave_pass_10 = this.sounds.nave_pss_10;

        // Aliases extras usados no EnemyManager
        this.sounds['laser_inim_15'] = this.sounds.laser_inim_15;
        this.sounds['laser_inim_10'] = this.sounds.laser_inim_10;
        this.sounds['laser_inimi_5'] = this.sounds.laser_inimi_5;
        this.sounds['nave_pass_15'] = this.sounds.nave_pass_15;
        this.sounds['nave_pss_10'] = this.sounds.nave_pss_10;
        this.sounds['nave_pass_5'] = this.sounds.nave_pass_5;
        this.sounds['nave_pass_6'] = this.sounds.nave_pass_6;

        Object.values(this.sounds).forEach(sound => {
            if (sound) sound.preload = 'auto';
        });

        this.lastLaserTime = 0;
        this.lastPdcTime = 0;
        this.activeCloneCount = {};
        this.maxCloneCount = {
            explosion: 3,
            enemyLaser: 4,
            laser: 4,
            pdc: 3,
            enemyPass: 2,
            drone: 2,
            meteoro: 2,
            inimiga_passando: 2,
            nave_pass_15: 1,
            nave_pss_10: 1,
            nave_pass_5: 1,
            nave_pass_6: 1
        };
    }

    init() {
        console.log('🔊 Inicializando todos os sons do jogo...');
        Object.values(this.sounds).forEach(sound => {
            if (sound) sound.load();
        });
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
        if (!name) return;

        if (name === 'nave') {
            this.startShipEngine();
            return;
        }

        // Mapeamento de nomes (normalização)
        let soundKey = name;

        const nameMap = {
            'explosao_inimiga': 'explosion',
            'explosaoInimiga': 'explosion',
            'enemyLaser': 'enemyLaser',
            'laser_inimigo': 'enemyLaser',
            'drone': 'drone',
            'meteoro': 'meteoro',
            'inimiga_passando': 'enemyPass',
            'nave_pass_15': 'nave_pass_15',
            'nave_pss_10': 'nave_pss_10',
            'nave_pass_5': 'nave_pass_5',
            'nave_pass_6': 'nave_pass_6',
            'laser_inim_15': 'laser_inim_15',
            'laser_inim_10': 'laser_inim_10',
            'laser_inimi_5': 'laser_inimi_5',
            'laser_inim_6': 'laser_inim_6',
            'missile': 'missile'
        };

        if (nameMap[name]) soundKey = nameMap[name];

        const baseSound = this.sounds[soundKey];

        if (!baseSound) {
            console.warn(`Som não encontrado: ${name} (tentou chave: ${soundKey})`);
            return;
        }

        // --- TRAVAS DE SPAM ---
        const now = Date.now();
        if (soundKey.includes('laser') && now - this.lastLaserTime < 60) return;
        if (soundKey === 'pdc' && now - this.lastPdcTime < 200) return;

        if (soundKey.includes('laser')) this.lastLaserTime = now;
        if (soundKey === 'pdc') this.lastPdcTime = now;

        const maxClones = this.maxCloneCount[soundKey] ?? 3;
        const activeClones = this.activeCloneCount[soundKey] || 0;
        if (activeClones >= maxClones) return;

        this.activeCloneCount[soundKey] = activeClones + 1;
        const soundClone = baseSound.cloneNode(true);
        soundClone.loop = false;

        // Volumes específicos
        if (soundKey.includes('laser')) {
            soundClone.volume = 0.22;
        } else if (soundKey === 'explosion') {
            soundClone.volume = 0.55;
        } else if (soundKey === 'drone' || soundKey === 'meteoro') {
            soundClone.volume = 0.45;
        } else {
            soundClone.volume = 0.35;
        }

        const cleanupClone = () => {
            if (this.activeCloneCount[soundKey] > 0) {
                this.activeCloneCount[soundKey] -= 1;
            }
            soundClone.remove();
        };

        let cleanupCalled = false;
        const safeCleanup = () => {
            if (cleanupCalled) return;
            cleanupCalled = true;
            cleanupClone();
        };

        soundClone.onended = safeCleanup;
        soundClone.play().catch(() => safeCleanup());

        // Fallback para liberar caso o onended não seja disparado
        setTimeout(safeCleanup, 3500);
    }
}