import * as THREE from 'three';
import { unzipSync, strFromU8 } from 'fflate';
import { ScorePopup } from './ScorePopup.js';
import { SoundManager } from './SoundManager.js';
import { InputManager } from './InputManager.js';
import { Player } from './Player.js';
import { LaserManager } from './LaserManager.js';
import { EnemyManager } from './EnemyManager.js';
import { ExplosionManager } from './ExplosionManager.js';
import { SpaceEnvironment } from './SpaceEnvironment.js';
import { ProgressionManager } from './ProgressionManager.js';
import { PickupManager } from './PickupManager.js';

window.fflate = { unzipSync, strFromU8 };

// --- DECLARAÇÕES GLOBAIS ---
let audioInitialized = false;
let currentState = 'menu';
let score = 0;
const GAME_STATE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', GAME_OVER: 'game_over' };

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
const pickupManager = new PickupManager(scene);
window.pickupManager = pickupManager;

// --- FUNÇÕES DE APOIO ---
function updateCamera() {
    if (!player.mesh) return;
 
    const targetPosition = new THREE.Vector3(
        player.mesh.position.x * 0.5, 
        player.mesh.position.y + 10,  
        player.mesh.position.z + 40   
    );

    camera.position.lerp(targetPosition, 0.08);    

    camera.lookAt(player.mesh.position.x, player.mesh.position.y, player.mesh.position.z);
}

function updateHUD() {
    const scoreVal = document.getElementById('score-val');
    if (scoreVal) scoreVal.textContent = score.toString().padStart(7, '0');
}

async function initGame() {
    enemyManager.init(); 
    criarPainelDebugNivel(); // 🔥 Injetando a interface de testes assim que o jogo inicia
}

function startGame() {
    if (currentState === GAME_STATE.PLAYING) return;

    currentState = GAME_STATE.PLAYING;
    score = 0;

    document.getElementById('overlay').style.display = 'none';

    player.mesh.position.set(0, -1, 8);

    enemyManager.clearAllEnemies();
    
    // 🔥 CORREÇÃO 1: Passando o Nível Inicial Correto (1) em vez do Score zerado para criar a primeira onda
    enemyManager.spawnWave(player, progressionManager.getLevel());

    // 🚀 O GRAU: Força o motor a ligar/reiniciar sempre que uma partida nova começar
    if (audioInitialized) {
        soundManager.startShipEngine();
    }

    updateHUD();
    updateLevelHUD();
}

function updateLevelHUD() {
    const levelVal = document.getElementById('level-val');
    if (levelVal) {
        levelVal.textContent = progressionManager.getLevel();
    }
}
function criarPainelDebugNivel() {
    const debugContainer = document.createElement('div');
    debugContainer.id = 'debugPanel';
    
    // Estilização estilo "HUD Sci-Fi"
    debugContainer.style.cssText = `
        position: absolute;
        top: 20px;
        left: 20px;
        z-index: 99999;
        background: rgba(10, 10, 20, 0.75);
        backdrop-filter: blur(10px);
        padding: 16px;
        border-radius: 4px;
        border-left: 4px solid #ff3344;
        border-top: 1px solid #333;
        border-right: 1px solid #333;
        border-bottom: 1px solid #333;
        font-family: 'Courier New', Courier, monospace;
        color: #fff;
        box-shadow: 0 0 20px rgba(255, 51, 68, 0.2);
        cursor: default;
        transition: all 0.3s ease;
    `;

    debugContainer.innerHTML = `
        <div style="margin-bottom: 12px; font-weight: 800; color: #ff3344; letter-spacing: 2px; font-size: 14px; text-transform: uppercase; border-bottom: 1px solid #ff3344; padding-bottom: 5px;">
            🛸 NEXUS: SELETOR DE ZONA
        </div>
        <select id="debugLevelSelect" style="
            background: #050505; 
            color: #ff3344; 
            border: 1px solid #ff3344; 
            padding: 8px; 
            width: 100%; 
            cursor: pointer; 
            font-family: inherit; 
            font-weight: bold;
            outline: none;
            transition: 0.2s;
        ">
            <option value="1">ZONA 01: SETOR ALPHA</option>
            <option value="21">ZONA 21: GIGANTES TIPO 05</option>
            <option value="31">ZONA 31: GIGANTES TIPO 10</option>
            <option value="51">ZONA 51: GIGANTES TIPO 15</option>
        </select>
        <div style="margin-top: 10px; font-size: 10px; color: #888; opacity: 0.8;">SISTEMA DE TESTE DE NÍVEIS ATIVO</div>
    `;

    document.body.appendChild(debugContainer);

    // Efeito Hover no Dropdown
    const select = document.getElementById('debugLevelSelect');
    select.onmouseover = () => { select.style.background = '#1a0a0a'; };
    select.onmouseout = () => { select.style.background = '#050505'; };

    select.addEventListener('change', (e) => {
        const nivelSelecionado = parseInt(e.target.value);
        
        // Efeito de feedback visual rápido
        debugContainer.style.borderColor = '#00ffcc';
        setTimeout(() => debugContainer.style.borderColor = '#ff3344', 500);

        progressionManager.getLevel = () => nivelSelecionado;
        updateLevelHUD();
        
        if (currentState === GAME_STATE.PLAYING && enemyManager) {
            enemyManager.clearAllEnemies();
            enemyManager.spawnWave(player, nivelSelecionado);
        }
        
        console.log(`%c🚀 [NEXUS] Nível alterado para: ${nivelSelecionado}`, 'color: #ff3344; font-weight: bold;');
    });
}

// --- LOOP PRINCIPAL ATUALIZADO ---
function animate() {
    requestAnimationFrame(animate);

    // 1. Calculamos o tempo no início de tudo
    const deltaTime = Math.min(clock.getDelta(), 0.1);

    if (currentState === GAME_STATE.PLAYING) {
        const input = inputManager.update();

        // 2. Atualiza o Jogador (que também processa o PDC)
        player.update(input, deltaTime, enemyManager);

        // 3. Atualiza o Ambiente
        if (spaceEnvironment && typeof spaceEnvironment.update === 'function') {
            spaceEnvironment.update(deltaTime * 10.0);
        }

        // 4. Atualiza os Inimigos (ÚNICA CHAMADA)
        // Aqui dentro o inimigo dropa itens via window.pickupManager
        enemyManager.update(
            laserManager,
            (pts, enemyPosition) => {
                // Lógica de Score unificada
                score += pts;
                const levelUp = progressionManager.addScore(pts);
                updateHUD();

                if (enemyPosition) {
                    scorePopup.show(pts, enemyPosition);
                }

                if (levelUp) {
                    updateLevelHUD();
                    enemyManager.enemySpeed *= 1.10;
                    enemyManager.maxEnemiesOnScreen += 1;
                    enemyManager.waveCooldown *= 0.95;
                }
            },
            player,
            deltaTime,
            explosionManager,
            soundManager,
            progressionManager.getLevel() // Nível real do jogo
        );

        // 5. Atualiza o PickupManager (coleta de reparos)
        pickupManager.update(deltaTime, player);

        // 6. Finaliza os sistemas
        laserManager.update(deltaTime);
        explosionManager.update(deltaTime);
        scorePopup.update(deltaTime);
        updateCamera();
    }

    renderer.render(scene, camera);
}

function onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
}

function updateOrientationUI() {
    const isPortrait = window.innerHeight > window.innerWidth;

    document.body.classList.toggle('portrait', isPortrait);
    document.body.classList.toggle('landscape', !isPortrait);
}

window.addEventListener('resize', () => {
    onResize();
    updateOrientationUI();
});

window.addEventListener('DOMContentLoaded', () => {

    updateOrientationUI();
    onResize();

    document.getElementById('start-btn')?.addEventListener('click', () => {
        if(!audioInitialized) {
            soundManager.init();
            audioInitialized = true;
        }
        
        // 🚀 LIGA O MOTOR AQUI: Ativa o som contínuo aproveitando o clique de start do usuário!
        soundManager.startShipEngine();
        
        startGame();
    });

    initGame().then(() => animate());
});