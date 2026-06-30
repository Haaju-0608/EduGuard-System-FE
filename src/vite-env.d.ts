/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_FASTAPI_EVIDENCE_URL?: string;
  readonly VITE_AI_PARTICIPATION_ID?: string;
  readonly VITE_AI_SESSION_ID?: string;
  readonly VITE_AI_STUDENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
