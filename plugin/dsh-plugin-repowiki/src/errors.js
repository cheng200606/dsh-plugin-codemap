/**
 * The unified error payload.
 *
 * Every route, tool and command of this plugin reports failures with the same
 * three fields, so the Web client can render `error.code`, `error.message` and
 * `error.hint` without knowing where the failure came from.
 */

/** The error codes the plugin reports. */
export const ERROR_CODES = {
  NOT_FOUND: 'not_found',
  INVALID_ARGUMENT: 'invalid_argument',
  CONFLICT: 'conflict',
  FAILED: 'failed',
  UNSUPPORTED: 'unsupported',
  INTERNAL: 'internal',
}

/** The Chinese hint used when the error carries none of its own. */
export const ERROR_HINTS = {
  [ERROR_CODES.NOT_FOUND]: '请确认页面 id 是否存在（可用 /wiki status 查看页面清单）',
  [ERROR_CODES.INVALID_ARGUMENT]: '请检查请求参数是否合法，例如语言、模板或页面 id。',
  [ERROR_CODES.CONFLICT]: '请等待当前任务结束后重试',
  [ERROR_CODES.FAILED]: '本次生成未完成，可查看日志后重试。',
  [ERROR_CODES.UNSUPPORTED]: '当前环境暂不支持该操作。',
  [ERROR_CODES.INTERNAL]: '插件内部异常，请查看宿主日志获取更多细节。',
}

/**
 * Turn any thrown value into the unified error payload.
 *
 * The conversion never throws: a string becomes the message, a missing
 * message becomes 「未知错误」, and a hint is only used when the error brings
 * its own one.
 *
 * @param {*} error - The thrown value.
 * @param {string} [fallbackCode] - The code used when the error carries none.
 * @returns {{ code: string, message: string, hint: string }} The payload.
 */
export function toErrorPayload(error, fallbackCode = ERROR_CODES.INTERNAL) {
  let code = typeof fallbackCode === 'string' && fallbackCode ? fallbackCode : ERROR_CODES.INTERNAL
  let message = '未知错误'
  let hint = ''

  try {
    if (typeof error === 'string') {
      if (error) message = error
    } else if (error && typeof error === 'object') {
      const rawCode = error.code
      if (typeof rawCode === 'string' && rawCode) code = rawCode
      const rawMessage = error.message
      if (typeof rawMessage === 'string' && rawMessage) message = rawMessage
      else if (rawMessage !== undefined && rawMessage !== null) message = String(rawMessage)
      const rawHint = error.hint
      if (typeof rawHint === 'string' && rawHint) hint = rawHint
      else if (rawHint !== undefined && rawHint !== null) hint = String(rawHint)
    }
  } catch {
    // A broken error object must not break the response: keep the defaults.
  }

  if (!hint) hint = ERROR_HINTS[code] ?? ERROR_HINTS[ERROR_CODES.INTERNAL]
  return { code, message, hint }
}
