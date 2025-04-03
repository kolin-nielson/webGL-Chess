// Assuming glMatrix is globally available
const vec3 = glMatrix.vec3;
const mat4 = glMatrix.mat4;
const vec4 = glMatrix.vec4; // Need vec4 for homogeneous coordinates

/**
 * Calculates the intersection point of a ray with a plane.
 * @param {vec3} rayOrigin - The origin point of the ray.
 * @param {vec3} rayDirection - The normalized direction vector of the ray.
 * @param {vec3} planePoint - A point on the plane (e.g., [0, 0, 0] for the board).
 * @param {vec3} planeNormal - The normal vector of the plane (e.g., [0, 1, 0] for the board).
 * @returns {vec3 | null} The intersection point, or null if the ray is parallel to the plane or points away.
 */
function intersectRayPlane(rayOrigin, rayDirection, planePoint, planeNormal) {
    const denom = vec3.dot(planeNormal, rayDirection);

    // Check if the ray is parallel to the plane (or very close to parallel)
    if (Math.abs(denom) < 1e-6) {
        return null; // No intersection or infinite intersections
    }

    const p0l0 = vec3.create();
    vec3.subtract(p0l0, planePoint, rayOrigin);
    const t = vec3.dot(p0l0, planeNormal) / denom;

    // Check if the intersection point is behind the ray's origin
    // Allow slightly negative t values to handle cases where origin is almost on the plane
    if (t < -1e-6) {
        return null;
    }

    // Calculate the intersection point
    const intersection = vec3.create();
    vec3.scale(intersection, rayDirection, t);
    vec3.add(intersection, rayOrigin, intersection);

    return intersection;
}

/**
 * Unprojects a 2D screen coordinate (like mouse click) into a 3D world space ray.
 * @param {number} screenX - The x-coordinate on the screen (canvas pixels, from left).
 * @param {number} screenY - The y-coordinate on the screen (canvas pixels, from top).
 * @param {number} screenWidth - The width of the screen/canvas.
 * @param {number} screenHeight - The height of the screen/canvas.
 * @param {mat4} viewMatrix - The camera's view matrix.
 * @param {mat4} projectionMatrix - The camera's projection matrix.
 * @returns {{origin: vec3, direction: vec3} | null} An object containing the ray's origin and direction in world space, or null if matrices are not invertible.
 */
function screenToWorldRay(screenX, screenY, screenWidth, screenHeight, viewMatrix, projectionMatrix) {
    // 1. Normalize Device Coordinates (NDC) - range [-1, 1]
    const ndcX = (screenX / screenWidth) * 2 - 1;
    const ndcY = 1 - (screenY / screenHeight) * 2; // Flip Y

    // 2. Prepare points on near and far planes in NDC
    // We need homogeneous coordinates (w=1)
    const nearPointHom = [ndcX, ndcY, -1.0, 1.0]; // Z = -1 is the near plane
    const farPointHom = [ndcX, ndcY, 1.0, 1.0];  // Z = 1 is the far plane

    // 3. Inverse View-Projection Matrix
    const viewProjMatrix = mat4.create();
    mat4.multiply(viewProjMatrix, projectionMatrix, viewMatrix);

    const invViewProj = mat4.create();
    if (!mat4.invert(invViewProj, viewProjMatrix)) {
        console.error("Cannot invert view-projection matrix");
        return null; // Matrix is not invertible
    }

    // 4. Unproject NDC points to World Space
    const nearPointWorld = vec4.create();
    const farPointWorld = vec4.create();

    vec4.transformMat4(nearPointWorld, nearPointHom, invViewProj);
    vec4.transformMat4(farPointWorld, farPointHom, invViewProj);

    // 5. Perspective Divide (divide by w)
    if (Math.abs(nearPointWorld[3]) < 1e-6 || Math.abs(farPointWorld[3]) < 1e-6) {
        console.warn("Perspective divide by zero or near-zero w.");
        // This might happen with orthographic projection or extreme perspectives
        // Handle gracefully - perhaps return null or a default ray
        return null;
    }

    vec3.scale(nearPointWorld, nearPointWorld, 1.0 / nearPointWorld[3]);
    vec3.scale(farPointWorld, farPointWorld, 1.0 / farPointWorld[3]);

    // 6. Calculate Ray Origin and Direction
    const rayOrigin = vec3.fromValues(nearPointWorld[0], nearPointWorld[1], nearPointWorld[2]);
    const rayEnd = vec3.fromValues(farPointWorld[0], farPointWorld[1], farPointWorld[2]);
    const rayDirection = vec3.create();
    vec3.subtract(rayDirection, rayEnd, rayOrigin);
    vec3.normalize(rayDirection, rayDirection);

    // Debugging: Log the calculated ray
    // console.log("Ray Origin:", rayOrigin);
    // console.log("Ray Direction:", rayDirection);

    return {
        origin: rayOrigin,
        direction: rayDirection
    };
}

/**
 * Converts world XZ coordinates to board row/column indices.
 * Assumes the board is centered at the world origin on the XZ plane (Y=0).
 * @param {number} worldX - The world X coordinate.
 * @param {number} worldZ - The world Z coordinate.
 * @param {number} boardScale - The scale factor applied to the board/piece positions.
 * @param {number} boardCenterOffset - The offset used to center the board (e.g., 3.5 for 8 squares of size 1).
 * @param {number} boardSize - The number of squares along one dimension (e.g., 8 for standard chess).
 * @returns {{row: number, col: number} | null} The row and column, or null if outside board bounds.
 */
function worldToBoardCoords(worldX, worldZ, boardScale, boardCenterOffset, boardSize = 8) {
    // Divide by scale and shift by the center offset
    // Use floor to get the integer index corresponding to the square
    const col = Math.floor((worldX / boardScale) + boardCenterOffset + 0.5); // Add 0.5 to center the rounding
    const row = Math.floor((worldZ / boardScale) + boardCenterOffset + 0.5); // Add 0.5 to center the rounding

    // Check bounds
    if (row < 0 || row > 7 || col < 0 || col > 7) {
        return null; // Clicked outside the logical board squares
    }
    return { row, col };
}

export { intersectRayPlane, screenToWorldRay, worldToBoardCoords }; 