import Js5Index from '#/js5/Js5Index.js';
import Packet from '#/io/Packet.js';
import { gunzipDataSync } from '#/io/GZip.js';
import BZip2 from '#/io/BZip2.js';
import { copyBytes } from '#/util/ArrayCopy.js';
import Js5Protocol from '#/js5/Js5Protocol.js';
import NameHashCollection from '#/js5/NameHashCollection.js';

export default class Js5Archive {
    public index: number;
    public idx255: Js5Index;
    public dataIndex: Js5Index;
    public checksum: number = 0;
    public fileContentCache: Uint8Array[][] = [];
    public groupContentCache: Uint8Array[] = [];
    public fileIds: Uint32Array[] = [];
    public crc8: number = 0;
    public size: number = 0;
    public groupIds: Uint32Array = new Uint32Array(0);
    public groupVersions = new Uint32Array(0);
    public groupChecksums = new Uint32Array(0);
    public groupSizes: Uint32Array = new Uint32Array(0);
    public nameHashes: Uint32Array = new Uint32Array(0);
    public groupNames?: NameHashCollection;
    public fileNames?: NameHashCollection[];
    public fileNameHashes: Uint32Array[] = [];

    constructor(index: number, idx255: Js5Index, dataIndex: Js5Index) {
        this.index = index;
        this.idx255 = idx255;
        this.dataIndex = dataIndex;
    }

    public getFile(groupId: number, fileId: number): Uint8Array {
        const fileData = this.getEncryptableFileContents(groupId, fileId);
        if (fileData == null) {
            throw new Error(`File not found for group ${groupId} file ${fileId}`);
        }
        return fileData;
    }

    public getEncryptableFileContents(groupId: number, fileId: number, xteaKeys?: Uint32Array): Uint8Array | null {
        if (groupId < 0 || groupId >= this.fileContentCache.length || this.fileContentCache[groupId] == null || fileId < 0 || fileId >= this.fileContentCache[groupId].length) {
            return null;
        }

        if (this.fileContentCache[groupId][fileId] == null) {
            let loaded = this.decodeGroup(groupId, xteaKeys);
            if (!loaded) {
                this.requestGroup(groupId);
                loaded = this.decodeGroup(groupId, xteaKeys);
                if (!loaded) {
                    return null;
                }
            }
        }
        return this.fileContentCache[groupId][fileId];
    }

    public decodeGroup(groupId: number, xteaKeys?: Uint32Array): boolean {
        if (this.groupContentCache[groupId] == null) {
            return false;
        }

        const groupSize = this.groupSizes[groupId];
        const groupFileData = this.fileContentCache[groupId];
        const groupFileIds = this.fileIds[groupId];

        let allFilesPresent = true;
        for (let i = 0; i < groupSize; i++) {
            if (groupFileData[groupFileIds[i]] == null) {
                allFilesPresent = false;
                break;
            }
        }

        if (allFilesPresent) {
            return true;
        }

        let compressedData: Uint8Array;
        if (xteaKeys == null || xteaKeys[0] == 0 && xteaKeys[1] == 0 && xteaKeys[2] == 0 && xteaKeys[3] == 0) {
            compressedData = this.groupContentCache[groupId];
        }
        else {
            compressedData = new Uint8Array(this.groupContentCache[groupId].length);
            copyBytes(this.groupContentCache[groupId], 0, compressedData, 0, compressedData.length);

            const packet = new Packet(compressedData);
            packet.decrypt(xteaKeys, 5, packet.length);
        }

        const decompressedData = Js5Archive.decompress(compressedData);

        if (groupSize < 1) {
            groupFileData[groupFileIds[0]] = decompressedData;
            return true;
        }

        let dataLength = decompressedData.length;
        const stripeCount = decompressedData[--dataLength] & 0xff;

        const packet = new Packet(decompressedData);
        dataLength -= 4 * stripeCount * groupSize;
        packet.pos = dataLength;

        const fileSizes = new Uint32Array(groupSize);
        for (let stripe = 0; stripeCount > stripe; stripe++) {
            let currentLength = 0;
            for (let f = 0; f < groupSize; f++) {
                const delta = packet.g4();

                currentLength += delta;
                fileSizes[f] += currentLength;
            }
        }

        for (let f = 0; f < groupSize; f++) {
            if(groupFileData[groupFileIds[f]] == null)
                groupFileData[groupFileIds[f]] = new Uint8Array(fileSizes[f]);

            fileSizes[f] = 0;
        }

        packet.pos = dataLength;
        let decompressedDataPointer = 0;
        for (let stripe = 0; stripeCount > stripe; stripe++) {
            let size = 0;
            for (let f = 0; f < groupSize; f++) {
                const stripeLength = fileSizes[f];

                const delta = packet.g4();
                size += delta;

                copyBytes(decompressedData, decompressedDataPointer, groupFileData[groupFileIds[f]], stripeLength, size);
                fileSizes[f] += size;
                decompressedDataPointer += size;
            }
        }

        return true;
    }

    private requestGroup(groupId: number) {
        const data = this.dataIndex.read(groupId);
        if (data == null) {
            throw new Error(`Archive ${this.index} Group ${groupId} not found`);
        }

        this.groupContentCache[groupId] = data;
    }

    public decodeMetadata() {
        const data = this.idx255.read(this.index);
        if (data == null) {
            throw new Error('No metadata found for archive ' + this.index);
        }

        this.crc8 = Packet.calculateCrc8(0, data.length, data);
        const packet = new Packet(Js5Archive.decompress(data));

        const protocol = packet.g1();
        if (protocol != Js5Protocol.Original) {
            throw new Error(`Invalid protocol: ${protocol}`);
        }

        const hasNames = packet.g1();

        this.size = packet.g2();
        this.groupIds = new Uint32Array(this.size);

        let previousGroupId = 0;
        let highestGroupId = -1;
        for (let index = 0; this.size > index; index++) {
            this.groupIds[index] = previousGroupId += packet.g2();
            if (this.groupIds[index] > highestGroupId) {
                highestGroupId = this.groupIds[index];
            }
        }

        this.groupVersions = new Uint32Array(highestGroupId + 1);
        this.groupChecksums = new Uint32Array(highestGroupId + 1);
        this.groupSizes = new Uint32Array(highestGroupId + 1);
        this.fileIds = new Array(highestGroupId + 1);
        this.fileContentCache = new Array(highestGroupId + 1);
        this.groupContentCache = new Array(highestGroupId + 1);

        if (hasNames != 0) {
            this.nameHashes = new Uint32Array(highestGroupId + 1);

            for (let i = 0; this.size > i; i++) {
                const groupId = this.groupIds[i];
                this.nameHashes[groupId] = packet.g4();
            }

            this.groupNames = new NameHashCollection(this.nameHashes);
        }

        for (let i = 0; i < this.size; i++) {
            this.groupChecksums[this.groupIds[i]] = packet.g4();
        }

        for (let i = 0; i < this.size; i++) {
            this.groupVersions[this.groupIds[i]] = packet.g4();
        }

        for (let i = 0; this.size > i; i++) {
            this.groupSizes[this.groupIds[i]] = packet.g2();
        }

        for (let i = 0; i < this.size; i++) {
            const groupId = this.groupIds[i];
            const groupSize = this.groupSizes[groupId];
            this.fileIds[groupId] = new Uint32Array(groupSize);

            let previousFileId = 0;
            let highestFileId = -1;

            for (let fileId = 0; groupSize > fileId; fileId++) {
                this.fileIds[groupId][fileId] = previousFileId += packet.g2();

                if (this.fileIds[groupId][fileId] > highestFileId) {
                    highestFileId = this.fileIds[groupId][fileId];
                }
            }

            this.fileContentCache[groupId] = new Array(highestFileId + 1);
        }

        if (hasNames != 0) {
            this.fileNames = new Array(highestGroupId + 1);
            this.fileNameHashes = new Array(highestGroupId + 1);

            for (let i = 0; this.size > i; i++) {
                const groupId = this.groupIds[i];
                const groupSize = this.groupSizes[groupId];

                this.fileNameHashes[groupId] = new Uint32Array(this.fileContentCache[groupId].length);

                for (let fileId = 0; groupSize > fileId; fileId++) {
                    this.fileNameHashes[groupId][this.fileIds[groupId][fileId]] = packet.g4();
                }

                this.fileNames[groupId] = new NameHashCollection(this.fileNameHashes[groupId]);
            }
        }
    }

    public static decompress(cacheData: Uint8Array): Uint8Array {
        const packet = new Packet(cacheData);

        const type = packet.g1();
        const length = packet.g4();

        if (length < 0) {
            throw new Error(`Invalid length: ${length}`);
        }

        if (type != 0) {
            const decompressedLength = packet.g4();
            if (decompressedLength < 0 || decompressedLength >= 2000000) {
                return new Uint8Array(100);
            }

            let decompressed: Uint8Array;
            if (type != 1) {
                // gzip
                decompressed = gunzipDataSync(cacheData, 9, length);
            }
            else {
                // bzip
                decompressed = BZip2.decompress(packet.data.subarray(packet.pos), decompressedLength, true);
            }

            return decompressed;
        }

        const decompressed = new Uint8Array(length);
        packet.gdata(decompressed, 0, length);
        return decompressed;
    }
}