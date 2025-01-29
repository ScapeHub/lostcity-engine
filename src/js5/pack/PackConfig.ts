import Js5Archive from '#/js5/Js5Archive.js';
import readline from 'readline';
import fs from 'fs';
import { ConfigLine, ConfigParseCallback, CONSTANTS, parseStepError } from '#tools/pack/config/PackShared.js';
import { packJs5LocConfigs, parseLocConfig } from '#tools/pack/config/LocConfig.js';
import { packJs5NpcConfigs, parseNpcConfig } from '#tools/pack/config/NpcConfig.js';
import { packJs5ObjConfigs, parseObjConfig } from '#tools/pack/config/ObjConfig.js';
import { packJs5VarpConfigs, parseVarpConfig } from '#tools/pack/config/VarpConfig.js';
import { packJs5VarbitConfigs, parseVarbitConfig } from '#tools/pack/config/VarbitConfig.js';
import { FloPack, FluPack, IdkPack, MesAnimPack, SeqPack, SpotAnimPack } from '#/util/PackFile.js';
import { parseBinaryFiles } from '#/js5/pack/Js5Pack.js';

type ConfigPackCallback = (configs: Map<string, ConfigLine[]>, archive: Js5Archive) => void;

export async function packJs5Config(archive: Js5Archive) {
    await parseConfigFile(archive, 'loc', parseLocConfig, packJs5LocConfigs);
    await parseConfigFile(archive, 'npc', parseNpcConfig, packJs5NpcConfigs);
    await parseConfigFile(archive, 'obj', parseObjConfig, packJs5ObjConfigs);
    await parseConfigFile(archive, 'varp', parseVarpConfig, packJs5VarpConfigs);
    await parseConfigFile(archive, 'varbit', parseVarbitConfig, packJs5VarbitConfigs);

    parseBinaryFiles(archive, 'config/flo', FloPack, 4);
    parseBinaryFiles(archive, 'config/flu', FluPack, 1);
    parseBinaryFiles(archive, 'config/seq', SeqPack, 12);
    parseBinaryFiles(archive, 'config/spotanim', SpotAnimPack, 13);
    parseBinaryFiles(archive, 'config/idk', IdkPack, 3);
    parseBinaryFiles(archive, 'config/mesanim', MesAnimPack, 7);

    archive.pack();
}

async function parseConfigFile(archive: Js5Archive, ext: string, parse: ConfigParseCallback, pack: ConfigPackCallback) {
    console.log(`packing ${ext}...`);

    const file = './data/cache/unpacked/config/all.' + ext;
    const reader = readline.createInterface({
        input: fs.createReadStream(file)
    });

    const configs = new Map<string, ConfigLine[]>();
    let config: ConfigLine[] = [];
    let debugname: string | null = null;

    let lineNumber = 0;
    for await (const line of reader) {
        lineNumber++;

        try {
            if (line.length === 0 || line.startsWith('//')) {
                continue;
            }

            if (line.startsWith('[')) {
                if (!line.endsWith(']')) {
                    throw parseStepError(file, lineNumber, `Missing closing bracket: ${line}`);
                }

                if (debugname !== null) {
                    configs.set(debugname, config);
                }

                debugname = line.substring(1, line.length - 1);
                if (!debugname.length) {
                    throw parseStepError(file, lineNumber, 'No config name');
                }

                if (configs.has(debugname)) {
                    throw parseStepError(file, lineNumber, `Duplicate config found: ${debugname}`);
                }

                config = [];
                continue;
            }

            const separator = line.indexOf('=');
            if (separator === -1) {
                throw parseStepError(file, lineNumber, `Missing property separator: ${line}`);
            }

            const key = line.substring(0, separator);
            let value = line.substring(separator + 1);

            for (let i = 0; i < value.length; i++) {
                // check the value for a constant starting with ^ and ending with a \r, \n, comma, or otherwise end of string
                // then replace just that substring with CONSTANTS.get(value) if CONSTANTS.has(value) returns true

                if (value[i] === '^') {
                    const start = i;
                    let end = i + 1;

                    while (end < value.length) {
                        if (value[end] === '\r' || value[end] === '\n' || value[end] === ',' || value[end] === ' ') {
                            break;
                        }

                        end++;
                    }

                    const constant = value.substring(start + 1, end);
                    if (CONSTANTS.has(constant)) {
                        value = value.substring(0, start) + CONSTANTS.get(constant) + value.substring(end);
                    }

                    i = end;
                }
            }

            const parsed = parse(key, value);
            if (parsed === null) {
                throw parseStepError(file, lineNumber, `Invalid property value: ${line}`);
            } else if (typeof parsed === 'undefined') {
                throw parseStepError(file, lineNumber, `Invalid property key: ${line}`);
            }

            if (debugname == 'loc_17163') {
                console.log(key, parsed);
            }

            config.push({ key, value: parsed });
        }
        catch (err) {
            console.error(`Error on line ${lineNumber} of ${ext}. Error:`, err);
            throw err;
        }
    }

    if (debugname !== null) {
        configs.set(debugname, config);
    }

    pack(configs, archive);
}