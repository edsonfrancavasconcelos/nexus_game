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
let joystickCenterX = 0;
let joystickCenterY = 0;

function createVirtualJoystick() {
    const joystickContainer = document.createElement('div');
    joystickContainer.id = 'virtual-joystick';
    joystickContainer.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 30px;
        width: 130px;
        height: 130px;
        border: 4px solid rgba(0, 255, 255, 0.35);
        border-radius: 50%;
        display: none;
        z-index: 1000;
        touch-action: none;
        background: rgba(0, 0, 0, 0.2);
    `;

    const thumb = document.createElement('div');
    thumb.style.cssText = `
        position: absolute;
        width: 48px;
        height: 48px;
        background: rgba(0, 255, 255, 0.75);
        border-radius: 50%;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        box-shadow: 0 0 20px #00ffff;
    `;

    joystickContainer.appendChild(thumb);
    document.body.appendChild(joystickContainer);

    joystickBase = joystickContainer;
    joystickThumb = thumb;

    if ('ontouchstart' in window) {
        joystickBase.style.display = 'block';
    }

    setupJoystickEvents();
}

function setupJoystickEvents() {
    joystickBase.addEventListener('touchstart', (e) => {
        e.preventDefault();
        joystickActive = true;
        const touch = e.touches[0];
        joystickCenterX = touch.clientX;
        joystickCenterY = touch.clientY;
    });

    document.addEventListener('touchmove', (e) => {
        if (!joystickActive) return;
        e.preventDefault();
        const touch = e.touches[0];
        let dx = touch.clientX - joystickCenterX;
        let dy = touch.clientY - joystickCenterY;
        const dist = Math.min(48, Math.sqrt(dx*dx + dy*dy));
        const angle = Math.atan2(dy, dx);

        dx = Math.cos(angle) * dist;
        dy = Math.sin(angle) * dist;

        joystickThumb.style.transform = `translate(${dx}px, ${dy}px)`;

        window.moveInput.x = dx / 48;
        window.moveInput.y = dy / 48;
    });

    document.addEventListener('touchend', () => {
        if (!joystickActive) return;
        joystickActive = false;
        joystickThumb.style.transform = 'translate(-50%, -50%)';
        window.moveInput.x = 0;
        window.moveInput.y = 0;
    });
}

// ==================== CARD DE LEVEL UP ====================
window.showLevelUp = function(level) {
    const existing = document.getElementById('level-up-card');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.id = 'level-up-card';
    card.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: rgba(0, 20, 40, 0.96); border: 4px solid #00ffff;
        padding: 35px 70px; border-radius: 16px; text-align: center;
        z-index: 10000; box-shadow: 0 0 50px #00ffff; color: white;
        font-family: system-ui, sans-serif;
    `;
    card.innerHTML = `
        <h2 style="color:#00ffff; margin:0; font-size:26px;">NOVA ZONA ALCANÇADA</h2>
        <div style="font-size: 78px; font-weight: bold; margin: 12px 0; color:#00ffcc;">${level}</div>
    `;
    document.body.appendChild(card);

    setTimeout(() => { if (card.parentNode) card.remove(); }, 4500);
};

// ==================== FUNÇÕES ====================
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
    createVirtualJoystick();     // Joystick Mobile
    setupNexusSelector();        // ← Função agora definida
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

        enemyManager.update(
            laserManager,
            (pts, hitPosition) => {
                score += pts;
                updateHUD();
                const levelUp = progressionManager.addScore(pts);
                if (hitPosition) scorePopup.show(pts, hitPosition);
                if (levelUp) {
                    window.showLevelUp(progressionManager.getLevel());
                    updateLevelHUD();
                }
            },
            player, deltaTime, explosionManager, soundManager, progressionManager.getLevel()
        );

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

    initGame().then(() => animate());
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});