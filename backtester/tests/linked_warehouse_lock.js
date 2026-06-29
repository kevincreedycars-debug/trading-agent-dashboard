const fs = require("node:fs/promises");
const path = require("node:path");

const LOCK_DIRNAME = ".linked-warehouse-test-lock";
const RETRY_MS = 250;
const STALE_LOCK_MS = 10 * 60 * 1000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireLock(repoRoot) {
  const lockPath = path.join(repoRoot, LOCK_DIRNAME);

  for (;;) {
    try {
      await fs.mkdir(lockPath);
      await fs.writeFile(
        path.join(lockPath, "owner.json"),
        JSON.stringify({
          pid: process.pid,
          acquired_at: new Date().toISOString()
        }, null, 2)
      );

      return async () => {
        await fs.rm(lockPath, { recursive: true, force: true });
      };
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }

      try {
        const stats = await fs.stat(lockPath);
        if ((Date.now() - stats.mtimeMs) > STALE_LOCK_MS) {
          await fs.rm(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue;
      }

      await delay(RETRY_MS);
    }
  }
}

async function withLinkedWarehouseLock(repoRoot, fn) {
  const release = await acquireLock(repoRoot);
  try {
    return await fn();
  } finally {
    await release();
  }
}

module.exports = {
  withLinkedWarehouseLock
};
