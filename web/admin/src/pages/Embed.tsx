import { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../api'
import { toast } from '../toast'

type TenantInfo = { publicKey?: string }

export default function EmbedPanel() {
  const [baseUrl, setBaseUrl] = useState(window.location.origin)
  const [anchorSelector, setAnchorSelector] = useState('')
  const [publicKey, setPublicKey] = useState('')

  useEffect(() => {
    apiGet<TenantInfo>('/admin/api/tenant')
      .then((t) => setPublicKey(t.publicKey || ''))
      .catch(() => {})
  }, [])

  const snippet = useMemo(() => {
    const base = baseUrl.replace(/\/$/, '')
    const config: Record<string, string> = {
      dataBase: `${base}/reviews-data`,
      widgetJsUrl: `${base}/reviews-widget.js`,
      widgetCssUrl: `${base}/reviews-widget.css`,
      configBase: base,
    }
    if (publicKey) config.publicKey = publicKey
    if (anchorSelector.trim()) config.anchorSelector = anchorSelector.trim()
    const json = JSON.stringify(config, null, 2).replace(/</g, '\\u003c')
    return `<script>
window.REVIEWS_EMBED_CONFIG = ${json};
</script>
<script src="${base}/loader.js" async></script>`
  }, [anchorSelector, baseUrl, publicKey])

  const insecureBase = baseUrl.trim().startsWith('http://')

  async function copy() {
    await navigator.clipboard.writeText(snippet)
    toast.success('Скопировано — вставьте в шаблон или диспетчер тегов')
  }

  return (
    <div className="panel-state">
      <div className="grp open">
        <div className="ghead"><b>Подключение на сайт</b><span className="n">бывш. «Встраивание»</span></div>
        <div className="gbody">
          <div className="steps">
            <div className="step">
              <span className="num">1</span>
              <span>
                <b>Укажите базу</b>
                <p>Адрес сервера отзывов — он же источник CSS/JS виджета</p>
                <input className="fld" style={{ marginTop: 6, width: '100%', minHeight: 38, fontSize: 13.5, border: '1.5px solid var(--border)', borderRadius: 'var(--r-s)', padding: '0 10px' }} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              </span>
            </div>
            <div className="step">
              <span className="num">2</span>
              <span>
                <b>Скопируйте сниппет</b>
                <p>
                  Один код на все страницы (Custom HTML в диспетчере тегов): виджет сам различает карточку товара и
                  главную по адресу. Якорь по умолчанию — <code>#reviews-widget</code> (карточка) /{' '}
                  <code>#reviews-homepage</code> (главная).
                </p>
              </span>
            </div>
          </div>
          <label className="fld">
            <span>Anchor selector (необязательно)</span>
            <input value={anchorSelector} onChange={(e) => setAnchorSelector(e.target.value)} placeholder="#reviews-widget" />
          </label>
          {insecureBase && (
            <p className="hint" style={{ color: 'var(--warn)', fontWeight: 700 }}>
              ⚠ База с http:// будет заблокирована на https-сайте (mixed content). Настройте HTTPS для сервера
              отзывов.
            </p>
          )}
          <div className="code">{snippet}</div>
          <button onClick={copy}>Скопировать сниппет</button>
          <div className="fld" style={{ gap: 8 }}>
            <span>Чек-лист после вставки</span>
            <label className="check">
              <input type="checkbox" />
              <span>
                <b>Якорь на странице товара</b>
                <span className="d">#reviews-widget или автоподстановка</span>
              </span>
            </label>
            <label className="check">
              <input type="checkbox" />
              <span>
                <b>Контейнер опубликован в диспетчере тегов</b>
                <span className="d">сервер сниппет в HTML не увидит — проверьте публикацию контейнера</span>
              </span>
            </label>
            <label className="check">
              <input type="checkbox" />
              <span>
                <b>Проверка на живой странице</b>
                <span className="d">«Состояние» → «Проверить страницу товара»</span>
              </span>
            </label>
          </div>
          <p className="hint">
            Артикул loader возьмёт из JSON-LD / data-article на якоре / ссылочного индекса. CORS: укажите адрес
            магазина в «Настройках» — изменения применяются сразу, рестарт не нужен.
          </p>
        </div>
      </div>
    </div>
  )
}
