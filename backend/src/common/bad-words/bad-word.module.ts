import { Global, Module } from '@nestjs/common';
import { BadWordService } from './bad-word.service';
import { BadWordInterceptor } from './bad-word.interceptor';

@Global()
@Module({
  providers: [BadWordService, BadWordInterceptor],
  exports: [BadWordService, BadWordInterceptor],
})
export class BadWordModule {}
