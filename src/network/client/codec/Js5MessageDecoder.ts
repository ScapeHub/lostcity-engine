import Packet from '#/io/Packet.js';
import Js5ClientMessage from '#/network/client/Js5ClientMessage.js';

export default abstract class Js5MessageDecoder {
    abstract opcode: number;
    abstract size: number;

    abstract read(buf: Packet, length: number): Js5ClientMessage;
}