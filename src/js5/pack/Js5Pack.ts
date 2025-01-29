import Js5 from '#/js5/Js5.js';
import { packJs5Config } from '#/js5/pack/PackConfig.js';
import {
    HuffmanPack, InterfacePack,
    JinglePack, MapPack,
    ModelPack,
    MusicPack,
    PackFile, revalidatePack,
    SkeletonPack, SkinPack,
    SoundPack,
    SpritePack, TexturePack
} from '#/util/PackFile.js';
import fs from 'fs';
import Js5Archive from '#/js5/Js5Archive.js';
import Packet from '#/io/Packet.js';

type XteaKey = { name: string, keys: Int32Array }

export async function packJs5() {
    const js5 = new Js5('./data/cache/packed', 12);
    const keys: XteaKey[] = [];

    revalidatePack();

    await packJs5Config(js5.configArchive);

    packNamedBinaryGroupFiles(js5.huffmanArchive, 'huffman', HuffmanPack);
    packBinaryGroupFiles(js5.jingleArchive, 'jingle', JinglePack);
    packNamedBinaryGroupFiles(js5.musicArchive, 'music', MusicPack);
    packBinaryGroupFiles(js5.soundArchive, 'sound', SoundPack);
    packBinaryGroupFiles(js5.skeletonArchive, 'skeleton', SkeletonPack);
    packBinaryGroupFiles(js5.modelArchive, 'model', ModelPack);
    packNamedBinaryGroupFiles(js5.spriteArchive, 'sprite', SpritePack);

    packBinaryGroup(js5.textureArchive, 'texture', TexturePack);
    packBinaryGroup(js5.skinCacheArchive, 'skin', SkinPack);
    packBinaryGroup(js5.interfaceArchive, 'interface', InterfacePack);

    packNamedEncryptedBinaryGroupFiles(js5.worldMapArchive, 'map', MapPack, keys);

    writeKeys(keys);

    js5.close();
}

function generateKeys(secureRandom: () => number = () => Math.floor(Math.random() * 2 ** 32)): Int32Array {
    return new Int32Array([secureRandom(), secureRandom(), secureRandom(), secureRandom()]);
}

function writeKeys(keys: XteaKey[]): void {
    try {
        // Convert the JavaScript object to a JSON string
        const jsonData = JSON.stringify(keys, null, 4); // Pretty-print with 4 spaces
        // Write the JSON string to the file
        fs.writeFileSync('./data/cache/packed/keys.json', jsonData, 'utf8');
    } catch (error) {
        console.error(`Error writing JSON file: ${error}`);
    }
}


export function readBinaryFiles(path: string, pack: PackFile): Map<number, Uint8Array> {
    try {
        // Read directory contents
        const files = fs.readdirSync(path);

        const fileData: Map<number, Uint8Array> = new Map();

        for (const file of files) {
            const stat = fs.statSync(`${path}/${file}`);

            // Check if the file is a directory or a file
            if (stat.isDirectory()) {
                continue;
            }

            if (!stat.isFile()) {
                continue;
            }

            if (!file.endsWith('.dat')) {
                continue;
            }

            const fileName = file.substring(0, file.length - 4);
            const id = pack.getByName(fileName);
            if (id === -1) {
                continue;
            }

            const data = new Uint8Array(fs.readFileSync(`${path}/${file}`));
            fileData.set(id, data);
        }

        return fileData;
    } catch (err) {
        console.error(`Error reading directory ${path}:`, err);
        throw err;
    }
}

export function parseBinaryFiles(archive: Js5Archive, path: string, pack: PackFile, groupId: number) {
    const files = readBinaryFiles(`./data/cache/unpacked/${path}/`, pack);

    console.log(`Packing ${pack.type}`);
    files.forEach((data, id) => {
        archive.writeFile(groupId, id, data);
    });
}

export function packBinaryGroupFiles(archive: Js5Archive, path: string, pack: PackFile) {
    const files = readBinaryFiles(`./data/cache/unpacked/${path}/`, pack);

    console.log(`Packing ${pack.type}`);
    files.forEach((data, id) => {
        archive.writeFile(id, 0, data);
    });

    archive.pack();
}

export function packBinaryGroup(archive: Js5Archive, path: string, pack: PackFile) {
    const files = readBinaryFiles(`./data/cache/unpacked/${path}/`, pack);

    console.log(`Packing ${pack.type}`);
    files.forEach((data, id) => {
        const packet = new Packet(data);

        while (packet.available > 0) {
            const fileId = packet.g2();
            const fileSize = packet.g2();

            const fileData = new Uint8Array(fileSize);
            packet.gdata(fileData, 0, fileSize);

            archive.writeFile(id, fileId, fileData);
        }
    });

    archive.pack();
}

export function packNamedBinaryGroupFiles(archive: Js5Archive, path: string, pack: PackFile) {
    const files = readBinaryFiles(`./data/cache/unpacked/${path}/`, pack);

    console.log(`Packing ${pack.type}`);
    files.forEach((data, id) => {
        const name = pack.getById(id);
        if (!name) {
            throw new Error(`Failed to find name for id ${id}, ${pack.type}`);
        }
        archive.writeNamedGroup(id, name, 0, data);
    });

    archive.pack();
}

export function packNamedEncryptedBinaryGroupFiles(archive: Js5Archive, path: string, pack: PackFile, xteaKeys: XteaKey[]): void {
    const files = readBinaryFiles(`./data/cache/unpacked/${path}/`, pack);

    console.log(`Packing ${pack.type}`);
    files.forEach((data, id) => {
        const name = pack.getById(id);
        if (!name) {
            throw new Error(`Failed to find name for id ${id}, ${pack.type}`);
        }

        const keys = name.startsWith('m') ? undefined : generateKeys();
        archive.writeNamedGroup(id, name, 0, data);

        if (keys) {
            xteaKeys.push({ name, keys });
        }
    });

    archive.pack();
}