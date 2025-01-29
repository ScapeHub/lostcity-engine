import Js5ClientMessage from '#/network/client/Js5ClientMessage.js';
import ClientSocket from '#/server/ClientSocket.js';

export default abstract class Js5ClientMessageHandler {
    abstract handle(message: Js5ClientMessage, client: ClientSocket): boolean;
}
