import type { ComponentType } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiWrite, clearCSRF } from './api'
import { Icon } from './components/icons'
import ToastHost from './components/ToastHost'
import Billing from './pages/Billing'
import Dashboard from './pages/Dashboard'
import Editor from './pages/Editor'
import Marketplaces from './pages/Marketplaces'
import QuestionsPanel from './pages/Questions'
import Reviews from './pages/Reviews'
import Settings from './pages/Settings'
import Status from './pages/Status'
// OperatorPage is replaced by the hosted build (closed-source overlay):
// the open-source build ships a hidden no-op. The page itself renders only
// for owner sessions (server-gated /admin/api/saas/*).
let OperatorPage: ComponentType | null = null
export function setOperatorPage(component: ComponentType) {
  OperatorPage = component
}

type Mode = 'loading' | 'setup' | 'login' | 'authed'
type Route =
  | 'dashboard'
  | 'reviews'
  | 'widget'
  | 'settings'
  | 'marketplaces'
  | 'status'
  | 'billing'
  | 'operator'

type NavItem = { route: Route; label: string; icon: string }
type NavGroup = { label: string; items: NavItem[] }

const NAV: NavGroup[] = [
  {
    label: 'Работа',
    items: [
      { route: 'dashboard', label: 'Обзор', icon: 'home' },
      { route: 'reviews', label: 'Отзывы', icon: 'list' },
    ],
  },
  { label: 'Виджет', items: [{ route: 'widget', label: 'Конструктор', icon: 'widget' }] },
  {
    label: 'Настройки',
    items: [
      { route: 'settings', label: 'Общие', icon: 'gear' },
      { route: 'marketplaces', label: 'Маркетплейсы', icon: 'mp' },
      { route: 'status', label: 'Состояние', icon: 'pulse' },
    ],
  },
  { label: 'Аккаунт', items: [{ route: 'billing', label: 'Подписка', icon: 'card' }] },
]

const CRUMBS: Record<Route, string> = {
  dashboard: 'Работа / Обзор',
  reviews: 'Работа / Отзывы',
  widget: 'Виджет / Конструктор',
  settings: 'Настройки / Общие',
  marketplaces: 'Настройки / Маркетплейсы',
  status: 'Настройки / Состояние',
  billing: 'Аккаунт / Подписка',
  operator: 'Аккаунт / SaaS',
}

const LEGACY_ROUTES: Record<string, Route> = {
  '': 'dashboard',
  dashboard: 'dashboard',
  reviews: 'reviews',
  questions: 'reviews',
  status: 'status',
  billing: 'billing',
  widget: 'widget',
  showcase: 'widget',
  editor: 'widget',
  embed: 'widget',
  'widget/showcase': 'widget',
  'widget/editor': 'widget',
  'widget/embed': 'widget',
  operator: 'operator',
  settings: 'settings',
  marketplaces: 'marketplaces',
  'settings/general': 'settings',
  'settings/marketplaces': 'marketplaces',
}

function currentRoute(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '')
  if (raw in LEGACY_ROUTES) return LEGACY_ROUTES[raw]
  return 'dashboard'
}
async function postAuth(path: string, body: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({ error: 'Запрос не выполнен' }))) as { error?: string }
    throw new Error(data.error ?? 'Запрос не выполнен')
  }
}

type VersionInfo = {
  current: string
  latest: string
  updateAvailable: boolean
  releaseUrl: string
}

const UPDATE_DOCS_URL = 'https://github.com/marker-oss/yakit-reviews-extension#обслуживание'
const DISMISSED_KEY = 'reviews-update-dismissed'

type Health = { tone: 'ok' | 'warn' | 'fail'; label: string }

function computeHealth(checks: { level: string }[] | undefined): Health | null {
  if (!checks) return null
  const fails = checks.filter((c) => c.level === 'fail').length
  const warns = checks.filter((c) => c.level === 'warn').length
  if (fails > 0) return { tone: 'fail', label: `${fails} ${plural(fails, ['проблема', 'проблемы', 'проблем'])}` }
  if (warns > 0) return { tone: 'warn', label: `${warns} ${plural(warns, ['предупреждение', 'предупреждения', 'предупреждений'])}` }
  return { tone: 'ok', label: 'Всё в порядке' }
}

function plural(n: number, forms: [string, string, string]) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]
  return forms[2]
}

// Sidebar nav is derived from mode/hasOperator — plain computation, never a
// hook: this function is called after early returns in App (loading/auth),
// and a conditional useMemo here throws "Rendered fewer hooks" (#310).
function buildNav(hasOperator: boolean): NavGroup[] {
  const groups = NAV.map((g) => ({ ...g, items: [...g.items] }))
  if (hasOperator) groups[3].items.push({ route: 'operator', label: 'SaaS', icon: 'panel' })
  return groups
}

export default function App() {
  const [mode, setMode] = useState<Mode>('loading')
  const [route, setRoute] = useState<Route>(currentRoute)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [dismissedVersion, setDismissedVersion] = useState(() => localStorage.getItem(DISMISSED_KEY) ?? '')
  const [counts, setCounts] = useState({ pendingReviews: 0, pendingQuestions: 0 })
  const [health, setHealth] = useState<Health | null>(null)
  const [role, setRole] = useState('')
  const [sbOpen, setSbOpen] = useState(false)
  // The operator tab appears only when the operator page component was
  // installed (hosted build) AND the session belongs to an owner.
  const hasOperator = role === 'owner' && OperatorPage !== null

  useEffect(() => {
    apiGet<{ user_id: number; role: string }>('/admin/api/me')
      .then((me) => {
        setMode('authed')
        setRole(me.role)
      })
      .catch(() => {
        fetch('/admin/api/setup-status')
          .then((s) => s.json())
          .then((data: { needs_setup: boolean }) => setMode(data.needs_setup ? 'setup' : 'login'))
          .catch(() => setMode('login'))
      })
  }, [])

  useEffect(() => {
    const onHash = () => {
      setRoute(currentRoute())
      setSbOpen(false)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (mode !== 'authed') return
    apiGet<VersionInfo>('/admin/api/version').then(setVersionInfo).catch(() => {})
    apiGet<{ pendingReviews: number; pendingQuestions: number }>('/admin/api/counts')
      .then(setCounts)
      .catch(() => {})
    apiGet<{ checks: { level: string }[] }>('/admin/api/diagnostics')
      .then((d) => setHealth(computeHealth(d.checks)))
      .catch(() => {})
  }, [mode, route])

  function dismissUpdate(version: string) {
    localStorage.setItem(DISMISSED_KEY, version)
    setDismissedVersion(version)
  }

  const showUpdateBanner = versionInfo !== null && versionInfo.updateAvailable && versionInfo.latest !== dismissedVersion

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await postAuth(mode === 'setup' ? '/admin/api/setup' : '/admin/api/login', { login, password })
      setMode('authed')
      setPassword('')
      try {
        const me = await apiGet<{ user_id: number; role: string }>('/admin/api/me')
        setRole(me.role)
      } catch {
        setRole('')
      }
    } catch (err) {
      setError(err instanceof Error ? authError(err.message) : 'Запрос не выполнен')
    }
  }

  async function logout() {
    setError('')
    try {
      await apiWrite('POST', '/admin/api/logout')
      clearCSRF()
      setMode('login')
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? authError(err.message) : 'Запрос не выполнен')
    }
  }

  if (mode === 'loading') {
    return (
      <>
        <main className="auth-screen">
          <p className="muted">Загрузка...</p>
        </main>
        <ToastHost />
      </>
    )
  }

  if (mode !== 'authed') {
    const setup = mode === 'setup'
    return (
      <>
        <main className="auth-screen">
          <form className="auth-panel" onSubmit={submit}>
            <div className="auth-brand">
              <span className="sb-mark">R</span>
              <span>
                <b>Виджет отзывов</b>
                <small>панель управления</small>
              </span>
            </div>
            <div>
              <p className="eyebrow">{setup ? 'Первый запуск' : 'Вход'}</p>
              <h1 style={{ marginTop: 4 }}>{setup ? 'Создайте администратора' : 'Войдите в админку'}</h1>
              {setup && (
                <p className="sub" style={{ marginTop: 8 }}>
                  Логин и пароль от этой панели. Храните надёжно — восстановление только через сервер.
                </p>
              )}
            </div>
            <label>
              <span>Логин</span>
              <input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" />
            </label>
            <label>
              <span>Пароль</span>
              <input
                value={password}
                type="password"
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={setup ? 'new-password' : 'current-password'}
              />
            </label>
            <button type="submit">{setup ? 'Создать и войти' : 'Войти'}</button>
            {error && <p className="error">{error}</p>}
            {setup && (
              <div className="onboard-checklist">
                <div className="done">
                  <i />
                  Панель установлена
                </div>
                <div>
                  <i />
                  Создать администратора
                </div>
                <div>
                  <i />
                  Подключить маркетплейс
                </div>
                <div>
                  <i />
                  Настроить виджет и вставить сниппет
                </div>
              </div>
            )}
            <div className="auth-foot">
              <span>{window.location.host}</span>
              <span>{versionInfo ? `v${versionInfo.current}` : ''}</span>
            </div>
          </form>
        </main>
        <ToastHost />
      </>
    )
  }

  const nav = buildNav(hasOperator)

  const page = (
    <>
      {route === 'dashboard' && <Dashboard />}
      {route === 'reviews' && <Reviews questions={<QuestionsPanel />} pendingQuestions={counts.pendingQuestions} />}
      {route === 'widget' && <Editor />}
      {route === 'settings' && <Settings />}
      {route === 'marketplaces' && <Marketplaces />}
      {route === 'status' && <Status />}
      {route === 'billing' && <Billing />}
      {route === 'operator' && OperatorPage !== null && hasOperator && <OperatorPage />}
    </>
  )

  return (
    <>
      <div className={`app${sbOpen ? ' sb-open' : ''}`}>
        {sbOpen && <div className="sb-scrim" onClick={() => setSbOpen(false)} />}
        <aside className="sb">
          <div className="sb-brand">
            <span className="sb-mark">R</span>
            <span className="sb-name">
              Виджет отзывов
              <small>панель управления</small>
            </span>
          </div>
          {nav.map((group) => (
            <div key={group.label}>
              <span className="sb-lbl">{group.label}</span>
              {group.items.map((item) => (
                <a
                  key={item.route}
                  className="sb-i"
                  href={`#/${item.route}`}
                  aria-current={route === item.route ? 'page' : undefined}
                  onClick={() => setSbOpen(false)}
                >
                  <Icon name={item.icon} />
                  {item.label}
                  {item.route === 'reviews' && counts.pendingReviews > 0 && <span className="navcount">{counts.pendingReviews}</span>}
                </a>
              ))}
            </div>
          ))}
          <a
            className={`sb-status${health ? ` ${health.tone}` : ''}`}
            href="#/status"
            style={{ background: health ? undefined : 'var(--sunken)' }}
          >
            {health ? health.label : 'Состояние'}
          </a>
          <div className="sb-foot">
            <button className="sb-user" onClick={logout} title="Выйти">
              <span className="sb-av">{(login || role || 'A').slice(0, 1).toUpperCase()}</span>
              <span>
                <b>{login || 'Админ'}</b>
                <span>{role === 'owner' ? 'владелец' : ''}</span>
              </span>
              <Icon name="out" />
            </button>
            <div className="sb-ver">
              <span>{versionInfo ? `v${versionInfo.current}` : ''}</span>
              {versionInfo?.updateAvailable ? (
                <a href={versionInfo.releaseUrl} target="_blank" rel="noreferrer">
                  есть v{versionInfo.latest}
                </a>
              ) : (
                <span>актуальная</span>
              )}
            </div>
          </div>
        </aside>

        <div className="main">
          <header className="top">
            <button className="sb-burger" onClick={() => setSbOpen(true)} aria-label="Меню">
              <Icon name="burger" />
            </button>
            <span className="crumb">
              {CRUMBS[route].split(' / ')[0]} / <b>{CRUMBS[route].split(' / ')[1]}</b>
            </span>
            <span className="spacer" />
            {showUpdateBanner && versionInfo && (
              <a className="env-chip" href={versionInfo.releaseUrl} target="_blank" rel="noreferrer">
                Доступна v{versionInfo.latest}
              </a>
            )}
          </header>
          {showUpdateBanner && versionInfo && (
            <div className="update-banner">
              <span>
                Доступна новая версия <strong>{versionInfo.latest}</strong> (у вас {versionInfo.current}).{' '}
                <a href={versionInfo.releaseUrl} target="_blank" rel="noreferrer">
                  Что нового
                </a>{' '}
                ·{' '}
                <a href={UPDATE_DOCS_URL} target="_blank" rel="noreferrer">
                  Как обновиться
                </a>
              </span>
              <button className="secondary" onClick={() => dismissUpdate(versionInfo.latest)}>
                Скрыть
              </button>
            </div>
          )}
          {route === 'widget' ? page : <div className="page">{page}</div>}
        </div>
      </div>
      <ToastHost />
    </>
  )
}

function authError(message: string) {
  if (message === 'authentication required') return 'Требуется вход в админку'
  if (message === 'invalid login or password') return 'Неверный логин или пароль'
  return message || 'Запрос не выполнен'
}
