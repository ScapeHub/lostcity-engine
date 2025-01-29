import Js5FileChannel from '#/js5/Js5FileChannel.js';

export default class Js5Index {
    private static buffer: Uint8Array = new Uint8Array(520);

    public readonly dataChannel: Js5FileChannel;
    public readonly metaChannel: Js5FileChannel;
    public maxLength: number;
    public store: number;

    constructor(store: number, metaChannel: Js5FileChannel, dataChannel: Js5FileChannel, maxLength: number) {
        this.maxLength = maxLength;
        this.metaChannel = metaChannel;
        this.dataChannel = dataChannel;
        this.store = store;
    }

    public read(file: number): Uint8Array | null {
        try {
            if (this.metaChannel.size < (file * 6 + 6)) {
                return null;
            }

            this.metaChannel.seek(file * 6);
            this.metaChannel.read(Js5Index.buffer, 0, 6);

            let sector = (Js5Index.buffer[5] & 0xff) + ((Js5Index.buffer[3] & 0xff) << 16) + ((Js5Index.buffer[4] & 0xff) << 8);
            const size = ((Js5Index.buffer[0] & 0xff) << 16) + (Js5Index.buffer[2] & 0xff) + ((Js5Index.buffer[1] & 0xff) << 8);

            // let sector = (0xff00 & Js5Index.buffer[4] << 8) + ((0xff & Js5Index.buffer[3]) << 16) + (0xff & Js5Index.buffer[5]);
            // const size = (0xff & Js5Index.buffer[2]) + ((Js5Index.buffer[0] & 0xff) << 16) + ((0xff & Js5Index.buffer[1]) << 8);

            if (size < 0 || size > this.maxLength) {
                return null;
            }

            if (sector <= 0 || Math.floor(this.dataChannel.size / 520) < sector) {
                return null;
            }

            let position = 0;
            let part = 0;
            const data = new Uint8Array(size);
            while (size > position) {
                if (sector == 0) {
                    return null;
                }

                this.dataChannel.seek(sector * 520);

                let available = size - position;
                if (available > 512) {
                    available = 512;
                }

                this.dataChannel.read(Js5Index.buffer, 0, 8 + available);

                const sectorFile = (Js5Index.buffer[1] & 0xff) + ((Js5Index.buffer[0] & 0xff) << 8);
                const nextSector = ((Js5Index.buffer[5] & 0xff) << 8) + ((Js5Index.buffer[4] & 0xff) << 16) + (Js5Index.buffer[6] & 0xff);
                const sectorPart = (Js5Index.buffer[3] & 0xff) + ((Js5Index.buffer[2] & 0xff) << 8);
                const sectorStore = Js5Index.buffer[7] & 0xff;

                // const sectorFile = (0xff00 & Js5Index.buffer[0] << 8) + (0xff & Js5Index.buffer[1]);
                // const nextSector = (Js5Index.buffer[6] & 0xff) + ((0xff & Js5Index.buffer[5]) << 8) + ((0xff & Js5Index.buffer[4]) << 16);
                // const sectorPart = (0xff00 & Js5Index.buffer[2] << 8) + (0xff & Js5Index.buffer[3]);
                // const sectorStore = 0xff & Js5Index.buffer[7];

                if (file != sectorFile || part != sectorPart || this.store != sectorStore) {
                    return null;
                }

                if (nextSector < 0 || Math.floor(this.dataChannel.size / 520) < nextSector) {
                    return null;
                }

                for (let i = 0; i < available; i++) {
                    data[position++] = Js5Index.buffer[8 + i];
                }

                part++;
                sector = nextSector;
            }
            return data;
        }
        catch (err) {
            console.error(err);
            return null;
        }
    }

    public write(buffer: Uint8Array, file: number, length: number): boolean;
    public write(buffer: Uint8Array, file: number, length: number, overwrite: boolean): boolean;

    public write(buffer: Uint8Array, file: number, length: number, overwrite?: boolean): boolean {
        if (overwrite === undefined) {
            if (length < 0 || length > this.maxLength) {
                throw new Error('Invalid length');
            }

            let written = this.write(buffer, file, length, true);
            if (!written) {
                written = this.write(buffer, file, length, false);
            }
            return written;
        }

        try {
            let sector = 0;
            if (overwrite) {
                if (this.metaChannel.size < (file * 6 + 6)) {
                    return false;
                }

                this.metaChannel.seek(file * 6);
                this.metaChannel.read(Js5Index.buffer, 0, 6);

                sector = (Js5Index.buffer[5] & 0xff)
                    + ((Js5Index.buffer[3] & 0xff) << 16)
                    + ((Js5Index.buffer[4] & 0xff) << 8);

                if (sector <= 0 || Math.floor(this.dataChannel.size / 520) < sector) {
                    return false;
                }
            }
            else {
                sector = Math.floor(((519 + this.dataChannel.size) / 520));

                if (sector == 0) {
                    sector = 1;
                }
            }

            Js5Index.buffer[0] = (length >> 16);
            Js5Index.buffer[1] = (length >> 8);
            Js5Index.buffer[2] = length;
            Js5Index.buffer[3] = (sector >> 16);
            Js5Index.buffer[4] = (sector >> 8);
            Js5Index.buffer[5] = sector;

            this.metaChannel.seek(file * 6);
            this.metaChannel.write(Js5Index.buffer, 0, 6);

            let written = 0;
            for (let part = 0; written < length; part++) {
                let nextSector = 0;

                if (overwrite) {
                    this.dataChannel.seek(520 * sector);

                    try {
                        this.dataChannel.read(Js5Index.buffer, 0, 8);
                    }
                    catch (err) {
                        console.error(err);
                        break;
                    }

                    nextSector = ((Js5Index.buffer[5] & 0xff) << 8) + ((Js5Index.buffer[4] & 0xff) << 16) + (Js5Index.buffer[6] & 0xff);
                    const sectorFile = (Js5Index.buffer[1] & 0xff) + ((Js5Index.buffer[0] & 0xff) << 8);
                    const sectorStore = Js5Index.buffer[7] & 0xff;
                    const sectorPart = (Js5Index.buffer[3] & 255) + ((Js5Index.buffer[2] & 255) << 8);

                    // nextSector = (Js5Index.buffer[6] & 0xff) + (Js5Index.buffer[4] << 16 & 0xff0000) + (0xff00 & Js5Index.buffer[5] << 8);
                    // const sectorFile = (Js5Index.buffer[1] & 0xff) + (Js5Index.buffer[0] << 8 & 0xff00);
                    // const sectorStore = Js5Index.buffer[7] & 0xff;
                    // const sectorPart = (Js5Index.buffer[3] & 0xff) + ((0xff & Js5Index.buffer[2]) << 8);

                    if (file != sectorFile || part != sectorPart || this.store != sectorStore) {
                        return false;
                    }

                    if (nextSector < 0 || Math.floor(this.dataChannel.size / 520) < nextSector) {
                        return false;
                    }
                }

                if (nextSector == 0) {
                    overwrite = false;
                    nextSector = Math.floor(((519 + this.dataChannel.size) / 520));

                    if (nextSector == 0) {
                        nextSector++;
                    }

                    if (sector == nextSector) {
                        nextSector++;
                    }
                }

                if (length - written <= 512) {
                    nextSector = 0;
                }

                Js5Index.buffer[0] = (file >> 8);
                Js5Index.buffer[1] = file;
                Js5Index.buffer[2] = (part >> 8);
                Js5Index.buffer[3] = part;
                Js5Index.buffer[4] = (nextSector >> 16);
                Js5Index.buffer[5] = (nextSector >> 8);
                Js5Index.buffer[6] = nextSector;
                Js5Index.buffer[7] = this.store;

                this.dataChannel.seek(520 * sector);
                this.dataChannel.write(Js5Index.buffer, 0, 8);

                let available = length - written;
                if (available > 512) {
                    available = 512;
                }

                this.dataChannel.write(buffer, written, available);
                written += available;
                sector = nextSector;
            }
            return true;
        }
        catch (err) {
            console.error(err);
            return false;
        }
    }
}