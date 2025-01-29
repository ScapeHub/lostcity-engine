import Js5 from '#/js5/Js5.js';
import Packet from '#/io/Packet.js';

describe('GetInvGroupFileSizes', () => {
    it('loads cache files and checks inv sizes', () => {
        const js5 = new Js5('./cache/423', 12);

        js5.worldMapArchive.unpack();

        const keys: Int32Array = new Int32Array(4);
        keys[0] = -125671574;
        keys[1] = 254943715;
        keys[2] = 1343095705;
        keys[3] = -1965171670;

        const data = js5.worldMapArchive.readFile(1475, 0, keys);
        console.log(data.length);
    });
});

describe('Js5DecodesArchiveGroupFile', () => {
    it('loads cache and decodes archive group file', () => {
        const js5 = new Js5('./data/cache/packed', 12);

        const varbitId = 44;
        const expectedVarp = 351;
        const expectedStartBit = 20;
        const expectedEndBit = 20;

        const data = js5.configArchive.readFile(14, varbitId);
        const packet = new Packet(data);

        let varp: number = -1;
        let startBit: number = -1;
        let endBit: number = -1;

        while (true) {
            let opcode = packet.g1();
            if (opcode == 0) {
                break;
            }

            if (opcode == 1) {
                varp = packet.g2();
                startBit = packet.g1();
                endBit = packet.g1();
            }
        }

        expect(varp).toBe(expectedVarp);
        expect(expectedStartBit).toBe(startBit)
        expect(expectedEndBit).toBe(endBit)
    });
});

describe('Creates fresh cache', () => {
    it('creates new cache and packs a group file', () => {
        const js5 = new Js5('./cache', 12);

        const varbitId = 44;
        const expectedVarp = 351;
        const expectedStartBit = 40;
        const expectedEndBit = 40;

        let packet = Packet.allocDirect(6);

        // opcode
        packet.p1(1);

        packet.p2(expectedVarp);
        packet.p1(expectedStartBit);
        packet.p1(expectedEndBit);

        // eof opcode
        packet.p1(0);

        // js5.configArchive.unpack();
        js5.skeletonArchive.writeFile(1, varbitId, packet.data);
        js5.skeletonArchive.pack();
    });

    it('loads cache and verifies encoded group file', () => {
        const js5 = new Js5('./cache', 12);

        const varbitId = 44;
        const expectedVarp = 351;
        const expectedStartBit = 40;
        const expectedEndBit = 40;

        const data = js5.skeletonArchive.readFile(1, varbitId);
        const packet = new Packet(data);

        let varp: number = -1;
        let startBit: number = -1;
        let endBit: number = -1;

        while (true) {
            let opcode = packet.g1();
            if (opcode == 0) {
                break;
            }

            if (opcode == 1) {
                varp = packet.g2();
                startBit = packet.g1();
                endBit = packet.g1();
            }
        }

        expect(varp).toBe(expectedVarp);
        expect(expectedStartBit).toBe(startBit)
        expect(expectedEndBit).toBe(endBit)
    });
});

describe('Js5DecodesAndEncodesArchiveGroupFile', () => {
    it('loads cache and encodes archive group file', () => {
        const js5 = new Js5('./cache/423', 12);

        const varbitId = 30_000;
        const expectedVarp = 200;
        const expectedStartBit = 14;
        const expectedEndBit = 16;

        let packet = Packet.allocDirect(6);

        // opcode
        packet.p1(1);

        packet.p2(expectedVarp);
        packet.p1(expectedStartBit);
        packet.p1(expectedEndBit);

        // eof opcode
        packet.p1(0);

        js5.configArchive.unpack();
        js5.configArchive.writeFile(14, varbitId, packet.data);
        js5.configArchive.pack();
    });

    it('loads cache and verifies encoded group file', () => {
        const js5 = new Js5('./cache/423', 12);

        const varbitId = 30_000;
        const expectedVarp = 200;
        const expectedStartBit = 14;
        const expectedEndBit = 16;

        const data = js5.configArchive.readFile(14, varbitId);
        const packet = new Packet(data);

        let varp: number = -1;
        let startBit: number = -1;
        let endBit: number = -1;

        while (true) {
            let opcode = packet.g1();
            if (opcode == 0) {
                break;
            }

            if (opcode == 1) {
                varp = packet.g2();
                startBit = packet.g1();
                endBit = packet.g1();
            }
        }

        expect(varp).toBe(expectedVarp);
        expect(expectedStartBit).toBe(startBit)
        expect(expectedEndBit).toBe(endBit)
    });
});

describe('Js5DecodesAndEncodesNewArchiveGroupFile', () => {
    it('loads cache and encodes new archive group and file', () => {
        const js5 = new Js5('./cache/423', 12);

        const varbitId = 30_000;
        const expectedVarp = 200;
        const expectedStartBit = 14;
        const expectedEndBit = 16;

        let packet = Packet.allocDirect(6);

        // opcode
        packet.p1(1);

        packet.p2(expectedVarp);
        packet.p1(expectedStartBit);
        packet.p1(expectedEndBit);

        // eof opcode
        packet.p1(0);

        js5.configArchive.unpack();
        js5.configArchive.writeFile(20, varbitId, packet.data);
        js5.configArchive.pack();
    });

    it('loads cache and verifies encoded group file', () => {
        const js5 = new Js5('./cache/423', 12);

        const varbitId = 30_000;
        const expectedVarp = 200;
        const expectedStartBit = 14;
        const expectedEndBit = 16;

        const data = js5.configArchive.readFile(20, varbitId);
        const packet = new Packet(data);

        let varp: number = -1;
        let startBit: number = -1;
        let endBit: number = -1;

        while (true) {
            let opcode = packet.g1();
            if (opcode == 0) {
                break;
            }

            if (opcode == 1) {
                varp = packet.g2();
                startBit = packet.g1();
                endBit = packet.g1();
            }
        }

        expect(varp).toBe(expectedVarp);
        expect(expectedStartBit).toBe(startBit)
        expect(expectedEndBit).toBe(endBit)
    });
});