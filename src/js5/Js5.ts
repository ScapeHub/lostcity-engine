import Js5Archive from '#/js5/Js5Archive.js';
import RandomAccessFile from '#/util/RandomAccessFile.js';
import Js5FileChannel from '#/js5/Js5FileChannel.js';
import Js5Index from '#/js5/Js5Index.js';

export default class Js5 {
    private _interfaceArchive?: Js5Archive;
    private _configArchive?: Js5Archive;
    private _skeletonArchive?: Js5Archive;
    private _skinArchive?: Js5Archive;
    private _soundArchive?: Js5Archive;
    private _worldMapArchive?: Js5Archive;
    private _musicArchive?: Js5Archive;
    private _modelArchive?: Js5Archive;
    private _spriteArchive?: Js5Archive;
    private _textureArchive?: Js5Archive;
    private _huffmanArchive?: Js5Archive;
    private _jingleArchive?: Js5Archive;

    private readonly _dataFile: RandomAccessFile;
    private readonly _indexFiles: RandomAccessFile[];
    private readonly _metadataFile: RandomAccessFile;

    private readonly _dataChannel: Js5FileChannel;
    private readonly _indexChannels: Js5FileChannel[];
    private readonly _metadataChannel: Js5FileChannel;

    private readonly _metadataIndex: Js5Index;

    constructor(directory: string, indexCount: number) {
        // create cache files
        this._indexFiles = Array(indexCount);
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
    }

    public pack() {
        this.skeletonCacheArchive.pack();
        this.skinCacheArchive.pack();
        this.configArchive.pack();
        this.interfaceArchive.pack();
        this.soundArchive.pack();
        this.worldMapArchive.pack();
        this.musicArchive.pack();
        this.modelArchive.pack();
        this.spriteArchive.pack();
        this.textureArchive.pack();
        this.huffmanArchive.pack();
        this.jingleArchive.pack();
    }

    public get skeletonCacheArchive(): Js5Archive {
        return (this._skeletonArchive ??= this.loadArchive(0));
    }

    public get skinCacheArchive(): Js5Archive {
        return (this._skinArchive ??= this.loadArchive(1));
    }

    public get configArchive(): Js5Archive {
        return (this._configArchive ??= this.loadArchive(2));
    }

    public get interfaceArchive(): Js5Archive {
        return (this._interfaceArchive ??= this.loadArchive(3));
    }

    public get soundArchive(): Js5Archive {
        return (this._soundArchive ??= this.loadArchive(4));
    }

    public get worldMapArchive(): Js5Archive {
        return (this._worldMapArchive ??= this.loadArchive(5));
    }

    public get musicArchive(): Js5Archive {
        return (this._musicArchive ??= this.loadArchive(6));
    }

    public get modelArchive(): Js5Archive {
        return (this._modelArchive ??= this.loadArchive(7));
    }

    public get spriteArchive(): Js5Archive {
        return (this._spriteArchive ??= this.loadArchive(8));
    }

    public get textureArchive(): Js5Archive {
        return (this._textureArchive ??= this.loadArchive(9));
    }

    public get huffmanArchive(): Js5Archive {
        return (this._huffmanArchive ??= this.loadArchive(10));
    }

    public get jingleArchive(): Js5Archive {
        return (this._jingleArchive ??= this.loadArchive(11));
    }

    private loadArchive(id: number): Js5Archive {
        const dataIndex = new Js5Index(id, this._indexChannels[id], this._dataChannel, 1000000);
        return new Js5Archive(id, this._metadataIndex, dataIndex);
    }
}