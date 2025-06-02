// src/core/Game.ts
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MenuManager } from './MenuManager';
import { ModelsLoader, CharacterData, KitData } from '../utils/loadModels';
import { AIManager } from '../ai/AIManager';
import { EventEmitter } from '../utils/EventEmitter';
import { NotificationManager } from './NotificationManager';
import { ErrorManager } from './ErrorManager';

interface GameState {
isStarted: boolean;
isPaused: boolean;
score: number;
health: number;
ammo: number;
selectedCharacter: string | null;
selectedKit: string | null;
highScore: number;
currentUser: string;
lastPlayTime: string;
level: number;
currentRegion: string;
}

interface GameResources {
scene: THREE.Scene;
camera: THREE.PerspectiveCamera;
renderer: THREE.WebGLRenderer;
controls: OrbitControls;
}

export class Game extends EventEmitter {
private resources: GameResources;
private modelsLoader: ModelsLoader;
private aiManager: AIManager;
private menuManager: MenuManager | null = null;
private lastTime: number = 0;
private readonly targetFPS = 60;
private readonly frameInterval = 1000 / this.targetFPS;
private animationFrameId: number | null = null;
private platform: THREE.Mesh;
private lastFrameTime: number = 0;
private frameCount: number = 0;
private currentFPS: number = 0;
private canvas: HTMLCanvasElement;

private gameState: GameState = {
isStarted: false,
isPaused: false,
score: 0,
health: 100,
ammo: 30,
selectedCharacter: null,
selectedKit: null,
highScore: 0,
currentUser: 'MyDemir',
lastPlayTime: '2025-05-27 21:10:00',
level: 1,
currentRegion: 'default'
};

private ui = {
score: document.getElementById('score') as HTMLElement,
health: document.getElementById('health') as HTMLElement,
ammo: document.getElementById('ammo') as HTMLElement,
uiContainer: document.getElementById('ui') as HTMLElement,
loadingScreen: document.getElementById('loading-screen') as HTMLElement,
finalScore: document.getElementById('final-score') as HTMLElement,
highScore: document.getElementById('high-score') as HTMLElement,
crosshair: document.querySelector('.crosshair') as HTMLElement,
taskContainer: document.getElementById('task') as HTMLElement
};

private player: THREE.Object3D | null = null;
private weapon: THREE.Object3D | null = null;
private moveState = {
forward: false,
backward: false,
left: false,
right: false,
jump: false,
sprint: false,
mouseX: 0,
mouseY: 0
};

private readonly MOUSE_SENSITIVITY = 0.002;
private readonly CAMERA_MIN_Y = -Math.PI / 3; // -60 derece
private readonly CAMERA_MAX_Y = Math.PI / 3;  // 60 derece
private cameraRotation = {
x: 0,  // Yatay rotasyon (sağ-sol)
y: 0   // Dikey rotasyon (yukarı-aşağı)
};

private movementSpeed: number = 5; // readonly kaldırıldı, değişken yapıldı
private readonly ROTATION_SPEED = 2;
private readonly raycaster = new THREE.Raycaster();
private readonly moveDirection = new THREE.Vector3();
private abilityCooldowns: Map<string, number> = new Map();
private characterStats: CharacterData['stats'] | null = null;
private kitStats: KitData['stats'] | null = null;

private readonly CAMERA_NORMAL_OFFSET = new THREE.Vector3(0, 10, 15); // Daha yakın normal görüş
private readonly CAMERA_ABILITY_OFFSET = new THREE.Vector3(0, 8, 10); // Yetenek kullanırken daha yakın
private readonly CAMERA_LERP_SPEED = 0.1;
private isAbilityActive: boolean = false;

// Karakter ve silah pozisyon ayarları için sabitler
private readonly WEAPON_OFFSET = {
  x: 0.3,  // Sağa/sola offset (daha küçük)
  y: 1.0,  // Yukarı offset (daha küçük)
  z: 0.2   // İleri/geri offset (daha küçük)
};

private readonly BASE_MOVEMENT_SPEED = 3.0; // Temel hareket hızı (düşürüldü)
private readonly SPRINT_MULTIPLIER = 1.5;   // Koşu çarpanı
private readonly ROTATION_SMOOTHNESS = 0.1;  // Dönüş yumuşaklığı

constructor(canvas: HTMLCanvasElement) {
super();
console.log("Game sınıfı başlatılıyor");

this.canvas = canvas;
// Pointer kontrollerini başlat
this.initializePointerControls(canvas);

this.resources = this.initializeResources(canvas);
this.modelsLoader = new ModelsLoader(this.resources.scene);
this.aiManager = new AIManager(this.modelsLoader, this.resources.scene);

// Şehir modellerini yükle
this.modelsLoader.loadCityModels().then(() => {
this.platform = this.setupWorld();
this.loadGameState();
this.setCurrentDateTime();

document.addEventListener('keydown', this.onKeyDown.bind(this));
document.addEventListener('keyup', this.onKeyUp.bind(this));
window.addEventListener('resize', this.onWindowResize.bind(this));

this.initializeGame();
}).catch(error => {
console.error('Şehir modelleri yüklenemedi:', error);
NotificationManager.getInstance().show('Şehir modelleri yüklenemedi!', 'error');
});
}

private initializePointerControls(canvas: HTMLCanvasElement): void {
  // Pointer Lock API için event listener'lar
  canvas.addEventListener('click', () => {
    if (!document.pointerLockElement) {
      canvas.requestPointerLock().catch(error => {
        console.warn('Fare kilidi etkinleştirilemedi:', error);
        // Fare kilidi olmasa da oyunu başlat
        if (!this.gameState.isStarted) {
          this.gameState.isStarted = true;
          this.gameState.isPaused = false;
          this.updateUI();
          this.ui.uiContainer.classList.remove('hidden');
          if (this.menuManager) {
            this.menuManager.showMenu('none');
          }
        }
      });
    }
  });

  // Pointer Lock değişikliklerini dinle
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) {
      document.addEventListener('mousemove', this.onMouseMove.bind(this));
      canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
      canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
      
      // Oyunu başlat
      if (!this.gameState.isStarted) {
        this.gameState.isStarted = true;
        this.gameState.isPaused = false;
        this.updateUI();
        this.ui.uiContainer.classList.remove('hidden');
        if (this.menuManager) {
          this.menuManager.showMenu('none');
        }
      }
    } else {
      document.removeEventListener('mousemove', this.onMouseMove.bind(this));
      canvas.removeEventListener('mousedown', this.onMouseDown.bind(this));
      canvas.removeEventListener('mouseup', this.onMouseUp.bind(this));
      if (this.gameState.isStarted && !this.gameState.isPaused) {
        this.togglePause();
      }
    }
  });

  // Pointer Lock hatalarını dinle
  document.addEventListener('pointerlockerror', () => {
    console.warn('Fare kilidi hatası oluştu');
    NotificationManager.getInstance().show('Fare kontrolü etkinleştirilemedi!', 'warning');
    // Fare kilidi olmasa da oyunu başlat
    if (!this.gameState.isStarted) {
      this.gameState.isStarted = true;
      this.gameState.isPaused = false;
      this.updateUI();
      this.ui.uiContainer.classList.remove('hidden');
      if (this.menuManager) {
        this.menuManager.showMenu('none');
      }
    }
  });
}

private initializeResources(canvas: HTMLCanvasElement): GameResources {
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5);

const camera = new THREE.PerspectiveCamera(
60,
window.innerWidth / window.innerHeight,
0.1,
2000
);
camera.position.set(0, 50, 100);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({
canvas,
antialias: true,
powerPreference: 'high-performance',
precision: 'mediump',
logarithmicDepthBuffer: true
});

// Renderer optimizasyonları
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxDistance = 200;
controls.minDistance = 5;
controls.maxPolarAngle = Math.PI / 2;
controls.target.set(0, 1, 0);

return { scene, camera, renderer, controls };
}

   
private async initializeGame(): Promise<void> {
this.ui.uiContainer.classList.add('hidden');

try {
await this.modelsLoader.initialize();
await this.modelsLoader.loadCityModels();
this.menuManager = new MenuManager(this.modelsLoader);
this.setupMenuListeners();
if (this.ui.loadingScreen) {
this.ui.loadingScreen.classList.add('fade-out');
await new Promise(resolve => setTimeout(resolve, 500));
this.ui.loadingScreen.classList.add('hidden');
}
this.menuManager.showMenu('main');
this.animate();
NotificationManager.getInstance().show('Oyun yüklendi!', 'success');
} catch (error) {
console.error('Oyun başlatılamadı:', error);
NotificationManager.getInstance().show('Oyun başlatılamadı!', 'error');
}
}

private setCurrentDateTime(): void {
const now = new Date();
const year = now.getUTCFullYear();
const month = String(now.getUTCMonth() + 1).padStart(2, '0');
const day = String(now.getUTCDate()).padStart(2, '0');
const hours = String(now.getUTCHours() + 3).padStart(2, '0');
const minutes = String(now.getUTCMinutes()).padStart(2, '0');
const seconds = String(now.getUTCSeconds()).padStart(2, '0');
this.gameState.lastPlayTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

private loadGameState(): void {
const savedState = localStorage.getItem('gameState');
if (savedState) {
const parsedState = JSON.parse(savedState);
this.gameState = { ...this.gameState, ...parsedState };
}

const savedHighScore = localStorage.getItem('highScore');
if (savedHighScore) {
this.gameState.highScore = parseInt(savedHighScore);
}
}

private saveGameState(): void {
const stateToSave = {
highScore: this.gameState.highScore,
lastPlayTime: this.gameState.lastPlayTime,
selectedCharacter: this.gameState.selectedCharacter,
selectedKit: this.gameState.selectedKit,
level: this.gameState.level,
currentRegion: this.gameState.currentRegion
};
localStorage.setItem('gameState', JSON.stringify(stateToSave));
localStorage.setItem('highScore', this.gameState.highScore.toString());
}

private setupMenuListeners(): void {
if (this.menuManager) {
this.menuManager.on('startGame', () => {
console.log("Oyun başlatılıyor");
const selectedCharacter = this.menuManager!.getSelectedCharacterId();
const selectedKit = this.menuManager!.getSelectedKit();
if (!selectedCharacter || !selectedKit) {
NotificationManager.getInstance().show('Lütfen bir karakter ve silah seçin!', 'error');
this.menuManager!.showMenu('character');
return;
}
this.startGame();
});

this.menuManager.on('characterSelected', (characterId: string, kitId: string) => {
console.log(`Karakter ve silah seçildi: ${characterId}, ${kitId}`);
this.gameState.selectedCharacter = characterId;
this.gameState.selectedKit = kitId;
this.saveGameState();
});

this.menuManager.on('resumeGame', () => {
console.log("Oyun devam ettiriliyor");
this.resumeGame();
});

this.menuManager.on('restartGame', () => {
console.log("Oyun yeniden başlatılıyor");
this.restartGame();
});

this.menuManager.on('exitToMain', () => {
console.log("Ana menüye dönülüyor");
this.exitToMain();
});
} else {
console.error("MenuManager başlatılmadı!");
}
}

private animate(currentTime: number = 0): void {
  this.animationFrameId = requestAnimationFrame((time) => this.animate(time));

  // FPS kontrolü
  const deltaTime = currentTime - this.lastFrameTime;
  if (deltaTime < this.frameInterval) return;

  // FPS sayacı
  this.frameCount++;
  if (currentTime > this.lastFrameTime + 1000) {
    this.currentFPS = this.frameCount;
    this.frameCount = 0;
    this.lastFrameTime = currentTime;
  }

  if (this.gameState.isStarted && !this.gameState.isPaused) {
    // Performans optimizasyonu için RAF'ı throttle et
    if (this.lastTime === 0) {
      this.lastTime = currentTime;
    }
    const elapsed = currentTime - this.lastTime;
    
    if (elapsed > this.frameInterval) {
      this.lastTime = currentTime - (elapsed % this.frameInterval);
      
      // Oyun güncellemeleri
      this.updateGame(elapsed / 1000);
      this.updateCamera();
      
      // Render işlemi
      this.resources.renderer.render(this.resources.scene, this.resources.camera);
    }
  }
}

private updateGame(deltaTime: number): void {
// Karakter ve düşman güncellemeleri
this.updatePlayerMovement(deltaTime);
this.updateEnemies(deltaTime);
this.updateAbilities(deltaTime);
this.checkCollisions();
}

private updatePlayerMovement(deltaTime: number): void {
  if (!this.player) return;

  // Hareket vektörünü sıfırla
  this.moveDirection.set(0, 0, 0);

  // Kamera yönünü baz alarak hareket yönünü hesapla
  const cameraDirection = new THREE.Vector3();
  this.resources.camera.getWorldDirection(cameraDirection);
  cameraDirection.y = 0; // Y eksenini sıfırla (yerçekimi için)
  cameraDirection.normalize();

  // Kameraya göre sağ vektörünü hesapla
  const rightVector = new THREE.Vector3();
  rightVector.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));

  // Hareket yönünü belirle
  if (this.moveState.forward) {
    this.moveDirection.add(cameraDirection);
  }
  if (this.moveState.backward) {
    this.moveDirection.sub(cameraDirection);
  }
  if (this.moveState.left) {
    this.moveDirection.sub(rightVector);
  }
  if (this.moveState.right) {
    this.moveDirection.add(rightVector);
  }

  // Hareket varsa uygula
  if (this.moveDirection.length() > 0) {
    // Hareket vektörünü normalize et
    this.moveDirection.normalize();
    
    // Hızı hesapla
    let baseSpeed = this.BASE_MOVEMENT_SPEED * (this.characterStats?.speed || 50) / 50;
    if (this.moveState.sprint) {
      baseSpeed *= this.SPRINT_MULTIPLIER;
    }
    const finalSpeed = baseSpeed * deltaTime;
    
    this.moveDirection.multiplyScalar(finalSpeed);

    // Karakterin pozisyonunu güncelle
    this.player.position.add(this.moveDirection);

    // Silahı karakterle birlikte hareket ettir
    if (this.weapon) {
      // Silahı karakterin pozisyonuna ve rotasyonuna bağla
      this.weapon.position.copy(this.player.position);
      this.weapon.rotation.copy(this.player.rotation);
      
      // Silah offset'ini uygula
      const offsetVector = new THREE.Vector3(
        this.WEAPON_OFFSET.x,
        this.WEAPON_OFFSET.y,
        this.WEAPON_OFFSET.z
      ).applyQuaternion(this.player.quaternion);
      
      this.weapon.position.add(offsetVector);
    }
  }

  // Kamerayı güncelle
  this.updateCamera();
}

private checkCollisions(): void {
if (!this.player) return;

const playerBoundingBox = new THREE.Box3().setFromObject(this.player);
  
// Düşmanlarla çarpışma kontrolü
this.aiManager.getEnemies().forEach(enemy => {
const enemyBoundingBox = new THREE.Box3().setFromObject(enemy.model);
if (playerBoundingBox.intersectsBox(enemyBoundingBox)) {
this.gameState.health -= enemy.damage * 0.1;
if (this.gameState.health <= 0) {
this.endGame();
}
}
});
}

private cleanup(): void {
  // Event listener'ları temizle
  const canvas = this.resources.renderer.domElement;
  document.removeEventListener('keydown', this.onKeyDown.bind(this));
  document.removeEventListener('keyup', this.onKeyUp.bind(this));
  document.removeEventListener('mousemove', this.onMouseMove.bind(this));
  canvas.removeEventListener('mousedown', this.onMouseDown.bind(this));
  canvas.removeEventListener('mouseup', this.onMouseUp.bind(this));
  window.removeEventListener('resize', this.onWindowResize.bind(this));

  // Animation frame'i iptal et
  if (this.animationFrameId !== null) {
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }

  // Pointer Lock'u kaldır
  if (document.pointerLockElement === canvas) {
    document.exitPointerLock();
  }

  // Diğer temizlik işlemleri...
  while (this.resources.scene.children.length > 0) {
    const object = this.resources.scene.children[0];
    this.resources.scene.remove(object);
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      if (Array.isArray(object.material)) {
        object.material.forEach(material => material.dispose());
      } else {
        object.material.dispose();
      }
    }
  }

  this.resources.renderer.dispose();
  this.resources.controls.dispose();
  this.modelsLoader.cleanup();
  if (this.menuManager) this.menuManager.cleanup();

  this.gameState.isStarted = false;
  this.gameState.isPaused = false;
  this.gameState.score = 0;
  this.gameState.health = 100;
  this.gameState.ammo = 30;
  this.gameState.level = 1;
  this.player = null;
  this.weapon = null;
  this.characterStats = null;
  this.kitStats = null;
  this.abilityCooldowns.clear();
  this.saveGameState();
}

private setupWorld(): THREE.Mesh {
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
this.resources.scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(50, 100, 50);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 500;
dirLight.shadow.camera.left = -250;
dirLight.shadow.camera.right = 250;
dirLight.shadow.camera.top = 250;
dirLight.shadow.camera.bottom = -250;
this.resources.scene.add(dirLight);

const platform = new THREE.Mesh(
new THREE.BoxGeometry(500, 0.5, 500),
new THREE.MeshStandardMaterial({
color: 0x808080,
roughness: 0.7,
metalness: 0.1
})
);
platform.receiveShadow = true;
platform.position.y = 0;
this.resources.scene.add(platform);

const cityData = this.modelsLoader.getCityData();
if (!cityData.buildings.length && !cityData.roads.length && !cityData.props.length) {
console.error('Şehir verileri eksik!');
NotificationManager.getInstance().show('Şehir verileri eksik, oyun başlatılamadı!', 'error');
throw new Error('Şehir verileri yüklenemedi');
}

cityData.buildings.forEach(data => {
const model = this.modelsLoader.getModel(data.id)?.scene.clone();
if (model) {
model.position.set(Math.random() * 500 - 250, 0, Math.random() * 500 - 250);
model.scale.setScalar(3);
model.userData = { type: 'building' };
this.resources.scene.add(model);
this.aiManager.getStructures().push(model);
} else {
console.warn(`Bina modeli eksik: ${data.id}`);
NotificationManager.getInstance().show(`Bina yüklenemedi: ${data.name}`, 'warning');
}
});

cityData.roads.forEach(data => {
const model = this.modelsLoader.getModel(data.id)?.scene.clone();
if (model) {
model.position.set(Math.random() * 500 - 250, 0, Math.random() * 500 - 250);
model.scale.setScalar(3);
model.userData = { type: 'road' };
this.resources.scene.add(model);
} else {
console.warn(`Yol modeli eksik: ${data.id}`);
}
});

cityData.props.forEach(data => {
const model = this.modelsLoader.getModel(data.id)?.scene.clone();
if (model) {
model.position.set(Math.random() * 500 - 250, 0, Math.random() * 500 - 250);
model.scale.setScalar(3);
model.userData = { type: 'prop', effect: data.effect, effectDescription: data.effectDescription };
this.resources.scene.add(model);
} else {
console.warn(`Prop modeli eksik: ${data.id}`);
}
});

return platform;
}

private onWindowResize(): void {
this.resources.camera.aspect = window.innerWidth / window.innerHeight;
this.resources.camera.updateProjectionMatrix();
this.resources.renderer.setSize(window.innerWidth, window.innerHeight);
}

private onKeyDown(event: KeyboardEvent): void {
  if (!this.gameState.isStarted) return;

  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      this.moveState.forward = true;
      break;
    case 'KeyS':
    case 'ArrowDown':
      this.moveState.backward = true;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      this.moveState.left = true;
      break;
    case 'KeyD':
    case 'ArrowRight':
      this.moveState.right = true;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      this.moveState.sprint = true;
      break;
    case 'Space':
      this.moveState.jump = true;
      break;
    case 'Escape':
      this.togglePause();
      break;
    case 'KeyE':
      if (this.characterStats) {
        this.activateAbility(this.characterStats.ability);
      }
      break;
  }
}

private onKeyUp(event: KeyboardEvent): void {
  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      this.moveState.forward = false;
      break;
    case 'KeyS':
    case 'ArrowDown':
      this.moveState.backward = false;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      this.moveState.left = false;
      break;
    case 'KeyD':
    case 'ArrowRight':
      this.moveState.right = false;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      this.moveState.sprint = false;
      break;
    case 'Space':
      this.moveState.jump = false;
      break;
  }
}

private onMouseDown(event: MouseEvent): void {
if (!this.gameState.isStarted || this.gameState.isPaused) return;
if (event.button === 0) {
this.shoot();
}
}

private onMouseUp(event: MouseEvent): void {}

private onMouseMove(event: MouseEvent): void {
  if (!this.gameState.isStarted || this.gameState.isPaused) return;
  if (document.pointerLockElement === null) return;

  try {
    // Fare hareketini al
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    // Yatay rotasyon (sağ-sol)
    this.cameraRotation.x -= movementX * this.MOUSE_SENSITIVITY;

    // Dikey rotasyon (yukarı-aşağı) - sınırlandırılmış
    this.cameraRotation.y = Math.max(
      this.CAMERA_MIN_Y,
      Math.min(this.CAMERA_MAX_Y, this.cameraRotation.y - movementY * this.MOUSE_SENSITIVITY)
    );

    // Karakteri ve silahı döndür
    if (this.player) {
      this.player.rotation.y = this.cameraRotation.x;
      
      if (this.weapon) {
        // Silahı karakterle aynı yöne döndür
        this.weapon.rotation.y = this.cameraRotation.x;
        
        // Silahı karakterin pozisyonuna göre offset ile yerleştir
        const weaponOffset = new THREE.Vector3(
          this.WEAPON_OFFSET.x,
          this.WEAPON_OFFSET.y,
          this.WEAPON_OFFSET.z
        ).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraRotation.x);
        
        this.weapon.position.copy(this.player.position).add(weaponOffset);
      }
    }
  } catch (error) {
    console.warn('Fare hareketi işlenirken hata oluştu:', error);
  }
}

private updateUI(): void {
  try {
    // Skor, can ve mermi güncellemesi
    if (this.ui.score) this.ui.score.textContent = `Skor: ${this.gameState.score}`;
    if (this.ui.health) this.ui.health.textContent = `Can: ${Math.round(this.gameState.health)}%`;
    if (this.ui.ammo) this.ui.ammo.textContent = `Mermi: ${this.gameState.ammo}`;

    // Can durumuna göre renk değişimi
    if (this.ui.health) {
      const healthPercent = this.gameState.health;
      if (healthPercent <= 25) {
        this.ui.health.style.color = '#ff0000'; // Kritik seviye - kırmızı
        this.ui.health.style.animation = 'pulse 1s infinite';
      } else if (healthPercent <= 50) {
        this.ui.health.style.color = '#ffa500'; // Tehlike seviyesi - turuncu
        this.ui.health.style.animation = 'none';
      } else {
        this.ui.health.style.color = '#ffffff'; // Normal seviye - beyaz
        this.ui.health.style.animation = 'none';
      }
    }

    // Mermi durumuna göre renk değişimi
    if (this.ui.ammo) {
      if (this.gameState.ammo <= 5) {
        this.ui.ammo.style.color = '#ff0000'; // Az mermi - kırmızı
        this.ui.ammo.style.animation = 'pulse 1s infinite';
      } else if (this.gameState.ammo <= 10) {
        this.ui.ammo.style.color = '#ffa500'; // Düşük mermi - turuncu
        this.ui.ammo.style.animation = 'none';
      } else {
        this.ui.ammo.style.color = '#ffffff'; // Normal seviye - beyaz
        this.ui.ammo.style.animation = 'none';
      }
    }

    // Skor animasyonu
    if (this.ui.score && this.gameState.score > 0) {
      this.ui.score.classList.add('score-updated');
      setTimeout(() => {
        if (this.ui.score) {
          this.ui.score.classList.remove('score-updated');
        }
      }, 300);
    }

    // Oyun sonu skorları
    if (this.ui.finalScore) this.ui.finalScore.textContent = `Son Skor: ${this.gameState.score}`;
    if (this.ui.highScore) this.ui.highScore.textContent = `En Yüksek Skor: ${this.gameState.highScore}`;

    // Crosshair görünürlüğü
    if (this.ui.crosshair) {
      if (this.gameState.isStarted && !this.gameState.isPaused) {
        this.ui.crosshair.style.display = 'block';
      } else {
        this.ui.crosshair.style.display = 'none';
      }
    }
  } catch (error) {
    console.warn('UI güncellenirken hata oluştu:', error);
  }
}

private spawnEnemies(): void {
  // Düşman oluşturma mantığını basitleştir
  if (Math.random() < 0.01 && this.aiManager.getEnemies().length < 10) {
    const spawnPosition = new THREE.Vector3(
      Math.random() * 100 - 50,
      0,
      Math.random() * 100 - 50
    );
    
    this.aiManager.spawnEnemy(
      this.gameState.level,
      this.aiManager.getEnemies().length,
      0.5,
      {
        health: this.gameState.health,
        power: this.characterStats?.power || 50
      }
    );
  }
}

private updateEnemies(deltaTime: number): void {
  if (!this.player) return;
  
  const enemies = this.aiManager.getEnemies();
  enemies.forEach(enemy => {
    if (!enemy.model) return;

    const direction = new THREE.Vector3()
      .subVectors(this.player!.position, enemy.model.position)
      .normalize();

    // Düşman hızını ayarla
    const speed = enemy.speed * deltaTime;
    enemy.model.position.add(direction.multiplyScalar(speed));

    // Düşmanın oyuncuya bakmasını sağla
    enemy.model.lookAt(this.player!.position);
  });
}

private updateAbilities(deltaTime: number): void {
this.aiManager.getEnemies().forEach(enemy => {
if (enemy.model.position.distanceTo(this.player!.position) < 1) {
const damage = enemy.damage * deltaTime;
this.gameState.health -= damage;
if (this.gameState.health <= 0) {
this.endGame();
}
}
});
}

public async startGame(): Promise<void> {
  try {
    if (!this.gameState.isStarted) {
      console.log('Oyun başlatılıyor...');

      if (!this.gameState.selectedCharacter || !this.gameState.selectedKit) {
        throw new Error('Karakter veya silah seçilmemiş');
      }

      // Menüleri gizle
      if (this.menuManager) {
        this.menuManager.showMenu('none');
      }

      // UI'ı görünür yap
      this.ui.uiContainer.classList.remove('hidden');
      this.ui.loadingScreen.classList.add('hidden');

      // Karakter ve silah modellerini yükle
      await Promise.all([
        this.modelsLoader.loadCharacterModels([this.gameState.selectedCharacter]),
        this.modelsLoader.loadKitModels([this.gameState.selectedKit])
      ]);

      // Karakteri yükle ve ayarla
      const characterModel = this.modelsLoader.getModel(this.gameState.selectedCharacter);
      if (!characterModel) {
        throw new Error('Karakter modeli yüklenemedi');
      }

      this.player = characterModel.scene.clone();
      this.player.position.set(0, 2, 0);
      this.player.scale.set(3, 3, 3);
      this.player.name = 'player';
      this.player.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.resources.scene.add(this.player);

      // Silahı yükle ve ayarla
      const kitModel = this.modelsLoader.getModel(this.gameState.selectedKit);
      if (!kitModel) {
        throw new Error('Silah modeli yüklenmedi');
      }

      this.weapon = kitModel.scene.clone();
      this.weapon.scale.set(0.5, 0.5, 0.5);
      this.weapon.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.resources.scene.add(this.weapon);
      
      // Harita üretimi
      await this.aiManager.generateMap(this.gameState.level, this.gameState.currentRegion);
      
      // Oyun durumunu güncelle
      this.gameState.isStarted = true;
      this.gameState.isPaused = false;
      
      // UI'ı güncelle
      this.updateUI();
      
      // Kamera ayarlarını sıfırla
      this.cameraRotation = { x: 0, y: 0 };
      this.updateCamera();
      
      // Pointer lock'u etkinleştir
      const canvas = this.resources.renderer.domElement;
      canvas.requestPointerLock().catch(error => {
        console.warn('Fare kilidi etkinleştirilemedi:', error);
        NotificationManager.getInstance().show('Fare kontrolü etkinleştirilemedi!', 'warning');
      });
      
      // İlk görevi oluştur
      this.aiManager.generateDynamicTask(this.gameState.level);
      
      console.log('Oyun başlatıldı!');
      NotificationManager.getInstance().show('Oyun başladı!', 'success');
    }
  } catch (error) {
    console.error('Oyun başlatma hatası:', error);
    NotificationManager.getInstance().show('Oyun başlatılamadı!', 'error');
    throw error;
  }
}

private shoot(): void {
  if (this.gameState.ammo <= 0) {
    NotificationManager.getInstance().show('Mermi bitti!', 'error');
    this.ui.ammo.style.animation = 'shake 0.5s';
    return;
  }

  this.gameState.ammo--;
  this.updateUI(); // Her atışta UI'ı güncelle

  if (this.gameState.ammo <= 5) {
    NotificationManager.getInstance().show('Mermi azalıyor!', 'warning');
  }

  let damage = this.kitStats?.damage || 40;
  let effect = this.kitStats?.effect || 'none';

  const bullet = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffff00 })
  );
  bullet.position.copy(this.player!.position);
  bullet.position.y += 1;
  this.resources.scene.add(bullet);
  setTimeout(() => this.resources.scene.remove(bullet), 500);

  this.emit('weaponFired', this.gameState.ammo);

  if (this.player && this.weapon) {
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.weapon.quaternion);
    this.raycaster.set(this.player.position, direction);
    const intersects = this.raycaster.intersectObjects(this.aiManager.getEnemies().map(e => e.model));

    if (intersects.length > 0) {
      const hitEnemy = intersects[0].object;
      const enemy = this.aiManager.getEnemies().find(e => e.model === hitEnemy);
      if (enemy) {
        enemy.health -= damage;
        if (effect === 'slow') {
          enemy.speed *= 0.7;
          setTimeout(() => enemy.speed = enemy.type === 'fast' ? 80 : 50, 1000);
        } else if (effect === 'area') {
          this.createAreaEffect(1, damage / 2, 0xffff00);
        } else if (effect === 'rapid' && !this.abilityCooldowns.get('rapidFire')) {
          this.kitStats!.fireRate *= 1.5;
          const now = Date.now();
          setTimeout(() => this.kitStats!.fireRate /= 1.5, 3000);
          this.abilityCooldowns.set('rapidFire', now + 10000);
        }

        if (enemy.health <= 0) {
          this.gameState.score += 10;
          this.aiManager.updateTaskProgress(true);
          this.resources.scene.remove(hitEnemy);
          this.aiManager.getEnemies().splice(this.aiManager.getEnemies().indexOf(enemy), 1);
          const task = this.aiManager.getCurrentTask();
          if (task && task.progress >= task.target) {
            this.gameState.score += task.reward;
            NotificationManager.getInstance().show('Görev tamamlandı!', 'success');
            this.aiManager.generateDynamicTask(this.gameState.level);
          }
        }
        this.emit('scoreUpdate', 10);
      }
    }
  }
}

private togglePause(): void {
  this.gameState.isPaused = !this.gameState.isPaused;
  
  if (this.gameState.isPaused) {
    this.ui.crosshair.style.display = 'none';
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    NotificationManager.getInstance().show('Oyun duraklatıldı', 'warning');
    if (this.menuManager) {
      this.menuManager.showMenu('pause');
    }
  } else {
    this.ui.crosshair.style.display = 'block';
    NotificationManager.getInstance().show('Oyun devam ediyor', 'success');
    if (this.menuManager) {
      this.menuManager.showMenu('none');
      const canvas = this.resources.renderer.domElement;
      canvas.requestPointerLock().catch(error => {
        console.warn('Fare kilidi yeniden etkinleştirilemedi:', error);
      });
    }
  }
  
  this.updateUI();
}

private resumeGame(): void {
this.gameState.isPaused = false;
NotificationManager.getInstance().show('Oyun devam ediyor', 'success');
this.menuManager?.showMenu('none');
}

private restartGame(): void {
  console.log("Oyun yeniden başlatılıyor");

  // Oyun durumunu sıfırla ama karakteri ve silahı koru
  const savedCharacter = this.gameState.selectedCharacter;
  const savedKit = this.gameState.selectedKit;
  
  // Sahneyi temizle
  while (this.resources.scene.children.length > 0) {
    const object = this.resources.scene.children[0];
    this.resources.scene.remove(object);
  }

  // Kamerayı sıfırla
  this.resources.camera.position.set(0, 50, 100);
  this.resources.camera.lookAt(0, 1, 0);

  // Kontrolleri sıfırla
  this.resources.controls.reset();

  // Oyun durumunu sıfırla
  this.gameState = {
    isStarted: false,
    isPaused: false,
    score: 0,
    health: 100,
    ammo: 30,
    selectedCharacter: savedCharacter,
    selectedKit: savedKit,
    highScore: this.gameState.highScore,
    currentUser: this.gameState.currentUser,
    lastPlayTime: this.gameState.lastPlayTime,
    level: 1,
    currentRegion: 'default'
  };

  // ModelsLoader'ı yeniden başlat
  this.modelsLoader = new ModelsLoader(this.resources.scene);
  
  // Dünyayı yeniden kur ve modelleri yükle
  Promise.all([
    this.modelsLoader.loadCityModels(),
    this.modelsLoader.loadCharacterModels([savedCharacter!]),
    this.modelsLoader.loadKitModels([savedKit!])
  ]).then(() => {
    // Dünyayı kur
    this.platform = this.setupWorld();
    
    // Karakteri ve silahı yeniden yükle
    const characterModel = this.modelsLoader.getModel(savedCharacter!);
    const kitModel = this.modelsLoader.getModel(savedKit!);

    if (characterModel && kitModel) {
      // Karakteri ayarla
      this.player = characterModel.scene.clone();
      this.player.position.set(0, 2, 0);
      this.player.scale.set(3, 3, 3);
      this.player.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.resources.scene.add(this.player);

      // Silahı ayarla
      this.weapon = kitModel.scene.clone();
      this.weapon.scale.set(0.5, 0.5, 0.5);
      this.weapon.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.resources.scene.add(this.weapon);

      // Oyunu başlat
      this.gameState.isStarted = true;
      this.gameState.isPaused = false;
      this.ui.uiContainer.classList.remove('hidden');

      // Kamera rotasyonlarını sıfırla
      this.cameraRotation = { x: 0, y: 0 };
      
      // Kamerayı karaktere odakla
      this.updateCamera();

      // AI görevlerini yeniden oluştur
      this.aiManager.generateDynamicTask(this.gameState.level);

      NotificationManager.getInstance().show('Oyun yeniden başlatıldı!', 'success');
    }
  }).catch(error => {
    console.error('Model yükleme hatası:', error);
    NotificationManager.getInstance().show('Oyun yeniden başlatılamadı!', 'error');
  });
}

private endGame(): void {
this.gameState.isStarted = false;
if (this.gameState.score > this.gameState.highScore) {
this.gameState.highScore = this.gameState.score;
this.saveGameState();
}
this.updateUI();
this.menuManager?.showMenu('gameOver');
}

private exitToMain(): void {
console.log("Ana menüye dönülüyor");
this.gameState.isStarted = false;
this.gameState.isPaused = false;
this.ui.uiContainer.classList.add('hidden');
if (this.menuManager) {
this.menuManager.showMenu('main');
} else {
console.error("MenuManager mevcut değil!");
NotificationManager.getInstance().show('Ana menüye geçiş başarısız!', 'error');
}
}

private activateAbility(ability: string): void {
  const now = Date.now();
  const cooldown = this.abilityCooldowns.get(ability) || 0;
  if (now < cooldown) return;

  if (!this.player || !this.characterStats) return;

  // Yetenek kullanımı başladığında kamerayı yakınlaştır
  this.isAbilityActive = true;
  
  switch (ability) {
    case 'invisibility':
      this.setOpacity(this.player, 0.2);
      setTimeout(() => {
        if (this.player) {
          this.setOpacity(this.player, 1.0);
          this.isAbilityActive = false; // Yetenek bittiğinde kamerayı normale döndür
        }
      }, 3000);
      this.abilityCooldowns.set(ability, now + 10000);
      break;

    case 'dash':
      const direction = this.player.getWorldDirection(new THREE.Vector3());
      this.player.position.add(direction.multiplyScalar(5));
      setTimeout(() => {
        this.isAbilityActive = false;
      }, 1000);
      this.abilityCooldowns.set(ability, now + 6000);
      break;

    case 'shield':
      this.gameState.health += 50;
      const shieldEffect = new THREE.Mesh(
        new THREE.SphereGeometry(2, 32, 32),
        new THREE.MeshBasicMaterial({
          color: 0x00ff00,
          transparent: true,
          opacity: 0.3
        })
      );
      shieldEffect.position.copy(this.player.position);
      this.resources.scene.add(shieldEffect);
      
      setTimeout(() => {
        this.gameState.health = Math.max(this.gameState.health - 50, 0);
        this.resources.scene.remove(shieldEffect);
        this.isAbilityActive = false;
      }, 5000);
      this.abilityCooldowns.set(ability, now + 10000);
      break;
  }

  NotificationManager.getInstance().show(`${ability} yeteneği kullanıldı!`, 'success');
}

private createAreaEffect(radius: number, damage: number, color: number): void {
  if (!this.player) return;

  const effect = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 16),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 })
  );
  effect.position.copy(this.player.position);
  this.resources.scene.add(effect);

  // Efekti kısa süre sonra kaldır
  setTimeout(() => {
    this.resources.scene.remove(effect);
  }, 200);

  // Hasar verme
  if (damage > 0) {
    this.aiManager.getEnemies().forEach(enemy => {
      if (enemy.model && enemy.model.position.distanceTo(this.player!.position) < radius) {
        enemy.health -= damage;
        if (enemy.health <= 0) {
          this.resources.scene.remove(enemy.model);
          this.aiManager.getEnemies().splice(this.aiManager.getEnemies().indexOf(enemy), 1);
          this.gameState.score += 10;
          this.aiManager.updateTaskProgress(true);
        }
      }
    });
  }
}

private setOpacity(model: THREE.Object3D, opacity: number): void {
  model.traverse(child => {
    if (child instanceof THREE.Mesh) {
      const material = child.material as THREE.MeshStandardMaterial;
      material.transparent = true;
      material.opacity = opacity;
    }
  });
}

private updateCamera(): void {
  if (!this.player) return;

  // Kamera offset'ini belirle
  const offset = this.isAbilityActive ? this.CAMERA_ABILITY_OFFSET : this.CAMERA_NORMAL_OFFSET;

  // Kameranın hedef pozisyonunu hesapla
  const targetPosition = this.player.position.clone();
  
  // Kamera rotasyonlarını uygula
  const rotationMatrix = new THREE.Matrix4();
  rotationMatrix.makeRotationY(this.cameraRotation.x);
  
  const offsetVector = offset.clone();
  offsetVector.applyMatrix4(rotationMatrix);
  
  // Dikey rotasyonu uygula
  offsetVector.y = Math.cos(this.cameraRotation.y) * offset.z;
  offsetVector.z *= Math.cos(this.cameraRotation.y);
  
  targetPosition.add(offsetVector);

  // Kamerayı yumuşak bir şekilde hareket ettir
  this.resources.camera.position.lerp(targetPosition, this.CAMERA_LERP_SPEED);
  
  // Kameranın bakış noktasını karakterin pozisyonuna ayarla
  const lookAtPosition = this.player.position.clone();
  lookAtPosition.y += 1.5; // Göz hizası için yukarı offset
  this.resources.camera.lookAt(lookAtPosition);
}
}
