


const pieceSymbols = {
    pawn: '♟',
    rook: '♜',
    knight: '♞',
    bishop: '♝',
    queen: '♛',
    king: '♚'
};


let capturedByWhite = [];
let capturedByBlack = [];


let turnDisplay;
let statusDisplay;
let turnDot;
let whiteCapturesContainer;
let blackCapturesContainer;
let gameOverOverlay;
let gameOverText;
let newGameBtn;
let fpsCounter;


let frameCount = 0;
let lastFpsUpdateTime = 0;
let fps = 60;


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

    
    if (newGameBtn) {
        newGameBtn.addEventListener('click', handleNewGameClick);
    }

    
    lastFpsUpdateTime = performance.now();
}


function addCapturedPiece(piece, capturedBy) {
    
    const container = capturedBy === 'white' ? whiteCapturesContainer : blackCapturesContainer;

    
    const pieceIcon = document.createElement('div');
    pieceIcon.className = `piece-icon ${piece.color}`;
    pieceIcon.textContent = pieceSymbols[piece.type];

    
    container.appendChild(pieceIcon);

    
    if (capturedBy === 'white') {
        capturedByWhite.push(piece);
    } else {
        capturedByBlack.push(piece);
    }
}


function updateTurnIndicator(currentPlayer) {
    if (turnDisplay) {
        turnDisplay.textContent = `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}'s Turn`;
    }

    if (turnDot) {
        turnDot.className = `turn-dot ${currentPlayer}`;
    }
}


function updateStatusDisplay(status, gameStatusMessage) {
    if (statusDisplay) {
        statusDisplay.textContent = gameStatusMessage;

        
        statusDisplay.classList.remove('check', 'checkmate');

        
        if (status === 'check') {
            statusDisplay.classList.add('check');
        } else if (status === 'checkmate') {
            statusDisplay.classList.add('checkmate');
        }
    }
}


function showGameOverOverlay(gameStatusMessage) {
    if (gameOverText) {
        gameOverText.textContent = gameStatusMessage;
    }

    if (gameOverOverlay) {
        gameOverOverlay.classList.add('visible');
    }
}


function handleNewGameClick() {
    
    if (gameOverOverlay) {
        gameOverOverlay.classList.remove('visible');
    }

    
    if (whiteCapturesContainer) {
        whiteCapturesContainer.innerHTML = '';
    }
    if (blackCapturesContainer) {
        blackCapturesContainer.innerHTML = '';
    }

    
    capturedByWhite = [];
    capturedByBlack = [];

    
    
    const resetEvent = new CustomEvent('chess-game-reset');
    document.dispatchEvent(resetEvent);
}


function updateFPS(timestamp) {
    frameCount++;

    
    if (timestamp - lastFpsUpdateTime >= 500) {
        
        fps = Math.round((frameCount * 1000) / (timestamp - lastFpsUpdateTime));

        
        if (fpsCounter) {
            fpsCounter.textContent = `FPS: ${fps}`;

            
            fpsCounter.className = 'fps-counter';
            if (fps < 30) {
                fpsCounter.classList.add('low');
            } else if (fps < 50) {
                fpsCounter.classList.add('medium');
            } else {
                fpsCounter.classList.add('high');
            }
        }

        
        frameCount = 0;
        lastFpsUpdateTime = timestamp;
    }

    return fps;
}


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
