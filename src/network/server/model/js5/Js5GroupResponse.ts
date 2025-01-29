import Js5ServerMessage from '#/network/server/Js5ServerMessage.js';

export default class Js5GroupResponse extends Js5ServerMessage {
    archive: number;
    group: number;
    prefetch: boolean;
    data: Uint8Array;
    xor: number;

    constructor(archive: number, group: number, prefetch: boolean, data: Uint8Array, xor: number) {
        super();

        this.archive = archive;
        this.group = group;
        this.prefetch = prefetch;
        this.data = data;
        this.xor = xor;
    }
}