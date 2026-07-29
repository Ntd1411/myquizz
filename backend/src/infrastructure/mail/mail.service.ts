import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '../config/envconfig.js'

export interface MailOptions {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  cc?: string | string[]
  bcc?: string | string[]
  replyTo?: string
}

class MailService {
  private transporter: Transporter

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD
      }
    })
  }

  // Gửi email, trả về messageId
  async sendMail(options: MailOptions): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const info = await this.transporter.sendMail({
      from: env.MAIL_FROM,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo,
      subject: options.subject,
      text: options.text,
      html: options.html
    })

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return info.messageId ?? ''
  }

  // (Tuỳ chọn) kiểm tra cấu hình SMTP lúc khởi động
  async verify(): Promise<boolean> {
    return this.transporter.verify()
  }
}

export const mailService = new MailService()
