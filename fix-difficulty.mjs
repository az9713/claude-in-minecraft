// Reads level.dat, sets Difficulty to 0 (peaceful), writes it back
import nbt from './bot/node_modules/prismarine-nbt/nbt.js';
import { readFileSync, writeFileSync } from 'fs';
import { promisify } from 'util';
import { gunzipSync, gzipSync } from 'zlib';

const file = './server/world/level.dat';
const raw = readFileSync(file);
const decompressed = gunzipSync(raw);

const parseNbt = promisify(nbt.parse);
const data = await parseNbt(decompressed);

const current = data.value.Data.value.Difficulty?.value;
console.log('Current difficulty:', current, '(0=peaceful 1=easy 2=normal 3=hard)');

data.value.Data.value.Difficulty = { type: 'byte', value: 0 };
data.value.Data.value.DifficultyLocked = { type: 'byte', value: 1 };
console.log('Set to 0 (peaceful) and locked.');

const written = nbt.writeUncompressed(data);
const recompressed = gzipSync(Buffer.from(written));
writeFileSync(file, recompressed);
console.log('level.dat saved.');
