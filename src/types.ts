export interface Poem {
  id: string;
  author_id: string;
  author_name: string;
  author_dynasty: string;
  title: string;
  dynasty: string;
  full_text: string;
  highlight_line: string;
  stage: string;
  grade: string;
  semester: string;
  unit_title: string;
  lesson_position: string;
  theme: string;
  translation: string;
  background: string;
  cover_url: string;
  source_game_id: string;
  lesson_id?: string;
  learningObjectives: string[];
  annotations: Array<{ term: string; meaning: string }>;
  examPoints: string[];
  motifs: string[];
  places: string[];
  writingPoints: string[];
  lines?: Array<{ id: string; text: string; commentary: string; line_order: number }>;
  questions?: Question[];
  relations?: Relation[];
  dialogueProfile?: PoetDialogueProfile | null;
}

export interface Question {
  id: string;
  poem_id: string;
  type: 'choice' | 'short' | 'fill' | 'open';
  prompt: string;
  answer: string;
  difficulty: string;
  explanation: string;
  status: string;
  options: Array<{ id: string; label: string; text: string; is_correct: number }>;
}

export interface Relation {
  id: string;
  from_poem_id: string;
  to_poem_id: string;
  relation_type: string;
  label: string;
  reason: string;
  title: string;
  highlight_line: string;
  theme: string;
  cover_url: string;
}

export interface Catalog {
  id: string;
  name: string;
  publisher: string;
  version: string;
  volumes: Volume[];
}

export interface Volume {
  id: string;
  stage: string;
  grade: string;
  semester: string;
  label: string;
  units: Unit[];
}

export interface Unit {
  id: string;
  title: string;
  learning_goal: string;
  poems: Array<Pick<Poem, 'id' | 'title' | 'highlight_line' | 'theme' | 'cover_url' | 'stage' | 'grade' | 'semester'> & {
    lesson_no: string;
    position_label: string;
  }>;
}

export interface Lesson {
  id: string;
  poem_id: string;
  poem_title: string;
  highlight_line: string;
  full_text: string;
  cover_url: string;
  source_game_id: string;
  theme: string;
  motifs: string[];
  places: string[];
  writingPoints: string[];
  title: string;
  summary: string;
  steps: LessonStep[];
  scenes: LessonScene[];
  relations: Relation[];
}

export interface LessonStep {
  id: string;
  lesson_id: string;
  step_key: string;
  title: string;
  step_order: number;
  objective: string;
  content: {
    text: string;
    highlightLine: string;
    motifs: string[];
    places: string[];
    writingPoints: string[];
  };
  interactions: Interaction[];
}

export interface Interaction {
  id: string;
  question_id: string;
  prompt: string;
  interaction_type: string;
  question_type: 'choice' | 'short' | 'fill' | 'open';
  question_prompt: string;
  question_explanation: string;
  options: Array<{ id: string; label: string; text: string }>;
}

export interface LessonScene {
  id: string;
  title: string;
  panorama_url: string;
  educationFocus: {
    focus?: string[];
    originalAmbientLine?: string;
    hotspots?: string[];
  };
}

export interface PoetDialogueProfile {
  id: string;
  poem_id: string;
  poem_title: string;
  highlight_line: string;
  role_name: string;
  role_summary: string;
  avatar_url: string | null;
  grade_band: string;
  prompt: {
    id: string;
    version_no: number;
    status: string;
    stage_key: string;
    safetyRules: string[];
  } | null;
  facts: Array<{ id: string; fact_type: string; fact_text: string }>;
  suggestedQuestions: Array<{ id: string; text: string; question_order: number }>;
}

export interface DialogueSession {
  id: string;
  poem_id: string;
  poem_title: string;
  prompt_version_id: string;
  prompt_version_no: number;
  role_name: string;
  messages: DialogueMessage[];
}

export interface DialogueMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  added_to_note: number;
  citedContext?: Array<{ fact_text: string }>;
  safetyResult?: Record<string, unknown>;
}

export interface LearningSession {
  id: string;
  student_id: string;
  poem_id: string;
  lesson_id: string;
  status: string;
  progress_step: string;
  mastery?: {
    correctRate?: number;
    completedSteps?: string[];
    reviewNeeded?: boolean;
  };
}

export interface ProgressPayload {
  studentId: string;
  summary: {
    completed: number;
    inProgress: number;
    correctRate: number;
    answerCount: number;
    noteCount: number;
    reviewCount: number;
  };
  sessions: Array<LearningSession & {
    poem_title: string;
    cover_url: string;
    highlight_line: string;
    theme: string;
    answers: Array<{ id: string; prompt: string; explanation: string; is_correct: number; student_answer: string }>;
  }>;
  notes: Array<{ id: string; poem_title: string; note_text: string }>;
  reviewQueue: Array<{ id: string; poem_id: string; poem_title: string; highlight_line: string; reason: string; due_at: string; status: string }>;
  mastery: Array<{ id: string; name: string; type: string; poem_title: string; mastery_level: number }>;
}

export interface GraphPayload {
  nodes: Array<{ id: string; type: string; label: string; meta?: string; image?: string }>;
  edges: Array<{ id: string; from: string; to: string; label: string; relationType?: string }>;
}

export interface TeacherReport {
  classes: Array<{
    id: string;
    name: string;
    invite_code: string;
    members: Array<{ student_id: string; student_name: string }>;
  }>;
  assignments: Array<{
    id: string;
    title: string;
    class_name: string;
    progress: Array<{ student_id: string; status: string; correct_rate: number }>;
  }>;
  report: {
    classCount: number;
    studentCount: number;
    assignmentCount: number;
    averageCompletion: number;
    wrongQuestions: Array<{ prompt: string; poem_title: string; wrong_count: number }>;
    questionStats: Array<{ prompt: string; poem_title: string; answer_count: number; correct_count: number; correct_rate: number }>;
  };
}

export interface DemoUser {
  id: string;
  role: 'student' | 'teacher' | 'editor' | 'admin';
  display_name: string;
  email: string;
  status: string;
}

export interface StudentReport extends ProgressPayload {
  user: DemoUser;
  assignmentProgress: Array<{ assignment_title: string; class_name: string; status: string; correct_rate: number }>;
}
