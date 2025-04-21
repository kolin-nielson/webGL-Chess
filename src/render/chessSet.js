import { loadTexture, setShaderAttributes, setHighlightShaderAttributes, setPickingShaderAttributes, createPlaneBuffer } from "./helpers.js";
import { readObj } from "./objReader.js";

const mat4 = glMatrix.mat4;
const mat3 = glMatrix.mat3;
const vec3 = glMatrix.vec3; 





class ChessSet {
    constructor(gl) {
        
        this.boardState = [
            
            { id: 1, type: 'rook', color: 'black', row: 0, col: 0, hasMoved: false }, { id: 2, type: 'knight', color: 'black', row: 0, col: 1 }, { id: 3, type: 'bishop', color: 'black', row: 0, col: 2 }, { id: 4, type: 'queen', color: 'black', row: 0, col: 3 }, { id: 5, type: 'king', color: 'black', row: 0, col: 4, hasMoved: false }, { id: 6, type: 'bishop', color: 'black', row: 0, col: 5 }, { id: 7, type: 'knight', color: 'black', row: 0, col: 6 }, { id: 8, type: 'rook', color: 'black', row: 0, col: 7, hasMoved: false },
            
            { id: 9, type: 'pawn', color: 'black', row: 1, col: 0 }, { id: 10, type: 'pawn', color: 'black', row: 1, col: 1 }, { id: 11, type: 'pawn', color: 'black', row: 1, col: 2 }, { id: 12, type: 'pawn', color: 'black', row: 1, col: 3 }, { id: 13, type: 'pawn', color: 'black', row: 1, col: 4 }, { id: 14, type: 'pawn', color: 'black', row: 1, col: 5 }, { id: 15, type: 'pawn', color: 'black', row: 1, col: 6 }, { id: 16, type: 'pawn', color: 'black', row: 1, col: 7 },
            
            
            { id: 17, type: 'pawn', color: 'white', row: 6, col: 0 }, { id: 18, type: 'pawn', color: 'white', row: 6, col: 1 }, { id: 19, type: 'pawn', color: 'white', row: 6, col: 2 }, { id: 20, type: 'pawn', color: 'white', row: 6, col: 3 }, { id: 21, type: 'pawn', color: 'white', row: 6, col: 4 }, { id: 22, type: 'pawn', color: 'white', row: 6, col: 5 }, { id: 23, type: 'pawn', color: 'white', row: 6, col: 6 }, { id: 24, type: 'pawn', color: 'white', row: 6, col: 7 },
            
            { id: 25, type: 'rook', color: 'white', row: 7, col: 0, hasMoved: false }, { id: 26, type: 'knight', color: 'white', row: 7, col: 1 }, { id: 27, type: 'bishop', color: 'white', row: 7, col: 2 }, { id: 28, type: 'queen', color: 'white', row: 7, col: 3 }, { id: 29, type: 'king', color: 'white', row: 7, col: 4, hasMoved: false }, { id: 30, type: 'bishop', color: 'white', row: 7, col: 5 }, { id: 31, type: 'knight', color: 'white', row: 7, col: 6 }, { id: 32, type: 'rook', color: 'white', row: 7, col: 7, hasMoved: false },
        ];
        this.boardScale = 1.0;
        this.boardCenterOffset = 3.5;
        this.rebuildPieceMap(); 
    }

    
    rebuildPieceMap() {
        this.pieceMap = new Map(this.boardState.map(p => [p.id, p]));
    }

    
    async init(gl, anisoExt = null, maxAnisotropy = 1) {
        
        this.blackTexture = loadTexture(gl, 'assets/textures/PiezasAjedrezDiffuseMarmolBlackBrighter.png', [80, 80, 80, 255], anisoExt, maxAnisotropy);
        this.whiteTexture = loadTexture(gl, 'assets/textures/PiezasAjedrezDiffuseMarmol.png', [220, 220, 220, 255], anisoExt, maxAnisotropy);
        this.boardTexture = loadTexture(gl, 'assets/textures/TableroDiffuse01.png', [255, 171, 0, 255], anisoExt, maxAnisotropy);

        
        this.baseTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([40, 35, 30, 255]));
        gl.bindTexture(gl.TEXTURE_2D, null);
        this.buffers = {};
        await readObj(gl, "assets/models/PiezasAjedrezAdjusted.obj", this.buffers);
        console.log("Loaded buffers:", Object.keys(this.buffers));
        this.highlightBuffer = createPlaneBuffer(gl);
        console.log("Highlight Buffer Created:", this.highlightBuffer, "Vertex Count:", this.highlightBuffer?.vertexCount);
        this.highlightTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.highlightTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([150, 255, 100, 180]));
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    
    getPieceById(id) {
        return this.pieceMap.get(id);
    }

    
    getPieceAt(row, col) {
        
        const index = this.boardState.findIndex(p => p.row === row && p.col === col);
        return index !== -1 ? this.boardState[index] : null;
    }

    
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
        let originalTargetPieceData = null; 

        
        const targetPiece = this.getPieceAt(targetRow, targetCol);

        if (targetPiece) {
            if (targetPiece.color === piece.color) {
                console.log("Invalid move: cannot capture own piece.");
                 return { success: false, capturedPiece: null, isCastle: false, isEnPassantCapture: false };
            }
            
            console.log(`Capture detected: Piece ${targetPiece.id} (${targetPiece.type}) at [${targetRow}, ${targetCol}] will be captured.`);
            originalTargetPieceData = { id: targetPiece.id, type: targetPiece.type, row: targetPiece.row, col: targetPiece.col, color: targetPiece.color }; 
        }

        
        console.log(`Updating piece ${pieceId} (${piece.type}) from [${startRow}, ${startCol}] to [${targetRow}, ${targetCol}]`);
        piece.row = targetRow;
        piece.col = targetCol;

        
        if ((piece.type === 'king' || piece.type === 'rook') && piece.hasMoved === false) {
            console.log(`Setting hasMoved=true for ${piece.type} ID ${piece.id}`);
            piece.hasMoved = true;
        }

        
        if (piece.type === 'pawn' && targetPiece === null) { 
            const colDiffEP = Math.abs(targetCol - startCol);
            if (colDiffEP === 1) { 
                 
                 
                 const capturedPawnRow = startRow;
                 const capturedPawnCol = targetCol;
                 const capturedPawn = this.getPieceAt(capturedPawnRow, capturedPawnCol);
                 if (capturedPawn && capturedPawn.type === 'pawn' && capturedPawn.color !== piece.color) {
                     console.log(`En Passant Capture detected: Pawn ${capturedPawn.id} at [${capturedPawnRow}, ${capturedPawnCol}] will be captured.`);
                     originalTargetPieceData = { id: capturedPawn.id, type: capturedPawn.type, row: capturedPawn.row, col: capturedPawn.col, color: capturedPawn.color }; 
                     isEnPassantCapture = true;
                 } else {
                    
                     console.error(`En Passant Error: Could not find opponent pawn at [${capturedPawnRow}, ${capturedPawnCol}] for capture, despite validation.`);
                      return { success: false, capturedPiece: null, isCastle: false, isEnPassantCapture: false };
                 }
            }
        }

        
        if (piece.type === 'king') {
            const colDiff = targetCol - startCol;
            if (Math.abs(colDiff) === 2) {
                isCastle = true; 
                const rookStartCol = (colDiff > 0) ? 7 : 0;
                const rookEndCol = (colDiff > 0) ? 5 : 3;
                const rook = this.getPieceAt(startRow, rookStartCol);
                if (rook && rook.type === 'rook' && rook.color === piece.color) {
                    console.log(`Castling: Moving rook from [${startRow}, ${rookStartCol}] to [${startRow}, ${rookEndCol}]`);
                    rook.col = rookEndCol;
                    rook.hasMoved = true;
                } else {
                    console.error(`Castling Error: Could not find corresponding rook at [${startRow}, ${rookStartCol}]`);
                    
                    return { success: false, capturedPiece: null, isCastle: false, isEnPassantCapture: false };
                }
            }
        }

        return { success: true, capturedPiece: originalTargetPieceData, isCastle: isCastle, isEnPassantCapture: isEnPassantCapture };
    }

    
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
        
        return true;
    }

    
    _uniformCache = {};

    
    getUniformLocation(gl, shaderProgram, name) {
        const cacheKey = `${shaderProgram}-${name}`;
        if (!this._uniformCache[cacheKey]) {
            this._uniformCache[cacheKey] = gl.getUniformLocation(shaderProgram, name);
        }
        return this._uniformCache[cacheKey];
    }

    
    createVAOs(gl, shaderProgram) {
        
        if (!gl.createVertexArray) return;
        this.vaos = {};
        
        for (const [name, buffer] of Object.entries(this.buffers)) {
            if (buffer && buffer.vertexCount) {
                const vao = gl.createVertexArray();
                gl.bindVertexArray(vao);
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                setShaderAttributes(gl, shaderProgram);
                gl.bindVertexArray(null);
                this.vaos[name] = vao;
            }
        }
        
        if (this.highlightBuffer) {
            const vao = gl.createVertexArray();
            gl.bindVertexArray(vao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.highlightBuffer);
            setShaderAttributes(gl, shaderProgram);
            gl.bindVertexArray(null);
            this.vaos.highlight = vao;
        }
    }

    
    draw(gl, shaderProgram, viewMatrix, projectionMatrix, animationState = null, validMoveTargets = [], currentTime = 0) {
        
        const modelViewMatrixUniformLocation = this.getUniformLocation(gl, shaderProgram, "uModelViewMatrix");
        const normalMatrixUniformLocation = this.getUniformLocation(gl, shaderProgram, "uNormalMatrix");
        const projectionMatrixUniformLocation = this.getUniformLocation(gl, shaderProgram, "uProjectionMatrix");
        const currentPieceIdUniformLocation = this.getUniformLocation(gl, shaderProgram, "uSelectedId");
        const useTextureUniformLocation = this.getUniformLocation(gl, shaderProgram, "uUseTexture");
        const baseColorUniformLocation = this.getUniformLocation(gl, shaderProgram, "uBaseColor");

        gl.uniformMatrix4fv(projectionMatrixUniformLocation, false, projectionMatrix);

        const modelMatrix = mat4.create();
        const modelViewMatrix = mat4.create();
        const normalMatrix = mat3.create();

        
        const useVAO = (gl.bindVertexArray && this.vaos);
        const boardBuffer = this.buffers["cube"];
        const boardVAO = useVAO && this.vaos["cube"];
        if (boardBuffer && boardBuffer.vertexCount) {
             mat4.identity(modelMatrix);
             
             mat4.translate(modelMatrix, modelMatrix, [0, -0.1, 0]); 
             mat4.scale(modelMatrix, modelMatrix, [1.05, 0.5, 1.05]); 

             mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
             mat3.normalFromMat4(normalMatrix, modelViewMatrix);
             gl.uniformMatrix4fv(modelViewMatrixUniformLocation, false, modelViewMatrix);
             gl.uniformMatrix3fv(normalMatrixUniformLocation, false, normalMatrix);
             if (currentPieceIdUniformLocation) gl.uniform1i(currentPieceIdUniformLocation, 0);
             if (useTextureUniformLocation) gl.uniform1i(useTextureUniformLocation, 1); 

             gl.bindTexture(gl.TEXTURE_2D, this.baseTexture); 
             if (boardVAO) {
                gl.bindVertexArray(boardVAO);
             } else {
                gl.bindBuffer(gl.ARRAY_BUFFER, boardBuffer);
                setShaderAttributes(gl, shaderProgram);
             }
             gl.drawArrays(gl.TRIANGLES, 0, boardBuffer.vertexCount);
             if (boardVAO) gl.bindVertexArray(null);
        }

        
        if (boardBuffer && boardBuffer.vertexCount) {
             mat4.identity(modelMatrix); 
             mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
             mat3.normalFromMat4(normalMatrix, modelViewMatrix);
             gl.uniformMatrix4fv(modelViewMatrixUniformLocation, false, modelViewMatrix);
             gl.uniformMatrix3fv(normalMatrixUniformLocation, false, normalMatrix);
             if (currentPieceIdUniformLocation) gl.uniform1i(currentPieceIdUniformLocation, 0);
             if (useTextureUniformLocation) gl.uniform1i(useTextureUniformLocation, 1);

             gl.bindTexture(gl.TEXTURE_2D, this.boardTexture); 
             if (boardVAO) {
                gl.bindVertexArray(boardVAO);
             } else {
                gl.bindBuffer(gl.ARRAY_BUFFER, boardBuffer);
                setShaderAttributes(gl, shaderProgram);
             }
             gl.drawArrays(gl.TRIANGLES, 0, boardBuffer.vertexCount);
             if (boardVAO) gl.bindVertexArray(null);
        } else {
            console.error("Board buffer 'cube' not found or invalid!");
        }

        
        
        gl.useProgram(shaderProgram);
        if (validMoveTargets.length > 0 && this.highlightBuffer && this.highlightBuffer.vertexCount) {
            gl.enable(gl.BLEND); 
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); 
            if (useTextureUniformLocation) gl.uniform1i(useTextureUniformLocation, 0); 
            
            if (baseColorUniformLocation) gl.uniform4f(baseColorUniformLocation, 0.8, 0.8, 0.3, 0.6);
            const highlightVAO = useVAO && this.vaos.highlight;
            if (highlightVAO) {
                gl.bindVertexArray(highlightVAO);
            } else {
                gl.bindBuffer(gl.ARRAY_BUFFER, this.highlightBuffer);
                setShaderAttributes(gl, shaderProgram);
            }

            
            if (currentPieceIdUniformLocation) gl.uniform1i(currentPieceIdUniformLocation, -1);

            
            const highlightMatrix = mat4.create();
            const highlightViewMatrix = mat4.create();
            const highlightNormalMatrix = mat3.create();

            
            for (const target of validMoveTargets) {
                const x = (target.col - this.boardCenterOffset) * this.boardScale;
                const y = 0.01; 
                const z = (target.row - this.boardCenterOffset) * this.boardScale;
                mat4.identity(highlightMatrix);
                mat4.translate(highlightMatrix, highlightMatrix, [x, y, z]);
                mat4.multiply(highlightViewMatrix, viewMatrix, highlightMatrix);
                
                mat3.normalFromMat4(highlightNormalMatrix, highlightViewMatrix);
                gl.uniformMatrix3fv(normalMatrixUniformLocation, false, highlightNormalMatrix);
                gl.uniformMatrix4fv(modelViewMatrixUniformLocation, false, highlightViewMatrix);
                gl.drawArrays(gl.TRIANGLES, 0, this.highlightBuffer.vertexCount);
            }
            gl.disable(gl.BLEND);
            if (highlightVAO) gl.bindVertexArray(null);
            if (useTextureUniformLocation) gl.uniform1i(useTextureUniformLocation, 1);
        }

        
        if (useTextureUniformLocation) gl.uniform1i(useTextureUniformLocation, 1);

        
        const pieceTranslation = vec3.create();
        const pieceMatrix = mat4.create();
        const pieceViewMatrix = mat4.create();
        const pieceNormalMatrix = mat3.create();

        
        const piecesByType = {};

        
        for (const piece of this.boardState) {
            if (!piecesByType[piece.type]) {
                piecesByType[piece.type] = [];
            }
            piecesByType[piece.type].push(piece);
        }

        
        for (const pieceType in piecesByType) {
            const buffer = this.buffers[pieceType];
            if (!buffer || !buffer.vertexCount) continue;
            const vao = useVAO && this.vaos[pieceType];
            if (vao) {
                gl.bindVertexArray(vao);
            } else {
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                setShaderAttributes(gl, shaderProgram);
            }

            
            for (const piece of piecesByType[pieceType]) {
                
                mat4.identity(pieceMatrix);

                
                
                if (animationState?.isCaptureAnimating && piece.id === animationState.capturedPieceId) {
                     vec3.copy(pieceTranslation, animationState.capturedPiecePosition);
                
                } else if (animationState && (animationState.isAnimating || animationState.isCaptureAnimating) && piece.id === animationState.pieceId) {
                    vec3.copy(pieceTranslation, animationState.currentPosition);
                
                } else {
                    const x = (piece.col - this.boardCenterOffset) * this.boardScale;
                    const y = 0; 
                    const z = (piece.row - this.boardCenterOffset) * this.boardScale;
                    vec3.set(pieceTranslation, x, y, z);
                }

                
                mat4.translate(pieceMatrix, pieceMatrix, pieceTranslation);
                

                
                mat4.multiply(pieceViewMatrix, viewMatrix, pieceMatrix);
                mat3.normalFromMat4(pieceNormalMatrix, pieceViewMatrix);
                gl.uniformMatrix4fv(modelViewMatrixUniformLocation, false, pieceViewMatrix);
                gl.uniformMatrix3fv(normalMatrixUniformLocation, false, pieceNormalMatrix);
                if (currentPieceIdUniformLocation) gl.uniform1i(currentPieceIdUniformLocation, piece.id);

                
                gl.bindTexture(gl.TEXTURE_2D, piece.color === 'white' ? this.whiteTexture : this.blackTexture);

                
                gl.drawArrays(gl.TRIANGLES, 0, buffer.vertexCount);
            }
            if (vao) gl.bindVertexArray(null);
        }
    }

    
    drawForPicking(gl, pickingProgramInfo, viewMatrix, projectionMatrix) {
        
        
        
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

    
    resetBoard() {
        console.log("Resetting board state...");
        this.boardState = [
            
            { id: 1, type: 'rook', color: 'black', row: 0, col: 0, hasMoved: false }, { id: 2, type: 'knight', color: 'black', row: 0, col: 1 }, { id: 3, type: 'bishop', color: 'black', row: 0, col: 2 }, { id: 4, type: 'queen', color: 'black', row: 0, col: 3 }, { id: 5, type: 'king', color: 'black', row: 0, col: 4, hasMoved: false }, { id: 6, type: 'bishop', color: 'black', row: 0, col: 5 }, { id: 7, type: 'knight', color: 'black', row: 0, col: 6 }, { id: 8, type: 'rook', color: 'black', row: 0, col: 7, hasMoved: false },
            { id: 9, type: 'pawn', color: 'black', row: 1, col: 0 }, { id: 10, type: 'pawn', color: 'black', row: 1, col: 1 }, { id: 11, type: 'pawn', color: 'black', row: 1, col: 2 }, { id: 12, type: 'pawn', color: 'black', row: 1, col: 3 }, { id: 13, type: 'pawn', color: 'black', row: 1, col: 4 }, { id: 14, type: 'pawn', color: 'black', row: 1, col: 5 }, { id: 15, type: 'pawn', color: 'black', row: 1, col: 6 }, { id: 16, type: 'pawn', color: 'black', row: 1, col: 7 },
            { id: 17, type: 'pawn', color: 'white', row: 6, col: 0 }, { id: 18, type: 'pawn', color: 'white', row: 6, col: 1 }, { id: 19, type: 'pawn', color: 'white', row: 6, col: 2 }, { id: 20, type: 'pawn', color: 'white', row: 6, col: 3 }, { id: 21, type: 'pawn', color: 'white', row: 6, col: 4 }, { id: 22, type: 'pawn', color: 'white', row: 6, col: 5 }, { id: 23, type: 'pawn', color: 'white', row: 6, col: 6 }, { id: 24, type: 'pawn', color: 'white', row: 6, col: 7 },
            { id: 25, type: 'rook', color: 'white', row: 7, col: 0, hasMoved: false }, { id: 26, type: 'knight', color: 'white', row: 7, col: 1 }, { id: 27, type: 'bishop', color: 'white', row: 7, col: 2 }, { id: 28, type: 'queen', color: 'white', row: 7, col: 3 }, { id: 29, type: 'king', color: 'white', row: 7, col: 4, hasMoved: false }, { id: 30, type: 'bishop', color: 'white', row: 7, col: 5 }, { id: 31, type: 'knight', color: 'white', row: 7, col: 6 }, { id: 32, type: 'rook', color: 'white', row: 7, col: 7, hasMoved: false },
        ];
        this.rebuildPieceMap(); 
    }
}

export { ChessSet };