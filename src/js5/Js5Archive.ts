import Js5Index from '#/js5/Js5Index.js';
import Packet from '#/io/Packet.js';
import { gunzipDataSync, gzipCompress } from '#/io/GZip.js';
import BZip2 from '#/io/BZip2.js';
import { copyBytes } from '#/util/ArrayCopy.js';
import Js5Protocol from '#/js5/Js5Protocol.js';
import { genJagHash } from '#/io/Jagfile.js';

type GroupMetadata = {
    id: number;
    version: number;
    checksum: number;
    size: number;
    nameHash?: number; // Optional if names are present
    files: Map<number, FileMetadata>;
    keys?: Int32Array;
    requiresPacking?: boolean;
    isLoaded: boolean;
};

type FileMetadata = {
    id: number;
    size: number;
    nameHash?: number; // Optional if names are present
    content: Uint8Array | null; // Null until contents are loaded
};

export default class Js5Archive {
    public index: number;
    public idx255: Js5Index;
    public dataIndex: Js5Index;
    public checksum: number = 0;
    private _crc8: number = 0;
    public size: number = 0;
    public isNamed: boolean = false;

    // Dynamic storage for group and file metadata
    private groups: Map<number, GroupMetadata> = new Map();

    private _isMetadataLoaded: boolean = false;

    constructor(index: number, idx255: Js5Index, dataIndex: Js5Index) {
        this.index = index;
        this.idx255 = idx255;
        this.dataIndex = dataIndex;
    }

    public get crc(): number {
        if (!this._isMetadataLoaded) {
            this.decodeMetadata();
        }

        return this._crc8;
    }

    public listGroupFiles(groupId: number, keys?: Int32Array): MapIterator<FileMetadata> {
        const group = this.getGroupMetadata(groupId, true, keys);
        return group.files.values();
    }

    public listGroupIds(): number[] {
        const groups = [...this.groups.values()];
        return groups.map(group => group.id);
    }

    public getGroupData(groupId: number): Uint8Array | null {
        if (!this._isMetadataLoaded) {
            this.decodeMetadata();
        }

        return this.dataIndex.read(groupId);
    }

    public readFile(groupId: number, fileId: number, keys?: Int32Array): Uint8Array {
        if (!this._isMetadataLoaded) {
            this.decodeMetadata();
        }

        const group = this.getGroupMetadata(groupId, true, keys);
        const file = group.files.get(fileId);
        if (file == null) {
            throw new Error(`File not found for group ${groupId} file ${fileId}`);
        }

        if (!file.content) {
            throw new Error(`File not found for group ${groupId} file ${fileId}`);
        }

        return file.content;
    }

    public readNamed(name: string, fileId: number, keys?: Int32Array): Uint8Array {
        if (!this._isMetadataLoaded) {
            this.decodeMetadata();
        }

        const group = this.getNamedGroupMetadata(name, true, keys);
        const file = group.files.get(fileId);
        if (file == null) {
            throw new Error(`File not found for group ${name} file ${fileId}`);
        }

        if (!file.content) {
            throw new Error(`File not found for group ${name} file ${fileId}`);
        }

        return file.content;
    }

    public writeFile(groupId: number, fileId: number, data: Uint8Array, keys?: Int32Array) {
        const group = this.getOrCreateGroupMetadata(groupId, undefined, keys);
        const file: FileMetadata = {
            id: fileId,
            size: data.length,
            content: data
        };

        if (!group.files.has(fileId)) {
            group.size++;
        }

        group.requiresPacking = true;
        group.files.set(fileId, file);
    }

    public writeNamedGroup(groupId: number, groupName: string, fileId: number, data: Uint8Array, keys?: Int32Array) {
        const group = this.getOrCreateGroupMetadata(groupId, groupName, keys);
        const file: FileMetadata = {
            id: fileId,
            size: data.length,
            content: data,
            nameHash: 0
        };

        if (group.size == 0) {
            group.size++;
        }

        this.isNamed = true;
        group.requiresPacking = true;
        group.files.set(fileId, file);
    }

    public unpack() {
        if (this._isMetadataLoaded) {
            return;
        }

        this.decodeMetadata();
    }

    public pack() {
        this.groups.forEach(group => {
            if (!group.requiresPacking) {
                return;
            }

            const encodedGroup = this.writeGroup(group);
            const written = this.dataIndex.write(encodedGroup, group.id, encodedGroup.length);
            if (!written) {
                throw new Error(`Failed to write group ${group.id} to archive ${this.index}`);
            }
        });

        const encodedMetadata = this.encodeMetadata();
        const written = this.idx255.write(encodedMetadata, this.index, encodedMetadata.length);
        if (!written) {
            throw new Error(`Failed to write metadata for archive ${this.index}`);
        }
    }

    private writeGroup(group: GroupMetadata): Uint8Array {
        const files = [...group.files.values()].sort((a, b) => a.id - b.id);
        let size: number = 0;

        files.forEach(file => (size += file.content?.length ?? 0));

        const packet = Packet.allocDirect(size + files.length * 4 + 1);
        if (files.length <= 1) {
            packet.pdata(files[0].content!, 0, files[0].content!.length);

            const compressionType: number = group.keys ? 2 : 1;
            const compressed = Js5Archive.compress(packet.data.subarray(0, packet.pos), compressionType, group);
            group.checksum = Packet.getcrc(compressed, 0, compressed.length - 2);
            return compressed;
        }

        files.forEach(file => packet.pdata(file.content!, 0, file.content!.length));

        const stripeCount: number = 1;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileSize = file.content?.length ?? 0;
            const delta = i == 0 ? 0 : (files[i - 1]?.content?.length ?? 0);

            packet.p4(fileSize - delta);
        }

        packet.p1(stripeCount);

        const compressionType: number = group.keys ? 2 : 1;
        const compressed = Js5Archive.compress(packet.data.subarray(0, packet.pos), compressionType, group);
        group.checksum = Packet.getcrc(compressed, 0, compressed.length - 2);
        return compressed;
    }

    private encodeGroup(group: GroupMetadata): Uint8Array {
        if (group.files.size === 0) {
            throw new Error(`Group ${group.id} does not contain any files.`);
        }

        // If there's only one file, bypass encoding for simplicity
        if (group.size <= 1) {
            const singleFile = [...group.files.values()][0];
            if (singleFile.content == null) {
                throw new Error(`File content missing for group ${group.id} file ${singleFile.id}`);
            }
            group.checksum = Packet.getcrc(singleFile.content, 0, singleFile.content.length);
            return singleFile.content; // Return the raw file content directly
        }

        // Step 1: Gather file contents and calculate sizes
        const fileContents = [...group.files.values()].map(file => {
            if (!file.content) {
                throw new Error(`File content missing for group ${group.id} file ${file.id}`);
            }
            return file.content;
        });

        const fileSizes = fileContents.map(content => content.length);
        const totalSize = fileSizes.reduce((sum, size) => sum + size, 0);

        // Step 2: Encode size deltas and stripe data
        const stripeCount = 1; // Assuming one stripe
        const sizeDeltas = new Array(group.size * stripeCount).fill(0);
        let cumulativeSize = 0;

        for (let i = 0; i < group.size; i++) {
            sizeDeltas[i] = fileSizes[i] - cumulativeSize;
            cumulativeSize = fileSizes[i]; // Accumulate current size
        }

        // Step 3: Write the data to a packet
        const packet = new Packet(new Uint8Array(totalSize + 4 * sizeDeltas.length + 1));
        packet.pos = 0;

        // Write the file data sequentially
        fileContents.forEach(content => packet.pdata(content, 0, content.length));

        // Write the size deltas at the end of the packet
        for (const delta of sizeDeltas) {
            packet.p4(delta); // Write 4 bytes for delta
        }

        packet.p1(stripeCount); // Write stripe count at the very end

        // Step 4: Compress the data
        const compressedData = Js5Archive.compress(packet.data.subarray(0, packet.pos));

        // Step 5: Encrypt if keys are provided
        if (group.keys && group.keys[0] !== 0 && group.keys[1] !== 0 && group.keys[2] !== 0 && group.keys[3] !== 0) {
            const encryptedData = new Uint8Array(compressedData.length);
            copyBytes(compressedData, 0, encryptedData, 0, compressedData.length);

            const encryptionPacket = new Packet(encryptedData);
            // encryptionPacket.encrypt(keys, 5, encryptionPacket.length);

            return encryptionPacket.data;
        }

        group.checksum = Packet.getcrc(compressedData, 0, compressedData.length);
        return compressedData; // Return the compressed and optionally encrypted data
    }

    private decodeGroup(group: GroupMetadata, keys?: Int32Array) {
        const data = this.dataIndex.read(group.id);
        if (data == null) {
            throw new Error(`Archive ${this.index} Group ${group.id} not found`);
        }

        let compressedData: Uint8Array;
        if (keys != null && keys[0] != 0 && keys[1] != 0 && keys[2] != 0 && keys[3] != 0) {
            compressedData = new Uint8Array(data.length);
            copyBytes(data, 0, compressedData, 0, data.length);

            const packet = new Packet(compressedData);
            packet.decrypt(keys, 5, packet.length);
        } else {
            compressedData = data;
        }

        const decompressedData = Js5Archive.decompress(compressedData);

        if (group.size <= 1) {
            const file = [...group.files.values()][0];
            file.content = decompressedData;
            group.isLoaded = true;
            return;
        }

        let dataLength = decompressedData.length;
        const stripeCount = decompressedData[--dataLength] & 0xff;

        const packet = new Packet(decompressedData);
        dataLength -= 4 * stripeCount * group.size;
        packet.pos = dataLength;

        const fileSizes = new Uint32Array(group.size);
        for (let stripe = 0; stripeCount > stripe; stripe++) {
            let currentLength = 0;
            for (let f = 0; f < group.size; f++) {
                const delta = packet.g4();
                currentLength += delta;
                fileSizes[f] += currentLength;
            }
        }

        const groupFiles = [...group.files.values()];
        for (let f = 0; f < group.size; f++) {
            if (!groupFiles[f].content) {
                groupFiles[f].content = new Uint8Array(fileSizes[f]);
            }

            fileSizes[f] = 0;
        }

        packet.pos = dataLength;
        let decompressedDataPointer = 0;
        for (let stripe = 0; stripeCount > stripe; stripe++) {
            let size = 0;
            for (let f = 0; f < group.size; f++) {
                const stripeLength = fileSizes[f];
                const delta = packet.g4();
                size += delta;

                const content = groupFiles[f].content;

                if (content) {
                    copyBytes(decompressedData, decompressedDataPointer, content, stripeLength, size);
                }

                fileSizes[f] += size;
                decompressedDataPointer += size;
            }
        }
        group.isLoaded = true;
    }

    private encodeMetadata(): Uint8Array {
        const packet = Packet.alloc(4);

        // TODO support other protocols
        packet.p1(Js5Protocol.Original);
        packet.p1(this.isNamed ? 1 : 0);
        packet.p2(this.groups.size);

        // sort groups as group ids are written via deltas
        const sortedGroups = [...this.groups.keys()].sort((a, b) => a - b);

        // write group id deltas
        for (let i = 0; i < sortedGroups.length; i++) {
            let groupDelta = sortedGroups[i];
            if (i != 0) {
                groupDelta -= sortedGroups[i - 1];
            }
            packet.p2(groupDelta);
        }

        // write group names
        if (this.isNamed) {
            for (const groupId of sortedGroups) {
                const group = this.getGroupMetadata(groupId);
                if (group.nameHash === undefined) {
                    throw new Error(`Archive ${this.index} Group ${groupId} does not have a name`);
                }
                packet.p4(group.nameHash);
            }
        }

        // write group checksums
        for (const groupId of sortedGroups) {
            const group = this.getGroupMetadata(groupId);
            packet.p4(group.checksum);
        }

        // write group versions
        for (const groupId of sortedGroups) {
            const group = this.getGroupMetadata(groupId);
            packet.p4(group.version);
        }

        // write group sizes
        for (const groupId of sortedGroups) {
            const group = this.getGroupMetadata(groupId);
            packet.p2(group.size);
        }

        // write group file id deltas
        for (const groupId of sortedGroups) {
            const group = this.getGroupMetadata(groupId);
            const sortedFiles = [...group.files.keys()].sort((a, b) => a - b);

            for (let i = 0; i < group.size; i++) {
                let delta = sortedFiles[i];
                if (i != 0) {
                    delta -= sortedFiles[i - 1];
                }
                packet.p2(delta);
            }
        }

        // write file names
        if (this.isNamed) {
            for (const groupId of sortedGroups) {
                const group = this.getGroupMetadata(groupId);
                const sortedFiles = [...group.files.keys()].sort((a, b) => a - b);

                for (const fileId of sortedFiles) {
                    const file = group.files.get(fileId);
                    if (!file) {
                        throw new Error(`Archive ${this.index} Group ${groupId} File ${fileId} not found`);
                    }

                    if (file.nameHash === undefined) {
                        throw new Error(`Archive ${this.index} Group ${groupId} File ${fileId} does not have a name`);
                    }

                    packet.p4(file.nameHash);
                }
            }
        }

        const packedData = packet.data.subarray(0, packet.pos);
        const compressedData = Js5Archive.compress(packedData);
        return compressedData;
        // return Js5Archive.compress(packet.data.subarray(0, packet.pos));
    }

    private decodeMetadata() {
        const data = this.idx255.read(this.index);
        if (data == null) {
            throw new Error('No metadata found for archive ' + this.index);
        }

        this._crc8 = Packet.getcrc(data, 0, data.length);
        const packet = new Packet(Js5Archive.decompress(data));

        const protocol = packet.g1();
        if (protocol != Js5Protocol.Original) {
            throw new Error(`Invalid protocol: ${protocol}`);
        }

        this.isNamed = packet.g1() != 0;

        // Read group size
        this.size = packet.g2();
        let previousGroupId = 0;

        const groupIds: number[] = [];

        let groupId: number;
        for (let i = 0; i < this.size; i++) {
            groupId = previousGroupId += packet.g2();
            groupIds.push(groupId);

            this.groups.set(groupId, {
                id: groupId,
                checksum: 0,
                version: 0,
                size: 0,
                files: new Map(),
                isLoaded: false
            });
        }

        let group: GroupMetadata;

        // group names
        if (this.isNamed) {
            for (let i = 0; i < this.size; i++) {
                groupId = groupIds[i];
                group = this.getGroupMetadata(groupId);
                group.nameHash = packet.g4();
            }
        }

        // group checksum
        for (let i = 0; i < this.size; i++) {
            groupId = groupIds[i];
            group = this.getGroupMetadata(groupId);

            group.checksum = packet.g4();
        }

        // group version
        for (let i = 0; i < this.size; i++) {
            groupId = groupIds[i];
            group = this.getGroupMetadata(groupId);

            group.version = packet.g4();
        }

        // group size
        for (let i = 0; i < this.size; i++) {
            groupId = groupIds[i];
            group = this.getGroupMetadata(groupId);

            group.size = packet.g2();
        }

        // group file ids
        for (let i = 0; i < this.size; i++) {
            groupId = groupIds[i];
            group = this.getGroupMetadata(groupId);

            let previousFileId = 0;
            for (let j = 0; group.size > j; j++) {
                const fileId = (previousFileId += packet.g2());
                group.files.set(fileId, {
                    id: fileId,
                    size: 0,
                    content: null,
                    nameHash: undefined
                });
            }
        }

        // group file names
        if (this.isNamed) {
            for (let i = 0; i < this.size; i++) {
                const groupId = groupIds[i];
                const group = this.getGroupMetadata(groupId);

                [...group.files.values()].forEach(file => {
                    file.nameHash = packet.g4();
                });
            }
        }

        this._isMetadataLoaded = true;
    }

    private getGroupMetadata(groupId: number, loadGroup: boolean = false, keys?: Int32Array): GroupMetadata {
        // TODO support getting groups by name
        const group = this.groups.get(groupId);
        if (group == null) {
            throw new Error(`Group ${groupId} not found`);
        }

        if (!group.isLoaded && loadGroup) {
            this.decodeGroup(group, keys);
        }
        return group;
    }

    private getNamedGroupMetadata(groupName: string, loadGroup: boolean = false, keys?: Int32Array): GroupMetadata {
        // TODO support getting groups by name
        const group = [...this.groups.values()].find(group => group.nameHash === genJagHash(groupName));
        if (group == null) {
            throw new Error(`Group ${groupName} not found`);
        }

        if (!group.isLoaded && loadGroup) {
            this.decodeGroup(group, keys);
        }
        return group;
    }

    private getOrCreateGroupMetadata(groupId: number, groupName?: string, keys?: Int32Array): GroupMetadata {
        // TODO support getting groups by name
        let group = this.groups.get(groupId);
        if (group == null) {
            group = {
                id: groupId,
                checksum: 0,
                version: 1,
                size: 0,
                files: new Map(),
                isLoaded: true
            };

            this.groups.set(groupId, group);
        }
        group.keys = keys;
        if (groupName !== undefined) {
            group.nameHash = genJagHash(groupName);
        }

        if (!group.isLoaded) {
            this.decodeGroup(group, keys);
        }

        return group;
    }

    public static compress(cacheData: Uint8Array, type: number = 1, group?: GroupMetadata) {
        let compressed: Uint8Array;
        if (type == 0) {
            compressed = cacheData;
        } else if (type == 1) {
            compressed = BZip2.compress(cacheData, false, true);
        } else if (type == 2) {
            compressed = gzipCompress(cacheData, 0, cacheData.length);
        } else {
            throw new Error(`Invalid compression type: ${type}`);
        }

        let length = compressed.length + 5;
        if (type != 0) {
            length += 4;
        }
        if (group) {
            length += 2;
        }

        const packet = Packet.allocDirect(length);

        packet.p1(type);

        packet.p4(compressed.length);

        if (type != 0) {
            packet.p4(cacheData.length);
        }

        packet.pdata(compressed, 0, compressed.length);

        if (group) {
            if (group.keys && group.keys[0] !== 0 && group.keys[1] !== 0 && group.keys[2] !== 0 && group.keys[3] !== 0) {
                if (type !== 2) {
                    throw new Error(`Invalid compression type: ${type}, use 2 (gzip) instead for encrypted data.`);
                }
                packet.encrypt(group.keys, 5, packet.pos);
            }

            try {
                packet.p2(group.version);
            } catch (e) {
                console.log('failed to write group version:', e);
            }
        }
        return packet.data.subarray(0, packet.pos);
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
            } else {
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