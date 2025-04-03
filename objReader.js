// objReader.js

// Helper function used by readObj
function AddVertexBufferObject(gl, buffers, objectName, vertexList, uvList, normalList, currentFaceList) {
    const vertices = [];
    for (let i = 0; i < currentFaceList.length; i += 3) {
        const vertexIndex = currentFaceList[i] * 3;
        const uvIndex = currentFaceList[i + 1] * 2;
        const normalIndex = currentFaceList[i + 2] * 3;
        vertices.push(
            vertexList[vertexIndex + 0], vertexList[vertexIndex + 1], vertexList[vertexIndex + 2], // x,y,z
            uvList[uvIndex + 0], uvList[uvIndex + 1], // u,v
            normalList[normalIndex + 0], normalList[normalIndex + 1], normalList[normalIndex + 2] // nx,ny,nz
        );
    }

    const vertexBufferObject = gl.createBuffer();
    vertexBufferObject.vertexCount = vertices.length / 8; // 8 components per vertex (3+2+3)
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBufferObject);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    buffers[objectName] = vertexBufferObject;
}

// Parses an OBJ file text and creates WebGL buffers for each object found.
async function readObj(gl, filename, buffers) {
    const response = await fetch(filename);
    if (!response.ok) {
        throw new Error(`Failed to fetch OBJ file: ${filename} - Status ${response.status}`);
    }
    const text = await response.text()

    const lines = text.split("\n");
    let objectName = "defaultObject"; // Default name if no 'o' line found before faces
    const vertexList = [];
    const normalList = [];
    const uvList = [];
    let currentFaceList = [];

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) continue; // Skip empty lines and comments

        const values = trimmedLine.split(/\s+/); // Split by whitespace
        const type = values[0];

        if (type === 'o') {
            // If we were processing faces for a previous object, finalize it
            if (currentFaceList.length > 0 && objectName) {
                AddVertexBufferObject(gl, buffers, objectName, vertexList, uvList, normalList, currentFaceList);
                currentFaceList = []; // Reset for the new object
            }
            objectName = values[1];
        } else if (type === 'v') {
            vertexList.push(parseFloat(values[1]), parseFloat(values[2]), parseFloat(values[3]));
        } else if (type === 'vn') {
            normalList.push(parseFloat(values[1]), parseFloat(values[2]), parseFloat(values[3]));
        } else if (type === 'vt') {
            // Handle 2D or 3D texture coords, ignore Z if present
            uvList.push(parseFloat(values[1]), 1.0 - parseFloat(values[2])); // Invert V coordinate for WebGL
        } else if (type === 'f') {
            // Handle faces (triangulate if necessary)
            const numVerts = values.length - 1;
            if (numVerts < 3) continue; // Need at least 3 vertices for a face

            const faceIndices = []; // Store vertex/uv/normal indices for this face
            for (let i = 1; i <= numVerts; i++) {
                const fields = values[i].split('/');
                const vIndex = parseInt(fields[0]) - 1; // Vertex index
                const tIndex = fields.length > 1 && fields[1] ? parseInt(fields[1]) - 1 : vIndex; // UV index (default to vIndex if missing)
                const nIndex = fields.length > 2 && fields[2] ? parseInt(fields[2]) - 1 : vIndex; // Normal index (default to vIndex if missing)
                faceIndices.push(vIndex, tIndex, nIndex);
            }

            // Triangulate the face (create fan from first vertex)
            for (let i = 1; i < numVerts - 1; i++) {
                // Triangle: vertex 0, vertex i, vertex i+1
                currentFaceList.push(faceIndices[0*3+0], faceIndices[0*3+1], faceIndices[0*3+2]);
                currentFaceList.push(faceIndices[i*3+0], faceIndices[i*3+1], faceIndices[i*3+2]);
                currentFaceList.push(faceIndices[(i+1)*3+0], faceIndices[(i+1)*3+1], faceIndices[(i+1)*3+2]);
            }
        }
    }
    // Add the last object found
    if (currentFaceList.length > 0 && objectName) {
        AddVertexBufferObject(gl, buffers, objectName, vertexList, uvList, normalList, currentFaceList);
    }
}

export { readObj }; 