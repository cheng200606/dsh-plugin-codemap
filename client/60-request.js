/* ---- 60-request.js ----
 * JSON request, error normalisation and abort helpers.
 * This file is concatenated into ../../client.js by scripts/build-client.mjs.
 */
    function normalizeError(payload, status) {
      const fallbackCode = `HTTP_${status || 0}`
      const raw = payload && typeof payload === 'object' ? payload.error ?? payload : null
      if (raw && typeof raw === 'object') {
        return {
          code: String(raw.code ?? fallbackCode),
          message: String(raw.message ?? raw.error ?? ''),
          hint: String(raw.hint ?? ''),
        }
      }
      if (typeof raw === 'string' && raw.trim() !== '') {
        return { code: fallbackCode, message: raw, hint: '' }
      }
      if (payload && typeof payload === 'object' && typeof payload.message === 'string') {
        return { code: String(payload.code ?? fallbackCode), message: payload.message, hint: String(payload.hint ?? '') }
      }
      return { code: fallbackCode, message: `HTTP ${status || 0}`, hint: '' }
    }

    /** True when a failure is the abort of a superseded request. */
    function isAbortError(cause) {
      if (!cause) return false
      if (cause.name === 'AbortError') return true
      return String(cause.message ?? '').includes('aborted')
    }

    /**
     * Perform one JSON request against the shared `/api` channel.
     *
     * @param {string} url the request URL
     * @param {{ signal?: AbortSignal, method?: string, body?: object }} [options]
     */
    async function requestJson(url, options = {}) {
      const init = { method: options.method || 'GET', signal: options.signal }
      if (options.body !== undefined) {
        init.headers = { 'content-type': 'application/json' }
        init.body = JSON.stringify(options.body)
      }
      let response
      try {
        response = await fetch(url, init)
      } catch (cause) {
        if (isAbortError(cause)) throw cause
        const failure = new Error(String((cause && cause.message) || cause))
        failure.state = {
          code: 'NETWORK',
          message: String((cause && cause.message) || cause),
          hint: 'The host did not answer; check that the DSH host is running.',
        }
        throw failure
      }
      if (!response.ok) {
        let payload = null
        try {
          payload = await response.json()
        } catch {
          payload = null
        }
        const failure = new Error(`HTTP ${response.status}`)
        failure.state = normalizeError(payload, response.status)
        throw failure
      }
      try {
        return await response.json()
      } catch (cause) {
        const failure = new Error(String((cause && cause.message) || cause))
        failure.state = {
          code: 'BAD_RESPONSE',
          message: String((cause && cause.message) || cause),
          hint: 'The host answered with a payload the panel cannot read.',
        }
        throw failure
      }
    }

    /** Turn any failure into the `{code, message, hint}` triple. */
    function toErrorState(cause) {
      if (cause && cause.state && typeof cause.state === 'object') return cause.state
      return normalizeError(null, 0)
    }
