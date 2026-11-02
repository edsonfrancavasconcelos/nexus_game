// Biomas e paletas (0..9). O bioma de terreno vem de biomeOf(paleta); 8 e 9 são Nova York (cidade com estilo próprio).

export const BIOME_COUNT = 4;
export const BIOME_NAMES = ['plains', 'forest', 'city', 'extreme'];

export const COLOR_KEYS = ['zenith', 'mid', 'horizon', 'sun', 'haze', 'fieldA', 'fieldB', 'fieldC', 'rock', 'glow', 'dust', 'tint'];
export const SCALAR_KEYS = ['fog', 'gfog', 'cLo', 'cHi', 'night', 'win', 'sat', 'con', 'snow', 'lava', 'sunI', 'ambI'];

const P = (colors, scalars) => ({ colors, scalars });

export const PALETTES = [
    // 0 - Planícies ao pôr do sol
    P({ zenith: 0x1b2a5c, mid: 0x7a4f8c, horizon: 0xffa860, sun: 0xffd9a0, haze: 0xff7f3f, fieldA: 0x4f7a45, fieldB: 0xa98440, fieldC: 0x3d6a7a, rock: 0x6a5470, glow: 0x40e8ff, dust: 0xffc890, tint: [1.02, 1.0, 0.97] },
      { fog: 1 / 5400, gfog: 0.15, cLo: 0.46, cHi: 0.78, night: 0, win: 0, sat: 1.08, con: 1.06, snow: 3000, lava: 0, sunI: 2.2, ambI: 1.2 }),
    // 1 - Floresta, manhã dourada
    P({ zenith: 0x2a4f7a, mid: 0x7fa7a0, horizon: 0xf5e6b0, sun: 0xfff0c0, haze: 0xcfe8a0, fieldA: 0x2f6a35, fieldB: 0x3f7a3a, fieldC: 0x8aa64a, rock: 0x5a5446, glow: 0x9dff7a, dust: 0xd8e8a0, tint: [1.0, 1.03, 0.95] },
      { fog: 1 / 3900, gfog: 0.55, cLo: 0.5, cHi: 0.82, night: 0, win: 0, sat: 1.1, con: 1.05, snow: 3000, lava: 0, sunI: 2.4, ambI: 1.25 }),
    // 2 - Cidade ao entardecer
    P({ zenith: 0x141a40, mid: 0x6a4a8a, horizon: 0xff9a70, sun: 0xffc8a0, haze: 0xff6a60, fieldA: 0x3a4a58, fieldB: 0x55506a, fieldC: 0x4a5a78, rock: 0x4a4a5a, glow: 0x4fe8ff, dust: 0xffd8c0, tint: [1.0, 0.98, 1.04] },
      { fog: 1 / 7000, gfog: 0.12, cLo: 0.5, cHi: 0.8, night: 0.3, win: 0.9, sat: 1.12, con: 1.1, snow: 3000, lava: 0, sunI: 1.8, ambI: 1.1 }),
    // 3 - Cânion nevado
    P({ zenith: 0x2a4468, mid: 0x8aa4c4, horizon: 0xdce8f5, sun: 0xfff4e0, haze: 0xb8d0ee, fieldA: 0xdfe8f2, fieldB: 0xaab8cc, fieldC: 0x7a8aa0, rock: 0x6a6470, glow: 0x9ad8ff, dust: 0xffffff, tint: [0.97, 1.0, 1.06] },
      { fog: 1 / 3600, gfog: 0.4, cLo: 0.36, cHi: 0.62, night: 0, win: 0, sat: 0.9, con: 1.08, snow: 260, lava: 0.1, sunI: 2.0, ambI: 1.3 }),
    // 4 - Planícies em crepúsculo azul
    P({ zenith: 0x0b1233, mid: 0x2c3f86, horizon: 0x8aa8ff, sun: 0xcfe0ff, haze: 0x6f8dff, fieldA: 0x2c6a70, fieldB: 0x3c4f94, fieldC: 0x4f7a5a, rock: 0x3b4878, glow: 0x6bffd9, dust: 0xbfd8ff, tint: [0.98, 1.0, 1.06] },
      { fog: 1 / 5000, gfog: 0.2, cLo: 0.5, cHi: 0.8, night: 0.5, win: 0, sat: 1.1, con: 1.08, snow: 3000, lava: 0, sunI: 1.6, ambI: 1.1 }),
    // 5 - Floresta bioluminescente
    P({ zenith: 0x061a22, mid: 0x0e4a52, horizon: 0x56d8b0, sun: 0xbfffe0, haze: 0x2fbf9a, fieldA: 0x1d5a4a, fieldB: 0x2a7a5a, fieldC: 0x3a8a9a, rock: 0x35484a, glow: 0x7dffb0, dust: 0x9dffd0, tint: [0.96, 1.04, 1.02] },
      { fog: 1 / 3000, gfog: 1.0, cLo: 0.5, cHi: 0.84, night: 0.7, win: 0, sat: 1.15, con: 1.1, snow: 3000, lava: 0, sunI: 1.5, ambI: 1.0 }),
    // 6 - Metrópole neon à noite
    P({ zenith: 0x02040f, mid: 0x141a4a, horizon: 0x5a3a9a, sun: 0xb0b8ff, haze: 0xff3ad0, fieldA: 0x2a3050, fieldB: 0x35305a, fieldC: 0x2a3050, rock: 0x30304a, glow: 0xff4fd8, dust: 0xff9ae8, tint: [1.0, 0.97, 1.06] },
      { fog: 1 / 6000, gfog: 0.18, cLo: 0.52, cHi: 0.82, night: 1.0, win: 1.7, sat: 1.2, con: 1.15, snow: 3000, lava: 0, sunI: 0.9, ambI: 0.95 }),
    // 7 - Região vulcânica
    P({ zenith: 0x1a0808, mid: 0x6a2a1a, horizon: 0xff7a30, sun: 0xffb070, haze: 0xff4a1a, fieldA: 0x3a2a28, fieldB: 0x4a3028, fieldC: 0x5a3a2a, rock: 0x3a2c2a, glow: 0xff5a18, dust: 0xffa060, tint: [1.05, 0.98, 0.94] },
      { fog: 1 / 3200, gfog: 0.5, cLo: 0.38, cHi: 0.66, night: 0.1, win: 0, sat: 1.1, con: 1.14, snow: 3000, lava: 1.0, sunI: 1.9, ambI: 1.1 }),
    // 8 - Nova York, fim de tarde dourado com névoa urbana
    P({ zenith: 0x1a2a55, mid: 0x8a5a7a, horizon: 0xffb070, sun: 0xffd9a0, haze: 0xffa070, fieldA: 0x4a5060, fieldB: 0x5a5a66, fieldC: 0x4a5a78, rock: 0x585868, glow: 0xffd27a, dust: 0xffe0b8, tint: [1.03, 1.0, 0.97] },
      { fog: 1 / 5200, gfog: 0.35, cLo: 0.5, cHi: 0.8, night: 0.35, win: 1.1, sat: 1.1, con: 1.1, snow: 3000, lava: 0, sunI: 2.0, ambI: 1.15 }),
    // 9 - Nova York à noite, névoa de sódio
    P({ zenith: 0x03060f, mid: 0x16224a, horizon: 0x6a4a7a, sun: 0xc8d0ff, haze: 0xd89a60, fieldA: 0x2a3040, fieldB: 0x343848, fieldC: 0x2a3050, rock: 0x3a3c50, glow: 0xffc060, dust: 0xffd8a0, tint: [1.0, 0.98, 1.03] },
      { fog: 1 / 4800, gfog: 0.4, cLo: 0.52, cHi: 0.82, night: 1.0, win: 1.9, sat: 1.15, con: 1.14, snow: 3000, lava: 0, sunI: 0.8, ambI: 0.95 }),
    // 10 - Manhattan, crepúsculo azul-âmbar com janelas acesas e névoa fina de rio
    P({ zenith: 0x0f1c44, mid: 0x5a5a8a, horizon: 0xffa468, sun: 0xffd2a0, haze: 0xe08a70, fieldA: 0x3e4658, fieldB: 0x4c5064, fieldC: 0x3c4a68, rock: 0x505468, glow: 0xffd890, dust: 0xffe4c4, tint: [1.02, 0.99, 1.0] },
      { fog: 1 / 5600, gfog: 0.3, cLo: 0.5, cHi: 0.8, night: 0.6, win: 1.5, sat: 1.1, con: 1.12, snow: 3000, lava: 0, sunI: 1.5, ambI: 1.05 })
];

// Bioma de terreno (0 planície, 1 floresta, 2 cidade, 3 extremo) de cada paleta; Nova York é a cidade com estilo próprio.
const PALETTE_BIOME = [0, 1, 2, 3, 0, 1, 2, 3, 2, 2, 2];
export const MANHATTAN_PALETTE = 10;
export const biomeOf = (pal) => PALETTE_BIOME[pal];
export const nyOf = (pal) => (pal >= 8 ? 1 : 0);

// Valores por bioma usados pelas partículas e pela velocidade (planície, floresta, cidade, extremo).
export const BIOME_PARAMS = {
    dustHeight: [28, 120, 60, 170],
    fall: [0, 0.06, 0, 0.1],
    dustSize: [1, 1.3, 0.8, 1.1],
    speedMul: [1.0, 1.25, 1.05, 0.95],
    streakMul: [1.0, 1.25, 0.9, 1.5]
};

// Ciclo de 5 níveis: planície, floresta, cidade, extremo, Nova York; a segunda volta troca horário/clima.
const LEVEL_CYCLE = [[0, 1, 2, 3, 8], [4, 5, 6, 7, 9]];
export function levelToPalette(level) {
    const l = Math.max(1, Math.floor(level)) - 1;
    return LEVEL_CYCLE[Math.floor(l / 5) % 2][l % 5];
}
