const nodemailer = require('nodemailer');
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
} = require('./config');

const FROM_EMAIL = 'contact@augmenthumankind.com';
const FROM_NAME = 'Augment Humankind';

function formatConfigForEmail(config) {
  let output = '----------------------------------------------------\n';
  output += 'CONFIGURATION DETAILS\n';
  output += '----------------------------------------------------\n\n';

  output += 'BACKGROUND:\n';
  output += `- Color: ${config?.bg ?? '#000000'}\n`;
  output += `- Image URL: ${config?.bgImageUrl ?? '(none)'}\n\n`;

  output += 'SHAPES:\n';
  if (Array.isArray(config?.shapes)) {
    for (const shape of config.shapes) {
      const shapeType = String(shape?.type || 'unknown');
      const label = shapeType.charAt(0).toUpperCase() + shapeType.slice(1);
      output += `- ${label}\n`;
      output += `  - Number of shapes: ${shape?.count ?? 0}\n`;
      output += `  - Size: ${shape?.size ?? 1.0}\n`;
      output += `  - Base color: ${shape?.palette?.baseColor ?? '#ffffff'}\n`;
      output += `  - Texture URL: ${shape?.textureUrl ?? '(none)'}\n`;
    }
  } else {
    output += '(No shapes configured)\n';
  }

  output += '\n----------------------------------------------------\n\n';

  return output;
}

function getTransport() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

async function sendMail(to, subject, body) {
  const transport = getTransport();
  if (!transport) return false;

  await transport.sendMail({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to,
    subject,
    text: body,
  });

  return true;
}

async function sendPieceCreatedEmail({ toEmail, pieceId, pieceSlug, adminKey, config, baseUrl }) {
  const subject = 'Your 3D Art Piece Details';

  let body = 'Hello,\n\n';
  body += 'Thank you for creating a 3D art piece! Here are your piece details:\n\n';
  body += `Piece ID: ${pieceId}\n`;
  body += `Piece Slug: ${pieceSlug}\n`;
  body += `Piece Admin Key: ${adminKey}\n\n`;
  body += 'IMPORTANT: Save this admin key! You will need it to edit or delete your piece.\n\n';
  body += '----------------------------------------------------\n';
  body += 'LINKS\n';
  body += '----------------------------------------------------\n\n';
  body += `View:   ${baseUrl}/view.html?id=${pieceSlug}\n`;
  body += `Edit:   ${baseUrl}/edit.html\n`;
  body += `Delete: ${baseUrl}/delete.html\n\n`;
  body += '----------------------------------------------------\n';
  body += 'EMBED CODES (Copy & Paste)\n';
  body += '----------------------------------------------------\n\n';
  body += 'Using Slug:\n';
  body += `<iframe src="${baseUrl}/view.html?id=${pieceSlug}" width="800" height="600" frameborder="0"></iframe>\n\n`;
  body += 'Using ID:\n';
  body += `<iframe src="${baseUrl}/view.html?id=${pieceId}" width="800" height="600" frameborder="0"></iframe>\n\n`;
  body += '----------------------------------------------------\n\n';
  body += formatConfigForEmail(config);
  body += 'Best regards,\n';
  body += 'Augment Humankind';

  try {
    return await sendMail(toEmail, subject, body);
  } catch {
    return false;
  }
}

async function sendPieceUpdatedEmail({ toEmail, pieceId, pieceSlug, config, baseUrl }) {
  const subject = 'Your 3D Art Piece Has Been Updated';

  let body = 'Hello,\n\n';
  body += 'This is to confirm that your 3D art piece has been successfully updated:\n\n';
  body += `Piece ID: ${pieceId}\n`;
  body += `Piece Slug: ${pieceSlug}\n\n`;
  body += '----------------------------------------------------\n';
  body += 'LINKS\n';
  body += '----------------------------------------------------\n\n';
  body += `View:   ${baseUrl}/view.html?id=${pieceSlug}\n`;
  body += `Edit:   ${baseUrl}/edit.html\n`;
  body += `Delete: ${baseUrl}/delete.html\n\n`;
  body += '----------------------------------------------------\n\n';
  body += formatConfigForEmail(config);
  body += 'Best regards,\n';
  body += 'Augment Humankind';

  try {
    return await sendMail(toEmail, subject, body);
  } catch {
    return false;
  }
}

async function sendPieceDeletedEmail({ toEmail, pieceId, pieceSlug, config }) {
  const subject = 'Your 3D Art Piece Has Been Deleted';

  let body = 'Hello,\n\n';
  body += 'This is to confirm that your 3D art piece has been permanently deleted:\n\n';
  body += `Piece ID: ${pieceId}\n`;
  body += `Piece Slug: ${pieceSlug}\n\n`;
  body += 'The piece and all associated data have been removed from our system.\n\n';
  body += 'If this deletion was made in error, you can recreate it using the configuration details below.\n\n';
  body += formatConfigForEmail(config);
  body += 'Best regards,\n';
  body += 'Augment Humankind';

  try {
    return await sendMail(toEmail, subject, body);
  } catch {
    return false;
  }
}

module.exports = {
  sendPieceCreatedEmail,
  sendPieceUpdatedEmail,
  sendPieceDeletedEmail,
};
