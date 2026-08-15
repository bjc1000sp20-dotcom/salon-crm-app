import crypto from 'crypto';

// LINE 官方驗證方式:用 Channel Secret 對原始 request body 做 HMAC-SHA256,
// base64 編碼後應該要跟 x-line-signature 這個 header 完全一樣。
export function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!signature || !channelSecret) return false;
  const expected = crypto.createHmac('sha256', channelSecret).update(rawBody).digest('base64');

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false; // 長度不同代表一定不吻合,避免 timingSafeEqual 對不同長度報錯
  return crypto.timingSafeEqual(a, b);
}
