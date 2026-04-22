import math
from typing import TypeVar

T = TypeVar("T")

CHUNK_SIZE = 4


def chunk_list(items: list[T]) -> list[list[T]]:
    """Split a list into groups of CHUNK_SIZE."""
    n = len(items)
    num_chunks = math.ceil(n / CHUNK_SIZE)
    return [items[i * CHUNK_SIZE:(i + 1) * CHUNK_SIZE] for i in range(num_chunks)]
