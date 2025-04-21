function loadTexture(gl, url, loadColor, anisoExt = null, maxAnisotropy = 1) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(loadColor));

    const image = new Image();
    image.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); 
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        
        if (anisoExt) {
            
            gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, maxAnisotropy);
        }
    };
    image.src = url;

    return texture;
}

function setShaderAttributes(gl, shaderProgram) {
    const valuesPerVertex = 3 + 2 + 3; 
    const stride = valuesPerVertex * Float32Array.BYTES_PER_ELEMENT;

    
    const positionAttribLocation = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
    const uvAttribLocation = gl.getAttribLocation(shaderProgram, 'aTextureCoord');
    const normalAttribLocation = gl.getAttribLocation(shaderProgram, 'aVertexNormal');

    
    if (positionAttribLocation !== -1) { 
    gl.vertexAttribPointer(
        positionAttribLocation, 
            3, 
        gl.FLOAT, 
            gl.FALSE, 
            stride, 
            0 
    );
    gl.enableVertexAttribArray(positionAttribLocation);
    } else {
        console.warn("Attribute 'aVertexPosition' not found in shader program.");
    }

    
    if (uvAttribLocation !== -1) {
    gl.vertexAttribPointer(
        uvAttribLocation, 
            2, 
        gl.FLOAT, 
            gl.FALSE, 
            stride, 
            3 * Float32Array.BYTES_PER_ELEMENT 
    );
    gl.enableVertexAttribArray(uvAttribLocation);
    } else {
        console.warn("Attribute 'aTextureCoord' not found in shader program.");
    }

    
    if (normalAttribLocation !== -1) {
    gl.vertexAttribPointer(
        normalAttribLocation, 
            3, 
        gl.FLOAT, 
            gl.FALSE, 
            stride, 
            5 * Float32Array.BYTES_PER_ELEMENT 
    );
    gl.enableVertexAttribArray(normalAttribLocation);
    } else {
        console.warn("Attribute 'aVertexNormal' not found in shader program.");
    }
}


function setHighlightShaderAttributes(gl, shaderProgram) {
    const positionAttribLocation = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
    if (positionAttribLocation !== -1) {
        
        
        
        gl.vertexAttribPointer(positionAttribLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionAttribLocation);
    } else {
        console.warn("Attribute 'aVertexPosition' not found in shader program for highlights.");
    }
    
    
    
    
    
    
}

function setPickingShaderAttributes(gl, pickingProgramInfo) {
    const valuesPerVertex = 3 + 2 + 3; 
    const stride = valuesPerVertex * Float32Array.BYTES_PER_ELEMENT;

    const positionAttribLocation = pickingProgramInfo.attribLocations.vertexPosition;

    
    if (positionAttribLocation !== -1) {
        gl.vertexAttribPointer(
            positionAttribLocation, 
            3, 
            gl.FLOAT, 
            gl.FALSE, 
            stride, 
            0 
        );
        gl.enableVertexAttribArray(positionAttribLocation);
    } else {
        
        console.warn("Attribute 'aVertexPosition' not found in picking shader program.");
    }

    
    
    
}


function createSkyboxBuffer(gl, size = 50.0) {
    const vertices = [
        
        -size, -size, size, size, -size, size, size, size, size, -size, size, size,
        
        -size, -size, -size, -size, size, -size, size, size, -size, size, -size, -size,
        
        -size, size, -size, -size, size, size, size, size, size, size, size, -size,
        
        -size, -size, -size, size, -size, -size, size, -size, size, -size, -size, size,
        
        size, -size, -size, size, size, -size, size, size, size, size, -size, size,
        
        -size, -size, -size, -size, size, -size, -size, size, size, -size, -size, size,
    ];
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    buffer.vertexCount = 36; 
    return buffer;
}


function loadCubemapTexture(gl, faceInfos) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 512; 
    const height = 512;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;

    faceInfos.forEach((faceInfo) => {
        const { target, url } = faceInfo;

        
        gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, null);

        
        const image = new Image();
        image.src = url;
        image.addEventListener('load', function () {
            
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




function createPlaneBuffer(gl) {
    const size = 0.45; 
    const yOffset = 0.0; 
    
    const vertices = [
        
        -size, yOffset, -size,  0.0, 0.0,  0.0, 1.0, 0.0, 
        -size, yOffset,  size,  0.0, 1.0,  0.0, 1.0, 0.0, 
         size, yOffset,  size,  1.0, 1.0,  0.0, 1.0, 0.0, 
        
        -size, yOffset, -size,  0.0, 0.0,  0.0, 1.0, 0.0, 
         size, yOffset,  size,  1.0, 1.0,  0.0, 1.0, 0.0, 
         size, yOffset, -size,  1.0, 0.0,  0.0, 1.0, 0.0, 
    ];

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    buffer.vertexCount = 6; 
    buffer.stride = 8 * Float32Array.BYTES_PER_ELEMENT; 
    return buffer;
}

export { loadTexture, setShaderAttributes, setHighlightShaderAttributes, setPickingShaderAttributes, createSkyboxBuffer, loadCubemapTexture, createPlaneBuffer };