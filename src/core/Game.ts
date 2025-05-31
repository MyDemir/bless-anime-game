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
level: 1
};

private ui = {
score: document.getElementById('score') as HTMLElement,
health: document.getElementById('health') as HTMLElement,
ammo: document.getElementById('ammo') as HTMLElement,
uiContainer: document.getElementById('ui') as HTMLElement,
loadingScreen: document.getElementById('loading-screen') as HTMLElement,
finalScore: document.getElementById('final-score') as HTMLElement,
highScore: document.getElementById('high-score') as HTMLElement,
task: document.getElementById('task') as HTMLElement
};

private player: THREE.Object3D | null = null;
private weapon: THREE.Object3D | null = null;
private moveState = {
forward: false,
backward: false,
left: false,
right: false,
jump: false
};

private movementSpeed: number = 5; // readonly kaldırıldı, değişken yapıldı
private readonly ROTATION_SPEED = 2;
private readonly raycaster = new THREE.Raycaster();
private readonly moveDirection = new THREE.Vector3();
private abilityCooldowns: Map<string, number> = new Map();
private characterStats: CharacterData['stats'] | null = null;
private kitStats: KitData['stats'] | null = null;

constructor(canvas: HTMLCanvasElement) {
super();
console.log("Game sınıfı başlatılıyor");

this.resources = this.initializeResources(canvas);
this.modelsLoader = new ModelsLoader(this.resources.scene);
this.aiManager = new AIManager(this.modelsLoader, this.resources.scene);

this.platform = this.setupWorld();
this.loadGameState();
this.setCurrentDateTime();

document.addEventListener('keydown', this.onKeyDown.bind(this));
document.addEventListener('keyup', this.onKeyUp.bind(this));
document.addEventListener('mousedown', this.onMouseDown.bind(this));
document.addEventListener('mouseup', this.onMouseUp.bind(this));
document.addEventListener('mousemove', this.onMouseMove.bind(this));
window.addEventListener('resize', this.onWindowResize.bind(this));

this.initializeGame();
}

private initializeResources(canvas: HTMLCanvasElement): GameResources {
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000); // far: 1000 -> 2000
camera.position.set(0, 50, 100); // Daha geniş görüş
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 1, 0);
controls.maxDistance = 200; // Daha büyük harita için

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
level: this.gameState.level
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

const deltaTime = (currentTime - this.lastTime) / 1000;
if (deltaTime < this.frameInterval) return;

if (this.gameState.isStarted && !this.gameState.isPaused) {
this.gameLoop(deltaTime);
this.resources.controls.update();
this.resources.renderer.render(this.resources.scene, this.resources.camera);
}

this.lastTime = currentTime;
}

private updatePlayerMovement(deltaTime: number): void {
if (!this.player) return;

this.moveDirection.set(0, 0, 0);

if (this.moveState.forward) this.moveDirection.z -= 1;
if (this.moveState.backward) this.moveDirection.z += 1;
if (this.moveState.left) this.moveDirection.x -= 1;
if (this.moveState.right) this.moveDirection.x += 1;

if (this.moveDirection.length() > 0) {
const speed = this.characterStats ? this.characterStats.speed / 5 : 10; // Hız artır (5 -> 10)
this.moveDirection.normalize().multiplyScalar(speed * deltaTime);
this.player.position.add(this.moveDirection);
this.checkCollisions();
}

if (this.weapon && this.player) {
this.weapon.position.copy(this.player.position);
this.weapon.rotation.copy(this.player.rotation);
this.weapon.position.y += 0.5;
this.weapon.position.z -= 0.3;

this.resources.camera.position.set(
this.player.position.x,
this.player.position.y + 10, // Daha yukarı
this.player.position.z + 20 // Daha uzak
);
this.resources.camera.lookAt(this.player.position);
}
}

private checkCollisions(): void {
if (!this.player) return;

this.raycaster.set(
this.player.position,
new THREE.Vector3(0, -1, 0)
);

const intersects = this.raycaster.intersectObjects([this.platform, ...this.aiManager.getStructures()]);
if (intersects.length > 0) {
const distance = intersects[0].distance;
if (distance < 0.5) {
this.player.position.y = intersects[0].point.y + 0.5;
}
}

this.resources.scene.children.forEach(obj => {
if (obj.userData.type === 'prop' && obj.userData.effect && this.player) { // Ek null kontrolü
const distance = this.player.position.distanceTo(obj.position);
if (distance < 1.5) {
if (obj.userData.effect === 'health_kit') {
this.gameState.health = Math.min(this.gameState.health + 20, this.characterStats?.health || 100);
NotificationManager.getInstance().show('Sağlık kiti alındı! +20 HP', 'success');
this.resources.scene.remove(obj);
} else if (obj.userData.effect === 'quest') {
this.aiManager.generateDynamicTask(this.gameState.level);
NotificationManager.getInstance().show('Yeni görev alındı!', 'success');
this.resources.scene.remove(obj);
}
}
}
});
}

public cleanup(): void {
if (this.animationFrameId !== null) {
cancelAnimationFrame(this.animationFrameId);
this.animationFrameId = null;
}

document.removeEventListener('keydown', this.onKeyDown.bind(this));
document.removeEventListener('keyup', this.onKeyUp.bind(this));
document.removeEventListener('mousedown', this.onMouseDown.bind(this));
document.removeEventListener('mouseup', this.onMouseUp.bind(this));
document.removeEventListener('mousemove', this.onMouseMove.bind(this));
window.removeEventListener('resize', this.onWindowResize.bind(this));

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
platform.position.y = -0.25;
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
console.log(`Key pressed: ${event.code}`);
if (!this.gameState.isStarted) {
console.log("Oyun başlamadı, ESC tuşu yok sayılıyor");
return;
}

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
case 'Space':
this.moveState.jump = true;
break;
case 'Escape':
console.log("ESC tuşuna basıldı, pause toggling...");
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
if (this.player) {
const movementX = event.movementX || 0;
this.player.rotation.y -= movementX * 0.002 * this.ROTATION_SPEED;
}
}

private updateUI(): void {
if (this.ui.score.textContent !== `Skor: ${this.gameState.score}`) {
this.ui.score.textContent = `Skor: ${this.gameState.score}`;
this.ui.health.textContent = `Can: ${this.gameState.health}`;
this.ui.ammo.textContent = `Mermi: ${this.gameState.ammo}`;
this.ui.finalScore.textContent = `Skor: ${this.gameState.score}`;
this.ui.highScore.textContent = `En Yüksek Skor: ${this.gameState.highScore}`;
const task = this.aiManager.getCurrentTask();
this.ui.task.textContent = task 
? `Görev: ${task.description} (${task.progress}/${task.target})`
: 'Görev yok';

const userInfoDiv = document.createElement('div');
userInfoDiv.classList.add('user-info-item');
userInfoDiv.innerHTML = `
               <div class="user-info-item">
                   <span class="user-info-label">Oyuncu:</span>
                   <span class="user-info-value">${this.gameState.currentUser}</span>
               </div>
               <div class="user-info-item">
                   <span class="user-info-label">Karakter:</span>
                   <span class="user-info-value">${this.gameState.selectedCharacter || 'Seçilmedi'}</span>
               </div>
               <div class="user-info-item">
                   <span class="user-info-label">Silah:</span>
                   <span class="user-info-value">${this.gameState.selectedKit || 'Seçilmedi'}</span>
               </div>
               <div class="user-info-item">
                   <span class="user-info-label">Son Oynama:</span>
                   <span class="user-info-value">${this.gameState.lastPlayTime}</span>
               </div>
               <div class="user-info-item">
                   <span class="user-info-label">Seviye:</span>
                   <span class="user-info-value">${this.gameState.level}</span>
               </div>
           `;
const existingUserInfo = this.ui.uiContainer.querySelector('.user-info');
if (!existingUserInfo) {
this.ui.uiContainer.querySelector('.ui-panel')?.appendChild(userInfoDiv);
} else {
existingUserInfo.innerHTML = userInfoDiv.innerHTML;
}
}
}
private async spawnEnemies(): Promise<void> {
const mapDensity = this.calculateMapDensity();
if (Math.random() < 0.01) {
const enemies = await this.aiManager.spawnEnemy(
this.gameState.level,
this.aiManager.getEnemies().length,
mapDensity
);
if (enemies.length > 0) {
NotificationManager.getInstance().show(`${enemies.length} düşman oluşturuldu!`, 'success');
}
}
}

private gameLoop(deltaTime: number): void {
this.updatePlayerMovement(deltaTime);
this.updateEnemies(deltaTime);
this.checkCollisions();
this.updateAbilities(deltaTime);
this.updateUI();

// spawnEnemy'yi ayrı bir asenkron çağrıda işle
this.spawnEnemies().catch(error => {
console.error('Düşman oluşturma hatası:', error);
NotificationManager.getInstance().show('Düşman oluşturulamadı!', 'error');
});

if (Math.random() < 0.005) {
this.aiManager.addStructure(
this.gameState.level,
this.aiManager.getStructures().length,
Math.random() > 0.5 ? 'city_center' : 'suburb'
);
}
if (!this.aiManager.getCurrentTask()) {
this.aiManager.generateDynamicTask(this.gameState.level);
}

this.updateLevel();
}

private calculateMapDensity(): number {
const buildingCount = this.aiManager.getStructures().length;
return Math.min(buildingCount / 200, 1); // 200 bina = max yoğunluk, veri ile uyumlu
}

private updateLevel(): void {
const newLevel = Math.floor(this.gameState.score / 50) + 1;
if (newLevel > this.gameState.level) {
this.gameState.level = newLevel;
NotificationManager.getInstance().show(`Seviye ${newLevel}!`, 'success');
this.aiManager.generateDynamicTask(this.gameState.level);
this.aiManager.spawnEvent(this.gameState.level);
this.saveGameState();
}
}

private updateEnemies(deltaTime: number): void {
const enemies = this.aiManager.getEnemies();
if (this.player) {
enemies.forEach(enemy => {
const direction = new THREE.Vector3()
.subVectors(this.player!.position, enemy.model.position)
.normalize();
enemy.model.position.add(direction.multiplyScalar(enemy.speed * deltaTime));
});
}
}

private activateAbility(ability: string): void {
const now = Date.now();
const cooldown = this.abilityCooldowns.get(ability) || 0;
if (now < cooldown) return;

if (!this.player || !this.characterStats) return;

let effectApplied = false;

switch (ability) {
case 'invisibility':
this.setOpacity(this.player, 0.2);
this.movementSpeed *= 1.2;
setTimeout(() => {
this.setOpacity(this.player!, 1.0);
this.movementSpeed /= 1.2;
}, 3000);
this.abilityCooldowns.set(ability, now + 10000);
effectApplied = true;
break;
case 'sword_slash':
this.createAreaEffect(3, 1.5 * this.characterStats.power, 0xff0000);
this.abilityCooldowns.set(ability, now + 8000);
effectApplied = true;
break;
case 'dash_leap':
this.player.position.add(this.player.getWorldDirection(new THREE.Vector3()).multiplyScalar(5));
this.gameState.health += 1000;
setTimeout(() => this.gameState.health -= 1000, 1000);
this.abilityCooldowns.set(ability, now + 6000);
effectApplied = true;
break;
case 'energy_burst':
this.createAreaEffect(2, this.characterStats.power, 0x00ff00);
this.aiManager.getEnemies().forEach(enemy => {
if (enemy.model.position.distanceTo(this.player!.position) < 2) {
enemy.speed *= 0.7;
setTimeout(() => enemy.speed = enemy.type === 'fast' ? 80 : 50, 1000);
}
});
this.abilityCooldowns.set(ability, now + 7000);
effectApplied = true;
break;
case 'trap_setup':
const trap = new THREE.Mesh(
new THREE.CircleGeometry(0.5, 16),
new THREE.MeshBasicMaterial({ color: 0xffff00 })
);
trap.position.copy(this.player.position);
trap.rotation.x = -Math.PI / 2;
this.resources.scene.add(trap);
const trapInterval = setInterval(() => {
this.aiManager.getEnemies().forEach(enemy => {
if (enemy.model.position.distanceTo(trap.position) < 0.5) {
enemy.health -= 50;
if (enemy.health <= 0) {
this.resources.scene.remove(enemy.model);
this.aiManager.getEnemies().splice(this.aiManager.getEnemies().indexOf(enemy), 1);
this.gameState.score += 10;
this.aiManager.updateTaskProgress(true);
}
}
});
}, 100);
setTimeout(() => {
clearInterval(trapInterval);
this.resources.scene.remove(trap);
}, 5000);
this.abilityCooldowns.set(ability, now + 12000);
effectApplied = true;
break;
case 'power_shield':
this.gameState.health += 1000;
setTimeout(() => this.gameState.health -= 1000, 5000);
this.abilityCooldowns.set(ability, now + 10000);
effectApplied = true;
break;
case 'double_shot':
this.kitStats!.damage *= 0.75;
this.kitStats!.fireRate *= 2;
setTimeout(() => {
this.kitStats!.damage /= 0.75;
this.kitStats!.fireRate /= 2;
}, 1000);
this.abilityCooldowns.set(ability, now + 8000);
effectApplied = true;
break;
case 'seismic_strike':
this.createAreaEffect(3, 1.2 * this.characterStats.power, 0x0000ff);
this.aiManager.getEnemies().forEach(enemy => {
if (enemy.model.position.distanceTo(this.player!.position) < 3) {
enemy.speed = 0;
setTimeout(() => enemy.speed = enemy.type === 'fast' ? 80 : 50, 1000);
}
});
this.abilityCooldowns.set(ability, now + 9000);
effectApplied = true;
break;
case 'speed_surge':
this.movementSpeed *= 1.5;
this.characterStats.power *= 0.8;
setTimeout(() => {
this.movementSpeed /= 1.5;
this.characterStats!.power /= 0.8;
}, 5000);
this.abilityCooldowns.set(ability, now + 10000);
effectApplied = true;
break;
case 'heavy_strike':
const target = this.aiManager.getEnemies().find(enemy => 
enemy.model.position.distanceTo(this.player!.position) < 2);
if (target) {
target.health -= 2 * this.characterStats.power;
if (target.health <= 0) {
this.resources.scene.remove(target.model);
this.aiManager.getEnemies().splice(this.aiManager.getEnemies().indexOf(target), 1);
this.gameState.score += 10;
this.aiManager.updateTaskProgress(true);
}
this.movementSpeed = 0;
setTimeout(() => this.movementSpeed = this.characterStats!.speed / 10, 2000);
}
this.abilityCooldowns.set(ability, now + 10000);
effectApplied = true;
break;
case 'smoke_bomb':
this.createAreaEffect(3, 0, 0x888888);
this.abilityCooldowns.set(ability, now + 10000);
effectApplied = true;
break;
case 'life_steal':
const lifeStealTarget = this.aiManager.getEnemies().find(enemy => 
enemy.model.position.distanceTo(this.player!.position) < 2);
if (lifeStealTarget) {
lifeStealTarget.health -= this.characterStats.power;
this.gameState.health += this.characterStats.power / 2;
if (lifeStealTarget.health <= 0) {
this.resources.scene.remove(lifeStealTarget.model);
this.aiManager.getEnemies().splice(this.aiManager.getEnemies().indexOf(lifeStealTarget), 1);
this.gameState.score += 10;
this.aiManager.updateTaskProgress(true);
}
}
this.abilityCooldowns.set(ability, now + 8000);
effectApplied = true;
break;
}

if (effectApplied) {
NotificationManager.getInstance().show(`${this.characterStats!.abilityDescription}`, 'success');
}
}

private createAreaEffect(radius: number, damage: number, color: number): void {
const effect = new THREE.Mesh(
new THREE.SphereGeometry(radius, 16, 16),
new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 })
);
effect.position.copy(this.player!.position);
this.resources.scene.add(effect);
setTimeout(() => this.resources.scene.remove(effect), 200);

if (damage > 0) {
this.aiManager.getEnemies().forEach(enemy => {
if (enemy.model.position.distanceTo(this.player!.position) < radius) {
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

public startGame(): void {
if (!this.menuManager) {
NotificationManager.getInstance().show('Menü yöneticisi başlatılmadı!', 'error');
return;
}

const selectedCharacterId = this.menuManager.getSelectedCharacterId();
const selectedKitId = this.menuManager.getSelectedKit();
if (!selectedCharacterId || !selectedKitId) {
NotificationManager.getInstance().show('Lütfen bir karakter ve silah seçin!', 'error');
this.menuManager.showMenu('character');
return;
}

this.gameState.selectedCharacter = selectedCharacterId;
this.gameState.selectedKit = selectedKitId;

Promise.all([
this.modelsLoader.loadCharacterModels([selectedCharacterId]),
this.modelsLoader.loadKitModels([selectedKitId])
]).then(() => {
const characterModel = this.modelsLoader.getModel(selectedCharacterId);
const kitModel = this.modelsLoader.getModel(selectedKitId);
if (!characterModel || !kitModel) {
throw new Error(`Model yüklenemedi: ${selectedCharacterId}, ${selectedKitId}`);
}

const characterData = this.modelsLoader.getCharacterData(selectedCharacterId);
const kitData = this.modelsLoader.getKitData(selectedKitId);
this.characterStats = characterData?.stats ?? null;
this.kitStats = kitData?.stats ?? null;
this.gameState.health = this.characterStats?.health || 100;

NotificationManager.getInstance().show(
`${this.gameState.currentUser} olarak ${selectedCharacterId} ve ${selectedKitId} ile oyuna başlandı!`,
'success'
);

if (this.player) {
this.resources.scene.remove(this.player);
}
if (this.weapon) {
this.resources.scene.remove(this.weapon);
}

this.player = characterModel.scene.clone();
if (!this.player) {
NotificationManager.getInstance().show('Karakter modeli klonlanamadı!', 'error');
return;
}
this.player.name = selectedCharacterId;
this.player.position.set(0, 1, 0);
this.resources.scene.add(this.player);

this.weapon = kitModel.scene.clone();
if (!this.weapon) {
NotificationManager.getInstance().show('Silah modeli klonlanamadı!', 'error');
return;
}
this.weapon.name = selectedKitId;
this.resources.scene.add(this.weapon);

this.gameState.isStarted = true;
this.gameState.isPaused = false;
this.gameState.score = 0;
this.gameState.health = this.characterStats?.health || 100;
this.gameState.ammo = 50;
this.gameState.level = 1;
this.setCurrentDateTime();

this.ui.uiContainer.classList.remove('hidden');
this.menuManager?.showMenu('none');
this.aiManager.generateDynamicTask(this.gameState.level);
this.updateUI();
}).catch(error => {
console.error('Model yükleme hatası:', error);
NotificationManager.getInstance().show('Model yüklenemedi!', 'error');
});
}

private shoot(): void {
if (this.gameState.ammo <= 0) {
NotificationManager.getInstance().show('Mermi bitti!', 'error');
this.emit('outOfAmmo');
return;
}

this.gameState.ammo--;
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
this.updateUI();

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
console.log(`Oyun durumu: isPaused=${this.gameState.isPaused}`);
if (this.gameState.isPaused) {
NotificationManager.getInstance().show('Oyun duraklatıldı', 'warning');
if (this.menuManager) {
this.menuManager.showMenu('pause');
console.log("Pause menüsü gösterilmeye çalışılıyor");
} else {
console.error("MenuManager mevcut değil!");
NotificationManager.getInstance().show('Pause menüsü açılamadı!', 'error');
}
} else {
NotificationManager.getInstance().show('Oyun devam ediyor', 'success');
if (this.menuManager) {
this.menuManager.showMenu('none');
}
}
}

private resumeGame(): void {
this.gameState.isPaused = false;
NotificationManager.getInstance().show('Oyun devam ediyor', 'success');
this.menuManager?.showMenu('none');
}

private restartGame(): void {
console.log("Oyun yeniden başlatılıyor");
this.cleanup();
this.resources.renderer = new THREE.WebGLRenderer({
canvas: this.resources.renderer.domElement,
antialias: true,
powerPreference: 'high-performance'
});
this.resources.renderer.setSize(window.innerWidth, window.innerHeight);
this.resources.renderer.shadowMap.enabled = true;
this.resources.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

this.resources.controls = new OrbitControls(this.resources.camera, this.resources.renderer.domElement);
this.resources.controls.enableDamping = true;
this.resources.controls.dampingFactor = 0.05;
this.resources.controls.target.set(0, 1, 0);

this.platform = this.setupWorld();
this.initializeGame();
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
}
