import { EventEmitter } from './utils/EventEmitter';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export class MenuManager {
    private menus: Map<string, HTMLElement>;
    private activeMenu: string | null = null;
    private selectedCharacter: string | null = null;
    private eventEmitter: EventEmitter;
    private characterPreviews: Map<string, { 
        scene: THREE.Scene,
        camera: THREE.PerspectiveCamera,
        renderer: THREE.WebGLRenderer,
        model?: THREE.Object3D 
    }> = new Map();

    constructor(eventEmitter: EventEmitter) {
        this.menus = new Map();
        this.eventEmitter = eventEmitter;
        this.initializeMenus();
        this.setupEventListeners();
    }

    private initializeMenus(): void {
        this.menus.set('main', document.getElementById('main-menu')!);
        this.menus.set('character', document.getElementById('character-select')!);
        this.menus.set('scoreboard', document.getElementById('scoreboard')!);
        this.menus.set('settings', document.getElementById('settings')!);
        this.menus.set('pause', document.getElementById('pause-menu')!);
        this.menus.set('gameOver', document.getElementById('game-over')!);

        this.createCharacterGrid();
    }

    private createCharacterGrid(): void {
        const characterGrid = document.querySelector('.character-grid');
        if (!characterGrid) return;

        const characters = [
            {
                id: 'ninja',
                name: 'Ninja',
                modelPath: './models/character/character-female-a.glb',
                stats: { speed: 90, power: 70 }
            },
            {
                id: 'samurai',
                name: 'Samuray',
                modelPath: './models/character/character-male-a.glb',
                stats: { speed: 70, power: 90 }
            }
        ];

        characterGrid.innerHTML = characters.map(char => `
            <div class="character-card" data-character="${char.id}">
                <div class="character-preview">
                    <canvas id="${char.id}-preview" class="character-canvas"></canvas>
                </div>
                <div class="character-info">
                    <h3>${char.name}</h3>
                    <div class="character-stats">
                        <div class="stat">
                            <span class="stat-label">Hız</span>
                            <div class="stat-bar">
                                <div class="stat-fill" style="width: ${char.stats.speed}%"></div>
                            </div>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Güç</span>
                            <div class="stat-bar">
                                <div class="stat-fill" style="width: ${char.stats.power}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        characters.forEach(char => {
            this.setupCharacterPreview(char.id, char.modelPath);
        });

        this.setupCharacterCardListeners();
    }

    private setupCharacterPreview(characterId: string, modelPath: string): void {
        const canvas = document.getElementById(`${characterId}-preview`) as HTMLCanvasElement;
        if (!canvas) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
        
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        camera.position.set(0, 1.5, 3);
        camera.lookAt(0, 1, 0);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(2, 2, 2);
        scene.add(dirLight);

        this.characterPreviews.set(characterId, { scene, camera, renderer });

        const loader = new GLTFLoader();
        loader.load(modelPath, (gltf) => {
            const model = gltf.scene;
            model.scale.set(1, 1, 1);
            model.position.set(0, 0, 0);
            scene.add(model);
            
            const preview = this.characterPreviews.get(characterId);
            if (preview) {
                preview.model = model;
            }

            this.animatePreview(characterId);
        });
    }

    private animatePreview(characterId: string): void {
        const preview = this.characterPreviews.get(characterId);
        if (!preview || !preview.model) return;

        const animate = () => {
            if (!this.characterPreviews.has(characterId)) return;

            requestAnimationFrame(animate);
            preview.model.rotation.y += 0.01;
            preview.renderer.render(preview.scene, preview.camera);
        };

        animate();
    }

    private setupCharacterCardListeners(): void {
        const cards = document.querySelectorAll('.character-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const characterId = card.getAttribute('data-character');
                if (characterId) {
                    this.selectCharacter(characterId);
                }
            });
        });
    }

    private setupEventListeners(): void {
        document.getElementById('characterSelectBtn')?.addEventListener('click', () => this.showMenu('character'));
        document.getElementById('scoreboardBtn')?.addEventListener('click', () => this.showMenu('scoreboard'));
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.showMenu('settings'));

        document.getElementById('backFromCharSelect')?.addEventListener('click', () => this.showMenu('main'));
        document.getElementById('backFromScoreboard')?.addEventListener('click', () => this.showMenu('main'));
        document.getElementById('backFromSettings')?.addEventListener('click', () => this.showMenu('main'));

        document.getElementById('confirmCharacter')?.addEventListener('click', () => {
            if (this.selectedCharacter) {
                this.showMenu('main');
            } else {
                alert('Lütfen bir karakter seçin!');
            }
        });
    }

    public showMenu(menuId: string): void {
        if (this.activeMenu) {
            const currentMenu = this.menus.get(this.activeMenu);
            if (currentMenu) {
                currentMenu.classList.add('hidden');
            }
        }

        if (menuId !== 'none') {
            const newMenu = this.menus.get(menuId);
            if (newMenu) {
                newMenu.classList.remove('hidden');
                this.activeMenu = menuId;
            }
        } else {
            this.activeMenu = null;
        }
    }

    private selectCharacter(characterId: string): void {
        document.querySelectorAll('.character-card').forEach(card => {
            card.classList.remove('selected');
        });

        const selectedCard = document.querySelector(`[data-character="${characterId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
            this.selectedCharacter = characterId;
            selectedCard.classList.add('character-selected-animation');
            setTimeout(() => {
                selectedCard.classList.remove('character-selected-animation');
            }, 500);
        }
    }

    public getSelectedCharacter(): string | null {
        return this.selectedCharacter;
    }

    public cleanup(): void {
        this.characterPreviews.forEach((preview, characterId) => {
            preview.renderer.dispose();
            preview.scene.clear();
        });
        this.characterPreviews.clear();
    }
    }
