import Js5MessageEncoder from '#/network/server/codec/Js5MessageEncoder.js';
import Packet from '#/io/Packet.js';
import Js5GroupResponse from '#/network/server/model/js5/Js5GroupResponse.js';

export default class Js5GroupResponseEncoder extends Js5MessageEncoder {
    opcode = -1;
    size = -2;

    write(buf: Packet, message: Js5GroupResponse): void {
        if (message.xor != 0) {
            for (let i = 0; i < message.data.length; i++) {
                message.data[i] ^= message.xor;
            }
        }

        buf.p1(message.archive);
        buf.p2(message.group);

        if (message.archive === 255 && message.group === 255) {
            buf.p1(0);
            buf.p4(message.data.length);

            let offset = 10;
            for (let i = 0; i < message.data.length; i++) {
                if (offset == 512) {
                    buf.p1(0xff);
                    offset = 1;
                }

                buf.p1(message.data[i]);
                offset++;
            }
        } else {
            const compression = message.data[0];
            const length = message.data[1] << 24 | message.data[2] << 16 | message.data[3] << 8 | message.data[4];
            const realLength = compression != 0 ? length + 4 : length;

            buf.p1(compression);
            buf.p4(length);

            for (let i = 5; i < realLength + 5; i++) {
                if ((buf.pos % 512) == 0) {
                    buf.p1(0xFF);
                }

                buf.p1(message.data[i]);
            }
        }
    }
}
