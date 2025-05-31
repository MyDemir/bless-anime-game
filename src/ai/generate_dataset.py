import numpy as np
import pandas as pd
import json
import os

# Sabitler
LEVEL_RANGE = (1, 10)  # Alpha sürüm için seviye aralığını küçülttük (1-10)
ENEMY_TYPES = ['basic', 'fast', 'aggressive', 'defensive']  # Düşman türleri
BUILDING_IDS = ['building-type-a', 'building-type-b', 'building-type-c', 'building-type-d']  # Bina türleri
REGIONS = {'suburb': 0, 'city_center': 1}  # Bölge kodları
MAP_SIZE = 100  # Harita boyutu (x, z: -50 to 50)
MAX_ENEMY_COUNT = 20  # Alpha sürüm için maksimum düşman sayısı
MAX_BUILDING_COUNT = 10  # Alpha sürüm için maksimum bina sayısı

# 1. enemy_selection_data.json oluşturma
def generate_enemy_data(num_samples=500):  # Daha küçük veri seti
    data = []
    for _ in range(num_samples):
        level = np.random.randint(LEVEL_RANGE[0], LEVEL_RANGE[1] + 1)
        enemy_count = np.random.randint(1, min(MAX_ENEMY_COUNT, level * 2))  # Seviyeye göre düşman sayısı
        map_density = np.random.uniform(0.1, 0.6)  # Daha küçük harita için düşük yoğunluk
        player_health = np.random.uniform(20, 100)  # Oyuncu sağlığı
        player_power = np.random.uniform(50, 100)  # Oyuncu gücü
        enemy_type_idx = np.random.choice(len(ENEMY_TYPES))  # Rastgele düşman türü
        spawn_count = np.random.randint(1, max(2, level // 3))  # Seviyeye göre spawn sayısı

        data.append({
            "level": level,
            "enemy_count": enemy_count,
            "map_density": map_density,
            "player_health": player_health,
            "player_power": player_power,
            "enemy_type": enemy_type_idx,  # 0: basic, 1: fast, 2: aggressive, 3: defensive
            "spawn_count": spawn_count
        })
    
    return data

# 2. structure_placement_data.json oluşturma
def generate_structure_data(num_samples=500):  # Daha küçük veri seti
    data = []
    for _ in range(num_samples):
        level = np.random.randint(LEVEL_RANGE[0], LEVEL_RANGE[1] + 1)
        building_count = np.random.randint(1, min(MAX_BUILDING_COUNT, level))  # Seviyeye göre bina sayısı
        region = np.random.choice(list(REGIONS.keys()))  # Rastgele bölge
        building_id = np.random.choice(BUILDING_IDS)  # Rastgele bina türü
        x = np.random.uniform(-MAP_SIZE / 2, MAP_SIZE / 2)  # X koordinatı (-50 to 50)
        z = np.random.uniform(-MAP_SIZE / 2, MAP_SIZE / 2)  # Z koordinatı (-50 to 50)

        data.append({
            "level": level,
            "building_count": building_count,
            "region": REGIONS[region],  # 0: suburb, 1: city_center
            "building_id": building_id,
            "x": x,
            "z": z
        })
    
    return data

# Veri setlerini dosyaya kaydet
def save_data(data, filename):
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"{filename} oluşturuldu: {len(data)} kayıt")

# Ana fonksiyon
def main():
    # Dizin oluştur
    os.makedirs('public/data', exist_ok=True)
    
    # Düşman veri setini oluştur ve kaydet
    enemy_data = generate_enemy_data(500)
    save_data(enemy_data, 'public/data/enemy_selection_data.json')
    
    # Yapı veri setini oluştur ve kaydet
    structure_data = generate_structure_data(500)
    save_data(structure_data, 'public/data/structure_placement_data.json')

if __name__ == "__main__":
    main()
