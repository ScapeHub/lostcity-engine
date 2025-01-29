import Js5 from '#/js5/Js5.js';
import Packet from '#/io/Packet.js';
import fs from 'fs';
import Js5Archive from '#/js5/Js5Archive.js';
import { LocShape } from '#tools/pack/config/LocConfig.js';

type Decoder = (opcode: number, packet: Packet) => string | string[];
type NameMap = Map<number, string>;

type MapKey = {
    archive: number,
    group: number,
    name_hash: number,
    name: string,
    mapsquare: number,
    key: Int32Array
}

const js5 = new Js5('./cache/423', 12);

// file names
const npcNames: NameMap = new Map();
const npcDesc: NameMap = new Map();
const seqNames: NameMap = new Map();
const invNames: NameMap = new Map();
const varpNames: NameMap = new Map();
const jingleNames: NameMap = new Map();
const locNames: NameMap = new Map();
const locDesc: NameMap = new Map();
const musicNames: NameMap = new Map();
const soundNames: NameMap = new Map();
const spotanimNames: NameMap = new Map();
const objNames: NameMap = new Map();
const objDesc: NameMap = new Map();
const huffmanNames: NameMap = new Map();
const spriteNames: NameMap = new Map();
const mapNames: NameMap = new Map();

loadNames();
unpack();

function loadNames() {
    unpackFileNames(npcNames, 9, decodeNpc);
    readFileNames('npc', npcNames);
    readFileNames('npc_desc', npcDesc);

    readFileNames('seq', seqNames);
    readFileNames('inv', invNames);
    readFileNames('varp', varpNames);
    readFileNames('jingle', jingleNames);

    unpackFileNames(locNames, 6, decodeLoc);
    readFileNames('loc_desc', locDesc);

    readFileNames('music', musicNames);
    readFileNames('sound', soundNames);
    readFileNames('spotanim', spotanimNames);

    unpackFileNames(objNames, 10, decodeObj);
    readFileNames('obj', objNames);
    readFileNames('obj_desc', objDesc);

    readFileNames('huffman', huffmanNames);

    readFileNames('sprite', spriteNames);
    readFileNames('map', mapNames);
}

function unpack() {
    unpackConfigGroup('npc', npcNames, 9, decodeNpc);
    unpackConfigGroup('obj', objNames, 10, decodeObj);
    unpackConfigGroup('loc', locNames, 6, decodeLoc);
    unpackConfigGroup('varp', varpNames, 16, decodeVarp);
    unpackConfigGroup('varbit', new Map(), 14, decodeVarbit);
    unpackInvs();

    unpackBinaryGroupFiles('seq', './data/cache/unpacked/config/', seqNames, js5.configArchive, 12);
    unpackBinaryGroupFiles('flo', './data/cache/unpacked/config/', new Map(), js5.configArchive, 4);
    unpackBinaryGroupFiles('flu', './data/cache/unpacked/config/', new Map(), js5.configArchive, 1);
    unpackBinaryGroupFiles('spotanim', './data/cache/unpacked/config/', spotanimNames, js5.configArchive, 13);
    unpackBinaryGroupFiles('idk', './data/cache/unpacked/config/', new Map(), js5.configArchive, 3);
    unpackBinaryGroupFiles('mesanim', './data/cache/unpacked/config/', new Map(), js5.configArchive, 7);

    unpackInterfaces();

    unpackBinaryArchive('huffman', './data/cache/unpacked/', huffmanNames, js5.huffmanArchive);
    unpackBinaryArchive('jingle', './data/cache/unpacked/', jingleNames, js5.jingleArchive);
    unpackBinaryArchive('music', './data/cache/unpacked/', musicNames, js5.musicArchive);
    unpackBinaryArchive('sound', './data/cache/unpacked/', soundNames, js5.soundArchive);

    unpackBinaryArchive('skeleton', './data/cache/unpacked/', new Map(), js5.skeletonArchive);
    unpackBinaryArchive('model', './data/cache/unpacked/', new Map(), js5.modelArchive);

    unpackBinaryArchiveGroup('texture', './data/cache/unpacked/', new Map(), js5.textureArchive);
    unpackBinaryArchiveGroup('skin', './data/cache/unpacked/', new Map(), js5.skinCacheArchive);

    unpackBinaryArchive('sprite', './data/cache/unpacked/', spriteNames, js5.spriteArchive);

    unpackMaps();
}

function readFileNames(name: string, names: NameMap): void {
    const fileContent = fs.readFileSync(`./unpacked/names/${name}.txt`, 'utf8'); // Read entire file content synchronously

    const lines = fileContent.split(/\r?\n/); // Split by line breaks (handles both LF and CRLF)

    for (const line of lines) {
        if (!line) continue;

        const args = line.split('=');
        const id = args[0].trim();
        const name = args[1].trim();
        names.set(parseInt(id), name);
    }
}

function readMapKeys(): MapKey[] {
    const fileContent = fs.readFileSync('./unpacked/names/map_keys.json', 'utf8');
    return JSON.parse(fileContent);
}

function createPackFile(name: string) {
    const filePath = './data/cache/unpacked/pack/' + name + '.pack';
    fs.mkdirSync('./data/cache/unpacked/pack', { recursive: true });
    fs.writeFileSync(filePath, '');
}

function appendPackFile(name: string, data: string) {
    const filePath = './data/cache/unpacked/pack/' + name + '.pack';
    fs.appendFileSync(filePath, data);
}

function createConfigFile(name: string) {
    const filePath = `./data/cache/unpacked/config/all.${name}`;
    fs.mkdirSync('./data/cache/unpacked/config/', { recursive: true });
    fs.writeFileSync(filePath, '');
}

function appendConfigFile(name: string, data: string) {
    const filePath = `./data/cache/unpacked/config/all.${name}`;
    fs.appendFileSync(filePath, data);
}

function createBinaryFile(path: string, fileName: string, data: Uint8Array) {
    fs.mkdirSync(path, { recursive: true });
    fs.writeFileSync(`${path}${fileName}.dat`, Buffer.from(data));
}

function getFileName(type: string, id: number, names: NameMap): string {
    return names.get(id) ?? `${type}_${id}`;
}

function unpackFileNames(fileNames: NameMap, groupId: number, decoder: Decoder) {
    js5.configArchive.unpack();
    const files = [...js5.configArchive.listGroupFiles(groupId)];

    console.log(`Unpacking ${files.length} file names...`);
    files.forEach((file) => {
        const fileData = js5.configArchive.readFile(groupId, file.id);
        const packet = new Packet(fileData);

        let name: string | undefined;
        let certScore = 0;

        let opcode: number;
        while (true) {
            opcode = packet.g1();
            if (opcode == 0) {
                break;
            }
            
            const config = decoder(opcode, packet);
            if (!Array.isArray(config) && config.startsWith('name=')) {
                const fileName = config.split('=')[1]
                    .replaceAll('(', '')
                    .replaceAll('"', '')
                    .replaceAll('?', '')
                    .replaceAll('-', '_')
                    .replaceAll('\'', '')
                    .trim()
                    .replaceAll(' ', '_')
                    .toLowerCase();

                if (groupId == 10) {
                    name = fileName;
                    continue;
                }

                name = fileName;
                break;
            }

            if (groupId == 10 && !Array.isArray(config) && (config.startsWith('certlink=') || config.startsWith('certtemplate='))) {
                certScore++;
            }
        }

        if (!name) {
            return;
        }

        if (certScore > 1) {
            name = 'cert_'+ name;
        }

        name = `${name}_${file.id}`;
        fileNames.set(file.id, name);
    });

    console.log(`Unpacked ${files.length} file names`);
}

function unpackMaps() {
    const mapKeys = readMapKeys();
    js5.worldMapArchive.unpack();

    createPackFile('map');
    const groups = js5.worldMapArchive.listGroupIds();

    console.log(`unpacking ${groups.length} maps...`);
    groups.forEach((groupId) => {
        try {
            const fileName = mapNames.get(groupId) ?? `map_${groupId}`;

            const isFloorMap = fileName.startsWith('m') || groupId % 2 == 0;

            const mapKey: MapKey | undefined = mapKeys.find(key => key.group == groupId);

            if (!isFloorMap && !mapKey) {
                appendPackFile('map', `${groupId}=null\n`);
                return;
            }

            const files = [...js5.worldMapArchive.listGroupFiles(groupId, mapKey?.key)];
            files.forEach((file) => {
                const fileData = js5.worldMapArchive.readFile(groupId, file.id, mapKey?.key);
                createBinaryFile('./data/cache/unpacked/map/', fileName, fileData);
                appendPackFile('map', `${groupId}=${fileName}\n`);
            });
        }
        catch (err) {
            console.error('Failed to unpack map', groupId, ':', err);
        }
    });

    console.log('unpacked maps');
}

function unpackBinaryArchiveGroup(name: string, path: string, fileNames: NameMap, archive: Js5Archive) {
    archive.unpack();

    createPackFile(name);
    const groups = archive.listGroupIds();

    console.log(`unpacking ${groups.length} ${name}...`);

    groups.forEach((groupId) => {
        try {
            const files = [...archive.listGroupFiles(groupId)];

            const fileName = fileNames.get(groupId) ?? `${name}_${groupId}`;
            appendPackFile(name, `${groupId}=${fileName}\n`);

            const packet = Packet.alloc(4);
            files.forEach((file) => {
                const fileData = archive.readFile(groupId, file.id);

                // write file metadata
                packet.p2(file.id);
                packet.p2(fileData.length);

                // write file data
                packet.pdata(fileData, 0, fileData.length);
            });

            createBinaryFile(`${path}${name}/`, fileName, packet.data.subarray(0, packet.pos));
        }
        catch (err) {
            console.error(`${name} group ${groupId} failed to unpack`, err);
        }
    });

    console.log(`unpacked ${name}`);
}

function unpackBinaryArchive(name: string, path: string, fileNames: NameMap, archive: Js5Archive) {
    archive.unpack();

    createPackFile(name);

    console.log(`unpacking ${name}...`);

    const groups = archive.listGroupIds();
    groups.forEach((groupId) => {
        try {
            const files = [...archive.listGroupFiles(groupId)];

            const fileName = fileNames.get(groupId) ?? `${name}_${groupId}`;

            files.forEach((file) => {
                const fileData = archive.readFile(groupId, file.id);

                if (file.id > 0) console.log(`sprite ${fileName} ${groupId} ${file.id}`);

                createBinaryFile(`${path}${name}/`, fileName, fileData);
                appendPackFile(name, `${groupId}=${fileName}\n`);
            });
        }
        catch (err) {
            console.error('Failed to unpack', name, groupId, ':', err);

            const fileName = fileNames.get(groupId) ?? `${name}_${groupId}`;
            appendPackFile(name, `${groupId}=null\n`);
        }
    });

    console.log(`unpacked ${name}`);
}

// invs are not transmitted in 425, we only have ids
function unpackInvs() {
    const size = 438;
    const name = 'inv';

    createPackFile(name);
    createConfigFile(name);

    console.log('Unpacking invs...');
    for (let i = 0; i < size; i++) {
        if (i > 0) {
            appendConfigFile(name, '\n');
        }

        const fileName = getFileName(name, i, invNames);
        appendConfigFile(name, `[${fileName}]\n`);
        appendPackFile(name, `${i}=${fileName}\n`);
    }

    console.log('Unpacked invs');
}

function unpackInterfaces() {
    const name = 'interface';

    js5.interfaceArchive.unpack();
    const groups = js5.interfaceArchive.listGroupIds();

    console.log(`Unpacking ${groups.length} interfaces`);

    createPackFile(name);

    groups.forEach((groupId) => {
        try {
            const files = [...js5.interfaceArchive.listGroupFiles(groupId)];

            const groupName = `interface_${groupId}`;

            appendPackFile(name, `${groupId}=${groupName}\n`);

            const packet = Packet.alloc(4);
            files.forEach((file) => {
                try {
                    const fileData = js5.interfaceArchive.readFile(groupId, file.id);
                    const childName = `com_${file.id}`;

                    // write file metadata
                    packet.p2(file.id);
                    packet.p2(fileData.length);

                    // write file data
                    packet.pdata(fileData, 0, fileData.length);

                    appendPackFile(name, `${groupId}:${file.id}=${groupName}:${childName}\n`);
                }
                catch (err) {
                    console.error('Failed to unpack interface', `${groupId}:${file.id}`, ':', err);
                    throw err;
                }
            });

            createBinaryFile('./data/cache/unpacked/interface/', groupName, packet.data.subarray(0, packet.pos));
        }
        catch (err) {
            console.error('Failed to unpack interface', groupId, ':', err);
            throw err;
        }
    });

    console.log('unpacked interfaces');
}

function unpackBinaryGroupFiles(name: string, path: string, fileNames: NameMap, archive: Js5Archive, groupId: number) {
    archive.unpack();
    const files = [...archive.listGroupFiles(groupId)];

    createPackFile(name);
    
    console.log(`Unpacking ${files.length} ${name} files...`);
    
    files.forEach((file) => {
        const fileData = archive.readFile(groupId, file.id);
        const fileName = getFileName(name, file.id, fileNames);
       
        createBinaryFile(`${path}${name}/`, fileName, fileData);
        appendPackFile(name, `${file.id}=${fileName}\n`);
    });

    console.log(`Unpacked ${name} files`);
}

function unpackConfigGroup(name: string, fileNames: NameMap, groupId: number, decoder: Decoder) {
    js5.configArchive.unpack();
    const files = [...js5.configArchive.listGroupFiles(groupId)];

    createPackFile(name);
    createConfigFile(name);

    console.log(`Unpacking ${files.length} ${name} files...`);

    files.forEach((file) => {
        const fileData = js5.configArchive.readFile(groupId, file.id);
        const packet = new Packet(fileData);

        let opcode: number;
        let config: string | string[];

        const src: string[] = [];

        const fileName = getFileName(name, file.id, fileNames);

        if (file.id > 0) {
            appendConfigFile(name, '\n');
        }

        src.push(`[${fileName}]`);

        let wroteDesc = false;

        while (true) {
            opcode = packet.g1();
            if (opcode == 0) {
                break;
            }

            if (name == 'npc' && !wroteDesc) {
                const desc = npcDesc.get(file.id);
                if (desc) {
                    src.push(`desc=${desc}`);
                }

                wroteDesc = true;
            }
            else if (name == 'obj' && !wroteDesc) {
                const desc = objDesc.get(file.id);
                if (desc) {
                    src.push(`desc=${desc}`);
                }

                wroteDesc = true;
            }
            else if (name == 'loc' && !wroteDesc) {
                const desc = locDesc.get(file.id);
                if (desc) {
                    src.push(`desc=${desc}`);
                }

                wroteDesc = true;
            }

            config = decoder(opcode, packet);

            if (Array.isArray(config)) {
                src.push(...config);
            }
            else if (config.length > 0) {
                src.push(config);
            }
        }

        appendPackFile(name, `${file.id}=${fileName}\n`);
        appendConfigFile(name, src.join('\n') + '\n');
    });

    console.log(`Unpacked ${name} files`);
}

function decodeNpc(opcode: number, packet: Packet): string | string[] {
    if (opcode === 1) {
        const out: string[] = [];

        const count = packet.g1();
        for (let i = 0; i < count; i++) {
            const id = packet.g2();
            out.push('model' + (i + 1) + '=model_' + id);
        }

        return out;
    } else if (opcode === 2) {
        const value = packet.gstr();
        return 'name=' + value;
    } else if (opcode === 3) {
        const value = packet.gstr();
        return 'desc=' + value;
    } else if (opcode === 12) {
        const value = packet.g1();
        return 'size=' + value;
    } else if (opcode === 13) {
        const id = packet.g2();
        const seqName = seqNames.get(id) ?? 'seq_' + id;
        return 'readyanim='+ seqName;
    } else if (opcode === 14) {
        const id = packet.g2();
        const seqName = seqNames.get(id) ?? 'seq_' + id;
        return 'walkanim=' + seqName;
    } else if (opcode === 16) {
        return 'hasalpha=yes';
    } else if (opcode === 17) {
        const front = packet.g2();
        const back = packet.g2();
        const right = packet.g2();
        const left = packet.g2();

        const seqs:string[] = [];
        seqs.push(seqNames.get(front) ?? 'seq_' + front);
        seqs.push(seqNames.get(back) ?? 'seq_' + back);
        seqs.push(seqNames.get(right) ?? 'seq_' + right);
        seqs.push(seqNames.get(left) ?? 'seq_' + left);

        let walkAnim = 'walkanim=';
        for (let i = 0; i < seqs.length; i++) {
            if (i > 0) {
                walkAnim += ',';
            }
            walkAnim += seqs[i];
        }

        return walkAnim;
    } else if (opcode >= 30 && opcode < 40) {
        const value = packet.gstr();

        const index = opcode - 30;
        return 'op' + (index + 1) + '=' + value;
    } else if (opcode === 40) {
        const out: string[] = [];

        const count = packet.g1();
        for (let i = 0; i < count; i++) {
            const src = packet.g2();
            const dst = packet.g2();

            out.push('recol' + (i + 1) + 's=' + src);
            out.push('recol' + (i + 1) + 'd=' + dst);
        }

        return out;
    } else if (opcode === 60) {
        const out: string[] = [];

        const count = packet.g1();
        for (let i = 0; i < count; i++) {
            const id = packet.g2();
            out.push('head' + (i + 1) + '=model_' + id);
        }

        return out;
    } else if (opcode === 90) {
        const value = packet.g2();
        return 'code90=' + value;
    } else if (opcode === 91) {
        const value = packet.g2();
        return 'code91=' + value;
    } else if (opcode === 92) {
        const value = packet.g2();
        return 'code92=' + value;
    } else if (opcode === 93) {
        return 'minimap=no';
    } else if (opcode === 95) {
        const value = packet.g2();

        if (value === 0) {
            return 'vislevel=hide';
        }

        return 'vislevel=' + value;
    } else if (opcode === 97) {
        const value = packet.g2();
        return 'resizeh=' + value;
    } else if (opcode === 98) {
        const value = packet.g2();
        return 'resizev=' + value;
    } else if (opcode === 99) {
        return 'alwaysontop=yes';
    } else if (opcode === 100) {
        const value = packet.g1b();
        return 'ambient=' + value;
    } else if (opcode === 101) {
        const value = packet.g1b();
        return 'contrast=' + value;
    } else if (opcode === 102) {
        const value = packet.g2();
        return 'headicon=' + value;
    } else if (opcode === 103) {
        const value = packet.g2();
        return 'turnspeed=' + value;
    } else if (opcode === 106) {
        const out: string[] = [];

        let multiNpcVarbit = packet.g2();
        if (multiNpcVarbit === 65535) {
            multiNpcVarbit = -1;
        }

        if (multiNpcVarbit !== -1) {
            out.push('multivarbit=varbit_' + multiNpcVarbit);
        }

        let multiNpcVarp = packet.g2();
        if (multiNpcVarp === 65535) {
            multiNpcVarp = -1;
        }

        if (multiNpcVarp !== -1) {
            const varpName = varpNames.get(multiNpcVarp) ?? 'varp_' + multiNpcVarp;
            out.push('multivarp='+ varpName);
        }

        const count: number = packet.g1();
        const multiNpcs = new Int32Array(count + 1);

        for (let i: number = 0; i <= count; i++) {
            multiNpcs[i] = packet.g2();
            if (multiNpcs[i] === 65535) {
                multiNpcs[i] = -1;
            }
        }

        for (let i: number = 0; i <= count; i++) {
            if (multiNpcs[i] !== -1) {
                const multiName = getFileName('npc', multiNpcs[i], npcNames);
                out.push('multinpc' + (i + 1) + '='+ multiName);
            }
            else {
                out.push('multinpc' + (i + 1) + '=null');
            }
        }

        return out;
    } else if (opcode === 107) {
        return 'active=no';
    }

    return '';
}

function decodeObj(opcode: number, packet: Packet): string | string[] {
    if (opcode === 1) {
        const id = packet.g2();
        return 'model=model_' + id;
    } else if (opcode === 2) {
        const value = packet.gstr();
        return 'name=' + value;
    } else if (opcode === 3) {
        const value = packet.gstr();
        return 'desc=' + value;
    } else if (opcode === 4) {
        const value = packet.g2();
        return '2dzoom=' + value;
    } else if (opcode === 5) {
        const value = packet.g2();
        return '2dxan=' + value;
    } else if (opcode === 6) {
        const value = packet.g2();
        return '2dyan=' + value;
    } else if (opcode === 7) {
        const value = packet.g2();
        return '2dxof=' + value;
    } else if (opcode === 8) {
        const value = packet.g2();
        return '2dyof=' + value;
    } else if (opcode === 9) {
        return 'code9=yes';
    } else if (opcode === 10) {
        packet.g2(); // unknown - not used in client
        return '';
    } else if (opcode === 11) {
        return 'stackable=yes';
    } else if (opcode === 12) {
        const value = packet.g4();
        return 'cost=' + value;
    } else if (opcode === 16) {
        return 'members=yes';
    } else if (opcode === 23) {
        const id = packet.g2();
        const offset = packet.g1();
        return 'manwear=model_' + id + ',' + offset;
    } else if (opcode === 24) {
        const id = packet.g2();
        return 'manwear2=model_' + id;
    } else if (opcode === 25) {
        const id = packet.g2();
        const offset = packet.g1();
        return 'womanwear=model_' + id + ',' + offset;
    } else if (opcode === 26) {
        const id = packet.g2();
        return 'womanwear2=model_' + id;
    } else if (opcode >= 30 && opcode < 35) {
        const value = packet.gstr();

        const index = opcode - 30;
        return 'op' + (index + 1) + '=' + value;
    } else if (opcode >= 35 && opcode < 40) {
        const value = packet.gstr();

        const index = opcode - 35;
        return 'iop' + (index + 1) + '=' + value;
    } else if (opcode === 40) {
        const out: string[] = [];

        const count = packet.g1();
        for (let i = 0; i < count; i++) {
            const src = packet.g2();
            const dst = packet.g2();

            out.push('recol' + (i + 1) + 's=' + src);
            out.push('recol' + (i + 1) + 'd=' + dst);
        }

        return out;
    } else if (opcode === 78) {
        const id = packet.g2();
        return 'manwear3=model_' + id;
    } else if (opcode === 79) {
        const id = packet.g2();
        return 'womanwear3=model_' + id;
    } else if (opcode === 90) {
        const id = packet.g2();
        return 'manhead=model_' + id;
    } else if (opcode === 91) {
        const id = packet.g2();
        return 'womanhead=model_' + id;
    } else if (opcode === 92) {
        const id = packet.g2();
        return 'manhead2=model_' + id;
    } else if (opcode === 93) {
        const id = packet.g2();
        return 'womanhead2=model_' + id;
    } else if (opcode === 95) {
        const value = packet.g2();
        return '2dzan=' + value;
    } else if (opcode === 97) {
        const id = packet.g2();
        const objName = objNames.get(id) ?? 'obj_' + id;
        return 'certlink='+ objName;
    } else if (opcode === 98) {
        const id = packet.g2();
        const objName = objNames.get(id) ?? 'obj_' + id;
        return 'certtemplate='+ objName;
    } else if (opcode >= 100 && opcode < 110) {
        const id = packet.g2();
        const count = packet.g2();

        const index = opcode - 100;

        const objName = objNames.get(id) ?? 'obj_' + id;
        return 'count' + (index + 1) + '='+ objName +',' + count;
    } else if (opcode === 110) {
        const value = packet.g2();
        return 'resizex=' + value;
    } else if (opcode === 111) {
        const value = packet.g2();
        return 'resizey=' + value;
    } else if (opcode === 112) {
        const value = packet.g2();
        return 'resizez=' + value;
    } else if (opcode === 113) {
        const value = packet.g1b();
        return 'ambient=' + value;
    } else if (opcode === 114) {
        const value = packet.g1b();
        return 'contrast=' + value;
    } else if (opcode === 115) {
        const value = packet.g1();
        return 'team=' + value;
    }

    return '';
}

function decodeLoc(opcode: number, packet: Packet): string | string[] {
    if (opcode === 1 || opcode === 5) {
        const out: string[] = [];

        const count = packet.g1();
        for (let i = 0; i < count; i++) {
            const id = packet.g2();
            let shape = 10;

            if (opcode === 1) {
                shape = packet.g1();
            }

            out.push('model' + (i + 1) + '=model_' + id + ',' + LocShape[shape]);
        }

        return out;
    } else if (opcode === 2) {
        const value = packet.gstr();
        return 'name=' + value;
    } else if (opcode === 3) {
        const value = packet.gstr();
        return 'desc=' + value;
    } else if (opcode === 14) {
        const value = packet.g1();
        return 'width=' + value;
    } else if (opcode === 15) {
        const value = packet.g1();
        return 'length=' + value;
    } else if (opcode === 17) {
        return 'blockwalk=no';
    } else if (opcode === 18) {
        return 'blockrange=no';
    } else if (opcode === 19) {
        const value = packet.gbool();
        return 'active=' + (value ? 'yes' : 'no');
    } else if (opcode === 21) {
        return 'hillskew=yes';
    } else if (opcode === 22) {
        return 'sharelight=yes';
    } else if (opcode === 23) {
        return 'occlude=yes';
    } else if (opcode === 24) {
        const id = packet.g2();
        const seqName = seqNames.get(id) ?? 'seq_' + id;
        return 'anim='+ seqName;
    } else if (opcode === 25) {
        return 'hasalpha=yes';
    } else if (opcode === 28) {
        const value = packet.g1();
        return 'wallwidth=' + value;
    } else if (opcode === 29) {
        const value = packet.g1b();
        return 'ambient=' + value;
    } else if (opcode === 39) {
        const value = packet.g1b();
        return 'contrast=' + value;
    } else if (opcode >= 30 && opcode < 39) {
        const value = packet.gstr();

        const index = opcode - 30;
        return 'op' + (index + 1) + '=' + value;
    } else if (opcode === 40) {
        const out: string[] = [];

        const count = packet.g1();
        for (let i = 0; i < count; i++) {
            const src = packet.g2();
            const dst = packet.g2();

            out.push('recol' + (i + 1) + 's=' + src);
            out.push('recol' + (i + 1) + 'd=' + dst);
        }

        return out;
    } else if (opcode === 41) {
        const out: string[] = [];

        const count = packet.g1();
        for (let i = 0; i < count; i++) {
            const src = packet.g2();
            const dst = packet.g2();

            out.push('//unsupported: retex' + (i + 1) + 's=' + src);
            out.push('//unsupported: retex' + (i + 1) + 'd=' + dst);
        }

        return out;
    } else if (opcode === 60 || opcode === 82) {
        const value = packet.g2();
        return 'mapfunction=' + value;
    } else if (opcode === 62) {
        return 'mirror=yes';
    } else if (opcode === 64) {
        return 'shadow=no';
    } else if (opcode === 65) {
        const value = packet.g2();
        return 'resizex=' + value;
    } else if (opcode === 66) {
        const value = packet.g2();
        return 'resizey=' + value;
    } else if (opcode === 67) {
        const value = packet.g2();
        return 'resizez=' + value;
    } else if (opcode === 68) {
        const value = packet.g2();
        return 'mapscene=' + value;
    } else if (opcode === 69) {
        const flags = packet.g1();

        if ((flags & 0x1) === 0) {
            return 'forceapproach=north';
        } else if ((flags & 0x2) === 0) {
            return 'forceapproach=east';
        } else if ((flags & 0x4) === 0) {
            return 'forceapproach=south';
        } else if ((flags & 0x8) === 0) {
            return 'forceapproach=west';
        }
    } else if (opcode === 70) {
        const value = packet.g2s();
        return 'offsetx=' + value;
    } else if (opcode === 71) {
        const value = packet.g2s();
        return 'offsety=' + value;
    } else if (opcode === 72) {
        const value = packet.g2s();
        return 'offsetz=' + value;
    } else if (opcode === 73) {
        return 'forcedecor=yes';
    } else if (opcode === 74) {
        return 'breakroutefinding=yes';
    } else if (opcode === 75) {
        const value = packet.gbool();
        return 'raiseobject=' + (value ? 'yes' : 'no');
    } else if (opcode === 77 || opcode === 92) {
        const out: string[] = [];

        let multiLocVarbit = packet.g2();
        if (multiLocVarbit === 65535) {
            multiLocVarbit = -1;
        }

        if (multiLocVarbit !== -1) {
            out.push('multivarbit=varbit_' + multiLocVarbit);
        }

        let multiLocVarp = packet.g2();
        if (multiLocVarp === 65535) {
            multiLocVarp = -1;
        }

        if (multiLocVarp !== -1) {
            const varpName = varpNames.get(multiLocVarp) ?? 'varp_' + multiLocVarp;
            out.push('multivarp='+ varpName);
        }

        let defaultMultiLoc: number = -1;
        if (opcode === 92) {
            defaultMultiLoc = packet.g2();

            if (defaultMultiLoc === 65535) {
                defaultMultiLoc = -1;
            }
        }

        const count: number = packet.g1();
        const multiLocs = new Int32Array(count + 1);

        for (let i: number = 0; i <= count; i++) {
            multiLocs[i] = packet.g2();

            if (multiLocs[i] === 65535) {
                multiLocs[i] = -1;
            }
        }

        if (defaultMultiLoc !== -1) {
            out.push('//unsupported: defaultloc=loc_' + defaultMultiLoc);
        }

        for (let i: number = 0; i <= count; i++) {
            if (multiLocs[i] !== -1) {
                const locName = locNames.get(multiLocs[i]) ?? 'loc_' + multiLocs[i];
                out.push('multiloc=' + i + ','+ locName);
            }
            else {
                out.push('multiloc=' + i + ',null');
            }
        }

        return out;
    } else if (opcode === 78) {
        const id = packet.g2();
        const value2 = packet.g1();
        return '//unsupported: bgsound=sound_' + id + ',' + value2;
    } else if (opcode === 79) {
        const out: string[] = [];
        out.push('//unsupported: randomsound=' + packet.g2() + ',' + packet.g2() + ',' + packet.g1());

        const count = packet.g1();
        for (let i = 0; i < count; i++) {
            const id = packet.g2();
            out.push('//unsupported: randomsound' + (i + 1) + '=sound_' + id);
        }

        out.push('//unsupported: bgsound=sound_' + packet.g2() + ',' + packet.g1());
        return out;
    } else if (opcode === 81) {
        const value = packet.g1();
        return '//unsupported: treeskew=' + value;
    }

    return '';
}

function decodeVarp(opcode: number, packet: Packet): string | string[] {
    if (opcode == 5) {
        const value = packet.g2();
        return 'clientcode='+ value;
    }

    return '';
}

function decodeVarbit(opcode: number, packet: Packet): string | string[] {
    if (opcode == 1) {
        const baseVarp = packet.g2();
        const startBit = packet.g1();
        const endBit = packet.g1();

        const out: string[] = [];

        const varpName = varpNames.get(baseVarp) ?? 'varp_' + baseVarp;
        out.push('basevar=' + varpName);
        out.push('startbit=' + startBit);
        out.push('endbit=' + endBit);
        return out;
    }

    return '';
}