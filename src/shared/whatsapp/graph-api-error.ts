import { AppError } from "@/shared/errors/app-error";

const GRAPH_API_ERROR_CODE = "GRAPH_API_ERROR";

/**
 * A call to the Meta Graph API failed (Meta returned an error, or the request
 * never reached Meta).
 *
 * Why: feature adapters (e.g. `MetaMessageSender`) map `metaErrorCode` into
 * their own typed errors so the UI can show the real reason.
 * Meta error codes: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
export class GraphApiError extends AppError {
  /** Meta's numeric `error.code`, or `null` when unknown (network failure, non-JSON body). */
  public readonly metaErrorCode: number | null;

  /** HTTP status returned by Meta, or `null` when no response was received. */
  public readonly httpStatus: number | null;

  constructor(metaErrorCode: number | null, httpStatus: number | null = null) {
    super(GRAPH_API_ERROR_CODE, "The WhatsApp Graph API request failed.");
    this.metaErrorCode = metaErrorCode;
    this.httpStatus = httpStatus;
  }
}
