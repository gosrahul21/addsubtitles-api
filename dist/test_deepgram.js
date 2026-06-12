"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@deepgram/sdk");
async function test() {
    const apiKey = process.env.DEEPGRAM_API_KEY || 'test';
    const client = new sdk_1.DeepgramClient({ apiKey });
    console.log("Deepgram version loaded.");
}
test();
//# sourceMappingURL=test_deepgram.js.map