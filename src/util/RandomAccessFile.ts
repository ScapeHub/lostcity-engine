import fs from 'fs';

import Packet from '#/io/Packet.js';

export default class RandomAccessFile {
    fd: number;
    pos: number = 0;

    constructor(path: string, readOnly = false) {
        if (!fs.existsSync(path)) {
            fs.writeFileSync(path, '');
        }

        this.fd = fs.openSync(path, readOnly ? 'r' : 'r+');
    }

    get length(): number {
        return fs.fstatSync(this.fd).size;
    }

    get size(): number {
        return this.length;
    }

    gdata(length: number): Buffer {
        const buffer = Buffer.alloc(length);
        fs.readSync(this.fd, buffer, 0, length, this.pos);
        this.pos += length;
        return buffer;
    }

    gPacket(length: number): Packet {
        return new Packet(this.gdata(length));
    }

    pdata(buffer: Uint8Array | Buffer | Packet): void {
        if (buffer instanceof Packet) {
            buffer = buffer.data;
        }

        fs.writeSync(this.fd, buffer, 0, buffer.length, this.pos);
        this.pos += buffer.length;
    }

    read(b: Uint8Array, length: number, offset: number): number {
        const bytesRead = fs.readSync(this.fd, b, offset, length, this.pos);
        this.pos += bytesRead;
        return bytesRead;
    }

    write(b: Uint8Array, offset: number, length: number): void {
        fs.writeSync(this.fd, b, offset, length, this.pos);
        this.pos += length;
    }

    seek(position: number): void {
        if (position < 0) {
            throw new Error('Seek position cannot be negative.');
        }

        this.pos = position;
    }

    close(): void {
        fs.closeSync(this.fd);
    }
}
