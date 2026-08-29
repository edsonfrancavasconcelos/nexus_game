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
const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const isCoarsePointer = matchMedia('(pointer: coarse)').matches;
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
        pixelRatio: Math.min(window.devicePixelRatio || 1, isMobile ? 1.2 : 1.5)
    };
};

// ====================== THREE.JS ======================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010103);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 50000);
camera.position.set(0, 5, 55);

const clock = new THREE.Clock();
const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance"
});

const applyViewportSettings = () => {
    const viewport = getViewportState();
    document.body.dataset.orientation = viewport.portrait ? 'portrait' : 'landscape';
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(viewport.pixelRatio);
    renderer.setSize(viewport.width, viewport.height, false);
};

applyViewportSettings();
document.body.appendChild(renderer.domElement);

// ====================== INSTÂNCIAS ======================
const soundManager = new SoundManager();
window.soundManager = soundManager;

const laserManager = new LaserManager(scene, soundManager);
const explosionManager = new ExplosionManager(scene, soundManager, isMobileDevice);
window.explosionManager = explosionManager;

const inputManager = new InputManager();
const scorePopup = new ScorePopup(scene, camera);
const player = new Player(scene, laserManager, explosionManager);
const enemyManager = new EnemyManager(scene, camera, scorePopup, isMobileDevice);
const spaceEnvironment = new SpaceEnvironment(scene, isMobileDevice ? 800 : 2000, isMobileDevice ? 120 : 400);
const progressionManager = new ProgressionManager();
const naveMae = new NaveMae(scene);

// ====================== HELPERS ======================
function syncLevelResources() {
    player.setLevelLoadout(progressionManager.getLevelLoadout());
    updateResourceHUD();
}

function updateHUD() {
    const scoreVal = document.getElementById('score-val');
    if (scoreVal) scoreVal.textContent = score.toString().padStart(7, '0');
    updateLevelProgressHUD();
}

function updateLevelHUD() {
    const levelVal = document.getElementById('level-val');
    if (levelVal) levelVal.textContent = progressionManager.getLevel();
}

function updateLevelProgressHUD() {
    const progress = progressionManager.getProgressPercent();
    const bar = document.getElementById('level-progress-bar');
    const label = document.getElementById('level-progress-label');

    if (bar) bar.style.width = `${Math.max(0, Math.min(100, progress * 100))}%`;
    if (label) label.textContent = `${Math.round(progress * 100)}%`;
}

function updateResourceHUD() {
    const missileVal = document.getElementById('missile-val');
    const pdcVal = document.getElementById('pdc-val');
    const chanceVal = document.getElementById('chance-val');

    const ammo = player.getAmmoStatus();
    if (missileVal) missileVal.textContent = ammo.missiles;
    if (pdcVal) pdcVal.textContent = ammo.pdcBursts;
    if (chanceVal) chanceVal.textContent = progressionManager.getChancesLeft();

    const chargeBar = document.getElementById('missile-load-bar');
    if (chargeBar) {
        const progress = Math.max(0, Math.min(1, ammo.missileReloadProgress));
        chargeBar.style.width = `${progress * 100}%`;
        chargeBar.style.opacity = ammo.missiles >= ammo.missileMax ? '0.4' : '1';
    }

    const pdcBar = document.getElementById('pdc-load-bar');
    if (pdcBar) {
        const pdcProgress = player.maxPdcBursts === Infinity ? 1 : Math.max(0, Math.min(1, (player.pdcBurstCount || 0) / Math.max(player.maxPdcBursts || 1, 1)));
        pdcBar.style.width = `${pdcProgress * 100}%`;
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

// ====================== JOYSTICK ======================
let joystickActive = false;
let joystickBase = null;
let joystickThumb = null;

function createVirtualJoystick() {
    const container = document.createElement('div');
    container.id = 'virtual-joystick';
    container.style.cssText = `
        position: fixed; bottom: 40px; left: 40px; width: 140px; height: 140px;
        border: 5px solid rgba(0,255,255,0.5); border-radius: 50%;
        background: rgba(0,40,80,0.3); z-index: 10000; touch-action: none; display: none;
    `;

    const thumb = document.createElement('div');
    thumb.style.cssText = `
        position: absolute; width: 55px; height: 55px; background: #00ffff;
        border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%);
        box-shadow: 0 0 25px #00ffff;
    `;

    container.appendChild(thumb);
    document.body.appendChild(container);

    joystickBase = container;
    joystickThumb = thumb;

    if ('ontouchstart' in window) joystickBase.style.display = 'block';
    setupJoystickEvents();
}

function setupJoystickEvents() {
    if (!joystickBase) return;

    joystickBase.addEventListener('touchstart', e => {
        e.preventDefault();
        joystickActive = true;
        handleJoystick(e.touches[0]);
    });

    document.addEventListener('touchmove', e => {
        if (joystickActive) {
            e.preventDefault();
            handleJoystick(e.touches[0]);
        }
    }, { passive: false });

    document.addEventListener('touchend', () => {
        if (!joystickActive) return;
        joystickActive = false;
        joystickThumb.style.transform = 'translate(-50%, -50%)';
        window.moveInput.x = 0;
        window.moveInput.y = 0;
    });
}

function handleJoystick(touch) {
    if (!touch || !joystickBase) return;

    const rect = joystickBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = touch.clientX - cx;
    let dy = touch.clientY - cy;
    const dist = Math.min(55, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);

    dx = Math.cos(angle) * dist;
    dy = Math.sin(angle) * dist;

    joystickThumb.style.transform = `translate(${dx}px, ${dy}px)`;
    window.moveInput.x = dx / 55;
    window.moveInput.y = dy / 55;
}

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

function updateCamera() {
    if (!player.shipModel) return;

    const baseOffset = new THREE.Vector3(0, 8, 75);
    const pitchInfluence = player.shipModel.rotation.x * 0.15;
    const rollInfluence = player.shipModel.rotation.z * 0.1;

    const offset = baseOffset.clone();
    offset.y += Math.sin(pitchInfluence) * 8;
    offset.z -= Math.cos(pitchInfluence) * 8;
    offset.x += Math.sin(rollInfluence) * 6;

    const targetPos = player.shipModel.position.clone().add(offset);
    camera.position.lerp(targetPos, 0.08);

    const lookAtTarget = player.shipModel.position.clone().add(new THREE.Vector3(0, 2, -5));
    camera.lookAt(lookAtTarget);
}

// ====================== ANIMATE ======================
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.1);

    if (currentState !== GAME_STATE.PLAYING) {
        renderer.render(scene, camera);
        return;
    }

    // Countdown inicial
    if (!isGameStarted) {
        countdown -= deltaTime;
        const display = document.getElementById('countdown-display');
        if (display) {
            const num = Math.ceil(countdown);
            display.innerText = num > 0 ? num : '';
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
    createVirtualJoystick();
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
            await soundManager.init();
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

window.addEventListener('resize', applyViewportSettings);
window.addEventListener('orientationchange', applyViewportSettings);