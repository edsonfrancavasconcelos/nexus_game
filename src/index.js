import * as THREE from 'three';
import { setScoreHandler } from './Scoring.js';
import { ScorePopup } from './ScorePopup.js';
import { SoundManager } from './SoundManager.js';
import { InputManager } from './InputManager.js';
import { Player } from './Player.js';
import { ChaseCamera } from './flight/ChaseCamera.js';
import { FlightAssist } from './flight/FlightAssist.js';
import { ShipFlight } from './flight/ShipFlight.js';
import { FlightCollision } from './flight/FlightCollision.js';
import { FlightDebug } from './flight/FlightDebug.js';
import { FireDebug } from './flight/FireDebug.js';
import { CollisionDebug } from './flight/CollisionDebug.js';
import { FlightTestMode } from './flight/FlightTestMode.js';
import { WorldObstacles } from './environments/WorldObstacles.js';
import { LaserManager } from './LaserManager.js';
import { ProjectileImpacts } from './flight/ProjectileImpacts.js';
import { EnemyDamageFX } from './flight/EnemyDamageFX.js';
import { ClimbCinematic } from './flight/ClimbCinematic.js';
import { ManhattanLandmarks } from './environments/ManhattanLandmarks.js';
import { EnemyManager } from './EnemyManager.js';
import { ExplosionManager } from './ExplosionManager.js';
import { SpaceEnvironment } from './SpaceEnvironment.js';
import { ProgressionManager } from './ProgressionManager.js';
import { getLevelData } from './getLevelData.js';
import { NaveMae } from './NaveMae.js';
import { PerfMonitor } from './PerfMonitor.js';
import { BloomPipeline } from './BloomPipeline.js';
import { detectQualityProfile } from './QualityProfile.js';

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
let lastBossNarrativePhase = 0;

const GAME_STATE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused' };
const isCoarsePointer = matchMedia('(pointer: coarse)').matches;
const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || isCoarsePointer
    || window.innerWidth < 900;
const quality = detectQualityProfile(isMobileDevice);
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
        pixelRatio: Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio)
    };
};

// ====================== THREE.JS ======================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010103);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, quality.far);
camera.position.set(0, 5, 55);

const clock = new THREE.Clock();
const renderer = new THREE.WebGLRenderer({
    antialias: quality.bloom === 0 && !isMobileDevice,
    powerPreference: isMobileDevice ? "default" : "high-performance"
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = isMobileDevice ? 1.08 : 1.18;

let resizeTimer = null;
let dynamicPixelRatio = null;
const applyViewportSettings = () => {
    const viewport = getViewportState();
    document.body.dataset.orientation = viewport.portrait ? 'portrait' : 'landscape';
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(dynamicPixelRatio ? Math.min(dynamicPixelRatio, viewport.pixelRatio) : viewport.pixelRatio);
    renderer.setSize(viewport.width, viewport.height, false);
    bloomPipeline?.setSize(viewport.width, viewport.height, renderer.getPixelRatio());
};

let bloomPipeline = null;
applyViewportSettings();
if (quality.bloom > 0) {
    bloomPipeline = new BloomPipeline(renderer, scene, camera, {
        strength: quality.bloom,
        msaaSamples: quality.msaa,
        resolutionScale: isMobileDevice ? 0.35 : 0.5
    });
    applyViewportSettings();
}
const renderFrame = () => (bloomPipeline ? bloomPipeline.render() : renderer.render(scene, camera));
document.body.appendChild(renderer.domElement);

const perfMonitor = new PerfMonitor(renderer, scene, {
    isMobile: isMobileDevice,
    minPixelRatio: quality.minPixelRatio,
    maxPixelRatio: getViewportState().pixelRatio,
    onScaleChange: (ratio) => { dynamicPixelRatio = ratio; applyViewportSettings(); }
});

// ====================== INSTÂNCIAS ======================
const soundManager = new SoundManager();
window.soundManager = soundManager;

const laserManager = new LaserManager(scene, soundManager);
const explosionManager = new ExplosionManager(scene, soundManager, isMobileDevice);
window.explosionManager = explosionManager;
explosionManager.camera = camera;
explosionManager.maxActiveExplosions = quality.maxExplosions;

const inputManager = new InputManager();
const scorePopup = new ScorePopup(scene, camera);
const player = new Player(scene, laserManager, explosionManager);
player.applyQuality({ renderer, shadows: quality.shipShadows, mobile: isMobileDevice });
const enemyManager = new EnemyManager(scene, camera, scorePopup, isMobileDevice);
enemyManager.maxEnemiesOnScreen = quality.maxEnemies;
const spaceEnvironment = new SpaceEnvironment(scene, quality.stars, quality.clouds, quality.far);
spaceEnvironment.attachPost(bloomPipeline);
const progressionManager = new ProgressionManager();
let naveMae = new NaveMae(scene);

// ====================== HELPERS ======================
function syncLevelResources() {
    player.setLevelLoadout(progressionManager.getLevelLoadout());
    updateResourceHUD();
}

const _domCache = new Map();
const $id = (id) => {
    let el = _domCache.get(id);
    if (!el) { el = document.getElementById(id); if (el) _domCache.set(id, el); }
    return el;
};
const _hudLast = {};
const setText = (el, key, value) => {
    if (!el || _hudLast[key] === value) return;
    _hudLast[key] = value;
    el.textContent = value;
};
const setStyle = (el, key, prop, value) => {
    if (!el || _hudLast[key] === value) return;
    _hudLast[key] = value;
    el.style[prop] = value;
};

function updateHUD() {
    setText($id('score-val'), 'score', score.toString().padStart(7, '0'));
    updateLevelProgressHUD();
}

function updateLevelHUD() {
    setText($id('level-val'), 'level', progressionManager.getLevel());
}

function updateLevelProgressHUD() {
    const progress = progressionManager.getProgressPercent();
    setStyle($id('level-progress-bar'), 'lpb', 'width', `${Math.max(0, Math.min(100, progress * 100))}%`);
    setText($id('level-progress-label'), 'lpl', `${Math.round(progress * 100)}%`);
}

function updateResourceHUD() {
    const ammo = player.getAmmoStatus();
    setText($id('missile-val'), 'missile', ammo.missiles);
    setText($id('pdc-val'), 'pdc', ammo.pdcBursts);
    setText($id('chance-val'), 'chance', progressionManager.getChancesLeft());

    const chargeBar = $id('missile-load-bar');
    if (chargeBar) {
        const progress = Math.max(0, Math.min(1, ammo.missileReloadProgress));
        setStyle(chargeBar, 'mlb', 'width', `${Math.round(progress * 100)}%`);
        setStyle(chargeBar, 'mlbo', 'opacity', ammo.missiles >= ammo.missileMax ? '0.4' : '1');
    }

    const pdcBar = $id('pdc-load-bar');
    if (pdcBar) {
        const pdcProgress = player.maxPdcBursts === Infinity ? 1 : Math.max(0, Math.min(1, (player.pdcBurstCount || 0) / Math.max(player.maxPdcBursts || 1, 1)));
        setStyle(pdcBar, 'plb', 'width', `${pdcProgress * 100}%`);
    }
}

function updateEnvironmentTheme(level = progressionManager.getLevel(), instant = false) {
    if (spaceEnvironment?.setLevelTheme) spaceEnvironment.setLevelTheme(level, instant);
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

const missionBriefings = {
    1: ['PATRULHA DE RECONHECIMENTO', 'Elimine as unidades hostis e descubra a origem da invasão.'],
    2: ['MISSÃO 2', 'Esquadrão de drones autônomos detectado na fronteira.'],
    3: ['MISSÃO 3', 'Sinais de comando hostis convergem para este setor.'],
    4: ['MISSÃO 4', 'Patrulhas da Federação perderam contato. Continue avançando.'],
    5: ['MISSÃO 5', 'Colônias próximas sob ataque. Elimine as unidades hostis.'],
    6: ['MISSÃO 6', 'Transmissão fragmentada confirma: os ataques são coordenados pela NEXUS.'],
    20: ['CAPÍTULO 2 — ZONA DE GUERRA', 'Cruzadores e interceptadores autônomos defendem a linha de frente.'],
    33: ['CAPÍTULO 3 — CINTURÃO DE ASTEROIDES', 'A NEXUS prepara emboscadas ao longo da rota para o núcleo.'],
    50: ['CAPÍTULO 4 — MUNDO INDUSTRIAL', 'Localize as fábricas de guerra e interrompa a produção de drones.'],
    75: ['CAPÍTULO 5 — CORAÇÃO DA IA', 'A fortaleza da NEXUS está à frente. Defesas orbitais detectadas.'],
    100: ['CAPÍTULO FINAL — RAPTOR STRIKE', 'A Nave-Mãe protege o núcleo central. Prepare-se para o confronto final.']
};
let combatMessageTimer = null;
let campaignEndingShown = false;

function showCombatMessage(title, message, briefing = false, duration = 2200) {
    const panel = $id('combat-message');
    const titleElement = $id('combat-message-title');
    const bodyElement = $id('combat-message-body');
    if (!panel || !titleElement || !bodyElement) return;

    titleElement.textContent = title;
    bodyElement.textContent = message;
    panel.classList.toggle('briefing', briefing);
    panel.classList.toggle('alert', !briefing && /ALERTA/.test(title));
    panel.classList.add('visible');
    clearTimeout(combatMessageTimer);
    combatMessageTimer = setTimeout(() => panel.classList.remove('visible'), duration);
}

function showMissionBriefing(level) {
    const data = getLevelData(level);
    const [title, message] = missionBriefings[level] || [
        `MISSÃO ${level}`,
        data.task
    ];
    showCombatMessage(title, message, true, 2800);
}

function showCampaignEnding() {
    if (campaignEndingShown) return;
    campaignEndingShown = true;
    currentState = GAME_STATE.PAUSED;
    soundManager.stopShipEngine();

    const ending = $id('campaign-ending');
    const choices = $id('campaign-ending-choices');
    const prompt = $id('campaign-ending-prompt');
    const result = $id('campaign-ending-result');
    if (!ending || !choices || !prompt || !result) return;

    choices.hidden = false;
    result.hidden = true;
    prompt.textContent = 'Com o núcleo vulnerável, a decisão final é sua. O que fará com a NEXUS?';
    ending.setAttribute('aria-hidden', 'false');
    ending.classList.add('visible');
    choices.querySelector('button')?.focus();
}

function chooseCampaignEnding(choice) {
    const choices = $id('campaign-ending-choices');
    const prompt = $id('campaign-ending-prompt');
    const result = $id('campaign-ending-result');
    if (!choices || !prompt || !result || result.dataset.chosen) return;

    result.dataset.chosen = choice;
    choices.hidden = true;
    prompt.textContent = choice === 'destroy'
        ? 'NEXUS: núcleo desativado.'
        : 'NEXUS: integração concluída. Novo comandante identificado.';
    result.textContent = choice === 'destroy'
        ? 'As frotas autônomas são desativadas. A humanidade recupera seus mundos e inicia a reconstrução. A galáxia tem uma nova chance de viver em paz.'
        : 'A guerra termina quando você integra os sistemas da NEXUS ao Raptor Strike TS. A tela escurece. Uma nova ameaça é detectada além da galáxia. Continua...';
    result.hidden = false;
}

window.showLevelUp = function (level, message) {
    const existing = document.getElementById('level-up-card');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.id = 'level-up-card';
    card.setAttribute('role', 'status');
    card.innerHTML = `
        <span class="lu-title">Zona alcançada</span><span class="lu-level">${level}</span>
        <div class="lu-msg">${message || ''}</div>
    `;
    document.body.appendChild(card);
    requestAnimationFrame(() => card.classList.add('visible'));
    setTimeout(() => card.classList.remove('visible'), 2200);
    setTimeout(() => card.remove(), 2700);
};

// ====================== SCORE / HIT ======================
let enemiesDestroyed = 0;
const handleEnemyScore = (pts, hitPosition) => {
    score += pts;
    enemiesDestroyed++;
    window.enemiesDestroyed = enemiesDestroyed;
    updateHUD();
    if (enemiesDestroyed % 5 === 0) {
        showCombatMessage('COMUNICAÇÃO DE COMBATE', 'Excelente trabalho. Objetivo eliminado.');
    }

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

let damageVisualTimer = 0;
let damageVisualDirection = 1;
let cinematicShakeTimer = 0;
let cinematicShakeStrength = 0;
let hitModelBasePosition = null;
const handlePlayerHit = (hitPosition = null) => {
    progressionManager.loseChance();
    updateResourceHUD();
    damageVisualTimer = 0.24;
    damageVisualDirection = Math.random() < 0.5 ? -1 : 1;
    if (player.shipModel && !hitModelBasePosition) {
        hitModelBasePosition = player.shipModel.position.clone();
    }
    const flash = $id('damage-flash');
    if (flash) {
        flash.classList.remove('active');
        void flash.offsetWidth;
        flash.classList.add('active');
    }
    soundManager.play('enemyLaser');
    explosionManager.create(hitPosition || player.mesh.position.clone(), {
        kind: 'damage',
        scale: 0.55,
        flashColor: 0xff3545,
        lightColor: 0xff1828
    });
    showCombatMessage('ALERTA DE COMBATE', 'Escudos comprometidos!');
};
setScoreHandler(handleEnemyScore, scorePopup);

const _camOffset = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _camLookDelta = new THREE.Vector3(0, 2, -5);
const flightPath = spaceEnvironment.biomes.flight;
const flightAssist = new FlightAssist();
const shipFlight = new ShipFlight();
const flightCollision = new FlightCollision(shipFlight);
spaceEnvironment.biomes.ship = shipFlight;
// Altitude real e colisão futura: a sonda de chão só informa a altura; hitsGround() não é chamada ainda.
shipFlight.setGroundProbe((x, z) => spaceEnvironment.biomes.groundHeightAt(x, z));
flightCollision.setGroundProbe((x, z) => spaceEnvironment.biomes.groundHeightAt(x, z));
flightCollision.setObstacles(new WorldObstacles(spaceEnvironment.biomes));
const flightDebug = new FlightDebug(scene, shipFlight, flightCollision, spaceEnvironment.biomes);
const fireDebug = new FireDebug(scene, player);
const projectileImpacts = new ProjectileImpacts(scene, laserManager, flightCollision.obstacles, explosionManager);
const enemyDamageFX = new EnemyDamageFX(enemyManager, projectileImpacts);
const collisionDebug = new CollisionDebug(scene, flightCollision, shipFlight);
let collisionFitted = false;
enemyManager.ship = shipFlight;
player.shipFlight = shipFlight;
player.flight = flightPath;
enemyManager.flightPath = flightPath;
const chaseCamera = new ChaseCamera(camera);
const climbCinematic = new ClimbCinematic(camera);
const manhattanLandmarks = new ManhattanLandmarks(scene, spaceEnvironment.biomes);
const flightTest = new FlightTestMode({
    scene, biomes: spaceEnvironment.biomes, ship: shipFlight, collision: flightCollision,
    obstacles: flightCollision.obstacles, chaseCamera, enemyManager, explosionManager, debug: flightDebug
});
const _cameraShakeOffset = new THREE.Vector3();
explosionManager.onCinematicImpact = (strength) => {
    cinematicShakeTimer = Math.max(cinematicShakeTimer, 0.28);
    cinematicShakeStrength = Math.max(cinematicShakeStrength, strength);
};

function updateCamera(deltaTime) {
    if (!player.shipModel) return;
    if (!hitModelBasePosition) hitModelBasePosition = player.shipModel.position.clone();

    if (damageVisualTimer > 0) damageVisualTimer = Math.max(0, damageVisualTimer - deltaTime);
    if (cinematicShakeTimer > 0) {
        cinematicShakeTimer = Math.max(0, cinematicShakeTimer - deltaTime);
        if (cinematicShakeTimer === 0) cinematicShakeStrength = 0;
    }
    const shakeStrength = damageVisualTimer > 0 ? damageVisualTimer / 0.24 : 0;
    player.shipModel.position.copy(hitModelBasePosition);
    player.shipModel.position.x += damageVisualDirection * 0.85 * shakeStrength;
    player.shipModel.position.y -= 0.2 * shakeStrength;
    const impactStrength = cinematicShakeTimer > 0
        ? (cinematicShakeTimer / 0.28) * cinematicShakeStrength
        : 0;
    _cameraShakeOffset.set(
        Math.sin(performance.now() * 0.13) * (1.6 * shakeStrength + impactStrength),
        Math.cos(performance.now() * 0.17) * (1.2 * shakeStrength + impactStrength * 0.72),
        0
    );
    const dtCam = Math.min(deltaTime, 0.1);
    player.worldPosition.copy(shipFlight.worldPosition);
    chaseCamera.speedFactor = flightAssist.speedFactor;
    chaseCamera.altitudeNorm = shipFlight.altitudeNorm;
    chaseCamera.pitchNorm = shipFlight.pitchCmd;
    spaceEnvironment.biomes.flightBoost = Math.min(1, Math.hypot(player.velocity.x, player.velocity.y) / 7.8 + Math.max(flightAssist.speedFactor - 1, 0) * 4);
    chaseCamera.update(dtCam, player.mesh.position, player.velocity, flightPath, null, _cameraShakeOffset);
    climbCinematic.apply(dtCam, shipFlight.climbRate, chaseCamera.fov);
}

// ====================== ANIMATE ======================
let wasPlaying = false;
let lastCountdownShown = null;
let combatCommsCooldown = 0;
function animate() {
    requestAnimationFrame(animate);
    if (currentState !== GAME_STATE.PLAYING) { wasPlaying = false; return; }
    if (!wasPlaying) { clock.getDelta(); wasPlaying = true; }
    const deltaTime = Math.min(clock.getDelta(), 0.1);

    // Countdown inicial
    if (!isGameStarted) {
        countdown -= deltaTime;
        const display = document.getElementById('countdown-display');
        if (display) {
            const num = Math.ceil(countdown);
            if (num !== lastCountdownShown) {
                lastCountdownShown = num;
                display.innerText = num > 0 ? num : '';
            }
            if (num <= 0) {
                isGameStarted = true;
                display.style.display = 'none';

                const nivelInicial = progressionManager.getLevel();
                if (!flightTest.enabled) enemyManager.spawnWave(player, nivelInicial);
                updateLevelUI(nivelInicial);
                if (!flightTest.enabled) showMissionBriefing(nivelInicial);
                updateEnvironmentTheme(nivelInicial, true);
                flightTest.begin();
                progressionManager.resetLevelResources();
                syncLevelResources();

                if (audioInitialized) soundManager.startShipEngine();
            }
        }
        renderFrame();
        return;
    }

    const currentLevel = progressionManager.getLevel();
    window.currentLevel = currentLevel;
    if (currentLevel >= 45) naveMae.preload?.();

    // Input
    const keyboardInput = inputManager.update(deltaTime);
    const input = {
        x: window.moveInput.x !== 0 ? window.moveInput.x : keyboardInput.x,
        y: window.moveInput.y !== 0 ? window.moveInput.y : keyboardInput.y
    };
    flightTest.assist(input);

    player.update(input, deltaTime, enemyManager, handlePlayerHit, handleEnemyScore);

    // Voo real: a nave avança pelo mundo; o ambiente e os inimigos usam essa posição como referência.
    const dtFlight = Math.min(deltaTime, 0.1);
    flightAssist.update(dtFlight, player.velocity);
    spaceEnvironment.biomes.speedScale = flightAssist.speedFactor;
    shipFlight.update(dtFlight, player.velocity, spaceEnvironment.biomes.speed, player.mesh.position, input.y);
    const originDx = shipFlight.originShiftX;
    const originDy = shipFlight.originShiftY;
    enemyManager.shiftWorld(originDx, originDy);
    laserManager.shiftWorld(originDx, originDy);
    projectileImpacts.shiftWorld(originDx, originDy);
    manhattanLandmarks.shiftWorld(originDx);
    explosionManager.shiftWorld(originDx, originDy);
    scorePopup.shiftWorld(originDx, originDy);
    player.shiftWorld(originDx, originDy);
    if (boss) { boss.ship = shipFlight; boss.shiftWorld?.(originDx, originDy); }

    if (!collisionFitted && player.shipModel) { flightCollision.fitToModel(player.shipModel); collisionFitted = true; }
    if (flightCollision.enabled || flightDebug.enabled || collisionDebug.enabled) flightCollision.evaluate(player.mesh.position, shipFlight.velocity, spaceEnvironment.biomes.speed);
    flightDebug.update(player.mesh.position);
    collisionDebug.update(player.mesh.position);
    fireDebug.update();
    flightTest.update(player.mesh.position);

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

    enemyManager.setLoadFactor(perfMonitor.fps);
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

    combatCommsCooldown = Math.max(0, combatCommsCooldown - deltaTime);
    if (combatCommsCooldown === 0 && enemyManager.enemies.length >= 5) {
        showCombatMessage('COMUNICAÇÃO DE COMBATE', 'Múltiplos contatos inimigos.');
        soundManager.play('drone');
        combatCommsCooldown = 12;
    } else if (combatCommsCooldown === 0 && enemyManager.enemyProjectiles.length > 0) {
        showCombatMessage('ALERTA TÁTICO', 'Atenção! Projéteis hostis detectados.');
        combatCommsCooldown = 12;
    }

    laserManager.update(deltaTime, enemyManager, handleEnemyScore, explosionManager, player.mesh.position);
    projectileImpacts.update(deltaTime);
    enemyDamageFX.update(deltaTime);
    manhattanLandmarks.update();
    explosionManager.update(deltaTime);
    scorePopup.update(deltaTime);
    updateCamera(deltaTime);

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
        showMissionBriefing(targetLevel);
    }

    const bossLevel = currentLevel >= 100 ? 100 : currentLevel >= 50 ? 50 : null;
    if (
        bossLevel !== null
        && boss === null
        && !window.__BOSS_SPAWNED_LEVELS.has(bossLevel)
    ) {
    window.__BOSS_SPAWNED_LEVELS.add(bossLevel);
    isBossFight = true;
    lastBossLevel = bossLevel;

    console.log(`🚀 [BOSS] Spawnando Nave Mãe no nível ${currentLevel} (início no 50)`);

    if (bossLevel === 100 && !naveMae.isAlive) {
        naveMae = new NaveMae(scene);
    }
    boss = naveMae;
    window.__NAVE_MAE_ATIVA = boss;
    lastBossNarrativePhase = 0;

    if (progressionManager.registerBoss) {
        progressionManager.registerBoss(boss);
    }
    progressionManager.activeBoss = boss;
    showCombatMessage('ALVO PRIORITÁRIO', 'Nave-Mãe da NEXUS localizada.');

    if (boss.ativarNave) {
        boss.ativarNave(bossLevel);
    }
}

    // ====================== ATUALIZAÇÃO DO BOSS ======================
    if (boss) {
        boss.update(deltaTime, player.mesh?.position, laserManager, explosionManager, player, enemyManager, soundManager);
        if (currentLevel >= 100 && boss.isActive) {
            const phase = boss.hp > 7 ? 1 : boss.hp > 5 ? 2 : boss.hp > 3 ? 3 : 4;
            if (phase !== lastBossNarrativePhase) {
                lastBossNarrativePhase = phase;
                const phaseMessages = [
                    'Fase 1 — Destrua os canhões externos.',
                    'Fase 2 — Neutralize os geradores de escudo.',
                    'Fase 3 — Enxames de drones de elite detectados.',
                    'Fase 4 — O núcleo central está exposto. Ataque agora!'
                ];
                showCombatMessage(`NAVE-MÃE — FASE ${phase}`, phaseMessages[phase - 1], true, 4000);
            }
        }

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

            if (currentLevel >= 100) {
                showCampaignEnding();
            } else {
                // Volta os inimigos normais no nível atual
                enemyManager.clearAllEnemies();
                enemyManager.spawnWave(player, progressionManager.getLevel());
            }
        }
    }

    renderFrame();
    perfMonitor.tick(deltaTime);
}

// ====================== SETUP ======================
function setupNexusSelector() {
    window.addEventListener('nivelAlterado', (e) => {
        const novoNivel = parseInt(e.detail.nivel);
        progressionManager.setLevel(novoNivel);
        updateLevelHUD();
        updateLevelUI(novoNivel);
        showMissionBriefing(novoNivel);
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
    setupNexusSelector();
}

function toggleGamePause() {
    const willPause = currentState === GAME_STATE.PLAYING;
    currentState = willPause ? GAME_STATE.PAUSED : GAME_STATE.PLAYING;
    if (willPause) {
        soundManager.stopShipEngine();
    } else if (audioInitialized) {
        soundManager.startShipEngine();
    }
}

function startGame() {
    if (currentState === GAME_STATE.PLAYING) return;

    countdown = flightTest.enabled ? 0.05 : 5;
    isGameStarted = false;
    score = 0;
    enemiesDestroyed = 0;
    window.enemiesDestroyed = 0;
    lastBossLevel = -1;
    boss = null;
    isBossFight = false;
    campaignEndingShown = false;
    lastBossNarrativePhase = 0;
    window.__BOSS_SPAWNED_LEVELS.clear();
    const ending = $id('campaign-ending');
    const endingResult = $id('campaign-ending-result');
    if (ending) {
        ending.classList.remove('visible');
        ending.setAttribute('aria-hidden', 'true');
    }
    if (endingResult) {
        endingResult.hidden = true;
        delete endingResult.dataset.chosen;
    }
    const endingChoices = $id('campaign-ending-choices');
    if (endingChoices) endingChoices.hidden = false;

    const countdownDisplay = document.getElementById('countdown-display');
    if (countdownDisplay) countdownDisplay.style.display = 'block';

    currentState = GAME_STATE.PLAYING;
    combatCommsCooldown = 0;

    const overlay = document.getElementById('overlay');
    if (overlay) overlay.style.display = 'none';

    const nexusSelector = document.getElementById('nexusSelector');
    if (nexusSelector) nexusSelector.style.display = 'none';

    player.mesh.position.set(0, -1, 8);
    player.velocity.set(0, 0);
    chaseCamera.reset(0, -1);
    flightAssist.reset();
    shipFlight.reset();
    enemyManager.clearAllEnemies();

    updateHUD();
    updateLevelHUD();
}

// ====================== DOM ======================
window.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const endingChoices = $id('campaign-ending-choices');
    if (endingChoices) {
        endingChoices.addEventListener('click', (event) => {
            const button = event.target.closest('[data-ending-choice]');
            if (button) chooseCampaignEnding(button.dataset.endingChoice);
        });
    }

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
            audioInitialized = true;
        }
        soundManager.startShipEngine();
        startGame();
    };

    if (startBtn) {
        startBtn.addEventListener('click', handleStart);
        startBtn.addEventListener('touchstart', handleStart, { passive: false });
    }
    if (flightTest.enabled) startGame();

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
        btnPause.addEventListener('click', toggleGamePause);
        btnPause.addEventListener('touchstart', (e) => {
            e.preventDefault();
            toggleGamePause();
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

const debouncedViewport = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyViewportSettings, 120);
};
window.addEventListener('resize', debouncedViewport);
window.addEventListener('orientationchange', debouncedViewport);

// Pausa automaticamente em segundo plano (economiza bateria/CPU) e descarta o delta acumulado ao voltar
document.addEventListener('visibilitychange', () => {
    if (document.hidden && currentState === GAME_STATE.PLAYING) {
        toggleGamePause();
    }
});