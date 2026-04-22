import threading
import time
from collections import defaultdict

_lock = threading.Lock()
_buckets: dict[str, list[float]] = defaultdict(list)

WINDOW_SECONDS = 3600
MAX_REQUESTS = 20


def is_allowed(ip: str) -> bool:
    now = time.time()
    cutoff = now - WINDOW_SECONDS
    with _lock:
        _buckets[ip] = [t for t in _buckets[ip] if t > cutoff]
        if len(_buckets[ip]) >= MAX_REQUESTS:
            return False
        _buckets[ip].append(now)
        return True
