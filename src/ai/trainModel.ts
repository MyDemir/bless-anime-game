import * as tf from '@tensorflow/tfjs';
import { NotificationManager } from '../core/NotificationManager';
import { ModelsLoader } from '../utils/loadModels'; // ModelsLoader'ı import et

interface EnemyData {
  level: number;
  enemy_count: number;
  map_density: number;
  player_health: number;
  player_power: number;
  enemy_type: number;
  spawn_count: number;
}

interface StructureData {
  level: number;
  building_count: number;
  region: number;
  building_id: string;
  x: number;
  z: number;
}

async function loadData<T>(file: string, fallbackData: T[] = []): Promise<T[]> {
  try {
    const response = await fetch(`/data/${file}`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Veri dosyası yüklenemedi: ${file} (${response.status})`);
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      console.log(`${file} yüklendi: ${data.length} kayıt`);
      
      // Veri doğrulama
      if (!Array.isArray(data)) {
        throw new Error(`Geçersiz veri formatı: ${file} bir dizi olmalı`);
      }

      // Enemy selection data için doğrulama
      if (file === 'enemy_selection_data.json') {
        data.forEach((item: any, index: number) => {
          if (!item.level || !item.enemy_count || !item.map_density || 
              !item.player_health || !item.player_power || 
              typeof item.enemy_type !== 'number' || !item.spawn_count) {
            throw new Error(`Eksik veya geçersiz düşman verisi: index ${index}`);
          }
        });
      }

      // Structure placement data için doğrulama
      if (file === 'structure_placement_data.json') {
        data.forEach((item: any, index: number) => {
          if (!item.level || !item.building_count || typeof item.region !== 'number' || 
              !item.building_id || typeof item.x !== 'number' || typeof item.z !== 'number') {
            throw new Error(`Eksik veya geçersiz yapı verisi: index ${index}`);
          }
        });
      }

      return data;
    } catch (e) {
      console.error(`JSON parse veya doğrulama hatası (${file}):`, e);
      NotificationManager.getInstance().show(`${file} veri hatası: ${e.message}`, 'error');
      return fallbackData;
    }
  } catch (error) {
    console.error(`Veri yükleme hatası (${file}):`, error);
    NotificationManager.getInstance().show(`${file} yüklenemedi!`, 'error');
    return fallbackData;
  }
}

function validateData(data: any[], file: string): void {
  if (!Array.isArray(data)) throw new Error(`Geçersiz veri formatı: ${file} bir dizi olmalı`);
  data.forEach((item, index) => {
    if (typeof item !== 'object') throw new Error(`Geçersiz veri: ${file} [${index}] bir nesne olmalı`);
  });
}

async function trainEnemyModel(modelsLoader: ModelsLoader): Promise<tf.LayersModel> {
  const data: EnemyData[] = await loadData<EnemyData>('enemy_selection_data.json', [
    { level: 1, enemy_count: 1, map_density: 0.3, player_health: 100, player_power: 70, enemy_type: 0, spawn_count: 1 }
  ]);
  if (!data.length) {
    console.warn('Düşman verisi boş, yedek model kullanılıyor');
    NotificationManager.getInstance().show('Düşman verisi eksik!', 'warning');
  }

  const xs = tf.tensor2d(data.map(d => [
    d.level / 10,
    d.enemy_count / 20,
    d.map_density,
    d.player_health / 100,
    d.player_power / 100
  ]));
  const ys = tf.tensor2d(data.map(d => [
    ...tf.oneHot([d.enemy_type], 4).dataSync(),
    d.spawn_count / 5
  ]));

  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [5] }));
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 5, activation: 'softmax' }));

  model.compile({
    optimizer: 'adam',
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  await model.fit(xs, ys, {
    epochs: 50,
    batchSize: 32,
    validationSplit: 0.2,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(`Epoch ${epoch}: loss = ${logs?.loss}, accuracy = ${logs?.accuracy}`);
      }
    }
  });

  xs.dispose();
  ys.dispose();

  // Modeli localStorage'a kaydet
  await model.save('localstorage://enemy-selection-model');
  return model;
}

async function trainStructureModel(modelsLoader: ModelsLoader): Promise<tf.LayersModel> {
  const data: StructureData[] = await loadData<StructureData>('structure_placement_data.json', [
    { level: 1, building_count: 1, region: 0, building_id: 'building-type-a', x: 0, z: 0 }
  ]);
  if (!data.length) {
    console.warn('Yapı verisi boş, yedek model kullanılıyor');
    NotificationManager.getInstance().show('Yapı verisi eksik!', 'warning');
  }

  const buildingIdMap: { [key: string]: number } = {
    'building-type-a': 0,
    'building-type-b': 1,
    'building-type-c': 2,
    'building-type-d': 3
  };
  const xs = tf.tensor2d(data.map(d => [d.level / 10, d.building_count / 10, d.region]));
  const ys = tf.tensor2d(data.map(d => [
    buildingIdMap[d.building_id] / 3,
    (d.x + 50) / 100,
    (d.z + 50) / 100
  ]));

  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [3] }));
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 3, activation: 'sigmoid' }));

  model.compile({
    optimizer: 'adam',
    loss: 'meanSquaredError',
    metrics: ['accuracy']
  });

  await model.fit(xs, ys, {
    epochs: 50,
    batchSize: 32,
    validationSplit: 0.2,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(`Epoch ${epoch}: loss = ${logs?.loss}, accuracy = ${logs?.accuracy}`);
      }
    }
  });

  xs.dispose();
  ys.dispose();
  
  // Modeli localStorage'a kaydet
  await model.save('localstorage://structure-placement-model');
  return model;
}

async function trainModels(modelsLoader: ModelsLoader): Promise<void> {
  try {
    const [enemyModel, structureModel] = await Promise.all([
      trainEnemyModel(modelsLoader),
      trainStructureModel(modelsLoader)
    ]);

    // ModelsLoader'ı yeniden başlat
    await modelsLoader.initialize();

    console.log('Modeller eğitildi ve kaydedildi');
    NotificationManager.getInstance().show('AI modelleri eğitildi!', 'success');
  } catch (error) {
    console.error('Model eğitimi hatası:', error);
    NotificationManager.getInstance().show('Model eğitimi başarısız!', 'error');
    throw error;
  }
}

export { trainModels, trainEnemyModel, trainStructureModel };
