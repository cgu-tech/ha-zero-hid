from enum import IntEnum
import errno

class ErrorSource(IntEnum):
    HID_NETWORK = 1
    HID_USB     = 2
    INTEGRATION = 3

class ErrorCode(IntEnum):
    HID_NETWORK_ERROR   = 1
    HID_USB_CABLE_ERROR = 2
    HID_USB_HID_ERROR   = 3
    HID_UNKNOWN_ERROR   = 4
    INTEGRATION_ERROR   = 5

def translate_errno(source: ErrorSource, err: int | None) -> ErrorCode:
    if source is ErrorSource.HID_NETWORK:
        return ErrorCode.HID_NETWORK_ERROR

    if source is ErrorSource.HID_USB:
        if not err:
            return ErrorCode.HID_UNKNOWN_ERROR

        if err in {
            errno.EAGAIN,
            errno.EALREADY,
            errno.EWOULDBLOCK,
            errno.EINPROGRESS,
            errno.ENODEV,
        }:
            return ErrorCode.HID_USB_CABLE_ERROR

        if err in {
            errno.EPIPE,
            errno.ESHUTDOWN,
        }:
            return ErrorCode.HID_USB_HID_ERROR

        return ErrorCode.HID_UNKNOWN_ERROR

    if source is ErrorSource.INTEGRATION:
        return ErrorCode.INTEGRATION_ERROR

    raise ValueError(f"Unsupported source: {source}")