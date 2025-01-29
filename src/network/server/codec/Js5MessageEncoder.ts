import Packet from '#/io/Packet.js';
import Js5ServerMessage from '#/network/server/Js5ServerMessage.js';

export default abstract class Js5MessageEncoder {
    abstract opcode: number;
    abstract size: number;

    abstract write(buf: Packet, message: Js5ServerMessage): void;

    test(_: Js5ServerMessage): number {
        return this.size;
    }
}