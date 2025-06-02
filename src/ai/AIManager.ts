import { trainModels } from './trainModel';
import * as THREE from 'three';
import * as tf from '@tensorflow/tfjs';
import { ModelsLoader } from '../utils/loadModels';
import { NotificationManager } from '../core/NotificationManager';
import { ErrorManager } from '../core/ErrorManager';

interface Task {
  id: number;
  description: string;
  target: number;
  progress: number;
  reward: number;
  createdAt: string;
  completedAt?: string;
}

interface Enemy {
  id: string;
  model: THREE.Object3D;
  health: number;
  speed: number;
  damage: number;
  type: string;
  lastUpdate: number;
  created: string;
}

interface AIPerformanceMetrics {
  predictions: number;
  avgPredictionTime: number;
  cacheHits: number;
  cacheMisses: number;
  lastUpdated: string;
}

export class AIManager {
  private modelsLoader: ModelsLoader;
  private scene: THREE.Scene;
  private enemyModel: tf.LayersModel | null = null;
  private structureModel: tf.LayersModel | null = null;
  private enemies: Enemy[] = [];
  private structures: THREE.Object3D[] = [];
  private currentTask: Task | null = null;
  private nextTaskId: number = 1;
  private modelCache = new Map<string, { prediction: tf.Tensor; timestamp: number }>();
  private metrics: AIPerformanceMetrics = {
    predictions: 0,
    avgPredictionTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastUpdated: new Date().toISOString()
  };
  private readonly CACHE_TTL = 5000;
  private readonly MAX_CACHE_SIZE = 100;
  private readonly MAX_ENEMIES = 20; // Alpha için düşürüldü
  private readonly PERFORMANCE_THRESHOLD = 30;
  private readonly MAP_BOUNDS = 50; // 100x100 harita için

  constructor(modelsLoader: ModelsLoader, scene: THREE.Scene) {
    this.modelsLoader = modelsLoader;
    this.scene = scene;
    this.startPerformanceMonitoring();
  }

  public async loadModels(): Promise<void> {
    try {
      // Göreceli yolları kullanarak modelleri yüklemeyi dene
      this.enemyModel = await tf.loadLayersModel('/enemy-selection-model/model.json').catch(() => null);
      this.structureModel = await tf.loadLayersModel('/structure-placement-model/model.json').catch(() => null);

      if (!this.enemyModel || !this.structureModel) {
        console.log('AI modelleri bulunamadı, yeni modeller eğitiliyor...');
        await trainModels(this.modelsLoader);
        
        // Yeni eğitilen modelleri yüklemeyi dene
        this.enemyModel = await tf.loadLayersModel('/enemy-selection-model/model.json');
        this.structureModel = await tf.loadLayersModel('/structure-placement-model/model.json');
        
        if (!this.enemyModel || !this.structureModel) {
          throw new Error('AI modelleri yüklenemedi ve oluşturulamadı');
        }
      }

      console.log('AI modelleri başarıyla yüklendi');
      NotificationManager.getInstance().show('AI modelleri yüklendi!', 'success');
    } catch (error) {
      console.error('AI modelleri yüklenemedi:', error);
      NotificationManager.getInstance().show('AI modelleri yüklenemedi!', 'error');
      throw error;
    }
  }

  async spawnEnemy(level: number, enemyCount: number, mapDensity: number, playerStats: { health: number; power: number }): Promise<Enemy[]> {
    if (!this.enemyModel || this.enemies.length >= this.MAX_ENEMIES) return [];

    const startTime = performance.now();
    const cacheKey = `enemy_${level}_${enemyCount}_${mapDensity}_${playerStats.health}_${playerStats.power}`;
    const spawnedEnemies: Enemy[] = [];

    try {
      let prediction: tf.Tensor;
      const cached = this.modelCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
        prediction = cached.prediction;
        this.metrics.cacheHits++;
      } else {
        const input = tf.tensor2d([[
          level / 10,
          enemyCount / 20,
          mapDensity,
          playerStats.health / 100,
          playerStats.power / 100
        ]]);
        prediction = this.enemyModel.predict(input) as tf.Tensor;
        input.dispose();
        this.modelCache.set(cacheKey, { prediction, timestamp: Date.now() });
        this.metrics.cacheMisses++;
        if (this.modelCache.size > this.MAX_CACHE_SIZE) {
          const oldestKey = Array.from(this.modelCache.keys())[0];
          this.modelCache.get(oldestKey)?.prediction.dispose();
          this.modelCache.delete(oldestKey);
        }
      }

      const output = await prediction.data();
      const [basicProb, fastProb, aggressiveProb, defensiveProb, spawnCount] = output;
      const enemyTypeProbs = [basicProb, fastProb, aggressiveProb, defensiveProb];
      const enemyTypeIdx = enemyTypeProbs.indexOf(Math.max(...enemyTypeProbs));
      const enemyType = ['basic', 'fast', 'aggressive', 'defensive'][enemyTypeIdx];

      const characterData = this.modelsLoader.getAllCharacterData();
      const characterIds = characterData.map(c => c.id);

      for (let i = 0; i < Math.round(spawnCount * 5); i++) {
        if (this.enemies.length >= this.MAX_ENEMIES) break;
        const id = characterIds[Math.floor(Math.random() * characterIds.length)];
        const model = this.modelsLoader.getModel(id);
        if (!model) {
          console.warn(`Karakter modeli eksik: ${id}`);
          continue;
        }

        const instance = model.scene.clone();
        const position = this.findSafeSpawnPosition();
        instance.position.copy(position);

        const enemy: Enemy = {
          id: `${id}_${Date.now()}_${i}`,
          model: instance,
          health: level * 50 * (playerStats.health < 50 ? 0.8 : 1.2),
          speed: enemyType === 'fast' ? 80 : enemyType === 'aggressive' ? 60 : enemyType === 'defensive' ? 40 : 50,
          damage: enemyType === 'aggressive' ? 20 : enemyType === 'defensive' ? 10 : 15,
          type: enemyType,
          lastUpdate: Date.now(),
          created: new Date().toISOString()
        };

        this.applyEnemyBehavior(enemy, playerStats);
        this.enemies.push(enemy);
        this.scene.add(instance);
        spawnedEnemies.push(enemy);
      }

      this.updateMetrics(startTime);
      return spawnedEnemies;
    } catch (error) {
      ErrorManager.getInstance().handleError(error as Error, 'AIManager.spawnEnemy');
      return spawnedEnemies;
    }
  }

  private findSafeSpawnPosition(): THREE.Vector3 {
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const position = new THREE.Vector3(
        Math.random() * 100 - 50,
        0,
        Math.random() * 100 - 50
      );

      if (this.isPositionSafe(position)) {
        return position;
      }
      attempts++;
    }

    return new THREE.Vector3(0, 0, -40);
  }

  private isPositionSafe(position: THREE.Vector3): boolean {
    const minDistance = 10; // Küçük harita için azaltıldı

    for (const enemy of this.enemies) {
      if (position.distanceTo(enemy.model.position) < minDistance) {
        return false;
      }
    }

    for (const structure of this.structures) {
      if (position.distanceTo(structure.position) < minDistance) {
        return false;
      }
    }

    return true;
  }

  private applyEnemyBehavior(enemy: Enemy, playerStats: { health: number; power: number }): void {
    const interval = setInterval(() => {
      const enemyInstance = this.enemies.find(e => e.id === enemy.id);
      if (!enemyInstance || enemyInstance.health <= 0) {
        clearInterval(interval);
        return;
      }

      const now = Date.now();
      const deltaTime = (now - enemyInstance.lastUpdate) / 1000;
      enemyInstance.lastUpdate = now;

      const player = this.scene.getObjectByName('player');
      if (!player) return;

      const direction = player.position.clone().sub(enemyInstance.model.position).normalize();
      const distance = enemyInstance.model.position.distanceTo(player.position);

      switch (enemyInstance.type) {
        case 'basic':
          enemyInstance.model.position.addScaledVector(direction, enemyInstance.speed * deltaTime);
          break;
        case 'fast':
          const offset = Math.sin(now / 1000) * 0.3;
          enemyInstance.model.position.addScaledVector(direction, enemyInstance.speed * deltaTime);
          enemyInstance.model.position.x += offset;
          break;
        case 'aggressive':
          if (distance < 5) {
            enemyInstance.model.position.addScaledVector(direction, enemyInstance.speed * 1.5 * deltaTime);
          } else {
            enemyInstance.model.position.addScaledVector(direction, enemyInstance.speed * deltaTime);
          }
          break;
        case 'defensive':
          if (distance < 10) {
            enemyInstance.model.position.addScaledVector(direction.negate(), enemyInstance.speed * deltaTime);
          }
          break;
      }

      this.keepInBounds(enemyInstance.model.position);
    }, 1000 / 60);
  }

  private keepInBounds(position: THREE.Vector3): void {
    position.x = Math.max(-this.MAP_BOUNDS, Math.min(this.MAP_BOUNDS, position.x));
    position.z = Math.max(-this.MAP_BOUNDS, Math.min(this.MAP_BOUNDS, position.z));
  }

  async addStructure(level: number, buildingCount: number, region: string): Promise<void> {
    if (!this.structureModel) return;

    try {
      const regionId = region === 'suburb' ? 0 : 1;
      const input = tf.tensor2d([[
        level / 10,
        buildingCount / 10,
        regionId
      ]]);

      const prediction = this.structureModel.predict(input) as tf.Tensor;
      const [buildingIdx, xNorm, zNorm] = await prediction.data();

      input.dispose();
      prediction.dispose();

      const buildingIds = ['building-type-a', 'building-type-b', 'building-type-c', 'building-type-d'];
      const id = buildingIds[Math.round(buildingIdx * 3)];
      const x = xNorm * 100 - 50; // 0-1 -> -50 to 50
      const z = zNorm * 100 - 50;

      const cityData = this.modelsLoader.getCityData();
      const building = cityData.buildings.find(b => b.id === id);
      if (!building) {
        console.warn(`Bina bulunamadı: ${id}`);
        return;
      }

      const position = new THREE.Vector3(x, 0, z);
      if (!this.checkCollision(position, building.size)) {
        return;
      }

      const model = this.modelsLoader.getModel(id);
      if (!model) {
        console.warn(`Bina modeli eksik: ${id}`);
        NotificationManager.getInstance().show(`Bina yüklenemedi: ${building.name}`, 'warning');
        return;
      }

      const instance = model.scene.clone();
      instance.position.copy(position);
      instance.scale.setScalar(2); // Küçük harita için ölçek azaltıldı
      instance.userData = {
        type: 'building',
        id,
        created: new Date().toISOString()
      };

      this.structures.push(instance);
      this.scene.add(instance);
    } catch (error) {
      ErrorManager.getInstance().handleError(error as Error, 'AIManager.addStructure');
    }
  }

  async generateMap(level: number, region: string): Promise<void> {
    try {
      // Model yükleme kontrolü
      if (!this.modelsLoader.isLoaded()) {
        console.log('Modeller henüz yüklenmedi, yükleme başlatılıyor...');
        await this.modelsLoader.initialize();
      }

      console.log(`Harita üretiliyor - Level: ${level}, Bölge: ${region}`);
      const buildingCount = Math.min(10, level * 2);

      // Mevcut yapıları temizle
      this.structures.forEach(structure => this.scene.remove(structure));
      this.structures = [];

      const cityData = this.modelsLoader.getCityData();
      if (!cityData) {
        throw new Error('Şehir verileri yüklenemedi');
      }

      // Binaları ekle
      const buildings = cityData.buildings || [];
      for (let i = 0; i < buildingCount && i < buildings.length; i++) {
        const building = buildings[i];
        if (building && building.id) {
          await this.addStructure(level, buildingCount, region);
        }
      }
      
      // Yolları ekle
      const roads = (cityData.roads || []).filter(r => r && r.region && r.region.includes(region));
      if (roads.length > 0) {
        for (let i = 0; i < Math.min(3, level); i++) {
          const road = roads[Math.floor(Math.random() * roads.length)];
          if (road && road.id) {
            const model = this.modelsLoader.getModel(road.id);
            if (model) {
              const instance = model.scene.clone();
              const position = this.findSafeSpawnPosition();
              instance.position.copy(position);
              instance.scale.setScalar(2);
              this.scene.add(instance);
              this.structures.push(instance);
            }
          }
        }
      }

      // Çevre elemanlarını ekle
      const props = (cityData.props || []).filter(p => p && p.region && p.region.includes(region));
      if (props.length > 0) {
        for (let i = 0; i < Math.min(5, level * 2); i++) {
          const prop = props[Math.floor(Math.random() * props.length)];
          if (prop && prop.id) {
            const model = this.modelsLoader.getModel(prop.id);
            if (model) {
              const instance = model.scene.clone();
              const position = this.findSafeSpawnPosition();
              instance.position.copy(position);
              instance.scale.setScalar(2);
              this.scene.add(instance);
              this.structures.push(instance);
            }
          }
        }
      }

      console.log(`Harita üretimi tamamlandı - ${this.structures.length} yapı yerleştirildi`);
      NotificationManager.getInstance().show('Harita başarıyla oluşturuldu!', 'success');
    } catch (error) {
      console.error('Harita üretim hatası:', error);
      NotificationManager.getInstance().show('Harita oluşturulurken hata oluştu!', 'error');
      throw error;
    }
  }

  private checkCollision(position: THREE.Vector3, size: { width: number; depth: number }): boolean {
    const minDistance = Math.max(size.width, size.depth) * 2 + 5; // Küçük harita için azaltıldı
    for (const obj of this.structures) {
      const dist = position.distanceTo(obj.position);
      if (dist < minDistance) {
        return false;
      }
    }
    return true;
  }

  generateDynamicTask(level: number): void {
    const target = level * 2;
    const reward = level * 50;
    this.currentTask = {
      id: this.nextTaskId++,
      description: `Seviye ${level} için ${target} düşman yen`,
      target,
      progress: 0,
      reward,
      createdAt: new Date().toISOString()
    };
  }

  updateTaskProgress(increment: boolean): void {
    if (this.currentTask && increment) {
      this.currentTask.progress++;
      if (this.currentTask.progress >= this.currentTask.target) {
        this.currentTask.completedAt = new Date().toISOString();
      }
    }
  }

  spawnEvent(level: number): void {
    const events = [
      { type: 'health_kit', minLevel: 2, chance: 0.3 },
      { type: 'speed_boost', minLevel: 3, chance: 0.2 },
      { type: 'power_up', minLevel: 4, chance: 0.1 }
    ];

    for (const event of events) {
      if (level >= event.minLevel && Math.random() < event.chance) {
        this.createEventItem(event.type);
      }
    }
  }

  private createEventItem(type: string): void {
    const modelMap = {
      'health_kit': 'detail-parasol',
      'speed_boost': 'detail-speed',
      'power_up': 'detail-power'
    };

    const modelId = modelMap[type as keyof typeof modelMap];
    const model = this.modelsLoader.getModel(modelId);
    if (!model) {
      console.warn(`Prop modeli eksik: ${modelId}`);
      return;
    }

    const instance = model.scene.clone();
    const position = this.findSafeSpawnPosition();
    instance.position.copy(position);
    instance.scale.setScalar(2);
    instance.userData = {
      type: 'prop',
      effect: type,
      created: new Date().toISOString()
    };

    this.scene.add(instance);
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.metrics.lastUpdated = new Date().toISOString();
      for (const [key, value] of this.modelCache.entries()) {
        if (Date.now() - value.timestamp > this.CACHE_TTL) {
          value.prediction.dispose();
          this.modelCache.delete(key);
        }
      }
      this.enemies = this.enemies.filter(enemy => enemy.health > 0);
    }, 5000);
  }

  private updateMetrics(startTime: number): void {
    const predictionTime = performance.now() - startTime;
    this.metrics.predictions++;
    this.metrics.avgPredictionTime =
      (this.metrics.avgPredictionTime * (this.metrics.predictions - 1) + predictionTime) / this.metrics.predictions;
  }

  public getMetrics(): AIPerformanceMetrics {
    return { ...this.metrics };
  }

  public getEnemies(): Enemy[] {
    return this.enemies;
  }

  public getStructures(): THREE.Object3D[] {
    return this.structures;
  }

  public getCurrentTask(): Task | null {
    return this.currentTask;
  }

  public dispose(): void {
    this.modelCache.forEach(cached => cached.prediction.dispose());
    this.modelCache.clear();
    if (this.enemyModel) {
      this.enemyModel.dispose();
      this.enemyModel = null;
    }
    if (this.structureModel) {
      this.structureModel.dispose();
      this.structureModel = null;
    }
    this.enemies.forEach(enemy => this.scene.remove(enemy.model));
    this.structures.forEach(structure => this.scene.remove(structure));
    this.enemies = [];
    this.structures = [];
  }
}
