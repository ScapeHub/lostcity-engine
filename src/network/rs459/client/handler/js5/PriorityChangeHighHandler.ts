import Js5ClientMessageHandler from '#/network/client/handler/Js5ClientMessageHandler.js';

export default class PriorityChangeHighHandler extends Js5ClientMessageHandler {
    handle() {
        return true;
    }
}
