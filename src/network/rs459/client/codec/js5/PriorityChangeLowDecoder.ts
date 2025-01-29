import Js5MessageDecoder from '#/network/client/codec/Js5MessageDecoder.js';
import PriorityChangeLow from '#/network/client/model/js5/PriorityChangeLow.js';
import Js5ClientMessage from '#/network/client/Js5ClientMessage.js';

export default class PriorityChangeLowDecoder extends Js5MessageDecoder {
    opcode = 3;
    size = 3;

    read(): Js5ClientMessage {
        return new PriorityChangeLow();
    }
}
