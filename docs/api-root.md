---
title: 'API: Root'
---

# API: `@rdlabo/workers-hono-kit`

The root export is web-standard only: it runs on `workerd` and never depends on Node.js APIs or `mysql2`. The table below lists the helpers exported from the root entry point.

| Export | Description |
| --- | --- |
| `finalizeResponse()` | Middleware that adds a weak `ETag` (delegates to `hono/etag`; also handles `If-None-Match` → `304`). |
| `validate(target, schema, options?)` | Zod validator → NestJS `ValidationPipe`-shaped `400` (`{ statusCode, message[], error }`). `options.onValidationError(err, c)` to report (e.g. Sentry). |
| `createValidate({ sentry? })` | Bound `validate` factory. Pass `sentry` on Sentry apps; omit for console-only (review, cbs-ai). |
| `createSentryValidate(sentry)` | **Deprecated** — use `createValidate({ sentry })`. |
| `zNum` / `zNumWithDefault` / `zNumOptional` / `zNumNullable` | Number-coercion zod schemas (mirror class-transformer `@Transform`). |
| `getAuthenticationSecret<T>(options, secretId)` / `AwsSecretsOptions` | Fetch a secret from AWS Secrets Manager (SigV4 `fetch`, per-isolate cache). |
| `getTemporaryCredentials(options)` / `GetTemporaryCredentialsOptions` / `StsCredentials` | STS `AssumeRole` via SigV4 `fetch` (global `sts.amazonaws.com`); returns temporary credentials for browser S3 uploads. |
| `getCloudFrontSignedUrl(url, privateKeyPem, keyPairId, dateLessThan)` | CloudFront signed URL (canned policy, RSA-SHA1, URL-safe base64) — Web Crypto reimpl of `@aws-sdk/cloudfront-signer`, byte-identical query order. |
| `JoseFirebaseVerifier` / `FirebaseVerifier` / `DecodedIdToken` | Firebase ID-token verification (`verifyIdToken`, `getUser`, `deleteUser`). |
| `createRemoteFirebaseVerifier(projectId)` | Convenience factory: production verifier with a cached remote JWKS (verification only). |
| `createServiceAccountVerifier(serviceAccountJson)` | Cached verifier built from a service-account JSON, **with `IdentityToolkit`** (getUser/deleteUser). One per isolate, re-created only when the SA JSON changes. |
| `IdentityToolkit` / `ServiceAccount` / `SECURETOKEN_JWK_URL` | Identity Toolkit REST client + constants for `getUser` / `deleteUser`. |
| `retryWhenDeadlock(fn, retries?, delay?)` | Retry on MySQL `ER_LOCK_DEADLOCK` with exponential backoff. |
| `getUserProtocol(c)` / `IUserProtocol` | Read client IP / UA (`CF-Connecting-IP` → `X-Forwarded-For`). |
| `getAppInfo(c)` / `AppInfo` | Read `x-amz-meta-version` / `x-amz-meta-uuid`. |
| `resolveAppEnv(env)` / `isProductionEnv(env)` / `AppEnv` | Resolve `'development'` / `'production'` from `env.APP_ENV` (defaults to `'production'` for safety). |
| `HttpStatus` | Standard HTTP status code enum (IANA registry). |
| `createHttpErrorHandler(options?)` / `HttpErrorHandlerOptions` | `app.onError()` handler that maps a thrown `HTTPException` to `{ statusCode, message, error? }` (`401` omits `error`). Optional custom error predicate and unhandled-error report hook. Unhandled errors log via `console.error` (mysql2 errors include `sqlMessage` / `errno` when detectable). |
| `createAppErrorHandler(options?)` / `CreateAppErrorHandlerOptions` | Standard `app.onError`: {@link createQueryFailedErrorHandler} + default {@link classifyGenericMysqlDriverError} + optional `sentry` (Sentry apps), `getReportError` / `reportError` (tests / container), or neither (no external reporting). |
| `createQueryFailedErrorHandler(options)` / `QueryFailedClassifier` / `ClassifiedDbError` | Lower-level compose when you need full control over `classify` + `onUnhandledError` without defaults. |
| `classifyGenericMysqlDriverError(err)` | Default classifier: any mysql2 driver error → `{ statusCode: 500, message: 'Internal server error' }`; non-DB errors → `null`. |
| `findMysqlDriverError(err)` / `logMysqlDriverError(err, statusCode)` | Low-level mysql2 driver-error detection (follows `err.cause`) and structured logging. For custom classifiers (e.g. odss). |
| `notFoundHandler(c)` | `app.notFound()` handler with `{ message: 'Cannot METHOD path', error, statusCode }` 404 body. |
| `normalizeTrailingSlash(request)` | Strip trailing slash(es) from the request URL before routing (Express/Nest parity). Does **not** 301-redirect — preserves POST/PUT/DELETE bodies. |
| `HTTP_ERROR_PHRASES` | `{ 400, 401, 403, 404 }` → standard `error` field phrases. |
| `createAuthMiddleware(options)` / `AuthMiddlewareOptions` | Factory for a Firebase-token auth middleware: reads the token header, verifies, resolves the DB user id, and stashes the result on the context. Omit `resolveUserId` for a token-only (login) guard. |
| `createIdentityAuthFailureBody()` / `createLegacyIdentityAuthFailureBody()` / `createAuthFailureBody(scope, code, message)` / `AuthFailureScope` | Stable wire contract for distinguishing a lost global identity (`identity`) from recent-login (`reauthentication`) and feature credential (`credential`) failures. The legacy helper tags products whose installed clients still require auth failure as `403`. |
| `perfLog(options?)` / `PerfLogOptions` / `AnalyticsEngineDatasetLike` | Middleware that records one per-request latency data point (`t_app`, colo, cold/warm, route, status) and emits it to **Workers Logs** (`console.log`) and/or **Workers Analytics Engine** (`writeDataPoint`). Lets you measure low-traffic Workers without a live `wrangler tail`. |
| `createMaintenanceMiddleware(options)` / `createMaintenanceWaitHandler(options)` / `isMaintenanceEnabled(env)` / `MAINTENANCE_CODE` / `MAINTENANCE_WAIT_PATH` | Fleet maintenance short-circuit: when enabled (`MAINTENANCE=1`), every non-allowlisted request returns `503` + `{ statusCode, message, code: 'MAINTENANCE' }` **before** container/DB. Pair with `GET /public/maintenance/wait` SSE (`event: ping` / `event: ended`) so clients can auto-dismiss a lock UI. Mount after `cors`, before `containerMiddleware`. |
| `ErrorReporter` / `ErrorReportContext` | Types for a `reportError`-style unhandled-error reporter (e.g. wired to Sentry), paired with `createHttpErrorHandler`'s `onUnhandledError`. |
| `createSentryErrorReporter(sentry)` / `SentryExceptionReporterLike` | Build an `ErrorReporter` that forwards to Sentry with an optional `request_id` tag (no hard `@sentry/cloudflare` dependency). |
| `DeferExecutor` / `defaultDefer` / `createWaitUntilDefer(ctx)` | Fire-and-forget executor for Workers: both variants log background rejections without propagating them; `createWaitUntilDefer` also registers work via `ctx.waitUntil`. |
| `configureHibernationAutoResponse` / `upgradeHibernationWebSocket` / `broadcastHibernationWebSockets` | Hibernation WebSocket room primitives: runtime ping/pong without waking JavaScript, attachment-before-accept upgrade, and broadcast through sockets restored by `getWebSockets()`. |
| `acknowledgeHibernationWebSocketClose` / `closeHibernationWebSocket` | Safe close helpers, including normalization of reserved received-only close codes. |
| `retryDurableObjectOperation(operation, options?)` / `isRetryableDurableObjectError(error)` | Retry idempotent DO work only for `retryable && !overloaded`, with jittered exponential backoff. `operation` runs per attempt so callers create a fresh stub after an exception. |
| `createIdempotencyInput(...)` / `runIdempotentMutation(...)` | Canonical payload hashing and a transaction-bound mutation state machine. Missing keys preserve legacy behavior; replay/conflict/in-flight semantics are shared while each app owns its schema and ORM adapter. |
| `withIdempotencyHttpErrors(run)` | Maps only standard idempotency failures to 400/409/503 and rethrows unrelated failures. |
| `createAiGatewayProvider(config)` / `AiGatewayConfig` / `AiGatewayProvider` | Route `@ai-sdk` models through the Cloudflare AI Gateway, via either a Workers `AI` binding or REST credentials (`accountId` / `gateway` / `token`). |
| `KVCache` / `KVNamespace` / `KVCacheOptions` / `KVCacheErrorContext` / `KVCacheOperation` | Workers-KV cache-aside helper (key `appName+version+table_type_column`, sha256 for string ids, TTL clamped ≥60s). Set `appName` / `version` per application; optional `onError(error, context)` observes fail-soft read/parse/serialize/write/delete failures. Context contains only the operation and logical table, not cache types, keys, ids, or values. |
| `createStripeClient(secret, opts?)` / `verifyStripeWebhook(...)` / `CreateStripeClientOptions` | Workers-native Stripe client (fetch transport) + async webhook verification (SubtleCrypto). `apiVersion` optional (pin to a fixed Stripe API version). |
| `extractStripeFailureReason(source)` / `StripeFailureReason` | Duck-type a Stripe `PaymentIntent` / `Invoice` / `{ paymentIntent?, invoice? }` / thrown error into a normalized `{ code, declineCode, message, paymentIntentId, invoiceId, subscriptionId }` (SDK-free), or `null`. |
| `stripeFailureMessageJa(reason)` | Render a `StripeFailureReason` (or `null`) as a single user-facing Japanese sentence (`decline_code` > `code`; fraud codes masked; unknown → generic). |
| `PaymentDeclinedError` / `toPaymentDeclinedError(error, status?)` / `PaymentDeclinedBody` | `HTTPException` carrying a verbatim `{ statusCode, message, code?, declineCode? }` body for a synchronous card decline (defaults to `400`). `toPaymentDeclinedError` returns `null` for non-declines (re-throw → 500). |
| `classifyStripeReconcile(subscription)` / `StripeReconcileAction` | Classify an expanded Stripe subscription into `trial` / `clear` / `canceled` / `failed` / `action_required` / `none` (termination evaluated before `succeeded`). Consumer does the DB write. |
| `serializePaymentFailure(record)` / `parsePaymentFailure(receipt)` / `PaymentFailureRecord` / `PaymentFailureReason` / `PaymentFailureSource` | (De)serialize the `payment_failed.receipt` JSON. `parsePaymentFailure` restores both a full Stripe record and a bare IAP reason. |
| `serializeIapFailureReason(reason)` / `IapFailureReason` | Serialize an IAP reason (`billing_retry` / `auto_renew_off` / `subscription_canceled` / `subscription_gone` + provider codes) directly, without the source/timestamp wrapper. |
| `paymentFailureMessageJa(input)` / `PaymentFailureStatus` / `PaymentFailureType` / `UNRESOLVED_PAYMENT_STATUSES` | Provider-agnostic Japanese message for a `payment_failed` row (`canceled` re-subscribe prompt, IAP `failed` App Store/Google Play prompt, else Stripe wording). `UNRESOLVED_PAYMENT_STATUSES` = everything except `resolved` for read/resolve `WHERE`. |
| `iapFailureKey(input)` | Provider-native `payment_failed.recursions_id`: iOS `${original_transaction_id}:${expires_date_ms}`, Android `${orderId}` (provider is in the `type` column). |
| `verifyAppleReceipt(receipt, opts)` / `classifyAppleRenewal(verify, now)` / `AppleRenewalClassification` / `AppleRenewalState` / `AppleVerifyReceiptResponse` / `ApplePendingRenewalInfo` / `AppleLatestReceiptInfo` | Verify an App Store receipt (production → sandbox fallback; inject `password` / `fetchImpl`) and classify it into `billing_retry` / `lapsed` / `active` / `unknown` plus the raw fields used (`statusCode` / `billingRetryStatus` / `autoRenewStatus`, latest `original_transaction_id` / `expires_date_ms`). |
| `googleAccessToken(creds, fetch?)` / `getGoogleSubscription(opts)` / `classifyGoogleSubscription(purchase, now)` / `GoogleSubscriptionClassification` / `GoogleSubscriptionState` / `GoogleSubscriptionPurchase` / `GoogleOAuthCredentials` | Exchange a refresh token for an Android Publisher access token (throws on `invalid_grant`), fetch a subscription purchase, and classify it into `canceled` / `gone` / `active` / `unknown` plus raw `statusCode` / `cancelReason`. |
| `sendInChunks(queue, messages, options?)` / `QueueLike` / `QueueSendMessage` | Send queue messages in bounded chunks to stay under the Workers subrequest cap per invocation. `options.chunkSize` sets the per-batch size (defaults to and is capped at 100). |
| `processBatch(batch, handler, options?)` / `isNonRetryableQueueError(error)` / `NonRetryableQueueErrorLike` / `MessageBatchLike` / `QueueMessageLike` / `ProcessBatchOptions` / `ProcessBatchResult` | Process a queue batch with bounded concurrency. Errors explicitly tagged with `queueDisposition: 'discard'` are reported and acked as permanent failures; all other errors are retried. |
| `createQueueErrorHandler(options)` / `CreateQueueErrorHandlerOptions` | Factory for `processBatch`'s `onError`: logs every failure; optional Sentry capture with queue/message context; optional `maxRetries` gate (report only on final attempt, except permanent failures which are reported immediately). |
| `assertStripeCustomerUpdated(options)` | Preserve the shared Stripe UPDATE→existence-check algorithm. `createNotFoundError(customerId)` can supply a domain-specific error without forking the algorithm. |
| `ExecutionContextLike` | Minimal `waitUntil`-only Workers execution context shape used by lifecycle-compatible APIs and deferred work helpers. |

Permanent Queue failures must opt in with the Queue-specific marker; unrelated `retryable` fields are ignored:

```ts
import type { NonRetryableQueueErrorLike } from '@rdlabo/workers-hono-kit';

class CustomerLinkMissingError extends Error implements NonRetryableQueueErrorLike {
  readonly queueDisposition = 'discard' as const;
}
```
