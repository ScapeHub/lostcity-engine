export function copyBytes(
    source: Uint8Array,
    sourceStart: number,
    destination: Uint8Array,
    destinationStart: number,
    numBytes: number
): void {
    if (source === destination) {
        // If source and destination are the same array
        if (sourceStart === destinationStart) {
            return; // Nothing to copy if start positions are the same
        }
        if (destinationStart > sourceStart && destinationStart < sourceStart + numBytes) {
            // Handle overlapping regions safely by copying backwards
            numBytes--; // Adjust numBytes for backward copy
            sourceStart += numBytes;
            destinationStart += numBytes;
            numBytes = sourceStart - numBytes;

            numBytes += 7; // Chunking in groups of 8 bytes
            while (sourceStart >= numBytes) {
                destination[destinationStart--] = source[sourceStart--];
                destination[destinationStart--] = source[sourceStart--];
                destination[destinationStart--] = source[sourceStart--];
                destination[destinationStart--] = source[sourceStart--];
                destination[destinationStart--] = source[sourceStart--];
                destination[destinationStart--] = source[sourceStart--];
                destination[destinationStart--] = source[sourceStart--];
                destination[destinationStart--] = source[sourceStart--];
            }

            numBytes -= 7; // Handle any leftover bytes
            while (sourceStart >= numBytes) {
                destination[destinationStart--] = source[sourceStart--];
            }
            return; // Copying is complete
        }
    }

    // Non-overlapping regions or different arrays
    numBytes += sourceStart;
    numBytes -= 7; // Chunking in groups of 8 bytes
    while (sourceStart < numBytes) {
        destination[destinationStart++] = source[sourceStart++];
        destination[destinationStart++] = source[sourceStart++];
        destination[destinationStart++] = source[sourceStart++];
        destination[destinationStart++] = source[sourceStart++];
        destination[destinationStart++] = source[sourceStart++];
        destination[destinationStart++] = source[sourceStart++];
        destination[destinationStart++] = source[sourceStart++];
        destination[destinationStart++] = source[sourceStart++];
    }

    numBytes += 7; // Handle any leftover bytes
    while (sourceStart < numBytes) {
        destination[destinationStart++] = source[sourceStart++];
    }
}