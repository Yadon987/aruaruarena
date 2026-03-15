import { HttpResponse, http } from 'msw'

export const healthHandlers = [
  /**
   * GET /api/health
   *
   * backend 稼働確認を返します。
   */
  http.get('/api/health', () =>
    HttpResponse.json({
      status: 'ok',
      environment: 'test',
      timestamp: '2026-03-15T00:00:00Z',
      worker: {
        mode: 'local_worker',
        status: 'ok',
        command: 'bundle exec ruby scripts/run_judgment_worker.rb',
      },
    })
  ),
]
