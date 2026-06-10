import { DeepgramClient } from '@deepgram/sdk';
import * as fs from 'fs';

async function test() {
  const apiKey = process.env.DEEPGRAM_API_KEY || 'test'; // Ensure it runs or fails with auth error
  const client = new DeepgramClient({ apiKey });
  
  // We don't have a real DG key here easily accessible maybe? Wait, backend has .env
  console.log("Deepgram version loaded.");
}
test();
