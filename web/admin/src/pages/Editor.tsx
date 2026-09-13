import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiGet, apiWrite } from '../api'
import { toast } from '../toast'
import { useDirty } from '../useDirty'
import {
  defaultWidgetConfig,
  mergeWidgetConfig,
  widgetPresets,
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

type ReviewsWidgetApi = {
  mount: (root: HTMLElement, options: Record<string, unknown>) => void
  sampleReviews: unknown[]
  defaultConfig: Record<string, unknown>
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

// E4: пресеты-снапшоты из макета 04-editor (04:1144-1149) — применяют весь вид.
const PRESET_VARS: Record<string, Partial<WidgetConfig>> = {
  default: {
    theme: { ...defaultWidgetConfig.theme, accent: '#68478D', star: '#C99A3F', border: '#E7DFD7', panel: '#ffffff' },
    typography: { ...defaultWidgetConfig.typography, radius: 16, scale: 1, density: 'comfortable' },
    layout: { ...defaultWidgetConfig.layout, mode: 'list', columns: 2 },
    header: { ...defaultWidgetConfig.header, layout: 'row' },
    form: { ...defaultWidgetConfig.form, mode: 'inline' },
    appearance: { ...defaultWidgetConfig.appearance, preset: 'default' },
  },
  editorial: {
    theme: { ...defaultWidgetConfig.theme, accent: '#17191D', star: '#17191D', border: '#E3E3E3', panel: '#ffffff' },
    typography: { ...defaultWidgetConfig.typography, radius: 4, scale: 1, density: 'comfortable' },
    layout: { ...defaultWidgetConfig.layout, mode: 'carousel', columns: 2 },
    header: { ...defaultWidgetConfig.header, layout: 'center' },
    form: { ...defaultWidgetConfig.form, mode: 'button' },
    appearance: { ...defaultWidgetConfig.appearance, preset: 'ugc-editorial' },
  },
  community: {
    theme: { ...defaultWidgetConfig.theme, accent: '#0E7A6E', star: '#E8A33D', border: '#EAE3DA', panel: '#ffffff' },
    typography: { ...defaultWidgetConfig.typography, radius: 14, scale: 1, density: 'comfortable' },
    layout: { ...defaultWidgetConfig.layout, mode: 'wall', columns: 3 },
    header: { ...defaultWidgetConfig.header, layout: 'stack' },
    form: { ...defaultWidgetConfig.form, mode: 'button' },
    appearance: { ...defaultWidgetConfig.appearance, preset: 'ugc-community' },
  },
  bazaar: {
    theme: { ...defaultWidgetConfig.theme, accent: '#C2410C', star: '#C2410C', border: '#EADFD6', panel: '#ffffff' },
    typography: { ...defaultWidgetConfig.typography, radius: 6, scale: 1, density: 'compact' },
    layout: { ...defaultWidgetConfig.layout, mode: 'grid', columns: 3 },
    header: { ...defaultWidgetConfig.header, layout: 'row' },
    form: { ...defaultWidgetConfig.form, mode: 'inline' },
    appearance: { ...defaultWidgetConfig.appearance, preset: 'bazaar' },
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
  const [contextVersions, setContextVersions] = useState<Record<string, number>>({})
  // E3: источник превью (мок | прокси-страница). /api/preview-page готов на BE.
  const [previewSource, setPreviewSource] = useState<'mock' | 'real'>('mock')
  const [shopOrigin, setShopOrigin] = useState('')

  function load(nextContext = context) {
    historyRef.current = []
    Promise.all([
      apiGet<Partial<WidgetConfig>>(`/admin/api/widget-config/${nextContext}`),
      apiGet<{ versions: VersionItem[] }>(`/admin/api/widget-config/${nextContext}/versions`),
    ])
      .then(([config, versionData]) => {
        const merged = mergeWidgetConfig(config)
        // E12: черновик перезаписывает эфирную версию (публикация сохраняет BASE).
        let draft: Partial<WidgetConfig> | null = null
        try {
          draft = JSON.parse(window.localStorage.getItem(`reviews-draft-${nextContext}`) || 'null')
        } catch {
          draft = null
        }
        const withDraft = draft ? mergeWidgetConfig({ ...merged, ...draft }) : merged
        setCfg(withDraft)
        setBaseline(merged)
        setPreviewCfg(withDraft)
        setVersions(versionData.versions)
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Запрос не выполнен'))
  }

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
        setContextVersions(map)
      })
      .catch(() => {})
  }, [context])

  useEffect(() => load(context), [context])

  // Debounce config → preview: the srcDoc iframe remounts on every change, so
  // fast typing in text/color inputs shouldn't thrash it.
  const previewTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    window.clearTimeout(previewTimer.current)
    previewTimer.current = window.setTimeout(() => setPreviewCfg(cfg), 200)
    return () => window.clearTimeout(previewTimer.current)
  }, [cfg])

  const dirty = useDirty(cfg, baseline)
  const activeVersion = versions.find((v) => v.active)?.version ?? null
  const [canUndo, setCanUndo] = useState(false)

  // E1: каждое изменение пушит снапшот в историю (до 60) и сохраняет черновик.
  function pushHistory(prev: WidgetConfig) {
    historyRef.current.push(JSON.stringify(prev))
    if (historyRef.current.length > 60) historyRef.current.shift()
    setCanUndo(true)
    try {
      window.localStorage.setItem(`reviews-draft-${context}`, JSON.stringify(prev))
    } catch {
      /* приватный режим — черновик живёт только в памяти */
    }
  }

  function undoDraft() {
    const snap = historyRef.current.pop()
    if (!snap) return
    setCanUndo(historyRef.current.length > 0)
    setCfg(mergeWidgetConfig(JSON.parse(snap)))
  }

  // E1: ⌘Z / Ctrl+Z.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      e.preventDefault()
      undoDraft()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function publish() {
    try {
      const res = await apiWrite<{ version: number }>('POST', `/admin/api/widget-config/${context}`, cfg)
      toast.success(`Опубликована v${res.version} — уже на сайте`)
      historyRef.current = []
      setCanUndo(false)
      try {
        window.localStorage.removeItem(`reviews-draft-${context}`)
      } catch {
        /* noop */
      }
      setBaseline(cfg)
      load(context)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Запрос не выполнен')
    }
  }

  function resetDraft() {
    setCfg(baseline)
    historyRef.current = []
    setCanUndo(false)
    try {
      window.localStorage.removeItem(`reviews-draft-${context}`)
    } catch {
      /* noop */
    }
    toast.info('Черновик возвращён к эфирной версии')
  }

  function patch(partial: Partial<WidgetConfig>) {
    setCfg((prev) => {
      pushHistory(prev)
      return { ...prev, ...partial }
    })
  }

  // E4: пресет = снапшот всего вида.
  function applyPreset(presetId: string) {
    const vars = PRESET_VARS[presetId]
    if (!vars) return
    setCfg((prev) => {
      pushHistory(prev)
      return mergeWidgetConfig({ ...prev, ...vars, appearance: { preset: vars.appearance?.preset ?? prev.appearance.preset } })
    })
    toast.success(`Пресет «${EDITOR_PRESETS.find((p) => p.id === presetId)?.name ?? presetId}» применён`)
  }

  const preview = useMemo(() => previewDocument(previewCfg, context), [previewCfg, context])
  const previewCfgRef = useRef(previewCfg)
  useEffect(() => {
    previewCfgRef.current = previewCfg
  }, [previewCfg])
  // E3(real): anchor селектор для прокси-превью; меняется из поля в hintstrip.
  const [previewAnchor, setPreviewAnchor] = useState('#reviews-widget')
  // Подсказка, если якоря нет на странице магазина (mount тогда не делаем —
  // как живой loader: «no anchor» = просто не рендерим).
  const [anchorMissing, setAnchorMissing] = useState(false)

  // Надёжный монтаж виджета в srcDoc-iframe: inline-скрипт в srcdoc не
  // исполняется (CSP/srcdoc-квирк Chromium), поэтому монтируем из родителя по onLoad.
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null)
  const mountPreviewWidget = useCallback(() => {
    const frame = previewFrameRef.current
    if (!frame) return
    try {
      const win: Window & { ReviewsWidget?: ReviewsWidgetApi } | null = frame.contentWindow
      const doc = frame.contentDocument
      if (!win || !doc || !win.ReviewsWidget) return
      const root = doc.getElementById('preview')
      if (root && win.ReviewsWidget.defaultConfig) {
        win.ReviewsWidget.mount(root, {
          reviews: win.ReviewsWidget.sampleReviews,
          productName: context === 'product' ? 'Платье миди «Аметист»' : '',
          context,
          config: previewCfgRef.current,
          submissionUrl: '/api/review-submissions',
          submissionConfig: { enabled: true, allowedTypes: ['image/jpeg', 'image/png', 'video/mp4'], privacyUrl: '' },
        })
      }
    } catch {
      /* iframe ещё грузится */
    }
  }, [context])
  // Монтаж после каждого обновления previewCfg (iframe пересоздаётся через srcDoc).
  useEffect(() => {
    const frame = previewFrameRef.current
    if (frame) mountPreviewWidget()
  }, [preview, mountPreviewWidget])

  // Триггер ремонта real-превью: previewCfg уже приходит с 200мс-дебаунсом
  // (см. выше), anchor/context/shopOrigin добавляют свои поводы.
  const [realPreviewTick, setRealPreviewTick] = useState(0)
  useEffect(() => {
    setRealPreviewTick((t) => t + 1)
  }, [previewCfg, previewSource, shopOrigin, previewAnchor, context])
  // Режим «Страница магазина»: same-origin iframe с /api/preview-page.
  // Сервер уже вырезал скрипты магазина и выложил window.ReviewsWidget
  // (+ REVIEWS_EMBED_CONFIG, инертный без loader); родитель монтирует виджет
  // сам, прокидывая сэмпл-отзывы и live-конфиг из рельсы. CSS текст тянем
  // один раз и кэшируем на модуль (widgetCssTextReady внизу файла).
  const realFrameRef = useRef<HTMLIFrameElement | null>(null)
  const realAnchorRef = useRef(previewAnchor)
  useEffect(() => {
    realAnchorRef.current = previewAnchor
  }, [previewAnchor])
  const mountRealPreview = useCallback(() => {
    if (previewSource !== 'real') return
    const frame = realFrameRef.current
    if (!frame) return
    void widgetCssTextReady.then(() => {
      try {
        const win = frame.contentWindow as (Window & {
          ReviewsWidget?: ReviewsWidgetApi & { mountShadow: (host: HTMLElement, options: Record<string, unknown>) => void }
        }) | null
        const doc = frame.contentDocument
        if (!win || !doc || !win.ReviewsWidget?.mountShadow) return
        const anchor = doc.querySelector(realAnchorRef.current)
        setAnchorMissing(!anchor)
        if (!anchor) return
        let host = anchor.querySelector<HTMLElement>('[data-reviews-preview-host]')
        // Один host на якорь: remount переиспользует его (mountShadow сам
        // чистит shadowRoot), иначе каждый тик добавлял бы новый div.
        if (!host) {
          host = doc.createElement('div')
          host.setAttribute('data-reviews-preview-host', '')
          anchor.appendChild(host)
        }
        win.ReviewsWidget.mountShadow(host, {
          styleText: widgetCssText,
          reviews: win.ReviewsWidget.sampleReviews,
          context,
          config: previewCfgRef.current,
          submissionUrl: '/api/review-submissions',
          submissionConfig: { enabled: true, allowedTypes: ['image/jpeg', 'image/png', 'video/mp4'], privacyUrl: '' },
        })
      } catch {
        /* iframe ещё грузится */
      }
    })
  }, [previewSource, context])
  useEffect(() => {
    mountRealPreview()
  }, [realPreviewTick, mountRealPreview])
  return (
    <>
      <div className="ed-tools">
        <span className="crumb">
          Виджет / <b>Конструктор</b>
        </span>
        <select value={context} onChange={(e) => setContext(e.target.value as WidgetContext)} aria-label="Контекст">
          <option value="product">Карточка товара</option>
          <option value="homepage">Главная страница</option>
        </select>
        {activeVersion !== null && <span className="live-badge">В эфире: v{activeVersion}</span>}
        {dirty && <span className="dirty-badge" title="«Сбросить» вернёт эфирную версию">Есть изменения</span>}
        <button className="quiet" onClick={undoDraft} disabled={!canUndo} title="Отменить последнее действие (⌘Z)">
          ↶ Отменить
        </button>
        {dirty && (
          <button className="quiet" onClick={resetDraft} title="Вернуть эфирную версию">
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
        <button onClick={publish} disabled={!dirty}>
          Опубликовать
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
              <button aria-pressed={previewSource === 'mock'} onClick={() => setPreviewSource('mock')}>
                Мок
              </button>
              <button
                aria-pressed={previewSource === 'real'}
                disabled={!shopOrigin}
                title={shopOrigin ? undefined : 'Укажите адрес магазина в Настройках'}
                onClick={() => setPreviewSource('real')}
              >
                Страница магазина
              </button>
            </div>
            {previewSource === 'real' && (
              <label className="k" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                Якорь
                <input
                  value={previewAnchor}
                  onChange={(e) => setPreviewAnchor(e.target.value)}
                  placeholder="#reviews-widget"
                  style={{ minWidth: 150 }}
                />
              </label>
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
                <span>shop-mila.ru/product/plate-42</span>
              </div>
            </div>
            {previewSource === 'real' && shopOrigin ? (
              <div className="realframe">
                <iframe
                  title="Предпросмотр на странице магазина"
                  ref={realFrameRef}
                  onLoad={mountRealPreview}
                  src={`/api/preview-page?url=${encodeURIComponent(shopOrigin)}&anchor=${encodeURIComponent(previewAnchor)}`}
                />
                {anchorMissing && (
                  <div className="realframe-hint" role="alert">
                    Якорь «{previewAnchor}» не найден на странице магазина — виджет не смонтирован.
                  </div>
                )}
              </div>
            ) : (
              <iframe
                title="Предпросмотр виджета"
                ref={previewFrameRef}
                srcDoc={preview}
                onLoad={mountPreviewWidget}
              />
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

          {tab === 'look' && <LookPanel cfg={cfg} patch={patch} />}
          {tab === 'select' && <SelectPanel cfg={cfg} patch={patch} />}
          {tab === 'form' && <FormPanel cfg={cfg} patch={patch} />}
          {tab === 'mp' && <MarketplacePanel cfg={cfg} patch={patch} />}
          {tab === 'showcase' && <ShowcasePanel />}
          {tab === 'embed' && <EmbedPanel />}
          {tab === 'versions' && <VersionsPanel versions={versions} context={context} contextVersions={contextVersions} onRollback={rollback} />}
        </aside>
      </div>
    </>
  )

  async function rollback(version: number) {
    try {
      await apiWrite('POST', `/admin/api/widget-config/${context}/rollback/${version}`)
      toast.success(`Активна версия ${version}`)
      load(context)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Запрос не выполнен')
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
        <label className="fld">
          <span>Схема</span>
          <div className="seg" role="group" aria-label="Схема шапки">
            {(['row', 'stack', 'center'] as const).map((l) => (
              <button key={l} aria-pressed={cfg.header.layout === l} onClick={() => patch({ header: { ...cfg.header, layout: l } })}>
                {l === 'row' ? 'Ряд' : l === 'stack' ? 'Стопка' : 'Центр'}
              </button>
            ))}
          </div>
        </label>
        <div className="fld">
          <span>Элементы шапки</span>
          <div className="attrflags" style={{ rowGap: 8 }}>
            {(
              [
                ['title', 'Заголовок'],
                ['rating', 'Оценка'],
                ['count', 'Счётчик'],
                ['recommend', 'Рекомендуют'],
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
          Схема меняет компоновку сводки; элементы включаются по одному — пустая шапка скрывается.
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
        <label className="fld">
          <span>Плотность</span>
          <div className="seg" role="group" aria-label="Плотность">
            <button aria-pressed={cfg.typography.density === 'compact'} onClick={() => patch({ typography: { ...cfg.typography, density: 'compact' } })}>
              Компактно
            </button>
            <button aria-pressed={cfg.typography.density === 'comfortable'} onClick={() => patch({ typography: { ...cfg.typography, density: 'comfortable' } })}>
              Свободно
            </button>
          </div>
        </label>
        <label className="fld">
          <span>Макет списка</span>
          <div className="seg" role="group" aria-label="Макет">
            {(['list', 'grid', 'carousel', 'video', 'wall'] as const).map((m) => (
              <button key={m} aria-pressed={cfg.layout.mode === m} onClick={() => patch({ layout: { ...cfg.layout, mode: m } })}>
                {modeLabel(m)}
              </button>
            ))}
          </div>
        </label>
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
      </Group>

      <SectionsGroup cfg={cfg} patch={patch} />

      <Group title="Медиа в отзыве" note="фото и видео в карточке" open>
        <label className="fld">
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
        </label>
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
      </Group>

      <Group title="Продвинутое" note="реже нужное">
        <label className="check">
          <input type="checkbox" checked={cfg.theme.dark} onChange={(e) => patch({ theme: { ...cfg.theme, dark: e.target.checked } })} />
          <span>
            <b>Тёмная тема</b>
            <span className="d">инвертирует подложки и текст</span>
          </span>
        </label>
        <div className="f2">
          <label className="fld">
            <span>Цвет текста</span>
            <input value={cfg.theme.text} onChange={(e) => patch({ theme: { ...cfg.theme, text: e.target.value } })} />
          </label>
          <label className="fld">
            <span>Приглушённый</span>
            <input value={cfg.theme.muted} onChange={(e) => patch({ theme: { ...cfg.theme, muted: e.target.value } })} />
          </label>
        </div>
        <label className="fld">
          <span>Цвет текста на акценте</span>
          <input value={cfg.theme.accentInk} onChange={(e) => patch({ theme: { ...cfg.theme, accentInk: e.target.value } })} />
        </label>
        <label className="fld">
          <span>Шрифт</span>
          <select
            value={cfg.typography.inheritSite ? 'inherit' : cfg.typography.fontFamily.includes('Manrope') ? 'manrope' : cfg.typography.fontFamily.includes('Onest') ? 'onest' : 'custom'}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'inherit') {
                patch({ typography: { ...cfg.typography, inheritSite: true } })
              } else if (v === 'onest') {
                patch({ typography: { ...cfg.typography, inheritSite: false, fontFamily: 'Onest, ui-sans-serif, system-ui, sans-serif' } })
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
              max={32}
              value={cfg.layout.wall.gap}
              onChange={(e) => patch({ layout: { ...cfg.layout, wall: { ...cfg.layout.wall, gap: Number(e.target.value) } } })}
            />
          </label>
        </div>
      </Group>
    </>
  )
}

// E4: применить пресет-снапшот (из LookPanel; функция на уровне модуля, т.к. applyPreset живёт в Editor).
function applyPresetFrom(presetId: string, cfg: WidgetConfig, patch: (p: Partial<WidgetConfig>) => void) {
  const vars = PRESET_VARS[presetId]
  if (!vars) return
  patch({ ...vars, appearance: { preset: vars.appearance?.preset ?? cfg.appearance.preset } })
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

function checkContrast(cfg: WidgetConfig): ContrastWarn {
  const panelEff = cfg.theme.dark ? '#1E1A26' : cfg.theme.panel
  const fg = (key: string) => {
    if (key === 'accink') return cfg.theme.accentInk
    if (cfg.theme.dark) return ({ star: '#C99A3F', text: '#F1EEF7', muted: '#A79FB5' } as Record<string, string>)[key] ?? cfg.theme[key as 'text']
    return cfg.theme[key as 'text' | 'muted' | 'star']
  }
  for (const p of CPAIRS) {
    const against = p.key === 'accink' ? cfg.theme.accent : panelEff
    const ratio = contrastRatio(fg(p.key), against)
    if (ratio < p.need) return { ...p, ratio }
  }
  return null
}

function fixContrast(key: string, cfg: WidgetConfig, patch: (p: Partial<WidgetConfig>) => void) {
  const p = CPAIRS.find((x) => x.key === key)
  if (!p) return
  const target = key === 'accink' ? cfg.theme.accent : cfg.theme.dark ? '#1E1A26' : cfg.theme.panel
  const goal = hexLum(target) > 0.4 ? '#000000' : '#ffffff'
  const from = key === 'accink' ? cfg.theme.accentInk : cfg.theme[key as 'text' | 'muted' | 'star']
  let cur = from
  for (let i = 1; i <= 16; i++) {
    cur = mixHex(from, goal, i * 0.08)
    if (contrastRatio(cur, target) >= p.need) break
  }
  if (key === 'accink') patch({ theme: { ...cfg.theme, accentInk: cur } })
  else if (key === 'star') patch({ theme: { ...cfg.theme, star: cur } })
  else if (key === 'muted') patch({ theme: { ...cfg.theme, muted: cur } })
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
    if (to < 0 || to >= cfg.layout.sections.length || from === to) return
    const next = [...cfg.layout.sections]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    patch({ layout: { ...cfg.layout, sections: next } })
  }

  function toggleSection(id: WidgetSectionId, enable: boolean) {
    const next = enable
      ? [...cfg.layout.sections, id]
      : cfg.layout.sections.filter((s) => s !== id)
    patch({ layout: { ...cfg.layout, sections: next } })
  }

  return (
    <Group title="Секции" note="тяните, чтобы менять порядок" open>
      <div className="seclist">
        {(Object.keys(widgetSectionLabels) as WidgetSectionId[]).map((id) => {
          const index = cfg.layout.sections.indexOf(id)
          const enabled = index !== -1
          return (
            <div
              key={id}
              className="secrow"
              draggable
              onDragStart={(e) => {
                dragIndex.current = index === -1 ? 9999 : index
                e.currentTarget.classList.add('dragging')
              }}
              onDragEnd={(e) => e.currentTarget.classList.remove('dragging')}
              onDragOver={(e) => {
                e.preventDefault()
                const from = dragIndex.current
                if (from === null || from === 9999) return
                const rows = Array.from(e.currentTarget.parentElement!.children) as HTMLElement[]
                const to = rows.indexOf(e.currentTarget)
                move(from, to)
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
              {id === 'list' ? (
                <>
                  <input type="checkbox" checked disabled />
                  <b>{widgetSectionLabels[id]}</b>
                  <span className="tag">всегда</span>
                </>
              ) : (
                <>
                  <input type="checkbox" checked={enabled} onChange={(e) => toggleSection(id, e.target.checked)} />
                  <b className={enabled ? '' : 'off'}>{widgetSectionLabels[id]}</b>
                </>
              )}
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
        <label className="fld">
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
        </label>
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
              onDragEnd={(e) => e.currentTarget.classList.remove('dragging')}
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
              <span className="tag">{rule.direction === 'desc' ? 'выше' : 'ниже'}</span>
            </div>
          ))}
        </div>
        <span className="hint">Ранжирование работает внутри отфильтрованной выдачи.</span>
      </Group>

      <Group title="Форма публичных фильтров" note="как выглядят кастомные фильтры" open>
        <label className="fld">
          <span>Раскладка</span>
          <div className="seg" role="group" aria-label="Раскладка фильтров">
            {(['rows', 'dropdowns', 'chips'] as const).map((l) => (
              <button key={l} aria-pressed={cfg.filters.layout === l} onClick={() => patch({ filters: { ...cfg.filters, layout: l } })}>
                {l === 'rows' ? 'Ряды' : l === 'dropdowns' ? 'Дропдауны' : 'Чипы'}
              </button>
            ))}
          </div>
        </label>
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
        <span className="hint">
          Значения берутся из настраиваемых полей с включённым «Публичный фильтр» — вкладка «Форма».
        </span>
      </Group>
    </>
  )
}

/* ============ ФОРМА ============ */

function FormPanel({ cfg, patch }: { cfg: WidgetConfig; patch: (p: Partial<WidgetConfig>) => void }) {
  const labels = cfg.labels ?? { writeReview: '', readMore: '' }
  const formEnabled = cfg.layout.sections.includes('form')
  const fieldCount =
    2 + (labels.writeReview ? 0 : 0) + cfg.customFields.length + (cfg.typography.inheritSite ? 0 : 0)

  return (
    <>
      <Group title="Форма отзыва" note={`${fieldCount + 3} полей`} open>
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
        <label className="fld">
          <span>Режим открытия</span>
          <div className="seg" role="group" aria-label="Режим формы">
            <button aria-pressed={cfg.form.mode === 'button'} onClick={() => patch({ form: { ...cfg.form, mode: 'button' } })}>
              По кнопке
            </button>
            <button aria-pressed={cfg.form.mode === 'inline'} onClick={() => patch({ form: { ...cfg.form, mode: 'inline' } })}>
              Развёрнутая
            </button>
          </div>
        </label>
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
              <input
                type="checkbox"
                checked={cfg.form.fields.email}
                onChange={(e) => patch({ form: { ...cfg.form, fields: { ...cfg.form.fields, email: e.target.checked } } })}
              />
              <b>Email</b>
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
          Оценка и текст — обязательные поля. Режим «По кнопке»: секция превращается в CTA-полосу, форма открывается поп-апом.
        </span>
      </Group>

      <Group title="Подсветка в отзыве" note="кастомные теги" open>
        <label className="fld">
          <span>Стиль подсветки</span>
          <div className="seg" role="group" aria-label="Стиль подсветки">
            <button aria-pressed={cfg.customTags.display === 'chips'} onClick={() => patch({ customTags: { ...cfg.customTags, display: 'chips' } })}>
              Чипы
            </button>
            <button aria-pressed={cfg.customTags.display === 'string'} onClick={() => patch({ customTags: { ...cfg.customTags, display: 'string' } })}>
              Строка
            </button>
          </div>
        </label>
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
        <div className="attrcard" key={index}>
          <div className="ahead">
            <input
              className="lbl"
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
            <select className="sel" value={field.type} onChange={(e) => update(index, { type: e.target.value as CustomFieldDef['type'] })}>
              <option value="chips">Чипы</option>
              <option value="select">Список</option>
              <option value="text">Текст</option>
            </select>
          </div>
          {field.type !== 'text' && (
            <input
              value={field.options.join(', ')}
              placeholder="Варианты через запятую: 152, 158, 164"
              onChange={(e) => update(index, { options: e.target.value.split(',').map((o) => o.trim()) })}
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
      <button type="button" className="ghead" onClick={() => setIsOpen(!isOpen)}>
        <b>{title}</b>
        {note && <span className="n">{note}</span>}
        <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div className="gbody">{children}</div>
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="fld">
      <span>{label}</span>
      <div className="color-field">
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </label>
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


// CSS виджета как текст для mountShadow в real-превью: один fetch на модуль.
let widgetCssText = ''
const widgetCssTextReady = fetch('/reviews-widget.css')
  .then((r) => (r.ok ? r.text() : ''))
  .then((text) => {
    widgetCssText = text
    return text
  })
  .catch(() => '')

function previewDocument(config: WidgetConfig, context: WidgetContext) {
  const configJson = JSON.stringify(config).replace(/</g, '\\u003c')
  const contextJson = JSON.stringify(context)
  const productName = context === 'product' ? 'Платье миди «Аметист»' : ''
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="reviews-widget.css">
  <style>
    *{box-sizing:border-box}
    body{margin:0;background:#FCFBF9;font-family:Manrope,system-ui,sans-serif;color:#17191D}
    .shop-top{display:flex;align-items:center;gap:20px;padding:14px 26px;border-bottom:1px solid #E3E3DF}
    .shop-logo{font-weight:800;letter-spacing:.12em;font-size:15px}
    .shop-nav{display:flex;gap:16px;font-size:12.5px;color:#5D6167;font-weight:600}
    .shop-cart{margin-left:auto;width:32px;height:32px;border-radius:50%;background:#EFEFEC;display:grid;place-items:center;color:#5D6167;font-size:14px}
    .shop-crumbs{padding:12px 26px 0;font-size:11.5px;color:#9AA1AA;font-weight:600}
    .phero{display:grid;grid-template-columns:300px minmax(0,1fr);gap:24px;padding:16px 26px 24px;border-bottom:1px solid #E3E3DF}
    .phero .img{aspect-ratio:1;border-radius:12px;background:linear-gradient(140deg,#E8DFE9,#D9C9DC 60%,#C9B4CE);position:relative}
    .phero .img::after{content:"";position:absolute;inset:auto 14% 0;height:58%;border-radius:12px 12px 0 0;background:rgba(255,255,255,.28)}
    .phero h2{font-size:20px;font-weight:800;margin:0}
    .phero .rate{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#5D6167;margin-top:6px}
    .phero .rate .st{color:#C99A3F;font-size:12px;letter-spacing:1px}
    .phero .price{font-size:22px;font-weight:800;margin-top:10px}
    .phero .desc{font-size:12.5px;color:#5D6167;margin-top:8px;max-width:420px}
    .phero .buy{margin-top:14px;display:inline-flex;align-items:center;min-height:40px;padding:0 22px;border-radius:999px;background:#17191D;color:#fff;font-size:13.5px;font-weight:700}
    @media (max-width:520px){.phero{grid-template-columns:1fr}.shop-nav{display:none}.phero .img{max-width:220px}}
  </style>
</head>
<body>
  <div class="shop-top">
    <span class="shop-logo">MILA</span>
    <nav class="shop-nav"><span>Новинки</span><span>Платья</span><span>Кардиганы</span><span>Акции</span></nav>
    <span class="shop-cart">🛍</span>
  </div>
  <div class="shop-crumbs">Главная / Платья / Платье миди «Аметист»</div>
  <div class="phero">
    <div class="img"></div>
    <div>
      <h2>Платье миди «Аметист»</h2>
      <div class="rate"><span class="st">★★★★★</span><span>4,7 · <b style="color:#0E7A6E">312 отзывов</b></span></div>
      <div class="price">4 590 ₽</div>
      <p class="desc">Платье из вискозы с подкладкой. Свободный крой, длина миди, рукав 3/4.</p>
      <button class="buy">Добавить в корзину</button>
    </div>
  </div>
  <div id="preview" class="reviews-widget reviews-widget-root"></div>
  <script src="reviews-widget.js"></script>
  <script>
    ReviewsWidget.mount(document.getElementById('preview'), {
      reviews: ReviewsWidget.sampleReviews,
      productName: ${JSON.stringify(productName)},
      context: ${contextJson},
      config: ${configJson},
      submissionUrl: '/api/review-submissions',
      submissionConfig: { enabled: true, allowedTypes: ["image/jpeg", "image/png", "video/mp4"], privacyUrl: "" }
    });
</body>
</html>`
}
