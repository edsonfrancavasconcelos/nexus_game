import * as THREE from 'three';
import { ScorePopup } from './ScorePopup.js';
import { SoundManager } from './SoundManager.js';
import { InputManager } from './InputManager.js';
import { Player } from './Player.js';
import { LaserManager } from './LaserManager.js';
import { EnemyManager } from './EnemyManager.js';
import { ExplosionManager } from './ExplosionManager.js';
import { SpaceEnvironment } from './SpaceEnvironment.js';
import { ProgressionManager } from './ProgressionManager.js';
import { getLevelData } from './getLevelData.js';
import { NaveMae } from './NaveMae.js';
import { PerfMonitor } from './PerfMonitor.js';
import { detectQualityProfile } from './QualityProfile.js';

window.moveInput = { x: 0, y: 0 };

if (typeof window.__BOSS_SPAWNED_LEVELS === 'undefined') {
    window.__BOSS_SPAWNED_LEVELS = new Set();
}
if (typeof window.__NAVE_MAE_ATIVA === 'undefined') {
    window.__NAVE_MAE_ATIVA = null;
}

// ====================== GLOBAIS ======================
let lastBossLevel = -1;
let audioInitialized = false;
let currentState = 'menu';
let score = 0;
let countdown = 5;
let isGameStarted = false;
let boss = null;
let isBossFight = false;

const GAME_STATE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused' };
const isCoarsePointer = matchMedia('(pointer: coarse)').matches;
const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || isCoarsePointer
    || window.innerWidth < 900;
const quality = detectQualityProfile(isMobileDevice);
const getViewportState = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const portrait = height > width;
    const isMobile = isMobileDevice || isCoarsePointer || width < 900;

    return {
        width,
        height,
        portrait,
        isMobile,
        pixelRatio: Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio)
    };
};

// ====================== THREE.JS ======================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010103);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, quality.far);
camera.position.set(0, 5, 55);

const clock = new THREE.Clock();
const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: isMobileDevice ? "default" : "high-performance"
});

let resizeTimer = null;
let dynamicPixelRatio = null;
const applyViewportSettings = () => {
    const viewport = getViewportState();
    document.body.dataset.orientation = viewport.portrait ? 'portrait' : 'landscape';
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(dynamicPixelRatio ? Math.min(dynamicPixelRatio, viewport.pixelRatio) : viewport.pixelRatio);
    renderer.setSize(viewport.width, viewport.height, false);
};

applyViewportSettings();
document.body.appendChild(renderer.domElement);

const perfMonitor = new PerfMonitor(renderer, scene, {
    isMobile: isMobileDevice,
    minPixelRatio: quality.minPixelRatio,
    maxPixelRatio: getViewportState().pixelRatio,
    onScaleChange: (ratio) => { dynamicPixelRatio = ratio; applyViewportSettings(); }
});

// ====================== INSTÂNCIAS ======================
const soundManager = new SoundManager();
window.soundManager = soundManager;

const laserManager = new LaserManager(scene, soundManager);
const explosionManager = new ExplosionManager(scene, soundManager, isMobileDevice);
window.explosionManager = explosionManager;
explosionManager.maxActiveExplosions = quality.maxExplosions;

const inputManager = new InputManager();
const scorePopup = new ScorePopup(scene, camera);
const player = new Player(scene, laserManager, explosionManager);
const enemyManager = new EnemyManager(scene, camera, scorePopup, isMobileDevice);
enemyManager.maxEnemiesOnScreen = quality.maxEnemies;
const spaceEnvironment = new SpaceEnvironment(scene, quality.stars, quality.clouds);
const progressionManager = new ProgressionManager();
const naveMae = new NaveMae(scene);

// ====================== HELPERS ======================
function syncLevelResources() {
    player.setLevelLoadout(progressionManager.getLevelLoadout());
    updateResourceHUD();
}

const _domCache = new Map();
const $id = (id) => {
    let el = _domCache.get(id);
    if (!el) { el = document.getElementById(id); if (el) _domCache.set(id, el); }
    return el;
};
const _hudLast = {};
const setText = (el, key, value) => {
    if (!el || _hudLast[key] === value) return;
    _hudLast[key] = value;
    el.textContent = value;
};
const setStyle = (el, key, prop, value) => {
    if (!el || _hudLast[key] === value) return;
    _hudLast[key] = value;
    el.style[prop] = value;
};

function updateHUD() {
    setText($id('score-val'), 'score', score.toString().padStart(7, '0'));
    updateLevelProgressHUD();
}

function updateLevelHUD() {
    setText($id('level-val'), 'level', progressionManager.getLevel());
}

function updateLevelProgressHUD() {
    const progress = progressionManager.getProgressPercent();
    setStyle($id('level-progress-bar'), 'lpb', 'width', `${Math.max(0, Math.min(100, progress * 100))}%`);
    setText($id('level-progress-label'), 'lpl', `${Math.round(progress * 100)}%`);
}

function updateResourceHUD() {
    const ammo = player.getAmmoStatus();
    setText($id('missile-val'), 'missile', ammo.missiles);
    setText($id('pdc-val'), 'pdc', ammo.pdcBursts);
    setText($id('chance-val'), 'chance', progressionManager.getChancesLeft());

    const chargeBar = $id('missile-load-bar');
    if (chargeBar) {
        const progress = Math.max(0, Math.min(1, ammo.missileReloadProgress));
        setStyle(chargeBar, 'mlb', 'width', `${Math.round(progress * 100)}%`);
        setStyle(chargeBar, 'mlbo', 'opacity', ammo.missiles >= ammo.missileMax ? '0.4' : '1');
    }

    const pdcBar = $id('pdc-load-bar');
    if (pdcBar) {
        const pdcProgress = player.maxPdcBursts === Infinity ? 1 : Math.max(0, Math.min(1, (player.pdcBurstCount || 0) / Math.max(player.maxPdcBursts || 1, 1)));
        setStyle(pdcBar, 'plb', 'width', `${pdcProgress * 100}%`);
    }
}

function updateEnvironmentTheme(level = progressionManager.getLevel()) {
    if (spaceEnvironment?.setLevelTheme) spaceEnvironment.setLevelTheme(level);
}

function updateLevelUI(currentLevel) {
    const data = getLevelData(currentLevel);
    const titleElement = document.querySelector('.nexus-title');
    const taskElement = document.querySelector('.nexus-status');

    if (titleElement && taskElement) {
        titleElement.innerText = `NÍVEL ${currentLevel} - ${data.title}`;
        taskElement.innerText = data.task;
        titleElement.style.display = 'block';
        taskElement.style.display = 'block';
        titleElement.style.color = '#00ffff';
        taskElement.style.color = '#ffffff';
    }
}

window.showLevelUp = function (level, message) {
    const existing = document.getElementById('level-up-card');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.id = 'level-up-card';
    card.style.cssText = `
        position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
        padding:30px;border-radius:18px;text-align:center;z-index:20000;
        color:white;pointer-events:none;background:rgba(0,0,0,0.7);
        border:1px solid #00ffff;backdrop-filter:blur(10px);
    `;

    card.innerHTML = `
        <h2 style="color:#00ffff;margin:0;font-size:20px;text-transform:uppercase;letter-spacing:2px;">Zona Alcançada</h2>
        <div style="font-size:60px;font-weight:bold;margin:10px 0;color:#fff;">${level}</div>
        <p style="font-size:16px;max-width:300px;line-height:1.4;margin:10px 0;">${message || ''}</p>
    `;
    document.body.appendChild(card);
    setTimeout(() => card.remove(), 5000);
};

// ====================== SCORE / HIT ======================
const handleEnemyScore = (pts, hitPosition) => {
    score += pts;
    updateHUD();

    // Progressão principal pelo score (a cada 10.000)
    // O addScore do ProgressionManager fica como backup
    const levelUp = progressionManager.addScore(pts * 0.7);
    if (levelUp) {
        updateLevelHUD();
        updateEnvironmentTheme();
        progressionManager.resetLevelResources();
        syncLevelResources();
    }
};

const handlePlayerHit = () => {
    progressionManager.loseChance();
    updateResourceHUD();
};

const _camOffset = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _camLookDelta = new THREE.Vector3(0, 2, -5);

function updateCamera() {
    if (!player.shipModel) return;

    const pitchInfluence = player.shipModel.rotation.x * 0.15;
    const rollInfluence = player.shipModel.rotation.z * 0.1;

    _camOffset.set(0, 8, 75);
    _camOffset.y += Math.sin(pitchInfluence) * 8;
    _camOffset.z -= Math.cos(pitchInfluence) * 8;
    _camOffset.x += Math.sin(rollInfluence) * 6;

    _camTarget.copy(player.shipModel.position).add(_camOffset);
    camera.position.lerp(_camTarget, 0.08);

    _camLook.copy(player.shipModel.position).add(_camLookDelta);
    camera.lookAt(_camLook);
}

// ====================== ANIMATE ======================
let wasPlaying = false;
let lastCountdownShown = null;
function animate() {
    requestAnimationFrame(animate);
    if (currentState !== GAME_STATE.PLAYING) { wasPlaying = false; return; }
    if (!wasPlaying) { clock.getDelta(); wasPlaying = true; }
    const deltaTime = Math.min(clock.getDelta(), 0.1);

    // Countdown inicial
    if (!isGameStarted) {
        countdown -= deltaTime;
        const display = document.getElementById('countdown-display');
        if (display) {
            const num = Math.ceil(countdown);
            if (num !== lastCountdownShown) {
                lastCountdownShown = num;
                display.innerText = num > 0 ? num : '';
            }
            if (num <= 0) {
                isGameStarted = true;
                display.style.display = 'none';

                const nivelInicial = progressionManager.getLevel();
                enemyManager.spawnWave(player, nivelInicial);
                updateLevelUI(nivelInicial);
                updateEnvironmentTheme(nivelInicial);
                progressionManager.resetLevelResources();
                syncLevelResources();

                if (audioInitialized) soundManager.startShipEngine();
            }
        }
        renderer.render(scene, camera);
        return;
    }

    const currentLevel = progressionManager.getLevel();
    window.currentLevel = currentLevel;
    if (currentLevel >= 45) naveMae.preload?.();

    // Input
    const keyboardInput = inputManager.update();
    const input = {
        x: window.moveInput.x !== 0 ? window.moveInput.x : keyboardInput.x,
        y: window.moveInput.y !== 0 ? window.moveInput.y : keyboardInput.y
    };

    player.update(input, deltaTime, enemyManager, handlePlayerHit, handleEnemyScore);

    if (spaceEnvironment) {
        spaceEnvironment.update(
            deltaTime,
            player.mesh.position,
            input,
            progressionManager.getLevel(),
            player.mesh,
            soundManager
        );
    }

    enemyManager.update(
        laserManager,
        handleEnemyScore,
        player,
        deltaTime,
        explosionManager,
        soundManager,
        progressionManager.getLevel(),
        handlePlayerHit
    );

    laserManager.update(deltaTime, enemyManager, handleEnemyScore, explosionManager);
    explosionManager.update(deltaTime);
    scorePopup.update(deltaTime);
    updateCamera();

    // ====================== PROGRESSÃO DE NÍVEL (sempre a cada 10.000 pontos) ======================
    const targetLevel = Math.floor(score / 10000) + 1;

    if (targetLevel > currentLevel) {
        progressionManager.setLevel(targetLevel);
        updateLevelHUD();
        updateEnvironmentTheme(targetLevel);
        progressionManager.resetLevelResources();
        syncLevelResources();

        // Só respawna inimigos normais se não estiver em boss fight
        if (!isBossFight) {
            enemyManager.clearAllEnemies();
            enemyManager.spawnWave(player, targetLevel);
        }

        const info = getLevelData(targetLevel);
        window.showLevelUp(targetLevel, info.title);
    }

 // ====================== SPAWN DA NAVE MÃE (apenas 1 vez a partir do nível 50) ======================
if (
    currentLevel >= 50 &&
    boss === null &&
    !window.__BOSS_SPAWNED_LEVELS.has(50)   // marca só o 50 → nunca spawna de novo
) {
    window.__BOSS_SPAWNED_LEVELS.add(50);
    isBossFight = true;
    lastBossLevel = 50;

    console.log(`🚀 [BOSS] Spawnando Nave Mãe no nível ${currentLevel} (início no 50)`);

    boss = naveMae;
    window.__NAVE_MAE_ATIVA = boss;

    if (progressionManager.registerBoss) {
        progressionManager.registerBoss(boss);
    }
    progressionManager.activeBoss = boss;

    // Sempre começa como nível 50 → pequena e cresce gradualmente
    if (boss.ativarNave) {
        boss.ativarNave(50);
    }
}

    // ====================== ATUALIZAÇÃO DO BOSS ======================
    if (boss) {
        boss.update(deltaTime, player.mesh?.position, laserManager, explosionManager, player, enemyManager, soundManager);

        // Boss destruído
        if (boss.hp <= 0 || (boss.isActive === false && boss.isAlive === false)) {
            console.log(`💥 [BOSS] Nave Mãe destruída no nível ${currentLevel}`);

            try { boss.dispose(); } catch (e) {}

            boss = null;
            isBossFight = false;
            lastBossLevel = -1;
            window.__NAVE_MAE_ATIVA = null;

            // Não remove o registro de spawn: o boss deve aparecer apenas uma vez por jogo.
            // Assim evitamos que o mesmo nível volte a spawnar a Nave Mãe infinitamente.

            // Volta os inimigos normais no nível atual
            enemyManager.clearAllEnemies();
            enemyManager.spawnWave(player, progressionManager.getLevel());
        }
    }

    renderer.render(scene, camera);
    perfMonitor.tick(deltaTime);
}

// ====================== SETUP ======================
function setupNexusSelector() {
    window.addEventListener('nivelAlterado', (e) => {
        const novoNivel = parseInt(e.detail.nivel);
        progressionManager.setLevel(novoNivel);
        updateLevelHUD();
        updateLevelUI(novoNivel);
        updateEnvironmentTheme(novoNivel);

        if (currentState === GAME_STATE.PLAYING) {
            if (boss) {
                try { boss.dispose(); } catch (e) {}
                boss = null;
            }
            lastBossLevel = -1;
            isBossFight = false;
            window.__BOSS_SPAWNED_LEVELS.clear();

            enemyManager.clearAllEnemies();
            progressionManager.resetLevelResources();
            syncLevelResources();
            enemyManager.spawnWave(player, novoNivel);
        }
    });
}

async function initGame() {
    await enemyManager.init();
    setupNexusSelector();
}

function startGame() {
    if (currentState === GAME_STATE.PLAYING) return;

    countdown = 5;
    isGameStarted = false;
    score = 0;
    lastBossLevel = -1;
    boss = null;
    isBossFight = false;
    window.__BOSS_SPAWNED_LEVELS.clear();

    const countdownDisplay = document.getElementById('countdown-display');
    if (countdownDisplay) countdownDisplay.style.display = 'block';

    currentState = GAME_STATE.PLAYING;

    const overlay = document.getElementById('overlay');
    if (overlay) overlay.style.display = 'none';

    const nexusSelector = document.getElementById('nexusSelector');
    if (nexusSelector) nexusSelector.style.display = 'none';

    player.mesh.position.set(0, -1, 8);
    enemyManager.clearAllEnemies();

    updateHUD();
    updateLevelHUD();
}

// ====================== DOM ======================
window.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');

    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyQ') player.startBarrelRoll(-1);
        if (e.code === 'KeyE') player.startBarrelRoll(1);
    });

    const btnLeft = document.getElementById('btnRollLeft');
    const btnRight = document.getElementById('btnRollRight');
    if (btnLeft) {
        btnLeft.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            player.startBarrelRoll(-1);
        });
    }
    if (btnRight) {
        btnRight.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            player.startBarrelRoll(1);
        });
    }

    const handleStart = async (e) => {
        if (e) e.preventDefault();
        if (!audioInitialized) {
            audioInitialized = true;
        }
        soundManager.startShipEngine();
        startGame();
    };

    if (startBtn) {
        startBtn.addEventListener('click', handleStart);
        startBtn.addEventListener('touchstart', handleStart, { passive: false });
    }

    const btnShoot = document.getElementById('btnShoot');
    if (btnShoot) {
        btnShoot.addEventListener('mousedown', () => player.isFiring = true);
        btnShoot.addEventListener('mouseup', () => player.isFiring = false);
        btnShoot.addEventListener('touchstart', (e) => {
            e.preventDefault();
            player.isFiring = true;
        });
        btnShoot.addEventListener('touchend', (e) => {
            e.preventDefault();
            player.isFiring = false;
        });
    }

    const btnMissile = document.getElementById('btnMissile');
    if (btnMissile) {
        const fire = (e) => {
            if (e) e.preventDefault();
            if (player.fireMissile()) updateResourceHUD();
        };
        btnMissile.addEventListener('pointerdown', fire);
        btnMissile.addEventListener('click', fire);
        btnMissile.addEventListener('touchstart', fire, { passive: false });
    }

    const btnPause = document.getElementById('btnPause');
    if (btnPause) {
        btnPause.addEventListener('click', () => {
            currentState = (currentState === GAME_STATE.PLAYING)
                ? GAME_STATE.PAUSED
                : GAME_STATE.PLAYING;
        });
        btnPause.addEventListener('touchstart', (e) => {
            e.preventDefault();
            currentState = (currentState === GAME_STATE.PLAYING)
                ? GAME_STATE.PAUSED
                : GAME_STATE.PLAYING;
        });
    }

    const btnPDC = document.getElementById('btnPDC');
    if (btnPDC) {
        btnPDC.addEventListener('click', (e) => {
            e.preventDefault();
            const active = player.togglePDC();
            e.target.style.opacity = active ? "1" : "0.5";
        });
    }

    syncLevelResources();
    initGame().then(() => animate());
});

const debouncedViewport = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyViewportSettings, 120);
};
window.addEventListener('resize', debouncedViewport);
window.addEventListener('orientationchange', debouncedViewport);

// Pausa automaticamente em segundo plano (economiza bateria/CPU) e descarta o delta acumulado ao voltar
document.addEventListener('visibilitychange', () => {
    if (document.hidden && currentState === GAME_STATE.PLAYING) {
        currentState = GAME_STATE.PAUSED;
    }
});