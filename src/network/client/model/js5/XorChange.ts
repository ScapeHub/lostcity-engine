import Js5ClientMessage from '#/network/client/Js5ClientMessage.js';

export default class XorChange extends Js5ClientMessage {
    key: number;

    constructor(key: number) {
        super();

        this.key = key;
    }
}