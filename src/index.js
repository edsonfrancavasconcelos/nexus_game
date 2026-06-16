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

// ==================== JOYSTICK VIRTUAL PARA MOBILE ====================
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
        width: 120px;
        height: 120px;
        border: 3px solid rgba(0, 255, 255, 0.4);
        border-radius: 50%;
        display: none;
        z-index: 1000;
        touch-action: none;
    `;

    const thumb = document.createElement('div');
    thumb.style.cssText = `
        position: absolute;
        width: 45px;
        height: 45px;
        background: rgba(0, 255, 255, 0.7);
        border-radius: 50%;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        box-shadow: 0 0 15px #00ffff;
    `;

    joystickContainer.appendChild(thumb);
    document.body.appendChild(joystickContainer);

    joystickBase = joystickContainer;
    joystickThumb = thumb;

    // Mostrar apenas em mobile
    if ('ontouchstart' in window) {
        joystickBase.style.display = 'block';
    }

    setupJoystickEvents();
}

function setupJoystickEvents() {
    let startX, startY;

    joystickBase.addEventListener('touchstart', (e) => {
        e.preventDefault();
        joystickActive = true;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        joystickCenterX = startX;
        joystickCenterY = startY;
    });

    document.addEventListener('touchmove', (e) => {
        if (!joystickActive) return;
        e.preventDefault();
        
        const touch = e.touches[0];
        let dx = touch.clientX - joystickCenterX;
        let dy = touch.clientY - joystickCenterY;

        const distance = Math.min(45, Math.sqrt(dx*dx + dy*dy));
        const angle = Math.atan2(dy, dx);

        dx = Math.cos(angle) * distance;
        dy = Math.sin(angle) * distance;

        joystickThumb.style.transform = `translate(${dx - 22.5}px, ${dy - 22.5}px)`;

        // Normaliza input (-1 a 1)
        window.moveInput.x = dx / 45;
        window.moveInput.y = dy / 45;
    });

    document.addEventListener('touchend', () => {
        if (!joystickActive) return;
        joystickActive = false;
        joystickThumb.style.transform = 'translate(-50%, -50%)';
        window.moveInput.x = 0;
        window.moveInput.y = 0;
    });
}

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

window.showLevelUp = function(level) {
    const existing = document.getElementById('level-up-card');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.id = 'level-up-card';
    card.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: rgba(0, 20, 40, 0.95); border: 3px solid #00ffff;
        padding: 30px 60px; border-radius: 15px; text-align: center;
        z-index: 10000; box-shadow: 0 0 40px #00ffff; color: white;
    `;
    card.innerHTML = `
        <h2 style="color:#00ffff; margin:0; font-size:28px;">NOVA ZONA ALCANÇADA</h2>
        <div style="font-size: 72px; font-weight: bold; margin: 15px 0; color:#00ffcc;">${level}</div>
    `;
    document.body.appendChild(card);

    setTimeout(() => { if (card.parentNode) card.remove(); }, 4500);
};

async function initGame() {
    await enemyManager.init();
    createVirtualJoystick();   // ← Adicionado aqui
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

// ... (o resto do animate, setupNexusSelector, event listeners permanecem iguais)

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.1);

    if (currentState === GAME_STATE.PLAYING) {
        const input = inputManager.update();

        player.update(input, deltaTime, enemyManager);

        if (spaceEnvironment) {
            spaceEnvironment.update(deltaTime, player.mesh.position, input);
        }

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

// ==================== EVENTOS ====================
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