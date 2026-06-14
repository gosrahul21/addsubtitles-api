import { DeepgramClient } from '@deepgram/sdk';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

async function test() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  const client = new DeepgramClient({ apiKey });
  
  // Download the file from Cloudinary first
  const url = 'https://res.cloudinary.com/du4sc4lo3/video/upload/v1781471641/kew8w8qpeaepyjyhape9.wav';
  console.log('Downloading audio...');
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync('temp.wav', Buffer.from(buffer));
  
  const audioBuffer = fs.readFileSync('temp.wav');
  
  console.log('Testing temp.wav with nova-2 and hi via transcribeFile...');
  try {
    const res1: any = await client.listen.v1.media.transcribeFile(
      audioBuffer,
      { model: 'nova-2', language: 'hi', smart_format: true, punctuate: true, utterances: true, words: true } as any
    );
    console.log('File transcript:', res1.result?.results?.channels[0]?.alternatives[0]?.transcript || res1.results?.channels[0]?.alternatives[0]?.transcript);
  } catch(e) { console.error('file error', e) }

  console.log('Testing temp.wav with nova-2 and hi via transcribeUrl...');
  try {
    const res2: any = await client.listen.v1.media.transcribeUrl(
      { url },
      { model: 'nova-2', language: 'hi', smart_format: true, punctuate: true, utterances: true, words: true } as any
    );
    console.log('URL transcript:', res2.result?.results?.channels[0]?.alternatives[0]?.transcript || res2.results?.channels[0]?.alternatives[0]?.transcript);
  } catch(e) { console.error('url error', e) }
}

test();
