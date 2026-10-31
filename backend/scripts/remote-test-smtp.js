const nodemailer = require('nodemailer');

const config = {
  host: 'mail.cipcusco.org.pe',
  port: 587,
  secure: false,
  auth: {
    user: 'notificaciones@cipcusco.org.pe',
    pass: 'r3a_5eS:X1L$',
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
