"""
External HTTP catalog provider scaffold.
Returns empty list unless an ExternalSource is configured and active.
"""
import logging
import requests
from .base import BaseProvider, Suggestion
from catalog.models import ExternalSource

logger = logging.getLogger(__name__)


class ExternalHttpProvider(BaseProvider):
    name = 'external_http'

    def search(self, query: str, category: str):
        source = ExternalSource.objects.filter(name=self.name, is_active=True).first()
        if not source:
            return []
        try:
            url = source.config.get('url', '')
            api_key = source.config.get('api_key', '')
            if not url:
                return []
            resp = requests.get(
                url,
                params={'q': query, 'category': category},
                headers={'Authorization': f'Bearer {api_key}'},
                timeout=5,
            )
            resp.raise_for_status()
            items = resp.json().get('results', [])
            return [
                Suggestion(
                    title=item.get('title', ''),
                    category=category,
                    specs=item.get('specs', {}),
                    confidence=float(item.get('confidence', 0.7)),
                    source='external',
                )
                for item in items
            ]
        except Exception as exc:
            logger.warning("ExternalHttpProvider error: %s", exc)
            return []
