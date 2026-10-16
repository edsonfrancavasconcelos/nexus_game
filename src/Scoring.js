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
