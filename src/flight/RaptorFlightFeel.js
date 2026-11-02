// Perfil "Raptor Flight Feel": só valores de sensação de pilotagem (sem lógica).
// Ajuste aqui após o teste real; Player, ChaseCamera, ShipFlight e FlightAssist leem estes números.
export const RAPTOR_FLIGHT_FEEL = {
    name: 'Raptor Flight Feel',

    // Esterçamento com massa de caça: acelera sem pular e para sem deslizar.
    // Velocidade máxima ≈ accel/60 * damping/(1-damping); constante de tempo ≈ 1/(60*(1-damping)) s (~0,17 s).
    steer: {
        accel: 44,
        damping: 0.92,   // maior = mais inércia/deslize; menor = mais seco
        brake: 1.15,     // multiplicador ao inverter o comando (retorno ao centro sem tranco)
        vertAccel: 34,   // subida/descida mais mansa que o strafe
        refSpeed: 8.4    // ≈ velocidade lateral máxima; normaliza roll/câmera (não é limite)
    },

    // Roll do modelo: curva suave = pouca inclinação, curva forte = mais.
    roll: {
        max: 0.46,       // rad com comando total
        curve: 1.7,      // >1: comandos pequenos inclinam menos que o linear (curvas progressivas)
        pitchMax: 0.3,   // rad de pitch com atitude total (nariz sobe/desce antes da altitude mudar)
        response: 4,     // maior = inclina/volta mais rápido
        yawFromSpeed: 0.15,
        bankFromSpeed: 0.09,
        followRate: 4.5
    },

    // Câmera de perseguição: um pouco mais de atraso para dar peso, sempre presa à nave.
    camera: {
        baseFov: 70,
        lag: 3.6,        // rigidez da mola de posição (maior = menos atraso)
        lookRate: 5,
        pitchLook: 7,    // a mira da câmera acompanha o pitch da nave (u por unidade de atitude)
        followX: 0.62,
        rollFromSpeed: 0.028,
        rollFromAccel: 0.0025,
        rollRate: 2.8,
        // FOV extra com a velocidade de avanço (speedFactor) e com o esterçamento
        fovSpeedGain: 55,
        fovSteerGain: 1.8,
        fovAccelGain: 0.25,
        fovRate: 2
    },

    // Avanço e trajetória real.
    speed: {
        cruiseScale: 0.6,   // multiplica a velocidade de cruzeiro dos biomas (360 u/s base → ~216)
        worldDrift: 0.2,    // deslocamento lateral real do mundo por rumo
        headingRate: 4.5,   // quão rápido o rumo (heading) segue o comando
        climbGain: 26,      // velocidade máxima de mudança de altitude do mundo (u/s)
        climbResponse: 1.5, // maior = a altitude responde mais rápido (segue o pitch, não o comando)
        pitchResponse: 3.2, // atitude (pitch) segue o comando; maior = nariz mais rápido
        pitchDeadzone: 0.14, // parte do pitch que ainda não gera subida/descida (o nariz vai antes)
        cruiseFactor: 0.6,
        turnBleed: 0.035
    }
};
