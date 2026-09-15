export type WidgetContext = 'product' | 'homepage'

export type MarketplacePolicy = {
  hidden: boolean
  label: string
  showSourceLinks: boolean
}

export type WidgetSectionId = 'summary' | 'player' | 'media' | 'filters' | 'list' | 'form'

export const widgetSectionLabels: Record<WidgetSectionId, string> = {
  summary: 'Сводка и распределение',
  player: 'Плеер-лента',
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
    viewAllHref: string
    marketplaceDisplay: 'text' | 'icons'
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
  header: {
    title: string
    layout: 'row' | 'stack' | 'center'
    elements: {
      title: boolean
      rating: boolean
      count: boolean
      recommend: boolean
      distribution: boolean
    }
    distribution: {
      position: 'auto' | 'beside' | 'below'
      width: 'compact' | 'full'
      density: 'compact' | 'normal'
    }
  }
  filters: {
    layout: 'rows' | 'dropdowns' | 'chips'
    collapsible: boolean
    multiSelect: boolean
    labelMode: 'all' | 'plain'
    hideRare: boolean
  }
  labels: {
    writeReview: string
    readMore: string
    search: string
    viewAll: string
    recentlyAdded: string
  }
  layout: {
    mode: 'list' | 'grid' | 'carousel' | 'video' | 'wall'
    columns: number
    pageSize: number
    pagination: 'more' | 'pages'
    loadMoreAction: 'inline' | 'dialog'
    mediacard: {
      layout: 'row' | 'grid' | 'collage' | 'one'
      aspect: '16:10' | '1:1' | '4:5'
      maxTiles: 3 | 4 | 6
      plusMore: boolean
      videoBadge: boolean
    }
    player: {
      enabled: boolean
      title: string
      tile: {
        aspect: '9:16' | '3:4' | '1:1'
        width: number
      }
      showAuthor: boolean
      showLikes: boolean
      showSourceBadge: boolean
      autoAdvance: {
        enabled: boolean
        intervalSec: number
        pauseOnHover: boolean
      }
    }
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
    tileHover: boolean
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
  form: {
    mode: 'inline' | 'button'
    ctaMode: 'section' | 'header' | 'both'
    title: string
    submitLabel: string
    fields: { title: boolean; email: boolean; media: boolean; prosCons: boolean }
    maxMedia: 1 | 3 | 6
    mediaHint: string
    cta: {
      text: string
      hint: string
    }
  }
  customTags: {
    display: 'chips' | 'string'
    chipLabel: boolean
  }
  customFields: CustomFieldDef[]
  ranking: {
    field: 'pinned' | 'hasPhoto' | 'hasText' | 'rating' | 'createdAt'
    direction: 'asc' | 'desc'
  }[]
  marketplacePolicy: Record<'wb' | 'ym' | 'ozon', MarketplacePolicy>
}

export const defaultWidgetConfig: WidgetConfig = {
  appearance: {
    preset: 'default',
    viewAllHref: '',
    marketplaceDisplay: 'text',
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
    fontFamily: '',
    inheritSite: false,
    scale: 1,
    radius: 16,
    density: 'comfortable',
  },
  layout: {
    mode: 'list',
    columns: 2,
    pageSize: 3,
    sections: ['summary', 'player', 'media', 'filters', 'list', 'form'],
    pagination: 'more',
    loadMoreAction: 'inline',
    mediacard: {
      layout: 'row',
      aspect: '16:10',
      maxTiles: 4,
      plusMore: true,
      videoBadge: true,
    },
    player: {
      enabled: true,
      title: 'Видео покупателей',
      tile: { aspect: '9:16', width: 156 },
      showAuthor: true,
      showLikes: true,
      showSourceBadge: true,
      autoAdvance: { enabled: true, intervalSec: 5, pauseOnHover: true },
    },
    video: {
      aspect: '9:16',
      tileWidth: 156,
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
    tileHover: true,
  },
  header: {
    title: 'Отзывы покупателей',
    layout: 'row',
    elements: { title: true, rating: true, count: true, recommend: true, distribution: true },
    distribution: { position: 'auto', width: 'compact', density: 'compact' },
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
    hideRare: false,
  },
  labels: {
    writeReview: 'Написать отзыв',
    readMore: 'Читать полностью',
    search: 'Поиск по отзывам',
    viewAll: 'Смотреть все',
    recentlyAdded: 'Недавно',
  },
  form: {
    mode: 'inline',
    ctaMode: 'section',
    title: 'Оставить отзыв',
    submitLabel: 'Отправить отзыв',
    fields: { title: true, email: true, media: true, prosCons: true },
    maxMedia: 3,
    mediaHint: 'Фото до 8 МБ · видео до 50 МБ',
    cta: { text: 'Оставить отзыв', hint: 'Помогите другим покупателям — оценка, текст, фото или видео' },
  },
  customTags: {
    display: 'chips',
    chipLabel: true,
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
    header: {
      ...defaultWidgetConfig.header,
      ...(value.header ?? {}),
      elements: {
        ...defaultWidgetConfig.header.elements,
        distribution: value.visibility?.ratingDistribution !== false,
        ...(value.header?.elements ?? {}),
      },
      distribution: {
        position: value.header?.distribution?.position === 'beside' || value.header?.distribution?.position === 'below' ? value.header.distribution.position : 'auto',
        width: value.header?.distribution?.width === 'full' ? 'full' : 'compact',
        density: value.header?.distribution?.density === 'normal' ? 'normal' : 'compact',
      },
    },
    answers: { ...defaultWidgetConfig.answers, ...(value.answers ?? {}) },
    viewer: { ...defaultWidgetConfig.viewer, ...(value.viewer ?? {}) },
    filters: { ...defaultWidgetConfig.filters, ...(value.filters ?? {}) },
    visibility: { ...defaultWidgetConfig.visibility, ...(value.visibility ?? {}) },
    defaults: { ...defaultWidgetConfig.defaults, ...(value.defaults ?? {}) },
    labels: { ...defaultWidgetConfig.labels, ...(value.labels ?? {}) },
    layout: {
      ...defaultWidgetConfig.layout,
      ...(value.layout ?? {}),
      loadMoreAction: value.layout?.loadMoreAction === 'dialog' ? 'dialog' : 'inline',
      mediacard: { ...defaultWidgetConfig.layout.mediacard, ...(value.layout?.mediacard ?? {}) },
      player: {
        ...defaultWidgetConfig.layout.player,
        ...(value.layout?.player ?? {}),
        tile: { ...defaultWidgetConfig.layout.player.tile, ...(value.layout?.player?.tile ?? {}) },
        autoAdvance: {
          ...defaultWidgetConfig.layout.player.autoAdvance,
          ...(value.layout?.player?.autoAdvance ?? {}),
        },
      },
      sections: normalizeSections(value.layout?.sections, value.visibility),
      video: { ...defaultWidgetConfig.layout.video, ...(value.layout?.video ?? {}) },
      wall: { ...defaultWidgetConfig.layout.wall, ...(value.layout?.wall ?? {}) },
    },
    form: {
      ...defaultWidgetConfig.form,
      ...(value.form ?? {}),
      fields: { ...defaultWidgetConfig.form.fields, ...(value.form?.fields ?? {}), email: true },
      maxMedia: ([1, 3, 6] as number[]).includes(Number(value.form?.maxMedia)) ? (Number(value.form?.maxMedia) as 1 | 3 | 6) : defaultWidgetConfig.form.maxMedia,
      cta: { ...defaultWidgetConfig.form.cta, ...(value.form?.cta ?? {}) },
    },
    customTags: { ...defaultWidgetConfig.customTags, ...(value.customTags ?? {}) },
    customFields: normalizeCustomFields(value.customFields),
    marketplacePolicy: mergeMarketplacePolicy(value.marketplacePolicy),
    ranking: value.ranking?.length ? value.ranking : defaultWidgetConfig.ranking,
  }
}

function normalizeSections(
  raw: WidgetSectionId[] | undefined,
  legacyVisibility: Partial<WidgetConfig['visibility']> | undefined,
): WidgetSectionId[] {
  const explicit = Array.isArray(raw)
  const legacy: Partial<Record<WidgetSectionId, boolean>> = explicit ? {} : {
    summary: legacyVisibility?.ratingDistribution === false,
    player: legacyVisibility?.videoRail === false,
    media: legacyVisibility?.photos === false,
    filters: legacyVisibility?.filters === false,
  }
  const out: WidgetSectionId[] = []
  for (const id of explicit ? raw : defaultWidgetConfig.layout.sections) {
    if (!Object.hasOwn(widgetSectionLabels, id) || out.includes(id) || legacy[id]) continue
    out.push(id)
  }
  if (!out.includes('list')) out.push('list')
  return out
}

function mergeMarketplacePolicy(value: Partial<WidgetConfig['marketplacePolicy']> | undefined): WidgetConfig['marketplacePolicy'] {
  return {
    wb: { ...defaultWidgetConfig.marketplacePolicy.wb, ...(value?.wb ?? {}) },
    ym: { ...defaultWidgetConfig.marketplacePolicy.ym, ...(value?.ym ?? {}) },
    ozon: { ...defaultWidgetConfig.marketplacePolicy.ozon, ...(value?.ozon ?? {}) },
  }
}
