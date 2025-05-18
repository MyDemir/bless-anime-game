import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MenuManager } from './MenuManager';
import { ModelsLoader } from './../utils/loadModels';
import { EventEmitter } from './../utils/EventEmitter';
export class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;

    private modelsLoader: ModelsLoader;
    private eventEmitter: EventEmitter;
    private menuManager: MenuManager;

    private gameState = {
        isStarted: false,
        isPaused: false,
        score: 0,
        health: 100,
        ammo: 30,
        selectedCharacter: null as string | null,
        highScore: 0,
        currentUser: 'MyDemir',
        lastPlayTime: '2025-05-16 00:33:50'
    };

    private ui = {
        score: document.getElementById('score') as HTMLElement,
        health: document.getElementById('health') as HTMLElement,
        ammo: document.getElementById('ammo') as HTMLElement,
        uiContainer: document.getElementById('ui') as HTMLElement,
        loadingScreen: document.getElementById('loading-screen') as HTMLElement
    };

    private player: THREE.Object3D | null = null;
    private blasters: THREE.Object3D[] = [];
    private enemies: THREE.Object3D[] = [];

    constructor(canvas: HTMLCanvasElement) {
        this.eventEmitter = new EventEmitter();
        this.menuManager = new MenuManager();
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xbfd1e5);
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(5, 5, 5);
        this.camera.lookAt(0, 0, 0);
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 1, 0);
        this.modelsLoader = new ModelsLoader(this.scene);
        this.setupWorld();
        this.setupEventListeners();
        this.loadHighScore();
        this.setCurrentDateTime();
        this.loadGameModels().then(() => {
            this.animate();
            (window as any).showNotification('Oyun yüklendi!', 'success');
        }).catch(error => {
            console.error('Oyun modelleri yüklenemedi:', error);
            (window as any).showNotification('Oyun başlatılamadı!', 'error');
        });
        this.ui.uiContainer.classList.add('hidden');
    }

    private setCurrentDateTime(): void {
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const day = String(now.getUTCDate()).padStart(2, '0');
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        const seconds = String(now.getUTCSeconds()).padStart(2, '0');
        this.gameState.lastPlayTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    private loadHighScore(): void {
        const savedHighScore = localStorage.getItem('highScore');
        if (savedHighScore) {
            this.gameState.highScore = parseInt(savedHighScore);
        }
    }

    private saveHighScore(): void {
        if (this.gameState.score > this.gameState.highScore) {
            this.gameState.highScore = this.gameState.score;
            localStorage.setItem('highScore', this.gameState.highScore.toString());
            (window as any).showNotification('Yeni yüksek skor kaydedildi! 🏆', 'success');
        }
    }

    private async loadGameModels(): Promise<void> {
        try {
            console.log('Model yükleme başlıyor...');
            await Promise.all([
                this.modelsLoader.loadCharacterModels(),
                this.modelsLoader.loadBlasterModels()
            ]);
            console.log('Modeller başarıyla yüklendi');
            (window as any).showNotification('Modeller başarıyla yüklendi!', 'success');
            if (this.ui.loadingScreen) {
                this.ui.loadingScreen.classList.add('fade-out');
                setTimeout(() => {
                    if (this.ui.loadingScreen) {
                        this.ui.loadingScreen.style.display = 'none';
                    }
                    this.menuManager.showMenu('main');
                }, 500);
            }
        } catch (error) {
            console.error('Model yükleme hatası:', error);
            (window as any).showNotification('Model yükleme hatası! Lütfen sayfayı yenileyin.', 'error');
            throw error;
        }
    }

    private setupWorld(): void {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(5, 10, 5);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 50;
        dirLight.shadow.camera.left = -10;
        dirLight.shadow.camera.right = 10;
        dirLight.shadow.camera.top = 10;
        dirLight.shadow.camera.bottom = -10;
        this.scene.add(dirLight);
        const platform = new THREE.Mesh(
            new THREE.BoxGeometry(10, 0.5, 10),
            new THREE.MeshStandardMaterial({
                color: 0x808080,
                roughness: 0.7,
                metalness: 0.1
            })
        );
        platform.receiveShadow = true;
        platform.position.y = -0.25;
        this.scene.add(platform);
    }

    private setupEventListeners(): void {
        window.addEventListener('resize', () => this.onWindowResize());
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.eventEmitter.on('playerDamage', (damage: number) => {
            this.gameState.health -= damage;
            if (this.gameState.health <= 30) {
                (window as any).showNotification('Kritik hasar! Can düşük!', 'warning');
            }
            this.updateUI();
            if (this.gameState.health <= 0) {
                (window as any).showNotification('Öldünüz!', 'error');
                this.endGame();
            }
        });
        this.eventEmitter.on('scoreUpdate', (points: number) => {
            this.gameState.score += points;
            if (points > 0) {
                (window as any).showNotification(`+${points} puan!`, 'success');
            }
            this.updateUI();
        });
        document.getElementById('startBtn')?.addEventListener('click', () => {
            this.startGame();
        });
        document.getElementById('resumeBtn')?.addEventListener('click', () => {
            this.resumeGame();
        });
        document.getElementById('restartBtn')?.addEventListener('click', () => {
            this.restartGame();
        });
        document.getElementById('exitToMainBtn')?.addEventListener('click', () => {
            this.exitToMain();
        });
        document.getElementById('confirmCharacter')?.addEventListener('click', () => {
            const selectedChar = this.menuManager.getSelectedCharacter();
            if (selectedChar) {
                (window as any).showNotification(`${selectedChar} karakteri seçildi!`, 'success');
            }
        });
    }

    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private onKeyDown(event: KeyboardEvent): void {
        if (!this.gameState.isStarted || this.gameState.isPaused) return;
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                // İleri hareket
                break;
            case 'KeyS':
            case 'ArrowDown':
                // Geri hareket
                break;
            case 'KeyA':
            case 'ArrowLeft':
                // Sola hareket
                break;
            case 'KeyD':
            case 'ArrowRight':
                // Sağa hareket
                break;
            case 'Space':
                // Zıplama
                break;
            case 'Escape':
                this.togglePause();
                break;
        }
    }

    private onKeyUp(event: KeyboardEvent): void {
        // Tuş bırakma işlemleri
    }

    private onMouseDown(event: MouseEvent): void {
        if (!this.gameState.isStarted || this.gameState.isPaused) return;
        if (event.button === 0) { // Sol tık
            this.shoot();
        }
    }

    private onMouseUp(event: MouseEvent): void {
        // Mouse bırakma işlemleri
    }

    private onMouseMove(event: MouseEvent): void {
        if (!this.gameState.isStarted || this.gameState.isPaused) return;
        // Karakter döndürme
    }

    public startGame(): void {
        const selectedCharacter = this.menuManager.getSelectedCharacter();
        if (!selectedCharacter) {
            (window as any).showNotification('Lütfen bir karakter seçin!', 'error');
            this.menuManager.showMenu('character');
            return;
        }

        const characterModel = this.modelsLoader.getModel(selectedCharacter);
        if (!characterModel || !characterModel.scene) {
            (window as any).showNotification(`Karakter modeli yüklenemedi: ${selectedCharacter}`, 'error');
            this.menuManager.showMenu('character');
            return;
        }

        (window as any).showNotification(`${this.gameState.currentUser} olarak oyuna başlandı!`, 'success');

        if (this.player) {
            this.scene.remove(this.player);
        }
        const newPlayer = characterModel.scene.clone();
        if (!newPlayer) {
            (window as any).showNotification('Karakter modeli klonlanamadı!', 'error');
            return;
        }
        this.player = newPlayer;
        this.player.name = selectedCharacter;
        this.player.position.set(0, 0, 0);
        this.scene.add(this.player);

        this.gameState.isStarted = true;
        this.gameState.isPaused = false;
        this.gameState.score = 0;
        this.gameState.health = 100;
        this.gameState.ammo = 30;
        this.gameState.selectedCharacter = selectedCharacter;
        this.setCurrentDateTime();

        this.ui.uiContainer.classList.remove('hidden');
        this.menuManager.showMenu('none');
        this.updateUI();
    }

    private resumeGame(): void {
        this.gameState.isPaused = false;
        (window as any).showNotification('Oyun devam ediyor', 'success');
        this.menuManager.showMenu('none');
    }

    private restartGame(): void {
        this.saveHighScore();
        (window as any).showNotification('Oyun yeniden başlatılıyor...', 'info');
        this.startGame();
    }

    private exitToMain(): void {
        this.gameState.isStarted = false;
        this.gameState.isPaused = false;
        this.saveHighScore();
        (window as any).showNotification('Ana menüye dönülüyor...', 'info');
        this.ui.uiContainer.classList.add('hidden');
        this.menuManager.showMenu('main');
    }

    private endGame(): void {
        this.gameState.isStarted = false;
        if (this.gameState.score > this.gameState.highScore) {
            (window as any).showNotification('Yeni yüksek skor! 🏆', 'success');
        }
        this.saveHighScore();
        (window as any).showNotification(`Oyun bitti! Skorunuz: ${this.gameState.score}`, 'info');
        const finalScoreElement = document.getElementById('final-score');
        const highScoreElement = document.getElementById('high-score');
        if (finalScoreElement) {
            finalScoreElement.textContent = `Skor: ${this.gameState.score}`;
        }
        if (highScoreElement) {
            highScoreElement.textContent = `En Yüksek Skor: ${this.gameState.highScore}`;
        }
        this.menuManager.showMenu('gameOver');
    }

    private shoot(): void {
        if (this.gameState.ammo <= 0) {
            (window as any).showNotification('Mermi bitti!', 'error');
            this.eventEmitter.emit('outOfAmmo');
            return;
        }
        this.gameState.ammo--;
        if (this.gameState.ammo <= 5) {
            (window as any).showNotification('Mermi azalıyor!', 'warning');
        }
        this.eventEmitter.emit('weaponFired', this.gameState.ammo);
        this.updateUI();
    }

    private togglePause(): void {
        this.gameState.isPaused = !this.gameState.isPaused;
        if (this.gameState.isPaused) {
            (window as any).showNotification('Oyun duraklatıldı', 'warning');
            this.menuManager.showMenu('pause');
        } else {
            (window as any).showNotification('Oyun devam ediyor', 'success');
            this.menuManager.showMenu('none');
        }
    }

    private updateUI(): void {
        this.ui.score.textContent = `Skor: ${this.gameState.score}`;
        this.ui.health.textContent = `Can: ${this.gameState.health}`;
        this.ui.ammo.textContent = `Mermi: ${this.gameState.ammo}`;
        const userInfoDiv = document.createElement('div');
        userInfoDiv.classList.add('user-info');
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
                <span class="user-info-label">Son Oynama:</span>
                <span class="user-info-value">${this.gameState.lastPlayTime}</span>
            </div>
        `;
        const existingUserInfo = this.ui.uiContainer.querySelector('.user-info');
        if (!existingUserInfo) {
            this.ui.uiContainer.querySelector('.ui-panel')?.appendChild(userInfoDiv);
        } else {
            existingUserInfo.innerHTML = userInfoDiv.innerHTML;
        }
    }

    private animate(): void {
        requestAnimationFrame(() => this.animate());
        if (!this.gameState.isPaused && this.gameState.isStarted) {
            const deltaTime = 1/60;
            this.gameLoop(deltaTime);
        }
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    private gameLoop(deltaTime: number): void {
        this.updatePlayerMovement(deltaTime);
        this.updateEnemies(deltaTime);
        this.checkCollisions();
    }

    private updatePlayerMovement(deltaTime: number): void {
        // Karakter hareket mantığı
    }

    private updateEnemies(deltaTime: number): void {
        // Düşman hareket mantığı
    }

    private checkCollisions(): void {
        // Çarpışma kontrol mantığı
    }

    // main.ts için gerekli metodlar
    getCurrentUser() {
        return this.gameState.currentUser;
    }

    getLastPlayTime() {
        return this.gameState.lastPlayTime;
    }

    // MenuManager için gerekli metod
    showMenu(menuId: string): void {
        this.menuManager.showMenu(menuId);
    }
         }
