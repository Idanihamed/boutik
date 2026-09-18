import { IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { IsUploadedImageUrl } from '../../common/validators/uploaded-image-url.validator';

export class ReplyContactMessageDto {
  // Optionnel : une réponse uniquement vocale (voir replyVoiceUrl) est acceptée, au même
  // titre qu'un message de contact initial (voir CreateContactMessageDto). Au moins l'un des
  // deux doit être présent — vérifié dans ContactMessagesService.setReply.
  @IsOptional()
  @ValidateIf((o) => !!o.reply)
  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  reply?: string;

  // Chemin "/uploads/..." renvoyé par l'upload vocal admin (voir
  // ContactMessagesController.uploadReplyVoice).
  @IsOptional()
  @IsString()
  @Matches(/^\/uploads\//, { message: 'replyVoiceUrl doit être un chemin "/uploads/..." renvoyé par l’upload vocal.' })
  replyVoiceUrl?: string;

  // URL renvoyée par ContactMessagesController.uploadReplyAttachment (photo ou vidéo).
  @IsOptional()
  @IsString()
  @IsUploadedImageUrl()
  replyAttachmentUrl?: string;
}
