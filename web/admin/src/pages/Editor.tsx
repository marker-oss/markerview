import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiGet, apiWrite } from '../api'
import { toast } from '../toast'
import { useDirty } from '../useDirty'
import {
  defaultWidgetConfig,
  mergeWidgetConfig,
  widgetSectionLabels,
  type CustomFieldDef,
  type MarketplacePolicy,
  type WidgetConfig,
  type WidgetContext,
  type WidgetSectionId,
} from '../widgetConfig'
import EmbedPanel from './Embed'
import ShowcasePanel from './Showcase'

type VersionItem = {
  version: number
  active: boolean
  created_at: string
}

type ReviewsWidgetHandle = {
  updateConfig: (config: WidgetConfig) => void
  destroy: () => void
}

type ReviewsWidgetApi = {
  mount: (root: HTMLElement, options: Record<string, unknown>) => ReviewsWidgetHandle
  mountShadow: (host: HTMLElement, options: Record<string, unknown>) => ReviewsWidgetHandle
  sampleReviews: unknown[]
}

type SubmissionConfig = {
  enabled: boolean
  maxFiles: number
  maxImageBytes: number
  maxVideoBytes: number
  maxTotalBytes: number
  allowedTypes: string[]
  privacyUrl?: string
  reviewTermsUrl?: string
  customFields?: CustomFieldDef[]
}

// Server limits from review_submissions.go; the public config replaces these.
const previewSubmissionFallback: SubmissionConfig = {
  enabled: true,
  maxFiles: 5,
  maxImageBytes: 8 * 1024 * 1024,
  maxVideoBytes: 50 * 1024 * 1024,
  maxTotalBytes: 80 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'],
}


const visibilityLabels: Record<keyof WidgetConfig['visibility'], string> = {
  photos: 'Фото в отзывах',
  sellerAnswers: 'Ответы продавца',
  prosCons: 'Плюсы и минусы',
  marketplaceBadges: 'Бейджи площадок',
  ratingDistribution: 'Распределение оценок',
  videoRail: 'Видео-лента',
  filters: 'Панель фильтров',
  questions: 'Вопросы',
}

const rankingLabels: Record<WidgetConfig['ranking'][number]['field'], string> = {
  pinned: 'Закрепленные',
  hasPhoto: 'С фото',
  hasText: 'С текстом',
  rating: 'Высокая оценка',
  createdAt: 'Свежие',
}

const marketplaceLabels: Record<keyof WidgetConfig['marketplacePolicy'], string> = {
  wb: 'Wildberries',
  ym: 'Яндекс Маркет',
  ozon: 'Ozon',
}

const THEME_PALETTES: { name: string; theme: WidgetConfig['theme'] }[] = [
  {
    name: 'Нейтральная светлая',
    theme: { panel: '#ffffff', text: '#202124', muted: '#62656b', accent: '#34373d', accentInk: '#ffffff', border: '#dedfe2', star: '#9a6a00', dark: false },
  },
  {
    name: 'Тёплая светлая',
    theme: { panel: '#fffcf7', text: '#302b26', muted: '#71665c', accent: '#7a5434', accentInk: '#ffffff', border: '#e5d9ca', star: '#986600', dark: false },
  },
  {
    name: 'Графитовая тёмная',
    theme: { panel: '#202226', text: '#f2f3f5', muted: '#b3b7c0', accent: '#b8c6ff', accentInk: '#17203b', border: '#484c55', star: '#e5ba62', dark: true },
  },
]

type RailTab = 'look' | 'select' | 'form' | 'mp' | 'showcase' | 'embed' | 'versions'

const RAIL_TABS: { id: RailTab; label: string }[] = [
  { id: 'look', label: 'Вид' },
  { id: 'select', label: 'Отбор' },
  { id: 'form', label: 'Форма' },
  { id: 'mp', label: 'Площадки' },
  { id: 'showcase', label: 'Витрина' },
  { id: 'embed', label: 'Подключение' },
  { id: 'versions', label: 'Версии' },
]

// Only the visual properties changed by the original preset snapshots.
const PRESET_VARS: Record<string, {
  theme: Pick<WidgetConfig['theme'], 'accent' | 'star' | 'border' | 'panel'>
  typography: Pick<WidgetConfig['typography'], 'radius' | 'density'>
  layout: Pick<WidgetConfig['layout'], 'mode' | 'columns'>
  header: Pick<WidgetConfig['header'], 'layout'>
  form: Pick<WidgetConfig['form'], 'ctaMode'>
  appearance: Pick<WidgetConfig['appearance'], 'preset'>
}> = {
  default: {
    theme: { accent: '#68478D', star: '#C99A3F', border: '#E7DFD7', panel: '#ffffff' },
    typography: { radius: 16, density: 'comfortable' },
    layout: { mode: 'list', columns: 2 },
    header: { layout: 'row' },
    form: { ctaMode: 'section' },
    appearance: { preset: 'default' },
  },
  editorial: {
    theme: { accent: '#17191D', star: '#17191D', border: '#E3E3E3', panel: '#ffffff' },
    typography: { radius: 4, density: 'comfortable' },
    layout: { mode: 'carousel', columns: 2 },
    header: { layout: 'center' },
    form: { ctaMode: 'header' },
    appearance: { preset: 'ugc-editorial' },
  },
  community: {
    theme: { accent: '#0E7A6E', star: '#E8A33D', border: '#EAE3DA', panel: '#ffffff' },
    typography: { radius: 14, density: 'comfortable' },
    layout: { mode: 'wall', columns: 3 },
    header: { layout: 'stack' },
    form: { ctaMode: 'both' },
    appearance: { preset: 'ugc-community' },
  },
  bazaar: {
    theme: { accent: '#C2410C', star: '#C2410C', border: '#EADFD6', panel: '#ffffff' },
    typography: { radius: 6, density: 'compact' },
    layout: { mode: 'grid', columns: 3 },
    header: { layout: 'row' },
    form: { ctaMode: 'section' },
    appearance: { preset: 'bazaar' },
  },
}

const EDITOR_PRESETS: { id: string; name: string; hint: string; color: string; tiles: 1 | 2 | 3 }[] = [
  { id: 'default', name: 'Классика', hint: 'список · шапка рядом · форма секцией', color: '#68478D', tiles: 1 },
  { id: 'editorial', name: 'Editorial', hint: 'лента · центр · форма в шапке', color: '#17191D', tiles: 1 },
  { id: 'community', name: 'UGC Комьюнити', hint: 'стена фото · стопка · форма в 2 местах', color: '#0E7A6E', tiles: 2 },
  { id: 'bazaar', name: 'Базар', hint: 'сетка 3-в-ряд · компактно · форма секцией', color: '#C2410C', tiles: 3 },
]

export default function Editor() {
  const [context, setContext] = useState<WidgetContext>('product')
  const [cfg, setCfg] = useState<WidgetConfig>(defaultWidgetConfig)
  const [baseline, setBaseline] = useState<WidgetConfig>(defaultWidgetConfig)
  const [versions, setVersions] = useState<VersionItem[]>([])
  const [tab, setTab] = useState<RailTab>('look')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [railOff, setRailOff] = useState(false)
  const [previewCfg, setPreviewCfg] = useState<WidgetConfig>(defaultWidgetConfig)
  // E1: undo-история (до 60 шагов) + E12: черновик в localStorage.
  const historyRef = useRef<string[]>([])
  const cfgRef = useRef(cfg)
  const baselineRef = useRef(baseline)
  const contextRef = useRef(context)
  const loadedContextRef = useRef<WidgetContext | null>(null)
  const requestRef = useRef(0)
  const operationRef = useRef<'publish' | 'rollback' | null>(null)
  const [loading, setLoading] = useState(true)
  const [operation, setOperation] = useState<'publish' | 'rollback' | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [contextVersions, setContextVersions] = useState<Record<string, number>>({})
  // E3: источник превью (мок | прокси-страница). /api/preview-page готов на BE.
  const [previewSource, setPreviewSource] = useState<'mock' | 'real'>('mock')
  const [shopOrigin, setShopOrigin] = useState('')
  const submissionConfigRef = useRef<SubmissionConfig>({ ...previewSubmissionFallback })
  const [submissionMaxFiles, setSubmissionMaxFiles] = useState(previewSubmissionFallback.maxFiles)

  const load = useCallback((nextContext: WidgetContext) => {
    const request = ++requestRef.current
    loadedContextRef.current = null
    historyRef.current = []
    setCanUndo(false)
    setLoading(true)
    Promise.all([
      apiGet<Partial<WidgetConfig>>(`/admin/api/widget-config/${nextContext}`),
      apiGet<{ versions: VersionItem[] }>(`/admin/api/widget-config/${nextContext}/versions`),
      apiGet<SubmissionConfig>('/api/review-submission-config').catch(() => previewSubmissionFallback),
    ])
      .then(([config, versionData, submissionConfig]) => {
        if (request !== requestRef.current || nextContext !== contextRef.current) return
        const merged = mergeWidgetConfig(config)
        let withDraft = merged
        try {
          const draft = JSON.parse(window.localStorage.getItem(`reviews-draft-${nextContext}`) || 'null')
          if (draft && typeof draft === 'object' && !Array.isArray(draft)) {
            withDraft = mergeWidgetConfig({ ...merged, ...draft })
            // Incomplete custom fields are editable drafts, not published schema.
            if (Array.isArray(draft.customFields)) withDraft.customFields = draft.customFields
          }
        } catch {
          /* Ignore an unavailable or malformed local draft. */
        }
        cfgRef.current = withDraft
        baselineRef.current = merged
        loadedContextRef.current = nextContext
        Object.assign(submissionConfigRef.current, submissionConfig, { enabled: true, customFields: withDraft.customFields })
        setSubmissionMaxFiles(submissionConfig.maxFiles)
        setCfg(withDraft)
        setBaseline(merged)
        setPreviewCfg(withDraft)
        setVersions(versionData.versions)
        const active = versionData.versions.find((v) => v.active)
        setContextVersions((prev) => ({ ...prev, [nextContext]: active?.version ?? 0 }))
      })
      .catch((err) => {
        if (request === requestRef.current) toast.error(err instanceof Error ? err.message : 'Запрос не выполнен')
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false)
      })
  }, [])

  // E13: активная версия каждого контекста для блока «Контексты» + E3 shopOrigin.
  useEffect(() => {
    apiGet<{ shopOrigin?: string }>('/admin/api/settings')
      .then((s) => setShopOrigin(s.shopOrigin ?? ''))
      .catch(() => {})
    Promise.all(
      (['product', 'homepage'] as WidgetContext[]).map((ctx) =>
        apiGet<{ versions: VersionItem[] }>(`/admin/api/widget-config/${ctx}/versions`).then((d) => [ctx, d.versions] as const),
      ),
    )
      .then((pairs) => {
        const map: Record<string, number> = {}
        pairs.forEach(([ctx, list]) => {
          const active = list.find((v) => v.active)
          if (active) map[ctx] = active.version
        })
        setContextVersions((prev) => ({ ...map, ...prev }))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load(context)
    return () => { requestRef.current++ }
  }, [context, load])

  // Debounce live updates without replacing the iframe or its widget instance.
  const previewTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    window.clearTimeout(previewTimer.current)
    previewTimer.current = window.setTimeout(() => setPreviewCfg(cfg), 200)
    return () => window.clearTimeout(previewTimer.current)
  }, [cfg])

  const dirty = useDirty(cfg, baseline)
  const activeVersion = versions.find((v) => v.active)?.version ?? null

  const saveDraft = useCallback((next: WidgetConfig) => {
    cfgRef.current = next
    setCfg(next)
    try {
      const key = `reviews-draft-${contextRef.current}`
      if (JSON.stringify(next) === JSON.stringify(baselineRef.current)) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, JSON.stringify(next))
    } catch {
      /* Private mode: the draft remains available in memory. */
    }
  }, [])

  const undoDraft = useCallback(() => {
    if (loadedContextRef.current !== contextRef.current || operationRef.current === 'rollback') return
    const snap = historyRef.current.pop()
    if (!snap) return
    setCanUndo(historyRef.current.length > 0)
    saveDraft(JSON.parse(snap))
  }, [saveDraft])

  // Leave native undo inside editable controls alone.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      e.preventDefault()
      undoDraft()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [undoDraft])

  async function publish() {
    if (operationRef.current || loadedContextRef.current !== contextRef.current) return
    const publishedContext = contextRef.current
    const published = cfgRef.current
    operationRef.current = 'publish'
    setOperation('publish')
    try {
      const res = await apiWrite<{ version: number }>('POST', `/admin/api/widget-config/${publishedContext}`, published)
      if (loadedContextRef.current !== publishedContext) return
      baselineRef.current = published
      setBaseline(published)
      saveDraft(cfgRef.current)
      if (cfgRef.current === published) {
        historyRef.current = []
        setCanUndo(false)
      }
      setVersions((prev) => [{ version: res.version, active: true, created_at: new Date().toISOString() }, ...prev.map((v) => ({ ...v, active: false }))])
      setContextVersions((prev) => ({ ...prev, [publishedContext]: res.version }))
      toast.success(`Опубликована v${res.version} — уже на сайте`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Запрос не выполнен')
    } finally {
      operationRef.current = null
      setOperation(null)
    }
  }

  function resetDraft() {
    if (loadedContextRef.current !== contextRef.current || operationRef.current) return
    saveDraft(baselineRef.current)
    historyRef.current = []
    setCanUndo(false)
    toast.info('Черновик возвращён к эфирной версии')
  }

  function patch(partial: Partial<WidgetConfig>) {
    if (loadedContextRef.current !== contextRef.current || operationRef.current === 'rollback') return
    const prev = cfgRef.current
    const next = { ...prev, ...partial }
    if (JSON.stringify(prev) === JSON.stringify(next)) return
    historyRef.current.push(JSON.stringify(prev))
    if (historyRef.current.length > 60) historyRef.current.shift()
    setCanUndo(true)
    saveDraft(next)
  }

  const preview = useMemo(() => previewDocument(), [])
  const previewCfgRef = useRef(previewCfg)
  useEffect(() => {
    previewCfgRef.current = previewCfg
    submissionConfigRef.current.customFields = previewCfg.customFields
  }, [previewCfg])
  // E3(real): anchor селектор для прокси-превью; меняется из поля в hintstrip.
  const [previewAnchor, setPreviewAnchor] = useState('#reviews-widget')
  // Только preview: при отсутствии якоря монтируем в конце страницы магазина.
  const [previewFallback, setPreviewFallback] = useState(false)
  const [previewError, setPreviewError] = useState('')

  // Надёжный монтаж виджета в srcDoc-iframe: inline-скрипт в srcdoc не
  // исполняется (CSP/srcdoc-квирк Chromium), поэтому монтируем из родителя по onLoad.
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null)
  const mockMountRef = useRef<{ root: HTMLElement; handle: ReviewsWidgetHandle } | null>(null)
  const realMountRef = useRef<{ root: HTMLElement; handle: ReviewsWidgetHandle } | null>(null)
  useEffect(() => () => {
    mockMountRef.current?.handle.destroy()
    realMountRef.current?.handle.destroy()
    mockMountRef.current = null
    realMountRef.current = null
  }, [context, previewSource])
  const mountPreviewWidget = useCallback((reportFailure = false) => {
    const frame = previewFrameRef.current
    if (!frame || loadedContextRef.current !== context) return
    try {
      const win: Window & { ReviewsWidget?: ReviewsWidgetApi } | null = frame.contentWindow
      const doc = frame.contentDocument
      const root = doc?.getElementById('preview')
      if (!win?.ReviewsWidget || !root) {
        if (reportFailure) setPreviewError('Не удалось загрузить предпросмотр виджета.')
        return
      }
      if (mockMountRef.current?.root === root) {
        mockMountRef.current.handle.updateConfig(previewCfgRef.current)
      } else {
        mockMountRef.current?.handle.destroy()
        const handle = win.ReviewsWidget.mount(root, {
          reviews: previewSampleReviews(win.ReviewsWidget.sampleReviews),
          productName: context === 'product' ? 'Пример товара' : '',
          context,
          config: previewCfgRef.current,
          preview: true,
          submissionConfig: submissionConfigRef.current,
        })
        mockMountRef.current = { root, handle }
      }
      setPreviewError('')
    } catch {
      if (reportFailure) setPreviewError('Не удалось смонтировать предпросмотр виджета.')
    }
  }, [context])
  useEffect(() => {
    mountPreviewWidget()
  }, [previewCfg, loading, previewSource, mountPreviewWidget])

  // The proxy supplies the same runtime; only its mount host differs.
  const realFrameRef = useRef<HTMLIFrameElement | null>(null)
  const realAnchorRef = useRef(previewAnchor)
  useEffect(() => {
    realAnchorRef.current = previewAnchor
  }, [previewAnchor])
  const mountRealPreview = useCallback((reportFailure = false) => {
    if (previewSource !== 'real') return
    const frame = realFrameRef.current
    if (!frame || loadedContextRef.current !== context) return
    try {
      const win = frame.contentWindow as (Window & { ReviewsWidget?: ReviewsWidgetApi }) | null
      const doc = frame.contentDocument
      if (!win || !doc?.body || !win.ReviewsWidget?.mountShadow) {
        setPreviewFallback(false)
        if (reportFailure) setPreviewError('Не удалось загрузить предпросмотр страницы магазина.')
        return
      }
      const anchor = doc.querySelector(realAnchorRef.current)
      const container = anchor ?? doc.body
      let host = doc.querySelector<HTMLElement>('[data-reviews-preview-host]')
      // Keep one host per document, including the missing-anchor fallback.
      if (!host) {
        host = doc.createElement('div')
        host.setAttribute('data-reviews-preview-host', '')
      }
      if (host.parentElement !== container) container.appendChild(host)
      if (realMountRef.current?.root === host) {
        realMountRef.current.handle.updateConfig(previewCfgRef.current)
      } else {
        realMountRef.current?.handle.destroy()
        const handle = win.ReviewsWidget.mountShadow(host, {
          styleText: widgetCssText,
          reviews: previewSampleReviews(win.ReviewsWidget.sampleReviews),
          productName: context === 'product' ? 'Пример товара' : '',
          context,
          config: previewCfgRef.current,
          preview: true,
          submissionConfig: submissionConfigRef.current,
        })
        realMountRef.current = { root: host, handle }
      }
      setPreviewFallback(!anchor)
      setPreviewError('')
    } catch {
      setPreviewFallback(false)
      if (reportFailure) setPreviewError('Не удалось смонтировать предпросмотр страницы магазина.')
    }
  }, [previewSource, context])
  useEffect(() => {
    mountRealPreview()
  }, [previewCfg, previewAnchor, loading, mountRealPreview])
  return (
    <>
      <div className="ed-tools">
        <span className="crumb">
          Виджет / <b>Конструктор</b>
        </span>
        <select value={context} disabled={operation !== null} onChange={(e) => {
          contextRef.current = e.target.value as WidgetContext
          loadedContextRef.current = null
          requestRef.current++
          setLoading(true)
          setVersions([])
          setContext(contextRef.current)
        }} aria-label="Контекст">
          <option value="product">Карточка товара</option>
          <option value="homepage">Главная страница</option>
        </select>
        {!loading && activeVersion !== null && <span className="live-badge">В эфире: v{activeVersion}</span>}
        {!loading && dirty && <span className="dirty-badge" title="«Сбросить» вернёт эфирную версию">Есть изменения</span>}
        <button className="quiet" onClick={undoDraft} disabled={!canUndo || loading || operation === 'rollback'} title="Отменить последнее действие (⌘Z)">
          ↶ Отменить
        </button>
        {!loading && dirty && (
          <button className="quiet" onClick={resetDraft} disabled={operation !== null} title="Вернуть эфирную версию">
            Сбросить
          </button>
        )}
        <div className="seg" role="group" aria-label="Устройство">
          <button aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>
            Десктоп
          </button>
          <button aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}>
            Мобайл
          </button>
        </div>
        <button onClick={publish} disabled={!dirty || loading || operation !== null || loadedContextRef.current !== context}>
          {operation === 'publish' ? 'Публикуем…' : 'Опубликовать'}
        </button>
        <button
          className="railtoggle"
          aria-pressed={railOff}
          aria-label={railOff ? 'Показать панель настроек' : 'Свернуть панель настроек'}
          onClick={() => setRailOff(!railOff)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="M14.5 4v16" />
          </svg>
        </button>
      </div>

      <div className={`ed${railOff ? ' rail-off' : ''}`}>
        <div className="canvas">
          <div className="hintstrip">
            <div className="seg" role="group" aria-label="Источник превью">
              <button aria-pressed={previewSource === 'mock'} onClick={() => { setPreviewError(''); setPreviewFallback(false); setPreviewSource('mock') }}>
                Мок
              </button>
              <button
                aria-pressed={previewSource === 'real'}
                disabled={!shopOrigin}
                title={shopOrigin ? undefined : 'Укажите адрес магазина в Настройках'}
                onClick={() => { setPreviewError(''); setPreviewSource('real') }}
              >
                Страница магазина
              </button>
            </div>
            {previewSource === 'real' && (
              <div className="k" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <label htmlFor="preview-anchor">Якорь</label>
                <input
                  id="preview-anchor"
                  value={previewAnchor}
                  onChange={(e) => setPreviewAnchor(e.target.value)}
                  placeholder="#reviews-widget"
                  style={{ minWidth: 150 }}
                />
              </div>
            )}
            <span>
              {previewSource === 'real'
                ? 'Прокси-превью: страница получена сервером, скрипты магазина отключены.'
                : 'Превью на мок-странице товара. Изменения в рельсе применяются сразу; публикация — отдельное действие.'}
            </span>
          </div>
          <div className={`browser${device === 'mobile' ? ' mobile' : ''}`}>
            <div className="bbar">
              <div className="dots">
                <i />
                <i />
                <i />
              </div>
              <div className="url">
                <b>https</b>
                <span>{previewSource === 'real' ? shopOrigin : 'shop.example/product/sample'}</span>
              </div>
            </div>
            {previewSource === 'real' && shopOrigin ? (
              <div className="realframe">
                <iframe
                  title="Предпросмотр на странице магазина"
                  ref={realFrameRef}
                  onLoad={() => mountRealPreview(true)}
                  onError={() => setPreviewError('Не удалось загрузить предпросмотр страницы магазина.')}
                  src={`/api/preview-page?url=${encodeURIComponent(shopOrigin)}`}
                />
                {previewFallback && !previewError && (
                  <div className="realframe-hint" role="status">
                    Якорь «{previewAnchor}» не найден на странице магазина — виджет показан в конце страницы только для предпросмотра.
                  </div>
                )}
                {previewError && <div className="realframe-hint" role="alert">{previewError}</div>}
              </div>
            ) : (
              <>
                <iframe
                  title="Предпросмотр виджета"
                  ref={previewFrameRef}
                  srcDoc={preview}
                  onLoad={() => mountPreviewWidget(true)}
                  onError={() => setPreviewError('Не удалось загрузить предпросмотр виджета.')}
                />
                {previewError && <div className="realframe-hint" role="alert">{previewError}</div>}
              </>
            )}
          </div>
        </div>

        <aside className="rail">
          <nav className="railnav" role="group" aria-label="Разделы панели настроек">
            {RAIL_TABS.map((t) => (
              <button key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>

          {loading || operation === 'rollback' ? <p className="hint" role="status">Загружаем настройки…</p> : loadedContextRef.current !== context ? (
            <button className="secondary" onClick={() => load(context)}>Повторить загрузку</button>
          ) : <>
          {tab === 'look' && <LookPanel cfg={cfg} patch={patch} />}
          {tab === 'select' && <SelectPanel cfg={cfg} patch={patch} />}
          {tab === 'form' && <FormPanel cfg={cfg} patch={patch} maxFiles={submissionMaxFiles} />}
          {tab === 'mp' && <MarketplacePanel cfg={cfg} patch={patch} />}
          {tab === 'showcase' && <ShowcasePanel />}
          {tab === 'embed' && <EmbedPanel />}
          {tab === 'versions' && <VersionsPanel versions={versions} context={context} contextVersions={contextVersions} onRollback={rollback} />}
          </>}
        </aside>
      </div>
    </>
  )

  async function rollback(version: number) {
    if (operationRef.current || loadedContextRef.current !== contextRef.current) return
    const rollbackContext = contextRef.current
    operationRef.current = 'rollback'
    setOperation('rollback')
    try {
      await apiWrite('POST', `/admin/api/widget-config/${rollbackContext}/rollback/${version}`)
      try { window.localStorage.removeItem(`reviews-draft-${rollbackContext}`) } catch { /* No persistent draft. */ }
      toast.success(`Активна версия ${version}`)
      load(rollbackContext)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Запрос не выполнен')
    } finally {
      operationRef.current = null
      setOperation(null)
    }
  }
}

/* ============ ВИД ============ */

function LookPanel({ cfg, patch }: { cfg: WidgetConfig; patch: (p: Partial<WidgetConfig>) => void }) {
  // E2: contrast guard — те же пары, что в макете (04:1832-1837).
  const cwarn = checkContrast(cfg)

  function patchHeaderElements(key: keyof WidgetConfig['header']['elements'], value: boolean) {
    patch({ header: { ...cfg.header, elements: { ...cfg.header.elements, [key]: value } } })
  }

  return (
    <>
      <Group title="Пресеты вида" note="4">
        <div className="preset-grid">
          {EDITOR_PRESETS.map((p) => (
            <button
              key={p.id}
              className="preset"
              aria-pressed={cfg.appearance.preset === PRESET_VARS[p.id]?.appearance?.preset}
              onClick={() => applyPresetFrom(p.id, cfg, patch)}
            >
              <span className="thumb" style={{ color: p.color }}>
                <span className="b1" />
                <span className="b2" />
                <span className="tiles" style={{ ['--tc' as string]: p.tiles }}>
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </span>
              <b>{p.name}</b>
              <small>{p.hint}</small>
            </button>
          ))}
        </div>
      </Group>

      <Group title="Шапка виджета" note="сводка и распределение" open>
        <div className="fld">
          <span>Схема</span>
          <div className="seg" role="group" aria-label="Схема шапки">
            {(['row', 'stack', 'center'] as const).map((l) => (
              <button key={l} aria-pressed={cfg.header.layout === l} onClick={() => patch({ header: { ...cfg.header, layout: l } })}>
                {l === 'row' ? 'Ряд' : l === 'stack' ? 'Стопка' : 'Центр'}
              </button>
            ))}
          </div>
        </div>
        <div className="fld">
          <span>Элементы шапки</span>
          <div className="attrflags" style={{ rowGap: 8 }}>
            {(
              [
                ['title', 'Заголовок'],
                ['rating', 'Оценка'],
                ['count', 'Счётчик'],
                ['recommend', 'Доля оценок 4–5★'],
                ['distribution', 'Распределение'],
              ] as [keyof WidgetConfig['header']['elements'], string][]
            ).map(([key, label]) => (
              <label className="check" key={key}>
                <input type="checkbox" checked={cfg.header.elements[key]} onChange={(e) => patchHeaderElements(key, e.target.checked)} />
                <b>{label}</b>
              </label>
            ))}
          </div>
        </div>
        <span className="hint">
          «Доля оценок 4–5★» показывает долю высоких оценок, а не явные рекомендации покупателей. Схема меняет компоновку сводки; элементы включаются по одному — пустая шапка скрывается.
        </span>
      </Group>

      <Group title="Вид" open>
        <label className="fld">
          <span>Заголовок</span>
          <input
            type="text"
            value={cfg.header.title}
            placeholder={defaultWidgetConfig.header.title}
            onChange={(e) => patch({ header: { ...cfg.header, title: e.target.value } })}
          />
        </label>
        <div className="f2">
          <ColorField label="Акцент" value={cfg.theme.accent} onChange={(value) => patch({ theme: { ...cfg.theme, accent: value } })} />
          <ColorField label="Звёзды" value={cfg.theme.star} onChange={(value) => patch({ theme: { ...cfg.theme, star: value } })} />
        </div>
        <div className="f2">
          <ColorField label="Граница" value={cfg.theme.border} onChange={(value) => patch({ theme: { ...cfg.theme, border: value } })} />
          <ColorField label="Фон карточки" value={cfg.theme.panel} onChange={(value) => patch({ theme: { ...cfg.theme, panel: value } })} />
        </div>
        {cwarn && (
          <div className="cwarn">
            <span className="msg">
              <b>{cwarn.msg}</b> · контраст {cwarn.ratio.toFixed(2).replace('.', ',')}:1, нужно ≥{' '}
              {String(cwarn.need).replace('.', ',')}:1
            </span>
            <button type="button" className="cwfix" onClick={() => fixContrast(cwarn.key, cfg, patch)}>
              Исправить
            </button>
          </div>
        )}
        <RangeField
          label="Масштаб текста"
          value={cfg.typography.scale}
          min={0.85}
          max={1.25}
          step={0.05}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(v) => patch({ typography: { ...cfg.typography, scale: v } })}
        />
        <RangeField
          label="Скругление"
          value={cfg.typography.radius}
          min={0}
          max={24}
          step={2}
          format={(v) => `${v}px`}
          onChange={(v) => patch({ typography: { ...cfg.typography, radius: v } })}
        />
        <div className="fld">
          <span>Плотность</span>
          <div className="seg" role="group" aria-label="Плотность">
            <button aria-pressed={cfg.typography.density === 'compact'} onClick={() => patch({ typography: { ...cfg.typography, density: 'compact' } })}>
              Компактно
            </button>
            <button aria-pressed={cfg.typography.density === 'comfortable'} onClick={() => patch({ typography: { ...cfg.typography, density: 'comfortable' } })}>
              Свободно
            </button>
          </div>
        </div>
        <div className="fld">
          <span>Макет списка</span>
          <div className="seg" role="group" aria-label="Макет">
            {(['list', 'grid', 'carousel', 'video', 'wall'] as const).map((m) => (
              <button key={m} aria-pressed={cfg.layout.mode === m} onClick={() => patch({ layout: { ...cfg.layout, mode: m } })}>
                {modeLabel(m)}
              </button>
            ))}
          </div>
        </div>
        <div className="f2">
          <label className="fld">
            <span>Колонки</span>
            <select value={String(cfg.layout.columns)} onChange={(e) => patch({ layout: { ...cfg.layout, columns: Number(e.target.value) } })}>
              {['1', '2', '3', '4'].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="fld">
            <span>Порция</span>
            <select value={String(cfg.layout.pageSize)} onChange={(e) => patch({ layout: { ...cfg.layout, pageSize: Number(e.target.value) } })}>
              {['3', '6', '9', '12'].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="fld">
          <span>Как показать остальные отзывы</span>
          <select value={cfg.layout.loadMoreAction} onChange={(e) => patch({ layout: { ...cfg.layout, loadMoreAction: e.target.value as WidgetConfig['layout']['loadMoreAction'] } })}>
            <option value="inline">Добавить на страницу</option>
            <option value="dialog">Открыть окно со всеми отзывами</option>
          </select>
        </label>
        <span className="hint">
          Порция — размер следующей загрузки, а не предел отзывов. Карусель прокручивается сразу и подгружает отзывы автоматически у края, независимо от пагинации.
          {cfg.layout.loadMoreAction === 'dialog' && ' Кнопка «Смотреть все отзывы» открывает отдельное окно с поиском, фильтрами и сортировкой.'}
        </span>
      </Group>

      <SectionsGroup cfg={cfg} patch={patch} />

      <Group title="Медиа в отзыве" note="фото и видео в карточке" open>
        <div className="fld">
          <span>Раскладка</span>
          <div className="seg" role="group" aria-label="Раскладка медиа">
            {(
              [
                ['row', 'Полоска'],
                ['grid', 'Сетка'],
                ['collage', 'Коллаж'],
                ['one', 'Одна'],
              ] as [WidgetConfig['layout']['mediacard']['layout'], string][]
            ).map(([value, label]) => (
              <button key={value} aria-pressed={cfg.layout.mediacard.layout === value} onClick={() => patch({ layout: { ...cfg.layout, mediacard: { ...cfg.layout.mediacard, layout: value } } })}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="f2">
          <label className="fld">
            <span>Формат кадра</span>
            <select value={cfg.layout.mediacard.aspect} onChange={(e) => patch({ layout: { ...cfg.layout, mediacard: { ...cfg.layout.mediacard, aspect: e.target.value as WidgetConfig['layout']['mediacard']['aspect'] } } })}>
              <option value="16:10">16:10</option>
              <option value="1:1">1:1 квадрат</option>
              <option value="4:5">4:5 портрет</option>
            </select>
          </label>
          <label className="fld">
            <span>Максимум плиток</span>
            <select
              value={String(cfg.layout.mediacard.maxTiles)}
              onChange={(e) => patch({ layout: { ...cfg.layout, mediacard: { ...cfg.layout.mediacard, maxTiles: Number(e.target.value) as WidgetConfig['layout']['mediacard']['maxTiles'] } } })}
            >
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="6">6</option>
            </select>
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={cfg.layout.mediacard.plusMore} onChange={(e) => patch({ layout: { ...cfg.layout, mediacard: { ...cfg.layout.mediacard, plusMore: e.target.checked } } })} />
          <span>
            <b>Плитка «+N»</b>
            <span className="d">остальные медиа открываются в плеере</span>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={cfg.layout.mediacard.videoBadge} onChange={(e) => patch({ layout: { ...cfg.layout, mediacard: { ...cfg.layout.mediacard, videoBadge: e.target.checked } } })} />
          <span><b>Длительность у видео</b><span className="d">0:24 на кадре</span></span>
        </label>
      </Group>

      <Group title="Плеер-лента" note="вертикальные видео рядом" open>
        <label className="check">
          <input
            type="checkbox"
            checked={cfg.layout.player.enabled && cfg.layout.sections.includes('player')}
            onChange={(e) => {
              const next = e.target.checked
                ? [...cfg.layout.sections.filter((s) => s !== 'player'), 'player' as WidgetSectionId]
                : cfg.layout.sections.filter((s) => s !== 'player')
              patch({ layout: { ...cfg.layout, sections: next, player: { ...cfg.layout.player, enabled: next.includes('player' as WidgetSectionId) } } })
            }}
          />
          <span>
            <b>Показывать плеер-ленту</b>
            <span className="d">секция «Плеер-лента» в конструкторе секций</span>
          </span>
        </label>
        <label className="fld">
          <span>Заголовок</span>
          <input value={cfg.layout.player.title} onChange={(e) => patch({ layout: { ...cfg.layout, player: { ...cfg.layout.player, title: e.target.value } } })} />
        </label>
        <div className="f2">
          <label className="fld">
            <span>Формат плитки</span>
            <select
              value={cfg.layout.player.tile.aspect}
              onChange={(e) => patch({ layout: { ...cfg.layout, player: { ...cfg.layout.player, tile: { ...cfg.layout.player.tile, aspect: e.target.value as WidgetConfig['layout']['player']['tile']['aspect'] } } } })}
            >
              <option value="9:16">9:16 вертикальный</option>
              <option value="3:4">3:4 портрет</option>
              <option value="1:1">1:1 квадрат</option>
            </select>
          </label>
          <RangeField
            label="Ширина"
            value={cfg.layout.player.tile.width}
            min={120}
            max={200}
            step={4}
            format={(v) => `${v}px`}
            onChange={(v) => patch({ layout: { ...cfg.layout, player: { ...cfg.layout.player, tile: { ...cfg.layout.player.tile, width: v } } } })}
          />
        </div>
        <div className="fld">
          <span>Подписи на плитке</span>
          <div className="attrflags">
            <label className="check">
              <input type="checkbox" checked={cfg.layout.player.showAuthor} onChange={(e) => patch({ layout: { ...cfg.layout, player: { ...cfg.layout.player, showAuthor: e.target.checked } } })} />
              <b>Автор</b>
            </label>
            <label className="check">
              <input type="checkbox" checked={cfg.layout.player.showLikes} onChange={(e) => patch({ layout: { ...cfg.layout, player: { ...cfg.layout.player, showLikes: e.target.checked } } })} />
              <b>Лайки</b>
            </label>
            <label className="check">
              <input type="checkbox" checked={cfg.layout.player.showSourceBadge} onChange={(e) => patch({ layout: { ...cfg.layout, player: { ...cfg.layout.player, showSourceBadge: e.target.checked } } })} />
              <b>Площадка</b>
            </label>
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={cfg.layout.player.autoAdvance.enabled} onChange={(e) => patch({ layout: { ...cfg.layout, player: { ...cfg.layout.player, autoAdvance: { ...cfg.layout.player.autoAdvance, enabled: e.target.checked } } } })} />
          <b>Автоперелистывание ленты</b>
        </label>
        <RangeField label="Интервал перелистывания" value={cfg.layout.player.autoAdvance.intervalSec} min={4} max={10} step={1} format={(v) => `${v} сек`} onChange={(v) => patch({ layout: { ...cfg.layout, player: { ...cfg.layout.player, autoAdvance: { ...cfg.layout.player.autoAdvance, intervalSec: v } } } })} />
        <label className="check">
          <input type="checkbox" checked={cfg.layout.player.autoAdvance.pauseOnHover} onChange={(e) => patch({ layout: { ...cfg.layout, player: { ...cfg.layout.player, autoAdvance: { ...cfg.layout.player.autoAdvance, pauseOnHover: e.target.checked } } } })} />
          <b>Пауза при наведении</b>
        </label>
      </Group>

      <Group title="Продвинутое" note="реже нужное">
        <label className="check">
          <input type="checkbox" checked={cfg.theme.dark} onChange={(e) => patch({ theme: { ...cfg.theme, dark: e.target.checked } })} />
          <span>
            <b>Тёмная тема</b>
            <span className="d">инвертирует подложки и текст</span>
          </span>
        </label>
        <div className="theme-palettes" role="group" aria-label="Готовые цветовые палитры">
          {THEME_PALETTES.map(({ name, theme }) => (
            <button key={name} type="button" className="theme-palette" aria-label={`Применить палитру «${name}»`} aria-pressed={(Object.keys(theme) as (keyof WidgetConfig['theme'])[]).every((key) => cfg.theme[key] === theme[key])} onClick={() => patch({ theme })}>
              <b>{name}</b>
              {[theme.panel, theme.text, theme.muted, theme.accent, theme.accentInk, theme.border, theme.star].map((color, index) => (
                <span key={`${color}-${index}`} aria-hidden="true" style={{ background: color }} />
              ))}
            </button>
          ))}
        </div>
        <div className="f2">
          <ColorField label="Цвет текста" value={cfg.theme.text} onChange={(value) => patch({ theme: { ...cfg.theme, text: value } })} />
          <ColorField label="Приглушённый" value={cfg.theme.muted} onChange={(value) => patch({ theme: { ...cfg.theme, muted: value } })} />
        </div>
        <ColorField label="Цвет текста на акценте" value={cfg.theme.accentInk} onChange={(value) => patch({ theme: { ...cfg.theme, accentInk: value } })} />
        <label className="fld">
          <span>Шрифт</span>
          <select
            value={cfg.typography.inheritSite ? 'inherit' : !cfg.typography.fontFamily.trim() || cfg.typography.fontFamily.includes('Onest') ? 'onest' : cfg.typography.fontFamily.includes('Manrope') ? 'manrope' : 'custom'}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'inherit') {
                patch({ typography: { ...cfg.typography, inheritSite: true } })
              } else if (v === 'onest') {
                patch({ typography: { ...cfg.typography, inheritSite: false, fontFamily: '' } })
              } else if (v === 'manrope') {
                patch({ typography: { ...cfg.typography, inheritSite: false, fontFamily: "Manrope, system-ui, sans-serif" } })
              } else {
                const custom = window.prompt('Свой CSS-стек шрифта:', cfg.typography.fontFamily)
                if (custom !== null && custom.trim()) patch({ typography: { ...cfg.typography, inheritSite: false, fontFamily: custom.trim() } })
              }
            }}
          >
            <option value="onest">Onest (встроенный)</option>
            <option value="inherit">Наследовать сайт</option>
            <option value="manrope">Manrope</option>
            <option value="custom">Свой CSS-стек…</option>
          </select>
        </label>
        {cfg.typography.inheritSite && (
          <span className="hint">Наследование сайта применяет и его цвета: они могут переопределить выбранную палитру и ручные значения.</span>
        )}
        {!cfg.typography.inheritSite && cfg.typography.fontFamily && (
          <label className="fld">
            <span>CSS-стек шрифта</span>
            <input value={cfg.typography.fontFamily} onChange={(e) => patch({ typography: { ...cfg.typography, fontFamily: e.target.value } })} />
          </label>
        )}
        <label className="fld">
          <span>Пагинация</span>
          <select value={cfg.layout.pagination} onChange={(e) => patch({ layout: { ...cfg.layout, pagination: e.target.value as WidgetConfig['layout']['pagination'] } })}>
            <option value="more">Кнопка «Показать ещё»</option>
            <option value="pages">Страницы</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={cfg.visibility.marketplaceBadges}
            onChange={(e) => patch({ visibility: { ...cfg.visibility, marketplaceBadges: e.target.checked } })}
          />
          <span>
            <b>Бейдж источника</b>
            <span className="d">WB/Ozon/ЯМ на плитке</span>
          </span>
        </label>
        <div className="fld">
          <span>Подписи площадок</span>
          <div className="seg" role="group" aria-label="Вид подписей площадок">
            <button type="button" aria-pressed={cfg.appearance.marketplaceDisplay === 'text'} onClick={() => patch({ appearance: { ...cfg.appearance, marketplaceDisplay: 'text' } })}>
              Названия
            </button>
            <button type="button" aria-pressed={cfg.appearance.marketplaceDisplay === 'icons'} onClick={() => patch({ appearance: { ...cfg.appearance, marketplaceDisplay: 'icons' } })}>
              Иконки
            </button>
          </div>
          <span className="hint">Во всём виджете, включая фильтры и медиа. Переименованные вручную площадки всегда остаются текстом.</span>
        </div>
        {(['photos', 'sellerAnswers', 'prosCons', 'questions'] as const).map((key) => (
          <label className="check" key={key}>
            <input type="checkbox" checked={cfg.visibility[key]} onChange={(e) => patch({ visibility: { ...cfg.visibility, [key]: e.target.checked } })} />
            <b>{visibilityLabels[key]}</b>
          </label>
        ))}
        <div className="f2">
          <label className="fld">
            <span>Стена: мин. ширина</span>
            <input
              type="number"
              min={140}
              max={320}
              value={cfg.layout.wall.minTileWidth}
              onChange={(e) => patch({ layout: { ...cfg.layout, wall: { ...cfg.layout.wall, minTileWidth: Number(e.target.value) } } })}
            />
          </label>
          <label className="fld">
            <span>Стена: отступ</span>
            <input
              type="number"
              min={0}
              max={48}
              value={cfg.layout.wall.gap}
              onChange={(e) => patch({ layout: { ...cfg.layout, wall: { ...cfg.layout.wall, gap: Number(e.target.value) } } })}
            />
          </label>
        </div>
        <label className="fld">
          <span>Стена: максимум плиток</span>
          <input type="number" min={1} max={96} value={cfg.layout.wall.maxTiles} onChange={(e) => patch({ layout: { ...cfg.layout, wall: { ...cfg.layout.wall, maxTiles: Number(e.target.value) } } })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={cfg.layout.tileHover} onChange={(e) => patch({ layout: { ...cfg.layout, tileHover: e.target.checked } })} />
          <b>Подписи при наведении на плитку стены</b>
        </label>
        <div className="f2">
          <label className="fld">
            <span>Видео: формат плитки</span>
            <select value={cfg.layout.video.aspect} onChange={(e) => patch({ layout: { ...cfg.layout, video: { ...cfg.layout.video, aspect: e.target.value as WidgetConfig['layout']['video']['aspect'] } } })}>
              <option value="9:16">9:16 вертикальный</option>
              <option value="3:4">3:4 портрет</option>
              <option value="1:1">1:1 квадрат</option>
            </select>
          </label>
          <RangeField label="Видео: ширина" value={cfg.layout.video.tileWidth} min={120} max={200} step={4} format={(v) => `${v}px`} onChange={(v) => patch({ layout: { ...cfg.layout, video: { ...cfg.layout.video, tileWidth: v } } })} />
        </div>
        <div className="attrflags">
          <label className="check">
            <input type="checkbox" checked={cfg.layout.video.showAuthor} onChange={(e) => patch({ layout: { ...cfg.layout, video: { ...cfg.layout.video, showAuthor: e.target.checked } } })} />
            <b>Видео: автор</b>
          </label>
          <label className="check">
            <input type="checkbox" checked={cfg.layout.video.showSourceBadge} onChange={(e) => patch({ layout: { ...cfg.layout, video: { ...cfg.layout.video, showSourceBadge: e.target.checked } } })} />
            <b>Видео: площадка</b>
          </label>
        </div>
        <div className="fld">
          <span>Ответ продавца · стиль</span>
          <div className="seg" role="group" aria-label="Стиль ответа">
            {([['card', 'Карточка'], ['plain', 'Тонкая'], ['bubble', 'Пузырь'], ['accent', 'Акцент']] as const).map(([style, label]) => (
              <button key={style} aria-pressed={cfg.answers.style === style} onClick={() => patch({ answers: { ...cfg.answers, style } })}>{label}</button>
            ))}
          </div>
        </div>
        <ColorField label="Цвет ответа" value={cfg.answers.color} onChange={(color) => patch({ answers: { ...cfg.answers, color } })} />
        <label className="fld">
          <span>Заголовок ответа</span>
          <input value={cfg.answers.title} placeholder="Имя продавца из отзыва" onChange={(e) => patch({ answers: { ...cfg.answers, title: e.target.value } })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={cfg.answers.showTitle} onChange={(e) => patch({ answers: { ...cfg.answers, showTitle: e.target.checked } })} />
          <b>Показывать заголовок ответа</b>
        </label>
        <div className="fld">
          <span>Плеер · оформление</span>
          <div className="seg" role="group" aria-label="Хром плеера">
            <button aria-pressed={cfg.viewer.chrome === 'full'} onClick={() => patch({ viewer: { ...cfg.viewer, chrome: 'full' } })}>Полный</button>
            <button aria-pressed={cfg.viewer.chrome === 'min'} onClick={() => patch({ viewer: { ...cfg.viewer, chrome: 'min' } })}>Минималистичный</button>
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={cfg.layout.video.productPanel} onChange={(e) => patch({ layout: { ...cfg.layout, video: { ...cfg.layout.video, productPanel: e.target.checked } } })} />
          <span><b>Панель товара в плеере</b><span className="d">показывается, если у медиа есть данные товара</span></span>
        </label>
        <label className="check">
          <input type="checkbox" checked={cfg.viewer.showOriginal} onChange={(e) => patch({ viewer: { ...cfg.viewer, showOriginal: e.target.checked } })} />
          <b>«Открыть оригинал»</b>
        </label>
        <label className="check">
          <input type="checkbox" checked={cfg.viewer.showCounter} onChange={(e) => patch({ viewer: { ...cfg.viewer, showCounter: e.target.checked } })} />
          <b>Счётчик медиа в плеере</b>
        </label>
        <label className="check">
          <input type="checkbox" checked={cfg.layout.video.autoplayInViewer} onChange={(e) => patch({ layout: { ...cfg.layout, video: { ...cfg.layout.video, autoplayInViewer: e.target.checked } } })} />
          <span><b>Автовоспроизведение (без звука)</b><span className="d">видео в плеере автоматически переходит к следующему</span></span>
        </label>
        <label className="fld">
          <span>Ссылка «Смотреть все»</span>
          <input value={cfg.appearance.viewAllHref} placeholder="https://shop.example/reviews" onChange={(e) => patch({ appearance: { ...cfg.appearance, viewAllHref: e.target.value } })} />
        </label>
        {(['search', 'viewAll', 'recentlyAdded'] as const).map((key) => (
          <label className="fld" key={key}>
            <span>{key === 'search' ? 'Подсказка поиска' : key === 'viewAll' ? 'Текст «Смотреть все»' : 'Подпись свежего отзыва'}</span>
            <input value={cfg.labels[key]} placeholder={defaultWidgetConfig.labels[key]} onChange={(e) => patch({ labels: { ...cfg.labels, [key]: e.target.value } })} />
          </label>
        ))}
      </Group>
    </>
  )
}

function applyPresetFrom(presetId: string, cfg: WidgetConfig, patch: (p: Partial<WidgetConfig>) => void) {
  const vars = PRESET_VARS[presetId]
  if (!vars) return
  patch({
    theme: { ...cfg.theme, ...vars.theme },
    typography: { ...cfg.typography, ...vars.typography, scale: 1 },
    layout: { ...cfg.layout, ...vars.layout },
    header: { ...cfg.header, ...vars.header },
    form: { ...cfg.form, ...vars.form },
    appearance: { ...cfg.appearance, ...vars.appearance },
  })
}

// E2: contrast guard — WCAG-пары из макета 04-editor (04:1832-1843).
const CPAIRS: { key: string; need: number; msg: string }[] = [
  { key: 'star', need: 3, msg: 'Звёзды сливаются с фоном карточки' },
  { key: 'text', need: 4.5, msg: 'Текст отзывов почти не читается на фоне' },
  { key: 'muted', need: 4.5, msg: 'Приглушённый текст слишком бледный' },
  { key: 'accink', need: 4.5, msg: 'Текст на акцентном фоне нечитаем' },
]

function hexLum(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 1
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function hexToRgb(hex: string): [number, number, number] | null {
  let h = String(hex || '').replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function contrastRatio(a: string, b: string): number {
  const l1 = hexLum(a)
  const l2 = hexLum(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a) ?? [0, 0, 0]
  const B = hexToRgb(b) ?? [0, 0, 0]
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

type ContrastWarn = { key: string; need: number; msg: string; ratio: number } | null

function effectiveColor(cfg: WidgetConfig, key: Exclude<keyof WidgetConfig['theme'], 'dark'>): string {
  const dark = { accent: '#b99bdf', accentInk: '#211b29', text: '#f0eaf5', muted: '#b8adbf', panel: '#211d26', border: '#4d4356', star: '#e5ba62' }
  const value = hexToRgb(cfg.theme[key]) ? mixHex(cfg.theme[key], cfg.theme[key], 0) : defaultWidgetConfig.theme[key]
  return cfg.theme.dark && value.toLowerCase() === defaultWidgetConfig.theme[key].toLowerCase() ? dark[key] : value
}

function checkContrast(cfg: WidgetConfig): ContrastWarn {
  const panelEff = effectiveColor(cfg, 'panel')
  for (const p of CPAIRS) {
    const against = p.key === 'accink' ? effectiveColor(cfg, 'accent') : panelEff
    const ratio = contrastRatio(effectiveColor(cfg, p.key === 'accink' ? 'accentInk' : p.key as 'text' | 'muted' | 'star'), against)
    if (ratio < p.need) return { ...p, ratio }
  }
  return null
}

function fixContrast(key: string, cfg: WidgetConfig, patch: (p: Partial<WidgetConfig>) => void) {
  const p = CPAIRS.find((x) => x.key === key)
  if (!p) return
  const target = effectiveColor(cfg, key === 'accink' ? 'accent' : 'panel')
  const goal = contrastRatio('#000000', target) >= contrastRatio('#ffffff', target) ? '#000000' : '#ffffff'
  const from = effectiveColor(cfg, key === 'accink' ? 'accentInk' : key as 'text' | 'muted' | 'star')
  let cur = from
  for (let i = 1; i <= 16; i++) {
    cur = mixHex(from, goal, i / 16)
    if (contrastRatio(cur, target) >= p.need) break
  }
  if (key === 'accink') patch({ theme: { ...cfg.theme, accentInk: cur } })
  else if (key === 'star') patch({ theme: { ...cfg.theme, star: cur } })
  else if (key === 'muted') patch({ theme: { ...cfg.theme, muted: cur } })
  else if (key === 'text') patch({ theme: { ...cfg.theme, text: cur } })
  toast.info('Цвет подправлен до читаемого контраста')
}

function modeLabel(m: WidgetConfig['layout']['mode']) {
  switch (m) {
    case 'list':
      return 'Список'
    case 'grid':
      return 'Сетка'
    case 'carousel':
      return 'Лента'
    case 'video':
      return 'Видео'
    case 'wall':
      return 'Стена'
  }
}

function SectionsGroup({ cfg, patch }: { cfg: WidgetConfig; patch: (p: Partial<WidgetConfig>) => void }) {
  const dragIndex = useRef<number | null>(null)

  function move(from: number, to: number) {
    if (from < 0 || to < 0 || to >= cfg.layout.sections.length || from === to) return
    const next = [...cfg.layout.sections]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    patch({ layout: { ...cfg.layout, sections: next } })
  }

  function toggleSection(id: WidgetSectionId, enable: boolean) {
    const next = enable
      ? [...cfg.layout.sections.filter((section) => section !== id), id]
      : cfg.layout.sections.filter((s) => s !== id)
    patch({ layout: { ...cfg.layout, sections: next, player: id === 'player' ? { ...cfg.layout.player, enabled: enable } : cfg.layout.player } })
  }

  return (
    <Group title="Секции" note="тяните, чтобы менять порядок" open>
      <div className="seclist">
        {[...cfg.layout.sections, ...(Object.keys(widgetSectionLabels) as WidgetSectionId[]).filter((id) => !cfg.layout.sections.includes(id))].map((id) => {
          const index = cfg.layout.sections.indexOf(id)
          const enabled = index !== -1
          return (
            <div
              key={id}
              className="secrow"
              draggable={enabled}
              onDragStart={(e) => {
                dragIndex.current = index
                e.currentTarget.classList.add('dragging')
              }}
              onDragEnd={(e) => { dragIndex.current = null; e.currentTarget.classList.remove('dragging') }}
              onDragOver={(e) => {
                e.preventDefault()
                const from = dragIndex.current
                if (from === null || !enabled) return
                move(from, index)
                dragIndex.current = index
              }}
              onDrop={(e) => {
                e.preventDefault()
                dragIndex.current = null
              }}
            >
              <span className="grip">
                <i />
              </span>
              {id === 'list' ? (
                <>
                  <input type="checkbox" checked disabled aria-label={widgetSectionLabels[id]} />
                  <b>{widgetSectionLabels[id]}</b>
                  <span className="tag">всегда</span>
                </>
              ) : (
                <>
                  <input type="checkbox" checked={enabled} aria-label={widgetSectionLabels[id]} onChange={(e) => toggleSection(id, e.target.checked)} />
                  <b className={enabled ? '' : 'off'}>{widgetSectionLabels[id]}</b>
                </>
              )}
              {enabled && <span className="attrflags" style={{ marginLeft: 'auto' }}>
                <button type="button" className="quiet sm" disabled={index === 0} aria-label={`${widgetSectionLabels[id]}: выше`} onClick={() => move(index, index - 1)}>↑</button>
                <button type="button" className="quiet sm" disabled={index === cfg.layout.sections.length - 1} aria-label={`${widgetSectionLabels[id]}: ниже`} onClick={() => move(index, index + 1)}>↓</button>
              </span>}
            </div>
          )
        })}
      </div>
      <span className="hint">Порядок применяется к превью сразу. «Список отзывов» — ядро виджета, не выключается.</span>
    </Group>
  )
}

/* ============ ОТБОР ============ */

function SelectPanel({ cfg, patch }: { cfg: WidgetConfig; patch: (p: Partial<WidgetConfig>) => void }) {
  const dragIndex = useRef<number | null>(null)

  function moveRanking(from: number, to: number) {
    if (to < 0 || to >= cfg.ranking.length || from === to) return
    const next = [...cfg.ranking]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    patch({ ranking: next })
  }

  return (
    <>
      <Group title="Правила выдачи" open>
        <div className="fld">
          <span>Минимальная оценка</span>
          <div className="seg" role="group" aria-label="Минимальная оценка">
            <button aria-pressed={cfg.defaults.minRating === 0} onClick={() => patch({ defaults: { ...cfg.defaults, minRating: 0 } })}>
              Все
            </button>
            <button aria-pressed={cfg.defaults.minRating === 4} onClick={() => patch({ defaults: { ...cfg.defaults, minRating: 4 } })}>
              4 и выше
            </button>
            <button aria-pressed={cfg.defaults.minRating === 5} onClick={() => patch({ defaults: { ...cfg.defaults, minRating: 5 } })}>
              Только 5
            </button>
          </div>
        </div>
        <span className="hint">
          Минимум продавца ограничивает доступные покупателю фильтры: покупатель не может ослабить это правило.
          {' '}Общее количество, средняя оценка, распределение и доля оценок 4–5★ считаются после правил отбора магазина, а не по всем импортированным отзывам.
        </span>
        <label className="fld">
          <span>Площадка по умолчанию</span>
          <select
            value={cfg.defaults.marketplace}
            onChange={(e) => patch({ defaults: { ...cfg.defaults, marketplace: e.target.value as WidgetConfig['defaults']['marketplace'] } })}
          >
            <option value="all">Все площадки</option>
            <option value="wb">Wildberries</option>
            <option value="ozon">Ozon</option>
            <option value="ym">Яндекс Маркет</option>
          </select>
        </label>
        <label className="fld">
          <span>Начальная сортировка</span>
          <select
            value={cfg.defaults.initialSort}
            onChange={(e) => patch({ defaults: { ...cfg.defaults, initialSort: e.target.value as WidgetConfig['defaults']['initialSort'] } })}
          >
            <option value="relevance">Релевантные</option>
            <option value="newest">Сначала новые</option>
            <option value="highest">Высокая оценка</option>
            <option value="lowest">Низкая оценка</option>
            <option value="media">С медиа</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={cfg.defaults.requireText} onChange={(e) => patch({ defaults: { ...cfg.defaults, requireText: e.target.checked } })} />
          <span>
            <b>Только с текстом</b>
            <span className="d">осмысленные отзывы без пустышек</span>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={cfg.defaults.requirePhoto} onChange={(e) => patch({ defaults: { ...cfg.defaults, requirePhoto: e.target.checked } })} />
          <span>
            <b>Только с фото</b>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={cfg.defaults.onlyWithAnswer} onChange={(e) => patch({ defaults: { ...cfg.defaults, onlyWithAnswer: e.target.checked } })} />
          <span>
            <b>Только с ответом</b>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={cfg.defaults.photoFirst} onChange={(e) => patch({ defaults: { ...cfg.defaults, photoFirst: e.target.checked } })} />
          <span>
            <b>Фото выше</b>
            <span className="d">отзывы с медиа поднимаются</span>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={cfg.defaults.textFirst} onChange={(e) => patch({ defaults: { ...cfg.defaults, textFirst: e.target.checked } })} />
          <b>Текст выше</b>
        </label>
      </Group>

      <Group title="Порядок показа" note="тяните" open>
        <div className="ranklist">
          {cfg.ranking.map((rule, index) => (
            <div
              key={rule.field}
              className="rowl"
              draggable
              onDragStart={(e) => {
                dragIndex.current = index
                e.currentTarget.classList.add('dragging')
              }}
              onDragEnd={(e) => { dragIndex.current = null; e.currentTarget.classList.remove('dragging') }}
              onDragOver={(e) => {
                e.preventDefault()
                const from = dragIndex.current
                if (from === null || from === index) return
                const rows = Array.from(e.currentTarget.parentElement!.children) as HTMLElement[]
                const to = rows.indexOf(e.currentTarget)
                moveRanking(from, to)
                dragIndex.current = to
              }}
              onDrop={(e) => {
                e.preventDefault()
                dragIndex.current = null
              }}
            >
              <span className="grip">
                <i />
              </span>
              <b>{rankingLabels[rule.field]}</b>
              <button type="button" className="tag" aria-label={`${rankingLabels[rule.field]}: ${rule.direction === 'desc' ? 'выше' : 'ниже'}`} onClick={() => patch({ ranking: cfg.ranking.map((item, i) => i === index ? { ...item, direction: item.direction === 'desc' ? 'asc' : 'desc' } : item) })}>{rule.direction === 'desc' ? 'выше' : 'ниже'}</button>
              <button type="button" className="quiet sm" disabled={index === 0} aria-label={`${rankingLabels[rule.field]}: приоритет выше`} onClick={() => moveRanking(index, index - 1)}>↑</button>
              <button type="button" className="quiet sm" disabled={index === cfg.ranking.length - 1} aria-label={`${rankingLabels[rule.field]}: приоритет ниже`} onClick={() => moveRanking(index, index + 1)}>↓</button>
            </div>
          ))}
        </div>
        <span className="hint">Ранжирование работает внутри отфильтрованной выдачи.</span>
      </Group>

      <Group title="Форма публичных фильтров" note="как выглядят кастомные фильтры" open>
        <div className="fld">
          <span>Раскладка</span>
          <div className="seg" role="group" aria-label="Раскладка фильтров">
            {(['rows', 'dropdowns', 'chips'] as const).map((l) => (
              <button key={l} aria-pressed={cfg.filters.layout === l} onClick={() => patch({ filters: { ...cfg.filters, layout: l } })}>
                {l === 'rows' ? 'Ряды' : l === 'dropdowns' ? 'Дропдауны' : 'Чипы'}
              </button>
            ))}
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={cfg.filters.collapsible} onChange={(e) => patch({ filters: { ...cfg.filters, collapsible: e.target.checked } })} />
          <span>
            <b>Сворачиваемая панель</b>
            <span className="d">кнопка «Фильтры · N активны»</span>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={cfg.filters.multiSelect} onChange={(e) => patch({ filters: { ...cfg.filters, multiSelect: e.target.checked } })} />
          <span>
            <b>Мультивыбор значений</b>
            <span className="d">164 + 170 одновременно</span>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={cfg.filters.labelMode === 'plain'} onChange={(e) => patch({ filters: { ...cfg.filters, labelMode: e.target.checked ? 'plain' : 'all' } })} />
          <span>
            <b>Короткая подпись</b>
            <span className="d">«Рост» вместо «Все: Рост»</span>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={cfg.filters.hideRare} onChange={(e) => patch({ filters: { ...cfg.filters, hideRare: e.target.checked } })} />
          <span><b>Скрывать редкие значения</b><span className="d">значение с одним отзывом не показывается</span></span>
        </label>
        <span className="hint">
          Значения берутся из настраиваемых полей с включённым «Публичный фильтр» — вкладка «Форма».
        </span>
      </Group>
    </>
  )
}

/* ============ ФОРМА ============ */

function FormPanel({ cfg, patch, maxFiles }: { cfg: WidgetConfig; patch: (p: Partial<WidgetConfig>) => void; maxFiles: number }) {
  const labels = cfg.labels
  const formEnabled = cfg.layout.sections.includes('form')
  const fieldCount = 4 + cfg.customFields.length + Number(cfg.form.fields.title) + Number(cfg.form.fields.email) + Number(cfg.form.fields.media) + (cfg.form.fields.prosCons ? 2 : 0)

  return (
    <>
      <Group title="Форма отзыва" note={`${fieldCount} полей`} open>
        <label className="check">
          <input
            type="checkbox"
            checked={formEnabled}
            onChange={(e) => {
              const next = e.target.checked
                ? [...cfg.layout.sections, 'form' as WidgetSectionId]
                : cfg.layout.sections.filter((s) => s !== 'form')
              patch({ layout: { ...cfg.layout, sections: next } })
            }}
          />
          <span>
            <b>Показывать форму</b>
            <span className="d">секция «Форма отзыва» в конструкторе секций</span>
          </span>
        </label>
        <div className="fld">
          <span>Режим открытия</span>
          <div className="seg" role="group" aria-label="Режим формы">
            <button aria-pressed={cfg.form.mode === 'button'} onClick={() => patch({ form: { ...cfg.form, mode: 'button' } })}>
              По кнопке
            </button>
            <button aria-pressed={cfg.form.mode === 'inline'} onClick={() => patch({ form: { ...cfg.form, mode: 'inline' } })}>
              Развёрнутая
            </button>
          </div>
        </div>
        <div className="fld">
          <span>Кнопка формы</span>
          <div className="seg" role="group" aria-label="Где кнопка формы">
            {([['section', 'В секции'], ['header', 'В шапке'], ['both', 'Шапка + секция']] as const).map(([ctaMode, label]) => (
              <button key={ctaMode} aria-pressed={cfg.form.ctaMode === ctaMode} onClick={() => patch({ form: { ...cfg.form, ctaMode } })}>{label}</button>
            ))}
          </div>
        </div>
        <div className="f2">
          <label className="fld">
            <span>Заголовок формы</span>
            <input value={cfg.form.title} onChange={(e) => patch({ form: { ...cfg.form, title: e.target.value } })} />
          </label>
          <label className="fld">
            <span>Кнопка отправки</span>
            <input value={cfg.form.submitLabel} onChange={(e) => patch({ form: { ...cfg.form, submitLabel: e.target.value } })} />
          </label>
        </div>
        <div className="fld">
          <span>Поля формы</span>
          <div className="attrflags" style={{ rowGap: 8 }}>
            <label className="check">
              <input type="checkbox" checked readOnly disabled />
              <b>Имя</b>
              <span className="d">обязательное поле</span>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={cfg.form.fields.title}
                onChange={(e) => patch({ form: { ...cfg.form, fields: { ...cfg.form.fields, title: e.target.checked } } })}
              />
              <b>Заголовок</b>
            </label>
            <label className="check">
              <input type="checkbox" checked readOnly disabled />
              <b>Email</b>
              <span className="d">обязателен для приёма отзыва, не публикуется</span>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={cfg.form.fields.media}
                onChange={(e) => patch({ form: { ...cfg.form, fields: { ...cfg.form.fields, media: e.target.checked } } })}
              />
              <b>Фото и видео</b>
            </label>
            <label className="check">
              <input type="checkbox" checked={cfg.form.fields.prosCons} onChange={(e) => patch({ form: { ...cfg.form, fields: { ...cfg.form.fields, prosCons: e.target.checked } } })} />
              <b>Плюсы и минусы</b>
            </label>
            <label className="check">
              <input type="checkbox" checked readOnly disabled />
              <b>Согласие</b>
              <span className="d">обязательное поле</span>
            </label>
          </div>
        </div>
        <div className="f2">
          <label className="fld">
            <span>Медиа: максимум</span>
            <select
              value={String(cfg.form.maxMedia)}
              onChange={(e) => patch({ form: { ...cfg.form, maxMedia: Number(e.target.value) as 1 | 3 | 6 } })}
            >
              <option value="1">1</option>
              <option value="3">3</option>
              <option value="6">6</option>
            </select>
          </label>
          <label className="fld">
            <span>Подпись у медиа</span>
            <input value={cfg.form.mediaHint} onChange={(e) => patch({ form: { ...cfg.form, mediaHint: e.target.value } })} />
          </label>
        </div>
        <span className="hint">Действует также лимит сервера: до {maxFiles} файлов. При текущей настройке можно прикрепить до {Math.min(cfg.form.maxMedia, maxFiles)}.</span>
        <label className="fld">
          <span>CTA: текст</span>
          <input value={cfg.form.cta.text} onChange={(e) => patch({ form: { ...cfg.form, cta: { ...cfg.form.cta, text: e.target.value } } })} />
        </label>
        <label className="fld">
          <span>CTA: подпись</span>
          <input value={cfg.form.cta.hint} onChange={(e) => patch({ form: { ...cfg.form, cta: { ...cfg.form.cta, hint: e.target.value } } })} />
        </label>
        <label className="fld">
          <span>Кнопка «Написать отзыв»</span>
          <input
            value={labels.writeReview ?? ''}
            placeholder="Написать отзыв"
            onChange={(e) => patch({ labels: { ...labels, writeReview: e.target.value } })}
          />
        </label>
        <label className="fld">
          <span>Ссылка «Читать полностью»</span>
          <input
            value={labels.readMore ?? ''}
            placeholder="Читать полностью"
            onChange={(e) => patch({ labels: { ...labels, readMore: e.target.value } })}
          />
        </label>
        <span className="hint">
          Имя, email, оценка, текст и согласие обязательны для приёма отзыва. «По кнопке» открывает поп-ап, «Развёрнутая» — форму в секции. Расположение кнопки управляет шапкой и секцией; на главной странице форма не показывается. В превью отправка только демонстрационная.
        </span>
      </Group>

      <Group title="Подсветка в отзыве" note="кастомные теги" open>
        <div className="fld">
          <span>Стиль подсветки</span>
          <div className="seg" role="group" aria-label="Стиль подсветки">
            <button aria-pressed={cfg.customTags.display === 'chips'} onClick={() => patch({ customTags: { ...cfg.customTags, display: 'chips' } })}>
              Чипы
            </button>
            <button aria-pressed={cfg.customTags.display === 'string'} onClick={() => patch({ customTags: { ...cfg.customTags, display: 'string' } })}>
              Строка
            </button>
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={cfg.customTags.chipLabel} onChange={(e) => patch({ customTags: { ...cfg.customTags, chipLabel: e.target.checked } })} />
          <span>
            <b>Подпись в чипе</b>
            <span className="d">«Рост 164» вместо просто «164»</span>
          </span>
        </label>
      </Group>

      <Group title="Настраиваемые поля" note={`${cfg.customFields.length} из 6`} open>
        <CustomFieldsEditor fields={cfg.customFields} onChange={(customFields) => patch({ customFields })} />
      </Group>
    </>
  )
}

function CustomFieldsEditor({ fields, onChange }: { fields: CustomFieldDef[]; onChange: (fields: CustomFieldDef[]) => void }) {
  function update(index: number, p: Partial<CustomFieldDef>) {
    onChange(fields.map((field, i) => (i === index ? { ...field, ...p } : field)))
  }
  function add() {
    onChange([...fields, { id: `field_${Date.now().toString(36)}`, label: '', type: 'select', options: ['', ''], required: false, filterable: false, showInReview: true, showInSummary: false }])
  }
  return (
    <>
      {fields.map((field, index) => (
        <div className="attrcard" key={field.id}>
          <div className="ahead">
            <input
              className="lbl"
              aria-label={`Название поля ${index + 1}`}
              value={field.label}
              maxLength={60}
              placeholder="Например: Рост"
              onChange={(e) => update(index, { label: e.target.value })}
            />
            <button className="del" onClick={() => onChange(fields.filter((_, i) => i !== index))} aria-label="Удалить поле">
              ✕
            </button>
          </div>
          <div className="a2">
            <select className="sel" aria-label={`Тип поля ${field.label || index + 1}`} value={field.type} onChange={(e) => update(index, { type: e.target.value as CustomFieldDef['type'] })}>
              <option value="chips">Чипы</option>
              <option value="select">Список</option>
              <option value="text">Текст</option>
            </select>
          </div>
          {field.type !== 'text' && (
            <input
              aria-label={`Варианты поля ${field.label || index + 1}`}
              value={field.options.join(',')}
              placeholder="Варианты через запятую: 152, 158, 164"
              onChange={(e) => update(index, { options: e.target.value.split(',') })}
            />
          )}
          <div className="attrflags">
            <label className="check">
              <input type="checkbox" checked={field.required} onChange={(e) => update(index, { required: e.target.checked })} />
              <b>Обязательное</b>
            </label>
            <label className="check">
              <input type="checkbox" checked={field.filterable} onChange={(e) => update(index, { filterable: e.target.checked })} />
              <b>Фильтр</b>
            </label>
            <label className="check">
              <input type="checkbox" checked={field.showInReview} onChange={(e) => update(index, { showInReview: e.target.checked })} />
              <b>В отзыве</b>
            </label>
            <label className="check">
              <input type="checkbox" checked={field.showInSummary} onChange={(e) => update(index, { showInSummary: e.target.checked })} />
              <b>В сводке</b>
            </label>
          </div>
        </div>
      ))}
      <button className="secondary" onClick={add} disabled={fields.length >= 6}>
        + Добавить поле
      </button>
      {fields.length === 0 && (
        <span className="hint">Кастомные поля показываются в форме отзыва, в отзыве чипами и могут стать фильтрами.</span>
      )}
    </>
  )
}

/* ============ ПЛОЩАДКИ ============ */

function MarketplacePanel({ cfg, patch }: { cfg: WidgetConfig; patch: (p: Partial<WidgetConfig>) => void }) {
  // E16: счётчики отзывов и статусы доступов.
  const [byMarketplace, setByMarketplace] = useState<Record<string, number>>({})
  const [statuses, setStatuses] = useState<Record<string, { configured: boolean; enabled: boolean }>>({})
  useEffect(() => {
    apiGet<{ by_marketplace?: Record<string, number> }>('/admin/api/dashboard')
      .then((d) => setByMarketplace(d.by_marketplace ?? {}))
      .catch(() => {})
    apiGet<{ marketplaces: { id: string; configured: boolean; enabled: boolean }[] }>('/admin/api/marketplaces')
      .then((d) => {
        const map: Record<string, { configured: boolean; enabled: boolean }> = {}
        d.marketplaces.forEach((m) => {
          map[m.id] = { configured: m.configured, enabled: m.enabled }
        })
        setStatuses(map)
      })
      .catch(() => {})
  }, [])
  const mpBadges: Record<string, { text: string; cls: string }> = {
    wb: { text: `${byMarketplace.wb ?? 0} отзывов`, cls: 'bag-ok' },
    ym: { text: 'выключен', cls: 'bag-neutral' },
    ozon: { text: statuses.ozon?.configured ? 'готов' : 'нет доступов', cls: statuses.ozon?.configured ? 'bag-ok' : 'bag-warn' },
  }
  function setPolicy<K extends keyof MarketplacePolicy>(
    marketplace: keyof WidgetConfig['marketplacePolicy'],
    key: K,
    value: MarketplacePolicy[K],
  ) {
    patch({
      marketplacePolicy: {
        ...cfg.marketplacePolicy,
        [marketplace]: { ...cfg.marketplacePolicy[marketplace], [key]: value },
      },
    })
  }

  return (
    <Group title="Площадки в публичном виджете" open>
      {(['wb', 'ym', 'ozon'] as (keyof WidgetConfig['marketplacePolicy'])[]).map((mp) => {
        const policy = cfg.marketplacePolicy[mp]
        return (
          <div key={mp} style={{ display: 'grid', gap: 10, borderTop: mp === 'wb' ? undefined : '1px dashed var(--border)', paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <b style={{ fontSize: 13.5 }}>{marketplaceLabels[mp]}</b>
              <span className={`bag ${mpBadges[mp].cls}`}>{mpBadges[mp].text}</span>
            </div>
            <label className="check">
              <input type="checkbox" checked={!policy.hidden} onChange={(e) => setPolicy(mp, 'hidden', !e.target.checked)} />
              <span>
                <b>Показывать отзывы</b>
              </span>
            </label>
            <label className="fld">
              <span>Публичное название</span>
              <input
                value={policy.label}
                onChange={(e) => setPolicy(mp, 'label', e.target.value)}
                placeholder={mp === 'wb' ? 'Маркетплейс' : marketplaceLabels[mp]}
              />
            </label>
            <label className="check">
              <input type="checkbox" checked={policy.showSourceLinks} onChange={(e) => setPolicy(mp, 'showSourceLinks', e.target.checked)} />
              <span>
                <b>Ссылки на источник</b>
                <span className="d">ведут на отзыв на площадке</span>
              </span>
            </label>
          </div>
        )
      })}
      <p className="hint">
        Публичное название показывается покупателям вместо бренда площадки — полезно, если скрываете, откуда
        собраны отзывы.
      </p>
    </Group>
  )
}

function VersionsPanel({
  versions,
  context,
  contextVersions,
  onRollback,
}: {
  versions: VersionItem[]
  context: WidgetContext
  contextVersions: Record<string, number>
  onRollback: (version: number) => void
}) {
  return (
    <>
      <Group title="Версии конфига" note={context === 'product' ? 'карточка товара' : 'главная страница'} open>
        {versions.length === 0 && <p className="hint">Версий пока нет — опубликуйте первую.</p>}
        <div className="rows">
          {versions.map((item) => (
            <div className="vrow" key={item.version} aria-current={item.active || undefined}>
              <b>v{item.version}</b>
              <span className="when">{item.active ? 'активна' : new Date(item.created_at).toLocaleString()}</span>
              {item.active ? (
                <span className="tag" style={{ color: 'var(--ok)' }}>
                  в эфире
                </span>
              ) : (
                <button className="quiet sm" onClick={() => onRollback(item.version)}>
                  Откатить
                </button>
              )}
            </div>
          ))}
        </div>
        <span className="hint">Каждая публикация создаёт версию целиком для контекста. Откат мгновенный.</span>
      </Group>
      <Group title="Контексты" open>
        <div className="rows">
          <div className="rowl">
            <b>Карточка товара</b>
            <span className="tag" style={{ color: contextVersions.product ? 'var(--ok)' : 'var(--soft-muted)' }}>
              {contextVersions.product ? `v${contextVersions.product} активна` : 'нет версий'}
            </span>
          </div>
          <div className="rowl">
            <b>Главная страница</b>
            <span className="tag" style={{ color: contextVersions.homepage ? 'var(--ok)' : 'var(--soft-muted)' }}>
              {contextVersions.homepage ? `v${contextVersions.homepage} активна` : 'нет версий'}
            </span>
          </div>
        </div>
        <span className="hint">Переключается селектором «Карточка товара / Главная страница» в панели сверху.</span>
      </Group>
    </>
  )
}
/* ============ общие блоки ============ */

function Group({ title, note, open = true, children }: { title: string; note?: string; open?: boolean; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(open)
  return (
    <div className={`grp${isOpen ? ' open' : ''}`}>
      <button type="button" className="ghead" aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)}>
        <b>{title}</b>
        {note && <span className="n">{note}</span>}
        <svg aria-hidden="true" className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div className="gbody">{children}</div>
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="fld">
      <span>{label}</span>
      <div className="color-field">
        <input type="color" aria-label={`${label}: выбрать цвет`} value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
        <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  )
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <label className="fld">
      <span>
        {label} · <b style={{ fontSize: 12, color: 'var(--muted)' }}>{format(value)}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

/* ============ превью: мок-страница + реальный виджет ============ */


const widgetBaseURL = new URL('/', window.location.origin)
const widgetCssText = `@import url("${new URL('reviews-widget.css', widgetBaseURL)}");`

function previewSampleReviews(sampleReviews: unknown[]) {
  return sampleReviews.map((review) => {
    const item = review as Record<string, unknown>
    if (!Array.isArray(item.media)) return review
    return {
      ...item,
      media: item.media.map((media) => {
        const value = media as Record<string, unknown>
        return {
          ...value,
          ...(typeof value.url === 'string' ? { url: new URL(value.url, widgetBaseURL).href } : {}),
          ...(typeof value.previewUrl === 'string' ? { previewUrl: new URL(value.previewUrl, widgetBaseURL).href } : {}),
        }
      }),
    }
  })
}

function previewDocument() {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/reviews-widget.css">
  <style>
    *{box-sizing:border-box}
    body{margin:0;background:#f6f6f4;font-family:Manrope,system-ui,sans-serif;color:#17191D}
    .shop-top{display:flex;align-items:center;gap:20px;padding:14px 26px;border-bottom:1px solid #E3E3DF}
    .shop-logo{font-weight:800;letter-spacing:.12em;font-size:15px}
    .shop-nav{display:flex;gap:16px;font-size:12.5px;color:#5D6167;font-weight:600}
    .shop-cart{margin-left:auto;width:32px;height:32px;border-radius:50%;background:#EFEFEC;display:grid;place-items:center;color:#5D6167;font-size:14px}
    .shop-crumbs{padding:12px 26px 0;font-size:11.5px;color:#9AA1AA;font-weight:600}
    .phero{display:grid;grid-template-columns:300px minmax(0,1fr);gap:24px;padding:16px 26px 24px;border-bottom:1px solid #E3E3DF}
    .phero .img{aspect-ratio:1;border-radius:12px;background:#e7e7e3;position:relative}
    .phero .img::after{content:"";position:absolute;inset:auto 14% 0;height:58%;border-radius:12px 12px 0 0;background:rgba(255,255,255,.28)}
    .phero h2{font-size:20px;font-weight:800;margin:0}
    .phero .rate{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#5D6167;margin-top:6px}
    .phero .rate .st{color:#777b80;font-size:12px;letter-spacing:1px}
    .phero .price{font-size:22px;font-weight:800;margin-top:10px}
    .phero .desc{font-size:12.5px;color:#5D6167;margin-top:8px;max-width:420px}
    .phero .buy{margin-top:14px;display:inline-flex;align-items:center;min-height:40px;padding:0 22px;border-radius:999px;background:#17191D;color:#fff;font-size:13.5px;font-weight:700}
    @media (max-width:520px){.phero{grid-template-columns:1fr}.shop-nav{display:none}.phero .img{max-width:220px}}
  </style>
</head>
<body>
  <div class="shop-top">
    <span class="shop-logo">МАГАЗИН</span>
    <nav class="shop-nav"><span>Каталог</span><span>Новинки</span><span>Доставка</span></nav>
    <span class="shop-cart" aria-label="Корзина"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 7h14l1 14H4L5 7Z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg></span>
  </div>
  <div class="shop-crumbs">Главная / Каталог / Пример товара</div>
  <div class="phero">
    <div class="img" role="img" aria-label="Место для фотографии товара"></div>
    <div>
      <h2>Пример товара</h2>
      <div class="rate"><span class="st">★★★★★</span><span>4,7 · <b>312 отзывов</b></span></div>
      <div class="price">2 490 ₽</div>
      <p class="desc">Описание, характеристики и фотографии вашего товара. Ниже — отзывы покупателей.</p>
      <button class="buy">Добавить в корзину</button>
    </div>
  </div>
  <div id="preview" class="reviews-widget reviews-widget-root"></div>
  <script src="/reviews-widget.js"></script>
</body>
</html>`
}
