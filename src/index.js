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

// --- 🛠️ INTERFACE DO SELETOR DE NÍVEIS (DEBUG) ---
function criarPainelDebugNivel() {
    const debugContainer = document.createElement('div');
    debugContainer.style.position = 'absolute';
    debugContainer.style.top = '20px';
    debugContainer.style.left = '20px';
    debugContainer.style.zIndex = '99999';
    debugContainer.style.background = 'rgba(5, 5, 15, 0.9)';
    debugContainer.style.padding = '12px';
    debugContainer.style.borderRadius = '8px';
    debugContainer.style.border = '2px solid #ff3344';
    debugContainer.style.fontFamily = 'monospace';
    debugContainer.style.color = '#fff';
    debugContainer.style.boxShadow = '0 0 15px rgba(255, 51, 68, 0.4)';

    debugContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-weight: bold; color: #ff3344; letter-spacing: 1px;">🛸 NEXUS DEBUG PANEL</div>
        <select id="debugLevelSelect" style="background: #111; color: #fff; border: 1px solid #ff3344; padding: 6px; width: 100%; cursor: pointer; font-family: monospace; border-radius: 4px;">
            <option value="1">Nível 1 (Naves Base)</option>
            <option value="21">Nível 21 (Naves Gigantes Tipo 5)</option>
            <option value="31">Nível 31 (Naves Gigantes Tipo 10)</option>
            <option value="51">Nível 51 (Naves Gigantes Tipo 15)</option>
        </select>
    `;

    document.body.appendChild(debugContainer);

    document.getElementById('debugLevelSelect').addEventListener('change', (e) => {
        const nivelSelecionado = parseInt(e.target.value);
        
        // Força o progressionManager a retornar o nível escolhido alterando o método getLevel dinamicamente
        progressionManager.getLevel = () => nivelSelecionado;
        
        // Atualiza o HUD visual do jogo
        updateLevelHUD();
        
        // Limpa as naves antigas da tela para nascerem as novas imediatamente se o jogo estiver rodando
        if (currentState === GAME_STATE.PLAYING && enemyManager) {
            enemyManager.clearAllEnemies();
            enemyManager.spawnWave(player, nivelSelecionado);
        }
        
        console.log(`🛠️ [DEBUG] Nível forçado com sucesso para: ${nivelSelecionado}`);
    });
}

// --- LOOP PRINCIPAL ATUALIZADO ---
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.1);

    if (currentState === GAME_STATE.PLAYING) {
        const input = inputManager.update();

        // 🔥 CORREÇÃO 2: Injetando o 'enemyManager' no update do Player para ativar o PDC autônomo!
        player.update(input, deltaTime, enemyManager); 
        
        // --- Atualiza o ambiente espacial (nebulosa/estrelas) ---
        if (spaceEnvironment && typeof spaceEnvironment.update === 'function') {      
            const velocidadeCenario = deltaTime * 10.0; 
            spaceEnvironment.update(velocidadeCenario);
        }

        // --- LOOP DO ENEMY MANAGER ---
        enemyManager.update(
            laserManager,
            (pts, enemyPosition) => {
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
                    console.log(`LEVEL ${progressionManager.getLevel()}`);
                }
            },
            player,
            deltaTime,
            explosionManager,
            soundManager,
            progressionManager.getLevel() // 🔥 CORREÇÃO 3: Passando o Level Real do jogo em vez do score total!
        );

        // Atualiza os lasers depois de processar as colisões do frame
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