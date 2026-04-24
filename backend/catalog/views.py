import unicodedata
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import ItemCatalog, DepreciationPolicy
from .serializers import ItemCatalogSerializer, DepreciationPolicySerializer
from .providers.internal import InternalProvider
from .providers.external import ExternalHttpProvider
from .services.depreciation import compute_depreciation


def normalize(text):
    return unicodedata.normalize('NFKD', text.strip().lower())


# ---- Catalog suggestions ----

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_suggestions(request):
    """Return ranked suggestions from all active providers."""
    query = request.data.get('query', '').strip()
    category = request.data.get('category', '')

    providers = [InternalProvider(), ExternalHttpProvider()]
    suggestions = []
    seen = set()

    for provider in providers:
        try:
            for s in provider.search(query, category):
                key = (normalize(s.title), s.category)
                if key not in seen:
                    seen.add(key)
                    suggestions.append({
                        'id': s.item_id,
                        'title': s.title,
                        'category': s.category,
                        'specs': s.specs,
                        'confidence': round(s.confidence, 3),
                        'source': s.source,
                    })
        except Exception:
            pass

    suggestions.sort(key=lambda x: -x['confidence'])
    return Response(suggestions)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_item(request):
    """Field officer confirmed or created a catalog item."""
    title = request.data.get('title', '').strip()
    category = request.data.get('category', '')
    specs = request.data.get('specs', {})

    if not title or not category:
        return Response({'error': 'title and category required'}, status=400)

    obj, created = ItemCatalog.objects.get_or_create(
        title__iexact=title,
        category=category,
        defaults={'title': title, 'specs': specs, 'created_by': request.user},
    )
    if not created and specs:
        obj.specs.update(specs)
        obj.save(update_fields=['specs'])

    return Response(ItemCatalogSerializer(obj).data, status=201 if created else 200)


# ---- Depreciation ----

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calculate_depreciation(request):
    """Compute depreciation.

    If a ``category`` is provided and no explicit ``rate``/``method`` override,
    a matching :class:`DepreciationPolicy` is loaded (Feature #12) and its
    defaults are applied.
    """
    from datetime import date
    from decimal import Decimal
    data = request.data
    try:
        category = (data.get('category') or '').strip()
        method = data.get('method') or 'straight_line'
        rate = data.get('rate')
        salvage_rate = data.get('salvage_rate')
        useful_life_years = data.get('useful_life_years')
        units_lifetime = data.get('units_lifetime')

        # Feature #12: fall back to active policy by (category, method)
        applied_policy = None
        if category:
            applied_policy = DepreciationPolicy.objects.filter(
                category=category, method=method
            ).first() or DepreciationPolicy.objects.filter(category=category).first()
            if applied_policy:
                if rate in (None, ''):
                    rate = applied_policy.default_rate
                if salvage_rate in (None, ''):
                    salvage_rate = applied_policy.salvage_rate
                if useful_life_years in (None, ''):
                    useful_life_years = applied_policy.useful_life_years
                if method in (None, '') and applied_policy.method:
                    method = applied_policy.method
                if units_lifetime in (None, '') and applied_policy.units_lifetime:
                    units_lifetime = applied_policy.units_lifetime

        result = compute_depreciation(
            method=method or 'straight_line',
            purchase_value=Decimal(str(data['purchase_value'])),
            purchase_date=date.fromisoformat(data['purchase_date']),
            salvage_rate=Decimal(str(salvage_rate if salvage_rate not in (None, '') else '0.10')),
            rate=Decimal(str(rate)) if rate not in (None, '') else None,
            useful_life_years=int(useful_life_years) if useful_life_years not in (None, '') else 10,
            units_used=int(data.get('units_used', 0)),
            units_lifetime=int(units_lifetime) if units_lifetime not in (None, '') else None,
        )

        # Align response keys with the mobile widget (Feature #12)
        out = dict(result)
        out['depreciation_amount'] = result['accumulated_depreciation']
        if rate not in (None, ''):
            out['applied_rate'] = str(rate)
        if applied_policy:
            out['applied_policy'] = {
                'category': applied_policy.category,
                'method': applied_policy.method,
                'default_rate': str(applied_policy.default_rate),
                'salvage_rate': str(applied_policy.salvage_rate),
                'useful_life_years': applied_policy.useful_life_years,
            }
        return Response(out)
    except (KeyError, ValueError) as exc:
        return Response({'error': str(exc)}, status=400)


class DepreciationPolicyListView(generics.ListAPIView):
    serializer_class = DepreciationPolicySerializer
    permission_classes = [IsAuthenticated]
    queryset = DepreciationPolicy.objects.all()


class DepreciationPolicyDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = DepreciationPolicySerializer
    permission_classes = [IsAuthenticated]
    queryset = DepreciationPolicy.objects.all()

    def perform_update(self, serializer):
        user = self.request.user
        if not (hasattr(user, 'role') and user.role.role == 'admin'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only admins can update depreciation policies.')
        serializer.save()


class ItemCatalogListView(generics.ListAPIView):
    serializer_class = ItemCatalogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ItemCatalog.objects.all()
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(title__icontains=q)
        return qs
