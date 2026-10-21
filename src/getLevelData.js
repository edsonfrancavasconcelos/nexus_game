export function getLevelData(level) {
    if (level >= 100) {
        return {
            chapter: 6,
            chapterTitle: "Raptor Strike",
            title: "Núcleo da NEXUS",
            task: "A Nave-Mãe protege o núcleo central. Destrua-a e decida o destino da NEXUS."
        };
    }
    if (level >= 75) {
        return {
            chapter: 5,
            chapterTitle: "Coração da IA",
            title: "Fortaleza da NEXUS",
            task: "Atravesse as defesas orbitais e os esquadrões de elite até o núcleo."
        };
    }
    if (level >= 50) {
        return {
            chapter: 4,
            chapterTitle: "Mundo Industrial",
            title: "Fábricas da NEXUS",
            task: "A infraestrutura inimiga produz novas frotas. Ataque as defesas industriais."
        };
    }
    if (level >= 33) {
        return {
            chapter: 3,
            chapterTitle: "Cinturão de Asteroides",
            title: "Rota de Emboscada",
            task: "A NEXUS usa o cinturão para ocultar suas forças. Mantenha-se alerta."
        };
    }
    if (level >= 20) {
        return {
            chapter: 2,
            chapterTitle: "Zona de Guerra",
            title: "Linha de Defesa",
            task: "Interceptadores hostis defendem a linha de frente da NEXUS."
        };
    }
    if (level >= 1) {
        return {
            chapter: 1,
            chapterTitle: "Fronteira Perdida",
            title: "Colônias da Federação",
            task: "Elimine as patrulhas e descubra quem coordena a invasão."
        };
    }
    return {
        chapter: 1,
        chapterTitle: "Fronteira Perdida",
        title: "Zona de Patrulha",
        task: "Presença hostil detectada. Abra caminho pelas linhas inimigas."
    };
}