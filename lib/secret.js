// 비밀글 암호화 (빌드 시). 브라우저 Web Crypto로 그대로 풀 수 있는 형식.
//   키 = PBKDF2-SHA256(PIN, salt, ITER) -> AES-256-GCM
//   비밀글 전체를 JSON 하나로 묶어 한 번에 암호화한다 (PIN 확인 1회로 전부 열림).
//   빌드마다 salt·IV를 새로 만든다.
const crypto = require('crypto');

const ITER = 600000;

function encrypt(payload, pin, iter = ITER) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(String(pin), salt, iter, 32, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return { v: 1, alg: 'PBKDF2-SHA256/AES-256-GCM', iter, salt: salt.toString('base64'), iv: iv.toString('base64'), ct: ct.toString('base64') };
}

// 테스트·검증용 (브라우저 site/app.js의 unlock과 같은 절차를 Node Web Crypto로)
async function decrypt(blob, pin) {
  const { subtle } = globalThis.crypto;
  const b = s => Buffer.from(s, 'base64');
  const base = await subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b(blob.salt), iterations: blob.iter },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: b(blob.iv) }, key, b(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

module.exports = { encrypt, decrypt, ITER };
