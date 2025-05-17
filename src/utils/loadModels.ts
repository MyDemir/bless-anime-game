import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Scene } from 'three';

export class ModelsLoader {
    private loader: GLTFLoader;
    private scene: Scene;
    private models: Map<string, GLTF>;

    constructor(scene: Scene) {
        this.loader = new GLTFLoader();
        this.scene = scene;
        this.models = new Map();
    }

    async loadCharacterModels(): Promise<void> {
        try {
            console.log('Karakter modelleri yükleme başlıyor...');
            const modelPaths = {
                ninja: '/models/character/character-female-a.glb',
                samurai: '/models/character/character-male-a.glb',
            };

            console.log('Ninja modeli yükleme denemesi...');
            const ninjaModel = await this.loader.loadAsync(modelPaths.ninja);
            ninjaModel.scene.name = 'ninja';
            this.scene.add(ninjaModel.scene);
            this.models.set('ninja', ninjaModel);
            console.log('Ninja modeli başarıyla yüklendi');

            console.log('Samuray modeli yükleme denemesi...');
            const samuraiModel = await this.loader.loadAsync(modelPaths.samurai);
            samuraiModel.scene.name = 'samurai';
            this.scene.add(samuraiModel.scene);
            this.models.set('samurai', samuraiModel);
            console.log('Samuray modeli başarıyla yüklendi');

            ninjaModel.scene.scale.set(1, 1, 1);
            samuraiModel.scene.scale.set(1, 1, 1);
        } catch (error) {
            console.error('Karakter modelleri yüklenirken spesifik hata:', error);
            if (error instanceof Error) {
                throw new Error(`Karakter modelleri yüklenemedi: ${error.message}`);
            }
            throw new Error('Karakter modelleri yüklenemedi: Bilinmeyen hata');
        }
    }

    async loadBlasterModels(): Promise<void> {
        try {
            console.log('Silah modelleri yükleme başlıyor...');
            const blasterPath = '/models/kit/blaster-r.glb';

            console.log('Blaster modeli yükleme denemesi...');
            const blasterModel = await this.loader.loadAsync(blasterPath);
            blasterModel.scene.name = 'blaster';
            this.scene.add(blasterModel.scene);
            this.models.set('blaster', blasterModel);
            console.log('Blaster modeli başarıyla yüklendi');

            blasterModel.scene.scale.set(1, 1, 1);
        } catch (error) {
            console.error('Silah modeli yüklenirken spesifik hata:', error);
            if (error instanceof Error) {
                throw new Error(`Silah modeli yüklenemedi: ${error.message}`);
            }
            throw new Error('Silah modeli yüklenemedi: Bilinmeyen hata');
        }
    }

    getModel(modelId: string): GLTF | undefined {
        return this.models.get(modelId);
    }
        }
