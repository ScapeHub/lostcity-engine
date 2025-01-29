import ClientSocket from '#/server/ClientSocket.js';
import Packet from '#/io/Packet.js';
import Js5 from '#/js5/Js5.js';
import Js5GroupResponse from '#/network/server/model/js5/Js5GroupResponse.js';
import Js5ClientRepository from '#/network/rs459/client/prot/js5/Js5ClientRepository.js';
import Js5ServerRepository from '#/network/rs459/server/prot/Js5ServerRepository.js';

type Js5Request = {
    client: ClientSocket;
    archive: number;
    group: number;
}

class Js5UpdateServer {
    private static in = Packet.alloc(5000);
    private static serverRepo = new Js5ServerRepository();
    private static clientRepo = new Js5ClientRepository();

    private clients: ClientSocket[] = [];
    public urgent: Js5Request[] = [];
    public prefetch: Js5Request[] = [];

    public addClient(client: ClientSocket): void {
        client.send(Uint8Array.from([ 0 ]));
        client.state = 2;

        this.clients.push(client);
    }

    public cycle(): void {
        for (let i = 0; i < this.clients.length; i++) {
            const client = this.clients[i];
            if (client.state === -1) {
                this.clients.splice(i--, 1);
                continue;
            }

            let available = client.available;
            while (available > 0) {
                if (client.opcode === -1) {
                    client.read(Js5UpdateServer.in.data, 0, 1);
                    Js5UpdateServer.in.pos = 0;
                    client.opcode = Js5UpdateServer.in.g1();
                    available -= 1;

                    const decoder = Js5UpdateServer.clientRepo.getDecoder(client.opcode);
                    if (!decoder) {
                        break;
                    }

                    client.waiting = decoder.size;
                }

                if (available < client.waiting) {
                    break;
                }

                const decoder = Js5UpdateServer.clientRepo.getDecoder(client.opcode)!;
                const handler = Js5UpdateServer.clientRepo.getHandler(client.opcode)!;

                client.read(Js5UpdateServer.in.data, 0, client.waiting);
                Js5UpdateServer.in.pos = 0;
                available -= client.waiting;

                const message = decoder.read(Js5UpdateServer.in, decoder.size);
                client.opcode = -1;

                if (!handler.handle(message, client)) {
                    break;
                }
            }
        }

        for (let i = 0; i < this.urgent.length; i++) {
            const req = this.urgent.splice(i--, 1)[0];
            if (req.client.state === -1) {
                continue;
            }

            req.client.urgentLimit--;

            let data: Uint8Array | null;
            if (req.archive === 255 && req.group === 255) {
                data = Js5.cache.getReferenceData();
            }
            else {
                data = Js5.cache.getGroupData(req.archive, req.group);
            }
            if (!data) {
                continue;
            }

            const message = new Js5GroupResponse(req.archive, req.group, false, data, 0);
            const encoder = Js5UpdateServer.serverRepo.getEncoder(message);
            if (!encoder) {
                continue;
            }

            const buf = Packet.alloc(10_000_000);
            encoder.write(buf, message);
            req.client.send(buf.data.subarray(0, buf.pos));
            buf.release();
        }

        for (let i = 0; i < this.prefetch.length; i++) {
            const req = this.prefetch.splice(i--, 1)[0];
            if (req.client.state === -1) {
                continue;
            }

            req.client.prefetchLimit--;

            const data = Js5.cache.getGroupData(req.archive, req.group);
            if (!data) {
                continue;
            }

            const message = new Js5GroupResponse(req.archive, req.group, true, data, 0);
            const encoder = Js5UpdateServer.serverRepo.getEncoder(message);
            if (!encoder) {
                continue;
            }

            const buf = Packet.alloc(10_000_000);
            encoder.write(buf, message);
            req.client.send(buf.data.subarray(0, buf.pos));
            buf.release();
        }

        // todo: account for drift due to event loop/OS scheduling
        setTimeout(this.cycle.bind(this), 50);
    }
}

export default new Js5UpdateServer();