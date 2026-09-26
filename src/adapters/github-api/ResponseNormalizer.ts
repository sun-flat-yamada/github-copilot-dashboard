export type NormalizerFn<TRaw = unknown, TNormalized = unknown> = (raw: TRaw) => TNormalized;

export interface NormalizedApiResponse<T = unknown> {
  data: T;
  apiVersionUsed: string;
  normalizedAt: string;
}

export interface IResponseNormalizer<TRaw = unknown, TNormalized = unknown> {
  normalize(raw: TRaw, apiVersion: string): NormalizedApiResponse<TNormalized>;
}
