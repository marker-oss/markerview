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
const mpLogos: Record<string, string> = {
  wb: new URL('../../../reviews-widget/assets/marketplaces/wb.png?inline', import.meta.url).href,
  ym: new URL('../../../reviews-widget/assets/marketplaces/ym.png?inline', import.meta.url).href,
  ozon: new URL('../../../reviews-widget/assets/marketplaces/ozon.png?inline', import.meta.url).href,
}

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
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

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
    setLoading(true)
    setLoadError('')
    apiGet<{ marketplaces: MarketplaceStatus[] }>('/admin/api/marketplaces')
      .then((data) => setItems(data.marketplaces))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Запрос не выполнен'))
      .finally(() => setLoading(false))
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
    <section className="marketplaces-page">
      <div className="pagehead">
        <div>
          <h1>Маркетплейсы</h1>
          <p className="sub">Доступы, синхронизация и публикация ответов</p>
        </div>
        <div className="actions">
          <button onClick={() => sync()} disabled={busy !== '' || loading || !items.some((item) => item.enabled && item.configured)}>
            {busy === 'all' ? 'Запускаем синхронизацию…' : 'Синхронизировать всё'}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mp-load-error" role="alert">
          <span>Не удалось загрузить площадки. {loadError}</span>
          <button className="secondary" onClick={load} disabled={loading}>Повторить</button>
        </div>
      )}

      <div className="stack" aria-busy={loading}>
        {items.map((item) => {
          const labels = fieldLabels[item.id] ?? {}
          const name = mpNames[item.id] ?? item.id
          return (
            <article className="card mp-card" key={item.id} aria-labelledby={`mp-${item.id}-title`}>
              <header className="mp-card-head">
                <div className="mp-identity">
                  {mpLogos[item.id] ? (
                    <img className="mp-logo" src={mpLogos[item.id]} alt="" width="44" height="44" />
                  ) : <span className="mp-logo mp-logo-fallback" aria-hidden="true">{item.id.toUpperCase()}</span>}
                  <div>
                    <h2 id={`mp-${item.id}-title`}>{name}</h2>
                    <p className="hint">{item.configured ? 'Доступы сохранены' : 'Добавьте данные для подключения'}</p>
                  </div>
                </div>
                <span className={`bag ${item.warning ? 'bag-warn' : !item.configured ? 'bag-neutral' : item.enabled ? 'bag-ok' : 'bag-neutral'}`}>
                  {item.warning ? 'Проверьте доступы' : !item.configured ? 'Не настроен' : item.enabled ? 'Готов к синхронизации' : 'Отключён'}
                </span>
                <button
                  className="mp-toggle"
                  aria-pressed={item.enabled}
                  onClick={() => save(item, !item.enabled)}
                  disabled={busy !== ''}
                  aria-label={`${item.enabled ? 'Выключить' : 'Включить'} ${name}`}
                >
                  <span className="tgl" aria-hidden="true" />
                  <span>{item.enabled ? 'Включён' : 'Выключен'}</span>
                </button>
              </header>
              {item.warning && <p className="mp-warning" role="status">{item.warning}</p>}
              <form className="mp-credentials" aria-label={`Доступы ${name}`} onSubmit={(e) => { e.preventDefault(); save(item) }}>
                <div className="mp-fields">
                  {Object.entries(labels).map(([key, label]) => (
                    <label className="fld" key={key}>
                      <span>{label}</span>
                      <input
                        name={key}
                        value={drafts[item.id]?.[key] ?? ''}
                        onChange={(e) => setDraft(item.id, key, e.target.value)}
                        placeholder={item.fields?.[key] ? 'Сохранён · введите для замены' : 'Введите значение'}
                        type={key.includes('token') || key.includes('key') ? 'password' : 'text'}
                        autoComplete="off"
                        spellCheck={false}
                        aria-describedby={`mp-${item.id}-help`}
                      />
                    </label>
                  ))}
                </div>
                <p className="hint" id={`mp-${item.id}-help`}>
                  {item.id === 'wb' && 'Персональный токен WB категории «Отзывы и вопросы». '}
                  {item.id === 'ym' && 'Укажите Business ID и API key или OAuth token. '}
                  Пустые поля не изменяют сохранённые значения.
                </p>
                <div className="mp-card-actions">
                  <button className="secondary" type="submit" disabled={busy !== ''}>
                    {busy === `save-${item.id}` ? 'Сохраняем…' : 'Сохранить доступы'}
                  </button>
                  <button className="secondary" type="button" onClick={() => sync(item.id)} disabled={busy !== '' || !item.enabled || !item.configured}>
                    {busy === item.id ? 'Запускаем…' : 'Синхронизировать'}
                  </button>
                </div>
              </form>
              <div className="mp-publishing">
                <div>
                  <h3>Публикация ответов</h3>
                  <p className="hint">Отправлять ответы из ЛК на {name}.</p>
                </div>
                <button
                  className="mp-toggle"
                  aria-pressed={publish[item.id] ?? defaultPublish[item.id] ?? false}
                  onClick={(e) => togglePublish(item.id, e.currentTarget.getAttribute('aria-pressed') !== 'true')}
                  disabled={busy !== ''}
                  aria-label={`Публиковать ответы на ${name}`}
                >
                  <span className="tgl" aria-hidden="true" />
                  <span>{(publish[item.id] ?? defaultPublish[item.id] ?? false) ? 'Включена' : 'Выключена'}</span>
                </button>
              </div>
            </article>
          )
        })}
        {items.length === 0 && !loadError && (
          <div className="empty" role="status">
            <b>{loading ? 'Загружаем площадки…' : 'Площадки не найдены'}</b>
            <p>{loading ? 'Получаем состояние подключений.' : 'Проверьте конфигурацию маркетплейсов на сервере.'}</p>
          </div>
        )}
      </div>

      <h2 className="sec-t" id="mp-catalog-title">Каталог товаров</h2>
      <section className="card mp-catalog" aria-labelledby="mp-catalog-title">
        <div className="mp-catalog-head">
          <div>
            <h3>Товары вашего магазина</h3>
            <p className="hint">Обновите каталог по карте сайта, чтобы связать отзывы с товарами.</p>
          </div>
          <span className={`bag ${catalog?.state === 'error' ? 'bag-err' : catalog?.state === 'done' ? 'bag-ok' : 'bag-neutral'}`}>
            {catalog?.state === 'running' ? 'Обновляется' : catalog?.state === 'done' ? 'Обновлён' : catalog?.state === 'error' ? 'Ошибка обновления' : 'Ожидание запуска'}
          </span>
        </div>
        {catalogStatusText(catalog) && <p className="mp-catalog-status" role="status">{catalogStatusText(catalog)}</p>}
        <div className="mp-card-actions">
          <button className="secondary" onClick={() => refreshCatalog()} disabled={busy !== '' || catalog?.state === 'running'}>
            {busy === 'catalog' || catalog?.state === 'running' ? 'Обновляем каталог…' : 'Обновить каталог'}
          </button>
          <button className="quiet" onClick={() => refreshCatalog(true)} disabled={busy !== '' || catalog?.state === 'running'}>
            Пересканировать полностью
          </button>
        </div>
        <p className="hint">Обновление добавит новые товары. Полное сканирование повторно обойдёт все страницы и займёт больше времени.</p>
      </section>
    </section>
  )
}
