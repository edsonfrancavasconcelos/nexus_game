import { ao as Vector3, am as TrianglesDrawMode, ak as TriangleFanDrawMode, al as TriangleStripDrawMode, J as Loader, K as LoaderUtils, F as FileLoader, S as MeshPhysicalMaterial, an as Vector2, i as Color, H as LinearSRGBColorSpace, a8 as SRGBColorSpace, ae as SpotLight, a1 as PointLight, D as DirectionalLight, O as Matrix4, p as InstancedMesh, a5 as Quaternion, o as InstancedBufferAttribute, _ as Object3D, aj as TextureLoader, I as ImageBitmapLoader, e as BufferAttribute, q as InterleavedBuffer, z as LinearMipmapLinearFilter, W as NearestMipmapLinearFilter, E as LinearMipmapNearestFilter, X as NearestMipmapNearestFilter, y as LinearFilter, V as NearestFilter, a7 as RepeatWrapping, U as MirroredRepeatWrapping, g as ClampToEdgeWrapping, a3 as PointsMaterial, M as Material, v as LineBasicMaterial, T as MeshStandardMaterial, m as DoubleSide, Q as MeshBasicMaterial, a4 as PropertyBinding, f as BufferGeometry, ab as SkinnedMesh, P as Mesh, x as LineSegments, L as Line, w as LineLoop, a2 as Points, G as Group, a0 as PerspectiveCamera, N as MathUtils, $ as OrthographicCamera, aa as Skeleton, b as AnimationClip, B as Bone, t as InterpolateDiscrete, u as InterpolateLinear, r as InterleavedBufferAttribute, ai as Texture, ap as VectorKeyframeTrack, Z as NumberKeyframeTrack, a6 as QuaternionKeyframeTrack, j as ColorManagement, n as FrontSide, s as Interpolant, c as Box3, ac as Sphere, ad as SphereGeometry, Y as NormalBlending, l as CylinderGeometry, A as AdditiveBlending, k as ConeGeometry, d as BoxGeometry, ag as SpriteMaterial, af as Sprite, ah as TetrahedronGeometry, C as CanvasTexture, R as MeshPhongMaterial, a as AmbientLight, a9 as Scene, aq as WebGLRenderer, h as Clock } from "./three-CgbjQTyu.js";
(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
class ScorePopup {
  constructor(scene2, camera2) {
    this.scene = scene2;
    this.camera = camera2;
    this.popups = [];
  }
  show(points, position) {
    const scoreElement = document.createElement("div");
    const isMobile = window.innerWidth < 900;
    scoreElement.className = "score-popup";
    scoreElement.textContent = `+${points}`;
    Object.assign(scoreElement.style, {
      position: "absolute",
      color: "#ffff00",
      fontSize: isMobile ? "18px" : "24px",
      fontWeight: "bold",
      textShadow: "0 0 8px #ff0000",
      pointerEvents: "none",
      zIndex: "100",
      whiteSpace: "nowrap",
      transition: "opacity 0.1s linear"
      // Deixa o sumiço suave
    });
    document.body.appendChild(scoreElement);
    this.popups.push({
      element: scoreElement,
      life: 1.8,
      position: position.clone(),
      velocity: new Vector3(0, isMobile ? 12 : 8, 0)
    });
  }
  update(deltaTime) {
    if (!deltaTime) return;
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= deltaTime;
      p.position.y += p.velocity.y * deltaTime;
      p.velocity.y *= 0.9;
      if (p.life <= 0) {
        if (p.element.parentNode) p.element.remove();
        this.popups.splice(i, 1);
        continue;
      }
      const vector = p.position.clone().project(this.camera);
      const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
      p.element.style.left = `${x}px`;
      p.element.style.top = `${y}px`;
      p.element.style.opacity = Math.max(0, p.life / 1.8);
      p.element.style.transform = `scale(${1 + (1.8 - p.life) * 0.15})`;
    }
  }
}
class SoundManager {
  constructor() {
    this.sounds = {
      // --- JOGADOR ---
      laser: new Audio("/assets/sounds/laser.mp3"),
      nave: new Audio("/assets/sounds/nave.mp3"),
      pdc: new Audio("/assets/sounds/pdc_shot.mp3"),
      // --- INIMIGOS GERAIS ---
      enemyLaser: new Audio("/assets/sounds/laser_inimigo.mp3"),
      explosion: new Audio("/assets/sounds/explosao_inimiga.mp3"),
      enemyPass: new Audio("/assets/sounds/inimiga_passando.mp3"),
      // --- LASERS DOS INIMIGOS ---
      laser_inim_15: new Audio("/assets/sounds/laser_inim_15.mp3"),
      laser_inim_10: new Audio("/assets/sounds/laser_inim_10.mp3"),
      laser_inimi_5: new Audio("/assets/sounds/laser_inimi_5.mp3"),
      laser_inim_6: new Audio("/assets/sounds/laser_inimigo.mp3"),
      // fallback
      laser_inimigo: new Audio("/assets/sounds/laser_inimigo.mp3"),
      missile: new Audio("/assets/sounds/laser.mp3"),
      // --- SONS DE PASSAGEM ---
      nave_pass_15: new Audio("/assets/sounds/nave_pass_15.mp3"),
      nave_pss_10: new Audio("/assets/sounds/nave_pass_10.mp3"),
      // nome exato do arquivo
      nave_pass_5: new Audio("/assets/sounds/nave_pass_5.mp3"),
      nave_pass_6: new Audio("/assets/sounds/inimiga_passando.mp3"),
      // fallback
      drone: new Audio("/assets/sounds/drone.mp3"),
      dronePass: new Audio("/assets/sounds/drone.mp3"),
      meteoro: new Audio("/assets/sounds/meteoro.mp3"),
      meteoroPass: new Audio("/assets/sounds/meteoro.mp3"),
      inimiga_passando: new Audio("/assets/sounds/inimiga_passando.mp3")
    };
    this.sounds.laserInimi5 = this.sounds.laser_inimi_5;
    this.sounds.laserInim10 = this.sounds.laser_inim_10;
    this.sounds.laserInim15 = this.sounds.laser_inim_15;
    this.sounds.navePass5 = this.sounds.nave_pass_5;
    this.sounds.navePss10 = this.sounds.nave_pss_10;
    this.sounds.navePass15 = this.sounds.nave_pass_15;
    this.sounds.nave_pass_10 = this.sounds.nave_pss_10;
    this.sounds["laser_inim_15"] = this.sounds.laser_inim_15;
    this.sounds["laser_inim_10"] = this.sounds.laser_inim_10;
    this.sounds["laser_inimi_5"] = this.sounds.laser_inimi_5;
    this.sounds["nave_pass_15"] = this.sounds.nave_pass_15;
    this.sounds["nave_pss_10"] = this.sounds.nave_pss_10;
    this.sounds["nave_pass_5"] = this.sounds.nave_pass_5;
    this.sounds["nave_pass_6"] = this.sounds.nave_pass_6;
    Object.values(this.sounds).forEach((sound) => {
      if (sound) sound.preload = "auto";
    });
    this.lastLaserTime = 0;
    this.lastPdcTime = 0;
    this.activeCloneCount = {};
    this.maxCloneCount = {
      explosion: 3,
      enemyLaser: 4,
      laser: 4,
      pdc: 3,
      enemyPass: 2,
      drone: 2,
      meteoro: 2,
      inimiga_passando: 2,
      nave_pass_15: 1,
      nave_pss_10: 1,
      nave_pass_5: 1,
      nave_pass_6: 1
    };
  }
  init() {
    console.log("🔊 Inicializando todos os sons do jogo...");
    Object.values(this.sounds).forEach((sound) => {
      if (sound) sound.load();
    });
  }
  startShipEngine() {
    const engine = this.sounds["nave"];
    if (engine) {
      engine.loop = true;
      engine.volume = 0.15;
      engine.play().catch((e) => console.warn("Áudio do motor aguardando interação:", e));
    }
  }
  stopShipEngine() {
    const engine = this.sounds["nave"];
    if (engine) engine.pause();
  }
  play(name) {
    if (!name) return;
    if (name === "nave") {
      this.startShipEngine();
      return;
    }
    let soundKey = name;
    const nameMap = {
      "explosao_inimiga": "explosion",
      "explosaoInimiga": "explosion",
      "enemyLaser": "enemyLaser",
      "laser_inimigo": "enemyLaser",
      "drone": "drone",
      "meteoro": "meteoro",
      "inimiga_passando": "enemyPass",
      "nave_pass_15": "nave_pass_15",
      "nave_pss_10": "nave_pss_10",
      "nave_pass_5": "nave_pass_5",
      "nave_pass_6": "nave_pass_6",
      "laser_inim_15": "laser_inim_15",
      "laser_inim_10": "laser_inim_10",
      "laser_inimi_5": "laser_inimi_5",
      "laser_inim_6": "laser_inim_6",
      "missile": "missile"
    };
    if (nameMap[name]) soundKey = nameMap[name];
    const baseSound = this.sounds[soundKey];
    if (!baseSound) {
      console.warn(`Som não encontrado: ${name} (tentou chave: ${soundKey})`);
      return;
    }
    const now = Date.now();
    if (soundKey.includes("laser") && now - this.lastLaserTime < 60) return;
    if (soundKey === "pdc" && now - this.lastPdcTime < 200) return;
    if (soundKey.includes("laser")) this.lastLaserTime = now;
    if (soundKey === "pdc") this.lastPdcTime = now;
    const maxClones = this.maxCloneCount[soundKey] ?? 3;
    const activeClones = this.activeCloneCount[soundKey] || 0;
    if (activeClones >= maxClones) return;
    this.activeCloneCount[soundKey] = activeClones + 1;
    const soundClone = baseSound.cloneNode(true);
    soundClone.loop = false;
    if (soundKey.includes("laser")) {
      soundClone.volume = 0.22;
    } else if (soundKey === "explosion") {
      soundClone.volume = 0.55;
    } else if (soundKey === "drone" || soundKey === "meteoro") {
      soundClone.volume = 0.45;
    } else {
      soundClone.volume = 0.35;
    }
    const cleanupClone = () => {
      if (this.activeCloneCount[soundKey] > 0) {
        this.activeCloneCount[soundKey] -= 1;
      }
      soundClone.remove();
    };
    let cleanupCalled = false;
    const safeCleanup = () => {
      if (cleanupCalled) return;
      cleanupCalled = true;
      cleanupClone();
    };
    soundClone.onended = safeCleanup;
    soundClone.play().catch(() => safeCleanup());
    setTimeout(safeCleanup, 3500);
  }
}
class InputManager {
  constructor() {
    this.moveInput = { x: 0, y: 0 };
    this.keys = {
      ArrowUp: false,
      ArrowDown: false,
      ArrowLeft: false,
      ArrowRight: false,
      Space: false
      // Certifique-se de que o event.code enviado seja exatamente 'Space'
    };
    this.inputAcceleration = 0.22;
    this.currentX = 0;
    this.currentY = 0;
    this.joystickActive = false;
    this._initKeyboard();
    this._initJoystick();
  }
  _initKeyboard() {
    window.addEventListener("keydown", (event) => {
      if (Object.prototype.hasOwnProperty.call(this.keys, event.code)) {
        event.preventDefault();
        this.keys[event.code] = true;
      }
    });
    window.addEventListener("keyup", (event) => {
      if (Object.prototype.hasOwnProperty.call(this.keys, event.code)) {
        this.keys[event.code] = false;
      }
    });
    window.addEventListener("blur", () => {
      for (let key in this.keys) {
        this.keys[key] = false;
      }
      this.currentX = 0;
      this.currentY = 0;
      this.moveInput.x = 0;
      this.moveInput.y = 0;
    });
  }
  _initJoystick() {
    const joystickArea = document.getElementById("joystick-area");
    const stick = document.getElementById("stick");
    if (!joystickArea || !stick) return;
    let touchStartX = 0;
    let touchStartY = 0;
    const maxDistance = 65;
    joystickArea.addEventListener("touchstart", (event) => {
      this.joystickActive = true;
      const touch = event.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }, { passive: false });
    joystickArea.addEventListener("touchmove", (event) => {
      if (!this.joystickActive) return;
      event.preventDefault();
      const touch = event.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const distance = Math.min(Math.sqrt(deltaX * deltaX + deltaY * deltaY), maxDistance);
      const angle = Math.atan2(deltaY, deltaX);
      const moveX = Math.cos(angle) * distance;
      const moveY = Math.sin(angle) * distance;
      stick.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.15)`;
      this.moveInput.x = moveX / maxDistance;
      this.moveInput.y = -(moveY / maxDistance);
    }, { passive: false });
    joystickArea.addEventListener("touchend", () => {
      this.joystickActive = false;
      stick.style.transform = "translate(0px, 0px) scale(1)";
      this.moveInput.x = 0;
      this.moveInput.y = 0;
    });
  }
  update() {
    if (!this.joystickActive) {
      let targetX = 0, targetY = 0;
      if (this.keys.ArrowLeft) targetX = -1;
      if (this.keys.ArrowRight) targetX = 1;
      if (this.keys.ArrowUp) targetY = 1;
      if (this.keys.ArrowDown) targetY = -1;
      this.currentX += (targetX - this.currentX) * this.inputAcceleration;
      this.currentY += (targetY - this.currentY) * this.inputAcceleration;
      return {
        x: this.currentX,
        y: this.currentY,
        isFiring: this.keys.Space
        // Adicionei isso caso você precise disparar pelo teclado
      };
    }
    return {
      x: this.moveInput.x * 1.7,
      y: this.moveInput.y * 1.7,
      isFiring: false
      // Joystick normalmente não dispara aqui, a menos que tenha botão extra
    };
  }
}
function toTrianglesDrawMode(geometry, drawMode) {
  if (drawMode === TrianglesDrawMode) {
    console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles.");
    return geometry;
  }
  if (drawMode === TriangleFanDrawMode || drawMode === TriangleStripDrawMode) {
    let index = geometry.getIndex();
    if (index === null) {
      const indices = [];
      const position = geometry.getAttribute("position");
      if (position !== void 0) {
        for (let i = 0; i < position.count; i++) {
          indices.push(i);
        }
        geometry.setIndex(indices);
        index = geometry.getIndex();
      } else {
        console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible.");
        return geometry;
      }
    }
    const numberOfTriangles = index.count - 2;
    const newIndices = [];
    if (drawMode === TriangleFanDrawMode) {
      for (let i = 1; i <= numberOfTriangles; i++) {
        newIndices.push(index.getX(0));
        newIndices.push(index.getX(i));
        newIndices.push(index.getX(i + 1));
      }
    } else {
      for (let i = 0; i < numberOfTriangles; i++) {
        if (i % 2 === 0) {
          newIndices.push(index.getX(i));
          newIndices.push(index.getX(i + 1));
          newIndices.push(index.getX(i + 2));
        } else {
          newIndices.push(index.getX(i + 2));
          newIndices.push(index.getX(i + 1));
          newIndices.push(index.getX(i));
        }
      }
    }
    if (newIndices.length / 3 !== numberOfTriangles) {
      console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");
    }
    const newGeometry = geometry.clone();
    newGeometry.setIndex(newIndices);
    newGeometry.clearGroups();
    return newGeometry;
  } else {
    console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:", drawMode);
    return geometry;
  }
}
class GLTFLoader extends Loader {
  constructor(manager) {
    super(manager);
    this.dracoLoader = null;
    this.ktx2Loader = null;
    this.meshoptDecoder = null;
    this.pluginCallbacks = [];
    this.register(function(parser) {
      return new GLTFMaterialsClearcoatExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsDispersionExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFTextureBasisUExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFTextureWebPExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFTextureAVIFExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsSheenExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsTransmissionExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsVolumeExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsIorExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsEmissiveStrengthExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsSpecularExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsIridescenceExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsAnisotropyExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMaterialsBumpExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFLightsExtension(parser);
    });
    this.register(function(parser) {
      return new GLTFMeshoptCompression(parser);
    });
    this.register(function(parser) {
      return new GLTFMeshGpuInstancing(parser);
    });
  }
  load(url, onLoad, onProgress, onError) {
    const scope = this;
    let resourcePath;
    if (this.resourcePath !== "") {
      resourcePath = this.resourcePath;
    } else if (this.path !== "") {
      const relativeUrl = LoaderUtils.extractUrlBase(url);
      resourcePath = LoaderUtils.resolveURL(relativeUrl, this.path);
    } else {
      resourcePath = LoaderUtils.extractUrlBase(url);
    }
    this.manager.itemStart(url);
    const _onError = function(e) {
      if (onError) {
        onError(e);
      } else {
        console.error(e);
      }
      scope.manager.itemError(url);
      scope.manager.itemEnd(url);
    };
    const loader = new FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setResponseType("arraybuffer");
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(url, function(data) {
      try {
        scope.parse(data, resourcePath, function(gltf) {
          onLoad(gltf);
          scope.manager.itemEnd(url);
        }, _onError);
      } catch (e) {
        _onError(e);
      }
    }, onProgress, _onError);
  }
  setDRACOLoader(dracoLoader) {
    this.dracoLoader = dracoLoader;
    return this;
  }
  setDDSLoader() {
    throw new Error(
      'THREE.GLTFLoader: "MSFT_texture_dds" no longer supported. Please update to "KHR_texture_basisu".'
    );
  }
  setKTX2Loader(ktx2Loader) {
    this.ktx2Loader = ktx2Loader;
    return this;
  }
  setMeshoptDecoder(meshoptDecoder) {
    this.meshoptDecoder = meshoptDecoder;
    return this;
  }
  register(callback) {
    if (this.pluginCallbacks.indexOf(callback) === -1) {
      this.pluginCallbacks.push(callback);
    }
    return this;
  }
  unregister(callback) {
    if (this.pluginCallbacks.indexOf(callback) !== -1) {
      this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(callback), 1);
    }
    return this;
  }
  parse(data, path, onLoad, onError) {
    let json;
    const extensions = {};
    const plugins = {};
    const textDecoder = new TextDecoder();
    if (typeof data === "string") {
      json = JSON.parse(data);
    } else if (data instanceof ArrayBuffer) {
      const magic = textDecoder.decode(new Uint8Array(data, 0, 4));
      if (magic === BINARY_EXTENSION_HEADER_MAGIC) {
        try {
          extensions[EXTENSIONS.KHR_BINARY_GLTF] = new GLTFBinaryExtension(data);
        } catch (error) {
          if (onError) onError(error);
          return;
        }
        json = JSON.parse(extensions[EXTENSIONS.KHR_BINARY_GLTF].content);
      } else {
        json = JSON.parse(textDecoder.decode(data));
      }
    } else {
      json = data;
    }
    if (json.asset === void 0 || json.asset.version[0] < 2) {
      if (onError) onError(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));
      return;
    }
    const parser = new GLTFParser(json, {
      path: path || this.resourcePath || "",
      crossOrigin: this.crossOrigin,
      requestHeader: this.requestHeader,
      manager: this.manager,
      ktx2Loader: this.ktx2Loader,
      meshoptDecoder: this.meshoptDecoder
    });
    parser.fileLoader.setRequestHeader(this.requestHeader);
    for (let i = 0; i < this.pluginCallbacks.length; i++) {
      const plugin = this.pluginCallbacks[i](parser);
      if (!plugin.name) console.error("THREE.GLTFLoader: Invalid plugin found: missing name");
      plugins[plugin.name] = plugin;
      extensions[plugin.name] = true;
    }
    if (json.extensionsUsed) {
      for (let i = 0; i < json.extensionsUsed.length; ++i) {
        const extensionName = json.extensionsUsed[i];
        const extensionsRequired = json.extensionsRequired || [];
        switch (extensionName) {
          case EXTENSIONS.KHR_MATERIALS_UNLIT:
            extensions[extensionName] = new GLTFMaterialsUnlitExtension();
            break;
          case EXTENSIONS.KHR_DRACO_MESH_COMPRESSION:
            extensions[extensionName] = new GLTFDracoMeshCompressionExtension(json, this.dracoLoader);
            break;
          case EXTENSIONS.KHR_TEXTURE_TRANSFORM:
            extensions[extensionName] = new GLTFTextureTransformExtension();
            break;
          case EXTENSIONS.KHR_MESH_QUANTIZATION:
            extensions[extensionName] = new GLTFMeshQuantizationExtension();
            break;
          default:
            if (extensionsRequired.indexOf(extensionName) >= 0 && plugins[extensionName] === void 0) {
              console.warn('THREE.GLTFLoader: Unknown extension "' + extensionName + '".');
            }
        }
      }
    }
    parser.setExtensions(extensions);
    parser.setPlugins(plugins);
    parser.parse(onLoad, onError);
  }
  parseAsync(data, path) {
    const scope = this;
    return new Promise(function(resolve, reject) {
      scope.parse(data, path, resolve, reject);
    });
  }
}
function GLTFRegistry() {
  let objects = {};
  return {
    get: function(key) {
      return objects[key];
    },
    add: function(key, object) {
      objects[key] = object;
    },
    remove: function(key) {
      delete objects[key];
    },
    removeAll: function() {
      objects = {};
    }
  };
}
const EXTENSIONS = {
  KHR_BINARY_GLTF: "KHR_binary_glTF",
  KHR_DRACO_MESH_COMPRESSION: "KHR_draco_mesh_compression",
  KHR_LIGHTS_PUNCTUAL: "KHR_lights_punctual",
  KHR_MATERIALS_CLEARCOAT: "KHR_materials_clearcoat",
  KHR_MATERIALS_DISPERSION: "KHR_materials_dispersion",
  KHR_MATERIALS_IOR: "KHR_materials_ior",
  KHR_MATERIALS_SHEEN: "KHR_materials_sheen",
  KHR_MATERIALS_SPECULAR: "KHR_materials_specular",
  KHR_MATERIALS_TRANSMISSION: "KHR_materials_transmission",
  KHR_MATERIALS_IRIDESCENCE: "KHR_materials_iridescence",
  KHR_MATERIALS_ANISOTROPY: "KHR_materials_anisotropy",
  KHR_MATERIALS_UNLIT: "KHR_materials_unlit",
  KHR_MATERIALS_VOLUME: "KHR_materials_volume",
  KHR_TEXTURE_BASISU: "KHR_texture_basisu",
  KHR_TEXTURE_TRANSFORM: "KHR_texture_transform",
  KHR_MESH_QUANTIZATION: "KHR_mesh_quantization",
  KHR_MATERIALS_EMISSIVE_STRENGTH: "KHR_materials_emissive_strength",
  EXT_MATERIALS_BUMP: "EXT_materials_bump",
  EXT_TEXTURE_WEBP: "EXT_texture_webp",
  EXT_TEXTURE_AVIF: "EXT_texture_avif",
  EXT_MESHOPT_COMPRESSION: "EXT_meshopt_compression",
  EXT_MESH_GPU_INSTANCING: "EXT_mesh_gpu_instancing"
};
class GLTFLightsExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_LIGHTS_PUNCTUAL;
    this.cache = { refs: {}, uses: {} };
  }
  _markDefs() {
    const parser = this.parser;
    const nodeDefs = this.parser.json.nodes || [];
    for (let nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex++) {
      const nodeDef = nodeDefs[nodeIndex];
      if (nodeDef.extensions && nodeDef.extensions[this.name] && nodeDef.extensions[this.name].light !== void 0) {
        parser._addNodeRef(this.cache, nodeDef.extensions[this.name].light);
      }
    }
  }
  _loadLight(lightIndex) {
    const parser = this.parser;
    const cacheKey = "light:" + lightIndex;
    let dependency = parser.cache.get(cacheKey);
    if (dependency) return dependency;
    const json = parser.json;
    const extensions = json.extensions && json.extensions[this.name] || {};
    const lightDefs = extensions.lights || [];
    const lightDef = lightDefs[lightIndex];
    let lightNode;
    const color = new Color(16777215);
    if (lightDef.color !== void 0) color.setRGB(lightDef.color[0], lightDef.color[1], lightDef.color[2], LinearSRGBColorSpace);
    const range = lightDef.range !== void 0 ? lightDef.range : 0;
    switch (lightDef.type) {
      case "directional":
        lightNode = new DirectionalLight(color);
        lightNode.target.position.set(0, 0, -1);
        lightNode.add(lightNode.target);
        break;
      case "point":
        lightNode = new PointLight(color);
        lightNode.distance = range;
        break;
      case "spot":
        lightNode = new SpotLight(color);
        lightNode.distance = range;
        lightDef.spot = lightDef.spot || {};
        lightDef.spot.innerConeAngle = lightDef.spot.innerConeAngle !== void 0 ? lightDef.spot.innerConeAngle : 0;
        lightDef.spot.outerConeAngle = lightDef.spot.outerConeAngle !== void 0 ? lightDef.spot.outerConeAngle : Math.PI / 4;
        lightNode.angle = lightDef.spot.outerConeAngle;
        lightNode.penumbra = 1 - lightDef.spot.innerConeAngle / lightDef.spot.outerConeAngle;
        lightNode.target.position.set(0, 0, -1);
        lightNode.add(lightNode.target);
        break;
      default:
        throw new Error("THREE.GLTFLoader: Unexpected light type: " + lightDef.type);
    }
    lightNode.position.set(0, 0, 0);
    lightNode.decay = 2;
    assignExtrasToUserData(lightNode, lightDef);
    if (lightDef.intensity !== void 0) lightNode.intensity = lightDef.intensity;
    lightNode.name = parser.createUniqueName(lightDef.name || "light_" + lightIndex);
    dependency = Promise.resolve(lightNode);
    parser.cache.add(cacheKey, dependency);
    return dependency;
  }
  getDependency(type, index) {
    if (type !== "light") return;
    return this._loadLight(index);
  }
  createNodeAttachment(nodeIndex) {
    const self2 = this;
    const parser = this.parser;
    const json = parser.json;
    const nodeDef = json.nodes[nodeIndex];
    const lightDef = nodeDef.extensions && nodeDef.extensions[this.name] || {};
    const lightIndex = lightDef.light;
    if (lightIndex === void 0) return null;
    return this._loadLight(lightIndex).then(function(light) {
      return parser._getNodeRef(self2.cache, lightIndex, light);
    });
  }
}
class GLTFMaterialsUnlitExtension {
  constructor() {
    this.name = EXTENSIONS.KHR_MATERIALS_UNLIT;
  }
  getMaterialType() {
    return MeshBasicMaterial;
  }
  extendParams(materialParams, materialDef, parser) {
    const pending = [];
    materialParams.color = new Color(1, 1, 1);
    materialParams.opacity = 1;
    const metallicRoughness = materialDef.pbrMetallicRoughness;
    if (metallicRoughness) {
      if (Array.isArray(metallicRoughness.baseColorFactor)) {
        const array = metallicRoughness.baseColorFactor;
        materialParams.color.setRGB(array[0], array[1], array[2], LinearSRGBColorSpace);
        materialParams.opacity = array[3];
      }
      if (metallicRoughness.baseColorTexture !== void 0) {
        pending.push(parser.assignTexture(materialParams, "map", metallicRoughness.baseColorTexture, SRGBColorSpace));
      }
    }
    return Promise.all(pending);
  }
}
class GLTFMaterialsEmissiveStrengthExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_EMISSIVE_STRENGTH;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const emissiveStrength = materialDef.extensions[this.name].emissiveStrength;
    if (emissiveStrength !== void 0) {
      materialParams.emissiveIntensity = emissiveStrength;
    }
    return Promise.resolve();
  }
}
class GLTFMaterialsClearcoatExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_CLEARCOAT;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const pending = [];
    const extension = materialDef.extensions[this.name];
    if (extension.clearcoatFactor !== void 0) {
      materialParams.clearcoat = extension.clearcoatFactor;
    }
    if (extension.clearcoatTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "clearcoatMap", extension.clearcoatTexture));
    }
    if (extension.clearcoatRoughnessFactor !== void 0) {
      materialParams.clearcoatRoughness = extension.clearcoatRoughnessFactor;
    }
    if (extension.clearcoatRoughnessTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "clearcoatRoughnessMap", extension.clearcoatRoughnessTexture));
    }
    if (extension.clearcoatNormalTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "clearcoatNormalMap", extension.clearcoatNormalTexture));
      if (extension.clearcoatNormalTexture.scale !== void 0) {
        const scale = extension.clearcoatNormalTexture.scale;
        materialParams.clearcoatNormalScale = new Vector2(scale, scale);
      }
    }
    return Promise.all(pending);
  }
}
class GLTFMaterialsDispersionExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_DISPERSION;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const extension = materialDef.extensions[this.name];
    materialParams.dispersion = extension.dispersion !== void 0 ? extension.dispersion : 0;
    return Promise.resolve();
  }
}
class GLTFMaterialsIridescenceExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_IRIDESCENCE;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const pending = [];
    const extension = materialDef.extensions[this.name];
    if (extension.iridescenceFactor !== void 0) {
      materialParams.iridescence = extension.iridescenceFactor;
    }
    if (extension.iridescenceTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "iridescenceMap", extension.iridescenceTexture));
    }
    if (extension.iridescenceIor !== void 0) {
      materialParams.iridescenceIOR = extension.iridescenceIor;
    }
    if (materialParams.iridescenceThicknessRange === void 0) {
      materialParams.iridescenceThicknessRange = [100, 400];
    }
    if (extension.iridescenceThicknessMinimum !== void 0) {
      materialParams.iridescenceThicknessRange[0] = extension.iridescenceThicknessMinimum;
    }
    if (extension.iridescenceThicknessMaximum !== void 0) {
      materialParams.iridescenceThicknessRange[1] = extension.iridescenceThicknessMaximum;
    }
    if (extension.iridescenceThicknessTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "iridescenceThicknessMap", extension.iridescenceThicknessTexture));
    }
    return Promise.all(pending);
  }
}
class GLTFMaterialsSheenExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_SHEEN;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const pending = [];
    materialParams.sheenColor = new Color(0, 0, 0);
    materialParams.sheenRoughness = 0;
    materialParams.sheen = 1;
    const extension = materialDef.extensions[this.name];
    if (extension.sheenColorFactor !== void 0) {
      const colorFactor = extension.sheenColorFactor;
      materialParams.sheenColor.setRGB(colorFactor[0], colorFactor[1], colorFactor[2], LinearSRGBColorSpace);
    }
    if (extension.sheenRoughnessFactor !== void 0) {
      materialParams.sheenRoughness = extension.sheenRoughnessFactor;
    }
    if (extension.sheenColorTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "sheenColorMap", extension.sheenColorTexture, SRGBColorSpace));
    }
    if (extension.sheenRoughnessTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "sheenRoughnessMap", extension.sheenRoughnessTexture));
    }
    return Promise.all(pending);
  }
}
class GLTFMaterialsTransmissionExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_TRANSMISSION;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const pending = [];
    const extension = materialDef.extensions[this.name];
    if (extension.transmissionFactor !== void 0) {
      materialParams.transmission = extension.transmissionFactor;
    }
    if (extension.transmissionTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "transmissionMap", extension.transmissionTexture));
    }
    return Promise.all(pending);
  }
}
class GLTFMaterialsVolumeExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_VOLUME;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const pending = [];
    const extension = materialDef.extensions[this.name];
    materialParams.thickness = extension.thicknessFactor !== void 0 ? extension.thicknessFactor : 0;
    if (extension.thicknessTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "thicknessMap", extension.thicknessTexture));
    }
    materialParams.attenuationDistance = extension.attenuationDistance || Infinity;
    const colorArray = extension.attenuationColor || [1, 1, 1];
    materialParams.attenuationColor = new Color().setRGB(colorArray[0], colorArray[1], colorArray[2], LinearSRGBColorSpace);
    return Promise.all(pending);
  }
}
class GLTFMaterialsIorExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_IOR;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const extension = materialDef.extensions[this.name];
    materialParams.ior = extension.ior !== void 0 ? extension.ior : 1.5;
    return Promise.resolve();
  }
}
class GLTFMaterialsSpecularExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_SPECULAR;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const pending = [];
    const extension = materialDef.extensions[this.name];
    materialParams.specularIntensity = extension.specularFactor !== void 0 ? extension.specularFactor : 1;
    if (extension.specularTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "specularIntensityMap", extension.specularTexture));
    }
    const colorArray = extension.specularColorFactor || [1, 1, 1];
    materialParams.specularColor = new Color().setRGB(colorArray[0], colorArray[1], colorArray[2], LinearSRGBColorSpace);
    if (extension.specularColorTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "specularColorMap", extension.specularColorTexture, SRGBColorSpace));
    }
    return Promise.all(pending);
  }
}
class GLTFMaterialsBumpExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.EXT_MATERIALS_BUMP;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const pending = [];
    const extension = materialDef.extensions[this.name];
    materialParams.bumpScale = extension.bumpFactor !== void 0 ? extension.bumpFactor : 1;
    if (extension.bumpTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "bumpMap", extension.bumpTexture));
    }
    return Promise.all(pending);
  }
}
class GLTFMaterialsAnisotropyExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_MATERIALS_ANISOTROPY;
  }
  getMaterialType(materialIndex) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return MeshPhysicalMaterial;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }
    const pending = [];
    const extension = materialDef.extensions[this.name];
    if (extension.anisotropyStrength !== void 0) {
      materialParams.anisotropy = extension.anisotropyStrength;
    }
    if (extension.anisotropyRotation !== void 0) {
      materialParams.anisotropyRotation = extension.anisotropyRotation;
    }
    if (extension.anisotropyTexture !== void 0) {
      pending.push(parser.assignTexture(materialParams, "anisotropyMap", extension.anisotropyTexture));
    }
    return Promise.all(pending);
  }
}
class GLTFTextureBasisUExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.KHR_TEXTURE_BASISU;
  }
  loadTexture(textureIndex) {
    const parser = this.parser;
    const json = parser.json;
    const textureDef = json.textures[textureIndex];
    if (!textureDef.extensions || !textureDef.extensions[this.name]) {
      return null;
    }
    const extension = textureDef.extensions[this.name];
    const loader = parser.options.ktx2Loader;
    if (!loader) {
      if (json.extensionsRequired && json.extensionsRequired.indexOf(this.name) >= 0) {
        throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");
      } else {
        return null;
      }
    }
    return parser.loadTextureImage(textureIndex, extension.source, loader);
  }
}
class GLTFTextureWebPExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.EXT_TEXTURE_WEBP;
    this.isSupported = null;
  }
  loadTexture(textureIndex) {
    const name = this.name;
    const parser = this.parser;
    const json = parser.json;
    const textureDef = json.textures[textureIndex];
    if (!textureDef.extensions || !textureDef.extensions[name]) {
      return null;
    }
    const extension = textureDef.extensions[name];
    const source = json.images[extension.source];
    let loader = parser.textureLoader;
    if (source.uri) {
      const handler = parser.options.manager.getHandler(source.uri);
      if (handler !== null) loader = handler;
    }
    return this.detectSupport().then(function(isSupported) {
      if (isSupported) return parser.loadTextureImage(textureIndex, extension.source, loader);
      if (json.extensionsRequired && json.extensionsRequired.indexOf(name) >= 0) {
        throw new Error("THREE.GLTFLoader: WebP required by asset but unsupported.");
      }
      return parser.loadTexture(textureIndex);
    });
  }
  detectSupport() {
    if (!this.isSupported) {
      this.isSupported = new Promise(function(resolve) {
        const image = new Image();
        image.src = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";
        image.onload = image.onerror = function() {
          resolve(image.height === 1);
        };
      });
    }
    return this.isSupported;
  }
}
class GLTFTextureAVIFExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = EXTENSIONS.EXT_TEXTURE_AVIF;
    this.isSupported = null;
  }
  loadTexture(textureIndex) {
    const name = this.name;
    const parser = this.parser;
    const json = parser.json;
    const textureDef = json.textures[textureIndex];
    if (!textureDef.extensions || !textureDef.extensions[name]) {
      return null;
    }
    const extension = textureDef.extensions[name];
    const source = json.images[extension.source];
    let loader = parser.textureLoader;
    if (source.uri) {
      const handler = parser.options.manager.getHandler(source.uri);
      if (handler !== null) loader = handler;
    }
    return this.detectSupport().then(function(isSupported) {
      if (isSupported) return parser.loadTextureImage(textureIndex, extension.source, loader);
      if (json.extensionsRequired && json.extensionsRequired.indexOf(name) >= 0) {
        throw new Error("THREE.GLTFLoader: AVIF required by asset but unsupported.");
      }
      return parser.loadTexture(textureIndex);
    });
  }
  detectSupport() {
    if (!this.isSupported) {
      this.isSupported = new Promise(function(resolve) {
        const image = new Image();
        image.src = "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAABcAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=";
        image.onload = image.onerror = function() {
          resolve(image.height === 1);
        };
      });
    }
    return this.isSupported;
  }
}
class GLTFMeshoptCompression {
  constructor(parser) {
    this.name = EXTENSIONS.EXT_MESHOPT_COMPRESSION;
    this.parser = parser;
  }
  loadBufferView(index) {
    const json = this.parser.json;
    const bufferView = json.bufferViews[index];
    if (bufferView.extensions && bufferView.extensions[this.name]) {
      const extensionDef = bufferView.extensions[this.name];
      const buffer = this.parser.getDependency("buffer", extensionDef.buffer);
      const decoder = this.parser.options.meshoptDecoder;
      if (!decoder || !decoder.supported) {
        if (json.extensionsRequired && json.extensionsRequired.indexOf(this.name) >= 0) {
          throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");
        } else {
          return null;
        }
      }
      return buffer.then(function(res) {
        const byteOffset = extensionDef.byteOffset || 0;
        const byteLength = extensionDef.byteLength || 0;
        const count = extensionDef.count;
        const stride = extensionDef.byteStride;
        const source = new Uint8Array(res, byteOffset, byteLength);
        if (decoder.decodeGltfBufferAsync) {
          return decoder.decodeGltfBufferAsync(count, stride, source, extensionDef.mode, extensionDef.filter).then(function(res2) {
            return res2.buffer;
          });
        } else {
          return decoder.ready.then(function() {
            const result = new ArrayBuffer(count * stride);
            decoder.decodeGltfBuffer(new Uint8Array(result), count, stride, source, extensionDef.mode, extensionDef.filter);
            return result;
          });
        }
      });
    } else {
      return null;
    }
  }
}
class GLTFMeshGpuInstancing {
  constructor(parser) {
    this.name = EXTENSIONS.EXT_MESH_GPU_INSTANCING;
    this.parser = parser;
  }
  createNodeMesh(nodeIndex) {
    const json = this.parser.json;
    const nodeDef = json.nodes[nodeIndex];
    if (!nodeDef.extensions || !nodeDef.extensions[this.name] || nodeDef.mesh === void 0) {
      return null;
    }
    const meshDef = json.meshes[nodeDef.mesh];
    for (const primitive of meshDef.primitives) {
      if (primitive.mode !== WEBGL_CONSTANTS.TRIANGLES && primitive.mode !== WEBGL_CONSTANTS.TRIANGLE_STRIP && primitive.mode !== WEBGL_CONSTANTS.TRIANGLE_FAN && primitive.mode !== void 0) {
        return null;
      }
    }
    const extensionDef = nodeDef.extensions[this.name];
    const attributesDef = extensionDef.attributes;
    const pending = [];
    const attributes = {};
    for (const key in attributesDef) {
      pending.push(this.parser.getDependency("accessor", attributesDef[key]).then((accessor) => {
        attributes[key] = accessor;
        return attributes[key];
      }));
    }
    if (pending.length < 1) {
      return null;
    }
    pending.push(this.parser.createNodeMesh(nodeIndex));
    return Promise.all(pending).then((results) => {
      const nodeObject = results.pop();
      const meshes = nodeObject.isGroup ? nodeObject.children : [nodeObject];
      const count = results[0].count;
      const instancedMeshes = [];
      for (const mesh of meshes) {
        const m = new Matrix4();
        const p = new Vector3();
        const q = new Quaternion();
        const s = new Vector3(1, 1, 1);
        const instancedMesh = new InstancedMesh(mesh.geometry, mesh.material, count);
        for (let i = 0; i < count; i++) {
          if (attributes.TRANSLATION) {
            p.fromBufferAttribute(attributes.TRANSLATION, i);
          }
          if (attributes.ROTATION) {
            q.fromBufferAttribute(attributes.ROTATION, i);
          }
          if (attributes.SCALE) {
            s.fromBufferAttribute(attributes.SCALE, i);
          }
          instancedMesh.setMatrixAt(i, m.compose(p, q, s));
        }
        for (const attributeName in attributes) {
          if (attributeName === "_COLOR_0") {
            const attr = attributes[attributeName];
            instancedMesh.instanceColor = new InstancedBufferAttribute(attr.array, attr.itemSize, attr.normalized);
          } else if (attributeName !== "TRANSLATION" && attributeName !== "ROTATION" && attributeName !== "SCALE") {
            mesh.geometry.setAttribute(attributeName, attributes[attributeName]);
          }
        }
        Object3D.prototype.copy.call(instancedMesh, mesh);
        this.parser.assignFinalMaterial(instancedMesh);
        instancedMeshes.push(instancedMesh);
      }
      if (nodeObject.isGroup) {
        nodeObject.clear();
        nodeObject.add(...instancedMeshes);
        return nodeObject;
      }
      return instancedMeshes[0];
    });
  }
}
const BINARY_EXTENSION_HEADER_MAGIC = "glTF";
const BINARY_EXTENSION_HEADER_LENGTH = 12;
const BINARY_EXTENSION_CHUNK_TYPES = { JSON: 1313821514, BIN: 5130562 };
class GLTFBinaryExtension {
  constructor(data) {
    this.name = EXTENSIONS.KHR_BINARY_GLTF;
    this.content = null;
    this.body = null;
    const headerView = new DataView(data, 0, BINARY_EXTENSION_HEADER_LENGTH);
    const textDecoder = new TextDecoder();
    this.header = {
      magic: textDecoder.decode(new Uint8Array(data.slice(0, 4))),
      version: headerView.getUint32(4, true),
      length: headerView.getUint32(8, true)
    };
    if (this.header.magic !== BINARY_EXTENSION_HEADER_MAGIC) {
      throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");
    } else if (this.header.version < 2) {
      throw new Error("THREE.GLTFLoader: Legacy binary file detected.");
    }
    const chunkContentsLength = this.header.length - BINARY_EXTENSION_HEADER_LENGTH;
    const chunkView = new DataView(data, BINARY_EXTENSION_HEADER_LENGTH);
    let chunkIndex = 0;
    while (chunkIndex < chunkContentsLength) {
      const chunkLength = chunkView.getUint32(chunkIndex, true);
      chunkIndex += 4;
      const chunkType = chunkView.getUint32(chunkIndex, true);
      chunkIndex += 4;
      if (chunkType === BINARY_EXTENSION_CHUNK_TYPES.JSON) {
        const contentArray = new Uint8Array(data, BINARY_EXTENSION_HEADER_LENGTH + chunkIndex, chunkLength);
        this.content = textDecoder.decode(contentArray);
      } else if (chunkType === BINARY_EXTENSION_CHUNK_TYPES.BIN) {
        const byteOffset = BINARY_EXTENSION_HEADER_LENGTH + chunkIndex;
        this.body = data.slice(byteOffset, byteOffset + chunkLength);
      }
      chunkIndex += chunkLength;
    }
    if (this.content === null) {
      throw new Error("THREE.GLTFLoader: JSON content not found.");
    }
  }
}
class GLTFDracoMeshCompressionExtension {
  constructor(json, dracoLoader) {
    if (!dracoLoader) {
      throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");
    }
    this.name = EXTENSIONS.KHR_DRACO_MESH_COMPRESSION;
    this.json = json;
    this.dracoLoader = dracoLoader;
    this.dracoLoader.preload();
  }
  decodePrimitive(primitive, parser) {
    const json = this.json;
    const dracoLoader = this.dracoLoader;
    const bufferViewIndex = primitive.extensions[this.name].bufferView;
    const gltfAttributeMap = primitive.extensions[this.name].attributes;
    const threeAttributeMap = {};
    const attributeNormalizedMap = {};
    const attributeTypeMap = {};
    for (const attributeName in gltfAttributeMap) {
      const threeAttributeName = ATTRIBUTES[attributeName] || attributeName.toLowerCase();
      threeAttributeMap[threeAttributeName] = gltfAttributeMap[attributeName];
    }
    for (const attributeName in primitive.attributes) {
      const threeAttributeName = ATTRIBUTES[attributeName] || attributeName.toLowerCase();
      if (gltfAttributeMap[attributeName] !== void 0) {
        const accessorDef = json.accessors[primitive.attributes[attributeName]];
        const componentType = WEBGL_COMPONENT_TYPES[accessorDef.componentType];
        attributeTypeMap[threeAttributeName] = componentType.name;
        attributeNormalizedMap[threeAttributeName] = accessorDef.normalized === true;
      }
    }
    return parser.getDependency("bufferView", bufferViewIndex).then(function(bufferView) {
      return new Promise(function(resolve, reject) {
        dracoLoader.decodeDracoFile(bufferView, function(geometry) {
          for (const attributeName in geometry.attributes) {
            const attribute = geometry.attributes[attributeName];
            const normalized = attributeNormalizedMap[attributeName];
            if (normalized !== void 0) attribute.normalized = normalized;
          }
          resolve(geometry);
        }, threeAttributeMap, attributeTypeMap, LinearSRGBColorSpace, reject);
      });
    });
  }
}
class GLTFTextureTransformExtension {
  constructor() {
    this.name = EXTENSIONS.KHR_TEXTURE_TRANSFORM;
  }
  extendTexture(texture, transform) {
    if ((transform.texCoord === void 0 || transform.texCoord === texture.channel) && transform.offset === void 0 && transform.rotation === void 0 && transform.scale === void 0) {
      return texture;
    }
    texture = texture.clone();
    if (transform.texCoord !== void 0) {
      texture.channel = transform.texCoord;
    }
    if (transform.offset !== void 0) {
      texture.offset.fromArray(transform.offset);
    }
    if (transform.rotation !== void 0) {
      texture.rotation = transform.rotation;
    }
    if (transform.scale !== void 0) {
      texture.repeat.fromArray(transform.scale);
    }
    texture.needsUpdate = true;
    return texture;
  }
}
class GLTFMeshQuantizationExtension {
  constructor() {
    this.name = EXTENSIONS.KHR_MESH_QUANTIZATION;
  }
}
class GLTFCubicSplineInterpolant extends Interpolant {
  constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
    super(parameterPositions, sampleValues, sampleSize, resultBuffer);
  }
  copySampleValue_(index) {
    const result = this.resultBuffer, values = this.sampleValues, valueSize = this.valueSize, offset = index * valueSize * 3 + valueSize;
    for (let i = 0; i !== valueSize; i++) {
      result[i] = values[offset + i];
    }
    return result;
  }
  interpolate_(i1, t0, t, t1) {
    const result = this.resultBuffer;
    const values = this.sampleValues;
    const stride = this.valueSize;
    const stride2 = stride * 2;
    const stride3 = stride * 3;
    const td = t1 - t0;
    const p = (t - t0) / td;
    const pp = p * p;
    const ppp = pp * p;
    const offset1 = i1 * stride3;
    const offset0 = offset1 - stride3;
    const s2 = -2 * ppp + 3 * pp;
    const s3 = ppp - pp;
    const s0 = 1 - s2;
    const s1 = s3 - pp + p;
    for (let i = 0; i !== stride; i++) {
      const p0 = values[offset0 + i + stride];
      const m0 = values[offset0 + i + stride2] * td;
      const p1 = values[offset1 + i + stride];
      const m1 = values[offset1 + i] * td;
      result[i] = s0 * p0 + s1 * m0 + s2 * p1 + s3 * m1;
    }
    return result;
  }
}
const _q = new Quaternion();
class GLTFCubicSplineQuaternionInterpolant extends GLTFCubicSplineInterpolant {
  interpolate_(i1, t0, t, t1) {
    const result = super.interpolate_(i1, t0, t, t1);
    _q.fromArray(result).normalize().toArray(result);
    return result;
  }
}
const WEBGL_CONSTANTS = {
  POINTS: 0,
  LINES: 1,
  LINE_LOOP: 2,
  LINE_STRIP: 3,
  TRIANGLES: 4,
  TRIANGLE_STRIP: 5,
  TRIANGLE_FAN: 6
};
const WEBGL_COMPONENT_TYPES = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array
};
const WEBGL_FILTERS = {
  9728: NearestFilter,
  9729: LinearFilter,
  9984: NearestMipmapNearestFilter,
  9985: LinearMipmapNearestFilter,
  9986: NearestMipmapLinearFilter,
  9987: LinearMipmapLinearFilter
};
const WEBGL_WRAPPINGS = {
  33071: ClampToEdgeWrapping,
  33648: MirroredRepeatWrapping,
  10497: RepeatWrapping
};
const WEBGL_TYPE_SIZES = {
  "SCALAR": 1,
  "VEC2": 2,
  "VEC3": 3,
  "VEC4": 4,
  "MAT2": 4,
  "MAT3": 9,
  "MAT4": 16
};
const ATTRIBUTES = {
  POSITION: "position",
  NORMAL: "normal",
  TANGENT: "tangent",
  TEXCOORD_0: "uv",
  TEXCOORD_1: "uv1",
  TEXCOORD_2: "uv2",
  TEXCOORD_3: "uv3",
  COLOR_0: "color",
  WEIGHTS_0: "skinWeight",
  JOINTS_0: "skinIndex"
};
const PATH_PROPERTIES = {
  scale: "scale",
  translation: "position",
  rotation: "quaternion",
  weights: "morphTargetInfluences"
};
const INTERPOLATION = {
  CUBICSPLINE: void 0,
  // We use a custom interpolant (GLTFCubicSplineInterpolation) for CUBICSPLINE tracks. Each
  // keyframe track will be initialized with a default interpolation type, then modified.
  LINEAR: InterpolateLinear,
  STEP: InterpolateDiscrete
};
const ALPHA_MODES = {
  OPAQUE: "OPAQUE",
  MASK: "MASK",
  BLEND: "BLEND"
};
function createDefaultMaterial(cache) {
  if (cache["DefaultMaterial"] === void 0) {
    cache["DefaultMaterial"] = new MeshStandardMaterial({
      color: 16777215,
      emissive: 0,
      metalness: 1,
      roughness: 1,
      transparent: false,
      depthTest: true,
      side: FrontSide
    });
  }
  return cache["DefaultMaterial"];
}
function addUnknownExtensionsToUserData(knownExtensions, object, objectDef) {
  for (const name in objectDef.extensions) {
    if (knownExtensions[name] === void 0) {
      object.userData.gltfExtensions = object.userData.gltfExtensions || {};
      object.userData.gltfExtensions[name] = objectDef.extensions[name];
    }
  }
}
function assignExtrasToUserData(object, gltfDef) {
  if (gltfDef.extras !== void 0) {
    if (typeof gltfDef.extras === "object") {
      Object.assign(object.userData, gltfDef.extras);
    } else {
      console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, " + gltfDef.extras);
    }
  }
}
function addMorphTargets(geometry, targets, parser) {
  let hasMorphPosition = false;
  let hasMorphNormal = false;
  let hasMorphColor = false;
  for (let i = 0, il = targets.length; i < il; i++) {
    const target = targets[i];
    if (target.POSITION !== void 0) hasMorphPosition = true;
    if (target.NORMAL !== void 0) hasMorphNormal = true;
    if (target.COLOR_0 !== void 0) hasMorphColor = true;
    if (hasMorphPosition && hasMorphNormal && hasMorphColor) break;
  }
  if (!hasMorphPosition && !hasMorphNormal && !hasMorphColor) return Promise.resolve(geometry);
  const pendingPositionAccessors = [];
  const pendingNormalAccessors = [];
  const pendingColorAccessors = [];
  for (let i = 0, il = targets.length; i < il; i++) {
    const target = targets[i];
    if (hasMorphPosition) {
      const pendingAccessor = target.POSITION !== void 0 ? parser.getDependency("accessor", target.POSITION) : geometry.attributes.position;
      pendingPositionAccessors.push(pendingAccessor);
    }
    if (hasMorphNormal) {
      const pendingAccessor = target.NORMAL !== void 0 ? parser.getDependency("accessor", target.NORMAL) : geometry.attributes.normal;
      pendingNormalAccessors.push(pendingAccessor);
    }
    if (hasMorphColor) {
      const pendingAccessor = target.COLOR_0 !== void 0 ? parser.getDependency("accessor", target.COLOR_0) : geometry.attributes.color;
      pendingColorAccessors.push(pendingAccessor);
    }
  }
  return Promise.all([
    Promise.all(pendingPositionAccessors),
    Promise.all(pendingNormalAccessors),
    Promise.all(pendingColorAccessors)
  ]).then(function(accessors) {
    const morphPositions = accessors[0];
    const morphNormals = accessors[1];
    const morphColors = accessors[2];
    if (hasMorphPosition) geometry.morphAttributes.position = morphPositions;
    if (hasMorphNormal) geometry.morphAttributes.normal = morphNormals;
    if (hasMorphColor) geometry.morphAttributes.color = morphColors;
    geometry.morphTargetsRelative = true;
    return geometry;
  });
}
function updateMorphTargets(mesh, meshDef) {
  mesh.updateMorphTargets();
  if (meshDef.weights !== void 0) {
    for (let i = 0, il = meshDef.weights.length; i < il; i++) {
      mesh.morphTargetInfluences[i] = meshDef.weights[i];
    }
  }
  if (meshDef.extras && Array.isArray(meshDef.extras.targetNames)) {
    const targetNames = meshDef.extras.targetNames;
    if (mesh.morphTargetInfluences.length === targetNames.length) {
      mesh.morphTargetDictionary = {};
      for (let i = 0, il = targetNames.length; i < il; i++) {
        mesh.morphTargetDictionary[targetNames[i]] = i;
      }
    } else {
      console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.");
    }
  }
}
function createPrimitiveKey(primitiveDef) {
  let geometryKey;
  const dracoExtension = primitiveDef.extensions && primitiveDef.extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION];
  if (dracoExtension) {
    geometryKey = "draco:" + dracoExtension.bufferView + ":" + dracoExtension.indices + ":" + createAttributesKey(dracoExtension.attributes);
  } else {
    geometryKey = primitiveDef.indices + ":" + createAttributesKey(primitiveDef.attributes) + ":" + primitiveDef.mode;
  }
  if (primitiveDef.targets !== void 0) {
    for (let i = 0, il = primitiveDef.targets.length; i < il; i++) {
      geometryKey += ":" + createAttributesKey(primitiveDef.targets[i]);
    }
  }
  return geometryKey;
}
function createAttributesKey(attributes) {
  let attributesKey = "";
  const keys = Object.keys(attributes).sort();
  for (let i = 0, il = keys.length; i < il; i++) {
    attributesKey += keys[i] + ":" + attributes[keys[i]] + ";";
  }
  return attributesKey;
}
function getNormalizedComponentScale(constructor) {
  switch (constructor) {
    case Int8Array:
      return 1 / 127;
    case Uint8Array:
      return 1 / 255;
    case Int16Array:
      return 1 / 32767;
    case Uint16Array:
      return 1 / 65535;
    default:
      throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.");
  }
}
function getImageURIMimeType(uri) {
  if (uri.search(/\.jpe?g($|\?)/i) > 0 || uri.search(/^data\:image\/jpeg/) === 0) return "image/jpeg";
  if (uri.search(/\.webp($|\?)/i) > 0 || uri.search(/^data\:image\/webp/) === 0) return "image/webp";
  return "image/png";
}
const _identityMatrix = new Matrix4();
class GLTFParser {
  constructor(json = {}, options = {}) {
    this.json = json;
    this.extensions = {};
    this.plugins = {};
    this.options = options;
    this.cache = new GLTFRegistry();
    this.associations = /* @__PURE__ */ new Map();
    this.primitiveCache = {};
    this.nodeCache = {};
    this.meshCache = { refs: {}, uses: {} };
    this.cameraCache = { refs: {}, uses: {} };
    this.lightCache = { refs: {}, uses: {} };
    this.sourceCache = {};
    this.textureCache = {};
    this.nodeNamesUsed = {};
    let isSafari = false;
    let safariVersion = -1;
    let isFirefox = false;
    let firefoxVersion = -1;
    if (typeof navigator !== "undefined") {
      const userAgent = navigator.userAgent;
      isSafari = /^((?!chrome|android).)*safari/i.test(userAgent) === true;
      const safariMatch = userAgent.match(/Version\/(\d+)/);
      safariVersion = isSafari && safariMatch ? parseInt(safariMatch[1], 10) : -1;
      isFirefox = userAgent.indexOf("Firefox") > -1;
      firefoxVersion = isFirefox ? userAgent.match(/Firefox\/([0-9]+)\./)[1] : -1;
    }
    if (typeof createImageBitmap === "undefined" || isSafari && safariVersion < 17 || isFirefox && firefoxVersion < 98) {
      this.textureLoader = new TextureLoader(this.options.manager);
    } else {
      this.textureLoader = new ImageBitmapLoader(this.options.manager);
    }
    this.textureLoader.setCrossOrigin(this.options.crossOrigin);
    this.textureLoader.setRequestHeader(this.options.requestHeader);
    this.fileLoader = new FileLoader(this.options.manager);
    this.fileLoader.setResponseType("arraybuffer");
    if (this.options.crossOrigin === "use-credentials") {
      this.fileLoader.setWithCredentials(true);
    }
  }
  setExtensions(extensions) {
    this.extensions = extensions;
  }
  setPlugins(plugins) {
    this.plugins = plugins;
  }
  parse(onLoad, onError) {
    const parser = this;
    const json = this.json;
    const extensions = this.extensions;
    this.cache.removeAll();
    this.nodeCache = {};
    this._invokeAll(function(ext) {
      return ext._markDefs && ext._markDefs();
    });
    Promise.all(this._invokeAll(function(ext) {
      return ext.beforeRoot && ext.beforeRoot();
    })).then(function() {
      return Promise.all([
        parser.getDependencies("scene"),
        parser.getDependencies("animation"),
        parser.getDependencies("camera")
      ]);
    }).then(function(dependencies) {
      const result = {
        scene: dependencies[0][json.scene || 0],
        scenes: dependencies[0],
        animations: dependencies[1],
        cameras: dependencies[2],
        asset: json.asset,
        parser,
        userData: {}
      };
      addUnknownExtensionsToUserData(extensions, result, json);
      assignExtrasToUserData(result, json);
      return Promise.all(parser._invokeAll(function(ext) {
        return ext.afterRoot && ext.afterRoot(result);
      })).then(function() {
        for (const scene2 of result.scenes) {
          scene2.updateMatrixWorld();
        }
        onLoad(result);
      });
    }).catch(onError);
  }
  /**
   * Marks the special nodes/meshes in json for efficient parse.
   */
  _markDefs() {
    const nodeDefs = this.json.nodes || [];
    const skinDefs = this.json.skins || [];
    const meshDefs = this.json.meshes || [];
    for (let skinIndex = 0, skinLength = skinDefs.length; skinIndex < skinLength; skinIndex++) {
      const joints = skinDefs[skinIndex].joints;
      for (let i = 0, il = joints.length; i < il; i++) {
        nodeDefs[joints[i]].isBone = true;
      }
    }
    for (let nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex++) {
      const nodeDef = nodeDefs[nodeIndex];
      if (nodeDef.mesh !== void 0) {
        this._addNodeRef(this.meshCache, nodeDef.mesh);
        if (nodeDef.skin !== void 0) {
          meshDefs[nodeDef.mesh].isSkinnedMesh = true;
        }
      }
      if (nodeDef.camera !== void 0) {
        this._addNodeRef(this.cameraCache, nodeDef.camera);
      }
    }
  }
  /**
   * Counts references to shared node / Object3D resources. These resources
   * can be reused, or "instantiated", at multiple nodes in the scene
   * hierarchy. Mesh, Camera, and Light instances are instantiated and must
   * be marked. Non-scenegraph resources (like Materials, Geometries, and
   * Textures) can be reused directly and are not marked here.
   *
   * Example: CesiumMilkTruck sample model reuses "Wheel" meshes.
   */
  _addNodeRef(cache, index) {
    if (index === void 0) return;
    if (cache.refs[index] === void 0) {
      cache.refs[index] = cache.uses[index] = 0;
    }
    cache.refs[index]++;
  }
  /** Returns a reference to a shared resource, cloning it if necessary. */
  _getNodeRef(cache, index, object) {
    if (cache.refs[index] <= 1) return object;
    const ref = object.clone();
    const updateMappings = (original, clone) => {
      const mappings = this.associations.get(original);
      if (mappings != null) {
        this.associations.set(clone, mappings);
      }
      for (const [i, child] of original.children.entries()) {
        updateMappings(child, clone.children[i]);
      }
    };
    updateMappings(object, ref);
    ref.name += "_instance_" + cache.uses[index]++;
    return ref;
  }
  _invokeOne(func) {
    const extensions = Object.values(this.plugins);
    extensions.push(this);
    for (let i = 0; i < extensions.length; i++) {
      const result = func(extensions[i]);
      if (result) return result;
    }
    return null;
  }
  _invokeAll(func) {
    const extensions = Object.values(this.plugins);
    extensions.unshift(this);
    const pending = [];
    for (let i = 0; i < extensions.length; i++) {
      const result = func(extensions[i]);
      if (result) pending.push(result);
    }
    return pending;
  }
  /**
   * Requests the specified dependency asynchronously, with caching.
   * @param {string} type
   * @param {number} index
   * @return {Promise<Object3D|Material|THREE.Texture|AnimationClip|ArrayBuffer|Object>}
   */
  getDependency(type, index) {
    const cacheKey = type + ":" + index;
    let dependency = this.cache.get(cacheKey);
    if (!dependency) {
      switch (type) {
        case "scene":
          dependency = this.loadScene(index);
          break;
        case "node":
          dependency = this._invokeOne(function(ext) {
            return ext.loadNode && ext.loadNode(index);
          });
          break;
        case "mesh":
          dependency = this._invokeOne(function(ext) {
            return ext.loadMesh && ext.loadMesh(index);
          });
          break;
        case "accessor":
          dependency = this.loadAccessor(index);
          break;
        case "bufferView":
          dependency = this._invokeOne(function(ext) {
            return ext.loadBufferView && ext.loadBufferView(index);
          });
          break;
        case "buffer":
          dependency = this.loadBuffer(index);
          break;
        case "material":
          dependency = this._invokeOne(function(ext) {
            return ext.loadMaterial && ext.loadMaterial(index);
          });
          break;
        case "texture":
          dependency = this._invokeOne(function(ext) {
            return ext.loadTexture && ext.loadTexture(index);
          });
          break;
        case "skin":
          dependency = this.loadSkin(index);
          break;
        case "animation":
          dependency = this._invokeOne(function(ext) {
            return ext.loadAnimation && ext.loadAnimation(index);
          });
          break;
        case "camera":
          dependency = this.loadCamera(index);
          break;
        default:
          dependency = this._invokeOne(function(ext) {
            return ext != this && ext.getDependency && ext.getDependency(type, index);
          });
          if (!dependency) {
            throw new Error("Unknown type: " + type);
          }
          break;
      }
      this.cache.add(cacheKey, dependency);
    }
    return dependency;
  }
  /**
   * Requests all dependencies of the specified type asynchronously, with caching.
   * @param {string} type
   * @return {Promise<Array<Object>>}
   */
  getDependencies(type) {
    let dependencies = this.cache.get(type);
    if (!dependencies) {
      const parser = this;
      const defs = this.json[type + (type === "mesh" ? "es" : "s")] || [];
      dependencies = Promise.all(defs.map(function(def, index) {
        return parser.getDependency(type, index);
      }));
      this.cache.add(type, dependencies);
    }
    return dependencies;
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
   * @param {number} bufferIndex
   * @return {Promise<ArrayBuffer>}
   */
  loadBuffer(bufferIndex) {
    const bufferDef = this.json.buffers[bufferIndex];
    const loader = this.fileLoader;
    if (bufferDef.type && bufferDef.type !== "arraybuffer") {
      throw new Error("THREE.GLTFLoader: " + bufferDef.type + " buffer type is not supported.");
    }
    if (bufferDef.uri === void 0 && bufferIndex === 0) {
      return Promise.resolve(this.extensions[EXTENSIONS.KHR_BINARY_GLTF].body);
    }
    const options = this.options;
    return new Promise(function(resolve, reject) {
      loader.load(LoaderUtils.resolveURL(bufferDef.uri, options.path), resolve, void 0, function() {
        reject(new Error('THREE.GLTFLoader: Failed to load buffer "' + bufferDef.uri + '".'));
      });
    });
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
   * @param {number} bufferViewIndex
   * @return {Promise<ArrayBuffer>}
   */
  loadBufferView(bufferViewIndex) {
    const bufferViewDef = this.json.bufferViews[bufferViewIndex];
    return this.getDependency("buffer", bufferViewDef.buffer).then(function(buffer) {
      const byteLength = bufferViewDef.byteLength || 0;
      const byteOffset = bufferViewDef.byteOffset || 0;
      return buffer.slice(byteOffset, byteOffset + byteLength);
    });
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#accessors
   * @param {number} accessorIndex
   * @return {Promise<BufferAttribute|InterleavedBufferAttribute>}
   */
  loadAccessor(accessorIndex) {
    const parser = this;
    const json = this.json;
    const accessorDef = this.json.accessors[accessorIndex];
    if (accessorDef.bufferView === void 0 && accessorDef.sparse === void 0) {
      const itemSize = WEBGL_TYPE_SIZES[accessorDef.type];
      const TypedArray = WEBGL_COMPONENT_TYPES[accessorDef.componentType];
      const normalized = accessorDef.normalized === true;
      const array = new TypedArray(accessorDef.count * itemSize);
      return Promise.resolve(new BufferAttribute(array, itemSize, normalized));
    }
    const pendingBufferViews = [];
    if (accessorDef.bufferView !== void 0) {
      pendingBufferViews.push(this.getDependency("bufferView", accessorDef.bufferView));
    } else {
      pendingBufferViews.push(null);
    }
    if (accessorDef.sparse !== void 0) {
      pendingBufferViews.push(this.getDependency("bufferView", accessorDef.sparse.indices.bufferView));
      pendingBufferViews.push(this.getDependency("bufferView", accessorDef.sparse.values.bufferView));
    }
    return Promise.all(pendingBufferViews).then(function(bufferViews) {
      const bufferView = bufferViews[0];
      const itemSize = WEBGL_TYPE_SIZES[accessorDef.type];
      const TypedArray = WEBGL_COMPONENT_TYPES[accessorDef.componentType];
      const elementBytes = TypedArray.BYTES_PER_ELEMENT;
      const itemBytes = elementBytes * itemSize;
      const byteOffset = accessorDef.byteOffset || 0;
      const byteStride = accessorDef.bufferView !== void 0 ? json.bufferViews[accessorDef.bufferView].byteStride : void 0;
      const normalized = accessorDef.normalized === true;
      let array, bufferAttribute;
      if (byteStride && byteStride !== itemBytes) {
        const ibSlice = Math.floor(byteOffset / byteStride);
        const ibCacheKey = "InterleavedBuffer:" + accessorDef.bufferView + ":" + accessorDef.componentType + ":" + ibSlice + ":" + accessorDef.count;
        let ib = parser.cache.get(ibCacheKey);
        if (!ib) {
          array = new TypedArray(bufferView, ibSlice * byteStride, accessorDef.count * byteStride / elementBytes);
          ib = new InterleavedBuffer(array, byteStride / elementBytes);
          parser.cache.add(ibCacheKey, ib);
        }
        bufferAttribute = new InterleavedBufferAttribute(ib, itemSize, byteOffset % byteStride / elementBytes, normalized);
      } else {
        if (bufferView === null) {
          array = new TypedArray(accessorDef.count * itemSize);
        } else {
          array = new TypedArray(bufferView, byteOffset, accessorDef.count * itemSize);
        }
        bufferAttribute = new BufferAttribute(array, itemSize, normalized);
      }
      if (accessorDef.sparse !== void 0) {
        const itemSizeIndices = WEBGL_TYPE_SIZES.SCALAR;
        const TypedArrayIndices = WEBGL_COMPONENT_TYPES[accessorDef.sparse.indices.componentType];
        const byteOffsetIndices = accessorDef.sparse.indices.byteOffset || 0;
        const byteOffsetValues = accessorDef.sparse.values.byteOffset || 0;
        const sparseIndices = new TypedArrayIndices(bufferViews[1], byteOffsetIndices, accessorDef.sparse.count * itemSizeIndices);
        const sparseValues = new TypedArray(bufferViews[2], byteOffsetValues, accessorDef.sparse.count * itemSize);
        if (bufferView !== null) {
          bufferAttribute = new BufferAttribute(bufferAttribute.array.slice(), bufferAttribute.itemSize, bufferAttribute.normalized);
        }
        for (let i = 0, il = sparseIndices.length; i < il; i++) {
          const index = sparseIndices[i];
          bufferAttribute.setX(index, sparseValues[i * itemSize]);
          if (itemSize >= 2) bufferAttribute.setY(index, sparseValues[i * itemSize + 1]);
          if (itemSize >= 3) bufferAttribute.setZ(index, sparseValues[i * itemSize + 2]);
          if (itemSize >= 4) bufferAttribute.setW(index, sparseValues[i * itemSize + 3]);
          if (itemSize >= 5) throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.");
        }
      }
      return bufferAttribute;
    });
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#textures
   * @param {number} textureIndex
   * @return {Promise<THREE.Texture|null>}
   */
  loadTexture(textureIndex) {
    const json = this.json;
    const options = this.options;
    const textureDef = json.textures[textureIndex];
    const sourceIndex = textureDef.source;
    const sourceDef = json.images[sourceIndex];
    let loader = this.textureLoader;
    if (sourceDef.uri) {
      const handler = options.manager.getHandler(sourceDef.uri);
      if (handler !== null) loader = handler;
    }
    return this.loadTextureImage(textureIndex, sourceIndex, loader);
  }
  loadTextureImage(textureIndex, sourceIndex, loader) {
    const parser = this;
    const json = this.json;
    const textureDef = json.textures[textureIndex];
    const sourceDef = json.images[sourceIndex];
    const cacheKey = (sourceDef.uri || sourceDef.bufferView) + ":" + textureDef.sampler;
    if (this.textureCache[cacheKey]) {
      return this.textureCache[cacheKey];
    }
    const promise = this.loadImageSource(sourceIndex, loader).then(function(texture) {
      texture.flipY = false;
      texture.name = textureDef.name || sourceDef.name || "";
      if (texture.name === "" && typeof sourceDef.uri === "string" && sourceDef.uri.startsWith("data:image/") === false) {
        texture.name = sourceDef.uri;
      }
      const samplers = json.samplers || {};
      const sampler = samplers[textureDef.sampler] || {};
      texture.magFilter = WEBGL_FILTERS[sampler.magFilter] || LinearFilter;
      texture.minFilter = WEBGL_FILTERS[sampler.minFilter] || LinearMipmapLinearFilter;
      texture.wrapS = WEBGL_WRAPPINGS[sampler.wrapS] || RepeatWrapping;
      texture.wrapT = WEBGL_WRAPPINGS[sampler.wrapT] || RepeatWrapping;
      parser.associations.set(texture, { textures: textureIndex });
      return texture;
    }).catch(function() {
      return null;
    });
    this.textureCache[cacheKey] = promise;
    return promise;
  }
  loadImageSource(sourceIndex, loader) {
    const parser = this;
    const json = this.json;
    const options = this.options;
    if (this.sourceCache[sourceIndex] !== void 0) {
      return this.sourceCache[sourceIndex].then((texture) => texture.clone());
    }
    const sourceDef = json.images[sourceIndex];
    const URL = self.URL || self.webkitURL;
    let sourceURI = sourceDef.uri || "";
    let isObjectURL = false;
    if (sourceDef.bufferView !== void 0) {
      sourceURI = parser.getDependency("bufferView", sourceDef.bufferView).then(function(bufferView) {
        isObjectURL = true;
        const blob = new Blob([bufferView], { type: sourceDef.mimeType });
        sourceURI = URL.createObjectURL(blob);
        return sourceURI;
      });
    } else if (sourceDef.uri === void 0) {
      throw new Error("THREE.GLTFLoader: Image " + sourceIndex + " is missing URI and bufferView");
    }
    const promise = Promise.resolve(sourceURI).then(function(sourceURI2) {
      return new Promise(function(resolve, reject) {
        let onLoad = resolve;
        if (loader.isImageBitmapLoader === true) {
          onLoad = function(imageBitmap) {
            const texture = new Texture(imageBitmap);
            texture.needsUpdate = true;
            resolve(texture);
          };
        }
        loader.load(LoaderUtils.resolveURL(sourceURI2, options.path), onLoad, void 0, reject);
      });
    }).then(function(texture) {
      if (isObjectURL === true) {
        URL.revokeObjectURL(sourceURI);
      }
      assignExtrasToUserData(texture, sourceDef);
      texture.userData.mimeType = sourceDef.mimeType || getImageURIMimeType(sourceDef.uri);
      return texture;
    }).catch(function(error) {
      console.error("THREE.GLTFLoader: Couldn't load texture", sourceURI);
      throw error;
    });
    this.sourceCache[sourceIndex] = promise;
    return promise;
  }
  /**
   * Asynchronously assigns a texture to the given material parameters.
   * @param {Object} materialParams
   * @param {string} mapName
   * @param {Object} mapDef
   * @return {Promise<Texture>}
   */
  assignTexture(materialParams, mapName, mapDef, colorSpace) {
    const parser = this;
    return this.getDependency("texture", mapDef.index).then(function(texture) {
      if (!texture) return null;
      if (mapDef.texCoord !== void 0 && mapDef.texCoord > 0) {
        texture = texture.clone();
        texture.channel = mapDef.texCoord;
      }
      if (parser.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM]) {
        const transform = mapDef.extensions !== void 0 ? mapDef.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM] : void 0;
        if (transform) {
          const gltfReference = parser.associations.get(texture);
          texture = parser.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM].extendTexture(texture, transform);
          parser.associations.set(texture, gltfReference);
        }
      }
      if (colorSpace !== void 0) {
        texture.colorSpace = colorSpace;
      }
      materialParams[mapName] = texture;
      return texture;
    });
  }
  /**
   * Assigns final material to a Mesh, Line, or Points instance. The instance
   * already has a material (generated from the glTF material options alone)
   * but reuse of the same glTF material may require multiple threejs materials
   * to accommodate different primitive types, defines, etc. New materials will
   * be created if necessary, and reused from a cache.
   * @param  {Object3D} mesh Mesh, Line, or Points instance.
   */
  assignFinalMaterial(mesh) {
    const geometry = mesh.geometry;
    let material = mesh.material;
    const useDerivativeTangents = geometry.attributes.tangent === void 0;
    const useVertexColors = geometry.attributes.color !== void 0;
    const useFlatShading = geometry.attributes.normal === void 0;
    if (mesh.isPoints) {
      const cacheKey = "PointsMaterial:" + material.uuid;
      let pointsMaterial = this.cache.get(cacheKey);
      if (!pointsMaterial) {
        pointsMaterial = new PointsMaterial();
        Material.prototype.copy.call(pointsMaterial, material);
        pointsMaterial.color.copy(material.color);
        pointsMaterial.map = material.map;
        pointsMaterial.sizeAttenuation = false;
        this.cache.add(cacheKey, pointsMaterial);
      }
      material = pointsMaterial;
    } else if (mesh.isLine) {
      const cacheKey = "LineBasicMaterial:" + material.uuid;
      let lineMaterial = this.cache.get(cacheKey);
      if (!lineMaterial) {
        lineMaterial = new LineBasicMaterial();
        Material.prototype.copy.call(lineMaterial, material);
        lineMaterial.color.copy(material.color);
        lineMaterial.map = material.map;
        this.cache.add(cacheKey, lineMaterial);
      }
      material = lineMaterial;
    }
    if (useDerivativeTangents || useVertexColors || useFlatShading) {
      let cacheKey = "ClonedMaterial:" + material.uuid + ":";
      if (useDerivativeTangents) cacheKey += "derivative-tangents:";
      if (useVertexColors) cacheKey += "vertex-colors:";
      if (useFlatShading) cacheKey += "flat-shading:";
      let cachedMaterial = this.cache.get(cacheKey);
      if (!cachedMaterial) {
        cachedMaterial = material.clone();
        if (useVertexColors) cachedMaterial.vertexColors = true;
        if (useFlatShading) cachedMaterial.flatShading = true;
        if (useDerivativeTangents) {
          if (cachedMaterial.normalScale) cachedMaterial.normalScale.y *= -1;
          if (cachedMaterial.clearcoatNormalScale) cachedMaterial.clearcoatNormalScale.y *= -1;
        }
        this.cache.add(cacheKey, cachedMaterial);
        this.associations.set(cachedMaterial, this.associations.get(material));
      }
      material = cachedMaterial;
    }
    mesh.material = material;
  }
  getMaterialType() {
    return MeshStandardMaterial;
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#materials
   * @param {number} materialIndex
   * @return {Promise<Material>}
   */
  loadMaterial(materialIndex) {
    const parser = this;
    const json = this.json;
    const extensions = this.extensions;
    const materialDef = json.materials[materialIndex];
    let materialType;
    const materialParams = {};
    const materialExtensions = materialDef.extensions || {};
    const pending = [];
    if (materialExtensions[EXTENSIONS.KHR_MATERIALS_UNLIT]) {
      const kmuExtension = extensions[EXTENSIONS.KHR_MATERIALS_UNLIT];
      materialType = kmuExtension.getMaterialType();
      pending.push(kmuExtension.extendParams(materialParams, materialDef, parser));
    } else {
      const metallicRoughness = materialDef.pbrMetallicRoughness || {};
      materialParams.color = new Color(1, 1, 1);
      materialParams.opacity = 1;
      if (Array.isArray(metallicRoughness.baseColorFactor)) {
        const array = metallicRoughness.baseColorFactor;
        materialParams.color.setRGB(array[0], array[1], array[2], LinearSRGBColorSpace);
        materialParams.opacity = array[3];
      }
      if (metallicRoughness.baseColorTexture !== void 0) {
        pending.push(parser.assignTexture(materialParams, "map", metallicRoughness.baseColorTexture, SRGBColorSpace));
      }
      materialParams.metalness = metallicRoughness.metallicFactor !== void 0 ? metallicRoughness.metallicFactor : 1;
      materialParams.roughness = metallicRoughness.roughnessFactor !== void 0 ? metallicRoughness.roughnessFactor : 1;
      if (metallicRoughness.metallicRoughnessTexture !== void 0) {
        pending.push(parser.assignTexture(materialParams, "metalnessMap", metallicRoughness.metallicRoughnessTexture));
        pending.push(parser.assignTexture(materialParams, "roughnessMap", metallicRoughness.metallicRoughnessTexture));
      }
      materialType = this._invokeOne(function(ext) {
        return ext.getMaterialType && ext.getMaterialType(materialIndex);
      });
      pending.push(Promise.all(this._invokeAll(function(ext) {
        return ext.extendMaterialParams && ext.extendMaterialParams(materialIndex, materialParams);
      })));
    }
    if (materialDef.doubleSided === true) {
      materialParams.side = DoubleSide;
    }
    const alphaMode = materialDef.alphaMode || ALPHA_MODES.OPAQUE;
    if (alphaMode === ALPHA_MODES.BLEND) {
      materialParams.transparent = true;
      materialParams.depthWrite = false;
    } else {
      materialParams.transparent = false;
      if (alphaMode === ALPHA_MODES.MASK) {
        materialParams.alphaTest = materialDef.alphaCutoff !== void 0 ? materialDef.alphaCutoff : 0.5;
      }
    }
    if (materialDef.normalTexture !== void 0 && materialType !== MeshBasicMaterial) {
      pending.push(parser.assignTexture(materialParams, "normalMap", materialDef.normalTexture));
      materialParams.normalScale = new Vector2(1, 1);
      if (materialDef.normalTexture.scale !== void 0) {
        const scale = materialDef.normalTexture.scale;
        materialParams.normalScale.set(scale, scale);
      }
    }
    if (materialDef.occlusionTexture !== void 0 && materialType !== MeshBasicMaterial) {
      pending.push(parser.assignTexture(materialParams, "aoMap", materialDef.occlusionTexture));
      if (materialDef.occlusionTexture.strength !== void 0) {
        materialParams.aoMapIntensity = materialDef.occlusionTexture.strength;
      }
    }
    if (materialDef.emissiveFactor !== void 0 && materialType !== MeshBasicMaterial) {
      const emissiveFactor = materialDef.emissiveFactor;
      materialParams.emissive = new Color().setRGB(emissiveFactor[0], emissiveFactor[1], emissiveFactor[2], LinearSRGBColorSpace);
    }
    if (materialDef.emissiveTexture !== void 0 && materialType !== MeshBasicMaterial) {
      pending.push(parser.assignTexture(materialParams, "emissiveMap", materialDef.emissiveTexture, SRGBColorSpace));
    }
    return Promise.all(pending).then(function() {
      const material = new materialType(materialParams);
      if (materialDef.name) material.name = materialDef.name;
      assignExtrasToUserData(material, materialDef);
      parser.associations.set(material, { materials: materialIndex });
      if (materialDef.extensions) addUnknownExtensionsToUserData(extensions, material, materialDef);
      return material;
    });
  }
  /** When Object3D instances are targeted by animation, they need unique names. */
  createUniqueName(originalName) {
    const sanitizedName = PropertyBinding.sanitizeNodeName(originalName || "");
    if (sanitizedName in this.nodeNamesUsed) {
      return sanitizedName + "_" + ++this.nodeNamesUsed[sanitizedName];
    } else {
      this.nodeNamesUsed[sanitizedName] = 0;
      return sanitizedName;
    }
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#geometry
   *
   * Creates BufferGeometries from primitives.
   *
   * @param {Array<GLTF.Primitive>} primitives
   * @return {Promise<Array<BufferGeometry>>}
   */
  loadGeometries(primitives) {
    const parser = this;
    const extensions = this.extensions;
    const cache = this.primitiveCache;
    function createDracoPrimitive(primitive) {
      return extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(primitive, parser).then(function(geometry) {
        return addPrimitiveAttributes(geometry, primitive, parser);
      });
    }
    const pending = [];
    for (let i = 0, il = primitives.length; i < il; i++) {
      const primitive = primitives[i];
      const cacheKey = createPrimitiveKey(primitive);
      const cached = cache[cacheKey];
      if (cached) {
        pending.push(cached.promise);
      } else {
        let geometryPromise;
        if (primitive.extensions && primitive.extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION]) {
          geometryPromise = createDracoPrimitive(primitive);
        } else {
          geometryPromise = addPrimitiveAttributes(new BufferGeometry(), primitive, parser);
        }
        cache[cacheKey] = { primitive, promise: geometryPromise };
        pending.push(geometryPromise);
      }
    }
    return Promise.all(pending);
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
   * @param {number} meshIndex
   * @return {Promise<Group|Mesh|SkinnedMesh>}
   */
  loadMesh(meshIndex) {
    const parser = this;
    const json = this.json;
    const extensions = this.extensions;
    const meshDef = json.meshes[meshIndex];
    const primitives = meshDef.primitives;
    const pending = [];
    for (let i = 0, il = primitives.length; i < il; i++) {
      const material = primitives[i].material === void 0 ? createDefaultMaterial(this.cache) : this.getDependency("material", primitives[i].material);
      pending.push(material);
    }
    pending.push(parser.loadGeometries(primitives));
    return Promise.all(pending).then(function(results) {
      const materials = results.slice(0, results.length - 1);
      const geometries = results[results.length - 1];
      const meshes = [];
      for (let i = 0, il = geometries.length; i < il; i++) {
        const geometry = geometries[i];
        const primitive = primitives[i];
        let mesh;
        const material = materials[i];
        if (primitive.mode === WEBGL_CONSTANTS.TRIANGLES || primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP || primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN || primitive.mode === void 0) {
          mesh = meshDef.isSkinnedMesh === true ? new SkinnedMesh(geometry, material) : new Mesh(geometry, material);
          if (mesh.isSkinnedMesh === true) {
            mesh.normalizeSkinWeights();
          }
          if (primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP) {
            mesh.geometry = toTrianglesDrawMode(mesh.geometry, TriangleStripDrawMode);
          } else if (primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN) {
            mesh.geometry = toTrianglesDrawMode(mesh.geometry, TriangleFanDrawMode);
          }
        } else if (primitive.mode === WEBGL_CONSTANTS.LINES) {
          mesh = new LineSegments(geometry, material);
        } else if (primitive.mode === WEBGL_CONSTANTS.LINE_STRIP) {
          mesh = new Line(geometry, material);
        } else if (primitive.mode === WEBGL_CONSTANTS.LINE_LOOP) {
          mesh = new LineLoop(geometry, material);
        } else if (primitive.mode === WEBGL_CONSTANTS.POINTS) {
          mesh = new Points(geometry, material);
        } else {
          throw new Error("THREE.GLTFLoader: Primitive mode unsupported: " + primitive.mode);
        }
        if (Object.keys(mesh.geometry.morphAttributes).length > 0) {
          updateMorphTargets(mesh, meshDef);
        }
        mesh.name = parser.createUniqueName(meshDef.name || "mesh_" + meshIndex);
        assignExtrasToUserData(mesh, meshDef);
        if (primitive.extensions) addUnknownExtensionsToUserData(extensions, mesh, primitive);
        parser.assignFinalMaterial(mesh);
        meshes.push(mesh);
      }
      for (let i = 0, il = meshes.length; i < il; i++) {
        parser.associations.set(meshes[i], {
          meshes: meshIndex,
          primitives: i
        });
      }
      if (meshes.length === 1) {
        if (meshDef.extensions) addUnknownExtensionsToUserData(extensions, meshes[0], meshDef);
        return meshes[0];
      }
      const group = new Group();
      if (meshDef.extensions) addUnknownExtensionsToUserData(extensions, group, meshDef);
      parser.associations.set(group, { meshes: meshIndex });
      for (let i = 0, il = meshes.length; i < il; i++) {
        group.add(meshes[i]);
      }
      return group;
    });
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#cameras
   * @param {number} cameraIndex
   * @return {Promise<THREE.Camera>}
   */
  loadCamera(cameraIndex) {
    let camera2;
    const cameraDef = this.json.cameras[cameraIndex];
    const params = cameraDef[cameraDef.type];
    if (!params) {
      console.warn("THREE.GLTFLoader: Missing camera parameters.");
      return;
    }
    if (cameraDef.type === "perspective") {
      camera2 = new PerspectiveCamera(MathUtils.radToDeg(params.yfov), params.aspectRatio || 1, params.znear || 1, params.zfar || 2e6);
    } else if (cameraDef.type === "orthographic") {
      camera2 = new OrthographicCamera(-params.xmag, params.xmag, params.ymag, -params.ymag, params.znear, params.zfar);
    }
    if (cameraDef.name) camera2.name = this.createUniqueName(cameraDef.name);
    assignExtrasToUserData(camera2, cameraDef);
    return Promise.resolve(camera2);
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skins
   * @param {number} skinIndex
   * @return {Promise<Skeleton>}
   */
  loadSkin(skinIndex) {
    const skinDef = this.json.skins[skinIndex];
    const pending = [];
    for (let i = 0, il = skinDef.joints.length; i < il; i++) {
      pending.push(this._loadNodeShallow(skinDef.joints[i]));
    }
    if (skinDef.inverseBindMatrices !== void 0) {
      pending.push(this.getDependency("accessor", skinDef.inverseBindMatrices));
    } else {
      pending.push(null);
    }
    return Promise.all(pending).then(function(results) {
      const inverseBindMatrices = results.pop();
      const jointNodes = results;
      const bones = [];
      const boneInverses = [];
      for (let i = 0, il = jointNodes.length; i < il; i++) {
        const jointNode = jointNodes[i];
        if (jointNode) {
          bones.push(jointNode);
          const mat = new Matrix4();
          if (inverseBindMatrices !== null) {
            mat.fromArray(inverseBindMatrices.array, i * 16);
          }
          boneInverses.push(mat);
        } else {
          console.warn('THREE.GLTFLoader: Joint "%s" could not be found.', skinDef.joints[i]);
        }
      }
      return new Skeleton(bones, boneInverses);
    });
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animations
   * @param {number} animationIndex
   * @return {Promise<AnimationClip>}
   */
  loadAnimation(animationIndex) {
    const json = this.json;
    const parser = this;
    const animationDef = json.animations[animationIndex];
    const animationName = animationDef.name ? animationDef.name : "animation_" + animationIndex;
    const pendingNodes = [];
    const pendingInputAccessors = [];
    const pendingOutputAccessors = [];
    const pendingSamplers = [];
    const pendingTargets = [];
    for (let i = 0, il = animationDef.channels.length; i < il; i++) {
      const channel = animationDef.channels[i];
      const sampler = animationDef.samplers[channel.sampler];
      const target = channel.target;
      const name = target.node;
      const input = animationDef.parameters !== void 0 ? animationDef.parameters[sampler.input] : sampler.input;
      const output = animationDef.parameters !== void 0 ? animationDef.parameters[sampler.output] : sampler.output;
      if (target.node === void 0) continue;
      pendingNodes.push(this.getDependency("node", name));
      pendingInputAccessors.push(this.getDependency("accessor", input));
      pendingOutputAccessors.push(this.getDependency("accessor", output));
      pendingSamplers.push(sampler);
      pendingTargets.push(target);
    }
    return Promise.all([
      Promise.all(pendingNodes),
      Promise.all(pendingInputAccessors),
      Promise.all(pendingOutputAccessors),
      Promise.all(pendingSamplers),
      Promise.all(pendingTargets)
    ]).then(function(dependencies) {
      const nodes = dependencies[0];
      const inputAccessors = dependencies[1];
      const outputAccessors = dependencies[2];
      const samplers = dependencies[3];
      const targets = dependencies[4];
      const tracks = [];
      for (let i = 0, il = nodes.length; i < il; i++) {
        const node = nodes[i];
        const inputAccessor = inputAccessors[i];
        const outputAccessor = outputAccessors[i];
        const sampler = samplers[i];
        const target = targets[i];
        if (node === void 0) continue;
        if (node.updateMatrix) {
          node.updateMatrix();
        }
        const createdTracks = parser._createAnimationTracks(node, inputAccessor, outputAccessor, sampler, target);
        if (createdTracks) {
          for (let k = 0; k < createdTracks.length; k++) {
            tracks.push(createdTracks[k]);
          }
        }
      }
      return new AnimationClip(animationName, void 0, tracks);
    });
  }
  createNodeMesh(nodeIndex) {
    const json = this.json;
    const parser = this;
    const nodeDef = json.nodes[nodeIndex];
    if (nodeDef.mesh === void 0) return null;
    return parser.getDependency("mesh", nodeDef.mesh).then(function(mesh) {
      const node = parser._getNodeRef(parser.meshCache, nodeDef.mesh, mesh);
      if (nodeDef.weights !== void 0) {
        node.traverse(function(o) {
          if (!o.isMesh) return;
          for (let i = 0, il = nodeDef.weights.length; i < il; i++) {
            o.morphTargetInfluences[i] = nodeDef.weights[i];
          }
        });
      }
      return node;
    });
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#nodes-and-hierarchy
   * @param {number} nodeIndex
   * @return {Promise<Object3D>}
   */
  loadNode(nodeIndex) {
    const json = this.json;
    const parser = this;
    const nodeDef = json.nodes[nodeIndex];
    const nodePending = parser._loadNodeShallow(nodeIndex);
    const childPending = [];
    const childrenDef = nodeDef.children || [];
    for (let i = 0, il = childrenDef.length; i < il; i++) {
      childPending.push(parser.getDependency("node", childrenDef[i]));
    }
    const skeletonPending = nodeDef.skin === void 0 ? Promise.resolve(null) : parser.getDependency("skin", nodeDef.skin);
    return Promise.all([
      nodePending,
      Promise.all(childPending),
      skeletonPending
    ]).then(function(results) {
      const node = results[0];
      const children = results[1];
      const skeleton = results[2];
      if (skeleton !== null) {
        node.traverse(function(mesh) {
          if (!mesh.isSkinnedMesh) return;
          mesh.bind(skeleton, _identityMatrix);
        });
      }
      for (let i = 0, il = children.length; i < il; i++) {
        node.add(children[i]);
      }
      return node;
    });
  }
  // ._loadNodeShallow() parses a single node.
  // skin and child nodes are created and added in .loadNode() (no '_' prefix).
  _loadNodeShallow(nodeIndex) {
    const json = this.json;
    const extensions = this.extensions;
    const parser = this;
    if (this.nodeCache[nodeIndex] !== void 0) {
      return this.nodeCache[nodeIndex];
    }
    const nodeDef = json.nodes[nodeIndex];
    const nodeName = nodeDef.name ? parser.createUniqueName(nodeDef.name) : "";
    const pending = [];
    const meshPromise = parser._invokeOne(function(ext) {
      return ext.createNodeMesh && ext.createNodeMesh(nodeIndex);
    });
    if (meshPromise) {
      pending.push(meshPromise);
    }
    if (nodeDef.camera !== void 0) {
      pending.push(parser.getDependency("camera", nodeDef.camera).then(function(camera2) {
        return parser._getNodeRef(parser.cameraCache, nodeDef.camera, camera2);
      }));
    }
    parser._invokeAll(function(ext) {
      return ext.createNodeAttachment && ext.createNodeAttachment(nodeIndex);
    }).forEach(function(promise) {
      pending.push(promise);
    });
    this.nodeCache[nodeIndex] = Promise.all(pending).then(function(objects) {
      let node;
      if (nodeDef.isBone === true) {
        node = new Bone();
      } else if (objects.length > 1) {
        node = new Group();
      } else if (objects.length === 1) {
        node = objects[0];
      } else {
        node = new Object3D();
      }
      if (node !== objects[0]) {
        for (let i = 0, il = objects.length; i < il; i++) {
          node.add(objects[i]);
        }
      }
      if (nodeDef.name) {
        node.userData.name = nodeDef.name;
        node.name = nodeName;
      }
      assignExtrasToUserData(node, nodeDef);
      if (nodeDef.extensions) addUnknownExtensionsToUserData(extensions, node, nodeDef);
      if (nodeDef.matrix !== void 0) {
        const matrix = new Matrix4();
        matrix.fromArray(nodeDef.matrix);
        node.applyMatrix4(matrix);
      } else {
        if (nodeDef.translation !== void 0) {
          node.position.fromArray(nodeDef.translation);
        }
        if (nodeDef.rotation !== void 0) {
          node.quaternion.fromArray(nodeDef.rotation);
        }
        if (nodeDef.scale !== void 0) {
          node.scale.fromArray(nodeDef.scale);
        }
      }
      if (!parser.associations.has(node)) {
        parser.associations.set(node, {});
      }
      parser.associations.get(node).nodes = nodeIndex;
      return node;
    });
    return this.nodeCache[nodeIndex];
  }
  /**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#scenes
   * @param {number} sceneIndex
   * @return {Promise<Group>}
   */
  loadScene(sceneIndex) {
    const extensions = this.extensions;
    const sceneDef = this.json.scenes[sceneIndex];
    const parser = this;
    const scene2 = new Group();
    if (sceneDef.name) scene2.name = parser.createUniqueName(sceneDef.name);
    assignExtrasToUserData(scene2, sceneDef);
    if (sceneDef.extensions) addUnknownExtensionsToUserData(extensions, scene2, sceneDef);
    const nodeIds = sceneDef.nodes || [];
    const pending = [];
    for (let i = 0, il = nodeIds.length; i < il; i++) {
      pending.push(parser.getDependency("node", nodeIds[i]));
    }
    return Promise.all(pending).then(function(nodes) {
      for (let i = 0, il = nodes.length; i < il; i++) {
        scene2.add(nodes[i]);
      }
      const reduceAssociations = (node) => {
        const reducedAssociations = /* @__PURE__ */ new Map();
        for (const [key, value] of parser.associations) {
          if (key instanceof Material || key instanceof Texture) {
            reducedAssociations.set(key, value);
          }
        }
        node.traverse((node2) => {
          const mappings = parser.associations.get(node2);
          if (mappings != null) {
            reducedAssociations.set(node2, mappings);
          }
        });
        return reducedAssociations;
      };
      parser.associations = reduceAssociations(scene2);
      return scene2;
    });
  }
  _createAnimationTracks(node, inputAccessor, outputAccessor, sampler, target) {
    const tracks = [];
    const targetName = node.name ? node.name : node.uuid;
    const targetNames = [];
    if (PATH_PROPERTIES[target.path] === PATH_PROPERTIES.weights) {
      node.traverse(function(object) {
        if (object.morphTargetInfluences) {
          targetNames.push(object.name ? object.name : object.uuid);
        }
      });
    } else {
      targetNames.push(targetName);
    }
    let TypedKeyframeTrack;
    switch (PATH_PROPERTIES[target.path]) {
      case PATH_PROPERTIES.weights:
        TypedKeyframeTrack = NumberKeyframeTrack;
        break;
      case PATH_PROPERTIES.rotation:
        TypedKeyframeTrack = QuaternionKeyframeTrack;
        break;
      case PATH_PROPERTIES.position:
      case PATH_PROPERTIES.scale:
        TypedKeyframeTrack = VectorKeyframeTrack;
        break;
      default:
        switch (outputAccessor.itemSize) {
          case 1:
            TypedKeyframeTrack = NumberKeyframeTrack;
            break;
          case 2:
          case 3:
          default:
            TypedKeyframeTrack = VectorKeyframeTrack;
            break;
        }
        break;
    }
    const interpolation = sampler.interpolation !== void 0 ? INTERPOLATION[sampler.interpolation] : InterpolateLinear;
    const outputArray = this._getArrayFromAccessor(outputAccessor);
    for (let j = 0, jl = targetNames.length; j < jl; j++) {
      const track = new TypedKeyframeTrack(
        targetNames[j] + "." + PATH_PROPERTIES[target.path],
        inputAccessor.array,
        outputArray,
        interpolation
      );
      if (sampler.interpolation === "CUBICSPLINE") {
        this._createCubicSplineTrackInterpolant(track);
      }
      tracks.push(track);
    }
    return tracks;
  }
  _getArrayFromAccessor(accessor) {
    let outputArray = accessor.array;
    if (accessor.normalized) {
      const scale = getNormalizedComponentScale(outputArray.constructor);
      const scaled = new Float32Array(outputArray.length);
      for (let j = 0, jl = outputArray.length; j < jl; j++) {
        scaled[j] = outputArray[j] * scale;
      }
      outputArray = scaled;
    }
    return outputArray;
  }
  _createCubicSplineTrackInterpolant(track) {
    track.createInterpolant = function InterpolantFactoryMethodGLTFCubicSpline(result) {
      const interpolantType = this instanceof QuaternionKeyframeTrack ? GLTFCubicSplineQuaternionInterpolant : GLTFCubicSplineInterpolant;
      return new interpolantType(this.times, this.values, this.getValueSize() / 3, result);
    };
    track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline = true;
  }
}
function computeBounds(geometry, primitiveDef, parser) {
  const attributes = primitiveDef.attributes;
  const box = new Box3();
  if (attributes.POSITION !== void 0) {
    const accessor = parser.json.accessors[attributes.POSITION];
    const min = accessor.min;
    const max = accessor.max;
    if (min !== void 0 && max !== void 0) {
      box.set(
        new Vector3(min[0], min[1], min[2]),
        new Vector3(max[0], max[1], max[2])
      );
      if (accessor.normalized) {
        const boxScale = getNormalizedComponentScale(WEBGL_COMPONENT_TYPES[accessor.componentType]);
        box.min.multiplyScalar(boxScale);
        box.max.multiplyScalar(boxScale);
      }
    } else {
      console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");
      return;
    }
  } else {
    return;
  }
  const targets = primitiveDef.targets;
  if (targets !== void 0) {
    const maxDisplacement = new Vector3();
    const vector = new Vector3();
    for (let i = 0, il = targets.length; i < il; i++) {
      const target = targets[i];
      if (target.POSITION !== void 0) {
        const accessor = parser.json.accessors[target.POSITION];
        const min = accessor.min;
        const max = accessor.max;
        if (min !== void 0 && max !== void 0) {
          vector.setX(Math.max(Math.abs(min[0]), Math.abs(max[0])));
          vector.setY(Math.max(Math.abs(min[1]), Math.abs(max[1])));
          vector.setZ(Math.max(Math.abs(min[2]), Math.abs(max[2])));
          if (accessor.normalized) {
            const boxScale = getNormalizedComponentScale(WEBGL_COMPONENT_TYPES[accessor.componentType]);
            vector.multiplyScalar(boxScale);
          }
          maxDisplacement.max(vector);
        } else {
          console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");
        }
      }
    }
    box.expandByVector(maxDisplacement);
  }
  geometry.boundingBox = box;
  const sphere = new Sphere();
  box.getCenter(sphere.center);
  sphere.radius = box.min.distanceTo(box.max) / 2;
  geometry.boundingSphere = sphere;
}
function addPrimitiveAttributes(geometry, primitiveDef, parser) {
  const attributes = primitiveDef.attributes;
  const pending = [];
  function assignAttributeAccessor(accessorIndex, attributeName) {
    return parser.getDependency("accessor", accessorIndex).then(function(accessor) {
      geometry.setAttribute(attributeName, accessor);
    });
  }
  for (const gltfAttributeName in attributes) {
    const threeAttributeName = ATTRIBUTES[gltfAttributeName] || gltfAttributeName.toLowerCase();
    if (threeAttributeName in geometry.attributes) continue;
    pending.push(assignAttributeAccessor(attributes[gltfAttributeName], threeAttributeName));
  }
  if (primitiveDef.indices !== void 0 && !geometry.index) {
    const accessor = parser.getDependency("accessor", primitiveDef.indices).then(function(accessor2) {
      geometry.setIndex(accessor2);
    });
    pending.push(accessor);
  }
  if (ColorManagement.workingColorSpace !== LinearSRGBColorSpace && "COLOR_0" in attributes) {
    console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${ColorManagement.workingColorSpace}" not supported.`);
  }
  assignExtrasToUserData(geometry, primitiveDef);
  computeBounds(geometry, primitiveDef, parser);
  return Promise.all(pending).then(function() {
    return primitiveDef.targets !== void 0 ? addMorphTargets(geometry, primitiveDef.targets, parser) : geometry;
  });
}
class Player {
  constructor(scene2, laserManager2) {
    this.scene = scene2;
    this.laserManager = laserManager2;
    this.pdcActive = false;
    this.missileCount = 10;
    this.maxMissiles = 10;
    this.missileReloadTime = 1.6;
    this.missileReloadTimer = 0;
    this.pdcBurstCount = Infinity;
    this.maxPdcBursts = Infinity;
    this.pdcDurability = 100;
    this.isFiring = false;
    this.isPaused = false;
    this.collisionCooldown = 0;
    this.isRolling = false;
    this.rollTimer = 0;
    this.rollDuration = 4;
    this.rollDirection = 1;
    this.mesh = new Group();
    this.mesh.name = "playerShip";
    this.shipModel = null;
    this.speed = 0.9;
    this.pitch = 0;
    this.roll = 0;
    this.rotationSpeed = 8;
    this.velocity = new Vector2(0, 0);
    this.thrusters = [];
    this.lastShotTime = 0;
    this.fireRate = 110;
    this.particles = [];
    this.particleGeometry = new SphereGeometry(1.2, 5, 5);
    this.particleMaterial = new MeshBasicMaterial({
      color: 14540253,
      transparent: true,
      opacity: 0.18,
      blending: NormalBlending,
      depthWrite: false
    });
    this.pdcRange = 650;
    this.pdcCooldown = 0.12;
    this.pdcTimer = 0;
    this.pdcProjectileLife = 1.2;
    this.pdcProjectiles = [];
    this.pdcBulletGeo = new CylinderGeometry(0.35, 0.15, 6, 8);
    this.pdcBulletGeo.rotateX(Math.PI / 2);
    this.pdcBulletMat = new MeshStandardMaterial({
      color: 16776960,
      emissive: 16729088,
      emissiveIntensity: 5,
      toneMapped: false
    });
    this.pdcCannons = [
      { container: new Group(), offset: new Vector3(-3.5, 4.5, -3) },
      { container: new Group(), offset: new Vector3(3.5, 4.5, -3) }
    ];
    const pdcGeo = new CylinderGeometry(0.3, 0.3, 2.5, 5);
    pdcGeo.rotateX(Math.PI / 2);
    const pdcMat = new MeshBasicMaterial({ color: 5592422 });
    this.pdcCannons.forEach((c) => {
      c.container.position.copy(c.offset);
      const mesh = new Mesh(pdcGeo, pdcMat);
      c.container.add(mesh);
      this.mesh.add(c.container);
    });
    this.mesh.position.set(0, 3, 0);
    this.scene.add(this.mesh);
    this._loadModel();
    this._initKeyboard();
    this._initTouchControls();
  }
  repairPDC() {
    this.pdcDurability = 100;
  }
  setLevelLoadout(loadout = {}) {
    this.maxMissiles = loadout.missiles ?? 10;
    this.missileCount = Math.min(this.maxMissiles, loadout.missiles ?? 10);
    this.maxPdcBursts = Infinity;
    this.pdcBurstCount = Infinity;
  }
  startBarrelRoll(dir) {
    if (!this.isRolling) {
      this.isRolling = true;
      this.rollTimer = 0;
      this.rollDirection = dir || 1;
      console.log("Direção do Roll definida como:", this.rollDirection);
    }
  }
  getAmmoStatus() {
    return {
      missiles: this.missileCount,
      pdcBursts: this.pdcBurstCount === Infinity ? "∞" : this.pdcBurstCount,
      missileMax: this.maxMissiles,
      missileReloadProgress: this.missileReloadTimer / Math.max(this.missileReloadTime, 1e-3)
    };
  }
  _updatePDC(enemyManager2, dt, onEnemyDestroyed = null) {
    var _a;
    if (!this.pdcActive || this.pdcBurstCount <= 0) {
      this._updatePDCProjectiles(enemyManager2, dt, onEnemyDestroyed);
      return;
    }
    this.pdcTimer += dt;
    let closestEnemy = null;
    let closestDist = Infinity;
    if (enemyManager2 == null ? void 0 : enemyManager2.enemies) {
      enemyManager2.enemies.forEach((enemy) => {
        const dist = this.mesh.position.distanceTo(enemy.position);
        if (dist < this.pdcRange && dist < closestDist) {
          closestDist = dist;
          closestEnemy = enemy;
        }
      });
    }
    const boss2 = window.__NAVE_MAE_ATIVA;
    if ((boss2 == null ? void 0 : boss2.isActive) && ((_a = boss2 == null ? void 0 : boss2.mesh) == null ? void 0 : _a.visible)) {
      const distBoss = this.mesh.position.distanceTo(boss2.mesh.position);
      if (distBoss < this.pdcRange && distBoss < closestDist) {
        closestDist = distBoss;
        closestEnemy = boss2.mesh;
      }
    }
    if (closestEnemy) {
      const targetPos = new Vector3();
      closestEnemy.getWorldPosition(targetPos);
      this.pdcCannons.forEach((c) => c.container.lookAt(targetPos));
      if (this.pdcTimer >= this.pdcCooldown) {
        this.pdcBurstCount = Math.max(0, this.pdcBurstCount - 1);
        this.pdcCannons.forEach((c) => this._firePDCShot(targetPos, c));
        this.pdcTimer = 0;
      }
    }
    this._updatePDCProjectiles(enemyManager2, dt, onEnemyDestroyed);
  }
  _firePDCShot(targetPos, cannon) {
    const bullet = new Mesh(this.pdcBulletGeo, this.pdcBulletMat);
    const spawnPos = new Vector3();
    cannon.container.getWorldPosition(spawnPos);
    bullet.position.copy(spawnPos);
    const spread = 0.26;
    bullet.rotation.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, 0);
    this.scene.add(bullet);
    if (window.soundManager) window.soundManager.play("pdc");
    const dir = new Vector3().subVectors(targetPos, spawnPos).normalize();
    this.pdcProjectiles.push({ mesh: bullet, dir, life: this.pdcProjectileLife, startTime: Date.now(), offset: Math.random() * Math.PI * 2 });
  }
  togglePDC() {
    this.pdcActive = !this.pdcActive;
    return this.pdcActive;
  }
  fireMissile() {
    if (this.missileCount <= 0) {
      console.log("🚫 Sem mísseis");
      return false;
    }
    if (!this.laserManager || typeof this.laserManager.createMissile !== "function") {
      console.log("🚫 LaserManager sem createMissile");
      return false;
    }
    this.mesh.updateMatrixWorld(true);
    if (this.shipModel) this.shipModel.updateMatrixWorld(true);
    const ship = this.shipModel || this.mesh;
    const noseLocal = this.gunNose || new Vector3(0, 2.2, -11);
    const spawnPos = noseLocal.clone().applyMatrix4(ship.matrixWorld);
    const missileQuat = new Quaternion();
    ship.getWorldQuaternion(missileQuat);
    const forward = new Vector3(0, 0, 1).applyQuaternion(missileQuat).normalize();
    spawnPos.addScaledVector(forward, 14);
    this.missileCount--;
    this.missileReloadTimer = 0;
    this.laserManager.createMissile(spawnPos, missileQuat);
    const last = this.laserManager.missiles[this.laserManager.missiles.length - 1];
    if (last == null ? void 0 : last.mesh) {
      last.mesh.userData.direction = forward.clone();
      last.mesh.lookAt(spawnPos.clone().add(forward));
    }
    if (window.soundManager) {
      try {
        window.soundManager.play("missile");
      } catch (e) {
      }
    }
    console.log("🚀 Míssil disparado | restantes:", this.missileCount);
    return true;
  }
  _updatePDCProjectiles(enemyManager2, dt, onEnemyDestroyed = null) {
    var _a, _b, _c, _d;
    const now = Date.now();
    for (let i = this.pdcProjectiles.length - 1; i >= 0; i--) {
      const b = this.pdcProjectiles[i];
      const elapsed = (now - b.startTime) * 0.04;
      const moveDir = b.dir.clone().multiplyScalar(2e3 * dt);
      b.mesh.position.add(moveDir);
      b.mesh.position.x += Math.sin(elapsed * 8 + b.offset) * 3 * dt * 5;
      b.mesh.position.y += Math.cos(elapsed * 8 + b.offset) * 3 * dt * 5;
      b.mesh.lookAt(b.mesh.position.clone().add(b.dir));
      let hit = false;
      if (enemyManager2 == null ? void 0 : enemyManager2.enemies) {
        for (let j = enemyManager2.enemies.length - 1; j >= 0; j--) {
          const e = enemyManager2.enemies[j];
          if (!e || ((_a = e.userData) == null ? void 0 : _a.type) === "meteoro") continue;
          const hitRadius = ((_b = e.userData) == null ? void 0 : _b.type) === "roblox" ? 64 : 52;
          if (b.mesh.position.distanceTo(e.position) < hitRadius) {
            const enemyKilled = enemyManager2.damageEnemy ? enemyManager2.damageEnemy(e, 15, b.mesh.position) : true;
            if (window.explosionManager) {
              if (enemyKilled) {
                window.explosionManager.create(b.mesh.position.clone());
              } else {
                window.explosionManager.create(b.mesh.position.clone(), 0.45);
              }
            }
            if (enemyKilled) {
              this.scene.remove(e);
              enemyManager2.enemies.splice(j, 1);
              if (onEnemyDestroyed) {
                const enemyType = (_c = e.userData) == null ? void 0 : _c.type;
                const points = enemyType === "meteoro" || enemyType === "asteroide" ? 500 : enemyType === "drone" ? 250 : enemyType === "roblox" ? 150 : 100;
                onEnemyDestroyed(points, b.mesh.position.clone());
              }
            }
            hit = true;
            break;
          }
        }
      }
      const boss2 = window.__NAVE_MAE_ATIVA;
      if (!hit && (boss2 == null ? void 0 : boss2.isActive) && ((_d = boss2 == null ? void 0 : boss2.mesh) == null ? void 0 : _d.visible)) {
        const bossHitRadius = Math.min(boss2.currentInternalScale * 0.9, 210);
        if (b.mesh.position.distanceTo(boss2.mesh.position) < bossHitRadius) {
          const bossDestroyed = boss2.takeDamage(25, b.mesh.position.clone(), window.explosionManager);
          hit = true;
          if (window.explosionManager) {
            if (bossDestroyed) {
              window.explosionManager.createBigExplosion(b.mesh.position.clone());
              if (onEnemyDestroyed) onEnemyDestroyed(5e3, b.mesh.position.clone());
            } else {
              window.explosionManager.create(b.mesh.position.clone(), 0.75);
            }
          }
        }
      }
      b.life -= dt;
      if (hit || b.life <= 0 || b.mesh.position.distanceTo(this.mesh.position) > this.pdcRange + 200) {
        this.scene.remove(b.mesh);
        this.pdcProjectiles.splice(i, 1);
      }
    }
  }
  _loadModel() {
    const loader = new GLTFLoader();
    loader.load("/assets/models/nave_game.glb", (gltf) => {
      this.shipModel = gltf.scene;
      this.shipModel.scale.set(2, 2, 2);
      this.shipModel.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) child.material.precision = "mediump";
        }
      });
      this.mesh.add(this.shipModel);
      this._createPlasmaThrusters();
      this._createGunPositions();
      this._createNavigationLights();
    });
  }
  _createNavigationLights() {
    const bottomLight = new PointLight(11206655, 120, 60);
    bottomLight.position.set(0, -2.5, -4);
    this.shipModel.add(bottomLight);
    this.fuselageLight = bottomLight;
  }
  _createGunPositions() {
    this.gunLeft = new Vector3(-8.2, 1.6, -7.5);
    this.gunRight = new Vector3(8.2, 1.6, -7.5);
    this.gunNose = new Vector3(0, 2.2, -11);
  }
  _createPlasmaThrusters() {
    const coreMat = new MeshBasicMaterial({ color: 6745855, transparent: true, blending: AdditiveBlending, depthWrite: false });
    const coreGeo = new ConeGeometry(0.99, 3, 16);
    this.thrusterLocalPos = new Vector3(0, 2, -9.8);
    const core = new Mesh(coreGeo, coreMat);
    const light = new PointLight(3399167, 120, 100);
    core.position.copy(this.thrusterLocalPos);
    light.position.copy(this.thrusterLocalPos);
    core.rotation.x = Math.PI / 2;
    this.shipModel.add(core);
    this.shipModel.add(light);
    this.thrusters.push({ core, light });
  }
  _initKeyboard() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyF" || e.code === "Space") this.isFiring = true;
      if (!e.repeat && (e.code === "KeyM" || e.code === "KeyA")) this.fireMissile();
      if (e.code === "KeyR") this.startBarrelRoll();
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "KeyF" || e.code === "Space") this.isFiring = false;
    });
  }
  _initTouchControls() {
    const shootBtn = document.getElementById("shootBtn");
    if (shootBtn) {
      shootBtn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.isFiring = true;
      });
      shootBtn.addEventListener("pointerup", (e) => {
        e.preventDefault();
        this.isFiring = false;
      });
    }
  }
  _shoot() {
    if (this.isPaused || !this.laserManager || !this.shipModel) return;
    const now = Date.now();
    if (now - this.lastShotTime < this.fireRate) return;
    this.lastShotTime = now;
    this.mesh.updateMatrixWorld();
    this.shipModel.updateMatrixWorld();
    const direction = new Vector3(0, 0, 1);
    const modelQuaternion = new Quaternion();
    this.shipModel.getWorldQuaternion(modelQuaternion);
    direction.applyQuaternion(modelQuaternion).normalize();
    [this.gunLeft, this.gunRight, this.gunNose].forEach((localPos) => {
      const worldPos = new Vector3().setFromMatrixPosition(new Matrix4().multiplyMatrices(this.shipModel.matrixWorld, new Matrix4().setPosition(localPos)));
      this.laserManager.fire(worldPos, direction);
    });
  }
  _emitHeatWash() {
    if (!this.mesh || !this.shipModel || !this.thrusterLocalPos) return;
    this.mesh.updateMatrixWorld();
    const worldPos = new Vector3().copy(this.thrusterLocalPos).applyMatrix4(this.shipModel.matrixWorld);
    for (let k = 0; k < 2; k++) {
      const p = new Mesh(this.particleGeometry, this.particleMaterial.clone());
      p.position.set(worldPos.x + (Math.random() - 0.5) * 1.5, worldPos.y + (Math.random() - 0.5) * 1.5, worldPos.z);
      this.scene.add(p);
      this.particles.push({ mesh: p, life: 1, speedZ: 180, driftX: (Math.random() - 0.5) * 4, driftY: (Math.random() - 0.5) * 4 });
    }
  }
  update(moveInput, deltaTime, enemyManager2, onPlayerHit = null, onEnemyDestroyed = null) {
    if (!this.shipModel || this.isPaused) return;
    const dt = Math.min(deltaTime, 0.1);
    const acel = 40;
    this.velocity.x += -moveInput.x * acel * dt;
    this.velocity.y += moveInput.y * acel * dt;
    this.velocity.multiplyScalar(0.9);
    this.mesh.position.x += this.velocity.x * dt * 1;
    this.mesh.position.y += this.velocity.y * dt * 1;
    if (this.isRolling) {
      this.rollTimer += dt;
      let progress = Math.min(this.rollTimer / this.rollDuration, 1);
      const smoothProgress = progress * progress * (3 - 2 * progress);
      const angle = smoothProgress * (Math.PI * 2) * this.rollDirection;
      this.shipModel.rotation.set(0, Math.PI, angle);
      if (this.rollTimer >= this.rollDuration) {
        this.isRolling = false;
        this.rollTimer = 0;
        this.shipModel.rotation.set(0, Math.PI, 0);
      }
    } else {
      const suavizacao = 0.01;
      this.pitch = MathUtils.lerp(this.pitch, moveInput.y * 0.3, suavizacao);
      this.roll = MathUtils.lerp(this.roll, -moveInput.x * 0.9, suavizacao);
      this.shipModel.rotation.set(this.pitch, Math.PI, this.roll);
    }
    if (this.missileCount < this.maxMissiles) {
      this.missileReloadTimer += dt;
      if (this.missileReloadTimer >= this.missileReloadTime) {
        this.missileCount = Math.min(this.maxMissiles, this.missileCount + 1);
        this.missileReloadTimer = 0;
      }
    }
    this.mesh.updateMatrixWorld();
    if (this.isFiring) this._shoot();
    this._updatePDC(enemyManager2, dt, onEnemyDestroyed);
    this._emitHeatWash();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.mesh.position.z += p.speedZ * dt;
      p.life -= dt * 4;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }
  _isCollidingWithAsteroid(enemyManager2) {
    var _a, _b;
    this.mesh.updateMatrixWorld(true);
    const playerBox = new Box3().setFromObject(this.mesh);
    for (const enemy of enemyManager2.enemies) {
      if (((_a = enemy == null ? void 0 : enemy.userData) == null ? void 0 : _a.type) === "asteroide" || ((_b = enemy == null ? void 0 : enemy.userData) == null ? void 0 : _b.type) === "meteoro") {
        enemy.updateMatrixWorld(true);
        if (playerBox.intersectsBox(new Box3().setFromObject(enemy))) return true;
      }
    }
    return false;
  }
}
const LASER_INTERNO_GEO = new BoxGeometry(0.5, 0.5, 14);
const LASER_EXTERNO_GEO = new BoxGeometry(1.3, 1.3, 14.2);
const MAT_CIANO_INTERNO = new MeshBasicMaterial({ color: 65535, toneMapped: false });
const MAT_ESCARLATE_EXTERNO = new MeshBasicMaterial({
  color: 16716083,
  transparent: true,
  opacity: 0.6,
  blending: AdditiveBlending,
  toneMapped: false
});
class LaserManager {
  constructor(scene2, soundManager2) {
    this.scene = scene2;
    this.soundManager = soundManager2;
    this.lasers = [];
    this.missiles = [];
    this.laserSpeed = 850;
  }
  fire(worldGunPos, direction) {
    const laserGroup = new Group();
    const meshInterno = new Mesh(LASER_INTERNO_GEO, MAT_CIANO_INTERNO);
    const meshExterno = new Mesh(LASER_EXTERNO_GEO, MAT_ESCARLATE_EXTERNO);
    laserGroup.add(meshInterno);
    laserGroup.add(meshExterno);
    laserGroup.position.copy(worldGunPos);
    laserGroup.lookAt(worldGunPos.clone().add(direction));
    laserGroup.userData = { direction: direction.clone().normalize(), life: 2 };
    this.scene.add(laserGroup);
    this.lasers.push(laserGroup);
    if (this.soundManager) this.soundManager.play("laser");
  }
  createMissile(position, quaternion) {
    const bodyGeometry = new CylinderGeometry(0.55, 0.55, 5.6, 10);
    bodyGeometry.rotateX(Math.PI / 2);
    const bodyMaterial = new MeshBasicMaterial({ color: 998687, toneMapped: false });
    const missile = new Mesh(bodyGeometry, bodyMaterial);
    const band = new Mesh(
      new CylinderGeometry(0.58, 0.58, 0.7, 10),
      new MeshBasicMaterial({ color: 3800852, toneMapped: false })
    );
    missile.add(band);
    const tip = new Mesh(
      new ConeGeometry(0.65, 1.7, 10),
      new MeshBasicMaterial({ color: 10354519, toneMapped: false })
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, 0, 3.15);
    missile.add(tip);
    const rearGlow = new Mesh(
      new SphereGeometry(0.22, 10, 10),
      new MeshBasicMaterial({ color: 65448, toneMapped: false })
    );
    rearGlow.position.set(0, 0, -2.8);
    missile.add(rearGlow);
    const missileLight = new PointLight(6750003, 3.5, 30);
    missileLight.position.set(0, 0, 0);
    missile.add(missileLight);
    missile.position.copy(position);
    missile.quaternion.copy(quaternion);
    missile.scale.set(1, 1, 1);
    missile.userData = {
      direction: new Vector3(0, 0, 1).applyQuaternion(quaternion).normalize()
    };
    this.scene.add(missile);
    this.missiles.push({ mesh: missile, speed: 620, life: 5 });
  }
  update(deltaTime, enemyManager2 = null, onEnemyDestroyed = null, explosionManager2 = null) {
    var _a, _b, _c;
    if (!deltaTime) return;
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      laser.position.addScaledVector(laser.userData.direction, this.laserSpeed * deltaTime);
      laser.userData.life -= deltaTime;
      if (laser.userData.life <= 0) {
        this.scene.remove(laser);
        laser.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
        });
        this.lasers.splice(i, 1);
      }
    }
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      const forward = (((_a = m.mesh.userData) == null ? void 0 : _a.direction) || new Vector3(0, 0, -1)).clone().normalize();
      m.mesh.position.addScaledVector(forward, m.speed * deltaTime);
      let hitEnemy = false;
      if ((_b = enemyManager2 == null ? void 0 : enemyManager2.enemies) == null ? void 0 : _b.length) {
        for (let j = enemyManager2.enemies.length - 1; j >= 0; j--) {
          const enemy = enemyManager2.enemies[j];
          if (!enemy) continue;
          const enemyType = (_c = enemy.userData) == null ? void 0 : _c.type;
          const hitRadius = enemyType === "meteoro" || enemyType === "asteroide" ? 110 : 70;
          if (m.mesh.position.distanceTo(enemy.position) <= hitRadius) {
            const hitPoint = m.mesh.position.clone();
            const destroyed = enemyManager2.damageEnemy ? enemyManager2.damageEnemy(enemy, 35, hitPoint) : true;
            if (explosionManager2) {
              if (destroyed) {
                explosionManager2.create(hitPoint, {
                  kind: "missile",
                  flashColor: 14221240,
                  lightColor: 6750003,
                  lightIntensity: 2600,
                  smokeColor: 2444064
                });
              } else {
                explosionManager2.create(hitPoint, 0.6);
              }
            }
            if (destroyed) {
              const points = enemyType === "meteoro" || enemyType === "asteroide" ? 500 : enemyType === "drone" ? 250 : enemyType === "roblox" ? 150 : 100;
              if (onEnemyDestroyed) onEnemyDestroyed(points, hitPoint);
              enemyManager2.scene.remove(enemy);
              enemyManager2.enemies.splice(j, 1);
            }
            hitEnemy = true;
            break;
          }
        }
      }
      m.life -= deltaTime;
      if (hitEnemy || m.life <= 0) {
        this.disposeMissile(m.mesh);
        this.missiles.splice(i, 1);
      }
    }
  }
  // Método auxiliar para manter o código limpo
  disposeMissile(mesh) {
    this.scene.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      Array.isArray(mesh.material) ? mesh.material.forEach((mat) => mat.dispose()) : mesh.material.dispose();
    }
    mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
    });
  }
}
const ENEMY_LASER_GEO = new CylinderGeometry(0.4, 0.4, 8, 4);
ENEMY_LASER_GEO.rotateX(Math.PI / 2);
const ENEMY_LASER_MAT = new MeshBasicMaterial({ color: 16720435, toneMapped: false });
class EnemyManager {
  constructor(scene2, camera2, scorePopup2, isMobile = false) {
    this.scorePopup = scorePopup2;
    this.scene = scene2;
    this.camera = camera2;
    this.enemies = [];
    this.enemyProjectiles = [];
    this.templates = {};
    this.isMobile = isMobile;
    this.enemyCollisionBox = new Box3();
    this.obstacleCollisionBox = new Box3();
    this.waveTimer = 0;
    this.enemySpeed = 220;
    this.maxEnemiesOnScreen = isMobile ? 12 : 18;
    this.waveCooldown = isMobile ? 1 : 0.7;
    this.enemyTemplate = null;
    this.enemyTemplate5 = null;
    this.enemyTemplate10 = null;
    this.enemyTemplate15 = null;
    this.droneTemplate = null;
    this.meteoroTemplate = null;
    this.enemyTemplate6 = null;
    this._loadEnemyModel();
  }
  async init() {
    return Promise.resolve();
  }
  clearAllEnemies() {
    this.enemies.forEach((e) => {
      if (!e.userData || !e.userData.isBoss) {
        this.scene.remove(e);
      }
    });
    this.enemies = this.enemies.filter((e) => e.userData && e.userData.isBoss);
    this.enemyProjectiles.forEach((p) => {
      if (p.mesh) this.scene.remove(p.mesh);
    });
    this.enemyProjectiles = [];
  }
  _createOrientedTemplate(model, yRotation = 0) {
    const group = new Group();
    const clonedModel = model.clone();
    clonedModel.rotation.y = yRotation;
    clonedModel.traverse((child) => {
      if (child.isMesh) {
        child.frustumCulled = false;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    group.add(clonedModel);
    return group;
  }
  _addLocalGlow(model, color = 16755302, intensity = 1.2, distance = 240, emissiveIntensity = 0.45) {
    model.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const enhancedMaterials = materials.map((material) => {
        const nextMaterial = material.clone();
        if (nextMaterial.emissive) {
          nextMaterial.emissive = new Color(color);
          nextMaterial.emissiveIntensity = emissiveIntensity;
        }
        nextMaterial.needsUpdate = true;
        return nextMaterial;
      });
      child.material = Array.isArray(child.material) ? enhancedMaterials : enhancedMaterials[0];
    });
    const glow = new PointLight(color, intensity, distance);
    glow.position.set(0, 0, 0);
    model.add(glow);
    return glow;
  }
  _styleAsteroidModel(model) {
    model.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const styledMaterials = materials.map((material) => {
        const nextMaterial = material.clone();
        if (nextMaterial.color) nextMaterial.color.setHex(1447446);
        if (nextMaterial.map) nextMaterial.map.colorSpace = SRGBColorSpace;
        if ("roughness" in nextMaterial) nextMaterial.roughness = 1;
        if ("metalness" in nextMaterial) nextMaterial.metalness = 0;
        if ("emissive" in nextMaterial) {
          nextMaterial.emissive.setHex(0);
          nextMaterial.emissiveIntensity = 0;
        }
        if ("envMapIntensity" in nextMaterial) nextMaterial.envMapIntensity = 0.15;
        nextMaterial.needsUpdate = true;
        return nextMaterial;
      });
      child.material = Array.isArray(child.material) ? styledMaterials : styledMaterials[0];
    });
  }
  _loadEnemyModel() {
    const loader = new GLTFLoader();
    const loadModel = (path, targetKey, scale, rotation = 0) => {
      loader.load(path, (gltf) => {
        const model = this._createOrientedTemplate(gltf.scene, rotation);
        model.scale.set(...scale);
        this[targetKey] = model;
      }, void 0, (error) => {
        console.error(`❌ Erro ao carregar ${path}:`, error);
      });
    };
    loadModel("/assets/models/nave_inimiga.glb", "enemyTemplate", [20, 20, 20], 0);
    loadModel("/assets/models/nave_inim_5.glb", "enemyTemplate5", [20, 20, 20], Math.PI / 2);
    loadModel("/assets/models/nave_inim_10.glb", "enemyTemplate10", [20, 20, 20], 0);
    loadModel("/assets/models/nave_inim_15.glb", "enemyTemplate15", [20, 20, 20], 0);
    loadModel("/assets/models/drone.glb", "droneTemplate", [30, 30, 30], Math.PI);
    loadModel("/assets/models/meteoro.glb", "meteoroTemplate", [5, 5, 5], 0);
    loadModel("/assets/models/roblox.glb", "enemyTemplate6", [7, 7, 7], 0);
    loader.load("/assets/models/asteroid_ball.glb", (gltf) => {
      const model = gltf.scene;
      model.scale.set(3.5, 3.5, 3.5);
      this._styleAsteroidModel(model);
      this.templates.asteroide = model;
    }, void 0, (error) => {
      console.error("❌ Erro ao carregar asteroid_ball.glb:", error);
    });
  }
  spawnWave(player2, currentLevel = 1) {
    var _a;
    if (!this.enemyTemplate || !(player2 == null ? void 0 : player2.mesh) || this.enemies.length >= this.maxEnemiesOnScreen) return;
    const rand = Math.random();
    let selectedTemplate = this.enemyTemplate;
    let type = "comum";
    let speed = this.enemySpeed + Math.random() * 60;
    let passSound = "enemyPass";
    let laserSound = "enemyLaser";
    let hp = 1;
    if (rand < 0.25 && ((_a = this.templates) == null ? void 0 : _a.asteroide)) {
      selectedTemplate = this.templates.asteroide;
      type = "asteroide";
      speed = 140 + Math.random() * 80;
      passSound = "meteoro";
      laserSound = null;
      hp = 3;
    } else if (rand < 0.45) {
      selectedTemplate = this.droneTemplate || this.enemyTemplate;
      type = "drone";
      speed = 410;
      passSound = "drone";
      laserSound = "enemyLaser";
      hp = 1;
    } else if (rand < 0.6) {
      selectedTemplate = this.meteoroTemplate || this.enemyTemplate;
      type = "meteoro";
      speed = 180 + Math.random() * 70;
      passSound = "meteoro";
      laserSound = null;
      hp = 3;
    } else {
      const r = Math.random();
      if (currentLevel >= 51 && r < 0.6) {
        selectedTemplate = this.enemyTemplate15 || this.enemyTemplate;
        type = "nave_inim_15";
        speed += 150;
        passSound = "nave_pass_15";
        laserSound = "laser_inim_15";
        hp = 5;
      } else if (currentLevel >= 31 && r < 0.5) {
        selectedTemplate = this.enemyTemplate10 || this.enemyTemplate;
        type = "nave_inim_10";
        speed += 80;
        passSound = "nave_pss_10";
        laserSound = "laser_inim_10";
        hp = 3;
      } else if (currentLevel >= 21 && r < 0.4) {
        selectedTemplate = this.enemyTemplate5 || this.enemyTemplate;
        type = "nave_inim_5";
        speed += 40;
        passSound = "nave_pass_5";
        laserSound = "laser_inimi_5";
        hp = 2;
      } else if (currentLevel >= 6 && r < 0.3) {
        selectedTemplate = this.enemyTemplate6 || this.enemyTemplate;
        type = "roblox";
        speed += 20;
        passSound = "nave_pass_6";
        laserSound = "laser_inim_6";
        hp = 2;
      } else {
        selectedTemplate = this.enemyTemplate;
        type = "comum";
        passSound = "inimiga_passando";
        laserSound = "laser_inimigo";
        hp = 1;
      }
    }
    const enemy = selectedTemplate.clone();
    if (type === "meteoro") {
      this._addLocalGlow(enemy, 16747069);
    }
    const camPos = new Vector3();
    this.camera.getWorldPosition(camPos);
    const camDirection = new Vector3();
    this.camera.getWorldDirection(camDirection);
    const camRight = new Vector3();
    camRight.setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
    const spawnDistance = 2200;
    const centerSpawnPoint = camPos.clone().addScaledVector(camDirection, spawnDistance);
    const sideChoice = Math.random() < 0.5 ? -1 : 1;
    const lateralOffset = sideChoice * (400 + Math.random() * 280);
    const verticalOffset = (Math.random() - 0.5) * 220;
    const finalSpawnPos = centerSpawnPoint.clone().addScaledVector(camRight, lateralOffset).addScaledVector(new Vector3(0, 1, 0), verticalOffset);
    enemy.position.copy(finalSpawnPos);
    const moveDir = new Vector3().subVectors(camPos, enemy.position).normalize();
    const shootTimer = type === "meteoro" || type === "asteroide" ? 99999 : 0.8 + Math.random() * 1.2;
    enemy.userData = {
      type,
      speed,
      moveDir,
      shootTimer,
      hp,
      passSound,
      laserSound,
      passSoundPlayed: false,
      wanderSeed: Math.random() * Math.PI * 2,
      attackRange: 900 + Math.random() * 300
    };
    enemy.lookAt(camPos);
    enemy.traverse((child) => {
      if (child.isMesh) child.frustumCulled = false;
    });
    this.scene.add(enemy);
    this.enemies.push(enemy);
  }
  update(laserManager2, onScoreIncrease, player2, deltaTime, explosionManager2, soundManager2, currentLevel = 1, onPlayerHit = null) {
    if (!(player2 == null ? void 0 : player2.mesh) || !deltaTime) return;
    const camPosAtual = new Vector3();
    this.camera.getWorldPosition(camPosAtual);
    if (this.lastLevel !== currentLevel) {
      this.lastLevel = currentLevel;
      window.dispatchEvent(new CustomEvent("levelChanged", {
        detail: { level: currentLevel }
      }));
    }
    const adjustedCooldown = Math.max(0.25, this.waveCooldown - currentLevel * 0.015);
    this.waveTimer += deltaTime;
    if (this.waveTimer > adjustedCooldown) {
      this.spawnWave(player2, currentLevel);
      this.waveTimer = 0;
    }
    const pPos = new Vector3();
    player2.mesh.getWorldPosition(pPos);
    laserManager2.lasers || [];
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = this.enemyProjectiles[i];
      if (!p || !p.mesh) {
        this.enemyProjectiles.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(p.dir, p.speed * deltaTime);
      p.life -= deltaTime;
      if (p.life <= 0 || p.mesh.position.distanceTo(camPosAtual) > 2500) {
        this.scene.remove(p.mesh);
        this.enemyProjectiles.splice(i, 1);
        continue;
      }
      if (p.mesh.position.distanceTo(player2.mesh.position) < 18) {
        this.scene.remove(p.mesh);
        this.enemyProjectiles.splice(i, 1);
        if (onPlayerHit) onPlayerHit();
      }
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy || !enemy.userData) {
        this.enemies.splice(i, 1);
        continue;
      }
      const data = enemy.userData;
      const previousPosition = enemy.position.clone();
      if (data.type !== "meteoro" && data.type !== "asteroide") {
        data.shootTimer -= deltaTime;
        if (data.shootTimer <= 0) {
          this._enemyShoot(enemy, player2, soundManager2);
          data.shootTimer = 1.4 + Math.random() * 1.2;
        }
      }
      const pPos2 = player2.mesh.position;
      enemy.position.distanceTo(pPos2);
      if (!data.moveDir || data.moveDir.lengthSq() < 1e-4) {
        data.moveDir = new Vector3().subVectors(pPos2, enemy.position).normalize();
      }
      const side = new Vector3().crossVectors(data.moveDir.clone().normalize(), new Vector3(0, 1, 0)).normalize();
      if (side.lengthSq() < 1e-3) {
        side.set(1, 0, 0);
      }
      const wander = Math.sin(Date.now() * 7e-4 + data.wanderSeed) * 0.12;
      const desiredDir = data.moveDir.clone().normalize();
      desiredDir.addScaledVector(side, wander);
      desiredDir.y += wander * 0.15;
      desiredDir.normalize();
      data.moveDir.lerp(desiredDir, 0.03);
      data.moveDir.normalize();
      enemy.position.addScaledVector(data.moveDir, data.speed * deltaTime);
      const aimTarget = pPos2.clone().add(
        new Vector3(0, Math.sin(Date.now() * 1e-3 + data.wanderSeed) * 0.8, 0)
      );
      enemy.lookAt(aimTarget);
      if (soundManager2 && !data.passSoundPlayed && data.passSound) {
        if (enemy.position.distanceTo(camPosAtual) < 500) {
          soundManager2.play(data.passSound);
          data.passSoundPlayed = true;
        }
      }
      if (data.type === "drone" || data.type === "meteoro" || data.type === "asteroide") {
        enemy.rotation.x += 0.015;
        enemy.rotation.y += 0.015;
      }
      if (data.type !== "meteoro" && data.type !== "asteroide" && this._hitsAsteroid(enemy, i, previousPosition)) {
        continue;
      }
      let foiAtingidoPorLaser = false;
      let pontoDoImpactoReal = null;
      const playerLasers = laserManager2.lasers || [];
      for (let j = playerLasers.length - 1; j >= 0; j--) {
        const laser = playerLasers[j];
        if (!laser) continue;
        if (enemy.position.distanceTo(laser.position) < (data.type === "meteoro" || data.type === "asteroide" ? 70 : 55)) {
          pontoDoImpactoReal = laser.position.clone();
          laser.userData = { destroyed: true };
          this.scene.remove(laser);
          playerLasers.splice(j, 1);
          data.hp--;
          if (data.hp <= 0) foiAtingidoPorLaser = true;
          break;
        }
      }
      if (foiAtingidoPorLaser) {
        if (soundManager2) soundManager2.play("explosao_inimiga");
        if (explosionManager2) explosionManager2.create(pontoDoImpactoReal, currentLevel >= 50 ? 2.5 : 1);
        let pontos = data.type === "meteoro" || data.type === "asteroide" ? 500 : data.type === "drone" ? 300 : 1e3;
        if (onScoreIncrease) onScoreIncrease(pontos, pontoDoImpactoReal);
        this.scene.remove(enemy);
        this.enemies.splice(i, 1);
        continue;
      }
      if (enemy.position.distanceTo(camPosAtual) > 2800) {
        this.scene.remove(enemy);
        this.enemies.splice(i, 1);
      }
    }
  }
  _hitsAsteroid(enemy, enemyIndex, previousPosition) {
    var _a, _b;
    const enemyType = (_a = enemy == null ? void 0 : enemy.userData) == null ? void 0 : _a.type;
    if (!enemyType || enemyType === "meteoro" || enemyType === "asteroide") return false;
    enemy.updateMatrixWorld(true);
    const enemyBox = this.enemyCollisionBox.setFromObject(enemy);
    for (let j = 0; j < this.enemies.length; j++) {
      if (j === enemyIndex) continue;
      const obstacle = this.enemies[j];
      const obstacleType = (_b = obstacle == null ? void 0 : obstacle.userData) == null ? void 0 : _b.type;
      if (obstacleType !== "asteroide" && obstacleType !== "meteoro") continue;
      obstacle.updateMatrixWorld(true);
      const obstacleBox = this.obstacleCollisionBox.setFromObject(obstacle);
      if (enemyBox.intersectsBox(obstacleBox)) {
        enemy.position.copy(previousPosition);
        enemy.userData.moveDir = enemy.userData.moveDir.clone().multiplyScalar(-0.15).normalize();
        return true;
      }
    }
    return false;
  }
  _enemyShoot(enemy, player2, soundManager2) {
    if (enemy.userData.type === "meteoro" || enemy.userData.type === "asteroide" || !(player2 == null ? void 0 : player2.mesh)) return;
    const pPos = new Vector3();
    player2.mesh.getWorldPosition(pPos);
    const laser = new Mesh(ENEMY_LASER_GEO, ENEMY_LASER_MAT);
    laser.position.copy(enemy.position);
    laser.lookAt(pPos);
    this.scene.add(laser);
    const dir = new Vector3().subVectors(pPos, laser.position).normalize();
    laser.userData = { direction: dir };
    this.enemyProjectiles.push({ mesh: laser, dir, speed: 520, life: 2.2 });
    if (soundManager2 && enemy.userData.laserSound) {
      soundManager2.play(enemy.userData.laserSound);
    }
  }
  damageEnemy(enemy, damage = 22, hitPoint = null) {
    if (!(enemy == null ? void 0 : enemy.userData)) return false;
    enemy.userData.hp = (enemy.userData.hp || 1) - damage;
    if (enemy.userData.hp <= 0) {
      let pontos = enemy.userData.type === "meteoro" || enemy.userData.type === "asteroide" ? 500 : enemy.userData.type === "drone" ? 250 : enemy.userData.type === "roblox" ? 150 : 100;
      if (this.scorePopup && hitPoint) this.scorePopup.show(pontos, hitPoint);
      return true;
    }
    return false;
  }
}
class ExplosionManager {
  constructor(scene2, soundManager2, isMobile = false) {
    this.scene = scene2;
    this.soundManager = soundManager2;
    this.explosions = [];
    this.spriteColumns = 3;
    this.spriteRows = 4;
    this.totalFrames = this.spriteColumns * this.spriteRows;
    const textureLoader = new TextureLoader();
    this.explosionTexture = textureLoader.load("/assets/img/explosion.png");
    this.explosionTexture.wrapS = RepeatWrapping;
    this.explosionTexture.wrapT = RepeatWrapping;
    this.explosionTexture.repeat.set(1 / this.spriteColumns, 1 / this.spriteRows);
  }
  create(position, multiplicador = 1) {
    if (this.soundManager) this.soundManager.play("explosion");
    const safePosition = position instanceof Vector3 ? position.clone() : new Vector3(0, 0, 0);
    if (typeof multiplicador === "object") multiplicador = 1;
    const distancia = Math.abs(safePosition.z);
    const escalaBase = 28 * multiplicador;
    const fatorEscala = escalaBase * (80 / (distancia + 100));
    const explosionTexture = new Texture(this.explosionTexture.image);
    explosionTexture.wrapS = RepeatWrapping;
    explosionTexture.wrapT = RepeatWrapping;
    explosionTexture.repeat.set(1 / this.spriteColumns, 1 / this.spriteRows);
    explosionTexture.needsUpdate = true;
    const mat = new SpriteMaterial({
      map: explosionTexture,
      transparent: true,
      opacity: 0.7,
      blending: AdditiveBlending,
      depthWrite: false
    });
    const sprite = new Sprite(mat);
    sprite.position.copy(safePosition);
    sprite.scale.set(fatorEscala, fatorEscala, 1);
    this.scene.add(sprite);
    this.explosions.push({
      sprite,
      life: 0.7,
      maxLife: 0.7
    });
    this.createDebris(safePosition, 4);
  }
  createBigExplosion(position) {
    const safePosition = position instanceof Vector3 ? position.clone() : new Vector3(0, 0, 0);
    this.create(safePosition, 1.3);
    this.createDebris(safePosition, 6);
  }
  createDebris(position, count = 5) {
    for (let i = 0; i < count; i++) {
      const geometry = new TetrahedronGeometry(Math.random() * 1 + 0.5);
      const material = new MeshStandardMaterial({
        color: 6710886,
        roughness: 0.88,
        metalness: 0.12
      });
      const debris = new Mesh(geometry, material);
      debris.position.copy(position);
      this.scene.add(debris);
      const direction = new Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.2 + 0.4,
        (Math.random() - 0.5) * 2
      ).normalize();
      const strength = 18 + Math.random() * 12;
      const velocity = direction.multiplyScalar(strength);
      const rotationSpeed = new Vector3(
        Math.random() * 0.05,
        Math.random() * 0.05,
        Math.random() * 0.05
      );
      this.explosions.push({
        isDebris: true,
        mesh: debris,
        velocity,
        rotationSpeed,
        life: 1.05
      });
    }
  }
  update(deltaTime) {
    if (!deltaTime) return;
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      if (exp.isDebris) {
        exp.life -= deltaTime;
        exp.velocity.y -= 0.5 * deltaTime;
        exp.mesh.position.addScaledVector(exp.velocity, deltaTime);
        exp.mesh.rotation.x += exp.rotationSpeed.x;
        exp.mesh.rotation.y += exp.rotationSpeed.y;
        exp.mesh.rotation.z += exp.rotationSpeed.z;
        if (exp.life <= 0 || exp.mesh.position.length() > 4500) {
          this.scene.remove(exp.mesh);
          exp.mesh.geometry.dispose();
          exp.mesh.material.dispose();
          this.explosions.splice(i, 1);
        }
        continue;
      }
      exp.life -= deltaTime;
      if (exp.life <= 0) {
        this.scene.remove(exp.sprite);
        exp.sprite.material.map.dispose();
        exp.sprite.material.dispose();
        this.explosions.splice(i, 1);
        continue;
      }
      const progress = 1 - exp.life / exp.maxLife;
      const currentFrame = Math.min(this.totalFrames - 1, Math.floor(progress * this.totalFrames));
      const col = currentFrame % this.spriteColumns;
      const row = Math.floor(currentFrame / this.spriteColumns);
      const texture = exp.sprite.material.map;
      texture.offset.set(col / this.spriteColumns, 1 - (row + 1) / this.spriteRows);
      texture.needsUpdate = true;
    }
  }
}
function createCloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new CanvasTexture(canvas);
}
new GLTFLoader();
const cloudTexture = createCloudTexture();
class SpaceEnvironment {
  constructor(scene2, starCount = 2e3, cloudCount = 400) {
    this.scene = scene2;
    this.loader = new GLTFLoader();
    this.planets = [];
    this.ambientLight = null;
    this.currentThemeIndex = 0;
    this.themes = [
      { background: 8772, cloud: 4482696, ambient: 16777215 },
      { background: 1054767, cloud: 7044351, ambient: 12109823 },
      { background: 1706024, cloud: 11558143, ambient: 15844095 },
      { background: 2757127, cloud: 16747069, ambient: 16765347 },
      { background: 402714, cloud: 4380324, ambient: 12779495 },
      { background: 2360842, cloud: 16732027, ambient: 16761039 }
    ];
    this.starCount = starCount;
    this.starPositions = new Float32Array(starCount * 3);
    this.starColors = new Float32Array(starCount * 3);
    this.starSizes = new Float32Array(starCount);
    this.starVelocities = new Float32Array(starCount);
    this.cloudCount = cloudCount;
    this.cloudPositions = new Float32Array(cloudCount * 3);
    this.cloudVelocities = new Float32Array(cloudCount);
    this.cloudSizes = new Float32Array(cloudCount);
    this.initParticles();
    this.initEnvironment();
    this.initPlanets();
  }
  initPlanets() {
    const planetFiles = [
      "/assets/models/planeta.glb",
      "/assets/models/planeta_dourado.glb",
      "/assets/models/moon.glb",
      "/assets/models/green_planeta.glb"
    ];
    const lanes = [-4800, -1600, 1600, 4800];
    planetFiles.forEach((path, index) => {
      const placeholderGeo = new SphereGeometry(50, 32, 32);
      const placeholderMat = new MeshPhongMaterial({
        color: Math.random() * 16777215,
        emissive: 1118481
      });
      const placeholder = new Mesh(placeholderGeo, placeholderMat);
      const xPos = lanes[index] + (Math.random() - 0.5) * 700;
      const yPos = -800 + Math.random() * 1700;
      placeholder.position.set(xPos, yPos, -6e3 - Math.random() * 2e3);
      placeholder.visible = false;
      this.scene.add(placeholder);
      this.planets.push(placeholder);
      this.loader.load(
        path,
        (gltf) => {
          const p = gltf.scene;
          console.log(`✅ Planeta carregado: ${path} (índice ${index})`);
          p.position.copy(placeholder.position);
          p.visible = placeholder.visible;
          this.scene.add(p);
          this.scene.remove(placeholder);
          const idx = this.planets.indexOf(placeholder);
          if (idx !== -1) {
            this.planets[idx] = p;
          }
        },
        void 0,
        (error) => {
          console.error(`❌ Erro ao carregar ${path}:`, error);
        }
      );
    });
  }
  initParticles() {
    this.starGeometry = new BufferGeometry();
    for (let i = 0; i < this.starCount; i++) {
      this.resetParticle(i, this.starPositions, this.starVelocities, 40, 20);
      this.setStarColor(i);
      this.starSizes[i] = Math.random() * 2.5 + 1;
    }
    this.starGeometry.setAttribute("position", new BufferAttribute(this.starPositions, 3));
    this.starGeometry.setAttribute("color", new BufferAttribute(this.starColors, 3));
    this.starGeometry.setAttribute("size", new BufferAttribute(this.starSizes, 1));
    const starMaterial = new PointsMaterial({ size: 2, vertexColors: true, transparent: true, opacity: 0.85, depthTest: true, depthWrite: false, sizeAttenuation: true });
    this.stars = new Points(this.starGeometry, starMaterial);
    this.scene.add(this.stars);
    this.cloudGeometry = new BufferGeometry();
    for (let i = 0; i < this.cloudCount; i++) {
      this.resetParticle(i, this.cloudPositions, this.cloudVelocities, 8, 4);
      this.cloudSizes[i] = Math.random() * 500 + 200;
    }
    this.cloudGeometry.setAttribute("position", new BufferAttribute(this.cloudPositions, 3));
    const cloudMat = new PointsMaterial({ map: cloudTexture, sizeAttenuation: true, transparent: true, depthWrite: false, color: 4482696, blending: NormalBlending });
    this.clouds = new Points(this.cloudGeometry, cloudMat);
    this.scene.add(this.clouds);
  }
  setStarColor(i) {
    const i3 = i * 3;
    const rand = Math.random();
    if (rand < 0.45) {
      this.starColors[i3] = 0.95 + Math.random() * 0.05;
      this.starColors[i3 + 1] = 0.95 + Math.random() * 0.05;
      this.starColors[i3 + 2] = 1;
    } else if (rand < 0.75) {
      this.starColors[i3] = 1;
      this.starColors[i3 + 1] = 0.9 + Math.random() * 0.1;
      this.starColors[i3 + 2] = 0.65 + Math.random() * 0.25;
    } else if (rand < 0.9) {
      this.starColors[i3] = 0.55 + Math.random() * 0.35;
      this.starColors[i3 + 1] = 0.8 + Math.random() * 0.2;
      this.starColors[i3 + 2] = 1;
    } else {
      this.starColors[i3] = 1;
      this.starColors[i3 + 1] = 0.45 + Math.random() * 0.35;
      this.starColors[i3 + 2] = 0.25 + Math.random() * 0.25;
    }
  }
  resetParticle(i, posArray, velArray, speedMax, speedMin) {
    const i3 = i * 3;
    posArray[i3] = (Math.random() - 0.5) * 4e3;
    posArray[i3 + 1] = (Math.random() - 0.5) * 4e3;
    posArray[i3 + 2] = (Math.random() - 0.5) * 4e3;
    velArray[i] = Math.random() * speedMax + speedMin;
  }
  initEnvironment() {
    this.ambientLight = new AmbientLight(16777215, 0.8);
    this.scene.add(this.ambientLight);
    this.applyTheme(this.themes[0]);
  }
  applyTheme(theme) {
    var _a;
    this.scene.background = new Color(theme.background);
    if (this.ambientLight) {
      this.ambientLight.color.setHex(theme.ambient);
      this.ambientLight.intensity = 0.75 + Math.random() * 0.15;
    }
    if ((_a = this.clouds) == null ? void 0 : _a.material) this.clouds.material.color.setHex(theme.cloud);
  }
  setLevelTheme(level) {
    if (level <= 1) {
      this.currentThemeIndex = 0;
      this.applyTheme(this.themes[0]);
      return;
    }
    let nextIndex = 1 + Math.floor(Math.random() * (this.themes.length - 1));
    if (nextIndex === this.currentThemeIndex) nextIndex = 1 + (nextIndex + 1) % (this.themes.length - 1);
    this.currentThemeIndex = nextIndex;
    this.applyTheme(this.themes[nextIndex]);
  }
  update(deltaTime, playerPosition, moveInput, currentLevel = 1, playerMesh = null, soundManager2 = null) {
    this.planets.forEach((p, index) => {
      const shouldBeVisible = currentLevel === 5;
      if (shouldBeVisible) {
        p.position.z += 80 * deltaTime;
        if (p.position.z > 1800) {
          p.visible = false;
        } else {
          const distZ = Math.abs(p.position.z);
          let opacity = 1;
          if (distZ > 8e3) {
            opacity = 0;
            p.visible = false;
          } else {
            p.visible = true;
            if (distZ > 6e3) {
              opacity = (8e3 - distZ) / 2e3;
            }
          }
          p.traverse((child) => {
            if (child.isMesh && child.material) {
              child.material.transparent = true;
              child.material.opacity = opacity;
            }
          });
          let scale;
          if (distZ > 7500) {
            scale = 1;
          } else if (distZ > 6e3) {
            const progress = (7500 - distZ) / 1500;
            scale = 1 + (30 - 1) * progress;
          } else if (distZ > 3e3) {
            const progress = (6e3 - distZ) / 3e3;
            scale = 30 + (150 - 30) * (progress * progress);
          } else if (distZ < 500) {
            scale = 200;
          } else {
            const progress = (3e3 - distZ) / 2500;
            scale = 150 + (200 - 150) * progress;
          }
          p.scale.set(scale, scale, scale);
          if (playerMesh && distZ < 3500) {
            this._avoidPlanetCollision(playerMesh, p, soundManager2);
          }
        }
      } else {
        p.visible = false;
      }
    });
    const pulse = Math.sin(Date.now() * 2e-3) * 0.1 + 0.9;
    this.stars.material.opacity = 0.85 * pulse;
    this.clouds.material.opacity = 0.3 * pulse;
    this.moveParticles(this.starPositions, this.starVelocities, this.starCount, this.stars, deltaTime, moveInput, playerPosition);
    this.moveParticles(this.cloudPositions, this.cloudVelocities, this.cloudCount, this.clouds, deltaTime, moveInput);
  }
  resetPlanetPosition(planet, index) {
    planet.position.z = -8500 - Math.random() * 2500;
    const lanes = [-4800, -1600, 1600, 4800];
    planet.position.x = lanes[index] + (Math.random() - 0.5) * 700;
    planet.position.y = -800 + Math.random() * 1700 - index * 100;
  }
  moveParticles(pos, vel, count, points, dt, moveInput, playerPos = null) {
    for (let i = 0; i < count; i++) {
      let i3 = i * 3;
      pos[i3 + 2] += vel[i] * 32 * dt;
      pos[i3] -= moveInput.x * 20 * dt;
      pos[i3 + 1] -= moveInput.y * 20 * dt;
      if (playerPos) {
        const dx = pos[i3] - playerPos.x;
        const dy = pos[i3 + 1] - playerPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 250 && dist > 0) {
          const pushForce = (250 - dist) / 250 * 5;
          pos[i3] += dx / dist * pushForce;
          pos[i3 + 1] += dy / dist * pushForce;
        }
      }
      if (pos[i3 + 2] > 50) {
        pos[i3 + 2] = -2e3;
        pos[i3] = (Math.random() - 0.5) * 1e3;
        pos[i3 + 1] = (Math.random() - 0.5) * 1e3;
        this.setStarColor(i);
      }
    }
    points.geometry.attributes.position.needsUpdate = true;
  }
  _avoidPlanetCollision(playerMesh, planet, soundManager2) {
    var _a;
    const dx = playerMesh.position.x - planet.position.x;
    const dy = playerMesh.position.y - planet.position.y;
    const dz = playerMesh.position.z - planet.position.z;
    const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const effectiveRadius = planet.scale.x * 0.5 + 150;
    const detectionRadius = effectiveRadius * 1.3;
    if (dist3D < detectionRadius) {
      if (soundManager2 && !((_a = playerMesh.userData) == null ? void 0 : _a.planetSoundPlayed)) {
        soundManager2.play("meteoro");
        playerMesh.userData.planetSoundPlayed = true;
      }
      if (dist3D < effectiveRadius) {
        const escapeDir = new Vector3(dx, dy, dz).normalize();
        playerMesh.position.copy(planet.position.clone().addScaledVector(escapeDir, effectiveRadius + 50));
        return;
      }
      const pushForce = Math.max(1, (detectionRadius - dist3D) / (detectionRadius - effectiveRadius) * 8);
      const pushX = dx / dist3D * pushForce * 0.6;
      const pushY = dy / dist3D * pushForce * 1.2;
      const pushZ = dz / dist3D * pushForce * 0.8;
      playerMesh.position.x += pushX;
      playerMesh.position.y += pushY;
      playerMesh.position.z += pushZ;
    } else {
      if (playerMesh.userData) playerMesh.userData.planetSoundPlayed = false;
    }
  }
}
class ProgressionManager {
  constructor() {
    this.level = 1;
    this.totalScore = 0;
    this.upgradePoints = 0;
    this.chancesLeft = 5;
    this.maxLevel = 100;
    this.levelProgressTarget = 1e4;
    this.levelProgressScore = 0;
    this.activeBoss = null;
  }
  shouldSpawnBoss() {
    return this.level >= 50 && this.level % 5 === 0 && !this.activeBoss;
  }
  getBossScale() {
    if (this.level < 50) return 1;
    const progress = (this.level - 50) / (this.maxLevel - 50);
    return 1 + progress * 1;
  }
  registerBoss(bossInstance) {
    this.activeBoss = bossInstance;
  }
  addScore(points) {
    this.totalScore += points;
    this.levelProgressScore += points;
    if (this.levelProgressScore < this.levelProgressTarget || this.level >= this.maxLevel) {
      return false;
    }
    this.levelProgressScore = Math.max(0, this.levelProgressScore - this.levelProgressTarget);
    this.levelUp();
    return true;
  }
  levelUp() {
    if (this.level >= this.maxLevel) return false;
    this.level++;
    this.upgradePoints += 2;
    this.resetLevelResources();
    console.log(`🚀 NÍVEL ${this.level} ALCANÇADO!`);
    return true;
  }
  getScoreNeededForNextLevel() {
    return 1e4;
  }
  resetLevelResources() {
    this.chancesLeft = 5;
    this.levelProgressTarget = 1e4;
  }
  loseChance() {
    this.chancesLeft = Math.max(0, this.chancesLeft - 1);
    return { chancesLeft: this.chancesLeft, failed: this.chancesLeft === 0 };
  }
  failLevel() {
    this.levelProgressScore = 0;
    this.resetLevelResources();
    return this.level;
  }
  resetLevelProgress() {
    this.levelProgressScore = 0;
    this.levelProgressTarget = 1e4;
    this.chancesLeft = 5;
    this.activeBoss = null;
  }
  getLevel() {
    return this.level;
  }
  setLevel(level) {
    this.level = Math.max(1, Math.min(this.maxLevel, Math.floor(level)));
    this.levelProgressScore = 0;
    this.resetLevelResources();
  }
  getChancesLeft() {
    return this.chancesLeft;
  }
  getProgressPercent() {
    return Math.min(1, this.levelProgressScore / this.levelProgressTarget);
  }
  getLevelLoadout() {
    const missileBonus = Math.floor(this.level / 6);
    const pdcBonus = Math.floor(this.level / 4);
    return {
      missiles: 8 + missileBonus,
      pdcBursts: 25 + pdcBonus,
      chancesLeft: this.chancesLeft
    };
  }
}
function getLevelData(level) {
  if (level >= 100) return { title: "Fronteira da Nave-Mãe", task: "Você chegou ao coração inimigo. Destrua a Nave-Mãe para vencer!" };
  if (level >= 75) return { title: "Setor de Radiação", task: "Escudos críticos! Elimine os inimigos rapidamente." };
  if (level >= 50) return { title: "Setor de Guerra Alpha", task: "Zona de conflito total. Não pare de atirar." };
  if (level >= 33) return { title: "Zona de Bloqueio Hostil", task: "Naves pesadas interceptando. Priorize alvos blindados." };
  if (level >= 20) return { title: "Perímetro Defensivo", task: "Inimigos detectados! Mantenha a velocidade e responda ao fogo." };
  if (level >= 1) return { title: "Setor de Hostil", task: "Calibre seus canhões e destrua os dróides básicos." };
  return {
    title: "Zona de Patrulha",
    task: "Detectada presença inimiga. Limpe o perímetro imediatamente."
  };
}
class NaveMae {
  constructor(scene2) {
    if (window.__NAVE_MAE_ATIVA) {
      console.warn("⚠️ Nave Mãe duplicada bloqueada");
      this.isAlive = false;
      this.isActive = false;
      return;
    }
    window.__NAVE_MAE_ATIVA = this;
    this.scene = scene2;
    this.mesh = null;
    this.explosionModel = null;
    this.hp = 25e4;
    this.maxHp = 25e4;
    this.isBoss = true;
    this.isAlive = false;
    this.isActive = false;
    this.invulnerableUntil = 0;
    this.spawnTime = 0;
    this.currentInternalScale = 2;
    this.lastFireTime = 0;
    this.fireRate = 2.2;
    this.bossLaserSound = "laser_inimigo";
    this.startScale = 45;
    this.maxScale = 350;
    this.startZ = -1800;
    this.cannonOffsets = [
      new Vector3(80, 55, 0),
      new Vector3(-80, 55, 0),
      new Vector3(0, 55, 70),
      new Vector3(0, 55, -70)
    ];
    this.loader = new GLTFLoader();
    this.textureLoader = new TextureLoader();
    this.fogoTexture = this.textureLoader.load("/assets/img/fire_prev.png");
    this._loadModel();
    this._loadExplosionModel();
  }
  _loadModel() {
    this.loader.load("/assets/models/nave_mae/scene.gltf", (gltf) => {
      if (window.__NAVE_MAE_ATIVA !== this) return;
      this.mesh = gltf.scene;
      this.mesh.userData = { isBoss: true, type: "boss", laserSound: this.bossLaserSound };
      this.mesh.visible = false;
      this.mesh.position.set(0, 40, this.startZ);
      this.mesh.scale.set(this.startScale, this.startScale, this.startScale);
      this.mesh.rotation.y = Math.PI;
      this.mesh.traverse((child) => {
        if (child.isMesh) {
          child.frustumCulled = false;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.scene.add(this.mesh);
      console.log("✅ Nave Mãe adicionada e pronta para o combate");
    }, void 0, (error) => {
      console.error("❌ Erro ao carregar nave_mae:", error);
    });
  }
  _loadExplosionModel() {
    this.loader.load("/assets/models/nave_mae/explosion.glb", (gltf) => {
      if (window.__NAVE_MAE_ATIVA !== this) return;
      this.explosionModel = gltf.scene;
      this.explosionModel.visible = false;
      this.explosionModel.position.set(0, 0, -100);
      this.explosionModel.scale.set(5, 5, 5);
      this.scene.add(this.explosionModel);
    });
  }
  ativarNave(nivel) {
    this.isAlive = true;
    this.isActive = true;
    this.hp = 10;
    this.maxHp = 10;
    this.requiredDestructionLevel = 98;
    this.startScale = 12;
    this.maxScale = 320;
    this.currentInternalScale = this.startScale;
    this.spawnTime = Date.now();
    this.invulnerableUntil = Date.now() + 2500;
    this.lastHpPercentLog = 100;
    if (this.mesh) {
      if (!this.mesh.parent) this.scene.add(this.mesh);
      this.mesh.visible = true;
      this.mesh.position.set(0, 50, this.startZ);
      this.mesh.scale.set(this.startScale, this.startScale, this.startScale);
    } else {
      setTimeout(() => {
        if (this.mesh) {
          if (!this.mesh.parent) this.scene.add(this.mesh);
          this.mesh.visible = true;
          this.mesh.position.set(0, 50, this.startZ);
          this.mesh.scale.set(this.startScale, this.startScale, this.startScale);
        }
      }, 500);
    }
    console.log(`💀 [BOSS] Nave Mãe ativada | HP: ${this.hp} | escala ${this.startScale} → ${this.maxScale}`);
    return true;
  }
  _calculateVulnerability(level) {
    if (level < 50) return 0;
    return Math.min(10, Math.floor((level - 50) / 5) + 1);
  }
  takeDamage(amount, hitPoint = null, explosionManager2 = null) {
    if (!this.isAlive || !this.isActive) return false;
    if (Date.now() < this.invulnerableUntil) return false;
    const currentLevel = window.currentLevel || 50;
    const allowedSegments = this._calculateVulnerability(currentLevel);
    const minHp = Math.max(0, this.maxHp - allowedSegments);
    if (this.hp <= minHp) {
      return false;
    }
    this.hp = Math.max(minHp, this.hp - 1);
    const percent = Math.floor(this.hp / this.maxHp * 100);
    if (percent >= 0 && percent % 10 === 0 && percent < this.lastHpPercentLog) {
      console.log(`🩸 Boss HP: ${percent}% (${this.hp})`);
      this.lastHpPercentLog = percent;
    }
    if (explosionManager2 && hitPoint) {
      explosionManager2.create(hitPoint.clone(), {
        kind: "boss",
        flashColor: 16737792,
        lightColor: 16759603,
        lightIntensity: 1800,
        smokeColor: 6693376
      });
    }
    if (this.hp <= 0) {
      this.explode(hitPoint, explosionManager2);
      return true;
    }
    return false;
  }
  explode(hitPoint = null, explosionManager2 = null) {
    this.isAlive = false;
    this.isActive = false;
    if (explosionManager2 && hitPoint) {
      explosionManager2.create(hitPoint, {
        kind: "boss",
        flashColor: 16737792,
        lightColor: 16759603,
        lightIntensity: 2800,
        smokeColor: 6693376
      });
    }
  }
  update(deltaTime, playerPosition, laserManager2 = null, explosionManager2 = null, player2 = null, enemyManager2 = null, soundManager2 = null) {
    var _a, _b;
    if (!this.isAlive || !this.isActive || !this.mesh) return;
    const timeSinceSpawn = (Date.now() - this.spawnTime) / 1e3;
    const growthDuration = 280;
    const timeProgress = Math.min(1, timeSinceSpawn / growthDuration);
    const targetZ = ((playerPosition == null ? void 0 : playerPosition.z) ?? 0) - 220;
    const totalDistance = Math.abs(this.startZ - targetZ);
    const currentDistance = Math.abs(this.mesh.position.z - targetZ);
    const approachProgress = MathUtils.clamp(1 - currentDistance / totalDistance, 0, 1);
    const progress = timeProgress * 0.7 + approachProgress * 0.3;
    this.currentInternalScale = MathUtils.lerp(this.startScale, this.maxScale, progress);
    this.mesh.scale.set(
      this.currentInternalScale,
      this.currentInternalScale,
      this.currentInternalScale
    );
    const target = new Vector3(0, 40, targetZ);
    if (playerPosition) {
      const bossOrbitX = Math.sin(timeSinceSpawn * 0.14) * 90;
      const bossOrbitY = Math.cos(timeSinceSpawn * 0.08) * 16;
      target.x = MathUtils.clamp((playerPosition.x ?? 0) * 0.05 + bossOrbitX, -120, 120);
      target.y = Math.max(26, (playerPosition.y ?? 20) + 24 + bossOrbitY);
    }
    const lerpSpeed = timeSinceSpawn < 25 ? 2e-3 : 8e-3;
    this.mesh.position.lerp(target, lerpSpeed);
    this.mesh.rotation.y = Math.PI + Math.sin(Date.now() * 25e-5) * 0.06;
    this.mesh.rotation.z = Math.sin(Date.now() * 4e-4) * 0.03;
    if (player2 && enemyManager2 && soundManager2) {
      this._attemptShoot(player2, enemyManager2, soundManager2);
    }
    const hitRadius = Math.min(this.currentInternalScale * 0.9, 220);
    if (laserManager2 == null ? void 0 : laserManager2.lasers) {
      for (let i = laserManager2.lasers.length - 1; i >= 0; i--) {
        const laser = laserManager2.lasers[i];
        if (!(laser == null ? void 0 : laser.position)) continue;
        if (laser.position.distanceTo(this.mesh.position) < hitRadius) {
          laserManager2.scene.remove(laser);
          laserManager2.lasers.splice(i, 1);
          this.takeDamage(8, laser.position.clone(), explosionManager2);
          break;
        }
      }
    }
    if (laserManager2 == null ? void 0 : laserManager2.missiles) {
      for (let i = laserManager2.missiles.length - 1; i >= 0; i--) {
        const missile = laserManager2.missiles[i];
        if (!((_a = missile == null ? void 0 : missile.mesh) == null ? void 0 : _a.position)) continue;
        if (missile.mesh.position.distanceTo(this.mesh.position) < hitRadius * 1.3) {
          const hitPoint = missile.mesh.position.clone();
          this.takeDamage(120, hitPoint, explosionManager2);
          if (typeof laserManager2.disposeMissile === "function") {
            laserManager2.disposeMissile(missile.mesh);
          } else {
            laserManager2.scene.remove(missile.mesh);
          }
          laserManager2.missiles.splice(i, 1);
          break;
        }
      }
    }
    if (player2 == null ? void 0 : player2.pdcProjectiles) {
      const projectiles = player2.pdcProjectiles;
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const b = projectiles[i];
        if (!((_b = b == null ? void 0 : b.mesh) == null ? void 0 : _b.position)) continue;
        if (b.mesh.position.distanceTo(this.mesh.position) < hitRadius) {
          this.takeDamage(4, b.mesh.position.clone(), explosionManager2);
          this.scene.remove(b.mesh);
          projectiles.splice(i, 1);
        }
      }
    }
  }
  _getCannonWorldPositions() {
    if (!this.mesh) return [];
    this.mesh.updateMatrixWorld(true);
    return this.cannonOffsets.map((offset) => offset.clone().applyMatrix4(this.mesh.matrixWorld));
  }
  _attemptShoot(player2, enemyManager2, soundManager2) {
    if (!this.mesh || !this.isAlive || !this.isActive) return;
    if (this.currentInternalScale < this.maxScale * 0.35) return;
    const now = Date.now();
    if (now - this.lastFireTime < this.fireRate * 1e3) return;
    if (!(player2 == null ? void 0 : player2.mesh) || !enemyManager2 || typeof enemyManager2._enemyShoot !== "function") return;
    const targetPos = new Vector3();
    player2.mesh.getWorldPosition(targetPos);
    const dist = this.mesh.position.distanceTo(targetPos);
    if (dist > 2200) return;
    this.lastFireTime = now;
    const cannonPositions = this._getCannonWorldPositions();
    cannonPositions.forEach((pos) => {
      const fakeEnemy = {
        position: pos,
        userData: { type: "boss", laserSound: this.bossLaserSound }
      };
      enemyManager2._enemyShoot(fakeEnemy, player2, soundManager2);
    });
  }
  dispose() {
    if (window.__NAVE_MAE_ATIVA === this) {
      window.__NAVE_MAE_ATIVA = null;
    }
    this.isAlive = false;
    this.isActive = false;
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
    if (this.explosionModel) {
      this.scene.remove(this.explosionModel);
      this.explosionModel = null;
    }
  }
}
window.moveInput = { x: 0, y: 0 };
if (typeof window.__BOSS_SPAWNED_LEVELS === "undefined") {
  window.__BOSS_SPAWNED_LEVELS = /* @__PURE__ */ new Set();
}
if (typeof window.__NAVE_MAE_ATIVA === "undefined") {
  window.__NAVE_MAE_ATIVA = null;
}
let audioInitialized = false;
let currentState = "menu";
let score = 0;
let countdown = 5;
let isGameStarted = false;
let boss = null;
let isBossFight = false;
const GAME_STATE = { PLAYING: "playing", PAUSED: "paused" };
const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const scene = new Scene();
scene.background = new Color(65795);
const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 5e4);
camera.position.set(0, 5, 55);
const clock = new Clock();
const renderer = new WebGLRenderer({
  antialias: false,
  powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(isMobileDevice ? 1 : Math.min(window.devicePixelRatio, 1.5));
document.body.appendChild(renderer.domElement);
const soundManager = new SoundManager();
window.soundManager = soundManager;
const laserManager = new LaserManager(scene, soundManager);
const explosionManager = new ExplosionManager(scene, soundManager, isMobileDevice);
window.explosionManager = explosionManager;
const inputManager = new InputManager();
const scorePopup = new ScorePopup(scene, camera);
const player = new Player(scene, laserManager, explosionManager);
const enemyManager = new EnemyManager(scene, camera, scorePopup, isMobileDevice);
const spaceEnvironment = new SpaceEnvironment(scene, isMobileDevice ? 800 : 2e3, isMobileDevice ? 120 : 400);
const progressionManager = new ProgressionManager();
const naveMae = new NaveMae(scene);
function syncLevelResources() {
  player.setLevelLoadout(progressionManager.getLevelLoadout());
  updateResourceHUD();
}
function updateHUD() {
  const scoreVal = document.getElementById("score-val");
  if (scoreVal) scoreVal.textContent = score.toString().padStart(7, "0");
  updateLevelProgressHUD();
}
function updateLevelHUD() {
  const levelVal = document.getElementById("level-val");
  if (levelVal) levelVal.textContent = progressionManager.getLevel();
}
function updateLevelProgressHUD() {
  const progress = progressionManager.getProgressPercent();
  const bar = document.getElementById("level-progress-bar");
  const label = document.getElementById("level-progress-label");
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, progress * 100))}%`;
  if (label) label.textContent = `${Math.round(progress * 100)}%`;
}
function updateResourceHUD() {
  const missileVal = document.getElementById("missile-val");
  const pdcVal = document.getElementById("pdc-val");
  const chanceVal = document.getElementById("chance-val");
  const ammo = player.getAmmoStatus();
  if (missileVal) missileVal.textContent = ammo.missiles;
  if (pdcVal) pdcVal.textContent = ammo.pdcBursts;
  if (chanceVal) chanceVal.textContent = progressionManager.getChancesLeft();
  const chargeBar = document.getElementById("missile-load-bar");
  if (chargeBar) {
    const progress = Math.max(0, Math.min(1, ammo.missileReloadProgress));
    chargeBar.style.width = `${progress * 100}%`;
    chargeBar.style.opacity = ammo.missiles >= ammo.missileMax ? "0.4" : "1";
  }
  const pdcBar = document.getElementById("pdc-load-bar");
  if (pdcBar) {
    const pdcProgress = player.maxPdcBursts === Infinity ? 1 : Math.max(0, Math.min(1, (player.pdcBurstCount || 0) / Math.max(player.maxPdcBursts || 1, 1)));
    pdcBar.style.width = `${pdcProgress * 100}%`;
  }
}
function updateEnvironmentTheme(level = progressionManager.getLevel()) {
  if (spaceEnvironment == null ? void 0 : spaceEnvironment.setLevelTheme) spaceEnvironment.setLevelTheme(level);
}
function updateLevelUI(currentLevel) {
  const data = getLevelData(currentLevel);
  const titleElement = document.querySelector(".nexus-title");
  const taskElement = document.querySelector(".nexus-status");
  if (titleElement && taskElement) {
    titleElement.innerText = `NÍVEL ${currentLevel} - ${data.title}`;
    taskElement.innerText = data.task;
    titleElement.style.display = "block";
    taskElement.style.display = "block";
    titleElement.style.color = "#00ffff";
    taskElement.style.color = "#ffffff";
  }
}
window.showLevelUp = function(level, message) {
  const existing = document.getElementById("level-up-card");
  if (existing) existing.remove();
  const card = document.createElement("div");
  card.id = "level-up-card";
  card.style.cssText = `
        position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
        padding:30px;border-radius:18px;text-align:center;z-index:20000;
        color:white;pointer-events:none;background:rgba(0,0,0,0.7);
        border:1px solid #00ffff;backdrop-filter:blur(10px);
    `;
  card.innerHTML = `
        <h2 style="color:#00ffff;margin:0;font-size:20px;text-transform:uppercase;letter-spacing:2px;">Zona Alcançada</h2>
        <div style="font-size:60px;font-weight:bold;margin:10px 0;color:#fff;">${level}</div>
        <p style="font-size:16px;max-width:300px;line-height:1.4;margin:10px 0;">${message || ""}</p>
    `;
  document.body.appendChild(card);
  setTimeout(() => card.remove(), 5e3);
};
let joystickActive = false;
let joystickBase = null;
let joystickThumb = null;
function createVirtualJoystick() {
  const container = document.createElement("div");
  container.id = "virtual-joystick";
  container.style.cssText = `
        position: fixed; bottom: 40px; left: 40px; width: 140px; height: 140px;
        border: 5px solid rgba(0,255,255,0.5); border-radius: 50%;
        background: rgba(0,40,80,0.3); z-index: 10000; touch-action: none; display: none;
    `;
  const thumb = document.createElement("div");
  thumb.style.cssText = `
        position: absolute; width: 55px; height: 55px; background: #00ffff;
        border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%);
        box-shadow: 0 0 25px #00ffff;
    `;
  container.appendChild(thumb);
  document.body.appendChild(container);
  joystickBase = container;
  joystickThumb = thumb;
  if ("ontouchstart" in window) joystickBase.style.display = "block";
  setupJoystickEvents();
}
function setupJoystickEvents() {
  if (!joystickBase) return;
  joystickBase.addEventListener("touchstart", (e) => {
    e.preventDefault();
    joystickActive = true;
    handleJoystick(e.touches[0]);
  });
  document.addEventListener("touchmove", (e) => {
    if (joystickActive) {
      e.preventDefault();
      handleJoystick(e.touches[0]);
    }
  }, { passive: false });
  document.addEventListener("touchend", () => {
    if (!joystickActive) return;
    joystickActive = false;
    joystickThumb.style.transform = "translate(-50%, -50%)";
    window.moveInput.x = 0;
    window.moveInput.y = 0;
  });
}
function handleJoystick(touch) {
  if (!touch || !joystickBase) return;
  const rect = joystickBase.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = touch.clientX - cx;
  let dy = touch.clientY - cy;
  const dist = Math.min(55, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  dx = Math.cos(angle) * dist;
  dy = Math.sin(angle) * dist;
  joystickThumb.style.transform = `translate(${dx}px, ${dy}px)`;
  window.moveInput.x = dx / 55;
  window.moveInput.y = dy / 55;
}
const handleEnemyScore = (pts, hitPosition) => {
  score += pts;
  updateHUD();
  const levelUp = progressionManager.addScore(pts * 0.7);
  if (levelUp) {
    updateLevelHUD();
    updateEnvironmentTheme();
    progressionManager.resetLevelResources();
    syncLevelResources();
  }
};
const handlePlayerHit = () => {
  progressionManager.loseChance();
  updateResourceHUD();
};
function updateCamera() {
  if (!player.shipModel) return;
  const baseOffset = new Vector3(0, 8, 75);
  const pitchInfluence = player.shipModel.rotation.x * 0.15;
  const rollInfluence = player.shipModel.rotation.z * 0.1;
  const offset = baseOffset.clone();
  offset.y += Math.sin(pitchInfluence) * 8;
  offset.z -= Math.cos(pitchInfluence) * 8;
  offset.x += Math.sin(rollInfluence) * 6;
  const targetPos = player.shipModel.position.clone().add(offset);
  camera.position.lerp(targetPos, 0.08);
  const lookAtTarget = player.shipModel.position.clone().add(new Vector3(0, 2, -5));
  camera.lookAt(lookAtTarget);
}
function animate() {
  var _a;
  requestAnimationFrame(animate);
  const deltaTime = Math.min(clock.getDelta(), 0.1);
  if (currentState !== GAME_STATE.PLAYING) {
    renderer.render(scene, camera);
    return;
  }
  if (!isGameStarted) {
    countdown -= deltaTime;
    const display = document.getElementById("countdown-display");
    if (display) {
      const num = Math.ceil(countdown);
      display.innerText = num > 0 ? num : "";
      if (num <= 0) {
        isGameStarted = true;
        display.style.display = "none";
        const nivelInicial = progressionManager.getLevel();
        enemyManager.spawnWave(player, nivelInicial);
        updateLevelUI(nivelInicial);
        updateEnvironmentTheme(nivelInicial);
        progressionManager.resetLevelResources();
        syncLevelResources();
        if (audioInitialized) soundManager.startShipEngine();
      }
    }
    renderer.render(scene, camera);
    return;
  }
  const currentLevel = progressionManager.getLevel();
  window.currentLevel = currentLevel;
  const keyboardInput = inputManager.update();
  const input = {
    x: window.moveInput.x !== 0 ? window.moveInput.x : keyboardInput.x,
    y: window.moveInput.y !== 0 ? window.moveInput.y : keyboardInput.y
  };
  player.update(input, deltaTime, enemyManager, handlePlayerHit, handleEnemyScore);
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
  laserManager.update(deltaTime, enemyManager, handleEnemyScore, explosionManager);
  explosionManager.update(deltaTime);
  scorePopup.update(deltaTime);
  updateCamera();
  const targetLevel = Math.floor(score / 1e4) + 1;
  if (targetLevel > currentLevel) {
    progressionManager.setLevel(targetLevel);
    updateLevelHUD();
    updateEnvironmentTheme(targetLevel);
    progressionManager.resetLevelResources();
    syncLevelResources();
    if (!isBossFight) {
      enemyManager.clearAllEnemies();
      enemyManager.spawnWave(player, targetLevel);
    }
    const info = getLevelData(targetLevel);
    window.showLevelUp(targetLevel, info.title);
  }
  if (currentLevel >= 50 && boss === null && !window.__BOSS_SPAWNED_LEVELS.has(50)) {
    window.__BOSS_SPAWNED_LEVELS.add(50);
    isBossFight = true;
    console.log(`🚀 [BOSS] Spawnando Nave Mãe no nível ${currentLevel} (início no 50)`);
    boss = naveMae;
    window.__NAVE_MAE_ATIVA = boss;
    if (progressionManager.registerBoss) {
      progressionManager.registerBoss(boss);
    }
    progressionManager.activeBoss = boss;
    if (boss.ativarNave) {
      boss.ativarNave(50);
    }
  }
  if (boss) {
    boss.update(deltaTime, (_a = player.mesh) == null ? void 0 : _a.position, laserManager, explosionManager, player, enemyManager, soundManager);
    if (boss.hp <= 0 || boss.isActive === false && boss.isAlive === false) {
      console.log(`💥 [BOSS] Nave Mãe destruída no nível ${currentLevel}`);
      try {
        boss.dispose();
      } catch (e) {
      }
      boss = null;
      isBossFight = false;
      window.__NAVE_MAE_ATIVA = null;
      enemyManager.clearAllEnemies();
      enemyManager.spawnWave(player, progressionManager.getLevel());
    }
  }
  renderer.render(scene, camera);
}
function setupNexusSelector() {
  window.addEventListener("nivelAlterado", (e) => {
    const novoNivel = parseInt(e.detail.nivel);
    progressionManager.setLevel(novoNivel);
    updateLevelHUD();
    updateLevelUI(novoNivel);
    updateEnvironmentTheme(novoNivel);
    if (currentState === GAME_STATE.PLAYING) {
      if (boss) {
        try {
          boss.dispose();
        } catch (e2) {
        }
        boss = null;
      }
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
  createVirtualJoystick();
  setupNexusSelector();
}
function startGame() {
  if (currentState === GAME_STATE.PLAYING) return;
  countdown = 5;
  isGameStarted = false;
  score = 0;
  boss = null;
  isBossFight = false;
  window.__BOSS_SPAWNED_LEVELS.clear();
  const countdownDisplay = document.getElementById("countdown-display");
  if (countdownDisplay) countdownDisplay.style.display = "block";
  currentState = GAME_STATE.PLAYING;
  const overlay = document.getElementById("overlay");
  if (overlay) overlay.style.display = "none";
  const nexusSelector = document.getElementById("nexusSelector");
  if (nexusSelector) nexusSelector.style.display = "none";
  player.mesh.position.set(0, -1, 8);
  enemyManager.clearAllEnemies();
  updateHUD();
  updateLevelHUD();
}
window.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("start-btn");
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyQ") player.startBarrelRoll(-1);
    if (e.code === "KeyE") player.startBarrelRoll(1);
  });
  const btnLeft = document.getElementById("btnRollLeft");
  const btnRight = document.getElementById("btnRollRight");
  if (btnLeft) {
    btnLeft.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      player.startBarrelRoll(-1);
    });
  }
  if (btnRight) {
    btnRight.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      player.startBarrelRoll(1);
    });
  }
  const handleStart = async (e) => {
    if (e) e.preventDefault();
    if (!audioInitialized) {
      await soundManager.init();
      audioInitialized = true;
    }
    soundManager.startShipEngine();
    startGame();
  };
  if (startBtn) {
    startBtn.addEventListener("click", handleStart);
    startBtn.addEventListener("touchstart", handleStart, { passive: false });
  }
  const btnShoot = document.getElementById("btnShoot");
  if (btnShoot) {
    btnShoot.addEventListener("mousedown", () => player.isFiring = true);
    btnShoot.addEventListener("mouseup", () => player.isFiring = false);
    btnShoot.addEventListener("touchstart", (e) => {
      e.preventDefault();
      player.isFiring = true;
    });
    btnShoot.addEventListener("touchend", (e) => {
      e.preventDefault();
      player.isFiring = false;
    });
  }
  const btnMissile = document.getElementById("btnMissile");
  if (btnMissile) {
    const fire = (e) => {
      if (e) e.preventDefault();
      if (player.fireMissile()) updateResourceHUD();
    };
    btnMissile.addEventListener("pointerdown", fire);
    btnMissile.addEventListener("click", fire);
    btnMissile.addEventListener("touchstart", fire, { passive: false });
  }
  const btnPause = document.getElementById("btnPause");
  if (btnPause) {
    btnPause.addEventListener("click", () => {
      currentState = currentState === GAME_STATE.PLAYING ? GAME_STATE.PAUSED : GAME_STATE.PLAYING;
    });
    btnPause.addEventListener("touchstart", (e) => {
      e.preventDefault();
      currentState = currentState === GAME_STATE.PLAYING ? GAME_STATE.PAUSED : GAME_STATE.PLAYING;
    });
  }
  const btnPDC = document.getElementById("btnPDC");
  if (btnPDC) {
    btnPDC.addEventListener("click", (e) => {
      e.preventDefault();
      const active = player.togglePDC();
      e.target.style.opacity = active ? "1" : "0.5";
    });
  }
  syncLevelResources();
  initGame().then(() => animate());
});
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
