import type { ApiErrorBody } from "@realm/contracts";
import type { FastifyError, FastifyInstance } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";
import { AppError } from "../lib/errors";

export function registerErrorHandling(app: FastifyInstance) {
  app.setNotFoundHandler((req, reply) => {
    const body: ApiErrorBody = {
      error: {
        code: "NOT_FOUND",
        message: `No route for ${req.method} ${req.url}`,
        requestId: req.id,
      },
    };
    reply.status(404).send(body);
  });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    const send = (status: number, error: ApiErrorBody["error"]) =>
      reply.status(status).send({ error: { ...error, requestId: req.id } } satisfies ApiErrorBody);

    if (err instanceof AppError) {
      if (err.retryAfter) reply.header("Retry-After", err.retryAfter);
      return send(err.status, {
        code: err.code,
        message: err.message,
        details: err.details,
        retryAfter: err.retryAfter,
      });
    }

    if (hasZodFastifySchemaValidationErrors(err)) {
      return send(400, {
        code: "VALIDATION_FAILED",
        message: "Some fields need attention",
        details: {
          issues: err.validation.map((v) => ({
            path: v.instancePath.replace(/^\//, "").split("/").filter(Boolean),
            message: v.message,
          })),
        },
      });
    }

    if (isResponseSerializationError(err)) {
      req.log.error({ err, url: req.url }, "response failed its schema — server bug");
      return send(500, { code: "INTERNAL", message: "Something went wrong on our side" });
    }

    if (err.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
      return send(415, {
        code: "BAD_REQUEST",
        message: "Send JSON (Content-Type: application/json)",
      });
    }
    if (err.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      return send(413, { code: "PAYLOAD_TOO_LARGE", message: "Request body too large" });
    }
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return send(err.statusCode, { code: "BAD_REQUEST", message: err.message });
    }

    req.log.error({ err }, "unhandled error");
    return send(500, { code: "INTERNAL", message: "Something went wrong on our side" });
  });
}
