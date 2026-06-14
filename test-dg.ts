import { DeepgramClient } from '@deepgram/sdk';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  const client = new DeepgramClient({ apiKey });
  
  const url = 'https://res.cloudinary.com/du4sc4lo3/video/upload/v1781471641/kew8w8qpeaepyjyhape9.wav';
  
  console.log('Testing nova-2 with hi...');
  try {
    const res1: any = await client.listen.v1.media.transcribeUrl(
      { url },
      { model: 'nova-2', language: 'hi', punctuate: true, utterances: true, words: true } as any
    );
    console.log('nova-2 hi:', res1.results?.channels[0]?.alternatives[0]?.transcript);
  } catch(e) { console.error('nova-2 error', e) }

  console.log('Testing whisper-large with hi...');
  try {
    const res2: any = await client.listen.v1.media.transcribeUrl(
      { url },
      { model: 'whisper-large', language: 'hi', punctuate: true, utterances: true, words: true } as any
    );
    console.log('whisper hi:', res2.results?.channels[0]?.alternatives[0]?.transcript);
  } catch(e) { console.error('whisper error', e) }
}

test();
