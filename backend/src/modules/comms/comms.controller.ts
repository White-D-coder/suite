import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { CommsService } from './comms.service';
import { SendEmailDto } from './dto/send-email.dto';
import { SendWhatsappDto } from './dto/send-whatsapp.dto';
import { AdminGuard } from '../auth/guards/jwt-auth.guard';

@Controller('comms')
@UseGuards(AdminGuard)
export class CommsController {
  constructor(private readonly commsService: CommsService) {}

  @Post('email')
  async sendEmail(@Body() sendEmailDto: SendEmailDto) {
    return this.commsService.sendEmail(sendEmailDto);
  }

  @Post('whatsapp')
  async sendWhatsapp(@Body() sendWhatsappDto: SendWhatsappDto) {
    return this.commsService.sendWhatsapp(sendWhatsappDto);
  }

  @Get('client/:clientId')
  async getClientHistory(@Param('clientId') clientId: string) {
    return this.commsService.getClientHistory(clientId);
  }
}
