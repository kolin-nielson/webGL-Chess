
const vec3 = glMatrix.vec3;
const mat4 = glMatrix.mat4;
const vec4 = glMatrix.vec4; 

function intersectRayPlane(rayOrigin, rayDirection, planePoint, planeNormal) {
    const denom = vec3.dot(planeNormal, rayDirection);

    
    if (Math.abs(denom) < 1e-6) {
        return null; 
    }

    const p0l0 = vec3.create();
    vec3.subtract(p0l0, planePoint, rayOrigin);
    const t = vec3.dot(p0l0, planeNormal) / denom;

    
    
    if (t < -1e-6) {
        return null;
    }

    
    const intersection = vec3.create();
    vec3.scale(intersection, rayDirection, t);
    vec3.add(intersection, rayOrigin, intersection);

    return intersection;
}

function screenToWorldRay(screenX, screenY, screenWidth, screenHeight, viewMatrix, projectionMatrix) {
    
    const ndcX = (screenX / screenWidth) * 2 - 1;
    const ndcY = 1 - (screenY / screenHeight) * 2; 

    
    
    const nearPointHom = [ndcX, ndcY, -1.0, 1.0]; 
    const farPointHom = [ndcX, ndcY, 1.0, 1.0];  

    
    const viewProjMatrix = mat4.create();
    mat4.multiply(viewProjMatrix, projectionMatrix, viewMatrix);

    const invViewProj = mat4.create();
    if (!mat4.invert(invViewProj, viewProjMatrix)) {
        console.error("Cannot invert view-projection matrix");
        return null; 
    }

    
    const nearPointWorld = vec4.create();
    const farPointWorld = vec4.create();

    vec4.transformMat4(nearPointWorld, nearPointHom, invViewProj);
    vec4.transformMat4(farPointWorld, farPointHom, invViewProj);

    
    if (Math.abs(nearPointWorld[3]) < 1e-6 || Math.abs(farPointWorld[3]) < 1e-6) {
        console.warn("Perspective divide by zero or near-zero w.");
        
        
        return null;
    }

    vec3.scale(nearPointWorld, nearPointWorld, 1.0 / nearPointWorld[3]);
    vec3.scale(farPointWorld, farPointWorld, 1.0 / farPointWorld[3]);

    
    const rayOrigin = vec3.fromValues(nearPointWorld[0], nearPointWorld[1], nearPointWorld[2]);
    const rayEnd = vec3.fromValues(farPointWorld[0], farPointWorld[1], farPointWorld[2]);
    const rayDirection = vec3.create();
    vec3.subtract(rayDirection, rayEnd, rayOrigin);
    vec3.normalize(rayDirection, rayDirection);

    
    
    

    return {
        origin: rayOrigin,
        direction: rayDirection
    };
}

function worldToBoardCoords(worldX, worldZ, boardScale, boardCenterOffset, boardSize = 8) {
    
    
    const col = Math.floor((worldX / boardScale) + boardCenterOffset + 0.5); 
    const row = Math.floor((worldZ / boardScale) + boardCenterOffset + 0.5); 

    
    if (row < 0 || row > 7 || col < 0 || col > 7) {
        return null; 
    }
    return { row, col };
}

export { intersectRayPlane, screenToWorldRay, worldToBoardCoords }; 