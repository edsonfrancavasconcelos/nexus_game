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

function updateCamera() {
    if (!player.shipModel) return;

    // Aumente o valor de -50 para algo maior, como -80 ou -100
    // O valor Y (15) controla a altura, pode manter ou ajustar se quiser.
    const offset = new THREE.Vector3(0, 15, -80); 
    
    // Aplica a rotação da nave no offset
    offset.applyQuaternion(player.shipModel.quaternion);

    // Calcula a posição alvo
    const targetPosition = new THREE.Vector3().copy(player.shipModel.position).add(offset);

    // O lerp mantém o movimento suave
    camera.position.lerp(targetPosition, 0.08);    

    // Olha para a nave
    camera.lookAt(player.shipModel.position);
}

function updateHUD() {
    const scoreVal = document.getElementById('score-val');
    if (scoreVal) scoreVal.textContent = score.toString().padStart(7, '0');
}

async function initGame() {
    enemyManager.init(); 
    setupNexusSelector(); // Nome mais adequado
}

function startGame(level) {
    if (currentState === GAME_STATE.PLAYING) return;

    currentState = GAME_STATE.PLAYING;
    score = 0;

   document.getElementById('overlay').style.display = 'none';
    document.getElementById('nexusSelector').style.display = 'none';

    const nexusSelector = document.getElementById('nexusSelector');
    if (nexusSelector) {
        nexusSelector.style.display = 'none';
    }

 player.mesh.position.set(0, -1, 8);
    enemyManager.clearAllEnemies();

    enemyManager.spawnWave(
        player,
        progressionManager.getLevel()
    );

    if (audioInitialized) {
        soundManager.startShipEngine();
    }

updateHUD();
    document.getElementById('level-val').textContent = level;
}

function updateLevelHUD() {
    const levelVal = document.getElementById('level-val');
    if (levelVal) {
        levelVal.textContent = progressionManager.getLevel();
    }
}
function criarPainelDebugNivel() {
   function criarPainelDebugNivel() {

    const debugContainer = document.getElementById('nexusSelector');

    const select = document.getElementById('debugLevelSelect');

    if (!debugContainer || !select) {
        console.error('Nexus Selector não encontrado.');
        return;
    }

    select.addEventListener('change', (e) => {
        const nivelSelecionado = parseInt(e.target.value);

        debugContainer.style.borderColor = '#00ffcc';

        setTimeout(() => {
            debugContainer.style.borderColor = '#ff3344';
        }, 500);

        progressionManager.getLevel = () => nivelSelecionado;

        updateLevelHUD();

        if (currentState === GAME_STATE.PLAYING && enemyManager) {
            enemyManager.clearAllEnemies();
            enemyManager.spawnWave(player, nivelSelecionado);
        }

        console.log(
            `%c🚀 [NEXUS] Nível alterado para: ${nivelSelecionado}`,
            'color: #ff3344; font-weight: bold;'
        );
    });
}

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

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.1);

    // Movimentação da câmera (cockpit)
    if (player.shipModel && player.cockpitView) {
        const camPos = new THREE.Vector3();
        player.cockpitView.getWorldPosition(camPos);
        camera.position.lerp(camPos, 0.5);
        camera.quaternion.slerp(player.shipModel.getWorldQuaternion(new THREE.Quaternion()), 0.5);
    }

    if (currentState === GAME_STATE.PLAYING) {
        const input = inputManager.update(); // Pega o input atualizado

        // Atualiza Jogador
        player.update(input, deltaTime, enemyManager);

        // Atualiza Ambiente passando o input (isso faz girar o disco)
        if (spaceEnvironment) {
            spaceEnvironment.update(deltaTime, player.mesh.position, input);
        }

        // Atualiza Inimigos
        enemyManager.update(
            laserManager,
            (pts, enemyPosition) => {
                score += pts;
                const levelUp = progressionManager.addScore(pts);
                updateHUD();
                if (enemyPosition) scorePopup.show(pts, enemyPosition);
                if (levelUp) {
                    updateLevelHUD();
                    enemyManager.enemySpeed *= 1.10;
                    enemyManager.maxEnemiesOnScreen += 1;
                    enemyManager.waveCooldown *= 0.95;
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

// Dentro do seu src/index.js

window.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const nexusSelector = document.getElementById('nexusSelector');
    const debugLevelSelect = document.getElementById('debugLevelSelect');

    startBtn.addEventListener('click', () => {
        // 1. Captura o nível escolhido
        const level = parseInt(debugLevelSelect.value);
        
        // 2. Esconde a UI do Nexus e o Overlay
        nexusSelector.style.display = 'none';
        document.getElementById('overlay').style.display = 'none';

        // 3. Inicia o jogo passando o nível
        startGame(level);
    });
});

function setupNexusSelector() {
    const debugContainer = document.getElementById('nexusSelector');
    const select = document.getElementById('debugLevelSelect');

    if (!debugContainer || !select) return;

    select.addEventListener('change', (e) => {
        const nivelSelecionado = parseInt(e.target.value);
        progressionManager.getLevel = () => nivelSelecionado;
        document.getElementById('level-val').textContent = nivelSelecionado;

        if (currentState === GAME_STATE.PLAYING) {
            enemyManager.clearAllEnemies();
            enemyManager.spawnWave(player, nivelSelecionado);
        }
    });
}

window.addEventListener('resize', () => {
    // Atualiza a proporção da câmera
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    // Atualiza o tamanho do renderizador
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Melhora a nitidez
});

window.addEventListener('DOMContentLoaded', () => {
    onResize();

    // Botões
    document.getElementById('start-btn').addEventListener('click', () => {
        if (!audioInitialized) {
            soundManager.init();
            audioInitialized = true;
        }
        soundManager.startShipEngine();
        
        // Pega o nível atual do seletor
        const level = parseInt(document.getElementById('debugLevelSelect').value);
        startGame(level);
    });   
    

    const btnPDC = document.getElementById('btnPDC');
    if (btnPDC) {
        btnPDC.addEventListener('click', (e) => {
            const active = player.togglePDC();
            e.target.style.opacity = active ? "1" : "0.5";
            e.target.style.border = active ? "2px solid #00ff00" : "2px solid #555555";
        });
    }

    const btnShoot = document.getElementById('btnShoot');
    if (btnShoot) {
        btnShoot.addEventListener('pointerdown', () => player.isFiring = true);
        btnShoot.addEventListener('pointerup', () => player.isFiring = false);
    }

    const btnPause = document.getElementById('btnPause');
    if (btnPause) {
        btnPause.addEventListener('click', () => {
            currentState = (currentState === GAME_STATE.PLAYING) ? GAME_STATE.PAUSED : GAME_STATE.PLAYING;
        });
    }

    // 3. Botão Start (Lógica do Motor e Início)
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (!audioInitialized) {
                soundManager.init();
                audioInitialized = true;
            }
            
            // 🚀 Liga o motor após o clique do usuário (necessário para navegadores)
            soundManager.startShipEngine();
            
            startGame();
            
            const nexusSelector = document.getElementById('nexusSelector');
            if (nexusSelector) {
                nexusSelector.style.display = 'none';
            }
        });
    }

    // 4. Inicializa o jogo e o loop principal somente após carregar tudo
    initGame().then(() => animate()); 
});