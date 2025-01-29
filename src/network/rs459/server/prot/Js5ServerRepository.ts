import Js5GroupResponse from '#/network/server/model/js5/Js5GroupResponse.js';
import Js5GroupResponseEncoder from '#/network/rs459/server/codec/js5/Js5GroupResponseEncoder.js';
import ServerRepository from '#/network/server/prot/ServerRepository.js';

export default class Js5ServerRepository extends ServerRepository {
    constructor() {
        super();

        this.bind(Js5GroupResponse, new Js5GroupResponseEncoder());
    }
}
