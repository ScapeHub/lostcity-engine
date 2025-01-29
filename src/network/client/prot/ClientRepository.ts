import Js5MessageDecoder from '#/network/client/codec/Js5MessageDecoder.js';
import Js5ClientMessageHandler from '#/network/client/handler/Js5ClientMessageHandler.js';

export default class ClientRepository {
    private decoders: Map<number, Js5MessageDecoder> = new Map(); // opcode -> decoder
    private handlers: Map<number, Js5ClientMessageHandler> = new Map(); // opcode -> handler

    protected bind(decoder: Js5MessageDecoder, handler: Js5ClientMessageHandler) {
        this.decoders.set(decoder.opcode, decoder);
        this.handlers.set(decoder.opcode, handler);
    }

    getDecoder(opcode: number): Js5MessageDecoder | undefined {
        return this.decoders.get(opcode);
    }

    getHandler(opcode: number): Js5ClientMessageHandler | undefined {
        return this.handlers.get(opcode);
    }
}