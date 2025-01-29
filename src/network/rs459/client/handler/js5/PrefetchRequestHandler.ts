import type PrefetchRequest from '#/network/client/model/js5/PrefetchRequest.ts';
import type ClientSocket from '#/server/ClientSocket.ts';
import Js5ClientMessageHandler from '#/network/client/handler/Js5ClientMessageHandler.js';
import Js5UpdateServer from '#/js5/Js5UpdateServer.js';

export default class PrefetchRequestHandler extends Js5ClientMessageHandler {
    handle(message: PrefetchRequest, client: ClientSocket) {
        if (client.prefetchLimit >= 20) {
            return true;
        }

        const { archive, group } = message;

        Js5UpdateServer.prefetch.push({ client, archive, group });
        client.prefetchLimit++;
        return true;
    }
}
