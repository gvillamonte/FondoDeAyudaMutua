import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SolicitarRecuperacionDto {
  @ApiProperty({ example: 'usuario@cipcusco.org.pe' })
  @IsString()
  @MinLength(3, { message: 'Debe ingresar un usuario o correo válido' })
  @MaxLength(150)
  identifier: string;
}
