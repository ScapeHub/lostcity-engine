import Js5ClientMessage from '#/network/client/Js5ClientMessage.js';

export default class UrgentRequest extends Js5ClientMessage {
    archive: number;
    group: number;

    constructor(archive: number, group: number) {
        super();

        this.archive = archive;
        this.group = group;
    }
}