from enum import IntEnum
import errno

class ErrorSource(IntEnum):
    HID = 1
    INTEGRATION = 2

class ErrorCode(IntEnum):
    HID_NETWORK_ERROR = 1
    HID_USB_ERROR     = 2
    HID_UNKNOWN_ERROR = 3
    INTEGRATION_ERROR = 4

def translate_errno(cls, source: ErrorSource, err: int | None) -> ErrorCode:
    if source is ErrorSource.HID:
        if not err:
            return cls.HID_UNKNOWN_ERROR
        
        if err in {
            errno.EADDRINUSE,
            errno.EADDRNOTAVAIL,
            errno.ENETDOWN,
            errno.ENETUNREACH,
            errno.ECONNABORTED,
            errno.ECONNRESET,
            errno.ENOBUFS,
            errno.EISCONN,
            errno.ENOTCONN,
            errno.ETIMEDOUT,
            errno.ECONNREFUSED,
            errno.EHOSTUNREACH,
            errno.EALREADY,
            errno.EINPROGRESS,
        }:
            return cls.HID_NETWORK_ERROR

        if err in {
            errno.EPIPE,
            errno.ESHUTDOWN,
        }:
            return cls.HID_USB_ERROR

        return cls.HID_UNKNOWN_ERROR

    if source is ErrorSource.INTEGRATION:
        return cls.INTEGRATION_ERROR

    raise ValueError(f"Unsupported source: {source}")