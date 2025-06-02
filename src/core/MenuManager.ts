// src/core/MenuManager.ts
import * as THREE from 'three';
import { NotificationManager } from './NotificationManager';
import { EventEmitter } from '../utils/EventEmitter';
import { ModelsLoader, CharacterData, KitData } from '../utils/loadModels';

interface CharacterSelectState {
    selectedCharacterId: string | null;
    selectedKitId: string | null;
    previousCharacterId: string | null;
    selectionTime: string | null;
    isCharacterConfirmed: boolean;
    isKitConfirmed: boolean;
}

export class MenuManager extends EventEmitter {
    private menus: Map<string, HTMLElement>;
    private activeMenu: string | null = null;
    private currentCarouselIndex: number = 0;
    private currentKitCarouselIndex: number = 0;
    private isLoading: boolean = false;
    private modelsLoader: ModelsLoader;
    private characters: CharacterData[] = [];
    private kits: KitData[] = [];
    private characterSelectState: CharacterSelectState = {
        selectedCharacterId: null,
        selectedKitId: null,
        previousCharacterId: null,
        selectionTime: null,
        isCharacterConfirmed: false,
        isKitConfirmed: false
    };
    private readonly CURRENT_USER = 'MyDemir';
    private readonly CURRENT_TIME = new Date().toISOString();

    constructor(modelsLoader: ModelsLoader) {
        super();
        this.modelsLoader = modelsLoader;
        console.log("MenuManager başlatılıyor...");
        this.menus = new Map();
        this.loadSavedState();
        this.initializeMenus();
    }

    private loadSavedState(): void {
        const savedState = localStorage.getItem('characterSelectState');
        if (savedState) {
            this.characterSelectState = JSON.parse(savedState);
        }
    }

    private async showLoadingState(): Promise<void> {
        this.isLoading = true;
        document.body.classList.add('loading');
    }

    private async hideLoadingState(): Promise<void> {
        this.isLoading = false;
        document.body.classList.remove('loading');
    }

    private setupMenuListeners(): void {
        console.log("Menü listener’ları ayarlanıyor");
        const buttons = [
            { id: 'startBtn', action: () => this.emit('startGame') },
            { id: 'characterSelectBtn', action: () => {
                console.log('Karakter seçimi ekranına geçiş');
                this.showMenu('character');
            }},
            { id: 'scoreboardBtn', action: () => this.showMenu('scoreboard') },
            { id: 'settingsBtn', action: () => this.showMenu('settings') },
            { id: 'backFromCharSelect', action: () => {
                console.log('Karakter seçiminden ana menüye dönüş');
                this.showMenu('main');
            }},
            { id: 'backFromKitSelect', action: () => {
                console.log('Silah seçiminden karakter seçimine dönüş');
                this.showMenu('character');
            }},
            { id: 'backFromScoreboard', action: () => this.showMenu('main') },
            { id: 'backFromSettings', action: () => this.showMenu('main') },
            { id: 'confirmCharacter', action: () => this.confirmCharacterSelection() },
            { id: 'confirmKit', action: () => this.confirmKitSelection() },
            { id: 'resumeBtn', action: () => {
                console.log("Devam Et butonuna basıldı");
                this.emit('resumeGame');
            }},
            { id: 'restartBtn', action: () => {
                console.log("Yeniden Başlat butonuna basıldı");
                this.emit('restartGame');
            }},
            { id: 'exitToMainBtn', action: () => {
                console.log("Ana Menüye Dön butonuna basıldı");
                this.emit('exitToMain');
            }}
        ];

        buttons.forEach(({ id, action }) => {
            const button = document.getElementById(id);
            if (button) {
                button.removeEventListener('click', action);
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    console.log(`Buton tıklandı: ${id}`);
                    action();
                }, { once: false });
            } else {
                console.warn(`Buton bulunamadı: ${id}`);
                NotificationManager.getInstance().show(`Buton bulunamadı: ${id}`, 'warning');
            }
        });
    }

    private async initializeMenus(): Promise<void> {
        console.log("Menüler başlatılıyor");
        if (!this.modelsLoader.isLoaded()) {
            console.log("Veri yüklenmedi, initialize çağrılıyor...");
            await this.modelsLoader.initialize();
        }

        this.characters = this.modelsLoader.getAllCharacterData();
        this.kits = this.modelsLoader.getAllKitData();
        if (!this.characters.length || !this.kits.length) {
            console.error("Karakter veya silah verileri yüklenemedi.");
            NotificationManager.getInstance().show('Veriler yüklenemedi!', 'error');
            this.showMenu('main');
            return;
        }

        const menuIds = [
            { key: 'main', id: 'main-menu' },
            { key: 'character', id: 'character-select' },
            { key: 'kit', id: 'kit-select' },
            { key: 'scoreboard', id: 'scoreboard' },
            { key: 'settings', id: 'settings' },
            { key: 'pause', id: 'pause-menu' },
            { key: 'gameOver', id: 'game-over' }
        ];

        menuIds.forEach(({ key, id }) => {
            const element = document.getElementById(id);
            if (element) {
                this.menus.set(key, element);
                console.log(`Menü kaydedildi: ${key} (ID: ${id})`);
            } else {
                console.error(`Menü bulunamadı: ${key} (ID: ${id})`);
                NotificationManager.getInstance().show(`Menü bulunamadı: ${id}`, 'error');
            }
        });

        this.setupMenuListeners();
        this.createCharacterCarousel();
        this.createKitCarousel();
    }

    private createCharacterCarousel(): void {
        console.log("Karakter karakteri oluşturuluyor");
        const characterGrid = document.querySelector('.character-grid');
        if (!characterGrid) {
            console.error("Karakter grid bulunamadı (.character-grid)");
            NotificationManager.getInstance().show('Karakter seçim ekranı yüklenemedi!', 'error');
            this.showMenu('main');
            return;
        }

        characterGrid.innerHTML = this.generateCarouselHTML();
        this.setupCharacterCardListeners();
        this.setupCarouselListeners();
        this.updateCarousel();
    }

    private generateCarouselHTML(): string {
        return `
            <div class="character-carousel-container">
                <div class="character-carousel">
                    <div class="character-cards-wrapper">
                        ${this.characters.map(char => this.generateCharacterCardHTML(char)).join('')}
                    </div>
                </div>
                <button class="carousel-button prev">◄</button>
                <button class="carousel-button next">►</button>
                <div class="character-nav-dots">
                    ${this.characters.map((_, i) => 
                        `<span class="nav-dot${i === 0 ? ' active' : ''}" data-index="${i}"></span>`
                    ).join('')}
                </div>
            </div>`;
    }

    private generateCharacterCardHTML(char: CharacterData): string {
        return `
            <div class="character-card" data-character-id="${char.id}">
                <div class="character-preview">
                    <img src="${char.photoPath}" alt="${char.name}" class="character-image" />
                </div>
                <div class="character-info">
                    <h3>${char.name}</h3>
                    <div class="character-stats">
                        <div class="stat">
                            <span class="stat-label">Speed</span>
                            <div class="stat-bar">
                                <div class="stat-fill" style="width: ${char.stats.speed}%"></div>
                            </div>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Power</span>
                            <div class="stat-bar">
                                <div class="stat-fill" style="width: ${char.stats.power}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="character-selection-info">
                        <small>Last Selected By: ${this.CURRENT_USER}</small>
                        <small>Last Selected: ${this.CURRENT_TIME}</small>
                    </div>
                </div>
            </div>`;
    }

    private createKitCarousel(): void {
        console.log("Kit carousel oluşturuluyor");
        const kitGrid = document.querySelector('.kit-grid');
        if (!kitGrid) {
            console.error("Kit grid bulunamadı (.kit-grid)");
            NotificationManager.getInstance().show('Silah seçim ekranı yüklenemedi!', 'error');
            this.showMenu('main');
            return;
        }

        kitGrid.innerHTML = this.generateKitCarouselHTML();
        this.setupKitCardListeners();
        this.setupKitCarouselListeners();
        this.updateKitCarousel();
    }

    private generateKitCarouselHTML(): string {
        return `
            <div class="kit-carousel-container">
                <div class="kit-carousel">
                    <div class="kit-cards-wrapper">
                        ${this.kits.map(kit => this.generateKitCardHTML(kit)).join('')}
                    </div>
                </div>
                <button class="carousel-button prev">◄</button>
                <button class="carousel-button next">►</button>
                <div class="kit-nav-dots">
                    ${this.kits.map((_, i) => 
                        `<span class="nav-dot${i === 0 ? ' active' : ''}" data-index="${i}"></span>`
                    ).join('')}
                </div>
            </div>`;
    }

    private generateKitCardHTML(kit: KitData): string {
        return `
            <div class="kit-card" data-kit-id="${kit.id}">
                <div class="kit-preview">
                    <img src="${kit.photoPath}" alt="${kit.name}" class="kit-image" />
                </div>
                <div class="kit-info">
                    <h3>${kit.name}</h3>
                    <div class="kit-stats">
                        <div class="stat">
                            <span class="stat-label">Fire Rate</span>
                            <div class="stat-bar">
                                <div class="stat-fill" style="width: ${kit.stats.fireRate}%"></div>
                            </div>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Damage</span>
                            <div class="stat-bar">
                                <div class="stat-fill" style="width: ${kit.stats.damage}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    private setupCharacterCardListeners(): void {
        console.log("Karakter kartı listener’ları ayarlanıyor");
        const cards = document.querySelectorAll('.character-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const characterId = card.getAttribute('data-character-id');
                if (characterId) {
                    console.log(`Karakter seçildi: ${characterId}`);
                    this.selectCharacter(characterId);
                }
            });
        });
    }

    private setupKitCardListeners(): void {
        console.log("Silah kartı listener’ları ayarlanıyor");
        const cards = document.querySelectorAll('.kit-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const kitId = card.getAttribute('data-kit-id');
                if (kitId) {
                    console.log(`Silah seçildi: ${kitId}`);
                    this.selectKit(kitId);
                }
            });
        });
    }

    private setupCarouselListeners(): void {
        console.log("Karakter carousel listener’ları ayarlanıyor");
        const prevBtn = document.querySelector('.character-carousel-container .prev');
        const nextBtn = document.querySelector('.character-carousel-container .next');
        const navDots = document.querySelectorAll('.character-nav-dots .nav-dot');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                console.log("Önceki karakter");
                this.currentCarouselIndex = (this.currentCarouselIndex - 1 + this.characters.length) % this.characters.length;
                this.updateCarousel();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                console.log("Sonraki karakter");
                this.currentCarouselIndex = (this.currentCarouselIndex + 1) % this.characters.length;
                this.updateCarousel();
            });
        }

        navDots.forEach(dot => {
            dot.addEventListener('click', () => {
                const index = parseInt(dot.getAttribute('data-index') || '0');
                console.log(`Karakter nav noktası tıklandı: ${index}`);
                this.currentCarouselIndex = index;
                this.updateCarousel();
            });
        });
    }

    private setupKitCarouselListeners(): void {
        console.log("Silah carousel listener’ları ayarlanıyor");
        const prevBtn = document.querySelector('.kit-carousel-container .prev');
        const nextBtn = document.querySelector('.kit-carousel-container .next');
        const navDots = document.querySelectorAll('.kit-nav-dots .nav-dot');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                console.log("Önceki silah");
                this.currentKitCarouselIndex = (this.currentKitCarouselIndex - 1 + this.kits.length) % this.kits.length;
                this.updateKitCarousel();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                console.log("Sonraki silah");
                this.currentKitCarouselIndex = (this.currentKitCarouselIndex + 1) % this.kits.length;
                this.updateKitCarousel();
            });
        }

        navDots.forEach(dot => {
            dot.addEventListener('click', () => {
                const index = parseInt(dot.getAttribute('data-index') || '0');
                console.log(`Silah nav noktası tıklandı: ${index}`);
                this.currentKitCarouselIndex = index;
                this.updateKitCarousel();
            });
        });
    }

    private updateCarousel(): void {
        console.log(`Karakter carousel güncelleniyor: index ${this.currentCarouselIndex}`);
        const wrapper = document.querySelector('.character-cards-wrapper') as HTMLElement;
        if (wrapper) {
            wrapper.style.transform = `translateX(-${this.currentCarouselIndex * 320}px)`;
        }

        const cards = document.querySelectorAll('.character-card');
        cards.forEach((card, index) => {
            if (index === this.currentCarouselIndex) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

        const navDots = document.querySelectorAll('.character-nav-dots .nav-dot');
        navDots.forEach((dot, index) => {
            if (index === this.currentCarouselIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    private updateKitCarousel(): void {
        console.log(`Silah carousel güncelleniyor: index ${this.currentKitCarouselIndex}`);
        const wrapper = document.querySelector('.kit-cards-wrapper') as HTMLElement;
        if (wrapper) {
            wrapper.style.transform = `translateX(-${this.currentKitCarouselIndex * 320}px)`;
        }

        const cards = document.querySelectorAll('.kit-card');
        cards.forEach((card, index) => {
            if (index === this.currentKitCarouselIndex) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

        const navDots = document.querySelectorAll('.kit-nav-dots .nav-dot');
        navDots.forEach((dot, index) => {
            if (index === this.currentKitCarouselIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    private selectCharacter(characterId: string): void {
        console.log(`Karakter seçiliyor: ${characterId}`);
        document.querySelectorAll('.character-card').forEach(card => {
            card.classList.remove('selected');
        });

        const selectedCard = document.querySelector(`.character-card[data-character-id="${characterId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
            this.characterSelectState.selectedCharacterId = characterId;
            this.characterSelectState.selectionTime = new Date().toISOString();
            localStorage.setItem('characterSelectState', JSON.stringify(this.characterSelectState));
            console.log(`Karakter seçildi: ${characterId}`);
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

    private selectKit(kitId: string): void {
        console.log(`Silah seçiliyor: ${kitId}`);
        document.querySelectorAll('.kit-card').forEach(card => {
            card.classList.remove('selected');
        });

        const selectedCard = document.querySelector(`.kit-card[data-kit-id="${kitId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
            this.characterSelectState.selectedKitId = kitId;
            this.characterSelectState.selectionTime = new Date().toISOString();
            localStorage.setItem('characterSelectState', JSON.stringify(this.characterSelectState));
            console.log(`Silah seçildi: ${kitId}`);
            const index = this.kits.findIndex(kit => kit.id === kitId);
            if (index !== -1) {
                this.currentKitCarouselIndex = index;
                this.updateKitCarousel();
            }
        } else {
            console.error(`Silah kartı bulunamadı: ${kitId}`);
            NotificationManager.getInstance().show(`Silah kartı bulunamadı: ${kitId}`, 'error');
        }
    }

    private confirmCharacterSelection(): void {
        if (!this.characterSelectState.selectedCharacterId) {
            NotificationManager.getInstance().show('Lütfen bir karakter seçin!', 'error');
            return;
        }
        this.characterSelectState.isCharacterConfirmed = true;
        localStorage.setItem('characterSelectState', JSON.stringify(this.characterSelectState));
        NotificationManager.getInstance().show('Karakter seçimi onaylandı!', 'success');
        this.showMenu('kit');
    }

    private confirmKitSelection(): void {
        if (!this.characterSelectState.selectedKitId) {
            NotificationManager.getInstance().show('Lütfen bir silah seçin!', 'error');
            return;
        }
        this.characterSelectState.isKitConfirmed = true;
        localStorage.setItem('characterSelectState', JSON.stringify(this.characterSelectState));
        NotificationManager.getInstance().show('Silah seçimi onaylandı!', 'success');
        this.emit('characterSelected', this.characterSelectState.selectedCharacterId, this.characterSelectState.selectedKitId);
        this.showMenu('main');
    }

    public getSelectedCharacterId(): string | null {
        return this.characterSelectState.isCharacterConfirmed ? this.characterSelectState.selectedCharacterId : null;
    }

    public getSelectedKit(): string | null {
        return this.characterSelectState.isKitConfirmed ? this.characterSelectState.selectedKitId : null;
    }

    public cleanup(): void {
        console.log("MenuManager temizleniyor");
        this.isLoading = false;
        document.body.classList.remove('loading');
    }

    public showMenu(menuId: string): void {
        console.log(`Menü gösteriliyor: ${menuId}`);
        this.menus.forEach((menu, key) => {
            if (menu) {
                menu.classList.add('hidden');
                console.log(`Menü gizlendi: ${key}`);
            }
        });

        if (menuId !== 'none') {
            const newMenu = this.menus.get(menuId);
            if (newMenu) {
                newMenu.classList.remove('hidden');
                this.activeMenu = menuId;
                console.log(`Yeni menü gösterildi: ${menuId}`);
                if (menuId === 'pause') {
                    console.log("Pause menüsü gösteriliyor, butonlar kontrol ediliyor...");
                    ['resumeBtn', 'restartBtn', 'exitToMainBtn'].forEach(btnId => {
                        const btn = document.getElementById(btnId);
                        if (!btn) {
                            console.error(`Pause menü butonu bulunamadı: ${btnId}`);
                            NotificationManager.getInstance().show(`Buton bulunamadı: ${btnId}`, 'error');
                        } else {
                            console.log(`Buton bulundu: ${btnId}`);
                        }
                    });
                }
            } else {
                console.error(`Menü bulunamadı: ${menuId}`);
                NotificationManager.getInstance().show(`Menü bulunamadı: ${menuId}`, 'error');
                this.showMenu('main');
            }
        } else {
            this.activeMenu = null;
            console.log("Tüm menüler gizlendi");
        }
    }
}
