import { ConfigLine, ConfigValue, PackedData } from '#tools/pack/config/PackShared.js';
import { VarbitPack, VarpPack } from '#/util/PackFile.js';
import Js5Archive from '#/js5/Js5Archive.js';
import Packet from '#/io/Packet.js';

export function parseVarbitConfig(key: string, value: string): ConfigValue | null | undefined {
    // prettier-ignore
    const numberKeys = [
        'startbit',
        'endbit'
    ];

    if (numberKeys.includes(key)) {
        let number;
        if (value.startsWith('0x')) {
            // check that the string contains only hexadecimal characters, and minus sign if applicable
            if (!/^-?[0-9a-fA-F]+$/.test(value.slice(2))) {
                return null;
            }

            number = parseInt(value, 16);
        } else {
            // check that the string contains only numeric characters, and minus sign if applicable
            if (!/^-?[0-9]+$/.test(value)) {
                return null;
            }

            number = parseInt(value);
        }

        if (Number.isNaN(number)) {
            return null;
        }

        return number;
    }
    else if (key === 'basevar') {
        const varpId = VarpPack.getByName(value);
        if (varpId == -1) {
            return null;
        }

        return varpId;
    }
    else {
        return undefined;
    }
}

export function packJs5VarbitConfigs(configs: Map<string, ConfigLine[]>, archive: Js5Archive): void {
    for (let i = 0; i < VarbitPack.size; i++) {
        const client = Packet.alloc(1);
        const debugname = VarbitPack.getById(i);
        const config = configs.get(debugname)!;

        let baseVar = -1;
        let startBit = -1;
        let endBit = -1;

        for (let j = 0; j < config.length; j++) {
            const { key, value } = config[j];

            if (key === 'basevar') {
                baseVar = value as number;
            }
            else if (key === 'startbit') {
                startBit = value as number;
            }
            else if (key === 'endbit') {
                endBit = value as number;
            }
        }

        if (baseVar == -1 || startBit == -1 || endBit == -1) {
            throw new Error('Invalid varbit config: ' + debugname);
        }

        client.p1(1);
        client.p2(baseVar);
        client.p1(startBit);
        client.p1(endBit);

        client.p1(0);

        archive.writeFile(14, i, client.data.subarray(0, client.pos));
    }
}

export function packVarbitConfigs(configs: Map<string, ConfigLine[]>): { client?: Packet; server: PackedData } {
    const server: PackedData = new PackedData(VarbitPack.size);

    for (let i = 0; i < VarbitPack.size; i++) {
        const debugname = VarbitPack.getById(i);

        server.p1(250);
        server.pjstr(debugname);

        server.next();
    }

    return { server };
}