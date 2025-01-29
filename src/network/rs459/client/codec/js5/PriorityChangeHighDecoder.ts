import Js5MessageDecoder from '#/network/client/codec/Js5MessageDecoder.js';
import Js5ClientMessage from '#/network/client/Js5ClientMessage.js';
import PriorityChangeHigh from '#/network/client/model/js5/PriorityChangeHigh.js';

export default class PriorityChangeHighDecoder extends Js5MessageDecoder {
    opcode = 2;
    size = 3;

    read(): Js5ClientMessage {
        return new PriorityChangeHigh();
    }
}
