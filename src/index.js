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

window.moveInput = { x: 0, y: 0 };

// --- DECLARAÇÕES GLOBAIS ---
let audioInitialized = false;
let currentState = 'menu';
let score = 0;
const GAME_STATE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused' };

// Scene, Camera, Renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010103);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 50000);
camera.position.set(0, 5, 55);
const clock = new THREE.Clock();
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- Instâncias ---
const soundManager = new SoundManager();
window.soundManager = soundManager;
const laserManager = new LaserManager(scene, soundManager); 
const explosionManager = new ExplosionManager(scene, soundManager);
window.explosionManager = explosionManager;
const inputManager = new InputManager();
const scorePopup = new ScorePopup(scene, camera);
const player = new Player(scene, laserManager, explosionManager);
const enemyManager = new EnemyManager(scene, camera, scorePopup);
const spaceEnvironment = new SpaceEnvironment(scene);
const progressionManager = new ProgressionManager();

// ==================== JOYSTICK VIRTUAL ====================
let joystickActive = false;
let joystickBase = null;
let joystickThumb = null;

function createVirtualJoystick() {
    const container = document.createElement('div');
    container.id = 'virtual-joystick';
    container.style.cssText = `
        position: fixed;
        bottom: 35px;
        left: 35px;
        width: 135px;
        height: 135px;
        border: 5px solid rgba(0, 255, 255, 0.5);
        border-radius: 50%;
        background: rgba(0, 40, 80, 0.25);
        z-index: 10000;
        touch-action: none;
        display: none;
    `;

    const thumb = document.createElement('div');
    thumb.style.cssText = `
        position: absolute;
        width: 52px;
        height: 52px;
        background: #00ffff;
        border-radius: 50%;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
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
    joystickBase.addEventListener('touchstart', e => {
        e.preventDefault();
        joystickActive = true;
        handleJoystickMove(e.touches[0]);
    });

    document.addEventListener('touchmove', e => {
        if (!joystickActive) return;
        e.preventDefault();
        handleJoystickMove(e.touches[0]);
    });

    document.addEventListener('touchend', () => {
        if (!joystickActive) return;
        joystickActive = false;
        joystickThumb.style.transform = 'translate(-50%, -50%)';
        window.moveInput.x = 0;
        window.moveInput.y = 0;
    });
}

function handleJoystickMove(touch) {
    const rect = joystickBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const dist = Math.min(55, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);

    dx = Math.cos(angle) * dist;
    dy = Math.sin(angle) * dist;

    joystickThumb.style.transform = `translate(${dx}px, ${dy}px)`;

    window.moveInput.x = dx / 55;
    window.moveInput.y = dy / 55;
}

// ==================== LEVEL UP CARD ====================
window.showLevelUp = function(level) {
    const existing = document.getElementById('level-up-card');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.id = 'level-up-card';
    card.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: rgba(0,20,40,0.97); border: 4px solid #00ffff;
        padding: 30px 70px; border-radius: 16px; text-align: center;
        z-index: 20000; box-shadow: 0 0 60px #00ffff; color: white;
    `;
    card.innerHTML = `
        <h2 style="color:#00ffff; margin:0; font-size:26px;">NOVA ZONA ALCANÇADA</h2>
        <div style="font-size: 78px; font-weight: bold; margin:12px 0; color:#00ffcc;">${level}</div>
    `;
    document.body.appendChild(card);
    setTimeout(() => card.remove(), 4500);
};

// ==================== OUTRAS FUNÇÕES ====================
function updateCamera() {
    if (!player.shipModel) return;
    const offset = new THREE.Vector3(0, 15, -80);
    offset.applyQuaternion(player.shipModel.quaternion);
    const targetPosition = new THREE.Vector3().copy(player.shipModel.position).add(offset);
    camera.position.lerp(targetPosition, 0.08);
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

function setupNexusSelector() {
    const select = document.getElementById('debugLevelSelect');
    if (!select) return;
    select.addEventListener('change', (e) => {
        const nivel = parseInt(e.target.value);
        progressionManager.getLevel = () => nivel;
        updateLevelHUD();
        if (currentState === GAME_STATE.PLAYING && enemyManager) {
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

    const currentLevel = progressionManager.getLevel();
    enemyManager.spawnWave(player, currentLevel);

    if (audioInitialized) soundManager.startShipEngine();
    updateHUD();
    updateLevelHUD();
}

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.1);

    if (currentState === GAME_STATE.PLAYING) {
        const input = inputManager.update();

        player.update(input, deltaTime, enemyManager);

        if (spaceEnvironment) spaceEnvironment.update(deltaTime, player.mesh.position, input);

        enemyManager.update(laserManager, (pts, hitPosition) => {
            score += pts;
            updateHUD();
            const levelUp = progressionManager.addScore(pts);
            if (hitPosition) scorePopup.show(pts, hitPosition);
            if (levelUp) window.showLevelUp(progressionManager.getLevel());
        }, player, deltaTime, explosionManager, soundManager, progressionManager.getLevel());

        laserManager.update(deltaTime);
        explosionManager.update(deltaTime);
        scorePopup.update(deltaTime);
        updateCamera();
    }

    renderer.render(scene, camera);
}

// ==================== INICIALIZAÇÃO ====================
window.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (!audioInitialized) {
                soundManager.init();
                audioInitialized = true;
            }
            soundManager.startShipEngine();
            startGame();
        });
    }

    // Botões de tiro e PDC
    const btnShoot = document.getElementById('btnShoot');
    if (btnShoot) {
        btnShoot.addEventListener('touchstart', (e) => { e.preventDefault(); player.isFiring = true; });
        btnShoot.addEventListener('touchend', (e) => { e.preventDefault(); player.isFiring = false; });
    }

    const btnPDC = document.getElementById('btnPDC');
    if (btnPDC) {
        btnPDC.addEventListener('click', (e) => {
            e.preventDefault();
            const active = player.togglePDC();
            e.target.style.opacity = active ? "1" : "0.5";
        });
    }

    initGame().then(() => animate());
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});