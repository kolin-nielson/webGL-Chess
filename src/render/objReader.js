


function AddVertexBufferObject(gl, buffers, objectName, vertexList, uvList, normalList, currentFaceList) {
    const vertices = [];
    for (let i = 0; i < currentFaceList.length; i += 3) {
        const vertexIndex = currentFaceList[i] * 3;
        const uvIndex = currentFaceList[i + 1] * 2;
        const normalIndex = currentFaceList[i + 2] * 3;
        vertices.push(
            vertexList[vertexIndex + 0], vertexList[vertexIndex + 1], vertexList[vertexIndex + 2], 
            uvList[uvIndex + 0], uvList[uvIndex + 1], 
            normalList[normalIndex + 0], normalList[normalIndex + 1], normalList[normalIndex + 2] 
        );
    }

    const vertexBufferObject = gl.createBuffer();
    vertexBufferObject.vertexCount = vertices.length / 8; 
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBufferObject);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    buffers[objectName] = vertexBufferObject;
}


async function readObj(gl, filename, buffers) {
    const response = await fetch(filename);
    if (!response.ok) {
        throw new Error(`Failed to fetch OBJ file: ${filename} - Status ${response.status}`);
    }
    const text = await response.text()

    const lines = text.split("\n");
    let objectName = "defaultObject"; 
    const vertexList = [];
    const normalList = [];
    const uvList = [];
    let currentFaceList = [];

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) continue; 

        const values = trimmedLine.split(/\s+/); 
        const type = values[0];

        if (type === 'o') {
            
            if (currentFaceList.length > 0 && objectName) {
                AddVertexBufferObject(gl, buffers, objectName, vertexList, uvList, normalList, currentFaceList);
                currentFaceList = []; 
            }
            objectName = values[1];
        } else if (type === 'v') {
            vertexList.push(parseFloat(values[1]), parseFloat(values[2]), parseFloat(values[3]));
        } else if (type === 'vn') {
            normalList.push(parseFloat(values[1]), parseFloat(values[2]), parseFloat(values[3]));
        } else if (type === 'vt') {
            
            uvList.push(parseFloat(values[1]), 1.0 - parseFloat(values[2])); 
        } else if (type === 'f') {
            
            const numVerts = values.length - 1;
            if (numVerts < 3) continue; 

            const faceIndices = []; 
            for (let i = 1; i <= numVerts; i++) {
                const fields = values[i].split('/');
                const vIndex = parseInt(fields[0]) - 1; 
                const tIndex = fields.length > 1 && fields[1] ? parseInt(fields[1]) - 1 : vIndex; 
                const nIndex = fields.length > 2 && fields[2] ? parseInt(fields[2]) - 1 : vIndex; 
                faceIndices.push(vIndex, tIndex, nIndex);
            }

            
            for (let i = 1; i < numVerts - 1; i++) {
                
                currentFaceList.push(faceIndices[0*3+0], faceIndices[0*3+1], faceIndices[0*3+2]);
                currentFaceList.push(faceIndices[i*3+0], faceIndices[i*3+1], faceIndices[i*3+2]);
                currentFaceList.push(faceIndices[(i+1)*3+0], faceIndices[(i+1)*3+1], faceIndices[(i+1)*3+2]);
            }
        }
    }
    
    if (currentFaceList.length > 0 && objectName) {
        AddVertexBufferObject(gl, buffers, objectName, vertexList, uvList, normalList, currentFaceList);
    }
}

export { readObj }; 