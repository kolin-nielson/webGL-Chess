import { loadTexture, setShaderAttributes, setHighlightShaderAttributes, setPickingShaderAttributes, createPlaneBuffer } from "./helpers.js";
import { readObj } from "./objReader.js";
// Assuming glMatrix is globally available from index.html script tag
const mat4 = glMatrix.mat4;
const mat3 = glMatrix.mat3;
const vec3 = glMatrix.vec3; // Added for animation

// Function to create a simple plane buffer (for highlights)
// Returns an interleaved buffer compatible with setShaderAttributes
// function createPlaneBuffer(gl) { ... }

class ChessSet {
    constructor(gl) {
        // Use a mutable array for board state
        this.boardState = [
            // Row 0 (Black Back Rank)
            { id: 1, type: 'rook', color: 'black', row: 0, col: 0, hasMoved: false }, { id: 2, type: 'knight', color: 'black', row: 0, col: 1 }, { id: 3, type: 'bishop', color: 'black', row: 0, col: 2 }, { id: 4, type: 'queen', color: 'black', row: 0, col: 3 }, { id: 5, type: 'king', color: 'black', row: 0, col: 4, hasMoved: false }, { id: 6, type: 'bishop', color: 'black', row: 0, col: 5 }, { id: 7, type: 'knight', color: 'black', row: 0, col: 6 }, { id: 8, type: 'rook', color: 'black', row: 0, col: 7, hasMoved: false },
            // Row 1 (Black Pawns)
            { id: 9, type: 'pawn', color: 'black', row: 1, col: 0 }, { id: 10, type: 'pawn', color: 'black', row: 1, col: 1 }, { id: 11, type: 'pawn', color: 'black', row: 1, col: 2 }, { id: 12, type: 'pawn', color: 'black', row: 1, col: 3 }, { id: 13, type: 'pawn', color: 'black', row: 1, col: 4 }, { id: 14, type: 'pawn', color: 'black', row: 1, col: 5 }, { id: 15, type: 'pawn', color: 'black', row: 1, col: 6 }, { id: 16, type: 'pawn', color: 'black', row: 1, col: 7 },
            // Rows 2-5 (Empty)
            // Row 6 (White Pawns)
            { id: 17, type: 'pawn', color: 'white', row: 6, col: 0 }, { id: 18, type: 'pawn', color: 'white', row: 6, col: 1 }, { id: 19, type: 'pawn', color: 'white', row: 6, col: 2 }, { id: 20, type: 'pawn', color: 'white', row: 6, col: 3 }, { id: 21, type: 'pawn', color: 'white', row: 6, col: 4 }, { id: 22, type: 'pawn', color: 'white', row: 6, col: 5 }, { id: 23, type: 'pawn', color: 'white', row: 6, col: 6 }, { id: 24, type: 'pawn', color: 'white', row: 6, col: 7 },
            // Row 7 (White Back Rank)
            { id: 25, type: 'rook', color: 'white', row: 7, col: 0, hasMoved: false }, { id: 26, type: 'knight', color: 'white', row: 7, col: 1 }, { id: 27, type: 'bishop', color: 'white', row: 7, col: 2 }, { id: 28, type: 'queen', color: 'white', row: 7, col: 3 }, { id: 29, type: 'king', color: 'white', row: 7, col: 4, hasMoved: false }, { id: 30, type: 'bishop', color: 'white', row: 7, col: 5 }, { id: 31, type: 'knight', color: 'white', row: 7, col: 6 }, { id: 32, type: 'rook', color: 'white', row: 7, col: 7, hasMoved: false },
        ];
        this.boardScale = 1.0;
        this.boardCenterOffset = 3.5;
        this.rebuildPieceMap(); // Initial map build
    }

    // Helper to rebuild the piece map from the current board state
    rebuildPieceMap() {
        this.pieceMap = new Map(this.boardState.map(p => [p.id, p]));
    }

    // Update init to accept anisotropy parameters
    async init(gl, anisoExt = null, maxAnisotropy = 1) {
        // Pass anisotropy info to loadTexture
        this.blackTexture = loadTexture(gl, 'pieces/PiezasAjedrezDiffuseMarmolBlackBrighter.png', [80, 80, 80, 255], anisoExt, maxAnisotropy);
        this.whiteTexture = loadTexture(gl, 'pieces/PiezasAjedrezDiffuseMarmol.png', [220, 220, 220, 255], anisoExt, maxAnisotropy);
        this.boardTexture = loadTexture(gl, 'pieces/TableroDiffuse01.png', [255, 171, 0, 255], anisoExt, maxAnisotropy);
        
        // Base texture doesn't need anisotropic filtering (it's 1x1)
        this.baseTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([40, 35, 30, 255]));
        gl.bindTexture(gl.TEXTURE_2D, null);
        this.buffers = {};
        await readObj(gl, "pieces/PiezasAjedrezAdjusted.obj", this.buffers);
        console.log("Loaded buffers:", Object.keys(this.buffers));
        this.highlightBuffer = createPlaneBuffer(gl);
        console.log("Highlight Buffer Created:", this.highlightBuffer, "Vertex Count:", this.highlightBuffer?.vertexCount);
        this.highlightTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.highlightTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([150, 255, 100, 180]));
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    // Method to find piece by ID
    getPieceById(id) {
        return this.pieceMap.get(id);
    }

    // Helper to get piece at a specific board location
    getPieceAt(row, col) {
        // Find the index in the boardState array
        const index = this.boardState.findIndex(p => p.row === row && p.col === col);
        return index !== -1 ? this.boardState[index] : null;
    }

    // Helper to remove a piece from the board
    removePiece(pieceId) {
        const index = this.boardState.findIndex(p => p.id === pieceId);
        if (index !== -1) {
            const removedPiece = this.boardState.splice(index, 1)[0];
            this.pieceMap.delete(pieceId);
            console.log(`Removed piece ${pieceId} (${removedPiece.type}) from [${removedPiece.row}, ${removedPiece.col}]`);
            return true;
        } else {
            console.warn(`Cannot remove piece: ID ${pieceId} not found in boardState.`);
            return false;
        }
    }

    // Updated movePiece to handle captures
    movePiece(pieceId, targetRow, targetCol) {
        const piece = this.getPieceById(pieceId);
        if (!piece) {
            console.error(`Cannot move piece: ID ${pieceId} not found.`);
            return { success: false, capturedPiece: null, isCastle: false, isEnPassantCapture: false };
        }

        const startRow = piece.row;
        const startCol = piece.col;
        let isCastle = false;
        let isEnPassantCapture = false;
        let originalTargetPieceData = null; // Store data of the captured piece

        // Check for a piece at the target location
        const targetPiece = this.getPieceAt(targetRow, targetCol);

        if (targetPiece) {
            if (targetPiece.color === piece.color) {
                console.log("Invalid move: cannot capture own piece.");
                 return { success: false, capturedPiece: null, isCastle: false, isEnPassantCapture: false };
            }
            // Don't remove the piece yet, just store its data for the animation handler
            console.log(`Capture detected: Piece ${targetPiece.id} (${targetPiece.type}) at [${targetRow}, ${targetCol}] will be captured.`);
            originalTargetPieceData = { id: targetPiece.id, type: targetPiece.type, row: targetPiece.row, col: targetPiece.col, color: targetPiece.color }; // Store full data
        }

        // Update the moving piece's position
        console.log(`Updating piece ${pieceId} (${piece.type}) from [${startRow}, ${startCol}] to [${targetRow}, ${targetCol}]`);
        piece.row = targetRow;
        piece.col = targetCol;

        // Set hasMoved flag if King or Rook moves
        if ((piece.type === 'king' || piece.type === 'rook') && piece.hasMoved === false) {
            console.log(`Setting hasMoved=true for ${piece.type} ID ${piece.id}`);
            piece.hasMoved = true;
        }

        // --- Handle En Passant Capture --- 
        if (piece.type === 'pawn' && targetPiece === null) { // targetPiece is null here
            const colDiffEP = Math.abs(targetCol - startCol);
            if (colDiffEP === 1) { // Check if it looks like en passant geometry
                 // Need to check if this move was validated specifically as en passant
                 // For now, assume validation was correct and find the actual captured pawn
                 const capturedPawnRow = startRow; 
                 const capturedPawnCol = targetCol;
                 const capturedPawn = this.getPieceAt(capturedPawnRow, capturedPawnCol);
                 if (capturedPawn && capturedPawn.type === 'pawn' && capturedPawn.color !== piece.color) {
                     console.log(`En Passant Capture detected: Pawn ${capturedPawn.id} at [${capturedPawnRow}, ${capturedPawnCol}] will be captured.`);
                     originalTargetPieceData = { id: capturedPawn.id, type: capturedPawn.type, row: capturedPawn.row, col: capturedPawn.col, color: capturedPawn.color }; // Store full data
                     isEnPassantCapture = true;
                 } else {
                    // If isValidMove said it was en passant, but we can't find the pawn here, something is wrong.
                     console.error(`En Passant Error: Could not find opponent pawn at [${capturedPawnRow}, ${capturedPawnCol}] for capture, despite validation.`);
                      return { success: false, capturedPiece: null, isCastle: false, isEnPassantCapture: false };
                 }
            }
        }

        // --- Handle Castling Rook Move --- 
        if (piece.type === 'king') {
            const colDiff = targetCol - startCol;
            if (Math.abs(colDiff) === 2) {
                isCastle = true; // Set castling flag
                const rookStartCol = (colDiff > 0) ? 7 : 0;
                const rookEndCol = (colDiff > 0) ? 5 : 3;  
                const rook = this.getPieceAt(startRow, rookStartCol);
                if (rook && rook.type === 'rook' && rook.color === piece.color) {
                    console.log(`Castling: Moving rook from [${startRow}, ${rookStartCol}] to [${startRow}, ${rookEndCol}]`);
                    rook.col = rookEndCol;
                    rook.hasMoved = true;
                } else {
                    console.error(`Castling Error: Could not find corresponding rook at [${startRow}, ${rookStartCol}]`);
                    // Return failure as the state is inconsistent with validation
                    return { success: false, capturedPiece: null, isCastle: false, isEnPassantCapture: false };
                }
            }
        }

        return { success: true, capturedPiece: originalTargetPieceData, isCastle: isCastle, isEnPassantCapture: isEnPassantCapture };
    }

    // Method to change a pawn to another piece type (usually Queen)
    promotePawn(pieceId, newType = 'queen') {
        const piece = this.getPieceById(pieceId);
        if (!piece) {
            console.error(`Cannot promote pawn: ID ${pieceId} not found.`);
            return false;
        }
        if (piece.type !== 'pawn') {
            console.warn(`Attempted to promote non-pawn piece ID ${pieceId} (type: ${piece.type})`);
            return false;
        }
        const promotionRank = (piece.color === 'white') ? 0 : 7;
        if (piece.row !== promotionRank) {
            console.warn(`Attempted to promote pawn ID ${pieceId} not on promotion rank (row: ${piece.row})`);
            return false;
        }

        console.log(`Promoting pawn ${pieceId} at [${piece.row}, ${piece.col}] to ${newType}`);
        piece.type = newType;
        // pieceMap is automatically updated as it holds a reference
        return true;
    }

    // Updated draw method - accepts full animation state
    draw(gl, shaderProgram, viewMatrix, projectionMatrix, animationState = null, validMoveTargets = []) { 
        const modelViewMatrixUniformLocation = gl.getUniformLocation(shaderProgram, "uModelViewMatrix");
        const normalMatrixUniformLocation = gl.getUniformLocation(shaderProgram, "uNormalMatrix");
        const projectionMatrixUniformLocation = gl.getUniformLocation(shaderProgram, "uProjectionMatrix");
        const currentPieceIdUniformLocation = gl.getUniformLocation(shaderProgram, "uSelectedId");
        const useTextureUniformLocation = gl.getUniformLocation(shaderProgram, "uUseTexture");
        const baseColorUniformLocation = gl.getUniformLocation(shaderProgram, "uBaseColor"); 

        gl.uniformMatrix4fv(projectionMatrixUniformLocation, false, projectionMatrix);

        const modelMatrix = mat4.create();
        const modelViewMatrix = mat4.create();
        const normalMatrix = mat3.create();

        // --- Draw Board Base First (slightly lower, scaled, different texture) ---
        const boardBuffer = this.buffers["cube"];
        if (boardBuffer && boardBuffer.vertexCount) {
             mat4.identity(modelMatrix);
             // Scale it slightly larger and move down
             mat4.translate(modelMatrix, modelMatrix, [0, -0.1, 0]); // Move down
             mat4.scale(modelMatrix, modelMatrix, [1.05, 0.5, 1.05]); // Make slightly wider/longer, but flatter

             mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
             mat3.normalFromMat4(normalMatrix, modelViewMatrix);
             gl.uniformMatrix4fv(modelViewMatrixUniformLocation, false, modelViewMatrix);
             gl.uniformMatrix3fv(normalMatrixUniformLocation, false, normalMatrix);
             if (currentPieceIdUniformLocation) gl.uniform1i(currentPieceIdUniformLocation, 0);
             if (useTextureUniformLocation) gl.uniform1i(useTextureUniformLocation, 1); // Use texture

             gl.bindTexture(gl.TEXTURE_2D, this.baseTexture); // Use base texture
             gl.bindBuffer(gl.ARRAY_BUFFER, boardBuffer); 
             setShaderAttributes(gl, shaderProgram); 
             gl.drawArrays(gl.TRIANGLES, 0, boardBuffer.vertexCount);
        }

        // --- Draw Board Top ---
        if (boardBuffer && boardBuffer.vertexCount) {
             mat4.identity(modelMatrix); // Reset model matrix
             mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
             mat3.normalFromMat4(normalMatrix, modelViewMatrix);
             gl.uniformMatrix4fv(modelViewMatrixUniformLocation, false, modelViewMatrix);
             gl.uniformMatrix3fv(normalMatrixUniformLocation, false, normalMatrix);
             if (currentPieceIdUniformLocation) gl.uniform1i(currentPieceIdUniformLocation, 0);
             if (useTextureUniformLocation) gl.uniform1i(useTextureUniformLocation, 1);

             gl.bindTexture(gl.TEXTURE_2D, this.boardTexture); // Board texture
             gl.bindBuffer(gl.ARRAY_BUFFER, boardBuffer);
        setShaderAttributes(gl, shaderProgram);
             gl.drawArrays(gl.TRIANGLES, 0, boardBuffer.vertexCount);
        } else {
            console.error("Board buffer 'cube' not found or invalid!");
        }

        // --- Draw Highlights ---
        // Ensure the correct shader program is active before drawing highlights
        gl.useProgram(shaderProgram);
        if (validMoveTargets.length > 0 && this.highlightBuffer && this.highlightBuffer.vertexCount) {
            gl.enable(gl.BLEND); // Restore blending
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // Restore blending function
            if (useTextureUniformLocation) gl.uniform1i(useTextureUniformLocation, 0); // Use base color
            // Restore desired highlight color
            if (baseColorUniformLocation) gl.uniform4f(baseColorUniformLocation, 0.8, 0.8, 0.3, 0.6); 
            gl.bindBuffer(gl.ARRAY_BUFFER, this.highlightBuffer);
            // Use standard attribute setup now that buffer has all data
            setShaderAttributes(gl, shaderProgram); 

            for (const target of validMoveTargets) {
                const x = (target.col - this.boardCenterOffset) * this.boardScale;
                const y = 0.01; // Keep small Y offset
                const z = (target.row - this.boardCenterOffset) * this.boardScale;
                console.log(`Drawing highlight at [${target.row}, ${target.col}] (World: ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
                mat4.identity(modelMatrix);
                mat4.translate(modelMatrix, modelMatrix, [x, y, z]);
                mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
                // Set normal matrix even though highlights don't use it, shader expects it
                mat3.normalFromMat4(normalMatrix, modelViewMatrix);
                gl.uniformMatrix3fv(normalMatrixUniformLocation, false, normalMatrix);
                gl.uniformMatrix4fv(modelViewMatrixUniformLocation, false, modelViewMatrix);
                if (currentPieceIdUniformLocation) gl.uniform1i(currentPieceIdUniformLocation, -1); 
                gl.drawArrays(gl.TRIANGLES, 0, this.highlightBuffer.vertexCount);
            }
            gl.disable(gl.BLEND); 
            if (useTextureUniformLocation) gl.uniform1i(useTextureUniformLocation, 1); 
        }

        // --- Draw Pieces ---
        setShaderAttributes(gl, shaderProgram); 
        if (useTextureUniformLocation) gl.uniform1i(useTextureUniformLocation, 1); 
        for (const piece of this.boardState) {
             const buffer = this.buffers[piece.type];
             if (!buffer || !buffer.vertexCount) continue;

             // Determine piece's current world position
             mat4.identity(modelMatrix);
             let pieceTranslation = vec3.create();
             
             // Is this piece the captured piece being animated?
             if (animationState?.isCaptureAnimating && piece.id === animationState.capturedPieceId) {
                  vec3.copy(pieceTranslation, animationState.capturedPiecePosition);
             // Is this piece the attacking piece being animated (move or capture)?
             } else if (animationState && (animationState.isAnimating || animationState.isCaptureAnimating) && piece.id === animationState.pieceId) {
                 vec3.copy(pieceTranslation, animationState.currentPosition);
             // Otherwise, use standard board position
             } else {
                 const x = (piece.col - this.boardCenterOffset) * this.boardScale;
                 const y = 0; // Standard Y position
                 const z = (piece.row - this.boardCenterOffset) * this.boardScale;
                 vec3.set(pieceTranslation, x, y, z);
             }

             // Apply translation and other transformations
             mat4.translate(modelMatrix, modelMatrix, pieceTranslation);
             // TODO: Add rotation or scaling if needed

             // Calculate matrices and set uniforms
             mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
             mat3.normalFromMat4(normalMatrix, modelViewMatrix);
             gl.uniformMatrix4fv(modelViewMatrixUniformLocation, false, modelViewMatrix);
             gl.uniformMatrix3fv(normalMatrixUniformLocation, false, normalMatrix);
             if (currentPieceIdUniformLocation) gl.uniform1i(currentPieceIdUniformLocation, piece.id);
             
             // Set texture
             gl.bindTexture(gl.TEXTURE_2D, piece.color === 'white' ? this.whiteTexture : this.blackTexture);
             
             // Bind buffer and draw
             gl.bindBuffer(gl.ARRAY_BUFFER, buffer); 
             setShaderAttributes(gl, shaderProgram); // Set attributes for THIS buffer
             gl.drawArrays(gl.TRIANGLES, 0, buffer.vertexCount);
        }
    }

    // New method for drawing the scene for color picking
    drawForPicking(gl, pickingProgramInfo, viewMatrix, projectionMatrix) {
        // Picking should not be affected by visual animation
        // It should always draw based on the actual boardState
        // Existing drawForPicking logic is correct.
        const shaderProgram = pickingProgramInfo.program;
        const modelViewMatrixUniformLocation = pickingProgramInfo.uniformLocations.modelViewMatrix;
        const projectionMatrixUniformLocation = pickingProgramInfo.uniformLocations.projectionMatrix;
        const pickColorUniformLocation = pickingProgramInfo.uniformLocations.pickColor;

        gl.uniformMatrix4fv(projectionMatrixUniformLocation, false, projectionMatrix);

        const modelMatrix = mat4.create();
        const modelViewMatrix = mat4.create();

        for (const piece of this.boardState) {
            const buffer = this.buffers[piece.type];
             if (!buffer || !buffer.vertexCount) continue;

            const x = (piece.col - this.boardCenterOffset) * this.boardScale;
            const y = 0;
            const z = (piece.row - this.boardCenterOffset) * this.boardScale;
            mat4.identity(modelMatrix);
            mat4.translate(modelMatrix, modelMatrix, [x, y, z]);

            mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
            gl.uniformMatrix4fv(modelViewMatrixUniformLocation, false, modelViewMatrix);

            const id = piece.id;
            const r = (id & 0xFF) / 255.0;
            const g = ((id >> 8) & 0xFF) / 255.0;
            const b = ((id >> 16) & 0xFF) / 255.0;
            gl.uniform4f(pickColorUniformLocation, r, g, b, 1.0);

            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            setPickingShaderAttributes(gl, pickingProgramInfo); 
            gl.drawArrays(gl.TRIANGLES, 0, buffer.vertexCount);
        }
    }

    // Method to reset the board to the initial state
    resetBoard() {
        console.log("Resetting board state...");
        this.boardState = [
            // Initial board state definition (copy from constructor)
            { id: 1, type: 'rook', color: 'black', row: 0, col: 0, hasMoved: false }, { id: 2, type: 'knight', color: 'black', row: 0, col: 1 }, { id: 3, type: 'bishop', color: 'black', row: 0, col: 2 }, { id: 4, type: 'queen', color: 'black', row: 0, col: 3 }, { id: 5, type: 'king', color: 'black', row: 0, col: 4, hasMoved: false }, { id: 6, type: 'bishop', color: 'black', row: 0, col: 5 }, { id: 7, type: 'knight', color: 'black', row: 0, col: 6 }, { id: 8, type: 'rook', color: 'black', row: 0, col: 7, hasMoved: false },
            { id: 9, type: 'pawn', color: 'black', row: 1, col: 0 }, { id: 10, type: 'pawn', color: 'black', row: 1, col: 1 }, { id: 11, type: 'pawn', color: 'black', row: 1, col: 2 }, { id: 12, type: 'pawn', color: 'black', row: 1, col: 3 }, { id: 13, type: 'pawn', color: 'black', row: 1, col: 4 }, { id: 14, type: 'pawn', color: 'black', row: 1, col: 5 }, { id: 15, type: 'pawn', color: 'black', row: 1, col: 6 }, { id: 16, type: 'pawn', color: 'black', row: 1, col: 7 },
            { id: 17, type: 'pawn', color: 'white', row: 6, col: 0 }, { id: 18, type: 'pawn', color: 'white', row: 6, col: 1 }, { id: 19, type: 'pawn', color: 'white', row: 6, col: 2 }, { id: 20, type: 'pawn', color: 'white', row: 6, col: 3 }, { id: 21, type: 'pawn', color: 'white', row: 6, col: 4 }, { id: 22, type: 'pawn', color: 'white', row: 6, col: 5 }, { id: 23, type: 'pawn', color: 'white', row: 6, col: 6 }, { id: 24, type: 'pawn', color: 'white', row: 6, col: 7 },
            { id: 25, type: 'rook', color: 'white', row: 7, col: 0, hasMoved: false }, { id: 26, type: 'knight', color: 'white', row: 7, col: 1 }, { id: 27, type: 'bishop', color: 'white', row: 7, col: 2 }, { id: 28, type: 'queen', color: 'white', row: 7, col: 3 }, { id: 29, type: 'king', color: 'white', row: 7, col: 4, hasMoved: false }, { id: 30, type: 'bishop', color: 'white', row: 7, col: 5 }, { id: 31, type: 'knight', color: 'white', row: 7, col: 6 }, { id: 32, type: 'rook', color: 'white', row: 7, col: 7, hasMoved: false },
        ];
        this.rebuildPieceMap(); // Rebuild the map based on the reset state
    }
}

export { ChessSet };