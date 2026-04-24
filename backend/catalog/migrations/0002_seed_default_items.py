"""Seed default ItemCatalog and DepreciationPolicy rows (Features #10, #12)."""
from django.db import migrations


DEFAULT_ITEMS = [
    # Land
    ('Residential Land', 'land', {'usage': 'residential'}),
    ('Commercial Land', 'land', {'usage': 'commercial'}),
    ('Agricultural Land', 'land', {'usage': 'agricultural'}),
    ('Industrial Land', 'land', {'usage': 'industrial'}),
    ('Bare Land', 'land', {}),
    # Building
    ('Single-Storey House', 'building', {'floors': 1}),
    ('Two-Storey House', 'building', {'floors': 2}),
    ('Apartment Unit', 'building', {}),
    ('Office Building', 'building', {}),
    ('Warehouse', 'building', {}),
    ('Commercial Shop', 'building', {}),
    ('Factory Building', 'building', {}),
    ('Hotel', 'building', {}),
    # Vehicle
    ('Sedan Car', 'vehicle', {'type': 'car'}),
    ('SUV', 'vehicle', {'type': 'car'}),
    ('Hatchback', 'vehicle', {'type': 'car'}),
    ('Pickup Truck', 'vehicle', {'type': 'truck'}),
    ('Lorry', 'vehicle', {'type': 'truck'}),
    ('Van', 'vehicle', {'type': 'van'}),
    ('Motorcycle', 'vehicle', {'type': 'motorcycle'}),
    ('Three Wheeler', 'vehicle', {'type': 'three_wheeler'}),
    ('Tractor', 'vehicle', {'type': 'agricultural'}),
    # Other
    ('Generator', 'other', {}),
    ('Industrial Machinery', 'other', {}),
    ('Office Equipment', 'other', {}),
    ('Furniture', 'other', {}),
    ('IT Equipment', 'other', {}),
    ('Inventory Stock', 'other', {}),
    ('Livestock', 'other', {}),
    ('Agricultural Equipment', 'other', {}),
]


DEFAULT_POLICIES = [
    # (category, method, rate, useful_life_years, salvage_rate)
    ('land', 'straight_line', 0.00, 50, 0.00),
    ('building', 'straight_line', 0.02, 50, 0.10),
    ('vehicle', 'diminishing_balance', 0.20, 8, 0.10),
    ('other', 'straight_line', 0.10, 10, 0.10),
]


def seed(apps, schema_editor):
    ItemCatalog = apps.get_model('catalog', 'ItemCatalog')
    DepreciationPolicy = apps.get_model('catalog', 'DepreciationPolicy')

    for title, category, specs in DEFAULT_ITEMS:
        ItemCatalog.objects.get_or_create(
            title=title,
            category=category,
            defaults={'specs': specs, 'confidence_default': 0.9},
        )

    for category, method, rate, life, salvage in DEFAULT_POLICIES:
        DepreciationPolicy.objects.get_or_create(
            category=category,
            method=method,
            defaults={
                'default_rate': rate,
                'useful_life_years': life,
                'salvage_rate': salvage,
            },
        )


def unseed(apps, schema_editor):
    # Do not delete on reverse — keep seeded data safe.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('catalog', '0001_initial'),
    ]
    operations = [
        migrations.RunPython(seed, unseed),
    ]
