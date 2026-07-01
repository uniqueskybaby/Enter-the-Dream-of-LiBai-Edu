import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function openEduDatabase(dbPath) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

export function nowIso() {
  return new Date().toISOString();
}

export function json(value) {
  return JSON.stringify(value ?? null);
}

export function parseJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS edu_schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_users (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_edu_users_role ON edu_users(role, status);

    CREATE TABLE IF NOT EXISTS edu_auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES edu_users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_edu_auth_sessions_token ON edu_auth_sessions(token, expires_at, revoked_at);

    CREATE TABLE IF NOT EXISTS edu_rate_limit_buckets (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      action_key TEXT NOT NULL,
      window_start TEXT NOT NULL,
      request_count INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(actor_id, action_key, window_start)
    );

    CREATE TABLE IF NOT EXISTS edu_operation_audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      status TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_edu_audit_logs_target ON edu_operation_audit_logs(target_type, target_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_edu_audit_logs_actor ON edu_operation_audit_logs(actor_id, created_at);

    CREATE TABLE IF NOT EXISTS edu_authors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dynasty TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_poems (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL REFERENCES edu_authors(id),
      title TEXT NOT NULL,
      dynasty TEXT NOT NULL,
      full_text TEXT NOT NULL,
      highlight_line TEXT NOT NULL,
      stage TEXT NOT NULL,
      grade TEXT NOT NULL,
      semester TEXT NOT NULL,
      unit_title TEXT NOT NULL,
      lesson_position TEXT NOT NULL,
      learning_objectives_json TEXT NOT NULL,
      annotations_json TEXT NOT NULL,
      translation TEXT NOT NULL,
      background TEXT NOT NULL,
      theme TEXT NOT NULL,
      exam_points_json TEXT NOT NULL,
      motifs_json TEXT NOT NULL,
      places_json TEXT NOT NULL,
      writing_points_json TEXT NOT NULL,
      cover_url TEXT NOT NULL,
      source_game_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_poem_lines (
      id TEXT PRIMARY KEY,
      poem_id TEXT NOT NULL REFERENCES edu_poems(id) ON DELETE CASCADE,
      line_order INTEGER NOT NULL,
      text TEXT NOT NULL,
      pinyin TEXT NOT NULL DEFAULT '',
      commentary TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS edu_textbooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      publisher TEXT NOT NULL,
      version TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_textbook_volumes (
      id TEXT PRIMARY KEY,
      textbook_id TEXT NOT NULL REFERENCES edu_textbooks(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      grade TEXT NOT NULL,
      semester TEXT NOT NULL,
      label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published'
    );

    CREATE TABLE IF NOT EXISTS edu_textbook_units (
      id TEXT PRIMARY KEY,
      volume_id TEXT NOT NULL REFERENCES edu_textbook_volumes(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      unit_order INTEGER NOT NULL,
      learning_goal TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS edu_unit_poems (
      id TEXT PRIMARY KEY,
      unit_id TEXT NOT NULL REFERENCES edu_textbook_units(id) ON DELETE CASCADE,
      poem_id TEXT NOT NULL REFERENCES edu_poems(id) ON DELETE CASCADE,
      lesson_no TEXT NOT NULL,
      position_label TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      UNIQUE(unit_id, poem_id)
    );

    CREATE TABLE IF NOT EXISTS edu_knowledge_points (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      grade_band TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'published',
      UNIQUE(type, name)
    );

    CREATE TABLE IF NOT EXISTS edu_motifs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS edu_places (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS edu_poem_knowledge_links (
      id TEXT PRIMARY KEY,
      poem_id TEXT NOT NULL REFERENCES edu_poems(id) ON DELETE CASCADE,
      knowledge_point_id TEXT NOT NULL REFERENCES edu_knowledge_points(id) ON DELETE CASCADE,
      link_reason TEXT NOT NULL DEFAULT '',
      UNIQUE(poem_id, knowledge_point_id)
    );

    CREATE TABLE IF NOT EXISTS edu_poem_relations (
      id TEXT PRIMARY KEY,
      from_poem_id TEXT NOT NULL REFERENCES edu_poems(id) ON DELETE CASCADE,
      to_poem_id TEXT NOT NULL REFERENCES edu_poems(id) ON DELETE CASCADE,
      relation_type TEXT NOT NULL,
      label TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      UNIQUE(from_poem_id, to_poem_id, relation_type)
    );

    CREATE TABLE IF NOT EXISTS edu_assets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      source TEXT NOT NULL,
      source_note TEXT NOT NULL DEFAULT '',
      prompt TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_asset_usages (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL REFERENCES edu_assets(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      usage_kind TEXT NOT NULL,
      UNIQUE(asset_id, target_type, target_id, usage_kind)
    );

    CREATE TABLE IF NOT EXISTS edu_lessons (
      id TEXT PRIMARY KEY,
      poem_id TEXT NOT NULL REFERENCES edu_poems(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      grade_band TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_lesson_steps (
      id TEXT PRIMARY KEY,
      lesson_id TEXT NOT NULL REFERENCES edu_lessons(id) ON DELETE CASCADE,
      step_key TEXT NOT NULL,
      title TEXT NOT NULL,
      step_order INTEGER NOT NULL,
      objective TEXT NOT NULL,
      content_json TEXT NOT NULL,
      asset_id TEXT REFERENCES edu_assets(id) ON DELETE SET NULL,
      UNIQUE(lesson_id, step_key)
    );

    CREATE TABLE IF NOT EXISTS edu_lesson_scene_nodes (
      id TEXT PRIMARY KEY,
      lesson_id TEXT NOT NULL REFERENCES edu_lessons(id) ON DELETE CASCADE,
      source_node_id TEXT NOT NULL,
      title TEXT NOT NULL,
      scene_order INTEGER NOT NULL,
      panorama_url TEXT NOT NULL,
      education_focus_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_lesson_interactions (
      id TEXT PRIMARY KEY,
      step_id TEXT NOT NULL REFERENCES edu_lesson_steps(id) ON DELETE CASCADE,
      question_id TEXT REFERENCES edu_questions(id) ON DELETE SET NULL,
      prompt TEXT NOT NULL,
      interaction_type TEXT NOT NULL,
      answer_json TEXT NOT NULL,
      explanation TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_questions (
      id TEXT PRIMARY KEY,
      poem_id TEXT NOT NULL REFERENCES edu_poems(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      answer TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      explanation TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_question_options (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES edu_questions(id) ON DELETE CASCADE,
      option_order INTEGER NOT NULL,
      label TEXT NOT NULL,
      text TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS edu_question_links (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES edu_questions(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      link_reason TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS edu_learning_sessions (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      poem_id TEXT NOT NULL REFERENCES edu_poems(id) ON DELETE CASCADE,
      lesson_id TEXT NOT NULL REFERENCES edu_lessons(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'in_progress',
      progress_step TEXT NOT NULL DEFAULT 'read',
      started_at TEXT NOT NULL,
      completed_at TEXT,
      mastery_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS edu_student_answers (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES edu_learning_sessions(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES edu_questions(id) ON DELETE CASCADE,
      student_answer TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      answered_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_mastery_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      knowledge_point_id TEXT NOT NULL REFERENCES edu_knowledge_points(id) ON DELETE CASCADE,
      poem_id TEXT NOT NULL REFERENCES edu_poems(id) ON DELETE CASCADE,
      mastery_level REAL NOT NULL DEFAULT 0,
      evidence_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL,
      UNIQUE(student_id, knowledge_point_id, poem_id)
    );

    CREATE TABLE IF NOT EXISTS edu_review_queue (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      poem_id TEXT NOT NULL REFERENCES edu_poems(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      due_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS edu_classes (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      name TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE,
      textbook_id TEXT REFERENCES edu_textbooks(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_class_members (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES edu_classes(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      UNIQUE(class_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS edu_assignments (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES edu_classes(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      due_at TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_assignment_items (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES edu_assignments(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_assignment_progress (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES edu_assignments(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'assigned',
      correct_rate REAL NOT NULL DEFAULT 0,
      completed_at TEXT,
      UNIQUE(assignment_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS edu_content_versions (
      id TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      content_id TEXT NOT NULL,
      version_no INTEGER NOT NULL,
      body_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      author_id TEXT NOT NULL DEFAULT 'editor-demo',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_content_reviews (
      id TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      content_id TEXT NOT NULL,
      version_id TEXT REFERENCES edu_content_versions(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewer_id TEXT,
      review_note TEXT NOT NULL DEFAULT '',
      reviewed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_ai_generation_jobs (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      input_json TEXT NOT NULL DEFAULT '{}',
      output_json TEXT NOT NULL DEFAULT '{}',
      review_required INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_publish_logs (
      id TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      content_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_poet_dialogue_profiles (
      id TEXT PRIMARY KEY,
      poem_id TEXT NOT NULL REFERENCES edu_poems(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES edu_authors(id) ON DELETE CASCADE,
      grade_band TEXT NOT NULL,
      role_name TEXT NOT NULL,
      role_summary TEXT NOT NULL,
      avatar_asset_id TEXT REFERENCES edu_assets(id) ON DELETE SET NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(poem_id)
    );

    CREATE TABLE IF NOT EXISTS edu_poet_system_prompts (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES edu_poet_dialogue_profiles(id) ON DELETE CASCADE,
      version_no INTEGER NOT NULL,
      stage_key TEXT NOT NULL,
      prompt_body TEXT NOT NULL,
      safety_rules_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_review',
      writer_id TEXT NOT NULL DEFAULT 'editor-demo',
      reviewer_id TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(profile_id, version_no, stage_key)
    );

    CREATE TABLE IF NOT EXISTS edu_poet_context_facts (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES edu_poet_dialogue_profiles(id) ON DELETE CASCADE,
      fact_type TEXT NOT NULL,
      fact_text TEXT NOT NULL,
      source_note TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS edu_poet_suggested_questions (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES edu_poet_dialogue_profiles(id) ON DELETE CASCADE,
      question_order INTEGER NOT NULL,
      text TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_poet_dialogue_sessions (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      poem_id TEXT NOT NULL REFERENCES edu_poems(id) ON DELETE CASCADE,
      lesson_id TEXT REFERENCES edu_lessons(id) ON DELETE SET NULL,
      step_key TEXT NOT NULL DEFAULT '',
      profile_id TEXT NOT NULL REFERENCES edu_poet_dialogue_profiles(id) ON DELETE CASCADE,
      prompt_version_id TEXT NOT NULL REFERENCES edu_poet_system_prompts(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_poet_dialogue_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES edu_poet_dialogue_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      cited_context_json TEXT NOT NULL DEFAULT '[]',
      safety_result_json TEXT NOT NULL DEFAULT '{}',
      added_to_note INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_poet_dialogue_feedback (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES edu_poet_dialogue_messages(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edu_learning_notes (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      poem_id TEXT NOT NULL REFERENCES edu_poems(id) ON DELETE CASCADE,
      dialogue_message_id TEXT REFERENCES edu_poet_dialogue_messages(id) ON DELETE SET NULL,
      note_text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    INSERT OR IGNORE INTO edu_schema_migrations (version, name, applied_at)
    VALUES (1, 'education-edition-initial-schema', '${nowIso()}');
  `);
}

export function randomId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizePoemRow(row) {
  if (!row) return null;
  return {
    ...row,
    learningObjectives: parseJson(row.learning_objectives_json, []),
    annotations: parseJson(row.annotations_json, []),
    examPoints: parseJson(row.exam_points_json, []),
    motifs: parseJson(row.motifs_json, []),
    places: parseJson(row.places_json, []),
    writingPoints: parseJson(row.writing_points_json, []),
  };
}
