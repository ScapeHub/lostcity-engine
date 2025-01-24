export default class NameHashCollection {
    public static readonly NOT_FOUND: number = -1;

    private readonly _hashTable: Int32Array;

    constructor(hashTable: Uint32Array) {
        const size = NameHashCollection.calculateInitialSize(hashTable.length);
        this._hashTable = new Int32Array(size * 2);

        for (let i = 0; this._hashTable.length > i; i++) {
            this._hashTable[i] = NameHashCollection.NOT_FOUND;
        }

        this.populateHashTable(size, hashTable);
    }

    public getIdByName(nameHash: number): number {
        const size = this._hashTable.length - 2;
        let current = nameHash << 1 & size;

        while (this._hashTable[current] != NameHashCollection.NOT_FOUND) {
            if (this._hashTable[current] == nameHash) {
                return this._hashTable[current + 1];
            }

            current = (current + 2) & size;
        }
        return NameHashCollection.NOT_FOUND;
    }

    private populateHashTable(size: number, nameHashes: Uint32Array) {
        for (let nameHashIndex = 0; nameHashes.length > nameHashIndex; nameHashIndex++) {
            const firstEmptySlot = this.findNextAvailableSlot(size, nameHashes[nameHashIndex]);
            this._hashTable[firstEmptySlot + firstEmptySlot] = nameHashes[nameHashIndex];
            this._hashTable[1 + firstEmptySlot + firstEmptySlot] = nameHashIndex;
        }
    }

    private findNextAvailableSlot(size: number, start: number): number {
        let current = start & size - 1;
        while (this._hashTable[current * 2 + 1] != NameHashCollection.NOT_FOUND) {
            current = current + 1 & -1 + size;
        }
        return current;
    }

    private static calculateInitialSize(length: number): number {
        let size = 1;
        while ((length >> 1) + length >= size) {
            size <<= 1;
        }
        return size;
    }
}