from rest_framework import serializers
from .models import ReportItem


class ReportItemSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ReportItem
        fields = [
            'id', 'project', 'created_by', 'created_by_name',
            'name', 'category', 'description', 'quantity', 'unit_value',
            'depreciation_method', 'depreciation_rate', 'book_value',
            'specs', 'merged_from_valuation',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'created_by_name']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
