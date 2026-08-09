const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'content-type': 'application/json',
  },
  body: JSON.stringify(body),
})

export const handler = async (event) => {
  // API Gateway validates the Cognito JWT before this Lambda is invoked.
  const claims = event.requestContext?.authorizer?.jwt?.claims ?? {}

  if (!claims.sub) {
    // Fail closed if the authorizer context is unexpectedly missing.
    return response(401, { message: 'Unauthorized' })
  }

  return response(200, {
    authenticated: true,
    userId: claims.sub,
    username: claims.username ?? claims['cognito:username'] ?? null,
    tokenUse: claims.token_use ?? null,
  })
}
