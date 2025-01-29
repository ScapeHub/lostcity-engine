import type Packet from '#/io/Packet.ts';

import Js5MessageDecoder from '#/network/client/codec/Js5MessageDecoder.js';
import Js5ClientMessage from '#/network/client/Js5ClientMessage.js';
import UrgentRequest from '#/network/client/model/js5/UrgentRequest.js';

export default class UrgentRequestDecoder extends Js5MessageDecoder {
    opcode = 1;
    size = 3;

    read(buf: Packet): Js5ClientMessage {
        const archive = buf.g1();
        const group = buf.g2();

        return new UrgentRequest(archive, group);
    }
}
