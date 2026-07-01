import type { Catalog, DemoUser, DialogueSession, GraphPayload, LearningSession, Lesson, Poem, PoetDialogueProfile, ProgressPayload, StudentReport, TeacherReport } from '../types';

export interface EduSession {
  user: DemoUser;
  token: string;
  issuedAt: string;
  expiresAt: string;
}

const sessionKey = 'enter-dream-libai-edu-session';

export function getEduSession(): EduSession | null {
  try {
    const raw = window.localStorage.getItem(sessionKey);
    if (!raw) return null;
    const session = JSON.parse(raw) as EduSession;
    if (!session?.token || new Date(session.expiresAt).getTime() <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function setEduSession(session: EduSession) {
  window.localStorage.setItem(sessionKey, JSON.stringify(session));
}

function authHeaders() {
  const session = getEduSession();
  return session ? { Authorization: `Bearer ${session.token}`, 'X-Edu-Token': session.token } : {};
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  for (const [key, value] of Object.entries(authHeaders())) headers.set(key, value);
  const response = await fetch(url, {
    ...init,
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || '请求失败');
  }
  return payload as T;
}

export const api = {
  catalogs: () => request<{ catalogs: Catalog[] }>('/api/edu/catalogs'),
  demoUsers: () => request<{ users: DemoUser[] }>('/api/edu/demo-users'),
  demoLogin: async (body: { userId?: string; role?: string }) => {
    const payload = await request<{ session: EduSession }>('/api/edu/auth/login', { method: 'POST', body: JSON.stringify(body) });
    setEduSession(payload.session);
    return payload;
  },
  poems: (query = '') => request<{ poems: Poem[] }>(`/api/edu/poems${query}`),
  poem: (id: string) => request<{ poem: Poem }>(`/api/edu/poems/${id}`),
  lesson: (id: string) => request<{ lesson: Lesson }>(`/api/edu/lessons/${id}`),
  graph: (query = '') => request<GraphPayload>(`/api/edu/graph${query}`),
  progress: (studentId = 'student-demo') => request<ProgressPayload>(`/api/edu/me/progress?studentId=${encodeURIComponent(studentId)}`),
  dialogueProfile: (poemId: string) => request<{ profile: PoetDialogueProfile }>(`/api/edu/poems/${poemId}/poet-dialogue-profile`),
  createDialogue: (body: { poemId: string; lessonId?: string; stepKey?: string }) =>
    request<{ session: DialogueSession }>('/api/edu/poet-dialogues', { method: 'POST', body: JSON.stringify(body) }),
  sendDialogueMessage: (sessionId: string, body: { message: string; stepKey?: string }) =>
    request<{ answer: { id: string; content: string }; session: DialogueSession }>(`/api/edu/poet-dialogues/${sessionId}/messages`, { method: 'POST', body: JSON.stringify(body) }),
  saveDialogueNote: (sessionId: string, body: { messageId?: string; noteText?: string }) =>
    request<{ note: { id: string; note_text: string } }>(`/api/edu/poet-dialogues/${sessionId}/notes`, { method: 'POST', body: JSON.stringify(body) }),
  createLearningSession: (body: { poemId: string; lessonId: string }) =>
    request<{ session: LearningSession }>('/api/edu/learning-sessions', { method: 'POST', body: JSON.stringify(body) }),
  answer: (body: { sessionId: string; questionId: string; answer: string; stepKey?: string }) =>
    request<{ correct: boolean; explanation: string }>('/api/edu/answers', { method: 'POST', body: JSON.stringify(body) }),
  completeLearning: (sessionId: string, body: { completedSteps: string[] }) =>
    request<{ session: LearningSession }>(`/api/edu/learning-sessions/${sessionId}/complete`, { method: 'POST', body: JSON.stringify(body) }),
  teacherReports: () => request<TeacherReport>('/api/edu/teacher/reports'),
  createClass: (body: { name: string }) =>
    request<{ class: { id: string; name: string; invite_code: string } }>('/api/edu/teacher/classes', { method: 'POST', body: JSON.stringify(body) }),
  addStudent: (classId: string, body: { studentName: string; studentId?: string; email?: string }) =>
    request<{ member: { id: string; student_id: string; student_name: string } }>(`/api/edu/teacher/classes/${classId}/students`, { method: 'POST', body: JSON.stringify(body) }),
  createAssignment: (body: { title: string; classId?: string; lessonId?: string; poemId?: string; unitId?: string }) =>
    request<{ assignment: { id: string; title: string } }>('/api/edu/teacher/assignments', { method: 'POST', body: JSON.stringify(body) }),
  studentReport: (studentId: string) => request<StudentReport>(`/api/edu/teacher/students/${studentId}/report`),
  adminContent: (type: string) => request<{ type: string; items: unknown[] }>(`/api/edu/admin/content/${type}`),
  saveAdminContent: (type: string, body: Record<string, unknown>) =>
    request<{ item: unknown }>(`/api/edu/admin/content/${type}`, { method: 'POST', body: JSON.stringify(body) }),
  updateAdminContent: (type: string, id: string, body: Record<string, unknown>) =>
    request<{ item: unknown }>(`/api/edu/admin/content/${type}/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  archiveAdminContent: (type: string, id: string) =>
    request<{ item: unknown }>(`/api/edu/admin/content/${type}/${id}`, { method: 'DELETE' }),
  submitAiJobForReview: (id: string, body: Record<string, unknown>) =>
    request<{ item: unknown }>(`/api/edu/admin/content/ai-jobs/${id}/apply`, { method: 'POST', body: JSON.stringify(body) }),
};
