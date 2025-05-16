# bless-anime-game

bless-anime-game/
├── bls.toml              # Bless project config
├── src/                  # Source files
│   ├── index.ts         # Entry point
│   ├── core/            # Core game systems
│   │   ├── Game.ts
│   │   ├── AI/
│   │   ├── Physics/
│   │   └── Renderer/
│   ├── models/          # Game models
│   │   ├── characters/
│   │   └── weapons/
│   ├── utils/           # Utility functions
│   │   ├── EventEmitter.ts
│   │   └── loadModels.ts
│   └── ui/              # UI components
│       ├── MenuManager.ts
│       └── components/
├── public/              # Static assets
│   ├── models/
│   └── textures/
├── tests/               # Test files
├── tsconfig.base.json   # Base TS config
├── tsconfig.debug.json  # Debug TS config
├── tsconfig.release.json# Release TS config
└── package.json         # Dependencies
