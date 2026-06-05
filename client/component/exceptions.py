from .errors import ErrorSource, ErrorCode, translate_errno

class HaZeroHidException(Exception):
    def __init__(self, source: ErrorSource, err: int | None = None, message: str | None = None, skippable: bool = False, server_id: str | None = None):
        self.source = source
        self.err = err
        self.code = translate_errno(source, err)
        self.skippable = skippable
        self.server_id = server_id

        super().__init__(message or self._default_message())

    def _default_message(self):
        return (
            f"source={self.source} | "
            f"err={self.err} | "
            f"code={self.code.name} | "
            f"skippable={self.skippable} | "
            f"server_id={self.server_id}"
        )