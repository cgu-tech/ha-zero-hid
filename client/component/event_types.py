from enum import IntEnum

class EventType(IntEnum):
    TRACE = 1
    DEBUG = 2
    INFO = 3
    WARN = 4
    ERROR = 5
    CRITICAL = 6
