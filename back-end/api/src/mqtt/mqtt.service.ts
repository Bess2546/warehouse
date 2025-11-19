import { Injectable } from '@nestjs/common';

@Injectable()
export class MqttService {
  constructor() {
    console.log('[MqttService] created');
  }
}