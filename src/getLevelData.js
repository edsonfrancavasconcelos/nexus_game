export function getLevelData(level) {
    // 1. Definição dos marcos por intervalos (Prioridade)
    if (level >= 100) return { title: "Fronteira da Nave-Mãe", task: "Você chegou ao coração inimigo. Destrua a Nave-Mãe para vencer!" };
    if (level >= 75) return { title: "Setor de Radiação", task: "Escudos críticos! Elimine os inimigos rapidamente." };
    if (level >= 50) return { title: "Setor de Guerra Alpha", task: "Zona de conflito total. Não pare de atirar." };
    if (level >= 33) return { title: "Zona de Bloqueio Hostil", task: "Naves pesadas interceptando. Priorize alvos blindados." };
    if (level >= 20) return { title: "Perímetro Defensivo", task: "Inimigos detectados! Mantenha a velocidade e responda ao fogo." };
    if (level >= 1) return { title: "Setor de Hostil", task: "Calibre seus canhões e destrua os dróides básicos." };

    // 2. Fallback (Para níveis inferiores a 1)
    return { 
        title: "Zona de Patrulha", 
        task: "Detectada presença inimiga. Limpe o perímetro imediatamente." 
    };
}