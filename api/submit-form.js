import { google } from 'googleapis';
import nodemailer from 'nodemailer';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body;

    const sheetId = process.env.GOOGLE_SHEET_ID;
    const sheetAdded = sheetId ? await logToSheet(data, sheetId) : false;

    const emailSent = await sendEmails(data);

    res.status(200).json({
      success: true,
      emailSent,
      sheetAdded,
    });
  } catch (error) {
    console.error('Form submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar el formulario',
    });
  }
}

async function sendEmails(data) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const toEmails = [
    'manuela.chavarria@premexcorp.com',
    'manuela.mesa.beltran@premexcorp.com',
  ];

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn('SMTP not configured, skipping email');
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const html = buildEmailHtml(data);

  await transporter.sendMail({
    from: `"Insylo Formulario" <${smtpUser}>`,
    to: toEmails.join(', '),
    subject: `Nuevo formulario Insylo - ${data.compania || 'Sin compañía'}`,
    html,
  });

  return true;
}

async function logToSheet(data, spreadsheetId) {
  const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
  if (!credentialsJson) {
    console.warn('Google Sheets credentials not configured');
    return false;
  }

  const credentials = JSON.parse(credentialsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const now = new Date().toISOString();

  const row = [
    now,
    data.compania || '',
    data.tipoUbicacion || '',
    data.nombreUbicacion || '',
    data.sector || '',
    data.siloId || '',
    data.cilindroSuelo || '',
    data.conoSuelo || '',
    data.alimentadorSuelo || '',
    data.conoTruncado || '',
    data.distanciaOrificio || '',
    data.anguloCono || '',
    data.distanciaPatas || '',
    data.radio || '',
    data.numeroPatas || '',
    data.correos ? data.correos.join('; ') : '',
  ];

  const headers = [
    'Fecha',
    'Compañía',
    'Tipo de ubicación',
    'Nombre de la ubicación',
    'Sector',
    'ID del silo',
    'Cilindro al suelo (cm)',
    'Cono al suelo (cm)',
    'Alimentador al suelo (cm)',
    'Cono truncado (cm)',
    'Distancia al orificio (cm)',
    'Ángulo del cono (grados)',
    'Distancia entre patas (cm)',
    'Radio (cm)',
    'Número de patas',
    'Correos de acceso',
  ];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Respuestas!A:P',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
  } catch {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:P',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
  }

  return true;
}

function buildEmailHtml(data) {
  const fields = [
    ['Compañía', data.compania],
    ['Tipo de ubicación', data.tipoUbicacion],
    ['Nombre de la ubicación', data.nombreUbicacion],
    ['Sector', data.sector],
    ['ID del silo', data.siloId],
    ['Cilindro al suelo (cm)', data.cilindroSuelo],
    ['Cono al suelo (cm)', data.conoSuelo],
    ['Alimentador al suelo (cm)', data.alimentadorSuelo],
    ['Cono truncado (cm)', data.conoTruncado],
    ['Distancia al orificio (cm)', data.distanciaOrificio],
    ['Ángulo del cono (grados)', data.anguloCono],
    ['Distancia entre patas (cm)', data.distanciaPatas],
    ['Radio (cm)', data.radio],
    ['Número de patas', data.numeroPatas],
    ['Correos de acceso', data.correos?.join(', ')],
  ];

  const rows = fields
    .filter(([, v]) => v)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border:1px solid #ddd;font-weight:600;background:#f5f8fa">${label}</td><td style="padding:8px 12px;border:1px solid #ddd">${value}</td></tr>`
    )
    .join('');

  const photos = data.fotos?.length
    ? data.fotos
        .map(
          (f, i) =>
            `<p><strong>Foto ${i + 1}:</strong> ${f.name} (${Math.round(f.size / 1024)} KB)</p>`
        )
        .join('')
    : '<p>No se adjuntaron fotos</p>';

  const imagenesSection = data.fotos?.length
    ? `<h3 style="color:#07184c;margin-top:24px">Imágenes adjuntas</h3>${photos}`
    : '';

  return `
    <div style="font-family:Inter,Helvetica,sans-serif;max-width:600px;margin:auto">
      <div style="background:#07184c;color:#fff;padding:20px;text-align:center;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:20px">Nuevo formulario Insylo</h1>
      </div>
      <div style="background:#fff;border:1px solid #ddd;border-top:none;padding:20px;border-radius:0 0 8px 8px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
        ${imagenesSection}
        <p style="color:#888;font-size:12px;margin-top:24px">Enviado el ${new Date().toLocaleString('es-CO')}</p>
      </div>
    </div>`;
}
