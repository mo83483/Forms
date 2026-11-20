// سجل AbortController مشترك للعمليات الجارية (إيقاف فوري من الواجهة)
const g = globalThis as typeof globalThis & { __AFS_CONTROLLERS__?: Map<string, AbortController> };
if (!g.__AFS_CONTROLLERS__) g.__AFS_CONTROLLERS__ = new Map();
const controllers = g.__AFS_CONTROLLERS__;

export function registerController(jobId: string, controller: AbortController) {
  controllers.set(jobId, controller);
}

export function abortJob(jobId: string): boolean {
  const c = controllers.get(jobId);
  if (!c) return false;
  c.abort();
  return true;
}

export function releaseController(jobId: string) {
  controllers.delete(jobId);
}
