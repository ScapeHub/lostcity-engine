import fs from 'fs';

import Packet from '#/io/Packet.js';

import { ConfigType } from '#/cache/config/ConfigType.js';
import { ParamHelper, ParamMap } from '#/cache/config/ParamHelper.js';
import Jagfile from '#/io/Jagfile.js';
import { printFatalError } from '#/util/Logger.js';
import kleur from 'kleur';
import Js5 from '#/js5/Js5.js';

export default class LocType extends ConfigType {
    static configNames: Map<string, number> = new Map();
    static configs: LocType[] = [];

    static load(dir: string) {
        if (!fs.existsSync(`${dir}/server/loc.dat`)) {
            return;
        }

        const server = Packet.load(`${dir}/server/loc.dat`);
        this.parse(server);
        
    }

    static async loadAsync(dir: string) {
        const file = await fetch(`${dir}/server/loc.dat`);
        if (!file.ok) {
            return;
        }

        const [server] = await Promise.all([file.arrayBuffer()]);
        this.parse(new Packet(new Uint8Array(server)));
    }

    static parse(server: Packet) {
        LocType.configNames = new Map();
        LocType.configs = [];

        const count = server.g2();

        for (let id = 0; id < count; id++) {
            const config = new LocType(id);
            const client = Js5.cache.configArchive.readFile(6, id);

            config.active = -1; // so we can infer if active should be automatically determined based on loc shape/ops available
            config.decodeType(server);
            config.decodeType(new Packet(client));

            if (config.active === -1 && config.shapes) {
                config.active = config.shapes.length > 0 && config.shapes[0] === 10 ? 1 : 0;

                if (config.op && config.op.length > 0) {
                    config.active = 1;
                }
            }

            LocType.configs[id] = config;

            if (config.debugname) {
                LocType.configNames.set(config.debugname, id);
            }
        }
    }

    static get(id: number): LocType {
        return LocType.configs[id];
    }

    static getId(name: string): number {
        return LocType.configNames.get(name) ?? -1;
    }

    static getByName(name: string): LocType | null {
        const id = this.getId(name);
        if (id === undefined || id === -1) {
            return null;
        }

        return this.get(id);
    }

    static get count() {
        return this.configs.length;
    }

    // ----
    models: Uint16Array | null = null;
    shapes: Uint8Array | null = null;
    name: string | null = null;
    desc: string | null = null;
    recol_s: Uint16Array | null = null;
    recol_d: Uint16Array | null = null;
    width = 1;
    length = 1;
    blockwalk = true;
    blockrange = true;
    active = 0; // not -1 here just in case an new LocType is created, we want to default to "false"
    hillskew = false;
    sharelight = false;
    occlude = false;
    anim = -1;
    hasalpha = false;
    wallwidth = 16;
    ambient = 0;
    contrast = 0;
    op: (string | null)[] | null = null;
    mapfunction = -1;
    mapscene = -1;
    mirror = false;
    shadow = true;
    resizex = 128;
    resizey = 128;
    resizez = 128;
    forceapproach = 0;
    xoff = 0;
    yoff = 0;
    zoff = 0;
    forcedecor = false;
    breakroutefinding = false;
    raiseobject = false;
    varbit = -1;
    varp = -1;
    multilocs: number[] | null = null;

    // server-side
    category = -1;
    params: ParamMap = new Map();

    decode(code: number, dat: Packet) {
        if (code === 1) {
            const count = dat.g1();
            this.models = new Uint16Array(count);
            this.shapes = new Uint8Array(count);

            for (let i = 0; i < count; i++) {
                this.models[i] = dat.g2();
                this.shapes[i] = dat.g1();
            }
        } else if (code === 2) {
            this.name = dat.gstr();
        } else if (code === 5) {
            const count = dat.g1();
            this.models = new Uint16Array(count);
            for (let i = 0; i < count; i++) {
                this.models[i] = dat.g2();
            }
        } else if (code === 14) {
            this.width = dat.g1();
        } else if (code === 15) {
            this.length = dat.g1();
        } else if (code === 17) {
            this.blockwalk = false;
        } else if (code === 18) {
            this.blockrange = false;
        } else if (code === 19) {
            this.active = dat.g1();
        } else if (code === 21) {
            this.hillskew = true;
        } else if (code === 22) {
            this.sharelight = true;
        } else if (code === 23) {
            this.occlude = true;
        } else if (code === 24) {
            this.anim = dat.g2();

            if (this.anim == 65535) {
                this.anim = -1;
            }
        } else if (code === 25) {
            this.hasalpha = true;
        } else if (code === 28) {
            this.wallwidth = dat.g1();
        } else if (code === 29) {
            this.ambient = dat.g1b();
        } else if (code === 39) {
            this.contrast = dat.g1b();
        } else if (code >= 30 && code < 35) {
            if (!this.op) {
                this.op = new Array(5).fill(null);
            }

            this.op[code - 30] = dat.gstr();
        } else if (code === 40) {
            const count = dat.g1();
            this.recol_s = new Uint16Array(count);
            this.recol_d = new Uint16Array(count);

            for (let i = 0; i < count; i++) {
                this.recol_s[i] = dat.g2();
                this.recol_d[i] = dat.g2();
            }
        } else if (code === 60) {
            this.mapfunction = dat.g2();
        } else if (code === 61) {
            this.category = dat.g2();
        } else if (code === 62) {
            this.mirror = true;
        } else if (code === 64) {
            this.shadow = false;
        } else if (code === 65) {
            this.resizex = dat.g2();
        } else if (code === 66) {
            this.resizey = dat.g2();
        } else if (code === 67) {
            this.resizez = dat.g2();
        } else if (code === 68) {
            this.mapscene = dat.g2();
        } else if (code === 69) {
            this.forceapproach = dat.g1();
        } else if (code === 70) {
            this.xoff = dat.g2s();
        } else if (code === 71) {
            this.yoff = dat.g2s();
        } else if (code === 72) {
            this.zoff = dat.g2s();
        } else if (code === 73) {
            this.forcedecor = true;
        } else if (code === 74) {
            this.breakroutefinding = true;
        } else if (code === 75) {
            this.raiseobject = dat.gbool();
        } else if (code === 77) {
            this.varbit = dat.g2();
            if (this.varbit == 65535) {
                this.varbit = -1;
            }

            this.varp = dat.g2();
            if (this.varp == 65535) {
                this.varp = -1;
            }

            const size = dat.g1();
            this.multilocs = new Array(size + 1);
            for (let i = 0; i <= size; i++) {
                this.multilocs[i] = dat.g2();
                if (this.multilocs[i] == 65535) {
                    this.multilocs[i] = -1;
                }
            }
        }
        else if (code === 249) {
            this.params = ParamHelper.decodeParams(dat);
        } else if (code === 250) {
            this.debugname = dat.gjstr();
        } else if (code == 251) {
            this.desc = dat.gjstr();
        } else {
            printFatalError(`Unrecognized loc config code: ${code}\nThis error comes from the packed data being out of sync, try running ` + kleur.green().bold('npm run build') + ', then restarting this.');
        }
    }
}
