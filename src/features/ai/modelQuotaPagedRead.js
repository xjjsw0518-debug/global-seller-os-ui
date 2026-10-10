/** One deadline covers the complete read; expired or superseded reads schedule no further pages. */
export async function loadModelQuotaPages(list, {
  pageSize = 100,
  timeoutMs = 10_000,
  isCurrent = () => true,
  makeTimeoutError = () => Object.assign(new Error("Model-list read timed out."), { code: "AI_MODEL_LIST_TIMEOUT" }),
} = {}) {
  let expired = false;
  let timeoutId;
  const assertCurrent = () => {
    if (expired) throw makeTimeoutError();
    if (!isCurrent()) throw Object.assign(new Error("Model-list read superseded."), { code: "AI_MODEL_LIST_SUPERSEDED" });
  };
  const readAll = async () => {
    assertCurrent();
    const first = await list({ page: 1, pageSize });
    assertCurrent();
    const items = [...first.items];
    for (let page = 2; page <= first.totalPages; page += 1) {
      assertCurrent();
      const next = await list({ page, pageSize });
      assertCurrent();
      items.push(...next.items);
    }
    return { ...first, items };
  };
  try {
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => { expired = true; reject(makeTimeoutError()); }, timeoutMs);
    });
    return await Promise.race([readAll(), timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}
