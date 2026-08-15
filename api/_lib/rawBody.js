// 讀取原始請求內容(不經過 JSON parser),驗證 LINE signature 一定要用未經處理的原始 bytes。
export function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
