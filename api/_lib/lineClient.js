// 呼叫 LINE Messaging API 的共用函式。LINE_CHANNEL_ACCESS_TOKEN 只會在這裡(伺服器端)被讀取,
// 不會、也不能出現在任何前端(瀏覽器)看得到的程式碼裡。
const LINE_API_BASE = 'https://api.line.me/v2/bot';

async function callLineApi(path, body) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('缺少 LINE_CHANNEL_ACCESS_TOKEN 環境變數');

  const res = await fetch(`${LINE_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LINE API error ${res.status}: ${errText}`);
  }
  return res;
}

export function pushMessage(to, text) {
  return callLineApi('/message/push', { to, messages: [{ type: 'text', text }] });
}

export function replyMessage(replyToken, text) {
  return callLineApi('/message/reply', { replyToken, messages: [{ type: 'text', text }] });
}

// 用已經拿到的 userId 查詢這個人的 LINE 顯示名稱/大頭貼(對方沒封鎖官方帳號才查得到)
export async function getProfile(userId) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('缺少 LINE_CHANNEL_ACCESS_TOKEN 環境變數');

  const res = await fetch(`${LINE_API_BASE}/profile/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LINE API error ${res.status}: ${errText}`);
  }
  return res.json();
}
