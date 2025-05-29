import { trainModels } from './trainModel';
import * as THREE from 'three';
import * as tf from '@tensorflow/tfjs';
import { ModelsLoader } from '../utils/loadModels';
import { NotificationManager } from '../core/NotificationManager';
import { ErrorManager } from './../core/ErrorManager';

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
  private enemies: Array<{ model: THREE.Object3D; speed: number; health: number; type: string; damage: number }> = [];
  private structures: THREE.Object3D[] = [];
  private currentTask: { description: string; progress: number; target: number; reward: number } | null = null;
  private nextTaskId: number = 1;
  private modelCache = new Map<string, {
    prediction: tf.Tensor;
    timestamp: number;
  }>();
  private metrics: AIPerformanceMetrics = {
    predictions: 0,
    avgPredictionTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastUpdated: new Date().toISOString()
  };
  private readonly CACHE_TTL = 5000; // 5 saniye cache süresi
  private readonly MAX_CACHE_SIZE = 100;
  private readonly MAX_ENEMIES = 50;
  private readonly PERFORMANCE_THRESHOLD = 30; // FPS

   constructor(modelsLoader: ModelsLoader, scene: THREE.Scene) {
    this.modelsLoader = modelsLoader;
    this.scene = scene;
  }

  public async loadModels(): Promise<void> {
        try {
            const [enemyModel, structureModel] = await Promise.all([
                tf.loadLayersModel('localstorage://enemy-selection-model'),
                tf.loadLayersModel('localstorage://structure-placement-model')
            ]);
            this.enemyModel = enemyModel;
            this.structureModel = structureModel;
            console.log('AI modelleri yüklendi');
        } catch (error) {
            console.error('AI modelleri yüklenemedi:', error);
            NotificationManager.getInstance().show('AI modelleri yüklenemedi!', 'error');
            throw error;
        }
    }

  async spawnEnemy(level: number, enemyCount: number, mapDensity: number): Promise<void> {
    if (!this.enemyModel || this.enemies.length >= this.MAX_ENEMIES) return;

    const startTime = performance.now();
    const cacheKey = `enemy_${level}_${enemyCount}_${mapDensity}`;

    try {
      let prediction: tf.Tensor;
      const cached = this.modelCache.get(cacheKey);

      if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
        prediction = cached.prediction;
        this.metrics.cacheHits++;
      } else {
        const input = tf.tensor2d([[
          level / 10, // Normalize level
          enemyCount / this.MAX_ENEMIES, // Normalize count
          mapDensity
        ]]);
        prediction = this.enemyModel.predict(input) as tf.Tensor;
        input.dispose();
        
        this.modelCache.set(cacheKey, {
          prediction,
          timestamp: Date.now()
        });
        this.metrics.cacheMisses++;
        
        if (this.modelCache.size > this.MAX_CACHE_SIZE) {
          const oldestKey = Array.from(this.modelCache.keys())[0];
          this.modelCache.get(oldestKey)?.prediction.dispose();
          this.modelCache.delete(oldestKey);
        }
      }

      const [enemyType, spawnCount] = await prediction.data();
      const characterData = this.modelsLoader.getAllCharacterData();
      const characterIds = characterData.map(c => c.id);

      for (let i = 0; i < Math.round(spawnCount); i++) {
        if (this.enemies.length >= this.MAX_ENEMIES) break;

        const id = characterIds[Math.floor(Math.random() * characterIds.length)];
        const model = this.modelsLoader.getModel(id);
        if (!model) continue;

        const instance = model.scene.clone();
        const position = this.findSafeSpawnPosition();
        instance.position.copy(position);

        const enemy: Enemy = {
          id: `${id}_${Date.now()}_${i}`,
          model: instance,
          health: level * 50,
          speed: enemyType > 0.5 ? 80 : 50,
          damage: enemyType > 0.5 ? 15 : 20,
          type: enemyType > 0.5 ? 'fast' : 'basic',
          lastUpdate: Date.now(),
          created: new Date().toISOString()
        };

        if (enemy.type === 'fast') {
          this.applyZigzagMovement(enemy.id, level);
        }

        this.enemies.push(enemy);
        this.scene.add(instance);
      }

      this.updateMetrics(startTime);
    } catch (error) {
      ErrorManager.getInstance().handleError(error as Error, 'AIManager.spawnEnemy');
    }
  }

  private findSafeSpawnPosition(): THREE.Vector3 {
    const maxAttempts = 10;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const position = new THREE.Vector3(
        Math.random() * 500 - 250,
        0,
        Math.random() * 500 - 250
      );
      
      if (this.isPositionSafe(position)) {
        return position;
      }
      attempts++;
    }
    
    // Fallback position if no safe spot found
    return new THREE.Vector3(0, 0, -200);
  }

  private isPositionSafe(position: THREE.Vector3): boolean {
    const minDistance = 20; // Minimum güvenli mesafe
    
    // Diğer düşmanlarla çarpışma kontrolü
    for (const enemy of this.enemies) {
      if (position.distanceTo(enemy.model.position) < minDistance) {
        return false;
      }
    }
    
    // Yapılarla çarpışma kontrolü
    for (const structure of this.structures) {
      if (position.distanceTo(structure.position) < minDistance) {
        return false;
      }
    }
    
    return true;
  }

  private applyZigzagMovement(id: string, level: number): void {
    let direction = 1;
    const baseInterval = 1000;
    const interval = setInterval(() => {
      const enemy = this.enemies.find(e => e.id === id);
      if (!enemy) {
        clearInterval(interval);
        return;
      }

      const now = Date.now();
      const deltaTime = (now - enemy.lastUpdate) / 1000;
      enemy.lastUpdate = now;

      const offset = direction * 0.5;
      enemy.model.position.x += offset * enemy.speed * deltaTime;
      direction *= -1;

      // Harita sınırları kontrolü
      this.keepInBounds(enemy.model.position);
    }, baseInterval / level);
  }

  private keepInBounds(position: THREE.Vector3): void {
    const BOUNDS = 250; // 500x500 harita için sınırlar
    position.x = Math.max(-BOUNDS, Math.min(BOUNDS, position.x));
    position.z = Math.max(-BOUNDS, Math.min(BOUNDS, position.z));
  }

  async addStructure(level: number, buildingCount: number, region: string): Promise<void> {
    if (!this.structureModel) return;

    try {
      const regionId = region === 'suburb' ? 0 : 1;
      const input = tf.tensor2d([[
        level / 10, // Normalize level
        buildingCount / 100, // Normalize count
        regionId
      ]]);
      
      const prediction = this.structureModel.predict(input) as tf.Tensor;
      const [buildingIdx, xNorm, zNorm] = await prediction.data();
      
      input.dispose();
      prediction.dispose();

      const buildingIds = ['building-type-a', 'building-type-b', 'building-type-c', 'building-type-d'];
      const id = buildingIds[Math.round(buildingIdx * (buildingIds.length - 1))];
      const x = (xNorm * 100 - 50) * 5;
      const z = (zNorm * 100 - 50) * 5;

      const cityData = this.modelsLoader.getCityData();
      const building = cityData.buildings.find(b => b.id === id);
      if (!building) return;

      const position = new THREE.Vector3(x, 0, z);
      if (!this.checkCollision(position, building.size)) {
        return;
      }

      const model = this.modelsLoader.getModel(id);
      if (!model) return;

      const instance = model.scene.clone();
      instance.position.copy(position);
      instance.scale.setScalar(3);
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

  private checkCollision(position: THREE.Vector3, size: { width: number; depth: number }): boolean {
    const minDistance = Math.max(size.width, size.depth) * 3 + 10;
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
    if (!model) return;

    const instance = model.scene.clone();
    const position = this.findSafeSpawnPosition();
    instance.position.copy(position);
    instance.scale.setScalar(3);
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
      
      // Eski cache girişlerini temizle
      for (const [key, value] of this.modelCache.entries()) {
        if (Date.now() - value.timestamp > this.CACHE_TTL) {
          value.prediction.dispose();
          this.modelCache.delete(key);
        }
      }
      
      // Ölen düşmanları temizle
      this.enemies = this.enemies.filter(enemy => enemy.health > 0);
    }, 5000);
  }

  private updateMetrics(startTime: number): void {
    const predictionTime = performance.now() - startTime;
    this.metrics.predictions++;
    this.metrics.avgPredictionTime = 
      (this.metrics.avgPredictionTime * (this.metrics.predictions - 1) + predictionTime) 
      / this.metrics.predictions;
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
    // Bellek temizleme
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
    
    // Scene temizleme
    this.enemies.forEach(enemy => {
      this.scene.remove(enemy.model);
    });
    this.structures.forEach(structure => {
      this.scene.remove(structure);
    });
    
    this.enemies = [];
    this.structures = [];
  }
}
