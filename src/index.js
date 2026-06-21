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

window.moveInput = { x: 0, y: 0 };

// --- DECLARAÇÕES GLOBAIS ---
let audioInitialized = false;
let currentState = 'menu';
let score = 0;
const GAME_STATE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused' };
const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

// Scene, Camera, Renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010103);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 50000);
camera.position.set(0, 5, 55);
const clock = new THREE.Clock();
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(isMobileDevice ? 1 : Math.min(window.devicePixelRatio, 1.5));
document.body.appendChild(renderer.domElement);

// --- Instâncias ---
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

function syncLevelResources() {
    player.setLevelLoadout(progressionManager.getLevelLoadout());
    updateResourceHUD();
}

// ==================== JOYSTICK VIRTUAL ====================
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

function updateLevelUI(currentLevel) {
    const data = getLevelData(currentLevel);
    
    // Supondo que você tenha elementos HTML para isso
    const titleElement = document.getElementById('zone-title');
    const taskElement = document.getElementById('zone-task');
    
    titleElement.innerText = `NÍVEL ${currentLevel} - ${data.title}`;
    taskElement.innerText = data.task;
}

function setupJoystickEvents() {
    joystickBase.addEventListener('touchstart', e => { e.preventDefault(); joystickActive = true; handleJoystick(e.touches[0]); });
    document.addEventListener('touchmove', e => { if (joystickActive) { e.preventDefault(); handleJoystick(e.touches[0]); }});
    document.addEventListener('touchend', () => {
        if (!joystickActive) return;
        joystickActive = false;
        joystickThumb.style.transform = 'translate(-50%, -50%)';
        window.moveInput.x = 0;
        window.moveInput.y = 0;
    });
}

function handleJoystick(touch) {
    const rect = joystickBase.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;
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

window.showLevelUp = function(level, message) {
    const existing = document.getElementById('level-up-card');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.id = 'level-up-card';
    card.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);padding:30px;border-radius:18px;text-align:center;z-index:20000;color:white;pointer-events:none;background:rgba(0,0,0,0.7);border:1px solid #00ffff;backdrop-filter:blur(10px);`;
    
    card.innerHTML = `
        <h2 style="color:#00ffff;margin:0;font-size:20px;text-transform:uppercase;letter-spacing:2px;">Zona Alcançada</h2>
        <div style="font-size:60px;font-weight:bold;margin:10px 0;color:#fff;">${level}</div>
        <p style="font-size:16px;max-width:300px;line-height:1.4;margin:10px 0;">${message}</p>
    `;
    document.body.appendChild(card);
    setTimeout(() => card.remove(), 5000); // Aumentei para 5s para dar tempo de ler
};

function getMissionText(level) {
    if (level <= 5) return "Treinamento: Destrua dróides básicos para calibrar seus sistemas.";
    if (level <= 20) return "Zona de Asteróides: Evite colisões e destrua as rochas instáveis.";
    if (level <= 33) return "Bloqueio Hostil: Naves de combate interceptando. Priorize alvos pesados!";
    if (level <= 50) return "Setor Alfa: Zona de conflito total. Mantenha fogo contínuo!";
    if (level <= 100) return "Fronteira Final: Destrua a Nave-Mãe e encerre esta guerra!";
    return "Sobreviva ao ataque e limpe o perímetro.";
}

// ==================== OUTRAS FUNÇÕES ====================
function updateCamera() {
    if (!player.shipModel) return;
    const offset = new THREE.Vector3(0, 15, -80);
    offset.applyQuaternion(player.shipModel.quaternion);
    camera.position.lerp(player.shipModel.position.clone().add(offset), 0.1);
    camera.lookAt(player.shipModel.position);
}

function updateHUD() {
    const scoreVal = document.getElementById('score-val');
    if (scoreVal) scoreVal.textContent = score.toString().padStart(7, '0');
}

function updateLevelHUD() {
    const levelVal = document.getElementById('level-val');
    if (levelVal) levelVal.textContent = progressionManager.getLevel();
}

function updateResourceHUD() {
    const missileVal = document.getElementById('missile-val');
    const pdcVal = document.getElementById('pdc-val');
    const chanceVal = document.getElementById('chance-val');

    if (missileVal) missileVal.textContent = player.getAmmoStatus().missiles;
    if (pdcVal) pdcVal.textContent = player.getAmmoStatus().pdcBursts;
    if (chanceVal) chanceVal.textContent = progressionManager.getChancesLeft();
}

function updateEnvironmentTheme(level = progressionManager.getLevel()) {
    if (spaceEnvironment?.setLevelTheme) {
        spaceEnvironment.setLevelTheme(level);
    }
}

function setupNexusSelector() {
    const select = document.getElementById('debugLevelSelect');
    if (!select) return;
    select.addEventListener('change', (e) => {
        const nivel = parseInt(e.target.value);
        progressionManager.setLevel(nivel);
        updateLevelHUD();
        updateEnvironmentTheme(nivel);
        if (currentState === GAME_STATE.PLAYING) {
            enemyManager.clearAllEnemies();
            enemyManager.spawnWave(player, nivel);
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
    currentState = GAME_STATE.PLAYING;
    score = 0;

    document.getElementById('overlay').style.display = 'none';
    document.getElementById('nexusSelector').style.display = 'none';

    player.mesh.position.set(0, -1, 8);
    enemyManager.clearAllEnemies();

    enemyManager.spawnWave(player, progressionManager.getLevel());
    updateEnvironmentTheme();
    progressionManager.resetLevelResources();
    syncLevelResources();

    if (audioInitialized) soundManager.startShipEngine();
    updateHUD();
    updateLevelHUD();
}

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.1);

    const handleEnemyScore = (pts, hitPosition) => {
        score += pts;
        updateHUD();

        const levelUp = progressionManager.addScore(pts);

        if (hitPosition) scorePopup.show(pts, hitPosition);
if (levelUp) {
    updateLevelHUD();
    updateEnvironmentTheme();
    progressionManager.resetLevelResources();
    syncLevelResources();

    // Busca os dados configurados no seu arquivo getLevelData.js
    const nivelAtual = progressionManager.getLevel();
    const info = getLevelData(nivelAtual); 

    // Agora passamos o Título e a Tarefa para a função de UI
    window.showLevelUp(nivelAtual, info.title, info.task);
}
    };

    const handlePlayerHit = () => {
        const result = progressionManager.loseChance();
        updateResourceHUD();

        if (result.failed) {
            const failedLevel = progressionManager.failLevel();
            enemyManager.clearAllEnemies();
            progressionManager.resetLevelResources();
            syncLevelResources();
            updateLevelHUD();
            updateEnvironmentTheme(failedLevel);
            enemyManager.spawnWave(player, failedLevel);
        }
    };

    if (currentState === GAME_STATE.PLAYING) {
        const keyboardInput = inputManager.update();
        const input = {
            x: window.moveInput.x !== 0 ? window.moveInput.x : keyboardInput.x,
            y: window.moveInput.y !== 0 ? window.moveInput.y : keyboardInput.y
        };

        player.update(input, deltaTime, enemyManager, handlePlayerHit);
        if (spaceEnvironment) spaceEnvironment.update(deltaTime, player.mesh.position, input);

        // --- ATUALIZAÇÃO DE SCORE E NÍVEL ---
        enemyManager.update(laserManager, handleEnemyScore, player, deltaTime, explosionManager, soundManager, progressionManager.getLevel());

        laserManager.update(deltaTime, enemyManager, handleEnemyScore, explosionManager);
        explosionManager.update(deltaTime);
        scorePopup.update(deltaTime);
        updateCamera();
    }
    renderer.render(scene, camera);
}

window.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    
    // Função unificada de início
    const handleStart = async (e) => {
        if (e) e.preventDefault();
        
        // Ativa áudio obrigatório para mobile
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

    // Shoot Button
    const btnShoot = document.getElementById('btnShoot');
    if (btnShoot) {
        btnShoot.addEventListener('mousedown', () => player.isFiring = true);
        btnShoot.addEventListener('mouseup', () => player.isFiring = false);
        btnShoot.addEventListener('touchstart', (e) => { e.preventDefault(); player.isFiring = true; });
        btnShoot.addEventListener('touchend', (e) => { e.preventDefault(); player.isFiring = false; });
    }

    const btnMissile = document.getElementById('btnMissile');
    if (btnMissile) {
        btnMissile.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (player.fireMissile()) updateResourceHUD();
        });
        btnMissile.addEventListener('click', (e) => {
            e.preventDefault();
            if (player.fireMissile()) updateResourceHUD();
        });
        btnMissile.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (player.fireMissile()) updateResourceHUD();
        }, { passive: false });
    }

    // Pause Button
    const btnPause = document.getElementById('btnPause');
    if (btnPause) {
        btnPause.addEventListener('click', () => {
            currentState = (currentState === GAME_STATE.PLAYING) ? GAME_STATE.PAUSED : GAME_STATE.PLAYING;
            console.log("Pause toggled:", currentState);
        });
        btnPause.addEventListener('touchstart', (e) => {
            e.preventDefault();
            currentState = (currentState === GAME_STATE.PLAYING) ? GAME_STATE.PAUSED : GAME_STATE.PLAYING;
        });
    }

    // PDC Button
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

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});