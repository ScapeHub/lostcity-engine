import fs from 'fs';

import { listFilesExt, loadDirExtFull, loadFile } from '#/util/Parse.js';
import { basename, dirname } from 'path';
import Environment from '#/util/Environment.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PackFileValidator = (packfile: PackFile, ...args: any[]) => void;

export class PackFile {
    type: string;
    validator: PackFileValidator | null = null;
    validatorArgs: any[] = [];
    pack: Map<number, string> = new Map();
    names: Set<string> = new Set();
    max: number = 0;

    get size() {
        return this.pack.size;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(type: string, validator: PackFileValidator | null = null, ...validatorArgs: any[]) {
        this.type = type;
        this.validator = validator;
        this.validatorArgs = validatorArgs;
        this.reload();
    }

    reload() {
        if (this.validator !== null) {
            this.validator(this, ...this.validatorArgs);
        } else {
            this.load(`./data/cache/unpacked/pack/${this.type}.pack`);
        }
    }

    load(path: string) {
        this.pack = new Map();

        if (!fs.existsSync(path)) {
            return;
        }

        const lines = loadFile(path);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.length === 0 || !/^\d+=/g.test(line)) {
                continue;
            }

            const parts = line.split('=');
            if (parts[1].length === 0) {
                throw new Error(`Pack file has an empty name ${path}:${i + 1}`);
            }

            // interfaces use group:id - we want to exclude these and only load group ids
            if (parts[0].includes(':')) {
                continue;
            }

            this.register(parseInt(parts[0]), parts[1]);
        }
        this.refreshNames();
    }

    register(id: number, name: string) {
        this.pack.set(id, name);
    }

    refreshNames() {
        this.names = new Set(this.pack.values());
        this.max = Math.max(...Array.from(this.pack.keys())) + 1;
    }

    save() {
        fs.writeFileSync(`${Environment.BUILD_SRC_DIR}/pack/${this.type}.pack`, Array.from(this.pack.entries()).sort((a, b) => a[0] - b[0]).map(([id, name]) => `${id}=${name}`).join('\n') + '\n');
    }

    getById(id: number): string {
        return this.pack.get(id) ?? '';
    }

    getByName(name: string): number {
        if (!this.names.has(name)) {
            return -1;
        }

        for (const [id, packName] of this.pack) {
            if (packName === name) {
                return id;
            }
        }

        return -1;
    }
}

function validateFilesPack(pack: PackFile, path: string, ext: string): void {
    pack.load(`${Environment.BUILD_SRC_DIR}/pack/${pack.type}.pack`);

    const files = listFilesExt(path, ext);

    const fileNames = new Set(files.map(x => basename(x, ext)));
    for (let i = 0; i < files.length; i++) {
        files[i] = files[i].substring(files[i].lastIndexOf('/') + 1); // strip file path
        files[i] = files[i].substring(0, files[i].length - ext.length); // strip extension
        fileNames.add(files[i]);
    }

    for (let i = 0; i < files.length; i++) {
        const name = files[i];

        if (!pack.names.has(name)) {
            throw new Error(`${pack.type}: ${name} is missing an ID line, you may need to edit ${Environment.BUILD_SRC_DIR}/pack/${pack.type}.pack`);
        }
    }

    if (Environment.BUILD_VERIFY_PACK) {
        for (const name of pack.names) {
            if (!fileNames.has(name)) {
                throw new Error(`${pack.type}: ${name} was not found on your disk, you may need to edit ${Environment.BUILD_SRC_DIR}/pack/${pack.type}.pack`);
            }
        }
    }

    pack.save();
}

function validateImagePack(pack: PackFile, path: string, ext: string): void {
    pack.load(`${Environment.BUILD_SRC_DIR}/pack/${pack.type}.pack`);

    const files = listFilesExt(path, ext);

    const fileNames = new Set(files.map(x => basename(x, ext)));
    for (let i = 0; i < files.length; i++) {
        if (basename(dirname(files[i])) === 'meta') {
            continue;
        }

        files[i] = files[i].substring(files[i].lastIndexOf('/') + 1); // strip file path
        files[i] = files[i].substring(0, files[i].length - ext.length); // strip extension
        fileNames.add(files[i]);

        const name = files[i];
        if (!pack.names.has(name)) {
            throw new Error(`${pack.type}: ${name} is missing an ID line, you may need to edit ${Environment.BUILD_SRC_DIR}/pack/${pack.type}.pack`);
        }
    }

    if (Environment.BUILD_VERIFY_PACK) {
        for (const name of pack.names) {
            if (!fileNames.has(name)) {
                throw new Error(`${pack.type}: ${name} was not found on your disk, you may need to edit ${Environment.BUILD_SRC_DIR}/pack/${pack.type}.pack`);
            }
        }
    }

    pack.save();
}

function validateConfigPack(pack: PackFile, ext: string, regen: boolean = false, reduce: boolean = false, reuse: boolean = false, recycle: boolean = false): void {
    const names = crawlConfigNames(ext);
    const configNames = new Set(names);

    if (regen) {
        if (reduce) {
            // remove missing ids (shifts ids)
            // remove missing names (shifts ids)
        } else if (reuse) {
            // if something was deleted, prioritize placing new names in those deleted slots
        } else if (recycle) {
            // completely scorched earth (resets ids)
        } else {
            // just add new ids to the end
            pack.load(`${Environment.BUILD_SRC_DIR}/pack/${pack.type}.pack`);
        }

        for (let i = 0; i < names.length; i++) {
            if (!pack.names.has(names[i])) {
                pack.register(pack.max++, names[i]);
            }
        }
        pack.refreshNames();
    } else {
        pack.load(`${Environment.BUILD_SRC_DIR}/pack/${pack.type}.pack`);
    }

    for (let i = 0; i < names.length; i++) {
        const name = names[i];

        if (!pack.names.has(name) && !name.startsWith('cert_')) {
            throw new Error(`${pack.type}: ${name} is missing an ID line, you may need to edit ${Environment.BUILD_SRC_DIR}/pack/${pack.type}.pack`);
        }
    }

    for (const name of pack.names) {
        if (!configNames.has(name) && !name.startsWith('cert_')) {
            throw new Error(`${pack.type}: ${name} was not found in any ${ext} files, you may need to edit ${Environment.BUILD_SRC_DIR}/pack/${pack.type}.pack`);
        }
    }

    if (regen) {
        pack.save();
    }
}

function validateCategoryPack(pack: PackFile) {
    pack.load(`${Environment.BUILD_SRC_DIR}/pack/category.pack`);
    // if (shouldBuild(`${Environment.BUILD_SRC_DIR}/scripts`, '.loc', `${Environment.BUILD_SRC_DIR}/pack/category.pack`) ||
    //     shouldBuild(`${Environment.BUILD_SRC_DIR}/scripts`, '.npc', `${Environment.BUILD_SRC_DIR}/pack/category.pack`) ||
    //     shouldBuild(`${Environment.BUILD_SRC_DIR}/scripts`, '.obj', `${Environment.BUILD_SRC_DIR}/pack/category.pack`)) {
    //     const categories = crawlConfigCategories();
    //     for (let i = 0; i < categories.length; i++) {
    //         pack.register(i, categories[i]);
    //     }
    //     pack.refreshNames();
    //     pack.save();
    // } else {
    //     pack.load(`${Environment.BUILD_SRC_DIR}/pack/category.pack`);
    // }
}

function validateInterfacePack(pack: PackFile) {
    pack.load(`${Environment.BUILD_SRC_DIR}/pack/interface.pack`);

    loadDirExtFull(`${Environment.BUILD_SRC_DIR}/scripts`, '.if', (lines: string[], file: string) => {
        if (Environment.BUILD_VERIFY_FOLDER) {
            const parent = basename(dirname(dirname(file)));
            const dir = basename(dirname(file));
            if (dir !== 'interfaces' && parent !== 'interfaces') {
                throw new Error(`Interface file ${file} must be located inside an "interfaces" directory.`);
            }
        }

        const inter = basename(file, '.if');
        if (!pack.names.has(inter)) {
            throw new Error(`${Environment.BUILD_SRC_DIR}/pack/interface.pack is missing ID for interface ${inter} from ${file}`);
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('[')) {
                const com = line.substring(1, line.length - 1);
                const name = `${inter}:${com}`;

                if (!pack.names.has(name)) {
                    throw new Error(`${Environment.BUILD_SRC_DIR}/pack/interface.pack is missing ID for component ${name} from ${file}`);
                }
            }
        }
    });
}

// todo: validate triggers, names, and/or reuse IDs?
function regenScriptPack(pack: PackFile) {
    pack.load(`${Environment.BUILD_SRC_DIR}/pack/script.pack`);

    const names = crawlConfigNames('.rs2', true);
    for (let i = 0; i < names.length; i++) {
        if (!pack.names.has(names[i])) {
            pack.register(pack.max++, names[i]);
        }
    }
    pack.refreshNames();
    pack.save();
}

export const CategoryPack = new PackFile('category', validateCategoryPack);
export const DbRowPack = new PackFile('dbrow', validateConfigPack, '.dbrow', true, false, false, true);
export const DbTablePack = new PackFile('dbtable', validateConfigPack, '.dbtable', true, false, false, true);
export const EnumPack = new PackFile('enum', validateConfigPack, '.enum', true, false, false, true);
export const HuntPack = new PackFile('hunt', validateConfigPack, '.hunt', true, false, false, true);
export const ParamPack = new PackFile('param', validateConfigPack, '.param', true, false, false, true);
export const ScriptPack = new PackFile('script', regenScriptPack);
export const StructPack = new PackFile('struct', validateConfigPack, '.struct', true, false, false, true);
export const VarnPack = new PackFile('varn', validateConfigPack, '.varn', true, false, false, true);
export const VarsPack = new PackFile('vars', validateConfigPack, '.vars', true, false, false, true);

// added - client packs
export const HuffmanPack = new PackFile('huffman');
export const JinglePack = new PackFile('jingle');
export const MusicPack = new PackFile('music');
export const SoundPack = new PackFile('sound');
export const SkeletonPack = new PackFile('skeleton');
export const ModelPack = new PackFile('model');
export const TexturePack = new PackFile('texture');
export const SkinPack = new PackFile('skin');
export const SpritePack = new PackFile('sprite');
export const MapPack = new PackFile('map');
export const InterfacePack = new PackFile('interface');
export const VarpPack = new PackFile('varp');
export const VarbitPack = new PackFile('varbit');
export const InvPack = new PackFile('inv');
export const LocPack = new PackFile('loc');
export const SeqPack = new PackFile('seq');
export const SpotAnimPack = new PackFile('spotanim');
export const FloPack = new PackFile('flo');
export const FluPack = new PackFile('flu');
export const IdkPack = new PackFile('idk');
export const MesAnimPack = new PackFile('mesanim');
export const NpcPack = new PackFile('npc');
export const ObjPack = new PackFile('obj');

export function revalidatePack() {
    CategoryPack.reload();
    DbRowPack.reload();
    DbTablePack.reload();
    EnumPack.reload();
    FloPack.reload();
    HuntPack.reload();
    IdkPack.reload();
    InterfacePack.reload();
    InvPack.reload();
    LocPack.reload();
    MesAnimPack.reload();
    ModelPack.reload();
    NpcPack.reload();
    ObjPack.reload();
    ParamPack.reload();
    ScriptPack.reload();
    SeqPack.reload();
    SoundPack.reload();
    SpotAnimPack.reload();
    StructPack.reload();
    TexturePack.reload();
    VarpPack.reload();
    VarnPack.reload();
    VarsPack.reload();
}

export function crawlConfigNames(ext: string, includeBrackets = false) {
    const names: string[] = [];

    loadDirExtFull(`${Environment.BUILD_SRC_DIR}/scripts`, ext, (lines: string[], file: string) => {
        if (file === `${Environment.BUILD_SRC_DIR}/scripts/engine.rs2`) {
            // these command signatures are specifically for the compiler to have type information
            return;
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('[')) {
                let name = line.substring(0, line.indexOf(']') + 1);
                if (!includeBrackets) {
                    name = name.substring(1, name.length - 1);
                }

                if (Environment.BUILD_VERIFY_FOLDER) {
                    const parent = basename(dirname(dirname(file)));
                    const dir = basename(dirname(file));
                    if (dir !== '_unpack' && ext !== '.flo') {
                        if (ext === '.rs2' && dir !== 'scripts' && parent !== 'scripts') {
                            throw new Error(`Script file ${file} must be located inside a "scripts" directory.`);
                        } else if (ext !== '.rs2' && dir !== 'configs' && parent !== 'configs') {
                            throw new Error(`Config file ${file} must be located inside a "configs" directory.`);
                        }
                    }
                }

                if (names.indexOf(name) === -1) {
                    names.push(name);
                }
            }
        }
    });

    return names;
}

function crawlConfigCategories() {
    const names: string[] = [];

    loadDirExtFull(`${Environment.BUILD_SRC_DIR}/scripts`, '.loc', (lines: string[]) => {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('category=')) {
                const name = line.substring('category='.length);

                if (names.indexOf(name) === -1) {
                    names.push(name);
                }
            }
        }
    });

    loadDirExtFull(`${Environment.BUILD_SRC_DIR}/scripts`, '.npc', (lines: string[]) => {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('category=')) {
                const name = line.substring('category='.length);

                if (names.indexOf(name) === -1) {
                    names.push(name);
                }
            }
        }
    });

    loadDirExtFull(`${Environment.BUILD_SRC_DIR}/scripts`, '.obj', (lines: string[]) => {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('category=')) {
                const name = line.substring('category='.length);

                if (names.indexOf(name) === -1) {
                    names.push(name);
                }
            }
        }
    });

    return names;
}

export function getModified(path: string) {
    if (!fs.existsSync(path)) {
        return 0;
    }

    const stats = fs.statSync(path);
    return stats.mtimeMs;
}

export function getLatestModified(path: string, ext: string) {
    const files = listFilesExt(path, ext);

    let latest = 0;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const stats = fs.statSync(file);

        if (stats.mtimeMs > latest) {
            latest = stats.mtimeMs;
        }
    }

    return latest;
}

export function shouldBuild(path: string, ext: string, out: string) {
    if (!fs.existsSync(out)) {
        return true;
    }

    const stats = fs.statSync(out);
    const latest = getLatestModified(path, ext);

    return stats.mtimeMs < latest;
}

export function shouldBuildFile(src: string, dest: string) {
    if (!fs.existsSync(dest)) {
        return true;
    }

    const stats = fs.statSync(dest);
    const srcStats = fs.statSync(src);

    return stats.mtimeMs < srcStats.mtimeMs;
}

export function shouldBuildFileAny(path: string, dest: string) {
    if (!fs.existsSync(dest)) {
        return true;
    }

    const names = fs.readdirSync(path);
    for (let i = 0; i < names.length; i++) {
        const stat = fs.statSync(`${path}/${names[i]}`);

        if (stat.isDirectory()) {
            const subdir = shouldBuildFileAny(`${path}/${names[i]}`, dest);
            if (subdir) {
                return true;
            }
        } else {
            if (shouldBuildFile(`${path}/${names[i]}`, dest)) {
                return true;
            }
        }
    }

    return false;
}
