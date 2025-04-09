// UI functionality for the chess game

// Chess piece Unicode symbols
const pieceSymbols = {
    pawn: '♟',
    rook: '♜',
    knight: '♞',
    bishop: '♝',
    queen: '♛',
    king: '♚'
};

// Arrays to track captured pieces
let capturedByWhite = [];
let capturedByBlack = [];

// UI elements
let turnDisplay;
let statusDisplay;
let turnDot;
let whiteCapturesContainer;
let blackCapturesContainer;
let gameOverOverlay;
let gameOverText;
let newGameBtn;
let fpsCounter;

// FPS tracking variables
let frameCount = 0;
let lastFpsUpdateTime = 0;
let fps = 60;

// Initialize UI elements
function initUI() {
    turnDisplay = document.getElementById('turn-display');
    statusDisplay = document.getElementById('status-display');
    turnDot = document.getElementById('turn-dot');
    whiteCapturesContainer = document.getElementById('white-captures');
    blackCapturesContainer = document.getElementById('black-captures');
    gameOverOverlay = document.getElementById('game-over-overlay');
    gameOverText = document.getElementById('game-over-text');
    newGameBtn = document.getElementById('new-game-btn');
    fpsCounter = document.getElementById('fps-counter');

    // Add event listener for new game button
    if (newGameBtn) {
        newGameBtn.addEventListener('click', handleNewGameClick);
    }

    // Initialize FPS tracking
    lastFpsUpdateTime = performance.now();
}

// Function to add a captured piece to the UI
function addCapturedPiece(piece, capturedBy) {
    // Determine which container to use
    const container = capturedBy === 'white' ? whiteCapturesContainer : blackCapturesContainer;

    // Create a new piece icon element
    const pieceIcon = document.createElement('div');
    pieceIcon.className = `piece-icon ${piece.color}`;
    pieceIcon.textContent = pieceSymbols[piece.type];

    // Add the piece to the container
    container.appendChild(pieceIcon);

    // Add to our tracking arrays
    if (capturedBy === 'white') {
        capturedByWhite.push(piece);
    } else {
        capturedByBlack.push(piece);
    }
}

// Function to update the turn indicator
function updateTurnIndicator(currentPlayer) {
    if (turnDisplay) {
        turnDisplay.textContent = `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}'s Turn`;
    }

    if (turnDot) {
        turnDot.className = `turn-dot ${currentPlayer}`;
    }
}

// Function to update the game status display
function updateStatusDisplay(status, gameStatusMessage) {
    if (statusDisplay) {
        statusDisplay.textContent = gameStatusMessage;

        // Reset classes
        statusDisplay.classList.remove('check', 'checkmate');

        // Add appropriate class based on game status
        if (status === 'check') {
            statusDisplay.classList.add('check');
        } else if (status === 'checkmate') {
            statusDisplay.classList.add('checkmate');
        }
    }
}

// Function to show the game over overlay
function showGameOverOverlay(gameStatusMessage) {
    if (gameOverText) {
        gameOverText.textContent = gameStatusMessage;
    }

    if (gameOverOverlay) {
        gameOverOverlay.classList.add('visible');
    }
}

// Function to handle new game button click
function handleNewGameClick() {
    // Hide the game over overlay
    if (gameOverOverlay) {
        gameOverOverlay.classList.remove('visible');
    }

    // Clear captured pieces UI
    if (whiteCapturesContainer) {
        whiteCapturesContainer.innerHTML = '';
    }
    if (blackCapturesContainer) {
        blackCapturesContainer.innerHTML = '';
    }

    // Reset captured pieces arrays
    capturedByWhite = [];
    capturedByBlack = [];

    // The rest of the game reset will be handled by the main.js file
    // We'll dispatch a custom event that main.js can listen for
    const resetEvent = new CustomEvent('chess-game-reset');
    document.dispatchEvent(resetEvent);
}

// Function to update FPS counter
function updateFPS(timestamp) {
    frameCount++;

    // Update FPS every 500ms
    if (timestamp - lastFpsUpdateTime >= 500) {
        // Calculate FPS: frames / seconds
        fps = Math.round((frameCount * 1000) / (timestamp - lastFpsUpdateTime));

        // Update the FPS counter in the UI
        if (fpsCounter) {
            fpsCounter.textContent = `FPS: ${fps}`;

            // Add visual indicator for performance
            fpsCounter.className = 'fps-counter';
            if (fps < 30) {
                fpsCounter.classList.add('low');
            } else if (fps < 50) {
                fpsCounter.classList.add('medium');
            } else {
                fpsCounter.classList.add('high');
            }
        }

        // Reset counters
        frameCount = 0;
        lastFpsUpdateTime = timestamp;
    }

    return fps;
}

// Export functions and variables
export {
    initUI,
    addCapturedPiece,
    updateTurnIndicator,
    updateStatusDisplay,
    showGameOverOverlay,
    handleNewGameClick,
    updateFPS,
    pieceSymbols
};
