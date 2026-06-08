import { Injectable, Logger } from '@nestjs/common';
import { DeepgramClient } from '@deepgram/sdk';
import * as path from 'path';
import * as fs from 'fs';
import * as ffmpeg from 'fluent-ffmpeg';

export interface WordEntry {
  word: string;
  start: number;
  end: number;
  speaker?: string;
}

export interface SubtitleBlock {
  start: number;
  end: number;
  words: WordEntry[];
}

@Injectable()
export class DeepgramService {
  private readonly logger = new Logger(DeepgramService.name);
  private readonly DG_MODEL = 'nova-3';
  private readonly MAX_WORDS_PER_LINE = 8;
  private readonly MAX_BLOCK_DURATION = 5;

  constructor() {}

  async transcribeAudio(audioBuffer: Buffer, language: string = 'en'): Promise<WordEntry[]> {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY is not set in environment');
    }

    const client = new DeepgramClient({ apiKey });

    this.logger.log(`Calling Deepgram API (model: ${this.DG_MODEL}, lang: ${language})...`);
    
    const response: any = await client.listen.v1.media.transcribeFile(
      audioBuffer,
      {
        model: this.DG_MODEL,
        language,
        smart_format: true,
        punctuate: true,
        utterances: true,
        words: true,
      } as any
    );

    const words: WordEntry[] =
      response?.results?.channels?.[0]?.alternatives?.[0]?.words?.map((w: any) => ({
        word: w.punctuated_word ?? w.word,
        start: w.start,
        end: w.end,
        speaker: 'A' // Default speaker since Deepgram speaker diarization might be separate config
      })) ?? [];

    this.logger.log(`Deepgram returned ${words.length} words`);
    return words;
  }

  groupIntoBlocks(words: WordEntry[]): SubtitleBlock[] {
    const blocks: SubtitleBlock[] = [];
    if (words.length === 0) return blocks;

    let current: WordEntry[] = [words[0]];

    for (let i = 1; i < words.length; i++) {
      const prev = words[i - 1];
      const curr = words[i];

      const gapSec = curr.start - prev.end;
      const blockDur = prev.end - current[0].start;
      const tooManyWords = current.length >= this.MAX_WORDS_PER_LINE;
      const tooLong = blockDur >= this.MAX_BLOCK_DURATION;
      const naturalPause = gapSec > 0.5;

      if (naturalPause || tooManyWords || tooLong) {
        blocks.push({
          start: current[0].start,
          end: current[current.length - 1].end,
          words: current,
        });
        current = [curr];
      } else {
        current.push(curr);
      }
    }

    if (current.length > 0) {
      blocks.push({
        start: current[0].start,
        end: current[current.length - 1].end,
        words: current,
      });
    }

    return blocks;
  }

  // ASS helpers
  private cssToAss(hex: string, alpha = 0): string {
    const h = hex.replace('#', '');
    const r = h.slice(0, 2);
    const g = h.slice(2, 4);
    const b = h.slice(4, 6);
    const aa = Math.round(alpha * 255).toString(16).padStart(2, '0').toUpperCase();
    return `&H${aa}${b}${g}${r}`.toUpperCase();
  }

  private toAss(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const cs = Math.round((sec % 1) * 100);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  private toCentiseconds(sec: number): number {
    return Math.max(1, Math.round(sec * 100));
  }

  buildAssKaraoke(blocks: SubtitleBlock[], fontName: string = 'Noto Sans Devanagari'): string {
    const primaryInactive = this.cssToAss('#FFD700');        // gold  — not-yet-spoken
    const primaryActive = this.cssToAss('#FFFFFF');          // white — currently spoken (secondary colour in ASS)
    const outlineColor = this.cssToAss('#000000');           // black outline
    const backColor = this.cssToAss('#000000', 0.75);        // dark shadow

    const scriptInfo = [
      '[Script Info]',
      'ScriptType: v4.00+',
      'PlayResX: 1080',
      'PlayResY: 1080',
      'ScaledBorderAndShadow: yes',
      '',
    ].join('\n');

    const styles = [
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      `Style: Default,${fontName},55,${primaryInactive},${primaryActive},${outlineColor},${backColor},-1,0,0,0,100,100,0,0,1,3,3,2,30,30,80,1`,
      '',
    ].join('\n');

    const eventHeader = [
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ];

    const dialogueLines: string[] = [];

    for (const block of blocks) {
      let assText = '';
      let cursor = block.start;

      for (let wi = 0; wi < block.words.length; wi++) {
        const w = block.words[wi];
        const isLast = wi === block.words.length - 1;

        if (w.start > cursor + 0.01) {
          const gapCs = this.toCentiseconds(w.start - cursor);
          assText += `{\\kf${gapCs}} `;
        }

        const wordDurationCs = this.toCentiseconds(w.end - w.start);
        assText += `{\\kf${wordDurationCs}}${w.word}`;

        if (!isLast) assText += ' ';
        cursor = w.end;
      }

      dialogueLines.push(
        `Dialogue: 0,${this.toAss(block.start)},${this.toAss(block.end)},Default,,0,0,0,,${assText}`
      );
    }

    return [scriptInfo, styles, eventHeader.join('\n'), ...dialogueLines, ''].join('\n');
  }

  async burnSubtitles(inputVideoPath: string, assPath: string, outputVideoPath: string, fontsDir?: string): Promise<void> {
    // Basic ASS burn-in
    const escapedAssPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    let assFilter = `ass='${escapedAssPath}'`;

    if (fontsDir) {
      const escapedFontsDir = fontsDir.replace(/\\/g, '/').replace(/:/g, '\\:');
      assFilter += `:fontsdir='${escapedFontsDir}'`;
    }

    return new Promise((resolve, reject) => {
      ffmpeg(inputVideoPath)
        .videoFilters(assFilter)
        .outputOptions([
          '-c:v libx264',
          '-preset fast',
          '-crf 18',
          '-c:a copy',
          '-movflags +faststart',
        ])
        .on('start', (cmd) => this.logger.log(`Running FFmpeg: ${cmd}`))
        .on('error', (err, stdout, stderr) => {
          this.logger.error(`FFmpeg error: ${err.message}`, stderr);
          reject(err);
        })
        .on('end', () => {
          this.logger.log(`Successfully burned subtitles into ${outputVideoPath}`);
          resolve();
        })
        .save(outputVideoPath);
    });
  }
}
