import type Packet from '#/io/Packet.ts';

import Js5MessageDecoder from '#/network/client/codec/Js5MessageDecoder.js';
import XorChange from '#/network/client/model/js5/XorChange.js';
import Js5ClientMessage from '#/network/client/Js5ClientMessage.js';

export default class XorChangeDecoder extends Js5MessageDecoder {
    opcode = 4;
    size = 3;

    read(buf: Packet): Js5ClientMessage {
        const key = buf.g1();

        return new XorChange(key);
    }
}
