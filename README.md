bless-anime-game/
├── bls.toml              # Bless project config
├── index.ts               # Entry point
├── src/                  # Source files
│   ├── core/            # Core game systems
│   │   ├── Game.ts      # Main game logic
│   │   └── MenuManager.ts
│   │   └── ErrorManager.ts
│   │   └── main.ts         
│   │   └── NotificationManager.ts
│   ├── utils/           # Utility functions
│   │   ├── EventEmitter.ts
│   │   └── loadModels.ts
│   ├── ai/           # AI functions
│       ├── AIManager.ts
├── public/              # Static assets
│   └── index.html
│   └── style.css
│   └── data/
│       ├── enemy_selection_data.json  #Düşman türü (temel/hızlı) ve spawn sayısı tahmini için
│       ├── structure_placement_data.json #Yapı ID’si ve konumu (x, z) tahmini için
│       ├── characters.json
│       ├── kits.json
│       ├── cities.json
│   └── models/
│       ├── character/
│               ├── Textures
│               ├── photo  #character photos
│      ├── city-kit/
│               ├── Textures
│               ├── cityv2/
│                 └── Textures
│      └── kit/
│           ├── Textures
│           ├── photo    #kit photos
├── tsconfig.base.json   # Base TS config
├── tsconfig.debug.json  # Debug TS config
├── tsconfig.release.json# Release TS config
└── package.json         # Dependencies
