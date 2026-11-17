"""Central error shape: {"error": {"code": str, "message": str, ...}} for every failure."""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str, **extra):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.extra = extra
        super().__init__(message)


def _body(code: str, message: str, **extra) -> dict:
    return {"error": {"code": code, "message": message, **extra}}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_req: Request, exc: ApiError):
        return JSONResponse(status_code=exc.status_code, content=_body(exc.code, exc.message, **exc.extra))

    @app.exception_handler(RequestValidationError)
    async def _validation(_req: Request, exc: RequestValidationError):
        fields = []
        for err in exc.errors():
            loc = ".".join(str(p) for p in err.get("loc", []) if p not in ("body", "query", "path"))
            fields.append({"field": loc, "message": err.get("msg", "Invalid value")})
        first = fields[0] if fields else {"field": "", "message": "Invalid request"}
        message = f"{first['field']}: {first['message']}" if first["field"] else first["message"]
        return JSONResponse(status_code=422, content=_body("validation_error", message, fields=fields))

    @app.exception_handler(StarletteHTTPException)
    async def _http(_req: Request, exc: StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content=_body("http_error", str(exc.detail)))
