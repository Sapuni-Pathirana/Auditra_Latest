"""
Depreciation calculator supporting:
  - Straight Line
  - Diminishing Balance
  - Units of Production
"""
from decimal import Decimal
from datetime import date


def compute_depreciation(
    method: str,
    purchase_value: Decimal,
    purchase_date: date,
    as_of: date = None,
    salvage_rate: Decimal = Decimal('0.10'),
    rate: Decimal = None,
    useful_life_years: int = 10,
    units_used: int = 0,
    units_lifetime: int = None,
) -> dict:
    """
    Returns:
        {
            'accumulated_depreciation': Decimal,
            'book_value': Decimal,
            'annual_depreciation': Decimal,
            'years_elapsed': float,
        }
    """
    if as_of is None:
        as_of = date.today()

    purchase_value = Decimal(str(purchase_value))
    salvage_value = purchase_value * Decimal(str(salvage_rate))
    depreciable_amount = purchase_value - salvage_value

    days_elapsed = (as_of - purchase_date).days
    years_elapsed = days_elapsed / 365.25

    if method == 'straight_line':
        if rate is None:
            rate = Decimal(str(1 / useful_life_years)) if useful_life_years else Decimal('0')
        annual = depreciable_amount * Decimal(str(rate))
        accumulated = min(annual * Decimal(str(years_elapsed)), depreciable_amount)

    elif method == 'diminishing_balance':
        if rate is None:
            rate = Decimal(str(1 / useful_life_years * 2)) if useful_life_years else Decimal('0')
        book = purchase_value
        accumulated = Decimal('0')
        full_years = int(years_elapsed)
        for _ in range(full_years):
            dep = book * Decimal(str(rate))
            accumulated += dep
            book -= dep
        # Partial year
        frac = Decimal(str(years_elapsed - full_years))
        accumulated += book * Decimal(str(rate)) * frac
        accumulated = min(accumulated, depreciable_amount)
        annual = purchase_value * Decimal(str(rate))

    elif method == 'units_of_production':
        if not units_lifetime:
            return {
                'accumulated_depreciation': Decimal('0'),
                'book_value': purchase_value,
                'annual_depreciation': Decimal('0'),
                'years_elapsed': years_elapsed,
            }
        per_unit = depreciable_amount / Decimal(str(units_lifetime))
        accumulated = min(per_unit * Decimal(str(units_used)), depreciable_amount)
        annual = Decimal('0')  # N/A for UoP

    else:
        accumulated = Decimal('0')
        annual = Decimal('0')

    book_value = max(purchase_value - accumulated, salvage_value)

    return {
        'accumulated_depreciation': round(accumulated, 2),
        'book_value': round(book_value, 2),
        'annual_depreciation': round(annual, 2),
        'years_elapsed': round(years_elapsed, 2),
    }
