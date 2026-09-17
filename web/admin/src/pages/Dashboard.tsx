import { useEffect, useState } from 'react'
import { apiGet } from '../api'
import type { DashboardData } from '../types'

function syncStatus(value: string) {
  if (value === 'ok') return 'успешно'
  if (value === 'error') return 'ошибка'
  if (value === 'running') return 'выполняется'
  return value
}

// Russian plural agreement: forms = [one, few, many] (1 проблема, 2 проблемы, 5 проблем).
function plural(n: number, forms: [string, string, string]) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]
  return forms[2]
}

function sourceLabel(value: string) {
  if (value === 'site') return 'Сайт'
  if (value === 'wb') return 'Wildberries'
  if (value === 'ym') return 'Яндекс Маркет'
  if (value === 'ozon') return 'Ozon'
  return value
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [diag, setDiag] = useState<{ checks: { id: string; level: string }[] } | null>(null)

  useEffect(() => {
    apiGet<DashboardData>('/admin/api/dashboard')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Запрос не выполнен'))
  }, [])

  useEffect(() => {
    apiGet<{ checks: { id: string; level: string }[] }>('/admin/api/diagnostics')
      .then(setDiag)
      .catch(() => {})
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted">Загрузка...</p>

  const byMp = Object.entries(data.by_marketplace)
  const mpMax = Math.max(1, ...byMp.map(([, count]) => count))
  const healthTone = (() => {
    if (!diag) return null
    const fails = diag.checks.filter((c) => c.level === 'fail').length
    const warns = diag.checks.filter((c) => c.level === 'warn').length
    if (fails > 0) return 'fail' as const
    if (warns > 0) return 'warn' as const
    return 'ok' as const
  })()
  const healthLabel = (() => {
    if (!diag) return 'Состояние проверяется…'
    const fails = diag.checks.filter((c) => c.level === 'fail').length
    const warns = diag.checks.filter((c) => c.level === 'warn').length
    const tone = fails > 0 ? 'fail' : warns > 0 ? 'warn' : 'ok'
    if (tone === 'ok') return 'Всё в порядке'
    return `${fails} ${plural(fails, ['проблема', 'проблемы', 'проблем'])} · ${warns} ${plural(warns, ['предупреждение', 'предупреждения', 'предупреждений'])}`
  })()

  return (
    <section>
      <div className="pagehead">
        <div>
          <h1>Обзор</h1>
          <p className="sub">Что происходит с отзывами прямо сейчас</p>
        </div>
        <div className="actions">
          <button
            className="secondary"
            onClick={() => {
              window.location.reload()
            }}
          >
            Обновить
          </button>
          <button
            onClick={() => {
              window.location.hash = '#/marketplaces'
            }}
          >
            Синхронизировать
          </button>
        </div>
      </div>

      {diag && (
        <a className={`health-strip health-${healthTone}`} href="#/status">
          <span>
            <b>Состояние: {healthLabel}</b>
            <br />
            <span className="d">Подробности и активные проверки — на странице «Состояние»</span>
          </span>
          <span className="go">Разобраться →</span>
        </a>
      )}

      <div className="sec-t">Метрики</div>
      <div className="kpis">
        <div className="card kpi">
          <span className="l">Всего отзывов</span>
          <span className="v">{data.total_reviews}</span>
          <span className="c">собрано со всех площадок</span>
        </div>
        <div className="card kpi">
          <span className="l">На сайте</span>
          <span className="v">{data.visible_reviews}</span>
          <span className="c">видны покупателям</span>
        </div>
        <div className="card kpi">
          <span className="l">Средняя оценка</span>
          <span className="v">{data.average_rating.toFixed(2)}</span>
          <span className="c">по показанным отзывам</span>
        </div>
        <div className="card kpi">
          <span className="l">Ожидают модерации</span>
          <span className="v">{data.pending_reviews}</span>
          <span className="c">ждут вашего решения</span>
        </div>
      </div>

      <div className="sec-t">Действия</div>
      <div className="pipe-grid">
        <div className="card pipe">
          <span className="n">{data.pending_reviews}</span>
          <span className="t">Нужна модерация</span>
          <span className="d">Новые отзывы ждут одобрения, чтобы попасть на сайт</span>
          <a className="pipe-link" href="#/reviews">
            Открыть отзывы
          </a>
        </div>
        <div className="card pipe">
          <span className="n">{data.visible_reviews}</span>
          <span className="t">Опубликовано</span>
          <span className="d">Живут на сайте и в виджете</span>
          <a className="pipe-link" href="#/widget">
            Настроить виджет
          </a>
        </div>
        <div className="card pipe">
          <span className="n">{data.total_reviews - data.visible_reviews}</span>
          <span className="t">Не показаны</span>
          <span className="d">Скрытые и отклонённые отзывы</span>
          <a className="pipe-link" href="#/reviews">
            Разобрать
          </a>
        </div>
      </div>

      {byMp.length > 0 && (
        <>
          <div className="sec-t">
            По маркетплейсам
            <a className="lnk" href="#/marketplaces">
              Настроить →
            </a>
          </div>
          <div className="card">
            {byMp.map(([marketplace, count]) => (
              <div className="row" key={marketplace}>
                <span className="k">{sourceLabel(marketplace)}</span>
                <span className="bar" aria-hidden="true">
                  <i style={{ width: `${Math.round((count / mpMax) * 100)}%` }} />
                </span>
                <span className="v">{count}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sec-t">Активность</div>
      <div className="card">
        {data.recent_syncs.length === 0 && <div className="row"><span className="d">Синхронизаций пока не было.</span></div>}
        {data.recent_syncs.map((run) => (
          <div className="row" key={run.ID}>
            <span className={`bag ${run.Status === 'error' ? 'bag-err' : 'bag-ok'}`}>
              {run.Status === 'error' ? 'ошибка' : syncStatus(run.Status)}
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="k" style={{ display: 'block' }}>
                {sourceLabel(run.Marketplace)} · получено {run.ReviewsSeen}, сохранено {run.ReviewsUpserted}
              </span>
              {run.ErrorText && <span className="d">{run.ErrorText}</span>}
            </span>
            <span className="v thin">{new Date(run.StartedAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
