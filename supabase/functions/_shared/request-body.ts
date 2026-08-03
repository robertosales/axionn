export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("REQUEST_BODY_TOO_LARGE");
  }
}

export async function readTextBody(req: Request, maxBytes: number): Promise<string> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new RequestBodyTooLargeError();
  if (!req.body) return "";

  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new RequestBodyTooLargeError();
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function readJsonBody<T>(req: Request, maxBytes: number): Promise<T> {
  return JSON.parse(await readTextBody(req, maxBytes)) as T;
}
