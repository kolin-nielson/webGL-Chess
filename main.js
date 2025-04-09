import { initShaderProgram } from "./shader.js";
import { ChessSet } from "./chessSet.js";
// Import raycasting functions
import { intersectRayPlane, screenToWorldRay, worldToBoardCoords } from './mathUtils.js';
// Import validation and helper, including game status check
import { isValidMove, getValidMoves, getGameStatus, isSquareAttacked } from './chessRules.js';
// Import UI functionality
import { initUI, addCapturedPiece, updateTurnIndicator, updateStatusDisplay, showGameOverOverlay, updateFPS } from './ui.js';
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

	// Initialize UI
	initUI();

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
	let isFirstTurn = true; // Flag to track if this is the first turn of the game

	// --- Animation State ---
	let animationState = {
		// Regular Move
		isAnimating: false,
		pieceId: null,
		startPosition: glMatrix.vec3.create(),
		endPosition: glMatrix.vec3.create(),
		currentPosition: glMatrix.vec3.create(), // Add this to fix TypeScript warnings
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

	// --- Camera Animation State ---
	let cameraAnimationState = {
		isAnimating: false,
		startPosition: glMatrix.vec3.create(),
		endPosition: glMatrix.vec3.create(),
		startTime: 0,
		duration: 0,
		startAngle: 0,  // Starting angle in radians
		endAngle: 0,    // Ending angle in radians
		radius: 0       // Distance from center
	};

	const standardMoveDuration = 0.4;
	const captureJumpDuration = 1.0;
	const captureStompDuration = 1.0;
	const captureJumpHeight = 0.8;
	const cameraTurnDuration = 1.2; // Duration for camera animation when turn changes (half rotation)

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
	// Create a new vec3 for currentEye so it's not a reference to whiteCameraEye or blackCameraEye
	let currentEye = glMatrix.vec3.clone(whiteCameraEye);

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

		// Update UI elements
		updateTurnIndicator(currentPlayer);
		updateStatusDisplay(status, gameStatusMessage);

		// Start camera animation to the new player's perspective
		const targetEye = (currentPlayer === 'white') ? whiteCameraEye : blackCameraEye;

		// Only start camera animation if it's not the first turn of the game
		if (!isFirstTurn) {
			// Setup circular camera animation
			cameraAnimationState.isAnimating = true;

			// Store start and end positions for reference
			glMatrix.vec3.copy(cameraAnimationState.startPosition, currentEye);
			glMatrix.vec3.copy(cameraAnimationState.endPosition, targetEye);

			// Calculate radius (distance from center to camera)
			// We'll use the XZ plane distance since Y remains constant
			const dx = currentEye[0] - at[0];
			const dz = currentEye[2] - at[2];
			cameraAnimationState.radius = Math.sqrt(dx * dx + dz * dz);

			// Calculate start angle (in radians)
			cameraAnimationState.startAngle = Math.atan2(currentEye[2] - at[2], currentEye[0] - at[0]);

			// Calculate end angle (in radians)
			cameraAnimationState.endAngle = Math.atan2(targetEye[2] - at[2], targetEye[0] - at[0]);

			// Make the camera rotate a half circle (180 degrees) to the opposite side
			// Add π radians (180 degrees) to create a half rotation
			cameraAnimationState.endAngle = cameraAnimationState.startAngle + Math.PI;

			// No need to normalize angles for a half rotation

			cameraAnimationState.startTime = performance.now() / 1000.0;
			cameraAnimationState.duration = cameraTurnDuration;
			// Removed console.log for performance
		} else {
			// If it's the first turn, just set the camera position directly without animation
			glMatrix.vec3.copy(currentEye, targetEye);
			console.log('First turn - setting camera position without animation');
			// Mark that we're no longer on the first turn
			isFirstTurn = false;
		}

		// Show game over overlay if game is over
		if (isGameOver) {
			console.log("Game Over: ", gameStatusMessage);
			showGameOverOverlay(gameStatusMessage);
		}
	}

	// --- Mouse Click Listener Function ---
	function handleMouseClick(event) {
		// Ignore clicks during ANY animation OR if game is over
		if (animationState.isAnimating || animationState.isCaptureAnimating || cameraAnimationState.isAnimating || isGameOver) return;

		const rect = canvas.getBoundingClientRect();
		const mouseX = event.clientX - rect.left;
		const mouseY = event.clientY - rect.top;

		// First, perform ray casting to determine what was clicked
		const viewMatrix = glMatrix.mat4.create();
		glMatrix.mat4.lookAt(viewMatrix, currentEye, at, up);
		const ray = screenToWorldRay(mouseX, mouseY, canvas.clientWidth, canvas.clientHeight, viewMatrix, projectionMatrix);
		if (!ray) return;
		const intersection = intersectRayPlane(ray.origin, ray.direction, boardPlanePoint, boardPlaneNormal);

		if (intersection) {
			const targetCoords = worldToBoardCoords(intersection[0], intersection[2], chessSet.boardScale, chessSet.boardCenterOffset);

			if (targetCoords) {
				// Check if we have a selected piece
				if (selectedPieceId !== null) {
					const pieceToMove = chessSet.getPieceById(selectedPieceId);
					if (!pieceToMove) { // Safety check
						selectedPieceId = null;
						validMoveTargets = [];
						return;
					}

					// Check if the clicked square is a valid move target
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
						return; // Exit after starting move animation
					}
				}

				// If we reach here, either:
				// 1. No piece was selected and we clicked on a board square
				// 2. A piece was selected but we clicked on an invalid move target
				// In either case, check if there's a piece at the clicked location
				const clickedPiece = chessSet.getPieceAt(targetCoords.row, targetCoords.col);

				if (clickedPiece && clickedPiece.color === currentPlayer) {
					// Select this piece
					selectedPieceId = clickedPiece.id;
					validMoveTargets = getValidMoves(clickedPiece, chessSet.boardState, chessSet.getPieceAt.bind(chessSet), lastMove);
					console.log(`Selected piece ${selectedPieceId} (${clickedPiece.type}) with ${validMoveTargets.length} valid moves`);
				} else {
					// Clicked on empty square or opponent's piece - deselect
					selectedPieceId = null;
					validMoveTargets = [];
				}
			} else {
				// Clicked outside the board
				selectedPieceId = null;
				validMoveTargets = [];
			}
		} else {
			// No intersection with board plane
			selectedPieceId = null;
			validMoveTargets = [];
		}
		// Redraw is handled by the animation loop, no need to explicitly call redraw here
	}

	// Listen for chess-game-reset event
	document.addEventListener('chess-game-reset', function() {
		// Reset the game state
		chessSet.resetBoard();
		currentPlayer = 'white';
		selectedPieceId = null;
		validMoveTargets = [];
		isGameOver = false;
		gameStatusMessage = "Playing";
		lastMove = null;
		isFirstTurn = true;

		// Update the UI
		updateGameStatus();
	});

	// --- Attach Event Listeners ---
	window.addEventListener("keydown", keyDown);
	window.addEventListener("keyup", keyUp);
	window.addEventListener('resize', reportWindowSize);
	canvas.addEventListener('click', handleMouseClick); // Ensure this is attached

	//
	// Main render loop
	//
	// Variables for frame rate limiting
	let lastFrameTime = 0;
	const targetFPS = 60;
	const frameInterval = 1000 / targetFPS;

	function redraw(currentTime) {
		// Update FPS counter
		updateFPS(currentTime);

		// Frame rate limiting
		const elapsed = currentTime - lastFrameTime;
		if (elapsed < frameInterval) {
			requestAnimationFrame(redraw);
			return; // Skip this frame
		}

		// Calculate a smoothed time delta
		lastFrameTime = currentTime - (elapsed % frameInterval);

		// Convert to seconds for animation calculations
		currentTime /= 1000.0;

		// --- Update Camera Animation --- (Only if camera is animating)
		if (cameraAnimationState.isAnimating) {
			const elapsedTime = currentTime - cameraAnimationState.startTime;
			const t = smoothstep(0, cameraAnimationState.duration, elapsedTime);

			// Interpolate angle for circular motion
			const currentAngle = cameraAnimationState.startAngle + (cameraAnimationState.endAngle - cameraAnimationState.startAngle) * t;

			// Calculate new camera position based on angle and radius
			const radius = cameraAnimationState.radius;
			currentEye[0] = at[0] + radius * Math.cos(currentAngle);
			currentEye[2] = at[2] + radius * Math.sin(currentAngle);
			// Y position remains constant (height above board)

			// Check if animation is complete
			if (elapsedTime >= cameraAnimationState.duration) {
				// Ensure camera is exactly at the target position
				glMatrix.vec3.copy(currentEye, cameraAnimationState.endPosition);
				cameraAnimationState.isAnimating = false;
			}
		}

		// --- Update Regular Move Animation --- (Only if isAnimating)
		if (animationState.isAnimating) {
			const elapsedTime = currentTime - animationState.startTime;
			const t = smoothstep(0, animationState.duration, elapsedTime);
			let currentPos = glMatrix.vec3.create();
			glMatrix.vec3.lerp(currentPos, animationState.startPosition, animationState.endPosition, t);
			currentPos[1] = Math.sin(t * Math.PI) * verticalArcHeight;
			animationState.currentPosition = currentPos;

			if (elapsedTime >= animationState.duration) {
				// Animation finished
				// Update board state via movePiece (no capture data expected)
				const moveResult = chessSet.movePiece(animationState.pieceId, animationState.targetRow, animationState.targetCol);
				if (moveResult.success) {
					// Check if there was a capture (en passant can cause this even in "regular" move)
					if (moveResult.capturedPiece) {
						// Add the captured piece to the UI
						addCapturedPiece(moveResult.capturedPiece, currentPlayer);
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
				animationState.isAnimating = false;
				animationState.pieceId = null;
			}
		}

		// --- Update Capture Animation --- (Only if isCaptureAnimating)
		if (animationState.isCaptureAnimating) {
			const phaseElapsedTime = currentTime - animationState.captureStartTime;
			let currentPos = glMatrix.vec3.create(); // Attacker position

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
					// Stomp complete

					if (animationState.stompCount >= animationState.maxStomps) {
						// --- Stomps Finished - Finalize Capture ---
						const moveResult = chessSet.movePiece(animationState.pieceId, animationState.targetRow, animationState.targetCol);
						if (moveResult.success && moveResult.capturedPiece) {
							if (moveResult.capturedPiece.id === animationState.capturedPieceId) {
								 // Remove captured piece

								 // Add the captured piece to the UI before removing it from the board
								 const capturedPiece = chessSet.getPieceById(animationState.capturedPieceId);
								 if (capturedPiece) {
									 // Add to the UI - captured by the opposite color of the piece
									 addCapturedPiece(capturedPiece, capturedPiece.color === 'white' ? 'black' : 'white');
								 }

								 // Now remove the piece from the board
								 chessSet.removePiece(animationState.capturedPieceId);
							} else {
								 // Error: ID mismatch
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

