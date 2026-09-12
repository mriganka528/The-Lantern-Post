import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { CharactersController, PalaceController } from './characters.controller';
import { CharactersService } from './characters.service';

@Module({ imports: [DatabaseModule, AuthModule], controllers: [CharactersController, PalaceController], providers: [CharactersService] })
export class CharactersModule {}
