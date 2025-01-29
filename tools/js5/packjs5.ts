import { packJs5 } from '#/js5/pack/Js5Pack.js';

try {
    await packJs5();
} catch (err) {
    if (err instanceof Error) {
        console.log(err.message);
    }

    process.exit(1);
}
