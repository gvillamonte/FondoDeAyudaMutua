const nodemailer = require('nodemailer');

const config = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE === 'false' ? false : true,
  auth: {
    user: process.env.SMTP_USER || 'notificaciones@cipcusco.org.pe',
    pass: process.env.SMTP_PASS || '',
  },
  tls: {
    rejectUnauthorized: false,
  },
};

console.log('Probando conexion desde servidor con:', config.host, config.port, config.auth.user);
const transporter = nodemailer.createTransport(config);

transporter.verify()
  .then(() => {
    console.log('>>> VERIFICACION SMTP EXITOSA! <<<');
    process.exit(0);
  })
  .catch((err) => {
    console.error('ERROR SMTP:', err.message);
    process.exit(1);
  });
