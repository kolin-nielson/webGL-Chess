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

    
    let isPotentiallyValidBasicMove = false;

    if (canPieceAttackSquare(piece, targetRow, targetCol, boardState, getPieceAt)) {
        
        if (piece.type === 'pawn') {
            
            if (targetPiece && targetPiece.color !== piece.color) {
                isPotentiallyValidBasicMove = true;
            }
            
        } else {
            
            if (!targetPiece || targetPiece.color !== piece.color) {
                isPotentiallyValidBasicMove = true; 
            }
        }
    } else if(piece.type === 'pawn') {
        
        
        const moveDir = (piece.color === 'white') ? -1 : 1;
        const initialRow = (piece.color === 'white') ? 6 : 1;
        const isForward1 = colDiff === 0 && rowDiff === moveDir && !targetPiece;
        const isForward2 = colDiff === 0 && startRow === initialRow && rowDiff === 2 * moveDir && !targetPiece && !getPieceAt(startRow + moveDir, startCol);
        
        if (isForward1 || isForward2) {
            isPotentiallyValidBasicMove = true;
        } else {
            
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
         
         isPotentiallyValidBasicMove = true;
    }

    if (!isPotentiallyValidBasicMove) {
        
        return false; 
    }

    
    if (piece.type === 'king' && absColDiff === 2) {
        
         const backRank = (piece.color === 'white') ? 7 : 0;
         if (startRow === backRank && absRowDiff === 0 && !piece.hasMoved) {
            const direction = (colDiff > 0) ? 1 : -1;
            const rookCol = (direction === 1) ? 7 : 0;
            const rook = getPieceAt(startRow, rookCol);
            if (!rook || rook.type !== 'rook' || rook.color !== piece.color || rook.hasMoved) return false;
            const checkCol1 = startCol + direction;
            const checkCol2 = startCol + 2 * direction; 
            if (getPieceAt(startRow, checkCol1) || getPieceAt(startRow, checkCol2)) return false;
            if (direction === -1 && getPieceAt(startRow, startCol - 3)) return false;
            const opponentColor = (piece.color === 'white' ? 'black' : 'white');
            if (isSquareAttacked(startRow, startCol, opponentColor, boardState, getPieceAt)) return false;
            if (isSquareAttacked(startRow, checkCol1, opponentColor, boardState, getPieceAt)) return false;
            if (isSquareAttacked(startRow, checkCol2, opponentColor, boardState, getPieceAt)) return false;
            
            console.log(`Castling move appears valid for King ${piece.id}`);
         } else {
             return false; 
         }
    }

    
    let kingPosition = null;
    let kingColor = piece.color;
    let originalTargetPiece = null;
    let tempBoardState = boardState.map(p => ({...p})); 
    const movingPieceIndex = tempBoardState.findIndex(p => p.id === piece.id);
    
    
    let targetPieceIndex = -1;
    if (targetPiece) {
        targetPieceIndex = tempBoardState.findIndex(p => p.row === targetRow && p.col === targetCol);
        originalTargetPiece = {...tempBoardState[targetPieceIndex]}; 
        tempBoardState.splice(targetPieceIndex, 1); 
    }

    
     const movingPieceIndexAfterCapture = tempBoardState.findIndex(p => p.id === piece.id);
     if(movingPieceIndexAfterCapture === -1) { console.error("Sim Error: Moving piece not found after capture sim"); return false; }
     tempBoardState[movingPieceIndexAfterCapture].row = targetRow;
     tempBoardState[movingPieceIndexAfterCapture].col = targetCol;

    
    const king = tempBoardState.find(p => p.type === 'king' && p.color === kingColor);
    if (!king) {
        console.warn("Cannot find king for check validation!");
        return true; 
    }
    kingPosition = { row: king.row, col: king.col };

    
    const opponentColor = (kingColor === 'white' ? 'black' : 'white');
    const isInCheck = isSquareAttacked(kingPosition.row, kingPosition.col, opponentColor, tempBoardState, (r, c) => {
        
        return tempBoardState.find(p => p.row === r && p.col === c) || null;
    });

    
    if (isInCheck) {
        return false;
    }

    return true; 
}


function isSquareAttacked(row, col, attackingColor, boardState, getPieceAt) {
    for (const piece of boardState) {
        if (piece.color === attackingColor) {
            
            
            
            if (canPieceAttackSquare(piece, row, col, boardState, getPieceAt)) {
                return true;
            }
        }
    }
    return false;
}



function canPieceAttackSquare(piece, targetRow, targetCol, boardState, getPieceAt) {
    if (!piece) return false;
    if (targetRow < 0 || targetRow > 7 || targetCol < 0 || targetCol > 7) return false;

    const startRow = piece.row;
    const startCol = piece.col;
    const targetPiece = getPieceAt(targetRow, targetCol); 

    
    if (startRow === targetRow && startCol === targetCol) return false;

    const rowDiff = targetRow - startRow;
    const colDiff = targetCol - startCol;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);

    switch (piece.type) {
        case 'pawn':
            const moveDir = (piece.color === 'white') ? -1 : 1;
            
            return (absColDiff === 1 && rowDiff === moveDir);

        case 'knight':
            return ((absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2));

        case 'rook':
            if (startRow !== targetRow && startCol !== targetCol) return false;
            
             if (startRow === targetRow) { const step = (targetCol > startCol) ? 1 : -1; for (let c = startCol + step; c !== targetCol; c += step) { if (getPieceAt(startRow, c)) return false; } } else { const step = (targetRow > startRow) ? 1 : -1; for (let r = startRow + step; r !== targetRow; r += step) { if (getPieceAt(r, startCol)) return false; } }
            return true;

         case 'bishop':
            if (absRowDiff !== absColDiff) return false;
            
             const rowStepB = rowDiff > 0 ? 1 : -1; const colStepB = colDiff > 0 ? 1 : -1; let currentRowB = startRow + rowStepB; let currentColB = startCol + colStepB; while (currentRowB !== targetRow) { if (getPieceAt(currentRowB, currentColB)) return false; currentRowB += rowStepB; currentColB += colStepB; }
            return true;

         case 'queen':
            const isRookMoveQ = (startRow === targetRow || startCol === targetCol);
            const isBishopMoveQ = (absRowDiff === absColDiff);
            if (!isRookMoveQ && !isBishopMoveQ) return false;
            
            if (isRookMoveQ) { if (startRow === targetRow) { const step = (targetCol > startCol) ? 1 : -1; for (let c = startCol + step; c !== targetCol; c += step) { if (getPieceAt(startRow, c)) return false; } } else { const step = (targetRow > startRow) ? 1 : -1; for (let r = startRow + step; r !== targetRow; r += step) { if (getPieceAt(r, startCol)) return false; } } } else { const rowStepQ = rowDiff > 0 ? 1 : -1; const colStepQ = colDiff > 0 ? 1 : -1; let currentRowQ = startRow + rowStepQ; let currentColQ = startCol + colStepQ; while (currentRowQ !== targetRow) { if (getPieceAt(currentRowQ, currentColQ)) return false; currentRowQ += rowStepQ; currentColQ += colStepQ; } }
            return true;

         case 'king':
             
             if (absRowDiff <= 1 && absColDiff <= 1) {
                 
                 return true; 
             }

             
             const backRank = (piece.color === 'white') ? 7 : 0;
             if (startRow === backRank && absRowDiff === 0 && absColDiff === 2 && !piece.hasMoved) {
                 
                 const direction = (colDiff > 0) ? 1 : -1;
                 const rookCol = (direction === 1) ? 7 : 0;
                 const rook = getPieceAt(startRow, rookCol);

                 
                 if (!rook || rook.type !== 'rook' || rook.color !== piece.color || rook.hasMoved) {
                     return false;
                 }

                 
                 
                 const checkCol1 = startCol + direction;
                 const checkCol2 = startCol + 2 * direction; 
                 if (getPieceAt(startRow, checkCol1) || getPieceAt(startRow, checkCol2)) {
                     return false; 
                 }
                 
                 if (direction === -1 && getPieceAt(startRow, startCol - 3)) {
                     return false; 
                 }

                 
                 const opponentColor = (piece.color === 'white' ? 'black' : 'white');
                 if (isSquareAttacked(startRow, startCol, opponentColor, boardState, getPieceAt)) {
                     return false; 
                 }

                 
                 if (isSquareAttacked(startRow, checkCol1, opponentColor, boardState, getPieceAt)) {
                     return false; 
                 }
                 
                 if (isSquareAttacked(startRow, checkCol2, opponentColor, boardState, getPieceAt)) {
                      return false;
                 }

                 
                 console.log(`Castling move appears valid for King ${piece.id}`);
                 return true;
             }

             return false; 

        default: return false;
    }
}

function getGameStatus(playerColor, boardState, getPieceAt, lastMove = null) {
    const opponentColor = (playerColor === 'white' ? 'black' : 'white');
    const playerPieces = boardState.filter(p => p.color === playerColor);
    const king = playerPieces.find(p => p.type === 'king');

    if (!king) {
        console.error(`Cannot determine game status: ${playerColor} king not found!`);
        return 'error'; 
    }

    const kingInCheck = isSquareAttacked(king.row, king.col, opponentColor, boardState, getPieceAt);

    
    let hasValidMoves = false;
    for (const piece of playerPieces) {
        const validMoves = getValidMoves(piece, boardState, getPieceAt, lastMove); 
        if (validMoves.length > 0) {
            hasValidMoves = true;
            break; 
        }
    }

    if (kingInCheck) {
        return hasValidMoves ? 'check' : 'checkmate';
    } else {
        return hasValidMoves ? 'playing' : 'stalemate';
    }
}




function getValidMoves(piece, boardState, getPieceAt, lastMove = null) {
    if (!piece) return [];
    const validMoves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (isValidMove(piece, r, c, boardState, getPieceAt, lastMove)) { 
                validMoves.push({ row: r, col: c });
            }
        }
    }
    return validMoves;
}

export { isValidMove, getValidMoves, isSquareAttacked, getGameStatus }; 