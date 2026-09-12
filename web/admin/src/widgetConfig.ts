export type WidgetContext = 'product' | 'homepage'

export type MarketplacePolicy = {
  hidden: boolean
  label: string
  showSourceLinks: boolean
}

export type WidgetSectionId = 'summary' | 'media' | 'filters' | 'list' | 'form'

export const widgetSectionLabels: Record<WidgetSectionId, string> = {
  summary: 'Сводка (оценка и распределение)',
  media: 'Лента фото и видео',
  filters: 'Панель фильтров',
  list: 'Список отзывов',
  form: 'Форма отзыва',
}

export type WidgetAppearancePreset = 'default' | 'native-kit' | 'minimal' | 'ugc-editorial' | 'ugc-community' | 'bazaar'

export type WidgetPresetInfo = {
  id: WidgetAppearancePreset
  name: string
  hint: string
  color: string
  tiles: boolean
}

// Catalog for the editor preset gallery: every id is a real rw-preset-* class
// in reviews-widget.css — the widget renders these without extra work.
export const widgetPresets: WidgetPresetInfo[] = [
  { id: 'default', name: 'Классика', hint: 'список · фиолетовый акцент', color: '#68478D', tiles: false },
  { id: 'native-kit', name: 'Нативный', hint: 'бесцветный · подхватывает сайт', color: '#17191D', tiles: false },
  { id: 'minimal', name: 'Минимал', hint: 'ч/б · тонкие линии', color: '#17191D', tiles: true },
  { id: 'ugc-editorial', name: 'UGC Редакция', hint: 'фото вперёд · терракота', color: '#B4532A', tiles: true },
  { id: 'ugc-community', name: 'UGC Комьюнити', hint: 'стена фото · тёплый', color: '#0E7A6E', tiles: true },
  { id: 'bazaar', name: 'Базар', hint: 'плотная стена · компактно', color: '#C2410C', tiles: true },
]

export type CustomFieldDef = {
  id: string
  label: string
  type: 'select' | 'chips' | 'text'
  options: string[]
  required: boolean
  filterable: boolean
  showInReview: boolean
  showInSummary: boolean
}

export type WidgetConfig = {
  appearance: {
    preset: WidgetAppearancePreset
  }
  theme: {
    accent: string
    accentInk: string
    text: string
    muted: string
    panel: string
    border: string
    star: string
    dark: boolean
  }
  typography: {
    fontFamily: string
    inheritSite: boolean
    scale: number
    radius: number
    density: 'comfortable' | 'compact'
  }
  header: {
    title: string
    layout: 'row' | 'stack' | 'center'
  }
  answers: {
    style: 'card' | 'plain' | 'bubble' | 'accent'
    color: string
    title: string
    showTitle: boolean
  }
  viewer: {
    chrome: 'full' | 'min'
    showOriginal: boolean
    showCounter: boolean
  }
  filters: {
    layout: 'rows' | 'dropdowns' | 'chips'
    collapsible: boolean
    multiSelect: boolean
    labelMode: 'all' | 'plain'
  }
  labels: {
    writeReview: string
    readMore: string
  }
  layout: {
    mode: 'list' | 'grid' | 'carousel' | 'video' | 'wall'
    columns: number
    pageSize: number
    pagination: 'more' | 'pages'
    sections: WidgetSectionId[]
    video: {
      aspect: '3:4' | '9:16' | '1:1'
      tileWidth: number
      showSourceBadge: boolean
      showAuthor: boolean
      autoplayInViewer: boolean
      productPanel: boolean
    }
    wall: {
      minTileWidth: number
      gap: number
      maxTiles: number
    }
  }
  visibility: {
    photos: boolean
    sellerAnswers: boolean
    prosCons: boolean
    marketplaceBadges: boolean
    ratingDistribution: boolean
    videoRail: boolean
    filters: boolean
    questions: boolean
  }
  defaults: {
    minRating: number
    requireText: boolean
    requirePhoto: boolean
    marketplace: 'all' | 'wb' | 'ozon' | 'ym'
    initialSort: 'relevance' | 'newest' | 'highest' | 'lowest' | 'media'
    textFirst: boolean
    photoFirst: boolean
    onlyWithAnswer: boolean
  }
  ranking: {
    field: 'pinned' | 'hasPhoto' | 'hasText' | 'rating' | 'createdAt'
    direction: 'asc' | 'desc'
  }[]
  customFields: CustomFieldDef[]
  marketplacePolicy: Record<'wb' | 'ym' | 'ozon', MarketplacePolicy>
}

export const defaultWidgetConfig: WidgetConfig = {
  appearance: {
    preset: 'default',
  },
  theme: {
    accent: '#68478D',
    accentInk: '#ffffff',
    text: '#2A2630',
    muted: '#6E6877',
    panel: '#ffffff',
    border: '#E7DFD7',
    star: '#C99A3F',
    dark: false,
  },
  typography: {
    fontFamily: 'Onest, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    inheritSite: false,
    scale: 1,
    radius: 16,
    density: 'comfortable',
  },
  layout: {
    mode: 'list',
    columns: 2,
    pageSize: 3,
    sections: ['summary', 'media', 'filters', 'list', 'form'],
    pagination: 'more',
    video: {
      aspect: '9:16',
      tileWidth: 260,
      showSourceBadge: true,
      showAuthor: true,
      autoplayInViewer: true,
      productPanel: true,
    },
    wall: {
      minTileWidth: 200,
      gap: 12,
      maxTiles: 24,
    },
  },
  header: {
    title: 'Отзывы покупателей',
    layout: 'row',
  },
  answers: {
    style: 'card',
    color: '#4E7C59',
    title: '',
    showTitle: true,
  },
  viewer: {
    chrome: 'full',
    showOriginal: true,
    showCounter: true,
  },
  filters: {
    layout: 'rows',
    collapsible: false,
    multiSelect: false,
    labelMode: 'all',
  },
  labels: {
    writeReview: '',
    readMore: '',
  },
  visibility: {
    photos: true,
    sellerAnswers: true,
    prosCons: true,
    marketplaceBadges: true,
    ratingDistribution: true,
    videoRail: true,
    filters: true,
    questions: true,
  },
  defaults: {
    minRating: 4,
    requireText: true,
    requirePhoto: false,
    marketplace: 'all',
    initialSort: 'relevance',
    textFirst: true,
    photoFirst: true,
    onlyWithAnswer: false,
  },
  ranking: [
    { field: 'pinned', direction: 'desc' },
    { field: 'hasPhoto', direction: 'desc' },
    { field: 'hasText', direction: 'desc' },
    { field: 'rating', direction: 'desc' },
    { field: 'createdAt', direction: 'desc' },
  ],
  marketplacePolicy: {
    wb: { hidden: false, label: '', showSourceLinks: true },
    ym: { hidden: false, label: '', showSourceLinks: true },
    ozon: { hidden: false, label: '', showSourceLinks: true },
  },
  customFields: [],
}

export function normalizeCustomFields(raw: unknown): CustomFieldDef[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: CustomFieldDef[] = []
  for (const item of raw.slice(0, 6)) {
    const field = (item ?? {}) as Partial<CustomFieldDef>
    const id = String(field.id || '').trim()
    const label = String(field.label || '').trim()
    const type = field.type === 'select' || field.type === 'chips' || field.type === 'text' ? field.type : ''
    if (!id || !label || !type || seen.has(id)) continue
    seen.add(id)
    const options = (Array.isArray(field.options) ? field.options : [])
      .map((option) => String(option || '').trim())
      .filter(Boolean)
      .slice(0, 12)
    if (type !== 'text' && options.length < 2) continue
    out.push({
      id,
      label,
      type,
      options,
      required: field.required === true,
      filterable: field.filterable === true,
      showInReview: field.showInReview !== false,
      showInSummary: field.showInSummary === true,
    })
  }
  return out
}

export function mergeWidgetConfig(value: Partial<WidgetConfig>): WidgetConfig {
  return {
    appearance: { ...defaultWidgetConfig.appearance, ...(value.appearance ?? {}) },
    theme: { ...defaultWidgetConfig.theme, ...(value.theme ?? {}) },
    typography: { ...defaultWidgetConfig.typography, ...(value.typography ?? {}) },
    header: { ...defaultWidgetConfig.header, ...(value.header ?? {}) },
    answers: { ...defaultWidgetConfig.answers, ...(value.answers ?? {}) },
    viewer: { ...defaultWidgetConfig.viewer, ...(value.viewer ?? {}) },
    filters: { ...defaultWidgetConfig.filters, ...(value.filters ?? {}) },
    labels: { ...defaultWidgetConfig.labels, ...(value.labels ?? {}) },
    layout: {
      ...defaultWidgetConfig.layout,
      ...(value.layout ?? {}),
      sections: normalizeSections(value.layout?.sections, value.visibility),
      video: { ...defaultWidgetConfig.layout.video, ...(value.layout?.video ?? {}) },
      wall: { ...defaultWidgetConfig.layout.wall, ...(value.layout?.wall ?? {}) },
    },
    visibility: { ...defaultWidgetConfig.visibility, ...(value.visibility ?? {}) },
    defaults: { ...defaultWidgetConfig.defaults, ...(value.defaults ?? {}) },
    customFields: normalizeCustomFields(value.customFields),
    marketplacePolicy: mergeMarketplacePolicy(value.marketplacePolicy),
    ranking: value.ranking?.length ? value.ranking : defaultWidgetConfig.ranking,
  }
}

function normalizeSections(
  raw: WidgetSectionId[] | undefined,
  legacyVisibility: Partial<WidgetConfig['visibility']> | undefined,
): WidgetSectionId[] {
  // Migration: configs published before `sections` existed gate blocks through
  // the flat visibility flags. Map them onto the section order.
  const legacy: Partial<Record<WidgetSectionId, true>> = {}
  if (legacyVisibility) {
    if (legacyVisibility.ratingDistribution === false) legacy.summary = true
    if (legacyVisibility.photos === false) legacy.media = true
    if (legacyVisibility.filters === false) legacy.filters = true
  }
  const out: WidgetSectionId[] = []
  const seen: Partial<Record<WidgetSectionId, true>> = {}
  for (const id of raw ?? defaultWidgetConfig.layout.sections) {
    if (!widgetSectionLabels[id] || seen[id]) continue
    if (legacy[id]) continue
    seen[id] = true
    out.push(id)
  }
  // The list is the point of the widget — always render it.
  if (!seen.list) out.push('list')
  return out
}

function mergeMarketplacePolicy(value: Partial<WidgetConfig['marketplacePolicy']> | undefined): WidgetConfig['marketplacePolicy'] {
  return {
    wb: { ...defaultWidgetConfig.marketplacePolicy.wb, ...(value?.wb ?? {}) },
    ym: { ...defaultWidgetConfig.marketplacePolicy.ym, ...(value?.ym ?? {}) },
    ozon: { ...defaultWidgetConfig.marketplacePolicy.ozon, ...(value?.ozon ?? {}) },
  }
}
