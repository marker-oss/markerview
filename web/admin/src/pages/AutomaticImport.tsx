import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { apiGet, apiWrite } from '../api'
import { toast } from '../toast'

type AutomaticImportTarget = {
  id: number
  url: string
  external_product_id?: string
  seller_article?: string
  label?: string
  enabled: boolean
  last_status?: string
  last_error?: string
  last_sync_at?: string
  last_synced_at?: string
}

type AutomaticImportResponse = {
  enabled: boolean
  limit: number
  active_count: number
  targets: AutomaticImportTarget[]
}

const statusLabels: Record<string, string> = {
  queued: 'В очереди',
  running: 'Выполняется',
  succeeded: 'Успешно',
  done: 'Успешно',
  failed: 'Ошибка',
  error: 'Ошибка',
}

function statusTone(status: string | undefined) {
  if (status === 'succeeded' || status === 'done') return 'bag-ok'
  if (status === 'failed' || status === 'error') return 'bag-err'
  if (status === 'queued' || status === 'running') return 'bag-acc'
  return 'bag-neutral'
}

function formatDate(value: string | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU')
}

export default function AutomaticImport() {
  const [data, setData] = useState<AutomaticImportResponse | null>(null)
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [sellerArticle, setSellerArticle] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState('')

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      setData(await apiGet<AutomaticImportResponse>('/admin/api/automatic-import'))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Запрос не выполнен')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function addTarget(event: FormEvent) {
    event.preventDefault()
    setBusy('add')
    try {
      await apiWrite<AutomaticImportTarget>('POST', '/admin/api/automatic-import/targets', {
        url: url.trim(),
        label: label.trim(),
        seller_article: sellerArticle.trim(),
      })
      setUrl('')
      setLabel('')
      setSellerArticle('')
      toast.success('Товар добавлен в автоматический импорт')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось добавить товар')
      // Refresh after conflicts so the displayed capacity remains server-authoritative.
      await load()
    } finally {
      setBusy('')
    }
  }

  async function targetAction(target: AutomaticImportTarget, action: 'queue' | 'disable') {
    const key = `${action}-${target.id}`
    setBusy(key)
    try {
      await apiWrite<AutomaticImportTarget>('POST', `/admin/api/automatic-import/targets/${target.id}/${action}`)
      toast.success(action === 'queue' ? 'Импорт поставлен в очередь' : 'Товар отключён')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Запрос не выполнен')
      await load()
    } finally {
      setBusy('')
    }
  }

  const canAdd = data !== null && data.enabled && data.active_count < data.limit

  return (
    <section className="automatic-import-page">
      <div className="pagehead">
        <div>
          <h1>Автоматический импорт</h1>
          <p className="sub">Товары Ozon, которые будут обновляться автоматически</p>
        </div>
        {data && (
          <span className={`bag ${data.enabled ? 'bag-ok' : 'bag-neutral'}`}>
            {data.active_count} / {data.limit} активных
          </span>
        )}
      </div>

      {loadError && (
        <div className="mp-load-error" role="alert">
          <span>Не удалось загрузить автоматический импорт. {loadError}</span>
          <button className="secondary" type="button" onClick={() => void load()} disabled={loading}>Повторить</button>
        </div>
      )}

      {data && !data.enabled && (
        <div className="card" role="status" style={{ padding: 18, marginBottom: 18 }}>
          <b>Автоматический импорт отключён</b>
          <p className="hint">Добавление и постановка товаров в очередь недоступны. Обратитесь к администратору, чтобы включить эту возможность.</p>
        </div>
      )}

      {canAdd && (
        <div className="card" style={{ padding: 18, marginBottom: 18 }}>
          <h2 style={{ marginTop: 0 }}>Добавить товар</h2>
          <form className="stack" onSubmit={addTarget}>
            <label className="fld">
              <span>Ссылка на товар Ozon</span>
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.ozon.ru/product/..."
                autoComplete="url"
                required
                aria-describedby="automatic-import-url-help"
              />
              <i className="hint" id="automatic-import-url-help">Используйте ссылку на карточку товара с домена www.ozon.ru.</i>
            </label>
            <div className="grid g2">
              <label className="fld">
                <span>Название (необязательно)</span>
                <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={128} />
              </label>
              <label className="fld">
                <span>Артикул продавца (необязательно)</span>
                <input value={sellerArticle} onChange={(event) => setSellerArticle(event.target.value)} maxLength={128} />
              </label>
            </div>
            <div className="actions" style={{ justifyContent: 'flex-start' }}>
              <button type="submit" disabled={busy !== ''}>
                {busy === 'add' ? 'Добавляем…' : 'Добавить товар'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="sec-t">Товары</div>
      <div className="stack" aria-busy={loading}>
        {loading && !data && <p className="muted" role="status">Загрузка…</p>}
        {data && data.targets.length === 0 && (
          <div className="empty">
            <b>Товаров пока нет</b>
            <p>Добавьте ссылку на карточку Ozon, чтобы включить автоматическое обновление.</p>
          </div>
        )}
        {data?.targets.map((target) => {
          const status = target.last_status || '—'
          const canQueue = target.enabled && status !== 'queued' && status !== 'running'
          const actionBusy = busy === `queue-${target.id}` || busy === `disable-${target.id}`
          return (
            <article className="card" key={target.id} aria-labelledby={`automatic-import-target-${target.id}`}>
              <div className="mp-card-head">
                <div style={{ minWidth: 0 }}>
                  <h2 id={`automatic-import-target-${target.id}`} style={{ overflowWrap: 'anywhere' }}>
                    {target.label || target.url}
                  </h2>
                  {target.label && <p className="hint" style={{ overflowWrap: 'anywhere' }}>{target.url}</p>}
                  {target.seller_article && <p className="hint">Артикул продавца: {target.seller_article}</p>}
                </div>
                <span className={`bag ${target.enabled ? statusTone(target.last_status) : 'bag-neutral'}`}>
                  {target.enabled ? (statusLabels[status] || status) : 'Отключён'}
                </span>
              </div>
              <div className="grid g2" style={{ marginTop: 14 }}>
                <span className="hint">Последняя синхронизация: {formatDate(target.last_sync_at || target.last_synced_at)}</span>
                <span className="hint">Последняя ошибка: {target.last_error || 'нет'}</span>
              </div>
              <div className="mp-card-actions" style={{ marginTop: 14 }}>
                {target.enabled && (
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => void targetAction(target, 'queue')}
                    disabled={busy !== '' || !canQueue}
                  >
                    {busy === `queue-${target.id}` ? 'Ставим в очередь…' : canQueue ? 'Запустить импорт' : 'Импорт выполняется…'}
                  </button>
                )}
                {target.enabled && (
                  <button
                    className="danger"
                    type="button"
                    onClick={() => void targetAction(target, 'disable')}
                    disabled={busy !== '' || actionBusy}
                  >
                    {busy === `disable-${target.id}` ? 'Отключаем…' : 'Отключить'}
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
