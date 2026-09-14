import { useEffect, useState } from 'react'
import { apiGet, apiWrite } from '../api'
import { toast } from '../toast'
import type { Question } from '../types'

type ListResponse = {
  questions: Question[]
}

const PAGE_SIZE = 25

function sourceLabel(value: string) {
  if (value === 'site') return 'Сайт'
  if (value === 'wb') return 'Wildberries'
  if (value === 'ozon') return 'Ozon'
  if (value === 'ym') return 'Яндекс Маркет'
  return value
}

export default function QuestionsPanel() {
  const [data, setData] = useState<ListResponse>({ questions: [] })
  const [marketplace, setMarketplace] = useState('')
  const [status, setStatus] = useState('pending')
  const [offset, setOffset] = useState(0)
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({})

  function load(nextOffset = offset) {
    const query = new URLSearchParams()
    if (marketplace) query.set('marketplace', marketplace)
    if (status) query.set('status', status)
    query.set('limit', String(PAGE_SIZE))
    query.set('offset', String(nextOffset))
    apiGet<ListResponse>(`/admin/api/questions?${query.toString()}`)
      .then((next) => {
        setData(next)
        setAnswerDrafts(Object.fromEntries(next.questions.map((q) => [q.id, q.answer?.text ?? ''])))
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Запрос не выполнен'))
  }

  useEffect(() => load(offset), [marketplace, status, offset])

  function resetTo(setter: (v: string) => void) {
    return (value: string) => {
      setOffset(0)
      setter(value)
    }
  }

  async function saveAnswer(id: number) {
    try {
      await apiWrite('PUT', `/admin/api/questions/${id}/answer`, { text: answerDrafts[id] ?? '' })
      toast.success('Ответ сохранён')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Запрос не выполнен')
    }
  }

  async function retryPublish(id: number) {
    try {
      await apiWrite('POST', `/admin/api/questions/${id}/answer/retry`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Запрос не выполнен')
    }
  }

  const total = data.questions.length
  const hasPrev = offset > 0
  const hasNext = offset + PAGE_SIZE < total

  return (
    <section>
      <div className="card fbar">
        <select aria-label="Площадка" value={marketplace} onChange={(e) => resetTo(setMarketplace)(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">Все площадки</option>
          <option value="site">Сайт</option>
          <option value="wb">Wildberries</option>
          <option value="ozon">Ozon</option>
          <option value="ym">Яндекс Маркет</option>
        </select>
        <select aria-label="Статус вопроса" value={status} onChange={(e) => resetTo(setStatus)(e.target.value)} style={{ maxWidth: 190 }}>
          <option value="pending">Ожидают ответа</option>
          <option value="">Все статусы</option>
          <option value="imported">Импортированные</option>
          <option value="answered">Отвеченные</option>
        </select>
        <span className="count">
          <b>{total}</b> вопросов на странице
        </span>
      </div>
      <div className="card">
        <div className="table">
          <div className="table-head grid-questions">
            <span>Вопрос</span>
            <span>Статус</span>
            <span></span>
          </div>
          {data.questions.map((q) => (
            <div className="table-row grid-questions" key={q.id}>
              <div>
                <div className="who">
                  <span className="av">{(q.authorName || q.marketplace).slice(0, 1).toUpperCase()}</span>
                  <span>
                    <b>{q.authorName || sourceLabel(q.marketplace)}</b>
                    <span>{new Date(q.createdAt).toLocaleDateString('ru-RU')}</span>
                  </span>
                </div>
                <p style={{ margin: '6px 0 0' }}>{q.text}</p>
                <small className="muted">
                  {sourceLabel(q.marketplace)}
                  {q.sellerArticle ? ` · ${q.sellerArticle}` : ''}
                </small>
              </div>
              <span>
                <span className={`bag ${q.status === 'answered' ? 'bag-ok' : q.status === 'pending' ? 'bag-warn' : 'bag-neutral'}`}>
                  {q.status === 'answered' ? 'отвечен' : q.status === 'pending' ? 'ждёт ответа' : 'импортирован'}
                </span>
                {q.answerPublish?.state === 'failed' && (
                  <div style={{ marginTop: 6 }}>
                    <span className="bag bag-err">Ошибка публикации</span>
                  </div>
                )}
              </span>
              <div className="reply-editor">
                <textarea
                  value={answerDrafts[q.id] ?? ''}
                  onChange={(e) => setAnswerDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Ответ на вопрос"
                  rows={2}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button className="secondary" onClick={() => saveAnswer(q.id)}>
                    Ответить
                  </button>
                  {q.answerPublish?.state === 'failed' && (
                    <button className="quiet sm" onClick={() => retryPublish(q.id)}>
                      Повторить
                    </button>
                  )}
                </div>
                {q.answerPublish && (
                  <div className="reply-publish">
                    {q.answerPublish.state === 'published' && <span className="status-ok">Опубликовано на МП</span>}
                    {q.answerPublish.state === 'pending' && <span className="status-muted">Публикация…</span>}
                    {q.answerPublish.state === 'unsupported' && <span className="status-muted">Публикация на МП недоступна</span>}
                    {q.answerPublish.state === 'failed' && (
                      <span className="status-warn">{q.answerPublish.error}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {data.questions.length === 0 && (
            <div className="empty" style={{ gridColumn: '1 / -1', margin: 12 }}>
              <b>Таких вопросов нет</b>
              <p>Смените фильтр или подключите площадку, которая поддерживает вопросы.</p>
            </div>
          )}
        </div>
        {total > PAGE_SIZE && (
          <div className="pager">
            <button aria-label="Предыдущая страница" disabled={!hasPrev} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              ‹
            </button>
            <span className="cur">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} из {total}
            </span>
            <button aria-label="Следующая страница" disabled={!hasNext} onClick={() => setOffset(offset + PAGE_SIZE)}>
              ›
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
