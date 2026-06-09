import { Controller, Post, Put, Get, Body, Param, Req, UseGuards, BadRequestException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateSettingsDto } from './dto/project.dto';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ProcessingService } from '../processing/processing.service';

@Controller('projects')
export class ProjectsController {
  constructor(
    private projectsService: ProjectsService,
    private jwtService: JwtService,
    private processingService: ProcessingService
  ) {}

  // Parse JWT optionally from cookie if present, allowing guest sessions
  private getUserIdOrNull(req: Request): string | null {
    const token = req.cookies?.['access_token'];
    if (!token) return null;
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'access-secret-key-123',
      });
      return payload.sub;
    } catch {
      return null;
    }
  }

  private getAuthenticatedUserOrNull(req: Request) {
    const token = req.cookies?.['access_token'];
    if (!token) return null;
    try {
      return this.jwtService.verify(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'access-secret-key-123',
      });
    } catch {
      return null;
    }
  }

  @Post()
  async createProject(
    @Body() dto: CreateProjectDto,
    @Req() req: Request
  ) {
    const userId = this.getUserIdOrNull(req);
    if (!userId && !dto.sessionId) {
      throw new BadRequestException('Either authentication or guest sessionId is required');
    }
    return this.projectsService.createProject(dto, userId);
  }

  @Post(':id/upload')
  @UseInterceptors(
    FileInterceptor('audioFile', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(process.cwd(), 'uploads');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `audio-${uniqueSuffix}${path.extname(file.originalname || '.wav')}`);
        },
      }),
    }),
  )
  async uploadVideo(
    @Param('id') id: string,
    @Req() req: Request,
    @UploadedFile() file?: any,
    @Body('videoUrl') videoUrl?: string,
  ) {
    let result;
    if (file) {
      // If a file was uploaded, we save its absolute path as the 'videoUrl'
      const absolutePath = path.resolve(file.path);
      result = await this.projectsService.saveUploadedVideo(id, absolutePath);
    } else if (videoUrl) {
      result = await this.projectsService.saveUploadedVideo(id, videoUrl);
    } else {
      throw new BadRequestException('Either an audioFile or videoUrl is required');
    }

    if(result){
      const tokenUser = this.getAuthenticatedUserOrNull(req);
      await this.processingService.triggerProcessing(id, tokenUser);
      return result;
    }
  }

  @Put(':id/settings')
  async updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateSettingsDto
  ) {
    return this.projectsService.updateSettings(id, dto);
  }

  @Get(':id')
  async getProjectDetails(@Param('id') id: string) {
    return {
    "id": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
    "userId": null,
    "sessionId": "guest-session",
    "status": "COMPLETED",
    "language": "Hindi",
    "videoUrl": "/Users/rahulgoswami/projects/video_editing_tools_poc/Audoaisubtitles-backend/uploads/audio-1780973613793-448567335.wav",
    "settingsJson": {},
    "createdAt": "2026-06-09T02:53:32.713Z",
    "subtitles": [
        {
            "id": "59cf91aa-8226-48d9-aa1a-ee2a13a6d7b2",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 14.799999,
            "timestampEnd": 16.585001,
            "text": "ये छह run, अरे वो 30 out का",
            "wordsJson": [
                {
                    "end": 14.96,
                    "word": "ये",
                    "start": 14.799999,
                    "speaker": "A"
                },
                {
                    "end": 15.2,
                    "word": "छह",
                    "start": 14.96,
                    "speaker": "A"
                },
                {
                    "end": 16.08,
                    "word": "run,",
                    "start": 15.2,
                    "speaker": "A"
                },
                {
                    "end": 15.945,
                    "word": "अरे",
                    "start": 15.625,
                    "speaker": "A"
                },
                {
                    "end": 16.105,
                    "word": "वो",
                    "start": 15.945,
                    "speaker": "A"
                },
                {
                    "end": 16.265,
                    "word": "30",
                    "start": 16.105,
                    "speaker": "A"
                },
                {
                    "end": 16.425,
                    "word": "out",
                    "start": 16.265,
                    "speaker": "A"
                },
                {
                    "end": 16.585001,
                    "word": "का",
                    "start": 16.425,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "2d6ae9f4-0fb3-4739-ab8b-5f076463b03f",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 0,
            "timestampEnd": 2,
            "text": "कोई ऐसा commentator है जो आपको लगता है",
            "wordsJson": [
                {
                    "end": 0.32,
                    "word": "कोई",
                    "start": 0,
                    "speaker": "A"
                },
                {
                    "end": 0.64,
                    "word": "ऐसा",
                    "start": 0.32,
                    "speaker": "A"
                },
                {
                    "end": 1.28,
                    "word": "commentator",
                    "start": 0.64,
                    "speaker": "A"
                },
                {
                    "end": 1.36,
                    "word": "है",
                    "start": 1.28,
                    "speaker": "A"
                },
                {
                    "end": 1.52,
                    "word": "जो",
                    "start": 1.36,
                    "speaker": "A"
                },
                {
                    "end": 1.68,
                    "word": "आपको",
                    "start": 1.52,
                    "speaker": "A"
                },
                {
                    "end": 1.8399999,
                    "word": "लगता",
                    "start": 1.68,
                    "speaker": "A"
                },
                {
                    "end": 2,
                    "word": "है",
                    "start": 1.8399999,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "e260ecf5-4a64-4aac-99ec-9fa739cdf85f",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 2,
            "timestampEnd": 3.4399998,
            "text": "यार बहुत ज़्यादा ही इसको footage मिल गया",
            "wordsJson": [
                {
                    "end": 2.1599998,
                    "word": "यार",
                    "start": 2,
                    "speaker": "A"
                },
                {
                    "end": 2.3999999,
                    "word": "बहुत",
                    "start": 2.1599998,
                    "speaker": "A"
                },
                {
                    "end": 2.56,
                    "word": "ज़्यादा",
                    "start": 2.3999999,
                    "speaker": "A"
                },
                {
                    "end": 2.72,
                    "word": "ही",
                    "start": 2.56,
                    "speaker": "A"
                },
                {
                    "end": 2.8799999,
                    "word": "इसको",
                    "start": 2.72,
                    "speaker": "A"
                },
                {
                    "end": 3.12,
                    "word": "footage",
                    "start": 2.8799999,
                    "speaker": "A"
                },
                {
                    "end": 3.28,
                    "word": "मिल",
                    "start": 3.12,
                    "speaker": "A"
                },
                {
                    "end": 3.4399998,
                    "word": "गया",
                    "start": 3.28,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "463b0a46-e79d-485c-acc6-f2ac4b33058f",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 3.4399998,
            "timestampEnd": 6.64,
            "text": "है? Footage की sense में? यार, खामखा popular",
            "wordsJson": [
                {
                    "end": 3.9199998,
                    "word": "है?",
                    "start": 3.4399998,
                    "speaker": "A"
                },
                {
                    "end": 4.4,
                    "word": "Footage",
                    "start": 4,
                    "speaker": "A"
                },
                {
                    "end": 4.56,
                    "word": "की",
                    "start": 4.4,
                    "speaker": "A"
                },
                {
                    "end": 4.7999997,
                    "word": "sense",
                    "start": 4.56,
                    "speaker": "A"
                },
                {
                    "end": 5.12,
                    "word": "में?",
                    "start": 4.7999997,
                    "speaker": "A"
                },
                {
                    "end": 5.7599998,
                    "word": "यार,",
                    "start": 5.12,
                    "speaker": "A"
                },
                {
                    "end": 6.24,
                    "word": "खामखा",
                    "start": 5.7599998,
                    "speaker": "A"
                },
                {
                    "end": 6.64,
                    "word": "popular",
                    "start": 6.24,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "4929bbd6-0e04-46f0-bf7e-2446c1c44254",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 6.64,
            "timestampEnd": 8.16,
            "text": "है ये यार. बहुत सारे हैं. पता कुछ",
            "wordsJson": [
                {
                    "end": 6.7999997,
                    "word": "है",
                    "start": 6.64,
                    "speaker": "A"
                },
                {
                    "end": 6.96,
                    "word": "ये",
                    "start": 6.7999997,
                    "speaker": "A"
                },
                {
                    "end": 7.12,
                    "word": "यार.",
                    "start": 6.96,
                    "speaker": "A"
                },
                {
                    "end": 7.3599997,
                    "word": "बहुत",
                    "start": 7.12,
                    "speaker": "A"
                },
                {
                    "end": 7.6,
                    "word": "सारे",
                    "start": 7.3599997,
                    "speaker": "A"
                },
                {
                    "end": 7.7599998,
                    "word": "हैं.",
                    "start": 7.6,
                    "speaker": "A"
                },
                {
                    "end": 8,
                    "word": "पता",
                    "start": 7.7599998,
                    "speaker": "A"
                },
                {
                    "end": 8.16,
                    "word": "कुछ",
                    "start": 8,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "7ef04810-fc13-4a46-878e-52714c31d399",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 8.16,
            "timestampEnd": 10.24,
            "text": "नहीं है इसको. बहुत सारे हैं. बहुत सारे",
            "wordsJson": [
                {
                    "end": 8.32,
                    "word": "नहीं",
                    "start": 8.16,
                    "speaker": "A"
                },
                {
                    "end": 8.4,
                    "word": "है",
                    "start": 8.32,
                    "speaker": "A"
                },
                {
                    "end": 8.639999,
                    "word": "इसको.",
                    "start": 8.4,
                    "speaker": "A"
                },
                {
                    "end": 8.8,
                    "word": "बहुत",
                    "start": 8.639999,
                    "speaker": "A"
                },
                {
                    "end": 9.04,
                    "word": "सारे",
                    "start": 8.8,
                    "speaker": "A"
                },
                {
                    "end": 9.679999,
                    "word": "हैं.",
                    "start": 9.04,
                    "speaker": "A"
                },
                {
                    "end": 10,
                    "word": "बहुत",
                    "start": 9.679999,
                    "speaker": "A"
                },
                {
                    "end": 10.24,
                    "word": "सारे",
                    "start": 10,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "bf442b22-4de9-48ff-91be-991e5301c625",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 10.24,
            "timestampEnd": 12.16,
            "text": "हैं. नहीं, पता तो है पर वो ऐसे",
            "wordsJson": [
                {
                    "end": 10.4,
                    "word": "हैं.",
                    "start": 10.24,
                    "speaker": "A"
                },
                {
                    "end": 10.559999,
                    "word": "नहीं,",
                    "start": 10.4,
                    "speaker": "A"
                },
                {
                    "end": 10.8,
                    "word": "पता",
                    "start": 10.559999,
                    "speaker": "A"
                },
                {
                    "end": 11.04,
                    "word": "तो",
                    "start": 10.8,
                    "speaker": "A"
                },
                {
                    "end": 11.44,
                    "word": "है",
                    "start": 11.04,
                    "speaker": "A"
                },
                {
                    "end": 11.759999,
                    "word": "पर",
                    "start": 11.44,
                    "speaker": "A"
                },
                {
                    "end": 11.92,
                    "word": "वो",
                    "start": 11.759999,
                    "speaker": "A"
                },
                {
                    "end": 12.16,
                    "word": "ऐसे",
                    "start": 11.92,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "97dbca8d-092b-41e5-a426-5709199d1f15",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 12.16,
            "timestampEnd": 13.599999,
            "text": "बढ़ा के बोलते हैं, अभी shot मारा है,",
            "wordsJson": [
                {
                    "end": 12.4,
                    "word": "बढ़ा",
                    "start": 12.16,
                    "speaker": "A"
                },
                {
                    "end": 12.559999,
                    "word": "के",
                    "start": 12.4,
                    "speaker": "A"
                },
                {
                    "end": 12.719999,
                    "word": "बोलते",
                    "start": 12.559999,
                    "speaker": "A"
                },
                {
                    "end": 12.88,
                    "word": "हैं,",
                    "start": 12.719999,
                    "speaker": "A"
                },
                {
                    "end": 13.04,
                    "word": "अभी",
                    "start": 12.88,
                    "speaker": "A"
                },
                {
                    "end": 13.2,
                    "word": "shot",
                    "start": 13.04,
                    "speaker": "A"
                },
                {
                    "end": 13.44,
                    "word": "मारा",
                    "start": 13.2,
                    "speaker": "A"
                },
                {
                    "end": 13.599999,
                    "word": "है,",
                    "start": 13.44,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "600dd5f7-2c4b-4ddc-8e52-7446722767df",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 13.599999,
            "timestampEnd": 14.799999,
            "text": "अभी ball रास्ते में भी नहीं है और",
            "wordsJson": [
                {
                    "end": 13.759999,
                    "word": "अभी",
                    "start": 13.599999,
                    "speaker": "A"
                },
                {
                    "end": 13.92,
                    "word": "ball",
                    "start": 13.759999,
                    "speaker": "A"
                },
                {
                    "end": 14.16,
                    "word": "रास्ते",
                    "start": 13.92,
                    "speaker": "A"
                },
                {
                    "end": 14.32,
                    "word": "में",
                    "start": 14.16,
                    "speaker": "A"
                },
                {
                    "end": 14.4,
                    "word": "भी",
                    "start": 14.32,
                    "speaker": "A"
                },
                {
                    "end": 14.559999,
                    "word": "नहीं",
                    "start": 14.4,
                    "speaker": "A"
                },
                {
                    "end": 14.639999,
                    "word": "है",
                    "start": 14.559999,
                    "speaker": "A"
                },
                {
                    "end": 14.799999,
                    "word": "और",
                    "start": 14.639999,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "fa6bcf69-1617-4f08-be7c-c86dda1314a2",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 16.585001,
            "timestampEnd": 18.105,
            "text": "catch हो गया आदमी यार, रुको. छह run",
            "wordsJson": [
                {
                    "end": 16.745,
                    "word": "catch",
                    "start": 16.585001,
                    "speaker": "A"
                },
                {
                    "end": 16.905,
                    "word": "हो",
                    "start": 16.745,
                    "speaker": "A"
                },
                {
                    "end": 16.985,
                    "word": "गया",
                    "start": 16.905,
                    "speaker": "A"
                },
                {
                    "end": 17.145,
                    "word": "आदमी",
                    "start": 16.985,
                    "speaker": "A"
                },
                {
                    "end": 17.305,
                    "word": "यार,",
                    "start": 17.145,
                    "speaker": "A"
                },
                {
                    "end": 17.545,
                    "word": "रुको.",
                    "start": 17.305,
                    "speaker": "A"
                },
                {
                    "end": 17.705,
                    "word": "छह",
                    "start": 17.545,
                    "speaker": "A"
                },
                {
                    "end": 18.105,
                    "word": "run",
                    "start": 17.705,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "37448127-6f32-4183-aa6b-cd566bf5166c",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 18.105,
            "timestampEnd": 20.185,
            "text": "हो सकते थे पर catch bucket लिए. रुको",
            "wordsJson": [
                {
                    "end": 18.505001,
                    "word": "हो",
                    "start": 18.105,
                    "speaker": "A"
                },
                {
                    "end": 18.745,
                    "word": "सकते",
                    "start": 18.505001,
                    "speaker": "A"
                },
                {
                    "end": 19.065,
                    "word": "थे",
                    "start": 18.745,
                    "speaker": "A"
                },
                {
                    "end": 19.385,
                    "word": "पर",
                    "start": 19.065,
                    "speaker": "A"
                },
                {
                    "end": 19.625,
                    "word": "catch",
                    "start": 19.385,
                    "speaker": "A"
                },
                {
                    "end": 19.785,
                    "word": "bucket",
                    "start": 19.625,
                    "speaker": "A"
                },
                {
                    "end": 19.945,
                    "word": "लिए.",
                    "start": 19.785,
                    "speaker": "A"
                },
                {
                    "end": 20.185,
                    "word": "रुको",
                    "start": 19.945,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "4ca60cf2-3f9e-424d-82db-8810f2ea7bd4",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 20.185,
            "timestampEnd": 22.425,
            "text": "ना थोड़ा, सांस लो beach में. कौन ऐसे?",
            "wordsJson": [
                {
                    "end": 20.425,
                    "word": "ना",
                    "start": 20.185,
                    "speaker": "A"
                },
                {
                    "end": 20.744999,
                    "word": "थोड़ा,",
                    "start": 20.425,
                    "speaker": "A"
                },
                {
                    "end": 20.905,
                    "word": "सांस",
                    "start": 20.744999,
                    "speaker": "A"
                },
                {
                    "end": 21.065,
                    "word": "लो",
                    "start": 20.905,
                    "speaker": "A"
                },
                {
                    "end": 21.305,
                    "word": "beach",
                    "start": 21.065,
                    "speaker": "A"
                },
                {
                    "end": 21.785,
                    "word": "में.",
                    "start": 21.305,
                    "speaker": "A"
                },
                {
                    "end": 22.105,
                    "word": "कौन",
                    "start": 21.785,
                    "speaker": "A"
                },
                {
                    "end": 22.425,
                    "word": "ऐसे?",
                    "start": 22.105,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "3f87e59b-add8-4bbb-9b50-707004a8c1a1",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 22.425,
            "timestampEnd": 23.945,
            "text": "एक दो नाम बताएं? बिल्कुल नहीं लूंगा. आप",
            "wordsJson": [
                {
                    "end": 22.585,
                    "word": "एक",
                    "start": 22.425,
                    "speaker": "A"
                },
                {
                    "end": 22.665,
                    "word": "दो",
                    "start": 22.585,
                    "speaker": "A"
                },
                {
                    "end": 22.825,
                    "word": "नाम",
                    "start": 22.665,
                    "speaker": "A"
                },
                {
                    "end": 23.145,
                    "word": "बताएं?",
                    "start": 22.825,
                    "speaker": "A"
                },
                {
                    "end": 23.305,
                    "word": "बिल्कुल",
                    "start": 23.145,
                    "speaker": "A"
                },
                {
                    "end": 23.545,
                    "word": "नहीं",
                    "start": 23.305,
                    "speaker": "A"
                },
                {
                    "end": 23.785,
                    "word": "लूंगा.",
                    "start": 23.545,
                    "speaker": "A"
                },
                {
                    "end": 23.945,
                    "word": "आप",
                    "start": 23.785,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "7fd65528-fc1a-4e20-97d9-13048e766217",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 23.945,
            "timestampEnd": 25.625,
            "text": "मैं खुद commentary करने लगा हूँ, मरवाओगे मेरे",
            "wordsJson": [
                {
                    "end": 24.265,
                    "word": "मैं",
                    "start": 23.945,
                    "speaker": "A"
                },
                {
                    "end": 24.425,
                    "word": "खुद",
                    "start": 24.265,
                    "speaker": "A"
                },
                {
                    "end": 24.665,
                    "word": "commentary",
                    "start": 24.425,
                    "speaker": "A"
                },
                {
                    "end": 24.904999,
                    "word": "करने",
                    "start": 24.665,
                    "speaker": "A"
                },
                {
                    "end": 24.985,
                    "word": "लगा",
                    "start": 24.904999,
                    "speaker": "A"
                },
                {
                    "end": 25.145,
                    "word": "हूँ,",
                    "start": 24.985,
                    "speaker": "A"
                },
                {
                    "end": 25.545,
                    "word": "मरवाओगे",
                    "start": 25.145,
                    "speaker": "A"
                },
                {
                    "end": 25.625,
                    "word": "मेरे",
                    "start": 25.545,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "e262c74f-30d5-4f61-b205-d14df26ee5e4",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 25.625,
            "timestampEnd": 26.185,
            "text": "को भी.",
            "wordsJson": [
                {
                    "end": 25.785,
                    "word": "को",
                    "start": 25.625,
                    "speaker": "A"
                },
                {
                    "end": 26.185,
                    "word": "भी.",
                    "start": 25.785,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "bd361135-c224-4947-88d1-df4c5c04585f",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 26.8245,
            "timestampEnd": 28.1045,
            "text": "So आप क्या अकल वगल होते हो वो",
            "wordsJson": [
                {
                    "end": 27.144499,
                    "word": "So",
                    "start": 26.8245,
                    "speaker": "A"
                },
                {
                    "end": 27.224499,
                    "word": "आप",
                    "start": 27.144499,
                    "speaker": "A"
                },
                {
                    "end": 27.384499,
                    "word": "क्या",
                    "start": 27.224499,
                    "speaker": "A"
                },
                {
                    "end": 27.544498,
                    "word": "अकल",
                    "start": 27.384499,
                    "speaker": "A"
                },
                {
                    "end": 27.7045,
                    "word": "वगल",
                    "start": 27.544498,
                    "speaker": "A"
                },
                {
                    "end": 27.8645,
                    "word": "होते",
                    "start": 27.7045,
                    "speaker": "A"
                },
                {
                    "end": 28.0245,
                    "word": "हो",
                    "start": 27.8645,
                    "speaker": "A"
                },
                {
                    "end": 28.1045,
                    "word": "वो",
                    "start": 28.0245,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "bd5923b1-0e41-4bfc-95d0-4ba58531d2e4",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 28.1045,
            "timestampEnd": 29.384499,
            "text": "लोग? हाँ, होते हैं, क्यों नहीं? तो आप",
            "wordsJson": [
                {
                    "end": 28.4245,
                    "word": "लोग?",
                    "start": 28.1045,
                    "speaker": "A"
                },
                {
                    "end": 28.6645,
                    "word": "हाँ,",
                    "start": 28.4245,
                    "speaker": "A"
                },
                {
                    "end": 28.7445,
                    "word": "होते",
                    "start": 28.6645,
                    "speaker": "A"
                },
                {
                    "end": 28.9045,
                    "word": "हैं,",
                    "start": 28.7445,
                    "speaker": "A"
                },
                {
                    "end": 29.064499,
                    "word": "क्यों",
                    "start": 28.9045,
                    "speaker": "A"
                },
                {
                    "end": 29.224499,
                    "word": "नहीं?",
                    "start": 29.064499,
                    "speaker": "A"
                },
                {
                    "end": 29.304499,
                    "word": "तो",
                    "start": 29.224499,
                    "speaker": "A"
                },
                {
                    "end": 29.384499,
                    "word": "आप",
                    "start": 29.304499,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "6a7e2225-a743-475c-9dbf-14c009562bec",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 29.384499,
            "timestampEnd": 30.5845,
            "text": "उनको बोलते हो क्या फ़ेंक रहा भई? तो",
            "wordsJson": [
                {
                    "end": 29.544498,
                    "word": "उनको",
                    "start": 29.384499,
                    "speaker": "A"
                },
                {
                    "end": 29.704498,
                    "word": "बोलते",
                    "start": 29.544498,
                    "speaker": "A"
                },
                {
                    "end": 29.7845,
                    "word": "हो",
                    "start": 29.704498,
                    "speaker": "A"
                },
                {
                    "end": 29.9445,
                    "word": "क्या",
                    "start": 29.7845,
                    "speaker": "A"
                },
                {
                    "end": 30.1045,
                    "word": "फ़ेंक",
                    "start": 29.9445,
                    "speaker": "A"
                },
                {
                    "end": 30.2645,
                    "word": "रहा",
                    "start": 30.1045,
                    "speaker": "A"
                },
                {
                    "end": 30.5045,
                    "word": "भई?",
                    "start": 30.2645,
                    "speaker": "A"
                },
                {
                    "end": 30.5845,
                    "word": "तो",
                    "start": 30.5045,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "d2b4b4da-d2fc-4a05-91f1-c0e19e0d16de",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 30.5845,
            "timestampEnd": 31.544498,
            "text": "मज़े लेते हैं, कौन ही मारते है, तो",
            "wordsJson": [
                {
                    "end": 30.7445,
                    "word": "मज़े",
                    "start": 30.5845,
                    "speaker": "A"
                },
                {
                    "end": 30.9045,
                    "word": "लेते",
                    "start": 30.7445,
                    "speaker": "A"
                },
                {
                    "end": 30.984499,
                    "word": "हैं,",
                    "start": 30.9045,
                    "speaker": "A"
                },
                {
                    "end": 31.064499,
                    "word": "कौन",
                    "start": 30.984499,
                    "speaker": "A"
                },
                {
                    "end": 31.224499,
                    "word": "ही",
                    "start": 31.064499,
                    "speaker": "A"
                },
                {
                    "end": 31.384499,
                    "word": "मारते",
                    "start": 31.224499,
                    "speaker": "A"
                },
                {
                    "end": 31.4645,
                    "word": "है,",
                    "start": 31.384499,
                    "speaker": "A"
                },
                {
                    "end": 31.544498,
                    "word": "तो",
                    "start": 31.4645,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "218e18f4-5b50-473c-b524-c950c96a3da4",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 31.544498,
            "timestampEnd": 33.8645,
            "text": "रुक जाओ भई. पर तो हर एक का",
            "wordsJson": [
                {
                    "end": 31.704498,
                    "word": "रुक",
                    "start": 31.544498,
                    "speaker": "A"
                },
                {
                    "end": 31.864498,
                    "word": "जाओ",
                    "start": 31.704498,
                    "speaker": "A"
                },
                {
                    "end": 33.1445,
                    "word": "भई.",
                    "start": 31.864498,
                    "speaker": "A"
                },
                {
                    "end": 33.3045,
                    "word": "पर",
                    "start": 33.1445,
                    "speaker": "A"
                },
                {
                    "end": 33.4645,
                    "word": "तो",
                    "start": 33.3045,
                    "speaker": "A"
                },
                {
                    "end": 33.6245,
                    "word": "हर",
                    "start": 33.4645,
                    "speaker": "A"
                },
                {
                    "end": 33.7045,
                    "word": "एक",
                    "start": 33.6245,
                    "speaker": "A"
                },
                {
                    "end": 33.8645,
                    "word": "का",
                    "start": 33.7045,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "5587355a-94f7-4ab9-b1f8-34d327c3ffc2",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 33.8645,
            "timestampEnd": 36.344498,
            "text": "style है. ठीक है. वो जिसका जैसा रहना",
            "wordsJson": [
                {
                    "end": 34.184498,
                    "word": "style",
                    "start": 33.8645,
                    "speaker": "A"
                },
                {
                    "end": 34.9045,
                    "word": "है.",
                    "start": 34.184498,
                    "speaker": "A"
                },
                {
                    "end": 35.3845,
                    "word": "ठीक",
                    "start": 35.0645,
                    "speaker": "A"
                },
                {
                    "end": 35.5445,
                    "word": "है.",
                    "start": 35.3845,
                    "speaker": "A"
                },
                {
                    "end": 35.7045,
                    "word": "वो",
                    "start": 35.5445,
                    "speaker": "A"
                },
                {
                    "end": 35.9445,
                    "word": "जिसका",
                    "start": 35.7045,
                    "speaker": "A"
                },
                {
                    "end": 36.1045,
                    "word": "जैसा",
                    "start": 35.9445,
                    "speaker": "A"
                },
                {
                    "end": 36.344498,
                    "word": "रहना",
                    "start": 36.1045,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        },
        {
            "id": "380ecf90-7577-4df1-bd66-2ad9ff71ceba",
            "projectId": "d65cbd70-e3ec-42aa-b9dc-c951e32b8ff4",
            "language": "en",
            "timestampStart": 36.344498,
            "timestampEnd": 38.5845,
            "text": "चाहिए नहीं तो उसकी दुकान बंद हो जाएगी.",
            "wordsJson": [
                {
                    "end": 36.5845,
                    "word": "चाहिए",
                    "start": 36.344498,
                    "speaker": "A"
                },
                {
                    "end": 36.664497,
                    "word": "नहीं",
                    "start": 36.5845,
                    "speaker": "A"
                },
                {
                    "end": 36.8245,
                    "word": "तो",
                    "start": 36.664497,
                    "speaker": "A"
                },
                {
                    "end": 36.984497,
                    "word": "उसकी",
                    "start": 36.8245,
                    "speaker": "A"
                },
                {
                    "end": 37.1445,
                    "word": "दुकान",
                    "start": 36.984497,
                    "speaker": "A"
                },
                {
                    "end": 37.3845,
                    "word": "बंद",
                    "start": 37.1445,
                    "speaker": "A"
                },
                {
                    "end": 37.4645,
                    "word": "हो",
                    "start": 37.3845,
                    "speaker": "A"
                },
                {
                    "end": 38.5845,
                    "word": "जाएगी.",
                    "start": 37.4645,
                    "speaker": "A"
                }
            ],
            "speaker": "A"
        }
    ]
};
    // return this.projectsService.getProject(id);
  }
}
