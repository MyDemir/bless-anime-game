bless-anime-game/
├── bls.toml              # Bless project config
├── src/                  # Source files
│── main.ts               # Entry point
│   ├── core/            # Core game systems
│   │   ├── Game.ts      # Main game logic
│   │   └── MenuManager.ts
│   ├── utils/           # Utility functions
│   │   ├── EventEmitter.ts
│   │   └── loadModels.ts
├── public/              # Static assets
│   └── index.html
│   └── style.css
│   └── models/
│      ├── character/
│      ├── city-kit/
│      └── kit/
├── tsconfig.base.json   # Base TS config
├── tsconfig.debug.json  # Debug TS config
├── tsconfig.release.json# Release TS config
└── package.json         # Dependencies


# Bless Anime Game 🎮

A 3D anime-style action game offering a unique gaming experience with AI-powered enemy behaviors and advanced combat mechanics.

![Game Screenshot](./assets/screenshots/game-preview.png)

## 🎮 Game Information
```
Current Date and Time (UTC): 2025-05-16 09:31:20
Current User's Login: MyDemir
Game Version: 1.0.0
```

## 🌟 Features

### AI and Game Mechanics

- **Intelligent Enemy AI System**
  - Dynamic behavior patterns
  - Adaptive responses to player movements
  - Tactical positioning and targeting
  - Multiple difficulty levels

- **Advanced Combat Mechanics**
  - Precise targeting system
  - Bullet physics simulation
  - Damage zone variations
  - Recoil and weapon control

### Character System

- Customizable anime characters
- Different weapon and ability sets
- Character progression system
- Unique character animations

### User Interface

- Dynamic health and ammo indicators
- Real-time notification system
- Score tracking system
- High score leaderboard

## 🎮 Controls

```
W/↑ - Forward
S/↓ - Backward
A/← - Left
D/→ - Right
SPACE - Jump
Left Mouse Click - Shoot
ESC - Pause Game
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- Modern web browser (Chrome, Firefox, Safari)
- Graphics card with WebGL support

### Installation

1. Clone the repository:
```bash
git clone https://github.com/MyDemir/bless-anime-game.git
```

2. Navigate to project directory:
```bash
cd bless-anime-game
```

3. Install dependencies:
```bash
npm install
```

4. Start development server:
```bash
npm run dev
```

5. Open in your browser:
```
http://localhost:3000
```

## 🛠 Technologies

- Three.js - 3D graphics engine
- TypeScript - Type-safe programming language
- Vite - Build tool and dev server
- WebGL - 3D rendering
- Custom AI System - Enemy behavior system

## 🤖 Artificial Intelligence System

Our game's AI system includes the following features:

### Enemy AI Behaviors

1. **State-Based Decision Making**
   - Combat state
   - Defense state
   - Retreat state
   - Exploration state

2. **Adaptive Difficulty System**
   - Automatic difficulty adjustment based on player performance
   - Dynamic strategy changes
   - Learning-based behavior models

3. **Tactical AI**
   - Environmental analysis
   - Coordinated enemy movements
   - Resource management
   - Target prioritization

## 📝 Version History

### v1.0.0 - Initial Release

- 3D game environment
- Basic character control
- Simple enemy AI system
- Notification system
- User and time management
- Basic combat mechanics
- Score system

## 🎯 Upcoming Features

- [ ] Advanced AI system update
- [ ] New character models
- [ ] New weapon types
- [ ] Special effects and particle systems
- [ ] Sound system
- [ ] Achievement system

## 👥 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contact

MyDemir - [@MyDemirDev](https://twitter.com/MyDemirDev)

Project Link: [https://github.com/MyDemir/bless-anime-game](https://github.com/MyDemir/blaster-anime-game)

## ⚙️ Development Status

The game is currently in active development with regular updates and improvements. The AI system is being continuously enhanced to provide a more challenging and engaging gaming experience.
