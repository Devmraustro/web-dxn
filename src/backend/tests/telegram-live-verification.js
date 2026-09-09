async function main() {
const dotenv = require('dotenv');
dotenv.config();

const axios = require('axios');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

console.log('=== TELEGRAM LIVE VERIFICATION ===');
console.log('credentials present:', !!token && !!chatId);

// 1. Test getMe endpoint
try {
  const res1 = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
  console.log('getMe PASS:', res1.data.ok);
} catch (err) {
  console.log('getMe FAIL:', err.response?.status || err.message);
}

// 2. If getMe succeeds, send a test message
try {
  const res2 = await axios.post(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      chat_id: chatId,
      text: 'DXN LIVE VERIFICATION TEST',
      parse_mode: 'Markdown'
    },
    { timeout: 10000, maxContentLength: 16000, maxBodyLength: 16000 }
  );
  console.log('sendMessage PASS:', res2.data.ok);
  console.log('message_id:', res2.data.result?.message_id);
} catch (err) {
  console.log('sendMessage FAIL:', err.response?.status || err.message);
}

console.log('=== END TELEGRAM LIVE VERIFICATION ===');
}
main();