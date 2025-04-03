import { initShaderProgram } from "./shader.js";
import { ChessSet } from "./chessSet.js";
// Import raycasting functions
import { intersectRayPlane, screenToWorldRay, worldToBoardCoords } from './mathUtils.js';
// Import validation and helper, including game status check
import { isValidMove, getValidMoves, getGameStatus, isSquareAttacked } from './chessRules.js';
// Import skybox helpers (REMOVED)
// import { createSkyboxBuffer, loadCubemapTexture } from './helpers.js';

// Assuming glMatrix is globally available from index.html script tag
// (Constants moved or removed)

// Simple smoothstep easing function
function smoothstep(edge0, edge1, x) {
	const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

// Function to convert row/col to world coordinates
function boardToWorldCoords(row, col, boardScale, boardCenterOffset) {
	const x = (col - boardCenterOffset) * boardScale;
	const z = (row - boardCenterOffset) * boardScale;
	// Use glMatrix.vec3 directly
	return glMatrix.vec3.fromValues(x, 0, z); 
}

// --- Global Constants ---
const verticalArcHeight = 0.5;
const pieceBaseHeight = 1.0; // Default/fallback height

// Map piece types to approximate heights (adjust as needed)
const PIECE_TYPE_HEIGHTS = {
	'pawn': 0.8,
	'rook': 1.0,
	'knight': 1.1,
	'bishop': 1.2,
	'queen': 1.4,
	'king': 1.5
};

// Wrap the main execution in DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
	console.log('DOM fully loaded and parsed');

	// --- Check glMatrix exists ---
	if (typeof glMatrix === 'undefined') {
		console.error("glMatrix global object not found! Check script inclusion and ensure it runs before this.");
		alert("Fatal Error: Required graphics library not loaded.");
		return;
	}
	// Now we assume glMatrix.vec3, glMatrix.mat4 etc. exist

	console.log('This is working');

	// Get UI elements (Removed resetButton)
	const turnDisplay = document.getElementById('turn-display');
	const statusDisplay = document.getElementById('status-display');

	//
	// start gl
	// 
	const canvas = document.getElementById('glcanvas');
	const gl = canvas.getContext('webgl');
	if (!gl) {
		alert('Your browser does not support WebGL');
	}

	// --- Get Anisotropic Filtering Extension --- 
	const anisoExt = (
		gl.getExtension('EXT_texture_filter_anisotropic') ||
		gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
		gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')
	);
	let maxAnisotropy = 1;
	if (anisoExt) {
		maxAnisotropy = gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
		console.log(`Anisotropic filtering supported. Max level: ${maxAnisotropy}`);
	} else {
		console.log("Anisotropic filtering not supported.");
	}

	gl.clearColor(0.75, 0.85, 0.8, 1.0); // Background for normal rendering
	gl.enable(gl.DEPTH_TEST); // Enable depth testing
	gl.depthFunc(gl.LEQUAL); // Near things obscure far things
	gl.enable(gl.CULL_FACE);

	// --- Game State Variables ---
	let selectedPieceId = null;
	let currentPlayer = 'white'; // White starts
	const boardPlanePoint = [0, 0, 0]; // Can stay as array literal
	const boardPlaneNormal = [0, 1, 0]; // Can stay as array literal
	let validMoveTargets = []; // Array to store {row, col} of valid moves for selected piece
	let isGameOver = false;
	let gameStatusMessage = "Playing";
	let lastMove = null; // Store info like { pieceId, startRow, startCol, endRow, endCol, pieceType, isDoublePawnPush }

	// --- Animation State --- 
	let animationState = {
		// Regular Move
		isAnimating: false,
		pieceId: null,
		startPosition: glMatrix.vec3.create(),
		endPosition: glMatrix.vec3.create(),
		startTime: 0,
		// duration will be set dynamically
		targetRow: 0,
		targetCol: 0,
		// Capture Animation Specific
		isCaptureAnimating: false,
		capturePhase: 0, // 0: idle, 1: attacker jump arc, 2: stomps
		stompCount: 0,
		maxStomps: 3,
		// stompDuration will be set dynamically
		stompHeight: 1.2, 
		capturedPieceId: null,
		captureStartTime: 0, 
		capturedPiecePosition: glMatrix.vec3.create(), 
		capturedPieceYAtStompStart: 0.0, 
		duration: 0, 
		// NEW dynamic height properties
		capturedPieceActualHeight: pieceBaseHeight, // Default
		dynamicSinkDepthPerStomp: (-pieceBaseHeight / 3) // Default
	};
	const standardMoveDuration = 0.4;
	const captureJumpDuration = 1.0; 
	const captureStompDuration = 1.0; 
	const captureJumpHeight = 0.8;

	//
	// Setup keyboard events:
	//

	window.addEventListener("keydown", keyDown);
	function keyDown(event) {
	}
	window.addEventListener("keyup", keyUp);
	function keyUp(event) {
	}

	//
	// Create MAIN shader program
	// 
	const shaderProgram = initShaderProgram(gl, await (await fetch("textureNormalTriangles.vs")).text(), await (await fetch("textureNormalTriangles.fs")).text());
	if (!shaderProgram) {
		alert("Failed to initialize the main shader program. Check console for errors.");
		return;
	}
	const programInfo = {
		program: shaderProgram,
		attribLocations: {
			vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
			textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
			vertexNormal: gl.getAttribLocation(shaderProgram, 'aVertexNormal'),
		},
		uniformLocations: {
			projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
			modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
			normalMatrix: gl.getUniformLocation(shaderProgram, 'uNormalMatrix'),
			textureSampler: gl.getUniformLocation(shaderProgram, 'uTexture'),
			useTexture: gl.getUniformLocation(shaderProgram, 'uUseTexture'),
			baseColor: gl.getUniformLocation(shaderProgram, 'uBaseColor'),
			shininess: gl.getUniformLocation(shaderProgram, 'uShininess'),
			eyePosition: gl.getUniformLocation(shaderProgram, 'uEyePosition'),
			lightDirection1: gl.getUniformLocation(shaderProgram, 'uLightDirection1'),
			ambientColor: gl.getUniformLocation(shaderProgram, 'uAmbientColor'),
			diffuseColor1: gl.getUniformLocation(shaderProgram, 'uDiffuseColor1'),
			specularColor1: gl.getUniformLocation(shaderProgram, 'uSpecularColor1'),
			lightDirection2: gl.getUniformLocation(shaderProgram, 'uLightDirection2'),
			diffuseColor2: gl.getUniformLocation(shaderProgram, 'uDiffuseColor2'),
			specularColor2: gl.getUniformLocation(shaderProgram, 'uSpecularColor2'),
			currentPieceId: gl.getUniformLocation(shaderProgram, 'uSelectedId'),
			actuallySelectedId: gl.getUniformLocation(shaderProgram, 'uActuallySelectedId'),
		},
	};

	//
	// Create PICKING shader program
	//
	const pickingShaderProgram = initShaderProgram(gl, await (await fetch("picking.vs")).text(), await (await fetch("picking.fs")).text());
	if (!pickingShaderProgram) {
		alert("Failed to initialize the picking shader program. Check console for errors.");
		return;
	}
	const pickingProgramInfo = {
		program: pickingShaderProgram,
		attribLocations: {
			vertexPosition: gl.getAttribLocation(pickingShaderProgram, 'aVertexPosition'),
		},
		uniformLocations: {
			projectionMatrix: gl.getUniformLocation(pickingShaderProgram, 'uProjectionMatrix'),
			modelViewMatrix: gl.getUniformLocation(pickingShaderProgram, 'uModelViewMatrix'),
			pickColor: gl.getUniformLocation(pickingShaderProgram, 'uPickColor'),
		},
	};

	//
	// Create SKYBOX shader program (REMOVED)
	// ... skyboxShaderProgram, skyboxProgramInfo removed ...

	gl.useProgram(programInfo.program); // Start with the main program
	gl.activeTexture(gl.TEXTURE0);
	gl.uniform1i(programInfo.uniformLocations.textureSampler, 0);

	// --- Lighting Setup (Use glMatrix.vec3 directly) ---
	const lightDirection1 = glMatrix.vec3.fromValues(0.8, -0.6, -1.0);
	glMatrix.vec3.normalize(lightDirection1, lightDirection1);
	gl.uniform3fv(programInfo.uniformLocations.lightDirection1, lightDirection1);
	gl.uniform3fv(programInfo.uniformLocations.diffuseColor1, [0.8, 0.8, 0.8]);
	gl.uniform3fv(programInfo.uniformLocations.specularColor1, [0.7, 0.7, 0.7]);

	const lightDirection2 = glMatrix.vec3.fromValues(-0.5, -0.4, 0.5);
	glMatrix.vec3.normalize(lightDirection2, lightDirection2);
	gl.uniform3fv(programInfo.uniformLocations.lightDirection2, lightDirection2);
	gl.uniform3fv(programInfo.uniformLocations.diffuseColor2, [0.3, 0.3, 0.35]);
	gl.uniform3fv(programInfo.uniformLocations.specularColor2, [0.1, 0.1, 0.1]);

	gl.uniform3fv(programInfo.uniformLocations.ambientColor, [0.15, 0.15, 0.15]);
	gl.uniform1f(programInfo.uniformLocations.shininess, 45.0);

	// --- Camera Setup ---
	// Define camera positions for each player
	const whiteCameraEye = [0, 10, 10]; // Original position
	const blackCameraEye = [0, 10, -10]; // Opposite side
	const at = [0, 0, 0]; // Look at the center of the board
	const up = [0, 1, 0];
	// Current eye will be updated based on currentPlayer
	let currentEye = whiteCameraEye;

	//
	// Create content to display
	//
	const chessSet = new ChessSet(gl);
	await chessSet.init(gl);

	//
	// Load Skybox Assets (REMOVED)
	// ... skyboxBuffer, skyboxTexture removed ...

	// --- Picking Framebuffer (FBO) Setup ---
	const pickingFBO = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, pickingFBO);

	const pickingTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, pickingTexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pickingTexture, 0);

	const pickingDepthBuffer = gl.createRenderbuffer();
	gl.bindRenderbuffer(gl.RENDERBUFFER, pickingDepthBuffer);
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, canvas.width, canvas.height);
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, pickingDepthBuffer);

	const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
	if (status !== gl.FRAMEBUFFER_COMPLETE) {
		console.error('Framebuffer incomplete: ' + status.toString());
		return;
	}

	// Unbind FBO and texture/renderbuffer
	gl.bindTexture(gl.TEXTURE_2D, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	// --- Projection Matrix Setup (Use glMatrix.mat4 directly) ---
	let projectionMatrix = glMatrix.mat4.create();
	function calculateProjectionMatrix(width, height) {
		const fieldOfView = 60 * Math.PI / 180; // in radians
		const aspect = width / height;
		const zNear = 0.1;
		const zFar = 100.0;
		glMatrix.mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);
	}

	window.addEventListener("resize", reportWindowSize);
	function reportWindowSize() {
		const clarity = 1.0;
		const displayWidth = gl.canvas.clientWidth * clarity;
		const displayHeight = gl.canvas.clientHeight * clarity;

		// Check if the canvas size has actually changed
		if (gl.canvas.width !== displayWidth || gl.canvas.height !== displayHeight) {
			gl.canvas.width = displayWidth;
			gl.canvas.height = displayHeight;

			// Resize FBO attachments
			gl.bindTexture(gl.TEXTURE_2D, pickingTexture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, displayWidth, displayHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			gl.bindTexture(gl.TEXTURE_2D, null);

			gl.bindRenderbuffer(gl.RENDERBUFFER, pickingDepthBuffer);
			gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, displayWidth, displayHeight);
			gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		}

		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
		calculateProjectionMatrix(gl.canvas.width, gl.canvas.height);
	}
	reportWindowSize(); // Initial setup

	// --- Function to Reset Game State Completely (REMOVED) ---
	// ... resetGame function removed ...

	// --- Function to Update Game Status and UI ---
	function updateGameStatus() {
		const status = getGameStatus(currentPlayer, chessSet.boardState, chessSet.getPieceAt.bind(chessSet), lastMove);
		console.log(`Game Status for ${currentPlayer}: ${status}`);

		switch (status) {
			case 'playing':
				gameStatusMessage = "Playing";
				isGameOver = false;
				break;
			case 'check':
				gameStatusMessage = `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} is in Check!`;
				isGameOver = false;
				break;
			case 'checkmate':
				gameStatusMessage = `Checkmate! ${currentPlayer === 'white' ? 'Black' : 'White'} wins!`;
				isGameOver = true;
				break;
			case 'stalemate':
				gameStatusMessage = "Stalemate! Draw.";
				isGameOver = true;
				break;
			case 'error': // Should not happen
				gameStatusMessage = "Error in game state.";
				isGameOver = true;
				break;
		}

		if (turnDisplay) {
			turnDisplay.textContent = `Turn: ${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}`;
		}
		if (statusDisplay) {
			statusDisplay.textContent = `Status: ${gameStatusMessage}`;
		}

		// Update camera position based on the NEW current player
		currentEye = (currentPlayer === 'white') ? whiteCameraEye : blackCameraEye;

		if (isGameOver) {
			console.log("Game Over: ", gameStatusMessage);
			// Optionally show a more prominent game over message/overlay
		}
	}

	// --- Mouse Click Listener Function ---
	function handleMouseClick(event) {
		// Ignore clicks during ANY animation OR if game is over
		if (animationState.isAnimating || animationState.isCaptureAnimating || isGameOver) return; 

		const rect = canvas.getBoundingClientRect();
		const mouseX = event.clientX - rect.left;
		const mouseY = event.clientY - rect.top;

		if (selectedPieceId !== null) {
			// --- Attempting Move Target Selection ---
			const pieceToMove = chessSet.getPieceById(selectedPieceId);
			if (!pieceToMove) { // Safety check
				selectedPieceId = null;
				validMoveTargets = [];
				return;
			}

			// Need view matrix for raycasting
			const viewMatrix = glMatrix.mat4.create();
			glMatrix.mat4.lookAt(viewMatrix, currentEye, at, up);
			const ray = screenToWorldRay(mouseX, mouseY, canvas.clientWidth, canvas.clientHeight, viewMatrix, projectionMatrix);
			if (!ray) return;
			const intersection = intersectRayPlane(ray.origin, ray.direction, boardPlanePoint, boardPlaneNormal);

			if (intersection) {
				const targetCoords = worldToBoardCoords(intersection[0], intersection[2], chessSet.boardScale, chessSet.boardCenterOffset);

				if (targetCoords) {
					if (pieceToMove.row === targetCoords.row && pieceToMove.col === targetCoords.col) {
						selectedPieceId = null;
						validMoveTargets = [];
					} else {
						// Check if the clicked target square is in the list of valid moves
						const isTargetValid = validMoveTargets.some(move => move.row === targetCoords.row && move.col === targetCoords.col);

						if (isTargetValid) {
							// --- Check if it's a capture before starting animation ---
							const potentialTargetPiece = chessSet.getPieceAt(targetCoords.row, targetCoords.col);
							const isEnPassant = (pieceToMove.type === 'pawn' && !potentialTargetPiece && Math.abs(targetCoords.col - pieceToMove.col) === 1);
							
							if (potentialTargetPiece && potentialTargetPiece.color !== pieceToMove.color || isEnPassant) {
								// --- Start Capture Animation Sequence ---
								console.log(`Starting CAPTURE animation for piece ${selectedPieceId} to [${targetCoords.row}, ${targetCoords.col}]`);
								
								// Find the actual captured piece ID and its height
								let capturedPiece = potentialTargetPiece;
								if (isEnPassant) {
									capturedPiece = chessSet.getPieceAt(pieceToMove.row, targetCoords.col); 
								}
								if (!capturedPiece) {
									console.error("Capture animation started but couldn't identify captured piece!");
									return; // Abort if no captured piece found
								}

								// Set animation state
								animationState.isCaptureAnimating = true;
								animationState.capturePhase = 1; // Start with jump arc
								animationState.pieceId = selectedPieceId; // Attacker
								animationState.targetRow = targetCoords.row;
								animationState.targetCol = targetCoords.col;
								animationState.startPosition = boardToWorldCoords(pieceToMove.row, pieceToMove.col, chessSet.boardScale, chessSet.boardCenterOffset);
								animationState.endPosition = boardToWorldCoords(targetCoords.row, targetCoords.col, chessSet.boardScale, chessSet.boardCenterOffset);
								animationState.capturedPieceId = capturedPiece.id;
								
								// Store actual height and calculate dynamic sinking
								animationState.capturedPieceActualHeight = PIECE_TYPE_HEIGHTS[capturedPiece.type] || pieceBaseHeight; // Use map or default
								const dynamicTotalSinkDepth = -animationState.capturedPieceActualHeight;
								animationState.dynamicSinkDepthPerStomp = dynamicTotalSinkDepth / animationState.maxStomps;
								
								animationState.stompCount = 0;
								animationState.captureStartTime = performance.now() / 1000.0;
								animationState.duration = captureJumpDuration; // Use jump duration
								animationState.capturedPieceYAtStompStart = 0.0; 

							} else {
								// --- Start Regular Move Animation ---
								console.log(`Starting REGULAR animation for piece ${selectedPieceId} to [${targetCoords.row}, ${targetCoords.col}]`);
								animationState.isAnimating = true;
								animationState.pieceId = selectedPieceId;
								animationState.targetRow = targetCoords.row;
								animationState.targetCol = targetCoords.col;
								animationState.startPosition = boardToWorldCoords(pieceToMove.row, pieceToMove.col, chessSet.boardScale, chessSet.boardCenterOffset);
								animationState.endPosition = boardToWorldCoords(targetCoords.row, targetCoords.col, chessSet.boardScale, chessSet.boardCenterOffset);
								animationState.startTime = performance.now() / 1000.0;
								animationState.duration = standardMoveDuration; // Use standard duration
							}
							selectedPieceId = null; 
							validMoveTargets = []; 
						} // End isTargetValid check
					}
				} else {
					selectedPieceId = null;
					validMoveTargets = [];
				}
			} else {
				selectedPieceId = null;
				validMoveTargets = [];
			}
		} else {
			// --- Attempting Piece Selection ---
			const webglPixelX = mouseX * gl.canvas.width / canvas.clientWidth;
			const webglPixelY = gl.canvas.height - mouseY * gl.canvas.height / canvas.clientHeight - 1;

			// Picking Render Pass
			gl.bindFramebuffer(gl.FRAMEBUFFER, pickingFBO);
			gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
			gl.useProgram(pickingProgramInfo.program);
			gl.clearColor(0.0, 0.0, 0.0, 0.0); // Clear picking buffer to empty (ID 0)
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			const pickViewMatrix = glMatrix.mat4.create(); // Use current camera for picking render
			glMatrix.mat4.lookAt(pickViewMatrix, currentEye, at, up);
			chessSet.drawForPicking(gl, pickingProgramInfo, pickViewMatrix, projectionMatrix);
			
			const pixelData = new Uint8Array(4);
			gl.readPixels(
				Math.floor(webglPixelX),
				Math.floor(webglPixelY),
				1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelData
			);
			
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
			gl.clearColor(0.75, 0.85, 0.8, 1.0); // Restore main background color
			gl.useProgram(programInfo.program); // Switch back to main program

			const clickedId = pixelData[0]; // ID from Red channel (assuming ID fits in 8 bits for simplicity)
			// If ID > 255, you'd need to decode from pixelData[0], [1], [2] etc.
			if (clickedId > 0) {
				const piece = chessSet.getPieceById(clickedId);
				if (piece && piece.color === currentPlayer) {
					selectedPieceId = clickedId;
					validMoveTargets = getValidMoves(piece, chessSet.boardState, chessSet.getPieceAt.bind(chessSet), lastMove);
				} else if (piece) {
					selectedPieceId = null; 
					validMoveTargets = [];
				} else {
					selectedPieceId = null;
					validMoveTargets = [];
				}
			} else {
				selectedPieceId = null;
				validMoveTargets = [];
			}
		}
		// Redraw is handled by the animation loop, no need to explicitly call redraw here
	}

	// --- Attach Event Listeners ---
	window.addEventListener("keydown", keyDown);
	window.addEventListener("keyup", keyUp);
	window.addEventListener('resize', reportWindowSize);
	canvas.addEventListener('click', handleMouseClick); // Ensure this is attached

	//
	// Main render loop
	//
	let previousTime = 0;
	function redraw(currentTime) {
		currentTime /= 1000.0; // Convert ms to seconds
		const deltaTime = currentTime - previousTime;
		previousTime = currentTime;

		// --- Update Regular Move Animation --- (Only if isAnimating)
		if (animationState.isAnimating) {
			const elapsedTime = currentTime - animationState.startTime;
			const t = smoothstep(0, animationState.duration, elapsedTime);
			let currentPos = glMatrix.vec3.create(); 
			glMatrix.vec3.lerp(currentPos, animationState.startPosition, animationState.endPosition, t);
			currentPos[1] = Math.sin(t * Math.PI) * verticalArcHeight; 
			animationState.currentPosition = currentPos; 

			if (elapsedTime >= animationState.duration) {
				console.log(`REGULAR Animation finished for piece ${animationState.pieceId}.`);
				// Update board state via movePiece (no capture data expected)
				const moveResult = chessSet.movePiece(animationState.pieceId, animationState.targetRow, animationState.targetCol);
				if (moveResult.success) {
					currentPlayer = (currentPlayer === 'white' ? 'black' : 'white');
					updateGameStatus(); 
					lastMove = {
						pieceId: animationState.pieceId,
						startRow: animationState.startPosition[2] / chessSet.boardScale + chessSet.boardCenterOffset, // Approx reverse calculation
						startCol: animationState.startPosition[0] / chessSet.boardScale + chessSet.boardCenterOffset, // Approx reverse calculation
						endRow: animationState.targetRow,
						endCol: animationState.targetCol,
						pieceType: chessSet.getPieceById(animationState.pieceId).type, // Type *after* potential promotion
						isDoublePawnPush: (chessSet.getPieceById(animationState.pieceId).type === 'pawn' && Math.abs(animationState.targetRow - (animationState.startPosition[2] / chessSet.boardScale + chessSet.boardCenterOffset)) === 2)
					};
					// Round startRow/startCol just in case of float issues
					lastMove.startRow = Math.round(lastMove.startRow);
					lastMove.startCol = Math.round(lastMove.startCol);
				} else {
					console.error("Move failed according to chessSet.movePiece - this might indicate an issue if isValidMove passed.");
					// Maybe play an error sound?
				}
				animationState.isAnimating = false;
				animationState.pieceId = null;
			}
		}

		// --- Update Capture Animation --- (Only if isCaptureAnimating)
		if (animationState.isCaptureAnimating) {
			const phaseElapsedTime = currentTime - animationState.captureStartTime;
			let currentPos = glMatrix.vec3.create(); // Attacker position
			let capturedPos = glMatrix.vec3.create(); // Captured position

			if (animationState.capturePhase === 1) { // Attacker Jump Arc
				const rawT = Math.min(1.0, phaseElapsedTime / animationState.duration);
				glMatrix.vec3.lerp(currentPos, animationState.startPosition, animationState.endPosition, rawT); 
				// Use DYNAMIC height for arc calculation
				currentPos[1] = (rawT * animationState.capturedPieceActualHeight) + (Math.sin(rawT * Math.PI) * captureJumpHeight); 
				animationState.currentPosition = currentPos;

				// Keep captured piece stationary on the board (Y=0)
				const capturedPiece = chessSet.getPieceById(animationState.capturedPieceId);
				if (capturedPiece) {
					animationState.capturedPiecePosition = boardToWorldCoords(capturedPiece.row, capturedPiece.col, chessSet.boardScale, chessSet.boardCenterOffset);
				}

				if (phaseElapsedTime >= animationState.duration) {
					console.log("Capture Phase 1 (Jump Arc) complete.");
					animationState.capturePhase = 2; // Move to stomps
					animationState.captureStartTime = currentTime; // Reset timer for stomps
					animationState.duration = captureStompDuration; // Set duration for a stomp
					animationState.stompCount = 0;
					// Ensure attacker is exactly at end position Y=0 before stomps
					// BUT keep captured piece's Y where it should be (should still be 0 here)
					glMatrix.vec3.copy(animationState.currentPosition, animationState.endPosition);
					// No need to explicitly set capturedPieceYAtStompStart here, it was 0 from init
				}
			} else if (animationState.capturePhase === 2) { // Stomps
				const t = Math.min(1.0, phaseElapsedTime / animationState.duration); 

				// --- Captured Piece Position Calculation (Progressive Sink) ---
				const capturedPiece = chessSet.getPieceById(animationState.capturedPieceId);
				let capturedCurrentY = animationState.capturedPieceYAtStompStart; 
				let baseCapturedPos = glMatrix.vec3.create(); 

				if (capturedPiece) {
					baseCapturedPos = boardToWorldCoords(capturedPiece.row, capturedPiece.col, chessSet.boardScale, chessSet.boardCenterOffset);

					let startY = animationState.capturedPieceYAtStompStart;
					// Target Y for the *end* of this current stomp - USE DYNAMIC SINK DEPTH
					let targetY = (animationState.stompCount + 1) * animationState.dynamicSinkDepthPerStomp;
					let sinkProgress = smoothstep(0, 1, t);
					capturedCurrentY = startY + (targetY - startY) * sinkProgress;

					baseCapturedPos[1] = capturedCurrentY; 
					animationState.capturedPiecePosition = baseCapturedPos; 
				}

				// --- Attacker Piece Position Calculation (Dynamic Height) ---
				glMatrix.vec3.copy(currentPos, animationState.endPosition); 

				// Determine the base Y for the stomp - USE DYNAMIC HEIGHT
				let stompBaseY = capturedCurrentY + animationState.capturedPieceActualHeight;

				// Calculate stomp motion relative to the captured piece's top
				// Asymmetric bounce: quick up (ease-out), slower down (ease-in)
				const upDurationRatio = 0.4; 
				let bounceHeight = 0;
				if (t < upDurationRatio) {
					const upT = t / upDurationRatio;
					bounceHeight = (1 - Math.pow(1 - upT, 3)) * animationState.stompHeight;
				} else {
					const downT = (t - upDurationRatio) / (1.0 - upDurationRatio);
					bounceHeight = (1 - Math.pow(downT, 5)) * animationState.stompHeight;
				}
				currentPos[1] = stompBaseY + bounceHeight;

				animationState.currentPosition = currentPos; 

				if (phaseElapsedTime >= animationState.duration) { // Stomp complete
					// Set the starting Y for the *next* stomp - USE DYNAMIC SINK DEPTH
					animationState.capturedPieceYAtStompStart = (animationState.stompCount + 1) * animationState.dynamicSinkDepthPerStomp;
					// Ensure the final calculated Y for this frame reflects the end state
					if (capturedPiece) {
						baseCapturedPos[1] = animationState.capturedPieceYAtStompStart;
						animationState.capturedPiecePosition = baseCapturedPos;
					}

					animationState.stompCount++;
					console.log(`Stomp ${animationState.stompCount}/${animationState.maxStomps} complete. Captured Y ~ ${animationState.capturedPieceYAtStompStart.toFixed(2)}`);

					if (animationState.stompCount >= animationState.maxStomps) {
						// --- Stomps Finished - Finalize Capture ---
						console.log("Capture Phase 2 (Stomps) complete. Finalizing.");
						const moveResult = chessSet.movePiece(animationState.pieceId, animationState.targetRow, animationState.targetCol);
						if (moveResult.success && moveResult.capturedPiece) {
							if (moveResult.capturedPiece.id === animationState.capturedPieceId) {
								 console.log(`Actually removing captured piece ID: ${animationState.capturedPieceId}`);
								 chessSet.removePiece(animationState.capturedPieceId);
							} else {
								 console.error("Mismatch between animated captured ID and moveResult captured ID!");
							}
							currentPlayer = (currentPlayer === 'white' ? 'black' : 'white');
							updateGameStatus(); 
							lastMove = {
								pieceId: animationState.pieceId,
								startRow: animationState.startPosition[2] / chessSet.boardScale + chessSet.boardCenterOffset, // Approx reverse calculation
								startCol: animationState.startPosition[0] / chessSet.boardScale + chessSet.boardCenterOffset, // Approx reverse calculation
								endRow: animationState.targetRow,
								endCol: animationState.targetCol,
								pieceType: chessSet.getPieceById(animationState.pieceId).type, // Type *after* potential promotion
								isDoublePawnPush: (chessSet.getPieceById(animationState.pieceId).type === 'pawn' && Math.abs(animationState.targetRow - (animationState.startPosition[2] / chessSet.boardScale + chessSet.boardCenterOffset)) === 2)
							};
							// Round startRow/startCol just in case of float issues
							lastMove.startRow = Math.round(lastMove.startRow);
							lastMove.startCol = Math.round(lastMove.startCol);
						} else {
							console.error("Move failed according to chessSet.movePiece - this might indicate an issue if isValidMove passed.");
							// Maybe play an error sound?
						}
						// Reset all animation states
						animationState.isAnimating = false;
						animationState.isCaptureAnimating = false;
						animationState.capturePhase = 0;
						animationState.pieceId = null;
						animationState.capturedPieceId = null;
					} else {
						// Start next stomp
						animationState.captureStartTime = currentTime;
						// Duration remains captureStompDuration
					}
				} // End Stomp complete check
			} // End Phase 2
		}

		// Calculate View Matrix (using currentEye)
		const viewMatrix = glMatrix.mat4.create();
		glMatrix.mat4.lookAt(viewMatrix, currentEye, at, up);

		// Create View matrix for Skybox (REMOVED)
		// ... skyboxViewMatrix removed ...

		// Clear the canvas before drawing
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		
		// --- Draw Skybox --- (REMOVED)
		// ... skybox drawing logic removed ...

		// --- Draw Main Scene (Chess Set) --- 
		gl.useProgram(programInfo.program); // Ensure main shader is active
		// Pass the current camera eye position to the shader
		gl.uniform3fv(programInfo.uniformLocations.eyePosition, currentEye);
		const highlightedPieceId = selectedPieceId || (animationState.isAnimating ? animationState.pieceId : 0);
		gl.uniform1i(programInfo.uniformLocations.actuallySelectedId, highlightedPieceId);

		// Draw the ChessSet (board, pieces, highlights)
		chessSet.draw(gl, programInfo.program, viewMatrix, projectionMatrix, animationState, validMoveTargets);

		requestAnimationFrame(redraw);
	}

	// Initial Status Update (will set initial camera)
	updateGameStatus();

	requestAnimationFrame(redraw); // Start the loop
});

