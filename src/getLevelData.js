// src/getLevelData.js

export function getLevelData(level) {
    // 1. Dicionário de Níveis Especiais (Marcos do Jogo)
    const marcos = {
        1: { title: "Setor de Treinamento", task: "Calibre seus canhões e destrua os dróides básicos." },
        20: { title: "Perímetro Defensivo", task: "Inimigos detectados! Mantenha a velocidade e responda ao fogo." },
        33: { title: "Zona de Bloqueio Hostil", task: "Naves pesadas interceptando. Priorize alvos blindados." },
        50: { title: "Setor de Guerra Alpha", task: "Zona de conflito total. Não pare de atirar." },
        75: { title: "Setor de Radiação", task: "Escudos críticos! Elimine os inimigos rapidamente." },
        100: { title: "Fronteira da Nave-Mãe", task: "Você chegou ao coração inimigo. Destrua a Nave-Mãe para vencer!" }
    };

    // 2. Se o nível for um marco, retorna ele
    if (marcos[level]) {
        return marcos[level];
    }

    // 3. Lógica automática para níveis comuns (Preenche o buraco de 1 a 100)
    // Isso garante que NUNCA falte um texto, mesmo que você não escreva um por um
    let categoria = "Zona de Patrulha";
    if (level > 80) categoria = "Setor Final";
    else if (level > 60) categoria = "Zona de Conflito";
    else if (level > 40) categoria = "Zona Hostil";
    else if (level > 10) categoria = "Setor de Avanço";

    return { 
        title: `${categoria} ${level}`, 
        task: `Nível ${level}: Detectada presença inimiga. Limpe o perímetro imediatamente.` 
    };
}