import numpy as np
import json
import os

# Sabitler
LEVEL_RANGE = (1, 10)
ENEMY_TYPES = ['basic', 'fast', 'aggressive', 'defensive']
BUILDING_IDS = ['building-type-a', 'building-type-b', 'building-type-c', 'building-type-d']
REGIONS = {'suburb': 0, 'city_center': 1}
MAP_SIZE = 100
MAX_ENEMY_COUNT = 20
MAX_BUILDING_COUNT = 10

def generate_enemy_data(num_samples=500):
    np.random.seed(42)
    data = []
    for _ in range(num_samples):
        level = np.random.randint(LEVEL_RANGE[0], LEVEL_RANGE[1] + 1)
        enemy_count = np.random.randint(1, min(MAX_ENEMY_COUNT, level * 2))
        map_density = float(np.random.uniform(0.1, 0.6))
        player_health = float(np.random.uniform(20, 100))
        player_power = float(np.random.uniform(50, 100))
        enemy_type_idx = int(np.random.choice(len(ENEMY_TYPES)))
        spawn_count = int(np.random.randint(1, max(2, level // 3)))

        data.append({
            "level": level,
            "enemy_count": enemy_count,
            "map_density": map_density,
            "player_health": player_health,
            "player_power": player_power,
            "enemy_type": enemy_type_idx,
            "spawn_count": spawn_count
        })
    return data

def generate_structure_data(num_samples=500):
    np.random.seed(42)
    data = []
    for _ in range(num_samples):
        level = np.random.randint(LEVEL_RANGE[0], LEVEL_RANGE[1] + 1)
        # Eğer level 1 ise building_count = 1, değilse randint ile üret
        if level <= 1:
            building_count = 1
        else:
            building_count = int(np.random.randint(1, min(MAX_BUILDING_COUNT, level)))
        region = np.random.choice(list(REGIONS.keys()))
        building_id = np.random.choice(BUILDING_IDS)
        x = float(np.random.uniform(-MAP_SIZE / 2, MAP_SIZE / 2))
        z = float(np.random.uniform(-MAP_SIZE / 2, MAP_SIZE / 2))

        data.append({
            "level": level,
            "building_count": building_count,
            "region": REGIONS[region],
            "building_id": building_id,
            "x": x,
            "z": z
        })
    return data
    
def save_json(data, filename):
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"{filename} oluşturuldu: {len(data)} kayıt")

def main():
    out_dir = '/kaggle/working'
    os.makedirs(out_dir, exist_ok=True)
    enemy_data = generate_enemy_data(500)
    save_json(enemy_data, os.path.join(out_dir, 'enemy_selection_data.json'))
    structure_data = generate_structure_data(500)
    save_json(structure_data, os.path.join(out_dir, 'structure_placement_data.json'))

if __name__ == "__main__":
    main()
