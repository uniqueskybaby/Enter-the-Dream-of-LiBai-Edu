import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Database,
  GitBranch,
  GraduationCap,
  Home,
  LibraryBig,
  MessageCircle,
  Network,
  PenLine,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { api, getEduSession } from './lib/api';
import type { Catalog, DemoUser, DialogueSession, GraphPayload, Interaction, LearningSession, Lesson, Poem, PoetDialogueProfile, ProgressPayload, StudentReport, TeacherReport } from './types';
import { PanoramaStage } from './immersive/PanoramaStage';
import type { HotspotConfig, PanoramaGameConfig, PanoramaNode, ViewState } from './immersive/gameTypes';

type RouteName = 'home' | 'catalog' | 'poem' | 'learn' | 'graph' | 'profile' | 'teacher' | 'admin';

interface AppState {
  catalogs: Catalog[];
  poems: Poem[];
  loading: boolean;
  error: string | null;
}

const navItems = [
  ['/edu', '学习首页', Home],
  ['/edu/catalog', '教材目录', LibraryBig],
  ['/edu/graph', '诗词星图', Network],
  ['/edu/profile', '学习记录', ClipboardList],
  ['/edu/teacher', '教师工作台', Users],
  ['/edu/admin/content/poems', '内容后台', Database],
] as const;

export default function App() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));
  const [state, setState] = useState<AppState>({ catalogs: [], poems: [], loading: true, error: null });
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [sessionUser, setSessionUser] = useState<DemoUser | null>(null);

  useEffect(() => {
    const onPop = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    if (!window.location.pathname.startsWith('/edu')) navigate('/edu', true);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([api.catalogs(), api.poems(), api.demoUsers()])
      .then(async ([catalogs, poems, demoUsers]) => {
        if (!alive) return;
        const storedSession = getEduSession();
        const defaultUser = demoUsers.users.find((user) => user.role === 'student') || demoUsers.users[0] || null;
        let activeUser = storedSession?.user || defaultUser;
        if (!storedSession && defaultUser) {
          const { session } = await api.demoLogin({ userId: defaultUser.id });
          activeUser = session.user;
        }
        if (!alive) return;
        setState({ catalogs: catalogs.catalogs, poems: poems.poems, loading: false, error: null });
        setUsers(demoUsers.users);
        setSessionUser(activeUser);
      })
      .catch((error) => {
        if (!alive) return;
        setState((prev) => ({ ...prev, loading: false, error: error instanceof Error ? error.message : '加载失败' }));
      });
    return () => {
      alive = false;
    };
  }, []);

  const route = parseRoute(path);
  const currentPoem = route.name === 'poem' && route.id ? state.poems.find((poem) => poem.id === route.id) : state.poems[0];

  function navigate(nextPath: string, replace = false) {
    const normalized = normalizePath(nextPath);
    if (replace) window.history.replaceState({}, '', normalized);
    else window.history.pushState({}, '', normalized);
    setPath(normalized);
  }

  if (state.loading) return <LoadingScreen />;

  return (
    <div className={`edu-app edu-app--${route.name}`}>
      <aside className="edu-sidebar">
        <a className="brand" href="/edu" onClick={(event) => handleNav(event, '/edu', navigate)}>
          <img src="/assets/ui/libai-avatar.jpg" alt="李白头像" />
          <span>
            <strong>入梦李白教育版</strong>
            <small>独立学习平台</small>
          </span>
        </a>
        <nav>
          {navItems.map(([href, label, Icon]) => (
            <a
              key={href}
              className={path === href || (href !== '/edu' && path.startsWith(href.split('/').slice(0, 3).join('/'))) ? 'active' : ''}
              href={href}
              onClick={(event) => handleNav(event, href, navigate)}
            >
              <Icon size={18} />
              {label}
            </a>
          ))}
        </nav>
        <div className="sidebar-proof">
          <ShieldCheck size={18} />
          <span>独立端口、独立数据库、独立资源副本</span>
        </div>
      </aside>

      <main className="edu-main">
        <header className="topline">
          <div>
            <span className="eyebrow">MVP 样板包</span>
            <h1>{titleFor(route.name)}</h1>
          </div>
          <div className="topline__stats">
            <Metric label="诗词" value={state.poems.length} />
            <Metric label="教材包" value={state.catalogs.length} />
            <Metric label="学习入口" value="6 步" />
          </div>
        </header>

        <DemoLogin users={users} currentUser={sessionUser} onLogin={setSessionUser} />

        {state.error ? <Notice tone="error" text={state.error} /> : null}

        {route.name === 'home' ? <HomePage poems={state.poems} catalogs={state.catalogs} navigate={navigate} /> : null}
        {route.name === 'catalog' ? <CatalogPage catalogs={state.catalogs} poems={state.poems} navigate={navigate} /> : null}
        {route.name === 'poem' && route.id ? <PoemPage poemId={route.id} navigate={navigate} fallback={currentPoem} /> : null}
        {route.name === 'learn' && route.id ? <LearnPage lessonId={route.id} navigate={navigate} /> : null}
        {route.name === 'graph' ? <GraphPage navigate={navigate} /> : null}
        {route.name === 'profile' ? <ProfilePage navigate={navigate} studentId={sessionUser?.role === 'student' ? sessionUser.id : 'student-demo'} /> : null}
        {route.name === 'teacher' ? <TeacherPage poems={state.poems} /> : null}
        {route.name === 'admin' ? <AdminPage poems={state.poems} /> : null}
      </main>
    </div>
  );
}

function normalizePath(pathname: string) {
  if (!pathname.startsWith('/edu')) return '/edu';
  return pathname.replace(/\/+$/, '') || '/edu';
}

function parseRoute(pathname: string): { name: RouteName; id?: string } {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[1] === 'catalog') return { name: 'catalog', id: parts[2] };
  if (parts[1] === 'poems') return { name: 'poem', id: parts[2] };
  if (parts[1] === 'learn') return { name: 'learn', id: parts[2] };
  if (parts[1] === 'graph') return { name: 'graph' };
  if (parts[1] === 'profile') return { name: 'profile' };
  if (parts[1] === 'teacher') return { name: 'teacher' };
  if (parts[1] === 'admin') return { name: 'admin' };
  return { name: 'home' };
}

function titleFor(route: RouteName) {
  return {
    home: '学习工作台',
    catalog: '教材目录',
    poem: '诗词学习页',
    learn: '360°沉浸诗境',
    graph: '诗词星图',
    profile: '我的学习记录',
    teacher: '教师工作台',
    admin: '内容管理后台',
  }[route];
}

function handleNav(event: React.MouseEvent<HTMLAnchorElement>, href: string, navigate: (path: string) => void) {
  event.preventDefault();
  navigate(href);
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <Sparkles size={38} />
      <strong>教育版正在载入</strong>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'error' | 'success' }) {
  return <div className={`notice notice--${tone}`}>{text}</div>;
}

function DemoLogin({ users, currentUser, onLogin }: { users: DemoUser[]; currentUser: DemoUser | null; onLogin: (user: DemoUser) => void }) {
  const [busy, setBusy] = useState(false);

  async function login(userId: string) {
    setBusy(true);
    try {
      const { session } = await api.demoLogin({ userId });
      onLogin(session.user);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="demo-login">
      <span className="eyebrow">演示账号</span>
      <select disabled={busy} value={currentUser?.id || ''} onChange={(event) => void login(event.target.value)}>
        {users.map((user) => (
          <option key={user.id} value={user.id}>{roleName(user.role)} · {user.display_name}</option>
        ))}
      </select>
      <span>{currentUser ? `${roleName(currentUser.role)}路径已选中` : '请选择角色'}</span>
    </section>
  );
}

function roleName(role: string) {
  return {
    student: '学生',
    teacher: '教师',
    editor: '编辑',
    admin: '管理员',
  }[role] || role;
}

function HomePage({ poems, catalogs, navigate }: { poems: Poem[]; catalogs: Catalog[]; navigate: (path: string) => void }) {
  const featured = poems.slice(0, 6);
  const firstLesson = featured[0]?.lesson_id;
  return (
    <div className="page-grid">
      <section className="hero-panel dream-entry">
        <img src="/assets/ui/cover-lushan.jpg" alt="庐山瀑布诗境" />
        <div className="hero-panel__content">
          <span className="eyebrow">沉浸式古诗学习故事平台</span>
          <h2>先入诗境，再学诗意。</h2>
          <p>从全景诗境进入课堂学习，在画面、意象、写法和诗人问答之间读懂一首诗。</p>
          <div className="hero-actions">
            {firstLesson ? (
              <button onClick={() => navigate(`/edu/learn/${firstLesson}`)}>
                <Sparkles size={18} />
                开始入梦学习
              </button>
            ) : null}
            <button className="secondary" onClick={() => navigate('/edu/catalog')}>
              <BookOpen size={18} />
              进入教材目录
            </button>
          </div>
          <div className="dream-entry__runes">
            {['诗境', '问诗人', '星图', '复盘'].map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="section-title">
          <div>
            <span className="eyebrow">样板教材</span>
            <h2>{catalogs[0]?.name || '李白经典诗词学习包'}</h2>
          </div>
          <button className="ghost" onClick={() => navigate('/edu/catalog')}>
            查看目录
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="workflow-strip">
          {['读诗', '入境', '解意', '探究', '连接', '复盘'].map((step, index) => (
            <div key={step} className="workflow-step">
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="band">
        <div className="section-title">
          <div>
            <span className="eyebrow">诗库</span>
            <h2>已导入的诗境素材</h2>
          </div>
          <button className="ghost" onClick={() => navigate('/edu/graph')}>
            打开星图
            <GitBranch size={16} />
          </button>
        </div>
        <div className="poem-grid">
          {featured.map((poem) => (
            <PoemCard key={poem.id} poem={poem} navigate={navigate} />
          ))}
        </div>
      </section>
    </div>
  );
}

function CatalogPage({ catalogs, poems, navigate }: { catalogs: Catalog[]; poems: Poem[]; navigate: (path: string) => void }) {
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState('');
  const [grade, setGrade] = useState('');
  const [semester, setSemester] = useState('');
  const [author, setAuthor] = useState('');
  const themes = Array.from(new Set(poems.map((poem) => poem.theme))).filter(Boolean);
  const grades = Array.from(new Set(poems.map((poem) => poem.grade))).filter(Boolean);
  const semesters = Array.from(new Set(poems.map((poem) => poem.semester))).filter(Boolean);
  const authors = Array.from(new Set(poems.map((poem) => poem.author_name))).filter(Boolean);
  const filtered = poems.filter((poem) =>
    (!query || `${poem.title}${poem.highlight_line}`.includes(query)) &&
    (!theme || poem.theme === theme || poem.motifs.includes(theme)) &&
    (!grade || poem.grade === grade || poem.stage === grade) &&
    (!semester || poem.semester === semester) &&
    (!author || poem.author_name === author),
  );

  return (
    <div className="page-grid">
      <section className="toolbar">
        <label>
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索诗题、诗句" />
        </label>
        <select value={theme} onChange={(event) => setTheme(event.target.value)}>
          <option value="">全部主题</option>
          {themes.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={grade} onChange={(event) => setGrade(event.target.value)}>
          <option value="">全部年级</option>
          {grades.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={semester} onChange={(event) => setSemester(event.target.value)}>
          <option value="">全部册次</option>
          {semesters.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={author} onChange={(event) => setAuthor(event.target.value)}>
          <option value="">全部作者</option>
          {authors.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </section>

      {catalogs.map((catalog) => (
        <section className="band" key={catalog.id}>
          <div className="section-title">
            <div>
              <span className="eyebrow">{catalog.publisher}</span>
              <h2>{catalog.name}</h2>
            </div>
            <span className="pill">{catalog.version}</span>
          </div>
          <div className="catalog-stack">
            {catalog.volumes.map((volume) => (
              <div className="volume-row" key={volume.id}>
                <div className="volume-label">
                  <strong>{volume.grade}{volume.semester}</strong>
                  <span>{volume.stage}</span>
                </div>
                <div className="unit-list">
                  {volume.units.map((unit) => (
                    <div className="unit-block" key={unit.id}>
                      <h3>{unit.title}</h3>
                      <p>{unit.learning_goal}</p>
                      <div className="mini-poems">
                        {unit.poems.map((poem) => (
                          <button key={poem.id} onClick={() => navigate(`/edu/poems/${poem.id}`)}>
                            {poem.title}
                            <ChevronRight size={14} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="band">
        <div className="section-title">
          <h2>筛选结果</h2>
          <span className="pill">{filtered.length} 首</span>
        </div>
        <div className="poem-grid">
          {filtered.map((poem) => <PoemCard key={poem.id} poem={poem} navigate={navigate} />)}
        </div>
      </section>
    </div>
  );
}

function PoemCard({ poem, navigate }: { poem: Poem; navigate: (path: string) => void }) {
  return (
    <article className="poem-card">
      <img src={poem.cover_url} alt={poem.title} />
      <div>
        <span>{poem.grade}{poem.semester} · {poem.theme}</span>
        <h3>{poem.title}</h3>
        <p>{poem.highlight_line}</p>
      </div>
      <div className="card-actions">
        <button className="ghost" onClick={() => navigate(`/edu/poems/${poem.id}`)}>详情</button>
        {poem.lesson_id ? <button onClick={() => navigate(`/edu/learn/${poem.lesson_id}`)}>学习</button> : null}
      </div>
    </article>
  );
}

function PoemPage({ poemId, fallback, navigate }: { poemId: string; fallback?: Poem; navigate: (path: string) => void }) {
  const [poem, setPoem] = useState<Poem | undefined>(fallback);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.poem(poemId)
      .then(({ poem: detail }) => alive && setPoem(detail))
      .catch((err) => alive && setError(err instanceof Error ? err.message : '诗词加载失败'));
    return () => {
      alive = false;
    };
  }, [poemId]);

  if (error) return <Notice tone="error" text={error} />;
  if (!poem) return <LoadingScreen />;

  return (
    <div className="detail-layout">
      <section className="poem-detail">
        <img className="detail-cover" src={poem.cover_url} alt={poem.title} />
        <div className="poem-detail__body">
          <span className="eyebrow">{poem.author_name} · {poem.dynasty} · {poem.grade}{poem.semester}</span>
          <h2>{poem.title}</h2>
          <blockquote>{poem.full_text}</blockquote>
          <div className="tag-row">
            {[poem.theme, ...poem.motifs.slice(0, 4), ...poem.writingPoints.slice(0, 2)].map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          <div className="split">
            <InfoBlock title="学习目标" items={poem.learningObjectives} />
            <InfoBlock title="考点" items={poem.examPoints} />
          </div>
          <div className="annotation-list">
            <h3>注释与译文</h3>
            <p>{poem.translation}</p>
            {poem.annotations.map((item) => (
              <div key={item.term}>
                <strong>{item.term}</strong>
                <span>{item.meaning}</span>
              </div>
            ))}
          </div>
          <div className="hero-actions">
            {poem.lesson_id ? (
              <button onClick={() => navigate(`/edu/learn/${poem.lesson_id}`)}>
                <Sparkles size={18} />
                进入六步学习
              </button>
            ) : null}
            <button className="secondary" onClick={() => navigate('/edu/graph')}>
              <Network size={18} />
              查看关系
            </button>
          </div>
        </div>
      </section>

      <aside className="side-stack">
        <AskPoet poemId={poem.id} lessonId={poem.lesson_id} />
        <section className="side-panel">
          <h3>关联诗词</h3>
          {(poem.relations || []).slice(0, 5).map((relation) => (
            <button key={relation.id} className="relation-link" onClick={() => navigate(`/edu/poems/${relation.to_poem_id}`)}>
              <span>{relation.label}</span>
              <strong>{relation.title}</strong>
            </button>
          ))}
        </section>
      </aside>
    </div>
  );
}

function InfoBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="info-block">
      <h3>{title}</h3>
      {items.map((item) => <p key={item}>{item}</p>)}
    </div>
  );
}

function LearnPage({ lessonId, navigate }: { lessonId: string; navigate: (path: string) => void }) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [config, setConfig] = useState<PanoramaGameConfig | null>(null);
  const [session, setSession] = useState<LearningSession | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, { correct: boolean; explanation: string }>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [poetOpen, setPoetOpen] = useState(false);
  const [view, setView] = useState<ViewState>({ yaw: 0, pitch: 0, fov: 95 });

  useEffect(() => {
    let alive = true;
    setLesson(null);
    setConfig(null);
    setSession(null);
    setCurrentNodeId(null);
    setSelectedHotspotId(null);
    setMessage(null);

    api.lesson(lessonId)
      .then(async ({ lesson: detail }) => {
        if (!alive) return undefined;
        setLesson(detail);
        const response = await fetch(`/data/${detail.source_game_id}.json`);
        if (!response.ok) throw new Error('全景诗境资源加载失败');
        const nextConfig = await response.json() as PanoramaGameConfig;
        if (!alive) return undefined;
        const startNode = nextConfig.nodes.find((node) => node.id === nextConfig.startNodeId) || nextConfig.nodes[0];
        setConfig(nextConfig);
        setCurrentNodeId(startNode?.id || null);
        return api.createLearningSession({ poemId: detail.poem_id, lessonId: detail.id });
      })
      .then((created) => {
        if (alive && created) setSession(created.session);
      })
      .catch((error) => {
        if (alive) setMessage(error instanceof Error ? error.message : '全景学习加载失败');
      });
    return () => {
      alive = false;
    };
  }, [lessonId]);

  const currentNode = useMemo(() => {
    if (!config) return null;
    return config.nodes.find((node) => node.id === currentNodeId) || config.nodes[0] || null;
  }, [config, currentNodeId]);

  const selectedHotspot = useMemo(() => (
    currentNode?.hotspots.find((hotspot) => hotspot.id === selectedHotspotId) || null
  ), [currentNode, selectedHotspotId]);

  const focus = useMemo(() => (
    lesson && currentNode && selectedHotspot
      ? buildHotspotFocus(lesson, config, currentNode, selectedHotspot)
      : null
  ), [lesson, config, currentNode, selectedHotspot]);

  if (!lesson || !config || !currentNode) {
    return (
      <div className="panorama-learn panorama-learn--loading">
        <LoadingScreen />
        {message ? <Notice tone="error" text={message} /> : null}
      </div>
    );
  }

  const activeStep = focus?.step || lesson.steps[activeStepIndex] || lesson.steps[0];
  const interaction = focus?.interaction || activeStep?.interactions[0] || null;
  const story = selectedHotspot ? config.stories[selectedHotspot.storyId] : null;
  const puzzle = selectedHotspot ? config.puzzles?.[selectedHotspot.id] : null;
  const answeredCount = Object.keys(results).length;
  const progress = Math.min(100, Math.round((answeredCount / Math.max(lesson.steps.length, 1)) * 100));
  const ambientLine = currentNode.ambientLine || config.poem.line || lesson.highlight_line;

  function handleHotspotClick(hotspotId: string) {
    const index = currentNode?.hotspots.findIndex((hotspot) => hotspot.id === hotspotId) ?? 0;
    setSelectedHotspotId(hotspotId);
    setActiveStepIndex(Math.max(0, index));
  }

  async function submitAnswer(target: Interaction) {
    if (!session || !activeStep) return;
    const value = answers[target.question_id] || '';
    if (!value.trim()) return;
    const result = await api.answer({
      sessionId: session.id,
      questionId: target.question_id,
      answer: value,
      stepKey: activeStep.step_key,
    });
    setResults((prev) => ({ ...prev, [target.question_id]: result }));
  }

  async function finish() {
    if (!session || !lesson) return;
    const completed = await api.completeLearning(session.id, { completedSteps: lesson.steps.map((item) => item.step_key) });
    setSession(completed.session);
    setMessage('学习记录已生成，教师端可以查看这次诗境学习。');
  }

  return (
    <div className="panorama-learn">
      <PanoramaStage
        node={currentNode}
        locked={false}
        onHotspotClick={handleHotspotClick}
        onViewChange={setView}
        onCloseModal={() => {
          setSelectedHotspotId(null);
          setPoetOpen(false);
        }}
      />

      <div className="panorama-vignette" aria-hidden="true" />

      <button className="world-back" onClick={() => navigate('/edu/catalog')}>
        <ChevronRight size={18} />
        返回目录
      </button>

      <section className="world-hud">
        <span className="eyebrow">360°诗境</span>
        <h1>{lesson.poem_title}</h1>
        <p>{ambientLine}</p>
        <div className="world-progress" aria-label={`学习进度 ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </section>

      <div className="world-step-dots" aria-label="学习环节">
        {lesson.steps.map((item, index) => (
          <button
            key={item.id}
            className={index === activeStepIndex ? 'active' : ''}
            onClick={() => setActiveStepIndex(index)}
            title={item.title}
          >
            <span>{index + 1}</span>
          </button>
        ))}
      </div>

      {selectedHotspot && activeStep ? (
        <section className="world-question-panel">
          <button className="world-panel-close" onClick={() => setSelectedHotspotId(null)} aria-label="关闭探究题">
            <X size={18} />
          </button>
          <div className="world-panel-title">
            <span className="eyebrow">{selectedHotspot.label} · {activeStep.objective}</span>
            <h2>{activeStep.title}</h2>
          </div>
          <p>{story?.text || puzzle?.clueText || activeStep.content.text}</p>
          <blockquote>{lesson.highlight_line}</blockquote>

          {interaction ? (
            <div className="world-interaction" key={interaction.id}>
              <h3>{interaction.question_prompt || interaction.prompt || puzzle?.question}</h3>
              {interaction.options.length ? (
                <div className="world-option-grid">
                  {interaction.options.map((option) => (
                    <button
                      key={option.id}
                      className={answers[interaction.question_id] === option.label ? 'selected' : ''}
                      onClick={() => setAnswers((prev) => ({ ...prev, [interaction.question_id]: option.label }))}
                    >
                      <b>{option.label}</b>
                      <span>{option.text}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  value={answers[interaction.question_id] || ''}
                  onChange={(event) => setAnswers((prev) => ({ ...prev, [interaction.question_id]: event.target.value }))}
                  placeholder="写下你在诗境中读到的画面"
                />
              )}
              <button className="world-primary" onClick={() => void submitAnswer(interaction)}>
                <CheckCircle2 size={16} />
                记录理解
              </button>
              {results[interaction.question_id] ? (
                <Notice
                  tone={results[interaction.question_id].correct ? 'success' : 'info'}
                  text={`${results[interaction.question_id].correct ? '理解到位。' : '已记录待复习。'}${results[interaction.question_id].explanation}`}
                />
              ) : null}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="world-ambient-panel">
          <span>{config.world.worldName}</span>
          <strong>{currentNode.title}</strong>
          <p>{currentNode.subtitle || lesson.summary}</p>
        </section>
      )}

      <button className={`poet-summon ${poetOpen ? 'active' : ''}`} onClick={() => setPoetOpen((value) => !value)}>
        <img src="/assets/ui/libai-avatar.jpg" alt="诗人头像" />
        <span>问诗人</span>
      </button>

      <AskPoet poemId={lesson.poem_id} lessonId={lesson.id} stepKey={activeStep?.step_key} immersive open={poetOpen} onClose={() => setPoetOpen(false)} />

      <section className="dream-report-chip">
        <Metric label="已记录" value={answeredCount} />
        <Metric label="视角" value={`${Math.round(view.yaw)}°`} />
        <Metric label="状态" value={session?.status === 'completed' ? '完成' : '学习中'} />
        <button className="world-finish" onClick={() => void finish()}>生成记录</button>
      </section>
      {message ? <div className="world-toast"><Notice tone="success" text={message} /></div> : null}
    </div>
  );
}

function buildHotspotFocus(lesson: Lesson, config: PanoramaGameConfig | null, node: PanoramaNode, hotspot: HotspotConfig) {
  const index = Math.max(0, node.hotspots.findIndex((item) => item.id === hotspot.id));
  const interactionEntries = lesson.steps.flatMap((step) => (
    step.interactions.map((interaction) => ({ step, interaction }))
  )).filter(({ interaction }) => Boolean(interaction.question_id));
  const puzzle = config?.puzzles?.[hotspot.id];
  const matched = interactionEntries.find(({ interaction }) => {
    const text = `${interaction.prompt}${interaction.question_prompt}${interaction.question_explanation}`;
    return text.includes(hotspot.label) || (puzzle?.motif ? text.includes(puzzle.motif) : false);
  });
  const entry = matched || interactionEntries[index % Math.max(interactionEntries.length, 1)];
  return {
    step: entry?.step || lesson.steps[Math.min(index + 1, lesson.steps.length - 1)] || lesson.steps[0],
    interaction: entry?.interaction || null,
  };
}

function AskPoet({ poemId, lessonId, stepKey, immersive = false, open = true, onClose }: { poemId: string; lessonId?: string; stepKey?: string; immersive?: boolean; open?: boolean; onClose?: () => void }) {
  const [profile, setProfile] = useState<PoetDialogueProfile | null>(null);
  const [session, setSession] = useState<DialogueSession | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.dialogueProfile(poemId)
      .then(({ profile: next }) => alive && setProfile(next))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [poemId]);

  async function ensureSession() {
    if (session) return session;
    const created = await api.createDialogue({ poemId, lessonId, stepKey });
    setSession(created.session);
    return created.session;
  }

  async function ask(text = input) {
    if (!text.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const current = await ensureSession();
      const response = await api.sendDialogueMessage(current.id, { message: text, stepKey });
      setSession(response.session);
      setInput('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '对话失败');
    } finally {
      setBusy(false);
    }
  }

  async function saveLastNote() {
    if (!session) return;
    const last = [...session.messages].reverse().find((message) => message.role === 'assistant');
    if (!last) return;
    await api.saveDialogueNote(session.id, { messageId: last.id });
    setNotice('已加入学习笔记');
  }

  return (
    <section className={`ask-poet ${immersive ? 'ask-poet--immersive' : ''} ${open ? 'ask-poet--open' : ''}`} aria-hidden={immersive && !open}>
      {immersive ? (
        <button className="poet-close" onClick={onClose} aria-label="关闭诗人对话">
          <X size={18} />
        </button>
      ) : null}
      <div className="ask-poet__head">
        <img src={profile?.avatar_url || '/assets/ui/libai-avatar.jpg'} alt="诗人头像" />
        <div>
          <span className="eyebrow">问诗人</span>
          <h3>{profile?.role_name || '诗人学习向导'}</h3>
        </div>
      </div>
      <p>{profile?.role_summary}</p>
      <div className="suggestion-list">
        {profile?.suggestedQuestions.slice(0, 4).map((item) => (
          <button key={item.id} onClick={() => void ask(item.text)}>{item.text}</button>
        ))}
      </div>
      <div className="message-list">
        {session?.messages.slice(-6).map((message) => (
          <div key={message.id} className={`message message--${message.role}`}>
            {message.content}
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="向当前诗境中的诗人提问" />
        <button disabled={busy} onClick={() => void ask()}>
          <Send size={16} />
        </button>
      </div>
      <button className="ghost full" onClick={() => void saveLastNote()}>
        <PenLine size={16} />
        保存关键问答
      </button>
      {profile?.prompt ? <span className="prompt-badge">Prompt v{profile.prompt.version_no} · {profile.prompt.status}</span> : null}
      {notice ? <Notice text={notice} tone="success" /> : null}
    </section>
  );
}

function GraphPage({ navigate }: { navigate: (path: string) => void }) {
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [filter, setFilter] = useState('');
  const [filterType, setFilterType] = useState<'theme' | 'motif' | 'author'>('theme');

  useEffect(() => {
    let alive = true;
    api.graph(filter ? `?${filterType}=${encodeURIComponent(filter)}` : '')
      .then((payload) => alive && setGraph(payload))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [filter, filterType]);

  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];
  const poemNodes = nodes.filter((node) => node.type === 'poem');
  const otherNodes = nodes.filter((node) => node.type !== 'poem');
  const positioned = useMemo(() => layoutNodes(nodes), [nodes]);

  return (
    <div className="page-grid">
      <section className="toolbar">
        <select value={filterType} onChange={(event) => setFilterType(event.target.value as 'theme' | 'motif' | 'author')}>
          <option value="theme">按主题</option>
          <option value="motif">按意象</option>
          <option value="author">按作者</option>
        </select>
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">全部关系</option>
          <option value="送别">送别</option>
          <option value="山水想象">山水想象</option>
          <option value="月">月</option>
          <option value="酒">酒</option>
          <option value="李白">李白</option>
        </select>
        <span className="pill">{nodes.length} 个节点 · {edges.length} 条关系</span>
      </section>
      <section className="graph-canvas">
        <svg viewBox="0 0 1000 620" aria-label="诗词星图关系线">
          {edges.map((edge) => {
            const from = positioned.get(edge.from);
            const to = positioned.get(edge.to);
            if (!from || !to) return null;
            return <line key={edge.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
          })}
        </svg>
        {nodes.map((node) => {
          const point = positioned.get(node.id);
          if (!point) return null;
          return (
            <button
              key={node.id}
              className={`graph-node graph-node--${node.type}`}
              style={{ left: `${point.x / 10}%`, top: `${point.y / 6.2}%` }}
              onClick={() => {
                if (node.type === 'poem') navigate(`/edu/poems/${node.id}`);
                else if (node.type === 'author') { setFilterType('author'); setFilter(node.label); }
                else if (node.type === 'motif') { setFilterType('motif'); setFilter(node.label); }
                else if (node.type === 'theme') { setFilterType('theme'); setFilter(node.label); }
              }}
            >
              {node.image ? <img src={node.image} alt="" /> : null}
              <strong>{node.label}</strong>
              <span>{node.type}</span>
            </button>
          );
        })}
      </section>
      <section className="band">
        <div className="split">
          <InfoBlock title="诗词节点" items={poemNodes.slice(0, 8).map((node) => node.label)} />
          <InfoBlock title="知识节点" items={otherNodes.slice(0, 8).map((node) => `${node.type} · ${node.label}`)} />
        </div>
      </section>
    </div>
  );
}

function layoutNodes(nodes: GraphPayload['nodes']) {
  const map = new Map<string, { x: number; y: number }>();
  const center = { x: 500, y: 310 };
  const poemNodes = nodes.filter((node) => node.type === 'poem');
  const otherNodes = nodes.filter((node) => node.type !== 'poem');
  poemNodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(1, poemNodes.length);
    map.set(node.id, { x: center.x + Math.cos(angle) * 235, y: center.y + Math.sin(angle) * 210 });
  });
  otherNodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(1, otherNodes.length);
    map.set(node.id, { x: center.x + Math.cos(angle) * 390, y: center.y + Math.sin(angle) * 270 });
  });
  return map;
}

function ProfilePage({ navigate, studentId }: { navigate: (path: string) => void; studentId: string }) {
  const [progress, setProgress] = useState<ProgressPayload | null>(null);

  useEffect(() => {
    let alive = true;
    api.progress(studentId).then((payload) => alive && setProgress(payload));
    return () => {
      alive = false;
    };
  }, [studentId]);

  if (!progress) return <LoadingScreen />;

  return (
    <div className="page-grid">
      <section className="report-band">
        <Metric label="已完成" value={progress.summary.completed} />
        <Metric label="学习中" value={progress.summary.inProgress} />
        <Metric label="正确率" value={`${Math.round(progress.summary.correctRate * 100)}%`} />
        <Metric label="笔记" value={progress.summary.noteCount} />
        <Metric label="待复习" value={progress.summary.reviewCount} />
      </section>
      <section className="band">
        <h2>学习记录</h2>
        <div className="record-list">
          {progress.sessions.map((session) => (
            <button key={session.id} onClick={() => navigate(`/edu/poems/${session.poem_id}`)}>
              <span>{session.status === 'completed' ? '已完成' : '学习中'}</span>
              <strong>{session.poem_title}</strong>
              <small>{session.answers.filter((answer) => !answer.is_correct).length} 道错题</small>
            </button>
          ))}
        </div>
      </section>
      <section className="band">
        <h2>待复习</h2>
        <div className="record-list">
          {progress.reviewQueue.length ? progress.reviewQueue.map((item) => (
            <button key={item.id} onClick={() => navigate(`/edu/poems/${item.poem_id}`)}>
              <span>{item.status}</span>
              <strong>{item.poem_title}</strong>
              <small>{item.reason}</small>
            </button>
          )) : <Notice text="暂无待复习内容。" />}
        </div>
      </section>
      <section className="band">
        <h2>知识点掌握</h2>
        <div className="mastery-grid">
          {progress.mastery.slice(0, 16).map((item) => (
            <div className="mastery-chip" key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.poem_title}</span>
              <b>{Math.round(item.mastery_level * 100)}%</b>
            </div>
          ))}
        </div>
      </section>
      <section className="band">
        <h2>对话笔记</h2>
        <div className="note-list">
          {progress.notes.map((note) => (
            <article key={note.id}>
              <strong>{note.poem_title}</strong>
              <p>{note.note_text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function TeacherPage({ poems }: { poems: Poem[] }) {
  const [report, setReport] = useState<TeacherReport | null>(null);
  const [studentReport, setStudentReport] = useState<StudentReport | null>(null);
  const [className, setClassName] = useState('新建诗词共读班');
  const [studentName, setStudentName] = useState('新同学');
  const [assignmentTitle, setAssignmentTitle] = useState('完成《望庐山瀑布》六步学习');
  const [targetPoemId, setTargetPoemId] = useState(poems[0]?.id || '');
  const firstClass = report?.classes[0];
  const selectedPoem = poems.find((poem) => poem.id === targetPoemId) || poems[0];

  function refresh() {
    api.teacherReports().then(setReport).catch(() => undefined);
  }

  useEffect(refresh, []);

  async function createClass() {
    await api.createClass({ name: className });
    refresh();
  }

  async function createAssignment() {
    await api.createAssignment({ title: assignmentTitle, classId: firstClass?.id, poemId: selectedPoem?.id });
    refresh();
  }

  async function addStudent() {
    if (!firstClass) return;
    await api.addStudent(firstClass.id, { studentName });
    refresh();
  }

  async function openStudentReport(studentId: string) {
    setStudentReport(await api.studentReport(studentId));
  }

  if (!report) return <LoadingScreen />;

  return (
    <div className="page-grid">
      <section className="report-band">
        <Metric label="班级" value={report.report.classCount} />
        <Metric label="学生" value={report.report.studentCount} />
        <Metric label="任务" value={report.report.assignmentCount} />
        <Metric label="完成率" value={`${Math.round(report.report.averageCompletion * 100)}%`} />
      </section>
      <section className="teacher-grid">
        <div className="form-panel">
          <h2>班级管理</h2>
          <input value={className} onChange={(event) => setClassName(event.target.value)} />
          <button onClick={() => void createClass()}>
            <Plus size={16} />
            创建班级
          </button>
          <input value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="学生姓名" />
          <button className="secondary" onClick={() => void addStudent()}>
            <Users size={16} />
            添加到最新班级
          </button>
          {report.classes.map((klass) => (
            <div className="class-row" key={klass.id}>
              <strong>{klass.name}</strong>
              <span>邀请码 {klass.invite_code}</span>
              <small>{klass.members.length} 名学生</small>
              <div className="student-chip-row">
                {klass.members.map((member) => (
                  <button key={member.student_id} className="ghost" onClick={() => void openStudentReport(member.student_id)}>
                    {member.student_name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="form-panel">
          <h2>任务管理</h2>
          <input value={assignmentTitle} onChange={(event) => setAssignmentTitle(event.target.value)} />
          <select value={targetPoemId} onChange={(event) => setTargetPoemId(event.target.value)}>
            {poems.map((poem) => <option key={poem.id} value={poem.id}>{poem.title}</option>)}
          </select>
          <button onClick={() => void createAssignment()}>
            <Plus size={16} />
            布置任务
          </button>
          {report.assignments.map((assignment) => (
            <div className="class-row" key={assignment.id}>
              <strong>{assignment.title}</strong>
              <span>{assignment.class_name}</span>
              <small>{assignment.progress.filter((item) => item.status === 'completed').length}/{assignment.progress.length} 完成</small>
            </div>
          ))}
        </div>
      </section>
      <section className="band">
        <h2>题目正确率</h2>
        <div className="record-list">
          {report.report.questionStats.length ? report.report.questionStats.map((item) => (
            <div className="wrong-row" key={item.prompt}>
              <strong>{item.poem_title}</strong>
              <span>{item.prompt}</span>
              <b>{Math.round(item.correct_rate * 100)}%</b>
            </div>
          )) : <Notice text="暂无作答数据，学生作答后会自动汇总。" />}
        </div>
      </section>
      <section className="band">
        <h2>错题排行</h2>
        <div className="record-list">
          {report.report.wrongQuestions.length ? report.report.wrongQuestions.map((item) => (
            <div className="wrong-row" key={item.prompt}>
              <strong>{item.poem_title}</strong>
              <span>{item.prompt}</span>
              <b>{item.wrong_count}</b>
            </div>
          )) : <Notice text="暂无错题数据。" />}
        </div>
      </section>
      {studentReport ? (
        <section className="band">
          <div className="section-title">
            <h2>{studentReport.user.display_name} 的学习记录</h2>
            <span className="pill">{studentReport.assignmentProgress.length} 个任务</span>
          </div>
          <div className="report-band">
            <Metric label="完成诗词" value={studentReport.summary.completed} />
            <Metric label="正确率" value={`${Math.round(studentReport.summary.correctRate * 100)}%`} />
            <Metric label="待复习" value={studentReport.summary.reviewCount} />
          </div>
          <div className="record-list">
            {studentReport.sessions.map((session) => (
              <div className="wrong-row" key={session.id}>
                <strong>{session.poem_title}</strong>
                <span>{session.status}</span>
                <b>{Math.round((session.mastery?.correctRate || 0) * 100)}%</b>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function AdminPage({ poems }: { poems: Poem[] }) {
  const tabs = ['poems', 'textbooks', 'knowledge', 'motifs', 'places', 'questions', 'lessons', 'assets', 'poet-dialogues', 'suggested-questions', 'ai-jobs', 'review', 'audit'];
  const [tab, setTab] = useState('poems');
  const [items, setItems] = useState<unknown[]>([]);
  const [newTitle, setNewTitle] = useState('教学样板新增诗');
  const [selectedPoemId, setSelectedPoemId] = useState(poems[0]?.id || '');
  const [promptDraft, setPromptDraft] = useState('你是诗人学习向导，只围绕当前诗词和学习目标回答。');
  const [quickText, setQuickText] = useState('新增内容');

  function refresh(nextTab = tab) {
    api.adminContent(nextTab).then((payload) => setItems(payload.items)).catch(() => setItems([]));
  }

  useEffect(() => refresh(tab), [tab]);

  async function createPoem() {
    await api.saveAdminContent('poems', {
      title: newTitle,
      fullText: '示例诗句，等待教研编辑完善。',
      highlightLine: '示例诗句，等待教研编辑完善。',
      learningObjectives: ['会读', '会释义', '会表达感受'],
      status: 'draft',
    });
    refresh('poems');
  }

  async function addPromptVersion() {
    const firstProfile = items.find((item): item is { id: string } => typeof item === 'object' && item !== null && 'id' in item);
    if (!firstProfile) return;
    await api.saveAdminContent('poet-dialogues', { profileId: firstProfile.id, promptBody: promptDraft, safetyRules: ['必须服务诗词学习'] });
    refresh('poet-dialogues');
  }

  async function createTypedContent() {
    const selectedPoem = poems.find((poem) => poem.id === selectedPoemId) || poems[0];
    if (tab === 'textbooks') await api.saveAdminContent(tab, { name: quickText, publisher: '教研组', version: '草稿版', status: 'draft' });
    if (tab === 'knowledge') await api.saveAdminContent(tab, { name: quickText, type: 'theme', description: '内容后台新增知识点', status: 'draft' });
    if (tab === 'motifs') await api.saveAdminContent(tab, { name: quickText, description: '内容后台新增意象' });
    if (tab === 'places') await api.saveAdminContent(tab, { name: quickText, description: '内容后台新增地点' });
    if (tab === 'questions') await api.saveAdminContent(tab, {
      poemId: selectedPoem?.id,
      type: 'short',
      prompt: quickText,
      answer: selectedPoem?.motifs[0] || '',
      difficulty: '基础',
      explanation: '后台新增题目解析',
      status: 'draft',
    });
    if (tab === 'lessons') await api.saveAdminContent(tab, {
      poemId: selectedPoem?.id,
      title: quickText,
      summary: '后台新增学习故事草稿',
      gradeBand: selectedPoem ? `${selectedPoem.stage}${selectedPoem.grade}` : '',
      status: 'draft',
    });
    if (tab === 'assets') await api.saveAdminContent(tab, {
      title: quickText,
      type: 'image',
      url: selectedPoem?.cover_url || '/assets/ui/cover-lushan.jpg',
      source: 'editor-upload',
      targetType: selectedPoem ? 'poem' : '',
      targetId: selectedPoem?.id,
      usageKind: 'reference',
      status: 'draft',
    });
    if (tab === 'suggested-questions') {
      const profile = await api.dialogueProfile(selectedPoem?.id || poems[0].id);
      await api.saveAdminContent(tab, { profileId: profile.profile.id, questionOrder: 5, text: quickText });
    }
    if (tab === 'ai-jobs') await api.saveAdminContent(tab, { targetType: 'poem', targetId: selectedPoem?.id, jobType: 'learning_content_draft' });
    refresh(tab);
  }

  async function archiveItem(item: unknown) {
    const id = itemId(item);
    if (!id) return;
    await api.archiveAdminContent(tab, id);
    refresh(tab);
  }

  async function publishItem(item: unknown) {
    const id = itemId(item);
    if (!id) return;
    if (tab === 'review' && hasKey(item, 'prompt_id')) {
      await api.saveAdminContent('review', { promptId: String(item.prompt_id), status: 'approved' });
    } else if (tab === 'ai-jobs') {
      await api.saveAdminContent('review', { aiJobId: id, status: 'approved', reviewNote: '界面审核通过并应用到诗库' });
    } else if (tab === 'poet-dialogues') {
      await api.saveAdminContent('poet-dialogues', { profileId: id, status: 'published' });
    } else {
      await api.updateAdminContent(tab, id, { ...(typeof item === 'object' && item ? item : {}), status: 'published' });
    }
    refresh(tab);
  }

  return (
    <div className="page-grid">
      <section className="admin-tabs">
        {tabs.map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{adminTabName(item)}</button>
        ))}
      </section>
      <section className="admin-workbench">
        <div className="form-panel">
          <h2>{adminTabName(tab)}</h2>
          {tab === 'poems' ? (
            <>
              <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
              <button onClick={() => void createPoem()}>
                <Plus size={16} />
                新建草稿
              </button>
            </>
          ) : null}
          {tab === 'poet-dialogues' ? (
            <>
              <textarea value={promptDraft} onChange={(event) => setPromptDraft(event.target.value)} />
              <button onClick={() => void addPromptVersion()}>
                <Bot size={16} />
                新建 Prompt 版本
              </button>
            </>
          ) : null}
          {!['poems', 'poet-dialogues', 'review', 'audit'].includes(tab) ? (
            <>
              <select value={selectedPoemId} onChange={(event) => setSelectedPoemId(event.target.value)}>
                {poems.map((poem) => <option key={poem.id} value={poem.id}>{poem.title}</option>)}
              </select>
              <input value={quickText} onChange={(event) => setQuickText(event.target.value)} />
              <button onClick={() => void createTypedContent()}>
                <Plus size={16} />
                {tab === 'ai-jobs' ? '生成 AI 草稿' : '新建记录'}
              </button>
            </>
          ) : null}
          <Notice text="内容状态、Prompt 版本和审核记录都保存在教育版独立数据库。" />
        </div>
        <div className="table-panel">
          <div className="table-head">
            <strong>记录</strong>
            <span>{items.length} 条</span>
          </div>
          <div className="table-list">
            {items.slice(0, 80).map((item, index) => (
              <div className="admin-record" key={index}>
                <pre>{compactJson(item)}</pre>
                <div>
                  {['poems', 'textbooks', 'knowledge', 'questions', 'lessons', 'assets', 'poet-dialogues', 'review', 'ai-jobs'].includes(tab) ? (
                    <button className="ghost" onClick={() => void publishItem(item)}>发布/审核</button>
                  ) : null}
                  {['poems', 'textbooks', 'knowledge', 'questions', 'lessons', 'assets'].includes(tab) ? (
                    <button className="ghost" onClick={() => void archiveItem(item)}>归档</button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="band">
        <div className="section-title">
          <h2>素材导入状态</h2>
          <span className="pill">{poems.length} 首诗境内容</span>
        </div>
        <div className="workflow-strip">
          {['诗词 CRUD', '教材 CRUD', '知识点 CRUD', '练习题 CRUD', '学习故事 CRUD', 'AI 审核审计'].map((item) => (
            <div className="workflow-step" key={item}>
              <CheckCircle2 size={18} />
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function adminTabName(tab: string) {
  return {
    poems: '诗词管理',
    textbooks: '教材目录',
    knowledge: '知识点',
    motifs: '意象',
    places: '地点',
    questions: '练习题',
    lessons: '学习故事',
    assets: '素材',
    'poet-dialogues': '诗人对话',
    'suggested-questions': '建议问题',
    'ai-jobs': 'AI 草稿',
    review: '内容审核',
    audit: '审计日志',
  }[tab] || tab;
}

function hasKey(item: unknown, key: string): item is Record<string, unknown> {
  return typeof item === 'object' && item !== null && key in item;
}

function itemId(item: unknown) {
  if (!hasKey(item, 'id')) return '';
  return String(item.id);
}

function compactJson(item: unknown) {
  const record = item as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const key of ['id', 'title', 'name', 'poem_title', 'role_name', 'status', 'prompt_status', 'theme', 'version_no', 'job_type', 'target_type', 'action', 'actor_id', 'actor_role', 'created_at']) {
    if (key in record) picked[key] = record[key];
  }
  return JSON.stringify(Object.keys(picked).length ? picked : record, null, 2);
}
