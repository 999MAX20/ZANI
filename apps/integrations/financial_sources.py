"""Read contract for a future verified accounting adapter, never generic events.

A registered reader receives (connector, start_date, end_date) and returns local
snapshot candidates for that exact period. It must not perform network I/O.
Completeness and reconciliation must be proven by the provider's reviewed import
contract before persisting a candidate. A connected flag or successful health
check is insufficient. No production provider currently implements this contract.
"""
from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass(frozen=True)
class FinancialSnapshot:
    business_id: int
    connector_id: int
    sync_run_id: int
    period_start: date
    period_end: date
    currency: str
    receipts: Decimal
    refunds: Decimal
    receipt_count: int
    refund_count: int
    complete: bool
