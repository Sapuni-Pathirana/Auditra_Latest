"""Base interface for catalog suggestion providers."""
from dataclasses import dataclass, field
from typing import List


@dataclass
class Suggestion:
    title: str
    category: str
    specs: dict = field(default_factory=dict)
    confidence: float = 1.0
    source: str = 'internal'
    item_id: int = None


class BaseProvider:
    """All providers must implement this interface."""

    name: str = 'base'

    def search(self, query: str, category: str) -> List[Suggestion]:
        raise NotImplementedError
