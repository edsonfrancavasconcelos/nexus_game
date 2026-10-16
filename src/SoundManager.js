export class SoundManager {
    constructor() {
        this.sounds = {
            shipEngine: new Audio('/assets/sounds/nave.mp3'),
            playerShot: new Audio('/assets/sounds/laser.mp3'),
            pdc: new Audio('/assets/sounds/pdc_shot.mp3'),
            enemyLaser: new Audio('/assets/sounds/laser_inimigo.mp3'),
            explosion: new Audio('/assets/sounds/explosao_inimiga.mp3'),
            enemyPass: new Audio('/assets/sounds/inimiga_passando.mp3'),
            laser_inim_15: new Audio('/assets/sounds/laser_inim_15.mp3'),
            laser_inim_10: new Audio('/assets/sounds/laser_inim_10.mp3'),
            laser_inimi_5: new Audio('/assets/sounds/laser_inimi_5.mp3'),
            nave_pass_15: new Audio('/assets/sounds/nave_pass_15.mp3'),
            nave_pss_10: new Audio('/assets/sounds/nave_pss_10.mp3'),
            nave_pass_5: new Audio('/assets/sounds/nave_pass_5.mp3'),
            drone: new Audio('/assets/sounds/drone.mp3'),
            meteoro: new Audio('/assets/sounds/meteoro.mp3')
        };

        this.aliases = {
            missile: 'playerShot',
            laser_inimigo: 'enemyLaser',
            laser_inim_6: 'enemyLaser',
            inimiga_passando: 'enemyPass',
            nave_pass_6: 'enemyPass',
            dronePass: 'drone',
            meteoroPass: 'meteoro',
            explosao_inimiga: 'explosion',
            explosaoInimiga: 'explosion'
        };

        Object.values(this.sounds).forEach(sound => {
            sound.preload = 'none';
        });

        this.lastPlayTime = new Map();
        this.activeCloneCount = {};
        this.pool = {};
        this.maxCloneCount = {
            playerShot: 4,
            pdc: 3,
            explosion: 3,
            enemyLaser: 4,
            enemyPass: 2,
            drone: 2,
            meteoro: 2,
            laser_inim_15: 2,
            laser_inim_10: 2,
            laser_inimi_5: 2,
            nave_pass_15: 1,
            nave_pss_10: 1,
            nave_pass_5: 1
        };
    }

    startShipEngine() {
        const engine = this.sounds.shipEngine;
        if (!engine || !engine.paused) return;

        engine.loop = true;
        engine.volume = 0.15;
        engine.play().catch(error => console.warn('Áudio do motor aguardando interação:', error));
    }

    stopShipEngine() {
        this.sounds.shipEngine?.pause();
    }

    play(name) {
        if (!name) return;

        const soundKey = this.aliases[name] || name;
        if (soundKey === 'shipEngine') {
            this.startShipEngine();
            return;
        }

        const baseSound = this.sounds[soundKey];
        if (!baseSound) {
            console.warn(`Som não encontrado: ${name} (tentou chave: ${soundKey})`);
            return;
        }

        const now = Date.now();
        const cooldown = soundKey === 'pdc' ? 200 : soundKey === 'playerShot' ? 60 : 0;
        if (cooldown && now - (this.lastPlayTime.get(soundKey) || 0) < cooldown) return;
        if (cooldown) this.lastPlayTime.set(soundKey, now);

        const maxClones = this.maxCloneCount[soundKey] ?? 3;
        const activeClones = this.activeCloneCount[soundKey] || 0;
        if (activeClones >= maxClones) return;

        this.activeCloneCount[soundKey] = activeClones + 1;
        const pool = this.pool[soundKey] || (this.pool[soundKey] = []);
        const soundClone = pool.pop() || baseSound.cloneNode(true);
        soundClone.loop = false;
        soundClone.currentTime = 0;

        if (soundKey === 'playerShot' || soundKey.includes('laser')) {
            soundClone.volume = 0.22;
        } else if (soundKey === 'explosion') {
            soundClone.volume = 0.55;
        } else if (soundKey === 'drone' || soundKey === 'meteoro') {
            soundClone.volume = 0.45;
        } else {
            soundClone.volume = 0.35;
        }

        let cleanupCalled = false;
        const safeCleanup = () => {
            if (cleanupCalled) return;
            cleanupCalled = true;
            soundClone.onended = null;
            if (this.activeCloneCount[soundKey] > 0) this.activeCloneCount[soundKey] -= 1;
            if (pool.length < 6) pool.push(soundClone);
        };

        soundClone.onended = safeCleanup;
        soundClone.play().catch(safeCleanup);
    }
}
