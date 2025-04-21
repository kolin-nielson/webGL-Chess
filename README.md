# WebGL Chess




A browser-based 3D Chess game powered by WebGL2 and JavaScript, featuring interactive piece selection, smooth animations, real-time shader effects, and a seamless UI overlay.


## Features
- Fully interactive 3D Chessboard rendered with WebGL2
- Dynamic lighting and environment mapping via a cubemap skybox
- Realistic piece models loaded from OBJ files
- Per-piece highlighting and picking shader for intuitive selection
- Smooth movement and capture animations (jump & stomp)
- Responsive UI overlay with turn indicator, captured pieces list, status display, and FPS counter
- Game logic powered by modular chess rule engine
- Optional Stockfish NNUE integration through WebAssembly for AI opponent

## Technologies Used
- JavaScript (ES6 Modules)
- HTML5 & CSS3
- WebGL2 for low‑level 3D rendering
- glMatrix 3.3.0 for matrix/vector math
- OBJ file parsing and buffer generation
- Custom GLSL shaders for textured and normal‑mapped rendering
- Stockfish NNUE WASM for AI (optional)
- Vanilla DOM manipulation for UI

## Getting Started

### Prerequisites
- A modern web browser with WebGL2 support (e.g. Chrome, Firefox)
- A local HTTP server to serve static assets  
  (`python3 -m http.server 8000` or `npm install -g http-server`)

### Installation
1. Clone the repository:  
   `git clone https://github.com/yourusername/webgl-chess.git`  
2. Navigate into the project directory:  
   `cd webgl-chess`

### Running the Project
1. Start your HTTP server:  
   `python3 -m http.server 8000`  
2. Open your browser and visit:  
   `http://localhost:8000`  
3. Enjoy playing 3D Chess!

## Project Structure
```
webgl-chess/
├── assets/
│   ├── shaders/       # GLSL vertex & fragment shaders
│   ├── textures/      # Diffuse maps & cubemaps
│   └── models/        # OBJ piece & skybox models
├── src/
│   ├── core/          # Entry point & main loop
│   ├── render/        # WebGL helpers, object loading, ChessSet class
│   ├── math/          # Chess rules & utility math functions
│   └── ui/            # DOM‑based UI controls & overlays
├── index.html         # Single HTML entry point
├── package.json       # (Optional) npm scripts & dependencies
└── README.md          # This file
```

## Gameplay & Controls
- Click a piece to select it; valid move targets highlight on the board.
- Click a highlighted square to move the piece.
- Capture animations include a jump into place followed by a stomping effect.
- The UI panel displays:
  - Current player turn indicator
  - Move status (Check, Checkmate, Stalemate)
  - Captured pieces grouped by color
  - Real‑time FPS counter
- Press the browser's reload button to start a new game.

## Architecture Overview
- **Core (`src/core`)**: Initializes WebGL context, sets up camera, handles input events, and orchestrates the render loop.
- **Render (`src/render`)**: Loads models/textures, manages buffer and VAO creation, and implements `ChessSet` with drawing logic.
- **Math (`src/math`)**: Implements chess rules, move validation, and geometric utilities (ray picking).
- **UI (`src/ui`)**: Manages on‑screen overlays, turn/ status updates, and FPS counter.
- **Shaders (`assets/shaders`)**: Custom GLSL code for textured rendering, highlighting, and object picking.

## Future Improvements
- AI opponent integration using the Stockfish WASM module.
- Online multiplayer through WebRTC or WebSocket servers.
- Mobile/touch support with gesture controls.
- Enhanced PBR shaders and post‑processing effects.

## Contributing
1. Fork the repo.
2. Create a new feature branch: `git checkout -b feature/fooBar`
3. Commit your changes: `git commit -am 'Add fooBar feature'`
4. Push to the branch: `git push origin feature/fooBar`
5. Open a Pull Request.

## License
This project is licensed under the MIT License.  
See [LICENSE](LICENSE) for details. 