import { useEffect, useMemo, useRef, useState } from 'react'
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

export default function Editor() {
  const [context, setContext] = useState<WidgetContext>('product')
  const [cfg, setCfg] = useState<WidgetConfig>(defaultWidgetConfig)
  const [baseline, setBaseline] = useState<WidgetConfig>(defaultWidgetConfig)
  const [versions, setVersions] = useState<VersionItem[]>([])
  const [tab, setTab] = useState<RailTab>('look')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [railOff, setRailOff] = useState(false)
  const [previewCfg, setPreviewCfg] = useState<WidgetConfig>(defaultWidgetConfig)

  function load(nextContext = context) {
    Promise.all([
      apiGet<Partial<WidgetConfig>>(`/admin/api/widget-config/${nextContext}`),
      apiGet<{ versions: VersionItem[] }>(`/admin/api/widget-config/${nextContext}/versions`),
    ])
      .then(([config, versionData]) => {
        const merged = mergeWidgetConfig(config)
        setCfg(merged)
        setBaseline(merged)
        setPreviewCfg(merged)
        setVersions(versionData.versions)
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Запрос не выполнен'))
  }

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

  async function publish() {
    try {
      const res = await apiWrite<{ version: number }>('POST', `/admin/api/widget-config/${context}`, cfg)
      toast.success(`Опубликована v${res.version} — уже на сайте`)
      setBaseline(cfg)
      load(context)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Запрос не выполнен')
    }
  }

  function resetDraft() {
    setCfg(baseline)
    toast.info('Черновик возвращён к эфирной версии')
  }

  function patch(partial: Partial<WidgetConfig>) {
    setCfg((prev) => ({ ...prev, ...partial }))
  }

  const preview = useMemo(() => previewDocument(previewCfg, context), [previewCfg, context])

  return (
    <>
      <div className="ed-tools">
        <select value={context} onChange={(e) => setContext(e.target.value as WidgetContext)} aria-label="Контекст">
          <option value="product">Карточка товара</option>
          <option value="homepage">Главная страница</option>
        </select>
        {activeVersion !== null && <span className="live-badge">В эфире: v{activeVersion}</span>}
        {dirty && <span className="dirty-badge" title="«Сбросить» вернёт эфирную версию">Есть изменения</span>}
        {dirty && (
          <button className="quiet" onClick={resetDraft} title="Вернуть эфирную версию">
            Сбросить
          </button>
        )}
        <span className="spacer" />
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
            <span className="k">Мок-страница магазина</span>
            <span>
              Превью показывает виджет в контексте карточки товара. Изменения в панели применяются сразу;
              публикация — отдельным действием.
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
            <iframe title="Предпросмотр виджета" srcDoc={preview} />
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
          {tab === 'versions' && <VersionsPanel versions={versions} context={context} onRollback={rollback} />}
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
  return (
    <>
      <Group title="Пресеты вида" note={`${widgetPresets.length}`}>
        <div className="preset-grid">
          {widgetPresets.map((p) => (
            <button
              key={p.id}
              className="preset"
              aria-pressed={cfg.appearance.preset === p.id}
              onClick={() => patch({ appearance: { preset: p.id } })}
            >
              <span className="thumb" style={{ color: p.color }}>
                <span className="b1" />
                <span className="b2" />
                {p.tiles ? (
                  <span className="tiles">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                ) : (
                  <span className="tile" />
                )}
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
        <label className="check">
          <input
            type="checkbox"
            checked={cfg.visibility.ratingDistribution}
            onChange={(e) => patch({ visibility: { ...cfg.visibility, ratingDistribution: e.target.checked } })}
          />
          <span>
            <b>Распределение оценок</b>
            <span className="d">полосы 5★…1★ рядом со сводкой</span>
          </span>
        </label>
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
            <input type="number" min={1} max={4} value={cfg.layout.columns} onChange={(e) => patch({ layout: { ...cfg.layout, columns: Number(e.target.value) } })} />
          </label>
          <label className="fld">
            <span>Порция</span>
            <input type="number" min={1} max={24} value={cfg.layout.pageSize} onChange={(e) => patch({ layout: { ...cfg.layout, pageSize: Number(e.target.value) } })} />
          </label>
        </div>
      </Group>

      <SectionsGroup cfg={cfg} patch={patch} />

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
            value={cfg.typography.inheritSite ? 'inherit' : 'site'}
            onChange={(e) => patch({ typography: { ...cfg.typography, inheritSite: e.target.value === 'inherit' } })}
          >
            <option value="site">Onest (встроенный)</option>
            <option value="inherit">Наследовать сайт</option>
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
            <span className="d">WB/Ozon/ЯМ на карточке</span>
          </span>
        </label>

        <div className="fld" style={{ border: 0, paddingTop: 0 }}>
          <span>Ответ продавца</span>
          <div className="seg" role="group" aria-label="Стиль ответа">
            {(['card', 'plain', 'bubble', 'accent'] as const).map((s) => (
              <button key={s} aria-pressed={cfg.answers.style === s} onClick={() => patch({ answers: { ...cfg.answers, style: s } })}>
                {s === 'card' ? 'Карточка' : s === 'plain' ? 'Тонкая' : s === 'bubble' ? 'Пузырь' : 'Акцент'}
              </button>
            ))}
          </div>
        </div>
        <ColorField label="Цвет ответа" value={cfg.answers.color} onChange={(value) => patch({ answers: { ...cfg.answers, color: value } })} />
        <label className="check">
          <input type="checkbox" checked={cfg.answers.showTitle} onChange={(e) => patch({ answers: { ...cfg.answers, showTitle: e.target.checked } })} />
          <span>
            <b>Заголовок ответа</b>
            <span className="d">«Ответ продавца» над текстом</span>
          </span>
        </label>
        <label className="fld">
          <span>Свой заголовок (необязательно)</span>
          <input
            value={cfg.answers.title}
            placeholder="Ответ продавца"
            onChange={(e) => patch({ answers: { ...cfg.answers, title: e.target.value } })}
          />
        </label>

        <div className="fld">
          <span>Плеер · оформление</span>
          <div className="seg" role="group" aria-label="Хром плеера">
            <button aria-pressed={cfg.viewer.chrome === 'full'} onClick={() => patch({ viewer: { ...cfg.viewer, chrome: 'full' } })}>
              Полный
            </button>
            <button aria-pressed={cfg.viewer.chrome === 'min'} onClick={() => patch({ viewer: { ...cfg.viewer, chrome: 'min' } })}>
              Минималистичный
            </button>
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={cfg.viewer.showOriginal} onChange={(e) => patch({ viewer: { ...cfg.viewer, showOriginal: e.target.checked } })} />
          <span>
            <b>«Открыть оригинал»</b>
            <span className="d">ссылка на отзыв на площадке</span>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={cfg.viewer.showCounter} onChange={(e) => patch({ viewer: { ...cfg.viewer, showCounter: e.target.checked } })} />
          <span>
            <b>Счётчик медиа</b>
          </span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={cfg.layout.video.autoplayInViewer}
            onChange={(e) => patch({ layout: { ...cfg.layout, video: { ...cfg.layout.video, autoplayInViewer: e.target.checked } } })}
          />
          <span>
            <b>Автопроигрывание в плеере</b>
            <span className="d">без звука</span>
          </span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={cfg.layout.video.productPanel}
            onChange={(e) => patch({ layout: { ...cfg.layout, video: { ...cfg.layout.video, productPanel: e.target.checked } } })}
          />
          <span>
            <b>Панель товара в плеере</b>
            <span className="d">фото и цена рядом с медиа</span>
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

  return (
    <>
      <Group title="Форма отзыва" note={formEnabled ? 'включена' : 'выключена'} open>
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
          Оценка и текст — обязательные поля. Согласие и правила публикации настраиваются на странице «Настройки».
        </span>
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
    onChange([...fields, { id: '', label: '', type: 'select', options: ['', ''], required: false, filterable: false, showInReview: true, showInSummary: false }])
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
            <input
              value={field.id}
              placeholder="id: height"
              onChange={(e) => update(index, { id: e.target.value })}
            />
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
            <label className="check">
              <input type="checkbox" checked={!policy.hidden} onChange={(e) => setPolicy(mp, 'hidden', !e.target.checked)} />
              <span>
                <b>Показывать отзывы {marketplaceLabels[mp]}</b>
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

/* ============ ВЕРСИИ ============ */

function VersionsPanel({
  versions,
  context,
  onRollback,
}: {
  versions: VersionItem[]
  context: WidgetContext
  onRollback: (version: number) => void
}) {
  const contextLabel = context === 'product' ? 'Карточка товара' : 'Главная страница'
  return (
    <>
      <Group title="Версии конфига" note={contextLabel} open>
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
            <span className="d">configContext: product</span>
          </div>
          <div className="rowl">
            <b>Главная страница</b>
            <span className="d">configContext: homepage</span>
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
      config: ${configJson}
    });
  </script>
</body>
</html>`
}
