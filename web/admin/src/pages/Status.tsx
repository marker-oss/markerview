import { useEffect, useState } from 'react'
import { apiGet, apiWrite } from '../api'
import { toast } from '../toast'

type DiagItem = { id: string; level: 'ok' | 'warn' | 'fail'; title: string; detail: string; fixHref?: string }
type ActivityItem = { at: string; level: string; source: string; message: string }
type Diagnostics = { checks: DiagItem[]; activity: ActivityItem[] }

const levelLabel: Record<DiagItem['level'], string> = { ok: '✓', warn: '!', fail: '✕' }

export default function Status() {
  const [data, setData] = useState<Diagnostics | null>(null)
  const [loadError, setLoadError] = useState('')
  const [productUrl, setProductUrl] = useState('')
  const [probe, setProbe] = useState<DiagItem[] | null>(null)
  const [probing, setProbing] = useState(false)

  useEffect(() => {
    apiGet<Diagnostics>('/admin/api/diagnostics')
      .then(setData)
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Не удалось загрузить диагностику'
        toast.error(msg)
        setLoadError(msg)
      })
  }, [])

  async function runProbe() {
    setProbing(true)
    try {
      const res = await apiWrite<{ checks: DiagItem[] }>('POST', '/admin/api/diagnostics/probe', {
        productUrl: productUrl.trim(),
      })
      setProbe(res.checks)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Проверка не выполнена')
    } finally {
      setProbing(false)
    }
  }

  if (loadError && !data) return <p className="error">{loadError}</p>
  if (!data) return <p className="muted">Загрузка...</p>

  return (
    <section>
      <div className="pagehead">
        <div>
          <h1>Состояние</h1>
          <p className="sub">Человеческим языком: что не так, почему виджета не видно и как починить</p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={() => setProbe(null)} disabled={!probe}>
            Сбросить проверку
          </button>
        </div>
      </div>

      <div className="grid">
        {data.checks.map((c) => (
          <div className={`diag-item diag-${c.level}`} key={c.id}>
            <span className="diag-mark">{levelLabel[c.level]}</span>
            <div>
              <b>{c.title}</b>
              {c.detail && <p className="muted">{c.detail}</p>}
            </div>
            {c.fixHref && (
              <a className="diag-fix" href={c.fixHref}>
                Исправить →
              </a>
            )}
          </div>
        ))}
      </div>

      <div className="sec-t">
        Проверить страницу товара
        <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 700 }}>активная проверка</span>
      </div>
      <div className="card" style={{ padding: 18 }}>
        <p className="hint" style={{ marginBottom: 12 }}>
          Вставьте адрес страницы товара — проверим доступность сайта и что виджет сможет подобрать отзывы. Если
          все проверки зелёные, а виджета нет — убедитесь, что контейнер в Тег Менеджере опубликован
          (вставленный через Тег Менеджер сниппет сервер проверить не может).
        </p>
        <div className="fbar" style={{ padding: 0 }}>
          <input
            style={{ flex: '1 1 320px' }}
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            placeholder="https://ваш-магазин.ру/product/..."
          />
          <button onClick={runProbe} disabled={probing}>
            {probing ? 'Проверяем…' : 'Проверить'}
          </button>
        </div>
        {probe && (
          <div className="grid" style={{ marginTop: 14 }}>
            {probe.map((c) => (
              <div className={`diag-item diag-${c.level}`} key={c.id}>
                <span className="diag-mark">{levelLabel[c.level]}</span>
                <div>
                  <b>{c.title}</b>
                  {c.detail && <p className="muted">{c.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sec-t">Журнал событий</div>
      <div className="card">
        {data.activity.length === 0 && <div className="row"><span className="d">Событий пока нет.</span></div>}
        {data.activity.map((a, i) => (
          <div className="row" key={i}>
            <span className={`bag ${a.level === 'error' || a.level === 'fail' ? 'bag-err' : a.level === 'warn' ? 'bag-warn' : 'bag-ok'}`}>
              {a.source}
            </span>
            <span style={{ minWidth: 0 }}>{a.message}</span>
            <span className="v thin">{new Date(a.at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
