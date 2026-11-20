// ─────────────────────────────────────────────────────────────────────────────
// AI Form Solver — In-Memory Job Manager
// لا توجد قاعدة بيانات: كل العمليات تُدار في الذاكرة (globalThis) وتختفي
// بعد 30 دقيقة أو عند إيقاف السيرفر. مناسب للجلسات اللحظية تمامًا.
// ─────────────────────────────────────────────────────────────────────────────

export type JobType = "solve" | "fill";
export type JobStatus = "running" | "done" | "error" | "cancelled";
export type LogLevel = "info" | "success" | "warn" | "error";

export interface JobLog {
  t: number;
  level: LogLevel;
  msg: string;
}

export interface JobSnapshot {
  id: string;
  type: JobType;
  status: JobStatus;
  step: string;
  progress: number;
  logs: JobLog[];
  result?: unknown;
  error?: string;
  createdAt: number;
  durationMs: number;
  cancelRequested: boolean;
}

type Listener = (snapshot: JobSnapshot) => void;

const TTL_MS = 30 * 60 * 1000;

export class Job {
  id: string;
  type: JobType;
  status: JobStatus = "running";
  step = "تهيئة…";
  progress = 0;
  logs: JobLog[] = [];
  result?: unknown;
  error?: string;
  createdAt = Date.now();
  cancelRequested = false;
  private listeners = new Set<Listener>();

  constructor(id: string, type: JobType) {
    this.id = id;
    this.type = type;
  }

  log(level: LogLevel, msg: string) {
    this.logs.push({ t: Date.now(), level, msg });
    if (this.logs.length > 400) this.logs.splice(0, this.logs.length - 400);
    this.emit();
  }

  patch(p: Partial<Pick<Job, "step" | "progress" | "status" | "result" | "error">>) {
    Object.assign(this, p);
    this.emit();
  }

  finish(status: Exclude<JobStatus, "running">, extra?: { result?: unknown; error?: string }) {
    this.status = status;
    if (extra?.result !== undefined) this.result = extra.result;
    if (extra?.error !== undefined) this.error = extra.error;
    if (status === "done") this.progress = 100;
    this.emit();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  snapshot(): JobSnapshot {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      step: this.step,
      progress: this.progress,
      logs: [...this.logs],
      result: this.result,
      error: this.error,
      createdAt: this.createdAt,
      durationMs: Date.now() - this.createdAt,
      cancelRequested: this.cancelRequested,
    };
  }

  private emit() {
    const snap = this.snapshot();
    for (const fn of this.listeners) {
      try { fn(snap); } catch { /* listener gone */ }
    }
  }
}

interface JobStore {
  jobs: Map<string, Job>;
}

const g = globalThis as typeof globalThis & { __AFS_JOB_STORE__?: JobStore };
if (!g.__AFS_JOB_STORE__) {
  g.__AFS_JOB_STORE__ = { jobs: new Map() };
}
const store = g.__AFS_JOB_STORE__;

function prune() {
  const now = Date.now();
  for (const [id, job] of store.jobs) {
    if (now - job.createdAt > TTL_MS && job.status !== "running") store.jobs.delete(id);
  }
}

export function createJob(type: JobType): Job {
  prune();
  const id = (globalThis.crypto?.randomUUID?.() ?? `job-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const job = new Job(id, type);
  store.jobs.set(id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return store.jobs.get(id);
}

export function requestCancel(id: string): boolean {
  const job = store.jobs.get(id);
  if (!job || job.status !== "running") return false;
  job.cancelRequested = true;
  job.log("warn", "طلب المستخدم إيقاف العملية — سيتم التوقف عند أول نقطة آمنة…");
  return true;
}
