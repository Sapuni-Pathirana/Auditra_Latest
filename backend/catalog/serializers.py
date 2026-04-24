from rest_framework import serializers
from .models import ItemCatalog, DepreciationPolicy


class ItemCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemCatalog
        fields = ['id', 'title', 'category', 'specs', 'source', 'confidence_default', 'created_at']
        read_only_fields = ['id', 'created_at']


class DepreciationPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = DepreciationPolicy
        fields = [
            'id', 'category', 'method', 'default_rate', 'salvage_rate',
            'useful_life_years', 'units_lifetime',
        ]
