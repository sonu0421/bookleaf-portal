import dotenv from 'dotenv';
dotenv.config();

function required(name, fallback = '') {
  const v = process.env[name] ?? fallback;
  return v;
}

export const env = {
  port: parseInt(process.env.PORT || '5000', 10),
  mongoUri: required('MONGO_URI', 'mongodb://localhost:27017/bookleaf'),
  jwtSecret: required('JWT_SECRET'),
  clientUrl: required('CLIENT_URL', 'http://localhost:5173'),
  groqApiKey: required('GROQ_API_KEY'),
  groqModel: required('GROQ_MODEL', 'openai/gpt-oss-120b'),
  nodeEnv: process.env.NODE_ENV || 'development',
};

export function validateEnv() {
  const errors = [];
  if (!env.jwtSecret || env.jwtSecret.length < 16) {
    errors.push('JWT_SECRET must be set and at least 16 characters.');
  }
  if (!env.mongoUri) errors.push('MONGO_URI is missing.');
  return errors;
}
