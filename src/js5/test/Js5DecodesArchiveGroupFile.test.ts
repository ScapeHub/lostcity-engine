import Js5 from '#/js5/Js5.js';
import Packet from '#/io/Packet.js';

describe('Js5DecodesArchiveGroupFile', () => {
    it('loads cache and decodes archive group file', () => {
        const js5 = new Js5('./cache/423', 12);

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
        js5.configArchive.writeFile(14, varbitId, packet.data);
        js5.pack();
    });

    it('loads cache and verifies encoded group file', () => {
        const js5 = new Js5('./cache', 12);

        const varbitId = 44;
        const expectedVarp = 351;
        const expectedStartBit = 40;
        const expectedEndBit = 40;

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

describe('Js5DecodesAndEncodesArchiveGroupFile', () => {
    it('loads cache and encodes archive group file', () => {
        const js5 = new Js5('./cache/423', 12);

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

        js5.configArchive.unpack();
        js5.configArchive.writeFile(14, varbitId, packet.data);
        js5.configArchive.pack();
    });

    it('loads cache and verifies encoded group file', () => {
        const js5 = new Js5('./cache/423', 12);

        const varbitId = 44;
        const expectedVarp = 351;
        const expectedStartBit = 40;
        const expectedEndBit = 40;

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