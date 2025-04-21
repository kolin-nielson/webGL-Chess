import { initShaderProgram } from "../render/shader.js";
import { ChessSet } from "../render/chessSet.js";

import { intersectRayPlane, screenToWorldRay, worldToBoardCoords } from "../math/mathUtils.js";

import { isValidMove, getValidMoves, getGameStatus, isSquareAttacked } from "../math/chessRules.js";

import { initUI, addCapturedPiece, updateTurnIndicator, updateStatusDisplay, showGameOverOverlay, updateFPS } from "../ui/ui.js";

import { createSkyboxBuffer, loadCubemapTexture, setHighlightShaderAttributes } from "../render/helpers.js";





function smoothstep(edge0, edge1, x) {
	const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}


function boardToWorldCoords(row, col, boardScale, boardCenterOffset) {
	const x = (col - boardCenterOffset) * boardScale;
	const z = (row - boardCenterOffset) * boardScale;
	
	return glMatrix.vec3.fromValues(x, 0, z);
}


const verticalArcHeight = 0.5;
const pieceBaseHeight = 1.0; 


const PIECE_TYPE_HEIGHTS = {
	'pawn': 0.8,
	'rook': 1.0,
	'knight': 1.1,
	'bishop': 1.2,
	'queen': 1.4,
	'king': 1.5
};


document.addEventListener('DOMContentLoaded', async () => {
	console.log('DOM fully loaded and parsed');

	
	if (typeof glMatrix === 'undefined') {
		console.error("glMatrix global object not found! Check script inclusion and ensure it runs before this.");
		alert("Fatal Error: Required graphics library not loaded.");
		return;
	}
	

	console.log('This is working');

	
	initUI();

	
	
	
	const canvas = document.getElementById('glcanvas');
	
	const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
	if (!gl) {
		alert('Your browser does not support WebGL');
	}
	
	if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) {
		gl.enable(gl.FRAMEBUFFER_SRGB);
	}

	
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

	gl.clearColor(0.75, 0.85, 0.8, 1.0); 
	gl.enable(gl.DEPTH_TEST); 
	gl.depthFunc(gl.LEQUAL); 
	gl.enable(gl.CULL_FACE);

	
	let selectedPieceId = null;
	let currentPlayer = 'white'; 
	const boardPlanePoint = [0, 0, 0]; 
	const boardPlaneNormal = [0, 1, 0]; 
	let validMoveTargets = []; 
	let isGameOver = false;
	let gameStatusMessage = "Playing";
	let lastMove = null; 
	let isFirstTurn = true; 

	
	let animationState = {
		
		isAnimating: false,
		pieceId: null,
		startPosition: glMatrix.vec3.create(),
		endPosition: glMatrix.vec3.create(),
		currentPosition: glMatrix.vec3.create(), 
		startTime: 0,
		
		targetRow: 0,
		targetCol: 0,
		
		isCaptureAnimating: false,
		capturePhase: 0, 
		stompCount: 0,
		maxStomps: 3,
		
		stompHeight: 1.2,
		capturedPieceId: null,
		captureStartTime: 0,
		capturedPiecePosition: glMatrix.vec3.create(),
		capturedPieceYAtStompStart: 0.0,
		duration: 0,
		
		capturedPieceActualHeight: pieceBaseHeight, 
		dynamicSinkDepthPerStomp: (-pieceBaseHeight / 3) 
	};

	
	let cameraAnimationState = {
		isAnimating: false,
		startPosition: glMatrix.vec3.create(),
		endPosition: glMatrix.vec3.create(),
		startTime: 0,
		duration: 0,
		startAngle: 0,  
		endAngle: 0,    
		radius: 0       
	};

	const standardMoveDuration = 0.4;
	const captureJumpDuration = 1.0;
	const captureStompDuration = 1.0;
	const captureJumpHeight = 0.8;
	const cameraTurnDuration = 1.2; 

	
	
	

	window.addEventListener("keydown", keyDown);
	function keyDown(event) {
	}
	window.addEventListener("keyup", keyUp);
	function keyUp(event) {
	}

	
	
	
	const shaderProgram = initShaderProgram(
	  gl,
	  await (await fetch("assets/shaders/textureNormalTriangles.vs")).text(),
	  await (await fetch("assets/shaders/textureNormalTriangles.fs")).text()
	);
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
			envIntensity: gl.getUniformLocation(shaderProgram, 'uEnvIntensity'),
		},
	};

	
	
	
	const pickingShaderProgram = initShaderProgram(
	  gl,
	  await (await fetch("assets/shaders/picking.vs")).text(),
	  await (await fetch("assets/shaders/picking.fs")).text()
	);
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

	
	
	

	gl.useProgram(programInfo.program); 
	gl.activeTexture(gl.TEXTURE0);
	gl.uniform1i(programInfo.uniformLocations.textureSampler, 0);
	
	gl.uniform1f(programInfo.uniformLocations.envIntensity, 0.2);

	
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

	
	
	const whiteCameraEye = [0, 10, 10]; 
	const blackCameraEye = [0, 10, -10]; 
	const at = [0, 0, 0]; 
	const up = [0, 1, 0];
	
	
	let currentEye = glMatrix.vec3.clone(whiteCameraEye);

	
	
	
	const chessSet = new ChessSet(gl);
	await chessSet.init(gl);
	
	if (gl.createVertexArray) {
		chessSet.createVAOs(gl, programInfo.program);
	}

	
	
	

	
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

	
	gl.bindTexture(gl.TEXTURE_2D, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	
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

		
		if (gl.canvas.width !== displayWidth || gl.canvas.height !== displayHeight) {
			gl.canvas.width = displayWidth;
			gl.canvas.height = displayHeight;

			
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
	reportWindowSize(); 

	
	



	
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
			case 'error': 
				gameStatusMessage = "Error in game state.";
				isGameOver = true;
				break;
		}

		
		updateTurnIndicator(currentPlayer);
		updateStatusDisplay(status, gameStatusMessage);

		
		const targetEye = (currentPlayer === 'white') ? whiteCameraEye : blackCameraEye;

		
		if (!isFirstTurn) {
			
			cameraAnimationState.isAnimating = true;

			
			glMatrix.vec3.copy(cameraAnimationState.startPosition, currentEye);
			glMatrix.vec3.copy(cameraAnimationState.endPosition, targetEye);

			
			
			const dx = currentEye[0] - at[0];
			const dz = currentEye[2] - at[2];
			cameraAnimationState.radius = Math.sqrt(dx * dx + dz * dz);

			
			cameraAnimationState.startAngle = Math.atan2(currentEye[2] - at[2], currentEye[0] - at[0]);

			
			cameraAnimationState.endAngle = Math.atan2(targetEye[2] - at[2], targetEye[0] - at[0]);

			
			
			cameraAnimationState.endAngle = cameraAnimationState.startAngle + Math.PI;

			

			cameraAnimationState.startTime = performance.now() / 1000.0;
			cameraAnimationState.duration = cameraTurnDuration;
			
		} else {
			
			glMatrix.vec3.copy(currentEye, targetEye);
			console.log('First turn - setting camera position without animation');
			
			isFirstTurn = false;
		}

		
		if (isGameOver) {
			console.log("Game Over: ", gameStatusMessage);
			showGameOverOverlay(gameStatusMessage);
		}
	}

	
	function handleMouseClick(event) {
		
		if (animationState.isAnimating || animationState.isCaptureAnimating || cameraAnimationState.isAnimating || isGameOver) return;

		const rect = canvas.getBoundingClientRect();
		const mouseX = event.clientX - rect.left;
		const mouseY = event.clientY - rect.top;

		
		const viewMatrix = glMatrix.mat4.create();
		glMatrix.mat4.lookAt(viewMatrix, currentEye, at, up);
		const ray = screenToWorldRay(mouseX, mouseY, canvas.clientWidth, canvas.clientHeight, viewMatrix, projectionMatrix);
		if (!ray) return;
		const intersection = intersectRayPlane(ray.origin, ray.direction, boardPlanePoint, boardPlaneNormal);

		if (intersection) {
			const targetCoords = worldToBoardCoords(intersection[0], intersection[2], chessSet.boardScale, chessSet.boardCenterOffset);

			if (targetCoords) {
				
				if (selectedPieceId !== null) {
					const pieceToMove = chessSet.getPieceById(selectedPieceId);
					if (!pieceToMove) { 
						selectedPieceId = null;
						validMoveTargets = [];
						return;
					}

					
					const isTargetValid = validMoveTargets.some(move => move.row === targetCoords.row && move.col === targetCoords.col);

					if (isTargetValid) {
						
						const potentialTargetPiece = chessSet.getPieceAt(targetCoords.row, targetCoords.col);
						const isEnPassant = (pieceToMove.type === 'pawn' && !potentialTargetPiece && Math.abs(targetCoords.col - pieceToMove.col) === 1);

						if (potentialTargetPiece && potentialTargetPiece.color !== pieceToMove.color || isEnPassant) {
							
							console.log(`Starting CAPTURE animation for piece ${selectedPieceId} to [${targetCoords.row}, ${targetCoords.col}]`);

							
							let capturedPiece = potentialTargetPiece;
							if (isEnPassant) {
								capturedPiece = chessSet.getPieceAt(pieceToMove.row, targetCoords.col);
							}
							if (!capturedPiece) {
								console.error("Capture animation started but couldn't identify captured piece!");
								return; 
							}

							
							animationState.isCaptureAnimating = true;
							animationState.capturePhase = 1; 
							animationState.pieceId = selectedPieceId; 
							animationState.targetRow = targetCoords.row;
							animationState.targetCol = targetCoords.col;
							animationState.startPosition = boardToWorldCoords(pieceToMove.row, pieceToMove.col, chessSet.boardScale, chessSet.boardCenterOffset);
							animationState.endPosition = boardToWorldCoords(targetCoords.row, targetCoords.col, chessSet.boardScale, chessSet.boardCenterOffset);
							animationState.capturedPieceId = capturedPiece.id;

							
							animationState.capturedPieceActualHeight = PIECE_TYPE_HEIGHTS[capturedPiece.type] || pieceBaseHeight; 
							const dynamicTotalSinkDepth = -animationState.capturedPieceActualHeight;
							animationState.dynamicSinkDepthPerStomp = dynamicTotalSinkDepth / animationState.maxStomps;

							animationState.stompCount = 0;
							animationState.captureStartTime = performance.now() / 1000.0;
							animationState.duration = captureJumpDuration; 
							animationState.capturedPieceYAtStompStart = 0.0;

						} else {
							
							console.log(`Starting REGULAR animation for piece ${selectedPieceId} to [${targetCoords.row}, ${targetCoords.col}]`);
							animationState.isAnimating = true;
							animationState.pieceId = selectedPieceId;
							animationState.targetRow = targetCoords.row;
							animationState.targetCol = targetCoords.col;
							animationState.startPosition = boardToWorldCoords(pieceToMove.row, pieceToMove.col, chessSet.boardScale, chessSet.boardCenterOffset);
							animationState.endPosition = boardToWorldCoords(targetCoords.row, targetCoords.col, chessSet.boardScale, chessSet.boardCenterOffset);
							animationState.startTime = performance.now() / 1000.0;
							animationState.duration = standardMoveDuration; 
						}
						selectedPieceId = null;
						validMoveTargets = [];
						return; 
					}
				}

				
				
				
				
				const clickedPiece = chessSet.getPieceAt(targetCoords.row, targetCoords.col);

				if (clickedPiece && clickedPiece.color === currentPlayer) {
					
					selectedPieceId = clickedPiece.id;
					validMoveTargets = getValidMoves(clickedPiece, chessSet.boardState, chessSet.getPieceAt.bind(chessSet), lastMove);
					console.log(`Selected piece ${selectedPieceId} (${clickedPiece.type}) with ${validMoveTargets.length} valid moves`);
				} else {
					
					selectedPieceId = null;
					validMoveTargets = [];
				}
			} else {
				
				selectedPieceId = null;
				validMoveTargets = [];
			}
		} else {
			
			selectedPieceId = null;
			validMoveTargets = [];
		}
		
	}

	
	document.addEventListener('chess-game-reset', function() {
		
		chessSet.resetBoard();
		currentPlayer = 'white';
		selectedPieceId = null;
		validMoveTargets = [];
		isGameOver = false;
		gameStatusMessage = "Playing";
		lastMove = null;
		isFirstTurn = true;

		
		updateGameStatus();
	});

	
	window.addEventListener("keydown", keyDown);
	window.addEventListener("keyup", keyUp);
	window.addEventListener('resize', reportWindowSize);
	canvas.addEventListener('click', handleMouseClick); 

	
	
	
	
	let lastFrameTime = 0;
	const targetFPS = 60;
	const frameInterval = 1000 / targetFPS;

	function redraw(currentTime) {
		
		updateFPS(currentTime);

		
		const elapsed = currentTime - lastFrameTime;
		if (elapsed < frameInterval) {
			requestAnimationFrame(redraw);
			return; 
		}

		
		lastFrameTime = currentTime - (elapsed % frameInterval);

		
		currentTime /= 1000.0;

		
		if (cameraAnimationState.isAnimating) {
			const elapsedTime = currentTime - cameraAnimationState.startTime;
			const t = smoothstep(0, cameraAnimationState.duration, elapsedTime);

			
			const currentAngle = cameraAnimationState.startAngle + (cameraAnimationState.endAngle - cameraAnimationState.startAngle) * t;

			
			const radius = cameraAnimationState.radius;
			currentEye[0] = at[0] + radius * Math.cos(currentAngle);
			currentEye[2] = at[2] + radius * Math.sin(currentAngle);
			

			
			if (elapsedTime >= cameraAnimationState.duration) {
				
				glMatrix.vec3.copy(currentEye, cameraAnimationState.endPosition);
				cameraAnimationState.isAnimating = false;
			}
		}

		
		if (animationState.isAnimating) {
			const elapsedTime = currentTime - animationState.startTime;
			const t = smoothstep(0, animationState.duration, elapsedTime);
			let currentPos = glMatrix.vec3.create();
			glMatrix.vec3.lerp(currentPos, animationState.startPosition, animationState.endPosition, t);
			currentPos[1] = Math.sin(t * Math.PI) * verticalArcHeight;
			animationState.currentPosition = currentPos;

			if (elapsedTime >= animationState.duration) {
				
				
				const moveResult = chessSet.movePiece(animationState.pieceId, animationState.targetRow, animationState.targetCol);
				if (moveResult.success) {
					
					if (moveResult.capturedPiece) {
						
						addCapturedPiece(moveResult.capturedPiece, currentPlayer);
					}

					currentPlayer = (currentPlayer === 'white' ? 'black' : 'white');
					updateGameStatus();
					lastMove = {
						pieceId: animationState.pieceId,
						startRow: animationState.startPosition[2] / chessSet.boardScale + chessSet.boardCenterOffset, 
						startCol: animationState.startPosition[0] / chessSet.boardScale + chessSet.boardCenterOffset, 
						endRow: animationState.targetRow,
						endCol: animationState.targetCol,
						pieceType: chessSet.getPieceById(animationState.pieceId).type, 
						isDoublePawnPush: (chessSet.getPieceById(animationState.pieceId).type === 'pawn' && Math.abs(animationState.targetRow - (animationState.startPosition[2] / chessSet.boardScale + chessSet.boardCenterOffset)) === 2)
					};
					
					lastMove.startRow = Math.round(lastMove.startRow);
					lastMove.startCol = Math.round(lastMove.startCol);
				} else {
					console.error("Move failed according to chessSet.movePiece - this might indicate an issue if isValidMove passed.");
					
				}
				animationState.isAnimating = false;
				animationState.pieceId = null;
			}
		}

		
		if (animationState.isCaptureAnimating) {
			const phaseElapsedTime = currentTime - animationState.captureStartTime;
			let currentPos = glMatrix.vec3.create(); 

			if (animationState.capturePhase === 1) { 
				const rawT = Math.min(1.0, phaseElapsedTime / animationState.duration);
				glMatrix.vec3.lerp(currentPos, animationState.startPosition, animationState.endPosition, rawT);
				
				currentPos[1] = (rawT * animationState.capturedPieceActualHeight) + (Math.sin(rawT * Math.PI) * captureJumpHeight);
				animationState.currentPosition = currentPos;

				
				const capturedPiece = chessSet.getPieceById(animationState.capturedPieceId);
				if (capturedPiece) {
					animationState.capturedPiecePosition = boardToWorldCoords(capturedPiece.row, capturedPiece.col, chessSet.boardScale, chessSet.boardCenterOffset);
				}

				if (phaseElapsedTime >= animationState.duration) {
					console.log("Capture Phase 1 (Jump Arc) complete.");
					animationState.capturePhase = 2; 
					animationState.captureStartTime = currentTime; 
					animationState.duration = captureStompDuration; 
					animationState.stompCount = 0;
					
					
					glMatrix.vec3.copy(animationState.currentPosition, animationState.endPosition);
					
				}
			} else if (animationState.capturePhase === 2) { 
				const t = Math.min(1.0, phaseElapsedTime / animationState.duration);

				
				const capturedPiece = chessSet.getPieceById(animationState.capturedPieceId);
				let capturedCurrentY = animationState.capturedPieceYAtStompStart;
				let baseCapturedPos = glMatrix.vec3.create();

				if (capturedPiece) {
					baseCapturedPos = boardToWorldCoords(capturedPiece.row, capturedPiece.col, chessSet.boardScale, chessSet.boardCenterOffset);

					let startY = animationState.capturedPieceYAtStompStart;
					
					let targetY = (animationState.stompCount + 1) * animationState.dynamicSinkDepthPerStomp;
					let sinkProgress = smoothstep(0, 1, t);
					capturedCurrentY = startY + (targetY - startY) * sinkProgress;

					baseCapturedPos[1] = capturedCurrentY;
					animationState.capturedPiecePosition = baseCapturedPos;
				}

				
				glMatrix.vec3.copy(currentPos, animationState.endPosition);

				
				let stompBaseY = capturedCurrentY + animationState.capturedPieceActualHeight;

				
				
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

				if (phaseElapsedTime >= animationState.duration) { 
					
					animationState.capturedPieceYAtStompStart = (animationState.stompCount + 1) * animationState.dynamicSinkDepthPerStomp;
					
					if (capturedPiece) {
						baseCapturedPos[1] = animationState.capturedPieceYAtStompStart;
						animationState.capturedPiecePosition = baseCapturedPos;
					}

					animationState.stompCount++;
					

					if (animationState.stompCount >= animationState.maxStomps) {
						
						const moveResult = chessSet.movePiece(animationState.pieceId, animationState.targetRow, animationState.targetCol);
						if (moveResult.success && moveResult.capturedPiece) {
							if (moveResult.capturedPiece.id === animationState.capturedPieceId) {
								 

								 
								 const capturedPiece = chessSet.getPieceById(animationState.capturedPieceId);
								 if (capturedPiece) {
									 
									 addCapturedPiece(capturedPiece, capturedPiece.color === 'white' ? 'black' : 'white');
								 }

								 
								 chessSet.removePiece(animationState.capturedPieceId);
							} else {
								 
							}
							currentPlayer = (currentPlayer === 'white' ? 'black' : 'white');
							updateGameStatus();
							lastMove = {
								pieceId: animationState.pieceId,
								startRow: animationState.startPosition[2] / chessSet.boardScale + chessSet.boardCenterOffset, 
								startCol: animationState.startPosition[0] / chessSet.boardScale + chessSet.boardCenterOffset, 
								endRow: animationState.targetRow,
								endCol: animationState.targetCol,
								pieceType: chessSet.getPieceById(animationState.pieceId).type, 
								isDoublePawnPush: (chessSet.getPieceById(animationState.pieceId).type === 'pawn' && Math.abs(animationState.targetRow - (animationState.startPosition[2] / chessSet.boardScale + chessSet.boardCenterOffset)) === 2)
							};
							
							lastMove.startRow = Math.round(lastMove.startRow);
							lastMove.startCol = Math.round(lastMove.startCol);
						} else {
							console.error("Move failed according to chessSet.movePiece - this might indicate an issue if isValidMove passed.");
							
						}
						
						animationState.isAnimating = false;
						animationState.isCaptureAnimating = false;
						animationState.capturePhase = 0;
						animationState.pieceId = null;
						animationState.capturedPieceId = null;
					} else {
						
						animationState.captureStartTime = currentTime;
						
					}
				} 
			} 
		}

		
		const viewMatrix = glMatrix.mat4.create();
		glMatrix.mat4.lookAt(viewMatrix, currentEye, at, up);

		
		

		
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		
		

		
		gl.useProgram(programInfo.program); 
		
		gl.uniform3fv(programInfo.uniformLocations.eyePosition, currentEye);
		const highlightedPieceId = selectedPieceId || (animationState.isAnimating ? animationState.pieceId : 0);
		gl.uniform1i(programInfo.uniformLocations.actuallySelectedId, highlightedPieceId);

		
		chessSet.draw(gl, programInfo.program, viewMatrix, projectionMatrix, animationState, validMoveTargets, currentTime);

		requestAnimationFrame(redraw);
	}

	
	updateGameStatus();

	requestAnimationFrame(redraw); 
});

