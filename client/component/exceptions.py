from .errors import ErrorSource, ErrorCode, translate_errno

class HaZeroHidException(Exception):
    def __init__(self, source: ErrorSource, err: int | None, message: str | None = None):
        self.source = source
        self.err = err
        self.code = translate_errno(source, err)

        super().__init__(message or self._default_message())

    def _default_message(self):
        return (
            f"source={self.source} | "
            f"err={self.err} | "
            f"code={self.code.name}"
        )