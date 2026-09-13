import { useEffect, useState } from 'react'
import { apiGet, apiWrite } from '../api'
import { toast } from '../toast'
import { useDirty } from '../useDirty'
import type { ShowcaseRule } from '../types'

export default function ShowcasePanel() {
  const [rule, setRule] = useState<ShowcaseRule | null>(null)
  const [baseline, setBaseline] = useState<ShowcaseRule | null>(null)
  const [loadError, setLoadError] = useState('')
  const dirty = useDirty(rule, baseline)
  const [shopOrigin, setShopOrigin] = useState('')

  useEffect(() => {
    apiGet<{ shopOrigin?: string }>('/admin/api/settings')
      .then((s) => setShopOrigin(s.shopOrigin ?? ''))
      .catch(() => {})
  }, [])

  useEffect(() => {
    apiGet<ShowcaseRule>('/admin/api/showcase-rule')
      .then((data) => {
        setRule(data)
        setBaseline(data)
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Запрос не выполнен'
        toast.error(msg)
        setLoadError(msg)
      })
  }, [])

  if (loadError && !rule) return <p className="error">{loadError}</p>
  if (!rule) return <p className="muted">Загрузка...</p>

  function set<K extends keyof ShowcaseRule>(key: K, value: ShowcaseRule[K]) {
    setRule({ ...rule!, [key]: value })
  }

  async function save() {
    try {
      await apiWrite('PUT', '/admin/api/showcase-rule', rule)
      setBaseline(rule)
      toast.success('Витрина сохранена — правило применится при следующей выгрузке')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Запрос не выполнен')
    }
  }

  return (
    <div className="panel-state">
      <div className="grp open">
        <div className="ghead"><b>Витрина на главной</b><span className="n">бывш. страница «Витрина»</span></div>
        <div className="gbody">
          <p className="hint">
            Витрина — <b style={{ color: 'var(--ink)' }}>какие отзывы показывать на главной странице магазина</b>{' '}
            (подборка /api/showcase). Оформление и секции настраиваются во вкладке «Вид».
          </p>
          <label className="fld">
            <span>Минимальная оценка</span>
            <select value={rule.MinRating} onChange={(e) => set('MinRating', Number(e.target.value))}>
              <option value={1}>Любая</option>
              <option value={4}>4 и выше</option>
              <option value={5}>Только 5</option>
            </select>
          </label>
          <label className="fld">
            <span>Сколько показывать</span>
            <input type="number" min={1} max={100} value={rule.Limit} onChange={(e) => set('Limit', Number(e.target.value))} />
          </label>
          <label className="fld">
            <span>Сортировка</span>
            <select value={rule.SortBy} onChange={(e) => set('SortBy', e.target.value as ShowcaseRule['SortBy'])}>
              <option value="recent">Сначала новые</option>
              <option value="rating">Сначала высокий рейтинг</option>
            </select>
          </label>
          <div className="f2">
            <label className="fld">
              <span>Мин. длина текста</span>
              <input type="number" min={0} value={rule.MinTextLen} onChange={(e) => set('MinTextLen', Number(e.target.value))} />
            </label>
            <label className="fld">
              <span>Возраст, дней (0 = любой)</span>
              <input type="number" min={0} value={rule.MaxAgeDays} onChange={(e) => set('MaxAgeDays', Number(e.target.value))} />
            </label>
          </div>
          <label className="check">
            <input type="checkbox" checked={rule.RequirePhoto} onChange={(e) => set('RequirePhoto', e.target.checked)} />
            <span>
              <b>Только с фото</b>
              <span className="d">фотоотзывы заметнее в подборке</span>
            </span>
          </label>
          <label className="check">
            <input type="checkbox" checked readOnly disabled />
            <span>
              <b>Закрепленные первыми</b>
              <span className="d">выбранные вручную отзывы всегда в начале (порядок закрепления)</span>
            </span>
          </label>
          <div className="fld">
            <span>Сейчас закреплено</span>
            <PinnedRow article={shopOrigin} />
          </div>
          <button disabled={!dirty} onClick={save}>
            Сохранить витрину
          </button>
          {dirty && <span className="hint" style={{ color: 'var(--warn)', fontWeight: 700 }}>Есть изменения</span>}
          <span className="hint">
            Витрина публикуется отдельно от конфига конструктора и не создаёт версию виджета.
          </span>
        </div>
      </div>
    </div>
  )
}

function PinnedRow({ article }: { article: string }) {
  const [pins, setPins] = useState<number[]>([])
  useEffect(() => {
    apiGet<{ reviewIds: number[] }>(`/admin/api/articles/${encodeURIComponent(article)}/pins`)
      .then((d) => setPins(d.reviewIds))
      .catch(() => {})
  }, [article])
  if (!pins.length) return <span className="hint">Закреплённых отзывов нет.</span>
  return (
    <div className="rows">
      {pins.map((id) => (
        <div className="rowl" key={id}>
          <b>#{id}</b>
          <span className="tag" style={{ color: 'var(--accent-deep)' }}>закреплён</span>
        </div>
      ))}
    </div>
  )
}
