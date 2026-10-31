const nodemailer = require('nodemailer');

const variations = [
  // mail.cipcusco.org.pe
  { host: 'mail.cipcusco.org.pe', port: 587, secure: false, user: 'notificaciones@cipcusco.org.pe', pass: 'r3a_5eS:X1L$' },
  { host: 'mail.cipcusco.org.pe', port: 587, secure: false, user: 'notificaciones', pass: 'r3a_5eS:X1L$' },
  { host: 'mail.cipcusco.org.pe', port: 465, secure: true, user: 'notificaciones@cipcusco.org.pe', pass: 'r3a_5eS:X1L$' },
  { host: 'mail.cipcusco.org.pe', port: 465, secure: true, user: 'notificaciones', pass: 'r3a_5eS:X1L$' },
  { host: 'mail.cipcusco.org.pe', port: 25, secure: false, user: 'notificaciones@cipcusco.org.pe', pass: 'r3a_5eS:X1L$' },
  { host: 'mail.cipcusco.org.pe', port: 2525, secure: false, user: 'notificaciones@cipcusco.org.pe', pass: 'r3a_5eS:X1L$' },

  // mail5006.site4now.net
  { host: 'mail5006.site4now.net', port: 587, secure: false, user: 'notificaciones@cipcusco.org.pe', pass: 'r3a_5eS:X1L$' },
  { host: 'mail5006.site4now.net', port: 587, secure: false, user: 'notificaciones', pass: 'r3a_5eS:X1L$' },
  { host: 'mail5006.site4now.net', port: 465, secure: true, user: 'notificaciones@cipcusco.org.pe', pass: 'r3a_5eS:X1L$' },
  { host: 'mail5006.site4now.net', port: 465, secure: true, user: 'notificaciones', pass: 'r3a_5eS:X1L$' },

  // webmail / cp / other
  { host: 'igw06.site4now.net', port: 587, secure: false, user: 'notificaciones@cipcusco.org.pe', pass: 'r3a_5eS:X1L$' },
  { host: 'igw06.site4now.net', port: 25, secure: false, user: 'notificaciones@cipcusco.org.pe', pass: 'r3a_5eS:X1L$' },

  // gmail with user variations
  { host: 'smtp.gmail.com', port: 587, secure: false, user: 'notificaciones@cipcusco.org.pe', pass: 'r3a_5eS:X1L$' },
  { host: 'smtp.gmail.com', port: 465, secure: true, user: 'notificaciones@cipcusco.org.pe', pass: 'r3a_5eS:X1L$' },
];

async function run() {
  for (const v of variations) {
    process.stdout.write(`Probando ${v.host}:${v.port} (user: ${v.user}, secure: ${v.secure})... `);
    const transporter = nodemailer.createTransport({
      host: v.host,
      port: v.port,
      secure: v.secure,
      auth: { user: v.user, pass: v.pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 5000,
      greetingTimeout: 4000,
    });

    try {
      await transporter.verify();
      console.log(`\n\n========================================`);
      console.log(`>>> EXITO TOTAL CON:`);
      console.log(`HOST: ${v.host}`);
      console.log(`PORT: ${v.port}`);
      console.log(`SECURE: ${v.secure}`);
      console.log(`USER: ${v.user}`);
      console.log(`========================================\n`);
      return v;
    } catch (err) {
      console.log(`ERR: ${err.message}`);
    }
  }
  console.log('\nNinguno autenticó.');
}

run().then(() => process.exit(0));
