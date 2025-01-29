import ClientRepository from '#/network/client/prot/ClientRepository.js';
import PrefetchRequestDecoder from '#/network/rs459/client/codec/js5/PrefetchRequestDecoder.js';
import PrefetchRequestHandler from '#/network/rs459/client/handler/js5/PrefetchRequestHandler.js';
import UrgentRequestDecoder from '#/network/rs459/client/codec/js5/UrgentRequestDecoder.js';
import UrgentRequestHandler from '#/network/rs459/client/handler/js5/UrgentRequestHandler.js';
import PriorityChangeHighDecoder from '#/network/rs459/client/codec/js5/PriorityChangeHighDecoder.js';
import PriorityChangeHighHandler from '#/network/rs459/client/handler/js5/PriorityChangeHighHandler.js';
import PriorityChangeLowDecoder from '#/network/rs459/client/codec/js5/PriorityChangeLowDecoder.js';
import PriorityChangeLowHandler from '#/network/rs459/client/handler/js5/PriorityChangeLowHandler.js';
import XorChangeDecoder from '#/network/rs459/client/codec/js5/XorChangeDecoder.js';
import XorChangeHandler from '#/network/rs459/client/handler/js5/XorChangeHandler.js';

export default class Js5ClientRepository extends ClientRepository {
    constructor() {
        super();

        this.bind(new PrefetchRequestDecoder(), new PrefetchRequestHandler());
        this.bind(new UrgentRequestDecoder(), new UrgentRequestHandler());
        this.bind(new PriorityChangeHighDecoder(), new PriorityChangeHighHandler());
        this.bind(new PriorityChangeLowDecoder(), new PriorityChangeLowHandler());
        this.bind(new XorChangeDecoder(), new XorChangeHandler());
    }
}
