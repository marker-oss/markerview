import { useEffect, useState } from 'react'
import { apiGet, apiWrite } from '../api'
import { toast } from '../toast'
import { useDirty } from '../useDirty'

interface SettingsResponse {
  agreementUrl: string
  reviewTermsUrl: string
  shopOrigin: string
  sitemapUrl: string
}

export default function Settings() {
  const [agreementUrl, setAgreementUrl] = useState('')
  const [reviewTermsUrl, setReviewTermsUrl] = useState('')
  const [shopOrigin, setShopOrigin] = useState('')
  const [sitemapUrl, setSitemapUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [baseline, setBaseline] = useState<SettingsResponse>({
    agreementUrl: '',
    reviewTermsUrl: '',
    shopOrigin: '',
    sitemapUrl: '',
  })

  // DSR (152-ФЗ) state
  const [dsrEmail, setDsrEmail] = useState('')
  const [dsrResult, setDsrResult] = useState<{ reviews: unknown[] } | null>(null)
  const [dsrBusy, setDsrBusy] = useState(false)

  useEffect(() => {
    apiGet<SettingsResponse>('/admin/api/settings')
      .then((data) => {
        const next = {
          agreementUrl: data.agreementUrl ?? '',
          reviewTermsUrl: data.reviewTermsUrl ?? '',
          shopOrigin: data.shopOrigin ?? '',
          sitemapUrl: data.sitemapUrl ?? '',
        }
        setAgreementUrl(next.agreementUrl)
        setReviewTermsUrl(next.reviewTermsUrl)
        setShopOrigin(next.shopOrigin)
        setSitemapUrl(next.sitemapUrl)
        setBaseline(next)
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Запрос не выполнен'))
  }, [])

  const current: SettingsResponse = { agreementUrl, reviewTermsUrl, shopOrigin, sitemapUrl }
  const dirty = useDirty(current, baseline)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await apiWrite<SettingsResponse>('PUT', '/admin/api/settings', {
        agreementUrl: agreementUrl.trim(),
        reviewTermsUrl: reviewTermsUrl.trim(),
        shopOrigin: shopOrigin.trim(),
        sitemapUrl: sitemapUrl.trim(),
      })
      const next = {
        agreementUrl: agreementUrl.trim(),
        reviewTermsUrl: reviewTermsUrl.trim(),
        shopOrigin: shopOrigin.trim(),
        sitemapUrl: sitemapUrl.trim(),
      }
      setBaseline(next)
      toast.success('Сохранено · CORS применяется сразу, без рестарта')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Запрос не выполнен')
    } finally {
      setBusy(false)
    }
  }

  async function dsrLookup() {
    setDsrResult(null)
    setDsrBusy(true)
    try {
      const data = await apiGet<{ reviews: unknown[] }>(
        `/admin/api/dsr/lookup?email=${encodeURIComponent(dsrEmail)}`,
      )
      setDsrResult(data)
      toast.info(`Найдено отзывов: ${data.reviews.length}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setDsrBusy(false)
    }
  }

  async function dsrDelete() {
    if (!window.confirm('Удалить все данные этого субъекта без возможности восстановления?')) return
    if (!window.confirm(`Подтвердите: безвозвратно удалить данные для "${dsrEmail}"?`)) return
    setDsrBusy(true)
    try {
      const r = await apiWrite<{ deleted: number }>('POST', '/admin/api/dsr/delete', {
        email: dsrEmail,
      })
      toast.success(`Удалено: ${r.deleted}`)
      setDsrResult(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setDsrBusy(false)
    }
  }

  return (
    <section>
      <div className="pagehead">
        <div>
          <h1>Общие настройки</h1>
          <p className="sub">Юридические ссылки, магазин и панель 152-ФЗ</p>
        </div>
        <div className="actions">
          {dirty && <span className="dirty-badge">Есть изменения</span>}
          <button form="settings-form" disabled={busy}>
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </div>

      <div className="sec-t">Форма отзыва на сайте</div>
      <div className="card" style={{ padding: 18 }}>
        <form id="settings-form" className="stack" onSubmit={save}>
          <div className="grid g2">
            <label className="fld">
              <span>Согласие на обработку данных</span>
              <input
                type="url"
                value={agreementUrl}
                onChange={(e) => setAgreementUrl(e.target.value)}
                placeholder="https://ваш-магазин.ру/personal-data-consent"
              />
              <i className="hint">Показывается под формой отзыва рядом с галочкой согласия. Пусто — ссылки нет.</i>
            </label>
            <label className="fld">
              <span>Правила публикации отзывов</span>
              <input
                type="url"
                value={reviewTermsUrl}
                onChange={(e) => setReviewTermsUrl(e.target.value)}
                placeholder="https://ваш-магазин.ру/review-terms"
              />
              <i className="hint">Необязательно; показывается в форме отзыва.</i>
            </label>
          </div>
        </form>
      </div>

      <div className="sec-t">
        Магазин и каталог
        <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 700 }}>применяется сразу</span>
      </div>
      <div className="card" style={{ padding: 18 }}>
        <form className="stack" onSubmit={save}>
          <div className="grid g2">
            <label className="fld">
              <span>Адрес магазина (origin · CORS)</span>
              <input
                type="url"
                value={shopOrigin}
                onChange={(e) => setShopOrigin(e.target.value)}
                placeholder="https://ваш-магазин.ру"
              />
              <i className="hint">
                Разрешает сайту магазина загружать виджет (без него — без стилей и данных). www-вариант домена
                разрешается автоматически.
              </i>
            </label>
            <label className="fld">
              <span>Адрес sitemap (необязательно)</span>
              <input
                type="url"
                value={sitemapUrl}
                onChange={(e) => setSitemapUrl(e.target.value)}
                placeholder="https://ваш-магазин.ру/sitemap.xml"
              />
              <i className="hint">
                Переопределяет адрес магазина для обхода каталога. По умолчанию — <code>/sitemap.xml</code>.
              </i>
            </label>
          </div>
        </form>
      </div>

      <div className="sec-t">Запросы субъектов (152-ФЗ)</div>
      <div className="card" style={{ padding: 18, display: 'grid', gap: 12 }}>
        <p className="hint">
          Поиск, выгрузка и удаление персональных данных по запросу субъекта. Укажите email, использованный
          при отправке отзыва на сайте.
        </p>
        <div className="fbar" style={{ padding: 0 }}>
          <input
            type="email"
            style={{ flex: '1 1 260px' }}
            value={dsrEmail}
            onChange={(e) => setDsrEmail(e.target.value)}
            placeholder="subject@example.com"
          />
          <button className="secondary" onClick={dsrLookup} disabled={dsrBusy || !dsrEmail.trim()}>
            Найти
          </button>
          {dsrResult !== null && (
            <a className="secondary sm" style={{ display: 'inline-flex', alignItems: 'center' }} href={`/admin/api/dsr/export?email=${encodeURIComponent(dsrEmail)}`}>
              Скачать выгрузку
            </a>
          )}
          {dsrResult !== null && dsrResult.reviews.length > 0 && (
            <button className="danger" onClick={dsrDelete} disabled={dsrBusy}>
              Удалить все данные
            </button>
          )}
        </div>
        {dsrResult !== null && <p className="hint">Найдено отзывов: {dsrResult.reviews.length}</p>}
        <p className="hint">
          Для отзывов с маркетплейсов удаляется только наша копия. Оригинал на WB / Ozon / Яндекс Маркет
          удаляется через сам маркетплейс.
        </p>
      </div>
    </section>
  )
}
