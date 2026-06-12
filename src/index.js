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
    criarPainelDebugNivel();
}

function startGame() {
    if (currentState === GAME_STATE.PLAYING) return;

    currentState = GAME_STATE.PLAYING;
    score = 0;

    document.getElementById('overlay').style.display = 'none';

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
    updateLevelHUD();
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

// --- LOOP PRINCIPAL ATUALIZADO ---
function animate() {
    requestAnimationFrame(animate);
    if (player.shipModel && player.cockpitView) {
        // A câmera agora "cola" no cockpit da nave
        const camPos = new THREE.Vector3();
        player.cockpitView.getWorldPosition(camPos);
        camera.position.lerp(camPos, 0.5); // lerp suaviza o movimento
        
        // Faz a câmera olhar para onde a nave está indo
        camera.quaternion.slerp(player.shipModel.getWorldQuaternion(new THREE.Quaternion()), 0.5);
    }

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

    // --- CONFIGURAÇÃO DOS NOVOS BOTÕES ---
    
    // Adicionamos uma verificação 'if' para evitar erros se o botão não for encontrado
    const btnMissile = document.getElementById('btnMissile');
    if (btnMissile) {
        btnMissile.addEventListener('click', () => {
            console.log("Míssil disparado!");
            player.fireMissile(); 
        });
    }

    const btnPDC = document.getElementById('btnPDC');
    if (btnPDC) {
        btnPDC.addEventListener('click', (e) => {
            const active = player.togglePDC();
            // Muda a opacidade para dar feedback visual de Ligado/Desligado
            e.target.style.opacity = active ? "1" : "0.5";
            // Opcional: mudar a borda para ficar mais claro
            e.target.style.border = active ? "2px solid #00ff00" : "2px solid #555555";
        });
    }
});

    document.getElementById('btnShoot').addEventListener('pointerdown', () => player.isFiring = true);
    document.getElementById('btnShoot').addEventListener('pointerup', () => player.isFiring = false);

    document.getElementById('btnPause').addEventListener('click', () => {
        currentState = (currentState === GAME_STATE.PLAYING) ? GAME_STATE.PAUSED : GAME_STATE.PLAYING;
    });

    // --- LÓGICA EXISTENTE DO START ---
    document.getElementById('start-btn')?.addEventListener('click', () => {
        // ... seu código de start atual ...
    });
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
        const nexusSelector = document.getElementById('nexusSelector');
if (nexusSelector) {
    nexusSelector.style.display = 'none';
}
    });

    initGame().then(() => animate());
