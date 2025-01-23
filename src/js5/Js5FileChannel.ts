import RandomAccessFile from '#/util/RandomAccessFile.js';
import { copyBytes } from '#/util/ArrayCopy.js';

export default class Js5FileChannel {
    public file: RandomAccessFile;
    public readPointer: number = 0;
    public writeIndex: number = 0;
    public readPayload: Uint8Array;
    public readPayloadLength: number = 0;
    public writePayload: Uint8Array;
    public writePointer: number = -1;
    public writePayloadLength: number = 0;
    public aLong1596: number = -1;
    public accessFilePointer: number = 0;
    public size: number = 0;

    constructor(file: RandomAccessFile, bufferSize: number) {
        this.file = file;
        this.size = file.length;
        this.writeIndex = file.length;
        this.writePayload = new Uint8Array(0);
        this.readPayload = new Uint8Array(bufferSize);
        this.readPointer = 0;
    }

    public seek(pointer: number): void {
        if (pointer < 0) {
            return;
        }

        this.readPointer = pointer;
    }

    public close(): void {
        this.save();
        this.file.close();
    }

    public readRemaining(): void {
        this.readPayloadLength = 0;

        if (this.readPointer != this.accessFilePointer) {
            this.file.seek(this.readPointer);
            this.accessFilePointer = this.readPointer;
        }

        this.aLong1596 = this.readPointer;

        let read = 0;
        for (; this.readPayloadLength < this.readPayload.length; this.readPayloadLength += read) {
            read = this.file.read(this.readPayload, this.readPayload.length - this.readPayloadLength, this.readPayloadLength);
            if (read == 0) {
                break;
            }

            this.accessFilePointer += read;
        }
    }

    write(b: Uint8Array, offset: number, length: number): void {
        try {
            if (this.size < length + this.readPointer) {
                this.size = length + this.readPointer;
            }

            if (this.writePointer != -1 && (this.readPointer < this.writePointer || this.writePointer + this.writePayloadLength < this.readPointer)) {
                this.save();
            }

            if (this.writePointer != -1 && this.writePointer + this.writePayload.length < length + this.readPointer) {
                const i = (this.writePointer - (this.readPointer - this.writePayload.length));
                length -= i;
                copyBytes(b, offset, this.writePayload, this.readPointer - this.writePointer, i);
                this.readPointer += i;
                this.writePayloadLength = this.writePayload.length;
                offset += i;
                this.save();
            }

            if (length > this.writePayload.length) {
                if (this.accessFilePointer != this.readPointer) {
                    this.file.seek(this.readPointer);
                    this.accessFilePointer = this.readPointer;
                }

                this.file.write(b, offset, length);
                this.accessFilePointer += length;
                if (this.accessFilePointer > this.writeIndex) {
                    this.writeIndex = this.accessFilePointer;
                }

                let l = -1;
                let l_0_ = -1;
                if (this.readPointer >= this.aLong1596 && this.readPointer < this.readPayloadLength + this.aLong1596) {
                    l_0_ = this.readPointer;
                }
                else if (this.readPointer <= this.aLong1596 && this.aLong1596 < this.readPointer + length) {
                    l = this.aLong1596;
                }

                if (this.aLong1596 < this.readPointer + length && this.aLong1596 + this.readPayloadLength >= length + this.readPointer) {
                    l = length + this.readPointer;
                }
                else if (this.aLong1596 + this.readPayloadLength > this.readPointer && length + this.readPointer > this.readPayloadLength + this.aLong1596) {
                    l = this.readPayloadLength + this.aLong1596;
                }

                if (l_0_ > -1 && l_0_ < l) {
                    const i = l - l_0_;
                    copyBytes(b, offset + l_0_ - this.readPointer, this.readPayload, l_0_ - this.aLong1596, i);
                }

                this.readPointer += length;
            }
            else if (length > 0) {
                if (this.writePointer == -1) {
                    this.writePointer = this.readPointer;
                }

                copyBytes(b, offset, this.writePayload, this.readPointer - this.writePointer, length);
                this.readPointer += length;
                if (this.writePayloadLength < this.readPointer - this.writePointer) {
                    this.writePayloadLength = this.readPointer - this.writePointer;
                }
            }
        }
        catch (err) {
            this.accessFilePointer = -1;
            console.error(err);
            throw err;
        }
    }

    public read(b: Uint8Array, offset: number, length: number): void {
        try {
            if (offset + length > b.length) {
                throw new Error('Offset + length exceeds buffer length');
            }

            if (this.writePointer != -1 && this.writePointer <= this.readPointer && length + this.readPointer <= this.writePayloadLength + this.writePointer) {
                copyBytes(this.writePayload, this.readPointer - this.writePointer, b, offset, length);
                this.readPointer += length;
                return;
            }

            const i = length;
            const l = this.readPointer;
            const i_2_ = offset;
            if (this.readPointer >= this.aLong1596 && this.readPayloadLength + this.aLong1596 > this.readPointer) {
                let i_3_ = this.readPayloadLength - this.readPointer + this.aLong1596;
                if (i_3_ > length) {
                    i_3_ = length;
                }

                copyBytes(this.readPayload, -this.aLong1596 + this.readPointer, b, offset, i_3_);
                offset += i_3_;
                this.readPointer += i_3_;
                length -= i_3_;
            }

            if (length <= this.readPayload.length) {
                if (length > 0) {
                    let i_4_ = length;
                    this.readRemaining();
                    if (i_4_ > this.readPayloadLength) {
                        i_4_ = this.readPayloadLength;
                    }

                    copyBytes(this.readPayload, 0, b, offset, i_4_);
                    this.readPointer += i_4_;
                    offset += i_4_;
                    length -= i_4_;
                }
            }
            else {
                this.file.seek(this.readPointer);
                this.accessFilePointer = this.readPointer;
                let i_5_ = 0;
                for (; length > 0; length -= i_5_) {
                    i_5_ = this.file.read(b, offset, length);
                    if (i_5_ == -1) {
                        break;
                    }

                    this.readPointer += i_5_;
                    this.accessFilePointer += i_5_;
                    offset += i_5_;
                }
            }

            if (this.writePointer != -1) {
                if (this.writePointer > this.readPointer && length > 0) {
                    let i_6_= (-this.readPointer + this.writePointer) + offset;
                    if (i_6_ > offset + length) {
                        i_6_ = offset + length;
                    }

                    while (offset < i_6_) {
                        length--;
                        b[offset++] = 0;
                        this.readPointer++;
                    }
                }

                let l_7_ = -1;
                if (l < this.writePointer + this.writePayloadLength && this.writePointer + this.writePayloadLength <= i + l) {
                    l_7_ = this.writePayloadLength + this.writePointer;
                }
                else if (l + i > this.writePointer && l + i <= this.writePayloadLength + this.writePointer) {
                    l_7_ = i + l;
                }

                let l_8_ = -1;
                if (this.writePointer < l || this.writePointer >= i + l) {
                    if (this.writePointer <= l && l < this.writePointer + this.writePayloadLength) {
                        l_8_ = l;
                    }
                }
                else {
                    l_8_ = this.writePointer;
                }

                if (l_8_ > -1 && l_7_ > l_8_) {
                    const i_9_ = -l_8_ + l_7_;
                    copyBytes(this.writePayload, l_8_ - this.writePointer, b, (-l + l_8_) + i_2_, i_9_);

                    if (this.readPointer < l_7_) {
                        length -= l_7_ - this.readPointer;
                        this.readPointer = l_7_;
                    }
                }
            }
        }
        catch (err) {
            this.accessFilePointer = -1;
            console.error(err);
            throw err;
        }

        if (length > 0) {
            throw new Error('EOF not reached');
        }
    }

    public save(): void {
        if (this.writePointer == -1) {
            return;
        }

        if (this.writePointer != this.accessFilePointer) {
            this.file.seek(this.writePointer);
            this.accessFilePointer = this.writePointer;
        }

        this.file.write(this.writePayload, 0, this.writePayloadLength);
        this.accessFilePointer += this.writePayloadLength;

        if (this.accessFilePointer >= this.writeIndex) {
            this.writeIndex = this.accessFilePointer;
        }

        let l: number = -1;
        if (this.aLong1596 > this.writePointer || this.aLong1596 + this.readPayloadLength <= this.writePointer) {
            if (this.writePointer <= this.aLong1596 && this.writePointer + this.writePayloadLength > this.aLong1596) {
                l = this.aLong1596;
            }
        }
        else {
            l = this.writePointer;
        }

        let l_10_: number = -1;
        if (this.writePayloadLength + this.writePointer <= this.aLong1596 || this.readPayloadLength + this.aLong1596 < this.writePointer + this.writePayloadLength) {
            if (this.writePointer < this.readPayloadLength + this.aLong1596 && this.aLong1596 + this.readPayloadLength <= this.writePayloadLength + this.writePointer) {
                l_10_ = this.readPayloadLength + this.aLong1596;
            }
        }
        else {
            l_10_ = this.writePointer + this.writePayloadLength;
        }

        if (l > -1 && l < l_10_) {
            const i = -l + l_10_;
            copyBytes(this.writePayload, l - this.writePointer, this.readPayload, l - this.aLong1596, i);
        }

        this.writePayloadLength = 0;
        this.writePointer = -1;
    }
}