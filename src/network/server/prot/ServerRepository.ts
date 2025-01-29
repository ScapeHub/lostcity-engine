import Js5ServerMessage from '#/network/server/Js5ServerMessage.js';
import Js5MessageEncoder from '#/network/server/codec/Js5MessageEncoder.js';

export default class ServerRepository {
    private encoders: Map<Js5ServerMessage, Js5MessageEncoder> = new Map();

    protected bind(message: Js5ServerMessage, encoder: Js5MessageEncoder) {
        this.encoders.set(message, encoder);
    }

    getEncoder(message: Js5ServerMessage): Js5MessageEncoder | undefined {
        return this.encoders.get(message.constructor);
    }
}
