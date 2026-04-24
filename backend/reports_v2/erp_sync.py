"""
ErpSyncService stub (Feature #13 — D2).

Provides a disabled-by-default hook that can be wired to an external ERP.
Enable via ``settings.ERP_SYNC_ENABLED = True`` when the real integration
is ready.
"""
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

ERP_SYNC_ENABLED = getattr(settings, 'ERP_SYNC_ENABLED', False)


def post_item_to_erp(report_item) -> bool:
    """Push a ReportItem to the external ERP system.

    Returns True on success.  Currently a no-op stub that logs the call.
    """
    if not ERP_SYNC_ENABLED:
        return False

    logger.info(
        'ErpSyncService.post_item_to_erp called for ReportItem #%s (project=%s)',
        report_item.id,
        report_item.project_id,
    )

    # TODO: implement real ERP HTTP call here.
    return False
