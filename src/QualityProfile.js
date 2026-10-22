// Perfis de qualidade automáticos: LOW (aparelhos antigos), MEDIUM (intermediários), HIGH (PC/fortes).
// Override manual para testes: ?quality=low|medium|high
const PROFILES = {
    low:    { name: 'LOW',    maxPixelRatio: 0.9, minPixelRatio: 0.5, far: 20000, stars: 450,  clouds: 60,  maxEnemies: 6,  maxExplosions: 10, bloom: 0 },
    medium: { name: 'MEDIUM', maxPixelRatio: 1.2, minPixelRatio: 0.6, far: 30000, stars: 700,  clouds: 90,  maxEnemies: 8,  maxExplosions: 16, bloom: 0.35 },
    high:   { name: 'HIGH',   maxPixelRatio: 1.5, minPixelRatio: 0.7, far: 50000, stars: 1500, clouds: 220, maxEnemies: 12, maxExplosions: 28, bloom: 0.5 }
};

export function detectQualityProfile(isMobile) {
    const forced = /[?&]quality=(low|medium|high)/.exec(location.search);
    if (forced) return PROFILES[forced[1]];

    const mem = navigator.deviceMemory || (isMobile ? 4 : 8);
    const cores = navigator.hardwareConcurrency || (isMobile ? 4 : 8);
    const ua = navigator.userAgent;
    const oldIOS = /iPhone OS (\d+)_/.exec(ua);
    const weakIOS = oldIOS && parseInt(oldIOS[1], 10) < 14;
    const pixels = screen.width * screen.height * (window.devicePixelRatio || 1) ** 2;

    if (!isMobile) return (mem >= 4 && cores >= 4) ? PROFILES.high : PROFILES.medium;
    if (weakIOS || mem <= 2 || cores <= 4 && mem <= 3) return PROFILES.low;
    if (mem >= 6 && cores >= 8 && pixels < 6e6) return PROFILES.high;
    return PROFILES.medium;
}
