"""Internal catalog provider — full-text search over ItemCatalog."""
from .base import BaseProvider, Suggestion
from catalog.models import ItemCatalog


class InternalProvider(BaseProvider):
    name = 'internal'

    def search(self, query: str, category: str):
        qs = ItemCatalog.objects.filter(category=category)
        if query:
            qs = qs.filter(title__icontains=query)
        return [
            Suggestion(
                title=item.title,
                category=item.category,
                specs=item.specs,
                confidence=item.confidence_default,
                source='internal',
                item_id=item.id,
            )
            for item in qs[:20]
        ]
