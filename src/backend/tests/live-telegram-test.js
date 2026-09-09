const dotenv = require('dotenv');
dotenv.config();

const axios = require('axios');

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  console.log(JSON.stringify({
    credentialsPresent: !!token && !!chatId,
    tokenLength: token ? token.length : 0,
    chatIdLength: chatId ? chatId.length : 0,
    tokenFormatOk: token ? /^\d{8,10}:[A-Za-z0-9_-]{35}$/.test(token) : false,
    chatIdFormatOk: chatId ? /^-?\d+$/.test(chatId) : false,
  }));

  try {
    const res = await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      { chat_id: chatId, text: 'DXN Live Test — verification message', parse_mode: 'Markdown' },
      { timeout: 10000, maxContentLength: 16000, maxBodyLength: 16000 }
    );
    console.log(JSON.stringify({
      status: res.status,
      delivered: true,
      messageId: res.data?.result?.message_id,
    }));
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    const code = err.code;
    console.log(JSON.stringify({
      status: 'failed',
      httpStatus: status,
      errorCode: data?.error_code,
      errorMessage: data?.description,
      axiosCode: code,
    }));
  }
}

main();
