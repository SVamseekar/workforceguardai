const AUTH_ERROR_MESSAGES: Record<string, string> = {
  cancelled: 'Sign-in was cancelled. You can try again when you are ready.',
  access_denied: 'Sign-in was cancelled. You can try again when you are ready.',
  sign_in_failed: 'We could not complete sign-in. Please try again or contact your administrator.',
  sign_in_unavailable:
    'The sign-in service is temporarily unavailable. Please try again in a few minutes.',
  unsupported_provider: 'That sign-in method is not supported.',
  not_provisioned:
    'Your account is not provisioned yet. Request a demo to get your organisation set up.',
  session_expired: 'Your session expired. Please sign in again.',
  network_error: 'Could not reach the sign-in service. Check your connection and try again.',
}

export function resolveAuthErrorMessage(
  code: string | null | undefined,
  description?: string | null,
): string | null {
  if (!code) return null

  const normalized = code.trim().toLowerCase()
  if (normalized in AUTH_ERROR_MESSAGES) {
    return AUTH_ERROR_MESSAGES[normalized]
  }

  const safeDescription = description?.trim()
  if (
    safeDescription &&
    safeDescription.length <= 160 &&
    !/[<>{}]/.test(safeDescription)
  ) {
    return safeDescription
  }

  return AUTH_ERROR_MESSAGES.sign_in_failed
}