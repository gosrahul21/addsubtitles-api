import { Injectable, Logger } from '@nestjs/common';
import Groq, { toFile } from 'groq-sdk';
import { WordEntry } from '../deepgram/deepgram.service';

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private groq: Groq | null = null;
  // Multilingual model available on Groq
  private readonly TRANSLATE_MODEL = 'qwen/qwen3.8-27b';
  private readonly STT_MODEL = 'whisper-large-v3-turbo';

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey && apiKey.trim() !== '') {
      this.groq = new Groq({ apiKey: apiKey.trim() });
      this.logger.log('Groq SDK initialized successfully');
    } else {
      this.logger.warn('GROQ_API_KEY is not configured in environment. Groq requests will fallback to Deepgram.');
    }
  }

  isAvailable(): boolean {
    return !!this.groq;
  }

  /**
   * Transcribe an audio buffer using Groq Whisper Large v3 Turbo
   * Returns WordEntry array with word-level timestamps
   */
  async transcribeAudio(audioBuffer: Buffer, language?: string): Promise<WordEntry[]> {
    if (!this.groq) {
      throw new Error('Groq client is not initialized (GROQ_API_KEY missing)');
    }

    this.logger.log(`Calling Groq Whisper API (${this.STT_MODEL}, lang: ${language || 'auto'})...`);

    const file = await toFile(audioBuffer, 'audio.wav', { type: 'audio/wav' });

    const options: any = {
      file,
      model: this.STT_MODEL,
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    };

    if (language && language !== 'multi' && language !== 'auto') {
      // Groq Whisper expects ISO-639-1 two-letter code (e.g., 'en', 'es', 'fr', 'hi')
      options.language = language.split('-')[0].toLowerCase();
    }

    const response: any = await this.groq.audio.transcriptions.create(options);

    const words: WordEntry[] = (response?.words || [])
      .map((w: any) => ({
        word: (w.word || '').trim(),
        start: Number(w.start),
        end: Number(w.end),
        speaker: 'A',
      }))
      .filter((w: any) => w.word && w.word.length > 0);

    this.logger.log(`Groq Whisper returned ${words.length} words`);
    return words;
  }

  /**
   * Downloads audio from a URL and passes it to Groq Whisper
   */
  async transcribeUrl(url: string, language?: string): Promise<WordEntry[]> {
    this.logger.log(`Fetching audio from URL for Groq Whisper: ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download audio from URL (${res.status}): ${res.statusText}`);
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    // Groq audio endpoint max file size is 25MB
    const maxBytes = 25 * 1024 * 1024;
    if (buffer.byteLength > maxBytes) {
      throw new Error(
        `Audio file size (${(buffer.byteLength / (1024 * 1024)).toFixed(2)}MB) exceeds Groq 25MB limit. Falling back to Deepgram.`
      );
    }

    return this.transcribeAudio(buffer, language);
  }

  /**
   * Translates subtitle segments into the target language using Groq's multilingual model
   * Retains timing information and creates word-level timestamps
   */
  async translateSubtitles(segments: any[], targetLanguage: string): Promise<any[]> {
    if (!this.groq) {
      throw new Error('Groq client is not initialized (GROQ_API_KEY missing)');
    }

    if (!segments || segments.length === 0) {
      return [];
    }

    this.logger.log(
      `Translating ${segments.length} subtitle segments into "${targetLanguage}" using Groq (${this.TRANSLATE_MODEL})...`
    );

    const inputData = segments.map((s, idx) => ({
      id: s.id !== undefined ? s.id : idx,
      start: Number(s.start ?? s.timestampStart ?? 0),
      end: Number(s.end ?? s.timestampEnd ?? 0),
      text: s.text ?? s.label ?? '',
    }));

    const systemPrompt = `You are an expert multilingual subtitle translator for video content.
You will receive an array of subtitle segments. Translate each segment's "text" accurately and naturally into "${targetLanguage}".
CRITICAL GUIDELINES:
1. Preserve the meaning, punchiness, and emotional tone of the original speech.
2. Keep translations concise so they fit the duration between start and end.
3. Return ONLY a valid JSON object with the property "translations": an array of objects matching:
   {
     "translations": [
       { "id": <same id>, "translatedText": "<translated text in ${targetLanguage}>" }
     ]
   }
4. DO NOT change the IDs or order.`;

    const completion = await this.groq.chat.completions.create({
      model: this.TRANSLATE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(inputData) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    let translations: Array<{ id: any; translatedText: string }> = [];

    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        translations = parsed;
      } else if (Array.isArray(parsed.translations)) {
        translations = parsed.translations;
      } else if (Array.isArray(parsed.segments)) {
        translations = parsed.segments;
      } else {
        const foundArray = Object.values(parsed).find((val) => Array.isArray(val));
        translations = (foundArray as any) || [];
      }
    } catch (parseErr: any) {
      this.logger.error(`Failed to parse Groq translation output: ${parseErr.message}`);
      throw new Error('Failed to parse translated subtitles from Groq');
    }

    // Merge translated text and compute word timings linearly for karaoke sync
    return segments.map((seg, idx) => {
      const segId = seg.id !== undefined ? seg.id : idx;
      const match = translations.find((t) => t.id === segId || t.id === idx) || translations[idx];
      const translatedText = match?.translatedText || match?.['text'] || seg.text || seg.label;

      const start = Number(seg.start ?? seg.timestampStart ?? 0);
      const end = Number(seg.end ?? seg.timestampEnd ?? start + 1);
      const duration = Math.max(0.2, end - start);

      const splitWords = (translatedText || '').trim().split(/\s+/).filter(Boolean);
      const wordDuration = duration / Math.max(1, splitWords.length);

      const translatedWords: WordEntry[] = splitWords.map((word, wIdx) => ({
        word,
        start: Number((start + wIdx * wordDuration).toFixed(2)),
        end: Number((start + (wIdx + 1) * wordDuration).toFixed(2)),
        speaker: seg.speaker || 'A',
      }));

      return {
        ...seg,
        text: translatedText,
        label: translatedText,
        words: translatedWords,
        wordsJson: translatedWords,
      };
    });
  }
}
