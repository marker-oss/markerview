import { useEffect, useState } from 'react'
import { apiGet, apiWrite } from '../api'
import { toast } from '../toast'
import type { MarketplaceStatus, SyncDispatch } from '../types'

const fieldLabels: Record<string, Record<string, string>> = {
  wb: { token: 'WB API-токен' },
  ym: {
    api_key: 'API key',
    oauth_token: 'OAuth token',
    business_id: 'Business ID',
    campaign_id: 'Campaign ID',
  },
  ozon: {
    client_id: 'Client ID',
    api_key: 'API key',
  },
}

const mpNames: Record<string, string> = { wb: 'Wildberries', ym: 'Яндекс Маркет', ozon: 'Ozon' }
const mpColors: Record<string, string> = { wb: '#B137E5', ym: '#FC3F1D', ozon: '#005BFF' }

const defaultPublish: Record<string, boolean> = { wb: true, ym: true, ozon: false }

type CatalogStatus = {
  state: 'idle' | 'running' | 'done' | 'error'
  total: number
  crawled: number
  products: number
  articles: number
  error?: string
}

function catalogStatusText(status: CatalogStatus | null): string {
  if (!status) return ''
  switch (status.state) {
    case 'running':
      return status.total > 0
        ? `Обновление каталога: ${status.crawled} из ${status.total} новых товаров…`
        : 'Обновление каталога: читаем карту сайта…'
    case 'done':
      return `Каталог обновлён: товаров ${status.products}, артикулов с отзывами ${status.articles}`
    case 'error':
      return `Каталог: ${status.error ?? 'обновление не удалось'}`
    default:
      return ''
  }
}

export default function Marketplaces() {
  const [items, setItems] = useState<MarketplaceStatus[]>([])
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({})
  const [busy, setBusy] = useState('')
  const [publish, setPublish] = useState<Record<string, boolean>>(defaultPublish)
  const [catalog, setCatalog] = useState<CatalogStatus | null>(null)
  const [catalogPollEpoch, setCatalogPollEpoch] = useState(0)

  // Poll the background catalog-refresh job while it runs; also picks up a job
  // already started earlier (page reload, another tab).
  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const tick = () => {
      apiGet<CatalogStatus>('/admin/api/site-links/refresh')
        .then((status) => {
          if (cancelled) return
          setCatalog(status)
          if (status.state === 'running') timer = window.setTimeout(tick, 2000)
        })
        .catch(() => {})
    }
    tick()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [catalogPollEpoch])

  function load() {
    apiGet<{ marketplaces: MarketplaceStatus[] }>('/admin/api/marketplaces')
      .then((data) => setItems(data.marketplaces))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Запрос не выполнен'))
  }

  useEffect(load, [])

  useEffect(() => {
    apiGet<Record<string, string>>('/admin/api/settings').then((data) => {
      setPublish({
        wb: data['publishRepliesWb'] !== '' && data['publishRepliesWb'] !== undefined ? data['publishRepliesWb'] === 'true' : defaultPublish.wb,
        ym: data['publishRepliesYm'] !== '' && data['publishRepliesYm'] !== undefined ? data['publishRepliesYm'] === 'true' : defaultPublish.ym,
        ozon: data['publishRepliesOzon'] !== '' && data['publishRepliesOzon'] !== undefined ? data['publishRepliesOzon'] === 'true' : defaultPublish.ozon,
      })
    }).catch(() => {})
  }, [])

  async function togglePublish(mp: string, value: boolean) {
    setPublish((p) => ({ ...p, [mp]: value }))
    try {
      await apiWrite('PUT', '/admin/api/settings', { [`publish_replies_${mp}`]: value ? 'true' : 'false' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Запрос не выполнен')
    }
  }

  async function sync(marketplace?: string) {
    setBusy(marketplace ?? 'all')
    try {
      const result = await apiWrite<SyncDispatch>('POST', marketplace ? `/admin/api/sync?marketplace=${marketplace}` : '/admin/api/sync')
      if (result.started.length) toast.success(`Синхронизация запущена: ${result.started.join(', ')}`)
      if (result.busy.length) toast.info(`Уже выполняется: ${result.busy.join(', ')}`)
      if (!result.started.length && !result.busy.length) toast.info('Нет включённых маркетплейсов для синхронизации')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Запрос не выполнен')
    } finally {
      setBusy('')
    }
  }

  async function refreshCatalog(full = false) {
    setBusy('catalog')
    try {
      await apiWrite<CatalogStatus>('POST', `/admin/api/site-links/refresh${full ? '?full=1' : ''}`)
    } catch (err) {
      // 409 «уже идёт» тоже прилетает сюда — тогда просто продолжаем опрашивать.
      const status = await apiGet<CatalogStatus>('/admin/api/site-links/refresh').catch(() => null)
      if (!status || status.state !== 'running') {
        toast.error(err instanceof Error ? err.message : 'Запрос не выполнен')
        setBusy('')
        return
      }
    }
    setBusy('')
    setCatalogPollEpoch((n) => n + 1)
  }

  async function save(item: MarketplaceStatus, enabled = item.enabled) {
    setBusy(`save-${item.id}`)
    try {
      await apiWrite('PUT', `/admin/api/marketplaces/${item.id}/credentials`, {
        enabled,
        values: drafts[item.id] ?? {},
      })
      setDrafts({ ...drafts, [item.id]: {} })
      toast.success('Доступы сохранены. Запустите синхронизацию, чтобы подтянуть отзывы', {
        label: 'Синхронизировать',
        onClick: () => sync(item.id),
      })
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Запрос не выполнен')
    } finally {
      setBusy('')
    }
  }

  function setDraft(id: string, key: string, value: string) {
    setDrafts({ ...drafts, [id]: { ...(drafts[id] ?? {}), [key]: value } })
  }

  return (
    <section>
      <div className="pagehead">
        <div>
          <h1>Маркетплейсы</h1>
          <p className="sub">Доступы, синхронизация и публикация ответов</p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={() => refreshCatalog()} disabled={busy !== '' || catalog?.state === 'running'} title="Перечитать карту сайта и добавить новые товары">
            Обновить каталог
          </button>
          <button className="secondary" onClick={() => refreshCatalog(true)} disabled={busy !== '' || catalog?.state === 'running'} title="Заново обойти все страницы товаров — долго">
            Пересканировать
          </button>
          <button onClick={() => sync()} disabled={busy !== ''}>
            Синхронизировать всё
          </button>
        </div>
      </div>

      {catalogStatusText(catalog) && <p className="hint" style={{ marginBottom: 14 }}>{catalogStatusText(catalog)}</p>}

      <div className="stack">
        {items.map((item) => {
          const labels = fieldLabels[item.id] ?? {}
          const name = mpNames[item.id] ?? item.id
          return (
            <div className="card" key={item.id}>
              <div className="row" style={{ flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
                <span className="who" style={{ minWidth: 170 }}>
                  <span className="av" style={{ borderRadius: 10, width: 38, height: 38, background: mpColors[item.id] ?? 'var(--sunken)', color: '#fff', fontSize: 10 }}>
                    {item.id.toUpperCase()}
                  </span>
                  <span>
                    <b>{name}</b>
                    <span>
                      {item.configured ? 'доступы настроены' : 'доступы не заданы'}
                    </span>
                  </span>
                </span>
                {item.configured ? (
                  <span className="bag bag-ok">готов к синхронизации</span>
                ) : (
                  <span className="bag bag-warn">не настроен</span>
                )}
                {item.warning && <span className="bag bag-err">{item.warning}</span>}
                <span className="tgl-row" style={{ marginLeft: 'auto' }}>
                  <button
                    className={`tgl${item.enabled ? '' : ''}`}
                    aria-pressed={item.enabled}
                    onClick={() => save(item, !item.enabled)}
                    disabled={busy !== ''}
                    aria-label={item.enabled ? 'Выключить' : 'Включить'}
                  />
                  <b>{item.enabled ? 'включён' : 'выключен'}</b>
                </span>
              </div>
              <div className="row" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(Object.keys(labels).length + 1, 4)}, minmax(150px, 1fr))`, gap: 10, alignItems: 'end' }}>
                {Object.entries(labels).map(([key, label]) => (
                  <label className="fld" key={key}>
                    <span>{label}</span>
                    <input
                      value={drafts[item.id]?.[key] ?? ''}
                      onChange={(e) => setDraft(item.id, key, e.target.value)}
                      placeholder={item.fields?.[key] ? 'уже задан' : 'не задан'}
                      type={key.includes('token') || key.includes('key') ? 'password' : 'text'}
                    />
                    {item.id === 'wb' && key === 'token' && (
                      <i className="hint">Токен WB категории «Отзывы и вопросы».</i>
                    )}
                  </label>
                ))}
                <button className="secondary" onClick={() => save(item)} disabled={busy !== ''}>
                  Сохранить доступы
                </button>
                <button className="secondary sm" onClick={() => sync(item.id)} disabled={busy !== '' || !item.enabled || !item.configured}>
                  Синхронизировать
                </button>
              </div>
              <div className="row">
                <span className="k">Публиковать ответы на МП</span>
                <span className="tgl-row" style={{ marginLeft: 'auto' }}>
                  <button
                    className="tgl"
                    aria-pressed={publish[item.id] ?? defaultPublish[item.id] ?? false}
                    onClick={(e) => togglePublish(item.id, e.currentTarget.getAttribute('aria-pressed') !== 'true')}
                    disabled={busy !== ''}
                    aria-label="Публиковать ответы"
                  />
                  <b>{(publish[item.id] ?? defaultPublish[item.id] ?? false) ? 'да' : 'нет'}</b>
                </span>
              </div>
            </div>
          )
        })}
        {items.length === 0 && (
          <div className="empty">
            <b>Маркетплейсы недоступны</b>
            <p>Список площадок появится после загрузки.</p>
          </div>
        )}
      </div>

      <div className="sec-t">Каталог товаров</div>
      <div className="grid g3">
        <div className="card" style={{ padding: 16, display: 'grid', gap: 8 }}>
          <b style={{ fontSize: 13.5 }}>Последний обход</b>
          <span className="hint">
            {catalog?.state === 'done' ? `товаров ${catalog.products}, артикулов ${catalog.articles}` : 'по карте сайта'}
          </span>
        </div>
        <div className="card" style={{ padding: 16, display: 'grid', gap: 8 }}>
          <b style={{ fontSize: 13.5 }}>Автообновление</b>
          <span className="hint">раз в сутки · без участия оператора</span>
          <span className="bag bag-ok" style={{ justifySelf: 'start' }}>Работает</span>
        </div>
        <div className="card" style={{ padding: 16, display: 'grid', gap: 8 }}>
          <b style={{ fontSize: 13.5 }}>Состояние каталога</b>
          <span className="hint">{catalogStatusText(catalog) || 'ожидание запуска'}</span>
        </div>
      </div>
    </section>
  )
}
