import { AwsClient } from 'aws4fetch';
import { createIsolateMemo } from '../container/isolate-memo.js';
import type { IsolateMemo } from '../container/isolate-memo.js';

/**
 * AWS credentials used to sign Secrets Manager requests.
 *
 * @remarks
 * Cloudflare Workers do not provide the AWS default credential chain, so AWS credentials are supplied
 * as Workers secrets and used to produce a SigV4 signature.
 */
export interface AwsSecretsOptions {
  /** AWS access key ID. */
  accessKeyId: string;
  /** AWS secret access key. */
  secretAccessKey: string;
  /** Optional STS session token, required when using temporary credentials. */
  sessionToken?: string;
  /** AWS region of the Secrets Manager endpoint, e.g. `ap-northeast-1`. */
  region: string;
}

/**
 * Per-isolate cache for the fetched secret.
 *
 * @remarks
 * The entry is keyed by region, access key ID, and secret ID. Each cold call can fetch in its
 * own request context. Only successfully parsed values are reused.
 * @internal
 */
let cache: { key: string; load: IsolateMemo<unknown, AwsSecretsOptions> } | undefined;

/**
 * Fetch and parse a secret from AWS Secrets Manager, caching the result per isolate.
 *
 * Issues a `GetSecretValue` call to Secrets Manager via a SigV4-signed `fetch` (using aws4fetch), with no
 * broad AWS SDK dependency involved. The parsed `SecretString` is cached per isolate keyed by region, access key ID, and
 * secret ID. Pending requests and failed fetches are never cached.
 *
 * @typeParam T - The shape of the JSON-parsed secret payload, supplied by the caller.
 * @param options - AWS credentials and region used to sign the request.
 * @param secretId - The Secrets Manager secret ID or ARN to retrieve.
 * @returns The parsed secret value cast to `T`.
 * @throws Error When the Secrets Manager response is not OK, or when it contains no `SecretString`.
 * @example
 * ```ts
 * interface DbSecret {
 *   username: string;
 *   password: string;
 * }
 *
 * const secret = await getAuthenticationSecret<DbSecret>(
 *   {
 *     accessKeyId: env.AWS_ACCESS_KEY_ID,
 *     secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
 *     region: 'ap-northeast-1',
 *   },
 *   'prod/db/credentials',
 * );
 * ```
 */
export function getAuthenticationSecret<T>(options: AwsSecretsOptions, secretId: string): Promise<T> {
  const key = `${options.region}:${options.accessKeyId}:${secretId}`;
  if (cache?.key !== key) {
    cache = { key, load: createIsolateMemo((credentials: AwsSecretsOptions) => fetchSecret(credentials, secretId)) };
  }
  return cache.load(options) as Promise<T>;
}

/**
 * Perform the SigV4-signed `GetSecretValue` request and parse the returned `SecretString`.
 *
 * @param options - AWS credentials and region used to sign the request.
 * @param secretId - The Secrets Manager secret ID or ARN to retrieve.
 * @returns The JSON-parsed secret payload.
 * @throws Error When the response is not OK, or when it contains no `SecretString`.
 * @internal
 */
async function fetchSecret(options: AwsSecretsOptions, secretId: string): Promise<unknown> {
  const aws = new AwsClient({
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    sessionToken: options.sessionToken,
    service: 'secretsmanager',
    region: options.region,
  });

  const response = await aws.fetch(`https://secretsmanager.${options.region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'secretsmanager.GetSecretValue',
    },
    body: JSON.stringify({ SecretId: secretId, VersionStage: 'AWSCURRENT' }),
  });

  if (!response.ok) {
    throw new Error(`Secrets Manager GetSecretValue failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as { SecretString?: string };
  if (!body.SecretString) {
    throw new Error('Secrets Manager GetSecretValue returned no SecretString');
  }
  return JSON.parse(body.SecretString);
}
