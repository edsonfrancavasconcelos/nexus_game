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
const laserManager = new LaserManager(scene, soundManager); 
const player = new Player(scene, laserManager);
const inputManager = new InputManager();

// Crie o ScorePopup primeiro, pois o EnemyManager precisa dele
const scorePopup = new ScorePopup(scene, camera);

// Agora o enemyManager pode usar a variável scorePopup sem erros
const enemyManager = new EnemyManager(scene, camera, scorePopup);

const explosionManager = new ExplosionManager(scene, soundManager); 
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
}

function startGame() {
    if (currentState === GAME_STATE.PLAYING) return;

    currentState = GAME_STATE.PLAYING;
    score = 0;

    document.getElementById('overlay').style.display = 'none';

    player.mesh.position.set(0, -1, 8);

    enemyManager.clearAllEnemies();
    enemyManager.spawnWave(player);

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

// --- LOOP PRINCIPAL ATUALIZADO ---
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.1);

    if (currentState === GAME_STATE.PLAYING) {
        const input = inputManager.update();

        player.update(input, deltaTime);
        
        // Atualiza o ambiente espacial (nebulosa/estrelas)
        if (spaceEnvironment && typeof spaceEnvironment.update === 'function') {
            spaceEnvironment.update(deltaTime);
        }

        // Deixamos o EnemyManager rodar a colisão comparando as posições atuais
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
            soundManager
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