import { ConfigValue, ConfigLine, PackedData, isConfigBoolean, getConfigBoolean } from '#tools/pack/config/PackShared.js';
import { AnimPack, ObjPack, SeqPack } from '#/util/PackFile.js';

export function parseSeqConfig(key: string, value: string): ConfigValue | null | undefined {
    const stringKeys: string[] = [];
    // prettier-ignore
    const numberKeys = [
        'replayoff', 'priority', 'replaycount'
    ];
    // prettier-ignore
    const booleanKeys = [
        'stretches'
    ];

    if (stringKeys.includes(key)) {
        if (value.length > 1000) {
            // arbitrary limit
            return null;
        }

        return value;
    } else if (numberKeys.includes(key)) {
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

        if (key === 'replayoff' && (number < 0 || number > 1000)) {
            return null;
        }

        if (key === 'priority' && (number < 0 || number > 10)) {
            return null;
        }

        if (key === 'replaycount' && (number < 0 || number > 1000)) {
            return null;
        }

        return number;
    } else if (booleanKeys.includes(key)) {
        if (!isConfigBoolean(value)) {
            return null;
        }

        return getConfigBoolean(value);
    } else if (key.startsWith('frame')) {
        const index = AnimPack.getByName(value);
        if (index === -1) {
            return null;
        }

        return index;
    } else if (key.startsWith('iframe')) {
        const index = AnimPack.getByName(value);
        if (index === -1) {
            return null;
        }

        return index;
    } else if (key.startsWith('delay')) {
        const parsed = parseInt(value);
        if (isNaN(parsed)) {
            return null;
        }

        return parsed;
    } else if (key === 'walkmerge') {
        const parts = value.split(',');

        const labels = [];
        for (let i = 0; i < parts.length; i++) {
            // not tracking labels by name currently
            labels.push(parseInt(parts[i].substring(parts[i].indexOf('_') + 1)));
        }

        return labels;
    } else if (key === 'righthand') {
        if (value === 'hide') {
            return 0;
        }

        const index = ObjPack.getByName(value);
        if (index === -1) {
            return null;
        }

        return index + 512;
    } else if (key === 'lefthand') {
        if (value === 'hide') {
            return 0;
        }

        const index = ObjPack.getByName(value);
        if (index === -1) {
            return null;
        }

        return index + 512;
    } else {
        return undefined;
    }
}

export function packSeqConfigs(_: Map<string, ConfigLine[]>): { server: PackedData } {
    const server: PackedData = new PackedData(SeqPack.size);

    for (let i = 0; i < SeqPack.size; i++) {
        const debugname = SeqPack.getById(i);

        server.p1(250);
        server.pjstr(debugname);

        server.next();
    }

    return { server };
}
