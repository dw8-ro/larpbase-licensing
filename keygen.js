const crypto = require('crypto');

function generateKey() {
  const hex = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${hex()}-${hex()}-${hex()}-${hex()}`;
}

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

module.exports = { generateKey, hashKey };
