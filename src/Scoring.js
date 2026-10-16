// Ponto único de pontuação para todas as armas do jogador.
const POINTS = { meteoro: 500, asteroide: 500, drone: 300, boss: 5000 };
const DEFAULT_POINTS = 1000;

let scoreHandler = null;
let scorePopup = null;

export function setScoreHandler(handler, popup = null) {
    scoreHandler = handler;
    scorePopup = popup;
}

export function pointsForEnemy(type) {
    return POINTS[type] ?? DEFAULT_POINTS;
}

// Concede pontos uma única vez por alvo, independentemente da arma.
export function awardPoints(enemy, weaponType, hitPoint = null, typeOverride = null) {
    if (!enemy || enemy.__scoreAwarded) return 0;
    enemy.__scoreAwarded = true;

    const type = typeOverride || enemy.userData?.type;
    const points = pointsForEnemy(type);
    const position = hitPoint || enemy.position || enemy.mesh?.position || null;

    if (scorePopup && position) scorePopup.show(points, position);
    if (scoreHandler) scoreHandler(points, position, weaponType);
    return points;
}

// Escala relativa da explos�o conforme o porte do inimigo.
const EXPLOSION_SIZE = { drone: 0.9, comum: 1.0, roblox: 1.15, nave_inim_5: 1.3, nave_inim_10: 1.5, nave_inim_15: 1.7, asteroide: 1.6, meteoro: 1.6 };
export function explosionSizeFor(type) {
    return EXPLOSION_SIZE[type] ?? 1.0;
}
