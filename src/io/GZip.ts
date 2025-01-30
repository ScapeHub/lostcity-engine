import * as zlib from 'zlib';

/**
 * Decompresses a GZip-compressed Buffer
 * @param compressedData - The compressed GZip data (Buffer or Uint8Array-like)
 * @param offset - The offset to start reading the GZip data
 * @param length - The length of the GZip-compressed data
 * @returns A promise that resolves to the decompressed Buffer
 */
export async function gunzipDataAsync(compressedData: Uint8Array, offset: number, length: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        // Slice the compressed data from `offset` to `offset + length`
        const gzipBuffer = Buffer.from(compressedData.buffer, offset, length);

        zlib.gunzip(gzipBuffer, (err, result) => {
            if (err) {
                return reject(err); // Handle decompression error
            }
            resolve(result); // Return decompressed data as a Buffer
        });
    });
}

/**
 * Decompresses a GZip-compressed Uint8Array synchronously.
 * @param compressedData - The GZip-compressed data (Uint8Array or Buffer)
 * @param offset - The offset at which the GZip data starts within the array
 * @param length - The length of the GZip-compressed data
 * @returns The decompressed data as a Uint8Array
 */
export function gunzipDataSync(compressedData: Uint8Array, offset: number, length: number): Uint8Array {
    // Extract the portion of the compressed data we care about
    const gzipBuffer = Buffer.from(compressedData.buffer, offset, length);

    // Use `zlib.gunzipSync` to decompress data synchronously
    const decompressedBuffer = zlib.gunzipSync(gzipBuffer);

    // Convert the Buffer to a Uint8Array and return
    return new Uint8Array(decompressedBuffer.buffer, decompressedBuffer.byteOffset, decompressedBuffer.byteLength);
}

export function gzipCompress(data: Uint8Array, offset: number, length: number): Uint8Array {
    const compressed = zlib.gzipSync(data.subarray(offset, offset + length));
    compressed[9] = 0;
    return compressed;
}


