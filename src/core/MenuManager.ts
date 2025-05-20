// src/core/MenuManager.ts

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { NotificationManager } from './NotificationManager';

export class MenuManager {
    private menus: Map<string, HTMLElement>;
    private activeMenu: string | null = null;
    private selectedCharacter: string | null = null;
    private characterPreviews: Map<string, { 
        scene: THREE.Scene,
        camera: THREE.PerspectiveCamera,
        renderer: THREE.WebGLRenderer,
        model?: THREE.Object3D 
    }> = new Map();
    private currentCarouselIndex: number = 0;
    private characters: { id: string; name: string; modelPath: string; stats: { speed: number; power: number } }[] = [
        {
            id: 'ninja',
            name: 'Ninja',
            modelPath: '/models/character/character-female-a.glb',
            stats: { speed: 90, power: 70 }
        },
        {
            id: 'samurai',
            name: 'Samuray',
            modelPath: '/models/character/character-male-a.glb',
            stats: { speed: 70, power: 90 }
        }
    ];

    constructor() {
        console.log("MenuManager başlatılıyor");
        this.menus = new Map();
        this.initializeMenus();
        this.setupEventListeners();
    }

    private initializeMenus(): void {
        console.log("Menüler başlatılıyor");
        this.menus.set('main', document.getElementById('main-menu')!);
        this.menus.set('character', document.getElementById('character-select')!);
        this.menus.set('scoreboard', document.getElementById('scoreboard')!);
        this.menus.set('settings', document.getElementById('settings')!);
        this.menus.set('pause', document.getElementById('pause-menu')!);
        this.menus.set('gameOver', document.getElementById('game-over')!);

        this.createCharacterCarousel();
    }

    private createCharacterCarousel(): void {
        console.log("Karakter carousel'i oluşturuluyor");
        const characterGrid = document.querySelector('.character-grid');
        if (!characterGrid) {
            console.error("Karakter gridi bulunamadı (.character-grid)");
            NotificationManager.getInstance().show('Karakter carousel yüklenemedi!', 'error');
            return;
        }

        characterGrid.innerHTML = `
            <div class="character-carousel-container">
                <div class="character-carousel">
                    <div class="character-cards-wrapper">
                        ${this.characters.map(char => `
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
                        `).join('')}
                    </div>
                </div>
                <button class="carousel-button prev">◄</button>
                <button class="carousel-button next">►</button>
                <div class="character-nav-dots">
                    ${this.characters.map((_, i) => `<span class="nav-dot${i === 0 ? ' active' : ''}" data-index="${i}"></span>`).join('')}
                </div>
            </div>
        `;

        this.characters.forEach(char => {
            this.setupCharacterPreview(char.id, char.modelPath);
        });

        this.setupCharacterCardListeners();
        this.setupCarouselListeners();
        this.updateCarousel();
    }

    private setupCharacterPreview(characterId: string, modelPath: string): void {
        console.log(`Karakter önizlemesi ayarlanıyor: ${characterId}`);
        const canvas = document.getElementById(`${characterId}-preview`) as HTMLCanvasElement;
        if (!canvas) {
            console.error(`Karakter önizleme canvas'ı bulunamadı: ${characterId}-preview`);
            NotificationManager.getInstance().show(`Karakter önizlemesi yüklenemedi: ${characterId}`, 'error');
            return;
        }

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
            console.log(`Karakter modeli yüklendi: ${characterId}`);
            const model = gltf.scene;
            model.scale.set(1, 1, 1);
            model.position.set(0, 0, 0);
            scene.add(model);
            
            const preview = this.characterPreviews.get(characterId);
            if (preview) {
                preview.model = model;
            }

            this.animatePreview(characterId);
        }, undefined, (error) => {
            console.error(`Karakter modeli yüklenemedi: ${characterId}`, error);
            NotificationManager.getInstance().show(`Karakter modeli yüklenemedi: ${characterId}`, 'error');
        });
    }

    private animatePreview(characterId: string): void {
        const preview = this.characterPreviews.get(characterId);
        if (!preview) return;

        const animate = () => {
            if (!this.characterPreviews.has(characterId)) return;

            requestAnimationFrame(animate);
            if (preview.model) {
                preview.model.rotation.y += 0.01;
            }
            preview.renderer.render(preview.scene, preview.camera);
        };

        animate();
    }

    private setupCharacterCardListeners(): void {
        console.log("Karakter kartı dinleyicileri ayarlanıyor");
        const cards = document.querySelectorAll('.character-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const characterId = card.getAttribute('data-character');
                if (characterId) {
                    console.log(`Karakter seçildi: ${characterId}`);
                    this.selectCharacter(characterId);
                }
            });
        });
    }

    private setupCarouselListeners(): void {
        console.log("Carousel dinleyicileri ayarlanıyor");
        const prevBtn = document.querySelector('.carousel-button.prev');
        const nextBtn = document.querySelector('.carousel-button.next');
        const navDots = document.querySelectorAll('.nav-dot');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                console.log("Önceki karaktere geçiş");
                this.currentCarouselIndex = (this.currentCarouselIndex - 1 + this.characters.length) % this.characters.length;
                this.updateCarousel();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                console.log("Sonraki karaktere geçiş");
                this.currentCarouselIndex = (this.currentCarouselIndex + 1) % this.characters.length;
                this.updateCarousel();
            });
        }

        navDots.forEach(dot => {
            dot.addEventListener('click', () => {
                const index = parseInt(dot.getAttribute('data-index') || '0');
                console.log(`Nav dot tıklandı: ${index}`);
                this.currentCarouselIndex = index;
                this.updateCarousel();
            });
        });
    }

    private updateCarousel(): void {
        console.log(`Carousel güncelleniyor: index ${this.currentCarouselIndex}`);
        const wrapper = document.querySelector('.character-cards-wrapper') as HTMLElement;
        if (wrapper) {
            wrapper.style.transform = `translateX(-${this.currentCarouselIndex * (100 / this.characters.length)}%)`;
        }

        const cards = document.querySelectorAll('.character-card');
        cards.forEach((card, index) => {
            if (index === this.currentCarouselIndex) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

        const navDots = document.querySelectorAll('.nav-dot');
        navDots.forEach((dot, index) => {
            if (index === this.currentCarouselIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    private setupEventListeners(): void {
        console.log("Menü olay dinleyicileri ayarlanıyor");
        document.getElementById('characterSelectBtn')?.addEventListener('click', () => {
            console.log("Karakter seçimi menüsü açılıyor");
            this.showMenu('character');
        });
        document.getElementById('scoreboardBtn')?.addEventListener('click', () => {
            console.log("Skor tablosu menüsü açılıyor");
            this.showMenu('scoreboard');
        });
        document.getElementById('settingsBtn')?.addEventListener('click', () => {
            console.log("Ayarlar menüsü açılıyor");
            this.showMenu('settings');
        });

        document.getElementById('backFromCharSelect')?.addEventListener('click', () => {
            console.log("Karakter seçiminden ana menüye dönülüyor");
            this.showMenu('main');
        });
        document.getElementById('backFromScoreboard')?.addEventListener('click', () => {
            console.log("Skor tablosundan ana menüye dönülüyor");
            this.showMenu('main');
        });
        document.getElementById('backFromSettings')?.addEventListener('click', () => {
            console.log("Ayarlardan ana menüye dönülüyor");
            this.showMenu('main');
        });

        document.getElementById('confirmCharacter')?.addEventListener('click', () => {
            if (this.selectedCharacter) {
                console.log(`Karakter onaylandı: ${this.selectedCharacter}`);
                NotificationManager.getInstance().show(`Karakter onaylandı: ${this.selectedCharacter}`, 'success');
                this.showMenu('main');
            } else {
                console.error("Karakter seçilmedi");
                NotificationManager.getInstance().show('Lütfen bir karakter seçin!', 'error');
            }
        });
    }

    public showMenu(menuId: string): void {
        console.log(`Menü gösteriliyor: ${menuId}`);
        if (this.activeMenu) {
            const currentMenu = this.menus.get(this.activeMenu);
            if (currentMenu) {
                currentMenu.classList.add('hidden');
                console.log(`Önceki menü gizlendi: ${this.activeMenu}`);
            }
        }

        if (menuId !== 'none') {
            const newMenu = this.menus.get(menuId);
            if (newMenu) {
                newMenu.classList.remove('hidden');
                this.activeMenu = menuId;
                console.log(`Yeni menü gösterildi: ${menuId}`);
                if (menuId === 'character') {
                    this.updateCarousel(); // Karakter seçimi açıldığında carousel'i güncelle
                }
            } else {
                console.error(`Menü bulunamadı: ${menuId}`);
                NotificationManager.getInstance().show(`Menü bulunamadı: ${menuId}`, 'error');
            }
        } else {
            this.activeMenu = null;
            console.log("Tüm menüler gizlendi");
        }
    }

    private selectCharacter(characterId: string): void {
        console.log(`Karakter seçimi: ${characterId}`);
        document.querySelectorAll('.character-card').forEach(card => {
            card.classList.remove('selected');
        });

        const selectedCard = document.querySelector(`[data-character="${characterId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
            this.selectedCharacter = characterId;
            console.log(`Karakter seçildi: ${characterId}`);
            // Carousel'i seçilen karaktere göre güncelle
            const index = this.characters.findIndex(char => char.id === characterId);
            if (index !== -1) {
                this.currentCarouselIndex = index;
                this.updateCarousel();
            }
        } else {
            console.error(`Karakter kartı bulunamadı: ${characterId}`);
            NotificationManager.getInstance().show(`Karakter kartı bulunamadı: ${characterId}`, 'error');
        }
    }

    public getSelectedCharacter(): string | null {
        return this.selectedCharacter;
    }

    public cleanup(): void {
        console.log("MenuManager temizleniyor");
        this.characterPreviews.forEach((preview, characterId) => {
            preview.renderer.dispose();
            preview.scene.clear();
        });
        this.characterPreviews.clear();
    }
                                           }
