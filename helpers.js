function loadTexture(gl, url, loadColor, anisoExt = null, maxAnisotropy = 1) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Fill the texture with a 1x1 blue pixel while waiting for the image to load
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(loadColor));

    const image = new Image();
    image.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
        // Set filtering parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); 
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // Apply Anisotropic filtering if available
        if (anisoExt) {
            // Use max anisotropy level supported by the browser
            gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, maxAnisotropy);
        }
    };
    image.src = url;

    return texture;
}

function setShaderAttributes(gl, shaderProgram) {
    const valuesPerVertex = 3 + 2 + 3; // 3 position, 2 UV, 3 normal
    const stride = valuesPerVertex * Float32Array.BYTES_PER_ELEMENT;

    // Get attribute locations using the correct names
    const positionAttribLocation = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
    const uvAttribLocation = gl.getAttribLocation(shaderProgram, 'aTextureCoord');
    const normalAttribLocation = gl.getAttribLocation(shaderProgram, 'aVertexNormal');

    // --- Position Attribute ---
    if (positionAttribLocation !== -1) { // Check if attribute exists
    gl.vertexAttribPointer(
        positionAttribLocation, // Attribute location
            3, // Number of elements per attribute (vec3)
        gl.FLOAT, // Type of elements
            gl.FALSE, // Normalized
            stride, // Stride
            0 // Offset
    );
    gl.enableVertexAttribArray(positionAttribLocation);
    } else {
        console.warn("Attribute 'aVertexPosition' not found in shader program.");
    }

    // --- UV Attribute ---
    if (uvAttribLocation !== -1) {
    gl.vertexAttribPointer(
        uvAttribLocation, // Attribute location
            2, // Number of elements per attribute (vec2)
        gl.FLOAT, // Type of elements
            gl.FALSE, // Normalized
            stride, // Stride
            3 * Float32Array.BYTES_PER_ELEMENT // Offset (after 3 position floats)
    );
    gl.enableVertexAttribArray(uvAttribLocation);
    } else {
        console.warn("Attribute 'aTextureCoord' not found in shader program.");
    }

    // --- Normal Attribute ---
    if (normalAttribLocation !== -1) {
    gl.vertexAttribPointer(
        normalAttribLocation, // Attribute location
            3, // Number of elements per attribute (vec3)
        gl.FLOAT, // Type of elements
            gl.FALSE, // Normalized
            stride, // Stride
            5 * Float32Array.BYTES_PER_ELEMENT // Offset (after 3 position + 2 UV floats)
    );
    gl.enableVertexAttribArray(normalAttribLocation);
    } else {
        console.warn("Attribute 'aVertexNormal' not found in shader program.");
    }
}

// Sets attributes needed for drawing simple highlights (position only)
function setHighlightShaderAttributes(gl, shaderProgram) {
    const positionAttribLocation = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
    if (positionAttribLocation !== -1) {
        // Assuming highlight buffer *only* contains vec3 position data
        // Stride = 0 means data is tightly packed (or only one attribute)
        // Offset = 0 means starts at the beginning of the buffer
        gl.vertexAttribPointer(positionAttribLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionAttribLocation);
    } else {
        console.warn("Attribute 'aVertexPosition' not found in shader program for highlights.");
    }
    // REMOVED: Explicitly disabling other attributes here.
    // Relying on setShaderAttributes before drawing pieces to re-enable them.
    // const uvAttribLocation = gl.getAttribLocation(shaderProgram, 'aTextureCoord');
    // if (uvAttribLocation !== -1) gl.disableVertexAttribArray(uvAttribLocation);
    // const normalAttribLocation = gl.getAttribLocation(shaderProgram, 'aVertexNormal');
    // if (normalAttribLocation !== -1) gl.disableVertexAttribArray(normalAttribLocation);
}

function setPickingShaderAttributes(gl, pickingProgramInfo) {
    const valuesPerVertex = 3 + 2 + 3; // Still need the full stride from the original buffer layout
    const stride = valuesPerVertex * Float32Array.BYTES_PER_ELEMENT;

    const positionAttribLocation = pickingProgramInfo.attribLocations.vertexPosition;

    // --- Position Attribute Only ---
    if (positionAttribLocation !== -1) {
        gl.vertexAttribPointer(
            positionAttribLocation, // Attribute location
            3, // Number of elements per attribute (vec3)
            gl.FLOAT, // Type of elements
            gl.FALSE, // Normalized
            stride, // Stride (uses the stride of the *original* interleaved buffer)
            0 // Offset (position is at the beginning)
        );
        gl.enableVertexAttribArray(positionAttribLocation);
    } else {
        // This check might be redundant if location is cached in pickingProgramInfo
        console.warn("Attribute 'aVertexPosition' not found in picking shader program.");
    }

    // Note: We don't need to explicitly disable the other attributes (UV, Normal)
    // because we switch shader programs. When the picking shader is active,
    // it only looks for the attributes it knows (aVertexPosition).
}

// Helper function to create a cube buffer for the skybox
function createSkyboxBuffer(gl, size = 50.0) {
    const vertices = [
        // Front face
        -size, -size, size, size, -size, size, size, size, size, -size, size, size,
        // Back face
        -size, -size, -size, -size, size, -size, size, size, -size, size, -size, -size,
        // Top face
        -size, size, -size, -size, size, size, size, size, size, size, size, -size,
        // Bottom face
        -size, -size, -size, size, -size, -size, size, -size, size, -size, -size, size,
        // Right face
        size, -size, -size, size, size, -size, size, size, size, size, -size, size,
        // Left face
        -size, -size, -size, -size, size, -size, -size, size, size, -size, -size, size,
    ];
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    buffer.vertexCount = 36; // 6 faces * 2 triangles/face * 3 vertices/triangle
    return buffer;
}

// Helper function to load a cubemap texture
function loadCubemapTexture(gl, faceInfos) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 512; // Assume textures are 512x512, adjust if needed
    const height = 512;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;

    faceInfos.forEach((faceInfo) => {
        const { target, url } = faceInfo;

        // Setup each face so it renders correctly while waiting for the image to load.
        gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, null);

        // Asynchronously load an image
        const image = new Image();
        image.src = url;
        image.addEventListener('load', function () {
            // Now that the image has loaded upload it to the texture.
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
            gl.texImage2D(target, level, internalFormat, format, type, image);
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        });
    });

    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return texture;
}

// Helper function to create a simple XY plane buffer (size 1x1, centered at origin)
// Now creates interleaved data (Pos, UV, Normal) compatible with setShaderAttributes
// With corrected CCW winding order
function createPlaneBuffer(gl) {
    const size = 0.45; // Make it slightly smaller than a board square
    const yOffset = 0.0; // Draw directly on the board plane (depth test handles)
    // Interleaved format: Pos(3), UV(2), Normal(3) - Dummy UV/Normal
    const vertices = [
        // Triangle 1 (CCW: Bottom-Left, Top-Left, Top-Right)
        -size, yOffset, -size,  0.0, 0.0,  0.0, 1.0, 0.0, // Bottom-left
        -size, yOffset,  size,  0.0, 1.0,  0.0, 1.0, 0.0, // Top-left
         size, yOffset,  size,  1.0, 1.0,  0.0, 1.0, 0.0, // Top-right
        // Triangle 2 (CCW: Bottom-Left, Top-Right, Bottom-Right)
        -size, yOffset, -size,  0.0, 0.0,  0.0, 1.0, 0.0, // Bottom-left
         size, yOffset,  size,  1.0, 1.0,  0.0, 1.0, 0.0, // Top-right
         size, yOffset, -size,  1.0, 0.0,  0.0, 1.0, 0.0, // Bottom-right
    ];

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    buffer.vertexCount = 6; // 2 triangles * 3 vertices/triangle
    buffer.stride = 8 * Float32Array.BYTES_PER_ELEMENT; // Store stride for setShaderAttributes
    return buffer;
}

export { loadTexture, setShaderAttributes, setHighlightShaderAttributes, setPickingShaderAttributes, createSkyboxBuffer, loadCubemapTexture, createPlaneBuffer };