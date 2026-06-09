import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { CACHE_KEYS } from '../common/constants/cache.constants';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as https from 'https';
import * as http from 'http';
import * as ffmpeg from 'fluent-ffmpeg';
import { DeepgramService, WordEntry } from '../deepgram/deepgram.service';
import { languageMap } from 'src/common/constants/language.config';

@Injectable()
@Processor('audio-processing')
export class ProcessingProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private redisService: RedisService,
    private deepgramService: DeepgramService,
  ) {
    super();
  }

  // Orchestrator method triggered by BullMQ
  async process(job: Job<any, any, string>): Promise<any> {
    const { projectId, videoUrl } = job.data;
    const workDir = path.join(os.tmpdir(), `addsubtitles-work-${projectId}`);
    
    try {
      console.log(`[Job ${job.id}] Starting audio transcription pipeline for project: ${projectId}`);
      console.log(`[Job ${job.id}] videoUrl: ${videoUrl}`);
      console.log(`[Job ${job.id}] workDir: ${workDir}`);
      
      const project = await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'PROCESSING' },
      });
      await this.redisService.del(CACHE_KEYS.PROJECT_DETAILS(projectId));

      if (!fs.existsSync(workDir)) {
        fs.mkdirSync(workDir, { recursive: true });
        console.log(`[Job ${job.id}] Created workDir: ${workDir}`);
      }

      // Step 1: Resolve input — either copy local file or download remote URL
      const ext = path.extname(videoUrl.split('?')[0]).toLowerCase() || '.mp4';
      const localVideoPath = path.join(workDir, `source_video${ext}`);
      if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
        console.log(`[Job ${job.id}] Downloading remote file from URL...`);
        await this.downloadFile(videoUrl, localVideoPath);
      } else {
        if (!fs.existsSync(videoUrl)) {
          throw new Error(`Source file not found at path: ${videoUrl}`);
        }
        fs.copyFileSync(videoUrl, localVideoPath);
        // Delete the original upload immediately after copying — prevents disk accumulation
        // try { fs.unlinkSync(videoUrl); } catch {}
        console.log(`[Job ${job.id}] Copied local file to workDir and deleted original upload`);
      }

      // Step 2: Determine if ffmpeg extraction is needed
      // Audio-only files (wav, mp3, aac, ogg, flac, m4a) can be sent directly to Deepgram.
      // Video files (mp4, mov, webm, mkv, avi) need audio extracted first.
      const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.aac', '.ogg', '.flac', '.m4a', '.opus'];
      const isAudioFile = AUDIO_EXTENSIONS.includes(ext);

      let audioBuffer: Buffer;
      if (isAudioFile) {
        console.log(`[Job ${job.id}] File is audio (${ext}), sending directly to Deepgram — skipping ffmpeg`);
        audioBuffer = fs.readFileSync(localVideoPath);
      } else {
        // Video file — extract audio via ffmpeg
        const rawAudioPath = path.join(workDir, 'extracted_full.wav');
        console.log(`[Job ${job.id}] Video file (${ext}), checking audio streams...`);
        const hasAudio = await this.hasAudioStream(localVideoPath);
        if (!hasAudio) {
          throw new Error('The uploaded video file has no audio stream. Please upload a video with audio.');
        }
        console.log(`[Job ${job.id}] Extracting audio: ${localVideoPath} -> ${rawAudioPath}`);
        await this.extractAudioChannel(localVideoPath, rawAudioPath);
        const totalDuration = await this.getAudioDuration(rawAudioPath);
        console.log(`[Job ${job.id}] Audio extracted successfully: ${totalDuration}s long.`);
        audioBuffer = fs.readFileSync(rawAudioPath);
      }

      // Step 3: Transcribe using Deepgram
      const words = await this.deepgramService.transcribeAudio(audioBuffer, languageMap[project.language] || 'en');

      // Step 3: Save subtitles to Database
      await this.saveSubtitlesToDb(projectId, words);

      // Step 4: Update database project status
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'COMPLETED' },
      });
      await this.redisService.del(CACHE_KEYS.PROJECT_DETAILS(projectId));

      console.log(`[Job ${job.id}] Pipeline finished successfully for Project: ${projectId}`);
    } catch (err) {
      console.error(`[Job ${job.id}] Pipeline failed:`, err);
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'FAILED' },
      });
      throw err;
    } finally {
      // Cleanup temporary files
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    }
  }

  // 0. Download remote file to local path
  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https://') ? https : http;
      const file = fs.createWriteStream(destPath);
      protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download file: HTTP ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
        file.on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
      }).on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
    });
  }

  // 1. FFmpeg extract audio utility (mono 16kHz WAV format)
  private extractAudioChannel(videoPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let stderrOutput = '';
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('pcm_s16le')
        .audioChannels(1)
        .audioFrequency(16000)
        .format('wav')
        .on('stderr', (line: string) => { stderrOutput += line + '\n'; })
        .on('end', () => resolve())
        .on('error', (err: Error) => {
          console.error('[FFmpeg stderr]:', stderrOutput);
          reject(new Error(`${err.message}\nFFmpeg stderr: ${stderrOutput}`));
        })
        .save(outputPath);
    });
  }

  // Helper: check if video has an audio stream
  private hasAudioStream(videoPath: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) return reject(err);
        const hasAudio = metadata.streams.some(s => s.codec_type === 'audio');
        console.log(`[hasAudioStream] streams: ${JSON.stringify(metadata.streams.map(s => ({ type: s.codec_type, codec: s.codec_name })))}`);
        resolve(hasAudio);
      });
    });
  }

  // 2. FFmpeg duration reader
  private getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) return reject(err);
        resolve(metadata.format.duration || 0);
      });
    });
  }

  // 3. Save Flat Word List into Subtitles blocks in PostgreSQL
  private async saveSubtitlesToDb(projectId: string, words: WordEntry[]) {
    if (words.length === 0) return;

    // Use DeepgramService to logically group words based on natural pauses
    const groupedBlocks = this.deepgramService.groupIntoBlocks(words);
    
    const dbBlocks = groupedBlocks.map(b => {
      const blockDuration = b.end - b.start;
      const totalChars = Math.max(1, b.words.reduce((acc, w) => acc + w.word.length, 0));
      let currentStart = b.start;
      
      const proportionalWords = b.words.map(w => {
        const wordDur = (w.word.length / totalChars) * blockDuration;
        const wordEnd = currentStart + wordDur;
        const result = {
          ...w,
          start: Number(currentStart.toFixed(3)),
          end: Number(wordEnd.toFixed(3))
        };
        currentStart = wordEnd;
        return result;
      });

      return {
        start: b.start,
        end: b.end,
        text: b.words.map(w => w.word).join(' '),
        words: proportionalWords,
        speaker: b.words[0]?.speaker || 'A',
      };
    });

    // Insert as Prisma transaction
    await this.prisma.$transaction(
      dbBlocks.map((b) =>
        this.prisma.subtitle.create({
          data: {
            projectId,
            language: 'en',
            timestampStart: b.start,
            timestampEnd: b.end,
            text: b.text,
            wordsJson: b.words as any,
            speaker: b.speaker || 'A',
          },
        })
      )
    );
  }
}
