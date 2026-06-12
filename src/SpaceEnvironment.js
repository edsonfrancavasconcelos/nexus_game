import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class SpaceEnvironment {
    constructor(scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.nebula = null;
        
        this.initEnvironment();
        this.loadNebula(); 
    }

    initEnvironment() {
        // Aumentando a intensidade para garantir que o modelo apareça iluminado
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5); 
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
        sunLight.position.set(10, 20, 15);
        this.scene.add(sunLight);

        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.FogExp2(0x303035, 0.0005); // Suavizado para não cobrir a nebulosa
    }

loadNebula() {
    this.loader.load('/assets/models/spaco.glb', (gltf) => {
        this.nebula = gltf.scene;
        
        // Reduzimos um pouco a escala e aproximamos para evitar o corte circular
        this.nebula.scale.set(80, 80, 80);
        this.nebula.position.set(0, 0, -1500); 

        this.nebula.traverse((child) => {
            if (child.isMesh) {
                // Força o material a ignorar o fog e renderizar as texturas corretamente
                child.material.fog = false; 
                child.material.side = THREE.DoubleSide; 
                
                // Se o material usar profundidade, desativamos a escrita para não criar o círculo preto
                child.material.depthWrite = false;
                
                child.visible = true;
                child.frustumCulled = false; 
            }
        });

        this.scene.add(this.nebula);
        console.log("🌌 Nebulosa ajustada sem cortes!");
    }, undefined, (err) => {
        console.error("Erro ao carregar nebulosa:", err);
    });
}
    // Criando o método update para evitar erros no loop principal
    update(deltaTime) {
        if (this.nebula) {
            // Pequena rotação no cenário para dar dinamismo ao espaço
            this.nebula.rotation.z += (0.001 * deltaTime);
        }
    }
}
