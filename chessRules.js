/**
 * Checks if a move is valid according to basic chess rules.
 * Includes check prevention, castling, en passant.
 * Does NOT check for checkmate/stalemate (handled by getGameStatus).
 *
 * @param {object} piece - The piece object attempting to move (needs { type, color, row, col }).
 * @param {number} targetRow - The target row index (0-7).
 * @param {number} targetCol - The target column index (0-7).
 * @param {array} boardState - The current array of all piece objects on the board.
 * @param {function} getPieceAt - A function (like chessSet.getPieceAt) to find a piece at specific coords.
 * @param {object | null} lastMove - Information about the previous move, needed for en passant.
 * @returns {boolean} True if the move is valid according to implemented rules, false otherwise.
 */
function isValidMove(piece, targetRow, targetCol, boardState, getPieceAt, lastMove = null) {
    if (!piece) return false;
    if (targetRow < 0 || targetRow > 7 || targetCol < 0 || targetCol > 7) return false;

    const startRow = piece.row;
    const startCol = piece.col;
    const targetPiece = getPieceAt(targetRow, targetCol);
    const rowDiff = targetRow - startRow;
    const colDiff = targetCol - startCol;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);

    // Basic validation (includes capturing own piece check)
    let isPotentiallyValidBasicMove = false;

    if (canPieceAttackSquare(piece, targetRow, targetCol, boardState, getPieceAt)) {
        // It's a potential attack move shape. Check specifics.
        if (piece.type === 'pawn') {
            // Pawn attack requires opponent on target square
            if (targetPiece && targetPiece.color !== piece.color) {
                isPotentiallyValidBasicMove = true;
            }
            // If target square empty, it's not a valid pawn attack (en passant handled below)
        } else {
            // Other pieces can attack empty square or opponent square
            if (!targetPiece || targetPiece.color !== piece.color) {
                isPotentiallyValidBasicMove = true; 
            }
        }
    } else if(piece.type === 'pawn') {
        // If canPieceAttackSquare was false, it's NOT an attack move.
        // Check non-attack pawn moves: Forward1 / Forward2 / EnPassant
        const moveDir = (piece.color === 'white') ? -1 : 1;
        const initialRow = (piece.color === 'white') ? 6 : 1;
        const isForward1 = colDiff === 0 && rowDiff === moveDir && !targetPiece;
        const isForward2 = colDiff === 0 && startRow === initialRow && rowDiff === 2 * moveDir && !targetPiece && !getPieceAt(startRow + moveDir, startCol);
        
        if (isForward1 || isForward2) {
            isPotentiallyValidBasicMove = true;
        } else {
            // Check En Passant ONLY if it wasn't a forward move
            const enPassantRow = (piece.color === 'white') ? 3 : 4;
            const isValidEnPassantTargetSquare = absColDiff === 1 && rowDiff === moveDir && !targetPiece && startRow === enPassantRow;
            
            if (isValidEnPassantTargetSquare) {
                if (lastMove && 
                    lastMove.isDoublePawnPush && 
                    lastMove.endRow === startRow && 
                    lastMove.endCol === targetCol) 
                {
                    isPotentiallyValidBasicMove = true;
                    console.log(`En passant capture appears valid for Pawn ${piece.id} targeting [${targetRow}, ${targetCol}]`);
                }
            }
        }
    } else if (piece.type === 'king' && absColDiff === 2 && absRowDiff === 0) {
         // Allow potential castling move to proceed to detailed checks below
         isPotentiallyValidBasicMove = true;
    }

    if (!isPotentiallyValidBasicMove) {
        //console.log(`Basic move validation failed for ${piece.type} from [${startRow}, ${startCol}] to [${targetRow}, ${targetCol}]`);
        return false; // Failed basic move/attack patterns
    }

    // --- Check Castling Specific Rules (if applicable) ---
    if (piece.type === 'king' && absColDiff === 2) {
        // Detailed castling logic is now here, called only if the basic King move was 2 squares
         const backRank = (piece.color === 'white') ? 7 : 0;
         if (startRow === backRank && absRowDiff === 0 && !piece.hasMoved) {
            const direction = (colDiff > 0) ? 1 : -1;
            const rookCol = (direction === 1) ? 7 : 0;
            const rook = getPieceAt(startRow, rookCol);
            if (!rook || rook.type !== 'rook' || rook.color !== piece.color || rook.hasMoved) return false;
            const checkCol1 = startCol + direction;
            const checkCol2 = startCol + 2 * direction; // This is the target square
            if (getPieceAt(startRow, checkCol1) || getPieceAt(startRow, checkCol2)) return false;
            if (direction === -1 && getPieceAt(startRow, startCol - 3)) return false;
            const opponentColor = (piece.color === 'white' ? 'black' : 'white');
            if (isSquareAttacked(startRow, startCol, opponentColor, boardState, getPieceAt)) return false;
            if (isSquareAttacked(startRow, checkCol1, opponentColor, boardState, getPieceAt)) return false;
            if (isSquareAttacked(startRow, checkCol2, opponentColor, boardState, getPieceAt)) return false;
            // If all checks pass, castling is valid (will proceed to check simulation)
            console.log(`Castling move appears valid for King ${piece.id}`);
         } else {
             return false; // Failed detailed castling checks (e.g., king already moved)
         }
    }

    // --- Simulate move and check for self-check --- 
    let kingPosition = null;
    let kingColor = piece.color;
    let originalTargetPiece = null;
    let tempBoardState = boardState.map(p => ({...p})); // Deep copy for simulation
    const movingPieceIndex = tempBoardState.findIndex(p => p.id === piece.id);
    
    // Find target index if exists
    let targetPieceIndex = -1;
    if (targetPiece) {
        targetPieceIndex = tempBoardState.findIndex(p => p.row === targetRow && p.col === targetCol);
        originalTargetPiece = {...tempBoardState[targetPieceIndex]}; // Store for restoration
        tempBoardState.splice(targetPieceIndex, 1); // Simulate capture
    }

    // Find the moving piece again in the potentially modified array
     const movingPieceIndexAfterCapture = tempBoardState.findIndex(p => p.id === piece.id);
     if(movingPieceIndexAfterCapture === -1) { console.error("Sim Error: Moving piece not found after capture sim"); return false; }
     tempBoardState[movingPieceIndexAfterCapture].row = targetRow;
     tempBoardState[movingPieceIndexAfterCapture].col = targetCol;

    // Find the king of the moving player
    const king = tempBoardState.find(p => p.type === 'king' && p.color === kingColor);
    if (!king) {
        console.warn("Cannot find king for check validation!");
        return true; // Allow move if king missing (shouldn't happen)
    }
    kingPosition = { row: king.row, col: king.col };

    // Check if the king is attacked AFTER the simulated move
    const opponentColor = (kingColor === 'white' ? 'black' : 'white');
    const isInCheck = isSquareAttacked(kingPosition.row, kingPosition.col, opponentColor, tempBoardState, (r, c) => {
        // Need a getPieceAt that works on the temporary state
        return tempBoardState.find(p => p.row === r && p.col === c) || null;
    });

    // --- Move is invalid if it leaves the king in check ---
    if (isInCheck) {
        return false;
    }

    return true; // Passed basic validation and check prevention
}

// Helper function to check if a square is attacked by a given color
function isSquareAttacked(row, col, attackingColor, boardState, getPieceAt) {
    for (const piece of boardState) {
        if (piece.color === attackingColor) {
            // Check if this piece can attack the target square
            // NOTE: We call isValidMove *without* the check prevention logic here,
            // otherwise we get infinite recursion. We need a simpler check.
            if (canPieceAttackSquare(piece, row, col, boardState, getPieceAt)) {
                return true;
            }
        }
    }
    return false;
}

// Simplified version of isValidMove specifically for attack checks (ignores whose turn it is, check prevention)
// Needed to avoid recursion within isSquareAttacked -> isValidMove -> isSquareAttacked
function canPieceAttackSquare(piece, targetRow, targetCol, boardState, getPieceAt) {
    if (!piece) return false;
    if (targetRow < 0 || targetRow > 7 || targetCol < 0 || targetCol > 7) return false;

    const startRow = piece.row;
    const startCol = piece.col;
    const targetPiece = getPieceAt(targetRow, targetCol); // Piece on the target square (can be null)

    // Cannot attack own square (implicit in movement rules but good check)
    if (startRow === targetRow && startCol === targetCol) return false;

    const rowDiff = targetRow - startRow;
    const colDiff = targetCol - startCol;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);

    switch (piece.type) {
        case 'pawn':
            const moveDir = (piece.color === 'white') ? -1 : 1;
            // Pawn only attacks diagonally forward one square
            return (absColDiff === 1 && rowDiff === moveDir);

        case 'knight':
            return ((absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2));

        case 'rook':
            if (startRow !== targetRow && startCol !== targetCol) return false;
            // Path check (same as regular move)
             if (startRow === targetRow) { const step = (targetCol > startCol) ? 1 : -1; for (let c = startCol + step; c !== targetCol; c += step) { if (getPieceAt(startRow, c)) return false; } } else { const step = (targetRow > startRow) ? 1 : -1; for (let r = startRow + step; r !== targetRow; r += step) { if (getPieceAt(r, startCol)) return false; } }
            return true;

         case 'bishop':
            if (absRowDiff !== absColDiff) return false;
            // Path check (same as regular move)
             const rowStepB = rowDiff > 0 ? 1 : -1; const colStepB = colDiff > 0 ? 1 : -1; let currentRowB = startRow + rowStepB; let currentColB = startCol + colStepB; while (currentRowB !== targetRow) { if (getPieceAt(currentRowB, currentColB)) return false; currentRowB += rowStepB; currentColB += colStepB; }
            return true;

         case 'queen':
            const isRookMoveQ = (startRow === targetRow || startCol === targetCol);
            const isBishopMoveQ = (absRowDiff === absColDiff);
            if (!isRookMoveQ && !isBishopMoveQ) return false;
            // Path check (same as regular move)
            if (isRookMoveQ) { if (startRow === targetRow) { const step = (targetCol > startCol) ? 1 : -1; for (let c = startCol + step; c !== targetCol; c += step) { if (getPieceAt(startRow, c)) return false; } } else { const step = (targetRow > startRow) ? 1 : -1; for (let r = startRow + step; r !== targetRow; r += step) { if (getPieceAt(r, startCol)) return false; } } } else { const rowStepQ = rowDiff > 0 ? 1 : -1; const colStepQ = colDiff > 0 ? 1 : -1; let currentRowQ = startRow + rowStepQ; let currentColQ = startCol + colStepQ; while (currentRowQ !== targetRow) { if (getPieceAt(currentRowQ, currentColQ)) return false; currentRowQ += rowStepQ; currentColQ += colStepQ; } }
            return true;

         case 'king':
             // Can move one square in any direction (handled by basic validation)
             if (absRowDiff <= 1 && absColDiff <= 1) {
                 // Standard move is already validated for check prevention
                 return true; 
             }

             // --- Castling Logic --- 
             const backRank = (piece.color === 'white') ? 7 : 0;
             if (startRow === backRank && absRowDiff === 0 && absColDiff === 2 && !piece.hasMoved) {
                 // Determine direction (Kingside or Queenside)
                 const direction = (colDiff > 0) ? 1 : -1;
                 const rookCol = (direction === 1) ? 7 : 0;
                 const rook = getPieceAt(startRow, rookCol);

                 // Check if the corresponding rook exists, is the correct type/color, and hasn't moved
                 if (!rook || rook.type !== 'rook' || rook.color !== piece.color || rook.hasMoved) {
                     return false;
                 }

                 // Check if path between King and Rook is clear
                 // (Check squares King moves over: e1-f1 or e1-d1, or e8-f8 or e8-d8)
                 const checkCol1 = startCol + direction;
                 const checkCol2 = startCol + 2 * direction; // This is the target square
                 if (getPieceAt(startRow, checkCol1) || getPieceAt(startRow, checkCol2)) {
                     return false; // Path blocked
                 }
                 // For Queenside castling, check the extra square b1/b8
                 if (direction === -1 && getPieceAt(startRow, startCol - 3)) {
                     return false; // Queenside path blocked
                 }

                 // Check if the King is currently in check
                 const opponentColor = (piece.color === 'white' ? 'black' : 'white');
                 if (isSquareAttacked(startRow, startCol, opponentColor, boardState, getPieceAt)) {
                     return false; // Cannot castle out of check
                 }

                 // Check if the squares the King passes through are attacked
                 if (isSquareAttacked(startRow, checkCol1, opponentColor, boardState, getPieceAt)) {
                     return false; // Cannot castle through check
                 }
                 // Also check the target square (check prevention handles this, but explicit check is fine)
                 if (isSquareAttacked(startRow, checkCol2, opponentColor, boardState, getPieceAt)) {
                      return false;
                 }

                 // If all checks pass, castling is valid
                 console.log(`Castling move appears valid for King ${piece.id}`);
                 return true;
             }

             return false; // Invalid king move (not 1 square, not valid castle)

        default: return false;
    }
}

/**
 * Determines the current game status for a given player.
 *
 * @param {string} playerColor - The color of the player whose turn it is ('white' or 'black').
 * @param {array} boardState - The current array of all piece objects on the board.
 * @param {function} getPieceAt - A function (like chessSet.getPieceAt) to find a piece at specific coords.
 * @param {object | null} lastMove - Information about the previous move, needed for en passant validation within getValidMoves.
 * @returns {string} 'playing', 'check', 'checkmate', or 'stalemate'.
 */
function getGameStatus(playerColor, boardState, getPieceAt, lastMove = null) {
    const opponentColor = (playerColor === 'white' ? 'black' : 'white');
    const playerPieces = boardState.filter(p => p.color === playerColor);
    const king = playerPieces.find(p => p.type === 'king');

    if (!king) {
        console.error(`Cannot determine game status: ${playerColor} king not found!`);
        return 'error'; // Or handle appropriately
    }

    const kingInCheck = isSquareAttacked(king.row, king.col, opponentColor, boardState, getPieceAt);

    // Check if the current player has any valid moves
    let hasValidMoves = false;
    for (const piece of playerPieces) {
        const validMoves = getValidMoves(piece, boardState, getPieceAt, lastMove); // Pass lastMove here
        if (validMoves.length > 0) {
            hasValidMoves = true;
            break; // Found at least one valid move, no need to check further
        }
    }

    if (kingInCheck) {
        return hasValidMoves ? 'check' : 'checkmate';
    } else {
        return hasValidMoves ? 'playing' : 'stalemate';
    }
}

// Function to get all valid moves for a piece (useful for highlighting)
// Now incorporates check prevention because it calls the updated isValidMove
// Needs to pass lastMove to isValidMove
function getValidMoves(piece, boardState, getPieceAt, lastMove = null) {
    if (!piece) return [];
    const validMoves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (isValidMove(piece, r, c, boardState, getPieceAt, lastMove)) { // Pass lastMove here
                validMoves.push({ row: r, col: c });
            }
        }
    }
    return validMoves;
}

export { isValidMove, getValidMoves, isSquareAttacked, getGameStatus }; 