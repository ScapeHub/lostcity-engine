import Js5Archive from '#/js5/Js5Archive.js';
import RandomAccessFile from '#/util/RandomAccessFile.js';
import Js5FileChannel from '#/js5/Js5FileChannel.js';
import Js5Index from '#/js5/Js5Index.js';
import Packet from '#/io/Packet.js';
import fs from 'fs';

type MapKey = {
    name: string;
    keys: number[];
}

export default class Js5 {
    public static cache: Js5;

    private readonly _dataFile: RandomAccessFile;
    private readonly _indexFiles: RandomAccessFile[];
    private readonly _metadataFile: RandomAccessFile;

    private readonly _dataChannel: Js5FileChannel;
    private readonly _indexChannels: Js5FileChannel[];
    private readonly _metadataChannel: Js5FileChannel;

    private readonly _metadataIndex: Js5Index;

    private readonly _mapKeys: Map<string, Int32Array> = new Map();

    public readonly archives: Js5Archive[];

    constructor(directory: string, indexCount: number) {
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory);
        }

        // create cache files
        this._indexFiles = Array(indexCount);
        this.archives = Array(indexCount);

        this._dataFile = new RandomAccessFile(`${directory}/main_file_cache.dat2`);
        this._metadataFile = new RandomAccessFile(`${directory}/main_file_cache.idx255`);
        for (let i = 0; i < indexCount; i++) {
            this._indexFiles[i] = new RandomAccessFile(`${directory}/main_file_cache.idx${i}`);
        }

        // load file channels
        this._indexChannels = Array(indexCount);
        this._dataChannel = new Js5FileChannel(this._dataFile, 5200);
        this._metadataChannel = new Js5FileChannel(this._metadataFile, 6000);
        for (let i = 0; i < indexCount; i++) {
            this._indexChannels[i] = new Js5FileChannel(this._indexFiles[i], 6000);
        }

        // load metadata index
        this._metadataIndex = new Js5Index(255, this._metadataChannel, this._dataChannel, 500000);

        // load archives
        for (let i = 0; i < indexCount; i++) {
            this.archives[i] = this.loadArchive(i);
        }

        // load map keys
        this.loadMapKeys(directory);
    }

    public static open(directory: string, indexCount: number = 12) {
        if (Js5.cache) {
            throw new Error('Js5 cache already open.');
        }
        Js5.cache = new Js5(directory, indexCount);
    }

    public getMapKeys(mapName: string): Int32Array | undefined {
        return this._mapKeys.get(mapName);
    }

    public getGroupData(archiveId: number, groupId: number): Uint8Array | null {
        if (archiveId < 0 || (archiveId >= this.archives.length && archiveId !== 255)) {
            throw new Error('Invalid archive id. Must be between 0 and ' + (this.archives.length - 1) + '. Requested ' + archiveId + '.');
        }

        if (archiveId === 255) {
            return this._metadataIndex.read(groupId);
        }

        return this.archives[archiveId].getGroupData(groupId);
    }

    public getReferenceData(): Uint8Array {
        const packet = Packet.allocDirect(this.archives.length * 4);
        for (let i = 0; i < this.archives.length; i++) {
            packet.p4(this.archives[i].crc);
        }
        return packet.data.subarray(0, packet.pos);
    }

    public pack(): void {
        this.archives.forEach(archive => archive.pack());
    }

    public close(): void {
        this._dataFile.close();
        this._indexFiles.forEach(file => file.close());
        this._metadataFile.close();
    }

    public get skeletonArchive(): Js5Archive {
        return this.archives[1];
    }

    public get skinCacheArchive(): Js5Archive {
        return this.archives[0];
    }

    public get configArchive(): Js5Archive {
        return this.archives[2];
    }

    public get interfaceArchive(): Js5Archive {
        return this.archives[3];
    }

    public get soundArchive(): Js5Archive {
        return this.archives[4];
    }

    public get worldMapArchive(): Js5Archive {
        return this.archives[5];
    }

    public get musicArchive(): Js5Archive {
        return this.archives[6];
    }

    public get modelArchive(): Js5Archive {
        return this.archives[7];
    }

    public get spriteArchive(): Js5Archive {
        return this.archives[8];
    }

    public get textureArchive(): Js5Archive {
        return this.archives[9];
    }

    public get huffmanArchive(): Js5Archive {
        return this.archives[10];
    }

    public get jingleArchive(): Js5Archive {
        return this.archives[11];
    }

    private loadArchive(id: number): Js5Archive {
        const dataIndex = new Js5Index(id, this._indexChannels[id], this._dataChannel, 1000000);
        return new Js5Archive(id, this._metadataIndex, dataIndex);
    }

    private loadMapKeys(dir: string) {
        if (!fs.existsSync(`${dir}/keys.json`)) {
            return;
        }

        try {
            const raw = fs.readFileSync(`${dir}/keys.json`, 'utf-8');
            const data: MapKey[] = JSON.parse(raw);
            data.forEach(key => {
                this._mapKeys.set(key.name, new Int32Array(key.keys));
            });
        }
        catch (err) {
            console.error('Error loading keys.json', err);
        }
    }
}